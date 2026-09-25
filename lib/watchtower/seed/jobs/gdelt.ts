// GDELT 2.0 — free for commercial use with citation (https://www.gdeltproject.org/about.html).
//  • Events: the 15-minute event export files, filtered to geolocated conflict,
//    coercion, force-posture and protest events (CAMEO root codes), kept 24h.
//  • Tone: DOC API average tone timeline → header sentiment.
import { unzipSync, strFromU8 } from 'fflate';
import type { ConflictEvent } from '../../../../shared/watchtower/types';
import { countryAt } from '../../geo/countries';
import { fetchJson, fetchRaw, fetchText, UpstreamError } from '../fetch';
import { isCoord, type SeedJob } from '../framework';

// GDELT 2.0 event export column positions (codebook order).
const C = { id: 0, isRoot: 25, eventCode: 26, rootCode: 28, quad: 29, goldstein: 30, mentions: 31, sources: 32, tone: 34, geoType: 51, geoName: 52, lat: 56, lon: 57, added: 59, url: 60 };

const ROOT_KIND: Record<string, ConflictEvent['kind']> = {
  '14': 'protest', // Protest
  '15': 'military', // Exhibit force posture
  '17': 'coercion', // Coerce
  '18': 'violence', // Assault
  '19': 'military', // Fight (conventional force)
  '20': 'violence', // Unconventional mass violence
};

const MIN_MENTIONS: Record<ConflictEvent['kind'], number> = { protest: 4, military: 3, coercion: 5, violence: 3 };
const WINDOW_MS = 24 * 3600 * 1000;
const MAX_EVENTS = 3000;

function parseAdded(s: string): number {
  // YYYYMMDDHHMMSS (UTC)
  if (!/^\d{14}$/.test(s)) return NaN;
  return Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12), +s.slice(12, 14));
}

export function parseGdeltEvents(tsv: string): ConflictEvent[] {
  const out: ConflictEvent[] = [];
  for (const line of tsv.split('\n')) {
    if (!line) continue;
    const c = line.split('\t');
    if (c.length < 61) continue;
    const kind = ROOT_KIND[c[C.rootCode]];
    if (!kind || c[C.isRoot] !== '1') continue;
    const geoType = Number(c[C.geoType]);
    if (geoType === 1 || geoType === 0) continue; // country-level centroids are too coarse to map
    const mentions = Number(c[C.mentions]) || 0;
    if (mentions < MIN_MENTIONS[kind]) continue;
    const lat = Number(c[C.lat]);
    const lon = Number(c[C.lon]);
    if (!isCoord(lat, lon) || (lat === 0 && lon === 0)) continue;
    const time = parseAdded(c[C.added]);
    out.push({
      id: c[C.id],
      lat,
      lon,
      time: isFinite(time) ? time : Date.now(),
      kind,
      country: null,
      mentions,
      tone: Math.round((Number(c[C.tone]) || 0) * 10) / 10,
      goldstein: Number(c[C.goldstein]) || 0,
      url: c[C.url] || '',
      place: (c[C.geoName] || '').split(',').slice(0, 2).join(','),
    });
  }
  return out;
}

/** Merge a new batch into the rolling 24h window, de-duplicating the same
 *  kind of event reported at the same place within an hour. */
export function mergeWindow(prev: ConflictEvent[], batch: ConflictEvent[], now: number): ConflictEvent[] {
  const keep = new Map<string, ConflictEvent>();
  for (const e of [...prev, ...batch]) {
    if (now - e.time > WINDOW_MS) continue;
    const k = `${e.kind}|${e.lat.toFixed(2)}|${e.lon.toFixed(2)}|${Math.floor(e.time / 3600000)}`;
    const cur = keep.get(k);
    if (!cur || e.mentions > cur.mentions) keep.set(k, { ...e, mentions: Math.max(e.mentions, cur?.mentions ?? 0) });
  }
  return [...keep.values()]
    .map((e) => (e.country ? e : { ...e, country: countryAt(e.lat, e.lon) }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, MAX_EVENTS)
    .sort((a, b) => b.time - a.time);
}

const fileStamp = (t: number) => {
  const d = new Date(Math.floor(t / 900000) * 900000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}00`;
};

async function fetchExport(url: string): Promise<ConflictEvent[]> {
  const res = await fetchRaw(url, { timeoutMs: 30000 });
  if (res.status === 404) return [];
  if (!res.ok) throw new UpstreamError(`gdelt: HTTP ${res.status}`, res.status);
  const zip = unzipSync(new Uint8Array(await res.arrayBuffer()));
  const name = Object.keys(zip)[0];
  return name ? parseGdeltEvents(strFromU8(zip[name])) : [];
}

export const gdeltEventsJob: SeedJob<ConflictEvent[]> = {
  id: 'gdelt-events',
  feed: 'conflict',
  tier: 'medium',
  intervalMin: 15,
  timeoutMs: 55000,
  async run({ store, now }, prev) {
    const last = await fetchText('http://data.gdeltproject.org/gdeltv2/lastupdate.txt', { timeoutMs: 10000 });
    const latest = last.split('\n').map((l) => l.trim().split(' ')[2]).find((u) => u?.endsWith('.export.CSV.zip'));
    if (!latest) throw new Error('gdelt: no export in lastupdate.txt');
    const latestStamp = latest.match(/(\d{14})\.export/)?.[1];
    // Catch up on up to 3 files missed since the last successful run.
    const seen = (await store.get<string>('wt:gdelt:lastfile')) ?? '';
    const urls = [latest];
    if (latestStamp && seen && seen < latestStamp) {
      const latestT = parseAdded(latestStamp);
      for (let k = 1; k <= 3; k++) {
        const s = fileStamp(latestT - k * 900000);
        if (s <= seen) break;
        urls.push(`http://data.gdeltproject.org/gdeltv2/${s}.export.CSV.zip`);
      }
    }
    const batches = await Promise.all(urls.map(fetchExport));
    if (latestStamp) await store.set('wt:gdelt:lastfile', latestStamp, { ex: 3 * 24 * 3600 });
    return mergeWindow(prev ?? [], batches.flat(), now);
  },
  validate: (d) => {
    if (!Array.isArray(d)) return { ok: false, count: 0, reason: 'bad shape' };
    return { ok: true, count: d.length };
  },
};

/* ── Tone ─────────────────────────────────────────────────────── */

export interface ToneSummary {
  avg24: number | null;
  prev24: number | null;
  points: [number, number][];
}

export function summariseTone(timeline: { date: string; value: number }[], now: number): ToneSummary {
  const pts: [number, number][] = timeline
    .map((p) => {
      const m = p.date.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
      return [m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : Date.parse(p.date), p.value] as [number, number];
    })
    .filter(([t, v]) => isFinite(t) && isFinite(v));
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const day = 24 * 3600 * 1000;
  return {
    avg24: avg(pts.filter(([t]) => now - t <= day).map(([, v]) => v)),
    prev24: avg(pts.filter(([t]) => now - t > day && now - t <= 2 * day).map(([, v]) => v)),
    points: pts.slice(-96),
  };
}

export const gdeltToneJob: SeedJob<ToneSummary> = {
  id: 'gdelt-tone',
  feed: 'tone',
  tier: 'slow',
  intervalMin: 60,
  async run({ now }) {
    const q = encodeURIComponent('(government OR military OR election OR economy OR conflict OR protest) sourcelang:english');
    const r = await fetchJson<{ timeline?: { series: string; data: { date: string; value: number }[] }[] }>(
      `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=timelinetone&timespan=2d&format=json`,
      { timeoutMs: 20000 },
    );
    return summariseTone(r.timeline?.[0]?.data ?? [], now);
  },
  validate: (d) => (d.avg24 === null ? { ok: false, count: 0, reason: 'no tone points in last 24h' } : { ok: true, count: d.points.length }),
};
