import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ease, fmt, spr } from "../../anim";
import { ArcaneMark } from "../../components/Chrome";
import { config } from "../../ad.config";
import { BEAT, MONO, SANS, T } from "../theme";
import { popFrames } from "../timeline";
import { clamp, Label, LivePill, Panel, usePunch, useSeg, Words } from "../ui";

/** Big two-line hook, words land on a dotted-8th grid, the whole block breathes with the build. */
export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { seg, duration } = useSeg();
  const lines = seg.lines ?? [""];
  const frames = popFrames(lines, 0, 11);
  const push = 1 + frame * 0.0003 + ease(frame, [duration - 14, duration], [0, 0.015]);
  const size = 150;
  const top = 900 - (lines.length * size * 1.0) / 2;
  return (
    <AbsoluteFill style={{ transform: `scale(${push})` }}>
      <Words lines={lines} frames={frames} size={size} top={top} lineGap={1.0} width={840} left={80} />
    </AbsoluteFill>
  );
};

/** One-bar statement, optionally with a live refresh timer chip. */
export const Statement: React.FC = () => {
  const frame = useCurrentFrame();
  const { seg } = useSeg();
  const punch = usePunch();
  const lines = seg.lines ?? ["", ""];
  const frames = popFrames(lines, 0, 7.5);
  const secs = 300 - Math.floor(frame / 3);
  const ring = (frame % 60) / 60;
  return (
    <AbsoluteFill style={{ transform: `scale(${1 + punch * 0.012})` }}>
      <Words lines={lines} frames={frames} size={124} top={600} />
      <Panel style={{ left: 500 - 230, top: 1000, width: 460, height: 120, scale: "1.45", display: "flex", alignItems: "center", gap: 22, padding: "0 28px", opacity: clamp(frame, 18, 24), transform: `translateY(${(1 - clamp(frame, 18, 26)) * 20}px)` }}>
        <svg width={64} height={64}>
          <circle cx={32} cy={32} r={26} fill="none" stroke={T.line} strokeWidth={6} />
          <circle cx={32} cy={32} r={26} fill="none" stroke={T.lav} strokeWidth={6} strokeLinecap="round" strokeDasharray={`${163 * (1 - ring)} 163`} transform="rotate(-90 32 32)" />
        </svg>
        <div style={{ flex: 1 }}>
          <Label size={15}>NEXT REFRESH</Label>
          <div style={{ fontFamily: MONO, fontSize: 36, color: T.text }}>{`0${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`}</div>
        </div>
        <LivePill />
      </Panel>
    </AbsoluteFill>
  );
};

const REALM_CARDS = [
  { n: "01", name: "Mind & Psychology", c: 18 },
  { n: "02", name: "Wealth & Business", c: 17 },
  { n: "03", name: "Health & Investing", c: 5 },
  { n: "04", name: "Systems", c: 6 },
];

/** "So I built..." The mark lands, the four realms fan out behind it. */
export const Payoff: React.FC = () => {
  const frame = useCurrentFrame();
  const { seg } = useSeg();
  const lines = seg.lines ?? ["", ""];
  const frames = popFrames(lines, 0, 7.5);
  const mark = spr(frame, 30, 14, 160);
  return (
    <AbsoluteFill>
      <Words lines={lines} frames={frames} size={100} top={330} />
      {REALM_CARDS.map((r, i) => {
        const p = spr(frame, 45 + i * 7.5, 15, 150);
        const col = i % 2;
        const row = Math.floor(i / 2);
        return (
          <Panel
            key={r.n}
            style={{
              left: 60 + col * 450,
              top: 1080 + row * 200,
              width: 430,
              height: 180,
              padding: "24px 26px",
              opacity: Math.min(1, p * 1.5),
              transform: `translateY(${(1 - p) * 60}px) scale(${0.9 + 0.1 * p})`,
            }}
          >
            <Label color={T.lav} size={15}>{`REALM ${r.n}`}</Label>
            <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 34, letterSpacing: "-0.03em", color: T.text, marginTop: 14 }}>{r.name}</div>
            <div style={{ fontFamily: MONO, fontSize: 16, color: T.muted, marginTop: 10, letterSpacing: "0.2em" }}>{`${r.c} PROTOCOLS`}</div>
          </Panel>
        );
      })}
      <div style={{ position: "absolute", left: 500 - 90, top: 640, width: 180, height: 180, borderRadius: 44, background: `linear-gradient(145deg, ${T.violet}, #5B3FD6)`, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${mark})`, boxShadow: `0 0 80px ${T.violet}88` }}>
        <ArcaneMark size={104} color="#fff" />
      </div>
      <div style={{ position: "absolute", top: 860, left: 60, width: 880, textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: 44, letterSpacing: "0.02em", color: T.text, opacity: clamp(frame, 40, 48) }}>
        THE ARCANE ARCHIVES
      </div>
    </AbsoluteFill>
  );
};

/** The ask. Lands on the CTA downbeat (the big hit) and holds. */
export const Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const { seg } = useSeg();
  const top = seg.p?.top as string | undefined;
  const sub = seg.p?.sub as string | undefined;
  const mark = spr(frame, 0, 12, 200);
  const comment = spr(frame, top ? BEAT : 0, 13, 260);
  const key = spr(frame, top ? BEAT * 2 : BEAT, 11, 280);
  const rest = clamp(frame, BEAT * 3, BEAT * 3 + 8);
  const glow = 0.5 + 0.5 * Math.sin(frame / 10);
  const kw = config.brand.ctaKeyword;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 500 - 60, top: top ? 380 : 470, width: 120, height: 120, borderRadius: 30, background: `linear-gradient(145deg, ${T.violet}, #5B3FD6)`, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${mark})`, boxShadow: `0 0 ${50 + glow * 30}px ${T.violet}88` }}>
        <ArcaneMark size={70} color="#fff" />
      </div>
      {top ? (
        <Words lines={[top, sub]} frames={[[0], sub ? sub.split(" ").map(() => 4) : []]} size={96} top={540} />
      ) : (
        <div style={{ position: "absolute", top: 640, left: 60, width: 880, textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: 52, letterSpacing: "0.02em", color: T.text, opacity: mark }}>THE ARCANE ARCHIVES</div>
      )}
      <div style={{ position: "absolute", top: top ? 790 : 820, left: 60, width: 880, textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: 120, letterSpacing: "-0.05em", color: T.text, opacity: Math.min(1, comment * 2), transform: `scale(${1 + (1 - comment) * 0.15})` }}>
        Comment
      </div>
      <div style={{ position: "absolute", top: top ? 945 : 970, left: 500 - 330, width: 660, height: 150, borderRadius: 30, background: T.lav, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 900, fontSize: 104, letterSpacing: "-0.03em", color: T.bg, transform: `scale(${key}) rotate(${(1 - key) * -4}deg)`, boxShadow: `0 0 ${60 + glow * 40}px ${T.violet}99` }}>
        {kw}
      </div>
      <div style={{ position: "absolute", top: top ? 1120 : 1150, left: 60, width: 880, textAlign: "center", fontFamily: SANS, fontWeight: 600, fontSize: 44, color: T.text, opacity: rest }}>for access</div>
      <div style={{ position: "absolute", top: top ? 1195 : 1230, left: 60, width: 880, textAlign: "center", fontFamily: MONO, fontSize: 30, letterSpacing: "0.1em", color: T.muted, opacity: rest }}>{config.brand.url}</div>
    </AbsoluteFill>
  );
};

/** A big number rolling up across one bar. */
export const Counter: React.FC = () => {
  const frame = useCurrentFrame();
  const { seg, duration } = useSeg();
  const to = (seg.p?.to as number) ?? 3330;
  const v = ease(frame, [0, duration - 10], [0, to]);
  const done = frame >= duration - 10;
  const punch = usePunch();
  return (
    <AbsoluteFill style={{ transform: `scale(${1 + punch * 0.015})` }}>
      <div style={{ position: "absolute", top: 700, left: 60, width: 880, textAlign: "center", fontFamily: SANS, fontWeight: 900, fontSize: 230, letterSpacing: "-0.06em", color: T.text, fontVariantNumeric: "tabular-nums" }}>
        {fmt(v)}
        <span style={{ color: T.lav, opacity: done ? 1 : 0.3 }}>+</span>
      </div>
      <Label size={22} color={T.lav} style={{ position: "absolute", top: 1000, left: 60, width: 880, textAlign: "center" }}>
        {(seg.p?.label as string) ?? "MODULES"}
      </Label>
    </AbsoluteFill>
  );
};

const TIERS = ["Seeker", "Initiate", "Adept", "Keeper", "Arcane Master"];

/** Rank chip flips a tier on every beat, lands on Arcane Master. */
export const RankFlip: React.FC = () => {
  const frame = useCurrentFrame();
  const { seg } = useSeg();
  const lines = seg.lines ?? ["", ""];
  const tier = Math.min(4, Math.floor(frame / (BEAT / 2)));
  const since = tier * (BEAT / 2);
  const p = spr(frame, since, 12, 260);
  const master = tier === 4;
  return (
    <AbsoluteFill>
      <Words lines={lines} frames={popFrames(lines, 0, 5)} size={104} top={420} />
      <div
        style={{
          position: "absolute",
          top: 880,
          left: 500 - 330,
          width: 660,
          height: 170,
          borderRadius: 85,
          border: `2px solid ${master ? T.gold : T.lav}`,
          background: master ? `${T.gold}1f` : `${T.violet}1a`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 22,
          boxShadow: `0 0 ${master ? 70 : 30}px ${master ? T.gold : T.violet}55`,
          transform: `scale(${1 + (1 - p) * 0.08})`,
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 24, color: master ? T.gold : T.lav, letterSpacing: "0.2em" }}>{`RANK ${tier + 1}/5`}</span>
        <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 64, letterSpacing: "-0.03em", color: master ? T.gold : T.text }}>{TIERS[tier]}</span>
      </div>
      <div style={{ position: "absolute", top: 1100, left: 500 - 300, width: 600, height: 8, borderRadius: 4, background: T.line }}>
        <div style={{ width: `${((tier + p) / 5) * 100}%`, height: 8, borderRadius: 4, background: master ? T.gold : T.lav }} />
      </div>
    </AbsoluteFill>
  );
};
