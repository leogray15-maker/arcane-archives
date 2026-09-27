import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { config } from "../ad.config";
import { ease, spr } from "../anim";
import { Headline } from "../components/Headline";
import { LineWork } from "../components/LineWork";
import { Label } from "../components/ui";
import { MONO, SANS, SERIF } from "../fonts";
import { useCues, useSpec } from "../SceneContext";

const C = config.colors;
// "How it works", from the site.
const STEPS = [
  { when: "DAY ONE", title: "Your first mission.", sub: "Escaping Hell: break the old habits, get the roadmap." },
  { when: "EVERY MORNING", title: "A Daily Quest from Leo.", sub: "Pinned in the main chat before you start work." },
  { when: "YOUR PATH", title: "Work through the protocols.", sub: "46+ protocols, in order. No hunting." },
  { when: "EVERY WEEK", title: "Get on the War Room call.", sub: "Answered live. Recorded if you miss it." },
];
const X = 70;
const TOP = 650;
const GAP = 212;

export const Steps: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues<"steps">();
  const cfg = useSpec<"steps">();
  let active = -1;
  cue.steps.forEach((f, i) => {
    if (frame >= f) active = i;
  });
  const lineTo = active < 0 ? 0 : ease(frame, [cue.steps[active], cue.steps[active] + 20], [TOP + (active - 1) * GAP, TOP + active * GAP]);

  return (
    <AbsoluteFill>
      <LineWork duration={cue.dur} sigil="none" />
      <Headline lines={cfg.headline} wordFrames={cue.words} top={330} size={100} />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <line x1={X + 34} y1={TOP} x2={X + 34} y2={TOP + 3 * GAP} stroke={C.cardLine} strokeWidth={2} opacity={ease(frame, [4, 16])} />
        {active >= 0 && <line x1={X + 34} y1={TOP} x2={X + 34} y2={Math.max(TOP, lineTo)} stroke={C.gold} strokeWidth={3} style={{ filter: `drop-shadow(0 0 6px ${C.gold})` }} />}
      </svg>
      {STEPS.map((s, i) => {
        const at = cue.steps[i];
        const appear = spr(frame, 8 + i * 3, 16, 160);
        const on = frame >= at;
        const p = spr(frame, at, 13, 200);
        const y = TOP + i * GAP;
        return (
          <div key={s.when} style={{ position: "absolute", left: X, top: y - 34, width: 870, opacity: Math.min(1, appear * 1.4) * (on ? 1 : 0.3), transform: `translateX(${(1 - appear) * 30}px)` }}>
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: 68,
                height: 68,
                borderRadius: 34,
                background: on ? "#16131F" : C.bg,
                border: `2px solid ${on ? C.gold : "#3A3646"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: MONO,
                fontSize: 26,
                color: on ? C.goldBright : C.violetBright,
                transform: `scale(${on ? 1 + (1 - p) * 0.25 : 1})`,
                boxShadow: on ? `0 0 ${10 + (1 - p) * 30}px ${C.gold}88` : undefined,
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </div>
            <div style={{ marginLeft: 104 }}>
              <Label size={17} color={on ? C.gold : C.muted}>
                {s.when}
              </Label>
              <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 46, color: C.text, marginTop: 8, letterSpacing: "-0.01em", transform: `translateY(${on ? (1 - p) * 10 : 0}px)` }}>{s.title}</div>
              <div style={{ fontFamily: SANS, fontSize: 24, color: C.muted, marginTop: 8 }}>{s.sub}</div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
