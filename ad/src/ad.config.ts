/**
 * THE one file to edit when cutting variants.
 *
 * Copy, colours, scene order, scene lengths, voiceover lines and the CTA keyword
 * all live here. Everything else (animation cue frames, sound-effect cue frames,
 * audio mix) is derived from this file by src/timeline.ts, so picture and sound
 * can never drift apart.
 *
 * All times are in frames at `fps` (30fps => 30 frames = 1 second).
 */

export const config = {
  fps: 30,
  width: 1080,
  height: 1920,

  brand: {
    name: "The Arcane Archives",
    url: "arcanearchives.shop",
    ctaKeyword: "ARCHIVES",
  },

  colors: {
    bg: "#07070A",
    gold: "#C9A45C",
    goldBright: "#E8C987",
    goldDeep: "#8A6B32",
    violet: "#8B7CF6",
    violetBright: "#B4A9FF",
    text: "#F4F1EA",
    muted: "#8C8898",
    card: "#0E0D14",
    cardLine: "#1E1C2A",
    up: "#3FD69A",
    down: "#E4596B",
  },

  // TikTok / Reels safe zones (px). Nothing important is placed inside these.
  safe: { top: 220, bottom: 380, rightRail: 140, margin: 60 },

  // Frames each scene overlaps the next one (the zoom-through / match-cut window).
  transitionFrames: 10,

  // Hold the last frame of the final scene (CTA) this long.
  finalHoldFrames: 45,

  // Voiceover: Kokoro TTS voice + treatment (see scripts/audio.py).
  voice: { id: "bm_lewis", speed: 0.9, pitchSemitones: -0.8 },

  // Music ducking under the voice (dB) and loudness targets.
  mix: { duckDb: -10, targetLufs: -14, truePeakDb: -1.5 },

  scenes: {
    hook: {
      duration: 100,
      headline: ["School taught you to obey.", "Not to think."],
      vo: [
        { text: "School taught you to obey.", at: 2 },
        { text: "Not to think.", at: 56 },
      ],
    },
    library: {
      duration: 150,
      headline: ["3,300 modules.", "Nine domains."],
      moduleCount: 3300,
      domains: [
        "Trading",
        "Business",
        "Psychology",
        "Mindset",
        "Health",
        "Esoteric",
        "Wealth",
        "Systems",
        "Philosophy",
      ],
      vo: [{ text: "Three thousand three hundred modules. Nine domains.", at: 8 }],
    },
    connection: {
      duration: 150,
      headline: ["Everything links", "to everything."],
      vo: [
        { text: "Trading.", at: 6 },
        { text: "Business.", at: 28 },
        { text: "Psychology.", at: 50 },
        { text: "The things they don't teach.", at: 78 },
      ],
    },
    markets: {
      duration: 135,
      headline: ["Live charts.", "Killzones marked."],
      disclaimer: "Educational content. Trading involves risk.",
      symbol: "XAUUSD · 15m",
      vo: [{ text: "Live markets.", at: 10 }],
    },
    live: {
      duration: 135,
      headline: ["Live calls.", "A live world view."],
      vo: [
        { text: "Live calls.", at: 6 },
        { text: "A live view of the world.", at: 58 },
      ],
    },
    rank: {
      duration: 150,
      headline: ["Start as a Seeker.", "Leave a Master."],
      tiers: ["Seeker", "Initiate", "Adept", "Keeper", "Arcane Master"],
      vo: [{ text: "Start as a Seeker.", at: 8 }],
    },
    founder: {
      duration: 135,
      headline: ["Built by a chef", "who became a trader."],
      vo: [{ text: "Built by a chef who became a trader.", at: 10 }],
    },
    cta: {
      duration: 150,
      headline: ["The Arcane Archives.", "Enter."],
      vo: [
        { text: "The Arcane Archives.", at: 28 },
        { text: "Comment, Archives.", at: 80 },
      ],
    },
  },

  /**
   * Variants = which scenes, in which order. Each one becomes its own Remotion
   * composition (e.g. `npx remotion render src/index.ts trading`).
   */
  variants: {
    full: ["hook", "library", "connection", "markets", "live", "rank", "founder", "cta"],
    trading: ["hook", "markets", "live", "rank", "cta"],
    founder: ["hook", "founder", "library", "rank", "cta"],
  },
} as const;

export type Config = typeof config;
export type SceneId = keyof Config["scenes"];
export type VariantId = keyof Config["variants"];
