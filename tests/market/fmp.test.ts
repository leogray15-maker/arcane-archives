import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const F = require('../../lib/market/fmp.js');
const P = require('../../lib/market/providers.js');

function fakeFetch(handler: (url: string) => unknown) {
  const calls: string[] = [];
  const fn = async (url: string) => {
    calls.push(url);
    const body = handler(url);
    if (body === undefined) return new Response('{}', { status: 404 });
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 200 });
  };
  return Object.assign(fn, { calls });
}

const q = (symbol: string, price: number, prev: number) => ({
  symbol, price, previousClose: prev, changePercentage: ((price - prev) / prev) * 100,
  open: prev, dayHigh: price + 2, dayLow: prev - 2, volume: 1000, timestamp: 1759390000,
});

afterEach(() => { delete process.env.FMP_API_KEY; delete process.env.FMP_SYMBOL_MAP; });

describe('FMP quotes', () => {
  it('maps a batch quote back to our keys and lists what was missing', async () => {
    const f = fakeFetch(() => [q('XAUUSD', 4178.5, 4185), q('^GSPC', 6712, 6690)]);
    const out = await F.fmpQuotes(['XAU', 'SPX', 'VIX'], { apiKey: 'k', fetch: f });
    expect(out.data.XAU).toMatchObject({ price: 4178.5, high: 4180.5, low: 4183, prevClose: 4185, src: 'fmp' });
    expect(out.data.SPX.change).toBeCloseTo(0.3288, 3);
    expect(out.missing).toEqual(['VIX']);
    expect(f.calls[0]).toContain('/stable/batch-quote?symbols=' + encodeURIComponent('XAUUSD,^GSPC,^VIX'));
  });

  it('reports a plan or key error instead of returning data', async () => {
    const f = fakeFetch(() => ({ 'Error Message': 'Invalid API KEY.' }));
    const out = await F.fmpQuotes(['XAU'], { apiKey: 'bad', fetch: f });
    expect(out.data).toEqual({});
    expect(out.error).toMatch(/Invalid API KEY/);
  });
});

describe('FMP candles', () => {
  it('converts New York timestamps to UTC (EDT and EST)', () => {
    expect(F.nyToUtc('2026-10-01 12:00:00')).toBe(Date.UTC(2026, 9, 1, 16));
    expect(F.nyToUtc('2026-12-01 12:00:00')).toBe(Date.UTC(2026, 11, 1, 17));
    expect(F.nyToUtc('2026-10-01')).toBe(Date.UTC(2026, 9, 1));
  });

  it('returns 4h candles oldest first', async () => {
    const f = fakeFetch(() => [
      { date: '2026-10-01 12:00:00', open: 4180, high: 4190, low: 4170, close: 4178.5, volume: 0 },
      { date: '2026-10-01 08:00:00', open: 4170, high: 4185, low: 4165, close: 4180, volume: 0 },
    ]);
    const r = await F.fmpCandles('XAU', '4h', { apiKey: 'k', fetch: f, now: Date.UTC(2026, 9, 2) });
    expect(r.ok).toBe(true);
    expect(r.candles.map((c: { c: number }) => c.c)).toEqual([4180, 4178.5]);
    expect(f.calls[0]).toContain('/stable/historical-chart/4hour?symbol=XAUUSD&from=');
  });

  it('builds weekly bars from daily ones', () => {
    const d = (day: number, o: number, h: number, l: number, c: number) => ({ t: Date.UTC(2026, 8, day), o, h, l, c, v: 1 });
    const w = F.toWeekly([d(28, 10, 12, 9, 11), d(29, 11, 15, 10, 14), d(30, 14, 14, 8, 9), d(5 + 30, 9, 10, 7, 8)]);
    expect(w).toHaveLength(2);
    expect(w[0]).toMatchObject({ o: 10, h: 15, l: 8, c: 9 });
  });
});

describe('provider choice', () => {
  it('uses FMP for the snapshot and candles when FMP_API_KEY is set', async () => {
    process.env.FMP_API_KEY = 'k';
    const f = fakeFetch((u) => u.includes('financialmodelingprep.com/stable/batch-quote') ? [q('XAUUSD', 4178.5, 4185)]
      : u.includes('historical-chart') ? Array.from({ length: 80 }, (_, i) => ({ date: `2026-09-${String(1 + (i % 28)).padStart(2, '0')} 08:00:00`, open: 1, high: 2, low: 0.5, close: 1.5 })) : undefined);
    const s = await P.snapshot({ fetch: f });
    expect(s.meta.provider).toBe('fmp');
    expect(s.data.XAU.src).toBe('fmp');
    const c = await P.candles('XAUUSD', '4h', { fetch: f });
    expect(c.ok).toBe(true);
    expect(c.src).toBe('fmp');
    expect(f.calls.some((u) => u.includes('twelvedata'))).toBe(false);
  });
});
