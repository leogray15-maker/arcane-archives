// Geo-tags a headline with ISO3 codes by matching country names, aliases and
// demonyms (case-sensitive, whole words).
import { AMBIGUOUS_NAMES, COUNTRY_TERMS } from '../config/country-text';
import { allIso3, countryNames } from '../geo/countries';

interface Term {
  iso3: string;
  re: RegExp;
}

let terms: Term[] | null = null;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function build(): Term[] {
  const map = new Map<string, string>(); // term -> iso3
  for (const iso3 of allIso3()) {
    for (const n of countryNames(iso3)) {
      if (n.length < 4 || AMBIGUOUS_NAMES.has(n)) continue;
      if (!map.has(n)) map.set(n, iso3);
    }
  }
  for (const [iso3, list] of Object.entries(COUNTRY_TERMS)) for (const t of list) map.set(t, iso3);
  // Longer terms first so "South Sudan" wins over "Sudan", "North Korean" over "Korean".
  return [...map.entries()]
    .sort((a, b) => b[0].length - a[0].length)
    .map(([t, iso3]) => ({ iso3, re: new RegExp(`(^|[^\\p{L}\\p{N}])${escape(t)}(?![\\p{L}\\p{N}])`, 'u') }));
}

export function geotag(text: string): string[] {
  terms ??= build();
  const found: string[] = [];
  let rest = text;
  for (const t of terms) {
    const m = t.re.exec(rest);
    if (!m) continue;
    if (!found.includes(t.iso3)) found.push(t.iso3);
    // blank the matched span so shorter overlapping terms don't also fire
    rest = rest.slice(0, m.index) + ' '.repeat(m[0].length) + rest.slice(m.index + m[0].length);
  }
  return found;
}
