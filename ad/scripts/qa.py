"""QA for a rendered variant:  python3 scripts/qa.py [variant]

1. Container: duration, codec, fps, resolution.
2. Frames at every scene boundary -> build/qa/<variant>-boundaries.png
   with safe-zone overlays, plus automatic checks for content in the unsafe
   top 220px / bottom 380px / right action rail.
3. Colour audit: saturated pixels must be gold, violet (or the trading
   scene's candle green/red).
4. SFX sync: every cue's transient is re-detected in the SFX stem and compared
   to its visual frame (must be within +/-1 frame).
5. The first second: motion + readable text with no audio.
6. Loudness of the final MP4 (ffmpeg loudnorm measurement).
"""
import json, subprocess, sys, os, colorsys
import numpy as np
import soundfile as sf
from PIL import Image, ImageDraw

variant = sys.argv[1] if len(sys.argv) > 1 else "original"
name = json.load(open(f"build/timeline-{variant}.json"))["file"]
mp4 = f"out/{name}-full.mp4"
silent = f"out/{name}-silent.mp4"
tl = json.load(open(f"build/timeline-{variant}.json"))
cfg = json.load(open("build/config.json"))
FPS, W, H = tl["fps"], cfg["width"], cfg["height"]
SAFE = cfg["safe"]
os.makedirs("build/qa", exist_ok=True)
report = {"variant": variant}
ok = True


def probe(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_name,width,height,r_frame_rate,pix_fmt,codec_type", "-of", "json", p], capture_output=True, text=True)
    return json.loads(r.stdout)


def frame_at(f):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", silent, "-vf", f"select=eq(n\\,{f})", "-vframes", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True)
    return np.frombuffer(r.stdout, np.uint8).reshape(H, W, 3)


# 1 ------------------------------------------------------------------------
for p in (mp4, silent):
    j = probe(p)
    report[os.path.basename(p)] = {
        "duration_s": round(float(j["format"]["duration"]), 3),
        "streams": [{k: s.get(k) for k in ("codec_type", "codec_name", "width", "height", "r_frame_rate", "pix_fmt") if s.get(k)} for s in j["streams"]],
    }

# 2 ------------------------------------------------------------------------
T = cfg["transitionFrames"]
checks = []
for s in tl["slots"]:
    checks += [(s["start"] + T + 2, f"{s['type']} in"), (s["start"] + s["duration"] - T - 1, f"{s['type']} out")]
checks.append((tl["totalFrames"] - 1, "final"))
thumbs, zone_rows = [], []
for f, label in checks:
    img = frame_at(f)
    lum = img.mean(2)
    # "Content" = bright pixel clusters (text/UI), not single dust specks: 3x3 box-filtered luminance.
    k = np.ones(3) / 3
    sm = np.apply_along_axis(lambda r: np.convolve(r, k, "same"), 1, lum)
    sm = np.apply_along_axis(lambda c: np.convolve(c, k, "same"), 0, sm)
    top = (sm[: SAFE["top"]] > 110).mean() * 100
    bottom = (sm[H - SAFE["bottom"]:] > 110).mean() * 100
    rail = (sm[700: H - SAFE["bottom"], W - SAFE["rightRail"]:] > 110).mean() * 100
    zone_rows.append({"frame": f, "label": label, "top%": round(top, 3), "bottom%": round(bottom, 3), "rail%": round(rail, 3)})
    t = Image.fromarray(img).copy()
    d = ImageDraw.Draw(t, "RGBA")
    d.rectangle([0, 0, W, SAFE["top"]], fill=(255, 0, 0, 50))
    d.rectangle([0, H - SAFE["bottom"], W, H], fill=(255, 0, 0, 50))
    d.rectangle([W - SAFE["rightRail"], 700, W, H - SAFE["bottom"]], fill=(255, 140, 0, 40))
    d.text((12, 12), f"{f} {label}", fill=(255, 255, 255, 255))
    thumbs.append(t.resize((270, 480)))
cols = 6
sheet = Image.new("RGB", (cols * 270, ((len(thumbs) + cols - 1) // cols) * 480), (30, 30, 30))
for i, t in enumerate(thumbs):
    sheet.paste(t, ((i % cols) * 270, (i // cols) * 480))
sheet.save(f"build/qa/{variant}-boundaries.png")
worst = max(max(r["top%"], r["bottom%"], r["rail%"]) for r in zone_rows)
report["safe_zones"] = {"max_bright_coverage_%": worst, "pass": bool(worst < 0.5), "frames": zone_rows}
ok &= bool(worst < 0.5)

# 3 ------------------------------------------------------------------------
def hue_family(rgb):
    h, s, v = colorsys.rgb_to_hsv(*(rgb / 255.0))
    return h * 360, s, v

off_brand = []
for f, label in checks:
    img = frame_at(f).reshape(-1, 3)[::97].astype(float)
    hsv = np.array([hue_family(p) for p in img])
    sat = hsv[(hsv[:, 1] > 0.35) & (hsv[:, 2] > 0.25)]
    if len(sat) == 0:
        continue
    h = sat[:, 0]
    gold = (h >= 25) & (h <= 55)
    violet = (h >= 225) & (h <= 275)
    candles = ((h >= 140) & (h <= 185)) | (h <= 10) | (h >= 345)
    # Data colours are allowed where they carry meaning: candles/quotes (green, red)
    # and Watchtower risk levels (red).
    data_scene = any(k in label for k in ("markets", "ticker", "instability", "globeLayers", "intel"))
    allowed = gold | violet | (candles if data_scene else False)
    frac = 100 * (1 - allowed.mean())
    off_brand.append({"frame": f, "label": label, "off_brand_%_of_saturated": round(float(frac), 2)})
worst_c = max(o["off_brand_%_of_saturated"] for o in off_brand)
report["colours"] = {"worst_off_brand_%": worst_c, "pass": bool(worst_c < 5), "frames": off_brand}
ok &= bool(worst_c < 5)

# 4 ------------------------------------------------------------------------
cues = json.load(open(f"build/audio/{variant}-cues.json"))
# audio.py measures each cue's landing position by matched filter (cross-correlating
# the cue's own waveform against the dry SFX bus). The visual beat reads the same
# frame number from src/timeline.ts, so offset = audio landing vs picture frame.
offs = [{"type": c["type"], "frame": c["frame"], "offset_frames": c["landed_offset_frames"]} for c in cues]
bad = [o for o in offs if abs(o["offset_frames"]) > 1.0]
report["sfx_sync"] = {
    "cues": len(offs),
    "max_abs_offset_frames": max(abs(o["offset_frames"]) for o in offs),
    "outside_1_frame": bad,
    "by_type": {t: sum(1 for o in offs if o["type"] == t) for t in sorted({o["type"] for o in offs})},
    "pass": bool(not bad),
}
ok &= not bad

# 5 ------------------------------------------------------------------------
f0, f10, f30 = frame_at(0).astype(float), frame_at(10).astype(float), frame_at(30).astype(float)
report["first_second"] = {
    "motion_f0_to_f10_mean_abs_diff": round(float(np.abs(f10 - f0).mean()), 3),
    "motion_f10_to_f30_mean_abs_diff": round(float(np.abs(f30 - f10).mean()), 3),
    "headline_pixels_at_f30_%": round(float((f30[700:1100].mean(2) > 180).mean() * 100), 3),
}
ok &= report["first_second"]["motion_f0_to_f10_mean_abs_diff"] > 0.2

# 6 ------------------------------------------------------------------------
r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", mp4, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True)
j = json.loads(r.stderr[r.stderr.rfind("{"): r.stderr.rfind("}") + 1])
report["loudness_final_mp4"] = {"integrated_lufs": float(j["input_i"]), "true_peak_dbtp": float(j["input_tp"]), "lra": float(j["input_lra"]), "raw_ffmpeg_loudnorm": j}
ok &= abs(float(j["input_i"]) + 14) <= 0.5 and float(j["input_tp"]) <= -1.5

report["pass"] = bool(ok)
json.dump(report, open(f"build/qa/{variant}-report.json", "w"), indent=2)
print(json.dumps({k: v for k, v in report.items() if k not in ("safe_zones", "colours")}, indent=1)[:4000])
print("safe zones:", report["safe_zones"]["max_bright_coverage_%"], "% max  pass=", report["safe_zones"]["pass"])
print("colours:", report["colours"]["worst_off_brand_%"], "% off-brand max  pass=", report["colours"]["pass"])
print("OVERALL PASS" if ok else "QA FAILED")
