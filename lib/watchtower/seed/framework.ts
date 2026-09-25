// Seed → cache → serve. Every job:
//   1. takes a lock (SET NX) so overlapping cron runs don't collide,
//   2. fetches + normalises upstream data,
//   3. validates it (including against the previous value),
//   4. only then overwrites the last-good value, and
//   5. writes wt:meta:<key> = { fetchedAt, lastAttemptAt, recordCount, source, ok, error }.
// A failed or invalid run leaves last-good data in place and records the error.
import { FEED_BY_ID, metaKey } from '../../../shared/watchtower/feeds';
import type { FeedMeta } from '../../../shared/watchtower/types';
import type { Store } from '../store';
import { redact } from './fetch';

export type SeedTier = 'fast' | 'medium' | 'slow' | 'daily';

export interface Validation {
  ok: boolean;
  count: number;
  reason?: string;
}

export interface SeedCtx {
  store: Store;
  now: number;
}

export interface SeedJob<T = unknown> {
  id: string;
  /** Feed id (shared/watchtower/feeds.ts) whose key this job writes */
  feed: string;
  tier: SeedTier;
  /** Minimum minutes between runs (the tier cron may fire more often) */
  intervalMin: number;
  timeoutMs?: number;
  /** Seconds to keep last-good data (default 7 days) */
  ttlSec?: number;
  /** 'derive' jobs run after all fetch jobs in the tier (they read other feeds) */
  stage?: 'fetch' | 'derive';
  /** Required env vars; if missing the job is skipped with a clear meta error */
  requiresEnv?: string[];
  run(ctx: SeedCtx, prev: T | null): Promise<T>;
  validate(data: T, prev: T | null): Validation;
}

export type SeedOutcome = 'ok' | 'invalid' | 'error' | 'locked' | 'skipped';

export interface SeedResult {
  job: string;
  outcome: SeedOutcome;
  count: number;
  ms: number;
  error?: string;
  at: number;
}

const DEFAULT_TTL = 7 * 24 * 3600;
const RUN_LOG_KEY = 'wt:runs:v1';

export async function runSeed<T>(job: SeedJob<T>, store: Store, now = Date.now()): Promise<SeedResult> {
  const feed = FEED_BY_ID[job.feed];
  if (!feed) throw new Error(`Unknown feed ${job.feed}`);
  const key = feed.redisKey;
  const mKey = metaKey(key);
  const t0 = Date.now();
  const timeoutMs = job.timeoutMs ?? 25000;

  const missing = (job.requiresEnv ?? []).filter((v) => !process.env[v]);
  const prevMeta = await store.get<FeedMeta>(mKey);
  if (missing.length) {
    await writeMeta(store, mKey, prevMeta, feed.source, now, { ok: false, error: `Not configured: set ${missing.join(', ')}` });
    return log(store, { job: job.id, outcome: 'skipped', count: 0, ms: 0, error: `missing ${missing.join(',')}`, at: now });
  }

  const lockKey = `wt:lock:${key}`;
  const token = `${now}-${Math.random().toString(36).slice(2)}`;
  const got = await store.set(lockKey, token, { nx: true, ex: Math.ceil(timeoutMs / 1000) + 30 });
  if (!got) return { job: job.id, outcome: 'locked', count: 0, ms: 0, at: now };

  try {
    const prev = await store.get<T>(key);
    const data = await withTimeout(job.run({ store, now }, prev), timeoutMs);
    const v = job.validate(data, prev);
    if (!v.ok) {
      await writeMeta(store, mKey, prevMeta, feed.source, now, { ok: false, error: `Rejected: ${v.reason ?? 'invalid data'}` });
      return log(store, { job: job.id, outcome: 'invalid', count: v.count, ms: Date.now() - t0, error: v.reason, at: now });
    }
    await store.set(key, data, { ex: job.ttlSec ?? DEFAULT_TTL });
    const meta: FeedMeta = { fetchedAt: now, lastAttemptAt: now, recordCount: v.count, source: feed.source, ok: true };
    await store.set(mKey, meta, { ex: 30 * 24 * 3600 });
    return log(store, { job: job.id, outcome: 'ok', count: v.count, ms: Date.now() - t0, at: now });
  } catch (e) {
    const msg = redact(e instanceof Error ? e.message : String(e)).slice(0, 240);
    await writeMeta(store, mKey, prevMeta, feed.source, now, { ok: false, error: msg });
    return log(store, { job: job.id, outcome: 'error', count: 0, ms: Date.now() - t0, error: msg, at: now });
  } finally {
    if ((await store.get<string>(lockKey)) === token) await store.del(lockKey);
  }
}

async function writeMeta(store: Store, mKey: string, prev: FeedMeta | null, source: string, now: number, patch: { ok: boolean; error?: string }) {
  const meta: FeedMeta = {
    fetchedAt: prev?.fetchedAt ?? null, // keep the last-good time
    recordCount: prev?.recordCount ?? 0,
    source,
    lastAttemptAt: now,
    ...patch,
  };
  await store.set(mKey, meta, { ex: 30 * 24 * 3600 });
}

async function log(store: Store, r: SeedResult) {
  try {
    const runs = (await store.get<SeedResult[]>(RUN_LOG_KEY)) ?? [];
    runs.unshift(r);
    await store.set(RUN_LOG_KEY, runs.slice(0, 80), { ex: 7 * 24 * 3600 });
  } catch {
    /* logging is best effort */
  }
  return r;
}

export async function recentRuns(store: Store) {
  return (await store.get<SeedResult[]>(RUN_LOG_KEY)) ?? [];
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}

/* Validation helpers */

/** Accept when it looks like the right shape, and never replace a healthy
 *  dataset with an empty or collapsed one (a partial upstream failure). */
export function validateList<T>(data: T[], prev: T[] | null, opts: { min?: number; maxDropRatio?: number; check?: (x: T) => boolean } = {}): Validation {
  if (!Array.isArray(data)) return { ok: false, count: 0, reason: 'not a list' };
  const bad = opts.check ? data.filter((x) => !opts.check!(x)).length : 0;
  if (bad > data.length * 0.1) return { ok: false, count: data.length, reason: `${bad} malformed records` };
  const min = opts.min ?? 1;
  if (data.length < min) {
    const prevLen = Array.isArray(prev) ? prev.length : 0;
    if (prevLen >= min) return { ok: false, count: data.length, reason: `only ${data.length} records (had ${prevLen})` };
  }
  if (opts.maxDropRatio && Array.isArray(prev) && prev.length >= 20 && data.length < prev.length * (1 - opts.maxDropRatio)) {
    return { ok: false, count: data.length, reason: `dropped from ${prev.length} to ${data.length}` };
  }
  return { ok: true, count: data.length };
}

export const isCoord = (lat: unknown, lon: unknown) =>
  typeof lat === 'number' && typeof lon === 'number' && isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
