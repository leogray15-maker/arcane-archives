// Our own small word lists for headline tone, topic groups and noise demotion.
// Deliberately simple and explainable — see METHODOLOGY.md.

export const NEGATIVE = [
  'attack', 'attacks', 'killed', 'kills', 'dead', 'deaths', 'death', 'war', 'strike', 'strikes', 'airstrike', 'bomb', 'bombing', 'missile',
  'crisis', 'collapse', 'violence', 'clashes', 'fighting', 'invasion', 'shelling', 'massacre', 'famine', 'hunger', 'flood', 'floods',
  'earthquake', 'wildfire', 'hurricane', 'cyclone', 'typhoon', 'protest', 'protests', 'riot', 'riots', 'coup', 'sanctions', 'threat',
  'threatens', 'warns', 'fears', 'arrested', 'detained', 'executed', 'hostage', 'hostages', 'displaced', 'refugees', 'outage', 'blackout',
  'recession', 'default', 'crash', 'shortage', 'emergency', 'casualties', 'injured', 'wounded', 'drone', 'drones', 'escalation', 'siege',
];

export const POSITIVE = [
  'peace', 'ceasefire', 'truce', 'agreement', 'deal', 'talks', 'aid', 'relief', 'rescue', 'rescued', 'recovery', 'growth', 'record high',
  'breakthrough', 'released', 'freed', 'reopens', 'reopened', 'elected', 'wins', 'signed', 'accord', 'cooperation', 'de-escalation',
  'improves', 'eases', 'rebuild', 'vaccine', 'cure', 'celebrate', 'restored',
];

/** Keyword groups used by headline ranking. */
export const KEYWORD_GROUPS: Record<string, { words: string[]; base: number; per: number }> = {
  violence: { words: ['killed', 'dead', 'deaths', 'massacre', 'shooting', 'bombing', 'casualties', 'wounded', 'executed', 'clashes', 'fighting'], base: 50, per: 12 },
  military: { words: ['military', 'troops', 'missile', 'missiles', 'airstrike', 'strike', 'drone', 'drones', 'navy', 'warship', 'army', 'offensive', 'invasion', 'mobilisation', 'mobilization', 'deployment', 'artillery', 'nuclear'], base: 40, per: 10 },
  unrest: { words: ['protest', 'protests', 'riot', 'riots', 'uprising', 'coup', 'martial law', 'crackdown', 'curfew', 'strike action', 'demonstrators'], base: 35, per: 9 },
  diplomacy: { words: ['ceasefire', 'talks', 'summit', 'sanctions', 'treaty', 'negotiations', 'envoy', 'ambassador', 'accord', 'truce', 'UN Security Council'], base: 35, per: 9 },
  crisis: { words: ['crisis', 'emergency', 'famine', 'humanitarian', 'evacuation', 'displaced', 'refugees', 'outbreak', 'disaster', 'earthquake', 'flood', 'cyclone', 'hurricane'], base: 15, per: 5 },
};

/** Business / celebrity noise — demoted unless something else makes the story matter. */
export const DEMOTE = [
  'earnings', 'quarterly', 'revenue', 'profit', 'shares', 'stock', 'stocks', 'IPO', 'CEO', 'startup', 'celebrity', 'actor', 'actress',
  'singer', 'album', 'movie', 'film', 'box office', 'streaming', 'fashion', 'royal wedding', 'football', 'Premier League', 'transfer',
  'recipe', 'review', 'gadget', 'smartphone', 'iPhone',
];

const wordRe = (w: string) => new RegExp(`(^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'iu');
const cache = new Map<string, RegExp>();
export function hasWord(text: string, w: string) {
  let re = cache.get(w);
  if (!re) cache.set(w, (re = wordRe(w)));
  return re.test(text);
}

/** -1..1: (positive − negative) / matches; 0 when nothing matched. */
export function lexiconTone(text: string): number {
  let pos = 0;
  let neg = 0;
  for (const w of POSITIVE) if (hasWord(text, w)) pos++;
  for (const w of NEGATIVE) if (hasWord(text, w)) neg++;
  const n = pos + neg;
  return n === 0 ? 0 : (pos - neg) / n;
}
