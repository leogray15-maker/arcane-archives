import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ease, easeInOut, rng, spr } from "../../anim";
import { sparkPath } from "../../components/ui";
import { BEAT, MONO, SANS, T } from "../theme";
import { popFrames } from "../timeline";
import { Kicker, Label, LivePill, Panel, usePunch, useSeg, Words } from "../ui";
import { MiniChart } from "./list";

const CX = 500;
const CY = 1060;
const R = 300;
const ZONES = [
  { name: "ASIA", from: 20, to: 24, col: T.violet },
  { name: "LONDON", from: 2, to: 5, col: T.orange },
  { name: "NEW YORK", from: 7, to: 10, col: T.green },
];
const ang = (h: number) => (h / 24) * Math.PI * 2 - Math.PI / 2;
const pt = (h: number, r: number) => [CX + Math.cos(ang(h)) * r, CY + Math.sin(ang(h)) * r];
const arc = (h0: number, h1: number, r: number) => {
  const [x0, y0] = pt(h0, r);
  const [x1, y1] = pt(h1, r);
  return `M${x0} ${y0} A${r} ${r} 0 ${((h1 - h0 + 24) % 24) > 12 ? 1 : 0} 1 ${x1} ${y1}`;
};

/** 24h dial: a killzone lights up on each beat, the hand sweeps into New York. */
export const Dial: React.FC = () => {
  const frame = useCurrentFrame();
  const { seg, duration } = useSeg();
  const lines = seg.lines ?? ["", ""];
  const at = [BEAT, BEAT * 2, BEAT * 3];
  const h = 18.5 + ease(frame, [0, BEAT * 4], [0, 13.8], easeInOut) + Math.max(0, frame - BEAT * 4) * 0.01;
  const [hx, hy] = pt(h, R - 130);
  const live = frame >= BEAT * 4;
  const lp = spr(frame, BEAT * 4, 12, 240);
  const hh = Math.floor(h) % 24;
  const mm = Math.floor((h % 1) * 60);
  void duration;
  return (
    <AbsoluteFill>
      <Words lines={lines} frames={[[at[0], at[1]], [at[2], at[2] + 4]]} size={104} top={320} />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <circle cx={CX} cy={CY} r={R} fill={T.panel} stroke={T.line} strokeWidth={2} />
        {Array.from({ length: 24 }, (_, i) => {
          const [x0, y0] = pt(i, R - (i % 3 === 0 ? 24 : 12));
          const [x1, y1] = pt(i, R - 4);
          return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={i % 3 === 0 ? T.muted : T.dim} strokeWidth={i % 3 === 0 ? 3 : 1.5} />;
        })}
        {[0, 6, 12, 18].map((i) => {
          const [x, y] = pt(i, R + 38);
          return (
            <text key={i} x={x} y={y + 8} textAnchor="middle" fontFamily={MONO} fontSize={24} fill={T.muted}>
              {String(i).padStart(2, "0")}
            </text>
          );
        })}
        {ZONES.map((z, i) => {
          const p = ease(frame, [at[i], at[i] + 8]);
          if (!p) return null;
          const span = (z.to - z.from + 24) % 24;
          const [lx, ly] = pt(z.from + span / 2, R - 100);
          return (
            <g key={z.name}>
              <path d={arc(z.from, z.from + span * p, R - 40)} fill="none" stroke={z.col} strokeWidth={36} />
              <text x={lx} y={ly + 8} textAnchor="middle" fontFamily={MONO} fontSize={20} letterSpacing="0.14em" fill={z.col} opacity={p}>
                {z.name}
              </text>
            </g>
          );
        })}
        <line x1={CX} y1={CY} x2={hx} y2={hy} stroke={T.text} strokeWidth={5} strokeLinecap="round" />
        <circle cx={CX} cy={CY} r={12} fill={T.text} />
      </svg>
      <div style={{ position: "absolute", top: CY + 40, left: CX - 150, width: 300, textAlign: "center", fontFamily: MONO, fontSize: 48, color: T.text }}>{`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`}</div>
      <div style={{ position: "absolute", top: CY + R + 40, left: CX - 220, width: 440, display: "flex", justifyContent: "center", opacity: live ? 1 : 0, transform: `scale(${1.25 + 0.2 * lp})` }}>
        <LivePill text="NY KILLZONE · ACTIVE" />
      </div>
    </AbsoluteFill>
  );
};

/** Candles draw in while the three killzones sweep across on the beat. */
export const Chart: React.FC = () => {
  const frame = useCurrentFrame();
  const { seg } = useSeg();
  const lines = seg.lines ?? ["", ""];
  return (
    <AbsoluteFill>
      <Words lines={lines} frames={popFrames(lines, 0, 7.5)} size={104} top={320} />
      <MiniChart f={frame} top={640} height={800} bands={[BEAT * 2, BEAT * 3, BEAT * 4]} drawTo={BEAT * 6} />
    </AbsoluteFill>
  );
};

const QUOTES = [
  { sym: "XAU", name: "Gold", px: 3987.4, ch: 0.42, dp: 2 },
  { sym: "BTC", name: "Bitcoin", px: 84736.0, ch: 0.36, dp: 2 },
  { sym: "ETH", name: "Ether", px: 2702.69, ch: 0.24, dp: 2 },
  { sym: "OIL", name: "WTI crude", px: 92.45, ch: -2.45, dp: 2 },
  { sym: "SPX", name: "S&P 500", px: 7745.9, ch: 0.65, dp: 1 },
  { sym: "VIX", name: "Volatility", px: 17.81, ch: -1.55, dp: 2 },
];
const SPARKS = QUOTES.map((q, i) => {
  const r = rng(300 + i);
  let v = 100;
  return Array.from({ length: 30 }, (_, k) => (v += (r() - 0.5) * 3 + q.ch * 0.2 * (k > 15 ? 1.5 : 0.5)));
});

export const Watchlist: React.FC = () => {
  const frame = useCurrentFrame();
  const { seg } = useSeg();
  const punch = usePunch();
  return (
    <AbsoluteFill style={{ transform: `scale(${1 + punch * 0.01})` }}>
      {seg.kicker && <Kicker text={seg.kicker} top={330} />}
      <Panel style={{ left: 60, top: 420, width: 880, height: 1040, padding: "20px 34px" }}>
        {QUOTES.map((q, i) => {
          const p = spr(frame, i * 3.75, 14, 240);
          const r = rng(i * 97 + Math.floor(frame / 5));
          const px = q.px * (1 + (r() - 0.5) * 0.0005);
          const col = q.ch >= 0 ? T.green : T.red;
          return (
            <div key={q.sym} style={{ display: "flex", alignItems: "center", gap: 20, height: 166, borderTop: i ? `1px solid ${T.line}` : undefined, opacity: Math.min(1, p * 1.5), transform: `translateX(${(1 - p) * 60}px)` }}>
              <span style={{ width: 80, height: 80, borderRadius: 40, background: T.panel2, border: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 20, color: T.lav }}>{q.sym}</span>
              <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 36, color: T.text, width: 220 }}>{q.name}</span>
              <svg width={170} height={60} style={{ overflow: "visible" }}>
                <path d={sparkPath(SPARKS[i], 170, 56, ease(frame, [i * 3.75, i * 3.75 + 20]))} fill="none" stroke={col} strokeWidth={3} />
              </svg>
              <span style={{ flex: 1, textAlign: "right" }}>
                <div style={{ fontFamily: MONO, fontSize: 32, color: T.text }}>{px.toLocaleString("en-US", { minimumFractionDigits: q.dp, maximumFractionDigits: q.dp })}</div>
                <div style={{ fontFamily: MONO, fontSize: 22, color: col }}>{`${q.ch >= 0 ? "+" : ""}${q.ch.toFixed(2)}%`}</div>
              </span>
            </div>
          );
        })}
      </Panel>
    </AbsoluteFill>
  );
};

const LESSONS = ["Market structure", "Liquidity", "Killzones & timing", "Risk management", "Journaling", "Psychology under pressure"];
export const Checklist: React.FC = () => {
  const frame = useCurrentFrame();
  const { seg } = useSeg();
  const done = Math.min(LESSONS.length, Math.floor(frame / 7.5));
  return (
    <AbsoluteFill>
      {seg.kicker && <Kicker text={seg.kicker} top={330} />}
      <Panel style={{ left: 60, top: 420, width: 880, height: 1040, padding: "30px 40px" }}>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 60, letterSpacing: "-0.04em", color: T.text }}>Start to finish.</div>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 60, letterSpacing: "-0.04em", color: T.lav, marginTop: -4 }}>In order.</div>
        <div style={{ height: 10, borderRadius: 5, background: T.line, margin: "30px 0 16px" }}>
          <div style={{ width: `${(done / LESSONS.length) * 100}%`, height: 10, borderRadius: 5, background: T.lav }} />
        </div>
        {LESSONS.map((l, i) => {
          const on = i < done;
          const p = spr(frame, (i + 1) * 7.5, 12, 280);
          return (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 22, height: 118, borderTop: `1px solid ${T.line}`, opacity: on ? 1 : 0.4 }}>
              <span style={{ fontFamily: MONO, fontSize: 22, color: on ? T.lav : T.dim, width: 42 }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 36, color: T.text, flex: 1 }}>{l}</span>
              <span style={{ width: 52, height: 52, borderRadius: 26, background: on ? T.lav : "transparent", border: `2px solid ${on ? T.lav : T.line}`, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${on ? 0.8 + 0.2 * p : 1})` }}>
                {on && (
                  <svg width={28} height={28} viewBox="0 0 24 24">
                    <path d="M5 12.5 L10 17 L19 7" fill="none" stroke={T.bg} strokeWidth={3.4} strokeLinecap="round" />
                  </svg>
                )}
              </span>
            </div>
          );
        })}
      </Panel>
    </AbsoluteFill>
  );
};
