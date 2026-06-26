/**
 * netlify/functions/market-data.js — Alpha Vantage market data proxy (Netlify)
 * Mirror of api/markets.js. See that file for the full description.
 *
 * Alpha Vantage covers indices (native ticker, falling back to ETF proxy),
 * metals (ETF proxies), the dollar index, commodities, the US 10Y and the
 * full crypto heatmap (BTC/ETH/SOL + 15 altcoins). CoinPaprika supplies
 * crypto market-cap/dominance (no AV equivalent). Cached server-side via
 * AV_TTL (default 1h; raise it if you're on AV's 25 req/day free tier).
 */
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';
const TTL = (parseInt(process.env.MARKETS_TTL || '60', 10)) * 1000;

let _cache = { t: 0, data: null };

/* Alpha Vantage — sole TradFi + crypto source (authenticated → never
 * IP-blocked). The free tier is 25 req/day — this fans out one request per
 * symbol (≈30 with the full crypto heatmap), so raise AV_TTL on the free
 * tier or lower it once you confirm a higher-rate-limit key. % changes are
 * exact; ETF-proxy prices are scaled index levels (SPY≈SPX/10 and
 * DIA≈DJI/100 are exact by design). */
const AV = 'https://www.alphavantage.co/query';
const AV_KEY = process.env.ALPHAVANTAGE_API_KEY || process.env.ALPHA_VANTAGE_API_KEY || '';
const AV_TTL = (parseInt(process.env.AV_TTL || '3600', 10)) * 1000;
let _avCache = { t: 0, data: {} };

async function avQuote(sym) {
  try {
    const r = await fetch(`${AV}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(sym)}&apikey=${encodeURIComponent(AV_KEY)}`, { headers: { 'User-Agent': UA } });
    if (!r.ok) return null;
    const j = await r.json();
    const g = j && j['Global Quote'];
    if (!g) return null;
    const price = parseFloat(g['05. price']);
    const chg = parseFloat(String(g['10. change percent'] || '').replace('%', ''));
    if (isNaN(price)) return null;
    return { price, change: isNaN(chg) ? null : chg };
  } catch (e) { return null; }
}

/* internal symbol -> [ native AV index ticker (tried first, scale 1),
 *                       fallback ETF proxy symbol, fallback scale ].
 * AV's Index Data APIs (Dow/S&P 500/Nasdaq/VIX/Russell) are only confirmed
 * to exist behind a "Premium" badge in their docs — we can't verify the
 * exact ticker without a live key, so we try the obvious AV-style ticker
 * via GLOBAL_QUOTE first and fall back to the ETF proxy (or, for VIX/FTSE,
 * to client-side simulation) if it doesn't resolve. */
const AV_INDEX = [
  ['SPX', 'SPX', 'SPY', 10.0],
  ['DOW', 'DJI', 'DIA', 100.0],
  ['NDQ', 'IXIC', 'QQQ', 41.0],
  ['VIX', 'VIX', null, 1],
  ['FTSE', 'FTSE', null, 1],
];

// internal symbol -> [ Alpha Vantage ETF symbol, price scale to index level ]
// (no plausible native AV ticker, so these go straight to the ETF proxy)
const AV_PROXY = [
  ['XAU', 'GLD', 10.8],
  ['XAG', 'SLV', 1.10],
  ['DXY', 'UUP', 3.71],
];

async function avIndexAll() {
  const rows = await Promise.all(AV_INDEX.map(async ([, native, proxy, scale]) => {
    const v = await avQuote(native);
    if (v) return v;
    if (!proxy) return null;
    const p = await avQuote(proxy);
    return p ? { price: p.price * scale, change: p.change } : null;
  }));
  const out = {};
  AV_INDEX.forEach(([key], i) => { if (rows[i]) out[key] = rows[i]; });
  return out;
}

async function avSeries(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!r.ok) return null;
    const j = await r.json();
    const arr = j && j.data;
    if (!Array.isArray(arr) || !arr.length) return null;
    const vals = arr.filter((d) => d.value && d.value !== '.').map((d) => parseFloat(d.value));
    if (!vals.length) return null;
    const price = vals[0];
    const prev = vals[1];
    const change = (prev != null && prev !== 0) ? ((price - prev) / prev) * 100 : null;
    return { price, change };
  } catch (e) { return null; }
}

// internal symbol -> Alpha Vantage digital currency symbol. Covers the
// trading-floor crypto heatmap (previously a direct Binance call) plus the
// BTC/ETH/SOL cards. Not every symbol is guaranteed to exist on AV's digital
// currency list — avCrypto() returns null for unsupported ones and they're
// simply omitted (the heatmap renders whatever AV actually returns).
const AV_CRYPTO = {
  BTC: 'BTC', ETH: 'ETH', SOL: 'SOL', BNB: 'BNB', XRP: 'XRP', ADA: 'ADA',
  DOGE: 'DOGE', AVAX: 'AVAX', LINK: 'LINK', DOT: 'DOT', LTC: 'LTC',
  BCH: 'BCH', ATOM: 'ATOM', UNI: 'UNI', ETC: 'ETC', XLM: 'XLM',
  NEAR: 'NEAR', APT: 'APT',
};

async function avCrypto(sym) {
  try {
    const r = await fetch(`${AV}?function=DIGITAL_CURRENCY_DAILY&symbol=${encodeURIComponent(sym)}&market=USD&apikey=${encodeURIComponent(AV_KEY)}`, { headers: { 'User-Agent': UA } });
    if (!r.ok) return null;
    const j = await r.json();
    const series = j && j['Time Series (Digital Currency Daily)'];
    if (!series) return null;
    const days = Object.keys(series).sort().reverse();
    if (!days.length) return null;
    const price = parseFloat(series[days[0]]['4a. close (USD)']);
    const prev = days[1] ? parseFloat(series[days[1]]['4a. close (USD)']) : null;
    if (isNaN(price)) return null;
    const change = (prev != null && !isNaN(prev) && prev !== 0) ? ((price - prev) / prev) * 100 : null;
    return { price, change };
  } catch (e) { return null; }
}

async function avAll() {
  if (!AV_KEY) return {};
  if (Object.keys(_avCache.data).length && Date.now() - _avCache.t < AV_TTL) return _avCache.data;
  const q = (fn, extra) => `${AV}?function=${fn}&interval=daily${extra || ''}&apikey=${encodeURIComponent(AV_KEY)}`;
  const [indices, proxies, wti, brent, ng, copper, us10, cryptos] = await Promise.all([
    avIndexAll(),
    Promise.all(AV_PROXY.map(([, sym]) => avQuote(sym))),
    avSeries(q('WTI')),
    avSeries(q('BRENT')),
    avSeries(q('NATURAL_GAS')),
    avSeries(q('COPPER')),
    avSeries(q('TREASURY_YIELD', '&maturity=10year')),
    Promise.all(Object.values(AV_CRYPTO).map((sym) => avCrypto(sym))),
  ]);
  const out = { ...indices };
  AV_PROXY.forEach(([key, , scale], i) => {
    const v = proxies[i];
    if (v) out[key] = { price: v.price * scale, change: v.change };
  });
  if (wti) out.WTI = wti;
  if (brent) out.BRENT = brent;
  if (ng) out.NATGAS = ng;
  if (copper) out.COPPER = copper;
  if (us10) out.US10Y = us10;
  Object.keys(AV_CRYPTO).forEach((key, i) => { if (cryptos[i]) out[key] = cryptos[i]; });
  if (Object.keys(out).length) _avCache = { t: Date.now(), data: out };
  return _avCache.data;
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

exports.handler = async function () {
  const headers = {
    'content-type': 'application/json',
    'cache-control': 'public, max-age=30',
    'access-control-allow-origin': '*',
  };

  if (_cache.data && Date.now() - _cache.t < TTL) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, cached: true, ..._cache.data }) };
  }

  const [extras, av] = await Promise.all([cryptoExtras(), avAll()]);
  const data = { ...av };
  const meta = {
    avKey: !!AV_KEY,
    avCount: Object.keys(av).length,
    avSymbols: Object.keys(av),
    total: Object.keys(data).length,
  };
  const payload = { data, crypto: extras.crypto, global: extras.global, meta };
  if (Object.keys(data).length) _cache = { t: Date.now(), data: payload };

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, ...payload }) };
};
