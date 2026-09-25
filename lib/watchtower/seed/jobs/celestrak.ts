// CelesTrak orbital elements (free; credit CelesTrak). Usage policy: download
// each group at most once per update (~every 2h) or the IP gets blocked — we
// fetch every 3 hours. Positions are propagated in the browser (satellite.js).
import type { SatGroup } from '../../../../shared/watchtower/types';
import { fetchRaw } from '../fetch';
import type { SeedJob } from '../framework';

export const SAT_GROUPS: { group: string; label: string; max: number }[] = [
  { group: 'stations', label: 'Space stations', max: 40 },
  { group: 'military', label: 'Military (misc.)', max: 200 },
  { group: 'gnss', label: 'Navigation (GNSS)', max: 160 },
  { group: 'weather', label: 'Weather', max: 120 },
  { group: 'resource', label: 'Earth observation', max: 220 },
];

export function parseTle(text: string, max: number): [string, string, string][] {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
  const out: [string, string, string][] = [];
  for (let i = 0; i + 2 < lines.length && out.length < max; i++) {
    const [n, a, b] = [lines[i], lines[i + 1], lines[i + 2]];
    if (a?.startsWith('1 ') && b?.startsWith('2 ') && !n.startsWith('1 ') && !n.startsWith('2 ')) {
      out.push([n.trim(), a, b]);
      i += 2;
    }
  }
  return out;
}

export const celestrakJob: SeedJob<SatGroup[]> = {
  id: 'celestrak',
  feed: 'satellites',
  tier: 'slow',
  intervalMin: 180,
  timeoutMs: 40000,
  async run(_ctx, prev) {
    const prevBy = new Map((prev ?? []).map((g) => [g.group, g]));
    const out: SatGroup[] = [];
    for (const g of SAT_GROUPS) {
      const res = await fetchRaw(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${g.group}&FORMAT=tle`, { timeoutMs: 15000, retries: 0 });
      // 403 = "not updated since your last download" under CelesTrak's policy → reuse what we have.
      if (!res.ok) {
        const p = prevBy.get(g.group);
        if (p) out.push(p);
        continue;
      }
      const tles = parseTle(await res.text(), g.max);
      out.push(tles.length ? { group: g.group, label: g.label, tles } : prevBy.get(g.group) ?? { group: g.group, label: g.label, tles: [] });
    }
    return out;
  },
  validate: (d, prev) => {
    const n = d.reduce((a, g) => a + g.tles.length, 0);
    const p = (prev ?? []).reduce((a, g) => a + g.tles.length, 0);
    if (n === 0) return { ok: false, count: 0, reason: p ? 'no elements returned (kept previous)' : 'no elements returned' };
    return { ok: true, count: n };
  },
};
