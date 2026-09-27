import React from "react";
import { Composition } from "remotion";
import { config, VariantId } from "./ad.config";
import { ArcaneAd } from "./Main";
import { buildTimeline } from "./timeline";

export const Root: React.FC = () => (
  <>
    {(Object.keys(config.variants) as VariantId[]).map((v) => (
      <Composition
        key={v}
        id={v}
        component={ArcaneAd}
        durationInFrames={buildTimeline(v).totalFrames}
        fps={config.fps}
        width={config.width}
        height={config.height}
        defaultProps={{ variant: v, withAudio: false }}
      />
    ))}
  </>
);
