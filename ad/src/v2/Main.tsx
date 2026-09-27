import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { spr } from "../anim";
import { FontGate } from "../fonts";
import { V2Type, v2Ad } from "./config";
import { punchFrames, segStarts } from "./timeline";
import { Backdrop, RiskLine, SegCtx } from "./ui";
import { Counter, Cta, Hook, Payoff, RankFlip, Statement } from "./scenes/text";
import { ListItem } from "./scenes/list";
import { Dashboard, GlobeScene, Step, VaultScroll, WarRoom } from "./scenes/product";
import { Chart, Checklist, Dial, Watchlist } from "./scenes/trading";

const SCENES: Record<V2Type, React.FC> = {
  hook: Hook,
  statement: Statement,
  listItem: ListItem,
  payoff: Payoff,
  cta: Cta,
  dashboard: Dashboard,
  globe: GlobeScene,
  vaultScroll: VaultScroll,
  step: Step,
  rankFlip: RankFlip,
  counter: Counter,
  dial: Dial,
  chart: Chart,
  watchlist: Watchlist,
  checklist: Checklist,
  warroom: WarRoom,
};

/** Hard cut on the downbeat, then a quick settle so the cut hits with the kick. */
const Settle: React.FC<{ children: React.ReactNode; first: boolean }> = ({ children, first }) => {
  const frame = useCurrentFrame();
  const p = first ? 1 : spr(frame, 0, 15, 300);
  return <AbsoluteFill style={{ transform: `scale(${1.05 - 0.05 * p})`, opacity: first ? 1 : Math.min(1, 0.4 + p) }}>{children}</AbsoluteFill>;
};

export const V2Ad: React.FC<{ ad: string; withAudio?: boolean }> = ({ ad, withAudio = false }) => {
  const spec = v2Ad(ad);
  const segs = segStarts(spec);
  const punches = punchFrames(spec);
  return (
    <FontGate>
      <AbsoluteFill style={{ background: "#0A0A0F", overflow: "hidden" }}>
        <Backdrop />
        {segs.map((s, i) => {
          const Scene = SCENES[s.seg.type];
          const last = i === segs.length - 1;
          const firstOfType = i === 0 || segs[i - 1].seg.type !== s.seg.type;
          return (
            <Sequence key={i} from={s.start} durationInFrames={s.duration + (last ? 30 : 0)} name={`${i + 1} ${s.seg.type}`}>
              <SegCtx.Provider value={{ seg: s.seg, start: s.start, duration: s.duration, punches, index: i, firstOfType }}>
                <Settle first={i === 0}>
                  <Scene />
                  {s.seg.risk && <RiskLine />}
                </Settle>
              </SegCtx.Provider>
            </Sequence>
          );
        })}
        {withAudio && <Audio src={staticFile(`audio/${ad}.wav`)} />}
      </AbsoluteFill>
    </FontGate>
  );
};
