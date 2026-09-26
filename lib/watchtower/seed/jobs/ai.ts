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
  // The AI brief costs tokens; the no-key digest is free, so it tracks the headlines closely.
  get intervalMin() {
    return configuredProviders().length ? 115 : 15;
  },
  timeoutMs: 55000,
  ttlSec: 3 * 24 * 3600,
  async run({ store, now }) {
    const ranked = (await store.get<RankedHeadline[]>(FEED_BY_ID.headlines.redisKey)) ?? [];
    if (!ranked.length) throw new Error('Waiting for input: ranked headlines');
    // No AI key: a plain digest of the top-ranked stories, clearly labelled as such.
    if (!configuredProviders().length) return headlineDigest(ranked, now);
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

/** Rule-based World Brief used when no AI provider is configured: the top
 *  stories verbatim, each cited, with no generated wording. */
export function headlineDigest(ranked: RankedHeadline[], now: number): AiBrief {
  const top = ranked.slice(0, 4);
  const citations = top.map((x, i) => ({ n: i + 1, title: x.title, source: x.source, link: x.link, time: x.time }));
  const line = (x: RankedHeadline, n: number) => `${x.title.replace(/[.\s]+$/, '')} (${x.source}${x.corroboration > 1 ? `, +${x.corroboration - 1} more` : ''}) [${n}].`;
  const paragraphs = [`Top story: ${line(top[0], 1)}`];
  if (top.length > 1) paragraphs.push(`Also tracking: ${top.slice(1).map((x, i) => line(x, i + 2)).join(' ')}`);
  return { paragraphs, citations, generatedAt: now, model: 'rule-based', provider: 'digest', thinData: ranked.length < 5 };
}
