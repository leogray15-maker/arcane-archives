/**
 * arcane-prices.js — Live market data service
 * The Arcane Archives | v3.0
 *
 * Sources:
 *  • /api/markets → FMP or Twelve Data (metals, FX, energy, indices, crypto) with
 *      day open/high/low/prev close, plus free CBOE (VIX, US indices) and US
 *      Treasury (2Y/10Y/30Y yields) backups and CoinPaprika crypto overview.
 *      Keys live in Vercel env vars only (see lib/market/providers.js).
 *  • Binance (browser, no key) → real-time BTC/ETH/SOL, wins for crypto.
 *  • open.er-api.com (via /api/fx) → FX spot only if /api/markets has none.
 *
 * Nothing is simulated: an instrument with no live source stays absent and
 * pages show "—".
 */

(function () {
  'use strict';

  /* ─── Internal state ─────────────────────── */
  const _data = {};          // { SYM: { price, change, dir, open, high, low, prevClose, ... } }
  const _callbacks = [];     // subscriber functions
  let   _initialised = false;
  let   _meta = null;        // /api/markets meta (sources, missing, error)

  /* ─── Helpers ────────────────────────────── */
  function dir(change) {
    if (change == null) return 'flat';
    return change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  }

  function fmtChg(change) {
    if (change == null || isNaN(change)) return '—';
    return (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
  }

  function fmtPrice(price, decimals) {
    if (price == null || isNaN(price)) return '—';
    return price.toLocaleString('en-US', {
      minimumFractionDigits: decimals ?? 2,
      maximumFractionDigits: decimals ?? 2,
    });
  }

  function fmtBig(n) {
    if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9)  return '$' + (n / 1e9).toFixed(1)  + 'B';
    if (n >= 1e6)  return '$' + (n / 1e6).toFixed(1)  + 'M';
    return '$' + n.toLocaleString();
  }

  function set(sym, price, change, extra) {
    _data[sym] = { price, change, dir: dir(change), ...(extra || {}) };
  }

  function snapshot() {
    const out = {};
    Object.entries(_data).forEach(([k, v]) => { out[k] = { ...v }; });
    return out;
  }

  function notify() {
    const d = snapshot();
    _callbacks.forEach(cb => { try { cb(d); } catch(e) {} });
  }

  /* ─── Fetchers ───────────────────────────── */

  async function fetchMarkets() {
    try {
      const r = await fetch('/api/markets', { cache: 'no-cache' });
      if (!r.ok) { console.log('[ArcanePrices] /api/markets HTTP', r.status); return; }
      const j = await r.json();
      _meta = j.meta || null;
      try {
        console.log('%c[ArcanePrices] sources →',
          'color:#f5c842;font-weight:bold',
          'Provider:', j.meta?.provider, '| key set:', j.meta?.keySet, j.meta?.error ? '| error: ' + j.meta.error : '',
          '| by source:', j.meta?.sources || {}, '| missing:', (j.meta?.missing || []).join(',') || 'none');
      } catch (_) {}
      const d = j && j.data;
      if (!d) return;

      Object.entries(d).forEach(([sym, v]) => {
        if (v && v.price != null) {
          const { price, change, ...extra } = v;
          set(sym, price, change, extra);
        }
      });

      // BTC card extras (market cap / 24h volume) from CoinPaprika
      if (j.crypto && _data.BTC) {
        if (j.crypto.btcMcap != null) _data.BTC.mcap = fmtBig(j.crypto.btcMcap);
        if (j.crypto.btcVol  != null) _data.BTC.vol  = fmtBig(j.crypto.btcVol);
      }

      // Crypto overview panel (total cap, volume, dominance) from CoinPaprika
      if (j.global) {
        const g = j.global;
        const btcDom = g.btcDom || 0;
        set('CRYPTO_GLOBAL', g.totalMcap || 0, g.change ?? null, {
          totalMcap: fmtBig(g.totalMcap || 0),
          totalVol:  fmtBig(g.totalVol  || 0),
          btcDom:    btcDom.toFixed(1) + '%',
          altDom:    Math.max(0, 100 - btcDom).toFixed(1) + '%',
          activeCoinCount: (g.coins || 0).toLocaleString(),
        });
      }
    } catch (e) { /* keep last good values */ }
  }

  // FX spot from open.er-api.com, used only for pairs /api/markets lacks.
  async function fetchFX() {
    const need = ['EURUSD','GBPUSD','USDJPY','AUDUSD','USDCAD','USDCHF','EURGBP'].filter(k => !_data[k] || _data[k].src === 'er-api');
    if (!need.length) return;
    try {
      const r = await fetch('/api/fx/latest/USD');
      if (!r.ok) return;
      const d = await r.json();
      if (!d.rates) return;
      const { EUR, GBP, JPY, AUD, CAD, CHF } = d.rates;
      const x = { src: 'er-api', daily: true };
      const put = (k, v) => { if (need.includes(k) && v) set(k, v, null, x); };
      put('EURUSD', EUR && 1 / EUR);
      put('GBPUSD', GBP && 1 / GBP);
      put('USDJPY', JPY);
      put('AUDUSD', AUD && 1 / AUD);
      put('USDCAD', CAD);
      put('USDCHF', CHF);
      put('EURGBP', EUR && GBP && GBP / EUR);
    } catch(e) { /* leave missing */ }
  }

  /* ─── Crypto direct from Binance (free, no key, CORS — uses the visitor's
   *     own IP so it never hits the datacenter rate-limits that block us) ─── */
  async function fetchCryptoDirect() {
    try {
      const r = await fetch(
        'https://api.binance.com/api/v3/ticker/24hr' +
        '?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22,%22SOLUSDT%22%5D'
      );
      if (!r.ok) return;
      const arr = await r.json();
      if (!Array.isArray(arr)) return;
      const by = {}; arr.forEach(t => { by[t.symbol] = t; });
      const map = { BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT' };
      Object.entries(map).forEach(([sym, bs]) => {
        const t = by[bs];
        if (!t) return;
        const prev = _data[sym] || {};
        set(sym, parseFloat(t.lastPrice), parseFloat(t.priceChangePercent), {
          open: parseFloat(t.openPrice), high: parseFloat(t.highPrice), low: parseFloat(t.lowPrice),
          prevClose: parseFloat(t.prevClosePrice), volume: parseFloat(t.volume),
          ts: t.closeTime, src: 'binance', window: '24h',
          mcap: prev.mcap, vol: sym === 'BTC' ? (prev.vol || fmtBig(parseFloat(t.quoteVolume) || 0)) : undefined,
        });
      });
    } catch (e) { /* keep server values */ }
  }

  /* ─── Main refresh ────────────────────────── */
  async function refresh() {
    await fetchMarkets();       // FMP or Twelve Data + CBOE + Treasury
    await fetchFX();            // fills FX only if missing
    await fetchCryptoDirect();  // Binance: real-time crypto, wins last
    notify();
    _initialised = true;
  }

  /* ─── Public API ─────────────────────────── */
  const ArcanePrices = {
    subscribe(cb) {
      _callbacks.push(cb);
      if (_initialised) cb(snapshot());
      return () => {
        const i = _callbacks.indexOf(cb);
        if (i > -1) _callbacks.splice(i, 1);
      };
    },

    get(sym) { return _data[sym] ? { ..._data[sym] } : null; },

    fmt(sym, decimals) {
      const d = _data[sym];
      if (!d) return '—';
      return fmtPrice(d.price, decimals);
    },

    chg(sym) {
      const d = _data[sym];
      if (!d) return '—';
      return fmtChg(d.change);
    },

    dir(sym) { return _data[sym]?.dir || 'flat'; },

    meta() { return _meta ? { ..._meta } : null; },

    fmtBig,
    fmtPrice,
    fmtChg,

    refresh,

    all() { return snapshot(); },
  };

  /* ─── Shared navbar ticker — rendered from our own feed ─── */
  const TICKER = [
    ['Gold','XAU',2], ['Silver','XAG',2], ['BTC','BTC',0], ['ETH','ETH',0],
    ['WTI Oil','WTI',2], ['S&P 500','SPX',2], ['Nasdaq 100','NDQ',2], ['VIX','VIX',2],
    ['Dollar','DXY',2], ['US 10Y','US10Y',3], ['EUR/USD','EURUSD',4],
    ['GBP/USD','GBPUSD',4], ['USD/JPY','USDJPY',2],
  ];
  function updateTicker(data) {
    const wrap = document.querySelector('.nav-ticker-wrap');
    if (!wrap) return;
    // Pages that draw their own ticker (Trading Floor) claim the wrap with data-tv.
    if (wrap.dataset.tv && !wrap.dataset.ap) return;
    if (!wrap.dataset.ap) {
      wrap.dataset.tv = '1'; wrap.dataset.ap = '1';
      wrap.innerHTML = '<div class="nav-ticker-track"></div>';
    }
    if (!data) return;
    const items = TICKER.map(([label, key, dec]) => {
      const d = data[key];
      if (!d || d.price == null) return '';
      const val = key === 'US10Y' ? fmtPrice(d.price, dec) + '%' : fmtPrice(d.price, dec);
      return '<div class="nav-ticker-item"><span class="t-sym">' + label + '</span><span class="t-price">' + val +
        '</span><span class="t-chg ' + (d.dir || 'flat') + '">' + fmtChg(d.change) + '</span></div>';
    }).filter(Boolean).join('');
    if (items) wrap.querySelector('.nav-ticker-track').innerHTML = items + items;  // doubled for a seamless loop
  }

  ArcanePrices.subscribe(updateTicker);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => updateTicker(null));
  else updateTicker(null);

  /* ─── Boot ───────────────────────────────── */
  refresh();
  setInterval(refresh, 30000);

  /* ─── Export ─────────────────────────────── */
  window.ArcanePrices = ArcanePrices;

})();
