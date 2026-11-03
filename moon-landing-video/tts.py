"""Generate narration audio for every line in script.json and build timeline.json.

Usage: python3 tts.py <kokoro-model-dir>
Uses sherpa-onnx + Kokoro v1.1-zh (offline). Each line is cached by text hash.
"""
import hashlib, json, os, re, sys
import numpy as np, soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "build", "tts")
GAP = 0.35          # pause between lines
DEFAULT_LEAD = 1.3  # narration starts this long after a scene begins (covers transition)
DEFAULT_TAIL = 0.9

def clean(text):
    return re.sub(r"[“”「」‘’]", "", text)

def trim(x, sr, thr=0.008, keep=0.05):
    idx = np.where(np.abs(x) > thr)[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] - int(keep * sr)); b = min(len(x), idx[-1] + int(keep * sr))
    return x[a:b]

def main():
    script = json.load(open(os.path.join(HERE, "script.json"), encoding="utf-8"))
    os.makedirs(OUT, exist_ok=True)
    sid, speed = script["voice"]["sid"], script["voice"]["speed"]
    tts = None
    def synth(text):
        nonlocal tts
        if tts is None:
            import sherpa_onnx
            M = sys.argv[1]
            cfg = sherpa_onnx.OfflineTtsConfig(
                model=sherpa_onnx.OfflineTtsModelConfig(
                    kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
                        model=f"{M}/model.int8.onnx", voices=f"{M}/voices.bin", tokens=f"{M}/tokens.txt",
                        data_dir=f"{M}/espeak-ng-data", dict_dir=f"{M}/dict",
                        lexicon=f"{M}/lexicon-us-en.txt,{M}/lexicon-zh.txt"),
                    num_threads=4),
                rule_fsts=f"{M}/date-zh.fst,{M}/phone-zh.fst,{M}/number-zh.fst", max_num_sentences=1)
            tts = sherpa_onnx.OfflineTts(cfg)
        a = tts.generate(text, sid=sid, speed=speed)
        return np.array(a.samples, dtype=np.float32), a.sample_rate

    trans = script["transition"]
    timeline, t_end = [], 0.0
    for si, sc in enumerate(script["scenes"]):
        start = 0.0 if si == 0 else t_end - trans
        t = start + sc.get("lead", DEFAULT_LEAD)
        lines = []
        for li, ln in enumerate(sc["lines"]):
            text = clean(ln.get("v", ln["s"]))
            key = hashlib.sha1(f"{sid}|{speed}|{text}".encode()).hexdigest()[:12]
            path = os.path.join(OUT, f"{key}.wav")
            if not os.path.exists(path):
                x, sr = synth(text)
                x = trim(x, sr)
                sf.write(path, x, sr)
                print(f"[{sc['id']}:{li}] {len(x)/sr:.2f}s {text}", flush=True)
            dur = sf.info(path).duration
            lines.append({"s": ln["s"], "wav": os.path.relpath(path, HERE), "t0": round(t, 3), "t1": round(t + dur, 3)})
            t += dur + GAP + ln.get("after", 0.0)
        end = lines[-1]["t1"] + sc.get("tail", DEFAULT_TAIL)
        timeline.append({"id": sc["id"], "start": round(start, 3), "end": round(end, 3), "lines": lines})
        t_end = end
    json.dump({"duration": round(t_end, 3), "transition": trans, "scenes": timeline},
              open(os.path.join(HERE, "build", "timeline.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"total {t_end:.1f}s")

if __name__ == "__main__":
    main()
