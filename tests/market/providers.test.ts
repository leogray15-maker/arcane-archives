import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const P = require('../../lib/market/providers.js');

type Handler = (url: string) => { status?: number; body: unknown } | undefined;
function fakeFetch(handler: Handler) {
  const calls: string[] = [];
  const fn = async (url: string) => {
    calls.push(url);
    const hit = handler(url);
    if (!hit) return new Response('not found', { status: 404 });
    const body = typeof hit.body === 'string' ? hit.body : JSON.stringify(hit.body);
    return new Response(body, { status: hit.status ?? 200 });
  };
  return Object.assign(fn, { calls });
}

const tdRow = (close: number, prev: number, extra: Record<string, unknown> = {}) => ({
  symbol: 'X', close: String(close), previous_close: String(prev), percent_change: String(((close - prev) / prev) * 100),
  open: String(prev), high: String(close + 1), low: String(prev - 1), volume: '1200', timestamp: 1759390000, is_market_open: true, ...extra,
});

const TREASURY_CSV = [
  'Date,"1 Mo","2 Yr","5 Yr","10 Yr","30 Yr"',
  '10/01/2026,4.10,3.62,3.70,4.12,4.71',
  '09/30/2026,4.11,3.60,3.69,4.15,4.73',
].join('\n');

afterEach(() => { delete process.env.TWELVEDATA_SYMBOL_MAP; });

describe('Twelve Data quotes', () => {
  it('parses a batched response and reports symbols it did not return', async () => {
    const f = fakeFetch((u) => u.startsWith('https://api.twelvedata.com/quote') ? { body: {
      'XAU/USD': tdRow(4178.5, 4185.0),
      'EUR/USD': tdRow(1.127, 1.125),
      'VIX': { code: 404, status: 'error', message: 'symbol not available on your plan' },
    } } : undefined);
    const out = await P.tdQuotes(['XAU', 'EURUSD', 'VIX'], { apiKey: 'k', fetch: f });
    expect(out.data.XAU.price).toBe(4178.5);
    expect(out.data.XAU.change).toBeCloseTo(-0.1553, 3);
    expect(out.data.XAU.high).toBe(4179.5);
    expect(out.data.XAU.src).toBe('twelvedata');
    expect(out.missing).toEqual(['VIX']);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]).toContain(encodeURIComponent('XAU/USD,EUR/USD,VIX'));
  });

  it('handles a single-symbol response, which is not keyed by symbol', async () => {
    const f = fakeFetch(() => ({ body: tdRow(60.5, 60.0) }));
    const out = await P.tdQuotes(['XAG'], { apiKey: 'k', fetch: f });
    expect(out.data.XAG.price).toBe(60.5);
  });

  it('returns nothing and says why when the key is missing or the plan rejects the call', async () => {
    expect((await P.tdQuotes(['XAU'], { apiKey: '' })).error).toBe('no_api_key');
    const f = fakeFetch(() => ({ body: { code: 429, status: 'error', message: 'You have run out of API credits' } }));
    const out = await P.tdQuotes(['XAU'], { apiKey: 'k', fetch: f });
    expect(out.data).toEqual({});
    expect(out.error).toMatch(/credits/);
  });

  it('lets TWELVEDATA_SYMBOL_MAP override a symbol', async () => {
    process.env.TWELVEDATA_SYMBOL_MAP = '{"FTSE":"FTSE"}';
    const f = fakeFetch(() => ({ body: tdRow(9300, 9280) }));
    await P.tdQuotes(['FTSE'], { apiKey: 'k', fetch: f });
    expect(f.calls[0]).toContain('symbol=FTSE&');
  });
});

describe('DXY from FX', () => {
  it('matches ICE\'s published formula (2 Jan 2024 close ≈ 102.2)', () => {
    const q = (p: number) => ({ price: p, prevClose: p, ts: 1 });
    const dxy = P.deriveDxy({ EURUSD: q(1.094), USDJPY: q(141.97), GBPUSD: q(1.262), USDCAD: q(1.3329), USDSEK: q(10.165), USDCHF: q(0.8505) });
    expect(dxy.price).toBeCloseTo(102.22, 1);
    expect(dxy.src).toBe('derived-fx');
  });
  it('refuses to derive it when any pair is missing', () => {
    expect(P.deriveDxy({ EURUSD: { price: 1.1 } })).toBeNull();
  });
});

describe('free backups', () => {
  it('parses US Treasury yields with basis-point changes', () => {
    const y = P.parseTreasuryCsv(TREASURY_CSV);
    expect(y.US10Y.price).toBe(4.12);
    expect(y.US10Y.chgBp).toBe(-3);
    expect(y.US2Y.price).toBe(3.62);
    expect(y.US30Y.asOf).toBe('10/01/2026');
  });

  it('parses CBOE delayed quotes and scales DJX to the Dow', () => {
    const j = { data: { current_price: 462.1, prev_day_close: 460.0, price_change_percent: 0.4565, open: 460.2, high: 463, low: 459.9, last_trade_time: '2026-10-01T16:15:00' } };
    const q = P.parseCboe(j, 100);
    expect(q.price).toBeCloseTo(46210, 6);
    expect(q.high).toBe(46300);
    expect(q.delayed).toBe(true);
    expect(q.asOf).toBe('2026-10-01 16:15:00 ET');
  });
});

describe('snapshot', () => {
  it('fills gaps from CBOE and the Treasury and derives DXY, never inventing a value', async () => {
    const td: Record<string, unknown> = {
      'XAU/USD': tdRow(4178.5, 4185), 'EUR/USD': tdRow(1.127, 1.125), 'USD/JPY': tdRow(157.9, 158.2),
      'GBP/USD': tdRow(1.3208, 1.319), 'USD/CAD': tdRow(1.38, 1.381), 'USD/SEK': tdRow(9.45, 9.47), 'USD/CHF': tdRow(0.8, 0.801),
      'DXY': { status: 'error', code: 404, message: 'not found' }, 'VIX': { status: 'error', code: 403, message: 'plan' },
    };
    const f = fakeFetch((u) => {
      if (u.startsWith('https://api.twelvedata.com/quote')) return { body: td };
      if (u.endsWith('_VIX.json')) return { body: { data: { current_price: 16.2, prev_day_close: 16.9, price_change_percent: -4.14, open: 16.8, high: 17, low: 16 } } };
      if (u.includes('daily-treasury-rates')) return { body: TREASURY_CSV };
      return undefined;
    });
    const s = await P.snapshot({ apiKey: 'k', fetch: f, now: Date.UTC(2026, 9, 2) });
    expect(s.data.XAU.src).toBe('twelvedata');
    expect(s.data.DXY.src).toBe('derived-fx');
    expect(s.data.VIX.src).toBe('cboe');
    expect(s.data.VIX.price).toBe(16.2);
    expect(s.data.US10Y.src).toBe('us-treasury');
    expect(s.data.SPX).toBeUndefined();          // nothing returned it, so it is absent
    expect(s.meta.missing).toContain('SPX');
    expect(s.meta.keySet).toBe(true);
  });
});

describe('candles', () => {
  it('returns Twelve Data candles oldest first with UTC timestamps', async () => {
    const f = fakeFetch(() => ({ body: { status: 'ok', values: [
      { datetime: '2026-10-01 12:00:00', open: '4180', high: '4190', low: '4170', close: '4178.5', volume: '0' },
      { datetime: '2026-10-01 08:00:00', open: '4170', high: '4185', low: '4165', close: '4180', volume: '0' },
    ] } }));
    const r = await P.candles('XAUUSD', '4h', { apiKey: 'k', fetch: f });
    expect(r.ok).toBe(true);
    expect(r.candles.map((c: { c: number }) => c.c)).toEqual([4180, 4178.5]);
    expect(r.candles[1].t).toBe(Date.UTC(2026, 9, 1, 12));
    expect(f.calls[0]).toContain('symbol=XAU%2FUSD&interval=4h');
  });

  it('rejects unknown symbols and intervals, and says when the key is missing', async () => {
    expect((await P.candles('NOPE', '4h', { apiKey: 'k' })).reason).toBe('unknown_symbol');
    expect((await P.candles('XAUUSD', '3h', { apiKey: 'k' })).reason).toBe('bad_interval');
    expect((await P.candles('XAUUSD', '4h', { apiKey: '' })).reason).toBe('no_api_key');
  });
});
