import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { metaKey, FEED_BY_ID } from '../../shared/watchtower/feeds';
import type { FeedMeta, Quake } from '../../shared/watchtower/types';
import { runSeed, validateList, type SeedJob } from '../../lib/watchtower/seed/framework';
import { runTier } from '../../lib/watchtower/seed/registry';
import { usgsJob } from '../../lib/watchtower/seed/jobs/usgs';
import { MemoryStore, setStore } from '../../lib/watchtower/store';
import { installFixtureFetch } from '../../lib/watchtower/dev/fixture-fetch';
import { buildBootstrap, computeHealth } from '../../lib/watchtower/api/core';

const FIX = join(__dirname, 'fixtures');
const key = FEED_BY_ID.seismic.redisKey;

let store: MemoryStore;
let restore: () => void;
beforeEach(() => {
  store = new MemoryStore();
  setStore(store);
  restore = installFixtureFetch(FIX);
});
afterEach(() => restore());

describe('USGS seed job', () => {
  it('normalises, dedupes and drops malformed features', async () => {
    const r = await runSeed(usgsJob, store);
    expect(r.outcome).toBe('ok');
    const quakes = (await store.get<Quake[]>(key))!;
    // 5 valid in day feed + 1 extra in significant feed; fx1 appears in both; fxbad dropped
    expect(quakes.map((q) => q.id).sort()).toEqual(['fx1', 'fx2', 'fx3', 'fx4', 'fx5', 'fx9']);
    const fx1 = quakes.find((q) => q.id === 'fx1')!;
    expect(fx1).toMatchObject({ mag: 6.1, significant: true, depthKm: 35, alert: 'green' });
    expect(quakes.find((q) => q.id === 'fx9')!.tsunami).toBe(true);
    // newest first
    expect(quakes[0].time).toBeGreaterThanOrEqual(quakes[1].time);
    const meta = (await store.get<FeedMeta>(metaKey(key)))!;
    expect(meta).toMatchObject({ ok: true, recordCount: 6, source: 'USGS' });
  });
});

describe('seed framework', () => {
  const job = (data: unknown[], opts: Partial<SeedJob<unknown[]>> = {}): SeedJob<unknown[]> => ({
    id: 't',
    feed: 'seismic',
    tier: 'fast',
    intervalMin: 5,
    run: async () => data,
    validate: (d, prev) => validateList(d, prev, { min: 1 }),
    ...opts,
  });

  it('keeps last-good data when an update is rejected', async () => {
    await runSeed(job([1, 2, 3]), store, 1000);
    const r = await runSeed(job([]), store, 2000);
    expect(r.outcome).toBe('invalid');
    expect(await store.get(key)).toEqual([1, 2, 3]);
    const meta = (await store.get<FeedMeta>(metaKey(key)))!;
    expect(meta.fetchedAt).toBe(1000); // last good
    expect(meta.lastAttemptAt).toBe(2000);
    expect(meta.ok).toBe(false);
    expect(meta.error).toMatch(/only 0 records/);
  });

  it('keeps last-good data when the upstream throws', async () => {
    await runSeed(job([1]), store, 1000);
    const r = await runSeed(job([], { run: async () => { throw new Error('boom key=secret123'); } }), store, 2000);
    expect(r.outcome).toBe('error');
    expect(await store.get(key)).toEqual([1]);
    const meta = (await store.get<FeedMeta>(metaKey(key)))!;
    expect(meta.error).toContain('boom');
    expect(meta.error).not.toContain('secret123');
  });

  it('refuses to run while another run holds the lock', async () => {
    await store.set(`wt:lock:${key}`, 'other', { nx: true, ex: 60 });
    const r = await runSeed(job([1]), store);
    expect(r.outcome).toBe('locked');
    expect(await store.get(key)).toBeNull();
  });

  it('releases the lock afterwards', async () => {
    await runSeed(job([1]), store);
    expect(await store.get(`wt:lock:${key}`)).toBeNull();
  });

  it('rejects a dataset that collapses', () => {
    const prev = Array.from({ length: 100 }, (_, i) => i);
    expect(validateList([1, 2], prev, { maxDropRatio: 0.8 }).ok).toBe(false);
    expect(validateList(prev.slice(0, 50), prev, { maxDropRatio: 0.8 }).ok).toBe(true);
  });

  it('marks unconfigured jobs as skipped without touching data', async () => {
    const r = await runSeed(job([1], { requiresEnv: ['WT_TEST_MISSING_ENV'] }), store);
    expect(r.outcome).toBe('skipped');
    const meta = (await store.get<FeedMeta>(metaKey(key)))!;
    expect(meta.error).toMatch(/WT_TEST_MISSING_ENV/);
  });
});

describe('dispatcher', () => {
  it('respects each job interval', async () => {
    const t0 = 1_000_000_000_000;
    const a = await runTier('fast', store, { now: t0 });
    expect(a.results.find((r) => r.job === 'usgs')?.outcome).toBe('ok');
    const b = await runTier('fast', store, { now: t0 + 60_000 });
    expect(b.results.find((r) => r.job === 'usgs')).toBeUndefined();
    const c = await runTier('fast', store, { now: t0 + 5 * 60_000 });
    expect(c.results.find((r) => r.job === 'usgs')).toBeDefined();
  });
});

describe('bootstrap + health', () => {
  it('returns seeded data to members and withholds member-only keys from free users', async () => {
    await runSeed(usgsJob, store);
    const member = await buildBootstrap(store, 'fast', { uid: 'm', email: null, tier: 'member' });
    expect((member.data.seismic as Quake[]).length).toBe(6);
    expect(member.meta.seismic?.ok).toBe(true);
    expect(member.locked).toEqual([]);

    const free = await buildBootstrap(store, 'fast', { uid: 'f', email: null, tier: 'free' });
    expect(free.data.seismic).toBeDefined(); // seismic is a free teaser layer
    expect(free.data.conflict).toBeUndefined();
    expect(free.locked).toContain('conflict');
  });

  it('reports OK / STALE / EMPTY per feed', async () => {
    const now = Date.now();
    await runSeed(usgsJob, store, now - 60 * 60000); // 60 min old; seismic maxStale = 20
    const health = await computeHealth(store, now);
    expect(health.find((f) => f.id === 'seismic')?.status).toBe('STALE');
    expect(health.find((f) => f.id === 'conflict')?.status).toBe('EMPTY');
    await runSeed(usgsJob, store, now);
    expect((await computeHealth(store, now)).find((f) => f.id === 'seismic')?.status).toBe('OK');
  });
});
