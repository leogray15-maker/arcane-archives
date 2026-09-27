import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { config } from "../ad.config";
import { ease, easeInOut, rng, spr } from "../anim";
import { Globe } from "../components/Globe";
import { Headline } from "../components/Headline";
import { LineWork } from "../components/LineWork";
import { MONO, SANS, SERIF } from "../fonts";
import { sceneCues } from "../timeline";

const C = config.colors;
const INITIALS = ["JM", "AK", "RT", "SL", "DN", "OB", "KP", "HW", "EV", "MC", "TF", "YR"];
const TINTS = ["#2A2440", "#1F2A33", "#33261F", "#262233"];

const WarRoom: React.FC<{ frame: number; avatars: number[] }> = ({ frame, avatars }) => {
  const r = rng(5);
  const secs = 2537 + Math.floor(frame / 30);
  const t = `${String(Math.floor(secs / 3600)).padStart(2, "0")}:${String(Math.floor(secs / 60) % 60).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
  const speaking = 1 + (Math.floor(frame / 18) % 3) * 4;
  return (
    <div
      style={{
        width: 820,
        padding: 36,
        boxSizing: "border-box",
        borderRadius: 28,
        background: "linear-gradient(170deg, #121119, #0A0A0F)",
        border: `1px solid ${C.cardLine}`,
        boxShadow: `0 40px 90px rgba(0,0,0,0.6), inset 0 1px 0 #ffffff0a`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: "0.34em", color: C.gold }}>THE WAR ROOM</div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontFamily: MONO,
            fontSize: 18,
            letterSpacing: "0.24em",
            color: C.violetBright,
            border: `1px solid ${C.violet}77`,
            padding: "7px 16px",
            borderRadius: 30,
            background: `${C.violet}14`,
          }}
        >
          <span style={{ position: "relative", width: 12, height: 12 }}>
            <span style={{ position: "absolute", inset: 0, borderRadius: 6, background: C.violetBright, boxShadow: `0 0 12px ${C.violet}` }} />
            <span
              style={{
                position: "absolute",
                inset: -((frame % 24) / 24) * 12,
                borderRadius: "50%",
                border: `2px solid ${C.violetBright}`,
                opacity: 1 - (frame % 24) / 24,
              }}
            />
          </span>
          LIVE
        </div>
      </div>
      <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 46, color: C.text, marginTop: 22, letterSpacing: "-0.01em" }}>Weekly member call</div>
      <div style={{ fontFamily: SANS, fontSize: 22, color: C.muted, marginTop: 6 }}>Bring what you're stuck on. Answered live.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 18, marginTop: 34 }}>
        {INITIALS.map((ini, i) => {
          const p = spr(frame, avatars[i], 14, 180);
          const isSpeaking = i === speaking;
          const tint = TINTS[Math.floor(r() * TINTS.length)];
          return (
            <div key={ini} style={{ display: "flex", justifyContent: "center", transform: `scale(${p})`, opacity: Math.min(1, p * 1.5) }}>
              <div
                style={{
                  width: 92,
                  height: 92,
                  borderRadius: "50%",
                  background: `radial-gradient(circle at 30% 25%, ${tint}, #0C0B12)`,
                  border: `2px solid ${isSpeaking ? C.gold : "#2B2838"}`,
                  boxShadow: isSpeaking ? `0 0 0 ${4 + Math.sin(frame / 2.5) * 3}px ${C.gold}33, 0 0 24px ${C.gold}55` : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: MONO,
                  fontSize: 26,
                  color: isSpeaking ? C.goldBright : "#B7B2C6",
                  letterSpacing: "0.04em",
                }}
              >
                {ini}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 32 }}>
        <div style={{ display: "flex", gap: 5, alignItems: "center", height: 40 }}>
          {Array.from({ length: 28 }, (_, i) => {
            const h = 6 + Math.abs(Math.sin(frame / 2.3 + i * 0.9) * Math.sin(frame / 5.1 + i * 0.4)) * 32;
            return <div key={i} style={{ width: 5, height: h, borderRadius: 3, background: i < 18 ? C.gold : "#2B2838" }} />;
          })}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 24, color: C.muted, fontVariantNumeric: "tabular-nums" }}>{t}</div>
      </div>
    </div>
  );
};

export const Live: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = sceneCues("live");
  const cfg = config.scenes.live;
  const g = cue.globeAt;
  const toGlobe = ease(frame, [g, g + 20], [0, 1], easeInOut);
  const cardIn = spr(frame, 0, 17, 120);
  const globeIn = ease(frame, [g, g + 34]);
  const globeScale = 0.5 + 0.34 * globeIn + ease(frame, [g + 34, cue.dur], [0, 0.04], (t) => t);
  const events = Math.round(ease(frame, [cue.pins[0], cue.pins[5] + 10], [96, 128]));

  return (
    <AbsoluteFill>
      <LineWork duration={cue.dur} sigil="orbit" cx={500} cy={1010} r={400} spin={0.08} opacity={0.3 * globeIn} delay={g} />
      <Headline lines={cfg.headline} wordFrames={cue.words} top={330} size={100} />

      {/* War Room card: pushes back into depth-of-field as we move to the globe */}
      <div
        style={{
          position: "absolute",
          left: 90,
          top: 660,
          transform: `translateY(${(1 - cardIn) * 80 - toGlobe * 120}px) scale(${1 - toGlobe * 0.25})`,
          opacity: (1 - toGlobe) * Math.min(1, cardIn * 1.5),
          filter: `blur(${toGlobe * 12}px)`,
          transformOrigin: "50% 0%",
        }}
      >
        <WarRoom frame={frame} avatars={cue.avatars} />
      </div>

      {/* Watchtower globe */}
      {frame >= g - 2 && (
        <div style={{ position: "absolute", left: -40, top: 470, width: 1080, height: 1080, opacity: globeIn, transform: `translateY(${(1 - globeIn) * 160}px)` }}>
          <Globe size={1080} pins={cue.pins} scale={globeScale} spinStart={g} />
        </div>
      )}
      {frame >= g && (
        <div
          style={{
            position: "absolute",
            top: 1470,
            left: 60,
            width: 880,
            display: "flex",
            justifyContent: "space-between",
            fontFamily: MONO,
            fontSize: 19,
            letterSpacing: "0.22em",
            color: C.muted,
            opacity: ease(frame, [g + 14, g + 26]),
          }}
        >
          <span>
            <span style={{ color: C.violetBright }}>● </span>THE WATCHTOWER
          </span>
          <span>
            EVENTS <span style={{ color: C.gold }}>{events}</span>
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};
