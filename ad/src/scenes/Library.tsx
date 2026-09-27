import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { config } from "../ad.config";
import { ease, fmt, rng, spr } from "../anim";
import { Headline } from "../components/Headline";
import { LineWork } from "../components/LineWork";
import { MONO, SANS } from "../fonts";
import { MODULES } from "../modules";
import { sceneCues } from "../timeline";
import { HOOK_CIRCLE } from "./Hook";

const C = config.colors;

/** Domain chip grid (3x3), kept clear of the right action rail. Shared with Connection for the match-cut. */
export const CHIP = { left: 60, top: 1318, w: 272, h: 58, gapX: 20, gapY: 16 };
export const chipRect = (i: number) => {
  const col = i % 3;
  const row = Math.floor(i / 3);
  return { x: CHIP.left + col * (CHIP.w + CHIP.gapX), y: CHIP.top + row * (CHIP.h + CHIP.gapY), w: CHIP.w, h: CHIP.h };
};

const FOCUS = { x: 540, y: 880 };
const DEPTH = 5200;
const CARDS = (() => {
  const r = rng(42);
  const out: { x: number; y: number; z: number; m: (typeof MODULES)[number]; n: number }[] = [];
  const planes = 18;
  for (let p = 0; p < planes; p++) {
    const z = -(p / planes) * DEPTH;
    for (let k = 0; k < 9; k++) {
      // Keep a clear aisle down the middle so the camera flies between the stacks.
      const ang = r() * Math.PI * 2;
      const rad = 330 + r() * 520;
      out.push({ x: Math.cos(ang) * rad * 1.15, y: Math.sin(ang) * rad * 0.8, z, m: MODULES[Math.floor(r() * MODULES.length)], n: 1 + Math.floor(r() * 3330) });
    }
  }
  return out;
})();

const ModuleCard: React.FC<{ title: string; domain: string; n: number; glow?: number }> = ({ title, domain, n, glow = 0 }) => (
  <div
    style={{
      width: 300,
      height: 168,
      padding: "20px 22px",
      boxSizing: "border-box",
      borderRadius: 16,
      background: `linear-gradient(160deg, #13121B, ${C.card})`,
      border: `1px solid ${glow ? C.gold : C.cardLine}`,
      boxShadow: glow ? `0 0 40px ${C.gold}55` : "0 20px 40px rgba(0,0,0,0.5)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 15, color: C.muted, letterSpacing: "0.08em" }}>
      <span>{String(n).padStart(4, "0")}</span>
      <span style={{ color: C.gold }}>{domain.toUpperCase()}</span>
    </div>
    <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 24, lineHeight: 1.15, color: C.text, letterSpacing: "-0.01em" }}>{title}</div>
    <div style={{ height: 3, borderRadius: 2, background: C.cardLine }}>
      <div style={{ width: `${(n * 37) % 100}%`, height: 3, borderRadius: 2, background: C.violet }} />
    </div>
  </div>
);

export const Library: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = sceneCues("library");
  const cfg = config.scenes.library;
  // Camera: fast launch, easing into a slow drift (easeOutExpo), never fully stops.
  const camZ = ease(frame, [0, 120], [0, DEPTH * 0.62]) + frame * 4;
  const speed = ease(frame, [0, 120], [0, DEPTH * 0.62]) - ease(frame - 1, [0, 120], [0, DEPTH * 0.62]);
  const count = ease(frame, [cue.counter.from, cue.counter.to], [0, cfg.moduleCount]);
  const done = frame >= cue.counter.to;
  // Match-cut from the hook: the hook circle becomes the mouth of the tunnel and blows past camera.
  const ringR = ease(frame, [0, 26], [HOOK_CIRCLE.r, 1400]);
  const ringO = ease(frame, [0, 26], [1, 0]);

  return (
    <AbsoluteFill>
      <LineWork duration={cue.dur} sigil="none" />
      {/* 3D fly-through */}
      <AbsoluteFill
        style={{
          perspective: 900,
          perspectiveOrigin: `${FOCUS.x}px ${FOCUS.y}px`,
          maskImage: "linear-gradient(to bottom, transparent 560px, black 700px, black 1120px, transparent 1260px)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 560px, black 700px, black 1120px, transparent 1260px)",
        }}
      >
        <div style={{ position: "absolute", left: FOCUS.x, top: FOCUS.y, transformStyle: "preserve-3d" }}>
          {CARDS.map((c, i) => {
            let z = c.z + camZ;
            z = ((z % DEPTH) + DEPTH) % DEPTH - DEPTH + 700; // wrap: infinite corridor
            if (z > 820 || z < -3400) return null;
            const fog = ease(z, [-3400, -1900], [0, 1]) * ease(z, [500, 820], [1, 0]);
            const dof = Math.abs(z + 700) / 260 + Math.max(0, speed - 20) * 0.08 * ease(z, [-1200, 400], [0, 1]);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  transform: `translate3d(${c.x - 150}px, ${c.y - 84}px, ${z}px)`,
                  opacity: fog,
                  filter: `blur(${Math.min(dof, 9).toFixed(2)}px)`,
                }}
              >
                <ModuleCard title={c.m.title} domain={c.m.domain} n={c.n} />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <circle cx={HOOK_CIRCLE.cx} cy={HOOK_CIRCLE.cy} r={ringR} fill="none" stroke={C.gold} strokeWidth={3} opacity={ringO} />
      </svg>

      <Headline lines={cfg.headline} wordFrames={cue.words} top={330} size={100} />

      {/* Counter */}
      <div style={{ position: "absolute", top: 1170, left: 60, width: 856, textAlign: "center" }}>
        <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: "0.4em", color: C.muted, opacity: ease(frame, [cue.counter.from - 6, cue.counter.from + 4]) }}>
          MODULES INDEXED
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontWeight: 500,
            fontSize: 84,
            color: C.text,
            letterSpacing: "-0.02em",
            fontVariantNumeric: "tabular-nums",
            transform: `scale(${done ? 1 + 0.06 * (1 - spr(frame, cue.counter.to, 12)) : 1})`,
            opacity: ease(frame, [cue.counter.from - 6, cue.counter.from + 4]),
          }}
        >
          {fmt(count)}
          <span style={{ color: C.gold, opacity: done ? 1 : 0.25 }}>+</span>
        </div>
      </div>

      {/* Nine domains igniting */}
      {cfg.domains.map((d, i) => {
        const r = chipRect(i);
        const at = cue.domains[i];
        const appear = spr(frame, 20 + i * 2.4, 16);
        const lit = frame >= at;
        const burst = ease(frame, [at, at + 18], [1, 0]);
        return (
          <div
            key={d}
            style={{
              position: "absolute",
              left: r.x,
              top: r.y,
              width: r.w,
              height: r.h,
              boxSizing: "border-box",
              borderRadius: 29,
              border: `1.5px solid ${lit ? C.gold : "#2A2735"}`,
              background: lit ? `linear-gradient(90deg, ${C.gold}26, ${C.gold}0a)` : "#0C0B12",
              boxShadow: lit ? `0 0 ${18 + burst * 40}px ${C.gold}${burst > 0.1 ? "88" : "33"}` : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              fontFamily: MONO,
              fontSize: 21,
              letterSpacing: "0.22em",
              color: lit ? C.goldBright : "#5E5A6B",
              opacity: appear,
              transform: `translateY(${(1 - appear) * 24}px) scale(${1 + burst * 0.06})`,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 4, background: lit ? C.goldBright : "#3A3646", boxShadow: lit ? `0 0 10px ${C.gold}` : "none" }} />
            {d.toUpperCase()}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
