/**
 * api/markets.js — Alpha Vantage market data proxy (Vercel)
 * The Arcane Archives
 *
 * Sources:
 *  • Alpha Vantage  → indices (ETF proxies), metals (ETF proxies), dollar
 *                     index, commodities, US 10Y and crypto (BTC/ETH/SOL).
 *  • CoinPaprika    → crypto market-cap / volume / BTC dominance (optional;
 *                     Alpha Vantage has no market-cap/dominance equivalent).
 *
 * Alpha Vantage's free tier is 25 requests/day, so this fans out one request
 * per symbol and caches the whole batch server-side for AV_TTL (default 24h)
 * — all visitors share one upstream fetch per cache window. FTSE and VIX have
 * no clean free-tier AV equivalent (no UK-listed quotes, no VIX symbol) so
 * they fall back to the client-side simulation in arcane-prices.js, same as
 * UK10Y/DE10Y/JP10Y. FX pairs are covered by the open.er-api.com fallback in
 * arcane-prices.js (no AV call — would otherwise add 6+ more requests/day).
 *
 * Returns: { ok, cached?, data:{ SYM:{price,change} }, crypto:{btcMcap,btcVol},
 *            global:{ totalMcap,totalVol,btcDom,coins,change } }
 */
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';
const TTL = (parseInt(process.env.MARKETS_TTL || '60', 10)) * 1000;

let _cache = { t: 0, data: null };

/* ─── Alpha Vantage — sole TradFi + crypto source. Authenticated, so (unlike
 *     free Yahoo/CoinGecko) it is never IP-blocked from a datacenter. Covers
 *     indices (via ETF proxies), metals (ETF proxies), the dollar index,
 *     commodities, the US 10Y and crypto. Free tier is 25 req/day, so cache
 *     AV_TTL (default 24h). On a paid key, lower AV_TTL for fresher data.
 *     % changes are exact; proxy prices are scaled index levels (SPY≈SPX/10
 *     and DIA≈DJI/100 are exact by design). ─── */
const AV = 'https://www.alphavantage.co/query';
const AV_KEY = process.env.ALPHAVANTAGE_API_KEY || process.env.ALPHA_VANTAGE_API_KEY || '';
const AV_TTL = (parseInt(process.env.AV_TTL || '86400', 10)) * 1000;
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

// internal symbol -> Alpha Vantage digital currency symbol
const AV_CRYPTO = { BTC: 'BTC', ETH: 'ETH', SOL: 'SOL' };

async function avCrypto(sym) {
  try {
    const r = await fetch(`${AV}?function=DIGITAL_CURRENCY_DAILY&symbol=${encodeURIComponent(sym)}&market=USD&apikey=${encodeURIComponent(AV_KEY)}`, { headers: { 'User-Agent': UA } });
    if (!r.ok) return null;
    const j = await r.json();
    const series = j && j['Time Series (Digital Currency Daily)'];
    if (!series) return null; // rate-limit Note/Information → no series
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
  const [proxies, wti, brent, ng, copper, us10, cryptos] = await Promise.all([
    Promise.all(AV_PROXY.map(([, sym]) => avQuote(sym))),
    avSeries(q('WTI')),
    avSeries(q('BRENT')),
    avSeries(q('NATURAL_GAS')),
    avSeries(q('COPPER')),
    avSeries(q('TREASURY_YIELD', '&maturity=10year')),
    Promise.all(Object.values(AV_CRYPTO).map((sym) => avCrypto(sym))),
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

module.exports = async (req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('cache-control', 'public, max-age=30');

  if (_cache.data && Date.now() - _cache.t < TTL) {
    res.status(200).json({ ok: true, cached: true, ..._cache.data });
    return;
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

  res.status(200).json({ ok: true, ...payload });
};
