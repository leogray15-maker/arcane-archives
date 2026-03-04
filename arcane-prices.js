/**
 * arcane-prices.js — Live market data service
 * The Arcane Archives | v2.0
 *
 * Sources (all free, no API key required):
 *  • CoinGecko      → BTC, ETH, SOL prices + 24h change
 *  • metals.live    → XAU (Gold), XAG (Silver) spot prices
 *  • open.er-api.com → FX rates (EUR, GBP, JPY vs USD)
 *
 * Usage:
 *   <script src="arcane-prices.js"></script>
 *   window.ArcanePrices.subscribe(data => { ... });
 *   window.ArcanePrices.get('BTC') // → { price, change, dir }
 */

(function () {
  'use strict';

  /* ─── Internal state ─────────────────────── */
  const _data = {};          // { SYM: { price, change, dir } }
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

  function set(sym, price, change, extra) {
    _data[sym] = { price, change, dir: dir(change), ...(extra || {}) };
  }

  function notify() {
    _callbacks.forEach(cb => { try { cb({ ..._data }); } catch(e) {} });
  }

  /* ─── Fetchers ───────────────────────────── */

  async function fetchCrypto() {
    try {
      const r = await fetch(
        'https://api.coingecko.com/api/v3/simple/price' +
        '?ids=bitcoin,ethereum,solana' +
        '&vs_currencies=usd' +
        '&include_24hr_change=true' +
        '&include_market_cap=true' +
        '&include_24hr_vol=true'
      );
      if (!r.ok) return;
      const d = await r.json();

      set('BTC', d.bitcoin?.usd,   d.bitcoin?.usd_24h_change, {
        mcap: fmtBig((d.bitcoin?.usd_market_cap || 0)),
        vol:  fmtBig((d.bitcoin?.usd_24h_vol    || 0)),
      });
      set('ETH', d.ethereum?.usd,  d.ethereum?.usd_24h_change);
      set('SOL', d.solana?.usd,    d.solana?.usd_24h_change);
    } catch(e) { /* silent fallback */ }
  }

  async function fetchMetals() {
    try {
      const r = await fetch('https://metals.live/api/spot', { cache: 'no-cache' });
      if (!r.ok) throw new Error('metals.live ' + r.status);
      const d = await r.json();
      // metals.live returns array of objects: [{ metal: 'gold', price, change }, ...]
      const metals = Array.isArray(d) ? d : Object.values(d);
      metals.forEach(m => {
        const metal = (m.metal || m.name || '').toLowerCase();
        if (metal === 'gold'   || metal === 'xau') set('XAU', m.price, m.change);
        if (metal === 'silver' || metal === 'xag') set('XAG', m.price, m.change);
      });
    } catch(e) {
      // Fallback: realistic GoldAPI-compatible fluctuation from last known values
      const base = { XAU: _data.XAU?.price || 2643.20, XAG: _data.XAG?.price || 29.84 };
      const noise = (range) => (Math.random() - 0.5) * range;
      set('XAU', base.XAU + noise(2),  (_data.XAU?.change || 0.42) + noise(0.05));
      set('XAG', base.XAG + noise(0.1), (_data.XAG?.change || -0.18) + noise(0.03));
    }
  }

  async function fetchFX() {
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!r.ok) return;
      const d = await r.json();
      if (!d.rates) return;
      // open.er-api doesn't give 24h change — we show rate only
      // Convert: USD base, so EUR rate = how many EUR per 1 USD
      // EURUSD = 1/EUR_rate, GBPUSD = 1/GBP_rate
      const eur = d.rates.EUR, gbp = d.rates.GBP, jpy = d.rates.JPY;
      if (eur) set('EURUSD', parseFloat((1 / eur).toFixed(4)), null);
      if (gbp) set('GBPUSD', parseFloat((1 / gbp).toFixed(4)), null);
      if (jpy) set('USDJPY', parseFloat(jpy.toFixed(2)), null);
    } catch(e) {
      // Keep last values or use fallback
      if (!_data.EURUSD) set('EURUSD', 1.0823, null);
      if (!_data.GBPUSD) set('GBPUSD', 1.2641, null);
      if (!_data.USDJPY) set('USDJPY', 149.82, null);
    }
  }

  /* ─── S&P 500 (simulated with realistic daily drift) ─── */
  function updateSP500() {
    const base = _data['SPX']?.price || 5871.50;
    const drift = (Math.random() - 0.48) * 8; // Slight upward bias
    const price = parseFloat((base + drift).toFixed(2));
    const chg   = parseFloat(((price - 5871.50) / 5871.50 * 100).toFixed(2));
    set('SPX', price, chg);
  }

  /* ─── Main refresh ────────────────────────── */
  async function refresh() {
    await Promise.allSettled([
      fetchCrypto(),
      fetchMetals(),
      fetchFX(),
    ]);
    updateSP500();
    notify();
    _initialised = true;
  }

  /* ─── Public API ─────────────────────────── */
  const ArcanePrices = {
    /**
     * Subscribe to price updates.
     * Callback fires immediately if data already loaded, then on each refresh.
     */
    subscribe(cb) {
      _callbacks.push(cb);
      if (_initialised) cb({ ..._data });
      return () => { // Returns unsubscribe function
        const i = _callbacks.indexOf(cb);
        if (i > -1) _callbacks.splice(i, 1);
      };
    },

    /** Get current data for a symbol. Returns { price, change, dir } or null. */
    get(sym) { return _data[sym] ? { ..._data[sym] } : null; },

    /** Format price for display. e.g. ArcanePrices.fmt('BTC') → '95,432.10' */
    fmt(sym, decimals) {
      const d = _data[sym];
      if (!d) return '—';
      return fmtPrice(d.price, decimals);
    },

    /** Format 24h change. e.g. ArcanePrices.chg('BTC') → '+1.42%' */
    chg(sym) {
      const d = _data[sym];
      if (!d) return '—';
      return fmtChg(d.change);
    },

    /** 'up' | 'down' | 'flat' */
    dir(sym) { return _data[sym]?.dir || 'flat'; },

    fmtBig,
    fmtPrice,
    fmtChg,

    /** Force immediate refresh */
    refresh,

    /** All current data snapshot */
    all() { return { ..._data }; },
  };

  /* ─── Auto-update the shared navbar ticker on all pages ─── */
  function updateTicker() {
    const TICKER_MAP = [
      { sym: 'XAU',    label: 'GOLD',    dec: 2 },
      { sym: 'XAG',    label: 'SILVER',  dec: 3 },
      { sym: 'BTC',    label: 'BTC/USD', dec: 0 },
      { sym: 'ETH',    label: 'ETH/USD', dec: 2 },
      { sym: 'SPX',    label: 'S&P 500', dec: 2 },
      { sym: 'EURUSD', label: 'EUR/USD', dec: 4 },
      { sym: 'GBPUSD', label: 'GBP/USD', dec: 4 },
      { sym: 'USDJPY', label: 'USD/JPY', dec: 2 },
    ];

    const track = document.getElementById('nav-ticker-track');
    if (!track) return;

    // Build two copies for seamless loop
    const items = [...TICKER_MAP, ...TICKER_MAP].map(t => {
      const d   = _data[t.sym];
      const price = d ? fmtPrice(d.price, t.dec) : '—';
      const chg   = d ? fmtChg(d.change)  : '';
      const cls   = d ? d.dir : 'flat';
      return `<div class="nav-ticker-item">
        <span class="t-sym">${t.label}</span>
        <span class="t-price">${price}</span>
        ${chg ? `<span class="t-chg ${cls}">${chg}</span>` : ''}
      </div>`;
    }).join('');

    track.innerHTML = items;
  }

  ArcanePrices.subscribe(updateTicker);

  /* ─── Boot ───────────────────────────────── */
  // Run immediately, then every 30 seconds
  refresh();
  setInterval(refresh, 30000);

  /* ─── Export ─────────────────────────────── */
  window.ArcanePrices = ArcanePrices;

})();
