import "@fontsource/playfair-display/600.css";
import "@fontsource/playfair-display/600-italic.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/800.css";
import "@fontsource/inter/900.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import React, { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";

export const SERIF = "'Playfair Display', Georgia, serif";
export const SANS = "Inter, system-ui, sans-serif";
export const MONO = "'JetBrains Mono', ui-monospace, monospace";

// Block rendering until every face is ready, so no frame renders with a fallback font.
const handle = delayRender("fonts");
export const fontsReady = Promise.all(
  [
    "600 40px 'Playfair Display'",
    "italic 600 40px 'Playfair Display'",
    "700 40px 'Playfair Display'",
    "400 40px Inter",
    "500 40px Inter",
    "600 40px Inter",
    "800 40px Inter",
    "900 40px Inter",
    "400 40px 'JetBrains Mono'",
    "500 40px 'JetBrains Mono'",
  ].map((f) => document.fonts.load(f)),
).then(() => continueRender(handle));

/** Renders children only once fonts are loaded, so text measurement uses real metrics. */
export const FontGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    fontsReady.then(() => setReady(true));
  }, []);
  return ready ? React.createElement(React.Fragment, null, children) : null;
};
