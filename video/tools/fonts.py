"""Subset the (large) source fonts to the characters this film actually uses.

Usage: python3 tools/fonts.py <dir with full fonts>
Sources (SIL Open Font License): Noto Serif SC, Noto Sans SC, Ma Shan Zheng, Cormorant Garamond.
"""
import os, sys, glob, string, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
src = sys.argv[1]
text = set(string.printable) | set("—–·…“”‘’《》〈〉「」、，。；：？！（）　°")
for f in ["narration.txt", "shots.json", "credits.html", "web/engine.js", "web/style.css", "player/template.html"] + sys.argv[2:]:
    p = os.path.join(ROOT, f)
    if os.path.exists(p):
        text |= set(open(p, encoding="utf-8").read())
text -= set("\n\r\t")
os.makedirs(os.path.join(ROOT, "web/fonts"), exist_ok=True)
tf = os.path.join(ROOT, "build/font-chars.txt"); os.makedirs(os.path.dirname(tf), exist_ok=True)
open(tf, "w", encoding="utf-8").write("".join(sorted(text)))
FONTS = {"NotoSerifSC.ttf": "notoserifsc__NotoSerifSC[wght].ttf", "NotoSansSC.ttf": "notosanssc__NotoSansSC[wght].ttf",
         "MaShanZheng.ttf": "mashanzheng__MaShanZheng-Regular.ttf", "CormorantGaramond.ttf": "cormorantgaramond__CormorantGaramond[wght].ttf"}
for out, name in FONTS.items():
    subprocess.check_call([sys.executable, "-m", "fontTools.subset", os.path.join(src, name), f"--text-file={tf}",
                           f"--output-file={os.path.join(ROOT, 'web/fonts', out)}", "--layout-features=*", "--no-hinting", "--drop-tables+=DSIG"])
    print(out, os.path.getsize(os.path.join(ROOT, "web/fonts", out)) // 1024, "KB")
print("chars:", len(text))
