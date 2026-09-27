// Fetches both bootstrap tiers in parallel with separate timeouts (fast ~3s,
// slow ~5s) and renders progressively as each arrives. Then keeps them fresh
// through the smart poller.
import { FEEDS, FEED_BY_ID } from '../../../shared/watchtower/feeds';
import type { BootstrapResponse } from '../../../shared/watchtower/types';
import { api } from './api-client';
import { poller } from './poller';
import { notify, setFeed, state, update } from './state';

const TIMEOUT = { fast: 3000, slow: 5000 } as const;
const INTERVAL = { fast: 2 * 60 * 1000, slow: 10 * 60 * 1000 } as const;
let fastFailures = 0;

async function load(tier: 'fast' | 'slow', timeoutMs: number) {
  try {
    const r = await api<BootstrapResponse>(`bootstrap?tier=${tier}`, { timeoutMs });
    for (const [id, value] of Object.entries(r.data)) {
      const m = r.meta[id] ?? null;
      const prev = state.meta[id];
      // Unchanged since last poll (same last-good timestamp): skip re-rendering.
      if (id in state.data && prev && m && prev.fetchedAt === m.fetchedAt && prev.lastAttemptAt === m.lastAttemptAt) continue;
      setFeed(id, value, m);
    }
    const locked = new Set(state.locked);
    r.locked.forEach((id) => locked.add(id));
    state.locked = locked;
    state.booted[tier] = true;
    state.lastUpdate = Date.now();
    notify('locked', 'booted', 'lastUpdate');
    if (tier === 'fast') fastFailures = 0;
    refreshConnection();
  } catch (e) {
    if (tier === 'fast') {
      fastFailures++;
      refreshConnection();
    }
    throw e;
  }
}

/** LIVE is earned: amber when >25% of fast feeds are stale, grey when the API is unreachable. */
export function refreshConnection(now = Date.now()) {
  if (fastFailures >= 2 || (!state.booted.fast && fastFailures > 0)) return update('connection', 'offline');
  if (!state.booted.fast) return;
  const fast = FEEDS.filter((f) => f.boot === 'fast' && !f.static && f.id in state.meta);
  const bad = fast.filter((f) => {
    const m = state.meta[f.id];
    return !m?.fetchedAt || now - m.fetchedAt > FEED_BY_ID[f.id].maxStaleMin * 60000;
  }).length;
  update('connection', fast.length && bad / fast.length > 0.25 ? 'degraded' : 'live');
}

export async function startBootstrap() {
  // Initial load: both tiers in parallel; panels render as each lands.
  const first = Promise.allSettled([load('fast', TIMEOUT.fast), load('slow', TIMEOUT.slow)]);
  // Retry slow tier once with a longer timeout if it missed its window.
  first.then(([, slow]) => {
    if (slow.status === 'rejected') void load('slow', 12000).catch(() => undefined);
  });
  poller.add({ id: 'bootstrap-fast', intervalMs: INTERVAL.fast, run: () => load('fast', 8000) });
  poller.add({ id: 'bootstrap-slow', intervalMs: INTERVAL.slow, run: () => load('slow', 12000) });
  setInterval(() => refreshConnection(), 30000);
  return first;
}
