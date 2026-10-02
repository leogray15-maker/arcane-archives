/**
 * api/markets.js — live market snapshot for every page (Vercel)
 * The Arcane Archives
 *
 * Twelve Data is the primary feed (set TWELVEDATA_API_KEY in Vercel). Free
 * CBOE delayed quotes and US Treasury daily yields fill VIX, US indices and
 * bond yields if Twelve Data does not return them. See lib/market/providers.js.
 *
 * Cached in memory (MARKETS_TTL seconds, default 60) and at Vercel's edge via
 * s-maxage, so every visitor shares one upstream fetch per minute.
 *
 * Returns: { ok, cached?, data:{ SYM:{price,change,open,high,low,prevClose,volume,ts,src} },
 *            crypto:{btcMcap,btcVol}, global:{...}, meta:{keySet,error,missing,sources} }
 */
const { snapshot } = require('../lib/market/providers');

const TTL = (parseInt(process.env.MARKETS_TTL || '60', 10)) * 1000;
let _cache = { t: 0, payload: null };

module.exports = async (req, res) => {
  const ttlSec = Math.round(TTL / 1000);
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('cache-control', `public, max-age=15, s-maxage=${ttlSec}, stale-while-revalidate=${ttlSec * 4}`);

  if (_cache.payload && Date.now() - _cache.t < TTL) {
    res.status(200).json({ ok: true, cached: true, ..._cache.payload });
    return;
  }

  try {
    const payload = await snapshot();
    if (payload.meta.total) _cache = { t: Date.now(), payload };
    const out = payload.meta.total ? payload : (_cache.payload || payload);
    res.status(200).json({ ok: !!out.meta.total, ...out });
  } catch (e) {
    if (_cache.payload) { res.status(200).json({ ok: true, stale: true, ..._cache.payload }); return; }
    res.status(200).json({ ok: false, reason: 'fetch_failed', data: {} });
  }
};
