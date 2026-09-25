// bootstrap · health · cron/:tier · admin/status · admin/refresh
import { FEEDS, FEED_BY_ID, canAccess, metaKey, type BootTier } from '../../../shared/watchtower/feeds';
import type { BootstrapResponse, FeedMeta, FeedStatus, HealthFeed, HealthResponse } from '../../../shared/watchtower/types';
import { authenticate, checkCronSecret, requireTier, type Principal } from '../http/auth';
import { route } from '../http/router';
import { fnv1a, HttpError, json } from '../http/types';
import { runSeed, recentRuns } from '../seed/framework';
import { JOBS, lastRuns, runTier } from '../seed/registry';
import type { Store } from '../store';
import { getStatic } from '../static-data';

/* ── bootstrap ─────────────────────────────────────────────── */

export async function buildBootstrap(store: Store, tier: BootTier, viewer: Principal): Promise<BootstrapResponse> {
  const feeds = FEEDS.filter((f) => f.boot === tier && !f.internal);
  const locked: string[] = [];
  const allowed = feeds.filter((f) => (canAccess(viewer.tier, f.access) ? true : (locked.push(f.id), false)));
  const live = allowed.filter((f) => !f.static);

  const keys = live.flatMap((f) => [f.redisKey, metaKey(f.redisKey)]);
  const vals = keys.length ? await store.mget(keys) : [];
  const data: Record<string, unknown> = {};
  const meta: Record<string, FeedMeta | null> = {};
  live.forEach((f, i) => {
    data[f.id] = vals[i * 2] ?? null;
    meta[f.id] = (vals[i * 2 + 1] as FeedMeta | null) ?? null;
  });
  for (const f of allowed.filter((x) => x.static)) {
    const s = getStatic(f.id);
    data[f.id] = s?.data ?? null;
    meta[f.id] = s?.meta ?? null;
  }
  return { tier, generatedAt: Date.now(), data, meta, locked };
}

route('GET', 'bootstrap', true, async ({ req, store, principal }) => {
  const tier = req.query.tier === 'slow' ? 'slow' : 'fast';
  const body = await buildBootstrap(store, tier, principal!);
  // ETag over the data + meta only, so unchanged polls get a cheap 304.
  const etag = `"${fnv1a(JSON.stringify([body.data, body.meta, body.locked]))}"`;
  return json(body, 200, tier === 'fast' ? 'fast' : 'slow', { ETag: etag });
});

/* ── health ────────────────────────────────────────────────── */

export async function computeHealth(store: Store, now = Date.now()): Promise<HealthFeed[]> {
  const live = FEEDS.filter((f) => !f.static);
  const metas = await store.mget<FeedMeta>(live.map((f) => metaKey(f.redisKey)));
  return live.map((f, i) => {
    const m = metas[i];
    const ageMin = m?.fetchedAt ? Math.round((now - m.fetchedAt) / 60000) : null;
    const status: FeedStatus = ageMin === null ? 'EMPTY' : ageMin > f.maxStaleMin ? 'STALE' : 'OK';
    return { id: f.id, label: f.label, status, ageMin, maxStaleMin: f.maxStaleMin, recordCount: m?.recordCount ?? 0, ok: m?.ok ?? false, error: m?.error };
  });
}

export function summarise(feeds: HealthFeed[]): Omit<HealthResponse, 'feeds'> {
  const counts: Record<FeedStatus, number> = { OK: 0, STALE: 0, EMPTY: 0 };
  feeds.forEach((f) => counts[f.status]++);
  const status = counts.OK === 0 ? 'down' : counts.STALE + counts.EMPTY > 0 ? 'degraded' : 'ok';
  return { status, checkedAt: Date.now(), counts };
}

// Public: counts only (for uptime monitors). Members: per-feed status.
// Admins: per-feed status plus upstream error messages.
route('GET', 'health', false, async ({ req, store }) => {
  const feeds = await computeHealth(store);
  const base = summarise(feeds);
  let viewer: Principal | null = null;
  if (req.headers['authorization']) viewer = await authenticate(req, store).catch(() => null);
  if (!viewer) return json(base, 200, 'none', { 'Cache-Control': 'public, max-age=60' });
  const withErrors = viewer.tier === 'admin';
  return json({ ...base, feeds: feeds.map((f) => (withErrors ? f : { ...f, error: undefined })) });
});

/* ── cron ──────────────────────────────────────────────────── */

route('GET', 'cron/:tier', false, async ({ req, store, params }) => {
  checkCronSecret(req);
  const tier = params.tier;
  if (!['fast', 'medium', 'slow', 'daily'].includes(tier)) throw new HttpError(404, 'Unknown tier');
  const out = await runTier(tier as 'fast', store);
  return json(out);
});

/* ── admin ─────────────────────────────────────────────────── */

route('GET', 'admin/status', true, async ({ store, principal }) => {
  requireTier(principal!, 'admin');
  const [feeds, runs, schedule, ai] = await Promise.all([computeHealth(store), recentRuns(store), lastRuns(store), aiStatus(store)]);
  return json({ ...summarise(feeds), feeds, runs: runs.slice(0, 40), schedule, ai, store: store.kind });
});

route('POST', 'admin/refresh', true, async ({ req, store, principal }) => {
  requireTier(principal!, 'admin');
  const id = String((req.body as any)?.job ?? req.query.job ?? '');
  const job = JOBS.find((j) => j.id === id || j.feed === id);
  if (!job) throw new HttpError(404, `Unknown job "${id}"`);
  const result = await runSeed(job, store);
  return json({ result, feed: FEED_BY_ID[job.feed]?.label });
});

let aiStatusFn: (store: Store) => Promise<unknown> = async () => null;
export function setAiStatus(fn: (store: Store) => Promise<unknown>) {
  aiStatusFn = fn;
}
const aiStatus = (store: Store) => aiStatusFn(store).catch(() => null);
