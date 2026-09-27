import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { config } from "../ad.config";
import { ease, rng, spr } from "../anim";
import { Headline } from "../components/Headline";
import { LineWork } from "../components/LineWork";
import { Footnote, Label, LivePill, Panel, sparkPath } from "../components/ui";
import { MONO, SANS } from "../fonts";
import { useCues, useSpec } from "../SceneContext";

const C = config.colors;
// Illustrative quotes (no positions, no P&L).
const QUOTES = [
  { sym: "XAU", name: "Gold", px: 3987.4, ch: 0.42, dp: 2 },
  { sym: "XAG", name: "Silver", px: 64.256, ch: 0.67, dp: 3 },
  { sym: "BTC", name: "Bitcoin", px: 84736.0, ch: 0.36, dp: 2 },
  { sym: "ETH", name: "Ether", px: 2702.69, ch: 0.24, dp: 2 },
  { sym: "OIL", name: "WTI crude", px: 92.45, ch: -2.45, dp: 2 },
  { sym: "SPX", name: "S&P 500", px: 7745.9, ch: 0.65, dp: 1 },
  { sym: "VIX", name: "Volatility", px: 17.81, ch: -1.55, dp: 2 },
];
const SPARKS = QUOTES.map((q, i) => {
  const r = rng(300 + i);
  let v = 100;
  return Array.from({ length: 40 }, (_, k) => (v += (r() - 0.5) * 3 + (q.ch / 40) * 6 * (k > 20 ? 1.5 : 0.5)));
});

export const Ticker: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues<"ticker">();
  const cfg = useSpec<"ticker">();
  const panelIn = spr(frame, 2, 17, 120);
  const tape = QUOTES.map((q) => `${q.sym} ${q.px.toLocaleString("en-US", { minimumFractionDigits: q.dp, maximumFractionDigits: q.dp })}  ${q.ch >= 0 ? "+" : ""}${q.ch.toFixed(2)}%`).join("     ·     ");

  return (
    <AbsoluteFill>
      <LineWork duration={cue.dur} sigil="none" />
      <Headline lines={cfg.headline} wordFrames={cue.words} top={330} size={100} />
      <Panel style={{ left: 60, top: 620, width: 880, height: 790, padding: "24px 30px", transform: `translateY(${(1 - panelIn) * 70}px)`, opacity: Math.min(1, panelIn * 1.5) }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Label>MARKETS</Label>
          <LivePill frame={frame} />
        </div>
        {QUOTES.map((q, i) => {
          const at = cue.rows[i];
          const p = spr(frame, at, 16, 170);
          const drawn = ease(frame, [at, at + 28]);
          // Prices keep ticking in the last digits.
          const r = rng(i * 977 + Math.floor(frame / 6));
          const px = q.px * (1 + (r() - 0.5) * 0.0006 * ease(frame, [at + 20, at + 30]));
          const up = q.ch >= 0;
          const col = up ? C.up : C.down;
          return (
            <div
              key={q.sym}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                height: 96,
                borderTop: i ? `1px solid ${C.cardLine}` : undefined,
                marginTop: i ? 0 : 14,
                opacity: Math.min(1, p * 1.4),
                transform: `translateX(${(1 - p) * 50}px)`,
              }}
            >
              <span style={{ width: 62, height: 62, borderRadius: 31, border: `1.5px solid ${C.gold}66`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 16, color: C.gold }}>
                {q.sym}
              </span>
              <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 27, color: C.text, width: 190 }}>{q.name}</span>
              <svg width={200} height={50} style={{ overflow: "visible" }}>
                <path d={sparkPath(SPARKS[i], 200, 46, drawn)} fill="none" stroke={col} strokeWidth={2.2} />
              </svg>
              <span style={{ flex: 1, textAlign: "right" }}>
                <div style={{ fontFamily: MONO, fontSize: 26, color: C.text, fontVariantNumeric: "tabular-nums" }}>
                  {px.toLocaleString("en-US", { minimumFractionDigits: q.dp, maximumFractionDigits: q.dp })}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 18, color: col }}>
                  {up ? "+" : ""}
                  {q.ch.toFixed(2)}%
                </div>
              </span>
            </div>
          );
        })}
      </Panel>
      {/* Tape */}
      <div style={{ position: "absolute", top: 1428, left: 60, width: 880, height: 46, overflow: "hidden", borderTop: `1px solid ${C.gold}44`, borderBottom: `1px solid ${C.gold}44`, opacity: ease(frame, [10, 24]) }}>
        <div style={{ whiteSpace: "nowrap", fontFamily: MONO, fontSize: 19, lineHeight: "46px", color: C.gold, transform: `translateX(${-frame * 4}px)`, letterSpacing: "0.06em" }}>
          {tape}     ·     {tape}
        </div>
      </div>
      <Footnote top={1498} opacity={ease(frame, [6, 18])}>
        {cfg.disclaimer} Illustrative quotes.
      </Footnote>
    </AbsoluteFill>
  );
};
