#!/usr/bin/env bash
# Contact sheet of an ad at the middle and end of each scene:  bash scripts/sheet.sh <ad>
set -e
cd "$(dirname "$0")/.."
AD="$1"
F=$(node -e "
const t=require('./build/timeline-$AD.json');
const f=[];t.slots.forEach(s=>{f.push(s.start+Math.round(s.duration*0.35));f.push(s.start+s.duration-14)});
console.log(f.join(' '))")
npx tsx scripts/stills.ts "$AD" build/stills $F >/dev/null
python3 scripts/contact.py "build/sheet-$AD.png" 6 300 $(for f in $F; do printf "build/stills/$AD-%04d.png " $f; done)
echo "build/sheet-$AD.png"
