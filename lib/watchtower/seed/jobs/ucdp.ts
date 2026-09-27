// UCDP Georeferenced Event Dataset (CC BY 4.0) — historical conflict baseline
// used for Country Instability floors. Since 2025 the API needs a token
// (request by email: https://ucdp.uu.se/apidocs/). Runs daily.
// We aggregate events and deaths per country over the last two years.
import { countryAt } from '../../geo/countries';
import { fetchJson } from '../fetch';
import type { SeedJob } from '../framework';

export interface UcdpSummary {
  version: string;
  since: string;
  byCountry: Record<string, { events: number; deaths: number }>;
  events: number;
}

interface UcdpEvent {
  latitude: number;
  longitude: number;
  best: number;
  date_start: string;
}

export function aggregateUcdp(events: UcdpEvent[], sinceMs: number): UcdpSummary['byCountry'] {
  const out: UcdpSummary['byCountry'] = {};
  for (const e of events) {
    if (Date.parse(e.date_start) < sinceMs) continue;
    const iso = countryAt(Number(e.latitude), Number(e.longitude));
    if (!iso) continue;
    const r = (out[iso] ??= { events: 0, deaths: 0 });
    r.events++;
    r.deaths += Number(e.best) || 0;
  }
  return out;
}

export const ucdpJob: SeedJob<UcdpSummary> = {
  id: 'ucdp',
  feed: 'ucdp',
  tier: 'daily',
  intervalMin: 60 * 20,
  timeoutMs: 55000,
  ttlSec: 30 * 24 * 3600,
  requiresEnv: ['UCDP_ACCESS_TOKEN'],
  async run({ now }) {
    // Candidate (monthly) releases carry the most recent events. Set
    // WT_UCDP_VERSION to the current version listed at https://ucdp.uu.se/apidocs/.
    const version = process.env.WT_UCDP_VERSION || '25.0.1';
    const since = new Date(now - 2 * 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const events: UcdpEvent[] = [];
    let url: string | null = `https://ucdpapi.pcr.uu.se/api/gedevents/${version}?pagesize=1000&StartDate=${since}`;
    for (let page = 0; url && page < 40; page++) {
      const r: { Result: UcdpEvent[]; NextPageUrl?: string } = await fetchJson(url, {
        headers: { 'x-ucdp-access-token': process.env.UCDP_ACCESS_TOKEN! },
        timeoutMs: 20000,
      });
      events.push(...(r.Result ?? []));
      url = r.NextPageUrl || null;
    }
    return { version, since, byCountry: aggregateUcdp(events, Date.parse(since)), events: events.length };
  },
  validate: (d, prev) => {
    if (!d || typeof d.byCountry !== 'object') return { ok: false, count: 0, reason: 'bad shape' };
    if (d.events === 0 && (prev?.events ?? 0) > 0) return { ok: false, count: 0, reason: 'no events returned (check WT_UCDP_VERSION)' };
    return { ok: true, count: d.events };
  },
};
