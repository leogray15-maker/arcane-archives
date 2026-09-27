// GET /api/watchtower/country-brief?iso=UKR  (members)
// Cached per country for 2h; generating a new one counts against the viewer's
// daily limit (WT_AI_USER_DAILY_LIMIT) and the global monthly budget.
import { FEED_BY_ID } from '../../../shared/watchtower/feeds';
import type { CiiScore, CountryBrief, NewsItem, SignalSet } from '../../../shared/watchtower/types';
import { generateCountryBrief } from '../ai/briefs';
import { AiUnavailable, aiStatus } from '../ai/provider';
import { requireTier } from '../http/auth';
import { route } from '../http/router';
import { HttpError, json } from '../http/types';
import { setAiStatus } from './core';

setAiStatus(aiStatus);

const userLimit = () => Number(process.env.WT_AI_USER_DAILY_LIMIT || '20');

route('GET', 'country-brief', true, async ({ req, store, principal }) => {
  requireTier(principal!, 'member');
  const iso = String(req.query.iso || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(iso)) throw new HttpError(400, 'iso must be an ISO 3166 alpha-3 code');

  const cacheKey = `wt:ai:country:${iso}`;
  const cached = await store.get<CountryBrief>(cacheKey);
  if (cached) return json({ ...cached, cached: true }, 200, 'fast');

  if (principal!.tier !== 'admin') {
    const day = new Date().toISOString().slice(0, 10);
    const n = await store.incr(`wt:ai:user:${principal!.uid}:${day}`, 1, 26 * 3600);
    if (n > userLimit()) throw new HttpError(429, `Daily limit of ${userLimit()} new country briefs reached — cached briefs still load.`, 'user_limit');
  }

  const [cii, signals, news] = await store.mget<unknown>([FEED_BY_ID.cii.redisKey, FEED_BY_ID.signals.redisKey, FEED_BY_ID.news.redisKey]);
  try {
    const brief = await generateCountryBrief(
      store,
      iso,
      {
        cii: ((cii as CiiScore[] | null) ?? []).find((c) => c.iso3 === iso) ?? null,
        signals: ((signals as SignalSet | null)?.items ?? []).filter((s) => s.country === iso),
        news: (news as NewsItem[] | null) ?? [],
      },
      Date.now(),
    );
    await store.set(cacheKey, brief, { ex: 2 * 3600 });
    return json({ ...brief, cached: false }, 200, 'fast');
  } catch (e) {
    if (e instanceof AiUnavailable) throw new HttpError(e.code === 'unconfigured' ? 503 : e.code === 'throttled' ? 429 : 503, e.message, `ai_${e.code}`);
    throw e;
  }
});
