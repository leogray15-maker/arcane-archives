// Footer: live feed health computed from the same meta the panels use.
import { FEEDS } from '../../../shared/watchtower/feeds';
import { state, subscribe } from '../app/state';
import { h, replaceChildren } from '../lib/dom';
import { emit } from './header';

export function feedHealth(now = Date.now()) {
  const live = FEEDS.filter((f) => !f.static && !f.internal && f.id in state.meta);
  const stale: string[] = [];
  const empty: string[] = [];
  for (const f of live) {
    const m = state.meta[f.id];
    if (!m || m.fetchedAt === null) empty.push(f.label);
    else if (now - m.fetchedAt > f.maxStaleMin * 60000) stale.push(f.label);
  }
  return { total: live.length, ok: live.length - stale.length - empty.length, stale, empty };
}

export function buildFooter(): HTMLElement {
  const okEl = h('span', { class: 'wt-footer-item' });
  const badEl = h('span', { class: 'wt-footer-item' });
  const footer = h(
    'footer',
    { class: 'wt-footer' },
    okEl,
    badEl,
    h('span', { style: 'flex:1' }),
    h('button', { class: 'wt-link-btn', onclick: () => emit('wt:sources') }, 'SOURCES & METHODOLOGY'),
    h('span', null, 'THE ARCANE ARCHIVES'),
  );
  const render = () => {
    const hl = feedHealth();
    if (!hl.total) {
      replaceChildren(okEl, h('span', { class: 'dot', style: 'background:#8a8699' }), 'FEEDS —');
      replaceChildren(badEl);
      return;
    }
    replaceChildren(okEl, h('span', { class: 'dot', style: `background:${hl.ok === hl.total ? '#5ee3a1' : '#f59e42'}` }), `FEEDS ${hl.ok}/${hl.total} OK`);
    const bad = [...hl.stale, ...hl.empty.map((s) => `${s} (no data)`)];
    if (bad.length) {
      const parts = [hl.stale.length ? `${hl.stale.length} STALE` : '', hl.empty.length ? `${hl.empty.length} NO DATA` : ''].filter(Boolean).join(' · ');
      const names = [...hl.stale, ...hl.empty].slice(0, 3).join(', ').toUpperCase();
      replaceChildren(badEl, h('span', { class: 'dot', style: 'background:#f59e42' }), `${parts} · ${names}${bad.length > 3 ? '…' : ''}`);
      badEl.title = bad.join('\n');
    } else replaceChildren(badEl);
  };
  subscribe(['meta'], render);
  setInterval(render, 30000);
  render();
  return footer;
}
