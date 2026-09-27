/**
 * Timing map. Turns ad.config.ts (+ measured voiceover timings) into absolute
 * frame numbers for every scene, VO phrase, animation beat and sound effect.
 *
 * The scenes read their beats from `sceneCues()` and the audio script reads the
 * exact same numbers from build/timeline.json, so every SFX lands on its visual.
 */
import { AdId, config, SceneSpec, SceneType } from "./ad.config";
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

/** Spread a headline line's word reveals across a spoken phrase, weighted by word length. */
const spread = (line: string, start: number, spoken: number) => {
  const words = line.split(" ");
  const weights = words.map((w) => w.replace(/[^a-z0-9]/gi, "").length + 2);
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  return words.map((_, i) => {
    const f = start + Math.round((acc / total) * spoken * 0.85);
    acc += weights[i];
    return f;
  });
};

/** Default headline word reveal: line 1 then line 2, 3 frames per word. */
const headlineWords = (lines: readonly string[], line2At?: number) => {
  const w1 = lines[0].split(" ").map((_, i) => HEADLINE_START + i * WORD_STAGGER);
  const l2start = line2At ?? HEADLINE_START + w1.length * WORD_STAGGER + 8;
  const w2 = lines[1].split(" ").map((_, i) => l2start + i * WORD_STAGGER);
  return [w1, w2];
};

type Spec<T extends SceneType> = SceneSpec<T>;
const tickRun = (from: number, to: number, every: number, gain = -20): Sfx[] => {
  const out: Sfx[] = [];
  for (let f = from; f < to; f += every) out.push({ type: "tick", frame: f, gain });
  return out;
};

const cueBuilders = {
  hook: (s: Spec<"hook">) => {
    const dur = s.duration;
    const [a, b] = s.vo;
    const w1 = spread(s.headline[0], a.at, voFrames(a.text));
    // Line 2 slams its last word on the spoken last word (with the sub-drop).
    const slam = b.at + lastWordOnset(b.text);
    const n2 = s.headline[1].split(" ").length;
    const w2 = Array.from({ length: n2 }, (_, i) => (n2 === 1 ? slam : Math.round(b.at + ((slam - b.at) * i) / (n2 - 1))));
    const sfx: Sfx[] = [
      ...w1.map((f) => ({ type: "pop" as const, frame: f, gain: -16 })),
      ...w2.slice(0, -1).map((f) => ({ type: "pop" as const, frame: f, gain: -15 })),
      { type: "subDrop", frame: slam, gain: -2 },
    ];
    return { dur, words: [w1, w2], think: slam, sfx };
  },
  library: (s: Spec<"library">) => {
    const dur = s.duration;
    const words = headlineWords(s.headline);
    const counter = { from: 14, to: 92 };
    const domains = s.domains.map((_, i) => 40 + i * 9);
    const sfx: Sfx[] = [
      { type: "whooshDeep", frame: 6, gain: -4, length: 70 },
      { type: "flutter", frame: 12, gain: -12 },
      { type: "flutter", frame: 46, gain: -14 },
      { type: "flutter", frame: 84, gain: -14 },
      ...domains.map((f, i) => ({ type: "chime" as const, frame: f, pitch: i, gain: -11 })),
      ...tickRun(counter.from, counter.to, 4),
    ];
    return { dur, words, counter, domains, sfx };
  },
  connection: (s: Spec<"connection">) => {
    const dur = s.duration;
    const words = headlineWords(s.headline);
    const collapse = { from: 0, to: 18 };
    // Links form in waves; each wave gets one zap.
    const linkWaves = [16, 24, 32, 42, 52, 64, 76, 90];
    const sfx: Sfx[] = [
      { type: "flutter", frame: 2, gain: -14 },
      ...linkWaves.map((f, i) => ({ type: "zap" as const, frame: f, gain: -14 - (i % 2) * 2, pitch: i })),
    ];
    // Domain nodes flare as the narrator names them.
    const named = s.vo.slice(0, 3).map((v) => v.at + 2);
    return { dur, words, collapse, linkWaves, named, sfx };
  },
  markets: (s: Spec<"markets">) => {
    const dur = s.duration;
    const words = headlineWords(s.headline);
    const candles = { from: 6, to: 78 };
    const zones = [26, 46, 66];
    const sfx: Sfx[] = [...zones.map((f) => ({ type: "sweep" as const, frame: f, gain: -13, length: 16 })), ...tickRun(30, dur - 10, 30, -19)];
    return { dur, words, candles, zones, sfx };
  },
  live: (s: Spec<"live">) => {
    const dur = s.duration;
    const globeAt = s.globe && s.vo[1] ? s.vo[1].at - 6 : 100000; // never, for War-Room-only cuts
    const words = headlineWords(s.headline, s.globe && s.vo[1] ? s.vo[1].at : undefined);
    const avatars = Array.from({ length: 12 }, (_, i) => 12 + Math.round(i * 2.5));
    const pins = [72, 79, 86, 93, 100, 107];
    const sfx: Sfx[] = [
      { type: "ping", frame: 6, gain: -18, pitch: 1.5 },
      ...avatars.filter((_, i) => i % 3 === 0).map((f) => ({ type: "tick" as const, frame: f, gain: -18 })),
      ...(s.globe
        ? [
            { type: "whoosh" as const, frame: globeAt + 4, gain: -9 },
            ...pins.map((f, i) => ({ type: "ping" as const, frame: f, gain: -10, pitch: 1 + (i % 3) * 0.12 })),
          ]
        : [{ type: "chime" as const, frame: 60, pitch: 2, gain: -16 }]),
    ];
    return { dur, words, avatars, globeAt, pins, sfx };
  },
  rank: (s: Spec<"rank">) => {
    const dur = s.duration;
    const words = headlineWords(s.headline);
    const tiers = [18, 42, 66, 90, 116];
    const credits = { from: 24, to: 124 };
    const sfx: Sfx[] = [...tiers.map((f, i) => ({ type: "ding" as const, frame: f, pitch: i, gain: i === 4 ? -5 : -9 })), ...tickRun(credits.from, credits.to, 6, -21)];
    return { dur, words, tiers, credits, sfx };
  },
  founder: (s: Spec<"founder">) => {
    const dur = s.duration;
    const words = headlineWords(s.headline);
    const knife = { from: 4, to: 40 };
    const morph = { from: 52, to: 100 };
    const sfx: Sfx[] = [
      { type: "shing", frame: 36, gain: -10 },
      { type: "sweep", frame: 54, gain: -16, length: 40 },
    ];
    return { dur, words, knife, morph, sfx };
  },
  cta: (s: Spec<"cta">) => {
    const dur = s.duration;
    const hit = 22;
    const words = headlineWords(s.headline, hit + 16).map((line, i) => (i === 0 ? line.map((f) => f + hit - 2) : line));
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

  // ---------------------------------------------------------------- ads 02-06
  globeLayers: (s: Spec<"globeLayers">) => {
    const dur = s.duration;
    const words = headlineWords(s.headline);
    const layers = s.layers.map((_, i) => (s.vo[i] ? s.vo[i].at + 2 : 30 + i * 32));
    const push = s.vo[s.layers.length]?.at ?? dur - 50;
    const accent: Sfx["type"][] = ["ping", "sweep", "zap", "ping"];
    const sfx: Sfx[] = [
      { type: "whoosh", frame: 4, gain: -10 },
      ...layers.flatMap((f, i) => [
        { type: "tick" as const, frame: f, gain: -14 },
        { type: accent[i % 4], frame: f + 3, gain: -12, pitch: 0.9 + i * 0.1, length: 20 },
      ]),
      { type: "chime", frame: push, pitch: 5, gain: -13 },
    ];
    return { dur, words, layers, push, sfx };
  },
  instability: (s: Spec<"instability">) => {
    const dur = s.duration;
    const words = headlineWords(s.headline);
    const rows = [20, 26, 32, 38, 44];
    const deltas = [64, 72];
    const gauge = { from: 70, to: 112 };
    const sfx: Sfx[] = [
      ...rows.map((f) => ({ type: "tick" as const, frame: f, gain: -15 })),
      ...deltas.map((f) => ({ type: "pop" as const, frame: f, gain: -14 })),
      { type: "sweep", frame: gauge.from + 4, gain: -14, length: 36 },
      { type: "chime", frame: gauge.to, pitch: 1, gain: -12 },
    ];
    return { dur, words, rows, deltas, gauge, sfx };
  },
  intel: (s: Spec<"intel">) => {
    const dur = s.duration;
    const words = headlineWords(s.headline);
    const rows = [18, 26, 34, 42];
    const brief = (s.vo[1]?.at ?? 76) - 8;
    const cites = [brief + 26, brief + 38, brief + 50];
    const sfx: Sfx[] = [
      ...rows.map((f) => ({ type: "tick" as const, frame: f, gain: -15 })),
      { type: "flutter", frame: brief, gain: -12 },
      ...cites.map((f, i) => ({ type: "ping" as const, frame: f, gain: -15, pitch: 1.4 + i * 0.12 })),
    ];
    return { dur, words, rows, brief, cites, sfx };
  },
  ticker: (s: Spec<"ticker">) => {
    const dur = s.duration;
    const words = headlineWords(s.headline);
    const rows = Array.from({ length: 7 }, (_, i) => 14 + i * 5);
    const sfx: Sfx[] = [{ type: "sweep", frame: 8, gain: -16, length: 20 }, ...rows.map((f) => ({ type: "tick" as const, frame: f, gain: -15 }))];
    return { dur, words, rows, sfx };
  },
  sessions: (s: Spec<"sessions">) => {
    const dur = s.duration;
    const words = headlineWords(s.headline);
    const arcs = s.vo.slice(0, 3).map((v) => v.at + 2);
    const active = (s.vo[3]?.at ?? 100) + 12;
    const sfx: Sfx[] = [
      { type: "sweep", frame: 4, gain: -15, length: 20 },
      ...arcs.map((f, i) => ({ type: "chime" as const, frame: f, pitch: 2 + i * 2, gain: -12 })),
      { type: "ping", frame: active, gain: -12, pitch: 1.2 },
    ];
    return { dur, words, arcs, active, sfx };
  },
  modules: (s: Spec<"modules">) => {
    const dur = s.duration;
    const words = headlineWords(s.headline);
    const checks = s.items.map((_, i) => 34 + i * 12);
    const sfx: Sfx[] = [
      { type: "flutter", frame: 6, gain: -14 },
      ...checks.map((f, i) => ({ type: "chime" as const, frame: f, pitch: i, gain: -15 })),
    ];
    return { dur, words, checks, sfx };
  },
  realms: (s: Spec<"realms">) => {
    const dur = s.duration;
    const words = headlineWords(s.headline);
    const cards = [16, 28, 40, 52];
    const sfx: Sfx[] = [
      ...cards.flatMap((f, i) => [
        { type: "flutter" as const, frame: f, gain: -15 },
        { type: "chime" as const, frame: f + 2, pitch: i * 2, gain: -13 },
      ]),
      ...tickRun(20, 90, 5, -22),
    ];
    return { dur, words, cards, sfx };
  },
  steps: (s: Spec<"steps">) => {
    const dur = s.duration;
    const words = headlineWords(s.headline);
    const [a, b, c] = s.vo;
    const steps = [a.at, b.at, Math.round((b.at + c.at) / 2) + 6, c.at];
    const sfx: Sfx[] = steps.map((f, i) => ({ type: "chime" as const, frame: f, pitch: i * 2 + 1, gain: -12 }));
    return { dur, words, steps, sfx };
  },
  quest: (s: Spec<"quest">) => {
    const dur = s.duration;
    const words = headlineWords(s.headline);
    const card = 12;
    const fill = { from: 44, to: 124 };
    const sfx: Sfx[] = [
      { type: "ping", frame: card, gain: -13, pitch: 1.3 },
      ...tickRun(fill.from, fill.to, 5, -20),
      { type: "ding", frame: fill.to, pitch: 3, gain: -9 },
    ];
    return { dur, words, card, fill, sfx };
  },
  kitchen: (s: Spec<"kitchen">) => {
    const dur = s.duration;
    const words = headlineWords(s.headline);
    const tickets = [10, 22, 34, 46, 58, 70];
    const bell = 96;
    const sfx: Sfx[] = [
      ...tickets.map((f) => ({ type: "flutter" as const, frame: f, gain: -12 })),
      { type: "ding", frame: bell, pitch: 2, gain: -8 },
      ...tickRun(30, dur - 12, 30, -18),
    ];
    return { dur, words, tickets, bell, sfx };
  },
  room: (s: Spec<"room">) => {
    const dur = s.duration;
    const words = headlineWords(s.headline);
    const rings = [14, 32, 50];
    const messages = [74, 98, 122];
    const sfx: Sfx[] = [
      ...rings.map((f, i) => ({ type: "ping" as const, frame: f, gain: -15, pitch: 0.9 + i * 0.1 })),
      ...messages.map((f) => ({ type: "pop" as const, frame: f, gain: -13 })),
      ...tickRun(18, 70, 6, -21),
    ];
    return { dur, words, rings, messages, sfx };
  },
  referral: (s: Spec<"referral">) => {
    const dur = s.duration;
    const words = headlineWords(s.headline);
    const typing = { from: 22, to: 52 };
    const click = 74;
    const shares = [88, 93, 98];
    const statsAt = (s.vo[1]?.at ?? 100) + 4;
    const tiles = [statsAt, statsAt + 7, statsAt + 14];
    const credits = { from: statsAt + 10, to: statsAt + 70 };
    const sfx: Sfx[] = [
      ...tickRun(typing.from, typing.to, 3, -22),
      { type: "pop", frame: click, gain: -12 },
      { type: "chime", frame: click + 3, pitch: 4, gain: -13 },
      ...shares.map((f) => ({ type: "tick" as const, frame: f, gain: -16 })),
      ...tiles.map((f, i) => ({ type: "ding" as const, frame: f, pitch: i, gain: -13 })),
      ...tickRun(credits.from + 4, credits.to, 6, -21),
    ];
    return { dur, words, typing, click, shares, tiles, credits, sfx };
  },
};

type Cues = typeof cueBuilders;
export type CuesOf<K extends SceneType> = ReturnType<Cues[K]> & { sfx: Sfx[] };
/** Per-scene animation beats and SFX, all in scene-relative frames. */
export const sceneCues = <K extends SceneType>(spec: SceneSpec<K>): CuesOf<K> =>
  (cueBuilders[spec.type] as unknown as (s: SceneSpec<K>) => CuesOf<K>)(spec);

export interface SceneSlot {
  spec: SceneSpec;
  index: number;
  start: number;
  duration: number;
}

export const adScenes = (ad: AdId) => config.ads[ad].scenes as SceneSpec[];

export const buildTimeline = (ad: AdId) => {
  const specs = adScenes(ad);
  const T = config.transitionFrames;
  const slots: SceneSlot[] = [];
  let cursor = 0;
  specs.forEach((spec, index) => {
    slots.push({ spec, index, start: cursor, duration: spec.duration });
    cursor += spec.duration - T;
  });
  const last = slots[slots.length - 1];
  const totalFrames = last.start + last.duration;

  const vo = slots.flatMap((slot) =>
    slot.spec.vo.map((v) => ({
      key: voKey(v.text),
      text: v.text,
      frame: slot.start + v.at,
      frames: voFrames(v.text),
      scene: slot.index,
      sceneType: slot.spec.type,
    })),
  );

  const sfx: Sfx[] = [];
  slots.forEach((slot, i) => {
    sceneCues(slot.spec).sfx.forEach((c) => sfx.push({ ...c, frame: c.frame + slot.start }));
    // Transition whoosh peaks mid-way through the overlap into the next scene.
    if (i > 0) sfx.push({ type: "whoosh", frame: slot.start + Math.round(T / 2), gain: -12 });
  });
  sfx.sort((a, b) => a.frame - b.frame);

  return {
    ad,
    file: config.ads[ad].file,
    fps: config.fps,
    totalFrames,
    slots: slots.map(({ spec, index, start, duration }) => ({ type: spec.type, index, start, duration })),
    vo,
    sfx,
  };
};

export type Timeline = ReturnType<typeof buildTimeline>;
