// The Watchtower must run with no service account, no Redis and no scheduler:
// ID tokens verify against Google's public certs, and the first bootstrap seeds.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync, createSign } from 'node:crypto';
import { join } from 'node:path';
import { verifyIdToken, loadUserWithToken } from '../../lib/watchtower/http/firebase-lite';
import { installFixtureFetch } from '../../lib/watchtower/dev/fixture-fetch';
import { ensureFresh } from '../../lib/watchtower/seed/lazy';
import { MemoryStore } from '../../lib/watchtower/store';

const PID = 'arcane-archives-3b0f5';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

function sign(claims: Record<string, unknown>, kid = 'k1') {
  const head = b64({ alg: 'RS256', kid });
  const body = b64(claims);
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(privateKey).toString('base64url');
  return `${head}.${body}.${sig}`;
}

const now = Date.UTC(2026, 8, 26, 12);
const sec = now / 1000;
const good = { aud: PID, iss: `https://securetoken.google.com/${PID}`, sub: 'u1', email: 'a@b.c', iat: sec - 10, exp: sec + 3600 };

describe('firebase-lite token verification', () => {
  beforeAll(() => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('securetoken')) return new Response(JSON.stringify({ k1: pem }), { headers: { 'cache-control': 'max-age=600' } });
      if (url.includes('firestore')) return new Response(JSON.stringify({ fields: { isPaid: { booleanValue: true } } }));
      return new Response('', { status: 404 });
    }));
  });
  afterAll(() => vi.unstubAllGlobals());

  it('accepts a valid token', async () => {
    const out = await verifyIdToken(sign(good), PID, now);
    expect(out.uid).toBe('u1');
    expect(out.email).toBe('a@b.c');
  });

  it('rejects wrong audience, expiry, unknown key and tampering', async () => {
    await expect(verifyIdToken(sign({ ...good, aud: 'other' }), PID, now)).rejects.toThrow(/audience/);
    await expect(verifyIdToken(sign({ ...good, exp: sec - 600 }), PID, now)).rejects.toThrow(/expired/);
    await expect(verifyIdToken(sign(good, 'nope'), PID, now)).rejects.toThrow(/key id/);
    const [h, , s] = sign(good).split('.');
    await expect(verifyIdToken(`${h}.${b64({ ...good, sub: 'admin' })}.${s}`, PID, now)).rejects.toThrow(/signature/);
  });

  it('reads membership fields from Firestore REST', async () => {
    expect(await loadUserWithToken('u1', 't', PID)).toEqual({ isPaid: true, subscriptionStatus: null });
  });
});

describe('lazy seeding', () => {
  let restore: () => void;
  beforeAll(() => {
    restore = installFixtureFetch(join(__dirname, 'fixtures'));
  });
  afterEach(() => undefined);
  afterAll(() => restore());

  it('seeds an empty store on the first request, then waits for the interval', async () => {
    const store = new MemoryStore();
    await ensureFresh(store);
    expect(await store.get('wt:seismic:v1')).not.toBeNull();
    const last = await store.get<number>('wt:lazy:last');
    await ensureFresh(store);
    expect(await store.get<number>('wt:lazy:last')).toBe(last);
  });
});

describe('World Brief without an AI key', () => {
  it('falls back to a cited digest of the top stories', async () => {
    const { headlineDigest } = await import('../../lib/watchtower/seed/jobs/ai');
    const mk = (title: string, source: string, corroboration = 1) =>
      ({ id: title, title, source, link: `https://x/${title}`, time: now, score: 1, corroboration, groups: [], clusterSources: [] }) as any;
    const b = headlineDigest([mk('Alpha happens.', 'BBC', 3), mk('Beta', 'DW'), mk('Gamma', 'AP')], now);
    expect(b.provider).toBe('digest');
    expect(b.paragraphs[0]).toBe('Top story: Alpha happens (BBC, +2 more) [1].');
    expect(b.paragraphs[1]).toBe('Also tracking: Beta (DW) [2]. Gamma (AP) [3].');
    expect(b.citations.map((c) => c.n)).toEqual([1, 2, 3]);
  });
});
