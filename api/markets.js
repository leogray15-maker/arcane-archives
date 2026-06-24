/**
 * api/markets.js — free, no-key market data proxy (Vercel)
 * The Arcane Archives
 *
 * Sources (all free, NO API key required):
 *  • Yahoo Finance  → indices, commodities, bonds, FX, metals AND crypto
 *                     (price + day % change) via ONE batched quote request.
 *  • CoinPaprika    → crypto market-cap / volume / BTC dominance (optional).
 *
 * Yahoo is queried with its cookie+crumb (now required) in a single batch call
 * so we never fan out 21 parallel requests (which Yahoo throttles). If the
 * batch fails we fall back to the per-symbol chart endpoint. Cached server-side
 * (MARKETS_TTL, default 60s) so visitors share one upstream fetch.
 *
 * Returns: { ok, cached?, data:{ SYM:{price,change} }, crypto:{btcMcap,btcVol},
 *            global:{ totalMcap,totalVol,btcDom,coins,change } }
 */
const Q = 'https://query1.finance.yahoo.com';
const CHART = Q + '/v8/finance/chart/';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';
const TTL = (parseInt(process.env.MARKETS_TTL || '60', 10)) * 1000;

// internal symbol -> Yahoo Finance symbol
const MAP = {
  BTC: 'BTC-USD', ETH: 'ETH-USD', SOL: 'SOL-USD',
  XAU: 'GC=F', XAG: 'SI=F',
  SPX: '^GSPC', NDQ: '^IXIC', DOW: '^DJI', FTSE: '^FTSE', VIX: '^VIX', DXY: 'DX-Y.NYB',
  WTI: 'CL=F', BRENT: 'BZ=F', NATGAS: 'NG=F', COPPER: 'HG=F',
  US10Y: '^TNX',
  EURUSD: 'EURUSD=X', GBPUSD: 'GBPUSD=X', USDJPY: 'USDJPY=X',
  AUDUSD: 'AUDUSD=X', USDCAD: 'USDCAD=X', USDCHF: 'USDCHF=X',
};

let _cache = { t: 0, data: null };
let _yc = { cookie: null, crumb: null, t: 0 }; // Yahoo cookie + crumb cache

async function getCrumb() {
  if (_yc.crumb && Date.now() - _yc.t < 30 * 60 * 1000) return _yc;
  const r1 = await fetch('https://fc.yahoo.com/', { headers: { 'User-Agent': UA } });
  let cookie = '';
  if (typeof r1.headers.getSetCookie === 'function') {
    cookie = r1.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  } else {
    cookie = (r1.headers.get('set-cookie') || '').split(';')[0];
  }
  const r2 = await fetch(Q + '/v1/test/getcrumb', { headers: { 'User-Agent': UA, Cookie: cookie } });
  const crumb = (await r2.text()).trim();
  if (!crumb || crumb.length > 40 || /[<>{}]/.test(crumb)) throw new Error('bad crumb');
  _yc = { cookie, crumb, t: Date.now() };
  return _yc;
}

async function batchQuote(symbols) {
  const { cookie, crumb } = await getCrumb();
  const url = Q + '/v7/finance/quote?symbols=' + encodeURIComponent(symbols.join(',')) +
    '&crumb=' + encodeURIComponent(crumb);
  const r = await fetch(url, { headers: { 'User-Agent': UA, Cookie: cookie } });
  if (!r.ok) throw new Error('quote ' + r.status);
  const j = await r.json();
  const rows = j && j.quoteResponse && j.quoteResponse.result;
  if (!Array.isArray(rows)) throw new Error('no rows');
  const out = {};
  rows.forEach((q) => {
    if (q.symbol && q.regularMarketPrice != null) {
      out[q.symbol] = {
        price: q.regularMarketPrice,
        change: q.regularMarketChangePercent != null ? q.regularMarketChangePercent : null,
      };
    }
  });
  return out;
}

async function chartQuote(sym) {
  try {
    const r = await fetch(`${CHART}${encodeURIComponent(sym)}?range=1d&interval=1d`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (!r.ok) return null;
    const j = await r.json();
    const m = j && j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].meta;
    if (!m || m.regularMarketPrice == null) return null;
    const price = m.regularMarketPrice;
    const prev = m.chartPreviousClose != null ? m.chartPreviousClose : m.previousClose;
    const change = (prev != null && prev !== 0) ? ((price - prev) / prev) * 100 : null;
    return { price, change };
  } catch (e) { return null; }
}

async function yahooAll() {
  const symbols = [...new Set(Object.values(MAP))];
  let bySym = {};
  try { bySym = await batchQuote(symbols); } catch (e) { bySym = {}; }

  // Fill any gaps with the per-symbol chart endpoint
  const missing = symbols.filter((s) => !bySym[s]);
  if (missing.length) {
    const charted = await Promise.all(missing.map((s) => chartQuote(s)));
    missing.forEach((s, i) => { if (charted[i]) bySym[s] = charted[i]; });
  }

  const data = {};
  Object.entries(MAP).forEach(([k, ys]) => { if (bySym[ys]) data[k] = bySym[ys]; });
  return data;
}

async function cryptoExtras() {
  const out = { crypto: null, global: null };
  try {
    const r = await fetch('https://api.coinpaprika.com/v1/global', { headers: { 'User-Agent': UA } });
    if (r.ok) {
      const g = await r.json();
      out.global = {
        totalMcap: g.market_cap_usd,
        totalVol: g.volume_24h_usd,
        btcDom: g.bitcoin_dominance_percentage,
        coins: g.cryptocurrencies_number,
        change: g.market_cap_change_24h != null ? g.market_cap_change_24h : null,
      };
    }
  } catch (e) { /* optional */ }
  try {
    const r = await fetch('https://api.coinpaprika.com/v1/tickers/btc-bitcoin', { headers: { 'User-Agent': UA } });
    if (r.ok) {
      const t = await r.json();
      const q = t && t.quotes && t.quotes.USD;
      if (q) out.crypto = { btcMcap: q.market_cap, btcVol: q.volume_24h };
    }
  } catch (e) { /* optional */ }
  return out;
}

module.exports = async (req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('cache-control', 'public, max-age=30');

  if (_cache.data && Date.now() - _cache.t < TTL) {
    res.status(200).json({ ok: true, cached: true, ..._cache.data });
    return;
  }

  const [data, extras] = await Promise.all([yahooAll(), cryptoExtras()]);
  const payload = { data, crypto: extras.crypto, global: extras.global };
  if (Object.keys(data).length) _cache = { t: Date.now(), data: payload };

  res.status(200).json({ ok: true, ...payload });
};
