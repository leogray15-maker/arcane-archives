# The Arcane Archives: 9:16 ads

Six 1080×1920, 30fps vertical adverts built entirely in code with Remotion (React) and three.js.
The voiceover, sound effects, music and mastering are all generated from the same timing map, so every render is deterministic.

## The ads (`out/`)

| Ad id | File stem | Angle | Length |
| --- | --- | --- | --- |
| `original` | `arcane-archives-ad` | 01 · The trailer: library, links, markets, calls, ranks, founder | 34.5s |
| `watchtower` | `arcane-archives-ad-02-watchtower` | 02 · The Watchtower: globe layers, instability scores, forecasts, sourced briefs | 32.2s |
| `trading` | `arcane-archives-ad-03-trading` | 03 · Trading: live markets, killzone session dial, charts, programme, War Room | 31.5s |
| `vault` | `arcane-archives-ad-04-vault` | 04 · The Vault: four realms, the path from day one, daily quests, ranks | 31.4s |
| `founder` | `arcane-archives-ad-05-founder` | 05 · The Founder: the kitchen, knife to candle, the library he built | 30.0s |
| `room` | `arcane-archives-ad-06-room` | 06 · The Room: community, ranks, referral link and Arcane Credits | 28.5s |

Each ad has `<stem>-full.mp4` (mastered to -14 LUFS, true peak ≤ -1.5 dBTP), `<stem>-silent.mp4` (no audio track, for trending sounds) and `<stem>-cover.png`.

## Making another ad: edit one file

`src/ad.config.ts` holds everything you'd change:

- `brand`: name, URL and **CTA keyword** (`ARCHIVES`)
- `colors`: gold, violet, background and UI colours
- `ads.<id>.scenes`: the ordered scenes of each ad. Each scene has a `type`, its `headline`, its VO lines (`at` = start frame inside the scene) and its `duration`
- `voice`, `mix`: TTS voice, pitch, music duck depth and loudness targets

Scene types you can mix freely: `hook`, `library`, `connection`, `markets`, `live` (`globe: false` for a War-Room-only beat), `rank`, `founder`, `cta`, `globeLayers`, `instability`, `intel`, `ticker`, `sessions`, `modules`, `realms`, `steps`, `quest`, `kitchen`, `room`, `referral`.
A new entry in `ads` becomes a Remotion composition automatically. `npx tsx scripts/export-timeline.ts` warns if a voice line overlaps the next one or runs past its scene.

## Pipeline

```bash
npm install
bash scripts/render.sh watchtower    # any ad id; add --skip-vo to reuse generated voice clips
python3 scripts/qa.py watchtower     # QA report + boundary contact sheet in build/qa/
bash scripts/sheet.sh watchtower     # quick contact sheet of stills (no video render)
npm run studio                       # live preview (run render.sh once first for audio)
```

`render.sh` runs these steps:

1. `scripts/export-timeline.ts` turns the config into `build/timeline-<ad>.json`: absolute frames for every scene, VO line and SFX cue. It warns if any VO line overlaps another or runs past its scene.
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
src/ad.config.ts        copy, colours, timings, CTA keyword, every ad's scene list
src/timeline.ts         timing map: scene starts, VO frames, animation beats, SFX cues
src/Main.tsx            composition: scenes + persistent top bar, dust, grain, vignette
src/SceneContext.tsx    gives each scene its spec + cues
src/components/         Headline (mask reveal), LineWork (gold sigils), Globe (three.js + Watchtower layers), Chrome, SceneShell, ui
src/scenes/             one component per scene type
scripts/                vo.py, audio.py, render.sh, qa.py, stills.ts, sheet.sh, land-dots.ts
```

## Compliance built in

- No income, profit or win-rate claims, and no P&L anywhere. Charts and quotes show price only.
- The referral ad shows the link, referral counts and Arcane Credits, with no £ amounts.
- "Educational content. Trading involves risk." stays on screen in every trading scene (chart, markets, sessions, programme).
- Watchtower data (instability scores, forecasts, briefs) is labelled as an illustrative preview.
- No faces or third-party logos. The chart uses TradingView-style candle colours but no TradingView branding. Avatars are abstract initials.
