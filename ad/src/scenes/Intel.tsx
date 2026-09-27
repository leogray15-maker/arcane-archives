import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { config } from "../ad.config";
import { ease, spr } from "../anim";
import { Headline } from "../components/Headline";
import { LineWork } from "../components/LineWork";
import { Footnote, Label, Panel } from "../components/ui";
import { MONO, SANS } from "../fonts";
import { useCues, useSpec } from "../SceneContext";

const C = config.colors;
// From the site's illustrative Watchtower preview.
const FORECASTS = [
  { t: "Black Sea maritime disruption", p: 50, tag: "SUPPLY CHAIN" },
  { t: "Iran security escalation", p: 70, tag: "CONFLICT" },
  { t: "Energy repricing risk", p: 67, tag: "MARKET" },
  { t: "Cyber threat concentration", p: 50, tag: "CYBER" },
];
// Deliberately generic, illustrative brief: every sentence carries a source marker.
const BRIEF: { text: string; cite: number }[] = [
  { text: "Insurers widened a maritime war-risk zone overnight.", cite: 1 },
  { text: "Energy futures opened higher on supply concerns.", cite: 2 },
  { text: "Regional outlets reported naval drills near a key strait.", cite: 3 },
];
const SOURCES = [
  { name: "Wire service", cred: 4 },
  { name: "Market desk", cred: 5 },
  { name: "Regional press", cred: 3 },
];

export const Intel: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues<"intel">();
  const cfg = useSpec<"intel">();
  const topIn = spr(frame, 6, 17, 120);
  const briefIn = spr(frame, cue.brief, 17, 120);

  return (
    <AbsoluteFill>
      <LineWork duration={cue.dur} sigil="none" />
      <Headline lines={cfg.headline} wordFrames={cue.words} top={330} size={100} />
      <Panel style={{ left: 60, top: 620, width: 880, height: 450, padding: "26px 30px", transform: `translateY(${(1 - topIn) * 60}px)`, opacity: Math.min(1, topIn * 1.5) }}>
        <Label>AI FORECASTS</Label>
        {FORECASTS.map((f, i) => {
          const at = cue.rows[i];
          const p = spr(frame, at, 16, 170);
          const fill = ease(frame, [at + 4, at + 30]);
          return (
            <div key={f.t} style={{ display: "flex", alignItems: "center", gap: 18, marginTop: i ? 20 : 26, paddingTop: 20, borderTop: `1px solid ${C.cardLine}`, opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 16}px)` }}>
              <span style={{ fontFamily: SANS, fontSize: 27, color: C.text, flex: 1 }}>{f.t}</span>
              <span style={{ width: 110, height: 5, borderRadius: 3, background: "#1C1A26" }}>
                <span style={{ display: "block", width: `${f.p * fill}%`, height: 5, borderRadius: 3, background: C.violetBright, boxShadow: `0 0 8px ${C.violet}` }} />
              </span>
              <span style={{ fontFamily: MONO, fontSize: 23, color: C.violetBright, width: 58, textAlign: "right" }}>{Math.round(f.p * fill)}%</span>
              <span style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.14em", color: C.gold, border: `1px solid ${C.gold}88`, borderRadius: 8, padding: "6px 10px", width: 150, textAlign: "center" }}>{f.tag}</span>
            </div>
          );
        })}
      </Panel>

      <Panel style={{ left: 60, top: 1092, width: 880, height: 390, padding: "26px 30px", transform: `translateY(${(1 - briefIn) * 60}px)`, opacity: frame >= cue.brief ? Math.min(1, briefIn * 1.5) : 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Label>WORLD BRIEF · 06:00 UTC</Label>
          <Label color={C.gold}>SOURCED</Label>
        </div>
        <div style={{ fontFamily: SANS, fontSize: 27, lineHeight: 1.45, color: C.text, marginTop: 18 }}>
          {BRIEF.map((b, i) => {
            const shown = ease(frame, [cue.brief + 4 + i * 6, cue.brief + 14 + i * 6]);
            const lit = frame >= cue.cites[i];
            const litP = spr(frame, cue.cites[i], 11, 240);
            return (
              <span key={i} style={{ opacity: shown }}>
                <span style={{ backgroundImage: `linear-gradient(${C.gold}33, ${C.gold}33)`, backgroundSize: `${lit ? litP * 100 : 0}% 100%`, backgroundRepeat: "no-repeat" }}>{b.text}</span>
                <sup
                  style={{
                    fontFamily: MONO,
                    fontSize: 17,
                    color: lit ? C.bg : C.gold,
                    background: lit ? C.gold : "transparent",
                    border: `1px solid ${C.gold}`,
                    borderRadius: 5,
                    padding: "1px 6px",
                    marginLeft: 6,
                    marginRight: 8,
                    display: "inline-block",
                    transform: `scale(${lit ? 1 + (1 - litP) * 0.4 : 1})`,
                  }}
                >
                  {b.cite}
                </sup>
              </span>
            );
          })}
        </div>
        <div style={{ position: "absolute", left: 30, right: 30, bottom: 24, display: "flex", gap: 14 }}>
          {SOURCES.map((s, i) => {
            const lit = frame >= cue.cites[i];
            const p = spr(frame, cue.cites[i], 14, 200);
            return (
              <div
                key={s.name}
                style={{
                  flex: 1,
                  border: `1px solid ${lit ? C.gold + "aa" : C.cardLine}`,
                  borderRadius: 12,
                  padding: "10px 12px",
                  opacity: lit ? 1 : 0.35,
                  transform: `translateY(${lit ? (1 - p) * 10 : 0}px)`,
                }}
              >
                <div style={{ fontFamily: MONO, fontSize: 15, color: C.gold, letterSpacing: "0.1em" }}>[{i + 1}]</div>
                <div style={{ fontFamily: SANS, fontSize: 19, color: C.text, marginTop: 4 }}>{s.name}</div>
                <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
                  {Array.from({ length: 5 }, (_, k) => (
                    <span key={k} style={{ width: 9, height: 9, borderRadius: 5, background: k < s.cred ? C.violetBright : "#2B2838" }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
      <Footnote top={1500} opacity={ease(frame, [20, 34])}>
        Illustrative preview. Sources rated for credibility.
      </Footnote>
    </AbsoluteFill>
  );
};
