// Keeps view, map mode, active layers and selected country in the URL so any
// view can be shared. Format: ?v=lat,lng,alt&m=2d&l=seismic,conflict&c=UKR
import { debounce } from '../lib/dom';
import { state, subscribe, update, type MapMode } from './state';

export function readUrl(defaultLayers: string[], validLayers: Set<string>) {
  const q = new URLSearchParams(location.search);
  const v = q.get('v')?.split(',').map(Number);
  if (v && v.length === 3 && v.every(isFinite)) {
    state.view = { lat: clamp(v[0], -85, 85), lng: clamp(v[1], -180, 180), alt: clamp(v[2], 0.15, 6) };
  }
  const m = q.get('m');
  if (m === '2d' || m === '3d') state.mode = m as MapMode;
  const l = q.get('l');
  state.layers = new Set(l === null ? defaultLayers : l.split(',').filter((id) => validLayers.has(id)));
  const c = q.get('c');
  state.country = c && /^[A-Z]{3}$/.test(c) ? c : null;
}

export function buildUrl(): string {
  const q = new URLSearchParams();
  const { lat, lng, alt } = state.view;
  q.set('v', `${lat.toFixed(2)},${lng.toFixed(2)},${alt.toFixed(2)}`);
  if (state.mode === '2d') q.set('m', '2d');
  q.set('l', [...state.layers].sort().join(','));
  if (state.country) q.set('c', state.country);
  return `${location.pathname}?${q.toString().replace(/%2C/g, ',')}`;
}

export function startUrlSync() {
  const write = debounce(() => history.replaceState(null, '', buildUrl()), 400);
  subscribe(['view', 'mode', 'layers', 'country'], write);
  window.addEventListener('popstate', () => {
    const q = new URLSearchParams(location.search);
    const c = q.get('c');
    update('country', c && /^[A-Z]{3}$/.test(c) ? c : null);
  });
}

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
