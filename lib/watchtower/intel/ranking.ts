// Headline ranking: groups near-duplicate headlines (same story from several
// outlets), then scores each story by source tier, corroboration, topic
// keyword groups and recency, demoting business/celebrity noise.
import type { NewsItem, RankedHeadline } from '../../../shared/watchtower/types';
import { DEMOTE, KEYWORD_GROUPS, hasWord } from '../text/lexicon';
import { overlap } from './util';

export const TIER_POINTS = { 1: 35, 2: 20, 3: 8 } as const;
export const RECENCY_HOURS = 16;
export const DUP_THRESHOLD = 0.6;

export interface Story {
  lead: NewsItem;
  items: NewsItem[];
}

/** Greedy clustering: each headline joins the first story it overlaps >60% with. */
export function clusterStories(items: NewsItem[]): Story[] {
  const stories: Story[] = [];
  const sorted = [...items].sort((a, b) => a.sourceTier - b.sourceTier || b.time - a.time);
  for (const it of sorted) {
    const s = stories.find((st) => overlap(st.lead.title, it.title) > DUP_THRESHOLD);
    if (s) s.items.push(it);
    else stories.push({ lead: it, items: [it] });
  }
  return stories;
}

export function recencyFactor(ageHours: number) {
  return Math.max(0.5, 1 - (0.5 * Math.max(0, ageHours)) / RECENCY_HOURS);
}

export function scoreStory(story: Story, now: number): { score: number; groups: string[]; sources: string[] } {
  const lead = story.lead;
  const text = story.items.map((i) => i.title).join(' \n ');
  const sources = [...new Set(story.items.map((i) => i.source))];
  const bestTier = Math.min(...story.items.map((i) => i.sourceTier)) as 1 | 2 | 3;
  let score = TIER_POINTS[bestTier] + Math.min(sources.length, 6) * 12;
  const groups: string[] = [];
  for (const [g, def] of Object.entries(KEYWORD_GROUPS)) {
    const matches = def.words.filter((w) => hasWord(lead.title, w)).length;
    if (matches) {
      groups.push(g);
      score += def.base + def.per * matches;
    }
  }
  const noisy = DEMOTE.some((w) => hasWord(text, w));
  if (noisy && groups.length === 0) score *= 0.35;
  const newest = Math.max(...story.items.map((i) => i.time));
  score *= recencyFactor((now - newest) / 3600000);
  return { score: Math.round(score * 10) / 10, groups, sources };
}

export function rankHeadlines(items: NewsItem[], now: number, limit = 100): RankedHeadline[] {
  return clusterStories(items)
    .map((s) => {
      const { score, groups, sources } = scoreStory(s, now);
      return {
        ...s.lead,
        countries: [...new Set(s.items.flatMap((i) => i.countries))],
        score,
        groups,
        corroboration: sources.length,
        clusterSources: sources,
      } satisfies RankedHeadline;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
