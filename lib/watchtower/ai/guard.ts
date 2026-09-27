// Output checks applied to every AI text before it is shown:
//  • citation markers must point at a numbered source that was provided,
//  • any sentence containing a number that doesn't appear in the inputs is
//    removed (no fabricated figures),
//  • sentences without a citation are removed unless they state that data is thin.

const THIN = /\b(limited|thin|sparse|few|insufficient|no (?:new )?reports?|little (?:new )?information|unclear|not enough)\b/i;

export function numbersIn(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const n = m[0].replace(/,/g, '');
    out.add(n);
    out.add(String(Number(n)));
  }
  return out;
}

export function splitSentences(p: string): string[] {
  return (p.match(/[^.!?]+(?:[.!?]+(?:\s*\[\d+\])*|$)/g) ?? []).map((s) => s.trim()).filter(Boolean);
}

export interface GuardResult {
  paragraphs: string[];
  removed: number;
}

export function guardText(paragraphs: string[], sourceText: string, citeCount: number, opts: { requireCitations?: boolean } = {}): GuardResult {
  const allowed = numbersIn(sourceText);
  let removed = 0;
  const out: string[] = [];
  for (const para of paragraphs) {
    const kept: string[] = [];
    for (const raw of splitSentences(para)) {
      // drop citation markers that don't refer to a real source
      const s = raw.replace(/\[(\d+)\]/g, (m, n) => (Number(n) >= 1 && Number(n) <= citeCount ? m : '')).replace(/\s+([.,;:])/g, '$1').trim();
      const body = s.replace(/\[\d+\]/g, '');
      const fabricated = [...numbersIn(body)].some((n) => !allowed.has(n));
      const cited = /\[\d+\]/.test(s);
      if (fabricated || (opts.requireCitations !== false && !cited && !THIN.test(s))) {
        removed++;
        continue;
      }
      kept.push(s);
    }
    if (kept.length) out.push(kept.join(' '));
  }
  return { paragraphs: out, removed };
}

/** Extracts the first JSON object from a model reply (tolerates code fences). */
export function parseJsonObject<T>(text: string): T | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
