import { createContext, useContext, useMemo } from "react";
import type { SceneSpec, SceneType } from "./ad.config";
import { CuesOf, sceneCues } from "./timeline";

const Ctx = createContext<SceneSpec | null>(null);
export const SceneProvider = Ctx.Provider;

/** The current scene's spec from ad.config.ts. */
export const useSpec = <K extends SceneType>() => {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSpec outside a scene");
  return s as SceneSpec<K>;
};

/** The current scene's animation beats (the same numbers the audio uses). */
export const useCues = <K extends SceneType>() => {
  const s = useSpec<K>();
  return useMemo(() => sceneCues(s), [s]) as CuesOf<K>;
};
