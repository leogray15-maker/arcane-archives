/** Writes build/config.json and build/timeline-<ad>.json for the audio scripts. */
import { mkdirSync, writeFileSync } from "node:fs";
import { AdId, config } from "../src/ad.config";
import { buildTimeline } from "../src/timeline";

mkdirSync("build", { recursive: true });
writeFileSync("build/config.json", JSON.stringify(config, null, 2));
const only = process.argv[2];
for (const ad of Object.keys(config.ads) as AdId[]) {
  if (only && ad !== only) continue;
  const t = buildTimeline(ad);
  writeFileSync(`build/timeline-${ad}.json`, JSON.stringify(t, null, 2));
  // Guard rails: VO must not overlap itself or spill past its scene.
  t.vo.forEach((v, i) => {
    const next = t.vo[i + 1];
    if (next && v.frame + v.frames > next.frame) console.warn(`  ! [${ad}] VO "${v.text}" overlaps "${next.text}" by ${v.frame + v.frames - next.frame}f`);
    const slot = t.slots[v.scene];
    const isLast = v.scene === t.slots.length - 1;
    const limit = slot.start + slot.duration - (isLast ? 0 : config.transitionFrames);
    if (v.frame + v.frames > limit) console.warn(`  ! [${ad}] VO "${v.text}" runs ${v.frame + v.frames - limit}f past the end of scene ${v.scene + 1} (${slot.type})`);
  });
  console.log(`${ad}: ${t.totalFrames} frames (${(t.totalFrames / config.fps).toFixed(2)}s), ${t.slots.length} scenes, ${t.vo.length} VO, ${t.sfx.length} SFX`);
}
