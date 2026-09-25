// Signals, Country Instability, Chokepoints, Strategic Posture, Infrastructure.
import type { ChokepointStatus, CiiScore, Severity, Signal, SignalSet, SpikeSet, TheatrePosture } from '../../../shared/watchtower/types';
import { feed, state, toggleLayer } from '../app/state';
import { LAYER_BY_ID } from '../config/layers';
import { h, lsGet, lsSet } from '../lib/dom';
import { ago } from '../lib/time';
import { BAND_COLORS } from '../map/scene';
import { emit } from '../ui/header';
import { Panel } from './Panel';

export const SEV_LABEL: Record<Severity, string> = { critical: 'CRITICAL', high: 'HIGH', med: 'ELEVATED', low: 'LOW' };
const TYPE_LABEL: Record<string, string> = {
  seismic: 'SEISMIC', natural: 'NATURAL', wildfire: 'WILDFIRE', conflict: 'CONFLICT', protest: 'UNREST', military_air: 'MILITARY', news_spike: 'NEWS SPIKE', convergence: 'CONVERGENCE', anomaly: 'ANOMALY',
};

export function sparkline(values: number[], color: string, w = 60, hgt = 16): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${hgt}`);
  svg.setAttribute('class', 'wt-spark');
  svg.setAttribute('aria-hidden', 'true');
  if (values.length < 2) return svg;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (w - 2) + 1).toFixed(1)},${(hgt - 1 - ((v - min) / span) * (hgt - 2)).toFixed(1)}`).join(' ');
  const pl = document.createElementNS(ns, 'polyline');
  pl.setAttribute('points', pts);
  pl.setAttribute('fill', 'none');
  pl.setAttribute('stroke', color);
  pl.setAttribute('stroke-width', '1.2');
  pl.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(pl);
  return svg;
}

const focusSignal = (s: Signal) => {
  if (s.lat || s.lon) emit('wt:fly', { lat: s.lat, lng: s.lon, alt: 0.9 });
  else if (s.country) emit('wt:country', s.country);
};

/* ── Signals ───────────────────────────────────────────────────── */
export class SignalsPanel extends Panel {
  private sev: 'ALL' | Severity = lsGet('wt:sig:sev', 'ALL');
  private type: string = lsGet('wt:sig:type', 'ALL');
  private chips: HTMLButtonElement[] = [];
  private typeSel: HTMLSelectElement;

  constructor() {
    super({
      id: 'signals', title: 'SIGNALS', feeds: ['signals'], emptyText: 'No signals match these filters.',
      info: 'Cross-source signal aggregator: every live feed (quakes, disasters, fires, conflict events, military aircraft, news spikes, convergence, anomalies) normalised into one list, most severe first.',
    });
    for (const s of ['ALL', 'critical', 'high', 'med'] as const) {
      const b = this.tool(h('button', { class: 'wt-chip', 'aria-pressed': String(this.sev === s), onclick: () => this.setSev(s) }, s === 'ALL' ? 'ALL' : SEV_LABEL[s])) as HTMLButtonElement;
      b.dataset.sev = s;
      this.chips.push(b);
    }
    this.typeSel = this.tool(h('select', { class: 'wt-chip', 'aria-label': 'Signal category', style: 'margin-left:auto;background:transparent' })) as HTMLSelectElement;
    this.typeSel.addEventListener('change', () => {
      this.type = this.typeSel.value;
      lsSet('wt:sig:type', this.type);
      this.scheduleRender();
    });
  }

  private setSev(s: 'ALL' | Severity) {
    this.sev = s;
    lsSet('wt:sig:sev', s);
    this.chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.sev === s)));
    this.scheduleRender();
  }

  protected renderBody() {
    const set = feed<SignalSet | null>('signals');
    if (!set) return null;
    const types = [...new Set(set.items.map((s) => s.type))];
    this.typeSel.replaceChildren(h('option', { value: 'ALL' }, 'ALL TYPES'), ...types.map((t) => h('option', { value: t }, TYPE_LABEL[t] ?? t.toUpperCase())));
    this.typeSel.value = (types as string[]).includes(this.type) ? this.type : 'ALL';
    const items = set.items.filter((s) => (this.sev === 'ALL' || s.severity === this.sev) && (this.typeSel.value === 'ALL' || s.type === this.typeSel.value));
    this.setCount(items.length);
    return items.slice(0, 120).map((s) =>
      h(
        'button',
        { class: 'wt-sig row', onclick: () => focusSignal(s) },
        h('span', { class: 'wt-sig-meta' }, h('span', { class: `sev ${s.severity}` }, SEV_LABEL[s.severity]), h('span', null, TYPE_LABEL[s.type] ?? s.type.toUpperCase()), h('span', { class: 'ago' }, ago(s.time))),
        h('span', { class: 'wt-sig-title' }, s.title),
        s.evidence.length ? h('span', { class: 'wt-sub' }, `${s.source} · ${s.evidence.slice(0, 3).join(' · ')}`) : h('span', { class: 'wt-sub' }, s.source),
      ),
    );
  }
}

/* ── Country Instability ───────────────────────────────────────── */
export class CiiPanel extends Panel {
  constructor() {
    super({
      id: 'cii', title: 'COUNTRY INSTABILITY', feeds: ['cii'],
      info: 'Country Instability Index (0–100): 40% structural baseline + 60% live events (unrest, conflict, security, information), plus capped boosts for disasters. Floors keep active war zones from looking calm in a data gap. Arrow = change over 24h. Click a country for its brief.',
    });
  }
  protected renderBody() {
    const list = feed<CiiScore[] | null>('cii');
    if (!list?.length) return null;
    return list.map((k) => {
      const color = BAND_COLORS[k.band];
      const d = k.change24h;
      return h(
        'button',
        { class: 'wt-cii row', onclick: () => emit('wt:country', k.iso3) },
        h(
          'span',
          { class: 'wt-cii-top' },
          h('span', { class: 'wt-cii-name' }, k.name),
          sparkline(k.spark, color),
          h('span', { class: 'wt-cii-band', style: `color:${color}` }, k.band),
          h('span', { class: 'wt-cii-score' }, String(k.score)),
          h('span', { class: 'wt-cii-delta', style: `color:${d && d > 0 ? '#f0788a' : d && d < 0 ? '#5ee3a1' : '#8a8699'}` }, d === null ? '·' : d > 0 ? `▲${d}` : d < 0 ? `▼${Math.abs(d)}` : '—'),
        ),
        h('span', { class: 'wt-bar' }, h('span', { style: `width:${k.score}%;background:${color}` })),
      );
    });
  }
}

/* ── Chokepoints ───────────────────────────────────────────────── */
const CK_COLOR = { DISRUPTED: '#f0526b', ELEVATED: '#f59e42', NORMAL: '#5ee3a1' } as const;
export class ChokepointsPanel extends Panel {
  constructor() {
    super({
      id: 'chokepoints', title: 'CHOKEPOINTS', feeds: ['chokepointStatus'], access: 'free',
      info: 'Supply-chain chokepoints. Status comes from conflict events, military aircraft and disaster alerts within each strait’s radius, plus 24h headlines mentioning disruption there.',
    });
  }
  protected renderBody() {
    const list = feed<ChokepointStatus[] | null>('chokepointStatus');
    if (!list?.length) return null;
    this.setCount(list.length);
    return list.map((c) =>
      h(
        'button',
        { class: 'row wt-row-btn wt-li', title: c.reasons.join('\n') || 'No nearby signals', onclick: () => emit('wt:focus', { lat: c.lat, lng: c.lon, alt: 1.1, kind: 'chokepoints', id: c.id }) },
        h('span', { class: 'wt-diamond', style: `background:${CK_COLOR[c.status]}` }),
        h('span', { class: 'wt-li-main' }, h('span', { class: 'wt-li-title' }, c.name), c.reasons[0] ? h('span', { class: 'wt-sub' }, c.reasons[0]) : null),
        h('span', { class: 'wt-sub' }, `${c.signals} sig`),
        h('span', { class: 'wt-status', style: `color:${CK_COLOR[c.status]}` }, c.status),
      ),
    );
  }
}

/* ── Strategic posture ─────────────────────────────────────────── */
const POSTURE_COLOR = { CRITICAL: '#f0526b', ELEVATED: '#f59e42', NORMAL: '#5ee3a1' } as const;
const THEATRE_VIEW: Record<string, [number, number, number]> = {
  gulf: [27, 53, 1.1], taiwan: [24, 120, 0.9], baltic: [57, 20, 1.1], blacksea: [44, 34, 1.0], korea: [38, 127.5, 0.9], redsea: [19, 39, 1.1],
};
export class PosturePanel extends Panel {
  constructor() {
    super({
      id: 'posture', title: 'STRATEGIC POSTURE', feeds: ['posture'],
      info: 'Per-theatre summary from military aircraft visible in the open ADS-B network, high/critical signals in the area, and the instability of adjacent countries. Aircraft that do not broadcast are not counted.',
    });
  }
  protected renderBody() {
    const list = feed<TheatrePosture[] | null>('posture');
    if (!list?.length) return null;
    return list.map((t) =>
      h(
        'button',
        { class: 'row wt-row-btn wt-li', style: 'align-items:flex-start', onclick: () => { const v = THEATRE_VIEW[t.id]; if (v) emit('wt:fly', { lat: v[0], lng: v[1], alt: v[2] }); } },
        h('span', { class: 'wt-li-main' }, h('span', { class: 'wt-li-title' }, t.name), h('span', { class: 'wt-sub', style: 'white-space:normal;line-height:1.5' }, t.summary)),
        h('span', { class: 'wt-status', style: `color:${POSTURE_COLOR[t.level]}` }, t.level),
      ),
    );
  }
}

/* ── Infrastructure overview ───────────────────────────────────── */
const INFRA = ['chokepoints', 'cables', 'pipelines', 'datacenters', 'spaceports', 'nuclear', 'bases'];
export class InfrastructurePanel extends Panel {
  constructor() {
    super({
      id: 'infrastructure', title: 'INFRASTRUCTURE', feeds: ['bases', 'nuclear', 'spaceports', 'datacenters', 'cables', 'pipelines'], watch: ['layers'],
      info: 'Counts for each reference layer. Click a row to show or hide it on the map. Reference datasets are hand-built from public sources with one citation per entry (see Sources & Methodology).',
    });
  }
  protected renderBody() {
    return INFRA.map((id) => {
      const l = LAYER_BY_ID[id];
      const n = l.count((k) => state.data[k]);
      const on = state.layers.has(id);
      return h(
        'button',
        { class: 'row wt-row-btn wt-li', 'aria-pressed': String(on), onclick: () => toggleLayer(id) },
        h('span', { style: `width:8px;height:8px;border-radius:2px;background:${l.color};opacity:${on ? 1 : 0.35}` }),
        h('span', { class: 'wt-li-main' }, h('span', { class: 'wt-li-title' }, l.label)),
        h('span', { class: 'wt-sub' }, n === null ? '—' : n.toLocaleString('en-GB')),
        h('span', { class: 'wt-status', style: `color:${on ? '#c4b5fd' : '#8a8699'}` }, on ? 'SHOWN' : 'HIDDEN'),
      );
    });
  }
}

/* ── Keyword spikes (compact, shown in the deck) ───────────────── */
export class SpikesPanel extends Panel {
  constructor() {
    super({
      id: 'spikes', title: 'NEWS SPIKES', feeds: ['spikes'],
      info: 'Terms whose headline mentions in the last 2 hours are more than 5, at least 3× their 7-day rate, and from 2+ outlets. 30-minute cooldown per term. Needs 24 hours of history before it fires.',
    });
  }
  protected renderBody() {
    const s = feed<SpikeSet | null>('spikes');
    if (!s) return null;
    if (s.learning) return h('div', { class: 'wt-panel-state' }, `Learning the normal news rhythm — spikes switch on after 24 hours of history (${s.historyHours}h so far).`);
    this.setCount(s.items.length);
    if (!s.items.length) return null;
    return s.items.map((k) =>
      h(
        'div',
        { class: 'wt-sig' },
        h('span', { class: 'wt-sig-meta' }, h('span', { class: `sev ${k.ratio >= 6 ? 'high' : 'med'}` }, `${k.ratio >= 99 ? 'NEW' : `${k.ratio}×`}`), h('span', null, `${k.count2h} MENTIONS · ${k.sources.length} SOURCES`), h('span', { class: 'ago' }, ago(k.firedAt))),
        h('span', { class: 'wt-sig-title' }, `“${k.term}”`),
        h('span', { class: 'wt-sub', style: 'white-space:normal' }, k.headlines.slice(0, 2).map((x) => `${x.source}: ${x.title}`).join(' · ')),
      ),
    );
  }
}
