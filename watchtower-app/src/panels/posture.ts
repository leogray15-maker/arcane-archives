// Right-column panels: Strategic Posture (theatre cards) and Threat Timeline
// (high/critical signals over the last 24h, stacked by severity).
import type { Severity, SignalSet, TheatrePosture } from '../../../shared/watchtower/types';
import { feed } from '../app/state';
import { countryName } from '../lib/countries';
import { h } from '../lib/dom';
import { emit } from '../ui/header';
import { Panel } from './Panel';

const LEVEL_COLOR = { CRITICAL: '#f87171', ELEVATED: '#fb923c', NORMAL: '#4ade80' } as const;
// NORMAL cards stay neutral so the elevated theatres stand out.
const LEVEL_RGB = { CRITICAL: '239,68,68', ELEVATED: '249,115,22', NORMAL: '140,135,160' } as const;
const THEATRE_VIEW: Record<string, [number, number, number]> = {
  gulf: [27, 53, 1.1], taiwan: [24, 120, 0.9], baltic: [57, 20, 1.1], blacksea: [44, 34, 1.0], korea: [38, 127.5, 0.9], redsea: [19, 39, 1.1],
};

export class StrategicPosturePanel extends Panel {
  constructor() {
    super({
      id: 'posture', title: 'STRATEGIC POSTURE', feeds: ['posture'],
      info: 'Each theatre combines military aircraft visible on open ADS-B, high and critical signals in the area, and the instability of the countries around it. Click a card to fly the map there.',
    });
  }

  protected renderBody() {
    const list = feed<TheatrePosture[] | null>('posture');
    if (!list?.length) return null;
    const order = { CRITICAL: 0, ELEVATED: 1, NORMAL: 2 };
    const sorted = [...list].sort((a, b) => order[a.level] - order[b.level] || b.signals - a.signals);
    this.setCount(`${sorted.length} theatres`);
    return h(
      'div',
      { class: 'wt-posture' },
      ...sorted.map((t) => {
        const c = LEVEL_COLOR[t.level];
        const top = t.topCountries.slice(0, 3).map((x) => countryName(x.iso3) || x.iso3).join(' · ');
        return h(
          'button',
          {
            class: `wt-theatre${t.level === 'NORMAL' ? ' normal' : ''}`,
            style: `--lvl:${c};--lvl-rgb:${LEVEL_RGB[t.level]}`,
            onclick: () => {
              const v = THEATRE_VIEW[t.id];
              if (v) emit('wt:fly', { lat: v[0], lng: v[1], alt: v[2] });
            },
            'aria-label': `${t.name}: ${t.level}. Fly the map there.`,
          },
          h('span', { class: 'wt-theatre-lvl' }, t.level),
          h('span', { class: 'wt-theatre-name' }, t.name),
          h(
            'span',
            { class: 'wt-theatre-stats' },
            h('span', { title: 'Military aircraft on open ADS-B' }, h('b', null, String(t.aircraft)), ' AIR'),
            h('span', { title: 'High and critical signals' }, h('b', null, String(t.signals)), ' SIG'),
          ),
          top ? h('span', { class: 'wt-theatre-top' }, top) : null,
        );
      }),
    );
  }
}

const HOURS = 24;
const BUCKET_H = 3;
const SEV_ORDER: Severity[] = ['critical', 'high', 'med'];
const SEV_COLOR: Record<string, string> = { critical: '#ef4444', high: '#f97316', med: '#fbbf24' };

export class ThreatTimelinePanel extends Panel {
  constructor() {
    super({
      id: 'timeline', title: 'THREAT TIMELINE', feeds: ['signals'],
      info: 'Signals from every source (earthquakes, disaster alerts, conflict events, military air activity, news spikes) over the last 24 hours, grouped into 3-hour blocks by severity. Trend compares the last 12 hours with the 12 before.',
    });
  }

  protected renderBody() {
    const set = feed<SignalSet | null>('signals');
    if (!set) return null;
    const now = Date.now();
    const n = HOURS / BUCKET_H;
    const buckets = Array.from({ length: n }, () => ({ critical: 0, high: 0, med: 0 }));
    for (const s of set.items) {
      const age = (now - s.time) / 3600000;
      if (age < 0 || age >= HOURS || s.severity === 'low') continue;
      buckets[n - 1 - Math.floor(age / BUCKET_H)][s.severity as 'critical' | 'high' | 'med']++;
    }
    const total = (b: (typeof buckets)[number]) => b.critical + b.high + b.med;
    const crit = buckets.reduce((a, b) => a + b.critical, 0);
    const high = buckets.reduce((a, b) => a + b.high, 0);
    const recent = buckets.slice(n / 2).reduce((a, b) => a + b.critical * 2 + b.high, 0);
    const earlier = buckets.slice(0, n / 2).reduce((a, b) => a + b.critical * 2 + b.high, 0);
    const trend = recent > earlier * 1.2 + 1 ? ['Worsening', '#f87171'] : earlier > recent * 1.2 + 1 ? ['Easing', '#4ade80'] : ['Stable', 'var(--wt-text)'];
    const max = Math.max(4, ...buckets.map(total));
    this.setCount('24h');

    const label = (i: number) => {
      const d = new Date(now - (n - i) * BUCKET_H * 3600000);
      return `${String(d.getUTCHours()).padStart(2, '0')}:00`;
    };
    return h(
      'div',
      { class: 'wt-tl' },
      h(
        'div',
        { class: 'wt-tl-stats' },
        h('div', null, h('b', null, String(crit)), h('span', null, 'CRITICAL · 24H')),
        h('div', null, h('b', null, String(high)), h('span', null, 'HIGH · 24H')),
        h('div', null, h('b', { style: `color:${trend[1]}` }, trend[0]), h('span', null, 'TREND')),
      ),
      h(
        'div',
        { class: 'wt-tl-chart', role: 'img', 'aria-label': `Signals per 3 hours over the last day: ${crit} critical, ${high} high.` },
        ...buckets.map((b, i) =>
          h(
            'div',
            { class: 'wt-tl-col', title: `${label(i)} UTC · ${b.critical} critical · ${b.high} high · ${b.med} medium` },
            ...SEV_ORDER.map((s) => h('i', { style: `height:${(b[s as 'critical'] / max) * 100}%;background:${SEV_COLOR[s]}` })),
          ),
        ),
      ),
      h('div', { class: 'wt-tl-axis' }, ...buckets.map((_, i) => h('span', null, i % 2 === 0 ? label(i) : ''))),
      h(
        'div',
        { class: 'wt-tl-legend' },
        ...SEV_ORDER.map((s) => h('span', null, h('i', { style: `background:${SEV_COLOR[s]}` }), s === 'med' ? 'Medium' : s[0].toUpperCase() + s.slice(1))),
      ),
    );
  }

  protected emptyText() {
    return 'No signals in the last 24 hours.';
  }
}
