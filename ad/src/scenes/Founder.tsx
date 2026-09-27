import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { config } from "../ad.config";
import { ease, easeInOut, lerp } from "../anim";
import { Headline } from "../components/Headline";
import { LineWork } from "../components/LineWork";
import { MONO } from "../fonts";
import { useCues, useSpec } from "../SceneContext";

const C = config.colors;
const FX = 520;
const FY = 960;
const S = 1.3;

type Seg = [number, number, number, number];
// Chef's knife, tip left, as straight strokes.
const KNIFE: Seg[] = [
  [-300, -14, -120, -52], [-120, -52, 80, -62], // spine
  [-300, -14, -200, 30], [-200, 30, -60, 50], [-60, 50, 80, 52], // edge belly
  [80, -62, 80, 52], [104, -42, 104, 40], // heel + bolster
  [104, -42, 300, -36], [104, 40, 300, 34], [300, -36, 318, 0], [318, 0, 300, 34], // handle
  [170, -9, 170, 7], [220, -8, 220, 6], [270, -8, 270, 6], // rivets
  [-230, 6, 40, 22], // edge shine
  [40, 22, 40, 22], [-120, -52, -120, -52], [300, 34, 300, 34], // spare points that grow into wicks
];
// Three candlesticks, trending up.
const rect = (x0: number, x1: number, y0: number, y1: number): Seg[] => [
  [x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0],
];
const CANDLES: Seg[] = [
  ...rect(-45, 45, -120, 70), // centre body (4)
  ...rect(-235, -175, -10, 90), // left body (4)
  ...rect(175, 235, -175, -65), // right body (4)
  [0, -120, 0, -230], [0, 70, 0, 150], // centre wicks
  [-205, 90, -205, 140], // left lower wick
  [-205, -10, -205, -70], // left upper wick
  [205, -175, 205, -235], [205, -65, 205, -15], // right wicks
];
// Pairing order: which knife stroke becomes which candle stroke.
const ORDER = [0, 1, 7, 8, 2, 3, 4, 5, 6, 9, 10, 14, 15, 16, 11, 12, 13, 17];

export const Founder: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues<"founder">();
  const cfg = useSpec<"founder">();
  const morphDone = ease(frame, [cue.morph.to - 10, cue.morph.to + 10]);
  const glintT = ease(frame, [cue.knife.to - 8, cue.knife.to + 10], [0, 1], easeInOut);
  const glintO = frame >= cue.knife.to - 8 && frame <= cue.knife.to + 12 ? Math.sin(glintT * Math.PI) : 0;
  const kitchen = ease(frame, [cue.knife.from + 10, cue.knife.from + 24]) * (1 - ease(frame, [cue.morph.from, cue.morph.from + 14]));
  const charts = ease(frame, [cue.morph.to - 12, cue.morph.to + 6]);
  const tx = (x: number) => FX + x * S;
  const ty = (y: number) => FY + y * S;

  return (
    <AbsoluteFill>
      <LineWork duration={cue.dur} sigil="triangle" cx={FX + 20} cy={FY} r={380} spin={0.03} opacity={0.25} />
      <Headline lines={cfg.headline} wordFrames={cue.words} top={330} size={100} />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <filter id="fglow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* chart grid fades up behind the candles */}
        {Array.from({ length: 6 }, (_, i) => (
          <line key={i} x1={tx(-330)} x2={tx(330)} y1={ty(-240 + i * 80)} y2={ty(-240 + i * 80)} stroke={C.violet} strokeOpacity={0.12 * morphDone} strokeDasharray="3 7" />
        ))}
        {/* candle body fills once the strokes have landed */}
        {[
          [-45, 45, -120, 70, C.gold],
          [-235, -175, -10, 90, C.violet],
          [175, 235, -175, -65, C.gold],
        ].map(([x0, x1, y0, y1, col], i) => (
          <rect
            key={i}
            x={tx(x0 as number)}
            y={ty(y0 as number)}
            width={((x1 as number) - (x0 as number)) * S}
            height={((y1 as number) - (y0 as number)) * S}
            fill={col as string}
            opacity={0.22 * ease(frame, [cue.morph.to - 6 + i * 3, cue.morph.to + 10 + i * 3])}
          />
        ))}
        <g filter="url(#fglow)">
          {KNIFE.map((k, i) => {
            const target = CANDLES[ORDER.indexOf(i)];
            const start = cue.morph.from + ORDER.indexOf(i) * 2.4;
            const m = ease(frame, [start, start + 18], [0, 1], easeInOut);
            const draw = ease(frame, [cue.knife.from + i * 1.8, cue.knife.from + i * 1.8 + 16]);
            const x1 = lerp(k[0], target[0], m);
            const y1 = lerp(k[1], target[1], m);
            const x2 = lerp(k[2], target[2], m);
            const y2 = lerp(k[3], target[3], m);
            const degenerate = k[0] === k[2] && k[1] === k[3];
            return (
              <line
                key={i}
                x1={tx(x1)}
                y1={ty(y1)}
                x2={tx(x1 + (x2 - x1) * (degenerate ? 1 : draw))}
                y2={ty(y1 + (y2 - y1) * (degenerate ? 1 : draw))}
                stroke={i === 14 && m < 0.5 ? C.goldBright : C.gold}
                strokeWidth={i === 14 ? 2 + m : 3}
                strokeLinecap="round"
                opacity={degenerate ? m : i === 14 ? 0.6 + 0.4 * m : 1}
              />
            );
          })}
        </g>
        {/* The "shing": a glint running down the edge */}
        {glintO > 0 && (
          <circle cx={tx(lerp(-300, 80, glintT))} cy={ty(lerp(-14, 52, glintT) * 0.7 + 10)} r={16} fill="#fff" opacity={glintO} style={{ filter: `blur(6px)` }} />
        )}
      </svg>
      <div style={{ position: "absolute", top: FY + 330, left: 60, width: 880, textAlign: "center", fontFamily: MONO, fontSize: 22, letterSpacing: "0.42em", height: 30 }}>
        <span style={{ position: "absolute", left: 0, right: 0, color: C.muted, opacity: kitchen, transform: `translateY(${(1 - kitchen) * -10}px)` }}>{cfg.labels[0]}</span>
        <span style={{ position: "absolute", left: 0, right: 0, color: C.gold, opacity: charts, transform: `translateY(${(1 - charts) * 10}px)` }}>{cfg.labels[1]}</span>
      </div>
    </AbsoluteFill>
  );
};
