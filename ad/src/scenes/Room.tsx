import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { config } from "../ad.config";
import { ease, rng, spr } from "../anim";
import { ArcaneMark } from "../components/Chrome";
import { Headline } from "../components/Headline";
import { LineWork } from "../components/LineWork";
import { Label } from "../components/ui";
import { MONO, SANS } from "../fonts";
import { useCues, useSpec } from "../SceneContext";

const C = config.colors;
const CX = 500;
const CY = 1010;
const RINGS = [
  { r: 150, n: 6 },
  { r: 265, n: 10 },
  { r: 380, n: 14 },
];
const LETTERS = "ABCDEFGHJKLMNOPRSTVWY";
const PEOPLE = (() => {
  const r = rng(77);
  return RINGS.flatMap((ring, ri) =>
    Array.from({ length: ring.n }, (_, k) => ({
      ring: ri,
      k,
      a: (k / ring.n) * Math.PI * 2 + ri * 0.4,
      ini: LETTERS[Math.floor(r() * LETTERS.length)] + LETTERS[Math.floor(r() * LETTERS.length)],
      tier: Math.floor(r() * 5),
    })),
  );
})();
// Short, anonymous room messages (illustrative).
const MESSAGES = [
  { text: "Quest done. Day 41.", person: 17, side: -1 },
  { text: "London open in 5.", person: 24, side: 1 },
  { text: "Just hit Adept.", person: 9, side: -1 },
];
const TIER_COL = ["#8C86A8", C.violet, C.violetBright, C.gold, C.goldBright];

export const Room: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues<"room">();
  const cfg = useSpec<"room">();
  const rot = frame * 0.06;
  const pos = (p: (typeof PEOPLE)[number]) => {
    const R = RINGS[p.ring].r;
    const a = p.a + ((p.ring % 2 ? -rot : rot) * Math.PI) / 180;
    return { x: CX + Math.cos(a) * R, y: CY + Math.sin(a) * R * 0.92 };
  };
  const coreP = spr(frame, 2, 15, 120);

  return (
    <AbsoluteFill>
      <LineWork duration={cue.dur} sigil="circle" cx={CX} cy={CY} r={430} spin={0.03} opacity={0.25} />
      <Headline lines={cfg.headline} wordFrames={cue.words} top={330} size={100} />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {RINGS.map((ring, i) => (
          <ellipse key={i} cx={CX} cy={CY} rx={ring.r} ry={ring.r * 0.92} fill="none" stroke={C.gold} strokeOpacity={0.18} strokeDasharray="2 8" opacity={ease(frame, [cue.rings[i] - 6, cue.rings[i] + 6])} />
        ))}
        {PEOPLE.map((p, i) => {
          const at = cue.rings[p.ring] + p.k * 1.6;
          const q = pos(p);
          const o = ease(frame, [at, at + 12]) * 0.22;
          return <line key={i} x1={CX} y1={CY} x2={q.x} y2={q.y} stroke={C.violet} strokeOpacity={o} strokeWidth={1} />;
        })}
      </svg>
      {/* the room's core */}
      <div
        style={{
          position: "absolute",
          left: CX - 60,
          top: CY - 60,
          width: 120,
          height: 120,
          borderRadius: 60,
          background: `radial-gradient(circle, #2A2140, #0C0B12)`,
          border: `2px solid ${C.gold}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${coreP})`,
          boxShadow: `0 0 ${40 + 10 * Math.sin(frame / 8)}px ${C.gold}55`,
        }}
      >
        <ArcaneMark size={60} color={C.goldBright} />
      </div>
      {PEOPLE.map((p, i) => {
        const at = cue.rings[p.ring] + p.k * 1.6;
        const s = spr(frame, at, 13, 200);
        const q = pos(p);
        const size = [70, 62, 54][p.ring];
        const col = TIER_COL[p.tier];
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: q.x - size / 2,
              top: q.y - size / 2,
              width: size,
              height: size,
              borderRadius: "50%",
              background: "radial-gradient(circle at 30% 25%, #2A2440, #0C0B12)",
              border: `2px solid ${col}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: MONO,
              fontSize: size * 0.3,
              color: "#C9C4D6",
              transform: `scale(${frame >= at ? s : 0})`,
              boxShadow: p.tier >= 3 ? `0 0 14px ${col}66` : undefined,
            }}
          >
            {p.ini}
          </div>
        );
      })}
      {/* messages pop from members */}
      {MESSAGES.map((m, i) => {
        const at = cue.messages[i];
        if (frame < at) return null;
        const s = spr(frame, at, 13, 200);
        const q = pos(PEOPLE[m.person]);
        const w = 290;
        const left = Math.max(70, Math.min(930 - w, m.side < 0 ? q.x - w - 10 : q.x + 20));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left,
              top: q.y - 80,
              width: w,
              padding: "14px 18px",
              boxSizing: "border-box",
              borderRadius: 16,
              background: "#15131F",
              border: `1px solid ${C.violet}66`,
              boxShadow: "0 18px 30px rgba(0,0,0,0.5)",
              fontFamily: SANS,
              fontSize: 22,
              color: C.text,
              transform: `translateY(${(1 - s) * 16}px) scale(${0.85 + 0.15 * s})`,
              opacity: Math.min(1, s * 1.5),
            }}
          >
            <div style={{ fontFamily: MONO, fontSize: 13, color: C.violetBright, letterSpacing: "0.14em", marginBottom: 4 }}>{PEOPLE[m.person].ini} · NOW</div>
            {m.text}
          </div>
        );
      })}
      <div style={{ position: "absolute", top: 1480, left: 60, width: 880, display: "flex", justifyContent: "center", opacity: ease(frame, [20, 32]) }}>
        <Label size={18}>
          THE ROOM · <span style={{ color: C.violetBright }}>LIVE</span>
        </Label>
      </div>
    </AbsoluteFill>
  );
};
