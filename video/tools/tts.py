"""Synthesize every narration unit with Kokoro v1.1-zh (via sherpa-onnx), trim, verify with ASR.

Outputs build/tts/<unit>.wav and build/units.json (durations per unit).
Environment:
  SYS_MODELS  directory holding kokoro-multi-lang-v1_1/ and (optionally) the SenseVoice ASR model
  SYS_VOICE   speaker id (default 101 = zm_098), SYS_SPEED speech rate (default 1.0)
"""
import os, sys, json, re, hashlib
import numpy as np, soundfile as sf
import sherpa_onnx

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import narration

MODELS = os.environ.get("SYS_MODELS", os.path.join(ROOT, "models"))
VOICE = int(os.environ.get("SYS_VOICE", "101"))
SPEED = float(os.environ.get("SYS_SPEED", "1.0"))
BUILD = os.path.join(ROOT, "build")
OUT = os.path.join(BUILD, "tts")
os.makedirs(OUT, exist_ok=True)


def patched_lexicon():
    k = os.path.join(MODELS, "kokoro-multi-lang-v1_1")
    custom = [l.rstrip("\n") for l in open(os.path.join(ROOT, "lexicon-custom.txt"), encoding="utf-8") if l.strip()]
    words = {l.split(" ", 1)[0] for l in custom}
    dst = os.path.join(BUILD, "lexicon-zh.patched.txt")
    with open(dst, "w", encoding="utf-8") as f:
        for l in open(os.path.join(k, "lexicon-zh.txt"), encoding="utf-8"):
            if l.split(" ", 1)[0] not in words:
                f.write(l)
        f.write("\n".join(custom) + "\n")
    return dst


def make_tts(debug=False):
    k = os.path.join(MODELS, "kokoro-multi-lang-v1_1")
    cfg = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
                model=f"{k}/model.onnx", voices=f"{k}/voices.bin", tokens=f"{k}/tokens.txt",
                data_dir=f"{k}/espeak-ng-data", dict_dir=f"{k}/dict",
                lexicon=f"{k}/lexicon-us-en.txt,{patched_lexicon()}"),
            num_threads=4, provider="cpu", debug=debug),
        max_num_sentences=1)
    return sherpa_onnx.OfflineTts(cfg)


def make_asr():
    a = os.path.join(MODELS, "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17")
    if not os.path.exists(a):
        return None
    return sherpa_onnx.OfflineRecognizer.from_sense_voice(
        model=f"{a}/model.onnx", tokens=f"{a}/tokens.txt", num_threads=4, use_itn=False, language="zh")


def trim(x, sr, thresh_db=-46.0, pad=0.03):
    win = int(sr * 0.01)
    n = len(x) // win
    rms = np.sqrt((x[: n * win].reshape(n, win) ** 2).mean(axis=1) + 1e-12)
    db = 20 * np.log10(rms + 1e-9)
    idx = np.where(db > thresh_db)[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] * win - int(pad * sr))
    b = min(len(x), (idx[-1] + 1) * win + int(pad * sr))
    y = x[a:b].copy()
    f = int(sr * 0.006)
    y[:f] *= np.linspace(0, 1, f)
    y[-f:] *= np.linspace(1, 0, f)
    return y


def toneless(s):
    from pypinyin import lazy_pinyin
    return lazy_pinyin(re.sub(r"[^一-鿿]", "", s))


def edit(r, h):
    d = np.zeros((len(r) + 1, len(h) + 1), int)
    d[:, 0] = range(len(r) + 1)
    d[0, :] = range(len(h) + 1)
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + (r[i - 1] != h[j - 1]))
    return int(d[-1, -1])


def main():
    chapters = narration.parse()
    tts = make_tts()
    asr = make_asr()
    units, problems = [], []
    for ch in chapters:
        for s in ch["sentences"]:
            for ui, u in enumerate(s["units"]):
                uid = f"{s['id']}.{ui + 1}"
                key = hashlib.md5(f"{u['say']}|{VOICE}|{SPEED}|{open(os.path.join(ROOT, 'lexicon-custom.txt'), 'rb').read()!r}".encode()).hexdigest()[:10]
                wav = os.path.join(OUT, f"{uid}.{key}.wav")
                if not os.path.exists(wav):
                    au = tts.generate(u["say"], sid=VOICE, speed=SPEED)
                    x = trim(np.array(au.samples, dtype=np.float32), au.sample_rate)
                    sf.write(wav, x, au.sample_rate)
                x, sr = sf.read(wav, dtype="float32")
                rec = {"id": uid, "sentence": s["id"], "chapter": ch["id"], "text": u["text"], "say": u["say"],
                       "cues": u["cues"], "pause": u["pause"], "file": os.path.relpath(wav, BUILD),
                       "dur": round(len(x) / sr, 3), "rms": float(np.sqrt((x ** 2).mean()))}
                if asr is not None:
                    import librosa
                    st = asr.create_stream()
                    st.accept_waveform(16000, librosa.resample(x, orig_sr=sr, target_sr=16000))
                    asr.decode_stream(st)
                    hyp = st.result.text
                    e = edit(toneless(u["say"]), toneless(hyp))
                    rec["asr"] = hyp
                    if e:
                        problems.append((uid, e, u["say"], hyp))
                units.append(rec)
                print(uid, rec["dur"], u["say"], flush=True)
    json.dump(units, open(os.path.join(BUILD, "units.json"), "w"), ensure_ascii=False, indent=1)
    speech = sum(u["dur"] for u in units)
    chars = sum(len(re.sub(r"[^一-鿿]", "", u["say"])) for u in units)
    print(f"\nunits={len(units)} speech={speech:.1f}s chars={chars} rate={chars / speech:.2f} chars/s")
    print("ASR mismatches (toneless pinyin):")
    for p in problems:
        print("  ", p)


if __name__ == "__main__":
    main()
