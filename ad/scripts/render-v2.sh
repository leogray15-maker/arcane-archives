#!/usr/bin/env bash
# v2 (music-led) ad:  bash scripts/render-v2.sh <id>    ids: zero | watch | order | timing
#   1. beat timeline  2. music track + master  3. picture  4. mux full/silent + cover
set -euo pipefail
cd "$(dirname "$0")/.."
AD="$1"
mkdir -p out build
npx tsx scripts/export-v2.ts > /dev/null
NAME=$(node -e "console.log(require('./build/v2-timeline-$AD.json').file)")
python3 scripts/music.py "$AD"
npx remotion render src/index.ts "$AD" "build/$AD-video.mp4" \
  --codec=h264 --crf=18 --x264-preset=slow --pixel-format=yuv420p --muted --props="{\"ad\":\"$AD\",\"withAudio\":false}"
ffmpeg -y -loglevel error -i "build/$AD-video.mp4" -c:v copy -an -movflags +faststart "out/$NAME-silent.mp4"
ffmpeg -y -loglevel error -i "build/$AD-video.mp4" -i "public/audio/$AD.wav" \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k -ar 48000 -shortest -movflags +faststart "out/$NAME-full.mp4"
# Cover: the finished hook headline.
npx remotion still src/index.ts "$AD" "out/$NAME-cover.png" --frame=112 --props="{\"ad\":\"$AD\",\"withAudio\":false}"
echo "done -> out/$NAME-{full,silent}.mp4, out/$NAME-cover.png"
