/** Writes build/v2-timeline-<id>.json (and build/timeline-<id>.json for qa.py) for every v2 ad. */
import { mkdirSync, writeFileSync } from "node:fs";
import { config } from "../src/ad.config";
import { V2_ADS } from "../src/v2/config";
import { buildV2Timeline } from "../src/v2/timeline";

mkdirSync("build", { recursive: true });
writeFileSync("build/config.json", JSON.stringify(config, null, 2));
for (const ad of V2_ADS) {
  const t = buildV2Timeline(ad.id);
  writeFileSync(`build/v2-timeline-${ad.id}.json`, JSON.stringify(t, null, 2));
  writeFileSync(`build/timeline-${ad.id}.json`, JSON.stringify(t, null, 2));
  console.log(`${ad.id}: ${t.bars} bars, ${t.totalFrames} frames (${(t.totalFrames / 30).toFixed(1)}s), ${t.hits.length} drum hits`);
}
