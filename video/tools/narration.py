"""Parse narration.txt into chapters / sentences / speech units / subtitle cues."""
import re, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

DIG = "零一二三四五六七八九"


def cardinal(n):
    n = int(n)
    if n < 10:
        return DIG[n]
    if n < 20:
        return "十" + (DIG[n % 10] if n % 10 else "")
    if n < 100:
        return DIG[n // 10] + "十" + (DIG[n % 10] if n % 10 else "")
    raise ValueError(n)


def spoken(text):
    """Turn display text into text for the speech engine (numerals -> Chinese readings)."""
    t = re.sub(r"(\d{4})年", lambda m: "".join(DIG[int(c)] for c in m.group(1)) + "年", text)
    t = re.sub(r"(\d{1,2})(月|日)", lambda m: cardinal(m.group(1)) + m.group(2), t)
    if re.search(r"\d", t):
        raise ValueError("unconverted digits in: " + text)
    return t


def display(text):
    """Subtitle form: drop trailing clause punctuation, keep quotes / dashes / question marks."""
    t = text.strip()
    t = re.sub(r"[，。；：、]+$", "", t)
    t = re.sub(r"[，。；]+(”)$", r"\1", t)
    return t


def parse(path=None):
    path = path or os.path.join(ROOT, "narration.txt")
    chapters, cur, para = [], None, False
    for raw in open(path, encoding="utf-8"):
        line = raw.rstrip("\n")
        if line.startswith("#"):
            continue
        if not line.strip():
            para = True
            continue
        if line.startswith("@"):
            cid, label, title, years = [x.strip() for x in line[1:].split("|")]
            cur = {"id": cid, "label": label, "title": title, "years": years, "sentences": []}
            chapters.append(cur)
            para = False
            continue
        sent = {"id": f"{cur['id']}.{len(cur['sentences']) + 1}", "units": [], "para_before": para}
        para = False
        for u in line.split(" / "):
            pm = re.search(r"\[([\d.]+)\]\s*$", u)
            pause = float(pm.group(1)) if pm else None
            if pm:
                u = u[: pm.start()]
            m = re.search(r"\{(.+)\}\s*$", u)
            say = m.group(1) if m else None
            if m:
                u = u[: m.start()]
            cues = [c.strip() for c in u.split(" | ")]
            full = "".join(cues)
            sent["units"].append({"text": full, "say": spoken(say or full), "cues": [display(c) for c in cues],
                                  "raw_cues": cues, "pause": pause})
        cur["sentences"].append(sent)
    return chapters


if __name__ == "__main__":
    chs = parse()
    total = 0
    for ch in chs:
        n = sum(len(re.sub(r"[^一-鿿0-9]", "", u["text"])) for s in ch["sentences"] for u in s["units"])
        total += n
        longest = max((len(c), c) for s in ch["sentences"] for u in s["units"] for c in u["cues"])
        print(f"{ch['id']:5s} {ch['title'] or '-':6s} sentences={len(ch['sentences']):2d} chars={n:4d} longest cue={longest[0]} {longest[1]}")
    print("total chars:", total)
