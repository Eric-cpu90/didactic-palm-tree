"""Render one still per shot (plus cards) and tile them into contact sheets: build/sheets/*.jpg"""
import json, os, subprocess, sys, glob
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
tl = json.load(open(os.path.join(ROOT, "build/timeline.json")))
frac = float(sys.argv[1]) if len(sys.argv) > 1 else 0.72
ts = [round(s["t0"] + (s["t1"] - s["t0"]) * frac, 2) for s in tl["shots"]]
ts += [round(g["t0"] + min(3.2, (g["t1"] - g["t0"]) * 0.6), 2) for g in tl["segments"]]
ts += [round(tl["segments"][-1]["t1"] - 5, 2)]
ts = sorted(set(ts))
d = os.path.join(ROOT, "build/stills"); os.makedirs(d, exist_ok=True)
for f in glob.glob(d + "/*.jpg"): os.remove(f)
subprocess.check_call(["node", os.path.join(HERE, "render.js"), "--stills", ",".join(map(str, ts)), "--dir", d])
files = sorted(glob.glob(d + "/*.jpg"))
out = os.path.join(ROOT, "build/sheets"); os.makedirs(out, exist_ok=True)
for f in glob.glob(out + "/*.jpg"): os.remove(f)
for i in range(0, len(files), 9):
    sheet = Image.new("RGB", (1920, 1080))
    for j, f in enumerate(files[i:i + 9]):
        sheet.paste(Image.open(f).resize((640, 360), Image.LANCZOS), ((j % 3) * 640, (j // 3) * 360))
    sheet.save(os.path.join(out, f"sheet_{i // 9:02d}.jpg"), quality=86)
print(len(files), "stills ->", (len(files) + 8) // 9, "sheets")
