import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { config } from "../ad.config";
import { ease, easeInExpo, rng, spr } from "../anim";
import { Headline } from "../components/Headline";
import { LineWork } from "../components/LineWork";
import { Label } from "../components/ui";
import { MONO } from "../fonts";
import { useCues, useSpec } from "../SceneContext";

const C = config.colors;
const RAIL_Y = 640;
const PAPER = "#E9E2D2";
const INK = "#1B1812";
const DISHES = ["ribeye mr", "sole", "risotto", "lamb rump", "tartare", "gnocchi", "halibut", "duck", "fondant"];
const TICKETS = Array.from({ length: 6 }, (_, i) => {
  const r = rng(40 + i);
  return {
    table: 3 + Math.floor(r() * 20),
    time: `19:${String(30 + i * 3).padStart(2, "0")}`,
    lines: Array.from({ length: 3 }, () => `${1 + Math.floor(r() * 3)}× ${DISHES[Math.floor(r() * DISHES.length)]}`),
  };
});

/** The kitchen: tickets on the rail, the pass timer, three burners, "order up". */
export const Kitchen: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues<"kitchen">();
  const cfg = useSpec<"kitchen">();
  const secs = 14 * 60 + 32 + Math.floor(frame / 30);
  const bellP = spr(frame, cue.bell, 11, 220);
  const bellOn = frame >= cue.bell;
  const bellFlash = ease(frame, [cue.bell, cue.bell + 16], [1, 0]);

  return (
    <AbsoluteFill>
      <LineWork duration={cue.dur} sigil="none" />
      <Headline lines={cfg.headline} wordFrames={cue.words} top={330} size={100} />
      {/* rail */}
      <div style={{ position: "absolute", left: 60, top: RAIL_Y, width: 880, height: 14, borderRadius: 7, background: `linear-gradient(180deg, ${C.goldBright}, ${C.goldDeep})`, opacity: ease(frame, [0, 12]), boxShadow: `0 6px 20px rgba(0,0,0,0.6)` }} />
      {TICKETS.map((t, i) => {
        const at = cue.tickets[i];
        const p = spr(frame, at, 14, 150);
        const x = 74 + i * 144;
        const from = 1120;
        const swing = Math.sin((frame - at) / 5) * 6 * Math.exp(-(frame - at) / 18) * (frame >= at ? 1 : 0);
        // First ticket goes on "order up".
        const pulled = i === 0 ? ease(frame, [cue.bell + 4, cue.bell + 20], [0, 1], easeInExpo) : 0;
        if (frame < at) return null;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: from + (x - from) * p,
              top: RAIL_Y + 6 - pulled * 500,
              width: 130,
              height: 330,
              transformOrigin: "50% 0%",
              transform: `rotate(${swing + (1 - p) * 8}deg)`,
              background: PAPER,
              borderRadius: "3px 3px 6px 6px",
              boxShadow: "0 18px 30px rgba(0,0,0,0.55)",
              padding: "20px 12px",
              boxSizing: "border-box",
              fontFamily: MONO,
              color: INK,
              opacity: 1 - pulled,
            }}
          >
            <div style={{ fontSize: 15, letterSpacing: "0.1em", fontWeight: 500 }}>TBL {t.table}</div>
            <div style={{ fontSize: 13, opacity: 0.6, marginTop: 2 }}>{t.time}</div>
            <div style={{ borderTop: `1px dashed ${INK}66`, margin: "12px 0" }} />
            {t.lines.map((l, k) => (
              <div key={k} style={{ fontSize: 14, lineHeight: 1.6 }}>
                {l}
              </div>
            ))}
            <div style={{ position: "absolute", bottom: 18, left: 12, right: 12, borderTop: `1px dashed ${INK}66`, paddingTop: 10, fontSize: 14, fontWeight: 500, letterSpacing: "0.2em", color: i === 0 && bellOn ? "#8A6B32" : INK }}>
              {i === 0 && bellOn ? "SERVED" : "FIRE"}
            </div>
          </div>
        );
      })}
      {/* pass timer */}
      <div style={{ position: "absolute", top: 1030, left: 60, width: 880, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: ease(frame, [16, 28]) }}>
        <Label>THE PASS</Label>
        <div style={{ fontFamily: MONO, fontSize: 44, color: C.text, fontVariantNumeric: "tabular-nums" }}>
          {`00:${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`}
        </div>
      </div>
      {/* burners */}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="flame">
            <stop offset="0%" stopColor={C.goldBright} stopOpacity={0.9} />
            <stop offset="55%" stopColor={C.gold} stopOpacity={0.35} />
            <stop offset="100%" stopColor={C.violet} stopOpacity={0} />
          </radialGradient>
        </defs>
        {[210, 500, 790].map((cx, i) => {
          const cy = 1300;
          const on = ease(frame, [24 + i * 8, 40 + i * 8]);
          const flick = 0.85 + 0.15 * Math.sin(frame / 2.3 + i * 2) * Math.sin(frame / 3.7 + i);
          return (
            <g key={i} opacity={on}>
              <circle cx={cx} cy={cy} r={120 * flick} fill="url(#flame)" opacity={0.55 + bellFlash * 0.3} />
              {[110, 80, 50].map((r, k) => (
                <circle key={k} cx={cx} cy={cy} r={r} fill="none" stroke={C.gold} strokeWidth={k === 0 ? 2 : 1.2} strokeOpacity={0.8 - k * 0.2} />
              ))}
              {Array.from({ length: 16 }, (_, k) => {
                const a = (k / 16) * Math.PI * 2;
                const len = 12 + 8 * Math.sin(frame / 2 + k * 1.7 + i);
                return (
                  <line
                    key={k}
                    x1={cx + Math.cos(a) * 52}
                    y1={cy + Math.sin(a) * 52}
                    x2={cx + Math.cos(a) * (52 + len)}
                    y2={cy + Math.sin(a) * (52 + len)}
                    stroke={C.goldBright}
                    strokeWidth={3}
                    strokeLinecap="round"
                    opacity={0.8}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
      {/* order up */}
      <div
        style={{
          position: "absolute",
          top: 1460,
          left: 500 - 180,
          width: 360,
          height: 60,
          borderRadius: 30,
          border: `1.5px solid ${C.gold}`,
          background: `${C.gold}22`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: MONO,
          fontSize: 22,
          letterSpacing: "0.3em",
          color: C.goldBright,
          opacity: bellOn ? Math.min(1, bellP * 1.5) : 0,
          transform: `scale(${0.8 + 0.2 * bellP})`,
          boxShadow: `0 0 ${20 + bellFlash * 40}px ${C.gold}66`,
        }}
      >
        ORDER UP
      </div>
    </AbsoluteFill>
  );
};
