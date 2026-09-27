/**
 * Timing map. Turns ad.config.ts (+ measured voiceover timings) into absolute
 * frame numbers for every scene, VO phrase, animation beat and sound effect.
 *
 * The scenes read their beats from `sceneCues()` and the audio script reads the
 * exact same numbers from build/timeline.json, so every SFX lands on its visual.
 */
import { config, SceneId, VariantId } from "./ad.config";
import voTimingRaw from "./generated/vo-timing.json";

type VoTiming = Record<string, { duration: number; lastWordOnset: number }>;
const voTiming = voTimingRaw as VoTiming;

export const voKey = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Length of a VO clip in frames (falls back to an estimate before audio.py has run). */
export const voFrames = (text: string) => {
  const t = voTiming[voKey(text)];
  return t ? Math.round(t.duration * config.fps) : Math.round(text.length * 1.9);
};

/** Frame offset (inside the clip) where the last word starts. */
const lastWordOnset = (text: string) => {
  const t = voTiming[voKey(text)];
  return t ? Math.round(t.lastWordOnset * config.fps) : Math.round(text.length * 1.3);
};

/** Spread word reveals across a spoken phrase, weighted by word length. */
export const wordsAcross = (text: string, start: number, spoken: number) => {
  const words = text.split(" ");
  const weights = words.map((w) => w.replace(/[^a-z0-9]/gi, "").length + 2);
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  return words.map((_, i) => {
    const f = start + Math.round((acc / total) * spoken * 0.9);
    acc += weights[i];
    return f;
  });
};

export type SfxType =
  | "subDrop"
  | "whoosh"
  | "whooshDeep"
  | "chime"
  | "tick"
  | "flutter"
  | "zap"
  | "sweep"
  | "ping"
  | "ding"
  | "pop"
  | "shing"
  | "riser"
  | "bassHit";

export interface Sfx {
  type: SfxType;
  frame: number; // frame the transient lands on (relative to scene until made absolute)
  gain?: number; // dB
  pitch?: number; // multiplier or index, per-type meaning
  length?: number; // frames, for risers/sweeps
}

const HEADLINE_START = 6;
const WORD_STAGGER = 3; // 100ms per word

/** Default headline word reveal: line 1 then line 2, 3 frames per word. */
const headlineWords = (lines: readonly string[], line2At?: number) => {
  const w1 = lines[0].split(" ").map((_, i) => HEADLINE_START + i * WORD_STAGGER);
  const l2start = line2At ?? HEADLINE_START + w1.length * WORD_STAGGER + 8;
  const w2 = lines[1].split(" ").map((_, i) => l2start + i * WORD_STAGGER);
  return [w1, w2];
};

/** Per-scene animation beats and SFX, all in scene-relative frames. */
const s = config.scenes;
const cueBuilders = {
  hook: () => {
    const dur = s.hook.duration;
    const [a, b] = s.hook.vo;
    const w1 = wordsAcross(a.text, a.at, voFrames(a.text));
    const think = b.at + lastWordOnset(b.text);
    const w2 = [b.at, b.at + Math.max(4, Math.round((think - b.at) * 0.45)), think];
    const sfx: Sfx[] = [
      ...w1.map((f) => ({ type: "pop" as const, frame: f, gain: -16 })),
      { type: "pop", frame: w2[0], gain: -15 },
      { type: "pop", frame: w2[1], gain: -15 },
      { type: "subDrop", frame: think, gain: -2 },
    ];
    return { dur, words: [w1, w2], think, sfx };
  },
  library: () => {
    const dur = s.library.duration;
    const words = headlineWords(s.library.headline);
    const counter = { from: 14, to: 92 };
    const domains = s.library.domains.map((_, i) => 40 + i * 9);
    const sfx: Sfx[] = [
      { type: "whooshDeep", frame: 6, gain: -4, length: 70 },
      { type: "flutter", frame: 12, gain: -12 },
      { type: "flutter", frame: 46, gain: -14 },
      { type: "flutter", frame: 84, gain: -14 },
      ...domains.map((f, i) => ({ type: "chime" as const, frame: f, pitch: i, gain: -11 })),
    ];
    for (let f = counter.from; f < counter.to; f += 4) sfx.push({ type: "tick", frame: f, gain: -20 });
    return { dur, words, counter, domains, sfx };
  },
  connection: () => {
    const dur = s.connection.duration;
    const words = headlineWords(s.connection.headline);
    const collapse = { from: 0, to: 18 };
    // Links form in waves; each wave gets one zap.
    const linkWaves = [16, 24, 32, 42, 52, 64, 76, 90];
    const sfx: Sfx[] = [
      { type: "flutter", frame: 2, gain: -14 },
      ...linkWaves.map((f, i) => ({ type: "zap" as const, frame: f, gain: -14 - (i % 2) * 2, pitch: i })),
    ];
    // Domain nodes flare as the narrator names them.
    const named = s.connection.vo.slice(0, 3).map((v) => v.at + 2);
    return { dur, words, collapse, linkWaves, named, sfx };
  },
  markets: () => {
    const dur = s.markets.duration;
    const words = headlineWords(s.markets.headline);
    const candles = { from: 6, to: 78 };
    const zones = [26, 46, 66];
    const sfx: Sfx[] = zones.map((f) => ({ type: "sweep" as const, frame: f, gain: -13, length: 16 }));
    for (let f = 30; f < dur - 10; f += 30) sfx.push({ type: "tick", frame: f, gain: -19 });
    return { dur, words, candles, zones, sfx };
  },
  live: () => {
    const dur = s.live.duration;
    const [, globeVo] = s.live.vo;
    const globeAt = globeVo.at - 6;
    const words = headlineWords(s.live.headline, globeVo.at);
    const avatars = Array.from({ length: 12 }, (_, i) => 12 + Math.round(i * 2.5));
    const pins = [72, 79, 86, 93, 100, 107];
    const sfx: Sfx[] = [
      { type: "ping", frame: 6, gain: -18, pitch: 1.5 },
      ...avatars.filter((_, i) => i % 3 === 0).map((f) => ({ type: "tick" as const, frame: f, gain: -18 })),
      { type: "whoosh", frame: globeAt + 4, gain: -9 },
      ...pins.map((f, i) => ({ type: "ping" as const, frame: f, gain: -10, pitch: 1 + (i % 3) * 0.12 })),
    ];
    return { dur, words, avatars, globeAt, pins, sfx };
  },
  rank: () => {
    const dur = s.rank.duration;
    const words = headlineWords(s.rank.headline);
    const tiers = [18, 42, 66, 90, 116];
    const credits = { from: 24, to: 124 };
    const sfx: Sfx[] = tiers.map((f, i) => ({ type: "ding" as const, frame: f, pitch: i, gain: i === 4 ? -5 : -9 }));
    for (let f = credits.from; f < credits.to; f += 6) sfx.push({ type: "tick", frame: f, gain: -21 });
    return { dur, words, tiers, credits, sfx };
  },
  founder: () => {
    const dur = s.founder.duration;
    const words = headlineWords(s.founder.headline);
    const knife = { from: 4, to: 40 };
    const morph = { from: 52, to: 100 };
    const sfx: Sfx[] = [
      { type: "shing", frame: 36, gain: -10 },
      { type: "sweep", frame: 54, gain: -16, length: 40 },
    ];
    return { dur, words, knife, morph, sfx };
  },
  cta: () => {
    const dur = s.cta.duration;
    const hit = 22;
    const words = headlineWords(s.cta.headline, hit + 16).map((line, i) => (i === 0 ? line.map((f) => f + hit - 2) : line));
    const pill = 62;
    const url = 70;
    const hold = dur - config.finalHoldFrames;
    const sfx: Sfx[] = [
      { type: "riser", frame: hit, gain: -6, length: 66 },
      { type: "bassHit", frame: hit, gain: 0 },
      { type: "chime", frame: pill, pitch: 4, gain: -14 },
    ];
    return { dur, words, hit, pill, url, hold, sfx };
  },
};

type Cues = typeof cueBuilders;
/** Per-scene animation beats and SFX, all in scene-relative frames. */
export const sceneCues = <K extends SceneId>(id: K): ReturnType<Cues[K]> & { sfx: Sfx[] } =>
  cueBuilders[id]() as ReturnType<Cues[K]> & { sfx: Sfx[] };
export interface SceneSlot {
  id: SceneId;
  index: number;
  start: number;
  duration: number;
}

export const buildTimeline = (variant: VariantId) => {
  const ids = config.variants[variant] as readonly SceneId[];
  const T = config.transitionFrames;
  const slots: SceneSlot[] = [];
  let cursor = 0;
  ids.forEach((id, index) => {
    slots.push({ id, index, start: cursor, duration: config.scenes[id].duration });
    cursor += config.scenes[id].duration - T;
  });
  const last = slots[slots.length - 1];
  const totalFrames = last.start + last.duration;

  const vo = slots.flatMap((slot) =>
    config.scenes[slot.id].vo.map((v) => ({
      key: voKey(v.text),
      text: v.text,
      frame: slot.start + v.at,
      frames: voFrames(v.text),
      scene: slot.id,
    })),
  );

  const sfx: Sfx[] = [];
  slots.forEach((slot, i) => {
    sceneCues(slot.id).sfx.forEach((c) => sfx.push({ ...c, frame: c.frame + slot.start }));
    // Transition whoosh peaks mid-way through the overlap into the next scene.
    if (i > 0) sfx.push({ type: "whoosh", frame: slot.start + Math.round(T / 2), gain: -12 });
  });
  sfx.sort((a, b) => a.frame - b.frame);

  return { variant, fps: config.fps, totalFrames, slots, vo, sfx };
};

export type Timeline = ReturnType<typeof buildTimeline>;
