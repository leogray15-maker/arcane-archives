// NASA FIRMS active fires (VIIRS, near real time). Needs a free MAP_KEY.
// https://firms.modaps.eosdis.nasa.gov/api/ — 5,000 transactions / 10 min.
// We keep high-confidence detections from the past day, attribute them to
// countries, and send the strongest 2,500 to the map.
import type { FirePoint, FireSummary } from '../../../../shared/watchtower/types';
import { countryAt } from '../../geo/countries';
import { fetchText } from '../fetch';
import type { SeedJob } from '../framework';

const MAX_POINTS = 2500;

export function parseFirmsCsv(csv: string, now = Date.now()): FireSummary {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 1 || !/latitude/i.test(lines[0])) throw new Error('unexpected FIRMS response');
  const cols = lines[0].split(',').map((c) => c.trim().toLowerCase());
  const ix = (n: string) => cols.indexOf(n);
  const iLat = ix('latitude'), iLon = ix('longitude'), iConf = ix('confidence'), iFrp = ix('frp'), iDate = ix('acq_date'), iTime = ix('acq_time');
  if ([iLat, iLon, iConf, iFrp, iDate].some((i) => i < 0)) throw new Error('FIRMS CSV missing columns');

  const points: FirePoint[] = [];
  const byCountry: Record<string, number> = {};
  let total = 0;
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    const conf = (c[iConf] || '').trim().toLowerCase();
    // VIIRS confidence is l / n / h; MODIS is 0–100.
    const high = conf === 'h' || conf === 'high' || (/^\d+$/.test(conf) && Number(conf) >= 80);
    if (!high) continue;
    const lat = Number(c[iLat]);
    const lon = Number(c[iLon]);
    const frp = Number(c[iFrp]) || 0;
    if (!isFinite(lat) || !isFinite(lon)) continue;
    const hhmm = (c[iTime] || '0000').padStart(4, '0');
    const t = Date.parse(`${c[iDate]}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00Z`) || now;
    total++;
    points.push([Math.round(lat * 1000) / 1000, Math.round(lon * 1000) / 1000, Math.round(frp * 10) / 10, t]);
  }
  points.sort((a, b) => b[2] - a[2]);
  // Country attribution for all high-confidence detections (cheap bbox + ring test).
  for (const [lat, lon] of points) {
    const iso = countryAt(lat, lon);
    if (iso) byCountry[iso] = (byCountry[iso] ?? 0) + 1;
  }
  return { points: points.slice(0, MAX_POINTS), byCountry, total };
}

export const firmsJob: SeedJob<FireSummary> = {
  id: 'firms',
  feed: 'fires',
  tier: 'slow',
  intervalMin: 60,
  timeoutMs: 50000,
  requiresEnv: ['NASA_FIRMS_MAP_KEY'],
  async run({ now }) {
    const source = process.env.WT_FIRMS_SOURCE || 'VIIRS_SNPP_NRT';
    const csv = await fetchText(`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${process.env.NASA_FIRMS_MAP_KEY}/${source}/world/1`, { timeoutMs: 45000 });
    return parseFirmsCsv(csv, now);
  },
  validate: (d, prev) => {
    if (!d || !Array.isArray(d.points)) return { ok: false, count: 0, reason: 'bad shape' };
    // A global day with zero high-confidence fires means a broken response.
    if (d.total === 0 && (prev?.total ?? 0) > 100) return { ok: false, count: 0, reason: 'no detections (had many)' };
    return { ok: true, count: d.total };
  },
};
