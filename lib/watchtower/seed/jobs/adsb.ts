// Military aircraft from adsb.lol (open data, ODbL 1.0 — attribution required).
// Uses adsb.lol's own military-flagged endpoint rather than a curated hex list.
import type { Aircraft } from '../../../../shared/watchtower/types';
import { fetchJson } from '../fetch';
import { isCoord, validateList, type SeedJob } from '../framework';

interface AdsbAc {
  hex: string;
  flight?: string;
  r?: string;
  t?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | 'ground';
  gs?: number;
  track?: number;
  seen?: number;
  seen_pos?: number;
}

export function normaliseAdsb(ac: AdsbAc[], now: number): Aircraft[] {
  const out: Aircraft[] = [];
  for (const a of ac) {
    if (!isCoord(a.lat, a.lon)) continue;
    const age = a.seen_pos ?? a.seen ?? 0;
    if (age > 300) continue; // stale position
    out.push({
      hex: a.hex,
      callsign: (a.flight || '').trim(),
      type: a.t || '',
      reg: a.r || '',
      lat: a.lat!,
      lon: a.lon!,
      altFt: typeof a.alt_baro === 'number' ? a.alt_baro : a.alt_baro === 'ground' ? 0 : null,
      speedKt: typeof a.gs === 'number' ? Math.round(a.gs) : null,
      track: typeof a.track === 'number' ? Math.round(a.track) : null,
      seenAt: now - Math.round(age * 1000),
    });
  }
  return out;
}

export const adsbJob: SeedJob<Aircraft[]> = {
  id: 'adsb',
  feed: 'aircraft',
  tier: 'fast',
  intervalMin: 5,
  async run({ now }) {
    const r = await fetchJson<{ ac?: AdsbAc[] }>('https://api.adsb.lol/v2/mil', { timeoutMs: 15000 });
    return normaliseAdsb(r.ac ?? [], now);
  },
  validate: (d, prev) => validateList(d, prev, { min: 1, maxDropRatio: 0.9 }),
};
