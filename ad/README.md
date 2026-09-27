# The Arcane Archives: 9:16 trailer ad

A 1080×1920, 30fps vertical advert built entirely in code with Remotion (React) and three.js.
The voiceover, sound effects, music and mastering are all generated from the same timing map, so every render is deterministic.

## Deliverables (`out/`)

| File | What it is |
| --- | --- |
| `arcane-archives-ad-full.mp4` | H.264 + AAC 320k, mastered to -14 LUFS, true peak ≤ -1.5 dBTP |
| `arcane-archives-ad-silent.mp4` | The same picture with no audio track, for use with trending sounds |
| `arcane-archives-ad-cover.png` | 1080×1920 cover frame (the held CTA frame) |

## Cutting variants: edit one file

`src/ad.config.ts` holds everything you'd change:

- `brand`: name, URL and **CTA keyword** (`ARCHIVES`)
- `colors`: gold, violet, background and UI colours
- `scenes.<id>`: headline copy, VO lines and when each starts (`at`, in frames), and scene length (`duration`)
- `variants`: which scenes play and in what order. `full`, `trading` and `founder` ship ready to render
- `voice`, `mix`: TTS voice, pitch, music duck depth and loudness targets

Add a variant by adding a line to `variants`, e.g. `mindset: ["hook", "library", "connection", "rank", "cta"]`.
It becomes a Remotion composition automatically.

## Pipeline

```bash
npm install
bash scripts/render.sh full          # or: trading | founder
python3 scripts/qa.py full           # QA report + boundary contact sheet in build/qa/
npm run studio                       # live preview (run render.sh once first for audio)
```

`render.sh` runs these steps:

1. `scripts/export-timeline.ts` turns the config into `build/timeline-<variant>.json`: absolute frames for every scene, VO line and SFX cue. It warns if any VO line overlaps another or runs past its scene.
2. `scripts/vo.py` generates each VO line with Kokoro TTS (`bm_lewis`, a deep British male voice). It then lowers the pitch slightly, warms the tone and adds a touch of grit. It measures each clip's length and the onset of its last word and writes them to `src/generated/vo-timing.json`. The animation reads that file, so "think." in the hook slams on the spoken word.
3. `scripts/audio.py` synthesises every SFX with numpy/scipy, places each transient on its cue frame, builds the dark ambient music bed, ducks it 10 dB under the voice and masters with a 4× oversampled limiter and an iterative loudness pass.
4. Remotion renders the picture and ffmpeg muxes the full and silent cuts plus the cover.

`src/timeline.ts` is the timing map. Scenes read their beats from `sceneCues(id)` and the audio script reads the same numbers, so picture and sound can't drift apart.

## Requirements

- Node 20+, Python 3.10+, ffmpeg
- `pip install kokoro-onnx soundfile numpy scipy pillow`
- The Kokoro model files `kokoro-v1.0.onnx` and `voices-v1.0.bin` from the kokoro-onnx GitHub releases, placed in `/opt/kokoro` (or pointed to with `KOKORO_MODEL` / `KOKORO_VOICES`)
- Chromium for Remotion: `remotion.config.ts` uses the pre-installed headless shell if it's there. Otherwise Remotion downloads its own.

## Structure

```
src/ad.config.ts        copy, colours, timings, CTA keyword, variants
src/timeline.ts         timing map: scene starts, VO frames, animation beats, SFX cues
src/Main.tsx            composition: scenes + persistent top bar, dust, grain, vignette
src/components/         Headline (mask reveal), LineWork (gold sigils), Globe (three.js), Chrome, SceneShell
src/scenes/             Hook, Library, Connection, Markets, Live, Rank, Founder, Cta
scripts/                vo.py, audio.py, render.sh, qa.py, stills.ts, land-dots.ts
```

## Compliance built in

- No income, profit or win-rate claims, and no P&L anywhere. The chart shows price only.
- "Educational content. Trading involves risk." stays on screen for the whole trading scene.
- No faces or third-party logos. The chart uses TradingView-style candle colours but no TradingView branding. Avatars are abstract initials.
