// Smoke test: seeds a store from fixtures, then hits bootstrap and health
// through the same router the Vercel function uses.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { FEEDS } from '../../shared/watchtower/feeds';
import type { BootstrapResponse, HealthResponse } from '../../shared/watchtower/types';
import { installFixtureFetch } from '../../lib/watchtower/dev/fixture-fetch';
import { runTier } from '../../lib/watchtower/seed/registry';
import { handle } from '../../lib/watchtower/routes';
import { MemoryStore } from '../../lib/watchtower/store';

const store = new MemoryStore();
let restore: () => void;
const get = (route: string, token?: string, query: Record<string, string> = {}) =>
  handle({ method: 'GET', route, query, headers: token ? { authorization: `Bearer ${token}` } : {} }, store);

beforeAll(async () => {
  process.env.WT_DEV_AUTH_BYPASS = '1';
  process.env.CRON_SECRET = 'smoke-secret';
  for (const k of ['NASA_FIRMS_MAP_KEY', 'UCDP_ACCESS_TOKEN', 'FRED_API_KEY', 'GROQ_API_KEY']) process.env[k] = 'fixture';
  restore = installFixtureFetch(join(__dirname, 'fixtures'));
  for (const tier of ['daily', 'slow', 'medium', 'fast', 'slow'] as const) await runTier(tier, store, { force: true });
});
afterAll(() => restore());

describe('smoke: bootstrap + health', () => {
  it('bootstrap requires a token', async () => {
    expect((await get('bootstrap')).status).toBe(401);
  });

  it('serves both tiers to a member with every visible key present', async () => {
    for (const tier of ['fast', 'slow'] as const) {
      const r = await get('bootstrap', 'dev-member', { tier });
      expect(r.status).toBe(200);
      expect(r.headers['Cache-Control']).toMatch(/^private/);
      expect(r.headers.ETag).toBeTruthy();
      const body = r.body as BootstrapResponse;
      const expected = FEEDS.filter((f) => f.boot === tier && !f.internal).map((f) => f.id);
      expect(Object.keys(body.data).sort()).toEqual(expected.sort());
      for (const id of expected) expect(body.data[id], id).not.toBeNull();
    }
  });

  it('health is all OK after seeding, and hides details from the public', async () => {
    const pub = (await get('health')).body as HealthResponse;
    expect(pub.status).toBe('ok');
    expect(pub.feeds).toBeUndefined();
    const admin = (await get('health', 'dev-admin')).body as HealthResponse;
    expect(admin.feeds!.every((f) => f.status === 'OK')).toBe(true);
  });

  it('cron requires the secret', async () => {
    expect((await handle({ method: 'GET', route: 'cron/fast', query: {}, headers: {} }, store)).status).toBe(401);
    const ok = await handle({ method: 'GET', route: 'cron/fast', query: {}, headers: { authorization: 'Bearer smoke-secret' } }, store);
    expect(ok.status).toBe(200);
  });

  it('admin routes are admin-only', async () => {
    expect((await get('admin/status', 'dev-member')).status).toBe(403);
    expect((await get('admin/status', 'dev-admin')).status).toBe(200);
  });
});
