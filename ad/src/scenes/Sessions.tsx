import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { config } from "../ad.config";
import { ease, easeInOut, spr } from "../anim";
import { Headline } from "../components/Headline";
import { LineWork } from "../components/LineWork";
import { Footnote, Label } from "../components/ui";
import { MONO } from "../fonts";
import { useCues, useSpec } from "../SceneContext";

const C = config.colors;
const CX = 500;
const CY = 1010;
const R = 300;
// ICT killzones, New York time.
const ZONES = [
  { name: "ASIA", from: 20, to: 24, color: C.violet },
  { name: "LONDON", from: 2, to: 5, color: C.gold },
  { name: "NEW YORK", from: 7, to: 10, color: C.violetBright },
];
const ang = (h: number) => (h / 24) * Math.PI * 2 - Math.PI / 2;
const pt = (h: number, r: number) => [CX + Math.cos(ang(h)) * r, CY + Math.sin(ang(h)) * r];
const arc = (h0: number, h1: number, r: number) => {
  const [x0, y0] = pt(h0, r);
  const [x1, y1] = pt(h1, r);
  const large = ((h1 - h0 + 24) % 24) > 12 ? 1 : 0;
  return `M${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
};
const hhmm = (h: number) => {
  const hh = ((Math.floor(h) % 24) + 24) % 24;
  const mm = Math.floor((h - Math.floor(h)) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

/** A 24-hour dial: the three killzones light up as they're named, the clock hand sweeps into New York. */
export const Sessions: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues<"sessions">();
  const cfg = useSpec<"sessions">();
  const dialIn = ease(frame, [0, 26]);
  // Hand: 18:30 -> 08:10 (through Asia and London), then creeps.
  const h = 18.5 + ease(frame, [4, cue.active], [0, 13.67], easeInOut) + Math.max(0, frame - cue.active) * 0.004;
  const inNY = frame >= cue.active;
  const activeP = spr(frame, cue.active, 12, 200);
  const [hx, hy] = pt(h, R - 165);

  return (
    <AbsoluteFill>
      <LineWork duration={cue.dur} sigil="none" />
      <Headline lines={cfg.headline} wordFrames={cue.words} top={330} size={100} />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <filter id="sglow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx={CX} cy={CY} r={R} fill="#0B0A11" stroke={C.gold} strokeOpacity={0.6} strokeWidth={1.5} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - dialIn} />
        <circle cx={CX} cy={CY} r={R - 60} fill="none" stroke={C.cardLine} strokeWidth={1} opacity={dialIn} />
        {Array.from({ length: 96 }, (_, i) => {
          const hr = i / 4;
          const major = i % 4 === 0;
          const [x0, y0] = pt(hr, R - (major ? 22 : 12));
          const [x1, y1] = pt(hr, R - 2);
          return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={major ? C.gold : "#3A3646"} strokeWidth={major ? 2 : 1} opacity={ease(frame, [i * 0.2, i * 0.2 + 10])} />;
        })}
        {Array.from({ length: 8 }, (_, i) => {
          const [x, y] = pt(i * 3, R + 36);
          return (
            <text key={i} x={x} y={y + 7} textAnchor="middle" fontFamily={MONO} fontSize={20} fill={C.muted} opacity={ease(frame, [8 + i, 20 + i])}>
              {String(i * 3).padStart(2, "0")}
            </text>
          );
        })}
        {ZONES.map((z, i) => {
          const at = cue.arcs[i];
          const p = ease(frame, [at, at + 18]);
          if (p <= 0) return null;
          const to = z.from + ((z.to - z.from + 24) % 24) * p;
          const [lx, ly] = pt((z.from + ((z.to - z.from + 24) % 24) / 2) % 24, R - 108);
          const flare = ease(frame, [at, at + 24], [1, 0]);
          return (
            <g key={z.name}>
              <path d={arc(z.from, to, R - 36)} fill="none" stroke={z.color} strokeWidth={30 + flare * 10} strokeLinecap="butt" opacity={0.9} filter="url(#sglow)" />
              <text x={lx} y={ly + 7} textAnchor="middle" fontFamily={MONO} fontSize={19} letterSpacing="0.18em" fill={z.color} opacity={ease(frame, [at + 6, at + 16])}>
                {z.name}
              </text>
              <text x={lx} y={ly + 32} textAnchor="middle" fontFamily={MONO} fontSize={15} fill={C.muted} opacity={ease(frame, [at + 8, at + 18])}>
                {`${String(z.from).padStart(2, "0")}:00–${String(z.to % 24).padStart(2, "0")}:00`}
              </text>
            </g>
          );
        })}
        {/* hand */}
        <line x1={CX} y1={CY} x2={hx} y2={hy} stroke={C.goldBright} strokeWidth={3} strokeLinecap="round" opacity={dialIn} />
        <circle cx={hx} cy={hy} r={7} fill={C.goldBright} filter="url(#sglow)" opacity={dialIn} />
        <circle cx={CX} cy={CY} r={10} fill={C.gold} />
      </svg>
      <div style={{ position: "absolute", top: CY + 40, left: CX - 200, width: 400, textAlign: "center", opacity: dialIn }}>
        <div style={{ fontFamily: MONO, fontSize: 56, fontWeight: 500, color: C.text, fontVariantNumeric: "tabular-nums" }}>{hhmm(h)}</div>
        <Label size={15} style={{ marginTop: 4 }}>
          NEW YORK TIME
        </Label>
      </div>
      <div
        style={{
          position: "absolute",
          top: CY + R + 76,
          left: CX - 230,
          width: 460,
          height: 58,
          borderRadius: 29,
          border: `1.5px solid ${C.violetBright}`,
          background: `${C.violet}22`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          fontFamily: MONO,
          fontSize: 20,
          letterSpacing: "0.2em",
          color: C.violetBright,
          opacity: inNY ? Math.min(1, activeP * 1.4) : 0,
          transform: `scale(${0.85 + 0.15 * activeP})`,
          boxShadow: `0 0 30px ${C.violet}55`,
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: 5, background: C.violetBright, opacity: 0.5 + 0.5 * Math.sin(frame / 4) }} />
        NY KILLZONE · ACTIVE
      </div>
      <Footnote top={1500} opacity={ease(frame, [6, 18])}>
        {cfg.disclaimer}
      </Footnote>
    </AbsoluteFill>
  );
};
