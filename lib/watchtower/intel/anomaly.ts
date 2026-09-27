// Temporal anomaly baselines: Welford's online mean/variance per
// event type × region × weekday. Reported only after ≥10 samples.
//   z ≥ 1.5 → medium, ≥ 2 → high, ≥ 3 → critical
import type { Anomaly, Severity } from '../../../shared/watchtower/types';

export interface Welford {
  n: number;
  mean: number;
  m2: number;
}

export const ANOMALY = { minSamples: 10, z: { med: 1.5, high: 2, critical: 3 } };

export function welfordAdd(s: Welford | undefined, x: number): Welford {
  const cur = s ?? { n: 0, mean: 0, m2: 0 };
  const n = cur.n + 1;
  const d = x - cur.mean;
  const mean = cur.mean + d / n;
  return { n, mean, m2: cur.m2 + d * (x - mean) };
}

export const variance = (s: Welford) => (s.n > 1 ? s.m2 / (s.n - 1) : 0);

export function zSeverity(z: number): Severity {
  return z >= ANOMALY.z.critical ? 'critical' : z >= ANOMALY.z.high ? 'high' : z >= ANOMALY.z.med ? 'med' : 'low';
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const keyOf = (type: string, region: string, weekday: number) => `${type}|${region}|${weekday}`;

export interface AnomalyState {
  stats: Record<string, Welford>;
  lastDay: number | null; // UTC day number of the last baseline update
}

/** Adds one daily observation per type×region for `weekday`. */
export function updateBaselines(state: AnomalyState, counts: Record<string, Record<string, number>>, weekday: number, day: number, regions: string[]): AnomalyState {
  const stats = { ...state.stats };
  for (const type of Object.keys(counts)) {
    for (const region of regions) {
      const k = keyOf(type, region, weekday);
      stats[k] = welfordAdd(stats[k], counts[type][region] ?? 0);
    }
  }
  return { stats, lastDay: day };
}

export function detectAnomalies(state: AnomalyState, counts: Record<string, Record<string, number>>, weekday: number): Anomaly[] {
  const out: Anomaly[] = [];
  for (const [type, byRegion] of Object.entries(counts)) {
    for (const [region, value] of Object.entries(byRegion)) {
      const s = state.stats[keyOf(type, region, weekday)];
      if (!s || s.n < ANOMALY.minSamples) continue;
      const std = Math.sqrt(variance(s));
      if (std === 0) continue;
      const z = (value - s.mean) / std;
      const severity = zSeverity(z);
      if (severity === 'low') continue;
      out.push({ key: keyOf(type, region, weekday), type, region, value, mean: s.mean, std, z: Math.round(z * 100) / 100, severity, samples: s.n });
    }
  }
  return out.sort((a, b) => b.z - a.z);
}
