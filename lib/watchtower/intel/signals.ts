// Signal aggregator: normalises every live event stream into one Signal shape,
// then clusters by country and region. Feeds the Signals panel, CII,
// chokepoints, posture and the AI prompts.
import type {
  Aircraft, Anomaly, ConflictEvent, ConvergenceCell, FireSummary, KeywordSpike, NaturalEvent, Quake, Severity, Signal, SignalBucket, SignalSet,
} from '../../../shared/watchtower/types';
import { regionOf } from '../config/geo-areas';
import { countryAt, iso3Name } from '../geo/countries';
import { maxSev, SEV_RANK } from './util';

export interface SignalInputs {
  quakes: Quake[];
  natural: NaturalEvent[];
  disasters: NaturalEvent[];
  fires: FireSummary | null;
  conflict: ConflictEvent[];
  aircraft: Aircraft[];
  spikes: KeywordSpike[];
  convergence: ConvergenceCell[];
  anomalies: Anomaly[];
  now: number;
}

const DAY = 24 * 3600000;
const up = (s: Severity): Severity => (['low', 'med', 'high', 'critical'] as Severity[])[Math.min(3, SEV_RANK[s] + 1)];

export function quakeSeverity(q: Quake): Severity {
  let s: Severity = q.mag >= 7 ? 'critical' : q.mag >= 6 ? 'high' : q.mag >= 5.5 ? 'med' : 'low';
  if (q.tsunami || q.alert === 'red' || q.alert === 'orange') s = up(s);
  return s;
}

export function buildSignals(inp: SignalInputs): Signal[] {
  const out: Signal[] = [];
  const add = (s: Omit<Signal, 'region'> & { region?: string | null }) => out.push({ ...s, region: s.region ?? regionOf(s.lat, s.lon) });

  for (const q of inp.quakes) {
    if (inp.now - q.time > DAY && !q.significant) continue;
    if (q.mag < 5 && !q.significant) continue;
    add({
      id: `eq:${q.id}`, type: 'seismic', severity: quakeSeverity(q), lat: q.lat, lon: q.lon, country: countryAt(q.lat, q.lon), time: q.time,
      title: `M${q.mag.toFixed(1)} earthquake — ${q.place}`, source: 'USGS', url: q.url,
      evidence: [`Depth ${q.depthKm} km`, q.tsunami ? 'Tsunami flag set' : '', q.alert ? `PAGER ${q.alert}` : ''].filter(Boolean),
    });
  }

  for (const e of inp.disasters) {
    const sev: Severity = e.alertLevel === 'Red' ? 'critical' : 'high';
    add({ id: `gd:${e.id}`, type: 'natural', severity: sev, lat: e.lat, lon: e.lon, country: e.country ?? null, time: e.time, title: `GDACS ${e.alertLevel?.toLowerCase()} alert: ${e.title}`, source: 'GDACS', url: e.url, evidence: [e.category] });
  }
  for (const e of inp.natural) {
    if (inp.now - e.time > 3 * DAY) continue;
    const sev: Severity = /storm|cyclone|hurricane|typhoon|volcan/i.test(e.category) ? 'med' : 'low';
    add({ id: `eo:${e.id}`, type: 'natural', severity: sev, lat: e.lat, lon: e.lon, country: e.country ?? null, time: e.time, title: e.title, source: 'NASA EONET', url: e.url, evidence: [e.category] });
  }

  if (inp.fires) {
    // One signal per country with notable fire activity, placed at the mean of its detections.
    const sums = new Map<string, { lat: number; lon: number; n: number; t: number }>();
    for (const [lat, lon, , t] of inp.fires.points) {
      const iso = countryAt(lat, lon);
      if (!iso) continue;
      const s = sums.get(iso) ?? { lat: 0, lon: 0, n: 0, t: 0 };
      s.lat += lat;
      s.lon += lon;
      s.n++;
      s.t = Math.max(s.t, t);
      sums.set(iso, s);
    }
    for (const [iso, n] of Object.entries(inp.fires.byCountry)) {
      if (n < 50) continue;
      const s = sums.get(iso);
      if (!s) continue;
      add({
        id: `fr:${iso}`, type: 'wildfire', severity: n >= 500 ? 'high' : n >= 150 ? 'med' : 'low', lat: s.lat / s.n, lon: s.lon / s.n, country: iso, time: s.t,
        title: `${n.toLocaleString('en-GB')} high-confidence fire detections in ${iso3Name(iso)} (24h)`, source: 'NASA FIRMS', evidence: ['VIIRS NRT'],
      });
    }
  }

  // Conflict: individually notable events, plus per-country roll-ups of the rest.
  const perCountry = new Map<string, { n: number; mentions: number; kinds: Set<string>; lat: number; lon: number; t: number }>();
  for (const e of inp.conflict) {
    const notable = e.mentions >= 20 || (e.kind === 'violence' && e.mentions >= 10);
    if (notable) {
      const sev: Severity = e.mentions >= 40 ? 'high' : 'med';
      add({
        id: `cf:${e.id}`, type: e.kind === 'protest' ? 'protest' : 'conflict', severity: sev, lat: e.lat, lon: e.lon, country: e.country, time: e.time,
        title: `${e.kind === 'protest' ? 'Protest' : e.kind === 'violence' ? 'Violence' : e.kind === 'military' ? 'Military action' : 'Coercion'} reported — ${e.place}`,
        source: 'GDELT', url: e.url, evidence: [`${e.mentions} mentions`, `tone ${e.tone}`],
      });
    } else if (e.country) {
      const c = perCountry.get(e.country) ?? { n: 0, mentions: 0, kinds: new Set<string>(), lat: 0, lon: 0, t: 0 };
      c.n++;
      c.mentions += e.mentions;
      c.kinds.add(e.kind);
      c.lat += e.lat;
      c.lon += e.lon;
      c.t = Math.max(c.t, e.time);
      perCountry.set(e.country, c);
    }
  }
  for (const [iso, c] of perCountry) {
    if (c.n < 4) continue;
    add({
      id: `cfc:${iso}`, type: c.kinds.has('protest') && c.kinds.size === 1 ? 'protest' : 'conflict', severity: c.n >= 25 ? 'high' : c.n >= 10 ? 'med' : 'low',
      lat: c.lat / c.n, lon: c.lon / c.n, country: iso, time: c.t, title: `${c.n} conflict/protest events in ${iso3Name(iso)} (24h)`, source: 'GDELT',
      evidence: [`Kinds: ${[...c.kinds].join(', ')}`, `${c.mentions} total mentions`],
    });
  }

  // Military air: 5° cells with 4+ aircraft.
  const air = new Map<string, Aircraft[]>();
  for (const a of inp.aircraft) {
    const k = `${Math.floor(a.lat / 5)}:${Math.floor(a.lon / 5)}`;
    (air.get(k) ?? air.set(k, []).get(k)!).push(a);
  }
  for (const [k, list] of air) {
    if (list.length < 4) continue;
    const lat = list.reduce((s, a) => s + a.lat, 0) / list.length;
    const lon = list.reduce((s, a) => s + a.lon, 0) / list.length;
    const iso = countryAt(lat, lon);
    add({
      id: `air:${k}`, type: 'military_air', severity: list.length >= 15 ? 'high' : list.length >= 8 ? 'med' : 'low', lat, lon, country: iso, time: Math.max(...list.map((a) => a.seenAt)),
      title: `${list.length} military aircraft over ${iso ? iso3Name(iso) : regionOf(lat, lon) ?? 'open water'}`, source: 'adsb.lol',
      evidence: list.slice(0, 6).map((a) => a.callsign || a.type || a.hex),
    });
  }

  for (const s of inp.spikes) {
    add({
      id: `sp:${s.term}`, type: 'news_spike', severity: s.ratio >= 6 || s.count2h >= 15 ? 'high' : 'med', lat: 0, lon: 0, country: null, region: null, time: s.firedAt,
      title: `Keyword spike: “${s.term}” — ${s.count2h} mentions across ${s.sources.length} sources in 2h`, source: 'Arcane news monitor', evidence: s.sources,
    });
  }

  for (const c of inp.convergence) {
    add({
      id: `cv:${c.id}`, type: 'convergence', severity: c.priority === 'critical' ? 'critical' : 'high', lat: c.lat, lon: c.lon, country: countryAt(c.lat, c.lon), time: inp.now,
      title: `${c.types.length} event types converge in one 1° cell near ${c.label}`, source: 'Arcane convergence engine', evidence: c.types,
    });
  }

  for (const a of inp.anomalies) {
    if (a.severity === 'low') continue;
    add({
      id: `an:${a.key}`, type: 'anomaly', severity: a.severity, lat: 0, lon: 0, country: null, region: a.region, time: inp.now,
      title: `${a.type} in ${a.region} ${a.z.toFixed(1)}σ above its usual level for this weekday`, source: 'Arcane baselines', evidence: [`${a.value} vs mean ${a.mean.toFixed(1)}`, `${a.samples} samples`],
    });
  }

  return out.sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.time - a.time).slice(0, 400);
}

export function clusterSignals(items: Signal[]): SignalSet {
  const byCountry: Record<string, SignalBucket> = {};
  const byRegion: Record<string, SignalBucket> = {};
  const bump = (m: Record<string, SignalBucket>, k: string | null, s: Signal) => {
    if (!k) return;
    const b = (m[k] ??= { count: 0, max: 'low', types: [] });
    b.count++;
    b.max = maxSev(b.max, s.severity);
    if (!b.types.includes(s.type)) b.types.push(s.type);
  };
  for (const s of items) {
    bump(byCountry, s.country, s);
    bump(byRegion, s.region, s);
  }
  return { items, byCountry, byRegion };
}
