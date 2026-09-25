import type { Severity } from '../../../shared/watchtower/types';

export const SEV_RANK: Record<Severity, number> = { low: 0, med: 1, high: 2, critical: 3 };
export const maxSev = (a: Severity, b: Severity): Severity => (SEV_RANK[a] >= SEV_RANK[b] ? a : b);
export const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));
export const log2p = (n: number) => Math.log2(1 + Math.max(0, n));

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const STOP = new Set(
  'the a an and or but of in on at to for from by with as is are was were be been has have had it its this that these those after before over under into about against amid says said say new news live update updates latest more than will would could can may might not no yes who what when where why how his her their our your they them he she we you i us up down out off first last year years day days week weeks month time times two three one says report reports reported just also still near amid across'.split(' '),
);

/** Lower-cased content words (≥4 letters, no stopwords). */
export function contentWords(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}][\p{L}'-]{2,}/gu) ?? []).map((w) => w.replace(/['’]s$/, '')).filter((w) => w.length >= 4 && !STOP.has(w));
}

/** Word overlap of two headlines: shared content words ÷ words in the shorter
 *  headline (0..1). >0.6 is treated as the same story. */
export function overlap(a: string, b: string): number {
  const A = new Set(contentWords(a));
  const B = new Set(contentWords(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / Math.min(A.size, B.size);
}
