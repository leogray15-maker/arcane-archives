// LLM access for the Watchtower: Groq first, OpenRouter as fallback. Server
// side only — keys never reach the browser. Every call:
//   • is cached in Redis by a hash of its input,
//   • checks a global monthly spend cap (WT_AI_MONTHLY_BUDGET_USD) first,
//   • is throttled globally (per minute),
//   • records its estimated cost from the provider's token usage.
import { createHash } from 'node:crypto';
import type { Store } from '../store';

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

interface ProviderDef {
  id: 'groq' | 'openrouter';
  url: string;
  keyEnv: string;
  modelEnv: string;
  defaultModel: string;
  /** USD per 1M tokens [input, output] — conservative defaults, override via env */
  price: [number, number];
}

export const PROVIDERS: ProviderDef[] = [
  { id: 'groq', url: 'https://api.groq.com/openai/v1/chat/completions', keyEnv: 'GROQ_API_KEY', modelEnv: 'WT_GROQ_MODEL', defaultModel: 'llama-3.3-70b-versatile', price: [0.59, 0.79] },
  { id: 'openrouter', url: 'https://openrouter.ai/api/v1/chat/completions', keyEnv: 'OPENROUTER_API_KEY', modelEnv: 'WT_OPENROUTER_MODEL', defaultModel: 'meta-llama/llama-3.3-70b-instruct', price: [0.6, 0.8] },
];

export class AiUnavailable extends Error {
  constructor(message: string, public code: 'unconfigured' | 'budget' | 'throttled' | 'failed') {
    super(message);
  }
}

export const monthKey = (now = Date.now()) => `wt:ai:spend:${new Date(now).toISOString().slice(0, 7)}`;
export const budgetUsd = () => Number(process.env.WT_AI_MONTHLY_BUDGET_USD || '10');
const GLOBAL_RPM = () => Number(process.env.WT_AI_GLOBAL_RPM || '20');

export const hashInput = (kind: string, input: unknown) => createHash('sha256').update(kind + '\n' + JSON.stringify(input)).digest('hex').slice(0, 32);

export function configuredProviders() {
  return PROVIDERS.filter((p) => !!process.env[p.keyEnv]);
}

export interface Completion {
  text: string;
  provider: string;
  model: string;
  costUsd: number;
}

async function callProvider(p: ProviderDef, messages: ChatMessage[], maxTokens: number, json: boolean): Promise<Completion> {
  const model = process.env[p.modelEnv] || p.defaultModel;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Number(process.env.WT_AI_TIMEOUT_MS || '25000'));
  try {
    const res = await fetch(p.url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${process.env[p.keyEnv]}`,
        'Content-Type': 'application/json',
        ...(p.id === 'openrouter' ? { 'HTTP-Referer': 'https://arcanearchives.shop', 'X-Title': 'Arcane Watchtower' } : {}),
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    const body: any = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`${p.id} HTTP ${res.status}: ${body?.error?.message ?? 'error'}`.slice(0, 200));
    const text: string = body?.choices?.[0]?.message?.content ?? '';
    if (!text.trim()) throw new Error(`${p.id}: empty completion`);
    const inTok = body?.usage?.prompt_tokens ?? Math.ceil(messages.reduce((a, m) => a + m.content.length, 0) / 4);
    const outTok = body?.usage?.completion_tokens ?? Math.ceil(text.length / 4);
    const [pin, pout] = [Number(process.env[`WT_${p.id.toUpperCase()}_PRICE_IN`] || p.price[0]), Number(process.env[`WT_${p.id.toUpperCase()}_PRICE_OUT`] || p.price[1])];
    return { text, provider: p.id, model, costUsd: (inTok * pin + outTok * pout) / 1e6 };
  } finally {
    clearTimeout(timer);
  }
}

/** One completion through the provider chain with budget, throttle and cost tracking. */
export async function complete(store: Store, messages: ChatMessage[], opts: { maxTokens: number; json?: boolean; now?: number }): Promise<Completion> {
  const providers = configuredProviders();
  if (!providers.length) throw new AiUnavailable('AI is not configured (set GROQ_API_KEY and/or OPENROUTER_API_KEY)', 'unconfigured');
  const now = opts.now ?? Date.now();
  const spentMicro = (await store.get<number>(monthKey(now))) ?? 0;
  if (spentMicro / 1e6 >= budgetUsd()) throw new AiUnavailable(`Monthly AI budget of $${budgetUsd()} reached`, 'budget');
  const minute = Math.floor(now / 60000);
  const n = await store.incr(`wt:ai:rpm:${minute}`, 1, 120);
  if (n > GLOBAL_RPM()) throw new AiUnavailable('AI is busy — try again in a minute', 'throttled');

  const errors: string[] = [];
  for (const p of providers) {
    try {
      const c = await callProvider(p, messages, opts.maxTokens, !!opts.json);
      await store.incr(monthKey(now), Math.max(1, Math.round(c.costUsd * 1e6)), 40 * 24 * 3600);
      await store.incr(`wt:ai:calls:${monthKey(now).slice(12)}`, 1, 40 * 24 * 3600);
      return c;
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  await store.set('wt:ai:lasterror', { at: now, errors }, { ex: 7 * 24 * 3600 });
  throw new AiUnavailable(`All AI providers failed: ${errors.join(' | ')}`, 'failed');
}

export async function aiStatus(store: Store) {
  const mk = monthKey();
  const [spent, calls, lastError] = await Promise.all([store.get<number>(mk), store.get<number>(`wt:ai:calls:${mk.slice(12)}`), store.get('wt:ai:lasterror')]);
  return {
    month: mk.slice(12),
    spentUsd: Math.round(((spent ?? 0) / 1e6) * 10000) / 10000,
    budgetUsd: budgetUsd(),
    calls: calls ?? 0,
    providers: PROVIDERS.map((p) => ({ id: p.id, configured: !!process.env[p.keyEnv], model: process.env[p.modelEnv] || p.defaultModel })),
    lastError,
  };
}
