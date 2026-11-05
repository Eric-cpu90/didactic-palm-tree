"""Build the soundtrack: narration + generative score (pentatonic pads, plucked strings) + sound effects.

Reads build/timeline.json and build/cues.json (written by `node render/render.js --cues`),
writes build/audio.wav (48 kHz stereo).
"""
import json, os
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly, oaconvolve, butter, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
rng = np.random.default_rng(2030)

tl = json.load(open(os.path.join(HERE, "build", "timeline.json"), encoding="utf-8"))
cues = json.load(open(os.path.join(HERE, "build", "cues.json"), encoding="utf-8"))
DUR = tl["duration"] + 0.5
N = int(DUR * SR)
t_all = np.arange(N) / SR

def lp(x, f, order=2):
    return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x, axis=0)
def hp(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x, axis=0)
def bp(x, f1, f2, order=2):
    return sosfilt(butter(order, [f1, f2], "band", fs=SR, output="sos"), x, axis=0)
def env_adsr(n, a, r, sustain=1.0):
    e = np.ones(n) * sustain
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, sustain, na) if na < n else np.linspace(0, sustain, n)[:na]
    if nr < n: e[-nr:] *= np.linspace(1, 0, nr) ** 2
    return e
def add(buf, x, t0, gain=1.0, pan=0.0):
    i0 = int(t0 * SR)
    if i0 >= len(buf) or i0 + len(x) <= 0: return
    if i0 < 0: x = x[-i0:]; i0 = 0
    x = x[: len(buf) - i0]
    if x.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        buf[i0:i0 + len(x), 0] += x * gain * l * 1.414
        buf[i0:i0 + len(x), 1] += x * gain * r * 1.414
    else:
        buf[i0:i0 + len(x)] += x * gain
def reverb_ir(seconds=2.8, decay=3.2, seed=1):
    n = int(seconds * SR); r = np.random.default_rng(seed)
    t = np.arange(n) / SR; e = np.exp(-decay * t)
    ir = np.stack([r.standard_normal(n) * e, r.standard_normal(n) * e], 1)
    ir = lp(ir, 6000); ir[:int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))[:, None]
    return ir / np.sqrt((ir ** 2).sum(0))
def reverb(x, mix=0.3, seconds=2.8, decay=3.2):
    ir = reverb_ir(seconds, decay)
    wet = np.stack([oaconvolve(x[:, 0], ir[:, 0])[: len(x)], oaconvolve(x[:, 1], ir[:, 1])[: len(x)]], 1)
    return x * (1 - mix) + wet * mix
def movavg(x, k):
    c = np.concatenate([[0.0], np.cumsum(x)]); h = k // 2
    i = np.arange(len(x)); a = np.clip(i - h, 0, len(x)); b = np.clip(i + h + 1, 0, len(x))
    return (c[b] - c[a]) / (b - a)
midi = lambda m: 440.0 * 2 ** ((m - 69) / 12)

# ---------------- section intensity ----------------
INT = {"opening": 0.55, "earthmoon": 0.5, "threesteps": 0.6, "timeline": 0.7, "chapter1": 0.85, "ce5stack": 0.6, "ce5launch": 0.95,
       "ce5loi": 0.65, "ce5sep": 0.6, "ce5descent": 0.75, "ce5sample": 0.55, "ce5ascent": 0.8, "ce5dock": 0.65, "ce5return": 0.8,
       "chapter2": 0.9, "hardware": 0.7, "progress": 0.7, "crewmap": 0.75, "crew1": 0.95, "crew2": 0.95, "crew3": 0.65, "crew4": 0.75,
       "crew5": 0.7, "crew6": 0.8, "crew7": 0.65, "crew8": 0.7, "crew9": 0.85, "crewrecap": 0.9, "future": 0.75, "ending": 1.0}
inten = np.zeros(N)
for s in tl["scenes"]:
    i0, i1 = int(s["start"] * SR), int(s["end"] * SR); inten[i0:i1] = np.maximum(inten[i0:i1], INT.get(s["id"], 0.6))
inten = movavg(inten, int(2.5 * SR))

# ---------------- score ----------------
def music():
    out = np.zeros((N, 2))
    # D minor: Dm  Bb  F  C | Dm  Gm  Bb  A(sus)  (4 s per chord)
    prog_ = [[50, 57, 62, 65, 69], [46, 53, 58, 62, 65], [41, 53, 57, 60, 65], [48, 55, 60, 64, 67],
             [50, 57, 62, 65, 69], [43, 55, 58, 62, 67], [46, 53, 58, 62, 65], [45, 52, 57, 62, 64]]
    CH = 4.0
    nchords = int(DUR / CH) + 2
    pad = np.zeros((N, 2))
    for c in range(nchords):
        notes = prog_[c % len(prog_)]; t0 = c * CH - 1.0; n = int((CH + 2.0) * SR)
        tt = np.arange(n) / SR; e = np.sin(np.pi * np.clip(tt / (CH + 2.0), 0, 1)) ** 1.5
        sig = np.zeros((n, 2))
        for j, m in enumerate(notes):
            f = midi(m + 12 if j > 0 else m)
            for det, pan in [(-0.12, -0.6), (0.12, 0.6)]:
                ph = rng.uniform(0, 2 * np.pi)
                w = np.sin(2 * np.pi * (f * (1 + det / 100)) * tt + ph) + 0.35 * np.sin(2 * np.pi * 2 * f * tt + ph) + 0.12 * np.sin(2 * np.pi * 3 * f * tt)
                g = 0.22 if j == 0 else 0.11
                sig[:, 0] += w * g * np.cos((pan + 1) * np.pi / 4); sig[:, 1] += w * g * np.sin((pan + 1) * np.pi / 4)
        add(pad, sig * e[:, None], t0)
    pad = lp(pad, 1800)
    # slow tremolo
    pad *= (0.85 + 0.15 * np.sin(2 * np.pi * 0.11 * t_all))[:, None]
    out += pad * 0.55
    # sub bass on roots
    bass = np.zeros(N)
    for c in range(nchords):
        m = prog_[c % len(prog_)][0] - 12; t0 = c * CH; n = int(CH * SR); tt = np.arange(n) / SR
        b = np.sin(2 * np.pi * midi(m) * tt) * env_adsr(n, 0.4, 1.2, 1.0)
        i0 = int(t0 * SR); bass[i0:i0 + n] += b[: max(0, min(n, N - i0))]
    out += np.stack([bass, bass], 1) * 0.16
    # guzheng-like plucks (Karplus-Strong) on D minor pentatonic
    scale = [62, 65, 67, 69, 72, 74, 77, 79, 81]
    plucks = np.zeros((N, 2))
    def ks(f, dur=2.6):
        n = int(dur * SR); p = max(2, int(SR / f)); buf = rng.uniform(-1, 1, p); y = np.zeros(n)
        for i in range(n):
            y[i] = buf[i % p]; buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * 0.996
        return y * np.exp(-np.arange(n) / SR * 1.4)
    cache = {}
    step = 0.5
    for i in range(int(DUR / step)):
        tt = i * step; ii = min(N - 1, int(tt * SR)); lvl = inten[ii]
        if rng.random() > 0.18 + 0.45 * lvl: continue
        if rng.random() < 0.5 and i % 2: continue
        c = int(tt // CH) % len(prog_); chord = prog_[c]
        cand = [m for m in scale if (m % 12) in [(x % 12) for x in chord] or rng.random() < 0.25]
        m = int(rng.choice(cand)); f = midi(m)
        if m not in cache: cache[m] = ks(f)
        add(plucks, cache[m], tt + rng.uniform(-0.02, 0.02), gain=0.22 * (0.5 + lvl), pan=float(rng.uniform(-0.7, 0.7)))
    plucks = hp(plucks, 180)
    out += plucks
    # bells for shimmer
    bells = np.zeros((N, 2))
    for i in range(int(DUR / 8)):
        tt = i * 8 + 2 + rng.uniform(-0.5, 0.5); n = int(3 * SR); x = np.arange(n) / SR
        m = int(rng.choice([86, 89, 91, 93])); b = (np.sin(2 * np.pi * midi(m) * x) + 0.3 * np.sin(2 * np.pi * midi(m) * 2.76 * x)) * np.exp(-x * 2.2)
        add(bells, b, tt, gain=0.05, pan=float(rng.uniform(-0.8, 0.8)))
    out += bells
    out = reverb(out, mix=0.38, seconds=3.2, decay=2.2)
    out *= (0.35 + 0.65 * inten)[:, None]
    return out

# ---------------- sound effects ----------------
def noise(n): return rng.standard_normal(n)
def brown(n):
    b = np.cumsum(noise(n)); b = hp(b, 15); return b / (np.abs(b).max() + 1e-9)
def sfx(kind, dur):
    if kind in ("launch", "launch_s"):
        d = max(dur, 3); n = int(d * SR); x = np.arange(n) / SR
        r = lp(brown(n), 260) * 2.2 + bp(noise(n), 200, 1200) * 0.25
        crack = (rng.random(n) < 0.002) * rng.standard_normal(n) * 3; r += bp(crack, 400, 3000) * 0.6
        e = np.clip(x / 1.2, 0, 1) * np.clip((d - x) / (d * 0.55), 0, 1)
        g = 0.9 if kind == "launch" else 0.45
        return np.tanh(r * e * 1.2) * g
    if kind == "burn":
        d = max(dur, 1); n = int(d * SR); x = np.arange(n) / SR
        r = bp(noise(n), 150, 900) * 0.6 + lp(brown(n), 150) * 0.8
        return r * np.clip(x / 0.3, 0, 1) * np.clip((d - x) / 0.6, 0, 1) * 0.32
    if kind in ("whoosh", "whoosh_s", "trans_slide", "trans_wipe", "trans_zoom", "trans_zoomin", "trans_iris"):
        d = 1.3 if kind == "whoosh" else 0.9; n = int(d * SR); x = np.arange(n) / SR
        nz = noise(n); out = np.zeros(n); y1 = 0.0; y2 = 0.0
        fc = 250 + 4200 * np.sin(np.pi * x / d) ** 2; a = 1 - np.exp(-2 * np.pi * fc / SR)
        for i in range(n):
            y1 += a[i] * (nz[i] - y1); y2 += a[i] * (y1 - y2); out[i] = y2
        out = hp(out, 120) * 2.5
        g = {"whoosh": 0.5, "whoosh_s": 0.3}.get(kind, 0.16)
        return out * np.sin(np.pi * x / d) ** 2 * g
    if kind in ("boom", "trans_flash"):
        n = int(4 * SR); x = np.arange(n) / SR
        f = 70 * np.exp(-x * 1.5) + 32
        b = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 1.1)
        b += lp(noise(n), 900) * np.exp(-x * 6) * 0.6
        if kind == "trans_flash": b = hp(noise(n), 3000) * np.clip(x / 0.5, 0, 1) * np.exp(-np.maximum(0, x - 0.5) * 5) * 0.2 + b * 0.3
        return b * 0.75
    if kind == "chime":
        n = int(3.5 * SR); x = np.arange(n) / SR; out = np.zeros(n)
        for m, dl in [(81, 0), (86, 0.12), (88, 0.24), (93, 0.36)]:
            i0 = int(dl * SR); xx = x[: n - i0]
            out[i0:] += (np.sin(2 * np.pi * midi(m) * xx) + 0.25 * np.sin(2 * np.pi * midi(m) * 3.01 * xx)) * np.exp(-xx * 2.0)
        return out * 0.12
    if kind == "tick":
        n = int(0.25 * SR); x = np.arange(n) / SR
        return (np.sin(2 * np.pi * 1320 * x) * np.exp(-x * 35) + 0.5 * np.sin(2 * np.pi * 2640 * x) * np.exp(-x * 50)) * 0.14
    if kind == "clunk":
        n = int(1.2 * SR); x = np.arange(n) / SR; out = lp(noise(n), 2500) * np.exp(-x * 40) * 0.8
        for f, dk in [(180, 9), (310, 12), (520, 16), (890, 22), (1430, 30)]: out += np.sin(2 * np.pi * f * x) * np.exp(-x * dk) * 0.35
        return out * 0.45
    if kind == "thud":
        n = int(1.5 * SR); x = np.arange(n) / SR
        return (np.sin(2 * np.pi * (60 * np.exp(-x * 4) + 40) * x) * np.exp(-x * 5) + lp(noise(n), 500) * np.exp(-x * 12) * 0.5) * 0.7
    if kind == "puff":
        n = int(0.5 * SR); x = np.arange(n) / SR
        return bp(noise(n), 800, 5000) * np.exp(-x * 9) * 0.25
    if kind == "scan":
        n = int(5 * SR); x = np.arange(n) / SR
        pulses = (np.sin(2 * np.pi * 2.0 * x) > 0.92).astype(float); pulses = lp(pulses, 60)
        return np.sin(2 * np.pi * 1800 * x) * pulses * 0.06 + np.sin(2 * np.pi * (500 + 300 * np.sin(2 * np.pi * 0.5 * x)) * x) * 0.012
    if kind == "drill":
        d = max(dur, 1); n = int(d * SR); x = np.arange(n) / SR
        s = np.sign(np.sin(2 * np.pi * 95 * x)) * 0.3 + bp(noise(n), 500, 3000) * 0.4
        return lp(s, 2500) * np.clip(x / 0.2, 0, 1) * np.clip((d - x) / 0.3, 0, 1) * 0.22
    if kind == "servo":
        d = max(dur, 0.8); n = int(d * SR); x = np.arange(n) / SR
        f = 420 + 160 * np.sin(np.pi * x / d)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * x / d) * 0.05
    if kind == "flag":
        return sfx("chime", 0) * 0.6
    if kind == "reentry":
        d = max(dur, 2); n = int(d * SR); x = np.arange(n) / SR
        r = lp(brown(n), 500) * 1.5 + bp(noise(n), 300, 2500) * 0.5
        return np.tanh(r * np.sin(np.pi * np.clip(x / d, 0, 1)) ** 1.2) * 0.5
    if kind == "rover":
        d = max(dur, 1); n = int(d * SR); x = np.arange(n) / SR
        return (np.sin(2 * np.pi * 110 * x) * 0.2 + bp(noise(n), 200, 1500) * 0.3) * np.sin(np.pi * x / d) * 0.25
    if kind in ("swell", "sweep"):
        d = max(dur, 1.5); n = int(d * SR); x = np.arange(n) / SR
        s = hp(noise(n), 2500) * 0.4 if kind == "swell" else np.sin(2 * np.pi * np.cumsum(200 + 600 * (x / d)) / SR) * 0.15
        return s * (x / d) ** 2 * np.clip((d - x) / 0.3, 0, 1) * (0.25 if kind == "swell" else 0.35)
    return np.zeros(1)

def effects():
    out = np.zeros((N, 2))
    for c in cues["cues"]:
        x = sfx(c["type"], c.get("dur", 0))
        if len(x) > 1: add(out, x, c["t"], gain=1.0, pan=0.0)
    return reverb(out, mix=0.22, seconds=2.0, decay=3.0)

def narration():
    out = np.zeros((N, 2)); env = np.zeros(N)
    for s in tl["scenes"]:
        for l in s["lines"]:
            x, sr = sf.read(os.path.join(HERE, l["wav"]), dtype="float64")
            if x.ndim > 1: x = x.mean(1)
            x = resample_poly(x, SR // 8000 * 1, sr // 8000 * 1) if sr != SR else x
            x = hp(x, 70)
            add(out, x, l["t0"], gain=1.0, pan=0.0)
            i0, i1 = int((l["t0"] - 0.25) * SR), int((l["t1"] + 0.35) * SR); env[max(0, i0):i1] = 1
    env = movavg(env, int(0.35 * SR))
    # gentle presence + compression-ish normalisation
    out = out / (np.abs(out).max() + 1e-9) * 0.82
    out = reverb(out, mix=0.06, seconds=0.8, decay=9)
    return out, env

if __name__ == "__main__":
    import sys
    # Default: background music only (subtitles carry the text). Opt in with --voice / --sfx.
    VOICE, SFX = "--voice" in sys.argv, "--sfx" in sys.argv
    print("music...", flush=True); m = music()
    m = m / (np.abs(m).max() + 1e-9) * (0.30 if VOICE else 0.8)
    mix = np.zeros_like(m)
    env = np.zeros(N)
    if VOICE:
        print("narration...", flush=True); v, env = narration()
        mix += v; m = m * (1 - 0.62 * env)[:, None]
    mix += m
    if SFX:
        print("effects...", flush=True); mix += effects() * 0.8 * (1 - 0.3 * env)[:, None]
    # fades
    fi, fo = int(1.0 * SR), int(2.5 * SR)
    mix[:fi] *= np.linspace(0, 1, fi)[:, None]; mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    mix = mix / (np.abs(mix).max() + 1e-9) * 0.93
    sf.write(os.path.join(HERE, "build", "audio.wav"), mix.astype(np.float32), SR, subtype="PCM_16")
    print(f"wrote build/audio.wav ({DUR:.1f}s)")
