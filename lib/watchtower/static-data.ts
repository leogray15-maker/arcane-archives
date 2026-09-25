// Static reference datasets (data/watchtower/*.json), bundled into the function
// and served through the gated bootstrap endpoint (never as public files).
import type { FeedMeta, StaticDataset } from '../../shared/watchtower/types';

const DATASETS: Record<string, StaticDataset<unknown>> = {};

export function registerStatic(id: string, ds: StaticDataset<unknown>) {
  DATASETS[id] = ds;
}

export function getStatic(id: string): { data: StaticDataset<unknown>; meta: FeedMeta } | null {
  const ds = DATASETS[id];
  if (!ds) return null;
  const t = Date.parse(ds.updated);
  return {
    data: ds,
    meta: { fetchedAt: isFinite(t) ? t : null, lastAttemptAt: null, recordCount: ds.items.length, source: `${ds.version} · ${ds.updated}`, ok: true },
  };
}
