import { Easing, interpolate, spring } from "remotion";
import { config } from "./ad.config";

export const easeOutExpo = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInExpo = Easing.bezier(0.7, 0, 0.84, 0);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** Clamped interpolate with easeOutExpo by default. */
export const ease = (
  frame: number,
  input: [number, number],
  output: [number, number] = [0, 1],
  easing: (t: number) => number = easeOutExpo,
) => interpolate(frame, input, output, { easing, extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/** House spring (damping 15). */
export const spr = (frame: number, delay = 0, damping = 15, stiffness = 140, mass = 1) =>
  spring({ frame: frame - delay, fps: config.fps, config: { damping, stiffness, mass } });

/** Deterministic PRNG (mulberry32) so every render is identical. */
export const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const fmt = (n: number) => Math.round(n).toLocaleString("en-GB");
