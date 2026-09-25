// ⌘K global search: countries, layers, hotspots, chokepoints, recent signals and actions.
import type { Chokepoint, Hotspot, SignalSet, StaticDataset } from '../../../shared/watchtower/types';
import { feed, state, toggleLayer } from '../app/state';
import { LAYERS } from '../config/layers';
import { h, replaceChildren } from '../lib/dom';
import { allCountries, loadCountryShapes } from '../lib/countries';
import { emit } from './header';
import { openModal } from './modal';
import { shareView } from './shortcuts';

interface Item {
  kind: string;
  label: string;
  sub?: string;
  run: () => void;
  keywords?: string;
}

let centroids: Map<string, [number, number]> | null = null;
async function loadCentroids() {
  if (centroids) return centroids;
  const shapes = await loadCountryShapes();
  centroids = new Map();
  for (const f of shapes) {
    const g = f.geometry as any;
    const polys: number[][][][] = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    // centre of the largest ring's bounding box — good enough to fly to
    const ring = polys.map((p) => p[0]).sort((a, b) => b.length - a.length)[0];
    if (!ring) continue;
    const xs = ring.map((p) => p[0]);
    const ys = ring.map((p) => p[1]);
    centroids.set(f.properties.iso3, [(Math.min(...ys) + Math.max(...ys)) / 2, (Math.min(...xs) + Math.max(...xs)) / 2]);
  }
  return centroids;
}

function buildItems(): Item[] {
  const items: Item[] = [];
  items.push(
    { kind: 'ACTION', label: `Switch to ${state.mode === '3d' ? '2D map' : '3D globe'}`, run: () => emit('wt:toggle-mode'), keywords: 'mode map globe flat' },
    { kind: 'ACTION', label: 'Open Extended Global Monitor', run: () => emit('wt:drawer'), keywords: 'drawer news markets macro air traffic' },
    { kind: 'ACTION', label: 'Copy share link for this view', run: () => shareView(), keywords: 'share url link copy' },
    { kind: 'ACTION', label: 'Reset view', run: () => emit('wt:home'), keywords: 'home reset' },
    { kind: 'ACTION', label: 'Sources & methodology', run: () => emit('wt:sources'), keywords: 'about licence attribution' },
    { kind: 'ACTION', label: 'Keyboard shortcuts', run: () => emit('wt:help'), keywords: 'help keys' },
  );
  for (const l of LAYERS) {
    if (l.disabledReason) continue;
    items.push({ kind: 'LAYER', label: `${state.layers.has(l.id) ? 'Hide' : 'Show'} ${l.label}`, sub: l.category.toUpperCase(), run: () => toggleLayer(l.id), keywords: l.description });
  }
  for (const hs of feed<StaticDataset<Hotspot> | null>('hotspots')?.items ?? []) {
    items.push({ kind: 'HOTSPOT', label: hs.name, sub: `LEVEL ${hs.baseline}`, run: () => emit('wt:fly', { lat: hs.lat, lng: hs.lon, alt: 1.0 }), keywords: hs.summary });
  }
  for (const c of feed<StaticDataset<Chokepoint> | null>('chokepoints')?.items ?? []) {
    items.push({ kind: 'CHOKEPOINT', label: c.name, run: () => emit('wt:focus', { lat: c.lat, lng: c.lon, alt: 1.0, kind: 'chokepoints', id: c.id }), keywords: c.keywords.join(' ') });
  }
  for (const s of (feed<SignalSet | null>('signals')?.items ?? []).slice(0, 60)) {
    items.push({
      kind: 'SIGNAL', label: s.title, sub: s.severity.toUpperCase(),
      run: () => (s.lat || s.lon ? emit('wt:fly', { lat: s.lat, lng: s.lon, alt: 0.9 }) : s.country && emit('wt:country', s.country)),
    });
  }
  for (const c of allCountries()) {
    items.push({
      kind: 'COUNTRY', label: c.name, sub: c.iso3,
      run: async () => {
        const ct = (await loadCentroids()).get(c.iso3);
        if (ct) emit('wt:fly', { lat: ct[0], lng: ct[1], alt: 1.2 });
        if (state.tier !== 'free') emit('wt:country', c.iso3);
      },
      keywords: c.iso3,
    });
  }
  return items;
}

function score(it: Item, q: string): number {
  if (!q) return it.kind === 'ACTION' ? 2 : it.kind === 'SIGNAL' ? 1 : 0;
  const l = it.label.toLowerCase();
  if (l.startsWith(q)) return 10;
  if (l.includes(` ${q}`)) return 7;
  if (l.includes(q)) return 5;
  if (it.sub?.toLowerCase() === q) return 6;
  if (it.keywords?.toLowerCase().includes(q)) return 2;
  return -1;
}

export function openPalette() {
  if (document.querySelector('.wt-palette')) return;
  void loadCentroids();
  const all = buildItems();
  const input = h('input', { class: 'wt-palette-input', placeholder: 'Search countries, layers, hotspots, signals…', 'aria-label': 'Search', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'wt-palette-list', autocomplete: 'off' }) as HTMLInputElement;
  const list = h('div', { class: 'wt-palette-list', id: 'wt-palette-list', role: 'listbox' });
  let results: Item[] = [];
  let sel = 0;

  const render = () => {
    const q = input.value.trim().toLowerCase();
    results = all.map((it) => ({ it, s: score(it, q) })).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s).slice(0, 40).map((x) => x.it);
    sel = Math.min(sel, Math.max(0, results.length - 1));
    replaceChildren(
      list,
      ...(results.length
        ? results.map((it, i) =>
            h('button', { class: 'wt-palette-item', role: 'option', 'aria-selected': String(i === sel), id: `wt-pi-${i}`, onclick: () => pick(i), onmousemove: () => { if (sel !== i) { sel = i; render(); } } },
              h('span', { class: 'wt-palette-kind' }, it.kind), h('span', null, it.label), it.sub ? h('span', { class: 'wt-palette-sub' }, it.sub) : null),
          )
        : [h('div', { class: 'wt-panel-state' }, 'No matches.')]),
    );
    input.setAttribute('aria-activedescendant', `wt-pi-${sel}`);
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  };
  const pick = (i: number) => {
    const it = results[i];
    if (!it) return;
    close();
    it.run();
  };
  input.addEventListener('input', () => ((sel = 0), render()));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') (sel = Math.min(results.length - 1, sel + 1)), render(), e.preventDefault();
    else if (e.key === 'ArrowUp') (sel = Math.max(0, sel - 1)), render(), e.preventDefault();
    else if (e.key === 'Enter') pick(sel), e.preventDefault();
  });
  const close = openModal('Search', h('div', null, input, list), { className: 'wt-palette', bare: true });
  render();
  requestAnimationFrame(() => input.focus());
}
