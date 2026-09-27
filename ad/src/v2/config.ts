/**
 * v2 ads: music-led, no narrator. Everything is on a 120 BPM grid
 * (1 bar = 60 frames = 2s), so every cut lands on a downbeat.
 *
 * Each ad is a list of segments. A segment has a scene `type`, a length in
 * `bars`, on-screen `lines` (line 2 is the lavender accent) and scene props.
 * The `music` block sets the track that ad gets (key, chords, sound, where the
 * beat drops and breaks down). Edit this file to cut new ads.
 */

export type V2Type =
  | "hook"
  | "statement"
  | "listItem"
  | "payoff"
  | "cta"
  | "dashboard"
  | "globe"
  | "vaultScroll"
  | "step"
  | "rankFlip"
  | "counter"
  | "dial"
  | "chart"
  | "watchlist"
  | "checklist"
  | "warroom";

export interface Seg {
  type: V2Type;
  bars: number;
  /** On-screen lines. The last line is the lavender accent when there's more than one (set `accent: -1` for none). */
  lines?: string[];
  accent?: number;
  /** Small mono label above the headline. */
  kicker?: string;
  /** Scene-specific props. */
  p?: Record<string, unknown>;
  /** Show the trading risk line on this segment. */
  risk?: boolean;
}

export type Chord = "i" | "iv" | "v" | "V" | "III" | "VI" | "VII";

export interface Music {
  /** MIDI note of the key's root in the bass octave (38 = D2). */
  root: number;
  /** One chord per bar, cycled. The bar before the CTA always breaks down; the CTA downbeat is the big hit. */
  chords: Chord[];
  /** Melodic instrument: GM program number from MuseScore General (0 piano, 4 e-piano, 8 celesta, 45 pizzicato). */
  lead: number;
  /** Pad instrument (49 slow strings, 89 warm pad, 94 halo pad, 95 sweep pad). */
  pad: number;
  /** Bar index (0-based) where drums + 808 come in. */
  drop: number;
}

export interface V2Ad {
  id: string;
  file: string;
  title: string;
  music: Music;
  segs: Seg[];
}

export const RISK_LINE = "Educational content. Trading involves risk.";

export const V2_ADS: V2Ad[] = [
  {
    id: "zero",
    file: "arcane-archives-ad-07-from-zero",
    title: "07 · Starting from zero",
    // D minor: i - VI - III - VII (Dm Bb F C)
    music: { root: 38, chords: ["i", "VI", "III", "VII"], lead: 0, pad: 89, drop: 2 },
    segs: [
      { type: "hook", bars: 2, lines: ["Starting from", "zero in 2026?", "Do these 5 things."] },
      { type: "listItem", bars: 1, lines: ["Stop collecting", "random clips."], accent: -1, p: { n: 1, visual: "clips" } },
      { type: "listItem", bars: 1, lines: ["Pick one path.", "Finish it."], accent: -1, p: { n: 2, visual: "progress" } },
      { type: "listItem", bars: 1, lines: ["30 minutes.", "Every morning."], accent: -1, p: { n: 3, visual: "quest" } },
      { type: "listItem", bars: 1, lines: ["Learn when markets", "actually move."], accent: -1, p: { n: 4, visual: "chart" }, risk: true },
      { type: "listItem", bars: 1, lines: ["Get in a room", "doing the same."], accent: -1, p: { n: 5, visual: "room" } },
      { type: "payoff", bars: 2, lines: ["So I built the place", "that does all five."] },
      { type: "cta", bars: 2 },
    ],
  },
  {
    id: "watch",
    file: "arcane-archives-ad-08-watchtower",
    title: "08 · The Watchtower, live",
    // E minor: i - VI - VII - v (Em C D Bm)
    music: { root: 40, chords: ["i", "VI", "VII", "v"], lead: 8, pad: 94, drop: 2 },
    segs: [
      { type: "hook", bars: 2, lines: ["The news is", "already", "out of date."] },
      { type: "dashboard", bars: 2, kicker: "THE WATCHTOWER", lines: ["The whole world.", "One screen."], p: { focus: "instability" } },
      { type: "dashboard", bars: 1, kicker: "STRATEGIC RISK", p: { focus: "risk" } },
      { type: "dashboard", bars: 1, kicker: "AI FORECASTS", p: { focus: "forecasts" } },
      { type: "globe", bars: 2, lines: ["Conflict. Shipping.", "Cables. Military."] },
      { type: "statement", bars: 1, lines: ["Refreshed every", "5 minutes."] },
      { type: "cta", bars: 2, p: { top: "The Watchtower.", sub: "Inside The Arcane Archives." } },
    ],
  },
  {
    id: "order",
    file: "arcane-archives-ad-09-order",
    title: "09 · You need an order",
    // C minor: i - iv - VI - V (Cm Fm Ab G)
    music: { root: 36, chords: ["i", "iv", "VI", "V"], lead: 45, pad: 49, drop: 2 },
    segs: [
      { type: "hook", bars: 2, lines: ["You don't need", "another", "course."] },
      { type: "vaultScroll", bars: 2, lines: ["You need an order."] },
      { type: "step", bars: 1, p: { n: 1, when: "DAY ONE", title: "Escaping Hell.", sub: "The module that hands you the roadmap." } },
      { type: "step", bars: 1, p: { n: 2, when: "EVERY MORNING", title: "A Daily Quest.", sub: "Pinned before you start work." } },
      { type: "step", bars: 1, p: { n: 3, when: "EVERY WEEK", title: "The War Room.", sub: "Answered live. Recorded if you miss it." } },
      { type: "rankFlip", bars: 1, lines: ["Seeker to", "Arcane Master."] },
      { type: "counter", bars: 1, p: { to: 3330, label: "MODULES · 46 PROTOCOLS · ONE LOGIN" } },
      { type: "cta", bars: 2 },
    ],
  },
  {
    id: "timing",
    file: "arcane-archives-ad-10-timing",
    title: "10 · Same setup, wrong hour",
    // F# minor: i - VI - III - VII
    music: { root: 42, chords: ["i", "VI", "III", "VII"], lead: 4, pad: 95, drop: 2 },
    segs: [
      { type: "hook", bars: 2, lines: ["Same setup.", "Wrong hour."] },
      { type: "dial", bars: 2, lines: ["Asia. London.", "New York."], risk: true },
      { type: "chart", bars: 2, lines: ["Killzones,", "already marked."], risk: true },
      { type: "watchlist", bars: 1, kicker: "LIVE MARKETS", risk: true },
      { type: "checklist", bars: 1, kicker: "FULL TRADING PROGRAMME", risk: true },
      { type: "warroom", bars: 1, lines: ["Bring your chart.", "We go through it live."] },
      { type: "cta", bars: 2 },
    ],
  },
];

export const v2Ad = (id: string) => {
  const ad = V2_ADS.find((a) => a.id === id);
  if (!ad) throw new Error(`no v2 ad ${id}`);
  return ad;
};
