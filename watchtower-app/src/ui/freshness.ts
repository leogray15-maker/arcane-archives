// Freshness badge: "FRESH 2M", "STALE 3H", "NO DATA". Never shows fake data as live.
import { FEED_BY_ID } from '../../../shared/watchtower/feeds';
import type { FeedMeta } from '../../../shared/watchtower/types';
import { ago } from '../lib/time';

export type Freshness = { cls: 'ok' | 'stale' | 'empty'; text: string; title: string };

export function freshnessOf(feedIds: string[], metas: Record<string, FeedMeta | null>, now = Date.now()): Freshness {
  if (!feedIds.length) return { cls: 'ok', text: 'STATIC', title: 'Reference data' };
  let oldest: number | null = null;
  let anyStale = false;
  let anyMissing = false;
  let allStatic = true;
  const errors: string[] = [];
  for (const id of feedIds) {
    const def = FEED_BY_ID[id];
    const m = metas[id];
    if (!def?.static) allStatic = false;
    if (!m || m.fetchedAt === null) {
      anyMissing = true;
      continue;
    }
    if (m.error) errors.push(`${def?.label ?? id}: ${m.error}`);
    if (def?.static) continue;
    if (oldest === null || m.fetchedAt < oldest) oldest = m.fetchedAt;
    if (def && def.maxStaleMin > 0 && now - m.fetchedAt > def.maxStaleMin * 60000) anyStale = true;
  }
  if (allStatic && !anyMissing) {
    const m = metas[feedIds[0]];
    return { cls: 'ok', text: 'STATIC', title: `Reference dataset · updated ${m?.source ?? ''}` };
  }
  if (oldest === null) return { cls: 'empty', text: 'NO DATA', title: 'This feed has not delivered any data yet.' };
  const age = ago(oldest, now).toUpperCase();
  const base = `Last successful update ${ago(oldest, now)} ago.`;
  if (anyStale) return { cls: 'stale', text: `STALE ${age}`, title: `${base} The source is late — showing last good data.${errors.length ? ' ' + errors.join('; ') : ''}` };
  if (anyMissing) return { cls: 'stale', text: `PARTIAL ${age}`, title: `${base} Some inputs have no data yet.` };
  return { cls: 'ok', text: `FRESH ${age}`, title: base };
}
