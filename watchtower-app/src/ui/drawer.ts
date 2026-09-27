// "Extended Global Monitor" drawer: News, Markets, Macro, Air Traffic.
import { canAccess } from '../../../shared/watchtower/feeds';
import type { Aircraft, MacroPoint, RankedHeadline } from '../../../shared/watchtower/types';
import { feed, state, subscribe } from '../app/state';
import { h, ICONS, replaceChildren, safeUrl, svg } from '../lib/dom';
import { ago, fmtNum } from '../lib/time';
import { freshnessOf } from './freshness';
import { emit } from './header';

type Tab = 'news' | 'markets' | 'macro' | 'air';
const TABS: { id: Tab; label: string; feeds: string[] }[] = [
  { id: 'news', label: 'NEWS', feeds: ['headlines'] },
  { id: 'markets', label: 'MARKETS', feeds: [] },
  { id: 'macro', label: 'MACRO', feeds: ['macro'] },
  { id: 'air', label: 'AIR TRAFFIC', feeds: ['aircraft'] },
];

export function buildDrawer() {
  let tab: Tab = 'news';
  let open = false;
  const scrim = h('div', { class: 'wt-scrim', hidden: true });
  const body = h('div', { class: 'wt-drawer-body' });
  const fresh = h('span', { class: 'wt-fresh empty' });
  const closeBtn = h('button', { class: 'wt-panel-collapse', 'aria-label': 'Close monitor' });
  closeBtn.appendChild(svg(ICONS.close));
  const tabs = h('div', { class: 'wt-tabs', role: 'tablist' });
  const drawer = h(
    'aside',
    { class: 'wt-drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Extended Global Monitor', 'aria-hidden': 'true', inert: true },
    h('div', { class: 'wt-drawer-head' }, h('span', null, 'EXTENDED GLOBAL MONITOR'), h('span', { style: 'flex:1' }), fresh, closeBtn),
    tabs,
    body,
  );

  const setOpen = (o: boolean) => {
    open = o;
    drawer.classList.toggle('open', o);
    drawer.toggleAttribute('inert', !o);
    drawer.setAttribute('aria-hidden', String(!o));
    scrim.hidden = !o;
    if (o) {
      render();
      (tabs.querySelector('[aria-selected="true"]') as HTMLElement | null)?.focus();
    }
  };
  closeBtn.addEventListener('click', () => setOpen(false));
  scrim.addEventListener('click', () => setOpen(false));
  document.addEventListener('wt:drawer', (e) => {
    const t = (e as CustomEvent).detail as Tab | undefined;
    if (t) tab = t;
    setOpen(t ? true : !open);
  });
  document.addEventListener('keydown', (e) => {
    if (open && e.key === 'Escape') setOpen(false);
  });

  const render = () => {
    replaceChildren(
      tabs,
      ...TABS.map((t) =>
        h('button', { role: 'tab', 'aria-selected': String(t.id === tab), onclick: () => ((tab = t.id), render()) }, t.label),
      ),
    );
    const def = TABS.find((t) => t.id === tab)!;
    const f = freshnessOf(def.feeds, state.meta);
    fresh.className = `wt-fresh ${f.cls}`;
    fresh.textContent = def.feeds.length ? f.text : '';
    fresh.style.display = def.feeds.length ? '' : 'none';
    if (!canAccess(state.tier, 'member')) {
      replaceChildren(body, h('div', { class: 'wt-panel-state' }, 'The Extended Global Monitor is part of the Watchtower membership.', h('div', { style: 'margin-top:14px' }, h('a', { class: 'wt-cta', href: state.checkoutUrl }, 'UNLOCK WATCHTOWER'))));
      return;
    }
    replaceChildren(body, tab === 'news' ? news() : tab === 'markets' ? markets() : tab === 'macro' ? macro() : air());
  };

  const news = () => {
    const items = feed<RankedHeadline[] | null>('headlines');
    if (!items?.length) return h('div', { class: 'wt-panel-state' }, items === undefined ? 'Loading…' : 'No ranked headlines yet.');
    return h(
      'div',
      null,
      ...items.slice(0, 60).map((n) =>
        h(
          'a',
          { class: 'wt-sig row', href: safeUrl(n.link), target: '_blank', rel: 'noopener noreferrer' },
          h('span', { class: 'wt-sig-meta' }, h('span', null, n.source.toUpperCase()), n.ownership === 'state' ? h('span', { class: 'sev low', title: 'State-affiliated outlet' }, 'STATE') : null, n.corroboration > 1 ? h('span', { class: 'dim' }, `+${n.corroboration - 1} SOURCES`) : null, h('span', { class: 'ago' }, ago(n.time))),
          h('span', { class: 'wt-sig-title' }, n.title),
        ),
      ),
      h('div', { class: 'wt-panel-state' }, 'Headlines link to the publisher. Ranked by source tier, corroboration, topic and recency.'),
    );
  };

  const markets = () =>
    h(
      'div',
      { class: 'wt-panel-state' },
      h('p', { style: 'margin:0 0 10px' }, 'Live index, commodity and crypto quotes are switched off.'),
      h('p', { style: 'margin:0 0 10px' }, 'The free quote sources we checked (Yahoo Finance, CoinGecko Demo and similar) are not licensed for display in a paid product. We will not show simulated prices. This tab turns on once a licensed provider is configured.'),
      h('p', { style: 'margin:0' }, 'The Macro tab carries public-domain US series from FRED.'),
    );

  const macro = () => {
    const pts = feed<MacroPoint[] | null>('macro');
    if (!pts?.length) return h('div', { class: 'wt-panel-state' }, pts === undefined ? 'Loading…' : 'No macro data yet — check that FRED_API_KEY is set.');
    return h(
      'div',
      null,
      h(
        'div',
        { class: 'wt-kv' },
        ...pts.flatMap((p) => {
          const d = p.value !== null && p.prev !== null ? p.value - p.prev : null;
          return [
            h('span', { class: 'k', title: `${p.source} · ${p.date ?? ''}` }, p.label),
            h('span', { class: 'v' }, p.value === null ? '—' : `${fmtNum(p.value, 2)}${p.unit}`),
            h('span', { class: `d ${d === null || d === 0 ? 'flat' : d > 0 ? 'up' : 'down'}` }, d === null ? '—' : `${d > 0 ? '+' : ''}${fmtNum(d, 2)}`),
          ];
        }),
      ),
      h('div', { class: 'wt-panel-state' }, 'Source: Federal Reserve Bank of St. Louis (FRED), public-domain US government series. Change is versus the previous observation.'),
    );
  };

  const air = () => {
    const ac = feed<Aircraft[] | null>('aircraft');
    if (!ac?.length) return h('div', { class: 'wt-panel-state' }, ac === undefined ? 'Loading…' : 'No military aircraft reported right now.');
    const rows = [...ac].sort((a, b) => (b.altFt ?? 0) - (a.altFt ?? 0)).slice(0, 150);
    return h(
      'div',
      null,
      h('div', { class: 'wt-panel-state', style: 'padding:12px 16px' }, `${ac.length} aircraft flagged military in the open ADS-B network. Aircraft that don't broadcast are not shown.`),
      h(
        'table',
        { class: 'wt-table' },
        h('thead', null, h('tr', null, h('th', null, 'CALLSIGN'), h('th', null, 'TYPE'), h('th', null, 'ALT FT'), h('th', null, 'KT'), h('th', null, 'SEEN'))),
        h(
          'tbody',
          null,
          ...rows.map((a) =>
            h(
              'tr',
              { class: 'row', style: 'cursor:pointer', tabindex: '0', onclick: () => emit('wt:fly', { lat: a.lat, lng: a.lon, alt: 0.6 }) },
              h('td', null, a.callsign || a.hex.toUpperCase()),
              h('td', null, a.type || '—'),
              h('td', null, a.altFt === null ? '—' : fmtNum(a.altFt)),
              h('td', null, a.speedKt === null ? '—' : fmtNum(a.speedKt)),
              h('td', null, ago(a.seenAt)),
            ),
          ),
        ),
      ),
    );
  };

  subscribe(['data.headlines', 'data.macro', 'data.aircraft', 'meta', 'tier'], () => open && render());
  return [scrim, drawer];
}
