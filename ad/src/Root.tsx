import React from "react";
import { Composition } from "remotion";
import { AdId, config } from "./ad.config";
import { ArcaneAd } from "./Main";
import { buildTimeline } from "./timeline";
import { V2Ad } from "./v2/Main";
import { V2_ADS } from "./v2/config";
import { totalFrames } from "./v2/timeline";

export const Root: React.FC = () => (
  <>
    {(Object.keys(config.ads) as AdId[]).map((ad) => (
      <Composition
        key={ad}
        id={ad}
        component={ArcaneAd}
        durationInFrames={buildTimeline(ad).totalFrames}
        fps={config.fps}
        width={config.width}
        height={config.height}
        defaultProps={{ ad, withAudio: false }}
      />
    ))}
    {V2_ADS.map((a) => (
      <Composition
        key={a.id}
        id={a.id}
        component={V2Ad}
        durationInFrames={totalFrames(a)}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ ad: a.id, withAudio: false }}
      />
    ))}
  </>
);
