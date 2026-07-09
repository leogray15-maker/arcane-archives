/**
 * netlify/functions/market-history.js — mirror of api/history.js (see that
 * file). Daily OHLCV candles from Stooq for the self-hosted Trading Floor
 * chart. Whitelisted symbols only, cached 10 min.
 */
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';
const TTL = 10 * 60 * 1000;

const HIST_MAP = {
  XAUUSD: 'xauusd', XAGUSD: 'xagusd',
  SPX500: '^spx', NAS100: '^ndx', US30: '^dji', UK100: '^ukx', VIX: '^vix',
  USOIL: 'cl.f', UKOIL: 'cb.f', NATGAS: 'ng.f', COPPER: 'hg.f',
  EURUSD: 'eurusd', GBPUSD: 'gbpusd', USDJPY: 'usdjpy',
  AUDUSD: 'audusd', USDCAD: 'usdcad', USDCHF: 'usdchf',
  US10Y: '10yusy.b',
  BTCUSD: 'btcusd', ETHUSD: 'ethusd',
};

const _cache = {};

function ymd(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

exports.handler = async function (event) {
  const headers = {
    'content-type': 'application/json',
    'cache-control': 'public, max-age=300',
    'access-control-allow-origin': '*',
  };
  const qs = (event && event.queryStringParameters) || {};
  const symbol = String(qs.symbol || '').toUpperCase();
  const days = Math.min(2000, Math.max(30, parseInt(qs.days || '420', 10) || 420));
  const stooqSym = HIST_MAP[symbol];
  if (!stooqSym) {
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Unknown symbol', symbols: Object.keys(HIST_MAP) }) };
  }

  const hit = _cache[symbol];
  if (hit && Date.now() - hit.t < TTL) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, cached: true, ...hit.body }) };
  }

  try {
    const d2 = new Date();
    const d1 = new Date(Date.now() - days * 86400000);
    const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSym)}&i=d&d1=${ymd(d1)}&d2=${ymd(d2)}`;
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/csv' } });
    if (!r.ok) throw new Error('upstream ' + r.status);
    const text = await r.text();
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2 || !/^date,open/i.test(lines[0])) throw new Error('no data');

    const candles = [];
    for (let i = 1; i < lines.length; i++) {
      const [date, o, h, l, c, v] = lines[i].split(',');
      const open = parseFloat(o), high = parseFloat(h), low = parseFloat(l), close = parseFloat(c);
      if (!date || isNaN(close)) continue;
      candles.push({
        t: Date.parse(date + 'T00:00:00Z'),
        o: isNaN(open) ? close : open,
        h: isNaN(high) ? close : high,
        l: isNaN(low) ? close : low,
        c: close,
        v: parseFloat(v) || 0,
      });
    }
    if (!candles.length) throw new Error('empty');

    const body = { symbol, source: 'stooq', interval: '1d', candles };
    _cache[symbol] = { t: Date.now(), body };
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, ...body }) };
  } catch (e) {
    if (hit) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, cached: true, stale: true, ...hit.body }) };
    }
    return { statusCode: 502, headers, body: JSON.stringify({ ok: false, error: String(e.message || e) }) };
  }
};
