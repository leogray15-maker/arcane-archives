// Geographic convergence: bins the last 24h of located events into 1°×1° cells.
// A cell with 3+ distinct event types raises an alert.
//   score = min(100, types × 25 + min(25, events × 2))
// Priority: 4+ types or score ≥ 90 → critical, otherwise high.
import type { Chokepoint, ConvergenceCell, Hotspot } from '../../../shared/watchtower/types';
import { countryAt, iso3Name } from '../geo/countries';
import { haversineKm } from './util';

export interface LocatedEvent {
  type: string;
  lat: number;
  lon: number;
  time: number;
}

export const CONVERGENCE = { windowMs: 24 * 3600000, minTypes: 3, labelRadiusKm: 350 };

export function convergenceScore(types: number, events: number) {
  return Math.min(100, types * 25 + Math.min(25, events * 2));
}

export function findConvergence(
  events: LocatedEvent[],
  now: number,
  places: { hotspots: Hotspot[]; chokepoints: Chokepoint[] },
): ConvergenceCell[] {
  const cells = new Map<string, { lat: number; lon: number; types: Set<string>; n: number }>();
  for (const e of events) {
    if (now - e.time > CONVERGENCE.windowMs) continue;
    const la = Math.floor(e.lat);
    const lo = Math.floor(e.lon);
    const k = `${la}:${lo}`;
    const c = cells.get(k) ?? { lat: la, lon: lo, types: new Set<string>(), n: 0 };
    c.types.add(e.type);
    c.n++;
    cells.set(k, c);
  }
  const out: ConvergenceCell[] = [];
  for (const [id, c] of cells) {
    if (c.types.size < CONVERGENCE.minTypes) continue;
    const score = convergenceScore(c.types.size, c.n);
    const lat = c.lat + 0.5;
    const lon = c.lon + 0.5;
    out.push({
      id,
      lat,
      lon,
      types: [...c.types].sort(),
      events: c.n,
      score,
      priority: c.types.size >= 4 || score >= 90 ? 'critical' : 'high',
      label: labelFor(lat, lon, places),
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Nearest hotspot or chokepoint within 350 km, else the country, else coordinates. */
export function labelFor(lat: number, lon: number, places: { hotspots: Hotspot[]; chokepoints: Chokepoint[] }) {
  let best: { name: string; d: number } | null = null;
  for (const p of [...places.chokepoints, ...places.hotspots]) {
    const d = haversineKm(lat, lon, p.lat, p.lon);
    if (d <= CONVERGENCE.labelRadiusKm && (!best || d < best.d)) best = { name: p.name, d };
  }
  if (best) return best.name;
  const iso = countryAt(lat, lon);
  if (iso) return iso3Name(iso);
  return `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
}
