// Keyboard shortcuts and share link.
import { buildUrl } from '../app/url-sync';
import { h, toast } from '../lib/dom';
import { emit } from './header';
import { openModal } from './modal';

export async function shareView() {
  const url = new URL(buildUrl(), location.origin).href;
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: 'Arcane Watchtower', url });
    else {
      await navigator.clipboard.writeText(url);
      toast('Link to this view copied');
    }
  } catch {
    toast(url, 6000);
  }
}

const KEYS: [string, string][] = [
  ['⌘K  /  Ctrl K  /  /', 'Search countries, layers, signals'],
  ['M', 'Switch 3D globe / 2D map'],
  ['L', 'Show / hide the layer panel'],
  ['D', 'Open the Extended Global Monitor'],
  ['H', 'Reset view'],
  ['+  /  −', 'Zoom in / out'],
  ['S', 'Copy a share link for this view'],
  ['?', 'This help'],
  ['Esc', 'Close popovers, dialogs and drawers'],
];

export function showHelp() {
  openModal('KEYBOARD SHORTCUTS', h('table', null, h('tbody', null, ...KEYS.map(([k, d]) => h('tr', null, h('td', { class: 'mono', style: 'white-space:nowrap;color:#c4b5fd' }, k), h('td', null, d))))));
}

export function installShortcuts() {
  document.addEventListener('wt:help', showHelp);
  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      emit('wt:search');
      return;
    }
    if (typing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('.wt-modal')) return;
    const map: Record<string, () => void> = {
      '/': () => emit('wt:search'),
      m: () => emit('wt:toggle-mode'),
      l: () => (matchMedia('(max-width: 760px)').matches ? emit('wt:layers-mobile') : (document.querySelector('.wt-layers .wt-panel-collapse') as HTMLElement | null)?.click()),
      d: () => emit('wt:drawer'),
      h: () => emit('wt:home'),
      '+': () => emit('wt:zoom', 0.65),
      '=': () => emit('wt:zoom', 0.65),
      '-': () => emit('wt:zoom', 1.5),
      s: () => void shareView(),
      '?': showHelp,
    };
    const fn = map[e.key.toLowerCase()] ?? map[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  });
}
