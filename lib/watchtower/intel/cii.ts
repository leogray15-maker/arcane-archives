// Country Instability Index (0–100). Our implementation of the published
// concept; weights and baselines live in config/cii.ts, method in METHODOLOGY.md.
//   event    = Unrest×0.25 + Conflict×0.30 + Security×0.20 + Information×0.25
//   combined = baseline×0.40 + event×0.60 + capped boosts
//   score    = max(combined, floor), clamped 0–100
import type { Aircraft, CiiScore, ConflictEvent, FireSummary, KeywordSpike, NaturalEvent, NewsItem, Quake } from '../../../shared/watchtower/types';
import { band, CII_COUNTRIES, CII_WEIGHTS, type CiiCountry } from '../config/cii';
import { countryAt } from '../geo/countries';
import { geotag } from '../text/geotag';
import { hasWord, KEYWORD_GROUPS } from '../text/lexicon';
import type { UcdpSummary } from '../seed/jobs/ucdp';
import { clamp, log2p } from './util';

export interface CiiInputs {
  conflict: ConflictEvent[];
  aircraft: Aircraft[];
  news: NewsItem[];
  quakes: Quake[];
  disasters: NaturalEvent[];
  fires: FireSummary | null;
  spikes: KeywordSpike[];
  ucdp: UcdpSummary | null;
  now: number;
  /** filled once by prepare(): country lookups shared by all countries */
  memo?: { air: Map<string, number>; quakeIso: (string | null)[]; spikeIso: string[][] };
}

function prepare(inp: CiiInputs): Required<CiiInputs>['memo'] {
  if (inp.memo) return inp.memo;
  const air = new Map<string, number>();
  for (const a of inp.aircraft) {
    const iso = countryAt(a.lat, a.lon);
    if (iso) air.set(iso, (air.get(iso) ?? 0) + 1);
  }
  inp.memo = {
    air,
    quakeIso: inp.quakes.map((q) => countryAt(q.lat, q.lon)),
    spikeIso: inp.spikes.map((sp) => [...new Set(sp.headlines.flatMap((h) => geotag(h.title)))]),
  };
  return inp.memo;
}

const DAY = 24 * 3600000;
const TIER_W = { 1: 1.5, 2: 1.2, 3: 0.8 } as const;

export interface Components {
  unrest: number;
  conflict: number;
  security: number;
  information: number;
}

export function componentsFor(c: CiiCountry, inp: CiiInputs): Components {
  const m = c.multiplier;
  let protest = 0, violence = 0, military = 0;
  for (const e of inp.conflict) {
    if (e.country !== c.iso3 || inp.now - e.time > DAY) continue;
    const w = log2p(e.mentions); // many mentions count, but with diminishing returns
    if (e.kind === 'protest') protest += w;
    else if (e.kind === 'violence') violence += w * 1.3;
    else if (e.kind === 'military') military += w;
    else violence += w * 0.6; // coercion
  }
  const air = prepare(inp).air.get(c.iso3) ?? 0;

  let info = 0;
  let unrestNews = 0;
  for (const n of inp.news) {
    if (inp.now - n.time > DAY || !n.countries.includes(c.iso3)) continue;
    const neg = n.tone !== undefined && n.tone < 0 ? 1 + Math.min(1, -n.tone) : 1;
    info += TIER_W[n.sourceTier] * neg;
    if (KEYWORD_GROUPS.unrest.words.some((w) => hasWord(n.title, w))) unrestNews++;
  }

  return {
    unrest: clamp(m * (14 * log2p(protest) + 6 * log2p(unrestNews))),
    conflict: clamp(m * 16 * log2p(violence + military * 0.8)),
    security: clamp(m * (18 * log2p(air) + 8 * log2p(military))),
    information: clamp(m * 13 * log2p(info)),
  };
}

export function boostsFor(c: CiiCountry, inp: CiiInputs, info: number): Record<string, number> {
  const caps = CII_WEIGHTS.boostCaps;
  const memo = prepare(inp);
  let quakes = 0;
  for (let i = 0; i < inp.quakes.length; i++) {
    const q = inp.quakes[i];
    if (inp.now - q.time > DAY || memo.quakeIso[i] !== c.iso3) continue;
    quakes += q.mag >= 7 ? 20 : q.mag >= 6 ? 10 : q.mag >= 5.5 ? 4 : 0;
  }
  let disasters = 0;
  for (const d of inp.disasters) if (d.country === c.iso3) disasters += d.alertLevel === 'Red' ? 10 : 5;
  const fireCount = inp.fires?.byCountry[c.iso3] ?? 0;
  const fires = fireCount >= 50 ? log2p(fireCount / 50) * 2 : 0;
  const spikeHits = memo.spikeIso.filter((isos) => isos.includes(c.iso3)).length;
  const newsUrgency = info >= 70 ? 3 + spikeHits : spikeHits * 2;
  const b = {
    quakes: Math.min(caps.quakes, quakes),
    disasters: Math.min(caps.disasters, disasters),
    fires: Math.min(caps.fires, Math.round(fires * 10) / 10),
    outages: 0, // no commercially licensed outage feed yet
    newsUrgency: Math.min(caps.newsUrgency, newsUrgency),
  };
  return Object.fromEntries(Object.entries(b).filter(([, v]) => v > 0));
}

export function floorFor(c: CiiCountry, ucdp: UcdpSummary | null): { floor: number; reason: string | null } {
  let floor = c.floor ?? 0;
  let reason = c.floor ? c.floorReason ?? 'Configured floor' : null;
  const u = ucdp?.byCountry[c.iso3];
  if (u) {
    const f = CII_WEIGHTS.ucdpFloors;
    const derived = u.deaths > 1000 || u.events > 100 ? f.war : u.events > 10 ? f.minor : 0;
    if (derived > floor) {
      floor = derived;
      reason = derived === f.war ? `UCDP: active war (${u.events} events, ${u.deaths} deaths, 2y)` : `UCDP: minor conflict (${u.events} events, 2y)`;
    }
  }
  return { floor, reason };
}

export type CiiHistory = Record<string, [number, number][]>;

export function scoreCountry(c: CiiCountry, inp: CiiInputs, hist: [number, number][] = []): CiiScore {
  const comp = componentsFor(c, inp);
  const w = CII_WEIGHTS.event;
  const event = comp.unrest * w.unrest + comp.conflict * w.conflict + comp.security * w.security + comp.information * w.information;
  const boosts = boostsFor(c, inp, comp.information);
  const boostSum = Object.values(boosts).reduce((a, b) => a + b, 0);
  const combined = c.baseline * CII_WEIGHTS.combine.baseline + event * CII_WEIGHTS.combine.event + boostSum;
  const { floor, reason } = floorFor(c, inp.ucdp);
  const score = Math.round(clamp(Math.max(combined, floor)));

  // 24h change against the stored sample nearest to 24h ago (±3h), if any.
  const target = inp.now - DAY;
  let prior: number | null = null;
  let bestGap = 3 * 3600000;
  for (const [t, s] of hist) {
    const gap = Math.abs(t - target);
    if (gap <= bestGap) {
      bestGap = gap;
      prior = s;
    }
  }
  return {
    iso3: c.iso3,
    name: c.name,
    score,
    band: band(score),
    baseline: c.baseline,
    event: Math.round(event * 10) / 10,
    components: { unrest: Math.round(comp.unrest), conflict: Math.round(comp.conflict), security: Math.round(comp.security), information: Math.round(comp.information) },
    boosts,
    floor,
    floorReason: combined < floor ? reason : null,
    change24h: prior === null ? null : score - prior,
    spark: dailySpark(hist, score, inp.now),
  };
}

/** Last sample of each of the past 30 days, with today's score at the end. */
export function dailySpark(hist: [number, number][], current: number, now: number): number[] {
  const byDay = new Map<number, number>();
  for (const [t, s] of hist) byDay.set(Math.floor(t / DAY), s);
  const today = Math.floor(now / DAY);
  const out: number[] = [];
  for (let d = today - 29; d < today; d++) if (byDay.has(d)) out.push(byDay.get(d)!);
  out.push(current);
  return out;
}

export function computeCii(inp: CiiInputs, history: CiiHistory = {}): CiiScore[] {
  return CII_COUNTRIES.map((c) => scoreCountry(c, inp, history[c.iso3])).sort((a, b) => b.score - a.score);
}

/** Append hourly samples and keep 30 days. */
export function appendHistory(history: CiiHistory, scores: CiiScore[], now: number): CiiHistory {
  const out: CiiHistory = {};
  const cutoff = now - 30 * DAY;
  for (const s of scores) {
    const h = (history[s.iso3] ?? []).filter(([t]) => t >= cutoff);
    const last = h[h.length - 1];
    if (!last || now - last[0] >= 55 * 60000) h.push([now, s.score]);
    out[s.iso3] = h;
  }
  return out;
}
