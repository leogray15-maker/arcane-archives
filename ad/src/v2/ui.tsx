/** v2 building blocks, styled after the site: tight heavy sans, lavender accent, flat dark panels. */
import React, { createContext, useContext } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { fitText } from "@remotion/layout-utils";
import { spr } from "../anim";
import { MONO, SANS, T } from "./theme";
import type { Seg } from "./config";

export interface V2Ctx {
  seg: Seg;
  start: number; // absolute frame the segment starts
  duration: number;
  punches: number[]; // absolute kick frames
  index: number;
  firstOfType: boolean; // first of consecutive segments of the same type
}
export const SegCtx = createContext<V2Ctx | null>(null);
export const useSeg = () => {
  const c = useContext(SegCtx);
  if (!c) throw new Error("useSeg outside segment");
  return c;
};

/** 0..1 kick punch that decays over ~5 frames after every kick. */
export const usePunch = () => {
  const { punches, start } = useSeg();
  const f = useCurrentFrame() + start;
  let last = -999;
  for (const p of punches) {
    if (p <= f) last = p;
    else break;
  }
  return Math.exp(-(f - last) / 4.5);
};

export const clamp = (f: number, a: number, b: number, from = 0, to = 1) =>
  interpolate(f, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/** Word-by-word pop headline. Line 2 is the lavender accent, like the site. */
export const Words: React.FC<{
  lines: (string | undefined)[];
  frames: number[][];
  size?: number;
  top: number;
  align?: "left" | "center";
  width?: number;
  left?: number;
  lineGap?: number;
  /** Index of the lavender line; defaults to the last line when there are several. -1 = none. */
  accent?: number;
}> = ({ lines, frames, size = 104, top, align = "center", width = 880, left = 60, lineGap = 0.98, accent }) => {
  const acc = accent ?? (lines.filter(Boolean).length > 1 ? lines.length - 1 : -1);
  const frame = useCurrentFrame();
  const fitted = Math.min(
    size,
    ...lines.filter(Boolean).map((l) => fitText({ text: l!, withinWidth: width - 10, fontFamily: "Inter", fontWeight: 800, letterSpacing: "-0.05em" }).fontSize),
  );
  return (
    <div style={{ position: "absolute", top, left, width, textAlign: align, fontFamily: SANS, fontWeight: 800, fontSize: fitted, letterSpacing: "-0.05em", lineHeight: lineGap }}>
      {lines.map((line, li) =>
        line ? (
          <div key={li} style={{ color: li === acc ? T.lav : T.text, whiteSpace: "nowrap" }}>
            {line.split(" ").map((w, wi, arr) => {
              const f = frames[li]?.[wi] ?? 0;
              const p = f <= 0 ? 1 : spr(frame, f, 13, 280);
              const on = frame >= f || f <= 0;
              return (
                <span key={wi} style={{ display: "inline-block", marginRight: wi < arr.length - 1 ? "0.22em" : 0, opacity: on ? Math.min(1, p * 2) : 0, transform: `translateY(${(1 - p) * 0.18 * fitted}px) scale(${1 + (1 - p) * 0.14})` }}>
                  {w}
                </span>
              );
            })}
          </div>
        ) : null,
      )}
    </div>
  );
};

export const Kicker: React.FC<{ text: string; top?: number; color?: string }> = ({ text, top = 292, color = T.lav }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", top, left: 60, width: 880, textAlign: "center", fontFamily: MONO, fontSize: 22, letterSpacing: "0.34em", color, opacity: clamp(frame, 0, 6) }}>
      {text}
    </div>
  );
};

export const Panel: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode }> = ({ style, children }) => (
  <div
    style={{
      position: "absolute",
      borderRadius: 24,
      background: T.panel,
      border: `1px solid ${T.line}`,
      boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
      boxSizing: "border-box",
      overflow: "hidden",
      ...style,
    }}
  >
    {children}
  </div>
);

export const Label: React.FC<{ children: React.ReactNode; color?: string; size?: number; style?: React.CSSProperties }> = ({ children, color = T.muted, size = 17, style }) => (
  <div style={{ fontFamily: MONO, fontSize: size, letterSpacing: "0.26em", color, ...style }}>{children}</div>
);

export const LivePill: React.FC<{ text?: string }> = ({ text = "LIVE" }) => {
  const frame = useCurrentFrame();
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontFamily: MONO, fontSize: 17, letterSpacing: "0.24em", color: T.green, border: `1.5px solid ${T.green}66`, padding: "7px 16px", borderRadius: 30 }}>
      <span style={{ width: 10, height: 10, borderRadius: 5, background: T.green, opacity: 0.55 + 0.45 * Math.sin(frame / 4) }} />
      {text}
    </span>
  );
};

export const Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ fontFamily: MONO, fontSize: 16, letterSpacing: "0.14em", color: T.gold, border: `1.5px solid ${T.gold}99`, borderRadius: 9, padding: "7px 12px" }}>{children}</span>
);

export const RiskLine: React.FC = () => (
  <div style={{ position: "absolute", top: 1500, left: 60, width: 880, textAlign: "center", fontFamily: SANS, fontSize: 22, color: T.muted }}>Educational content. Trading involves risk.</div>
);

/** Flat background with two slow glows (the site's hero look). */
export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  return (
    <AbsoluteFill style={{ background: T.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 700px at ${25 + Math.sin(t * 0.4) * 8}% ${22 + Math.cos(t * 0.3) * 5}%, ${T.violet}26, transparent 70%),
            radial-gradient(900px 800px at ${78 + Math.cos(t * 0.3) * 6}% ${80 + Math.sin(t * 0.35) * 5}%, ${T.violet}14, transparent 70%)`,
        }}
      />
    </AbsoluteFill>
  );
};
