/** Small shared UI atoms for the product-style panels (cards, labels, pills). */
import React from "react";
import { config } from "../ad.config";
import { MONO } from "../fonts";

const C = config.colors;

export const Panel: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode; glow?: number }> = ({ style, children, glow = 0 }) => (
  <div
    style={{
      position: "absolute",
      borderRadius: 26,
      background: "linear-gradient(170deg, #111019, #0A0A0F)",
      border: `1px solid ${glow > 0.02 ? C.gold + "88" : C.cardLine}`,
      boxShadow: `0 40px 80px rgba(0,0,0,0.55), inset 0 1px 0 #ffffff0a${glow > 0.02 ? `, 0 0 ${40 * glow}px ${C.gold}55` : ""}`,
      boxSizing: "border-box",
      overflow: "hidden",
      ...style,
    }}
  >
    {children}
  </div>
);

export const Label: React.FC<{ children: React.ReactNode; color?: string; size?: number; style?: React.CSSProperties }> = ({
  children,
  color = C.muted,
  size = 18,
  style,
}) => <div style={{ fontFamily: MONO, fontSize: size, letterSpacing: "0.3em", color, ...style }}>{children}</div>;

export const LivePill: React.FC<{ frame: number; text?: string; color?: string }> = ({ frame, text = "LIVE", color = C.violetBright }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      fontFamily: MONO,
      fontSize: 16,
      letterSpacing: "0.24em",
      color,
      border: `1px solid ${color}77`,
      padding: "6px 14px",
      borderRadius: 30,
      background: `${color}14`,
    }}
  >
    <span style={{ width: 9, height: 9, borderRadius: 5, background: color, opacity: 0.55 + 0.45 * Math.sin(frame / 4), boxShadow: `0 0 10px ${color}` }} />
    {text}
  </span>
);

/** Fixed-height, bottom-of-scene compliance/footnote line (kept above the bottom safe zone). */
export const Footnote: React.FC<{ children: React.ReactNode; opacity?: number; top?: number }> = ({ children, opacity = 1, top = 1492 }) => (
  <div style={{ position: "absolute", top, left: 60, width: 880, textAlign: "center", fontFamily: "Inter, sans-serif", fontSize: 21, color: C.muted, opacity }}>{children}</div>
);

/** Deterministic seeded sparkline path in a w x h box. */
export const sparkPath = (values: number[], w: number, h: number, upto = 1) => {
  const n = Math.max(2, Math.floor(values.length * upto));
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return values
    .slice(0, n)
    .map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * w).toFixed(1)} ${(h - ((v - lo) / (hi - lo || 1)) * h).toFixed(1)}`)
    .join(" ");
};
