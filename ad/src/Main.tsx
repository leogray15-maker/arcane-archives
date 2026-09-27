import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { AdId, SceneType } from "./ad.config";
import { Background, Dust, Grain, TopBar, Vignette } from "./components/Chrome";
import { SceneShell } from "./components/SceneShell";
import { FontGate } from "./fonts";
import { SceneProvider } from "./SceneContext";
import { adScenes, buildTimeline } from "./timeline";
import { Hook } from "./scenes/Hook";
import { Library } from "./scenes/Library";
import { Connection } from "./scenes/Connection";
import { Markets } from "./scenes/Markets";
import { Live } from "./scenes/Live";
import { Rank } from "./scenes/Rank";
import { Founder } from "./scenes/Founder";
import { Cta } from "./scenes/Cta";
import { GlobeLayers } from "./scenes/GlobeLayers";
import { Instability } from "./scenes/Instability";
import { Intel } from "./scenes/Intel";
import { Ticker } from "./scenes/Ticker";
import { Sessions } from "./scenes/Sessions";
import { Modules } from "./scenes/Modules";
import { Realms } from "./scenes/Realms";
import { Steps } from "./scenes/Steps";
import { Quest } from "./scenes/Quest";
import { Kitchen } from "./scenes/Kitchen";
import { Room } from "./scenes/Room";
import { Referral } from "./scenes/Referral";

const SCENES: Record<SceneType, React.FC> = {
  hook: Hook,
  library: Library,
  connection: Connection,
  markets: Markets,
  live: Live,
  rank: Rank,
  founder: Founder,
  cta: Cta,
  globeLayers: GlobeLayers,
  instability: Instability,
  intel: Intel,
  ticker: Ticker,
  sessions: Sessions,
  modules: Modules,
  realms: Realms,
  steps: Steps,
  quest: Quest,
  kitchen: Kitchen,
  room: Room,
  referral: Referral,
};

export const ArcaneAd: React.FC<{ ad: AdId; withAudio?: boolean }> = ({ ad, withAudio = false }) => {
  const tl = buildTimeline(ad);
  const specs = adScenes(ad);
  return (
    <FontGate>
      <AbsoluteFill style={{ background: "#07070A", overflow: "hidden" }}>
        <Background />
        {tl.slots.map((slot, i) => {
          const Scene = SCENES[slot.type];
          return (
            <Sequence key={i} from={slot.start} durationInFrames={slot.duration} name={`${i + 1} ${slot.type}`}>
              <SceneProvider value={specs[i]}>
                <SceneShell duration={slot.duration} first={i === 0} last={i === tl.slots.length - 1}>
                  <Scene />
                </SceneShell>
              </SceneProvider>
            </Sequence>
          );
        })}
        <Dust />
        <Vignette />
        <TopBar slots={tl.slots} />
        <Grain />
        {withAudio && <Audio src={staticFile(`audio/${ad}.wav`)} />}
      </AbsoluteFill>
    </FontGate>
  );
};
