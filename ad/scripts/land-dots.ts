/** Precomputes the dotted-land point cloud for the Watchtower globe (deterministic). */
import { writeFileSync, mkdirSync } from "node:fs";
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
import land from "world-atlas/land-110m.json" with { type: "json" };

const geo = feature(land as any, (land as any).objects.land) as any;
const N = 42000;
const pts: number[] = [];
const golden = Math.PI * (3 - Math.sqrt(5));
for (let i = 0; i < N; i++) {
  const y = 1 - (i / (N - 1)) * 2;
  const lat = (Math.asin(y) * 180) / Math.PI;
  const lon = ((((i * golden * 180) / Math.PI) % 360) + 360) % 360 - 180;
  if (geoContains(geo, [lon, lat])) pts.push(+lon.toFixed(2), +lat.toFixed(2));
}
mkdirSync("src/generated", { recursive: true });
writeFileSync("src/generated/land-dots.json", JSON.stringify(pts));
console.log(`land dots: ${pts.length / 2}`);
