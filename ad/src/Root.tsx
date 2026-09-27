import React from "react";
import { Composition } from "remotion";
import { AdId, config } from "./ad.config";
import { ArcaneAd } from "./Main";
import { buildTimeline } from "./timeline";

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
  </>
);
