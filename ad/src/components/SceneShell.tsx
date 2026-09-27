import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { config } from "../ad.config";
import { ease, easeInExpo, easeOutExpo } from "../anim";

/**
 * Wraps a scene: slow 4% camera push, zoom-through entrance/exit across the
 * overlap window (never a flat crossfade), plus depth-of-field on exit.
 */
export const SceneShell: React.FC<{
  duration: number;
  first?: boolean;
  last?: boolean;
  children: React.ReactNode;
}> = ({ duration, first, last, children }) => {
  const frame = useCurrentFrame();
  const T = config.transitionFrames;
  const push = 1 + 0.04 * ease(frame, [0, duration], [0, 1], (t) => 1 - Math.pow(1 - t, 2));
  const inP = first ? 1 : ease(frame, [0, T + 4], [0, 1], easeOutExpo);
  const outP = last ? 0 : ease(frame, [duration - T - 2, duration], [0, 1], easeInExpo);
  const scale = push * (0.93 + 0.07 * inP) * (1 + 0.14 * outP);
  const blur = (1 - inP) * 10 + outP * 14;
  const opacity = Math.min(inP * 1.4, 1) * (1 - outP);
  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "50% 50%",
        filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
        opacity,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
