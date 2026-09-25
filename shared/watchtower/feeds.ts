// The single list of data keys the Watchtower serves. Server (seeding, bootstrap,
// health) and client (loader, freshness badges) both read from here.
import type { Tier } from './types';

export type BootTier = 'fast' | 'slow';

export interface FeedDef {
  id: string;
  label: string;
  /** Redis key holding the value (versioned). Static datasets are served from the bundle. */
  redisKey: string;
  boot: BootTier;
  /** Minutes after which the feed counts as STALE. */
  maxStaleMin: number;
  /** Minimum viewer tier allowed to receive this key. */
  access: Tier;
  source: string;
  /** Static datasets are bundled with the function, not seeded. */
  static?: boolean;
  /** Derived keys are computed by the intelligence job rather than fetched upstream. */
  derived?: boolean;
  /** Not surfaced to the client (used only server-side). */
  internal?: boolean;
}

const f = (d: FeedDef) => d;

export const FEEDS: FeedDef[] = [
  // ── Live upstream feeds ─────────────────────────────────────────
  f({ id: 'seismic', label: 'USGS earthquakes', redisKey: 'wt:seismic:v1', boot: 'fast', maxStaleMin: 20, access: 'free', source: 'USGS' }),
  f({ id: 'natural', label: 'Natural events (EONET)', redisKey: 'wt:natural:v1', boot: 'fast', maxStaleMin: 90, access: 'free', source: 'NASA EONET' }),
  f({ id: 'disasters', label: 'Disaster alerts (GDACS)', redisKey: 'wt:gdacs:v1', boot: 'fast', maxStaleMin: 45, access: 'member', source: 'GDACS' }),
  f({ id: 'fires', label: 'Wildfires (FIRMS)', redisKey: 'wt:fires:v1', boot: 'slow', maxStaleMin: 180, access: 'member', source: 'NASA FIRMS' }),
  f({ id: 'conflict', label: 'Conflict & protest events (GDELT)', redisKey: 'wt:conflict:v1', boot: 'fast', maxStaleMin: 45, access: 'member', source: 'GDELT' }),
  f({ id: 'tone', label: 'News tone (GDELT)', redisKey: 'wt:tone:v1', boot: 'slow', maxStaleMin: 180, access: 'member', source: 'GDELT', internal: true }),
  f({ id: 'ucdp', label: 'Conflict baseline (UCDP)', redisKey: 'wt:ucdp:v1', boot: 'slow', maxStaleMin: 60 * 24 * 3, access: 'member', source: 'UCDP', internal: true }),
  f({ id: 'satellites', label: 'Satellites (CelesTrak)', redisKey: 'wt:satellites:v1', boot: 'slow', maxStaleMin: 60 * 8, access: 'member', source: 'CelesTrak' }),
  f({ id: 'aircraft', label: 'Military aircraft (adsb.lol)', redisKey: 'wt:aircraft:v1', boot: 'fast', maxStaleMin: 20, access: 'member', source: 'adsb.lol' }),
  f({ id: 'news', label: 'News (RSS)', redisKey: 'wt:news:v1', boot: 'slow', maxStaleMin: 45, access: 'member', source: 'Publisher RSS' }),
  f({ id: 'macro', label: 'Macro (FRED)', redisKey: 'wt:macro:v1', boot: 'slow', maxStaleMin: 60 * 30, access: 'member', source: 'FRED' }),

  // ── Derived (intelligence engine) ───────────────────────────────
  f({ id: 'signals', label: 'Signal aggregator', redisKey: 'wt:signals:v1', boot: 'fast', maxStaleMin: 30, access: 'member', source: 'Arcane', derived: true }),
  f({ id: 'cii', label: 'Country Instability Index', redisKey: 'wt:cii:v1', boot: 'fast', maxStaleMin: 30, access: 'member', source: 'Arcane', derived: true }),
  f({ id: 'convergence', label: 'Geographic convergence', redisKey: 'wt:convergence:v1', boot: 'fast', maxStaleMin: 30, access: 'member', source: 'Arcane', derived: true }),
  f({ id: 'spikes', label: 'Keyword spikes', redisKey: 'wt:spikes:v1', boot: 'fast', maxStaleMin: 30, access: 'member', source: 'Arcane', derived: true }),
  f({ id: 'headlines', label: 'Ranked headlines', redisKey: 'wt:headlines:v1', boot: 'fast', maxStaleMin: 45, access: 'member', source: 'Arcane', derived: true }),
  f({ id: 'anomalies', label: 'Anomaly baselines', redisKey: 'wt:anomalies:v1', boot: 'slow', maxStaleMin: 60, access: 'member', source: 'Arcane', derived: true }),
  f({ id: 'header', label: 'Threat level & sentiment', redisKey: 'wt:header:v1', boot: 'fast', maxStaleMin: 30, access: 'free', source: 'Arcane', derived: true }),
  f({ id: 'chokepointStatus', label: 'Chokepoint status', redisKey: 'wt:chokepoints:v1', boot: 'fast', maxStaleMin: 30, access: 'free', source: 'Arcane', derived: true }),
  f({ id: 'posture', label: 'Strategic posture', redisKey: 'wt:posture:v1', boot: 'fast', maxStaleMin: 30, access: 'member', source: 'Arcane', derived: true }),
  f({ id: 'brief', label: 'World Brief (AI)', redisKey: 'wt:brief:v1', boot: 'slow', maxStaleMin: 60 * 5, access: 'member', source: 'Arcane AI', derived: true }),
  f({ id: 'forecasts', label: 'AI Forecasts', redisKey: 'wt:forecasts:v1', boot: 'slow', maxStaleMin: 60 * 13, access: 'member', source: 'Arcane AI', derived: true }),

  // ── Static reference datasets (bundled, versioned in data/watchtower) ──
  f({ id: 'bases', label: 'Military bases', redisKey: 'static:bases', boot: 'slow', maxStaleMin: 0, access: 'member', source: 'Public sources (cited per entry)', static: true }),
  f({ id: 'nuclear', label: 'Nuclear sites', redisKey: 'static:nuclear', boot: 'slow', maxStaleMin: 0, access: 'member', source: 'IAEA PRIS + public sources', static: true }),
  f({ id: 'spaceports', label: 'Spaceports', redisKey: 'static:spaceports', boot: 'slow', maxStaleMin: 0, access: 'member', source: 'Public sources', static: true }),
  f({ id: 'datacenters', label: 'AI data centres', redisKey: 'static:datacenters', boot: 'slow', maxStaleMin: 0, access: 'member', source: 'Company announcements', static: true }),
  f({ id: 'cables', label: 'Undersea cables', redisKey: 'static:cables', boot: 'slow', maxStaleMin: 0, access: 'member', source: 'Hand-built from public sources', static: true }),
  f({ id: 'pipelines', label: 'Pipelines', redisKey: 'static:pipelines', boot: 'slow', maxStaleMin: 0, access: 'member', source: 'Hand-built from public sources', static: true }),
  f({ id: 'chokepoints', label: 'Chokepoints', redisKey: 'static:chokepoints', boot: 'fast', maxStaleMin: 0, access: 'free', source: 'Arcane', static: true }),
  f({ id: 'hotspots', label: 'Intel hotspots', redisKey: 'static:hotspots', boot: 'fast', maxStaleMin: 0, access: 'member', source: 'Arcane', static: true }),
];

export const FEED_BY_ID: Record<string, FeedDef> = Object.fromEntries(FEEDS.map((d) => [d.id, d]));

export const metaKey = (redisKey: string) => `wt:meta:${redisKey}`;

export const TIER_RANK: Record<Tier, number> = { free: 0, member: 1, admin: 2 };
export const canAccess = (viewer: Tier, required: Tier) => TIER_RANK[viewer] >= TIER_RANK[required];
