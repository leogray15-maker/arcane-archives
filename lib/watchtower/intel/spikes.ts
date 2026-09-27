// Keyword spike detection on headlines: a 2-hour window compared with a
// 7-day baseline built from hourly term buckets. A term fires when it has
// more than 5 mentions, at least 3× its baseline rate, from at least 2
// distinct outlets, and hasn't fired in the last 30 minutes.
import type { KeywordSpike, NewsItem, SpikeSet } from '../../../shared/watchtower/types';
import type { Store } from '../store';
import { contentWords } from './util';

export const SPIKE = { windowH: 2, baselineDays: 7, minCount: 5, multiplier: 3, minSources: 2, cooldownMin: 30, minHistoryH: 24 };
const HOUR = 3600000;

// Multi-word names that would be lost by splitting on spaces.
const PHRASES = ['xi jinping', 'kim jong un', 'strait of hormuz', 'red sea', 'south china sea', 'west bank', 'security council', 'martial law', 'gaza city'];
// Words too generic to be meaningful spikes.
const BLOCK = new Set(['world', 'people', 'government', 'country', 'minister', 'president', 'police', 'says', 'officials', 'state', 'watch', 'video', 'analysis', 'opinion']);

export function termsOf(title: string): string[] {
  const lower = title.toLowerCase();
  const out = new Set<string>();
  for (const p of PHRASES) if (lower.includes(p)) out.add(p);
  for (const w of contentWords(title)) if (!BLOCK.has(w)) out.add(w);
  return [...out];
}

export type Bucket = Record<string, { c: number; s: string[] }>;

export function bucketFor(items: NewsItem[], hourStart: number): Bucket {
  const b: Bucket = {};
  for (const it of items) {
    if (it.time < hourStart || it.time >= hourStart + HOUR) continue;
    for (const t of termsOf(it.title)) {
      const e = (b[t] ??= { c: 0, s: [] });
      e.c++;
      if (!e.s.includes(it.source)) e.s.push(it.source);
    }
  }
  return b;
}

export interface SpikeInput {
  items: NewsItem[];
  /** hourly buckets older than the 2h window, keyed by hour start */
  history: Record<number, Bucket>;
  now: number;
  cooling: Set<string>;
}

export function detectSpikes({ items, history, now, cooling }: SpikeInput): { spikes: KeywordSpike[]; historyHours: number } {
  const winStart = now - SPIKE.windowH * HOUR;
  const recent = items.filter((i) => i.time >= winStart && i.time <= now + 60000);
  const hours = Object.keys(history).map(Number).filter((h) => h < winStart && h >= now - SPIKE.baselineDays * 24 * HOUR);
  const historyHours = hours.length;
  const counts = new Map<string, { c: number; sources: Set<string>; heads: NewsItem[] }>();
  for (const it of recent) {
    for (const t of termsOf(it.title)) {
      const e = counts.get(t) ?? { c: 0, sources: new Set(), heads: [] };
      e.c++;
      e.sources.add(it.source);
      if (e.heads.length < 6) e.heads.push(it);
      counts.set(t, e);
    }
  }
  const spikes: KeywordSpike[] = [];
  for (const [term, e] of counts) {
    if (e.c <= SPIKE.minCount || e.sources.size < SPIKE.minSources || cooling.has(term)) continue;
    let total = 0;
    for (const h of hours) total += history[h]?.[term]?.c ?? 0;
    const baselinePer2h = historyHours ? (total / historyHours) * SPIKE.windowH : 0;
    const ratio = baselinePer2h > 0 ? e.c / baselinePer2h : Infinity;
    if (ratio < SPIKE.multiplier) continue;
    spikes.push({
      term,
      count2h: e.c,
      baselinePer2h: Math.round(baselinePer2h * 100) / 100,
      ratio: isFinite(ratio) ? Math.round(ratio * 10) / 10 : 99,
      sources: [...e.sources],
      firedAt: now,
      headlines: e.heads.map((h) => ({ title: h.title, link: h.link, source: h.source })),
    });
  }
  return { spikes: spikes.sort((a, b) => b.count2h - a.count2h), historyHours };
}

const bucketKey = (h: number) => `wt:terms:${h}`;

/** Updates hourly buckets, runs detection with cooldowns, keeps spikes active for 2h. */
export async function runSpikes(store: Store, items: NewsItem[], now: number, prev: SpikeSet | null): Promise<SpikeSet> {
  const thisHour = Math.floor(now / HOUR) * HOUR;
  // Recompute the last 3 hourly buckets (idempotent; late items land correctly).
  for (let k = 0; k < 3; k++) {
    const h = thisHour - k * HOUR;
    await store.set(bucketKey(h), bucketFor(items, h), { ex: 8 * 24 * 3600 });
  }
  const hourStarts = Array.from({ length: SPIKE.baselineDays * 24 }, (_, i) => thisHour - (i + 1) * HOUR);
  const vals = await store.mget<Bucket>(hourStarts.map(bucketKey));
  const history: Record<number, Bucket> = {};
  hourStarts.forEach((h, i) => vals[i] && (history[h] = vals[i]!));

  const previous = (prev?.items ?? []).filter((s) => now - s.firedAt < SPIKE.windowH * HOUR);
  const cooling = new Set(previous.filter((s) => now - s.firedAt < SPIKE.cooldownMin * 60000).map((s) => s.term));
  const { spikes, historyHours } = detectSpikes({ items, history, now, cooling });
  const learning = historyHours < SPIKE.minHistoryH;
  const fresh = learning ? [] : spikes;
  // A term that fires again after its cooldown replaces its older entry.
  const merged = [...fresh, ...previous.filter((p) => !fresh.some((f) => f.term === p.term))];
  return { items: merged.slice(0, 20), learning, historyHours };
}
