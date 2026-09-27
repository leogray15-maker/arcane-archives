/**
 * Render arbitrary frames to PNG with a single bundle.
 *   tsx scripts/stills.ts <variant> <outDir> <frame> [frame...]
 */
import path from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const [ad = "original", outDir = "build/stills", ...frames] = process.argv.slice(2);
const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(shell) ? shell : undefined;

(async () => {
  mkdirSync(outDir, { recursive: true });
  const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
  const inputProps = { ad, withAudio: false };
  const composition = await selectComposition({ serveUrl, id: ad, inputProps, browserExecutable, chromiumOptions: { gl: "swangle" } });
  for (const f of frames) {
    const output = path.join(outDir, `${ad}-${String(f).padStart(4, "0")}.png`);
    await renderStill({ composition, serveUrl, frame: Number(f), output, inputProps, browserExecutable, chromiumOptions: { gl: "swangle" } });
    console.log(output);
  }
})();
