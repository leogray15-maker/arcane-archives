/**
 * netlify/functions/market-quotes.js
 * Server-side Twelve Data proxy for The Arcane Archives.
 *
 * Why this exists:
 *  • Keeps the Twelve Data API key OFF the client (set TWELVEDATA_API_KEY in
 *    your Netlify env vars — Site settings → Environment variables).
 *  • Caches upstream responses so many visitors share one fetch and you stay
 *    inside the free tier (8 credits/min, 800/day). Tune with QUOTES_TTL (s).
 *
 * Returns: { ok, cached?, data: { SPX:{price,change}, ... } }
 * If no key is configured it returns ok:false with an empty data map, and the
 * client silently keeps its simulated values — nothing breaks.
 */
const TD_URL = 'https://api.twelvedata.com/quote';
const KEY = process.env.TWELVEDATA_API_KEY || process.env.TWELVE_DATA_API_KEY || '';
// Server cache (s). Free tier = 8 credits/min & 800/day; keep this high (default 15 min).
const TTL = (parseInt(process.env.QUOTES_TTL || '900', 10)) * 1000;

// full universe: internal symbol -> Twelve Data symbol
const MAP = {
  SPX:'SPX', DOW:'DJI', NDQ:'IXIC', VIX:'VIX', DXY:'DXY',
  WTI:'WTI/USD', BRENT:'BRENT/USD', NATGAS:'NG/USD', COPPER:'COPPER/USD',
  US10Y:'US10Y', UK10Y:'UK10Y', DE10Y:'DE10Y', JP10Y:'JP10Y',
  EURUSD:'EUR/USD', GBPUSD:'GBP/USD', USDJPY:'USD/JPY',
  AUDUSD:'AUD/USD', USDCAD:'USD/CAD', USDCHF:'USD/CHF',
};
// Which symbols to actually request. Free tier ≈ 8/min, so default to 8.
// Override with QUOTES_SYMBOLS (comma list of internal keys) on a paid plan.
const WANT = (process.env.QUOTES_SYMBOLS || 'SPX,DOW,NDQ,VIX,DXY,WTI,BRENT,US10Y')
  .split(',').map((s) => s.trim()).filter((k) => MAP[k]);

let _cache = { t: 0, data: null };

function reply(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=60',
      'access-control-allow-origin': '*',
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async function () {
  if (!KEY) return reply(200, { ok: false, reason: 'no_api_key', data: {} });

  if (_cache.data && Date.now() - _cache.t < TTL) {
    return reply(200, { ok: true, cached: true, data: _cache.data });
  }

  try {
    const symbols = [...new Set(WANT.map((k) => MAP[k]))].join(',');
    const url = `${TD_URL}?symbol=${encodeURIComponent(symbols)}&apikey=${encodeURIComponent(KEY)}`;
    const r = await fetch(url);
    const j = await r.json();

    const out = {};
    for (const ourKey of WANT) {
      const tdSym = MAP[ourKey];
      // batch responses are keyed by symbol; a single-symbol response is the row itself
      const row = j[tdSym] || (j && j.symbol === tdSym ? j : null);
      if (!row || row.status === 'error') continue;
      const price = parseFloat(row.close);
      const change = parseFloat(row.percent_change);
      if (!isNaN(price)) out[ourKey] = { price, change: isNaN(change) ? null : change };
    }

    if (Object.keys(out).length) _cache = { t: Date.now(), data: out };
    return reply(200, { ok: true, data: Object.keys(out).length ? out : (_cache.data || {}) });
  } catch (e) {
    return reply(200, { ok: false, reason: 'fetch_failed', data: _cache.data || {} });
  }
};
