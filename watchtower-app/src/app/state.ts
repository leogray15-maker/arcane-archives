// One central app-state object with key-level subscriptions. No state library.
import type { FeedMeta, Tier } from '../../../shared/watchtower/types';

export type MapMode = '3d' | '2d';
export type Connection = 'connecting' | 'live' | 'degraded' | 'offline';

export interface View {
  lat: number;
  lng: number;
  alt: number;
}

export interface AppState {
  uid: string;
  email: string | null;
  tier: Tier;
  checkoutUrl: string;
  mode: MapMode;
  view: View;
  layers: Set<string>;
  country: string | null;
  data: Record<string, unknown>;
  meta: Record<string, FeedMeta | null>;
  locked: Set<string>;
  connection: Connection;
  booted: { fast: boolean; slow: boolean };
  lastUpdate: number | null;
}

export type StateKey = keyof AppState | `data.${string}`;
type Listener = (changed: Set<StateKey>) => void;

export const HOME_VIEW: View = { lat: 22, lng: 20, alt: 2.4 };

export const state: AppState = {
  uid: '',
  email: null,
  tier: 'free',
  checkoutUrl: '/membership-assessment.html',
  mode: '3d',
  view: { ...HOME_VIEW },
  layers: new Set(),
  country: null,
  data: {},
  meta: {},
  locked: new Set(),
  connection: 'connecting',
  booted: { fast: false, slow: false },
  lastUpdate: null,
};

const listeners = new Set<{ keys: Set<StateKey> | null; fn: Listener }>();
let pending = new Set<StateKey>();
let scheduled = false;

function flush() {
  scheduled = false;
  const changed = pending;
  pending = new Set();
  for (const l of listeners) {
    if (!l.keys || [...changed].some((k) => l.keys!.has(k))) {
      try {
        l.fn(changed);
      } catch (e) {
        console.error('[watchtower] listener failed', e);
      }
    }
  }
}

export function notify(...keys: StateKey[]) {
  keys.forEach((k) => pending.add(k));
  if (!scheduled) {
    scheduled = true;
    queueMicrotask(flush);
  }
}

export function update<K extends keyof AppState>(key: K, value: AppState[K]) {
  state[key] = value;
  notify(key);
}

export function setFeed(id: string, value: unknown, meta: FeedMeta | null | undefined) {
  state.data[id] = value;
  if (meta !== undefined) state.meta[id] = meta;
  notify('data', `data.${id}`, 'meta');
}

export function subscribe(keys: StateKey[] | null, fn: Listener) {
  const entry = { keys: keys ? new Set(keys) : null, fn };
  listeners.add(entry);
  return () => listeners.delete(entry);
}

export function toggleLayer(id: string, on?: boolean) {
  const next = new Set(state.layers);
  const want = on ?? !next.has(id);
  if (want) next.add(id);
  else next.delete(id);
  update('layers', next);
}

export function feed<T>(id: string): T | undefined {
  return state.data[id] as T | undefined;
}
