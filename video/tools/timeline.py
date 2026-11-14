"""Lay narration units on a timeline, resolve shots/cues, and assemble the narration track.

Reads  narration.txt, build/units.json, shots.json
Writes build/timeline.json, build/narration.wav
"""
import os, sys, json, re
import numpy as np, soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BUILD = os.path.join(ROOT, "build")
sys.path.insert(0, HERE)
import narration

FPS = 30
LEAD_IN = 2.6        # music + black before the opening quote
OPEN_HOLD = 1.6      # hold after the opening quote
TITLE_DUR = 8.6      # title card
CARD_DUR = 4.2       # chapter card
CARD_GAP = 0.45      # card end -> first word
CH_END_PAD = 1.5     # last word -> next card
GAP_UNIT = 0.28      # between speech units inside a sentence
GAP_SENT = 0.62
GAP_PARA = 1.00
OUTRO_DUR = 19.0
XFADE = 1.0          # shot cross-fade
SR = 24000


def build():
    chapters = narration.parse()
    units = {u["id"]: u for u in json.load(open(os.path.join(BUILD, "units.json")))}
    shots_spec = json.load(open(os.path.join(ROOT, "shots.json"), encoding="utf-8"))
    t = 0.0
    tl = {"fps": FPS, "xfade": XFADE, "chapters": [], "cues": [], "units": [], "shots": [], "segments": []}
    audio = []          # (start_time, samples)
    unit_time, sent_time = {}, {}

    for ci, ch in enumerate(chapters):
        cid = ch["id"]
        ch_t0 = t
        if cid == "open":
            t += LEAD_IN
        elif cid == "pro":
            tl["segments"].append({"type": "title", "t0": t, "t1": t + TITLE_DUR})
            t += TITLE_DUR + CARD_GAP
        else:
            tl["segments"].append({"type": "card", "t0": t, "t1": t + CARD_DUR, "chapter": cid, "label": ch["label"],
                                   "title": ch["title"], "years": ch["years"]})
            t += CARD_DUR + CARD_GAP
        narr_t0 = t
        for si, s in enumerate(ch["sentences"]):
            if si > 0:
                t += GAP_PARA if s["para_before"] else GAP_SENT
            sent_time[s["id"]] = t
            for ui, u in enumerate(s["units"]):
                uid = f"{s['id']}.{ui + 1}"
                rec = units[uid]
                x, sr = sf.read(os.path.join(BUILD, rec["file"]), dtype="float32")
                assert sr == SR
                # gentle level matching between units (+-3 dB)
                act = x[np.abs(x) > 0.02]
                rms = float(np.sqrt((act ** 2).mean())) if len(act) else 0.1
                x = x * float(np.clip(0.11 / rms, 0.7, 1.41))
                d = len(x) / SR
                unit_time[uid] = (t, t + d)
                audio.append((t, x))
                tl["units"].append({"id": uid, "t0": round(t, 3), "t1": round(t + d, 3), "chapter": cid})
                # subtitle cues: split the unit's span by character count
                cues = rec["cues"]
                weights = [max(1, len(re.sub(r"[^一-鿿0-9]", "", c))) for c in cues]
                acc = 0
                for c, w in zip(cues, weights):
                    c0 = t + d * acc / sum(weights)
                    acc += w
                    c1 = t + d * acc / sum(weights)
                    tl["cues"].append({"t0": round(c0, 3), "t1": round(c1, 3), "text": c, "unit": uid, "chapter": cid})
                t += d
                if ui < len(s["units"]) - 1:
                    t += u["pause"] if u["pause"] is not None else GAP_UNIT
        narr_t1 = t
        if cid == "open":
            t += OPEN_HOLD
        else:
            t += CH_END_PAD
        tl["chapters"].append({"id": cid, "label": ch["label"], "title": ch["title"], "years": ch["years"],
                               "t0": round(ch_t0, 3), "narr_t0": round(narr_t0, 3), "narr_t1": round(narr_t1, 3),
                               "t1": round(t, 3)})
    tl["segments"].append({"type": "outro", "t0": t, "t1": t + OUTRO_DUR})
    t += OUTRO_DUR
    tl["duration"] = round(t, 3)
    tl["frames"] = int(round(t * FPS))

    # extend each cue until the next cue (max +0.9 s) so subtitles do not flicker in short gaps
    cues = tl["cues"]
    for i, c in enumerate(cues):
        nxt = cues[i + 1]["t0"] if i + 1 < len(cues) and cues[i + 1]["chapter"] == c["chapter"] else c["t1"] + 0.6
        c["t1"] = round(min(nxt, c["t1"] + 0.9), 3)

    # shots
    def anchor(a):
        if a in unit_time:
            return unit_time[a][0]
        if a in sent_time:
            return sent_time[a]
        raise KeyError(f"unknown anchor {a}")

    chmap = {c["id"]: c for c in tl["chapters"]}
    for cid, shots in shots_spec.items():
        c = chmap[cid]
        starts = []
        for i, sh in enumerate(shots):
            if i == 0 and "at" not in sh:
                starts.append(c["narr_t0"] - CARD_GAP - 0.2 if cid != "open" else 0.0)
            else:
                starts.append(anchor(sh["at"]) - sh.get("lead", 0.4))
        for i, sh in enumerate(shots):
            t0 = starts[i]
            t1 = starts[i + 1] if i + 1 < len(shots) else c["t1"] + 0.3
            assert t1 > t0 + 1.0, f"shot too short: {cid} #{i} {sh} ({t0:.2f}-{t1:.2f})"
            rec = dict(sh)
            rec.update({"chapter": cid, "t0": round(t0, 3), "t1": round(t1, 3)})
            for ln in rec.get("lines", []):
                if "at" in ln:
                    ln["t"] = round(anchor(ln["at"]) - 0.15, 3)
            for ln in rec.get("marks", []):
                if "at" in ln:
                    ln["t"] = round(anchor(ln["at"]) - 0.15, 3)
            tl["shots"].append(rec)
    tl["shots"].sort(key=lambda s: s["t0"])

    # narration track
    total = np.zeros(int((t + 1) * SR), dtype=np.float32)
    for t0, x in audio:
        i = int(round(t0 * SR))
        total[i:i + len(x)] += x
    sf.write(os.path.join(BUILD, "narration.wav"), total, SR)
    json.dump(tl, open(os.path.join(BUILD, "timeline.json"), "w"), ensure_ascii=False, indent=1)
    return tl


if __name__ == "__main__":
    tl = build()
    m, s = divmod(tl["duration"], 60)
    print(f"duration {int(m)}:{s:05.2f}  frames {tl['frames']}  shots {len(tl['shots'])}  cues {len(tl['cues'])}")
    for c in tl["chapters"]:
        print(f"  {c['id']:5s} {c['t0']:7.2f} -> {c['t1']:7.2f}  ({c['t1'] - c['t0']:5.1f}s)  {c['title']}")
    for sh in tl["shots"]:
        if sh["t1"] - sh["t0"] > 16 or sh["t1"] - sh["t0"] < 3:
            print(f"  note: shot {sh.get('img') or sh.get('type')} @{sh['chapter']} lasts {sh['t1'] - sh['t0']:.1f}s")
