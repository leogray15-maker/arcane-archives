// arcane-hub.js
// The dashboard as a launcher: featured carousel, "continue where you left
// off", what's hot, the library, the membership card and the admin command
// center. All routes are the app's real pages; all data comes from the
// member's Users doc, Settings/streamStatus, arcaneInsights, StockPicks and
// the visit history portal-shell.js records. Nothing is invented: when a
// signal is missing, its tile simply isn't shown.

import { auth, db, ADMIN_UIDS } from './auth-guard.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import { doc, getDoc, getDocs, collection, query, where, limit } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { art } from './arcane-hub-art.js';
import { EXP, FEATURED, SECONDARY, MEMBER, ADMIN } from './arcane-experiences.js';

const ESCAPING_HELL = 'read.html?course=2657f6a404fe80a39377f818f69088e8';
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = { locked: false, isAdmin: false, user: null, data: {}, live: false, insight: null, pick: null };

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:12px;height:12px"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

const isLocked = key => state.locked && EXP[key]?.members;
const chip = c => c ? `<span class="chip${c.live ? ' live' : ''}"${c.color ? ` style="--chip:${c.color}"` : ''}>${c.live || c.dot ? '<span class="pip"></span>' : ''}${esc(c.text)}</span>` : '';

function ago(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/* ── Tile ── */
function tile(key, o = {}) {
  const e = EXP[key], locked = isLocked(key);
  const href = o.href || e.href;
  return `<a class="tile${locked ? ' locked' : ''}" href="${esc(href)}" data-exp="${key}" style="--accent:${e.accent}" aria-label="${esc((o.title || e.title) + (locked ? ', members only' : ''))}">
    <div class="art-wrap">${art(key)}</div>
    <div class="tile-top">${locked ? `<span class="chip lock">${LOCK}Members</span>` : chip(o.chip)}</div>
    ${o.kicker !== '' ? `<div class="tile-kicker">${esc(o.kicker ?? e.cat)}</div>` : ''}
    <div class="tile-title">${esc(o.title || e.title)}</div>
    ${o.sub !== '' ? `<div class="tile-sub">${esc(o.sub ?? e.desc)}</div>` : ''}
    ${o.meta ? `<div class="tile-meta">${esc(o.meta)}</div>` : ''}
    <span class="tile-go">${locked ? 'See what’s inside' : esc(o.go || 'Enter')} ${ARROW}</span>
  </a>`;
}

/* ═══ FEATURED CAROUSEL ═══ */
const carousel = {
  root: null, stage: null, items: [], active: 0, step: 0, interacted: false,

  init() {
    this.root = $('#featured');
    this.stage = $('#stage');
    this.sel = $('#selector');
    $('#stage-prev').addEventListener('click', () => this.go(this.active - 1, true));
    $('#stage-next').addEventListener('click', () => this.go(this.active + 1, true));
    this.root.addEventListener('keydown', e => {
      if (e.target.closest('input, textarea')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); this.go(this.active + 1, true); this.focusTab(); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); this.go(this.active - 1, true); this.focusTab(); }
    });
    this.bindDrag();
    this.bindParallax();
    window.addEventListener('resize', () => this.layout());
    // Gentle auto-advance: driven by the selector's progress bar, so it pauses
    // whenever that animation pauses (hover, focus); stops after any interaction.
    if (!REDUCED) this.root.classList.add('autoplay');
    this.sel.addEventListener('animationend', e => { if (e.target.matches('.bar i') && !this.interacted) this.go(this.active + 1); });
    const pause = on => this.root.classList.toggle('paused', on);
    this.root.addEventListener('pointerenter', e => e.pointerType === 'mouse' && pause(true));
    this.root.addEventListener('pointerleave', () => pause(false));
    this.root.addEventListener('focusin', () => pause(true));
    this.root.addEventListener('focusout', e => { if (!this.root.contains(e.relatedTarget)) pause(false); });
  },

  stop() { this.interacted = true; this.root.classList.remove('autoplay'); },

  render(keys, extras = {}) {
    const current = this.items[this.active];
    this.items = keys;
    this.extras = extras;
    const n = keys.length;
    this.stage.querySelectorAll('.slide').forEach(s => s.remove());
    const frag = keys.map((key, i) => {
      const e = EXP[key], x = extras[key] || {}, locked = isLocked(key);
      const c = locked ? `<span class="chip lock">${LOCK}Members only</span>` : chip(x.chip || e.chip);
      return `<article class="slide" id="slide-${key}" role="tabpanel" aria-roledescription="slide" aria-label="${i + 1} of ${n}: ${esc(e.title)}" data-i="${i}" style="--accent:${e.accent}">
        <div class="art-wrap">${art(key)}</div>
        <div class="slide-body">
          <div class="slide-top"><span class="slide-index"><b>${String(i + 1).padStart(2, '0')}</b> / ${String(n).padStart(2, '0')}</span>${c}</div>
          <div class="slide-cat">${esc(x.cat || e.cat)}</div>
          <h2 class="slide-title">${esc(e.title)}</h2>
          <p class="slide-desc">${esc(x.desc || e.desc)}</p>
          <div class="slide-actions">
            ${locked
              ? `<a class="cta locked" href="${e.href}" data-exp="${key}">See what’s inside ${ARROW}</a>`
              : `<a class="cta" href="${esc(x.href || e.href)}" data-exp="${key}">${esc(x.cta || e.cta)} ${ARROW}</a>`}
            ${x.second && !locked ? `<a class="cta ghost" href="${esc(x.second.href)}" data-exp="${key}">${esc(x.second.text)}</a>` : ''}
          </div>
        </div>
      </article>`;
    }).join('');
    this.stage.insertAdjacentHTML('afterbegin', frag);
    this.stage.querySelectorAll('.slide').forEach(s => s.addEventListener('click', () => {
      const i = +s.dataset.i;
      if (i !== this.active && !this.justDragged) this.go(i, true);
    }));
    this.sel.innerHTML = keys.map((key, i) => `<button class="sel" role="tab" id="tab-${key}" aria-controls="slide-${key}" aria-selected="false" tabindex="-1" style="--accent:${EXP[key].accent}" data-i="${i}">${esc(EXP[key].title)}<span class="bar"><i></i></span></button>`).join('');
    this.sel.querySelectorAll('.sel').forEach(b => b.addEventListener('click', () => this.go(+b.dataset.i, true)));
    // Keep the member's selection; until they touch the carousel, a live
    // stream (prepended once known) takes the spotlight.
    const keep = keys.indexOf(current);
    this.active = keep >= 0 && this.interacted ? keep : (keep >= 0 && keys[0] !== 'live-streams' ? keep : 0);
    this.go(this.active);
  },

  focusTab() { this.sel.querySelector('[aria-selected="true"]')?.focus(); },

  go(i, user) {
    const n = this.items.length;
    if (user) this.stop();
    this.active = ((i % n) + n) % n;
    this.stage.querySelectorAll('.slide').forEach((s, k) => {
      const on = k === this.active;
      s.classList.toggle('is-active', on);
      s.setAttribute('aria-hidden', on ? 'false' : 'true');
      s.querySelectorAll('a').forEach(a => on ? a.removeAttribute('tabindex') : a.setAttribute('tabindex', '-1'));
      if (!on) { s.style.removeProperty('--mx'); s.style.removeProperty('--my'); }
    });
    this.sel.querySelectorAll('.sel').forEach((b, k) => {
      b.setAttribute('aria-selected', k === this.active ? 'true' : 'false');
      b.tabIndex = k === this.active ? 0 : -1;
    });
    const active = this.sel.children[this.active];
    if (active && this.sel.scrollWidth > this.sel.clientWidth) this.sel.scrollTo({ left: active.offsetLeft - 24, behavior: REDUCED ? 'auto' : 'smooth' });
    this.layout();
  },

  layout(drag = 0) {
    const slides = [...this.stage.querySelectorAll('.slide')];
    if (!slides.length) return;
    const n = slides.length, w = slides[0].offsetWidth;
    const narrow = window.innerWidth < 700;
    this.step = w * (narrow ? 0.9 : 0.93) + (narrow ? 10 : 24);
    slides.forEach((s, k) => {
      let o = k - this.active;
      o = ((o % n) + n) % n; if (o > n / 2) o -= n;
      o -= drag;
      const a = Math.abs(o);
      const scale = 1 - Math.min(a, 1.5) * 0.12;
      const op = a <= 1 ? 1 - a * 0.35 : Math.max(0, 0.65 - (a - 1) * 1.3);
      s.style.transform = `translate3d(calc(-50% + ${(o * this.step).toFixed(1)}px), 0, 0) scale(${scale.toFixed(3)})`;
      s.style.opacity = op.toFixed(3);
      s.style.zIndex = String(10 - Math.round(a * 2));
      s.style.visibility = op <= 0.01 ? 'hidden' : 'visible';
    });
  },

  bindDrag() {
    let x0 = null, dx = 0, id = null, dragging = false;
    const st = this.stage;
    st.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      x0 = e.clientX; dx = 0; id = e.pointerId; dragging = false;
    });
    st.addEventListener('pointermove', e => {
      if (x0 === null || e.pointerId !== id) return;
      dx = e.clientX - x0;
      if (!dragging && Math.abs(dx) > 8) { dragging = true; st.classList.add('dragging'); st.setPointerCapture(id); this.stop(); }
      if (dragging) this.layout(-dx / this.step);
    });
    const end = e => {
      if (x0 === null || e.pointerId !== id) return;
      st.classList.remove('dragging');
      if (dragging) {
        this.justDragged = true; setTimeout(() => { this.justDragged = false; }, 50);
        const t = dx / this.step;
        if (t < -0.15) this.go(this.active + Math.max(1, Math.round(-t)), true);
        else if (t > 0.15) this.go(this.active - Math.max(1, Math.round(t)), true);
        else this.layout();
      }
      x0 = null; dragging = false;
    };
    st.addEventListener('pointerup', end);
    st.addEventListener('pointercancel', end);
    // A drag must never end in following a link
    st.addEventListener('click', e => { if (this.justDragged) { e.preventDefault(); e.stopPropagation(); } }, true);
  },

  bindParallax() {
    if (REDUCED) return;
    let raf = 0;
    this.stage.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const s = this.stage.querySelector('.slide.is-active');
      if (!s || this.stage.classList.contains('dragging')) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = s.getBoundingClientRect();
        const mx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
        const my = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
        s.style.setProperty('--mx', mx.toFixed(3));
        s.style.setProperty('--my', my.toFixed(3));
      });
    });
    this.stage.addEventListener('pointerleave', () => {
      const s = this.stage.querySelector('.slide.is-active');
      if (s) { s.style.setProperty('--mx', 0); s.style.setProperty('--my', 0); }
    });
  },
};

function renderFeatured() {
  const keys = state.live ? ['live-streams', ...FEATURED] : FEATURED;
  const extras = {};
  if (state.live) extras['live-streams'] = { cat: 'Live now', desc: 'Leo is live right now. Join the stream.', cta: 'Watch now', chip: { text: 'Live now', live: true, color: '#F87171' } };
  extras['courses'] = { second: { href: ESCAPING_HELL, text: 'Start Escaping Hell' } };
  if (state.pick) extras['stock-picks'] = { chip: { text: `${state.pick.isNew ? 'New pick' : 'Latest pick'} · ${state.pick.ticker}`, dot: true, color: '#34D399' } };
  carousel.render(keys, extras);
}

/* ═══ CONTINUE WHERE YOU LEFT OFF ═══ */
function renderContinue() {
  const host = $('#continue-rail'), label = $('#continue-label');
  let recent = [];
  if (state.user) {
    try { recent = JSON.parse(localStorage.getItem('aa_recent_' + state.user.uid) || '[]'); } catch (_) {}
  }
  recent = (Array.isArray(recent) ? recent : []).filter(v => v && EXP[v.key]).slice(0, 6);
  const d = state.data || {};
  const prog = d.courseProgress || {}, done = d.coursesCompleted || {};
  const inProgress = Object.keys(prog).filter(id => !done[id] && Object.values(prog[id] || {}).some(Boolean)).length;
  const streak = Number(d.streak) || 0;
  const extra = key => {
    if (key === 'courses' && inProgress) return { chip: { text: `${inProgress} in progress`, dot: true, color: '#F2C94C' } };
    if (key === 'arcane-insights' && streak) return { chip: { text: `${streak}-day streak`, dot: true, color: '#F2C94C' } };
    return {};
  };
  if (recent.length) {
    label.textContent = 'Continue where you left off';
    host.innerHTML = recent.map(v => tile(v.key, { ...extra(v.key), meta: `Last visited · ${ago(v.t)}`, go: 'Continue' })).join('');
  } else {
    label.textContent = 'Where to begin';
    host.innerHTML = [
      tile('courses', { href: ESCAPING_HELL, kicker: 'Start here', title: 'Escaping Hell', sub: 'Your first mission. It breaks the old habits and hands you the roadmap.', go: 'Start', ...extra('courses') }),
      tile('arcane-insights', { kicker: 'Every morning', sub: 'Claim today’s Daily Insight. Keep the streak alive.', go: 'Claim', ...extra('arcane-insights') }),
      tile('war-room', { kicker: 'Every week', sub: 'Get on the call. Bring what you’re stuck on. Recorded if you miss it.' }),
      tile('settings', { kicker: 'Your card', title: 'Add your details', sub: 'Your name on your card, and your referral code.', go: 'Open' }),
    ].join('');
  }
  updateRailButtons('continue');
}

/* ═══ WHAT'S HOT ═══ */
function renderHot() {
  const items = [];
  if (state.live) items.push(tile('live-streams', { kicker: 'Live now', title: 'Leo is live', sub: 'The stream is on. Jump in.', chip: { text: 'Live', live: true, color: '#F87171' }, go: 'Watch' }));
  if (state.insight) items.push(tile('arcane-insights', { kicker: 'Today’s insight', title: state.insight.title || 'Daily Insight', sub: 'Today’s transmission is in. Claim it to keep your streak.', chip: { text: 'Today', dot: true, color: '#F2C94C' }, go: 'Read' }));
  if (state.pick) items.push(tile('stock-picks', { kicker: state.pick.isNew ? 'New stock pick' : 'Latest stock pick', title: state.pick.ticker, sub: state.pick.name || EXP['stock-picks'].desc, meta: state.pick.when ? `Added ${state.pick.when}` : '', chip: { text: state.pick.isNew ? 'New' : 'Latest', dot: true, color: '#34D399' }, go: 'View' }));
  items.push(tile('watchtower', { chip: { text: 'Live', live: true, color: '#22D3EE' } }));
  items.push(tile('war-room', { chip: { text: 'Weekly call', dot: true, color: '#F0553F' } }));
  if (!state.live) items.push(tile('live-streams', { kicker: 'Fridays · 7pm UK', sub: 'Open to everyone. Bring a friend.', chip: { text: 'Weekly', dot: true, color: '#F87171' } }));
  items.push(tile('trading-floor', { chip: { text: 'Live markets', live: true, color: '#4ADE80' } }));
  $('#hot-rail').innerHTML = items.join('');
  updateRailButtons('hot');
}

/* ═══ LIBRARY + SECONDARY + MEMBER ═══ */
function renderLibrary() {
  $('#library').innerHTML = FEATURED.map(k => tile(k, { chip: EXP[k].chip, go: EXP[k].cta })).join('');
  $('#secondary').innerHTML = SECONDARY.map(k => tile(k)).join('');
  $('#member-tiles').innerHTML = MEMBER.map(k => tile(k, { go: 'Open' })).join('');
}

function renderMember() {
  const d = state.data || {}, u = state.user;
  if (!u) return;
  const name = d.displayName || u.displayName || (u.email || '').split('@')[0] || 'Member';
  $('#id-name').textContent = name;
  if (u.photoURL) $('#id-photo').src = u.photoURL;
  const since = d.createdAt?.toDate?.() || (u.metadata?.creationTime ? new Date(u.metadata.creationTime) : null);
  if (since && !isNaN(since)) $('#id-since').textContent = since.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }).toUpperCase();
  const isPaid = d.isPaid === true || d.subscriptionStatus === 'active';
  const status = $('#id-status');
  status.textContent = state.isAdmin ? 'Admin' : (isPaid ? 'Active' : 'Free access');
  status.classList.toggle('ok', state.isAdmin || isPaid);
  $('#id-plan').textContent = state.isAdmin ? 'ADMIN' : (isPaid ? 'MEMBER' : 'FREE ACCESS');
  $('#id-balance').textContent = `£${(Number(d.balance) || 0).toFixed(2)}`;
  const streak = Number(d.streak) || 0;
  $('#id-streak').textContent = streak === 1 ? '1 day' : `${streak} days`;
}

function renderAdmin() {
  if (!state.isAdmin) return;
  $('#command-links').innerHTML = ADMIN.map(([h, t, s]) => `<a href="${h}"><b>${esc(t)}</b><span>${esc(s)}</span></a>`).join('');
  $('#command').hidden = false;
}

/* ── Rails: arrow buttons ── */
function updateRailButtons(name) {
  const rail = $(`#${name}-rail`), prev = $(`[data-rail="${name}"][data-dir="-1"]`), next = $(`[data-rail="${name}"][data-dir="1"]`);
  if (!rail || !prev) return;
  const max = rail.scrollWidth - rail.clientWidth - 2;
  prev.disabled = rail.scrollLeft <= 2;
  next.disabled = rail.scrollLeft >= max;
  prev.parentElement.hidden = max <= 0;
}
function bindRails() {
  document.querySelectorAll('[data-rail]').forEach(b => b.addEventListener('click', () => {
    const rail = $(`#${b.dataset.rail}-rail`);
    rail.scrollBy({ left: +b.dataset.dir * rail.clientWidth * 0.8, behavior: REDUCED ? 'auto' : 'smooth' });
  }));
  ['continue', 'hot'].forEach(n => {
    $(`#${n}-rail`).addEventListener('scroll', () => updateRailButtons(n), { passive: true });
  });
  window.addEventListener('resize', () => ['continue', 'hot'].forEach(updateRailButtons));
}

/* ── Locked experiences open the membership modal; entering fades out ── */
function bindNavigation() {
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-exp]');
    if (!a || e.defaultPrevented) return;
    const key = a.dataset.exp;
    if (isLocked(key)) { e.preventDefault(); window.openUpgradeModal?.(); return; }
    if (REDUCED || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0 || a.target === '_blank') return;
    e.preventDefault();
    const veil = $('#hub-veil');
    $('#hub-veil-text').textContent = `Entering ${EXP[key]?.title || ''}`;
    veil.classList.add('on');
    setTimeout(() => { location.href = a.href; }, 260);
  });
  window.addEventListener('pageshow', () => $('#hub-veil').classList.remove('on'));
}

/* ── Jump to (search across every real destination) ── */
function bindJump() {
  const box = $('#jump'), input = $('#jump-input'), list = $('#jump-list'), btn = $('#jump-btn');
  const GROUP = { courses: 'Archives', 'arcane-insights': 'Archives', 'war-room': 'Archives', 'live-calls': 'Archives', 'live-streams': 'Archives',
    'trading-floor': 'Markets', watchtower: 'Markets', 'stock-picks': 'Markets', 'free-signals': 'Markets', bullion: 'Markets' };
  const all = () => [
    ...Object.entries(EXP).map(([k, e]) => ({ title: e.title, href: e.href, group: GROUP[k] || 'Members', words: `${e.title} ${e.cat} ${e.desc}` })),
    ...(state.isAdmin ? ADMIN.map(([h, t, s]) => ({ title: t, href: h, group: 'Admin', words: `${t} ${s} admin` })) : []),
  ];
  let sel = 0, rows = [];
  const paint = () => {
    const q = input.value.trim().toLowerCase();
    rows = all().filter(r => !q || r.words.toLowerCase().includes(q));
    if (q) rows.sort((a, b) => b.title.toLowerCase().includes(q) - a.title.toLowerCase().includes(q));
    sel = Math.min(sel, Math.max(0, rows.length - 1));
    list.innerHTML = rows.length
      ? rows.map((r, i) => `<li><a href="${esc(r.href)}" role="option" id="jump-${i}" aria-selected="${i === sel}">${esc(r.title)}<span class="g">${r.group}</span></a></li>`).join('')
      : '<li class="jump-empty">Nothing matches that.</li>';
    input.setAttribute('aria-activedescendant', rows.length ? `jump-${sel}` : '');
  };
  let lastFocus = null;
  const open = () => { lastFocus = document.activeElement; box.classList.add('open'); input.value = ''; sel = 0; paint(); input.focus(); btn.setAttribute('aria-expanded', 'true'); };
  const close = () => { box.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); lastFocus?.focus?.(); };
  btn.addEventListener('click', open);
  box.addEventListener('click', e => { if (e.target === box) close(); });
  input.addEventListener('input', () => { sel = 0; paint(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, rows.length - 1); paint(); $(`#jump-${sel}`)?.scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); paint(); $(`#jump-${sel}`)?.scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'Enter' && rows[sel]) { e.preventDefault(); location.href = rows[sel].href; }
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
  });
  document.addEventListener('keydown', e => {
    const typing = e.target.closest?.('input, textarea, [contenteditable="true"]');
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); box.classList.contains('open') ? close() : open(); }
  });
}

/* ── Strip: date + London session (same rule the dashboard always used) ── */
function renderStrip() {
  const d = new Date();
  $('#strip-date').textContent = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).replace(/,/g, '').toUpperCase();
  const h = d.getHours(), day = d.getDay(), m = d.getMinutes();
  const open = day >= 1 && day <= 5 && h >= 8 && (h < 16 || (h === 16 && m <= 30));
  $('#strip-london').textContent = open ? 'London open' : 'London closed';
  $('#strip-dot').classList.toggle('open', open);
}

/* ── Footer quote ── */
function rotateQuotes() {
  const QUOTES = [
    ['The market is a device for transferring money from the impatient to the patient.', 'Buffett'],
    ['In the short run, the market is a voting machine. In the long run, it is a weighing machine.', 'Graham'],
    ['The trend is your friend until the end when it bends.', 'Ed Seykota'],
    ['Risk comes from not knowing what you’re doing.', 'Warren Buffett'],
    ['The four most dangerous words in investing: This time it’s different.', 'Templeton'],
    ['Markets are never wrong — opinions often are.', 'Jesse Livermore'],
    ['Price is what you pay. Value is what you get.', 'Warren Buffett'],
    ['Know what you own, and know why you own it.', 'Peter Lynch'],
    ['An investment in knowledge pays the best interest.', 'Benjamin Franklin'],
  ];
  const el = $('#hub-quote-text');
  let i = Math.floor(Math.random() * QUOTES.length);
  const set = () => { const [q, a] = QUOTES[i]; el.textContent = `“${q}” — ${a}`; i = (i + 1) % QUOTES.length; };
  set();
  if (!REDUCED) setInterval(() => { el.style.opacity = 0; setTimeout(() => { set(); el.style.opacity = 1; }, 400); }, 12000);
}

/* ── Nav: compact border once scrolled; staggered entrance ── */
function bindChrome() {
  const nav = $('#hub-nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const io = 'IntersectionObserver' in window && !REDUCED ? new IntersectionObserver(es => es.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }), { rootMargin: '0px 0px -8% 0px' }) : null;
  document.querySelectorAll('.reveal').forEach(el => io ? io.observe(el) : el.classList.add('in'));
}

/* ═══ First days: start-here checklist (unchanged behaviour) ═══
   Shown after payment (?welcome=1) and for a member's first 14 days,
   until they finish it or hide it. Progress lives in localStorage per
   member, plus what the profile already tells us. */
function showOnboarding(user, data, isPaid, isAdmin) {
  const box = document.getElementById('onboard');
  if (!box || !(isPaid || isAdmin)) return;
  const key = 'aa_onboard_' + user.uid;
  let st = {};
  try { st = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) {}
  const welcome = new URLSearchParams(location.search).get('welcome') === '1';
  const paidAt = data.paidAt?.toDate?.() || data.createdAt?.toDate?.() || null;
  const recent = paidAt && (Date.now() - paidAt.getTime()) < 14 * 24 * 60 * 60 * 1000;
  if (st.hidden && !welcome) return;
  if (!welcome && !recent) return;

  const save = () => { try { localStorage.setItem(key, JSON.stringify(st)); } catch (e) {} };
  if ((data.coursesCompleted || {})['2657f6a404fe80a39377f818f69088e8']) st.hell = true;
  if (Number(data.streak) > 0 || Number(data.totalCheckIns) > 0) st.insight = true;
  if (data.firstName || data.Username || data.username) st.profile = true;

  const steps = [...box.querySelectorAll('.ob-step')];
  function paint() {
    let done = 0, nextSet = false;
    steps.forEach(li => {
      const k = li.dataset.step, isDone = !!st[k];
      li.classList.toggle('done', isDone);
      li.classList.remove('next');
      if (isDone) done++;
      else if (!nextSet) { li.classList.add('next'); nextSet = true; }
      li.querySelector('.ob-state').textContent = isDone ? 'Done' : 'Start';
    });
    document.getElementById('ob-done').textContent = done;
    document.getElementById('ob-fill').style.width = (done / steps.length * 100) + '%';
    if (done === steps.length && !welcome) box.hidden = true;
  }
  steps.forEach(li => li.querySelector('a').addEventListener('click', () => { st[li.dataset.step] = true; save(); paint(); }));
  document.getElementById('ob-hide').addEventListener('click', () => { st.hidden = true; save(); box.hidden = true; });
  box.hidden = false;
  paint();
}

/* ═══ DATA ═══ */
async function loadSignals(canRead) {
  const jobs = [
    getDoc(doc(db, 'Settings', 'streamStatus')).then(s => {
      const d = s.data() || {};
      state.live = !!(d.isLive && d.youtubeId);
    }),
  ];
  if (canRead) {
    const today = new Date().toISOString().split('T')[0]; // same key arcane-insights.html uses
    jobs.push(getDocs(query(collection(db, 'arcaneInsights'), where('date', '==', today), limit(1))).then(s => {
      if (!s.empty) state.insight = { title: s.docs[0].data().title || '' };
    }));
    jobs.push(getDocs(collection(db, 'StockPicks')).then(s => {
      let best = null;
      s.forEach(d => {
        const p = d.data(), t = p.createdAt?.toMillis?.() || 0;
        if (p.ticker && (!best || t > best.t)) best = { t, ticker: String(p.ticker).toUpperCase(), name: p.companyName || '' };
      });
      if (best) {
        best.isNew = best.t && Date.now() - best.t < 7 * 864e5;
        best.when = best.t ? new Date(best.t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
        state.pick = best;
      }
    }));
  }
  await Promise.allSettled(jobs);
}

function boot() {
  renderStrip();
  carousel.init();
  renderFeatured();
  renderContinue();
  renderHot();
  renderLibrary();
  bindRails();
  bindNavigation();
  bindJump();
  bindChrome();
  rotateQuotes();

  onAuthStateChanged(auth, async user => {
    if (!user) { location.href = 'login.html'; return; }
    window._upgradeModalUserEmail = user.email || '';
    window._upgradeModalUserUid = user.uid || '';
    state.user = user;
    try {
      const snap = await getDoc(doc(db, 'Users', user.uid));
      const data = snap.exists() ? snap.data() : {};
      state.data = data;
      state.isAdmin = ADMIN_UIDS.includes(user.uid);
      const isPaid = data.isPaid === true || data.subscriptionStatus === 'active';
      state.locked = !state.isAdmin && !isPaid;
      $('#invite').classList.toggle('visible', state.locked);
      renderMember();
      renderAdmin();
      showOnboarding(user, data, isPaid, state.isAdmin);
      await loadSignals(!state.locked);
    } catch (e) {
      console.error('Dashboard load error:', e);
      state.locked = !state.isAdmin;
      $('#invite').classList.toggle('visible', state.locked);
    }
    renderFeatured();
    renderContinue();
    renderHot();
    renderLibrary();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
