// USGS earthquakes: all M4.5+ in the past day, plus "significant" events of the past week.
// Source: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php (public domain).
import type { Quake } from '../../../../shared/watchtower/types';
import { fetchJson } from '../fetch';
import { isCoord, validateList, type SeedJob } from '../framework';

const BASE = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/';

interface UsgsFeature {
  id: string;
  properties: { mag: number | null; place: string | null; time: number; url: string; tsunami: number; alert: string | null; sig: number; type: string; title?: string };
  geometry: { coordinates: [number, number, number] };
}

export function normaliseUsgs(features: UsgsFeature[], significantIds: Set<string>): Quake[] {
  const out: Quake[] = [];
  for (const f of features) {
    const p = f.properties;
    const [lon, lat, depth] = f.geometry?.coordinates ?? [];
    if (!p || p.mag === null || !isCoord(lat, lon) || p.type !== 'earthquake') continue;
    out.push({
      id: f.id,
      mag: Math.round(p.mag * 10) / 10,
      place: p.place || p.title || 'Unknown location',
      time: p.time,
      lat,
      lon,
      depthKm: Math.round(depth ?? 0),
      url: p.url,
      tsunami: p.tsunami === 1,
      alert: p.alert,
      significant: significantIds.has(f.id),
    });
  }
  return out;
}

export const usgsJob: SeedJob<Quake[]> = {
  id: 'usgs',
  feed: 'seismic',
  tier: 'fast',
  intervalMin: 5,
  async run() {
    const [day, sig] = await Promise.all([
      fetchJson<{ features: UsgsFeature[] }>(`${BASE}4.5_day.geojson`),
      fetchJson<{ features: UsgsFeature[] }>(`${BASE}significant_week.geojson`),
    ]);
    const sigIds = new Set((sig.features ?? []).map((f) => f.id));
    const byId = new Map<string, UsgsFeature>();
    for (const f of [...(day.features ?? []), ...(sig.features ?? [])]) byId.set(f.id, f);
    return normaliseUsgs([...byId.values()], sigIds).sort((a, b) => b.time - a.time);
  },
  validate: (d, prev) => validateList(d, prev, { min: 1, check: (q) => isCoord(q.lat, q.lon) && typeof q.mag === 'number' }),
};
