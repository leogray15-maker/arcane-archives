// AI derive jobs (slow tier): World Brief every ~2h, Forecasts every ~6h.
import { FEED_BY_ID } from '../../../../shared/watchtower/feeds';
import type { AiBrief, CiiScore, ForecastSet, RankedHeadline, SignalSet, SpikeSet, TheatrePosture } from '../../../../shared/watchtower/types';
import { generateForecasts, generateWorldBrief } from '../../ai/briefs';
import { AiUnavailable, configuredProviders } from '../../ai/provider';
import type { SeedJob } from '../framework';

const requireAi = () => {
  if (!configuredProviders().length) throw new AiUnavailable('Not configured: set GROQ_API_KEY and/or OPENROUTER_API_KEY', 'unconfigured');
};

export const aiBriefJob: SeedJob<AiBrief> = {
  id: 'ai-brief',
  feed: 'brief',
  tier: 'slow',
  stage: 'derive',
  intervalMin: 115,
  timeoutMs: 55000,
  ttlSec: 3 * 24 * 3600,
  async run({ store, now }) {
    requireAi();
    const ranked = (await store.get<RankedHeadline[]>(FEED_BY_ID.headlines.redisKey)) ?? [];
    if (!ranked.length) throw new Error('Waiting for input: ranked headlines');
    return generateWorldBrief(store, ranked, now);
  },
  validate: (d) => (d?.paragraphs?.length ? { ok: true, count: d.citations.length } : { ok: false, count: 0, reason: 'empty brief' }),
};

export const aiForecastJob: SeedJob<ForecastSet> = {
  id: 'ai-forecasts',
  feed: 'forecasts',
  tier: 'slow',
  stage: 'derive',
  intervalMin: 355,
  timeoutMs: 55000,
  ttlSec: 3 * 24 * 3600,
  async run({ store, now }) {
    requireAi();
    const [cii, signals, spikes, posture, headlines] = await store.mget<unknown>([
      FEED_BY_ID.cii.redisKey, FEED_BY_ID.signals.redisKey, FEED_BY_ID.spikes.redisKey, FEED_BY_ID.posture.redisKey, FEED_BY_ID.headlines.redisKey,
    ]);
    if (!cii) throw new Error('Waiting for input: CII');
    return generateForecasts(store, {
      cii: cii as CiiScore[],
      signals: signals as SignalSet | null,
      spikes: spikes as SpikeSet | null,
      posture: (posture as TheatrePosture[] | null) ?? [],
      headlines: (headlines as RankedHeadline[] | null) ?? [],
    }, now);
  },
  validate: (d) => (Array.isArray(d?.items) && d.items.length ? { ok: true, count: d.items.length } : { ok: false, count: 0, reason: 'no forecast items passed the checks' }),
};
