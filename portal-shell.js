// portal-shell.js
// Shared member-portal chrome: injects the sidebar + top navbar, highlights the
// active page, wires the mobile toggle + logout, populates nav user data, and
// loads the live ticker. Reuses the Firebase app from auth-guard.js (no re-init).
//
// Usage on a page:
//   <body data-page="stock-picks">
//   <link rel="stylesheet" href="arcane-portal.css">
//   ...page content (will be offset by the .has-portal-shell body padding)...
//   <script type="module" src="portal-shell.js"></script>

import { auth, db, ADMIN_UIDS } from './auth-guard.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

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
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
};

// page key -> {label, href, icon}
const NAV = {
  modules: [
    { key: 'dashboard',     label: 'Dashboard',     href: 'dashboard.html',                       icon: 'dashboard' },
    { key: 'watchtower',    label: 'Watchtower',    href: 'world-map.html',                       icon: 'watchtower' },
    { key: 'trading-floor', label: 'Trading Floor', href: 'trading-floor.html',                   icon: 'floor' },
    { key: 'war-room',      label: 'War Room',      href: 'war-room.html',                        icon: 'war' },
    { key: 'stock-picks',   label: 'Stock Picks',   href: 'stock-picks.html',                     icon: 'stocks' },
    { key: 'courses',       label: 'Courses',       href: 'courses.html',                         icon: 'book' },
    { key: 'live-calls',    label: 'Communication', href: 'live-calls.html',                      icon: 'chat' },
  ],
  intel: [
    { key: 'free-signals',  label: 'Signals',       href: 'free-signals.html',                    icon: 'signal' },
    { key: 'live-streams',  label: 'Live Streams',  href: 'live-streams.html',                    icon: 'video' },
    { key: 'bullion',       label: 'Bullion',       href: 'bullion.html',                         icon: 'bullion' },
    { key: 'referrals',     label: 'Referrals',     href: 'referrals.html',                        icon: 'users' },
  ],
  footer: [
    { key: 'arcane-store',  label: 'Store',         href: 'arcane-store.html',                    icon: 'store' },
    { key: 'settings',      label: 'Settings',      href: 'settings.html',                        icon: 'settings' },
  ],
};

function svg(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`;
}

function navItem(it, active) {
  const cls = 'sidebar-nav-item' + (it.key === active ? ' active' : '');
  const ext = it.ext ? ' target="_blank" rel="noopener"' : '';
  return `<a class="${cls}" href="${it.href}"${ext}>
    <span class="sidebar-nav-icon">${svg(it.icon)}</span>
    <span class="sidebar-nav-label">${it.label}</span>
  </a>`;
}

function buildShell(active) {
  const sidebar = `
  <aside class="arcane-sidebar" id="arcane-sidebar">
    <a class="sidebar-brand" href="dashboard.html">
      <img src="arcane-logo.png" alt="AA"/>
      <span class="brand-text">The Arcane<br>Archives</span>
    </a>
    <div class="sidebar-section-label">Modules</div>
    ${NAV.modules.map(it => navItem(it, active)).join('')}
    <div class="sidebar-divider"></div>
    <div class="sidebar-section-label">Open Intel</div>
    ${NAV.intel.map(it => navItem(it, active)).join('')}
    <div class="sidebar-divider"></div>
    ${NAV.footer.map(it => navItem(it, active)).join('')}
    <a class="sidebar-nav-item admin-item" href="admin-panel.html" id="sidebar-admin-link" style="display:none">
      <span class="sidebar-nav-icon">${svg('shield')}</span>
      <span class="sidebar-nav-label">Admin</span>
    </a>
  </aside>
  <div class="sidebar-overlay" id="sidebar-overlay"></div>
  <nav class="arcane-nav">
    <div class="nav-inner">
      <button class="sidebar-toggle" id="sidebar-toggle" aria-label="Menu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <a class="nav-left" href="dashboard.html">
        <img src="arcane-logo.png" class="nav-logo" alt="AA"/>
        <span class="nav-brand">The Arcane Archives</span>
      </a>
      <div class="nav-center">
        <a href="arcane-store.html" class="nav-store-btn">Store</a>
        <div class="nav-ticker-wrap"><div class="nav-ticker-track" id="nav-ticker-track"></div></div>
      </div>
      <div class="nav-right">
        <div class="nav-balance" id="nav-balance">£0.00</div>
        <div class="nav-online offline" id="nav-online"></div>
        <a class="nav-btn" href="settings.html" title="Settings">⚙️</a>
        <img class="nav-avatar" id="nav-avatar" src="arcane-logo.png" alt="Avatar"/>
      </div>
    </div>
  </nav>`;

  const host = document.createElement('div');
  host.id = 'arcane-shell';
  host.innerHTML = sidebar;
  document.body.insertBefore(host, document.body.firstChild);
  document.body.classList.add('has-portal-shell');
}

function wireShell() {
  const sidebar = document.getElementById('arcane-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const toggle  = document.getElementById('sidebar-toggle');
  const open  = () => { sidebar.classList.add('open'); overlay.classList.add('open'); document.body.style.overflow = 'hidden'; };
  const close = () => { sidebar.classList.remove('open'); overlay.classList.remove('open'); document.body.style.overflow = ''; };
  toggle?.addEventListener('click', () => sidebar.classList.contains('open') ? close() : open());
  overlay?.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

function populateNav() {
  onAuthStateChanged(auth, async user => {
    if (!user) return;
    try {
      const snap = await getDoc(doc(db, 'Users', user.uid));
      const data = snap.exists() ? snap.data() : {};
      const balance = Number(data.balance) || 0;
      const balEl = document.getElementById('nav-balance');
      if (balEl) balEl.textContent = `£${balance.toFixed(2)}`;
      if (user.photoURL) { const a = document.getElementById('nav-avatar'); if (a) a.src = user.photoURL; }
      document.getElementById('nav-online')?.classList.remove('offline');
      if (ADMIN_UIDS.includes(user.uid)) { const l = document.getElementById('sidebar-admin-link'); if (l) l.style.display = ''; }
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
  const links = [...document.querySelectorAll('link[rel="stylesheet"]')].map(l => l.getAttribute('href') || '');
  const hasChrome = links.some(h => h.includes('arcane-portal.css') || h.includes('portal-shell.css'));
  if (!hasChrome) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'portal-shell.css';
    document.head.appendChild(l);
  }
}

function init() {
  ensureChromeCss();
  const active = document.body.dataset.page || (location.pathname.split('/').pop() || '').replace('.html', '');
  buildShell(active);
  wireShell();
  bindLogout();
  populateNav();
  loadTicker();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
