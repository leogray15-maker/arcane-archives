// Panels under the map: Live Intelligence (ranked headlines by topic, with the
// news-tone and volume pulse) and Supply Chain (chokepoints, theatres, economy).
import type { ChokepointStatus, MacroPoint, NewsItem, RankedHeadline, TheatrePosture, ToneSummary } from '../../../shared/watchtower/types';
import { canAccess } from '../../../shared/watchtower/feeds';
import { feed, state } from '../app/state';
import { h, lsGet, lsSet } from '../lib/dom';
import { ago, fmtNum } from '../lib/time';
import { emit } from '../ui/header';
import { sparkline } from './intel';
import { Panel } from './Panel';

/** A row of text tabs placed in the panel's tool strip. */
function tabStrip<T extends string>(panel: { tool(el: HTMLElement): HTMLElement }, tabs: readonly { id: T; label: string }[], current: T, onChange: (id: T) => void) {
  const bar = h('div', { class: 'wt-ptabs', role: 'tablist' });
  const btns = tabs.map((t) => {
    const b = h('button', { role: 'tab', 'aria-selected': String(t.id === current), onclick: () => select(t.id) }, t.label);
    bar.appendChild(b);
    return b;
  });
  const select = (id: T) => {
    btns.forEach((b, i) => b.setAttribute('aria-selected', String(tabs[i].id === id)));
    onChange(id);
  };
  panel.tool(bar);
}

/* ── Live Intelligence ─────────────────────────────────────────── */
const INTEL_TABS = [
  { id: 'all', label: 'All' },
  { id: 'military', label: 'Military' },
  { id: 'violence', label: 'Conflict' },
  { id: 'unrest', label: 'Unrest' },
  { id: 'diplomacy', label: 'Diplomacy' },
  { id: 'crisis', label: 'Crisis' },
] as const;
type IntelTab = (typeof INTEL_TABS)[number]['id'];
const GROUP_COLOR: Record<string, string> = { violence: '#f0526b', military: '#8b7cf6', unrest: '#f59e42', diplomacy: '#5ec8f0', crisis: '#e8c547' };

export class LiveIntelPanel extends Panel {
  private tab: IntelTab = lsGet('wt:intel:tab', 'all');
  constructor() {
    super({
      id: 'live-intel', title: 'LIVE INTELLIGENCE', feeds: ['headlines', 'tone', 'news'],
      info: 'Ranked headlines from our curated outlets, grouped by topic. Near-duplicates are merged into one story and scored by source tier, corroboration, topic and recency. The pulse shows GDELT average news tone (below 0 = negative coverage) and our headline volume per hour over 24h.',
    });
    tabStrip(this, INTEL_TABS, this.tab, (id) => {
      this.tab = id;
      lsSet('wt:intel:tab', id);
      this.scheduleRender();
    });
  }

  private pulse(): HTMLElement | null {
    const tone = feed<ToneSummary | null>('tone');
    const news = feed<NewsItem[] | null>('news');
    const parts: HTMLElement[] = [];
    if (tone?.avg24 !== null && tone?.avg24 !== undefined) {
      const pts = tone.points.slice(-48).map((p) => p[1]);
      const d = tone.prev24 === null ? null : tone.avg24 - tone.prev24;
      const color = tone.avg24 < 0 ? '#f0526b' : '#5ee3a1';
      parts.push(
        h('div', { class: 'wt-pulse-row', title: 'GDELT average tone of English-language coverage, last 24h. The arrow compares with the previous 24h.' },
          sparkline(pts, color, 84, 18),
          h('span', { class: 'v', style: `color:${d !== null && d < 0 ? '#f0788a' : '#5ee3a1'}` }, d === null ? '' : d < 0 ? '▼' : '▲'),
          h('span', { class: 'v' }, fmtNum(tone.avg24, 1)),
          h('span', { class: 'k' }, 'TONE')),
      );
    }
    if (news?.length) {
      const now = Date.now();
      const buckets = new Array(24).fill(0);
      for (const n of news) {
        const age = Math.floor((now - n.time) / 3600000);
        if (age >= 0 && age < 24) buckets[23 - age]++;
      }
      parts.push(
        h('div', { class: 'wt-pulse-row', title: 'Headlines per hour from our outlets over the last 24h. The number is the last hour.' },
          sparkline(buckets, '#5ee3a1', 84, 18),
          h('span', { class: 'v' }, String(buckets[23])),
          h('span', { class: 'k' }, 'VOLUME / HR')),
      );
    }
    return parts.length ? h('div', { class: 'wt-pulse' }, ...parts) : null;
  }

  protected renderBody() {
    const list = feed<RankedHeadline[] | null>('headlines');
    if (!list?.length) return null;
    const items = this.tab === 'all' ? list : list.filter((x) => x.groups.includes(this.tab));
    this.setCount(items.length);
    const rows = items.slice(0, 60).map((x) => {
      const g = x.groups[0];
      return h(
        'a',
        { class: 'wt-news row', href: x.link, target: '_blank', rel: 'noopener noreferrer', style: g ? `border-left-color:${GROUP_COLOR[g]}` : '' },
        h('span', { class: 'wt-news-meta' }, h('span', null, x.source.toUpperCase()), x.corroboration > 1 ? h('span', { class: 'muted' }, `+${x.corroboration - 1} MORE`) : null, h('span', { class: 'ago' }, `${ago(x.time)} ago`)),
        h('span', { class: 'wt-news-title' }, x.title),
      );
    });
    const pulse = this.pulse();
    if (!rows.length) return [pulse, h('div', { class: 'wt-panel-state' }, 'No headlines on this topic right now.')].filter(Boolean) as HTMLElement[];
    return pulse ? [pulse, ...rows] : rows;
  }
}

/* ── Supply Chain ──────────────────────────────────────────────── */
const SUPPLY_TABS = [
  { id: 'chokepoints', label: 'Chokepoints' },
  { id: 'theatres', label: 'Theatres' },
  { id: 'economic', label: 'Economic' },
] as const;
type SupplyTab = (typeof SUPPLY_TABS)[number]['id'];
const CK_COLOR = { DISRUPTED: '#f0526b', ELEVATED: '#f59e42', NORMAL: '#5ee3a1' } as const;
const THEATRE_VIEW: Record<string, [number, number, number]> = {
  gulf: [27, 53, 1.1], taiwan: [24, 120, 0.9], baltic: [57, 20, 1.1], blacksea: [44, 34, 1.0], korea: [38, 127.5, 0.9], redsea: [19, 39, 1.1],
};

export class SupplyChainPanel extends Panel {
  private tab: SupplyTab = lsGet('wt:supply:tab', 'chokepoints');
  constructor() {
    super({
      id: 'supply-chain', title: 'SUPPLY CHAIN', feeds: ['chokepointStatus', 'posture', 'macro'], access: 'free', watch: ['tier'],
      info: 'Chokepoints: status from conflict events, military aircraft and disaster alerts within each strait’s radius, plus 24h headlines about disruption there. Theatres: military aircraft visible on open ADS-B, high/critical signals and neighbouring instability. Economic: public-domain US series from FRED.',
    });
    tabStrip(this, SUPPLY_TABS, this.tab, (id) => {
      this.tab = id;
      lsSet('wt:supply:tab', id);
      this.scheduleRender();
    });
  }

  private locked() {
    return h('div', { class: 'wt-panel-state' }, h('p', { style: 'margin:0 0 12px' }, 'This tab is part of the Watchtower membership.'), h('a', { class: 'wt-cta', href: state.checkoutUrl }, 'UNLOCK WATCHTOWER'));
  }

  protected renderBody() {
    if (this.tab === 'chokepoints') {
      const list = feed<ChokepointStatus[] | null>('chokepointStatus');
      if (!list?.length) return null;
      this.setCount(null);
      const order = { DISRUPTED: 0, ELEVATED: 1, NORMAL: 2 };
      return [...list].sort((a, b) => order[a.status] - order[b.status] || b.signals - a.signals).map((c) =>
        h(
          'button',
          { class: 'wt-card row', onclick: () => emit('wt:focus', { lat: c.lat, lng: c.lon, alt: 1.1, kind: 'chokepoints', id: c.id }) },
          h('span', { class: 'wt-card-top' }, h('span', { class: 'wt-card-title' }, c.name), h('span', { class: 'dot', style: `background:${CK_COLOR[c.status]}` }), h('span', { style: 'flex:1' }), h('span', { class: 'wt-badge', style: `color:${CK_COLOR[c.status]};border-color:${CK_COLOR[c.status]}55` }, c.status)),
          h('span', { class: 'wt-sub' }, `${c.signals} signal${c.signals === 1 ? '' : 's'} nearby · ${c.newsMentions} headline mention${c.newsMentions === 1 ? '' : 's'} (24h)`),
          c.reasons.length ? h('span', { class: 'wt-card-body' }, c.reasons.slice(0, 3).join(' · ')) : h('span', { class: 'wt-card-body muted' }, 'No signals or disruption reports in range.'),
        ),
      );
    }
    if (!canAccess(state.tier, 'member')) return this.locked();
    if (this.tab === 'theatres') {
      const list = feed<TheatrePosture[] | null>('posture');
      if (!list?.length) return null;
      const C = { CRITICAL: '#f0526b', ELEVATED: '#f59e42', NORMAL: '#5ee3a1' } as const;
      return list.map((t) =>
        h(
          'button',
          { class: 'wt-card row', onclick: () => { const v = THEATRE_VIEW[t.id]; if (v) emit('wt:fly', { lat: v[0], lng: v[1], alt: v[2] }); } },
          h('span', { class: 'wt-card-top' }, h('span', { class: 'wt-card-title' }, t.name), h('span', { class: 'dot', style: `background:${C[t.level]}` }), h('span', { style: 'flex:1' }), h('span', { class: 'wt-badge', style: `color:${C[t.level]};border-color:${C[t.level]}55` }, t.level)),
          h('span', { class: 'wt-sub' }, `${t.aircraft} military aircraft · ${t.signals} high/critical signal${t.signals === 1 ? '' : 's'}`),
          h('span', { class: 'wt-card-body' }, t.summary),
        ),
      );
    }
    const pts = feed<MacroPoint[] | null>('macro');
    if (!pts?.length) return null;
    return [
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
      h('div', { class: 'wt-panel-state', style: 'padding-top:4px' }, 'Source: FRED (Federal Reserve Bank of St. Louis). Change is versus the previous observation.'),
    ];
  }

  protected emptyText() {
    if (this.tab === 'economic') return 'No macro data yet — FRED_API_KEY is not set, or FRED has not responded.';
    return super.emptyText();
  }
}
