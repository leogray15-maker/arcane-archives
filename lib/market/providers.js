/**
 * lib/market/providers.js — server-side market data for /api/markets and /api/candles.
 * The Arcane Archives
 *
 * Primary:  FMP (FMP_API_KEY) when set, otherwise Twelve Data (TWELVEDATA_API_KEY)
 *           → metals, FX, energy, indices, crypto quotes (day open/high/low/
 *           prev close) and OHLC candles. See lib/market/fmp.js.
 * Backups (free, no key, used only for what Twelve Data did not return):
 *   • CBOE delayed quotes  → VIX, S&P 500, Nasdaq 100, Dow (15 min delayed).
 *   • US Treasury          → official daily par yields (2Y, 10Y, 30Y).
 *   • DXY is derived from Twelve Data FX with ICE's published formula when no
 *     direct index quote is available, so it is never a guess.
 *
 * Nothing here invents a number: an instrument no source returned is simply
 * absent from the payload and the pages show "—".
 */
'use strict';

const fmp = require('./fmp');

const TD = 'https://api.twelvedata.com';
const UA = 'Mozilla/5.0 (compatible; ArcaneArchives/1.0; +https://thearcanearchives.com)';

// internal key -> Twelve Data symbol. TWELVEDATA_SYMBOL_MAP (JSON) can override
// any entry, e.g. {"FTSE":"FTSE"} if your plan lists the index under another name.
const TD_SYMBOLS = {
  XAU: 'XAU/USD', XAG: 'XAG/USD', XPT: 'XPT/USD',
  WTI: 'WTI/USD', BRENT: 'XBR/USD', NATGAS: 'NG/USD', COPPER: 'XCU/USD',
  EURUSD: 'EUR/USD', GBPUSD: 'GBP/USD', USDJPY: 'USD/JPY', AUDUSD: 'AUD/USD',
  USDCAD: 'USD/CAD', USDCHF: 'USD/CHF', USDSEK: 'USD/SEK', EURGBP: 'EUR/GBP',
  BTC: 'BTC/USD', ETH: 'ETH/USD', SOL: 'SOL/USD',
  SPX: 'SPX', NDQ: 'NDX', DOW: 'DJI', FTSE: 'UKX', VIX: 'VIX', DXY: 'DXY',
};

function tdSymbols() {
  try {
    const extra = JSON.parse(process.env.TWELVEDATA_SYMBOL_MAP || '{}');
    return { ...TD_SYMBOLS, ...extra };
  } catch (e) { return { ...TD_SYMBOLS }; }
}

function tdKey() {
  return process.env.TWELVEDATA_API_KEY || process.env.TWELVE_DATA_API_KEY || '';
}

function num(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function pct(price, prev) {
  return price != null && prev ? ((price - prev) / prev) * 100 : null;
}

async function getJson(url, fetchImpl, timeoutMs) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs || 9000);
  try {
    const r = await (fetchImpl || fetch)(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(tid); }
}

/* ─── Twelve Data quotes ─────────────────────────────────────────────── */

// One quote row → our shape. Returns null for error rows.
function parseTdQuote(row) {
  if (!row || row.status === 'error' || row.code) return null;
  const price = num(row.close);
  if (price == null) return null;
  const prevClose = num(row.previous_close);
  const change = num(row.percent_change);
  return {
    price,
    change: change != null ? change : pct(price, prevClose),
    open: num(row.open),
    high: num(row.high),
    low: num(row.low),
    prevClose,
    volume: num(row.volume),
    ts: row.timestamp ? Number(row.timestamp) * 1000 : (row.last_quote_at ? Number(row.last_quote_at) * 1000 : null),
    marketOpen: typeof row.is_market_open === 'boolean' ? row.is_market_open : null,
    src: 'twelvedata',
  };
}

// Batched /quote. Multi-symbol responses are keyed by symbol; a single
// symbol comes back as the row itself.
async function tdQuotes(keys, opts) {
  const o = opts || {};
  const apiKey = o.apiKey != null ? o.apiKey : tdKey();
  const map = o.symbols || tdSymbols();
  const out = { data: {}, missing: [], error: null };
  if (!apiKey) { out.error = 'no_api_key'; return out; }
  const wanted = keys.filter((k) => map[k]);
  if (!wanted.length) return out;
  const syms = [...new Set(wanted.map((k) => map[k]))];
  let j;
  try {
    j = await getJson(`${TD}/quote?symbol=${encodeURIComponent(syms.join(','))}&apikey=${encodeURIComponent(apiKey)}`, o.fetch);
  } catch (e) { out.error = 'fetch_failed'; out.missing = wanted; return out; }
  if (j && j.status === 'error') { out.error = j.message || ('code ' + j.code); out.missing = wanted; return out; }
  wanted.forEach((k) => {
    const s = map[k];
    const row = syms.length === 1 ? j : j && j[s];
    const q = parseTdQuote(row);
    if (q) out.data[k] = q; else out.missing.push(k);
  });
  return out;
}

/* ─── DXY from FX (ICE U.S. Dollar Index formula) ─────────────────────── */
// DXY = 50.14348112 × EURUSD^-0.576 × USDJPY^0.136 × GBPUSD^-0.119
//       × USDCAD^0.091 × USDSEK^0.042 × USDCHF^0.036
const DXY_W = [['EURUSD', -0.576], ['USDJPY', 0.136], ['GBPUSD', -0.119], ['USDCAD', 0.091], ['USDSEK', 0.042], ['USDCHF', 0.036]];
function dxyFrom(field, fx) {
  let v = 50.14348112;
  for (const [k, w] of DXY_W) {
    const x = fx[k] && fx[k][field];
    if (x == null || !(x > 0)) return null;
    v *= Math.pow(x, w);
  }
  return v;
}
function deriveDxy(fx) {
  const price = dxyFrom('price', fx);
  if (price == null) return null;
  const prevClose = dxyFrom('prevClose', fx);
  return {
    price, change: pct(price, prevClose), prevClose,
    open: dxyFrom('open', fx), high: null, low: null, volume: null,
    ts: Math.min(...DXY_W.map(([k]) => fx[k].ts || Date.now())),
    src: 'derived-fx',
  };
}

/* ─── CBOE delayed index quotes (free, no key) ────────────────────────── */
const CBOE = 'https://cdn.cboe.com/api/global/delayed_quotes/quotes/';
const CBOE_SYMBOLS = { VIX: ['_VIX', 1], SPX: ['_SPX', 1], NDQ: ['_NDX', 1], DOW: ['_DJX', 100] };

function parseCboe(j, scale) {
  const d = j && j.data;
  const price = d && num(d.current_price);
  if (price == null) return null;
  const s = scale || 1;
  const prev = num(d.prev_day_close);
  const change = num(d.price_change_percent);
  return {
    price: price * s,
    change: change != null ? change : pct(price, prev),
    open: num(d.open) != null ? num(d.open) * s : null,
    high: num(d.high) != null ? num(d.high) * s : null,
    low: num(d.low) != null ? num(d.low) * s : null,
    prevClose: prev != null ? prev * s : null,
    volume: null,
    ts: null,
    asOf: d.last_trade_time ? String(d.last_trade_time).replace('T', ' ') + ' ET' : null,
    delayed: true,
    src: 'cboe',
  };
}

async function cboeQuotes(keys, opts) {
  const o = opts || {};
  const out = {};
  await Promise.all(keys.filter((k) => CBOE_SYMBOLS[k]).map(async (k) => {
    const [sym, scale] = CBOE_SYMBOLS[k];
    try {
      const q = parseCboe(await getJson(CBOE + sym + '.json', o.fetch), scale);
      if (q) out[k] = q;
    } catch (e) { /* leave missing */ }
  }));
  return out;
}

/* ─── US Treasury daily par yields (free, no key) ─────────────────────── */
function treasuryUrl(year) {
  return 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/' +
    year + '/all?type=daily_treasury_yield_curve&field_tdr_date_value=' + year + '&page&_format=csv';
}

function splitCsv(line) { return line.split(',').map((c) => c.replace(/^"|"$/g, '').trim()); }

// Rows come newest first. Returns { US2Y, US10Y, US30Y } with % change and bp change.
function parseTreasuryCsv(text) {
  const lines = String(text || '').trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return {};
  const head = splitCsv(lines[0]);
  const rows = lines.slice(1).map(splitCsv)
    .map((r) => ({ date: r[0], r }))
    .filter((x) => !isNaN(Date.parse(x.date)))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  if (!rows.length) return {};
  const col = { US2Y: '2 Yr', US10Y: '10 Yr', US30Y: '30 Yr' };
  const out = {};
  Object.entries(col).forEach(([k, name]) => {
    const i = head.indexOf(name);
    if (i < 0) return;
    const vals = rows.map((x) => ({ date: x.date, v: num(x.r[i]) })).filter((x) => x.v != null);
    if (!vals.length) return;
    const cur = vals[0], prev = vals[1];
    out[k] = {
      price: cur.v,
      change: prev ? pct(cur.v, prev.v) : null,
      chgBp: prev ? Math.round((cur.v - prev.v) * 100) : null,
      prevClose: prev ? prev.v : null,
      open: null, high: null, low: null, volume: null,
      ts: Date.parse(cur.date + ' 16:00 GMT-0400') || null,
      asOf: cur.date,
      daily: true,
      src: 'us-treasury',
    };
  });
  return out;
}

async function treasuryYields(opts) {
  const o = opts || {};
  const year = (o.now ? new Date(o.now) : new Date()).getUTCFullYear();
  const get = async (y) => {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 9000);
    try {
      const r = await (o.fetch || fetch)(treasuryUrl(y), { headers: { 'User-Agent': UA }, signal: ctrl.signal });
      return r.ok ? await r.text() : '';
    } catch (e) { return ''; } finally { clearTimeout(tid); }
  };
  let out = parseTreasuryCsv(await get(year));
  // First trading days of January: the new year's file has 0-1 rows.
  if (!out.US10Y || out.US10Y.change == null) {
    const prevYear = parseTreasuryCsv(await get(year - 1));
    if (!out.US10Y) out = prevYear;
    else Object.keys(out).forEach((k) => {
      const p = prevYear[k];
      if (p && out[k].change == null) {
        out[k].prevClose = p.price;
        out[k].change = pct(out[k].price, p.price);
        out[k].chgBp = Math.round((out[k].price - p.price) * 100);
      }
    });
  }
  return out;
}

/* ─── Crypto market overview (CoinPaprika, free) ──────────────────────── */
async function cryptoGlobal(opts) {
  const o = opts || {};
  const out = { crypto: null, global: null };
  try {
    const g = await getJson('https://api.coinpaprika.com/v1/global', o.fetch);
    out.global = {
      totalMcap: g.market_cap_usd, totalVol: g.volume_24h_usd,
      btcDom: g.bitcoin_dominance_percentage, coins: g.cryptocurrencies_number,
      change: g.market_cap_change_24h != null ? g.market_cap_change_24h : null,
    };
  } catch (e) { /* optional */ }
  try {
    const t = await getJson('https://api.coinpaprika.com/v1/tickers/btc-bitcoin', o.fetch);
    const q = t && t.quotes && t.quotes.USD;
    if (q) out.crypto = { btcMcap: q.market_cap, btcVol: q.volume_24h };
  } catch (e) { /* optional */ }
  return out;
}

/* ─── Which paid feed is primary ─────────────────────────────────────── */
// FMP wins when its key is set; tests pass `provider` explicitly.
function primary(o) {
  if (o.provider) return o.provider;
  if (o.apiKey == null && fmp.fmpKey()) return 'fmp';
  return 'twelvedata';
}

/* ─── Snapshot: everything the pages need, best source first ─────────── */
async function snapshot(opts) {
  const o = opts || {};
  const prov = primary(o);
  const keys = Object.keys(o.symbols || (prov === 'fmp' ? fmp.fmpSymbols() : tdSymbols()));
  const quotes = prov === 'fmp' ? fmp.fmpQuotes : tdQuotes;
  const [td, yields, extras] = await Promise.all([quotes(keys, o), treasuryYields(o), cryptoGlobal(o)]);
  const data = { ...td.data };

  if (!data.DXY) {
    const dxy = deriveDxy(data);
    if (dxy) data.DXY = dxy;
  }
  const cboeWant = Object.keys(CBOE_SYMBOLS).filter((k) => !data[k]);
  if (cboeWant.length) Object.assign(data, await cboeQuotes(cboeWant, o));
  Object.entries(yields).forEach(([k, v]) => { if (!data[k]) data[k] = v; });

  const sources = {};
  Object.entries(data).forEach(([k, v]) => { (sources[v.src] = sources[v.src] || []).push(k); });
  return {
    data,
    crypto: extras.crypto,
    global: extras.global,
    meta: {
      provider: prov,
      keySet: !!(o.apiKey != null ? o.apiKey : (prov === 'fmp' ? fmp.fmpKey() : tdKey())),
      error: td.error,
      missing: keys.filter((k) => !data[k]),
      sources,
      total: Object.keys(data).length,
      at: Date.now(),
    },
  };
}

/* ─── Candles ────────────────────────────────────────────────────────── */
const INTERVALS = { '1min': 30, '5min': 60, '15min': 120, '30min': 180, '1h': 300, '4h': 600, '1day': 1800, '1week': 3600 };

// Pages use their watchlist names; map them to our keys.
const PAGE_SYMBOLS = {
  XAUUSD: 'XAU', XAGUSD: 'XAG', BTCUSD: 'BTC', ETHUSD: 'ETH', SOLUSD: 'SOL',
  SPX500: 'SPX', NAS100: 'NDQ', US30: 'DOW', USOIL: 'WTI', UKOIL: 'BRENT',
  GBPUSD: 'GBPUSD', EURUSD: 'EURUSD', USDJPY: 'USDJPY', AUDUSD: 'AUDUSD',
  USDCAD: 'USDCAD', USDCHF: 'USDCHF', EURGBP: 'EURGBP', DXY: 'DXY', VIX: 'VIX',
};

function parseTdSeries(j) {
  if (!j || j.status === 'error' || !Array.isArray(j.values)) return null;
  const rows = j.values.map((v) => ({
    t: Date.parse(String(v.datetime).replace(' ', 'T') + (String(v.datetime).length > 10 ? 'Z' : 'T00:00:00Z')),
    o: num(v.open), h: num(v.high), l: num(v.low), c: num(v.close), v: num(v.volume),
  })).filter((r) => Number.isFinite(r.t) && r.o != null && r.h != null && r.l != null && r.c != null);
  rows.sort((a, b) => a.t - b.t);
  return rows;
}

async function candles(pageSym, interval, opts) {
  const o = opts || {};
  const key = PAGE_SYMBOLS[pageSym] || pageSym;
  if (!INTERVALS[interval]) return { ok: false, reason: 'bad_interval' };
  if (primary(o) === 'fmp') {
    const r = await fmp.fmpCandles(key, interval, o);
    return r.ok ? { ok: true, symbol: pageSym, interval, src: r.src, candles: r.candles } : r;
  }
  const map = o.symbols || tdSymbols();
  const tdSym = map[key];
  if (!tdSym) return { ok: false, reason: 'unknown_symbol' };
  const apiKey = o.apiKey != null ? o.apiKey : tdKey();
  if (!apiKey) return { ok: false, reason: 'no_api_key' };
  const size = Math.max(50, Math.min(500, parseInt(o.size, 10) || 200));
  let j;
  try {
    j = await getJson(`${TD}/time_series?symbol=${encodeURIComponent(tdSym)}&interval=${interval}&outputsize=${size}&timezone=UTC&apikey=${encodeURIComponent(apiKey)}`, o.fetch, 12000);
  } catch (e) { return { ok: false, reason: 'fetch_failed' }; }
  const rows = parseTdSeries(j);
  if (!rows || !rows.length) return { ok: false, reason: (j && j.message) ? 'provider_error' : 'no_data', message: j && j.message };
  return { ok: true, symbol: pageSym, interval, src: 'twelvedata', candles: rows };
}

module.exports = {
  TD_SYMBOLS, CBOE_SYMBOLS, INTERVALS, PAGE_SYMBOLS,
  parseTdQuote, tdQuotes, deriveDxy, parseCboe, cboeQuotes,
  parseTreasuryCsv, treasuryYields, cryptoGlobal, snapshot,
  parseTdSeries, candles,
};
