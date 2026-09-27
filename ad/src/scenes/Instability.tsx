import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { config } from "../ad.config";
import { ease, easeInOut, spr } from "../anim";
import { Headline } from "../components/Headline";
import { LineWork } from "../components/LineWork";
import { Footnote, Label, LivePill, Panel, sparkPath } from "../components/ui";
import { MONO, SANS } from "../fonts";
import { useCues, useSpec } from "../SceneContext";

const C = config.colors;
// The site's own illustrative preview values.
const ROWS = [
  { name: "Ukraine", score: 81, delta: 0 },
  { name: "Russia", score: 78, delta: 13 },
  { name: "Syria", score: 75, delta: 7 },
  { name: "Pakistan", score: 70, delta: 0 },
  { name: "Yemen", score: 70, delta: 0 },
];
const RISK = 68;
const TREND = [52, 55, 54, 58, 61, 60, 63, 66, 64, 67, 68, 68];

export const Instability: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = useCues<"instability">();
  const cfg = useSpec<"instability">();
  const listIn = spr(frame, 8, 17, 120);
  const gaugeP = ease(frame, [cue.gauge.from, cue.gauge.to], [0, 1], easeInOut);
  const gaugeIn = spr(frame, cue.gauge.from - 10, 17, 120);
  const R = 96;
  const circ = 2 * Math.PI * R;
  const high = frame >= cue.gauge.to;
  const highPop = spr(frame, cue.gauge.to, 11, 220);

  return (
    <AbsoluteFill>
      <LineWork duration={cue.dur} sigil="none" />
      <Headline lines={cfg.headline} wordFrames={cue.words} top={330} size={100} />
      <Panel style={{ left: 60, top: 620, width: 880, height: 560, padding: "28px 32px", transform: `translateY(${(1 - listIn) * 60}px)`, opacity: Math.min(1, listIn * 1.5) }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Label>COUNTRY INSTABILITY</Label>
          <LivePill frame={frame} />
        </div>
        {ROWS.map((r, i) => {
          const at = cue.rows[i];
          const p = spr(frame, at, 16, 160);
          const bar = ease(frame, [at + 2, at + 30]) * (r.score / 100);
          const col = r.score >= 80 ? C.down : C.gold;
          const dAt = r.delta ? cue.deltas[i === 1 ? 0 : 1] : 0;
          const dp = r.delta ? spr(frame, dAt, 11, 240) : 0;
          return (
            <div key={r.name} style={{ marginTop: i ? 20 : 30, opacity: Math.min(1, p * 1.4), transform: `translateX(${(1 - p) * -40}px)` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ width: 13, height: 13, borderRadius: 7, background: col, boxShadow: `0 0 10px ${col}` }} />
                <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 31, color: C.text, flex: 1 }}>{r.name}</span>
                <span style={{ fontFamily: MONO, fontSize: 30, color: C.text, width: 60, textAlign: "right" }}>{Math.round(r.score * Math.min(1, bar / (r.score / 100) || 0))}</span>
                <span style={{ fontFamily: MONO, fontSize: 22, width: 70, textAlign: "right", color: r.delta ? C.down : C.muted, opacity: r.delta ? dp : 0.7, transform: `scale(${r.delta ? 0.6 + 0.4 * dp : 1})` }}>
                  {r.delta ? `↑${r.delta}` : "→"}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "#1C1A26", marginTop: 12 }}>
                <div style={{ width: `${bar * 100}%`, height: 6, borderRadius: 3, background: `linear-gradient(90deg, ${col}aa, ${col})`, boxShadow: `0 0 10px ${col}66` }} />
              </div>
            </div>
          );
        })}
      </Panel>

      <Panel style={{ left: 60, top: 1206, width: 880, height: 270, padding: "26px 32px", transform: `translateY(${(1 - gaugeIn) * 60}px)`, opacity: Math.min(1, gaugeIn * 1.5) }} glow={high ? (1 - highPop) : 0}>
        <svg width={260} height={220} style={{ position: "absolute", left: 20, top: 24 }}>
          <circle cx={130} cy={110} r={R} fill="none" stroke="#1C1A26" strokeWidth={16} />
          <circle
            cx={130}
            cy={110}
            r={R}
            fill="none"
            stroke={C.gold}
            strokeWidth={16}
            strokeLinecap="round"
            strokeDasharray={`${circ * (RISK / 100) * gaugeP} ${circ}`}
            transform="rotate(-90 130 110)"
            style={{ filter: `drop-shadow(0 0 10px ${C.gold})` }}
          />
          <text x={130} y={124} textAnchor="middle" fontFamily={MONO} fontSize={58} fontWeight={500} fill={C.goldBright}>
            {Math.round(RISK * gaugeP)}
          </text>
          <text x={130} y={158} textAnchor="middle" fontFamily={MONO} fontSize={17} letterSpacing="0.3em" fill={C.gold} opacity={high ? 1 : 0} transform={`translate(130 152) scale(${0.7 + 0.3 * highPop}) translate(-130 -152)`}>
            HIGH
          </text>
        </svg>
        <div style={{ position: "absolute", left: 310, top: 36, right: 30 }}>
          <Label>STRATEGIC RISK</Label>
          <div style={{ fontFamily: SANS, fontSize: 26, color: C.text, marginTop: 14 }}>Trend · Stable</div>
          <svg width={520} height={90} style={{ marginTop: 14, overflow: "visible" }}>
            <path d={sparkPath(TREND, 520, 80, ease(frame, [cue.gauge.from, cue.gauge.to + 10]))} fill="none" stroke={C.gold} strokeWidth={2.5} />
          </svg>
        </div>
      </Panel>
      <Footnote top={1500} opacity={ease(frame, [30, 44])}>
        {cfg.note}
      </Footnote>
    </AbsoluteFill>
  );
};
