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

/* ─── Alpha Vantage — PRIMARY TradFi source. Authenticated, so (unlike free
 *     Yahoo/CoinGecko) it is never IP-blocked from a datacenter. Covers
 *     indices (via ETF proxies), metals (ETF proxies), the dollar index,
 *     commodities and the US 10Y. Free tier is small, so cache AV_TTL
 *     (default 1h). If your key is the 25/day tier, raise AV_TTL (e.g. 43200
 *     = 12h) or trim AV_PROXY. % changes are exact; proxy prices are scaled
 *     index levels (SPY≈SPX/10 and DIA≈DJI/100 are exact by design). ─── */
const AV = 'https://www.alphavantage.co/query';
const AV_KEY = process.env.ALPHAVANTAGE_API_KEY || process.env.ALPHA_VANTAGE_API_KEY || '';
const AV_TTL = (parseInt(process.env.AV_TTL || '3600', 10)) * 1000;
let _avCache = { t: 0, data: {} };

// internal symbol -> [ Alpha Vantage ETF symbol, price scale to index level ]
const AV_PROXY = [
  ['SPX', 'SPY', 10.0],
  ['DOW', 'DIA', 100.0],
  ['NDQ', 'QQQ', 41.0],
  ['XAU', 'GLD', 10.8],
  ['XAG', 'SLV', 1.10],
  ['DXY', 'UUP', 3.71],
];

async function avQuote(sym) {
  try {
    const r = await fetch(`${AV}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(sym)}&apikey=${encodeURIComponent(AV_KEY)}`, { headers: { 'User-Agent': UA } });
    if (!r.ok) return null;
    const j = await r.json();
    const g = j && j['Global Quote'];
    if (!g) return null; // rate-limit Note/Information → no Global Quote
    const price = parseFloat(g['05. price']);
    const chg = parseFloat(String(g['10. change percent'] || '').replace('%', ''));
    if (isNaN(price)) return null;
    return { price, change: isNaN(chg) ? null : chg };
  } catch (e) { return null; }
}

async function avSeries(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!r.ok) return null;
    const j = await r.json();
    const arr = j && j.data;
    if (!Array.isArray(arr) || !arr.length) return null; // rate-limit/Note → no .data
    const vals = arr.filter((d) => d.value && d.value !== '.').map((d) => parseFloat(d.value));
    if (!vals.length) return null;
    const price = vals[0];
    const prev = vals[1];
    const change = (prev != null && prev !== 0) ? ((price - prev) / prev) * 100 : null;
    return { price, change };
  } catch (e) { return null; }
}

async function avAll() {
  if (!AV_KEY) return {};
  if (Object.keys(_avCache.data).length && Date.now() - _avCache.t < AV_TTL) return _avCache.data;
  const q = (fn, extra) => `${AV}?function=${fn}&interval=daily${extra || ''}&apikey=${encodeURIComponent(AV_KEY)}`;
  const [proxies, wti, brent, ng, copper, us10] = await Promise.all([
    Promise.all(AV_PROXY.map(([, sym]) => avQuote(sym))),
    avSeries(q('WTI')),
    avSeries(q('BRENT')),
    avSeries(q('NATURAL_GAS')),
    avSeries(q('COPPER')),
    avSeries(q('TREASURY_YIELD', '&maturity=10year')),
  ]);
  const out = {};
  AV_PROXY.forEach(([key, , scale], i) => {
    const v = proxies[i];
    if (v) out[key] = { price: v.price * scale, change: v.change };
  });
  if (wti) out.WTI = wti;
  if (brent) out.BRENT = brent;
  if (ng) out.NATGAS = ng;
  if (copper) out.COPPER = copper;
  if (us10) out.US10Y = us10;
  if (Object.keys(out).length) _avCache = { t: Date.now(), data: out };
  return _avCache.data;
}

/* ─── Stooq — PRIMARY TradFi source. Free, no key, no cookie/crumb dance,
 *     and (unlike Yahoo) serves datacenter IPs reliably. One batched CSV
 *     request covers indices, metals, energy, FX and bonds. Day % change is
 *     computed vs the session open. Symbols Stooq doesn't carry come back
 *     "N/D" and are simply skipped — Yahoo/AlphaVantage fill the gaps. ─── */
const STOOQ_MAP = {
  SPX: '^spx', NDQ: '^ndq', DOW: '^dji', FTSE: '^ukx', VIX: '^vix',
  XAU: 'xauusd', XAG: 'xagusd',
  WTI: 'cl.f', BRENT: 'cb.f', NATGAS: 'ng.f', COPPER: 'hg.f',
  US10Y: '10yusy.b',
  EURUSD: 'eurusd', GBPUSD: 'gbpusd', USDJPY: 'usdjpy',
  AUDUSD: 'audusd', USDCAD: 'usdcad', USDCHF: 'usdchf',
  _USDSEK: 'usdsek', // internal — only used for the computed DXY
};

async function stooqAll() {
  try {
    const syms = Object.values(STOOQ_MAP).join('+');
    const url = `https://stooq.com/q/l/?s=${encodeURIComponent(syms)}&f=sd2t2ohlcv&h&e=csv`;
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/csv' } });
    if (!r.ok) return {};
    const text = await r.text();
    const lines = text.trim().split(/\r?\n/).slice(1); // drop header
    const byStooq = {};
    lines.forEach((ln) => {
      const [sym, , , o, h, l, c, v] = ln.split(',');
      const close = parseFloat(c), open = parseFloat(o);
      if (!sym || isNaN(close)) return;
      const entry = {
        price: close,
        change: (!isNaN(open) && open !== 0) ? ((close - open) / open) * 100 : null,
      };
      const high = parseFloat(h), low = parseFloat(l), vol = parseFloat(v);
      if (!isNaN(open)) entry.open = open;
      if (!isNaN(high)) entry.high = high;
      if (!isNaN(low))  entry.low  = low;
      if (!isNaN(vol) && vol > 0) entry.vol = vol;
      byStooq[sym.toLowerCase()] = entry;
    });
    const out = {};
    Object.entries(STOOQ_MAP).forEach(([k, ss]) => { if (byStooq[ss]) out[k] = byStooq[ss]; });
    return out;
  } catch (e) { return {}; }
}

/* ICE US Dollar Index computed from its six FX components — used whenever no
 * provider returns DXY directly. Weighted % change approximation alongside. */
function computeDXY(data) {
  const g = (k) => data[k] && data[k].price;
  const eur = g('EURUSD'), jpy = g('USDJPY'), gbp = g('GBPUSD'),
        cad = g('USDCAD'), sek = g('_USDSEK'), chf = g('USDCHF');
  if (!eur || !jpy || !gbp || !cad || !sek || !chf) return null;
  const price = 50.14348112 *
    Math.pow(eur, -0.576) * Math.pow(jpy, 0.136) * Math.pow(gbp, -0.119) *
    Math.pow(cad, 0.091) * Math.pow(sek, 0.042) * Math.pow(chf, 0.036);
  const c = (k, w) => (data[k] && data[k].change != null) ? data[k].change * w : 0;
  const change = c('EURUSD', -0.576) + c('USDJPY', 0.136) + c('GBPUSD', -0.119) +
                 c('USDCAD', 0.091) + c('_USDSEK', 0.042) + c('USDCHF', 0.036);
  return { price: parseFloat(price.toFixed(3)), change: parseFloat(change.toFixed(3)) };
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

  const [yData, extras, av, sq] = await Promise.all([yahooAll(), cryptoExtras(), avAll(), stooqAll()]);
  // Precedence: Stooq (fresh, datacenter-friendly) > AlphaVantage (authenticated) > Yahoo
  const data = { ...yData, ...av, ...sq };
  if (!data.DXY) { const dxy = computeDXY(data); if (dxy) data.DXY = dxy; }
  delete data._USDSEK; // internal component only
  const meta = {
    avKey: !!AV_KEY,
    yahooCount: Object.keys(yData).length,
    avCount: Object.keys(av).length,
    avSymbols: Object.keys(av),
    stooqCount: Object.keys(sq).filter(k => k[0] !== '_').length,
    stooqSymbols: Object.keys(sq).filter(k => k[0] !== '_'),
    total: Object.keys(data).length,
  };
  const payload = { data, crypto: extras.crypto, global: extras.global, meta };
  if (Object.keys(data).length) _cache = { t: Date.now(), data: payload };

  res.status(200).json({ ok: true, ...payload });
};
