import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { config } from "../ad.config";
import { ease, rng, spr } from "../anim";
import { Headline } from "../components/Headline";
import { LineWork } from "../components/LineWork";
import { useCues, useSpec } from "../SceneContext";

const C = config.colors;
export const HOOK_CIRCLE = { cx: 500, cy: 900, r: 390 };

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues<"hook">();
  const cfg = useSpec<"hook">();
  const { cx, cy, r } = HOOK_CIRCLE;
  // Frame 0 is already mid-stroke: the circle starts 12% drawn.
  const draw = 0.12 + 0.88 * ease(frame, [0, 26], [0, 1]);
  const hit = spr(frame, cue.think, 10, 260);
  const hitGlow = ease(frame, [cue.think, cue.think + 26], [1, 0]);
  const shakeAmt = ease(frame, [cue.think, cue.think + 10], [14, 0]);
  const rr = rng(frame * 31);
  const shake = frame >= cue.think ? { x: (rr() - 0.5) * shakeAmt, y: (rr() - 0.5) * shakeAmt } : { x: 0, y: 0 };
  const ringScale = frame >= cue.think ? 1 + (1 - hit) * -0.06 + hitGlow * 0.05 : 1;

  return (
    <AbsoluteFill style={{ transform: `translate(${shake.x}px, ${shake.y}px)` }}>
      {/* Radial flash on the final word */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(520px 520px at ${cx}px ${cy}px, ${C.gold}${Math.round(hitGlow * 70)
            .toString(16)
            .padStart(2, "0")}, transparent 70%)`,
        }}
      />
      <LineWork duration={cue.dur} sigil="none" delay={10} />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <g style={{ transformOrigin: `${cx}px ${cy}px`, transform: `scale(${ringScale}) rotate(${-90 + frame * 0.6}deg)` }}>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={C.gold}
            strokeWidth={3}
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1 - draw}
            style={{ filter: `drop-shadow(0 0 ${8 + hitGlow * 30}px ${C.gold})` }}
          />
          {/* Leading spark on the drawing tip */}
          {draw < 0.999 && (
            <circle
              cx={cx + Math.cos(draw * Math.PI * 2) * r}
              cy={cy + Math.sin(draw * Math.PI * 2) * r}
              r={7}
              fill={C.goldBright}
              style={{ filter: `drop-shadow(0 0 14px ${C.goldBright})` }}
            />
          )}
          <circle
            cx={cx}
            cy={cy}
            r={r + 34}
            fill="none"
            stroke={C.gold}
            strokeOpacity={0.35}
            strokeWidth={1}
            pathLength={1}
            strokeDasharray="0.004 0.012"
            opacity={ease(frame, [6, 24])}
          />
          <circle
            cx={cx}
            cy={cy}
            r={r - 26}
            fill="none"
            stroke={C.gold}
            strokeOpacity={0.25}
            strokeWidth={1}
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={-(1 - ease(frame, [8, 40]))}
          />
        </g>
        {/* Shockwave */}
        {frame >= cue.think && (
          <circle
            cx={cx}
            cy={cy}
            r={r + ease(frame, [cue.think, cue.think + 22], [0, 380])}
            fill="none"
            stroke={C.goldBright}
            strokeWidth={ease(frame, [cue.think, cue.think + 22], [6, 0.5])}
            opacity={hitGlow}
          />
        )}
      </svg>
      <div style={{ position: "absolute", top: cy - 150, left: 0, right: 0 }}>
        <Headline lines={cfg.headline} wordFrames={cue.words} top={0} size={84} line2Scale={cfg.headline[1].length <= 16 ? 1.45 : 1.12} slam right={config.safe.rightRail} />
      </div>
    </AbsoluteFill>
  );
};
