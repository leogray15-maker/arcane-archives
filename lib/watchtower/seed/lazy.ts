// Self-refreshing data. The Watchtower normally relies on a scheduler calling
// /api/watchtower/cron/tick every 5 minutes. When nothing has refreshed the
// feeds recently (no scheduler set up yet, or no Redis so each warm instance
// has its own memory store), a viewer's bootstrap request runs the due jobs
// itself. Jobs keep their own intervals, so this never refetches more often
// than the cron would.
import { FEED_BY_ID, metaKey } from '../../../shared/watchtower/feeds';
import type { Store } from '../store';
import { runTier } from './registry';

const LAST_KEY = 'wt:lazy:last';
const LOCK_KEY = 'wt:lazy:lock';
const MIN_GAP_MS = 4 * 60 * 1000;
/** How long a request waits for the very first seed before answering. */
const COLD_BUDGET_MS = 15000;

let inflight: Promise<unknown> | null = null;

/** Vercel's waitUntil (what @vercel/functions uses) — keeps background work alive after the response. */
function waitUntil(p: Promise<unknown>) {
  const ctx = (globalThis as any)[Symbol.for('@vercel/request-context')]?.get?.();
  ctx?.waitUntil?.(p);
}

export async function ensureFresh(store: Store, now = Date.now()): Promise<void> {
  if (process.env.WT_LAZY_SEED === '0') return;
  const [last, seismicMeta] = await store.mget<unknown>([LAST_KEY, metaKey(FEED_BY_ID.seismic.redisKey)]);
  const cold = !seismicMeta;
  if (!cold && typeof last === 'number' && now - last < MIN_GAP_MS) return;

  if (!inflight) {
    // Across instances sharing Redis only one runs; in-process `inflight` dedupes the rest.
    const got = await store.set(LOCK_KEY, now, { nx: true, ex: 90 }).catch(() => false);
    if (!got && !cold) return;
    await store.set(LAST_KEY, now, { ex: 24 * 3600 }).catch(() => undefined);
    inflight = runTier('tick', store, { now })
      .catch((e) => console.error('[watchtower] lazy seed failed', e))
      .finally(() => {
        inflight = null;
        store.del(LOCK_KEY).catch(() => undefined);
      });
    waitUntil(inflight);
  }
  if (cold) await Promise.race([inflight, new Promise((r) => setTimeout(r, COLD_BUDGET_MS))]);
}
