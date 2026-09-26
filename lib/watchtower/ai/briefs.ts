// World Brief, Country Brief and AI Forecasts.
import type { AiBrief, BriefCitation, CiiScore, CountryBrief, ForecastSet, NewsItem, RankedHeadline, Signal, SignalSet, SpikeSet, TheatrePosture } from '../../../shared/watchtower/types';
import { iso3Name } from '../geo/countries';
import { overlap } from '../intel/util';
import type { Store } from '../store';
import { guardText, parseJsonObject } from './guard';
import { complete, hashInput, type ChatMessage } from './provider';

export const TONE_RULES = `Rules you must follow:
- Use ONLY the numbered sources and data provided. Do not add outside knowledge or context.
- Neutral, factual, attributed language ("according to", "X reported"). No sensationalism, no loaded adjectives, no speculation, no advice or recommendations.
- Do not invent or estimate numbers. Only use figures that appear verbatim in the sources.
- Put citation markers like [1] or [2][3] at the end of every sentence that states a fact, referring to the numbered sources.
- If the sources are thin, conflicting or one-sided, say so plainly instead of filling gaps.`;

const fmtAge = (t: number, now: number) => {
  const h = Math.round((now - t) / 3600000);
  return h < 1 ? '<1h ago' : `${h}h ago`;
};

/** Top headlines with near-duplicates merged (>60% word overlap). */
export function pickHeadlines(ranked: RankedHeadline[], n = 12): RankedHeadline[] {
  const out: RankedHeadline[] = [];
  for (const h of ranked) {
    if (out.some((o) => overlap(o.title, h.title) > 0.6)) continue;
    out.push(h);
    if (out.length >= n) break;
  }
  return out;
}

function citationsFrom(items: (NewsItem | RankedHeadline)[]): BriefCitation[] {
  return items.map((h, i) => ({ n: i + 1, title: h.title, source: h.source, link: h.link, time: h.time }));
}

function sourceBlock(cites: BriefCitation[], now: number) {
  return cites.map((c) => `[${c.n}] ${c.source} (${fmtAge(c.time, now)}): ${c.title}`).join('\n');
}

/* ── World Brief ─────────────────────────────────────────────────── */

export async function generateWorldBrief(store: Store, ranked: RankedHeadline[], now: number): Promise<AiBrief> {
  const picked = pickHeadlines(ranked, 12);
  const cites = citationsFrom(picked);
  const cacheKey = `wt:ai:cache:brief:${hashInput('brief', picked.map((p) => [p.id, p.title]))}`;
  const cached = await store.get<AiBrief>(cacheKey);
  if (cached) return cached;

  const thin = picked.length < 5;
  const messages: ChatMessage[] = [
    { role: 'system', content: `You write the "World Brief" for a global situational-awareness dashboard.\n${TONE_RULES}\nReturn JSON: {"paragraphs": [string, ...]} with 2–3 short paragraphs, at most 170 words in total, most significant developments first.` },
    { role: 'user', content: `Ranked headlines (most significant first):\n${sourceBlock(cites, now)}${thin ? '\n\nNote: very few headlines are available this cycle.' : ''}` },
  ];
  const c = await complete(store, messages, { maxTokens: 500, json: true, now });
  const parsed = parseJsonObject<{ paragraphs?: string[] }>(c.text);
  const g = guardText(parsed?.paragraphs ?? [c.text], cites.map((x) => x.title).join('\n'), cites.length);
  const brief: AiBrief = {
    paragraphs: g.paragraphs.length ? g.paragraphs : ['Coverage this cycle is too thin to summarise reliably. See the ranked headlines in the monitor.'],
    citations: cites,
    generatedAt: now,
    model: c.model,
    provider: c.provider,
    thinData: thin || g.paragraphs.length === 0,
  };
  await store.set(cacheKey, brief, { ex: 24 * 3600 });
  return brief;
}

/* ── Country Brief ───────────────────────────────────────────────── */

export async function generateCountryBrief(
  store: Store,
  iso3: string,
  inputs: { cii: CiiScore | null; signals: Signal[]; news: NewsItem[] },
  now: number,
): Promise<CountryBrief> {
  const name = inputs.cii?.name ?? iso3Name(iso3);
  const headlines = [...inputs.news].filter((n) => n.countries.includes(iso3)).sort((a, b) => b.time - a.time).slice(0, 8);
  const cites = citationsFrom(headlines);
  const sigLines = inputs.signals.slice(0, 10).map((s) => `- ${s.severity.toUpperCase()} ${s.type}: ${s.title} (${s.source}, ${fmtAge(s.time, now)})`);
  const cii = inputs.cii;
  const ciiBlock = cii
    ? `Country Instability Index: ${cii.score}/100 (${cii.band}). Baseline ${cii.baseline}. Components — unrest ${cii.components.unrest}, conflict ${cii.components.conflict}, security ${cii.components.security}, information ${cii.components.information}.${cii.change24h !== null ? ` 24h change ${cii.change24h}.` : ''}${cii.floorReason ? ` Floor applied: ${cii.floorReason}.` : ''}`
    : 'This country is not in the Country Instability Index list.';
  const thin = headlines.length < 2 && inputs.signals.length < 2;
  const messages: ChatMessage[] = [
    { role: 'system', content: `You write short situational summaries of a single country for a dashboard.\n${TONE_RULES}\n- Index values and signal lines are internal data: you may restate them without a citation, but only with the exact figures given.\nReturn JSON: {"paragraphs": [string, ...]} — about 150 words in total.` },
    {
      role: 'user',
      content: `Country: ${name}\n\n${ciiBlock}\n\nRecent signals:\n${sigLines.join('\n') || '- none'}\n\nNumbered headlines:\n${sourceBlock(cites, now) || '(none in the last 48h)'}${thin ? '\n\nNote: data for this country is thin right now.' : ''}`,
    },
  ];
  const c = await complete(store, messages, { maxTokens: 420, json: true, now });
  const parsed = parseJsonObject<{ paragraphs?: string[] }>(c.text);
  const sourceText = [ciiBlock, ...sigLines, ...cites.map((x) => x.title)].join('\n');
  const g = guardText(parsed?.paragraphs ?? [c.text], sourceText, cites.length, { requireCitations: false });
  return {
    iso3,
    name,
    paragraphs: g.paragraphs.length ? g.paragraphs : [`There is too little recent data on ${name} to write a reliable summary.`],
    citations: cites,
    generatedAt: now,
    model: c.model,
    provider: c.provider,
    thinData: thin || g.paragraphs.length === 0,
  };
}

/* ── Forecasts ("what to watch") ─────────────────────────────────── */

export async function generateForecasts(
  store: Store,
  inp: { cii: CiiScore[]; signals: SignalSet | null; spikes: SpikeSet | null; posture: TheatrePosture[]; headlines: RankedHeadline[] },
  now: number,
): Promise<ForecastSet> {
  const top = inp.cii.slice(0, 10).map((c) => `${c.name}: ${c.score} (${c.band})${c.change24h ? `, 24h ${c.change24h > 0 ? '+' : ''}${c.change24h}` : ''}`);
  const sig = (inp.signals?.items ?? []).filter((s) => s.severity === 'critical' || s.severity === 'high').slice(0, 15).map((s) => `${s.severity}: ${s.title}`);
  const spikes = (inp.spikes?.items ?? []).map((s) => `"${s.term}" ${s.count2h} mentions in 2h`);
  const post = inp.posture.map((p) => `${p.name}: ${p.level} — ${p.summary}`);
  const heads = pickHeadlines(inp.headlines, 10).map((h, i) => `[${i + 1}] ${h.source}: ${h.title}`);
  const input = { top, sig, spikes, post, heads };
  const cacheKey = `wt:ai:cache:forecasts:${hashInput('forecasts', input)}`;
  const cached = await store.get<ForecastSet>(cacheKey);
  if (cached) return cached;

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You list plain-English "what to watch" items for the coming days, based only on the data given. These are not predictions of outcomes and not advice.
${TONE_RULES}
- Each item names something observable to watch (e.g. whether reported activity continues), not what will happen.
- Confidence reflects how strongly the provided data supports the item being worth watching: "low", "medium" or "high". Never give numeric probabilities.
Return JSON: {"items": [{"title": string, "region": string, "category": "conflict"|"security"|"unrest"|"disaster"|"economy"|"diplomacy"|"infrastructure", "confidence": "low"|"medium"|"high", "rationale": string}]} with 3 to 6 items. Rationale: one sentence citing the data it rests on.`,
    },
    { role: 'user', content: `Country Instability (top 10):\n${top.join('\n') || 'none'}\n\nHigh/critical signals:\n${sig.join('\n') || 'none'}\n\nKeyword spikes:\n${spikes.join('\n') || 'none'}\n\nTheatre posture:\n${post.join('\n') || 'none'}\n\nTop headlines:\n${heads.join('\n') || 'none'}` },
  ];
  const c = await complete(store, messages, { maxTokens: 700, json: true, now });
  const parsed = parseJsonObject<{ items?: any[] }>(c.text);
  const sourceText = [top, sig, spikes, post, heads].flat().join('\n');
  const conf = new Set(['low', 'medium', 'high']);
  const items = (parsed?.items ?? [])
    .filter((i) => i && typeof i.title === 'string' && typeof i.rationale === 'string')
    .map((i) => ({
      title: String(i.title).slice(0, 140),
      region: String(i.region ?? 'Global').slice(0, 60),
      category: String(i.category ?? 'security').slice(0, 30),
      confidence: (conf.has(i.confidence) ? i.confidence : 'low') as 'low' | 'medium' | 'high',
      rationale: String(i.rationale).slice(0, 300),
    }))
    // same number guard as the briefs: no figures that aren't in the data
    .filter((i) => guardText([`${i.title}. ${i.rationale}`], sourceText, heads.length, { requireCitations: false }).removed === 0)
    .slice(0, 6);
  const set: ForecastSet = { items, generatedAt: now, model: c.model, provider: c.provider };
  await store.set(cacheKey, set, { ex: 12 * 3600 });
  return set;
}
