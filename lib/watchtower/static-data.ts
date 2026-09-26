// Static reference datasets (data/watchtower/*.json), bundled into the function
// and served through the gated bootstrap endpoint (never as public files).
import type { FeedMeta, StaticDataset } from '../../shared/watchtower/types';
import bases from '../../data/watchtower/bases.v1.json';
import cables from '../../data/watchtower/cables.v1.json';
import chokepoints from '../../data/watchtower/chokepoints.v1.json';
import datacenters from '../../data/watchtower/datacenters.v1.json';
import hotspots from '../../data/watchtower/hotspots.v1.json';
import nuclear from '../../data/watchtower/nuclear.v1.json';
import pipelines from '../../data/watchtower/pipelines.v1.json';
import spaceports from '../../data/watchtower/spaceports.v1.json';

const DATASETS: Record<string, StaticDataset<unknown>> = Object.fromEntries(
  Object.entries({ bases, nuclear, spaceports, datacenters, cables, pipelines, chokepoints, hotspots }).map(([k, v]) => [k, v as StaticDataset<unknown>]),
);

export function getStatic(id: string): { data: StaticDataset<unknown>; meta: FeedMeta } | null {
  const ds = DATASETS[id];
  if (!ds) return null;
  const t = Date.parse(ds.updated);
  return {
    data: ds,
    meta: { fetchedAt: isFinite(t) ? t : null, lastAttemptAt: null, recordCount: ds.items.length, source: `${ds.version} · ${ds.updated}`, ok: true },
  };
}
