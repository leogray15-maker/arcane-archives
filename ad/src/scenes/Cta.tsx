import React from "react";
import { AbsoluteFill, Freeze, useCurrentFrame } from "remotion";
import { config } from "../ad.config";
import { ease, easeInExpo, spr } from "../anim";
import { ArcaneMark } from "../components/Chrome";
import { Headline } from "../components/Headline";
import { MONO, SANS } from "../fonts";
import { useCues, useSpec } from "../SceneContext";

const C = config.colors;
const AX = 500;
const AY = 800;

/** Tokens from every earlier scene get pulled back into the mark before the hit. */
const Token: React.FC<{ kind: number }> = ({ kind }) => {
  const s = { stroke: C.gold, fill: "none", strokeWidth: 2.5 } as const;
  switch (kind) {
    case 0: // module card
      return <rect x={-50} y={-30} width={100} height={60} rx={8} {...s} />;
    case 1: // graph node
      return (
        <g {...s}>
          <circle r={10} fill={C.gold} />
          <line x1={10} y1={0} x2={50} y2={-24} />
          <circle cx={56} cy={-28} r={6} />
        </g>
      );
    case 2: // candle
      return (
        <g {...s}>
          <rect x={-12} y={-26} width={24} height={46} />
          <line x1={0} y1={-26} x2={0} y2={-46} />
          <line x1={0} y1={20} x2={0} y2={40} />
        </g>
      );
    case 3: // globe
      return (
        <g {...s}>
          <circle r={36} />
          <ellipse rx={16} ry={36} />
          <line x1={-36} y1={0} x2={36} y2={0} />
        </g>
      );
    case 4: // badge
      return <polygon points="0,-40 35,-20 35,20 0,40 -35,20 -35,-20" {...s} />;
    default: // knife stroke
      return <path d="M-50 0 L30 -10 L50 -10 L50 8 L-10 10 Z" {...s} />;
  }
};

const CtaInner: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues<"cta">();
  const cfg = useSpec<"cta">();
  const pull = ease(frame, [0, cue.hit], [0, 1], easeInExpo);
  const hitP = spr(frame, cue.hit, 12, 160);
  const post = frame >= cue.hit;
  const flash = post ? ease(frame, [cue.hit, cue.hit + 10], [1, 0]) : 0;
  const orbitIn = ease(frame, [cue.hit, cue.hit + 30]);
  const pill = spr(frame, cue.pill, 16, 150);
  const url = ease(frame, [cue.url, cue.url + 14]);

  return (
    <AbsoluteFill>
      {/* Pull-back tokens with ghost trails (motion blur) */}
      {!post &&
        Array.from({ length: 6 }, (_, k) => {
          const a = (k / 6) * Math.PI * 2 - Math.PI / 2 + 0.3;
          const R0 = 400; // stays clear of the action rail
          return [0, 1, 2, 3].map((g) => {
            const p = Math.max(0, pull - g * 0.04);
            const R = R0 * (1 - p);
            return (
              <svg
                key={`${k}-${g}`}
                width={1080}
                height={1920}
                style={{ position: "absolute", inset: 0, opacity: (1 - g * 0.3) * ease(frame, [0, 6]) * (1 - ease(frame, [cue.hit - 3, cue.hit])) }}
              >
                <g transform={`translate(${AX + Math.cos(a + p * 1.4) * R} ${AY + Math.sin(a + p * 1.4) * R}) scale(${1.4 - p}) rotate(${p * 180})`}>
                  <Token kind={k} />
                </g>
              </svg>
            );
          });
        })}

      {/* Orbiting gold line-work */}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: orbitIn }}>
        {[
          { r: 250, dash: "1 14", speed: 0.4, w: 2 },
          { r: 300, dash: "60 20 4 20", speed: -0.25, w: 1.5 },
          { r: 360, dash: "2 10", speed: 0.15, w: 1 },
        ].map((o, i) => (
          <circle
            key={i}
            cx={AX}
            cy={AY}
            r={o.r * (0.7 + 0.3 * orbitIn)}
            fill="none"
            stroke={C.gold}
            strokeWidth={o.w}
            strokeDasharray={o.dash}
            strokeOpacity={0.7 - i * 0.15}
            style={{ transformOrigin: `${AX}px ${AY}px`, transform: `rotate(${frame * o.speed}deg)` }}
          />
        ))}
        {[0, 1, 2].map((i) => {
          const a = frame * (0.03 - i * 0.012) + (i * Math.PI * 2) / 3;
          const r = [250, 300, 360][i] * (0.7 + 0.3 * orbitIn);
          return <circle key={i} cx={AX + Math.cos(a) * r} cy={AY + Math.sin(a) * r} r={6 - i} fill={C.goldBright} style={{ filter: `drop-shadow(0 0 8px ${C.gold})` }} />;
        })}
        <polygon
          points={[0, 1, 2].map((i) => `${AX + Math.cos(-Math.PI / 2 + (i * Math.PI * 2) / 3) * 300},${AY + Math.sin(-Math.PI / 2 + (i * Math.PI * 2) / 3) * 300}`).join(" ")}
          fill="none"
          stroke={C.gold}
          strokeOpacity={0.25}
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - ease(frame, [cue.hit + 4, cue.hit + 34])}
        />
        {/* shockwave */}
        {post && <circle cx={AX} cy={AY} r={120 + ease(frame, [cue.hit, cue.hit + 26], [0, 700])} fill="none" stroke={C.goldBright} strokeWidth={3} opacity={ease(frame, [cue.hit, cue.hit + 26], [1, 0])} />}
      </svg>

      {/* The mark */}
      <div
        style={{
          position: "absolute",
          left: AX - 110,
          top: AY - 120,
          width: 220,
          height: 240,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${post ? 1 + (1 - hitP) * 0.35 : ease(frame, [cue.hit - 8, cue.hit], [0, 0.4])})`,
          opacity: post ? 1 : ease(frame, [cue.hit - 8, cue.hit]),
          filter: `drop-shadow(0 0 ${30 + flash * 60}px ${C.gold}aa)`,
        }}
      >
        <svg width={0} height={0} style={{ position: "absolute" }}>
          <defs>
            <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.goldBright} />
              <stop offset="100%" stopColor={C.goldDeep} />
            </linearGradient>
          </defs>
        </svg>
        <ArcaneMark size={220} color="url(#goldGrad)" />
      </div>

      <AbsoluteFill style={{ background: `radial-gradient(700px 700px at ${AX}px ${AY}px, #fff6e0, ${C.gold}88 40%, transparent 75%)`, opacity: flash }} />

      <Headline lines={cfg.headline} wordFrames={cue.words} top={1070} size={96} right={config.safe.rightRail} />

      <div
        style={{
          position: "absolute",
          top: 1330,
          left: AX - 330,
          width: 660,
          height: 84,
          borderRadius: 42,
          border: `1.5px solid ${C.gold}`,
          background: `linear-gradient(90deg, ${C.gold}1f, ${C.gold}08)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          fontFamily: SANS,
          fontSize: 30,
          color: C.text,
          transform: `translateY(${(1 - pill) * 30}px) scale(${0.9 + 0.1 * pill})`,
          opacity: Math.min(1, pill * 1.4),
          boxShadow: `0 0 40px ${C.gold}33`,
        }}
      >
        Comment
        <span style={{ fontFamily: MONO, fontWeight: 500, color: C.goldBright, letterSpacing: "0.12em" }}>{config.brand.ctaKeyword}</span>
        for access
      </div>
      <div
        style={{
          position: "absolute",
          top: 1446,
          left: AX - 440,
          width: 880,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 26,
          letterSpacing: "0.16em",
          color: C.muted,
          opacity: url,
          transform: `translateY(${(1 - url) * 12}px)`,
        }}
      >
        {config.brand.url}
      </div>
    </AbsoluteFill>
  );
};

/** Final hold: freeze the last composed frame for `finalHoldFrames` (dust + grain keep breathing on top). */
export const Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues<"cta">();
  return frame >= cue.hold ? (
    <Freeze frame={cue.hold}>
      <CtaInner />
    </Freeze>
  ) : (
    <CtaInner />
  );
};
