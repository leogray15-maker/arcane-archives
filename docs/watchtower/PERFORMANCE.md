# Watchtower performance report

Measured on 2026-09-25 with Lighthouse 12 (mobile preset: simulated 4G, 4× CPU
slowdown) against a production build served locally with fixture data. Run
`npm run build`, then follow the "Performance check" steps in RUNBOOK.md to
repeat it.

| Metric | Result | Target |
|---|---|---|
| First Contentful Paint | 1.6 s | — |
| Largest Contentful Paint (first meaningful paint) | 2.5 s | < 2.5 s ✅ (borderline) |
| Speed Index | 2.6 s | — |
| Total Blocking Time | 650 ms (was 1,720 ms before deferring the map) | < 600 ms (not quite) |
| Cumulative Layout Shift | 0 | < 0.1 ✅ |
| Lighthouse Performance | 80 | — |
| Lighthouse Accessibility | 100 | — |
| Lighthouse Best Practices | 93 (console errors come from fonts blocked in the test sandbox; no source maps) | — |

## What loads when

| Chunk | Size (gzip) | When |
|---|---|---|
| App shell, panels, state (`index-*.js`) | ~42 KB | Immediately |
| Firebase Auth | ~37 KB + ~10 KB | Immediately (auth gate) |
| Country shapes (`countries-110m`) | ~40 KB | When the map or search needs them |
| Globe (globe.gl + Three.js) | ~554 KB | When the browser is idle after first paint |
| 2D map (MapLibre + deck.gl) | ~469 KB + ~52 KB | Only when the user switches to 2D |
| satellite.js | ~11 KB | Only when the Satellites layer is on |
| Globe texture | 320 KB (2K); 1.2 MB (4K) | 2K with the globe; 4K only on high-DPI screens after idle |
| Live news / webcams | 0 until play | YouTube loads only when the user presses play |

## Remaining headroom

- The Three.js parse is the main source of blocking time. Options: a slimmer
  custom Three build, or showing a static globe image until first interaction on
  low-end phones.
- Fonts come from Google Fonts. Self-hosting them would save one connection.
