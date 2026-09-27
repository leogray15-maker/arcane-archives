"""Synthesise the full soundtrack for one variant from build/timeline-<variant>.json.

    python3 scripts/audio.py [variant]

Everything is generated here: no licensed audio. Outputs (48 kHz stereo):
  build/audio/<variant>-vo.wav, -sfx.wav, -music.wav   stems
  build/audio/<variant>-premaster.wav                  summed mix
  public/audio/<variant>.wav                           mastered (-14 LUFS, <= -1.5 dBTP)
  build/audio/<variant>-cues.json                      where every SFX transient landed
"""
import json, os, subprocess, sys
import numpy as np
import soundfile as sf
from scipy import signal

SR = 48000
variant = sys.argv[1] if len(sys.argv) > 1 else "full"
tl = json.load(open(f"build/timeline-{variant}.json"))
cfg = json.load(open("build/config.json"))
FPS = tl["fps"]
N = int(round(tl["totalFrames"] / FPS * SR))
rs = np.random.default_rng(1234)  # deterministic
t_of = lambda n: np.arange(n) / SR
db = lambda d: 10 ** (d / 20)
os.makedirs("build/audio", exist_ok=True)
os.makedirs("public/audio", exist_ok=True)


def env_exp(n, tau):
    return np.exp(-t_of(n) / tau)


def ar(n, attack, tau):
    a = max(1, int(attack * SR))
    e = env_exp(n, tau)
    e[:a] *= np.linspace(0, 1, a) ** 2
    return e


def lp(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, "low", fs=SR, output="sos"), x)


def hp(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def sweep_filter(x, f0, f1, kind="band", q=1.5, block=256):
    """Time-varying filter by processing short blocks with a moving cutoff."""
    out = np.zeros_like(x)
    zi = None
    nb = len(x) // block + 1
    for b in range(nb):
        s = slice(b * block, (b + 1) * block)
        if s.start >= len(x):
            break
        f = f0 * (f1 / f0) ** (b / max(1, nb - 1))
        f = min(max(f, 30), SR / 2 - 2000)
        if kind == "band":
            sos = signal.butter(2, [f / (1 + 1 / q), f * (1 + 1 / q)], "band", fs=SR, output="sos")
        else:
            sos = signal.butter(2, f, "low", fs=SR, output="sos")
        if zi is None or zi.shape[0] != sos.shape[0]:
            zi = np.zeros((sos.shape[0], 2))
        out[s], zi = signal.sosfilt(sos, x[s], zi=zi)
    return out


def sine(freq, n, phase=0.0):
    f = np.broadcast_to(np.asarray(freq, dtype=float), (n,))
    return np.sin(2 * np.pi * np.cumsum(f) / SR + phase)


def pan(x, p=0.0):
    """Equal-power pan, p in [-1, 1]; returns (n, 2)."""
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], 1)


def widen(x, ms=9):
    """Cheap stereo width via Haas-style decorrelation."""
    d = int(ms / 1000 * SR)
    r = np.concatenate([np.zeros(d), x[:-d]])
    return np.stack([x, 0.6 * x + 0.4 * r], 1)


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) + 1e-9
    return x / m * peak


# ---------------------------------------------------------------- SFX ------
# Each returns (stereo array, pre) where `pre` is the number of samples before
# the transient, so the transient lands exactly on the cue frame.

def sfx_subDrop(c):
    n = int(1.6 * SR)
    f = 32 + 100 * np.exp(-t_of(n) / 0.18)
    body = sine(f, n) * ar(n, 0.004, 0.55)
    body = np.tanh(body * 2.2) * 0.8
    click = hp(rs.standard_normal(n), 2000) * ar(n, 0.0005, 0.006) * 0.5
    return widen(norm(body + click), 4), 0


def sfx_pop(c):
    n = int(0.25 * SR)
    thump = sine(70 + 60 * np.exp(-t_of(n) / 0.02), n) * ar(n, 0.002, 0.07)
    air = hp(rs.standard_normal(n), 3000) * ar(n, 0.001, 0.012) * 0.35
    return pan(norm(thump + air)), 0


def sfx_whoosh(c, length=0.7, lo=300, hi=4000, pre_frac=0.55):
    n = int(length * SR)
    x = sweep_filter(rs.standard_normal(n), lo, hi, q=1.2)
    x2 = sweep_filter(rs.standard_normal(n), hi, lo, q=1.2)
    e = np.sin(np.pi * np.clip(np.linspace(0, 1, n), 0, 1)) ** 2.5
    pk = int(pre_frac * n)
    L = x * e
    R = x2 * e
    # stereo pass-by: left leads, right trails
    panl = np.linspace(1.2, 0.5, n)
    return norm(np.stack([L * panl, R * (1.7 - panl)], 1)), pk


def sfx_whooshDeep(c):
    length = (c.get("length") or 60) / FPS
    n = int(length * SR)
    x = sweep_filter(rs.standard_normal(n), 120, 1800, kind="low")
    e = ar(n, 0.08, length / 3)
    rumble = sine(38 + 20 * np.exp(-t_of(n) / 0.4), n) * ar(n, 0.05, length / 2.5) * 0.9
    return widen(norm(x * e * 0.8 + rumble), 12), int(0.06 * SR)


PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]


def bell(f0, n, tau, partials=((1, 1), (2.01, 0.45), (2.76, 0.3), (4.07, 0.18), (5.4, 0.08))):
    out = np.zeros(n)
    for m, a in partials:
        out += a * sine(f0 * m, n, rs.random() * 6) * env_exp(n, tau / (m ** 0.6))
    return out * ar(n, 0.002, 10)


def sfx_chime(c):
    n = int(1.8 * SR)
    f = 587.33 * 2 ** (PENTA[int(c.get("pitch", 0)) % len(PENTA)] / 12)
    x = bell(f, n, 0.55)
    return pan(norm(x), ((int(c.get("pitch", 0)) % 3) - 1) * 0.35), 0


def sfx_tick(c):
    n = int(0.05 * SR)
    x = hp(rs.standard_normal(n), 3500) * ar(n, 0.0003, 0.004) + 0.5 * sine(5200, n) * ar(n, 0.0003, 0.006)
    return pan(norm(x), 0.15), 0


def sfx_flutter(c):
    n = int(0.45 * SR)
    x = np.zeros(n)
    pos = 0
    while pos < n - 2000:
        m = int(rs.uniform(0.006, 0.02) * SR)
        g = rs.uniform(0.4, 1.0) * (1 - pos / n)
        burst = bp(rs.standard_normal(m), rs.uniform(1500, 3000), rs.uniform(5000, 9000)) * np.hanning(m) * g
        x[pos:pos + m] += burst
        pos += int(rs.uniform(0.012, 0.03) * SR)
    return widen(norm(x), 7), 0


def sfx_zap(c):
    n = int(0.35 * SR)
    t = t_of(n)
    f = 90 * (1 + 0.3 * np.sin(2 * np.pi * 31 * t)) * (1 + int(c.get("pitch", 0)) % 4 * 0.12)
    saw = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR)
    buzz = lp(saw, 2500) * ar(n, 0.002, 0.09)
    crackle = hp(rs.standard_normal(n), 4000) * (rs.random(n) < 0.03) * ar(n, 0.001, 0.08) * 3
    hum = sine(120, n) * ar(n, 0.01, 0.2) * 0.4
    return pan(norm(np.tanh(2 * (buzz + crackle + hum))), rs.uniform(-0.5, 0.5)), 0


def sfx_sweep(c):
    length = (c.get("length") or 16) / FPS
    n = int(max(length, 0.3) * SR)
    x = sweep_filter(rs.standard_normal(n), 500, 6000, q=2.5)
    e = ar(n, length * 0.6, length * 0.5)
    return widen(norm(x * e), 10), int(0.02 * SR)


def sfx_ping(c):
    n = int(1.6 * SR)
    f = 1150 * float(c.get("pitch", 1))
    x = sine(f, n) * ar(n, 0.002, 0.28) + 0.25 * sine(f * 2.01, n) * ar(n, 0.002, 0.1)
    out = x.copy()
    for k, g in ((0.18, 0.35), (0.36, 0.15)):
        d = int(k * SR)
        out[d:] += x[:-d] * g
    return pan(norm(out), rs.uniform(-0.6, 0.6)), 0


def sfx_ding(c):
    i = int(c.get("pitch", 0))
    n = int(2.2 * SR)
    f0 = 523.25 * 2 ** ([0, 4, 7, 11, 12][min(i, 4)] / 12)
    glide = f0 * (1 - 0.06 * np.exp(-t_of(n) / 0.03))  # rising into pitch
    x = np.zeros(n)
    for m, a in ((1, 1), (2, 0.5), (3.01, 0.25), (4.2, 0.12)):
        x += a * sine(glide * m, n) * env_exp(n, 0.9 / m ** 0.5)
    x *= ar(n, 0.002, 10)
    if i == 4:  # the Master tier: full chord + shimmer
        for s in (7, 12, 16):
            x += 0.5 * bell(f0 * 2 ** (s / 12), n, 1.2)
        x += hp(rs.standard_normal(n), 7000) * ar(n, 0.05, 0.5) * 0.15
    return widen(norm(x), 6), 0


def sfx_shing(c):
    n = int(0.9 * SR)
    t = t_of(n)
    metal = sum(a * sine(f * (1 + 0.04 * t), n) for f, a in ((3150, 1), (4730, 0.6), (6210, 0.4), (8120, 0.25)))
    scrape = bp(rs.standard_normal(n), 3000, 11000) * ar(n, 0.04, 0.12)
    x = metal * ar(n, 0.02, 0.35) * 0.5 + scrape
    return widen(norm(x), 5), int(0.03 * SR)


def sfx_riser(c):
    length = (c.get("length") or 60) / FPS
    n = int(length * SR)
    t = t_of(n)
    p = t / length
    noise = sweep_filter(rs.standard_normal(n), 300, 9000, q=1.5)
    f = 110 * 2 ** (p * 2.5)
    tone = sum(sine(f * d, n) for d in (1, 1.006, 0.994)) / 3
    x = (noise * 0.7 + lp(signal.sawtooth(2 * np.pi * np.cumsum(f) / SR), 3000) * 0.35 + tone * 0.3) * p ** 2.2
    x[-int(0.004 * SR):] *= np.linspace(1, 0, int(0.004 * SR))  # hard stop on the hit
    return widen(norm(x), 11), n


def sfx_bassHit(c):
    n = int(3.2 * SR)
    f = 38 + 70 * np.exp(-t_of(n) / 0.09)
    boom = np.tanh(2.5 * sine(f, n) * ar(n, 0.002, 0.9)) * 0.9
    body = lp(rs.standard_normal(n), 400) * ar(n, 0.001, 0.25) * 0.8
    crack = hp(rs.standard_normal(n), 1500) * ar(n, 0.0005, 0.03) * 0.6
    tail = bell(73.42, n, 2.0) * 0.4
    return widen(norm(boom + body + crack + tail), 14), 0


SFX = {k[4:]: v for k, v in globals().items() if k.startswith("sfx_")}


# ---------------------------------------------------------------- reverb ---
def reverb(x, seconds=2.2, mix=0.22, seed=5):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    ir = r.standard_normal((n, 2)) * np.exp(-t_of(n) / (seconds / 5))[:, None]
    ir = np.stack([lp(ir[:, 0], 6000), lp(ir[:, 1], 5500)], 1)
    ir /= np.sqrt((ir ** 2).sum(0))
    wet = np.stack([signal.fftconvolve(x[:, i], ir[:, i])[: len(x)] for i in range(2)], 1)
    return x * (1 - mix) + wet * mix * 1.4


# ---------------------------------------------------------------- tracks ---
def place(bus, clip, at_sample):
    s = max(0, at_sample)
    off = s - at_sample
    e = min(len(bus), at_sample + len(clip))
    if e > s:
        bus[s:e] += clip[off:off + (e - s)]


vo = np.zeros((N, 2))
for v in tl["vo"]:
    x, sr = sf.read(f"build/vo/{v['key']}.wav")
    assert sr == SR
    if x.ndim > 1:
        x = x.mean(1)
    place(vo, np.stack([x, x], 1) * db(3), int(round(v["frame"] / FPS * SR)))

sfx = np.zeros((N, 2))
cue_log = []
for c in tl["sfx"]:
    clip, pre = SFX[c["type"]](c)
    at = int(round(c["frame"] / FPS * SR))
    place(sfx, clip * db(c.get("gain", 0)), at - pre)
    cue_log.append({"type": c["type"], "frame": c["frame"], "sample": at, "_ref": (clip.mean(1), pre)})

# Verify where every cue's transient actually landed: cross-correlate a 300ms
# window of each clip (around its transient) against the dry SFX bus, searching
# +/-5 frames. Overlapping sounds don't move the correlation peak.
dry = sfx.mean(1)
D = int(5 / FPS * SR)
for c in cue_log:
    ref, pre = c.pop("_ref")
    a, b = max(0, pre - int(0.05 * SR)), min(len(ref), pre + int(0.25 * SR))
    tmpl = ref[a:b]
    start = c["sample"] - (pre - a) - D
    seg = dry[max(0, start): start + len(tmpl) + 2 * D]
    if start < 0 or len(seg) < len(tmpl) + 2 * D or np.abs(tmpl).max() == 0:
        c["landed_offset_frames"] = 0.0
        continue
    corr = signal.fftconvolve(seg, tmpl[::-1], "valid")
    lag = int(np.argmax(corr)) - D
    c["landed_offset_frames"] = round(lag / SR * FPS, 3)
sfx = reverb(sfx, 1.8, 0.2)

# Music: dark ambient bed in D minor. Drones, a slow heartbeat pulse, air.
t = t_of(N)
hit = next((c["frame"] for c in tl["sfx"] if c["type"] == "bassHit"), None)
hit_s = int(round(hit / FPS * SR)) if hit is not None else N
drone = np.zeros(N)
for f, a in ((36.71, 1.0), (55.0, 0.6), (73.42, 0.5), (87.31, 0.25), (110.0, 0.2)):
    for d in (0.997, 1.0, 1.003):
        drone += a * signal.sawtooth(2 * np.pi * f * d * t + rs.random() * 6)
cut = 180 + 260 * (0.5 + 0.5 * np.sin(2 * np.pi * t / 9.0))
drone = sweep_filter(drone, 220, 700, kind="low") * 0.25 + lp(drone, 160) * 0.35
drone *= 0.7 + 0.3 * np.sin(2 * np.pi * t / 6.5)
pulse = np.zeros(N)
beat = int(SR * 1.0)  # 60 bpm heartbeat (lub-dub)
kick_n = int(0.35 * SR)
kick = sine(42 + 50 * np.exp(-t_of(kick_n) / 0.03), kick_n) * ar(kick_n, 0.003, 0.12)
for s in range(int(0.5 * SR), N, beat):
    place(pulse, kick, s)
    place(pulse, kick * 0.55, s + int(0.24 * SR))
air = bp(rs.standard_normal(N), 2500, 9000) * 0.03 * (0.6 + 0.4 * np.sin(2 * np.pi * t / 11))
pad = sum(sine(f, N, rs.random() * 6) * (0.5 + 0.5 * np.sin(2 * np.pi * t / p + k)) for k, (f, p) in enumerate(((293.66, 7), (349.23, 9), (440.0, 11), (523.25, 13))))
pad = lp(pad, 1200) * 0.05
music = np.stack([drone + pulse * 0.8 + air + pad, drone + pulse * 0.8 + air * 0.9 + pad * 1.1], 1)
# Arc: fade in from the first frame, build through the middle, vanish into the riser, bloom after the hit.
intro = np.clip(t / 1.2, 0, 1)
build = 0.75 + 0.25 * np.clip((t - 8) / 20, 0, 1)
pre_hit = np.ones(N)
drop_s = hit_s - int(1.2 * SR)
if hit is not None:
    pre_hit[drop_s:hit_s] = np.linspace(1, 0.15, hit_s - drop_s)
    post = np.clip((np.arange(N) - hit_s) / (0.4 * SR), 0, 1)
    pre_hit[hit_s:] = 0.15 + 0.95 * post[hit_s:]
music *= (intro * build * pre_hit)[:, None]
music = reverb(music, 3.0, 0.3, seed=9)

# Duck music ~10 dB under the voice (smoothed sidechain).
vo_env = np.abs(vo[:, 0])
win = int(0.03 * SR)
vo_env = np.convolve(vo_env, np.ones(win) / win, "same")
gate = (vo_env > 0.01).astype(float)
att, rel = int(0.04 * SR), int(0.35 * SR)
sc = signal.lfilter([1 / rel], [1, -(1 - 1 / rel)], gate)
sc = np.maximum(sc, signal.lfilter([1 / att], [1, -(1 - 1 / att)], gate[::-1])[::-1])
sc = np.clip(sc * 3, 0, 1)
duck = db(cfg["mix"]["duckDb"] * sc)
music_ducked = music * duck[:, None]

def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)

vo_bus = vo
sfx_bus = sfx * db(-5.5)
mus_bus = norm(music_ducked, 1) * db(-12)
mix = vo_bus + sfx_bus + mus_bus
mix[-int(0.25 * SR):] *= np.linspace(1, 0, int(0.25 * SR))[:, None] ** 2  # gentle end-of-file tail

for name, x in (("vo", vo_bus), ("sfx", sfx_bus), ("music", mus_bus), ("premaster", mix)):
    sf.write(f"build/audio/{variant}-{name}.wav", x.astype(np.float32), SR, subtype="FLOAT")
json.dump(cue_log, open(f"build/audio/{variant}-cues.json", "w"), indent=1)

# ---------------------------------------------------------------- master ---
def measure(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True)
    j = r.stderr[r.stderr.rfind("{"): r.stderr.rfind("}") + 1]
    return json.loads(j)

target, tp = cfg["mix"]["targetLufs"], cfg["mix"]["truePeakDb"]
src = f"build/audio/{variant}-premaster.wav"
out = f"public/audio/{variant}.wav"
gain = 0.0
for it in range(6):
    m0 = measure(src)
    gain += target - float(m0["input_i"]) if it == 0 else target - float(m["input_i"])
    # gain -> true-peak-aware limiter (4x oversampled via resample) -> 48k
    af = (
        f"volume={gain:.3f}dB,aresample=192000,"
        f"alimiter=limit={db(tp - 0.4):.4f}:attack=2:release=60:level=false,"
        "aresample=48000"
    )
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-af", af, "-c:a", "pcm_s24le", out], check=True)
    m = measure(out)
    I, TP = float(m["input_i"]), float(m["input_tp"])
    print(f"  master pass {it + 1}: gain {gain:+.2f} dB -> {I:.2f} LUFS, {TP:.2f} dBTP")
    if abs(I - target) <= 0.1 and TP <= tp:
        break

print(json.dumps({"variant": variant, "integrated_lufs": I, "true_peak_dbtp": TP, "lra": float(m["input_lra"]), "duration_s": N / SR}))
json.dump({"integrated_lufs": I, "true_peak_dbtp": TP, "lra": float(m["input_lra"]), "duration_s": N / SR}, open(f"build/audio/{variant}-loudness.json", "w"), indent=2)
