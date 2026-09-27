import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { config } from "../ad.config";
import { ease, easeInOut, rng, spr } from "../anim";
import { Headline } from "../components/Headline";
import { LineWork } from "../components/LineWork";
import { MONO, SANS } from "../fonts";
import { sceneCues } from "../timeline";

const C = config.colors;
// TradingView-style candle colours (style only; no logo).
const UP = "#26A69A";
const DOWN = "#EF5350";

const P = { x: 60, y: 650, w: 850, h: 740 };
const PLOT = { x: P.x + 24, y: P.y + 110, w: P.w - 24 - 118, h: P.h - 110 - 70 };
const N = 64;

// Session layout across 64 fifteen-minute-ish bars (illustrative, NY time).
const ZONES = [
  { name: "ASIA KZ", time: "20:00–00:00", from: 4, to: 18, color: C.violet },
  { name: "LONDON KZ", time: "02:00–05:00", from: 24, to: 38, color: C.gold },
  { name: "NY KZ", time: "07:00–10:00", from: 44, to: 58, color: C.violet },
];
const TIMES = ["20:00", "00:00", "02:00", "05:00", "07:00", "10:00"];
const TIME_AT = [4, 18, 24, 38, 44, 58];

const CANDLES = (() => {
  const r = rng(2024);
  let p = 100;
  return Array.from({ length: N }, (_, i) => {
    // quiet in Asia, expansion in London, reversal + run in NY
    const drift = i < 20 ? 0.02 : i < 38 ? 0.55 : i < 46 ? -0.7 : 0.6;
    const vol = i < 20 ? 0.6 : 1.5;
    const o = p;
    const c = o + drift + (r() - 0.5) * 2.2 * vol;
    const h = Math.max(o, c) + r() * 1.2 * vol;
    const l = Math.min(o, c) - r() * 1.2 * vol;
    p = c;
    return { o, h, l, c };
  });
})();
const LO = Math.min(...CANDLES.map((c) => c.l)) - 2;
const HI = Math.max(...CANDLES.map((c) => c.h)) + 2;
const py = (v: number) => PLOT.y + PLOT.h - ((v - LO) / (HI - LO)) * PLOT.h;
const px = (i: number) => PLOT.x + (i + 0.5) * (PLOT.w / N);
const price = (v: number) => (2380 + v * 0.8).toFixed(2);

export const Markets: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = sceneCues("markets");
  const cfg = config.scenes.markets;
  // Panel opens from the flat gold line the graph collapsed into.
  const open = spr(frame, 0, 18, 110);
  const shown = ease(frame, [cue.candles.from, cue.candles.to], [0, N], easeInOut);
  const last = Math.max(0, Math.min(N - 1, Math.floor(shown) - 1));
  const live = CANDLES[last];
  // Last candle keeps ticking after the draw so the chart never sits still.
  const jitter = frame > cue.candles.to ? Math.sin(frame / 3.1) * 0.35 + Math.sin(frame / 7.3) * 0.5 : 0;
  const liveClose = live.c + jitter;
  const secs = 7 + Math.floor(frame / 30);
  const stamp = `14:32:${String(secs % 60).padStart(2, "0")} UTC`;

  return (
    <AbsoluteFill>
      <LineWork duration={cue.dur} sigil="none" />
      <Headline lines={cfg.headline} wordFrames={cue.words} top={330} size={100} />
      <div
        style={{
          position: "absolute",
          left: P.x,
          top: P.y,
          width: P.w,
          height: P.h,
          borderRadius: 26,
          background: "linear-gradient(180deg, #0D0C13, #09090E)",
          border: `1px solid ${C.cardLine}`,
          clipPath: `inset(${(1 - open) * 50}% 0 ${(1 - open) * 50}% 0 round 26px)`,
          boxShadow: `0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px ${C.gold}${open < 1 ? "55" : "11"}`,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ position: "absolute", left: 28, top: 26, display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 26, color: C.text }}>{cfg.symbol}</span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 15,
              letterSpacing: "0.2em",
              color: C.violetBright,
              border: `1px solid ${C.violet}66`,
              borderRadius: 20,
              padding: "4px 12px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 4, background: C.violetBright, opacity: 0.5 + 0.5 * Math.sin(frame / 4), boxShadow: `0 0 10px ${C.violet}` }} />
            LIVE
          </span>
        </div>
        <div style={{ position: "absolute", right: 28, top: 30, fontFamily: MONO, fontSize: 20, color: C.muted, letterSpacing: "0.06em" }}>{stamp}</div>
        <div style={{ position: "absolute", left: 28, top: 68, fontFamily: MONO, fontSize: 15, color: "#5E5A6B", letterSpacing: "0.12em" }}>
          ICT KILLZONES · NEW YORK TIME
        </div>
      </div>

      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, clipPath: `inset(${P.y + (1 - open) * P.h * 0.5}px 0 ${1920 - P.y - P.h + (1 - open) * P.h * 0.5}px 0)` }}>
        {/* Grid */}
        {Array.from({ length: 7 }, (_, i) => {
          const y = PLOT.y + (i / 6) * PLOT.h;
          return <line key={`h${i}`} x1={PLOT.x} x2={PLOT.x + PLOT.w} y1={y} y2={y} stroke="#1A1924" strokeWidth={1} />;
        })}
        {Array.from({ length: 9 }, (_, i) => {
          const x = PLOT.x + (i / 8) * PLOT.w;
          return <line key={`v${i}`} y1={PLOT.y} y2={PLOT.y + PLOT.h} x1={x} x2={x} stroke="#15141D" strokeWidth={1} />;
        })}
        {/* Killzone bands sweep across their session */}
        {ZONES.map((z, i) => {
          const at = cue.zones[i];
          const p = ease(frame, [at, at + 16]);
          const x0 = px(z.from) - PLOT.w / N / 2;
          const x1 = px(z.to) + PLOT.w / N / 2;
          const edge = ease(frame, [at + 10, at + 26], [1, 0]);
          return (
            <g key={z.name} opacity={p > 0 ? 1 : 0}>
              <rect x={x0} y={PLOT.y} width={(x1 - x0) * p} height={PLOT.h} fill={z.color} opacity={0.1} />
              <line x1={x0 + (x1 - x0) * p} x2={x0 + (x1 - x0) * p} y1={PLOT.y} y2={PLOT.y + PLOT.h} stroke={z.color} strokeWidth={2} opacity={0.4 + edge * 0.6} />
              <line x1={x0} x2={x0} y1={PLOT.y} y2={PLOT.y + PLOT.h} stroke={z.color} strokeOpacity={0.35} strokeDasharray="4 6" />
              <text x={x0 + 10} y={PLOT.y + 26} fontFamily={MONO} fontSize={16} letterSpacing="0.14em" fill={z.color} opacity={ease(frame, [at + 4, at + 14])}>
                {z.name}
              </text>
              <text x={x0 + 10} y={PLOT.y + 48} fontFamily={MONO} fontSize={13} fill={C.muted} opacity={ease(frame, [at + 6, at + 16])}>
                {z.time}
              </text>
            </g>
          );
        })}
        {/* Candles */}
        {CANDLES.map((c, i) => {
          const p = Math.max(0, Math.min(1, shown - i));
          if (p <= 0) return null;
          const isLast = i === last;
          const close = isLast ? liveClose : c.c;
          const up = close >= c.o;
          const col = up ? UP : DOWN;
          const bw = (PLOT.w / N) * 0.62;
          const top = py(Math.max(c.o, close));
          const bot = py(Math.min(c.o, close));
          const mid = (top + bot) / 2;
          return (
            <g key={i} opacity={p}>
              <line x1={px(i)} x2={px(i)} y1={py(Math.max(c.h, close))} y2={py(Math.min(c.l, close))} stroke={col} strokeWidth={1.6} transform={`translate(0 ${(1 - p) * 20})`} />
              <rect x={px(i) - bw / 2} y={mid - ((bot - top) / 2) * p} width={bw} height={Math.max(1.5, (bot - top) * p)} fill={col} rx={1} />
            </g>
          );
        })}
        {/* Live price line + tag */}
        {shown > 1 && (
          <g>
            <line x1={PLOT.x} x2={PLOT.x + PLOT.w} y1={py(liveClose)} y2={py(liveClose)} stroke={C.violet} strokeDasharray="3 5" strokeOpacity={0.8} />
            <circle cx={px(last)} cy={py(liveClose)} r={5 + Math.sin(frame / 4) * 1.5} fill={C.violetBright} style={{ filter: `drop-shadow(0 0 8px ${C.violet})` }} />
            <rect x={PLOT.x + PLOT.w + 8} y={py(liveClose) - 15} width={104} height={30} rx={6} fill={C.violet} />
            <text x={PLOT.x + PLOT.w + 60} y={py(liveClose) + 6} textAnchor="middle" fontFamily={MONO} fontSize={16} fontWeight={500} fill="#fff">
              {price(liveClose)}
            </text>
          </g>
        )}
        {/* Price scale */}
        {Array.from({ length: 6 }, (_, i) => {
          const v = LO + ((i + 0.5) / 6) * (HI - LO);
          return (
            <text key={i} x={PLOT.x + PLOT.w + 18} y={py(v) + 5} fontFamily={MONO} fontSize={15} fill="#5E5A6B">
              {price(v)}
            </text>
          );
        })}
        {/* Time axis */}
        {TIMES.map((t, i) => (
          <text key={t} x={px(TIME_AT[i])} y={PLOT.y + PLOT.h + 34} textAnchor="middle" fontFamily={MONO} fontSize={15} fill="#5E5A6B">
            {t}
          </text>
        ))}
      </svg>

      {/* Compliance line */}
      <div
        style={{
          position: "absolute",
          top: P.y + P.h + 26,
          left: 60,
          width: 880,
          textAlign: "center",
          fontFamily: SANS,
          fontSize: 22,
          color: C.muted,
          opacity: ease(frame, [4, 16]),
        }}
      >
        {cfg.disclaimer}
      </div>
    </AbsoluteFill>
  );
};
