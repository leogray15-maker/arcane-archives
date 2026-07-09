/**
 * arcane-prices.js — Live market data service
 * The Arcane Archives | v3.0
 *
 * 100% free sources, NO API keys, NO TradingView:
 *  • /api/markets (server proxy)  → Stooq primary (indices, metals, energy,
 *      FX, bonds — price + day % change + OHLC/vol), Yahoo/AlphaVantage
 *      fallback, CoinPaprika crypto globals. Cached server-side.
 *  • api.binance.com (direct)     → BTC/ETH/SOL real-time (uses the
 *      visitor's own IP, so datacenter rate-limits never apply).
 *  • api.gold-api.com (direct)    → live XAU/XAG spot, CORS-enabled.
 *  • /api/fx (open.er-api.com)    → FX baseline (no % change).
 *
 * Anything no provider returns falls back to a STATIC seed value shown with
 * no % change (— instead of a made-up number). Seeds never overwrite live
 * data and never drift — the old "simulation" random-walk is gone.
 *
 * The shared navbar ticker is rendered by this file as plain DOM from the
 * same live data (classes .nav-ticker-item / .t-sym / .t-price / .t-chg that
 * every portal page already styles).
 */

(function () {
  'use strict';

  /* ─── Internal state ─────────────────────── */
  const _data = {};          // { SYM: { price, change, dir, live?, sim?, open?, high?, low?, vol? } }
  const _callbacks = [];     // subscriber functions
  let   _initialised = false;

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

  // Live setter — marks the symbol as provider-backed so seeds never touch it
  function setLive(sym, price, change, extra) {
    _data[sym] = { price, change, dir: dir(change), live: true, ...(extra || {}) };
  }

  // Seed setter — only fills a hole; never overwrites anything
  function seed(sym, price) {
    if (_data[sym]) return;
    _data[sym] = { price, change: null, dir: 'flat', sim: true };
  }

  function notify() {
    _callbacks.forEach(cb => { try { cb({ ..._data }); } catch(e) {} });
  }

  /* ─── Last-resort placeholders (shown with "—" change, never drift) ─── */
  function seedBaselines() {
    seed('XAU', 4113);   seed('XAG', 48.2);
    seed('BTC', 62000);  seed('ETH', 1740);   seed('SOL', 77);
    seed('SPX', 7467);   seed('NDQ', 23900);  seed('DOW', 52200); seed('FTSE', 9200);
    seed('VIX', 18.4);   seed('DXY', 104.1);
    seed('WTI', 74.5);   seed('BRENT', 78.2); seed('NATGAS', 3.4); seed('COPPER', 5.1);
    seed('US10Y', 4.40); seed('UK10Y', 4.55); seed('DE10Y', 2.60); seed('JP10Y', 1.60);
    seed('EURUSD', 1.1414); seed('GBPUSD', 1.3374); seed('USDJPY', 162.52);
    seed('AUDUSD', 0.6600); seed('USDCAD', 1.3600); seed('USDCHF', 0.8000);
    seed('EURGBP', 0.8534);
  }

  /* ─── Fetchers ───────────────────────────── */

  async function fetchMarkets() {
    try {
      const r = await fetch('/api/markets', { cache: 'no-cache' });
      if (!r.ok) { console.log('[ArcanePrices] /api/markets HTTP', r.status); return; }
      const j = await r.json();
      try {
        console.log('%c[ArcanePrices] data sources →',
          'color:#f5c842;font-weight:bold',
          'Stooq:', j.meta?.stooqCount, j.meta?.stooqSymbols || [],
          '| Yahoo:', j.meta?.yahooCount,
          '| AV key:', j.meta?.avKey, 'AV:', j.meta?.avCount,
          '| total real:', j.meta?.total);
      } catch (_) {}
      const d = j && j.data;
      if (!d) return;

      // Real price + day % change (+ OHLC/volume when the source has them)
      Object.entries(d).forEach(([sym, v]) => {
        if (v && v.price != null) {
          setLive(sym, v.price, v.change, {
            open: v.open, high: v.high, low: v.low, vol: v.vol,
          });
        }
      });

      // BTC card extras (market cap / 24h volume) from CoinPaprika
      if (j.crypto && _data.BTC) {
        if (j.crypto.btcMcap != null) _data.BTC.mcap = fmtBig(j.crypto.btcMcap);
        if (j.crypto.btcVol  != null) _data.BTC.vol24 = fmtBig(j.crypto.btcVol);
      }

      // Crypto overview panel (total cap, volume, dominance) from CoinPaprika
      if (j.global) {
        const g = j.global;
        const btcDom = g.btcDom || 0;
        setLive('CRYPTO_GLOBAL', g.totalMcap || 0, g.change ?? null, {
          totalMcap: fmtBig(g.totalMcap || 0),
          totalVol:  fmtBig(g.totalVol  || 0),
          btcDom:    btcDom.toFixed(1) + '%',
          altDom:    Math.max(0, 100 - btcDom).toFixed(1) + '%',
          activeCoinCount: (g.coins || 0).toLocaleString(),
        });
      }
    } catch (e) { /* keep whatever we already have */ }
  }

  async function fetchFX() {
    try {
      const r = await fetch('/api/fx/latest/USD');
      if (!r.ok) return;
      const d = await r.json();
      if (!d.rates) return;
      const { EUR, GBP, JPY, AUD, CAD, CHF } = d.rates;
      // Real rates but no day-change data — keep an existing live change if
      // a better provider (server Stooq) already supplied one.
      const keep = (sym) => (_data[sym] && _data[sym].live) ? _data[sym].change : null;
      if (EUR && !_data.EURUSD?.live) setLive('EURUSD', parseFloat((1 / EUR).toFixed(4)), keep('EURUSD'));
      if (GBP && !_data.GBPUSD?.live) setLive('GBPUSD', parseFloat((1 / GBP).toFixed(4)), keep('GBPUSD'));
      if (JPY && !_data.USDJPY?.live) setLive('USDJPY', parseFloat(JPY.toFixed(2)),       keep('USDJPY'));
      if (AUD && !_data.AUDUSD?.live) setLive('AUDUSD', parseFloat((1 / AUD).toFixed(4)), keep('AUDUSD'));
      if (CAD && !_data.USDCAD?.live) setLive('USDCAD', parseFloat(CAD.toFixed(4)),       keep('USDCAD'));
      if (CHF && !_data.USDCHF?.live) setLive('USDCHF', parseFloat(CHF.toFixed(4)),       keep('USDCHF'));
      if (EUR && GBP && !_data.EURGBP?.live) setLive('EURGBP', parseFloat((GBP / EUR).toFixed(4)), null);
    } catch(e) { /* seeds cover it */ }
  }

  /* ─── Metals spot direct from gold-api.com (free, no key, CORS) ─── */
  async function fetchMetalsDirect() {
    const grab = async (metal, sym) => {
      try {
        const r = await fetch('https://api.gold-api.com/price/' + metal);
        if (!r.ok) return;
        const j = await r.json();
        const price = parseFloat(j && j.price);
        if (isNaN(price) || price <= 0) return;
        const prev = _data[sym];
        // Fresh real-time spot; keep the day % change (and OHLC) the server gave us
        setLive(sym, price, prev && prev.live ? prev.change : null, prev && prev.live ? {
          open: prev.open, high: prev.high, low: prev.low, vol: prev.vol,
        } : undefined);
      } catch (e) { /* optional */ }
    };
    await Promise.all([grab('XAU', 'XAU'), grab('XAG', 'XAG')]);
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
        setLive(sym, parseFloat(t.lastPrice), parseFloat(t.priceChangePercent), {
          open: parseFloat(t.openPrice) || undefined,
          high: parseFloat(t.highPrice) || undefined,
          low:  parseFloat(t.lowPrice)  || undefined,
          vol:  parseFloat(t.quoteVolume) || undefined,
          mcap: prev.mcap,
          vol24: prev.vol24 || (parseFloat(t.quoteVolume) ? fmtBig(parseFloat(t.quoteVolume)) : undefined),
        });
      });
    } catch (e) { /* server / seed values cover it */ }
  }

  /* ─── Main refresh ────────────────────────── */
  async function refresh() {
    seedBaselines();                 // fill holes once — never overwrites
    await fetchFX();                 // er-api FX rates (baseline, no % change)
    await fetchMarkets();            // server: Stooq/Yahoo/AV + crypto globals
    await Promise.all([
      fetchMetalsDirect(),           // gold-api: freshest XAU/XAG spot
      fetchCryptoDirect(),           // Binance: freshest crypto, wins last
    ]);
    notify();
    _initialised = true;
  }

  /* ─── Public API ─────────────────────────── */
  const ArcanePrices = {
    subscribe(cb) {
      _callbacks.push(cb);
      if (_initialised) cb({ ..._data });
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

    fmtBig,
    fmtPrice,
    fmtChg,

    refresh,

    all() { return { ..._data }; },
  };

  /* ─── Shared navbar ticker — self-rendered DOM, no third-party embeds ─── */
  const TICKER_SYMBOLS = [
    ['Gold', 'XAU', 2], ['Silver', 'XAG', 2], ['BTC', 'BTC', 0], ['ETH', 'ETH', 0],
    ['SOL', 'SOL', 2], ['WTI Oil', 'WTI', 2], ['S&P 500', 'SPX', 1], ['Nasdaq', 'NDQ', 0],
    ['Dow', 'DOW', 0], ['VIX', 'VIX', 2], ['Dollar', 'DXY', 2], ['US 10Y', 'US10Y', 2],
    ['EUR/USD', 'EURUSD', 4], ['GBP/USD', 'GBPUSD', 4], ['USD/JPY', 'USDJPY', 2],
  ];

  function updateTicker(data) {
    const wrap = document.querySelector('.nav-ticker-wrap');
    if (!wrap || wrap.dataset.tv) return;   // a page can claim the slot (trading floor does)
    let track = wrap.querySelector('.nav-ticker-track');
    if (!track) {
      wrap.innerHTML = '<div class="nav-ticker-track" id="nav-ticker-track"></div>';
      track = wrap.firstChild;
    }
    if (!data || !Object.keys(data).length) return;
    const items = TICKER_SYMBOLS.map(([label, key, dec]) => {
      const d = data[key];
      if (!d || d.price == null) return '';
      return `<div class="nav-ticker-item">
        <span class="t-sym">${label}</span>
        <span class="t-price">${fmtPrice(d.price, dec)}</span>
        <span class="t-chg ${d.dir || 'flat'}">${fmtChg(d.change)}</span>
      </div>`;
    }).filter(Boolean).join('');
    if (items) track.innerHTML = items + items; // duplicated for the seamless -50% loop
  }

  ArcanePrices.subscribe(updateTicker);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => updateTicker({ ..._data }));
  else updateTicker({ ..._data });

  /* ─── Boot ───────────────────────────────── */
  refresh();
  setInterval(refresh, 30000);

  /* ─── Export ─────────────────────────────── */
  window.ArcanePrices = ArcanePrices;

})();
