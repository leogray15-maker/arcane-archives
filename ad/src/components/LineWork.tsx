import React from "react";
import { useCurrentFrame } from "remotion";
import { config } from "../ad.config";
import { ease, easeInExpo } from "../anim";

const C = config.colors;
const M = config.safe.margin;
const TOP = 300;
const BOTTOM = config.height - config.safe.bottom - 20;
// The lower frame corner stops short of the TikTok/Reels action rail.
const BR = config.width - config.safe.rightRail;

export type Sigil = "circle" | "triangle" | "hexagram" | "square" | "orbit" | "none";

const polygon = (cx: number, cy: number, r: number, n: number, rot = -Math.PI / 2) =>
  Array.from({ length: n }, (_, i) => {
    const a = rot + (i / n) * Math.PI * 2;
    return `${i ? "L" : "M"}${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
  }).join(" ") + " Z";

const circle = (cx: number, cy: number, r: number) =>
  `M${cx + r} ${cy} A${r} ${r} 0 1 1 ${cx - r} ${cy} A${r} ${r} 0 1 1 ${cx + r} ${cy}`;

/**
 * The gold hermetic line-work that frames every scene. It draws itself in over
 * the first ~20 frames and un-draws over the last ~14: the connective tissue
 * between scenes.
 */
export const LineWork: React.FC<{
  duration: number;
  sigil?: Sigil;
  cx?: number;
  cy?: number;
  r?: number;
  spin?: number;
  opacity?: number;
  delay?: number;
}> = ({ duration, sigil = "circle", cx = 540, cy = 1020, r = 420, spin = 0, opacity = 0.55, delay = 0 }) => {
  const frame = useCurrentFrame();
  const out = ease(frame, [duration - 16, duration - 2], [0, 1], easeInExpo);

  const paths: { d: string; w: number; o: number; dash?: string }[] = [];
  const b = 44;
  // Corner brackets on the safe area
  paths.push({ d: `M${M} ${TOP + b} L${M} ${TOP} L${M + b} ${TOP}`, w: 2, o: 0.9 });
  paths.push({ d: `M${config.width - M - b} ${TOP} L${config.width - M} ${TOP} L${config.width - M} ${TOP + b}`, w: 2, o: 0.9 });
  paths.push({ d: `M${M} ${BOTTOM - b} L${M} ${BOTTOM} L${M + b} ${BOTTOM}`, w: 2, o: 0.9 });
  paths.push({ d: `M${BR - b} ${BOTTOM} L${BR} ${BOTTOM} L${BR} ${BOTTOM - b}`, w: 2, o: 0.9 });
  // Hairlines
  paths.push({ d: `M${M + b + 16} ${TOP} L${config.width - M - b - 16} ${TOP}`, w: 1, o: 0.35 });
  paths.push({ d: `M${M + b + 16} ${BOTTOM} L${BR - b - 16} ${BOTTOM}`, w: 1, o: 0.35 });

  if (sigil !== "none") {
    paths.push({ d: circle(cx, cy, r), w: 1.5, o: 0.8 });
    paths.push({ d: circle(cx, cy, r * 0.86), w: 1, o: 0.45, dash: "0.004 0.01" });
    paths.push({ d: `M${cx - r - 50} ${cy} L${cx + r + 50} ${cy} M${cx} ${cy - r - 50} L${cx} ${cy + r + 50}`, w: 1, o: 0.25 });
    if (sigil === "triangle") {
      paths.push({ d: polygon(cx, cy, r * 0.86, 3), w: 1.2, o: 0.6 });
      paths.push({ d: circle(cx, cy, r * 0.43), w: 1, o: 0.5 });
    }
    if (sigil === "hexagram") {
      paths.push({ d: polygon(cx, cy, r * 0.86, 3), w: 1.2, o: 0.55 });
      paths.push({ d: polygon(cx, cy, r * 0.86, 3, Math.PI / 2), w: 1.2, o: 0.55 });
    }
    if (sigil === "square") {
      paths.push({ d: polygon(cx, cy, r * 0.86, 4, Math.PI / 4), w: 1.2, o: 0.5 });
      paths.push({ d: polygon(cx, cy, r * 0.86, 4, 0), w: 1, o: 0.35 });
    }
    if (sigil === "orbit") {
      paths.push({ d: circle(cx, cy, r * 1.18), w: 1, o: 0.35, dash: "0.02 0.012" });
      paths.push({ d: polygon(cx, cy, r * 0.86, 6, 0), w: 1, o: 0.45 });
    }
    // Tick marks
    const ticks = Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2;
      const r1 = r * (i % 2 ? 1.02 : 1.0);
      const r2 = r * (i % 6 === 0 ? 1.09 : 1.045);
      return `M${(cx + Math.cos(a) * r1).toFixed(1)} ${(cy + Math.sin(a) * r1).toFixed(1)} L${(cx + Math.cos(a) * r2).toFixed(1)} ${(cy + Math.sin(a) * r2).toFixed(1)}`;
    }).join(" ");
    paths.push({ d: ticks, w: 1.2, o: 0.6 });
  }

  return (
    <svg width={config.width} height={config.height} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      {[paths.slice(0, 6), paths.slice(6)].map((group, gi) => (
      <g key={gi} style={{ transformOrigin: `${cx}px ${cy}px`, transform: gi ? `rotate(${spin * frame}deg)` : undefined }}>
        {group.map((p, j) => {
          const i = gi * 6 + j;
          const start = delay + i * 2;
          const inP = ease(frame, [start, start + 22], [0, 1]);
          return (
            <path
              key={i}
              d={p.d}
              pathLength={1}
              fill="none"
              stroke={C.gold}
              strokeWidth={p.w}
              strokeLinecap="round"
              strokeDasharray={p.dash ?? "1 1"}
              strokeDashoffset={p.dash ? 0 : 1 - inP + out * -1}
              opacity={p.o * opacity * (p.dash ? inP * (1 - out) : 1)}
            />
          );
        })}
      </g>
      ))}
    </svg>
  );
};
