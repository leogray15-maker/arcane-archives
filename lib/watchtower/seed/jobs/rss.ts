// News from the curated RSS list (lib/watchtower/config/feeds.ts).
// Conditional GETs (ETag / Last-Modified), parse RSS 2.0 / RDF / Atom, keep
// headline + link + outlet only, geo-tag, score tone, dedupe, keep 48h.
import { XMLParser } from 'fast-xml-parser';
import type { NewsItem } from '../../../../shared/watchtower/types';
import { RSS_FEEDS, type RssFeed } from '../../config/feeds';
import { fnv1a } from '../../http/types';
import type { Store } from '../../store';
import { geotag } from '../../text/geotag';
import { lexiconTone } from '../../text/lexicon';
import { fetchRaw } from '../fetch';
import type { SeedJob } from '../framework';

const KEEP_MS = 48 * 3600 * 1000;
const MAX_ITEMS = 1500;
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', textNodeName: '#text', processEntities: true, htmlEntities: true });

const text = (v: unknown): string => {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'object' && '#text' in (v as any)) return String((v as any)['#text']);
  return '';
};
const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

export function canonicalLink(u: string): string {
  try {
    const url = new URL(u.trim());
    for (const k of [...url.searchParams.keys()]) if (/^(utm_|at_|ref|cmp|ito|xtor|fbclid|gclid)/i.test(k)) url.searchParams.delete(k);
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return u.trim();
  }
}

const clean = (s: string) =>
  s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').replace(/&amp;/g, '&').trim();

export function parseFeed(xml: string, feed: RssFeed, now: number): NewsItem[] {
  const doc = parser.parse(xml);
  const channelItems = doc?.rss?.channel?.item ?? doc?.['rdf:RDF']?.item ?? doc?.RDF?.item;
  const atomEntries = doc?.feed?.entry;
  const raw: { title: string; link: string; date: string }[] = [];
  for (const it of arr<any>(channelItems)) {
    raw.push({ title: text(it.title), link: text(it.link) || text(it.guid), date: text(it.pubDate) || text(it['dc:date']) || text(it.date) });
  }
  for (const e of arr<any>(atomEntries)) {
    const links = arr<any>(e.link);
    const href = links.find((l) => !l['@rel'] || l['@rel'] === 'alternate')?.['@href'] ?? links[0]?.['@href'] ?? '';
    raw.push({ title: text(e.title), link: href, date: text(e.updated) || text(e.published) });
  }
  const out: NewsItem[] = [];
  for (const r of raw) {
    const title = clean(r.title);
    const link = canonicalLink(r.link);
    if (!title || !/^https?:\/\//.test(link)) continue;
    let time = Date.parse(r.date);
    if (!isFinite(time) || time > now + 3600000) time = now; // missing / future-dated → first seen
    if (now - time > KEEP_MS) continue;
    out.push({
      id: fnv1a(link),
      title: title.slice(0, 300),
      link,
      source: feed.name,
      sourceTier: feed.tier,
      ownership: feed.ownership,
      time,
      countries: geotag(title),
      tone: Math.round(lexiconTone(title) * 100) / 100,
    });
  }
  return out;
}

async function fetchFeed(feed: RssFeed, store: Store, now: number): Promise<NewsItem[] | null> {
  const cacheKey = `wt:rss:cond:${feed.id}`;
  const cond = (await store.get<{ etag?: string; lm?: string }>(cacheKey)) ?? {};
  const headers: Record<string, string> = { Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5' };
  if (cond.etag) headers['If-None-Match'] = cond.etag;
  if (cond.lm) headers['If-Modified-Since'] = cond.lm;
  const res = await fetchRaw(feed.url, { headers, timeoutMs: 12000, retries: 0 });
  if (res.status === 304) return null; // unchanged
  if (!res.ok) throw new Error(`${feed.name}: HTTP ${res.status}`);
  const xml = await res.text();
  const items = parseFeed(xml, feed, now);
  await store.set(cacheKey, { etag: res.headers.get('etag') ?? undefined, lm: res.headers.get('last-modified') ?? undefined }, { ex: 7 * 24 * 3600 });
  return items;
}

export function mergeNews(prev: NewsItem[], fresh: NewsItem[], now: number): NewsItem[] {
  const byId = new Map<string, NewsItem>();
  for (const n of prev) if (now - n.time <= KEEP_MS) byId.set(n.id, n);
  for (const n of fresh) {
    const existing = byId.get(n.id);
    // keep the earliest time we saw it; refresh everything else
    byId.set(n.id, existing ? { ...n, time: Math.min(existing.time, n.time) } : n);
  }
  return [...byId.values()].sort((a, b) => b.time - a.time).slice(0, MAX_ITEMS);
}

export const rssJob: SeedJob<NewsItem[]> = {
  id: 'rss',
  feed: 'news',
  tier: 'medium',
  intervalMin: 15,
  timeoutMs: 40000,
  async run({ store, now }, prev) {
    const feeds = RSS_FEEDS.filter((f) => f.enabled);
    const results = await Promise.allSettled(feeds.map((f) => fetchFeed(f, store, now)));
    const fresh: NewsItem[] = [];
    const failed: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') fresh.push(...(r.value ?? []));
      else failed.push(feeds[i].name);
    });
    if (failed.length === feeds.length) throw new Error(`all feeds failed (${failed.join(', ')})`);
    if (failed.length) await store.set('wt:rss:failed', failed, { ex: 3600 });
    else await store.del('wt:rss:failed');
    return mergeNews(prev ?? [], fresh, now);
  },
  validate: (d, prev) => {
    if (!Array.isArray(d)) return { ok: false, count: 0, reason: 'bad shape' };
    if (d.length === 0 && (prev?.length ?? 0) > 0) return { ok: false, count: 0, reason: 'no items (had items)' };
    return { ok: true, count: d.length };
  },
};
