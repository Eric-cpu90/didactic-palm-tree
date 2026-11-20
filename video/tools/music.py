"""Compose and render the original underscore, aligned to the timeline.

A slow pentatonic score in A minor / C major: string pad + piano figures as a bed under the narration,
a short solo phrase on every chapter card, a fuller statement under the title and at the end.
Writes build/music.mid and build/music.wav (FluidSynth + FluidR3_GM soundfont, MIT licence).
"""
import os, sys, json, random, subprocess
import mido

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); BUILD = os.path.join(ROOT, "build")
SF2 = os.environ.get("SYS_SF2", "/usr/share/sounds/sf2/FluidR3_GM.sf2")
TPS = 480                      # ticks per second (tempo fixed at 60 bpm, 480 ticks per beat)
rnd = random.Random(1866)

NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
def n(name):                   # "A4" -> midi number
    return 12 * (int(name[-1]) + 1) + NOTE[name[0]]

CHORD = {"C": ("C", "E", "G"), "Am": ("A", "C", "E"), "F": ("F", "A", "C"), "G": ("G", "B", "D"),
         "Dm": ("D", "F", "A"), "Em": ("E", "G", "B"), "Fmaj7": ("F", "A", "C"), "Csus": ("C", "D", "G")}

PIANO, PAD, SOLO, HARP, BASS, BELL, HORN = range(7)
PROGRAM = {PIANO: 0, PAD: 49, SOLO: 42, HARP: 46, BASS: 43, BELL: 14, HORN: 60}
VOLUME = {PIANO: 92, PAD: 84, SOLO: 100, HARP: 78, BASS: 80, BELL: 70, HORN: 74}

events = []                    # (time_s, kind, channel, a, b)

def note(ch, pitch, t, dur, vel):
    t = max(0.0, t + rnd.uniform(-0.008, 0.008))
    vel = int(max(1, min(127, vel + rnd.randint(-3, 3))))
    events.append((t, "on", ch, pitch, vel))
    events.append((t + dur, "off", ch, pitch, 0))

def cc(ch, t, num, val):
    events.append((max(0.0, t), "cc", ch, num, int(val)))

def prog(ch, t, p):
    events.append((max(0.0, t), "pc", ch, p, 0))

def up(pc_name, lo):           # lowest pitch of that pitch-class at or above midi number lo
    p = NOTE[pc_name] + 12 * ((lo // 12))
    while p < lo:
        p += 12
    return p

def pad_bar(chord, t, d, vel=50, with_bass=True):
    r, th, fi = CHORD[chord]
    ov = 0.25
    for p in (up(r, 48), up(fi, 52), up(th, 57), up(r, 62)):
        note(PAD, p, t, d + ov, vel)
    if with_bass:
        note(BASS, up(r, 33), t, d + ov, vel - 6)

def piano_bar(chord, t, d, vel=46, style="arp"):
    r, th, fi = CHORD[chord]
    lo = up(r, 45)
    tones = [lo, up(fi, lo), up(r, lo + 5), up(th, lo + 12), up(fi, lo + 12), up(th, lo + 12), up(r, lo + 5), up(fi, lo)]
    cc(PIANO, t + 0.02, 64, 127)
    if style == "arp":
        step = d / 8
        for i, p in enumerate(tones):
            note(PIANO, p, t + i * step, step * 2.2, vel + (6 if i == 0 else 0) - (3 if i % 2 else 0))
    elif style == "half":       # two broken figures per bar
        step = d / 4
        for i, p in enumerate([tones[0], tones[2], tones[1], tones[3]]):
            note(PIANO, p, t + i * step, step * 2.5, vel + (5 if i == 0 else -2))
    elif style == "sparse":     # one rolled chord
        for i, p in enumerate([tones[0], tones[1], tones[3]]):
            note(PIANO, p, t + i * 0.16, d * 0.9, vel - 2 * i)
    elif style == "pulse":      # steady quarter notes, more resolve
        step = d / 4
        for i in range(4):
            note(PIANO, tones[0] if i % 2 == 0 else tones[1], t + i * step, step * 0.9, vel + (6 if i == 0 else 0))
            note(PIANO, tones[3], t + i * step, step * 0.9, vel - 8)
            note(PIANO, tones[4], t + i * step, step * 0.9, vel - 10)
    cc(PIANO, t + d - 0.06, 64, 0)

def phrase(ch, notes, t, beat, vel=78, legato=1.02):
    """notes: list of (pitch name or None, beats)"""
    x = t
    for name, b in notes:
        if name:
            note(ch, n(name), x, b * beat * legato, vel)
        x += b * beat
    return x

def harp_roll(chord, t, vel=58, octaves=3, step=0.085, lo=48):
    r, th, fi = CHORD[chord]
    p0 = up(r, lo)
    seq = []
    for o in range(octaves):
        seq += [p0 + 12 * o, up(th, p0) + 12 * o, up(fi, p0) + 12 * o]
    seq.append(p0 + 12 * octaves)
    for i, p in enumerate(seq):
        note(HARP, p, t + i * step, 2.6, vel + i)

# ----------------------------------------------------------------------------- sections
SECTIONS = {
    #        progression (cycled)                         bed style   pad vel  solo program   card phrase
    "ch1": (["C", "Am", "F", "G"],                         "arp",      46, 73, [("G4", 1), ("A4", 1), ("C5", 1), ("D5", .5), ("E5", 2.5)]),
    "ch2": (["Am", "F", "C", "G", "Am", "F", "Dm", "Em"],  "half",     48, 68, [("E4", 1), ("A4", 1), ("C5", 1), ("B4", .5), ("A4", 2.5)]),
    "ch3": (["Am", "Em", "F", "C", "Dm", "Am", "F", "G"],  "arp",      48, 40, [("A4", 1), ("C5", 1), ("D5", 1), ("E5", .5), ("G5", 2.5)]),
    "ch4": (["Am", "Am", "Dm", "Em", "Am", "F", "Dm", "Em"], "half",   52, 42, [("A3", 1), ("E4", 1), ("D4", 1), ("C4", .5), ("A3", 2.5)]),
    "ch5": (["C", "G", "Am", "F", "C", "G", "F", "G"],     "pulse",    54, 60, [("C4", 1), ("G4", 1), ("A4", 1), ("G4", .5), ("C5", 2.5)]),
    "ch6": (["Am", "Em", "F", "C", "Dm", "Am", "Dm", "Em"], "half",    50, 68, [("E5", 1), ("D5", 1), ("C5", 1), ("A4", .5), ("E4", 2.5)]),
    "ch7": (["C", "F", "Am", "G", "C", "F", "G", "G"],     "pulse",    52, 60, [("G3", 1), ("C4", 1), ("D4", 1), ("E4", .5), ("G4", 2.5)]),
    "ch8": (["Am", "F", "Dm", "Am", "F", "C", "Dm", "Em"], "sparse",   46, 42, [("E4", 1), ("D4", 1), ("C4", 1), ("D4", .5), ("A3", 2.5)]),
    "end": (["C", "Am", "F", "G"],                         "arp",      52, 40, [("E5", 1), ("G5", 1), ("A5", 1), ("G5", .5), ("C6", 2.5)]),
}


def compose(tl):
    ch = {c["id"]: c for c in tl["chapters"]}
    units = {u["id"]: u for u in tl["units"]}
    for c in PROGRAM:
        prog(c, 0, PROGRAM[c]); cc(c, 0, 7, VOLUME[c]); cc(c, 0, 10, {PIANO: 58, PAD: 64, SOLO: 70, HARP: 44, BASS: 64, BELL: 64, HORN: 80}[c])
        cc(c, 0, 91, 90)

    # ---- opening: bell, low pedal, a few high piano notes under the quotation
    t_title = [s for s in tl["segments"] if s["type"] == "title"][0]
    note(BELL, n("A2"), 0.5, 7.0, 54)
    note(PAD, n("A2"), 0.3, t_title["t0"] - 0.1, 40); note(PAD, n("E3"), 0.3, t_title["t0"] - 0.1, 38)
    note(BASS, n("A1"), 0.3, t_title["t0"] - 0.1, 40)
    for name, t, v in [("E5", 1.4, 44), ("A5", 2.4, 40), ("G5", 5.0, 40), ("E5", 5.9, 42), ("D5", 7.6, 38)]:
        note(PIANO, n(name), t, 3.0, v)
    cc(PIANO, 1.3, 64, 127); cc(PIANO, t_title["t0"] - 0.2, 64, 0)

    # ---- title + prologue (to the first chapter card)
    t0, t1 = t_title["t0"], ch["ch1"]["t0"]
    prog_chords = ["Am", "F", "C", "G", "Am", "F", "C", "G"]
    nb = len(prog_chords); bd = (t1 - t0) / nb
    prog(SOLO, t0 - 0.1, 42)
    for i, cdn in enumerate(prog_chords):
        t = t0 + i * bd
        pad_bar(cdn, t, bd, 56 if i < 2 else 46)
        piano_bar(cdn, t, bd, 50 if i < 2 else 42, "arp" if i < 2 else "half")
    harp_roll("Am", t0 + 0.05, 56)
    beat = bd / 4
    phrase(SOLO, [("A3", 1), ("C4", 1), ("D4", 1), ("E4", 1), ("G4", 1.5), ("E4", .5), ("D4", 2)], t0 + 0.4, beat, 84)

    # ---- chapters
    order = [c for c in ("ch1", "ch2", "ch3", "ch4", "ch5", "ch6", "ch7", "ch8", "end")]
    outro = [s for s in tl["segments"] if s["type"] == "outro"][0]
    for k, cid in enumerate(order):
        chords, style, pv, solo, card = SECTIONS[cid]
        s0 = ch[cid]["t0"]
        s1 = ch[order[k + 1]]["t0"] if k + 1 < len(order) else None
        if cid == "end":
            s1 = units["end.8.1"]["t0"] - 0.6           # the finale takes over from here
        L = s1 - s0
        nb = max(4, round(L / 4.0)); bd = L / nb; beat = bd / 4
        prog(SOLO, s0 - 0.2, solo)
        # the quiet passage around the death scene
        quiet = (units["ch8.4.1"]["t0"] - 0.5, units["ch8.6.1"]["t0"] - 0.3) if cid == "ch8" else None
        for i in range(nb):
            t = s0 + i * bd
            cdn = chords[i % len(chords)]
            if quiet and quiet[0] <= t + bd / 2 <= quiet[1]:
                # only a held low fifth
                note(PAD, n("A2"), t, bd + 0.3, 36); note(PAD, n("E3"), t, bd + 0.3, 34)
                continue
            first = i == 0
            pad_bar(cdn, t, bd, pv + (8 if first else 0))
            piano_bar(cdn, t, bd, (48 if first else 40) + (4 if style == "pulse" else 0), "arp" if first else style)
        harp_roll(chords[0], s0 + 0.05, 54)
        phrase(SOLO, card, s0 + 0.35, beat * 0.92, 82)
        if cid == "ch8":
            note(BELL, n("A2"), units["ch8.4.1"]["t0"] - 0.4, 8.0, 50)
            # three soft bell tones under the last words
            for uid, nm in (("ch8.5.2", "E4"), ("ch8.5.3", "D4"), ("ch8.5.4", "A3")):
                note(PIANO, n(nm), units[uid]["t0"] + 0.1, 3.5, 40)
        if cid == "ch5":
            # a brighter answer when the Republic is proclaimed
            t = units["ch5.4.2"]["t0"] - 0.2
            prog(HORN, t - 0.3, 60)
            phrase(HORN, [("C4", 1), ("E4", 1), ("G4", 2)], t, beat, 60)

    # ---- finale: from the last two lines through the outro
    f0 = units["end.8.1"]["t0"] - 0.6
    f1 = tl["duration"]
    fin = ["C", "Am", "F", "G", "C", "F", "G", "C"]
    L = outro["t0"] + 9.0 - f0
    bd = L / len(fin); beat = bd / 4
    prog(SOLO, f0 - 0.2, 40)
    for i, cdn in enumerate(fin):
        t = f0 + i * bd
        pad_bar(cdn, t, bd, 58 + i)
        piano_bar(cdn, t, bd, 48 + i, "arp")
        r, th, fi = CHORD[cdn]
        note(HORN, up(r, 48), t, bd, 46 + i)
    mel = [("E5", 1), ("G5", 1), ("A5", 1.5), ("G5", .5), ("E5", 2), ("D5", 1), ("C5", 1),
           ("A4", 1), ("C5", 1), ("D5", 1.5), ("E5", .5), ("D5", 3), (None, 1),
           ("E5", 1), ("G5", 1), ("A5", 1.5), ("C6", .5), ("A5", 2), ("G5", 1), ("E5", 1),
           ("D5", 1.5), ("E5", .5), ("D5", 1), ("C5", 1), ("C5", 4)]
    phrase(SOLO, mel, f0 + 0.2, beat, 86)
    # final chord: held strings, harp roll, last low bell; everything rings into the fade-out
    te = f0 + len(fin) * bd
    hold = f1 - te - 0.3
    for p in ("C2", "C3", "G3", "C4", "E4", "G4", "C5"):
        note(PAD, n(p), te, hold, 54)
    note(BASS, n("C2"), te, hold, 50)
    note(HORN, n("C4"), te, hold * 0.8, 44)
    harp_roll("C", te + 0.05, 60, octaves=4)
    harp_roll("C", te + 3.2, 50, octaves=3, lo=60)
    note(BELL, n("C3"), te + 0.1, 8.0, 52)
    cc(PIANO, te, 64, 127)
    for i, p in enumerate(("C3", "G3", "C4", "E4", "G4", "C5")):
        note(PIANO, n(p), te + 0.1 + i * 0.12, hold * 0.7, 50)


def write_midi(path):
    mid = mido.MidiFile(ticks_per_beat=TPS)
    tr = mido.MidiTrack(); mid.tracks.append(tr)
    tr.append(mido.MetaMessage("set_tempo", tempo=1000000, time=0))
    rank = {"pc": 0, "cc": 1, "off": 2, "on": 3}
    last = 0
    for t, kind, c, a, b in sorted(events, key=lambda e: (round(e[0] * TPS), rank[e[1]])):
        tick = int(round(t * TPS)); dt = tick - last; last = tick
        if kind == "on":
            tr.append(mido.Message("note_on", channel=c, note=a, velocity=b, time=dt))
        elif kind == "off":
            tr.append(mido.Message("note_off", channel=c, note=a, velocity=0, time=dt))
        elif kind == "cc":
            tr.append(mido.Message("control_change", channel=c, control=a, value=b, time=dt))
        else:
            tr.append(mido.Message("program_change", channel=c, program=a, time=dt))
    mid.save(path)


if __name__ == "__main__":
    tl = json.load(open(os.path.join(BUILD, "timeline.json")))
    compose(tl)
    midi = os.path.join(BUILD, "music.mid"); wav = os.path.join(BUILD, "music.wav")
    write_midi(midi)
    subprocess.check_call(["fluidsynth", "-ni", "-q", "-g", "0.55", "-r", "48000",
                           "-o", "synth.reverb.active=1", "-o", "synth.reverb.room-size=0.82", "-o", "synth.reverb.level=0.7",
                           "-o", "synth.reverb.damp=0.25", "-o", "synth.reverb.width=0.9", "-o", "synth.chorus.active=0",
                           "-F", wav, SF2, midi])
    print("notes:", sum(1 for e in events if e[1] == "on"), "->", wav)
