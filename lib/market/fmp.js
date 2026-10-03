/**
 * lib/market/fmp.js — Financial Modeling Prep (FMP) quotes and candles.
 * Used instead of Twelve Data whenever FMP_API_KEY is set in Vercel.
 * Same output shape as the Twelve Data helpers in providers.js.
 */
'use strict';

const FMP = 'https://financialmodelingprep.com/stable';
const UA = 'Mozilla/5.0 (compatible; ArcaneArchives/1.0)';

// internal key -> FMP symbol. FMP_SYMBOL_MAP (JSON) can override any entry,
// e.g. {"XAU":"GCUSD"} to show gold futures instead of spot.
const FMP_SYMBOLS = {
  XAU: 'XAUUSD', XAG: 'XAGUSD', XPT: 'PLUSD',
  WTI: 'CLUSD', BRENT: 'BZUSD', NATGAS: 'NGUSD', COPPER: 'HGUSD',
  EURUSD: 'EURUSD', GBPUSD: 'GBPUSD', USDJPY: 'USDJPY', AUDUSD: 'AUDUSD',
  USDCAD: 'USDCAD', USDCHF: 'USDCHF', USDSEK: 'USDSEK', EURGBP: 'EURGBP',
  BTC: 'BTCUSD', ETH: 'ETHUSD', SOL: 'SOLUSD',
  SPX: '^GSPC', NDQ: '^NDX', DOW: '^DJI', FTSE: '^FTSE', VIX: '^VIX', DXY: 'DXUSD',
};

function fmpSymbols() {
  try { return { ...FMP_SYMBOLS, ...JSON.parse(process.env.FMP_SYMBOL_MAP || '{}') }; }
  catch (e) { return { ...FMP_SYMBOLS }; }
}
function fmpKey() { return process.env.FMP_API_KEY || ''; }

function num(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

async function getJson(url, fetchImpl, timeoutMs) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs || 9000);
  try {
    const r = await (fetchImpl || fetch)(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctrl.signal });
    const j = await r.json().catch(() => null);
    if (!r.ok) { const e = new Error((j && (j['Error Message'] || j.message)) || 'HTTP ' + r.status); e.status = r.status; throw e; }
    return j;
  } finally { clearTimeout(tid); }
}

function parseFmpQuote(row) {
  const price = row && num(row.price);
  if (price == null) return null;
  const prevClose = num(row.previousClose);
  const chg = num(row.changePercentage != null ? row.changePercentage : row.changesPercentage);
  return {
    price,
    change: chg != null ? chg : (prevClose ? ((price - prevClose) / prevClose) * 100 : null),
    open: num(row.open), high: num(row.dayHigh), low: num(row.dayLow),
    prevClose, volume: num(row.volume),
    ts: row.timestamp ? Number(row.timestamp) * 1000 : null,
    src: 'fmp',
  };
}

async function fmpQuotes(keys, opts) {
  const o = opts || {};
  const apiKey = o.apiKey != null ? o.apiKey : fmpKey();
  const map = o.symbols || fmpSymbols();
  const out = { data: {}, missing: [], error: null };
  if (!apiKey) { out.error = 'no_api_key'; return out; }
  const wanted = keys.filter((k) => map[k]);
  const syms = [...new Set(wanted.map((k) => map[k]))];
  let rows;
  try {
    rows = await getJson(`${FMP}/batch-quote?symbols=${encodeURIComponent(syms.join(','))}&apikey=${encodeURIComponent(apiKey)}`, o.fetch);
  } catch (e) { out.error = e.message || 'fetch_failed'; out.missing = wanted; return out; }
  if (!Array.isArray(rows)) { out.error = (rows && (rows['Error Message'] || rows.message)) || 'bad_response'; out.missing = wanted; return out; }
  const bySym = {};
  rows.forEach((r) => { if (r && r.symbol) bySym[String(r.symbol).toUpperCase()] = r; });
  wanted.forEach((k) => {
    const q = parseFmpQuote(bySym[map[k].toUpperCase()]);
    if (q) out.data[k] = q; else out.missing.push(k);
  });
  return out;
}

/* ─── Candles ─── */
// FMP intraday timestamps are New York exchange time; convert to UTC.
function nyToUtc(s) {
  const m = /^(\d{4})-(\d\d)-(\d\d)(?:[ T](\d\d):(\d\d)(?::(\d\d))?)?/.exec(String(s));
  if (!m) return NaN;
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  if (!m[4]) return asUtc;                 // daily bars: keep the date at 00:00 UTC
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(asUtc)).reduce((a, p) => { a[p.type] = p.value; return a; }, {});
  const nyAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc + (asUtc - nyAsUtc);        // add New York's offset from UTC
}

function parseFmpSeries(j) {
  const arr = Array.isArray(j) ? j : (j && Array.isArray(j.historical) ? j.historical : null);
  if (!arr) return null;
  const rows = arr.map((v) => ({ t: nyToUtc(v.date), o: num(v.open), h: num(v.high), l: num(v.low), c: num(v.close), v: num(v.volume) }))
    .filter((r) => Number.isFinite(r.t) && r.o != null && r.h != null && r.l != null && r.c != null);
  rows.sort((a, b) => a.t - b.t);
  return rows;
}

// Weekly bars built from daily ones (weeks start Monday, UTC).
function toWeekly(daily) {
  const out = [];
  daily.forEach((d) => {
    const day = new Date(d.t).getUTCDay();
    const wk = d.t - ((day + 6) % 7) * 86400000;
    const last = out[out.length - 1];
    if (last && last.t === wk) { last.h = Math.max(last.h, d.h); last.l = Math.min(last.l, d.l); last.c = d.c; last.v = (last.v || 0) + (d.v || 0); }
    else out.push({ t: wk, o: d.o, h: d.h, l: d.l, c: d.c, v: d.v });
  });
  return out;
}

const FMP_INTRADAY = { '1min': ['1min', 1], '5min': ['5min', 5], '15min': ['15min', 15], '30min': ['30min', 30], '1h': ['1hour', 60], '4h': ['4hour', 240] };

async function fmpCandles(key, interval, opts) {
  const o = opts || {};
  const map = o.symbols || fmpSymbols();
  const sym = map[key];
  if (!sym) return { ok: false, reason: 'unknown_symbol' };
  const apiKey = o.apiKey != null ? o.apiKey : fmpKey();
  if (!apiKey) return { ok: false, reason: 'no_api_key' };
  const size = Math.max(50, Math.min(500, parseInt(o.size, 10) || 200));
  const now = o.now || Date.now();
  const day = (t) => new Date(t).toISOString().slice(0, 10);
  let url;
  if (FMP_INTRADAY[interval]) {
    const [fi, mins] = FMP_INTRADAY[interval];
    const from = now - Math.ceil(size * mins * 60000 * 1.6) - 3 * 86400000;   // room for weekends
    url = `${FMP}/historical-chart/${fi}?symbol=${encodeURIComponent(sym)}&from=${day(from)}&to=${day(now)}&apikey=${encodeURIComponent(apiKey)}`;
  } else if (interval === '1day' || interval === '1week') {
    const days = interval === '1day' ? size * 1.6 : size * 7.5;
    url = `${FMP}/historical-price-eod/full?symbol=${encodeURIComponent(sym)}&from=${day(now - days * 86400000)}&to=${day(now)}&apikey=${encodeURIComponent(apiKey)}`;
  } else return { ok: false, reason: 'bad_interval' };
  let j;
  try { j = await getJson(url, o.fetch, 12000); }
  catch (e) { return { ok: false, reason: e.status ? 'provider_error' : 'fetch_failed', message: e.message }; }
  let rows = parseFmpSeries(j);
  if (rows && interval === '1week') rows = toWeekly(rows);
  if (!rows || !rows.length) return { ok: false, reason: 'no_data' };
  return { ok: true, src: 'fmp', candles: rows.slice(-size) };
}

module.exports = { FMP_SYMBOLS, fmpKey, fmpSymbols, parseFmpQuote, fmpQuotes, nyToUtc, parseFmpSeries, toWeekly, fmpCandles };
