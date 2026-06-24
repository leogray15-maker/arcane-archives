/**
 * netlify/functions/market-data.js — free, no-key market data proxy (Netlify)
 * Mirror of api/markets.js. See that file for the full description.
 *
 * Sources (all free, NO API key): Yahoo Finance (indices, commodities, bonds,
 * FX, metals, crypto prices + day % change) and CoinPaprika (crypto market-cap
 * / dominance). Cached server-side via MARKETS_TTL (default 60s).
 */
const Y = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';
const TTL = (parseInt(process.env.MARKETS_TTL || '60', 10)) * 1000;

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

exports.handler = async function () {
  const headers = {
    'content-type': 'application/json',
    'cache-control': 'public, max-age=30',
    'access-control-allow-origin': '*',
  };

  if (_cache.data && Date.now() - _cache.t < TTL) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, cached: true, ..._cache.data }) };
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

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, ...payload }) };
};
