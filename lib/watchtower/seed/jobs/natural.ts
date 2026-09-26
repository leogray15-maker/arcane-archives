// NASA EONET v3 open natural events, and GDACS orange/red disaster alerts.
// EONET: https://eonet.gsfc.nasa.gov/docs/v3 (NASA, no copyright; credit requested)
// GDACS: https://www.gdacs.org (CC BY 4.0, credit GDACS; poll every 10–15 min)
import type { NaturalEvent } from '../../../../shared/watchtower/types';
import { countryAt } from '../../geo/countries';
import { fetchJson, fetchRaw, UpstreamError } from '../fetch';
import { isCoord, validateList, type SeedJob } from '../framework';

interface EonetEvent {
  id: string;
  title: string;
  link?: string;
  categories: { id: string; title: string }[];
  sources?: { id: string; url: string }[];
  geometry: { date: string; type: 'Point' | 'Polygon'; coordinates: any }[];
}

export function normaliseEonet(events: EonetEvent[]): NaturalEvent[] {
  const out: NaturalEvent[] = [];
  for (const e of events) {
    const g = [...(e.geometry ?? [])].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
    if (!g) continue;
    let lon: number, lat: number;
    if (g.type === 'Point') [lon, lat] = g.coordinates;
    else {
      const ring: [number, number][] = g.coordinates?.[0] ?? [];
      if (!ring.length) continue;
      lon = ring.reduce((a, p) => a + p[0], 0) / ring.length;
      lat = ring.reduce((a, p) => a + p[1], 0) / ring.length;
    }
    if (!isCoord(lat, lon)) continue;
    out.push({
      id: e.id,
      title: e.title,
      category: e.categories?.[0]?.title ?? 'Event',
      source: 'EONET',
      lat,
      lon,
      time: Date.parse(g.date) || Date.now(),
      url: e.sources?.[0]?.url || e.link || 'https://eonet.gsfc.nasa.gov/',
      country: countryAt(lat, lon) ?? undefined,
    });
  }
  return out.sort((a, b) => b.time - a.time);
}

export const eonetJob: SeedJob<NaturalEvent[]> = {
  id: 'eonet',
  feed: 'natural',
  tier: 'medium',
  intervalMin: 30,
  async run() {
    const r = await fetchJson<{ events: EonetEvent[] }>('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=20&limit=400');
    return normaliseEonet(r.events ?? []);
  },
  validate: (d, prev) => validateList(d, prev, { min: 1, maxDropRatio: 0.85, check: (e) => isCoord(e.lat, e.lon) }),
};

const GDACS_TYPES: Record<string, string> = { EQ: 'Earthquake', TC: 'Tropical cyclone', FL: 'Flood', VO: 'Volcano', DR: 'Drought', WF: 'Wildfire', TS: 'Tsunami' };

interface GdacsFeature {
  geometry: { type: string; coordinates: [number, number] };
  properties: {
    eventtype: string;
    eventid: number;
    episodeid?: number;
    name?: string;
    htmldescription?: string;
    alertlevel: string;
    country?: string;
    iso3?: string;
    fromdate?: string;
    todate?: string;
    datemodified?: string;
    url?: { report?: string; details?: string };
    severitydata?: { severitytext?: string };
  };
}

export function normaliseGdacs(features: GdacsFeature[]): NaturalEvent[] {
  const byId = new Map<string, NaturalEvent>();
  for (const f of features) {
    const p = f.properties;
    if (!p || f.geometry?.type !== 'Point') continue;
    const [lon, lat] = f.geometry.coordinates;
    if (!isCoord(lat, lon)) continue;
    const type = GDACS_TYPES[p.eventtype] ?? p.eventtype;
    const id = `${p.eventtype}${p.eventid}`;
    const time = Date.parse(p.datemodified || p.todate || p.fromdate || '') || Date.now();
    const title = p.name ? `${type}: ${p.name.replace(/^(Earthquake|Tropical Cyclone|Flood|Volcano|Drought|Forest fires?) (in |- )?/i, '')}` : `${type} alert`;
    const ev: NaturalEvent = {
      id,
      title: [title, p.severitydata?.severitytext].filter(Boolean).join(' — '),
      category: type,
      source: 'GDACS',
      lat,
      lon,
      time,
      url: p.url?.report || `https://www.gdacs.org/report.aspx?eventtype=${p.eventtype}&eventid=${p.eventid}`,
      alertLevel: p.alertlevel,
      country: p.iso3 && /^[A-Z]{3}$/.test(p.iso3) ? p.iso3 : countryAt(lat, lon) ?? undefined,
    };
    const prev = byId.get(id);
    if (!prev || prev.time < ev.time) byId.set(id, ev); // keep the latest episode
  }
  return [...byId.values()].sort((a, b) => b.time - a.time);
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export const gdacsJob: SeedJob<NaturalEvent[]> = {
  id: 'gdacs',
  feed: 'disasters',
  tier: 'medium',
  intervalMin: 15,
  async run({ now }) {
    const to = new Date(now);
    const from = new Date(now - 10 * 24 * 3600 * 1000);
    const url = `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ;TC;FL;VO;DR;WF&alertlevel=Orange;Red&fromDate=${ymd(from)}&toDate=${ymd(to)}`;
    // GDACS answers 204/404 when the search has no matching events.
    const res = await fetchRaw(url, { timeoutMs: 20000 });
    if (res.status === 204 || res.status === 404) return [];
    if (!res.ok) throw new UpstreamError(`gdacs: HTTP ${res.status}`, res.status);
    const r = (await res.json()) as { features?: GdacsFeature[] };
    return normaliseGdacs(r.features ?? []);
  },
  // Zero orange/red alerts is a legitimate state, so an empty list is allowed.
  validate: (d, prev) => validateList(d, prev, { min: 0, check: (e) => isCoord(e.lat, e.lon) }),
};
