/**
 * arcane-prices.js — Live market data service
 * The Arcane Archives | v2.1
 *
 * Sources (all free, no API key required):
 *  • CoinGecko /simple/price  → BTC, ETH, SOL prices + 24h change
 *  • CoinGecko /global        → total market cap, BTC dominance
 *  • metals.live              → XAU (Gold), XAG (Silver) spot prices
 *  • open.er-api.com          → FX rates (EUR, GBP, JPY, AUD, CAD, CHF vs USD)
 *  • Simulation               → DOW, NDQ, VIX, WTI, BRENT, NATGAS, COPPER,
 *                               US10Y, UK10Y, DE10Y, JP10Y, DXY, SPX
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

  function noise(range) { return (Math.random() - 0.5) * range; }

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

      set('BTC', d.bitcoin?.usd,  d.bitcoin?.usd_24h_change, {
        mcap: fmtBig((d.bitcoin?.usd_market_cap || 0)),
        vol:  fmtBig((d.bitcoin?.usd_24h_vol    || 0)),
      });
      set('ETH', d.ethereum?.usd, d.ethereum?.usd_24h_change);
      set('SOL', d.solana?.usd,   d.solana?.usd_24h_change);
    } catch(e) { /* silent fallback */ }
  }

  async function fetchCryptoGlobal() {
    try {
      const r = await fetch('https://api.coingecko.com/api/v3/global');
      if (!r.ok) return;
      const d = await r.json();
      const gd = d.data;
      if (!gd) return;
      const totalMcap = gd.total_market_cap?.usd || 0;
      const totalVol  = gd.total_volume?.usd     || 0;
      const btcDom    = gd.market_cap_percentage?.btc || 0;
      const ethDom    = gd.market_cap_percentage?.eth || 0;
      set('CRYPTO_GLOBAL', totalMcap, null, {
        totalMcap:  fmtBig(totalMcap),
        totalVol:   fmtBig(totalVol),
        btcDom:     btcDom.toFixed(1) + '%',
        ethDom:     ethDom.toFixed(1) + '%',
        altDom:     (100 - btcDom - ethDom).toFixed(1) + '%',
        activeCoinCount: (gd.active_cryptocurrencies || 0).toLocaleString(),
      });
    } catch(e) { /* silent */ }
  }

  async function fetchMetals() {
    try {
      const r = await fetch('https://metals.live/api/spot', { cache: 'no-cache' });
      if (!r.ok) throw new Error('metals.live ' + r.status);
      const d = await r.json();
      const metals = Array.isArray(d) ? d : Object.values(d);
      metals.forEach(m => {
        const metal = (m.metal || m.name || '').toLowerCase();
        if (metal === 'gold'   || metal === 'xau') set('XAU', m.price, m.change);
        if (metal === 'silver' || metal === 'xag') set('XAG', m.price, m.change);
      });
    } catch(e) {
      const base = { XAU: _data.XAU?.price || 2643.20, XAG: _data.XAG?.price || 29.84 };
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
      const { EUR, GBP, JPY, AUD, CAD, CHF } = d.rates;
      if (EUR) set('EURUSD', parseFloat((1 / EUR).toFixed(4)), null);
      if (GBP) set('GBPUSD', parseFloat((1 / GBP).toFixed(4)), null);
      if (JPY) set('USDJPY', parseFloat(JPY.toFixed(2)),       null);
      if (AUD) set('AUDUSD', parseFloat((1 / AUD).toFixed(4)), null);
      if (CAD) set('USDCAD', parseFloat(CAD.toFixed(4)),       null);
      if (CHF) set('USDCHF', parseFloat(CHF.toFixed(4)),       null);
      if (EUR && GBP) set('EURGBP', parseFloat((GBP / EUR).toFixed(4)), null);
    } catch(e) {
      if (!_data.EURUSD) set('EURUSD', 1.0823, null);
      if (!_data.GBPUSD) set('GBPUSD', 1.2641, null);
      if (!_data.USDJPY) set('USDJPY', 149.82, null);
      if (!_data.AUDUSD) set('AUDUSD', 0.6512, null);
      if (!_data.USDCAD) set('USDCAD', 1.3541, null);
      if (!_data.USDCHF) set('USDCHF', 0.8921, null);
      if (!_data.EURGBP) set('EURGBP', 0.8571, null);
    }
  }

  /* ─── Simulated instruments (no free API) ─── */
  function simulateMarkets() {
    // S&P 500
    const spxBase = _data.SPX?.price || 5871.50;
    const spxNew  = parseFloat((spxBase + (Math.random() - 0.48) * 8).toFixed(2));
    set('SPX', spxNew, parseFloat(((spxNew - 5871.50) / 5871.50 * 100).toFixed(2)));

    // Dow Jones
    const dowBase = _data.DOW?.price || 43820.00;
    const dowNew  = parseFloat((dowBase + (Math.random() - 0.48) * 45).toFixed(2));
    set('DOW', dowNew, parseFloat(((dowNew - 43820) / 43820 * 100).toFixed(2)));

    // NASDAQ 100
    const ndqBase = _data.NDQ?.price || 18820.00;
    const ndqNew  = parseFloat((ndqBase + (Math.random() - 0.47) * 22).toFixed(2));
    set('NDQ', ndqNew, parseFloat(((ndqNew - 18820) / 18820 * 100).toFixed(2)));

    // VIX — mean-revert around 18
    const vixBase = _data.VIX?.price || 18.45;
    const vixNew  = Math.max(9, parseFloat((vixBase + (Math.random() - 0.52) * 0.3).toFixed(2)));
    const vixChg  = parseFloat(((vixNew - 18.45) / 18.45 * 100).toFixed(2));
    set('VIX', vixNew, vixChg);

    // WTI Crude
    const wtiBase = _data.WTI?.price || 72.45;
    const wtiNew  = parseFloat((wtiBase + noise(0.4)).toFixed(2));
    set('WTI', wtiNew, parseFloat(((wtiNew - 72.45) / 72.45 * 100).toFixed(2)));

    // Brent Crude
    const brtBase = _data.BRENT?.price || 75.80;
    const brtNew  = parseFloat((brtBase + noise(0.4)).toFixed(2));
    set('BRENT', brtNew, parseFloat(((brtNew - 75.80) / 75.80 * 100).toFixed(2)));

    // Natural Gas
    const ngBase = _data.NATGAS?.price || 2.85;
    const ngNew  = Math.max(1.5, parseFloat((ngBase + noise(0.025)).toFixed(3)));
    set('NATGAS', ngNew, parseFloat(((ngNew - 2.85) / 2.85 * 100).toFixed(2)));

    // Copper ($/lb)
    const cuBase = _data.COPPER?.price || 4.12;
    const cuNew  = parseFloat((cuBase + noise(0.018)).toFixed(3));
    set('COPPER', cuNew, parseFloat(((cuNew - 4.12) / 4.12 * 100).toFixed(2)));

    // US 10Y Yield
    const us10Base = _data.US10Y?.price || 4.452;
    const us10New  = Math.max(0.5, parseFloat((us10Base + noise(0.012)).toFixed(3)));
    set('US10Y', us10New, parseFloat((us10New - 4.452).toFixed(3)));

    // UK 10Y Gilt
    const uk10Base = _data.UK10Y?.price || 4.281;
    const uk10New  = Math.max(0.5, parseFloat((uk10Base + noise(0.010)).toFixed(3)));
    set('UK10Y', uk10New, parseFloat((uk10New - 4.281).toFixed(3)));

    // German 10Y Bund
    const de10Base = _data.DE10Y?.price || 2.381;
    const de10New  = Math.max(-0.5, parseFloat((de10Base + noise(0.008)).toFixed(3)));
    set('DE10Y', de10New, parseFloat((de10New - 2.381).toFixed(3)));

    // Japan 10Y JGB
    const jp10Base = _data.JP10Y?.price || 1.042;
    const jp10New  = Math.max(0, parseFloat((jp10Base + noise(0.005)).toFixed(3)));
    set('JP10Y', jp10New, parseFloat((jp10New - 1.042).toFixed(3)));

    // DXY (USD Index)
    const dxyBase = _data.DXY?.price || 104.12;
    const dxyNew  = parseFloat((dxyBase + noise(0.12)).toFixed(2));
    set('DXY', dxyNew, parseFloat(((dxyNew - 104.12) / 104.12 * 100).toFixed(2)));
  }

  /* ─── Main refresh ────────────────────────── */
  async function refresh() {
    await Promise.allSettled([
      fetchCrypto(),
      fetchCryptoGlobal(),
      fetchMetals(),
      fetchFX(),
    ]);
    simulateMarkets();
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

  /* ─── Auto-update shared navbar ticker ─── */
  function updateTicker() {
    const TICKER_MAP = [
      { sym: 'XAU',    label: 'GOLD',    dec: 2 },
      { sym: 'XAG',    label: 'SILVER',  dec: 3 },
      { sym: 'BTC',    label: 'BTC/USD', dec: 0 },
      { sym: 'ETH',    label: 'ETH/USD', dec: 2 },
      { sym: 'WTI',    label: 'WTI OIL', dec: 2 },
      { sym: 'SPX',    label: 'S&P 500', dec: 2 },
      { sym: 'VIX',    label: 'VIX',     dec: 2 },
      { sym: 'DXY',    label: 'DXY',     dec: 2 },
      { sym: 'US10Y',  label: 'US 10Y',  dec: 3 },
      { sym: 'EURUSD', label: 'EUR/USD', dec: 4 },
      { sym: 'GBPUSD', label: 'GBP/USD', dec: 4 },
      { sym: 'USDJPY', label: 'USD/JPY', dec: 2 },
    ];

    const track = document.getElementById('nav-ticker-track');
    if (!track) return;

    const items = [...TICKER_MAP, ...TICKER_MAP].map(t => {
      const d     = _data[t.sym];
      const price = d ? fmtPrice(d.price, t.dec) : '—';
      const chg   = d ? fmtChg(d.change) : '';
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
  refresh();
  setInterval(refresh, 30000);

  /* ─── Export ─────────────────────────────── */
  window.ArcanePrices = ArcanePrices;

})();
