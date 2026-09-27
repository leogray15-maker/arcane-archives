import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { config } from "../ad.config";
import { ease, spr } from "../anim";
import { Globe } from "../components/Globe";
import { Headline } from "../components/Headline";
import { LineWork } from "../components/LineWork";
import { Label, LivePill, Panel } from "../components/ui";
import { MONO } from "../fonts";
import { useCues, useSpec } from "../SceneContext";

const C = config.colors;
const SWATCH = [C.down, C.gold, C.violetBright, "#ffffff"];

/** Watchtower hero: the globe, with each data layer switching on as it is named. */
export const GlobeLayers: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues<"globeLayers">();
  const cfg = useSpec<"globeLayers">();
  const rise = spr(frame, 0, 17, 90);
  const push = ease(frame, [cue.push, cue.push + 40], [0, 0.06]);
  const scale = 0.52 + 0.24 * rise + push + frame * 0.0001;
  const [conflicts, shipping, cables, military] = cue.layers;
  const secs = 29 * 60 + 7 + Math.floor(frame / 30);
  const clock = `13:${String(Math.floor(secs / 60) % 60).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")} UTC`;

  return (
    <AbsoluteFill>
      <LineWork duration={cue.dur} sigil="orbit" cx={500} cy={980} r={370} spin={0.06} opacity={0.3} />
      <Headline lines={cfg.headline} wordFrames={cue.words} top={330} size={100} />
      <div style={{ position: "absolute", left: -40, top: 440, width: 1080, height: 1080, transform: `translateY(${(1 - rise) * 140}px)`, opacity: Math.min(1, rise * 1.4) }}>
        <Globe size={1080} scale={scale} lon0={-128} tilt={0.55} spin={0.09} layers={{ conflicts, shipping, cables, military }} />
      </div>
      {/* HUD */}
      <div style={{ position: "absolute", top: 610, left: 60, width: 880, display: "flex", justifyContent: "space-between", opacity: ease(frame, [10, 24]) }}>
        <Label size={17}>GLOBAL SITUATION</Label>
        <span style={{ fontFamily: MONO, fontSize: 17, color: C.muted, letterSpacing: "0.08em" }}>{clock}</span>
      </div>
      {/* Layer toggles */}
      <Panel style={{ left: 60, top: 1330, width: 880, height: 190, padding: "22px 26px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Label size={16}>LAYERS</Label>
          <LivePill frame={frame} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: 16, columnGap: 20, marginTop: 20 }}>
          {cfg.layers.map((l, i) => {
            const on = frame >= cue.layers[i];
            const p = spr(frame, cue.layers[i], 13, 260);
            return (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: MONO, fontSize: 19, letterSpacing: "0.12em", color: on ? C.text : "#5E5A6B" }}>
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    border: `2px solid ${on ? SWATCH[i] : "#3A3646"}`,
                    background: on ? `${SWATCH[i]}33` : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: `scale(${on ? 1 + (1 - p) * 0.4 : 1})`,
                    boxShadow: on ? `0 0 ${14 * (1.2 - p)}px ${SWATCH[i]}` : undefined,
                  }}
                >
                  {on && (
                    <svg width={16} height={16} viewBox="0 0 16 16">
                      <path d="M3 8.5 L6.5 12 L13 4.5" fill="none" stroke={SWATCH[i]} strokeWidth={2.4} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} />
                    </svg>
                  )}
                </span>
                {l}
              </div>
            );
          })}
        </div>
      </Panel>
    </AbsoluteFill>
  );
};
