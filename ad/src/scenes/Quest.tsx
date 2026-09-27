import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { config } from "../ad.config";
import { ease, spr } from "../anim";
import { Headline } from "../components/Headline";
import { LineWork } from "../components/LineWork";
import { Label, Panel } from "../components/ui";
import { MONO, SANS } from "../fonts";
import { useCues, useSpec } from "../SceneContext";

const C = config.colors;
const COLS = 26;
const ROWS = 14; // 364 days + today
const PITCH = 33;
const GX = 60 + (880 - COLS * PITCH) / 2;
const GY = 930;

/** The daily quest card, then a year of days filling in: 30 min/day -> 180+ hours. */
export const Quest: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues<"quest">();
  const cfg = useSpec<"quest">();
  const cardP = spr(frame, cue.card, 15, 150);
  const fillP = ease(frame, [cue.fill.from, cue.fill.to], [0, 1], (t) => t);
  const days = Math.round(fillP * 365);
  const hours = Math.round((days * 30) / 60);
  const landed = frame >= cue.fill.to;
  const pop = spr(frame, cue.fill.to, 11, 220);

  return (
    <AbsoluteFill>
      <LineWork duration={cue.dur} sigil="none" />
      <Headline lines={cfg.headline} wordFrames={cue.words} top={330} size={100} />
      <Panel style={{ left: 60, top: 620, width: 880, height: 270, padding: "26px 30px", transform: `translateY(${(1 - cardP) * 60}px) rotate(${(1 - cardP) * -2}deg)`, opacity: Math.min(1, cardP * 1.5) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg width={26} height={26} viewBox="0 0 24 24">
            <path d="M14 3 L21 10 L17 11 L13 15 L13 19 L11 21 L3 13 L5 11 L9 11 L13 7 Z M7 17 L3 21" fill="none" stroke={C.gold} strokeWidth={1.8} strokeLinejoin="round" />
          </svg>
          <Label color={C.gold}>DAILY QUEST · PINNED 06:00</Label>
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 32, color: C.text, marginTop: 22, lineHeight: 1.35 }}>
          Today: finish one module and post one takeaway in the room.
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
          <Label size={16}>FROM LEO · MAIN CHAT</Label>
          <Label size={16} color={C.violetBright}>30 MIN</Label>
        </div>
      </Panel>

      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: 365 }, (_, d) => {
          const col = Math.floor(d / ROWS);
          const row = d % ROWS;
          const on = d < days;
          const fresh = on && d > days - 12;
          return (
            <rect
              key={d}
              x={GX + col * PITCH + 5}
              y={GY + row * PITCH + 5}
              width={PITCH - 10}
              height={PITCH - 10}
              rx={5}
              fill={on ? (fresh ? C.goldBright : C.gold) : "#15141D"}
              opacity={on ? (fresh ? 1 : 0.8) : ease(frame, [20 + col * 0.6, 30 + col * 0.6])}
              style={fresh ? { filter: `drop-shadow(0 0 6px ${C.gold})` } : undefined}
            />
          );
        })}
      </svg>
      <div style={{ position: "absolute", top: GY + ROWS * PITCH + 18, left: 60, width: 880, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <Label size={16}>DAYS</Label>
          <div style={{ fontFamily: MONO, fontSize: 40, color: C.text, fontVariantNumeric: "tabular-nums" }}>{days}</div>
        </div>
        <div style={{ textAlign: "right", transform: `scale(${landed ? 1 + (1 - pop) * 0.12 : 1})`, transformOrigin: "100% 50%" }}>
          <Label size={16} color={C.gold}>HOURS</Label>
          <div style={{ fontFamily: MONO, fontSize: 40, color: landed ? C.goldBright : C.text, fontVariantNumeric: "tabular-nums", textShadow: landed ? `0 0 24px ${C.gold}88` : undefined }}>
            {hours}
            {landed ? "+" : ""}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
