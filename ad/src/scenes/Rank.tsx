import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { config } from "../ad.config";
import { ease, fmt, spr } from "../anim";
import { ArcaneMark } from "../components/Chrome";
import { Headline } from "../components/Headline";
import { LineWork } from "../components/LineWork";
import { MONO, SANS, SERIF } from "../fonts";
import { useCues, useSpec } from "../SceneContext";

const C = config.colors;
const BX = 500;
const BY = 930;

const poly = (r: number, n: number, rot = -Math.PI / 2) =>
  Array.from({ length: n }, (_, i) => {
    const a = rot + (i / n) * Math.PI * 2;
    return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
  }).join(" ");

/** Badge that gains geometry with every tier: circle -> triangle -> ring of ticks -> hexagram -> full gold seal. */
const Badge: React.FC<{ tier: number; frame: number; since: number }> = ({ tier, frame, since }) => {
  const gold = tier >= 3;
  const stroke = tier === 4 ? C.goldBright : gold ? C.gold : tier >= 2 ? C.violetBright : "#8C86A8";
  const pop = spr(frame, since, 11, 220);
  const s = 1 + (1 - pop) * 0.14;
  // Geometry from earlier tiers stays; the newest layer draws in on its beat.
  const layer = (t: number) => (tier > t ? 1 : tier === t ? ease(frame, [since, since + 10]) : 0);
  const rays = tier === 4;
  return (
    <svg width={600} height={600} viewBox="-300 -300 600 600" style={{ position: "absolute", left: BX - 300, top: BY - 300, overflow: "visible", transform: `scale(${s})` }}>
      <defs>
        <radialGradient id="seal" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={tier === 4 ? "#3A2C12" : "#15131F"} />
          <stop offset="100%" stopColor="#0A0910" />
        </radialGradient>
        <filter id="bglow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={tier === 4 ? 10 : 5} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {rays &&
        Array.from({ length: 36 }, (_, i) => {
          const a = (i / 36) * Math.PI * 2 + frame * 0.004;
          const len = i % 3 === 0 ? 290 : 250;
          return (
            <line
              key={i}
              x1={Math.cos(a) * 210}
              y1={Math.sin(a) * 210}
              x2={Math.cos(a) * len}
              y2={Math.sin(a) * len}
              stroke={C.gold}
              strokeOpacity={0.5 * ease(frame, [since, since + 14])}
              strokeWidth={i % 3 === 0 ? 2 : 1}
            />
          );
        })}
      <g filter="url(#bglow)" fill="none" stroke={stroke}>
        <circle r={190} strokeWidth={3} fill="url(#seal)" />
        <circle r={172} strokeWidth={1} strokeOpacity={0.5} />
        {tier >= 1 && <polygon points={poly(160, 3)} strokeWidth={2} opacity={layer(1)} />}
        {tier >= 2 &&
          Array.from({ length: 24 }, (_, i) => {
            const a = (i / 24) * Math.PI * 2 + frame * 0.01;
            return <line key={i} x1={Math.cos(a) * 196} y1={Math.sin(a) * 196} x2={Math.cos(a) * (i % 2 ? 206 : 216)} y2={Math.sin(a) * (i % 2 ? 206 : 216)} strokeWidth={2} opacity={layer(2)} />;
          })}
        {tier >= 2 && <circle r={96} strokeWidth={1.5} opacity={layer(2)} />}
        {tier >= 3 && <polygon points={poly(160, 3, Math.PI / 2)} strokeWidth={2} opacity={layer(3)} />}
        {tier >= 4 && <circle r={228} strokeWidth={2} strokeDasharray="2 8" opacity={layer(4)} />}
      </g>
      {tier < 4 ? (
        <circle r={10 + tier * 3} fill={stroke} filter="url(#bglow)" />
      ) : (
        <g transform="translate(-58 -64)" filter="url(#bglow)">
          <ArcaneMark size={126} color={C.goldBright} />
        </g>
      )}
    </svg>
  );
};

export const Rank: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues<"rank">();
  const cfg = useSpec<"rank">();
  let tier = 0;
  cue.tiers.forEach((f, i) => {
    if (frame >= f) tier = i;
  });
  const since = frame >= cue.tiers[0] ? cue.tiers[tier] : 0;
  const flash = frame >= cue.tiers[0] ? ease(frame, [since, since + 12], [tier === 4 ? 0.9 : 0.55, 0]) : 0;
  const wave = ease(frame, [since, since + 22]);
  const badgeIn = spr(frame, 0, 16, 120);
  const nameIn = spr(frame, since, 16, 180);
  const credits = ease(frame, [cue.credits.from, cue.credits.to], [0, 1240], (t) => t * (2 - t));
  const progress = (tier + (tier < 4 ? ease(frame, [since, since + 24], [0, 0.6]) : 1)) / 4;

  return (
    <AbsoluteFill>
      <LineWork duration={cue.dur} sigil="circle" cx={BX} cy={BY} r={330} spin={-0.05} opacity={0.35} />
      <Headline lines={cfg.headline} wordFrames={cue.words} top={330} size={100} />

      {/* tier flash + shockwave */}
      <AbsoluteFill style={{ background: `radial-gradient(420px 420px at ${BX}px ${BY}px, ${tier === 4 ? C.goldBright : C.violetBright}, transparent 70%)`, opacity: flash }} />
      {frame >= cue.tiers[0] && (
        <div
          style={{
            position: "absolute",
            left: BX - 200 - wave * 220,
            top: BY - 200 - wave * 220,
            width: 400 + wave * 440,
            height: 400 + wave * 440,
            borderRadius: "50%",
            border: `2px solid ${tier >= 3 ? C.gold : C.violetBright}`,
            opacity: 1 - wave,
          }}
        />
      )}
      <div style={{ position: "absolute", inset: 0, transform: `scale(${badgeIn})`, transformOrigin: `${BX}px ${BY}px` }}>
        <Badge tier={tier} frame={frame} since={since} />
      </div>

      {/* Tier readout */}
      <div style={{ position: "absolute", top: 1200, left: 60, width: 880, textAlign: "center" }}>
        <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: "0.34em", color: C.muted }}>
          RANK <span style={{ color: tier === 4 ? C.gold : C.violetBright }}>{String(tier + 1).padStart(2, "0")}</span> / 05
        </div>
        <div style={{ height: 96, overflow: "hidden", marginTop: 6 }}>
          <div
            style={{
              fontFamily: SERIF,
              fontWeight: 600,
              fontStyle: tier === 4 ? "italic" : "normal",
              fontSize: 76,
              color: tier === 4 ? C.gold : C.text,
              transform: `translateY(${(1 - nameIn) * 90}px)`,
              textShadow: tier === 4 ? `0 0 40px ${C.gold}66` : undefined,
            }}
          >
            {cfg.tiers[tier]}
          </div>
        </div>
        <div style={{ margin: "14px auto 0", width: 560, height: 4, borderRadius: 2, background: "#1E1C2A" }}>
          <div style={{ width: `${progress * 100}%`, height: 4, borderRadius: 2, background: tier >= 3 ? C.gold : C.violet, boxShadow: `0 0 12px ${tier >= 3 ? C.gold : C.violet}` }} />
        </div>
      </div>

      {/* Arcane Credits */}
      <div
        style={{
          position: "absolute",
          top: 1440,
          left: BX - 220,
          width: 440,
          height: 70,
          borderRadius: 35,
          border: `1px solid ${C.gold}55`,
          background: `${C.gold}0d`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          boxSizing: "border-box",
          opacity: ease(frame, [cue.credits.from - 8, cue.credits.from + 4]),
          transform: `translateY(${(1 - ease(frame, [cue.credits.from - 8, cue.credits.from + 8])) * 20}px)`,
        }}
      >
        <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: 20, letterSpacing: "0.18em", color: C.gold }}>◆ ARCANE CREDITS</span>
        <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 30, color: C.text, fontVariantNumeric: "tabular-nums" }}>{fmt(credits)}</span>
      </div>
    </AbsoluteFill>
  );
};
