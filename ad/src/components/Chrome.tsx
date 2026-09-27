/** Persistent layers: background, dust, film grain, vignette, top bar. */
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { config } from "../ad.config";
import { ease, rng, spr } from "../anim";
import { MONO, SANS } from "../fonts";
import { MARK_PATHS, MARK_VIEWBOX } from "./markPath";
type SceneSlot = { start: number };

const C = config.colors;

export const ArcaneMark: React.FC<{ size: number; color?: string; style?: React.CSSProperties }> = ({ size, color = C.text, style }) => (
  <svg viewBox={MARK_VIEWBOX} width={size * 0.9256} height={size} style={style}>
    {MARK_PATHS.map((d, i) => (
      <path key={i} d={d} fill={color} fillRule="evenodd" />
    ))}
  </svg>
);

export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 700px at ${30 + Math.sin(t * 0.3) * 6}% ${28 + Math.cos(t * 0.25) * 4}%, ${C.violet}1c, transparent 70%),
            radial-gradient(1000px 800px at ${70 + Math.cos(t * 0.2) * 6}% ${78 + Math.sin(t * 0.3) * 4}%, ${C.gold}14, transparent 70%)`,
        }}
      />
    </AbsoluteFill>
  );
};

const DUST = (() => {
  const r = rng(99);
  return Array.from({ length: 80 }, () => ({
    x: r() * 1080,
    y: r() * 1920,
    z: r(), // depth: 0 far .. 1 near
    s: 0.6 + r() * 2.4,
    phase: r() * Math.PI * 2,
    gold: r() < 0.55,
  }));
})();

export const Dust: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {DUST.map((d, i) => {
        const speed = 0.25 + d.z * 0.9;
        const y = (((d.y - frame * speed) % 1920) + 1920) % 1920;
        const x = d.x + Math.sin(frame / 40 + d.phase) * 14 * (0.3 + d.z);
        const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(frame / 18 + d.phase * 3));
        const size = d.s * (0.6 + d.z * 1.6);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: "50%",
              background: d.gold ? C.goldBright : "#ffffff",
              opacity: tw * (0.18 + d.z * 0.4),
              filter: `blur(${d.z > 0.8 ? (d.z - 0.8) * 12 : 0.4}px)`,
              boxShadow: d.gold ? `0 0 ${size * 3}px ${C.gold}` : undefined,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  const r = rng(frame * 7919 + 13);
  const tile = frame % 8;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity: 0.16, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: -384,
          backgroundImage: `url(${staticFile(`grain/g${tile}.png`)})`,
          backgroundSize: "384px 384px",
          transform: `translate(${Math.floor(r() * 384)}px, ${Math.floor(r() * 384)}px)`,
        }}
      />
    </AbsoluteFill>
  );
};

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background: "radial-gradient(130% 90% at 50% 48%, transparent 55%, rgba(0,0,0,0.75) 100%)",
    }}
  />
);

/** Mark + wordmark top-left, rolling "01 / 08" counter top-right. Sits just below the 220px safe line. */
export const TopBar: React.FC<{ slots: SceneSlot[] }> = ({ slots }) => {
  const frame = useCurrentFrame();
  const T = config.transitionFrames;
  const intro = ease(frame, [0, 18], [0, 1]);
  const total = slots.length;
  // The active scene index flips mid-transition.
  let idx = 0;
  slots.forEach((s, i) => {
    if (frame >= s.start + (i ? T / 2 : 0)) idx = i;
  });
  const flipAt = slots[idx].start + (idx ? T / 2 : 0);
  const roll = idx ? spr(frame, flipAt, 18, 200) : 1;
  const Y = 238;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div style={{ position: "absolute", top: Y, left: config.safe.margin, right: config.safe.margin, height: 44, opacity: intro }}>
      <div style={{ position: "absolute", left: 0, top: 0, display: "flex", alignItems: "center", gap: 16, transform: `translateY(${(1 - intro) * -10}px)` }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 11,
            background: `linear-gradient(145deg, ${C.violet}, #5B4BD6)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 24px ${C.violet}55`,
          }}
        >
          <ArcaneMark size={26} color="#fff" />
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 21, letterSpacing: "0.2em", color: C.text }}>THE ARCANE ARCHIVES</div>
      </div>
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 8,
          fontFamily: MONO,
          fontSize: 22,
          letterSpacing: "0.12em",
          color: C.muted,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ display: "inline-block", position: "relative", width: "2.4ch", height: 28, overflow: "hidden", color: C.gold }}>
          {idx > 0 && (
            <span style={{ position: "absolute", left: 0, top: 0, transform: `translateY(${-roll * 28}px)`, lineHeight: "28px" }}>{pad(idx)}</span>
          )}
          <span style={{ position: "absolute", left: 0, top: 0, transform: `translateY(${(1 - roll) * 28}px)`, lineHeight: "28px" }}>{pad(idx + 1)}</span>
        </span>
        <span>/ {pad(total)}</span>
      </div>
    </div>
  );
};
