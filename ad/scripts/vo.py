"""Generate the voiceover clips with Kokoro TTS and measure their timing.

Reads build/config.json, writes build/vo/<key>.wav (48 kHz, treated) and
src/generated/vo-timing.json ({key: {duration, lastWordOnset}}) which the
Remotion timeline imports so the animation locks to the real voice.
"""
import json, os, re, subprocess, sys, hashlib
import numpy as np, soundfile as sf

MODEL = os.environ.get("KOKORO_MODEL", "/opt/kokoro/kokoro-v1.0.onnx")
VOICES = os.environ.get("KOKORO_VOICES", "/opt/kokoro/voices-v1.0.bin")
cfg = json.load(open("build/config.json"))
voice = cfg["voice"]

def key(t): return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", t.lower()))

texts = []
for ad in cfg["ads"].values():
    for s in ad["scenes"]:
        for v in s["vo"]:
            if v["text"] not in texts: texts.append(v["text"])

os.makedirs("build/vo", exist_ok=True)
from kokoro_onnx import Kokoro
k = Kokoro(MODEL, VOICES)

def onset_of_last_word(x, sr):
    """Attack of the last stressed syllable: the last rise from a dip (<20% of
    peak) to >50% of peak. Nudged 50ms earlier so the visual lands on the word
    start rather than the vowel."""
    hop = int(sr * 0.01)
    env = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x) - hop, hop)])
    env = np.convolve(env, np.ones(3) / 3, "same") / env.max()
    for i in range(len(env) - 1, 12, -1):
        if env[i] >= 0.5 and env[i - 12:i].min() < 0.2:
            j = i - 12 + int(np.argmin(env[i - 12:i]))
            while j < i and env[j] < 0.2: j += 1
            return max(0.0, j * 0.01 - 0.05)
    return 0.0


def last_word(x, sr):
    """Onset of the last word, falling back to 60% through very short phrases
    where there's no clear dip before the final word."""
    o = onset_of_last_word(x, sr)
    d = len(x) / sr
    return o if o >= 0.3 * d else 0.6 * d

timing = {}
r = 2 ** (voice["pitchSemitones"] / 12)
for t in texts:
    kk = key(t)
    raw = f"build/vo/{kk}.raw.wav"
    out = f"build/vo/{kk}.wav"
    if os.path.exists(out) and not os.environ.get("FORCE_VO"):
        x, sr2 = sf.read(out)
        timing[kk] = {"duration": round(len(x) / sr2, 3), "lastWordOnset": round(float(last_word(x, sr2)), 3)}
        print(f"{t!r:60} {timing[kk]} (cached)")
        continue
    audio, sr = k.create(t.replace("'Archives'", "Archives"), voice=voice["id"], speed=voice["speed"], lang="en-gb")
    sf.write(raw, audio, sr)
    # Deeper + a touch of grit: formant-lowering pitch drop, warmth, presence, soft saturation, short room.
    chain = (
        f"asetrate={int(sr * r)},aresample=48000,atempo={1 / r:.5f},"
        "highpass=f=55,lowshelf=f=140:g=3,equalizer=f=320:t=q:w=1.2:g=-2,"
        "equalizer=f=3200:t=q:w=1:g=2.5,highshelf=f=9000:g=-2,"
        "acompressor=threshold=0.12:ratio=3:attack=8:release=120:makeup=1.6,"
        "asoftclip=type=tanh:param=1.2,"
        "aecho=0.8:0.5:28|47:0.10|0.06,"
        "silenceremove=start_periods=1:start_threshold=-50dB,areverse,"
        "silenceremove=start_periods=1:start_threshold=-50dB,areverse"
    )
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-af", chain, "-ar", "48000", "-ac", "1", out], check=True)
    x, sr2 = sf.read(out)
    timing[kk] = {"duration": round(len(x) / sr2, 3), "lastWordOnset": round(float(last_word(x, sr2)), 3)}
    print(f"{t!r:60} {timing[kk]}")

os.makedirs("src/generated", exist_ok=True)
json.dump(timing, open("src/generated/vo-timing.json", "w"), indent=2)
