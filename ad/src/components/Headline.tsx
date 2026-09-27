import React from "react";
import { useCurrentFrame } from "remotion";
import { config } from "../ad.config";
import { ease, spr } from "../anim";
import { SERIF } from "../fonts";
import { fitText } from "@remotion/layout-utils";

const C = config.colors;

/**
 * Two-line serif headline. Line 1 white upright, line 2 gold italic.
 * Each word rises out of a mask on its own frame (from the timing map).
 * `slam` = hook style: words punch in from scale with a blur smear.
 */
export const Headline: React.FC<{
  lines: readonly string[];
  wordFrames: number[][];
  top: number;
  size?: number;
  slam?: boolean;
  align?: "center" | "left";
  glowWord?: { line: number; index: number; frame: number };
  line2Scale?: number;
  /** Right inset; use config.safe.rightRail for text that sits beside the TikTok action rail. */
  right?: number;
}> = ({ lines, wordFrames, top, size = 96, slam = false, align = "center", glowWord, line2Scale = 1, right = config.safe.margin }) => {
  const frame = useCurrentFrame();
  // Shrink to fit the safe width if a line is too long for the requested size.
  const maxW = config.width - config.safe.margin - right - 16;
  const fitted = Math.min(
    size,
    ...lines.map((l, i) =>
      fitText({ text: l, withinWidth: maxW / (i ? line2Scale : 1), fontFamily: "Playfair Display", fontWeight: 600, letterSpacing: "-0.02em", additionalStyles: { fontStyle: i ? "italic" : "normal" } }).fontSize,
    ),
  );
  size = Math.floor(fitted);
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: config.safe.margin,
        right,
        textAlign: align,
        fontFamily: SERIF,
        fontWeight: 600,
        fontSize: size,
        lineHeight: 1.08,
        letterSpacing: "-0.02em",
        fontVariantNumeric: "lining-nums",
      }}
    >
      {lines.map((line, li) => (
        <div key={li} style={{ fontSize: li ? size * line2Scale : size, color: li === 0 ? C.text : C.gold, fontStyle: li === 0 ? "normal" : "italic", whiteSpace: "nowrap" }}>
          {line.split(" ").map((word, wi, arr) => {
            const f = wordFrames[li]?.[wi] ?? 0;
            const p = spr(frame, f, slam ? 12 : 16, slam ? 220 : 150);
            const early = frame < f;
            const blur = slam ? ease(frame, [f, f + 6], [14, 0]) : ease(frame, [f, f + 8], [6, 0]);
            const isGlow = glowWord && glowWord.line === li && glowWord.index === wi;
            const glow = isGlow ? ease(frame, [glowWord!.frame, glowWord!.frame + 24], [1, 0]) : 0;
            const transform = slam
              ? `translateY(${(1 - p) * 40}px) scale(${1 + (1 - p) * 0.5})`
              : `translateY(${(1 - p) * 105}%)`;
            return (
              <span
                key={wi}
                style={{
                  display: "inline-block",
                  overflow: slam ? "visible" : "hidden",
                  verticalAlign: "top",
                  paddingBottom: "0.12em",
                  marginRight: wi < arr.length - 1 ? "0.24em" : 0,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    transform,
                    opacity: early ? 0 : slam ? Math.min(1, p * 2) : 1,
                    filter: `blur(${blur}px)`,
                    textShadow: glow
                      ? `0 0 ${40 * glow}px ${C.gold}, 0 0 ${90 * glow}px ${C.gold}`
                      : li === 1
                        ? `0 0 30px ${C.gold}33`
                        : undefined,
                  }}
                >
                  {word}
                </span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};
