/**
 * api/quotes.js — Vercel serverless equivalent of netlify/functions/market-quotes.js
 * Set TWELVEDATA_API_KEY (and optionally QUOTES_TTL) in your Vercel project env vars.
 * Served at /api/quotes. Returns { ok, cached?, data: { SPX:{price,change}, ... } }.
 */
const TD_URL = 'https://api.twelvedata.com/quote';
const KEY = process.env.TWELVEDATA_API_KEY || process.env.TWELVE_DATA_API_KEY || '';
const TTL = (parseInt(process.env.QUOTES_TTL || '900', 10)) * 1000;

const MAP = {
  SPX:'SPX', DOW:'DJI', NDQ:'IXIC', VIX:'VIX', DXY:'DXY',
  WTI:'WTI/USD', BRENT:'BRENT/USD', NATGAS:'NG/USD', COPPER:'COPPER/USD',
  US10Y:'US10Y', UK10Y:'UK10Y', DE10Y:'DE10Y', JP10Y:'JP10Y',
  EURUSD:'EUR/USD', GBPUSD:'GBP/USD', USDJPY:'USD/JPY',
  AUDUSD:'AUD/USD', USDCAD:'USD/CAD', USDCHF:'USD/CHF',
};
const WANT = (process.env.QUOTES_SYMBOLS || 'SPX,DOW,NDQ,VIX,DXY,WTI,BRENT,US10Y')
  .split(',').map((s) => s.trim()).filter((k) => MAP[k]);

let _cache = { t: 0, data: null };

module.exports = async (req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('cache-control', 'public, max-age=60');

  if (!KEY) { res.status(200).json({ ok: false, reason: 'no_api_key', data: {} }); return; }

  if (_cache.data && Date.now() - _cache.t < TTL) {
    res.status(200).json({ ok: true, cached: true, data: _cache.data });
    return;
  }

  try {
    const symbols = [...new Set(WANT.map((k) => MAP[k]))].join(',');
    const r = await fetch(`${TD_URL}?symbol=${encodeURIComponent(symbols)}&apikey=${encodeURIComponent(KEY)}`);
    const j = await r.json();
    const out = {};
    for (const ourKey of WANT) {
      const tdSym = MAP[ourKey];
      const row = j[tdSym] || (j && j.symbol === tdSym ? j : null);
      if (!row || row.status === 'error') continue;
      const price = parseFloat(row.close);
      const change = parseFloat(row.percent_change);
      if (!isNaN(price)) out[ourKey] = { price, change: isNaN(change) ? null : change };
    }
    if (Object.keys(out).length) _cache = { t: Date.now(), data: out };
    res.status(200).json({ ok: true, data: Object.keys(out).length ? out : (_cache.data || {}) });
  } catch (e) {
    res.status(200).json({ ok: false, reason: 'fetch_failed', data: _cache.data || {} });
  }
}
