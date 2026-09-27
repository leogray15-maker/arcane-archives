// Client-side orbit propagation (satellite.js, MIT) from CelesTrak elements.
import type { SatGroup } from '../../../shared/watchtower/types';

type SatLib = typeof import('satellite.js');
let lib: SatLib | null = null;
let loading: Promise<SatLib> | null = null;
const recCache = new Map<string, any>();

export function loadSatLib() {
  return (loading ??= import('satellite.js').then((m) => (lib = m)));
}

export interface SatPos {
  id: string;
  name: string;
  group: string;
  lat: number;
  lng: number;
  altKm: number;
}

export function propagate(groups: SatGroup[], date = new Date()): SatPos[] {
  if (!lib) return [];
  const gmst = lib.gstime(date);
  const out: SatPos[] = [];
  for (const g of groups) {
    for (const [name, l1, l2] of g.tles) {
      const key = l1.slice(2, 7);
      let rec = recCache.get(key + l1.slice(18, 32));
      if (!rec) {
        try {
          rec = lib.twoline2satrec(l1, l2);
        } catch {
          continue;
        }
        recCache.set(key + l1.slice(18, 32), rec);
      }
      const pv = lib.propagate(rec, date);
      const pos = pv && typeof pv.position === 'object' ? pv.position : null;
      if (!pos) continue;
      const geo = lib.eciToGeodetic(pos, gmst);
      const lat = lib.degreesLat(geo.latitude);
      const lng = lib.degreesLong(geo.longitude);
      if (!isFinite(lat) || !isFinite(lng)) continue;
      out.push({ id: `${g.group}:${key}`, name: name.trim(), group: g.label, lat, lng, altKm: geo.height });
    }
  }
  return out;
}

/** Ground track for the next `minutes` (used for a few notable objects). */
export function groundTrack(l1: string, l2: string, minutes = 95, stepMin = 2, from = new Date()): [number, number][] {
  if (!lib) return [];
  const rec = lib.twoline2satrec(l1, l2);
  const pts: [number, number][] = [];
  for (let t = 0; t <= minutes; t += stepMin) {
    const d = new Date(from.getTime() + t * 60000);
    const pv = lib.propagate(rec, d);
    const pos = pv && typeof pv.position === 'object' ? pv.position : null;
    if (!pos) continue;
    const geo = lib.eciToGeodetic(pos, lib.gstime(d));
    pts.push([lib.degreesLat(geo.latitude), lib.degreesLong(geo.longitude)]);
  }
  return pts;
}
