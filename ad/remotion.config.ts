import { Config } from "@remotion/cli/config";
import { existsSync } from "node:fs";

// Use the pre-installed headless Chromium when present so renders work offline.
const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(shell)) Config.setBrowserExecutable(shell);

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setChromiumOpenGlRenderer("swangle");
Config.setConcurrency(4);
