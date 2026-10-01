// portal-shell.js
// Shared member-portal chrome: injects the hub top bar (menu, search, tabs,
// account) with the live market strip, the menu drawer, the "jump to" search
// and the page banner; highlights the active page, wires logout, populates nav
// user data and loads the live ticker. Reuses the Firebase app from
// auth-guard.js (no re-init).
//
// Usage on a page:
//   <body data-page="stock-picks">
//   <link rel="stylesheet" href="arcane-portal.css">
//   <div data-hub-banner></div>   (optional: the cinematic page banner; any
//                                  children are kept as the banner's extras)
//   ...page content (offset below the fixed top bar by the body padding)...
//   <script type="module" src="portal-shell.js"></script>

import { auth, db, ADMIN_UIDS } from './auth-guard.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { EXP, ADMIN } from './arcane-experiences.js';

const ICON = {
  dashboard: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  watchtower: '<circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="4" ry="10"/><line x1="2" y1="12" x2="22" y2="12"/>',
  floor: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  war: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  stocks: '<polyline points="22 7 13.5 15.5 8.5 10.5 1 18"/><polyline points="16 7 22 7 22 13"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  signal: '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1"/>',
  video: '<path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>',
  bullion: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  store: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 17l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
};

// Sidebar groups: page key -> {label, href, icon}
const NAV = [
  { label: null, items: [
    { key: 'dashboard',       label: 'Dashboard',     href: 'dashboard.html',       icon: 'dashboard' },
  ]},
  { label: 'The Archives', items: [
    { key: 'courses',         label: 'The Vault',     href: 'courses.html',         icon: 'book' },
    { key: 'arcane-insights', label: 'Daily Insight', href: 'arcane-insights.html', icon: 'spark' },
    { key: 'war-room',        label: 'War Room',      href: 'war-room.html',        icon: 'war' },
    { key: 'live-calls',      label: 'Live Calls',    href: 'live-calls.html',      icon: 'chat' },
    { key: 'live-streams',    label: 'Live Streams',  href: 'live-streams.html',    icon: 'video' },
  ]},
  { label: 'Markets', items: [
    { key: 'trading-floor',   label: 'Trading Floor', href: 'trading-floor.html',   icon: 'floor' },
    { key: 'watchtower',      label: 'Watchtower',    href: '/watchtower/',          icon: 'watchtower' },
    { key: 'stock-picks',     label: 'Stock Picks',   href: 'stock-picks.html',     icon: 'stocks' },
    { key: 'free-signals',    label: 'Signals',       href: 'free-signals.html',    icon: 'signal' },
    { key: 'bullion',         label: 'Bullion',       href: 'bullion.html',         icon: 'bullion' },
  ]},
  { label: 'Members', items: [
    { key: 'referrals',       label: 'Referrals',     href: 'referrals.html',       icon: 'users' },
    { key: 'arcane-store',    label: 'Store',         href: 'arcane-store.html',    icon: 'store' },
    { key: 'settings',        label: 'Settings',      href: 'settings.html',        icon: 'settings' },
  ]},
];

// Pages that live under another nav item
const ALIAS = {
  'read': 'courses', 'notion-invite': 'courses',
  'world-map': 'watchtower', 'global-intelligence': 'watchtower', 'market-data': 'trading-floor',
  'store-orders': 'arcane-store', 'store-success': 'arcane-store',
};

function svg(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;
}

function navItem(it, active) {
  const on = it.key === active;
  return `<a class="sidebar-nav-item${on ? ' active' : ''}" href="${it.href}"${on ? ' aria-current="page"' : ''}>
    <span class="sidebar-nav-icon">${svg(it.icon)}</span>
    <span class="sidebar-nav-label">${it.label}</span>
  </a>`;
}

function activeLabel(active) {
  for (const g of NAV) for (const it of g.items) if (it.key === active) return it.label;
  return document.body.dataset.title || '';
}

// The dashboard renders its own hub navigation (data-shell="hub"): the shell
// then only supplies the drawer. Every other page gets the shell's top bar.
const HUB = () => document.body.dataset.shell === 'hub';

// Top-bar tabs and the sections that light each one up
const TABS = [
  { label: 'Home',         href: 'dashboard.html',          keys: ['dashboard'] },
  { label: 'The Archives', href: 'dashboard.html#archives', keys: ['courses', 'arcane-insights', 'war-room', 'live-calls', 'live-streams'] },
  { label: 'Markets',      href: 'trading-floor.html',      keys: ['trading-floor', 'watchtower', 'stock-picks', 'free-signals', 'bullion'] },
  { label: 'Store',        href: 'arcane-store.html',       keys: ['arcane-store'] },
];

function topBar(active) {
  const tabs = TABS.map(t => `<a class="aa-tab" href="${t.href}"${t.keys.includes(active) ? ' aria-current="page"' : ''}>${t.label}</a>`).join('');
  return `
  <header class="aa-bar" id="aa-bar">
    <div class="aa-bar-row">
      <div class="aa-bar-left">
        <button class="aa-icon-btn" id="sidebar-toggle" aria-label="Open the menu" aria-expanded="false" aria-controls="arcane-sidebar">${svg('menu')}<span class="aa-hide-md">Menu</span></button>
        <button class="aa-icon-btn" id="aa-jump-btn" aria-label="Search the Archives" aria-expanded="false" aria-controls="aa-jump">${svg('search')}<kbd class="aa-hide-md" aria-hidden="true">/</kbd></button>
        <a class="aa-wordmark" href="dashboard.html" aria-label="The Arcane Archives, home"><img src="arcane-mark.svg" alt=""><span class="t"><i>Arcane </i><b>Archives</b></span></a>
      </div>
      <nav class="aa-tabs" aria-label="Sections">${tabs}</nav>
      <div class="aa-bar-right">
        <a class="aa-balance" href="referrals.html" title="Referral balance"><span>Balance</span><b id="nav-balance">£0.00</b></a>
        <a class="aa-icon-btn aa-hide-sm" href="settings.html" aria-label="Settings">${svg('settings')}</a>
        <a class="aa-avatar" href="settings.html" aria-label="Your account"><img id="nav-avatar" src="arcane-icon-192.png" alt=""><span class="nav-online offline" id="nav-online"></span></a>
      </div>
    </div>
    <div class="aa-strip">
      <div class="aa-strip-meta"><span id="aa-strip-date"></span><span><i class="aa-dot" id="aa-strip-dot"></i><span id="aa-strip-london">London closed</span></span></div>
      <div class="nav-ticker-wrap" aria-label="Live market prices"></div>
      ${active === 'trading-floor' ? '' : '<a class="aa-strip-link" href="trading-floor.html">Trading Floor →</a>'}
    </div>
  </header>
  <div class="aa-jump" id="aa-jump" role="dialog" aria-modal="true" aria-label="Search the Archives">
    <div class="aa-jump-box">
      <input class="aa-jump-input" id="aa-jump-input" type="search" placeholder="Jump to… The Vault, Watchtower, Store" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="aa-jump-list" aria-label="Search destinations">
      <ul class="aa-jump-list" id="aa-jump-list" role="listbox"></ul>
    </div>
  </div>`;
}

function buildShell(active) {
  const groups = NAV.map(g => `
    <div class="sidebar-group">
      ${g.label ? `<div class="sidebar-section-label">${g.label}</div>` : ''}
      ${g.items.map(it => navItem(it, active)).join('')}
    </div>`).join('');

  const sidebar = `
  <div class="arcane-sidebar" id="arcane-sidebar" role="complementary" aria-label="Portal">
    <a class="sidebar-brand" href="dashboard.html">
      <img src="arcane-mark.svg" alt=""/>
      <span class="brand-text">The Arcane Archives</span>
    </a>
    <div class="sidebar-scroll" role="navigation" aria-label="Portal sections">
      ${groups}
      <a class="sidebar-nav-item admin-item" href="admin-panel.html" id="sidebar-admin-link" style="display:none">
        <span class="sidebar-nav-icon">${svg('shield')}</span>
        <span class="sidebar-nav-label">Admin</span>
      </a>
    </div>
    <div class="sidebar-user">
      <img class="sidebar-user-avatar" id="sidebar-user-avatar" src="arcane-icon-192.png" alt=""/>
      <div class="sidebar-user-meta">
        <span class="sidebar-user-name" id="sidebar-user-name">Member</span>
        <span class="sidebar-user-plan" id="sidebar-user-plan">The Arcane Archives</span>
      </div>
      <button class="sidebar-logout" data-logout title="Log out" aria-label="Log out">${svg('logout')}</button>
    </div>
  </div>
  <div class="sidebar-overlay" id="sidebar-overlay"></div>`;

  const host = document.createElement('div');
  host.id = 'arcane-shell';
  host.innerHTML = sidebar + (HUB() ? '' : topBar(active));
  document.body.insertBefore(host, document.body.firstChild);
  document.body.classList.add('shell-hub');
  if (!HUB()) {
    document.body.classList.add('has-portal-shell');
    const atmos = document.createElement('div');
    atmos.className = 'aa-atmos';
    atmos.setAttribute('aria-hidden', 'true');
    atmos.innerHTML = '<div class="grid"></div><div class="grain"></div>';
    document.body.insertBefore(atmos, host);
  }
}

// The bar is fixed; pages offset themselves by its live height (--aa-nav-h,
// and --nav-h for the pages that use the older name).
function trackBarHeight() {
  const bar = document.getElementById('aa-bar');
  if (!bar) return;
  const set = () => {
    const h = Math.round(bar.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--aa-nav-h', h + 'px');
    document.documentElement.style.setProperty('--nav-h', h + 'px');
  };
  set();
  if ('ResizeObserver' in window) new ResizeObserver(set).observe(bar);
  // Keep the current section's tab in view when the tabs scroll sideways
  const tabs = bar.querySelector('.aa-tabs'), cur = tabs?.querySelector('[aria-current]');
  if (cur && tabs.scrollWidth > tabs.clientWidth) tabs.scrollLeft = cur.offsetLeft - (tabs.clientWidth - cur.offsetWidth) / 2;
  const onScroll = () => bar.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
}

// Date and London session in the strip (the same rule the dashboard uses)
function renderStrip() {
  const date = document.getElementById('aa-strip-date');
  if (!date) return;
  const d = new Date();
  date.textContent = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).replace(/,/g, '').toUpperCase();
  const h = d.getHours(), day = d.getDay(), m = d.getMinutes();
  const open = day >= 1 && day <= 5 && h >= 8 && (h < 16 || (h === 16 && m <= 30));
  document.getElementById('aa-strip-london').textContent = open ? 'London open' : 'London closed';
  document.getElementById('aa-strip-dot').classList.toggle('open', open);
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// "Jump to": search every real destination ("/" or Cmd/Ctrl-K)
let isAdmin = false;
function bindJump() {
  const box = document.getElementById('aa-jump'), input = document.getElementById('aa-jump-input'),
        list = document.getElementById('aa-jump-list'), btn = document.getElementById('aa-jump-btn');
  if (!box) return;
  const all = () => [
    { title: 'Dashboard', href: 'dashboard.html', group: 'Home', words: 'dashboard home hub' },
    ...NAV.slice(1).flatMap(g => g.items.map(it => {
      const e = EXP[it.key] || {};
      return { title: e.title || it.label, href: it.href, group: g.label === 'The Archives' ? 'Archives' : g.label, words: `${it.label} ${e.title || ''} ${e.cat || ''} ${e.desc || ''}` };
    })),
    ...(isAdmin ? ADMIN.map(([h, t, s]) => ({ title: t, href: h, group: 'Admin', words: `${t} ${s} admin` })) : []),
  ];
  let sel = 0, rows = [], lastFocus = null;
  const paint = () => {
    const q = input.value.trim().toLowerCase();
    rows = all().filter(r => !q || r.words.toLowerCase().includes(q));
    if (q) rows.sort((a, b) => b.title.toLowerCase().includes(q) - a.title.toLowerCase().includes(q));
    sel = Math.min(sel, Math.max(0, rows.length - 1));
    list.innerHTML = rows.length
      ? rows.map((r, i) => `<li><a href="${esc(r.href)}" role="option" id="aa-jump-${i}" aria-selected="${i === sel}">${esc(r.title)}<span class="g">${r.group}</span></a></li>`).join('')
      : '<li class="aa-jump-empty">Nothing matches that.</li>';
    input.setAttribute('aria-activedescendant', rows.length ? `aa-jump-${sel}` : '');
  };
  const open = () => { lastFocus = document.activeElement; box.classList.add('open'); input.value = ''; sel = 0; paint(); input.focus(); btn.setAttribute('aria-expanded', 'true'); };
  const close = () => { box.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); lastFocus?.focus?.(); };
  btn.addEventListener('click', open);
  box.addEventListener('click', e => { if (e.target === box) close(); });
  input.addEventListener('input', () => { sel = 0; paint(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, rows.length - 1); paint(); document.getElementById(`aa-jump-${sel}`)?.scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); paint(); document.getElementById(`aa-jump-${sel}`)?.scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'Enter' && rows[sel]) { e.preventDefault(); location.href = rows[sel].href; }
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
  });
  document.addEventListener('keydown', e => {
    const typing = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); box.classList.contains('open') ? close() : open(); }
  });
}

// The cinematic banner: <div data-hub-banner> becomes the page's header, drawn
// from the experience (art, category, title, line). data-title / data-kicker /
// data-desc override the copy; data-size="slim" for full-height app pages.
// Anything inside the placeholder is kept, below the copy.
async function renderBanner(active) {
  const host = document.querySelector('[data-hub-banner]');
  if (!host) return;
  const key = host.dataset.hubBanner || active;
  const e = EXP[key] || {};
  const extras = [...host.childNodes];
  const title = host.dataset.title || e.title || activeLabel(active);
  const kicker = host.dataset.kicker ?? e.cat ?? '';
  const desc = host.dataset.desc ?? e.desc ?? '';
  host.classList.add('aa-banner');
  if (host.dataset.size === 'slim') host.classList.add('slim');
  host.style.setProperty('--accent', e.accent || '#9B7BF7');
  host.innerHTML = `
    <div class="aa-banner-art" aria-hidden="true"></div>
    <div class="aa-banner-body">
      ${kicker ? `<div class="aa-banner-kicker"><span class="bar"></span>${esc(kicker)}</div>` : ''}
      <h1 class="aa-banner-title">${esc(title)}</h1>
      ${desc ? `<p class="aa-banner-desc">${esc(desc)}</p>` : ''}
      <div class="aa-banner-extra"></div>
    </div>`;
  const slot = host.querySelector('.aa-banner-extra');
  extras.forEach(n => slot.appendChild(n));
  if (!slot.children.length) slot.remove();
  try {
    const { art } = await import('./arcane-hub-art.js');
    host.querySelector('.aa-banner-art').innerHTML = art(key);
    requestAnimationFrame(() => host.classList.add('in'));
  } catch (_) { /* the banner reads fine without its art */ }
}

function wireShell() {
  const sidebar = document.getElementById('arcane-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const toggle  = document.getElementById('sidebar-toggle');
  const open  = () => { sidebar.classList.add('open'); overlay.classList.add('open'); document.body.style.overflow = 'hidden'; toggle?.setAttribute('aria-expanded', 'true'); sidebar.querySelector('a')?.focus(); };
  const close = () => {
    if (!sidebar.classList.contains('open')) return;
    sidebar.classList.remove('open'); overlay.classList.remove('open'); document.body.style.overflow = '';
    toggle?.setAttribute('aria-expanded', 'false');
  };
  toggle?.addEventListener('click', () => sidebar.classList.contains('open') ? close() : open());
  sidebar?.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
  overlay?.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

// Remembers the sections a member opens (newest first, per member, this
// browser only) so the dashboard can offer "Continue where you left off".
function recordVisit(uid, active) {
  const known = NAV.some(g => g.items.some(it => it.key === active));
  if (!known || active === 'dashboard') return;
  const key = 'aa_recent_' + uid;
  try {
    let list = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(list)) list = [];
    list = [{ key: active, t: Date.now() }, ...list.filter(v => v && v.key !== active)].slice(0, 12);
    localStorage.setItem(key, JSON.stringify(list));
  } catch (_) {}
}

function populateNav(active) {
  onAuthStateChanged(auth, async user => {
    if (!user) return;
    recordVisit(user.uid, active);
    try {
      const snap = await getDoc(doc(db, 'Users', user.uid));
      const data = snap.exists() ? snap.data() : {};
      const balance = Number(data.balance) || 0;
      const balEl = document.getElementById('nav-balance');
      if (balEl) balEl.textContent = `£${balance.toFixed(2)}`;
      if (user.photoURL) {
        ['nav-avatar', 'sidebar-user-avatar'].forEach(id => { const a = document.getElementById(id); if (a) a.src = user.photoURL; });
      }
      const name = data.displayName || user.displayName || (user.email || '').split('@')[0];
      const nameEl = document.getElementById('sidebar-user-name');
      if (nameEl && name) nameEl.textContent = name;
      const isPaid = data.isPaid === true || data.subscriptionStatus === 'active';
      const planEl = document.getElementById('sidebar-user-plan');
      if (planEl) planEl.textContent = ADMIN_UIDS.includes(user.uid) ? 'Admin' : (isPaid ? 'Member' : 'Free access');
      document.getElementById('nav-online')?.classList.remove('offline');
      if (ADMIN_UIDS.includes(user.uid)) { isAdmin = true; const l = document.getElementById('sidebar-admin-link'); if (l) l.style.display = ''; }
    } catch (e) { console.warn('portal-shell nav populate failed:', e.message); }
  });
}

function bindLogout() {
  // Any element with [data-logout] (or #logout-btn) triggers sign-out.
  document.querySelectorAll('[data-logout], #logout-btn').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.preventDefault();
      try { await signOut(auth); } catch (_) {}
      location.href = 'login.html';
    });
  });
}

function loadTicker() {
  if (document.querySelector('script[data-arcane-prices], script[src*="arcane-prices"]')) return;
  const s = document.createElement('script');
  s.src = 'arcane-prices.js';
  s.defer = true;
  s.setAttribute('data-arcane-prices', '');
  document.body.appendChild(s);
}

function ensureChromeCss() {
  // The chrome always comes from portal-shell.css (scoped to #arcane-shell), loaded
  // last so it wins over any page's legacy sidebar/nav rules.
  const links = [...document.querySelectorAll('link[rel="stylesheet"]')].map(l => l.getAttribute('href') || '');
  if (!links.some(h => h.includes('Barlow+Condensed'))) {
    const f = document.createElement('link');
    f.rel = 'stylesheet';
    f.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Inter+Tight:wght@600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap';
    document.head.appendChild(f);
  }
  if (!links.some(h => h.includes('portal-shell.css'))) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'portal-shell.css';
    document.head.appendChild(l);
  }
}

function init() {
  ensureChromeCss();
  const page = document.body.dataset.page || (location.pathname.split('/').pop() || '').replace('.html', '');
  const active = ALIAS[page] || page;
  buildShell(active);
  trackBarHeight();
  renderStrip();
  renderBanner(active);
  wireShell();
  bindJump();
  bindLogout();
  populateNav(active);
  loadTicker();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
