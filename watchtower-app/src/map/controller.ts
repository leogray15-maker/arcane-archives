// Owns the map section: chrome (2D/3D toggle, view chip, stats, zoom/home,
// legend, credit), the active renderer (globe by default, flat map lazy-loaded)
// and the scene rebuild loop.
import { HOME_VIEW, state, subscribe, update, type MapMode } from '../app/state';
import { LAYER_BY_ID } from '../config/layers';
import { debounce, h, ICONS, replaceChildren, svg, toast } from '../lib/dom';
import { countryAt } from './geo';
import { Popover } from './popover';
import { loadSatLib } from './satellites';
import { buildScene, layerVisible } from './scene';
import type { MapRenderer, Marker, Scene } from './types';

/** Builds the map section and returns its stage (where overlays such as the layer list go). */
export function buildMap(section: HTMLElement): HTMLElement {
  const canvas = h('div', { class: 'wt-map-canvas' });
  const viewChip = h('span', { class: 'wt-chip-flat' }, 'VIEW · GLOBAL');
  const stats = h('span', { class: 'wt-map-stats', 'aria-live': 'off' });
  const btn3d = h('button', { 'aria-pressed': 'true' }, '3D');
  const btn2d = h('button', { 'aria-pressed': 'false' }, '2D');
  const legend = h('div', { class: 'wt-legend', 'aria-label': 'Legend' });
  const credit = h('span', { class: 'wt-credit' });
  const msg = h('div', { class: 'wt-map-msg' }, 'LOADING MAP…');
  const zoomBtn = (label: string, aria: string, fn: () => void, icon?: string) => {
    const b = h('button', { 'aria-label': aria, onclick: fn }, icon ? '' : label);
    if (icon) b.appendChild(svg(icon));
    return b;
  };

  let renderer: MapRenderer | null = null;
  let scene: Scene | null = null;
  let switching = false;
  const popover = new Popover(section, () => renderer);

  const fsBtn = h('button', { class: 'wt-tool fs', 'aria-label': 'Full screen map', 'data-tip': 'Full screen map', onclick: () => (document.fullscreenElement ? document.exitFullscreen() : section.requestFullscreen?.()) });
  fsBtn.appendChild(svg(ICONS.expand));
  const monBtn = h('button', { class: 'wt-tool', 'aria-label': 'Open Extended Global Monitor', 'data-tip': 'Extended Global Monitor: news, macro, air traffic', onclick: () => document.dispatchEvent(new CustomEvent('wt:drawer')) });
  monBtn.appendChild(svg(ICONS.panel));
  document.addEventListener('fullscreenchange', () => window.dispatchEvent(new Event('resize')));

  const stage = h(
    'div',
    { class: 'wt-map-stage' },
    canvas,
    msg,
    h('div', { class: 'wt-map-bar' }, viewChip),
    h(
      'div',
      { class: 'wt-zoom' },
      zoomBtn('+', 'Zoom in', () => renderer?.zoomBy(0.65)),
      zoomBtn('−', 'Zoom out', () => renderer?.zoomBy(1.5)),
      zoomBtn('', 'Reset view', () => renderer?.flyTo(HOME_VIEW), ICONS.home),
    ),
    legend,
    credit,
  );
  section.replaceChildren(
    h(
      'div',
      { class: 'wt-map-head' },
      h('h1', { class: 'wt-map-title', style: 'margin:0' }, 'GLOBAL SITUATION'),
      stats,
      h('div', { class: 'wt-map-tools' }, h('div', { class: 'wt-seg', role: 'group', 'aria-label': 'Map mode' }, btn2d, btn3d), monBtn, fsBtn),
    ),
    stage,
  );

  const rebuild = () => {
    if (!renderer) return;
    scene = buildScene();
    renderer.setScene(scene);
    renderLegend();
    popover.follow();
  };
  const rebuildSoon = debounce(rebuild, 120);

  const renderLegend = () => {
    const shown = [...state.layers].map((id) => LAYER_BY_ID[id]).filter((l) => l && layerVisible(l.id)).sort((a, b) => Number(b.shape === 'area') - Number(a.shape === 'area')).slice(0, 8);
    replaceChildren(
      legend,
      ...shown.map((l) =>
        l.shape === 'area' ? h('span', null, 'CII', h('i', { class: 'wt-cii-scale' }), '0–100') : h('span', null, l.shape === 'tri' ? h('i', { style: `width:0;height:0;border-radius:0;border-left:7px solid ${l.color};border-top:4px solid transparent;border-bottom:4px solid transparent` }) : h('i', { style: `background:${l.color};border-radius:${l.shape === 'dot' ? '50%' : '1px'};${l.shape === 'diamond' ? 'transform:rotate(45deg)' : ''}${l.shape === 'line' ? ';height:2px;width:10px' : ''}` }), l.label.toUpperCase()),
      ),
    );
    legend.style.display = shown.length ? '' : 'none';
  };

  const onView = (v: { lat: number; lng: number; alt: number }) => {
    update('view', v);
    popover.follow();
    void countryAt(v.lat, v.lng).then((c) => {
      viewChip.textContent = v.alt > 1.9 ? 'VIEW · GLOBAL' : `VIEW · ${(c ?? 'OPEN WATER').toUpperCase()}`;
    });
  };

  const setMode = async (mode: MapMode) => {
    if (switching) return;
    switching = true;
    const view = renderer?.getView() ?? state.view;
    renderer?.destroy();
    renderer = null;
    popover.close();
    msg.textContent = mode === '2d' ? 'LOADING 2D MAP…' : 'LOADING GLOBE…';
    msg.style.display = '';
    try {
      let next: MapRenderer;
      if (mode === '2d') {
        const { FlatRenderer } = await import('./flat');
        next = new FlatRenderer();
      } else {
        const { GlobeRenderer } = await import('./globe');
        next = new GlobeRenderer();
      }
      await next.mount(canvas);
      renderer = next;
      renderer.onViewChange(onView);
      renderer.onMarkerClick((m: Marker, x, y) => popover.open(m, x, y));
      renderer.onAreaClick((iso3) => document.dispatchEvent(new CustomEvent('wt:country', { detail: iso3 })));
      renderer.flyTo(view, 0);
      msg.style.display = 'none';
      update('mode', mode);
      btn3d.setAttribute('aria-pressed', String(mode === '3d'));
      btn2d.setAttribute('aria-pressed', String(mode === '2d'));
      credit.textContent =
        mode === '3d' ? 'Imagery: NASA Blue Marble' : import.meta.env.VITE_WT_BASEMAP === 'openfreemap' ? '© OpenStreetMap contributors · OpenFreeMap' : 'Basemap: Natural Earth';
      rebuild();
      onView(renderer.getView());
    } catch (e) {
      console.error('[map]', e);
      msg.textContent = mode === '3d' ? 'WEBGL UNAVAILABLE — TRY 2D' : 'COULD NOT LOAD 2D MAP';
      if (mode === '2d' && !renderer) toast('2D map failed to load');
    } finally {
      switching = false;
    }
  };

  btn3d.addEventListener('click', () => state.mode !== '3d' && setMode('3d'));
  btn2d.addEventListener('click', () => state.mode !== '2d' && setMode('2d'));
  document.addEventListener('wt:toggle-mode', () => setMode(state.mode === '3d' ? '2d' : '3d'));
  document.addEventListener('wt:fly', (e) => renderer?.flyTo((e as CustomEvent).detail));
  document.addEventListener('wt:home', () => renderer?.flyTo(HOME_VIEW));
  document.addEventListener('wt:zoom', (e) => renderer?.zoomBy((e as CustomEvent).detail));
  document.addEventListener('wt:focus', (e) => {
    const d = (e as CustomEvent).detail as { lat: number; lng: number; alt?: number; kind?: string; id?: string };
    renderer?.flyTo({ lat: d.lat, lng: d.lng, alt: d.alt ?? 0.9 });
    const layer = d.kind;
    if (layer && !state.layers.has(layer) && LAYER_BY_ID[layer]) {
      const next = new Set(state.layers);
      next.add(layer);
      update('layers', next);
    }
    // open the marker's popover once the camera arrives
    window.setTimeout(() => {
      const m = scene?.markers.find((x) => d.id && x.id.endsWith(`:${d.id}`));
      const p = m && renderer?.project(m.lat, m.lng);
      if (m && p) popover.open(m, p.x, p.y);
    }, 1300);
  });

  subscribe(['data', 'layers', 'tier'], rebuildSoon);

  // Satellites move: re-propagate every 5s while the layer is on and visible.
  window.setInterval(() => {
    if (!document.hidden && layerVisible('satellites')) rebuild();
  }, 5000);
  subscribe(['layers'], () => layerVisible('satellites') && loadSatLib().then(rebuildSoon));
  if (layerVisible('satellites')) void loadSatLib().then(rebuildSoon);

  // fps + marker stats
  let frames = 0;
  let last = performance.now();
  const tick = (t: number) => {
    frames++;
    if (t - last >= 1000) {
      const fps = Math.round((frames * 1000) / (t - last));
      frames = 0;
      last = t;
      const total = scene?.totalPoints ?? 0;
      const rendered = (renderer as any)?.renderedCount ?? total;
      const proj = state.mode === '3d' ? 'Orbital view' : 'Flat projection';
      stats.textContent = `${proj} · ${total.toLocaleString('en-GB')} markers${rendered < total ? ` · ${rendered.toLocaleString('en-GB')} drawn` : ''}`;
      stats.title = `${fps} fps`;
    }
    if (!document.hidden) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  document.addEventListener('visibilitychange', () => !document.hidden && requestAnimationFrame(tick));

  // Load the (heavy) map engine once the shell and panels have painted.
  const idle = (window as any).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 300));
  idle(() => void setMode(state.mode), { timeout: 1200 });
  return stage;
}
