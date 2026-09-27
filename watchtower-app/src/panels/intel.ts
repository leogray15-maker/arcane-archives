// Signals, Country Instability, Chokepoints, Strategic Posture, Infrastructure.
import type { CiiScore, Severity, Signal, SignalSet, SpikeSet } from '../../../shared/watchtower/types';
import { feed, state, toggleLayer } from '../app/state';
import { LAYER_BY_ID } from '../config/layers';
import { h, ICONS, lsGet, lsSet, svg, toast } from '../lib/dom';
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
const PIN_KEY = 'wt:cii:pins';
export class CiiPanel extends Panel {
  private pins = new Set<string>(lsGet<string[]>(PIN_KEY, []));
  constructor() {
    super({
      id: 'cii', title: 'COUNTRY INSTABILITY', feeds: ['cii'],
      info: 'Country Instability Index (0–100): 40% structural baseline + 60% live events. U = unrest, C = conflict, S = security, I = information (each 0–100). Floors keep active war zones from looking calm in a data gap. The arrow is the change over 24h. Star a country to keep it at the top; click one for its brief.',
    });
  }
  private togglePin(iso3: string) {
    if (this.pins.has(iso3)) this.pins.delete(iso3);
    else this.pins.add(iso3);
    lsSet(PIN_KEY, [...this.pins]);
    this.scheduleRender();
  }
  private async share(k: CiiScore) {
    const url = new URL(location.href);
    url.searchParams.set('c', k.iso3);
    const text = `${k.name}: instability ${k.score}/100 (${k.band}) on the Arcane Watchtower`;
    try {
      if (navigator.share) await navigator.share({ title: 'Arcane Watchtower', text, url: url.toString() });
      else {
        await navigator.clipboard.writeText(url.toString());
        toast('Link copied');
      }
    } catch {
      /* share sheet dismissed */
    }
  }
  protected renderBody() {
    const list = feed<CiiScore[] | null>('cii');
    if (!list?.length) return null;
    this.setCount(list.length);
    const sorted = [...list].sort((a, b) => Number(this.pins.has(b.iso3)) - Number(this.pins.has(a.iso3)) || b.score - a.score);
    return sorted.map((k) => {
      const color = BAND_COLORS[k.band];
      const d = k.change24h;
      const pinned = this.pins.has(k.iso3);
      const star = h('button', { class: 'wt-ico', 'aria-pressed': String(pinned), 'aria-label': `${pinned ? 'Unpin' : 'Pin'} ${k.name}`, onclick: (e: Event) => { e.stopPropagation(); this.togglePin(k.iso3); } });
      star.appendChild(svg(ICONS.star));
      const share = h('button', { class: 'wt-ico', 'aria-label': `Share ${k.name}`, onclick: (e: Event) => { e.stopPropagation(); void this.share(k); } });
      share.appendChild(svg(ICONS.share));
      const c = k.components;
      return h(
        'div',
        { class: 'wt-cii row', role: 'button', tabindex: '0', onclick: () => emit('wt:country', k.iso3), onkeydown: (e: KeyboardEvent) => e.key === 'Enter' && emit('wt:country', k.iso3) },
        h(
          'span',
          { class: 'wt-cii-top' },
          star,
          h('span', { class: 'dot', style: `background:${color}` }),
          h('span', { class: 'wt-cii-name' }, k.name),
          h('span', { class: 'wt-cii-score' }, String(k.score)),
          h('span', { class: 'wt-cii-delta', style: `color:${d && d > 0 ? '#f0788a' : d && d < 0 ? '#5ee3a1' : '#8a8699'}` }, d === null ? '·' : d > 0 ? `↑${d}` : d < 0 ? `↓${Math.abs(d)}` : '→'),
          share,
        ),
        h('span', { class: 'wt-bar' }, h('span', { style: `width:${k.score}%;background:${color}` })),
        h('span', { class: 'wt-cii-parts', title: 'Unrest · Conflict · Security · Information' }, `U:${Math.round(c.unrest)} C:${Math.round(c.conflict)} S:${Math.round(c.security)} I:${Math.round(c.information)}`, h('span', { style: `color:${color};margin-left:auto` }, k.band)),
      );
    });
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
