"""Export the narration as an SRT subtitle file (output/china-moon-landing.srt)."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
tl = json.load(open(os.path.join(HERE, "build", "timeline.json"), encoding="utf-8"))
ts = lambda t: f"{int(t // 3600):02d}:{int(t % 3600 // 60):02d}:{int(t % 60):02d},{int(round((t % 1) * 1000)) % 1000:03d}"
lines = [l for s in tl["scenes"] for l in s["lines"]]
os.makedirs(os.path.join(HERE, "output"), exist_ok=True)
with open(os.path.join(HERE, "output", "china-moon-landing.srt"), "w", encoding="utf-8") as f:
    for i, l in enumerate(lines, 1):
        end = l['t1'] + 0.3 if i == len(lines) else min(l['t1'] + 0.3, lines[i]['t0'] - 0.15)
        f.write(f"{i}\n{ts(l['t0'] - 0.1)} --> {ts(end)}\n{l['s']}\n\n")
print(f"{len(lines)} subtitles")
