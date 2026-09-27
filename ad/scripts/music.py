"""Music for the v2 ads:  python3 scripts/music.py <ad-id>

Writes a real arrangement (MIDI -> MuseScore General soundfont via FluidSynth)
on the 120 BPM grid from build/v2-timeline-<id>.json, so every drum hit sits on
the frames the picture cuts and punches on.

  lead + pad       soundfont instruments (piano / celesta / pizzicato / e-piano, pads, strings)
  drums            soundfont TR-808 kit
  808 sub          synthesised, pitched to each bar's chord root
  risers, impact   reversed crash from the kit, filtered noise, sub boom

Mix: pedalboard reverb/delay/compression, kick sidechain pump, intro filter
sweep, then the same master as audio.py (-14 LUFS integrated, <= -1.5 dBTP).
Outputs public/audio/<id>.wav, stems in build/audio/, cue log for QA.
"""
import json, os, subprocess, sys, tempfile
import numpy as np
import soundfile as sf
from scipy import signal
import mido
from pedalboard import Pedalboard, Reverb, Delay, Compressor, LowpassFilter, HighpassFilter, Distortion, Gain

SR = 48000
SF = "/usr/share/sounds/sf3/MuseScore_General_Full.sf3"
ad_id = sys.argv[1]
tl = json.load(open(f"build/v2-timeline-{ad_id}.json"))
cfg = json.load(open("build/config.json"))
FPS, BPM = tl["fps"], tl["bpm"]
SPB = 60 / BPM  # seconds per beat
STEP = SPB / 4  # 16th
N = int(round(tl["totalFrames"] / FPS * SR))
music = tl["music"]
secs = tl["sections"]
chords = tl["chords"]
ROOT = music["root"]
rng = np.random.default_rng(sum(map(ord, ad_id)))
os.makedirs("build/audio", exist_ok=True)
os.makedirs("public/audio", exist_ok=True)
db = lambda d: 10 ** (d / 20)
t_of = lambda n: np.arange(n) / SR
TPB = 480  # MIDI ticks per beat
TPS = TPB // 4  # ticks per 16th


# ------------------------------------------------------------------ MIDI parts
def chord_notes(bar, octave_root):
    c = chords[bar]
    r = octave_root + c["off"]
    return [r, r + (3 if c["minor"] else 4), r + 7]


def write_midi(path, events, program, channel=0):
    """events: list of (start_step, length_steps, note, velocity)."""
    mid = mido.MidiFile(ticks_per_beat=TPB)
    tr = mido.MidiTrack()
    mid.tracks.append(tr)
    tr.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(BPM), time=0))
    if channel == 9:
        tr.append(mido.Message("control_change", control=0, value=127, channel=9, time=0))
    tr.append(mido.Message("program_change", program=program, channel=channel, time=0))
    msgs = []
    for st, ln, note, vel in events:
        msgs.append((st * TPS, 1, mido.Message("note_on", note=int(note), velocity=int(max(1, min(127, vel))), channel=channel)))
        msgs.append((int((st + ln) * TPS), 0, mido.Message("note_off", note=int(note), velocity=0, channel=channel)))
    msgs.sort(key=lambda m: (m[0], m[1]))
    now = 0
    for tick, _, m in msgs:
        m.time = tick - now
        now = tick
        tr.append(m)
    tr.append(mido.MetaMessage("end_of_track", time=TPB * 8))
    mid.save(path)


def render(midi_path, gain=0.6):
    out = midi_path.replace(".mid", ".wav")
    subprocess.run(["fluidsynth", "-ni", "-q", "-R", "0", "-C", "0", "-g", str(gain), "-r", str(SR), "-F", out, SF, midi_path], check=True, capture_output=True)
    x, sr = sf.read(out)
    assert sr == SR
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    y = np.zeros((N, 2))
    y[: min(N, len(x))] = x[:N]
    return y


lead_ev, pad_ev = [], []
LEAD_STEPS = [(0, 0, 100), (3, 2, 80), (6, 1, 86), (10, 0, 90), (12, 2, 72), (14, 1, 78)]  # (step, chord-tone idx, vel)
for b, sec in enumerate(secs):
    tones = chord_notes(b, ROOT + 24)
    pad = chord_notes(b, ROOT + 12)
    if sec in ("intro", "groove", "hit", "break"):
        pat = LEAD_STEPS if sec != "break" else LEAD_STEPS[:1] + LEAD_STEPS[3:4]
        for st, ti, vel in pat:
            n = tones[ti] + (12 if (b % 4 == 3 and st >= 10) else 0)
            lead_ev.append((b * 16 + st, 3, n, vel + rng.integers(-6, 6)))
        pad_ev += [(b * 16, 16, n, 62) for n in pad + [pad[0] + 12]]
    else:  # outro: one last chord, left to ring
        pad_ev += [(b * 16, 40, n, 70) for n in pad + [pad[0] + 12]]
        lead_ev.append((b * 16, 24, tones[0], 90))

DRUM_NOTE = {"kick": 36, "clap": 39, "hat": 42, "openhat": 46, "crash": 49}
drum_ev = [(h["step"], 2, DRUM_NOTE[h["kind"]], h["vel"]) for h in tl["hits"] if h["kind"] in DRUM_NOTE]

tmp = tempfile.mkdtemp(prefix=f"music-{ad_id}-")
write_midi(f"{tmp}/lead.mid", lead_ev, music["lead"])
write_midi(f"{tmp}/pad.mid", pad_ev, music["pad"], channel=1)
write_midi(f"{tmp}/drums.mid", drum_ev, 25, channel=9)  # TR-808 kit
write_midi(f"{tmp}/crash.mid", [(0, 8, 49, 120)], 25, channel=9)
lead = render(f"{tmp}/lead.mid", 0.9)
pad = render(f"{tmp}/pad.mid", 0.7)
drums = render(f"{tmp}/drums.mid", 0.9)
crash = render(f"{tmp}/crash.mid", 0.9)[: int(2.2 * SR)]


# ------------------------------------------------------------------ synthesised parts
def place(bus, clip, at):
    s, e = max(0, at), min(len(bus), at + len(clip))
    if e > s:
        bus[s:e] += clip[s - at: e - at]


def eight08(freq, length=0.9):
    n = int(length * SR)
    t = t_of(n)
    f = freq * (1 + 0.9 * np.exp(-t / 0.018))  # quick pitch drop = the 808 "knock"
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (length / 2.6))
    x[: int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    x = np.tanh(2.2 * x)  # harmonics so it reads on phone speakers
    return np.stack([x, x], 1)


sub = np.zeros((N, 2))
kicks = [h for h in tl["hits"] if h["kind"] == "kick"]
for h in kicks:
    bar = h["step"] // 16
    r = ROOT - 12 + chords[bar]["off"]
    while r < 33:
        r += 12
    f = 440 * 2 ** ((r - 69) / 12)
    nxt = [k for k in kicks if k["step"] > h["step"]]
    gap = (nxt[0]["step"] - h["step"]) * STEP if nxt else 1.0
    place(sub, eight08(f, min(1.1, gap + 0.05)) * db(-3), int(round(h["step"] * STEP * SR)))

fx = np.zeros((N, 2))
rise = np.zeros((N, 2))
cue_log = []


def riser(end_sample, seconds):
    n = int(seconds * SR)
    rev = crash[::-1][-n:] if n <= len(crash) else np.concatenate([np.zeros((n - len(crash), 2)), crash[::-1]])
    noise = rng.standard_normal(n)
    # noise swell, band rising
    out = np.zeros(n)
    blocks = 64
    for i in range(blocks):
        a, b = i * n // blocks, (i + 1) * n // blocks
        fc = 400 * (12000 / 400) ** (i / blocks)
        sos = signal.butter(2, [fc * 0.6, min(fc * 1.6, 20000)], "band", fs=SR, output="sos")
        out[a:b] = signal.sosfilt(sos, noise[a:b])
    out *= np.linspace(0, 1, n) ** 2.5 * 0.18
    x = np.stack([out, out], 1) + rev * 0.9
    place(rise, x, end_sample - n)


def impact(at):
    n = int(2.6 * SR)
    t = t_of(n)
    f = 34 + 60 * np.exp(-t / 0.07)
    boom = np.tanh(2.5 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.7)) * 0.9
    thud = signal.sosfilt(signal.butter(2, 300, "low", fs=SR, output="sos"), rng.standard_normal(n)) * np.exp(-t / 0.12) * 0.5
    x = boom + thud
    place(fx, np.stack([x, x], 1), at)


bar_s = lambda b: int(round(b * 16 * STEP * SR))
drop = music["drop"]
riser(bar_s(drop), 2 * SPB * 2)  # 4 beats of build into the drop
for b, sec in enumerate(secs):
    if sec == "break":
        riser(bar_s(b + 1), 4 * SPB)
for h in tl["hits"]:
    if h["kind"] == "impact":
        impact(int(round(h["step"] * STEP * SR)))

# ------------------------------------------------------------------ mix
kick_env = np.zeros(N)
for h in kicks + [x for x in tl["hits"] if x["kind"] == "impact"]:
    s = int(round(h["step"] * STEP * SR))
    n = int(0.28 * SR)
    e = np.exp(-t_of(n) / 0.09)
    kick_env[s: s + n] = np.maximum(kick_env[s: s + n], e[: len(kick_env[s: s + n])])
pump = (1 - 0.45 * kick_env)[:, None]  # ~5 dB duck on each kick

# Intro: lead + pad open up from a low-pass (the classic filtered intro).
def sweep_lowpass(x, end_sample, f0=500, f1=16000):
    y = x.copy()
    blocks = 96
    zi = None
    for i in range(blocks):
        a, b = i * end_sample // blocks, (i + 1) * end_sample // blocks
        fc = f0 * (f1 / f0) ** ((i / blocks) ** 1.6)
        sos = signal.butter(2, fc, "low", fs=SR, output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2, 2))
        for ch in range(2):
            y[a:b, ch], zi[:, ch, :] = signal.sosfilt(sos, x[a:b, ch], zi=zi[:, ch, :])
    return y

pb = lambda board, x: board(x.T.astype(np.float32), SR).T.astype(np.float64)
lead = pb(Pedalboard([HighpassFilter(180), Delay(delay_seconds=SPB * 0.75, feedback=0.28, mix=0.18), Reverb(room_size=0.55, wet_level=0.22, dry_level=0.85, width=1.0)]), lead)
pad = pb(Pedalboard([HighpassFilter(120), LowpassFilter(7000), Reverb(room_size=0.85, wet_level=0.35, dry_level=0.7, width=1.0)]), pad)
drums = pb(Pedalboard([Compressor(threshold_db=-14, ratio=3, attack_ms=5, release_ms=90), Distortion(drive_db=3), Gain(-2)]), drums)
sub = pb(Pedalboard([LowpassFilter(1400), Compressor(threshold_db=-10, ratio=3, attack_ms=2, release_ms=120)]), sub)
fx = pb(Pedalboard([Reverb(room_size=0.7, wet_level=0.25, dry_level=0.9, width=1.0)]), fx)
rise = pb(Pedalboard([HighpassFilter(200), Reverb(room_size=0.8, wet_level=0.3, dry_level=0.8, width=1.0)]), rise)

intro_end = bar_s(drop)
lead = sweep_lowpass(lead, intro_end)
pad = sweep_lowpass(pad, intro_end)
# Break bar: pull the top off again so the CTA hit lands bigger.
for b, sec in enumerate(secs):
    if sec == "break":
        a, e = bar_s(b), bar_s(b + 1)
        for x in (lead, pad):
            x[a:e] = pb(Pedalboard([LowpassFilter(1800)]), x[a:e])

# Gain staging by measurement, not guesswork: each stem is set to a target RMS
# over the bars where it matters. Melody sits on top; the 808 supports it
# instead of swamping it (phone speakers can't reproduce deep sub anyway).
groove = np.concatenate([np.arange(bar_s(b), bar_s(b + 1)) for b, s in enumerate(secs) if s == "groove"])
hitbars = np.concatenate([np.arange(bar_s(b), min(N, bar_s(b + 1))) for b, s in enumerate(secs) if s in ("hit", "outro")])
def rms_db(x, idx):
    return 20 * np.log10(np.sqrt(np.mean(x[idx] ** 2)) + 1e-12)
TARGET = {"lead": -21.0, "pad": -27.0, "drums": -20.5, "sub": -23.5}
stems = {}
for k, x in (("lead", lead * pump), ("pad", pad * pump), ("drums", drums), ("sub", sub)):
    stems[k] = x * db(TARGET[k] - rms_db(x, groove))
stems["fx"] = fx * db(-24.0 - rms_db(fx, hitbars))
breakbars = np.concatenate([np.arange(bar_s(b), bar_s(b + 1)) for b, s in enumerate(secs) if s == "break"])
stems["rise"] = rise * db(-27.0 - rms_db(rise, breakbars))
mix = sum(stems.values())
mix = pb(Pedalboard([Compressor(threshold_db=-10, ratio=2, attack_ms=20, release_ms=150)]), mix)
fade = int(0.35 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
for k, v in stems.items():
    sf.write(f"build/audio/{ad_id}-{k}.wav", v.astype(np.float32), SR, subtype="FLOAT")
sf.write(f"build/audio/{ad_id}-premaster.wav", mix.astype(np.float32), SR, subtype="FLOAT")

# ------------------------------------------------------------------ verify hits land on their frames
# Matched filter: each kick/clap's own waveform (from the drum stem at its exact
# time) must correlate best at zero lag within +/-3 frames in the full mix.
dmono = stems["drums"].mean(1)
mmono = signal.sosfilt(signal.butter(4, 150, "high", fs=SR, output="sos"), mix.mean(1))
D = int(3 / FPS * SR)
for h in tl["hits"]:
    if h["kind"] not in ("kick", "clap", "impact"):
        continue
    at = int(round(h["step"] * STEP * SR))
    L = int(0.08 * SR)
    if h["kind"] == "impact":
        # The impact is mostly sub: match it in its own band, against the full-band mix.
        L = int(0.3 * SR)
        tmpl = stems["fx"].mean(1)[at: at + L]
        seg = mix.mean(1)[max(0, at - D): at + L + D]
    else:
        tmpl = signal.sosfilt(signal.butter(4, 150, "high", fs=SR, output="sos"), dmono[at: at + L])
        seg = mmono[max(0, at - D): at + L + D]
    if len(seg) < L + 2 * D or np.abs(tmpl).max() == 0:
        continue
    corr = signal.fftconvolve(seg, tmpl[::-1], "valid")
    lag = int(np.argmax(corr)) - D
    # also check the transient itself sits on the picture frame
    cue_log.append({"type": h["kind"], "frame": h["frame"], "sample": at, "landed_offset_frames": round(lag / SR * FPS + (h["step"] * STEP * FPS - h["frame"]), 3), "masked": False})
json.dump(cue_log, open(f"build/audio/{ad_id}-cues.json", "w"), indent=1)

# ------------------------------------------------------------------ master (same chain as audio.py)
def measure(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True)
    return json.loads(r.stderr[r.stderr.rfind("{"): r.stderr.rfind("}") + 1])

target, tp = cfg["mix"]["targetLufs"], cfg["mix"]["truePeakDb"]
src = f"build/audio/{ad_id}-premaster.wav"
out = f"public/audio/{ad_id}.wav"
gain = target - float(measure(src)["input_i"])
for it in range(6):
    af = f"volume={gain:.3f}dB,aresample=192000,alimiter=limit={db(tp - 0.9):.4f}:attack=2:release=60:level=false,aresample=48000"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-af", af, "-c:a", "pcm_s24le", out], check=True)
    m = measure(out)
    I, TP = float(m["input_i"]), float(m["input_tp"])
    print(f"  master pass {it + 1}: gain {gain:+.2f} dB -> {I:.2f} LUFS, {TP:.2f} dBTP")
    if abs(I - target) <= 0.1 and TP <= tp - 0.35:  # headroom for the AAC encode
        break
    gain += target - I
print(json.dumps({"ad": ad_id, "integrated_lufs": I, "true_peak_dbtp": TP, "lra": float(m["input_lra"]), "duration_s": N / SR, "max_hit_offset_frames": max(abs(c["landed_offset_frames"]) for c in cue_log)}))
