"""Mix narration over the score with voice-keyed ducking, then normalise loudness.

Reads  build/narration.wav (24 kHz mono), build/music.wav (48 kHz stereo), build/timeline.json
Writes build/mix.wav (48 kHz stereo, about -16 LUFS integrated, peaks under -1.5 dBTP)
"""
import os, json, subprocess
import numpy as np, soundfile as sf, librosa

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); BUILD = os.path.join(ROOT, "build")
SR = 48000
MUSIC_OPEN = 10 ** (12 / 20)       # music gain where nobody speaks
MUSIC_DUCK = 10 ** (3.5 / 20)      # music gain under the voice
ATTACK, RELEASE = 0.25, 0.9        # seconds


def smooth_gate(active, sr, attack, release):
    """active: 0/1 per sample-block; returns a smoothed 0..1 curve (rise over `attack`, fall over `release`)."""
    out = np.empty_like(active, dtype=np.float64)
    a, r = 1.0 / max(1, attack * sr), 1.0 / max(1, release * sr)
    v = 0.0
    for i, x in enumerate(active):
        v = min(1.0, v + a) if x else max(0.0, v - r)
        out[i] = v
    return out


def limiter(x, ceiling, look=0.02, release=0.35):
    """Block-based look-ahead peak limiter for the music bus; returns a per-sample gain curve."""
    blk = 240
    nb = len(x) // blk + 1
    pk = np.abs(np.pad(x, ((0, nb * blk - len(x)), (0, 0)))).max(axis=1).reshape(nb, blk).max(axis=1)
    la = max(1, int(look * SR / blk))
    ahead = np.array([pk[i:i + la + 1].max() for i in range(nb)])
    want = np.minimum(1.0, ceiling / np.maximum(ahead, 1e-9))
    g = np.empty(nb); v = 1.0; r = 1.0 - np.exp(-blk / (release * SR))
    for i, w in enumerate(want):
        v = w if w < v else v + (w - v) * r
        g[i] = v
    return np.repeat(g, blk)[:len(x)]


def main():
    tl = json.load(open(os.path.join(BUILD, "timeline.json")))
    voice, vsr = sf.read(os.path.join(BUILD, "narration.wav"), dtype="float32")
    voice = librosa.resample(voice, orig_sr=vsr, target_sr=SR)
    music, msr = sf.read(os.path.join(BUILD, "music.wav"), dtype="float32")
    assert msr == SR
    n = int(round(tl["duration"] * SR))
    voice = np.pad(voice, (0, max(0, n - len(voice))))[:n]
    music = np.pad(music, ((0, max(0, n - len(music))), (0, 0)))[:n]

    # speech activity from the timeline (unit spans), with a little pre-roll so the dip lands before the word
    blk = 480                                              # 10 ms blocks
    act = np.zeros(n // blk + 1, dtype=bool)
    for u in tl["units"]:
        a = int((u["t0"] - 0.35) * SR) // blk; b = int((u["t1"] + 0.15) * SR) // blk
        act[max(0, a):b] = True
    # bridge short gaps between units so the music does not pump inside a sentence
    gaps, i = [], 0
    while i < len(act):
        if not act[i]:
            j = i
            while j < len(act) and not act[j]:
                j += 1
            if 0 < i and j < len(act) and (j - i) * blk / SR < 1.6:
                act[i:j] = True
            i = j
        else:
            i += 1
    g = smooth_gate(act.astype(np.float32), SR / blk, ATTACK, RELEASE)
    g = np.repeat(g, blk)[:n]
    gain = MUSIC_OPEN + (MUSIC_DUCK - MUSIC_OPEN) * g
    # fade the score in from silence and out at the very end
    fi = int(0.4 * SR); gain[:fi] *= np.linspace(0, 1, fi)
    fo = int(3.2 * SR); gain[-fo:] *= np.linspace(1, 0, fo) ** 1.5

    bus = music * gain[:, None]
    bus *= limiter(bus, ceiling=0.40)[:, None]
    mix = bus + voice[:, None] * 1.0
    mix *= limiter(mix, ceiling=10 ** (-5.6 / 20), look=0.005, release=0.12)[:, None]   # catch rare transients
    raw = os.path.join(BUILD, "mix.raw.wav")
    sf.write(raw, mix, SR, subtype="FLOAT")
    out = os.path.join(BUILD, "mix.wav")
    # two-pass loudness normalisation
    p1 = subprocess.run(["ffmpeg", "-hide_banner", "-i", raw, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                        capture_output=True, text=True).stderr
    m = json.loads(p1[p1.rindex("{"):p1.rindex("}") + 1])
    af = (f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    subprocess.check_call(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-af", af, "-ar", str(SR), "-c:a", "pcm_s16le", out])
    os.remove(raw)
    print("input loudness", m["input_i"], "LUFS, true peak", m["input_tp"], "->", out)


if __name__ == "__main__":
    main()
