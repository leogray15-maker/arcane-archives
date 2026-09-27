/**
 * v2 timing map: bars -> frames, word-pop frames, and the drum pattern.
 * The picture (beat punches, cuts) and scripts/music.py read the same hits.
 */
import { BAR, BEAT } from "./theme";
import { Chord, Seg, V2Ad, v2Ad } from "./config";

/** Frames of silence-free hold after the final CTA bar. */
export const TAIL = 30;

export const segStarts = (ad: V2Ad) => {
  let bar = 0;
  return ad.segs.map((s) => {
    const out = { seg: s, bar, start: bar * BAR, duration: s.bars * BAR };
    bar += s.bars;
    return out;
  });
};

export const totalBars = (ad: V2Ad) => ad.segs.reduce((a, s) => a + s.bars, 0);
export const totalFrames = (ad: V2Ad) => totalBars(ad) * BAR + TAIL;
export const ctaBar = (ad: V2Ad) => segStarts(ad).find((s) => s.seg.type === "cta")!.bar;

/** Word pops on the 8th-note grid (7.5 frames), starting `from` frames into the segment. */
export const popFrames = (lines: (string | undefined)[], from = 0, step = 7.5) => {
  let i = 0;
  return lines.map((l) => (l ?? "").split(" ").filter(Boolean).map(() => Math.round(from + step * i++)));
};

// 16 steps per bar (16th notes = 3.75 frames).
const KICK_A = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0];
const KICK_B = [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0];
const CLAP = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];

export type Section = "intro" | "groove" | "break" | "hit" | "outro";

/** What the music does in each bar. */
export const sections = (ad: V2Ad): Section[] => {
  const n = totalBars(ad);
  const cta = ctaBar(ad);
  return Array.from({ length: n }, (_, b) => {
    if (b < ad.music.drop) return "intro";
    if (b === cta - 1) return "break";
    if (b === cta) return "hit";
    if (b > cta) return "outro";
    return "groove";
  });
};

export interface Hit {
  step: number; // absolute 16th index
  frame: number; // rounded frame
  kind: "kick" | "clap" | "hat" | "openhat" | "crash" | "impact";
  vel: number;
}

/** The drum part. Deterministic, shared by picture and sound. */
export const drumHits = (ad: V2Ad): Hit[] => {
  const hits: Hit[] = [];
  const secs = sections(ad);
  const at = (bar: number, st: number) => ({ step: bar * 16 + st, frame: Math.round((bar * 16 + st) * (BEAT / 4)) });
  secs.forEach((sec, b) => {
    if (sec === "intro") {
      // Hats creep in during the second half of the bar before the drop.
      if (b === ad.music.drop - 1) for (let st = 8; st < 16; st += st < 12 ? 2 : 1) hits.push({ ...at(b, st), kind: "hat", vel: 50 + st * 3 });
      return;
    }
    if (sec === "break") return;
    if (sec === "outro") {
      hits.push({ ...at(b, 0), kind: "impact", vel: 110 });
      return;
    }
    const kick = b % 2 ? KICK_B : KICK_A;
    for (let st = 0; st < 16; st++) {
      if (kick[st]) hits.push({ ...at(b, st), kind: "kick", vel: st === 0 ? 120 : 105 });
      if (CLAP[st]) hits.push({ ...at(b, st), kind: "clap", vel: 105 });
      const roll = b % 4 === 3 && st >= 12;
      if (roll || st % 2 === 0) hits.push({ ...at(b, st), kind: "hat", vel: st % 4 === 0 ? 70 : 88 });
      if (!roll && st === 14 && b % 4 !== 3) hits.push({ ...at(b, st), kind: "openhat", vel: 70 });
    }
    if (sec === "hit" || b === ad.music.drop) hits.push({ ...at(b, 0), kind: "crash", vel: 110 });
    if (sec === "hit") hits.push({ ...at(b, 0), kind: "impact", vel: 127 });
  });
  return hits.sort((a, b) => a.step - b.step);
};

/** Frames the picture should punch on: every kick + impacts. */
export const punchFrames = (ad: V2Ad) => drumHits(ad).filter((h) => h.kind === "kick" || h.kind === "impact").map((h) => h.frame);

export const CHORDS: Record<Chord, { off: number; minor: boolean }> = {
  i: { off: 0, minor: true },
  iv: { off: 5, minor: true },
  v: { off: 7, minor: true },
  V: { off: 7, minor: false },
  III: { off: 3, minor: false },
  VI: { off: -4, minor: false },
  VII: { off: -2, minor: false },
};

export const buildV2Timeline = (id: string) => {
  const ad = v2Ad(id);
  const segs = segStarts(ad);
  return {
    ad: ad.id,
    file: ad.file,
    fps: 30,
    bpm: 120,
    totalFrames: totalFrames(ad),
    bars: totalBars(ad),
    slots: segs.map((s, index) => ({ type: s.seg.type, index, start: s.start, duration: s.duration })),
    sections: sections(ad),
    music: ad.music,
    chords: sections(ad).map((_, b) => CHORDS[ad.music.chords[b % ad.music.chords.length]]),
    hits: drumHits(ad),
    vo: [] as unknown[],
    sfx: [] as unknown[],
  };
};

export type SegInfo = ReturnType<typeof segStarts>[number] & { seg: Seg };
