#!/usr/bin/env bash
# Full pipeline for one ad:  bash scripts/render.sh [ad-id] [--skip-vo]   (ad ids: keys of `ads` in src/ad.config.ts)
#   1. timing map  2. voiceover (Kokoro)  3. soundtrack + master  4. picture  5. mux + cover
set -euo pipefail
cd "$(dirname "$0")/.."
VARIANT="${1:-original}"
mkdir -p out build

npx tsx scripts/export-timeline.ts
if [[ "${2:-}" != "--skip-vo" ]]; then
  python3 scripts/vo.py
  npx tsx scripts/export-timeline.ts   # re-derive cues from the measured voice timings
fi
NAME=$(node -e "console.log(require('./build/timeline-$VARIANT.json').file)")
python3 scripts/audio.py "$VARIANT"

npx remotion render src/index.ts "$VARIANT" "build/$VARIANT-video.mp4" \
  --codec=h264 --crf=18 --x264-preset=slow --pixel-format=yuv420p --muted --props="{\"ad\":\"$VARIANT\",\"withAudio\":false}"

# Silent cut: picture only (for trending sounds).
ffmpeg -y -loglevel error -i "build/$VARIANT-video.mp4" -c:v copy -an -movflags +faststart "out/$NAME-silent.mp4"
# Full cut: picture + mastered soundtrack.
ffmpeg -y -loglevel error -i "build/$VARIANT-video.mp4" -i "public/audio/$VARIANT.wav" \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k -ar 48000 -shortest -movflags +faststart "out/$NAME-full.mp4"

# Cover: the original trailer uses the held CTA frame; the others use their finished hook headline.
COVER=$(node -e "
const t=require('./build/timeline-$VARIANT.json');
console.log(t.ad==='original' ? t.totalFrames-1 : t.slots[0].start+t.slots[0].duration-14)")
npx remotion still src/index.ts "$VARIANT" "out/$NAME-cover.png" --frame="$COVER" --props="{\"ad\":\"$VARIANT\",\"withAudio\":false}"
echo "done -> out/$NAME-{full,silent}.mp4, out/$NAME-cover.png"
