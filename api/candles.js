/**
 * api/candles.js — OHLC candles for the Trading Floor's Technical Outlook (Vercel)
 * GET /api/candles?symbol=XAUUSD&interval=4h&size=200
 * interval: 1min 5min 15min 30min 1h 4h 1day 1week. Needs TWELVEDATA_API_KEY.
 * Returns { ok, symbol, interval, src, candles:[{t,o,h,l,c,v}] } oldest first.
 */
const { candles, INTERVALS } = require('../lib/market/providers');

const _cache = new Map(); // "SYM|interval|size" -> { t, body }

module.exports = async (req, res) => {
  const q = req.query || {};
  const symbol = String(q.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  const interval = String(q.interval || '4h');
  const size = Math.max(50, Math.min(500, parseInt(q.size, 10) || 200));
  const ttl = INTERVALS[interval] || 60;
  res.setHeader('access-control-allow-origin', '*');

  const key = `${symbol}|${interval}|${size}`;
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.t < ttl * 1000) {
    res.setHeader('cache-control', `public, max-age=30, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`);
    res.status(200).json({ ...hit.body, cached: true });
    return;
  }

  const body = await candles(symbol, interval, { size });
  if (body.ok) {
    _cache.set(key, { t: Date.now(), body });
    if (_cache.size > 200) _cache.delete(_cache.keys().next().value);
    res.setHeader('cache-control', `public, max-age=30, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`);
  } else {
    res.setHeader('cache-control', 'public, max-age=30, s-maxage=30');
  }
  res.status(200).json(body);
};
