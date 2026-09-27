import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { config } from "../ad.config";
import { ease, spr } from "../anim";
import { Headline } from "../components/Headline";
import { LineWork } from "../components/LineWork";
import { Label, Panel } from "../components/ui";
import { MONO, SANS, SERIF } from "../fonts";
import { useCues, useSpec } from "../SceneContext";

const C = config.colors;
// The four realms and real protocol names from the vault.
const REALMS = [
  { name: "Mind & Psychology", count: 18, items: ["Mind HiJacking", "The Glitched Brain Protocol", "Full Stoicism", "Dark Psychology"] },
  { name: "Wealth & Business", count: 17, items: ["Entrepreneurship Mastery", "Escaping Hell", "The Sales Mastery Protocol", "Copywriting Mastery"] },
  { name: "Health & Investing", count: 5, items: ["Health Ascendance", "Biohacking", "Bulking Protocol", "Full Investing Guide"] },
  { name: "Systems", count: 6, items: ["Full Trading Programme", "The Deep Work System", "Efficiency Blueprint", "Daily Quests"] },
];

export const Realms: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues<"realms">();
  const cfg = useSpec<"realms">();
  const W = 430;
  const H = 420;
  const total = REALMS.reduce((a, r) => a + r.count, 0);
  const sum = Math.round(ease(frame, [20, 90], [0, total]));

  return (
    <AbsoluteFill>
      <LineWork duration={cue.dur} sigil="none" />
      <Headline lines={cfg.headline} wordFrames={cue.words} top={330} size={100} />
      {REALMS.map((r, i) => {
        const at = cue.cards[i];
        const p = spr(frame, at, 15, 150);
        const glow = ease(frame, [at, at + 24], [1, 0]);
        const x = 60 + (i % 2) * (W + 20);
        const y = 620 + Math.floor(i / 2) * (H + 20);
        const count = Math.round(ease(frame, [at + 2, at + 36], [0, r.count]));
        return (
          <Panel
            key={r.name}
            glow={frame >= at ? glow : 0}
            style={{ left: x, top: y, width: W, height: H, padding: "28px 28px", opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * 60}px) scale(${0.94 + 0.06 * p})` }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Label color={C.violetBright} size={17}>{`REALM ${String(i + 1).padStart(2, "0")}`}</Label>
              <span style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.2em", color: C.gold, border: `1px solid ${C.gold}66`, borderRadius: 20, padding: "5px 12px" }}>{`${count} PROTOCOLS`}</span>
            </div>
            <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 40, color: C.text, marginTop: 18, lineHeight: 1.1, height: 92 }}>{r.name}</div>
            <div style={{ marginTop: 10 }}>
              {r.items.map((it, k) => {
                const ip = spr(frame, at + 12 + k * 3, 16, 180);
                return (
                  <div
                    key={it}
                    style={{
                      fontFamily: SANS,
                      fontSize: 21,
                      color: "#C9C4D6",
                      padding: "9px 0",
                      borderTop: `1px solid ${C.cardLine}`,
                      opacity: Math.min(1, ip * 1.4),
                      transform: `translateX(${(1 - ip) * 24}px)`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span style={{ fontFamily: MONO, fontSize: 15, color: C.muted, marginRight: 12 }}>{String(k + 1).padStart(2, "0")}</span>
                    {it}
                  </div>
                );
              })}
              <div style={{ fontFamily: MONO, fontSize: 16, color: C.gold, marginTop: 8, opacity: ease(frame, [at + 26, at + 36]) }}>{`+${r.count - r.items.length} more inside`}</div>
            </div>
          </Panel>
        );
      })}
      <div style={{ position: "absolute", top: 1490, left: 60, width: 880, textAlign: "center", fontFamily: MONO, fontSize: 20, letterSpacing: "0.3em", color: C.muted, opacity: ease(frame, [24, 36]) }}>
        <span style={{ color: C.gold }}>{sum}</span> PROTOCOLS · 3,330+ MODULES
      </div>
    </AbsoluteFill>
  );
};
