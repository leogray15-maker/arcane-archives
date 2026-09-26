// The intelligence engine as a derive-stage seed job. Runs after the fetch
// jobs in the fast tier: reads every feed once from Redis, computes ranked
// headlines, keyword spikes, anomaly baselines, convergence, signals, CII,
// header metrics, chokepoint status and strategic posture, and writes each
// under its own key with its own meta.
import { FEED_BY_ID, metaKey } from '../../../../shared/watchtower/feeds';
import type {
  Aircraft, AnomalySet, Chokepoint, CiiScore, ConflictEvent, FeedMeta, FireSummary, HeaderMetrics, Hotspot, NaturalEvent, NewsItem, Quake,
  SignalSet, SpikeSet, StaticDataset,
} from '../../../../shared/watchtower/types';
import { REGIONS, regionOf } from '../../config/geo-areas';
import { detectAnomalies, updateBaselines, type AnomalyState } from '../../intel/anomaly';
import { appendHistory, computeCii, type CiiHistory } from '../../intel/cii';
import { findConvergence, type LocatedEvent } from '../../intel/convergence';
import { rankHeadlines } from '../../intel/ranking';
import { buildSignals, clusterSignals } from '../../intel/signals';
import { runSpikes } from '../../intel/spikes';
import { chokepointStatus, posture, sentiment, threatLevel } from '../../intel/status';
import { getStatic } from '../../static-data';
import type { Store } from '../../store';
import type { ToneSummary } from './gdelt';
import type { UcdpSummary } from './ucdp';
import type { SeedJob } from '../framework';

const DAY = 24 * 3600000;
const INPUTS = ['seismic', 'natural', 'disasters', 'fires', 'conflict', 'aircraft', 'news', 'tone', 'ucdp'] as const;

async function readInputs(store: Store) {
  const keys = INPUTS.flatMap((id) => [FEED_BY_ID[id].redisKey, metaKey(FEED_BY_ID[id].redisKey)]);
  const vals = await store.mget(keys);
  const data: Record<string, unknown> = {};
  const meta: Record<string, FeedMeta | null> = {};
  INPUTS.forEach((id, i) => {
    data[id] = vals[i * 2];
    meta[id] = vals[i * 2 + 1] as FeedMeta | null;
  });
  return { data, meta };
}

/** Writes a derived key + meta. When required inputs are missing, the previous
 *  value is kept and the meta records what is missing (never shown as fresh). */
export async function writeDerived(store: Store, feedId: string, value: unknown, count: number, now: number, missing: string[] = [], partial: string[] = []) {
  const f = FEED_BY_ID[feedId];
  const mk = metaKey(f.redisKey);
  if (missing.length) {
    const prev = await store.get<FeedMeta>(mk);
    await store.set(mk, { fetchedAt: prev?.fetchedAt ?? null, lastAttemptAt: now, recordCount: prev?.recordCount ?? 0, source: f.source, ok: false, error: `Waiting for input: ${missing.join(', ')}` } satisfies FeedMeta, { ex: 30 * 24 * 3600 });
    return;
  }
  await store.set(f.redisKey, value, { ex: 7 * 24 * 3600 });
  await store.set(mk, { fetchedAt: now, lastAttemptAt: now, recordCount: count, source: f.source, ok: true, error: partial.length ? `Partial inputs: ${partial.join(', ')} unavailable` : undefined } satisfies FeedMeta, { ex: 30 * 24 * 3600 });
}

function countsByTypeRegion(ev: { type: string; lat: number; lon: number; time: number }[], now: number) {
  const out: Record<string, Record<string, number>> = {};
  for (const e of ev) {
    if (now - e.time > DAY) continue;
    const r = regionOf(e.lat, e.lon);
    if (!r) continue;
    (out[e.type] ??= {})[r] = (out[e.type][r] ?? 0) + 1;
  }
  return out;
}

export const intelJob: SeedJob<SignalSet> = {
  id: 'intel',
  feed: 'signals',
  tier: 'fast',
  stage: 'derive',
  intervalMin: 5,
  timeoutMs: 45000,
  async run({ store, now }) {
    const { data, meta } = await readInputs(store);
    const has = (id: string) => meta[id]?.fetchedAt != null && data[id] != null;
    const list = <T>(id: string) => (Array.isArray(data[id]) ? (data[id] as T[]) : []);

    const quakes = list<Quake>('seismic');
    const natural = list<NaturalEvent>('natural');
    const disasters = list<NaturalEvent>('disasters');
    const fires = (data.fires as FireSummary | null) ?? null;
    const conflict = list<ConflictEvent>('conflict');
    const aircraft = list<Aircraft>('aircraft');
    const news = list<NewsItem>('news');
    const tone = (data.tone as ToneSummary | null) ?? null;
    const ucdp = (data.ucdp as UcdpSummary | null) ?? null;
    const hotspots = (getStatic('hotspots')?.data as StaticDataset<Hotspot> | undefined)?.items ?? [];
    const chokepoints = (getStatic('chokepoints')?.data as StaticDataset<Chokepoint> | undefined)?.items ?? [];

    // 1. Headline ranking
    const headlines = rankHeadlines(news, now);
    await writeDerived(store, 'headlines', headlines, headlines.length, now, has('news') ? [] : ['news']);

    // 2. Keyword spikes
    let spikes: SpikeSet = { items: [], learning: true, historyHours: 0 };
    if (has('news')) {
      spikes = await runSpikes(store, news, now, await store.get<SpikeSet>(FEED_BY_ID.spikes.redisKey));
      await writeDerived(store, 'spikes', spikes, spikes.items.length, now);
    } else await writeDerived(store, 'spikes', null, 0, now, ['news']);

    // 3. Located events (shared by anomalies and convergence)
    const located: LocatedEvent[] = [
      ...conflict.map((e) => ({ type: e.kind === 'protest' ? 'protest' : e.kind === 'violence' ? 'violence' : 'military_event', lat: e.lat, lon: e.lon, time: e.time })),
      ...aircraft.map((a) => ({ type: 'military_air', lat: a.lat, lon: a.lon, time: a.seenAt })),
      ...quakes.map((q) => ({ type: 'seismic', lat: q.lat, lon: q.lon, time: q.time })),
      ...[...natural, ...disasters].map((e) => ({ type: 'natural', lat: e.lat, lon: e.lon, time: e.time })),
      ...(fires?.points ?? []).map(([lat, lon, , t]) => ({ type: 'wildfire', lat, lon, time: t })),
    ];

    // 4. Anomaly baselines (Welford per type × region × weekday; one sample per UTC day)
    const counts = countsByTypeRegion(located, now);
    // Headlines carry no coordinates, so news volume gets one global baseline.
    counts.news_volume = { Global: news.filter((n) => now - n.time <= DAY).length };
    let aState = (await store.get<AnomalyState>('wt:welford:v1')) ?? { stats: {}, lastDay: null };
    const today = Math.floor(now / DAY);
    const weekday = new Date(now).getUTCDay();
    if (aState.lastDay !== today && aState.lastDay !== null) {
      // First run of a new UTC day: the rolling 24h counts ≈ yesterday.
      aState = updateBaselines(aState, counts, (weekday + 6) % 7, today, [...REGIONS.map((r) => r.name), 'Global']);
      await store.set('wt:welford:v1', aState, { ex: 120 * 24 * 3600 });
    } else if (aState.lastDay === null) {
      await store.set('wt:welford:v1', { ...aState, lastDay: today }, { ex: 120 * 24 * 3600 });
    }
    const anomalyItems = detectAnomalies(aState, counts, weekday);
    const maxSamples = Math.max(0, ...Object.values(aState.stats).map((s) => s.n));
    const anomalies: AnomalySet = { items: anomalyItems, learning: maxSamples < 10, samples: maxSamples };
    await writeDerived(store, 'anomalies', anomalies, anomalyItems.length, now);

    // 5. Convergence
    const convergence = findConvergence(located, now, { hotspots, chokepoints });
    const liveInputs = ['conflict', 'aircraft', 'seismic'].filter(has);
    await writeDerived(store, 'convergence', convergence, convergence.length, now, liveInputs.length ? [] : ['conflict', 'aircraft', 'seismic'], ['conflict', 'aircraft', 'seismic', 'natural', 'fires'].filter((x) => !has(x)));

    // 6. Signals
    const signals = clusterSignals(buildSignals({ quakes, natural, disasters, fires, conflict, aircraft, spikes: spikes.items, convergence, anomalies: anomalyItems, now }));

    // 7. Country Instability Index (+ 30-day history)
    const history = (await store.get<CiiHistory>('wt:cii:hist:v1')) ?? {};
    const cii: CiiScore[] = computeCii({ conflict, aircraft, news, quakes, disasters, fires, spikes: spikes.items, ucdp, now }, history);
    await store.set('wt:cii:hist:v1', appendHistory(history, cii, now), { ex: 40 * 24 * 3600 });
    const ciiMissing = ['conflict', 'news', 'aircraft', 'ucdp'].filter((x) => !has(x));
    await writeDerived(store, 'cii', cii, cii.length, now, [], ciiMissing);

    // 8. Header metrics, chokepoints, posture
    const t = threatLevel(cii, signals.items, now);
    const s = sentiment(has('tone') ? tone : null, news, now);
    const header: HeaderMetrics = {
      threatLevel: t.level,
      threatScore: t.score,
      threatInputs: { topCountries: t.top, criticalSignals: t.critical },
      sentiment: s.value,
      sentimentChange: s.change,
      sentimentSource: s.source,
      computedAt: now,
    };
    await writeDerived(store, 'header', header, 1, now);

    const chokes = chokepointStatus(chokepoints, { conflict, aircraft, disasters, news, now });
    await writeDerived(store, 'chokepointStatus', chokes, chokes.length, now, [], ['conflict', 'aircraft', 'news'].filter((x) => !has(x)));

    const theatres = posture({ aircraft, signals: signals.items, cii, now });
    await writeDerived(store, 'posture', theatres, theatres.length, now, has('aircraft') ? [] : ['aircraft']);

    return signals;
  },
  validate: (d) => (d && Array.isArray(d.items) ? { ok: true, count: d.items.length } : { ok: false, count: 0, reason: 'bad shape' }),
};
