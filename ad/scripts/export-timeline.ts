/** Writes build/config.json and build/timeline-<variant>.json for the audio scripts. */
import { mkdirSync, writeFileSync } from "node:fs";
import { config, VariantId } from "../src/ad.config";
import { buildTimeline } from "../src/timeline";

mkdirSync("build", { recursive: true });
writeFileSync("build/config.json", JSON.stringify(config, null, 2));
for (const v of Object.keys(config.variants) as VariantId[]) {
  const t = buildTimeline(v);
  writeFileSync(`build/timeline-${v}.json`, JSON.stringify(t, null, 2));
  // Guard rails: VO must not overlap itself or spill past its scene.
  t.vo.forEach((v, i) => {
    const next = t.vo[i + 1];
    if (next && v.frame + v.frames > next.frame) console.warn(`  ! VO "${v.text}" overlaps "${next.text}"`);
    const slot = t.slots.find((s) => s.id === v.scene)!;
    const limit = slot.id === "cta" ? slot.start + slot.duration : slot.start + slot.duration - config.transitionFrames;
    if (v.frame + v.frames > limit) console.warn(`  ! VO "${v.text}" runs past the end of ${slot.id}`);
  });
  console.log(`${v}: ${t.totalFrames} frames (${(t.totalFrames / config.fps).toFixed(2)}s), ${t.vo.length} VO, ${t.sfx.length} SFX`);
}
