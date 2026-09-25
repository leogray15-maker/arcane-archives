import type { HeaderMetrics } from '../../../shared/watchtower/types';
import { feed, state, subscribe } from '../app/state';
import { h, ICONS, svg } from '../lib/dom';
import { utcClock } from '../lib/time';

export const emit = (name: string, detail?: unknown) => document.dispatchEvent(new CustomEvent(name, { detail }));

const THREAT_TIP =
  'Threat level (1–5) is our own roll-up: the average of the five highest Country Instability scores, plus weight for active critical signals. It is not DEFCON or any official alert status.';
const SENTIMENT_TIP =
  'Sentiment (0–100, 50 = neutral) is the average tone of the last 24h of news coverage — GDELT tone when available, otherwise our headline lexicon. The arrow compares with the previous 24h.';

const THREAT_COLORS = ['#5ee3a1', '#8b7cf6', '#f59e42', '#f0526b', '#f0526b'];

export function buildHeader(): HTMLElement {
  const clock = h('span', { class: 'wt-metric-value' }, utcClock());
  setInterval(() => (clock.textContent = utcClock()), 1000);

  const live = h('div', { class: 'wt-live', 'data-state': 'connecting', role: 'status', 'aria-live': 'polite' }, h('span', { class: 'dot' }), h('span', { class: 'txt' }, 'CONNECTING'));

  const bars = h('span', { class: 'wt-threat-bars' }, ...Array.from({ length: 5 }, () => h('span')));
  const threatVal = h('span', { style: 'font-size:13px;font-weight:700' }, '— / 5');
  const sentVal = h('span', { style: 'font-size:13px;font-weight:700' }, '—');
  const sentDelta = h('span', { style: 'font-size:11px' });

  const layersBtn = h('button', { class: 'wt-icon-btn', 'aria-label': 'Open layers', onclick: () => emit('wt:layers-mobile') });
  layersBtn.appendChild(svg(ICONS.layers));

  const searchBtn = h(
    'button',
    { class: 'wt-search-btn', 'aria-label': 'Search countries, layers, signals (⌘K)', onclick: () => emit('wt:search') },
    svg(ICONS.search),
    h('span', { class: 'label' }, 'Search countries, layers, signals'),
    h('span', { class: 'kbd' }, navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl K'),
  );

  const monitorBtn = h('button', { class: 'wt-monitor-btn', 'aria-label': 'Open Extended Global Monitor', onclick: () => emit('wt:drawer') }, svg(ICONS.panel), h('span', { class: 'label' }, 'MONITOR'));

  const tierChip = h('span', { class: 'wt-tier-chip' });
  const devChip = import.meta.env.DEV
    ? h('span', { class: 'wt-tier-chip', style: 'color:#f59e42;border-color:#5a3d1c', title: 'Local dev server: data comes from test fixtures, not live sources.' }, 'DEV')
    : null;

  const back = h('a', { class: 'wt-back', href: '/dashboard.html' }, '‹', h('span', { class: 'label' }, 'DASHBOARD'));

  const header = h(
    'header',
    { class: 'wt-header' },
    layersBtn,
    back,
    h('div', { class: 'wt-brand' }, svg(ICONS.logo), h('div', { class: 'wt-brand-text' }, h('span', { class: 'wt-brand-title' }, 'ARCANE WATCHTOWER'), h('span', { class: 'wt-brand-sub' }, '· GLOBAL SITUATION'))),
    live,
    searchBtn,
    h('div', { class: 'wt-spacer' }),
    h(
      'div',
      { class: 'wt-metrics' },
      h('div', { class: 'wt-metric clock' }, h('span', { class: 'wt-metric-label' }, 'UTC'), clock),
      h('div', { class: 'wt-vsep' }),
      h('button', { class: 'wt-metric', 'data-tip': THREAT_TIP, 'aria-label': 'Threat level' }, h('span', { class: 'wt-metric-label' }, 'THREAT LEVEL ⓘ'), h('span', { class: 'wt-metric-value' }, bars, threatVal)),
      h('button', { class: 'wt-metric', 'data-tip': SENTIMENT_TIP, 'aria-label': 'News sentiment' }, h('span', { class: 'wt-metric-label' }, 'SENTIMENT ⓘ'), h('span', { class: 'wt-metric-value', style: 'align-items:baseline;gap:6px' }, sentVal, sentDelta)),
      h('div', { class: 'wt-vsep' }),
      devChip,
      tierChip,
      monitorBtn,
    ),
  );

  const renderMetrics = () => {
    const m = feed<HeaderMetrics | null>('header');
    const lvl = m?.threatLevel ?? 0;
    [...bars.children].forEach((b, i) => ((b as HTMLElement).style.background = i < lvl ? THREAT_COLORS[lvl - 1] : ''));
    threatVal.textContent = lvl ? `${lvl} / 5` : '— / 5';
    threatVal.style.color = lvl ? (lvl >= 4 ? '#f0788a' : lvl === 3 ? '#f5b36b' : '#e9e6f2') : '#8a8699';
    if (m && m.sentiment !== null) {
      sentVal.textContent = String(Math.round(m.sentiment));
      const d = m.sentimentChange;
      sentDelta.textContent = d === null || Math.round(d) === 0 ? '—' : `${d > 0 ? '▲' : '▼'} ${Math.abs(Math.round(d))}`;
      sentDelta.style.color = d && d < 0 ? '#f0788a' : d && d > 0 ? '#5ee3a1' : '#8a8699';
    } else {
      sentVal.textContent = '—';
      sentDelta.textContent = '';
    }
  };
  const renderLive = () => {
    const labels = { connecting: 'CONNECTING', live: 'LIVE', degraded: 'DEGRADED', offline: 'OFFLINE' } as const;
    live.dataset.state = state.connection;
    live.querySelector('.txt')!.textContent = labels[state.connection];
    live.title =
      state.connection === 'degraded'
        ? 'Some fast feeds are stale — showing last good data.'
        : state.connection === 'offline'
          ? 'Cannot reach the Watchtower API. Retrying with backoff.'
          : '';
  };
  const renderTier = () => {
    tierChip.textContent = state.tier === 'admin' ? 'ADMIN' : state.tier === 'member' ? 'MEMBER' : 'PREVIEW';
    tierChip.className = `wt-tier-chip ${state.tier === 'admin' ? 'admin' : ''}`;
  };
  subscribe(['data.header'], renderMetrics);
  subscribe(['connection'], renderLive);
  subscribe(['tier'], renderTier);
  renderMetrics();
  renderLive();
  renderTier();
  return header;
}
