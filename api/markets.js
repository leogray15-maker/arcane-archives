/**
 * api/markets.js — free, no-key market data proxy (Vercel)
 * The Arcane Archives
 *
 * Sources (all free, NO API key required):
 *  • Yahoo Finance  → indices, commodities, bonds, FX, metals AND crypto
 *                     (price + day % change) for every instrument below.
 *  • CoinPaprika    → crypto market-cap / volume / BTC dominance for the
 *                     crypto-overview panel (best-effort; optional).
 *
 * Why server-side: Yahoo sends no CORS headers, so the browser can't call it
 * directly. We proxy + cache here (MARKETS_TTL, default 60s) so all visitors
 * share one upstream fetch and we never hammer the source.
 *
 * Returns: { ok, cached?, data:{ SYM:{price,change} }, crypto:{btcMcap,btcVol},
 *            global:{ totalMcap,totalVol,btcDom,coins,change } }
 */
const Y = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';
const TTL = (parseInt(process.env.MARKETS_TTL || '60', 10)) * 1000;

// internal symbol -> Yahoo Finance symbol
const MAP = {
  // crypto
  BTC: 'BTC-USD', ETH: 'ETH-USD', SOL: 'SOL-USD',
  // metals (COMEX futures track spot closely)
  XAU: 'GC=F', XAG: 'SI=F',
  // indices + vol + dollar index
  SPX: '^GSPC', NDQ: '^IXIC', DOW: '^DJI', FTSE: '^FTSE', VIX: '^VIX', DXY: 'DX-Y.NYB',
  // commodities
  WTI: 'CL=F', BRENT: 'BZ=F', NATGAS: 'NG=F', COPPER: 'HG=F',
  // bonds (Yahoo only reliably covers the US 10Y)
  US10Y: '^TNX',
  // FX
  EURUSD: 'EURUSD=X', GBPUSD: 'GBPUSD=X', USDJPY: 'USDJPY=X',
  AUDUSD: 'AUDUSD=X', USDCAD: 'USDCAD=X', USDCHF: 'USDCHF=X',
};

let _cache = { t: 0, data: null };

async function yq(sym) {
  try {
    const r = await fetch(`${Y}${encodeURIComponent(sym)}?range=1d&interval=1d`, {
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

  const keys = Object.keys(MAP);
  const [prices, extras] = await Promise.all([
    Promise.all(keys.map((k) => yq(MAP[k]))),
    cryptoExtras(),
  ]);

  const data = {};
  keys.forEach((k, i) => { if (prices[i]) data[k] = prices[i]; });

  const payload = { data, crypto: extras.crypto, global: extras.global };
  if (Object.keys(data).length) _cache = { t: Date.now(), data: payload };

  res.status(200).json({ ok: true, ...payload });
};
