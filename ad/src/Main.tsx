import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { SceneId, VariantId } from "./ad.config";
import { Background, Dust, Grain, TopBar, Vignette } from "./components/Chrome";
import { SceneShell } from "./components/SceneShell";
import { FontGate } from "./fonts";
import { buildTimeline } from "./timeline";
import { Hook } from "./scenes/Hook";
import { Library } from "./scenes/Library";
import { Connection } from "./scenes/Connection";
import { Markets } from "./scenes/Markets";
import { Live } from "./scenes/Live";
import { Rank } from "./scenes/Rank";
import { Founder } from "./scenes/Founder";
import { Cta } from "./scenes/Cta";

const SCENES: Record<SceneId, React.FC> = {
  hook: Hook,
  library: Library,
  connection: Connection,
  markets: Markets,
  live: Live,
  rank: Rank,
  founder: Founder,
  cta: Cta,
};

export const ArcaneAd: React.FC<{ variant: VariantId; withAudio?: boolean }> = ({ variant, withAudio = false }) => {
  const tl = buildTimeline(variant);
  return (
    <FontGate>
      <AbsoluteFill style={{ background: "#07070A", overflow: "hidden" }}>
        <Background />
        {tl.slots.map((slot, i) => {
          const Scene = SCENES[slot.id];
          return (
            <Sequence key={slot.id + i} from={slot.start} durationInFrames={slot.duration} name={slot.id}>
              <SceneShell duration={slot.duration} first={i === 0} last={i === tl.slots.length - 1}>
                <Scene />
              </SceneShell>
            </Sequence>
          );
        })}
        <Dust />
        <Vignette />
        <TopBar slots={tl.slots} />
        <Grain />
        {withAudio && <Audio src={staticFile(`audio/${variant}.wav`)} />}
      </AbsoluteFill>
    </FontGate>
  );
};
