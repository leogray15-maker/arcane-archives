// Procedural night-sky background (our own work — no third-party imagery).
export function starfieldDataUrl(w = 4096, h = 2048, seed = 7): string {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d')!;
  x.fillStyle = '#05040a';
  x.fillRect(0, 0, w, h);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  // faint violet haze band
  const g = x.createLinearGradient(0, h * 0.3, w, h * 0.7);
  g.addColorStop(0, 'rgba(139,124,246,0)');
  g.addColorStop(0.5, 'rgba(139,124,246,0.05)');
  g.addColorStop(1, 'rgba(139,124,246,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  for (let i = 0; i < 5200; i++) {
    const r = rnd() < 0.97 ? rnd() * 0.5 + 0.25 : rnd() * 0.7 + 0.6;
    const a = 0.2 + rnd() * 0.6;
    const tint = rnd() < 0.12 ? '196,181,253' : '255,255,255';
    x.fillStyle = `rgba(${tint},${a.toFixed(2)})`;
    x.beginPath();
    x.arc(rnd() * w, rnd() * h, r, 0, Math.PI * 2);
    x.fill();
  }
  return c.toDataURL('image/png');
}
