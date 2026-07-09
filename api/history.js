/**
 * api/history.js — free, no-key historical candles proxy (Vercel)
 * The Arcane Archives
 *
 * Serves daily OHLCV candles for the self-hosted Trading Floor chart
 * (crypto pairs come from Binance directly in the browser; everything
 * else comes through here). Source: Stooq daily CSV — free, no key,
 * datacenter-friendly. Whitelisted symbols only, cached 10 min.
 *
 * GET /api/history?symbol=XAUUSD[&days=365]
 * → { ok, symbol, candles: [{ t, o, h, l, c, v }] }  (t = epoch ms, ascending)
 */
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';
const TTL = 10 * 60 * 1000;

// UI symbol -> Stooq symbol (whitelist — this is NOT an open proxy)
const HIST_MAP = {
  XAUUSD: 'xauusd', XAGUSD: 'xagusd',
  SPX500: '^spx', NAS100: '^ndx', US30: '^dji', UK100: '^ukx', VIX: '^vix',
  USOIL: 'cl.f', UKOIL: 'cb.f', NATGAS: 'ng.f', COPPER: 'hg.f',
  EURUSD: 'eurusd', GBPUSD: 'gbpusd', USDJPY: 'usdjpy',
  AUDUSD: 'audusd', USDCAD: 'usdcad', USDCHF: 'usdchf',
  US10Y: '10yusy.b',
  BTCUSD: 'btcusd', ETHUSD: 'ethusd', // fallback only — Binance serves these client-side
};

const _cache = {}; // symbol -> { t, body }

function ymd(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

module.exports = async (req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('cache-control', 'public, max-age=300');

  const symbol = String((req.query && req.query.symbol) || '').toUpperCase();
  const days = Math.min(2000, Math.max(30, parseInt((req.query && req.query.days) || '420', 10) || 420));
  const stooqSym = HIST_MAP[symbol];
  if (!stooqSym) {
    res.status(400).json({ ok: false, error: 'Unknown symbol', symbols: Object.keys(HIST_MAP) });
    return;
  }

  const hit = _cache[symbol];
  if (hit && Date.now() - hit.t < TTL) {
    res.status(200).json({ ok: true, cached: true, ...hit.body });
    return;
  }

  try {
    const d2 = new Date();
    const d1 = new Date(Date.now() - days * 86400000);
    const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSym)}&i=d&d1=${ymd(d1)}&d2=${ymd(d2)}`;
    let text = null;
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/csv' } });
      if (r.ok) { const t = await r.text(); if (/^date,open/i.test(t.trim())) text = t; }
    } catch (e) { /* fall through to proxy */ }
    if (!text) {
      // Stooq refused this host — retry through AllOrigins
      const r = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(url), {
        headers: { 'User-Agent': UA, Accept: 'text/csv' },
      });
      if (!r.ok) throw new Error('upstream ' + r.status);
      text = await r.text();
    }
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
    res.status(200).json({ ok: true, ...body });
  } catch (e) {
    if (hit) { // serve stale on upstream failure
      res.status(200).json({ ok: true, cached: true, stale: true, ...hit.body });
      return;
    }
    res.status(502).json({ ok: false, error: String(e.message || e) });
  }
};
