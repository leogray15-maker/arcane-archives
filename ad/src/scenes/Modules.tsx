import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { config } from "../ad.config";
import { ease, spr } from "../anim";
import { Headline } from "../components/Headline";
import { LineWork } from "../components/LineWork";
import { Footnote, Label, Panel } from "../components/ui";
import { MONO, SANS, SERIF } from "../fonts";
import { useCues, useSpec } from "../SceneContext";

const C = config.colors;

/** A protocol's lessons ticking off in order, with a progress bar. */
export const Modules: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues<"modules">();
  const cfg = useSpec<"modules">();
  const inP = spr(frame, 2, 17, 120);
  const done = cue.checks.filter((f) => frame >= f).length;
  const progress = ease(frame, [cue.checks[0], cue.checks[cue.checks.length - 1] + 10]);
  const rowH = 96;

  return (
    <AbsoluteFill>
      <LineWork duration={cue.dur} sigil="none" />
      <Headline lines={cfg.headline} wordFrames={cue.words} top={330} size={100} />
      <Panel style={{ left: 60, top: 620, width: 880, height: 850, padding: "30px 34px", transform: `translateY(${(1 - inP) * 70}px)`, opacity: Math.min(1, inP * 1.5) }}>
        <Label color={C.violetBright}>PROTOCOL</Label>
        <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 52, color: C.text, marginTop: 10, letterSpacing: "-0.01em" }}>{cfg.programme}</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
          <Label size={16}>{`${cfg.items.length} MODULES · IN ORDER`}</Label>
          <Label size={16} color={C.gold}>{`${String(done).padStart(2, "0")} / ${String(cfg.items.length).padStart(2, "0")}`}</Label>
        </div>
        <div style={{ height: 5, borderRadius: 3, background: "#1C1A26", marginTop: 14 }}>
          <div style={{ width: `${progress * 100}%`, height: 5, borderRadius: 3, background: C.gold, boxShadow: `0 0 12px ${C.gold}` }} />
        </div>
        <div style={{ marginTop: 18 }}>
          {cfg.items.map((it, i) => {
            const at = cue.checks[i];
            const appear = spr(frame, 10 + i * 2.5, 16, 170);
            const chk = spr(frame, at, 12, 220);
            const on = frame >= at;
            const current = done === i;
            return (
              <div
                key={it}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 22,
                  height: rowH,
                  borderTop: `1px solid ${C.cardLine}`,
                  opacity: Math.min(1, appear * 1.4) * (on || current ? 1 : 0.45),
                  transform: `translateY(${(1 - appear) * 20}px)`,
                  background: current ? `linear-gradient(90deg, ${C.violet}18, transparent)` : undefined,
                }}
              >
                <span style={{ fontFamily: MONO, fontSize: 20, color: on ? C.gold : C.muted, width: 40 }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 30, color: C.text, flex: 1 }}>{it}</span>
                <svg width={44} height={44}>
                  <circle cx={22} cy={22} r={19} fill={on ? C.gold : "none"} stroke={on ? C.gold : "#3A3646"} strokeWidth={2} style={{ transformOrigin: "22px 22px", transform: `scale(${on ? 0.8 + 0.2 * chk : 1})` }} />
                  {on && <path d="M13 22.5 L19.5 29 L31 16" fill="none" stroke={C.bg} strokeWidth={3.4} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - chk} />}
                </svg>
              </div>
            );
          })}
        </div>
      </Panel>
      {cfg.disclaimer && (
        <Footnote top={1492} opacity={ease(frame, [6, 18])}>
          {cfg.disclaimer}
        </Footnote>
      )}
    </AbsoluteFill>
  );
};
