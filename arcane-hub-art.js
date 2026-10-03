// arcane-hub-art.js
// Original, code-drawn artwork for each experience on the dashboard hub.
// Every piece is an SVG composition (no stock imagery): one visual identity
// per experience, drawn at 1600x1000 and cropped to fit any card ("slice").
// Elements with class "a-spin" / "a-pulse" / "a-flow" animate only while
// their card is selected or hovered (see arcane-hub.css).

const W = 1600, H = 1000;
// The Arcane Archives mark (arcane-mark.svg), 92.56 × 100 units
const MARK = 'M45.84 99.61C45.72 99.53 45.24 99.03 44.76 98.52C42.13 95.65 40.92 94.55 38.21 92.52C36.16 90.99 32.24 88.78 29.78 87.78C29.45 87.64 29.03 87.47 28.86 87.39C28.68 87.31 28.28 87.16 27.95 87.05C27.63 86.94 27.19 86.79 26.98 86.71C26.66 86.58 24.96 86.01 23.78 85.63C23.60 85.57 23.41 85.53 23.35 85.53C23.29 85.53 23.08 85.48 22.87 85.42C22.67 85.36 22.34 85.27 22.15 85.21C21.96 85.16 21.66 85.08 21.49 85.03C21.32 84.99 21.04 84.93 20.87 84.90C20.69 84.87 20.41 84.81 20.22 84.77C20.04 84.73 19.75 84.66 19.56 84.61C19.38 84.57 19.05 84.51 18.82 84.48C18.59 84.45 18.28 84.39 18.12 84.35C17.97 84.31 17.69 84.28 17.50 84.28C17.31 84.27 16.98 84.23 16.77 84.17C16.56 84.11 16.23 84.07 16.03 84.07C15.83 84.07 15.51 84.03 15.30 83.99C15.09 83.95 14.38 83.89 13.71 83.86C13.04 83.82 12.15 83.76 11.73 83.72C10.79 83.62 4.87 83.66 3.74 83.78C0.91 84.06 0.77 84.06 0.43 83.89C0.00 83.66 0.04 83.53 1.28 81.32C2.05 79.94 2.49 79.14 2.87 78.40C3.08 78.02 3.59 77.08 4.01 76.32C4.43 75.56 5.04 74.41 5.37 73.78C5.70 73.15 6.26 72.14 6.60 71.53C6.95 70.91 7.42 70.04 7.66 69.58C8.15 68.66 8.43 68.13 8.92 67.25C9.10 66.93 9.43 66.30 9.66 65.86C9.89 65.42 10.24 64.77 10.44 64.41C10.64 64.04 11.21 63.01 11.69 62.11C12.68 60.29 15.26 55.59 15.54 55.08C16.01 54.24 16.13 54.02 16.72 52.94C17.06 52.31 17.69 51.15 18.12 50.37C18.55 49.59 19.04 48.68 19.21 48.36C19.38 48.03 19.81 47.25 20.15 46.62C21.16 44.77 21.70 43.77 22.00 43.22C22.15 42.93 22.39 42.49 22.53 42.24C22.67 41.99 23.00 41.38 23.26 40.89C23.53 40.39 23.87 39.75 24.03 39.46C24.19 39.18 24.50 38.60 24.72 38.18C24.94 37.76 25.24 37.21 25.38 36.96C25.52 36.71 25.76 36.29 25.90 36.02C26.05 35.76 26.36 35.18 26.60 34.74C26.84 34.30 27.19 33.64 27.38 33.28C27.57 32.92 27.82 32.45 27.93 32.24C28.05 32.03 28.54 31.12 29.03 30.22C30.28 27.91 31.09 26.44 31.67 25.39C32.10 24.63 32.84 23.26 33.88 21.33C34.28 20.58 34.88 19.49 35.20 18.92C35.37 18.62 35.61 18.19 35.73 17.96C35.86 17.73 36.29 16.93 36.69 16.19C37.09 15.44 37.56 14.58 37.74 14.28C37.91 13.97 38.26 13.33 38.51 12.85C39.38 11.23 41.31 7.68 41.96 6.51C42.32 5.87 42.61 5.33 42.61 5.32C42.61 5.31 43.04 4.52 43.56 3.57C44.08 2.62 44.61 1.62 44.75 1.36C45.28 0.29 45.62 0.01 46.33 0.00C47.14 0.00 47.17 0.04 49.33 3.96C49.45 4.17 49.93 5.05 50.41 5.91C50.89 6.77 51.46 7.81 51.68 8.23C51.90 8.65 52.10 9.03 52.13 9.07C52.18 9.14 53.38 11.34 53.92 12.37C54.09 12.69 54.59 13.62 55.03 14.42C55.88 15.97 56.14 16.45 57.86 19.62C58.46 20.72 59.04 21.78 59.16 21.97C59.27 22.17 59.49 22.56 59.64 22.85C59.79 23.14 59.98 23.49 60.05 23.62C60.13 23.76 60.39 24.23 60.62 24.67C60.85 25.10 61.34 26.00 61.70 26.65C62.45 27.98 65.76 34.01 66.18 34.81C66.34 35.10 66.56 35.50 66.69 35.71C66.81 35.92 67.12 36.48 67.38 36.96C67.64 37.44 68.23 38.52 68.68 39.36C69.14 40.20 69.71 41.25 69.95 41.69C70.19 42.13 70.45 42.61 70.54 42.76C70.96 43.50 71.37 44.26 71.37 44.29C71.37 44.31 71.45 44.45 71.54 44.59C71.63 44.73 71.85 45.12 72.03 45.46C72.20 45.80 72.53 46.41 72.76 46.82C72.98 47.22 73.38 47.96 73.65 48.46C73.92 48.96 74.77 50.54 75.56 51.97C76.34 53.40 77.16 54.92 77.38 55.34C77.60 55.76 77.82 56.16 77.87 56.24C77.92 56.32 78.29 56.99 78.69 57.74C79.98 60.15 81.31 62.61 81.93 63.75C82.27 64.36 83.14 65.95 83.86 67.29C85.41 70.15 85.77 70.80 85.99 71.18C86.08 71.33 86.27 71.69 86.42 71.98C86.56 72.26 86.74 72.58 86.80 72.67C86.87 72.77 87.16 73.32 87.46 73.89C87.76 74.46 88.16 75.19 88.34 75.51C88.52 75.83 88.67 76.10 88.67 76.12C88.67 76.14 88.83 76.42 89.01 76.76C89.20 77.09 89.62 77.88 89.96 78.51C90.30 79.14 90.76 79.98 90.99 80.38C91.63 81.50 92.56 83.37 92.56 83.54C92.56 83.87 92.12 84.11 91.73 83.99C91.60 83.95 90.85 83.89 90.06 83.85C89.28 83.82 88.25 83.76 87.77 83.73C86.56 83.64 82.39 83.64 81.55 83.72C81.17 83.76 80.26 83.82 79.54 83.86C78.81 83.89 78.09 83.95 77.94 83.99C77.79 84.03 77.43 84.06 77.14 84.06C76.85 84.07 76.43 84.11 76.21 84.17C75.99 84.23 75.68 84.27 75.52 84.27C75.36 84.27 75.05 84.32 74.83 84.38C74.61 84.44 74.29 84.48 74.13 84.48C73.97 84.48 73.73 84.52 73.60 84.56C73.46 84.60 73.20 84.66 73.01 84.69C72.82 84.72 72.51 84.78 72.33 84.82C71.46 85.03 71.33 85.06 71.13 85.09C70.93 85.11 70.77 85.15 69.84 85.42C69.63 85.48 69.41 85.53 69.36 85.53C69.31 85.53 68.95 85.62 68.57 85.74C68.18 85.85 67.69 86.00 67.48 86.06C67.12 86.17 66.47 86.39 65.02 86.91C64.42 87.13 63.55 87.48 62.31 87.99C60.12 88.90 56.57 90.90 55.05 92.07C54.95 92.15 54.53 92.45 54.11 92.76C53.69 93.06 53.22 93.41 53.07 93.53C52.92 93.66 52.63 93.88 52.44 94.04C51.95 94.41 49.83 96.43 49.01 97.30C46.74 99.72 46.35 100.00 45.84 99.61ZM47.48 91.11C49.31 89.26 51.13 87.66 52.61 86.61C52.94 86.38 53.46 86.00 53.76 85.77C54.62 85.13 56.29 84.01 57.18 83.49C58.46 82.74 59.29 82.29 60.50 81.69C61.27 81.32 61.99 80.96 62.10 80.90C62.30 80.79 62.59 80.67 64.25 79.99C65.40 79.52 66.90 78.98 67.59 78.78C67.70 78.75 68.02 78.66 68.28 78.58C69.06 78.34 70.84 77.86 71.37 77.74C71.51 77.71 71.84 77.64 72.10 77.57C73.30 77.29 73.91 77.18 75.33 76.98C75.58 76.94 75.91 76.88 76.06 76.85C76.22 76.81 76.63 76.76 76.97 76.74C77.32 76.72 77.71 76.67 77.84 76.63C77.97 76.59 78.51 76.56 79.03 76.56C80.37 76.56 80.54 76.46 80.17 75.88C80.02 75.65 79.33 74.38 78.22 72.33C76.90 69.89 76.30 68.77 75.77 67.77C75.44 67.16 75.03 66.40 74.85 66.07C74.67 65.75 74.41 65.28 74.28 65.03C73.44 63.46 72.41 61.57 72.11 61.04C71.76 60.43 71.06 59.17 70.61 58.33C70.03 57.25 69.10 55.57 68.83 55.11C68.66 54.84 68.53 54.60 68.53 54.58C68.53 54.48 68.08 53.83 67.97 53.77C67.55 53.55 60.73 57.45 58.81 59.01C58.66 59.13 58.31 59.40 58.03 59.61C57.02 60.38 55.89 61.42 54.83 62.57C53.66 63.83 53.51 64.00 52.72 65.07C52.44 65.45 52.11 65.89 52.00 66.04C51.89 66.19 51.65 66.57 51.47 66.87C51.29 67.18 51.07 67.54 50.98 67.67C50.50 68.41 49.32 70.97 48.94 72.12C48.90 72.21 48.76 72.60 48.62 72.99C48.49 73.37 48.34 73.81 48.31 73.96C48.28 74.11 48.20 74.42 48.13 74.65C48.07 74.88 47.98 75.24 47.93 75.45C47.87 75.66 47.78 76.02 47.72 76.25C47.59 76.72 47.42 77.52 47.34 78.08C47.30 78.28 47.25 78.59 47.21 78.77C47.06 79.47 46.92 80.31 46.92 80.50C46.92 80.99 46.70 81.91 46.53 82.08C46.04 82.61 45.46 82.03 45.46 81.01C45.46 80.84 45.43 80.59 45.39 80.45C45.36 80.32 45.30 79.94 45.26 79.62C45.17 78.88 44.88 77.25 44.76 76.77C44.73 76.64 44.62 76.20 44.52 75.80C44.04 73.84 43.89 73.39 43.17 71.46C42.29 69.10 41.04 66.73 39.88 65.23C39.17 64.30 39.12 64.25 38.57 63.57C37.77 62.57 35.47 60.37 34.25 59.42C32.19 57.82 31.22 57.17 28.61 55.64C27.73 55.12 25.03 53.78 24.87 53.78C24.70 53.78 24.50 54.08 23.78 55.41C23.39 56.13 22.87 57.10 22.62 57.56C22.37 58.02 22.05 58.60 21.92 58.85C21.79 59.10 21.62 59.38 21.56 59.47C21.49 59.57 21.24 60.02 21.00 60.48C20.76 60.94 20.51 61.39 20.45 61.49C20.39 61.58 20.06 62.19 19.72 62.84C19.38 63.49 19.04 64.13 18.96 64.27C18.87 64.40 18.61 64.88 18.36 65.34C18.12 65.80 17.78 66.44 17.60 66.77C17.42 67.09 16.94 67.98 16.53 68.75C16.11 69.51 15.65 70.36 15.49 70.62C15.33 70.89 15.17 71.19 15.13 71.29C15.08 71.38 14.90 71.73 14.72 72.05C13.76 73.73 12.46 76.18 12.46 76.29C12.46 76.49 12.57 76.52 13.53 76.57C14.92 76.66 16.58 76.87 18.12 77.16C18.69 77.26 19.02 77.33 20.07 77.53C20.26 77.57 20.66 77.66 20.97 77.75C21.28 77.83 21.67 77.92 21.86 77.95C22.04 77.99 22.22 78.03 22.26 78.06C22.29 78.08 22.62 78.17 22.97 78.26C23.32 78.35 23.69 78.45 23.78 78.49C23.88 78.53 24.15 78.62 24.37 78.68C24.60 78.75 25.01 78.88 25.28 78.98C25.55 79.07 25.83 79.16 25.90 79.18C26.25 79.27 28.80 80.28 30.07 80.82C30.56 81.03 33.81 82.68 34.31 82.97C36.54 84.28 37.28 84.75 39.30 86.16C41.03 87.38 43.04 89.08 44.79 90.82C45.55 91.58 46.23 92.20 46.29 92.20C46.36 92.20 46.89 91.71 47.48 91.11ZM46.48 63.97C46.56 63.88 46.71 63.66 46.82 63.47C47.82 61.70 49.59 59.38 51.69 57.10C52.89 55.78 53.30 55.40 55.77 53.27C56.17 52.93 56.93 52.35 58.49 51.20C59.64 50.35 62.89 48.33 63.54 48.06C63.91 47.90 64.57 47.47 64.57 47.38C64.57 47.34 64.18 46.59 63.71 45.73C63.23 44.86 62.71 43.90 62.55 43.60C62.39 43.29 62.03 42.64 61.76 42.14C61.48 41.64 60.95 40.67 60.57 39.98C60.20 39.30 59.63 38.27 59.32 37.69C58.18 35.60 57.90 35.08 57.90 35.04C57.90 35.02 57.78 34.80 57.63 34.54C57.32 34.02 56.80 33.07 56.06 31.68C55.78 31.17 55.45 30.56 55.33 30.33C55.20 30.10 55.01 29.74 54.89 29.53C54.52 28.83 54.20 28.26 53.51 27.02C53.14 26.35 52.65 25.46 52.42 25.04C51.60 23.53 51.02 22.49 50.96 22.42C50.93 22.37 50.73 22.03 50.53 21.64C50.33 21.26 49.89 20.45 49.56 19.84C49.23 19.23 48.65 18.16 48.27 17.47C47.89 16.79 47.43 15.94 47.25 15.60C46.78 14.74 46.44 14.24 46.33 14.24C46.19 14.24 46.00 14.54 45.22 15.98C44.83 16.69 44.23 17.77 43.89 18.38C43.54 18.99 43.17 19.65 43.07 19.84C42.55 20.77 42.06 21.64 41.67 22.34C41.44 22.76 41.08 23.41 40.87 23.80C40.67 24.18 40.43 24.62 40.33 24.77C40.24 24.92 39.77 25.76 39.29 26.64C38.82 27.52 38.39 28.29 38.34 28.35C38.29 28.40 38.08 28.80 37.85 29.22C37.63 29.64 37.40 30.06 37.33 30.15C37.27 30.25 36.99 30.77 36.71 31.30C36.43 31.84 36.17 32.31 36.13 32.36C36.10 32.41 35.90 32.75 35.70 33.12C35.31 33.87 33.97 36.30 33.22 37.64C32.96 38.11 32.55 38.86 32.32 39.31C32.08 39.76 31.82 40.23 31.74 40.37C31.66 40.50 31.42 40.92 31.22 41.30C31.02 41.69 30.71 42.27 30.53 42.59C29.51 44.42 29.34 44.72 29.34 44.76C29.34 44.78 29.10 45.23 28.81 45.76C27.77 47.64 27.77 47.43 28.74 47.90C29.09 48.07 29.58 48.33 29.83 48.48C30.08 48.63 30.79 49.05 31.41 49.42C32.58 50.12 33.93 51.04 35.13 51.96C35.51 52.25 35.91 52.56 36.02 52.64C36.34 52.87 37.29 53.69 38.18 54.50C38.65 54.93 39.24 55.46 39.51 55.69C40.12 56.21 40.90 57.04 41.78 58.08C42.14 58.52 42.57 59.01 42.72 59.19C42.88 59.36 43.11 59.65 43.24 59.83C43.37 60.00 43.61 60.31 43.77 60.52C44.46 61.40 45.34 62.67 45.74 63.36C46.21 64.18 46.26 64.22 46.48 63.97Z';

function rng(seed) {
  let s = 0;
  for (const c of seed) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const f = n => Math.round(n * 10) / 10;

function base(id, top, glow, gx, gy, glow2) {
  return `
  <defs>
    <linearGradient id="${id}-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="#07070A"/>
    </linearGradient>
    <radialGradient id="${id}-glow" cx="${gx / W}" cy="${gy / H}" r="0.55">
      <stop offset="0" stop-color="${glow}" stop-opacity="0.42"/>
      <stop offset="0.45" stop-color="${glow}" stop-opacity="0.1"/>
      <stop offset="1" stop-color="${glow}" stop-opacity="0"/>
    </radialGradient>
    ${glow2 ? `<radialGradient id="${id}-glow2" cx="${glow2[1] / W}" cy="${glow2[2] / H}" r="0.3">
      <stop offset="0" stop-color="${glow2[0]}" stop-opacity="0.32"/><stop offset="1" stop-color="${glow2[0]}" stop-opacity="0"/>
    </radialGradient>` : ''}
    <filter id="${id}-bloom" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#${id}-bg)"/>
  <rect width="${W}" height="${H}" fill="url(#${id}-glow)"/>
  ${glow2 ? `<rect width="${W}" height="${H}" fill="url(#${id}-glow2)"/>` : ''}`;
}

function grid(step, color, op) {
  let d = '';
  for (let x = 0; x <= W; x += step) d += `M${x} 0V${H}`;
  for (let y = 0; y <= H; y += step) d += `M0 ${y}H${W}`;
  return `<path d="${d}" stroke="${color}" stroke-opacity="${op}" stroke-width="1" fill="none"/>`;
}

function dust(r, n, color, x0 = 0, x1 = W, y0 = 0, y1 = H) {
  let s = '';
  for (let i = 0; i < n; i++) {
    s += `<circle cx="${f(x0 + r() * (x1 - x0))}" cy="${f(y0 + r() * (y1 - y0))}" r="${f(0.6 + r() * 1.8)}" fill="${color}" opacity="${f(0.08 + r() * 0.4)}"/>`;
  }
  return s;
}

/* ── THE VAULT: a monumental archway, the Arcane mark and a knowledge map ── */
function vault(id) {
  const r = rng('vault'), cx = 1080, floor = 640, gold = '#E9C46A', violet = '#9B7BF7';
  let floorLines = '';
  for (let x = -800; x <= W + 800; x += 110) floorLines += `M${cx} ${floor}L${x} ${H}`;
  for (let k = 1; k < 8; k++) { const y = floor + (H - floor) * Math.pow(k / 8, 1.8); floorLines += `M0 ${f(y)}H${W}`; }
  let arches = '';
  for (let i = 0; i < 6; i++) {
    const w = 210 + i * 150, h = 330 + i * 95, rr = w / 2;
    arches += `<path d="M${cx - rr} ${floor}V${floor - h + rr}A${rr} ${rr} 0 0 1 ${cx + rr} ${floor - h + rr}V${floor}" fill="none" stroke="${i ? gold : violet}" stroke-opacity="${f(0.5 - i * 0.075)}" stroke-width="${i ? 1.2 : 2}"/>`;
  }
  const nodes = [[640, 260], [760, 170], [900, 300], [1290, 190], [1420, 300], [1360, 470], [700, 470], [1500, 140]];
  let links = '', dots = '';
  nodes.forEach(([x, y], i) => {
    const [x2, y2] = nodes[(i + 3) % nodes.length];
    links += `M${x} ${y}L${x2} ${y2}`;
    dots += `<circle class="a-pulse" style="animation-delay:${f(i * 0.4)}s" cx="${x}" cy="${y}" r="${3 + (i % 3)}" fill="${gold}" opacity="0.8"/>`;
  });
  const s = 2.7, sx = cx - 46.28 * s, sy = 335 - 50 * s;
  return base(id, '#1A1230', violet, cx, 360, [gold, cx, 420]) + `
  <path d="${floorLines}" stroke="${gold}" stroke-opacity="0.07" fill="none"/>
  <g>${arches}</g>
  <rect x="${cx - 105}" y="${floor - 330}" width="210" height="330" fill="#07070A" opacity="0.55"/>
  <g transform="translate(${f(sx)} ${f(sy)}) scale(${s})" filter="url(#${id}-bloom)">
    <path d="${MARK}" fill="${gold}" fill-opacity="0.92" fill-rule="evenodd"/>
  </g>
  <path class="a-flow" d="${links}" stroke="${gold}" stroke-opacity="0.22" stroke-dasharray="4 8" fill="none"/>
  <g filter="url(#${id}-bloom)">${dots}</g>
  ${dust(r, 70, gold, 300, W, 0, floor)}`;
}

/* ── WAR ROOM: command radar, tactical grid and contour lines ── */
function warRoom(id) {
  const r = rng('war'), cx = 1100, cy = 470, red = '#F0553F', amber = '#F59E0B';
  let rings = '', ticks = '', contours = '', blips = '';
  for (let i = 1; i <= 5; i++) rings += `<circle cx="${cx}" cy="${cy}" r="${i * 84}" fill="none" stroke="${red}" stroke-opacity="${f(0.36 - i * 0.04)}"/>`;
  for (let a = 0; a < 360; a += 5) {
    const rad = a * Math.PI / 180, r1 = 430, r2 = a % 30 ? 440 : 456;
    ticks += `M${f(cx + Math.cos(rad) * r1)} ${f(cy + Math.sin(rad) * r1)}L${f(cx + Math.cos(rad) * r2)} ${f(cy + Math.sin(rad) * r2)}`;
  }
  for (let k = 0; k < 7; k++) {
    let d = `M0 ${120 + k * 130}`;
    for (let x = 0; x <= W; x += 80) d += `L${x} ${f(120 + k * 130 + Math.sin(x / 190 + k) * 38 + Math.cos(x / 70 + k * 2) * 10)}`;
    contours += `<path d="${d}" fill="none" stroke="${amber}" stroke-opacity="0.06"/>`;
  }
  [[1240, 330], [960, 600], [1330, 560], [880, 360], [1180, 700]].forEach(([x, y], i) => {
    blips += `<circle cx="${x}" cy="${y}" r="5" fill="${i % 2 ? amber : red}"/><circle class="a-pulse" style="animation-delay:${i * 0.6}s" cx="${x}" cy="${y}" r="14" fill="none" stroke="${i % 2 ? amber : red}" stroke-opacity="0.6"/>`;
  });
  return base(id, '#22100E', red, cx, cy, [amber, 1400, 200]) + `
  ${grid(50, '#ffffff', 0.025)}
  ${contours}
  ${rings}
  <path d="${ticks}" stroke="${red}" stroke-opacity="0.45"/>
  <path d="M${cx - 470} ${cy}H${cx + 470}M${cx} ${cy - 470}V${cy + 470}" stroke="${red}" stroke-opacity="0.25" stroke-dasharray="2 6"/>
  <defs><linearGradient id="${id}-sw" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${red}" stop-opacity="0"/><stop offset="1" stop-color="${red}" stop-opacity="0.5"/></linearGradient></defs>
  <g class="a-spin" style="transform-origin:${cx}px ${cy}px">
    <path d="M${cx} ${cy}L${cx + 420} ${cy}A420 420 0 0 0 ${f(cx + 420 * Math.cos(-0.7))} ${f(cy + 420 * Math.sin(-0.7))}Z" fill="url(#${id}-sw)" opacity="0.55"/>
    <path d="M${cx} ${cy}L${cx + 420} ${cy}" stroke="${red}" stroke-width="2" filter="url(#${id}-bloom)"/>
  </g>
  <circle cx="${cx}" cy="${cy}" r="9" fill="${red}" filter="url(#${id}-bloom)"/>
  ${blips}
  ${dust(r, 40, amber)}`;
}

/* ── TRADING FLOOR: candles, moving average and volume ── */
function tradingFloor(id) {
  const r = rng('floor'), green = '#4ADE80', red = '#F87171';
  const n = 46, x0 = 420, x1 = 1560, step = (x1 - x0) / n;
  let p = 640, candles = '', vol = '', ma = [], pts = [];
  for (let i = 0; i < n; i++) {
    const o = p, c = o - (r() - 0.42) * 46, hi = Math.min(o, c) - r() * 26, lo = Math.max(o, c) + r() * 26;
    p = c; pts.push(c);
    const up = c < o, x = x0 + i * step, col = up ? green : red;
    candles += `<path d="M${f(x + step / 2)} ${f(hi)}V${f(lo)}" stroke="${col}" stroke-opacity="0.7"/><rect x="${f(x + step * 0.18)}" y="${f(Math.min(o, c))}" width="${f(step * 0.64)}" height="${f(Math.max(3, Math.abs(c - o)))}" fill="${col}" opacity="${up ? 0.9 : 0.75}" rx="1.5"/>`;
    const vh = 20 + r() * 80;
    vol += `<rect x="${f(x + step * 0.18)}" y="${f(940 - vh)}" width="${f(step * 0.64)}" height="${f(vh)}" fill="${col}" opacity="0.28"/>`;
  }
  for (let i = 0; i < n; i++) {
    const w = pts.slice(Math.max(0, i - 6), i + 1); ma.push([x0 + i * step + step / 2, w.reduce((a, b) => a + b, 0) / w.length]);
  }
  const line = ma.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join('');
  let levels = '';
  for (let y = 180; y < 860; y += 85) levels += `M0 ${y}H${W}`;
  return base(id, '#0B1A12', green, 1150, 380, ['#F2C94C', 1500, 160]) + `
  <path d="${levels}" stroke="#ffffff" stroke-opacity="0.045"/>
  <defs><linearGradient id="${id}-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${green}" stop-opacity="0.25"/><stop offset="1" stop-color="${green}" stop-opacity="0"/></linearGradient></defs>
  <path d="${line}L${f(ma[n - 1][0])} 940L${f(ma[0][0])} 940Z" fill="url(#${id}-area)"/>
  ${vol}${candles}
  <path class="a-flow" d="${line}" fill="none" stroke="#F2C94C" stroke-width="2.5" stroke-dasharray="1400" filter="url(#${id}-bloom)"/>
  <path d="M0 ${f(pts[n - 1])}H${W}" stroke="${green}" stroke-opacity="0.5" stroke-dasharray="6 6"/>
  <circle class="a-pulse" cx="${f(ma[n - 1][0])}" cy="${f(pts[n - 1])}" r="7" fill="${green}" filter="url(#${id}-bloom)"/>`;
}

/* ── WATCHTOWER: wireframe globe, orbits and flashpoints ── */
function watchtower(id) {
  const r = rng('watch'), cx = 1100, cy = 580, R = 360, cyan = '#22D3EE', blue = '#60A5FA';
  let mer = '', lat = '', flash = '', arcs = '';
  for (let i = 1; i < 9; i++) mer += `<ellipse cx="${cx}" cy="${cy}" rx="${f(R * Math.abs(Math.cos(i * Math.PI / 9)))}" ry="${R}" fill="none" stroke="${cyan}" stroke-opacity="0.16"/>`;
  for (let i = -3; i <= 3; i++) { const y = cy + i * R / 4, w = Math.sqrt(R * R - (i * R / 4) ** 2); lat += `M${f(cx - w)} ${f(y)}H${f(cx + w)}`; }
  const pts = [[980, 470], [1210, 430], [1290, 610], [1050, 690], [930, 600], [1150, 540]];
  pts.forEach(([x, y], i) => {
    const c = i % 3 === 0 ? '#F59E0B' : cyan;
    flash += `<circle cx="${x}" cy="${y}" r="5" fill="${c}"/><circle class="a-pulse" style="animation-delay:${f(i * 0.5)}s" cx="${x}" cy="${y}" r="16" fill="none" stroke="${c}" stroke-opacity="0.55"/>`;
    const [x2, y2] = pts[(i + 2) % pts.length];
    arcs += `M${x} ${y}Q${f((x + x2) / 2)} ${f(Math.min(y, y2) - 140)} ${x2} ${y2}`;
  });
  return base(id, '#071822', cyan, cx, cy - 60, [blue, 400, 200]) + `
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="#07131B" stroke="${cyan}" stroke-opacity="0.35"/>
  ${mer}<path d="${lat}" stroke="${cyan}" stroke-opacity="0.14"/>
  <path class="a-flow" d="${arcs}" fill="none" stroke="${cyan}" stroke-opacity="0.5" stroke-dasharray="5 7"/>
  ${flash}
  <g transform="translate(${cx} ${cy}) rotate(-16) scale(1 0.3)">
    <circle r="520" fill="none" stroke="${blue}" stroke-opacity="0.3"/>
    <g class="a-spin"><circle cx="520" cy="0" r="9" fill="${blue}" filter="url(#${id}-bloom)"/></g>
  </g>
  <g transform="translate(${cx} ${cy}) rotate(24) scale(1 0.22)">
    <circle r="610" fill="none" stroke="${cyan}" stroke-opacity="0.2" stroke-dasharray="3 9"/>
    <g class="a-spin a-slow"><circle cx="-610" cy="0" r="7" fill="${cyan}" filter="url(#${id}-bloom)"/></g>
  </g>
  ${dust(r, 90, '#BFEFFF', 0, W, 0, 520)}`;
}

/* ── STOCK PICKS: a long equity curve with entry and target levels ── */
function stockPicks(id) {
  const r = rng('picks'), green = '#4ADE80', gold = '#F2C94C';
  let d = '', pts = [];
  for (let i = 0; i <= 60; i++) {
    const x = 380 + i * 20, t = i / 60;
    const y = 820 - Math.pow(t, 1.7) * 560 + Math.sin(i * 0.9) * 14 + (r() - 0.5) * 18;
    pts.push([x, y]); d += `${i ? 'L' : 'M'}${f(x)} ${f(y)}`;
  }
  const last = pts[pts.length - 1];
  let cols = '';
  for (let i = 0; i < 26; i++) { const h = 30 + r() * 120; cols += `<rect x="${380 + i * 46}" y="${f(960 - h)}" width="30" height="${f(h)}" fill="${gold}" opacity="${f(0.06 + r() * 0.1)}"/>`; }
  return base(id, '#0C1710', green, 1250, 340, [gold, 500, 820]) + `
  ${grid(80, '#ffffff', 0.03)}
  ${cols}
  <defs><linearGradient id="${id}-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${green}" stop-opacity="0.32"/><stop offset="1" stop-color="${green}" stop-opacity="0"/></linearGradient></defs>
  <path d="${d}L${f(last[0])} 960L380 960Z" fill="url(#${id}-a)"/>
  <path d="M0 640H${W}" stroke="${gold}" stroke-opacity="0.45" stroke-dasharray="8 8"/>
  <path d="M0 300H${W}" stroke="${green}" stroke-opacity="0.45" stroke-dasharray="8 8"/>
  <text x="400" y="628" font-family="JetBrains Mono, monospace" font-size="18" letter-spacing="4" fill="${gold}" opacity="0.7">ENTRY</text>
  <text x="400" y="288" font-family="JetBrains Mono, monospace" font-size="18" letter-spacing="4" fill="${green}" opacity="0.7">TARGET</text>
  <path class="a-flow" d="${d}" fill="none" stroke="${green}" stroke-width="3" stroke-dasharray="1600" filter="url(#${id}-bloom)"/>
  <circle class="a-pulse" cx="${f(last[0])}" cy="${f(last[1])}" r="8" fill="${green}" filter="url(#${id}-bloom)"/>`;
}

/* ── LIVE CALLS: a broadcast pulse, a waveform and the circle of members ── */
function liveCalls(id) {
  const r = rng('calls'), cx = 1100, cy = 480, cyan = '#67E8F9', violet = '#9B7BF7';
  let rings = '', wave = '', seats = '', spokes = '';
  for (let i = 0; i < 4; i++) rings += `<circle class="a-ripple" style="animation-delay:${i}s" cx="${cx}" cy="${cy}" r="60" fill="none" stroke="${cyan}" stroke-opacity="0.5"/>`;
  for (let i = 0; i < 90; i++) {
    const x = 160 + i * 16, h = 8 + Math.abs(Math.sin(i * 0.33) * Math.cos(i * 0.11)) * 120 * (0.5 + r());
    wave += `<rect x="${x}" y="${f(cy + 330 - h / 2)}" width="7" height="${f(h)}" rx="3.5" fill="url(#${id}-w)" opacity="0.55"/>`;
  }
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 - Math.PI / 2, x = cx + Math.cos(a) * 250, y = cy + Math.sin(a) * 200;
    spokes += `M${cx} ${cy}L${f(x)} ${f(y)}`;
    seats += `<circle cx="${f(x)}" cy="${f(y)}" r="22" fill="#0E0C1A" stroke="${i % 2 ? violet : cyan}" stroke-opacity="0.7"/><circle cx="${f(x)}" cy="${f(y - 5)}" r="7" fill="${i % 2 ? violet : cyan}" opacity="0.5"/><path d="M${f(x - 11)} ${f(y + 12)}Q${f(x)} ${f(y - 2)} ${f(x + 11)} ${f(y + 12)}" fill="${i % 2 ? violet : cyan}" opacity="0.5"/>`;
  }
  return base(id, '#0F0D22', violet, cx, cy, [cyan, 1350, 700]) + `
  <defs><linearGradient id="${id}-w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${violet}"/><stop offset="1" stop-color="${cyan}"/></linearGradient></defs>
  ${wave}
  <path class="a-flow" d="${spokes}" stroke="${cyan}" stroke-opacity="0.3" stroke-dasharray="4 8"/>
  ${rings}
  <circle cx="${cx}" cy="${cy}" r="44" fill="#0E0C1A" stroke="${cyan}" stroke-width="2" filter="url(#${id}-bloom)"/>
  <circle class="a-pulse" cx="${cx}" cy="${cy}" r="12" fill="#F87171"/>
  ${seats}
  ${dust(r, 50, cyan)}`;
}

/* ── Secondary experiences: simpler, still distinct ── */
function dailyInsight(id) {
  const r = rng('insight'), cx = 1050, cy = 640, gold = '#F2C94C';
  let rays = '';
  for (let i = 0; i < 24; i++) { const a = Math.PI + i / 23 * Math.PI; rays += `M${f(cx + Math.cos(a) * 200)} ${f(cy + Math.sin(a) * 200)}L${f(cx + Math.cos(a) * (520 + (i % 2) * 120))} ${f(cy + Math.sin(a) * (520 + (i % 2) * 120))}`; }
  return base(id, '#1C1426', gold, cx, cy, ['#9B7BF7', 400, 200]) + `
  <path class="a-flow" d="${rays}" stroke="${gold}" stroke-opacity="0.18" stroke-dasharray="6 10"/>
  <path d="M${cx - 190} ${cy}A190 190 0 0 1 ${cx + 190} ${cy}Z" fill="${gold}" opacity="0.85" filter="url(#${id}-bloom)"/>
  <path d="M0 ${cy}H${W}" stroke="${gold}" stroke-opacity="0.5"/>
  <path d="M0 ${cy + 40}H${W}M0 ${cy + 100}H${W}M0 ${cy + 190}H${W}" stroke="${gold}" stroke-opacity="0.08"/>
  <g transform="translate(${cx + 330} 230) scale(5)" fill="#fff" class="a-pulse"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></g>
  ${dust(r, 60, '#FFE9B0', 0, W, 0, cy)}`;
}

function signals(id) {
  const cx = 1100, cy = 620, violet = '#9B7BF7', cyan = '#67E8F9';
  let arcs = '';
  for (let i = 1; i <= 6; i++) arcs += `<path class="a-pulse" style="animation-delay:${f(i * 0.25)}s" d="M${cx - i * 75} ${cy}A${i * 75} ${i * 75} 0 0 1 ${cx + i * 75} ${cy}" fill="none" stroke="${i % 2 ? violet : cyan}" stroke-opacity="${f(0.7 - i * 0.08)}" stroke-width="3"/>`;
  let ecg = 'M0 820';
  for (let x = 0; x <= W; x += 40) ecg += x % 400 === 200 ? `L${x - 10} 820L${x} 700L${x + 10} 900L${x + 20} 820` : `L${x} 820`;
  return base(id, '#120F24', violet, cx, cy, [cyan, 300, 300]) + `
  ${grid(64, '#ffffff', 0.03)}${arcs}
  <circle cx="${cx}" cy="${cy}" r="16" fill="${cyan}" filter="url(#${id}-bloom)"/>
  <path class="a-flow" d="${ecg}" fill="none" stroke="${cyan}" stroke-opacity="0.6" stroke-width="2.5" stroke-dasharray="2400"/>`;
}

function bullion(id) {
  const gold = '#F2C94C', bar = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">
    <polygon points="0,60 180,60 220,0 40,0" fill="#F7DB85"/><polygon points="0,60 180,60 180,120 0,120" fill="#D9A93A"/><polygon points="180,60 220,0 220,60 180,120" fill="#A97E22"/></g>`;
  return base(id, '#1E170B', gold, 1100, 520) + `
  ${grid(80, gold, 0.035)}
  <g filter="url(#${id}-bloom)" opacity="0.92">
    ${bar(860, 600, 1.6)}${bar(1210, 600, 1.6)}${bar(1040, 470, 1.6)}
  </g>
  <path d="M0 800H${W}" stroke="${gold}" stroke-opacity="0.3"/>`;
}

function liveStreams(id) {
  const red = '#F87171', violet = '#9B7BF7', cx = 1100, cy = 480;
  let scan = '';
  for (let y = 0; y < H; y += 8) scan += `M0 ${y}H${W}`;
  return base(id, '#1A0D18', red, cx, cy, [violet, 300, 800]) + `
  <rect x="${cx - 330}" y="${cy - 200}" width="660" height="400" rx="20" fill="#0B0A10" stroke="${violet}" stroke-opacity="0.5"/>
  <path d="M${cx - 50} ${cy - 75}L${cx + 85} ${cy}L${cx - 50} ${cy + 75}Z" fill="#fff" opacity="0.9" filter="url(#${id}-bloom)"/>
  <circle class="a-pulse" cx="${cx - 280}" cy="${cy - 155}" r="11" fill="${red}"/>
  <text x="${cx - 258}" y="${cy - 148}" font-family="JetBrains Mono, monospace" font-size="20" letter-spacing="4" fill="${red}">REC</text>
  <path d="${scan}" stroke="#fff" stroke-opacity="0.025"/>`;
}

function referrals(id) {
  const r = rng('ref'), violet = '#9B7BF7', gold = '#F2C94C', cx = 1100, cy = 500;
  let net = '', nodes = '';
  const pts = [];
  for (let i = 0; i < 14; i++) { const a = r() * Math.PI * 2, d = 120 + r() * 340; pts.push([cx + Math.cos(a) * d * 1.3, cy + Math.sin(a) * d * 0.8]); }
  pts.forEach(([x, y], i) => { net += `M${cx} ${cy}L${f(x)} ${f(y)}`; nodes += `<circle cx="${f(x)}" cy="${f(y)}" r="${8 + (i % 3) * 3}" fill="${i % 4 ? violet : gold}" opacity="0.8"/>`; });
  return base(id, '#140F26', violet, cx, cy) + `
  <path class="a-flow" d="${net}" stroke="${violet}" stroke-opacity="0.35" stroke-dasharray="4 8"/>
  ${nodes}<circle cx="${cx}" cy="${cy}" r="24" fill="${gold}" filter="url(#${id}-bloom)"/>`;
}

function store(id) {
  const gold = '#F2C94C', violet = '#9B7BF7';
  return base(id, '#16101F', violet, 1100, 500, [gold, 1150, 650]) + `
  <rect x="840" y="330" width="240" height="320" rx="10" fill="#1A1724" stroke="${violet}" stroke-opacity="0.6" transform="rotate(-8 960 490)"/>
  <rect x="860" y="350" width="10" height="280" fill="${gold}" opacity="0.6" transform="rotate(-8 960 490)"/>
  <path d="M1130 600Q1230 420 1330 600Z" fill="#1A1724" stroke="${gold}" stroke-opacity="0.7"/>
  <path d="M1110 600H1400" stroke="${gold}" stroke-opacity="0.7" stroke-width="6" stroke-linecap="round"/>
  <g transform="translate(1207 498) scale(0.5)" opacity="0.9"><path d="${MARK}" fill="${gold}" fill-rule="evenodd"/></g>
  <path d="M0 700H${W}" stroke="#fff" stroke-opacity="0.08"/>`;
}

function settings(id) {
  const violet = '#9B7BF7', cx = 1100, cy = 500;
  let teeth = '';
  for (let i = 0; i < 12; i++) teeth += `<rect x="${cx - 18}" y="${cy - 210}" width="36" height="50" rx="6" fill="${violet}" opacity="0.5" transform="rotate(${i * 30} ${cx} ${cy})"/>`;
  return base(id, '#121020', violet, cx, cy) + `
  <g class="a-spin a-slow" style="transform-origin:${cx}px ${cy}px">${teeth}<circle cx="${cx}" cy="${cy}" r="170" fill="none" stroke="${violet}" stroke-width="20" stroke-opacity="0.5"/></g>
  <circle cx="${cx}" cy="${cy}" r="60" fill="none" stroke="#C9B8FF" stroke-width="3"/>`;
}

function retreat(id) {
  const gold = '#F2C94C', blue = '#60A5FA';
  const ridge = (y, amp, seed, op) => { const r = rng(seed); let d = `M0 ${H}L0 ${y}`; for (let x = 0; x <= W; x += 80) d += `L${x} ${f(y - r() * amp)}`; return `<path d="${d}L${W} ${H}Z" fill="#0B0A10" opacity="${op}" stroke="${gold}" stroke-opacity="0.25"/>`; };
  return base(id, '#0E1424', blue, 1150, 300, [gold, 1150, 330]) + `
  <circle cx="1150" cy="330" r="70" fill="${gold}" opacity="0.8" filter="url(#${id}-bloom)"/>
  ${ridge(620, 260, 'm1', 0.6)}${ridge(740, 200, 'm2', 0.8)}${ridge(860, 120, 'm3', 1)}`;
}

const ART = {
  'courses': vault, 'war-room': warRoom, 'trading-floor': tradingFloor, 'watchtower': watchtower,
  'stock-picks': stockPicks, 'live-calls': liveCalls, 'arcane-insights': dailyInsight, 'free-signals': signals,
  'bullion': bullion, 'live-streams': liveStreams, 'referrals': referrals, 'arcane-store': store,
  'settings': settings, 'retreat': retreat,
};

let seq = 0;
/** Returns an <svg> string for an experience key; ids are unique per call. */
export function art(key) {
  const draw = ART[key] || settings;
  const id = `aa${(seq++).toString(36)}`;
  return `<svg class="art" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${draw(id)}</svg>`;
}
