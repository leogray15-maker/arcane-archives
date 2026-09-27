/**
 * THE one file to edit when cutting ads.
 *
 * Each entry in `ads` is one finished advert: an ordered list of scenes. A scene
 * is a `type` (which component draws it) plus its copy, voiceover lines and
 * length. Reuse any scene type in any ad, reorder them, or change the copy, and
 * the timing map (src/timeline.ts), animation cues and audio all follow.
 *
 * All times are in frames at `fps` (30fps => 30 frames = 1 second).
 */

type Vo = { text: string; at: number };
type Base = { duration: number; headline: [string, string]; vo: Vo[] };

/** Extra fields per scene type. */
export interface SceneExtras {
  hook: {};
  library: { moduleCount: number; domains: string[] };
  connection: { domains: string[] };
  markets: { disclaimer: string; symbol: string };
  live: { globe: boolean };
  rank: { tiers: string[] };
  founder: { labels: [string, string] };
  cta: {};
  // --- added for ads 02-06 ---
  globeLayers: { layers: string[] };
  instability: { note: string };
  intel: {};
  ticker: { disclaimer: string };
  sessions: { disclaimer: string };
  modules: { programme: string; items: string[]; disclaimer?: string };
  realms: {};
  steps: {};
  quest: {};
  kitchen: {};
  room: {};
  referral: { refCode: string };
}
export type SceneType = keyof SceneExtras;
export type SceneSpec<T extends SceneType = SceneType> = { [K in T]: { type: K } & Base & SceneExtras[K] }[T];
export interface AdSpec {
  /** Output file stem: out/<file>-full.mp4 etc. */
  file: string;
  title: string;
  scenes: SceneSpec[];
}

const DOMAINS = ["Trading", "Business", "Psychology", "Mindset", "Health", "Esoteric", "Wealth", "Systems", "Philosophy"];
const TIERS = ["Seeker", "Initiate", "Adept", "Keeper", "Arcane Master"];
const RISK = "Educational content. Trading involves risk.";

const cta = (headline: [string, string] = ["The Arcane Archives.", "Enter."], first = "The Arcane Archives.", commentAt = 80, duration = 150): SceneSpec<"cta"> => ({
  type: "cta",
  duration,
  headline,
  vo: [
    { text: first, at: 28 },
    { text: "Comment, Archives.", at: commentAt },
  ],
});

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

  // Voiceover: Kokoro TTS voice + treatment (see scripts/vo.py).
  voice: { id: "bm_lewis", speed: 0.9, pitchSemitones: -0.8 },

  // Music ducking under the voice (dB) and loudness targets.
  mix: { duckDb: -10, targetLufs: -14, truePeakDb: -1.5 },

  ads: {
    // 01: the original trailer.
    original: {
      file: "arcane-archives-ad",
      title: "01 · The Trailer",
      scenes: [
        {
          type: "hook",
          duration: 100,
          headline: ["School taught you to obey.", "Not to think."],
          vo: [
            { text: "School taught you to obey.", at: 2 },
            { text: "Not to think.", at: 56 },
          ],
        },
        {
          type: "library",
          duration: 150,
          headline: ["3,300 modules.", "Nine domains."],
          moduleCount: 3300,
          domains: DOMAINS,
          vo: [{ text: "Three thousand three hundred modules. Nine domains.", at: 8 }],
        },
        {
          type: "connection",
          duration: 150,
          headline: ["Everything links", "to everything."],
          domains: DOMAINS,
          vo: [
            { text: "Trading.", at: 6 },
            { text: "Business.", at: 28 },
            { text: "Psychology.", at: 50 },
            { text: "The things they don't teach.", at: 78 },
          ],
        },
        {
          type: "markets",
          duration: 135,
          headline: ["Live charts.", "Killzones marked."],
          disclaimer: RISK,
          symbol: "XAUUSD · 15m",
          vo: [{ text: "Live markets.", at: 10 }],
        },
        {
          type: "live",
          duration: 135,
          headline: ["Live calls.", "A live world view."],
          globe: true,
          vo: [
            { text: "Live calls.", at: 6 },
            { text: "A live view of the world.", at: 58 },
          ],
        },
        {
          type: "rank",
          duration: 150,
          headline: ["Start as a Seeker.", "Leave a Master."],
          tiers: TIERS,
          vo: [{ text: "Start as a Seeker.", at: 8 }],
        },
        {
          type: "founder",
          duration: 135,
          headline: ["Built by a chef", "who became a trader."],
          labels: ["THE KITCHEN", "THE CHARTS"],
          vo: [{ text: "Built by a chef who became a trader.", at: 10 }],
        },
        cta(),
      ],
    },

    // 02: The Watchtower, the intelligence angle.
    watchtower: {
      file: "arcane-archives-ad-02-watchtower",
      title: "02 · The Watchtower",
      scenes: [
        {
          type: "hook",
          duration: 125,
          headline: ["They read headlines.", "You watch it move."],
          vo: [
            { text: "They read yesterday's headlines.", at: 2 },
            { text: "You watch it move.", at: 76 },
          ],
        },
        {
          type: "globeLayers",
          duration: 230,
          headline: ["The whole world.", "One screen."],
          layers: ["CONFLICT ZONES", "SHIPPING LANES", "UNDERSEA CABLES", "MILITARY ACTIVITY"],
          vo: [
            { text: "Conflict zones.", at: 28 },
            { text: "Shipping lanes.", at: 64 },
            { text: "Undersea cables.", at: 100 },
            { text: "Military movement.", at: 142 },
            { text: "One live map.", at: 180 },
          ],
        },
        {
          type: "instability",
          duration: 165,
          headline: ["Every flashpoint.", "Ranked."],
          note: "Illustrative preview. The real thing is live inside.",
          vo: [{ text: "Every flashpoint, ranked. And which way it's moving.", at: 10 }],
        },
        {
          type: "intel",
          duration: 190,
          headline: ["Forecasts.", "With sources."],
          vo: [
            { text: "Forecasts across every domain.", at: 8 },
            { text: "World briefs, with every claim sourced.", at: 86 },
          ],
        },
        {
          type: "ticker",
          duration: 125,
          headline: ["When the world moves,", "markets follow."],
          disclaimer: RISK,
          vo: [{ text: "And you see what the markets do next.", at: 10 }],
        },
        cta(["The Watchtower.", "Inside the Archives."], "The Watchtower. Inside The Arcane Archives.", 130, 180),
      ],
    },

    // 03: Trading, timing and structure. No P&L, no signals performance.
    trading: {
      file: "arcane-archives-ad-03-trading",
      title: "03 · Trading",
      scenes: [
        {
          type: "hook",
          duration: 110,
          headline: ["Most traders guess.", "You'll know when."],
          vo: [
            { text: "Most traders guess.", at: 2 },
            { text: "You'll know when.", at: 48 },
          ],
        },
        {
          type: "ticker",
          duration: 150,
          headline: ["Every market.", "One screen."],
          disclaimer: RISK,
          vo: [{ text: "Every market you care about. Live, on one screen.", at: 8 }],
        },
        {
          type: "sessions",
          duration: 175,
          headline: ["Asia. London.", "New York."],
          disclaimer: RISK,
          vo: [
            { text: "Asia.", at: 18 },
            { text: "London.", at: 42 },
            { text: "New York.", at: 66 },
            { text: "Know when price actually moves.", at: 94 },
          ],
        },
        {
          type: "markets",
          duration: 135,
          headline: ["Live charts.", "Killzones marked."],
          disclaimer: RISK,
          symbol: "XAUUSD · 15m",
          vo: [{ text: "Live charts, with the killzones already marked.", at: 10 }],
        },
        {
          type: "modules",
          duration: 165,
          headline: ["Start to finish.", "In order."],
          programme: "Full Trading Programme",
          items: ["Market structure", "Liquidity", "Killzones & timing", "Risk management", "Journaling", "Psychology under pressure"],
          disclaimer: RISK,
          vo: [{ text: "A full trading programme. Start to finish, in order.", at: 10 }],
        },
        {
          type: "live",
          duration: 120,
          headline: ["Stuck on a setup?", "Bring it live."],
          globe: false,
          vo: [{ text: "Stuck? Bring it to the weekly call.", at: 8 }],
        },
        cta(),
      ],
    },

    // 04: The Vault, how it works.
    vault: {
      file: "arcane-archives-ad-04-vault",
      title: "04 · The Vault",
      scenes: [
        {
          type: "hook",
          duration: 142,
          headline: ["Free content: tactics.", "The Archives: systems."],
          vo: [
            { text: "Free content hands you tactics.", at: 2 },
            { text: "This is the whole system.", at: 76 },
          ],
        },
        {
          type: "realms",
          duration: 165,
          headline: ["Four realms.", "46+ protocols."],
          vo: [{ text: "Four realms. Forty six protocols. Each one, start to finish.", at: 8 }],
        },
        {
          type: "steps",
          duration: 220,
          headline: ["No guesswork.", "A path from day one."],
          vo: [
            { text: "Day one: your first mission.", at: 20 },
            { text: "Every morning: a daily quest.", at: 80 },
            { text: "Every week: the War Room.", at: 152 },
          ],
        },
        {
          type: "quest",
          duration: 165,
          headline: ["Thirty minutes a day.", "180 hours a year."],
          vo: [{ text: "Thirty minutes a day adds up to over a hundred and eighty hours a year.", at: 10 }],
        },
        {
          type: "rank",
          duration: 150,
          headline: ["Start as a Seeker.", "Leave a Master."],
          tiers: TIERS,
          vo: [{ text: "Start as a Seeker. Leave a Master.", at: 8 }],
        },
        cta(),
      ],
    },

    // 05: The founder story, narrated in the third person.
    founder: {
      file: "arcane-archives-ad-05-founder",
      title: "05 · The Founder",
      scenes: [
        {
          type: "hook",
          duration: 130,
          headline: ["He didn't start on a desk.", "He started on the line."],
          vo: [
            { text: "He didn't start on a trading desk.", at: 2 },
            { text: "He started on the line.", at: 72 },
          ],
        },
        {
          type: "kitchen",
          duration: 140,
          headline: ["Tickets. Heat.", "Pressure."],
          vo: [{ text: "Service after service. Tickets, heat, pressure.", at: 10 }],
        },
        {
          type: "founder",
          duration: 135,
          headline: ["Then he found", "the charts."],
          labels: ["THE KITCHEN", "THE CHARTS"],
          vo: [{ text: "Then he found the charts.", at: 40 }],
        },
        {
          type: "markets",
          duration: 125,
          headline: ["Now he trades", "full time."],
          disclaimer: RISK,
          symbol: "XAUUSD · 15m",
          vo: [{ text: "Now he trades full time.", at: 10 }],
        },
        {
          type: "library",
          duration: 160,
          headline: ["So he built the library", "he wished he'd had."],
          moduleCount: 3300,
          domains: DOMAINS,
          vo: [{ text: "So he built the library he wished he'd had.", at: 8 }],
        },
        {
          type: "live",
          duration: 120,
          headline: ["And he's still", "on the call."],
          globe: false,
          vo: [{ text: "And he's still on the call, every week.", at: 8 }],
        },
        cta(),
      ],
    },

    // 06: The Room, community, ranks and referrals (Arcane Credits, no cash figures).
    room: {
      file: "arcane-archives-ad-06-room",
      title: "06 · The Room",
      scenes: [
        {
          type: "hook",
          duration: 100,
          headline: ["Nobody climbs", "alone."],
          vo: [
            { text: "Nobody gets there alone.", at: 2 },
            { text: "Not here.", at: 58 },
          ],
        },
        {
          type: "room",
          duration: 175,
          headline: ["A room moving", "at your pace."],
          vo: [{ text: "Join a room of people moving at the same pace as you.", at: 10 }],
        },
        {
          type: "rank",
          duration: 150,
          headline: ["Start as a Seeker.", "Climb to Master."],
          tiers: TIERS,
          vo: [{ text: "Start as a Seeker. Climb to Arcane Master.", at: 8 }],
        },
        {
          type: "referral",
          duration: 210,
          headline: ["Bring someone in.", "Climb together."],
          refCode: "SEEKER",
          vo: [
            { text: "Bring someone in with your own link.", at: 10 },
            { text: "Earn Arcane Credits for every member you refer.", at: 100 },
          ],
        },
        {
          type: "live",
          duration: 120,
          headline: ["Every week.", "Together."],
          globe: false,
          vo: [{ text: "And every week, you're on the call together.", at: 8 }],
        },
        cta(),
      ],
    },
  } satisfies Record<string, AdSpec>,
};

export type Config = typeof config;
export type AdId = keyof Config["ads"];
