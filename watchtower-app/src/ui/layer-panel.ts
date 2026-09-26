// Left layer panel. Reads everything from the layer registry.
import { canAccess } from '../../../shared/watchtower/feeds';
import { state, subscribe, toggleLayer, update } from '../app/state';
import { CATEGORY_LABEL, LAYERS, layerAccess, type LayerCategory } from '../config/layers';
import { h, ICONS, lsGet, lsSet, replaceChildren, svg } from '../lib/dom';

export function buildLayerPanel(): HTMLElement {
  const count = h('span', { class: 'wt-panel-count mono' });
  const filter = h('input', { id: 'wt-layer-filter', placeholder: 'Filter layers…', autocomplete: 'off', 'aria-label': 'Filter layers' }) as HTMLInputElement;
  const list = h('div', { class: 'wt-layer-list', role: 'group', 'aria-label': 'Map layers' });
  const collapse = h('button', { class: 'wt-panel-collapse', 'aria-label': 'Collapse layer panel', 'aria-expanded': 'true' });
  collapse.appendChild(svg(ICONS.chevron));

  const panel = h(
    'section',
    { class: 'wt-panel wt-layers', 'aria-label': 'Layers' },
    h('div', { class: 'wt-panel-head' }, h('span', { class: 'wt-panel-title' }, 'LAYERS'), h('span', { style: 'flex:1' }), count, collapse),
    h('div', { class: 'wt-layer-filter' }, filter),
    list,
  );

  const setCollapsed = (c: boolean) => {
    panel.classList.toggle('collapsed', c);
    collapse.setAttribute('aria-expanded', String(!c));
    collapse.style.transform = c ? 'rotate(-90deg)' : '';
    lsSet('wt:layers:collapsed', c);
  };
  collapse.addEventListener('click', () => setCollapsed(!panel.classList.contains('collapsed')));
  setCollapsed(lsGet('wt:layers:collapsed', false));

  // mobile drawer
  document.addEventListener('wt:layers-mobile', () => panel.classList.toggle('mobile-open'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') panel.classList.remove('mobile-open');
  });

  const render = () => {
    const q = filter.value.trim().toLowerCase();
    const get = (id: string) => state.data[id];
    const groups = new Map<LayerCategory, HTMLElement[]>();
    let on = 0;
    for (const l of LAYERS) {
      const locked = !canAccess(state.tier, layerAccess(l));
      const disabled = !!l.disabledReason || locked;
      const active = state.layers.has(l.id) && !disabled;
      if (active) on++;
      if (q && !l.label.toLowerCase().includes(q)) continue;
      const unsupported = !l.renderers.includes(state.mode === '3d' ? 'globe' : 'flat');
      const n = disabled ? null : l.count(get);
      const input = h('input', { type: 'checkbox', disabled, 'aria-describedby': `wt-l-${l.id}-d` }) as HTMLInputElement;
      input.checked = active;
      input.addEventListener('change', () => toggleLayer(l.id, input.checked));
      const tip = l.disabledReason ? `${l.description} (${l.disabledReason})` : locked ? `${l.description} — members only.` : l.description;
      const info = h('span', { class: 'info', 'data-tip': tip, role: 'img', 'aria-label': `About ${l.label}` }, 'i');
      info.addEventListener('click', (e) => e.preventDefault());
      const row = h(
        'label',
        { class: `wt-layer row ${active ? 'on' : ''} ${disabled ? 'locked' : ''} ${unsupported ? 'unsupported' : ''}` },
        input,
        h('span', { class: 'sw', style: `background:${l.color};opacity:${active ? 1 : 0.35}` }),
        h('span', { class: 'name' }, l.label.toUpperCase()),
        h('span', { class: 'count', id: `wt-l-${l.id}-d` }, l.disabledReason ? 'OFF' : locked ? '🔒' : n === null ? '—' : n.toLocaleString('en-GB')),
        info,
      );
      if (!groups.has(l.category)) groups.set(l.category, []);
      groups.get(l.category)!.push(row);
    }
    count.textContent = `${on} ON`;
    const kids: HTMLElement[] = [];
    for (const [cat, rows] of groups) kids.push(h('div', { class: 'wt-layer-group' }, CATEGORY_LABEL[cat]), ...rows);
    replaceChildren(list, ...(kids.length ? kids : [h('div', { class: 'wt-panel-state' }, 'No layers match.')]));
  };
  filter.addEventListener('input', render);
  subscribe(['layers', 'data', 'tier', 'mode'], render);
  render();
  update('layers', state.layers); // initial notify for renderers
  return panel;
}
