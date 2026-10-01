// arcane-hub-art.js
// Original, code-drawn artwork for each experience on the dashboard hub.
// Every piece is an SVG composition (no stock imagery): one visual identity
// per experience, drawn at 1600x1000 and cropped to fit any card ("slice").
// Elements with class "a-spin" / "a-pulse" / "a-flow" animate only while
// their card is selected or hovered (see arcane-hub.css).

const W = 1600, H = 1000;

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

/* ── THE VAULT: a monumental archway, the Arcane sigil and a knowledge map ── */
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
  const s = 15, sx = cx - 12 * s, sy = 330 - 11 * s;
  return base(id, '#1A1230', violet, cx, 360, [gold, cx, 420]) + `
  <path d="${floorLines}" stroke="${gold}" stroke-opacity="0.07" fill="none"/>
  <g>${arches}</g>
  <rect x="${cx - 105}" y="${floor - 330}" width="210" height="330" fill="#07070A" opacity="0.55"/>
  <g transform="translate(${sx} ${sy}) scale(${s})" fill="none" stroke="${gold}" stroke-width="${f(1.4 / s)}" filter="url(#${id}-bloom)">
    <path d="M12 2 3 20l9-5 9 5z"/><path d="M12 8l-4 8 4-2 4 2z" stroke="${violet}"/>
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
  <g transform="translate(1180 470) scale(4)" fill="none" stroke="${gold}" stroke-width="0.6" opacity="0.8"><path d="M12 2 3 20l9-5 9 5z"/></g>
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
