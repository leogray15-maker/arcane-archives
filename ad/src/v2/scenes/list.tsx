import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ease, rng, spr } from "../../anim";
import { BEAT, MONO, SANS, T } from "../theme";
import { popFrames } from "../timeline";
import { clamp, Label, Panel, usePunch, useSeg, Words } from "../ui";

const CLIPS = ["This ONE trick changed everything", "Day in my life at 19", "Stop doing this in 2026", "3 habits of the 1%", "Watch this before you trade", "The secret nobody tells you"];

const Clips: React.FC<{ f: number }> = ({ f }) => {
  const cut = BEAT * 2.5;
  const struck = clamp(f, cut, cut + 6);
  return (
    <>
      {CLIPS.map((c, i) => {
        const p = spr(f, i * 3.75, 14, 220);
        const r = rng(i + 3);
        const rot = (r() - 0.5) * 16;
        const x = 200 + (i % 3) * 300 + (r() - 0.5) * 30;
        const y = 790 + Math.floor(i / 3) * 360 + (r() - 0.5) * 30;
        return (
          <div
            key={c}
            style={{
              position: "absolute",
              left: x - 135,
              top: y,
              width: 270,
              height: 340,
              borderRadius: 20,
              background: `linear-gradient(170deg, #22203A, #121118)`,
              border: `1px solid ${T.line}`,
              padding: 18,
              boxSizing: "border-box",
              transform: `rotate(${rot}deg) scale(${p})`,
              opacity: 1 - struck * 0.6,
              filter: `grayscale(${struck})`,
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 29,
              lineHeight: 1.15,
              color: T.text,
              display: "flex",
              alignItems: "flex-end",
            }}
          >
            {c}
          </div>
        );
      })}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <line x1={90} y1={1480} x2={90 + 820 * struck} y2={780 + 700 * (1 - struck)} stroke={T.red} strokeWidth={14} strokeLinecap="round" opacity={struck > 0 ? 1 : 0} />
      </svg>
    </>
  );
};

const Progress: React.FC<{ f: number }> = ({ f }) => {
  const fill = ease(f, [6, BEAT * 3.2], [0, 1]);
  const done = fill > 0.99;
  const pop = spr(f, BEAT * 3.2, 11, 260);
  return (
    <Panel style={{ left: 60, top: 860, width: 880, height: 360, padding: "36px 40px" }}>
      <Label color={T.lav}>PROTOCOL</Label>
      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 56, letterSpacing: "-0.04em", color: T.text, marginTop: 14 }}>Discipline Mastery</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 34, fontFamily: MONO, fontSize: 22, color: T.muted }}>
        <span>{`MODULE ${String(Math.max(1, Math.round(fill * 12))).padStart(2, "0")} / 12`}</span>
        <span style={{ color: done ? T.green : T.muted }}>{done ? "COMPLETE" : `${Math.round(fill * 100)}%`}</span>
      </div>
      <div style={{ height: 14, borderRadius: 7, background: T.line, marginTop: 16 }}>
        <div style={{ width: `${fill * 100}%`, height: 14, borderRadius: 7, background: done ? T.green : T.lav }} />
      </div>
      {done && (
        <div style={{ position: "absolute", right: 40, top: 36, width: 72, height: 72, borderRadius: 36, background: T.green, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${pop})` }}>
          <svg width={40} height={40} viewBox="0 0 24 24">
            <path d="M5 12.5 L10 17 L19 7" fill="none" stroke={T.bg} strokeWidth={3.4} strokeLinecap="round" />
          </svg>
        </div>
      )}
    </Panel>
  );
};

const Quest: React.FC<{ f: number }> = ({ f }) => {
  const days = Math.min(7, Math.floor(f / 7.5) + 1);
  return (
    <>
      <Panel style={{ left: 60, top: 820, width: 880, height: 250, padding: "32px 38px" }}>
        <Label color={T.lav}>DAILY QUEST · 06:00</Label>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 40, lineHeight: 1.25, color: T.text, marginTop: 18 }}>Finish one module. Post one takeaway in the room.</div>
      </Panel>
      <div style={{ position: "absolute", top: 1120, left: 60, width: 880, display: "flex", gap: 14 }}>
        {"MTWTFSS".split("").map((d, i) => {
          const on = i < days;
          const p = spr(f, i * 7.5, 13, 260);
          return (
            <div key={i} style={{ flex: 1, height: 130, borderRadius: 18, border: `1.5px solid ${on ? T.lav : T.line}`, background: on ? `${T.violet}33` : T.panel, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, transform: `scale(${on ? 0.9 + 0.1 * p : 1})` }}>
              <span style={{ fontFamily: MONO, fontSize: 20, color: T.muted }}>{d}</span>
              <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 34, color: on ? T.lav : T.dim }}>{on ? "✓" : "·"}</span>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", top: 1290, left: 60, width: 880, textAlign: "center", fontFamily: MONO, fontSize: 24, letterSpacing: "0.2em", color: T.muted }}>
        <span style={{ color: T.text }}>30 MIN</span> × 365 = <span style={{ color: T.lav }}>180+ HOURS</span>
      </div>
    </>
  );
};

const CANDLES = (() => {
  const r = rng(77);
  let p = 100;
  return Array.from({ length: 40 }, (_, i) => {
    const drift = i < 14 ? 0 : i < 26 ? 0.7 : -0.2;
    const o = p;
    const c = o + drift + (r() - 0.5) * (i < 14 ? 1 : 2.6);
    p = c;
    return { o, c, h: Math.max(o, c) + r() * 1.3, l: Math.min(o, c) - r() * 1.3 };
  });
})();

export const MiniChart: React.FC<{ f: number; top?: number; height?: number; bands?: number[]; drawTo?: number }> = ({ f, top = 820, height = 560, bands = [BEAT, BEAT * 2, BEAT * 3], drawTo = BEAT * 3.5 }) => {
  const W = 880;
  const lo = Math.min(...CANDLES.map((c) => c.l)) - 1;
  const hi = Math.max(...CANDLES.map((c) => c.h)) + 1;
  const y = (v: number) => 70 + (height - 110) * (1 - (v - lo) / (hi - lo));
  const x = (i: number) => 30 + (i + 0.5) * ((W - 60) / CANDLES.length);
  const shown = ease(f, [0, drawTo], [0, CANDLES.length]);
  const Z = [
    { a: 2, b: 12, name: "ASIA", col: T.violet },
    { a: 14, b: 24, name: "LONDON", col: T.orange },
    { a: 27, b: 37, name: "NEW YORK", col: T.green },
  ];
  return (
    <Panel style={{ left: 60, top, width: W, height }}>
      <svg width={W} height={height}>
        {Z.map((z, i) => {
          const p = ease(f, [bands[i], bands[i] + 10]);
          const x0 = x(z.a) - 10;
          const w = (x(z.b) - x(z.a) + 20) * p;
          return (
            <g key={z.name} opacity={p > 0 ? 1 : 0}>
              <rect x={x0} y={40} width={w} height={height - 70} fill={z.col} opacity={0.12} />
              <text x={x0 + 10} y={30} fontFamily={MONO} fontSize={18} letterSpacing="0.14em" fill={z.col}>
                {z.name}
              </text>
            </g>
          );
        })}
        {CANDLES.map((c, i) => {
          const p = Math.max(0, Math.min(1, shown - i));
          if (!p) return null;
          const col = c.c >= c.o ? "#26A69A" : "#EF5350";
          return (
            <g key={i} opacity={p}>
              <line x1={x(i)} x2={x(i)} y1={y(c.h)} y2={y(c.l)} stroke={col} strokeWidth={2} />
              <rect x={x(i) - 7} y={y(Math.max(c.o, c.c))} width={14} height={Math.max(2, Math.abs(y(c.o) - y(c.c)))} fill={col} rx={1.5} />
            </g>
          );
        })}
      </svg>
    </Panel>
  );
};

const Room: React.FC<{ f: number }> = ({ f }) => {
  const r = rng(12);
  const L = "ABCDEFGHJKLMNPRSTVWY";
  return (
    <div style={{ position: "absolute", top: 820, left: 60, width: 880, display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 22 }}>
      {Array.from({ length: 15 }, (_, i) => {
        const p = spr(f, i * 3.75, 13, 260);
        const ini = L[Math.floor(r() * L.length)] + L[Math.floor(r() * L.length)];
        const hot = i === 7;
        return (
          <div key={i} style={{ display: "flex", justifyContent: "center", transform: `scale(${p})` }}>
            <div style={{ width: 140, height: 140, borderRadius: 70, background: `radial-gradient(circle at 30% 25%, #2A2440, #111117)`, border: `2px solid ${hot ? T.lav : T.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 34, color: hot ? T.lav : "#B9B5C9", boxShadow: hot ? `0 0 30px ${T.violet}88` : undefined }}>
              {ini}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** Numbered list beat: big number, the point, and a visual that proves it. */
export const ListItem: React.FC = () => {
  const frame = useCurrentFrame();
  const { seg } = useSeg();
  const punch = usePunch();
  const n = (seg.p?.n as number) ?? 1;
  const visual = seg.p?.visual as string;
  const lines = seg.lines ?? [""];
  const numP = spr(frame, 0, 12, 280);
  return (
    <AbsoluteFill style={{ transform: `scale(${1 + punch * 0.01})` }}>
      <div style={{ position: "absolute", top: 290, left: 60, fontFamily: SANS, fontWeight: 900, fontSize: 200, letterSpacing: "-0.06em", color: T.lav, lineHeight: 1, transform: `scale(${numP})`, transformOrigin: "0% 50%" }}>{`${n}.`}</div>
      <div style={{ position: "absolute", top: 330, right: 140, fontFamily: MONO, fontSize: 22, letterSpacing: "0.3em", color: T.muted }}>{`${n} / 5`}</div>
      <Words lines={lines} frames={popFrames(lines, 3, 5)} size={96} top={520} align="left" accent={seg.accent ?? -1} />
      {visual === "clips" && <Clips f={frame} />}
      {visual === "progress" && <Progress f={frame} />}
      {visual === "quest" && <Quest f={frame} />}
      {visual === "chart" && <MiniChart f={frame} />}
      {visual === "room" && <Room f={frame} />}
    </AbsoluteFill>
  );
};
