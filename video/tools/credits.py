"""Write CREDITS.md (image sources and licences) and build/subtitles.srt from the timeline."""
import os, json, re
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
man = json.load(open(os.path.join(ROOT, "assets/manifest.json"), encoding="utf-8"))
tl = json.load(open(os.path.join(ROOT, "build/timeline.json"), encoding="utf-8"))

used = {}
for s in tl["shots"]:
    def walk(n):
        if isinstance(n, dict):
            if "img" in n: used.setdefault(n["img"], s["t0"])
            for v in n.values(): walk(v)
        elif isinstance(n, list):
            for v in n: walk(v)
    walk(s)
used.setdefault("title_portrait", 9.0); used.setdefault("calli_txwg", 9.0)

def mmss(t): return f"{int(t // 60)}:{int(t % 60):02d}"
pd, cc = [], []
for k, t in sorted(used.items(), key=lambda kv: kv[1]):
    m = man[k]
    lic = m["license"] or "see source"
    artist = re.sub(r"\s+", " ", m["artist"] or "").strip()
    half = len(artist) // 2
    if artist and artist[:half] == artist[half:]:
        artist = artist[:half]
    if not artist or artist.lower().startswith("unknown"):
        artist = (re.sub(r"\s+", " ", m.get("credit") or "").strip() or "佚名")
    if not re.search(r"[A-Za-z\u4e00-\u9fff]{2,}", artist):
        artist = "佚名（详见 Commons 页面）"
    artist = artist.replace("|", "/")
    row = f"| {mmss(t)} | {m['title']} | {artist[:80]} | {lic} | [Commons]({m['source']}) |"
    (pd if lic.lower().startswith(("public domain", "no restriction", "pd", "cc0")) else cc).append(row)
head = "| 首次出现 | 文件 | 作者 / 来源 | 许可 | 链接 |\n|---|---|---|---|---|"
md = f"""# 《天下为公》图片与素材来源

全部图片来自维基共享资源（Wikimedia Commons），按其页面所载许可使用；片中对图片做了裁切、调色（统一为暖调黑白或降低饱和度）与缩放。

## 依知识共享许可使用的图片（需署名）

{head}
{chr(10).join(cc)}

## 公有领域 / CC0 图片

{head}
{chr(10).join(pd)}

## 其他素材

- 地图轮廓：Natural Earth（公有领域），经 world-atlas 2.0.2 数据包
- 旁白：Kokoro v1.1-zh 语音模型（Apache-2.0），经 sherpa-onnx 离线合成
- 配乐：为本片原创，以 FluidR3_GM 音色库（MIT）渲染
- 字体：思源宋体 / 思源黑体（Noto Serif SC / Noto Sans SC）、马善政毛笔楷书（Ma Shan Zheng）、Cormorant Garamond，均为 SIL Open Font License
"""
open(os.path.join(ROOT, "CREDITS.md"), "w", encoding="utf-8").write(md)

def ts(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
srt = []
for i, c in enumerate(tl["cues"], 1):
    srt.append(f"{i}\n{ts(c['t0'])} --> {ts(c['t1'])}\n{c['text']}\n")
open(os.path.join(ROOT, "build/subtitles.srt"), "w", encoding="utf-8").write("\n".join(srt))
print(len(cc), "CC images,", len(pd), "public-domain images,", len(srt), "subtitle cues")
