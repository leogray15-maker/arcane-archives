import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { config } from "../ad.config";
import { ease, easeInExpo, easeInOut, lerp, rng, spr } from "../anim";
import { Headline } from "../components/Headline";
import { LineWork } from "../components/LineWork";
import { MONO } from "../fonts";
import { sceneCues } from "../timeline";
import { chipRect } from "./Library";

const C = config.colors;
const CX = 500;
const CY = 1000;
const R = 300;

const DOMAINS = config.scenes.library.domains;
const domainPos = DOMAINS.map((_, i) => {
  const a = -Math.PI / 2 + (i / DOMAINS.length) * Math.PI * 2;
  return { x: CX + Math.cos(a) * R, y: CY + Math.sin(a) * R * 0.95 };
});

// Satellite module nodes around each domain + cross-domain links. Seeded.
const GRAPH = (() => {
  const r = rng(7);
  const sats = Array.from({ length: 30 }, (_, i) => {
    const d = i % DOMAINS.length;
    const a = r() * Math.PI * 2;
    const rad = 60 + r() * 150;
    const p = domainPos[d];
    // pull satellites inward so they sit between domains
    return { x: lerp(p.x + Math.cos(a) * rad, CX, 0.28), y: lerp(p.y + Math.sin(a) * rad, CY, 0.28), d };
  });
  const links: { a: { x: number; y: number }; b: { x: number; y: number }; wave: number; major: boolean }[] = [];
  // domain <-> domain (the "everything links to everything" web)
  const pairs = [[0, 2], [1, 3], [2, 5], [0, 4], [3, 7], [4, 6], [5, 8], [6, 1], [7, 0], [8, 3], [1, 5], [2, 7], [4, 8], [6, 2]];
  pairs.forEach(([a, b], i) => links.push({ a: domainPos[a], b: domainPos[b], wave: i % 8, major: true }));
  sats.forEach((s, i) => {
    links.push({ a: domainPos[s.d], b: s, wave: (i * 3) % 8, major: false });
    const other = sats[(i * 7 + 3) % sats.length];
    if (other.d !== s.d) links.push({ a: s, b: other, wave: (i * 5 + 2) % 8, major: false });
  });
  return { sats, links };
})();

export const Connection: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = sceneCues("connection");
  const cfg = config.scenes.connection;
  const collapse = spr(frame, cue.collapse.from, 17, 120);
  // Exit: the whole web flattens onto the horizontal price line of the next scene.
  const flat = ease(frame, [cue.dur - 22, cue.dur - 4], [0, 1], easeInExpo);
  const rot = frame * 0.05;
  const map = (p: { x: number; y: number }) => {
    const a = (rot * Math.PI) / 180;
    const dx = p.x - CX;
    const dy = p.y - CY;
    const x = CX + dx * Math.cos(a) - dy * Math.sin(a);
    const y = CY + dx * Math.sin(a) + dy * Math.cos(a);
    return { x, y: lerp(y, 1000, flat) };
  };

  return (
    <AbsoluteFill>
      <LineWork duration={cue.dur} sigil="hexagram" cx={CX} cy={CY} r={430} spin={0.04} opacity={0.35} delay={4} />
      <Headline lines={cfg.headline} wordFrames={cue.words} top={330} size={100} />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {GRAPH.links.map((l, i) => {
          const start = cue.linkWaves[l.wave] + (i % 3);
          const p = ease(frame, [start, start + 12], [0, 1]);
          if (p <= 0) return null;
          const a = map(l.a);
          const b = map(l.b);
          const zap = ease(frame, [start, start + 10], [1, 0]);
          // A pulse keeps running along each link once formed.
          const t = ((frame - start) / (l.major ? 34 : 46) + i * 0.13) % 1;
          return (
            <g key={i}>
              <line
                x1={a.x}
                y1={a.y}
                x2={lerp(a.x, b.x, p)}
                y2={lerp(a.y, b.y, p)}
                stroke={l.major ? C.gold : C.violet}
                strokeOpacity={(l.major ? 0.7 : 0.35) + zap * 0.3}
                strokeWidth={l.major ? 1.6 + zap * 2 : 1}
                filter={zap > 0.2 ? "url(#glow)" : undefined}
              />
              {p >= 1 && (
                <circle cx={lerp(a.x, b.x, t)} cy={lerp(a.y, b.y, t)} r={l.major ? 3.2 : 2} fill={l.major ? C.goldBright : C.violetBright} opacity={0.9} filter="url(#glow)" />
              )}
            </g>
          );
        })}
        {GRAPH.sats.map((s, i) => {
          const appear = spr(frame, 14 + (i % 10) * 2.5, 16);
          const p = map(s);
          return <circle key={i} cx={p.x} cy={p.y} r={4.5 * appear} fill={C.card} stroke={C.violet} strokeWidth={1.5} opacity={0.9} />;
        })}
      </svg>
      {/* Domain nodes: born from the library's domain chips (match-cut) */}
      {DOMAINS.map((d, i) => {
        const chip = chipRect(i);
        const target = map(domainPos[i]);
        const named = cue.named.indexOf(i);
        const flare = named >= 0 ? ease(frame, [cue.named[named], cue.named[named] + 30], [1, 0]) * (frame >= cue.named[named] ? 1 : 0) : 0;
        const w = lerp(chip.w, 26, collapse);
        const h = lerp(chip.h, 26, collapse);
        const x = lerp(chip.x + chip.w / 2, target.x, collapse);
        const y = lerp(chip.y + chip.h / 2, target.y, collapse);
        const labelIn = ease(frame, [10, 24]);
        const below = domainPos[i].y > CY + 40;
        return (
          <React.Fragment key={d}>
            {flare > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: x - 90 * (1 - flare) - 20,
                  top: y - 90 * (1 - flare) - 20,
                  width: 40 + 180 * (1 - flare),
                  height: 40 + 180 * (1 - flare),
                  borderRadius: "50%",
                  border: `2px solid ${C.goldBright}`,
                  opacity: flare,
                }}
              />
            )}
            <div
              style={{
                position: "absolute",
                left: x - w / 2,
                top: y - h / 2,
                width: w,
                height: h,
                borderRadius: lerp(29, 13, collapse),
                border: `2px solid ${C.gold}`,
                background: collapse > 0.6 ? C.gold : `${C.gold}22`,
                boxShadow: `0 0 ${20 + flare * 60}px ${C.gold}${flare > 0.1 ? "cc" : "66"}`,
                transform: `scale(${1 + flare * 0.5})`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: x - 120,
                width: 240,
                top: below ? y + 22 : y - 48,
                textAlign: "center",
                fontFamily: MONO,
                fontSize: 19 + flare * 4,
                letterSpacing: "0.2em",
                color: flare > 0.05 ? C.goldBright : C.gold,
                opacity: labelIn * (1 - flat),
                textShadow: flare ? `0 0 ${20 * flare}px ${C.gold}` : undefined,
              }}
            >
              {d.toUpperCase()}
            </div>
          </React.Fragment>
        );
      })}
      {/* The narrator's line on screen */}
      <div
        style={{
          position: "absolute",
          top: 1440,
          left: 60,
          width: 880,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 22,
          letterSpacing: "0.3em",
          color: C.muted,
          opacity: ease(frame, [cfg.vo[3].at, cfg.vo[3].at + 12]) * (1 - flat),
          transform: `translateY(${(1 - ease(frame, [cfg.vo[3].at, cfg.vo[3].at + 16], [0, 1], easeInOut)) * 16}px)`,
        }}
      >
        THE THINGS THEY DON'T TEACH
      </div>
    </AbsoluteFill>
  );
};
