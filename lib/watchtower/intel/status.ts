// Header metrics (threat level, sentiment), chokepoint status and strategic
// posture — all derived from signals, CII and feeds.
import type {
  Aircraft, Chokepoint, ChokepointStatus, CiiScore, ConflictEvent, HeaderMetrics, NaturalEvent, NewsItem, Signal, TheatrePosture,
} from '../../../shared/watchtower/types';
import { THEATRES, inBox } from '../config/geo-areas';
import { hasWord } from '../text/lexicon';
import { clamp, haversineKm, SEV_RANK } from './util';

const DAY = 24 * 3600000;

/* ── Threat level (1–5) ───────────────────────────────────────────
   Our own roll-up — NOT DEFCON or any official status.
   threatScore = mean(top-5 CII) × 0.85 + min(15, 5 × active critical signals)
   level: ≥80 → 5, ≥65 → 4, ≥50 → 3, ≥35 → 2, else 1                         */
export function threatLevel(cii: CiiScore[], signals: Signal[], now: number) {
  const top = [...cii].sort((a, b) => b.score - a.score).slice(0, 5);
  const avg = top.length ? top.reduce((a, c) => a + c.score, 0) / top.length : 0;
  const critical = signals.filter((s) => s.severity === 'critical' && now - s.time < DAY).length;
  const score = clamp(avg * 0.85 + Math.min(15, critical * 5));
  const level = (score >= 80 ? 5 : score >= 65 ? 4 : score >= 50 ? 3 : score >= 35 ? 2 : 1) as HeaderMetrics['threatLevel'];
  return { level, score: Math.round(score), top: top.map((c) => ({ iso3: c.iso3, score: c.score })), critical };
}

/* ── Sentiment (0–100, 50 = neutral) ──────────────────────────────
   GDELT average tone (roughly −10..+10) → 50 + tone × 5.
   Fallback: our headline lexicon (−1..1) → 50 + tone × 40.           */
export function sentiment(tone: { avg24: number | null; prev24: number | null } | null, news: NewsItem[], now: number) {
  if (tone?.avg24 !== null && tone?.avg24 !== undefined) {
    const s = clamp(50 + tone.avg24 * 5);
    const p = tone.prev24 === null ? null : clamp(50 + tone.prev24 * 5);
    return { value: Math.round(s), change: p === null ? null : Math.round(s - p), source: 'gdelt' as const };
  }
  const avg = (from: number, to: number) => {
    const t = news.filter((n) => n.time <= now - from && n.time > now - to && n.tone !== undefined).map((n) => n.tone!);
    return t.length >= 10 ? t.reduce((a, b) => a + b, 0) / t.length : null;
  };
  const cur = avg(0, DAY);
  if (cur === null) return { value: null, change: null, source: null };
  const prev = avg(DAY, 2 * DAY);
  const s = clamp(50 + cur * 40);
  return { value: Math.round(s), change: prev === null ? null : Math.round(s - clamp(50 + prev * 40)), source: 'lexicon' as const };
}

/* ── Chokepoints ──────────────────────────────────────────────── */
const DISRUPTION_WORDS = ['blockade', 'attack', 'attacked', 'closed', 'closure', 'suspended', 'halted', 'seized', 'mined', 'struck', 'hijacked', 'diverted'];

export function chokepointStatus(
  points: Chokepoint[],
  inp: { conflict: ConflictEvent[]; aircraft: Aircraft[]; disasters: NaturalEvent[]; news: NewsItem[]; now: number },
): ChokepointStatus[] {
  return points
    .map((c) => {
      const near = (lat: number, lon: number) => haversineKm(lat, lon, c.lat, c.lon) <= c.radiusKm;
      const kinetic = inp.conflict.filter((e) => inp.now - e.time <= DAY && e.kind !== 'protest' && near(e.lat, e.lon));
      const air = inp.aircraft.filter((a) => near(a.lat, a.lon));
      const disasters = inp.disasters.filter((d) => near(d.lat, d.lon));
      const mentions = inp.news.filter((n) => inp.now - n.time <= DAY && c.keywords.some((k) => n.title.includes(k)));
      const disruptive = mentions.filter((n) => DISRUPTION_WORDS.some((w) => hasWord(n.title, w)));
      const signals = kinetic.length + disasters.length + (air.length >= 3 ? 1 : 0);
      const reasons: string[] = [];
      if (kinetic.length) reasons.push(`${kinetic.length} conflict/military events within ${c.radiusKm} km`);
      if (disasters.length) reasons.push(`${disasters.length} disaster alert(s) nearby`);
      if (air.length) reasons.push(`${air.length} military aircraft in the area`);
      if (disruptive.length) reasons.push(`${disruptive.length} headlines mention disruption`);
      const status: ChokepointStatus['status'] =
        kinetic.length >= 3 || disruptive.length >= 5 || disasters.some((d) => d.alertLevel === 'Red')
          ? 'DISRUPTED'
          : signals >= 2 || disruptive.length >= 2 || mentions.length >= 6
            ? 'ELEVATED'
            : 'NORMAL';
      return { id: c.id, name: c.name, lat: c.lat, lon: c.lon, status, signals, newsMentions: mentions.length, reasons };
    })
    .sort((a, b) => rankStatus(b.status) - rankStatus(a.status) || b.signals - a.signals);
}
const rankStatus = (s: ChokepointStatus['status']) => (s === 'DISRUPTED' ? 2 : s === 'ELEVATED' ? 1 : 0);

/* ── Strategic posture per theatre ────────────────────────────── */
export function posture(inp: { aircraft: Aircraft[]; signals: Signal[]; cii: CiiScore[]; now: number }): TheatrePosture[] {
  return THEATRES.map((t) => {
    const air = inp.aircraft.filter((a) => inBox(a.lat, a.lon, t.box));
    const sig = inp.signals.filter((s) => (s.lat || s.lon) && inBox(s.lat, s.lon, t.box) && SEV_RANK[s.severity] >= SEV_RANK.high && inp.now - s.time <= DAY);
    const crit = sig.filter((s) => s.severity === 'critical').length;
    const top = inp.cii.filter((c) => t.countries.includes(c.iso3)).sort((a, b) => b.score - a.score).slice(0, 3);
    const topScore = top[0]?.score ?? 0;
    const level: TheatrePosture['level'] =
      air.length >= 25 || crit >= 2 || (air.length >= 12 && topScore >= 80) ? 'CRITICAL' : air.length >= 8 || sig.length >= 2 || topScore >= 66 ? 'ELEVATED' : 'NORMAL';
    const parts = [
      `${air.length} military aircraft visible`,
      sig.length ? `${sig.length} high/critical signals in 24h` : 'no high-severity signals in 24h',
      top.length ? `highest instability: ${top[0].name} ${top[0].score}` : '',
    ].filter(Boolean);
    return {
      id: t.id,
      name: t.name,
      level,
      aircraft: air.length,
      signals: sig.length,
      topCountries: top.map((c) => ({ iso3: c.iso3, score: c.score })),
      summary: `${parts.join('; ')}.`,
    };
  });
}
