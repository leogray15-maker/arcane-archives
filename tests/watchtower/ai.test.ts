import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewsItem, RankedHeadline } from '../../shared/watchtower/types';
import { generateCountryBrief, generateWorldBrief, pickHeadlines } from '../../lib/watchtower/ai/briefs';
import { guardText, parseJsonObject } from '../../lib/watchtower/ai/guard';
import { complete, monthKey } from '../../lib/watchtower/ai/provider';
import { MemoryStore, setStore } from '../../lib/watchtower/store';
import { handle } from '../../lib/watchtower/routes';

const NOW = Date.UTC(2026, 8, 25, 12);
const head = (i: number, title: string, source = 'BBC'): RankedHeadline => ({
  id: `h${i}`, title, link: `https://example.com/${i}`, source, sourceTier: 1, ownership: 'private', time: NOW - i * 600000, countries: ['UKR'],
  score: 100 - i, corroboration: 1, groups: [], clusterSources: [source],
});
const HEADS = [
  head(1, 'Missile strike hits Kharkiv energy site, 3 injured'), head(2, 'Red Sea blockade forces 40 ships to reroute', 'DW'),
  head(3, 'Missile strike hits Kharkiv energy site overnight', 'Guardian'), head(4, 'UN envoy arrives for Gaza talks'),
  head(5, 'Floods displace thousands in Bangladesh'), head(6, 'Protests in Nairobi over tax plan', 'Al Jazeera'),
];

function reply(content: object | string, status = 200) {
  return new Response(JSON.stringify(status === 200 ? { choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }], usage: { prompt_tokens: 1000, completion_tokens: 200 } } : { error: { message: 'down' } }), { status });
}

let store: MemoryStore;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  store = new MemoryStore(() => NOW);
  setStore(store);
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  process.env.GROQ_API_KEY = 'g';
  process.env.OPENROUTER_API_KEY = 'o';
  process.env.WT_AI_MONTHLY_BUDGET_USD = '10';
  process.env.WT_DEV_AUTH_BYPASS = '1';
});
afterEach(() => vi.unstubAllGlobals());

describe('output guard', () => {
  it('drops sentences with numbers that are not in the sources, and bad citations', () => {
    const g = guardText(['Forty ships rerouted [2]. Some 400 ships rerouted [2]. Strikes hit Kharkiv [9]. Three people were injured, 3 in total [1].'], HEADS.map((h) => h.title).join('\n'), 6);
    expect(g.paragraphs[0]).toBe('Forty ships rerouted [2]. Three people were injured, 3 in total [1].');
    expect(g.removed).toBe(2); // 400 not in sources; [9] stripped → uncited
  });
  it('keeps uncited sentences only when they say data is thin', () => {
    const g = guardText(['Reporting from the Sahel is thin this cycle. The situation is dire.'], '', 0);
    expect(g.paragraphs).toEqual(['Reporting from the Sahel is thin this cycle.']);
  });
  it('parses JSON wrapped in prose or code fences', () => {
    expect(parseJsonObject<{ a: number }>('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it('merges near-duplicate headlines before prompting', () => {
    expect(pickHeadlines(HEADS).map((h) => h.id)).not.toContain('h3');
  });
});

describe('provider chain, budget and cache', () => {
  it('falls back to OpenRouter when Groq fails and records spend', async () => {
    fetchMock.mockResolvedValueOnce(reply('', 500)).mockResolvedValueOnce(reply({ paragraphs: ['ok [1]'] }));
    const c = await complete(store, [{ role: 'user', content: 'x' }], { maxTokens: 50, now: NOW });
    expect(c.provider).toBe('openrouter');
    expect(fetchMock.mock.calls[0][0]).toContain('groq.com');
    expect(fetchMock.mock.calls[1][0]).toContain('openrouter.ai');
    expect(await store.get<number>(monthKey(NOW))).toBeGreaterThan(0);
  });

  it('refuses once the monthly budget is spent', async () => {
    await store.set(monthKey(NOW), 10_000_000);
    await expect(complete(store, [{ role: 'user', content: 'x' }], { maxTokens: 50, now: NOW })).rejects.toThrow(/budget/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('caches the World Brief by headline hash (one LLM call for many viewers)', async () => {
    fetchMock.mockResolvedValue(reply({ paragraphs: ['Missile strike hits Kharkiv energy site [1]. Red Sea blockade forces 40 ships to reroute [2].'] }));
    const a = await generateWorldBrief(store, HEADS, NOW);
    const b = await generateWorldBrief(store, HEADS, NOW);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(a.citations[0]).toMatchObject({ n: 1, source: 'BBC' });
    expect(a.thinData).toBe(false);
  });

  it('says so when data is thin', async () => {
    fetchMock.mockResolvedValue(reply({ paragraphs: ['Invented claim with 999 casualties [1].'] }));
    const b = await generateWorldBrief(store, HEADS.slice(0, 2), NOW);
    expect(b.thinData).toBe(true);
    expect(b.paragraphs[0]).toMatch(/too thin/);
  });

  it('country brief keeps index figures from the data', async () => {
    fetchMock.mockResolvedValue(reply({ paragraphs: ['Ukraine scores 72 on the index. A strike hit Kharkiv [1].'] }));
    const news: NewsItem[] = [HEADS[0]];
    const cb = await generateCountryBrief(store, 'UKR', { cii: { iso3: 'UKR', name: 'Ukraine', score: 72, band: 'HIGH', baseline: 72, event: 50, components: { unrest: 10, conflict: 60, security: 30, information: 40 }, boosts: {}, floor: 70, floorReason: null, change24h: null, spark: [] }, signals: [], news }, NOW);
    expect(cb.paragraphs[0]).toContain('72');
  });
});

describe('country-brief endpoint', () => {
  const call = (token: string, iso = 'UKR') => handle({ method: 'GET', route: 'country-brief', query: { iso }, headers: { authorization: `Bearer ${token}` } }, store);

  it('is members-only', async () => {
    expect((await call('dev-free')).status).toBe(403);
  });

  it('caches per country and enforces the per-user daily limit', async () => {
    process.env.WT_AI_USER_DAILY_LIMIT = '1';
    fetchMock.mockResolvedValue(reply({ paragraphs: ['Data on this country is thin.'] }));
    const first = await call('dev-member', 'UKR');
    expect(first.status).toBe(200);
    expect((await call('dev-member', 'UKR')).body).toMatchObject({ cached: true }); // cache hits don't count
    const second = await call('dev-member', 'SDN');
    expect(second.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    delete process.env.WT_AI_USER_DAILY_LIMIT;
  });
});
