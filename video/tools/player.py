"""Build the in-browser player (build/web/): web-sized images, AAC soundtrack, data files and index.html.

The page runs the same engine as the offline renderer, so it plays the film frame for frame without a video file.
Usage: python3 tools/player.py [<full font dir for re-subsetting>]
"""
import os, sys, json, shutil, subprocess, html, re
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
BUILD = os.path.join(ROOT, "build"); OUT = os.path.join(BUILD, "web")
sys.path.insert(0, HERE)
import narration

Image.MAX_IMAGE_PIXELS = None
tl = json.load(open(os.path.join(BUILD, "timeline.json"), encoding="utf-8"))
man = json.load(open(os.path.join(ROOT, "assets/manifest.json"), encoding="utf-8"))
for d in ("assets/img", "data", "audio", "web/fonts"):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)

# ---- images: at most 1920 x 1280, progressive JPEG
webman = {}
for k, m in man.items():
    src = os.path.join(ROOT, "assets", m["file"]); dst = os.path.join(OUT, "assets", m["file"])
    im = Image.open(src)
    if im.mode == "RGBA":
        im.thumbnail((1600, 1600), Image.LANCZOS); im.save(dst, optimize=True)
    else:
        im = im.convert("RGB"); im.thumbnail((1920, 1280), Image.LANCZOS)
        im.save(dst, quality=78, optimize=True, progressive=True)
    e = dict(m); e["w"], e["h"] = im.size
    if m.get("bg"):
        shutil.copy(os.path.join(ROOT, "assets", m["bg"]), os.path.join(OUT, "assets", m["bg"]))
    webman[k] = e
json.dump(webman, open(os.path.join(OUT, "assets/manifest.json"), "w"), ensure_ascii=False, separators=(",", ":"))
shutil.copy(os.path.join(ROOT, "assets/maps.json"), os.path.join(OUT, "assets/maps.json"))
shutil.copy(os.path.join(ROOT, "assets/grain.png"), os.path.join(OUT, "assets/grain.png"))
json.dump(tl, open(os.path.join(OUT, "data/timeline.json"), "w"), ensure_ascii=False, separators=(",", ":"))

# ---- soundtrack
aud = os.path.join(OUT, "audio/film.mp4")
if not os.path.exists(aud) or os.path.getmtime(aud) < os.path.getmtime(os.path.join(BUILD, "mix.wav")):
    subprocess.check_call(["ffmpeg", "-y", "-loglevel", "error", "-i", os.path.join(BUILD, "mix.wav"),
                           "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", aud])

# ---- page content
def fmt(t):
    t = int(t); return f"{t // 60}:{t % 60:02d}"
DUR = tl["duration"]
ch = {c["id"]: c for c in tl["chapters"]}
outro = [s for s in tl["segments"] if s["type"] == "outro"][0]
toc = [("open", "开篇", "题词", "世界潮流", 0.0), ("pro", "序章", "先行者", "1866 — 1925", ch["pro"]["t0"])]
toc += [(c["id"], c["label"], c["title"], c["years"].replace("—", "—"), c["t0"]) for c in tl["chapters"] if c["id"].startswith("ch") or c["id"] == "end"]
toc += [("outro", "片尾", "致谢", "", outro["t0"] - 0.6)]
toc_html = "\n".join(
    f'      <li><button type="button" data-id="{i}" data-t="{t:.2f}" aria-current="false"><span class="no">{html.escape(no)}</span>'
    f'<span class="name">{html.escape(name)}</span><span class="yr">{html.escape(yr)}</span><time>{fmt(t)}</time></button></li>'
    for i, no, name, yr, t in toc)
cuts = "".join(f'<span class="cut" style="left:{t / DUR * 100:.3f}%"></span>' for _, _, _, _, t in toc[1:])

units = {u["id"]: u for u in tl["units"]}
script = []
for c in narration.parse():
    meta = ch[c["id"]]
    head = {"open": "开篇 · 题词", "pro": "序章 · 先行者"}.get(c["id"], f'{meta["label"]} · {meta["title"]}')
    script.append(f'        <h3>{html.escape(head)}</h3>')
    para = []
    for s in c["sentences"]:
        if s["para_before"] and para:
            script.append("        <p>" + "".join(para) + "</p>"); para = []
        text = "".join(u["text"] for u in s["units"])
        para.append(f'<span class="s" data-t="{units[s["id"] + ".1"]["t0"]:.2f}">{html.escape(text)}</span>')
    if para:
        script.append("        <p>" + "".join(para) + "</p>")

used = {}
def walk(n, t):
    if isinstance(n, dict):
        if "img" in n: used.setdefault(n["img"], t)
        for v in n.values(): walk(v, t)
    elif isinstance(n, list):
        for v in n: walk(v, t)
for s in tl["shots"]:
    walk(s, s["t0"])
used.setdefault("title_portrait", ch["pro"]["t0"]); used.setdefault("calli_txwg", ch["pro"]["t0"])
rows, n_cc = [], 0
def author(m):
    a = re.sub(r"\s+", " ", m.get("artist") or "").strip()
    if a and a[:len(a) // 2] == a[len(a) // 2:]: a = a[:len(a) // 2]
    if not a or a.lower().startswith("unknown") or not re.search(r"[A-Za-z一-鿿]{2,}", a): a = "佚名"
    return a[:60]
for k, t in sorted(used.items(), key=lambda kv: (not (man[kv[0]]["license"] or "").upper().startswith("CC B"), kv[1])):
    m = man[k]; lic = m["license"] or "见来源页"
    if lic.upper().startswith("CC B"): n_cc += 1
    rows.append(f'            <tr><td class="t">{fmt(t)}</td><td><a href="{html.escape(m["source"])}" target="_blank" rel="noopener">'
                f'{html.escape(m["title"])}</a></td><td>{html.escape(author(m))}</td><td class="lic">{html.escape(lic)}</td></tr>')

calli = webman["calli_txwg"]
page = open(os.path.join(ROOT, "player/template.html"), encoding="utf-8").read()
mins, secs = divmod(int(round(DUR)), 60)
for k, v in {"{{TOC}}": toc_html, "{{SCRIPT}}": "\n".join(script), "{{CREDITS}}": "\n".join(rows), "{{CUTS}}": cuts,
             "{{DUR}}": f"{DUR:.2f}", "{{DUR_TEXT}}": f"{mins} 分 {secs:02d} 秒", "{{DUR_CLOCK}}": f"{mins}:{secs:02d}", "{{CALLI}}": calli["file"],
             "{{CALLI_W}}": str(calli["w"]), "{{CALLI_H}}": str(calli["h"]), "{{N_IMG}}": str(len(used)),
             "{{N_CC}}": str(n_cc), "{{N_PD}}": str(len(used) - n_cc)}.items():
    page = page.replace(k, v)
assert "{{" not in page
open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(page)

# ---- engine, styles, fonts (re-subset so the page's own text is covered)
if len(sys.argv) > 1:
    subprocess.check_call([sys.executable, os.path.join(HERE, "fonts.py"), sys.argv[1], os.path.join(OUT, "index.html")])
for f in ("engine.js", "style.css"):
    shutil.copy(os.path.join(ROOT, "web", f), os.path.join(OUT, "web", f))
for f in os.listdir(os.path.join(ROOT, "web/fonts")):
    shutil.copy(os.path.join(ROOT, "web/fonts", f), os.path.join(OUT, "web/fonts", f))

total = 0; files = []
for dp, _, fs in os.walk(OUT):
    for f in fs:
        p = os.path.join(dp, f); total += os.path.getsize(p); files.append(os.path.relpath(p, OUT))
big = max(files, key=lambda f: os.path.getsize(os.path.join(OUT, f)))
print(f"{len(files)} files, {total / 1e6:.1f} MB; largest {big} {os.path.getsize(os.path.join(OUT, big)) / 1e6:.1f} MB")
