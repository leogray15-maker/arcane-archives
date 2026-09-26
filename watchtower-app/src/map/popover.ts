import { canAccess } from '../../../shared/watchtower/feeds';
import { state } from '../app/state';
import { h, safeUrl } from '../lib/dom';
import { countryName } from '../lib/countries';
import { emit } from '../ui/header';
import type { MapRenderer, Marker } from './types';

export class Popover {
  private el: HTMLElement | null = null;
  private marker: Marker | null = null;

  constructor(private host: HTMLElement, private renderer: () => MapRenderer | null) {
    document.addEventListener('keydown', (e) => e.key === 'Escape' && this.close());
    host.addEventListener('pointerdown', (e) => {
      if (this.el && !this.el.contains(e.target as Node) && !(e.target as HTMLElement).closest('.wt-mk')) this.close();
    });
  }

  open(m: Marker, x: number, y: number) {
    this.close();
    this.marker = m;
    const url = safeUrl(m.url);
    const closeBtn = h('button', { class: 'wt-pop-close', 'aria-label': 'Close details', onclick: () => this.close() }, '×');
    this.el = h(
      'div',
      { class: 'wt-pop', role: 'dialog', 'aria-label': m.title },
      h('div', { class: 'wt-pop-head' }, h('span', { style: `color:${m.color}` }, `● ${m.label}`), closeBtn),
      h('div', { class: 'wt-pop-title' }, m.title),
      h('div', { class: 'wt-pop-meta' }, ...m.meta.filter(Boolean).flatMap((line, i) => (i ? [h('br'), line] : [line])), h('br'), `Source: ${m.source}`),
      h(
        'div',
        { class: 'wt-pop-links' },
        url ? h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, 'SOURCE ↗') : null,
        m.country && canAccess(state.tier, 'member')
          ? h('button', { class: 'wt-link-btn', onclick: () => (emit('wt:country', m.country), this.close()) }, `${countryName(m.country).toUpperCase()} BRIEF →`)
          : null,
        m.count ? h('button', { class: 'wt-link-btn', onclick: () => (emit('wt:fly', { lat: m.lat, lng: m.lng, alt: 0.45 }), this.close()) }, 'ZOOM IN →') : null,
      ),
    );
    this.host.appendChild(this.el);
    this.place(x, y);
    closeBtn.focus({ preventScroll: true });
  }

  private place(x: number, y: number) {
    if (!this.el) return;
    const w = 240;
    const hh = this.el.offsetHeight || 150;
    const W = this.host.clientWidth;
    const H = this.host.clientHeight;
    let left = x + 14;
    if (left + w > W - 8) left = x - w - 14;
    let top = y - hh / 2;
    top = Math.max(52, Math.min(H - hh - 8, top));
    this.el.style.left = `${Math.max(8, left)}px`;
    this.el.style.top = `${top}px`;
  }

  /** Keep the popover pinned to its marker as the view moves. */
  follow() {
    if (!this.el || !this.marker) return;
    const p = this.renderer()?.project(this.marker.lat, this.marker.lng);
    if (!p) return this.close();
    this.place(p.x, p.y);
  }

  close() {
    this.el?.remove();
    this.el = null;
    this.marker = null;
  }
}
