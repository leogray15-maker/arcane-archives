import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import type { Aircraft, CiiScore, ConflictEvent, NewsItem, Signal } from '../../shared/watchtower/types';
import { band, CII_COUNTRIES, CII_WEIGHTS } from '../../lib/watchtower/config/cii';
import { ANOMALY, detectAnomalies, updateBaselines, variance, welfordAdd, zSeverity, type AnomalyState } from '../../lib/watchtower/intel/anomaly';
import { appendHistory, componentsFor, floorFor, scoreCountry, type CiiInputs } from '../../lib/watchtower/intel/cii';
import { convergenceScore, findConvergence } from '../../lib/watchtower/intel/convergence';
import { clusterStories, rankHeadlines, recencyFactor, scoreStory } from '../../lib/watchtower/intel/ranking';
import { detectSpikes, SPIKE, termsOf, type Bucket } from '../../lib/watchtower/intel/spikes';
import { threatLevel, sentiment } from '../../lib/watchtower/intel/status';
import { overlap } from '../../lib/watchtower/intel/util';
import { runTier } from '../../lib/watchtower/seed/registry';
import { MemoryStore } from '../../lib/watchtower/store';
import { installFixtureFetch } from '../../lib/watchtower/dev/fixture-fetch';
import '../../lib/watchtower/static-register';
import { FEED_BY_ID } from '../../shared/watchtower/feeds';

const NOW = Date.UTC(2026, 8, 25, 12, 0, 0);
const H = 3600000;

const news = (title: string, source: string, minsAgo: number, tier: 1 | 2 | 3 = 1, extra: Partial<NewsItem> = {}): NewsItem => ({
  id: `${source}:${title}`, title, link: `https://example.com/${encodeURIComponent(title)}`, source, sourceTier: tier, ownership: 'private', time: NOW - minsAgo * 60000, countries: [], ...extra,
});

const emptyInputs = (over: Partial<CiiInputs> = {}): CiiInputs => ({ conflict: [], aircraft: [], news: [], quakes: [], disasters: [], fires: null, spikes: [], ucdp: null, now: NOW, ...over });

describe('Country Instability Index', () => {
  const ukr = CII_COUNTRIES.find((c) => c.iso3 === 'UKR')!;
  const usa = CII_COUNTRIES.find((c) => c.iso3 === 'USA')!;
  const ind = CII_COUNTRIES.find((c) => c.iso3 === 'IND')!;

  it('uses the published weights', () => {
    expect(CII_WEIGHTS.event).toEqual({ unrest: 0.25, conflict: 0.3, security: 0.2, information: 0.25 });
    expect(CII_WEIGHTS.combine).toEqual({ baseline: 0.4, event: 0.6 });
  });

  it('with no events, score = baseline × 0.4 (floors aside)', () => {
    expect(scoreCountry(ind, emptyInputs()).score).toBe(Math.round(ind.baseline * 0.4));
    expect(scoreCountry(usa, emptyInputs()).score).toBe(Math.round(usa.baseline * 0.4));
  });

  it('applies floors so war zones never look calm in a data gap', () => {
    const s = scoreCountry(ukr, emptyInputs());
    expect(s.score).toBe(70);
    expect(s.floorReason).toMatch(/Active war/);
  });

  it('derives UCDP floors from the two-year window', () => {
    const f = floorFor(ind, { version: 'x', since: '', events: 0, byCountry: { IND: { events: 12, deaths: 40 } } });
    expect(f).toEqual({ floor: 50, reason: expect.stringContaining('minor conflict') });
    const w = floorFor(ind, { version: 'x', since: '', events: 0, byCountry: { IND: { events: 20, deaths: 1500 } } });
    expect(w.floor).toBe(70);
  });

  it('combines components with the event weights', () => {
    const conflict: ConflictEvent[] = Array.from({ length: 6 }, (_, i) => ({ id: String(i), lat: 22, lon: 79, time: NOW - H, kind: 'violence', country: 'IND', mentions: 15, tone: -8, goldstein: -10, url: '', place: '' }));
    const inp = emptyInputs({ conflict });
    const c = componentsFor(ind, inp);
    const s = scoreCountry(ind, inp);
    const event = c.unrest * 0.25 + c.conflict * 0.3 + c.security * 0.2 + c.information * 0.25;
    expect(s.event).toBeCloseTo(event, 1);
    expect(s.score).toBe(Math.round(ind.baseline * 0.4 + event * 0.6));
    expect(c.conflict).toBeGreaterThan(0);
  });

  it('dampens media-heavy countries via the multiplier', () => {
    const mk = (iso3: string): NewsItem[] => Array.from({ length: 30 }, (_, i) => news(`Story ${i}`, 'BBC', 30, 1, { countries: [iso3], tone: -0.5 }));
    const us = componentsFor(usa, emptyInputs({ news: mk('USA') })).information;
    const ng = componentsFor(CII_COUNTRIES.find((c) => c.iso3 === 'NGA')!, emptyInputs({ news: mk('NGA') })).information;
    expect(us).toBeLessThan(ng);
  });

  it('caps boosts', () => {
    const quakes = Array.from({ length: 5 }, (_, i) => ({ id: String(i), mag: 7.2, place: '', time: NOW - H, lat: 28.6, lon: 77.2, depthKm: 10, url: '', tsunami: false, alert: null, significant: true }));
    const s = scoreCountry(ind, emptyInputs({ quakes }));
    expect(s.boosts.quakes).toBe(CII_WEIGHTS.boostCaps.quakes);
  });

  it('bands follow the thresholds', () => {
    expect([band(81), band(80), band(66), band(65), band(51), band(50), band(31), band(30)]).toEqual(['CRITICAL', 'HIGH', 'HIGH', 'ELEVATED', 'ELEVATED', 'NORMAL', 'NORMAL', 'LOW']);
  });

  it('computes 24h change from history and keeps 30 days', () => {
    const hist: [number, number][] = [[NOW - 24 * H, 10], [NOW - 2 * H, 11]];
    expect(scoreCountry(ind, emptyInputs(), hist).change24h).toBe(Math.round(ind.baseline * 0.4) - 10);
    expect(scoreCountry(ind, emptyInputs(), []).change24h).toBeNull();
    const s = { iso3: 'IND', score: 20 } as CiiScore;
    const h = appendHistory({ IND: [[NOW - 31 * 24 * H, 5], [NOW - 30 * 60000, 19]] }, [s], NOW);
    expect(h.IND).toEqual([[NOW - 30 * 60000, 19]]); // old sample dropped, no new sample within 55 min
  });
});

describe('geographic convergence', () => {
  it('scores types×25 + min(25, events×2)', () => {
    expect(convergenceScore(3, 4)).toBe(83);
    expect(convergenceScore(3, 20)).toBe(100);
    expect(convergenceScore(4, 1)).toBe(100);
  });

  it('alerts on 3+ distinct types in one 1° cell within 24h', () => {
    const ev = [
      { type: 'violence', lat: 44.6, lon: 33.5, time: NOW - H },
      { type: 'military_event', lat: 44.7, lon: 33.4, time: NOW - 2 * H },
      { type: 'military_air', lat: 44.9, lon: 33.0, time: NOW - 60000 },
      { type: 'protest', lat: 48.8, lon: 2.3, time: NOW - H },
      { type: 'seismic', lat: 44.5, lon: 33.9, time: NOW - 30 * H }, // too old
    ];
    const cells = findConvergence(ev, NOW, { hotspots: [], chokepoints: [] });
    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({ id: '44:33', types: ['military_air', 'military_event', 'violence'], events: 3, score: 81, priority: 'high' });
    expect(cells[0].label).toBe('Ukraine'); // nearest named place: Crimea → country
  });

  it('labels a cell with the nearest hotspot or chokepoint', () => {
    const ev = ['a', 'b', 'c'].map((t) => ({ type: t, lat: 12.6, lon: 43.3, time: NOW }));
    const [c] = findConvergence(ev, NOW, { hotspots: [], chokepoints: [{ id: 'bab', name: 'Bab-el-Mandeb', lat: 12.58, lon: 43.33, radiusKm: 100, keywords: [], lanes: [], note: '' }] });
    expect(c.label).toBe('Bab-el-Mandeb');
  });
});

describe('keyword spikes', () => {
  const recent = [
    news('Red Sea blockade widens', 'BBC', 10), news('Blockade hits Suez traffic', 'Guardian', 20), news('Insurers react to blockade', 'DW', 30),
    news('Blockade: what we know', 'BBC', 40), news('Shipping blockade enters day two', 'Al Jazeera', 50), news('Blockade raises prices', 'Guardian', 60),
  ];
  const history = (perHour: number): Record<number, Bucket> =>
    Object.fromEntries(Array.from({ length: 48 }, (_, i): [number, Bucket] => [NOW - (i + 3) * H, perHour ? { blockade: { c: perHour, s: ['BBC'] } } : {}]));

  it('fires above 5 mentions, 3× baseline, 2+ sources', () => {
    const { spikes } = detectSpikes({ items: recent, history: history(0), now: NOW, cooling: new Set() });
    const s = spikes.find((x) => x.term === 'blockade')!;
    expect(s.count2h).toBe(6);
    expect(s.sources.length).toBeGreaterThanOrEqual(2);
  });

  it('does not fire when the baseline is already high', () => {
    // baseline 2/hour → 4 per 2h; 6 < 3 × 4
    const { spikes } = detectSpikes({ items: recent, history: history(2), now: NOW, cooling: new Set() });
    expect(spikes.find((x) => x.term === 'blockade')).toBeUndefined();
    // exactly 3× the baseline (1/hour → 2 per 2h; 6 = 3 × 2) does fire
    expect(detectSpikes({ items: recent, history: history(1), now: NOW, cooling: new Set() }).spikes.find((x) => x.term === 'blockade')?.ratio).toBe(3);
    return;
    expect(spikes.find((x) => x.term === 'blockade')).toBeUndefined();
  });

  it('needs more than 5 mentions and 2 sources', () => {
    const five = recent.slice(0, 5);
    expect(detectSpikes({ items: five, history: history(0), now: NOW, cooling: new Set() }).spikes.find((x) => x.term === 'blockade')).toBeUndefined();
    const oneSource = recent.map((n) => ({ ...n, source: 'BBC' }));
    expect(detectSpikes({ items: oneSource, history: history(0), now: NOW, cooling: new Set() }).spikes.find((x) => x.term === 'blockade')).toBeUndefined();
  });

  it('respects the cooldown', () => {
    expect(detectSpikes({ items: recent, history: history(0), now: NOW, cooling: new Set(['blockade']) }).spikes.find((x) => x.term === 'blockade')).toBeUndefined();
    expect(SPIKE.cooldownMin).toBe(30);
  });

  it('keeps multi-word names together', () => {
    expect(termsOf('Kim Jong Un meets envoy in Red Sea port')).toEqual(expect.arrayContaining(['kim jong un', 'red sea']));
  });
});

describe('headline ranking', () => {
  it('merges near-duplicates (>60% word overlap)', () => {
    expect(overlap('Missile strike hits Kharkiv energy site', 'Russian missile strike hits Kharkiv energy site overnight')).toBeGreaterThan(0.6);
    const stories = clusterStories([news('Missile strike hits Kharkiv energy site', 'BBC', 10), news('Russian missile strike hits Kharkiv energy site overnight', 'DW', 20), news('Election results in Chile', 'BBC', 5)]);
    expect(stories).toHaveLength(2);
  });

  it('scores tier, corroboration, keyword groups and recency', () => {
    const a = scoreStory({ lead: news('Airstrike kills 12 in city', 'BBC', 0), items: [news('Airstrike kills 12 in city', 'BBC', 0), news('Airstrike kills 12 in city', 'DW', 0)] }, NOW);
    // tier1 35 + 2 sources×12 + violence (50+12×1 'kills'? no: 'killed' list) + military (40+10×1 airstrike)
    expect(a.groups).toContain('military');
    expect(a.sources).toEqual(['BBC', 'DW']);
    const fresh = scoreStory({ lead: news('Talks resume', 'BBC', 0), items: [news('Talks resume', 'BBC', 0)] }, NOW).score;
    const old = scoreStory({ lead: news('Talks resume', 'BBC', 16 * 60), items: [news('Talks resume', 'BBC', 16 * 60)] }, NOW).score;
    expect(old).toBeCloseTo(fresh * 0.5, 1);
    expect(recencyFactor(8)).toBeCloseTo(0.75);
    expect(recencyFactor(40)).toBe(0.5);
  });

  it('demotes business and celebrity noise', () => {
    const ranked = rankHeadlines([news('Tech giant posts record quarterly earnings', 'BBC', 5), news('Protests spread after coup attempt', 'DW', 5, 2)], NOW);
    expect(ranked[0].title).toMatch(/Protests/);
    const biz = ranked.find((r) => r.title.includes('earnings'))!;
    expect(biz.score).toBeLessThan(35); // (35 + 12) × 0.35 ≈ 16
  });
});

describe('anomaly baselines (Welford)', () => {
  it('matches the textbook mean and variance', () => {
    let s;
    for (const x of [2, 4, 4, 4, 5, 5, 7, 9]) s = welfordAdd(s, x);
    expect(s!.mean).toBe(5);
    expect(variance(s!)).toBeCloseTo(32 / 7, 10);
  });

  it('maps z to severity and waits for 10 samples', () => {
    expect([zSeverity(1.4), zSeverity(1.5), zSeverity(2), zSeverity(3)]).toEqual(['low', 'med', 'high', 'critical']);
    let state: AnomalyState = { stats: {}, lastDay: null };
    for (let d = 0; d < 9; d++) state = updateBaselines(state, { protest: { Europe: 10 + (d % 3) } }, 1, d, ['Europe']);
    expect(detectAnomalies(state, { protest: { Europe: 40 } }, 1)).toEqual([]);
    state = updateBaselines(state, { protest: { Europe: 11 } }, 1, 10, ['Europe']);
    const a = detectAnomalies(state, { protest: { Europe: 40 } }, 1);
    expect(a[0]).toMatchObject({ type: 'protest', region: 'Europe', severity: 'critical', samples: ANOMALY.minSamples });
    expect(detectAnomalies(state, { protest: { Europe: 40 } }, 2)).toEqual([]); // other weekday has no baseline
  });
});

describe('header metrics', () => {
  it('threat level rolls up top-5 CII plus critical signals', () => {
    const cii = [90, 85, 80, 75, 70, 10].map((score, i) => ({ iso3: `C${i}`, score }) as CiiScore);
    const crit = [{ severity: 'critical', time: NOW } as Signal];
    const t = threatLevel(cii, crit, NOW);
    expect(t.score).toBe(Math.round(80 * 0.85 + 5));
    expect(t.level).toBe(4);
    expect(threatLevel([], [], NOW).level).toBe(1);
  });

  it('sentiment maps GDELT tone to 0–100 with a lexicon fallback', () => {
    expect(sentiment({ avg24: -3, prev24: -2 }, [], NOW)).toEqual({ value: 35, change: -5, source: 'gdelt' });
    expect(sentiment(null, [], NOW).value).toBeNull();
  });
});

describe('full pipeline against fixtures', () => {
  let restore: () => void;
  beforeEach(() => {
    restore = installFixtureFetch(join(__dirname, 'fixtures'));
    for (const k of ['NASA_FIRMS_MAP_KEY', 'UCDP_ACCESS_TOKEN', 'FRED_API_KEY']) process.env[k] = 'test';
  });
  afterEach(() => restore());

  it('produces every derived key with honest meta', async () => {
    const store = new MemoryStore();
    for (const tier of ['daily', 'slow', 'medium', 'fast'] as const) await runTier(tier, store, { force: true });
    const get = (id: string) => store.get<any>(FEED_BY_ID[id].redisKey);
    const cii = await get('cii');
    expect(cii.length).toBe(CII_COUNTRIES.length);
    expect(cii[0].score).toBeGreaterThanOrEqual(cii[cii.length - 1].score);
    const conv = await get('convergence');
    expect(conv.some((c: any) => c.id === '44:33')).toBe(true); // Sevastopol fixture cell
    const sig = await get('signals');
    expect(sig.items.some((s: any) => s.type === 'convergence')).toBe(true);
    expect(sig.byCountry.UKR.count).toBeGreaterThan(0);
    const head = await get('headlines');
    expect(head[0].score).toBeGreaterThan(head[head.length - 1].score);
    const spikes = await get('spikes');
    expect(spikes.learning).toBe(true); // no 24h of history yet → never fires on day one
    const header = await get('header');
    expect(header.threatLevel).toBeGreaterThanOrEqual(1);
    expect(header.sentimentSource).toBe('gdelt');
    const chokes = await get('chokepointStatus');
    expect(chokes.find((c: any) => c.id === 'bab-el-mandeb').newsMentions).toBeGreaterThan(0);
    const posture = await get('posture');
    expect(posture.map((p: any) => p.id)).toContain('blacksea');
  });

  it('never publishes derived data whose inputs are missing', async () => {
    const store = new MemoryStore();
    const { intelJob } = await import('../../lib/watchtower/seed/jobs/intel');
    const { runSeed } = await import('../../lib/watchtower/seed/framework');
    await runSeed(intelJob, store);
    expect(await store.get(FEED_BY_ID.headlines.redisKey)).toBeNull();
    const meta = await store.get<any>(`wt:meta:${FEED_BY_ID.headlines.redisKey}`);
    expect(meta).toMatchObject({ ok: false, fetchedAt: null, error: 'Waiting for input: news' });
  });
});

// keep the type imports used
void ({} as Aircraft);
