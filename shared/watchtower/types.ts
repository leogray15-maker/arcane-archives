// Types shared by the Watchtower client (watchtower-app) and server (lib/watchtower).
// Keep this file dependency-free.

export type Tier = 'free' | 'member' | 'admin';
export type Severity = 'low' | 'med' | 'high' | 'critical';
export type FeedStatus = 'OK' | 'STALE' | 'EMPTY';

export interface FeedMeta {
  /** Time of the last successful write (ms). null = never written. */
  fetchedAt: number | null;
  /** Time of the last attempt, successful or not (ms). */
  lastAttemptAt: number | null;
  recordCount: number;
  source: string;
  ok: boolean;
  error?: string;
}

export interface Quake {
  id: string;
  mag: number;
  place: string;
  time: number;
  lat: number;
  lon: number;
  depthKm: number;
  url: string;
  tsunami: boolean;
  alert: string | null; // USGS PAGER: green | yellow | orange | red
  significant: boolean;
}

export interface NaturalEvent {
  id: string;
  title: string;
  category: string; // wildfires, severeStorms, volcanoes, floods, ...
  source: 'EONET' | 'GDACS';
  lat: number;
  lon: number;
  time: number;
  url: string;
  /** GDACS alert level when present: Green | Orange | Red */
  alertLevel?: string;
  country?: string;
}

/** Compact fire detection: [lat, lon, frp, time(ms)] */
export type FirePoint = [number, number, number, number];

export interface FireSummary {
  points: FirePoint[];
  byCountry: Record<string, number>; // ISO3 -> high-confidence detections
  total: number;
}

export interface ConflictEvent {
  id: string;
  lat: number;
  lon: number;
  time: number;
  kind: 'protest' | 'violence' | 'military' | 'coercion';
  country: string | null; // ISO3
  mentions: number;
  tone: number;
  goldstein: number;
  url: string;
  place: string;
}

export interface Aircraft {
  hex: string;
  callsign: string;
  type: string;
  reg: string;
  lat: number;
  lon: number;
  altFt: number | null;
  speedKt: number | null;
  track: number | null;
  seenAt: number;
}

export interface SatGroup {
  group: string;
  label: string;
  /** [name, tleLine1, tleLine2] */
  tles: [string, string, string][];
}

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  sourceTier: 1 | 2 | 3;
  ownership: 'private' | 'public-broadcaster' | 'state';
  time: number;
  countries: string[]; // ISO3
  tone?: number; // -1..1 from our lexicon
}

export interface RankedHeadline extends NewsItem {
  score: number;
  corroboration: number; // distinct sources in the cluster
  groups: string[]; // matched keyword groups
  clusterSources: string[];
}

export interface MacroPoint {
  id: string;
  label: string;
  value: number | null;
  prev: number | null;
  date: string | null;
  unit: string;
  source: string;
}

export interface Signal {
  id: string;
  type: SignalType;
  severity: Severity;
  lat: number;
  lon: number;
  country: string | null; // ISO3
  region: string | null;
  time: number;
  title: string;
  source: string;
  url?: string;
  evidence: string[];
}

export type SignalType =
  | 'seismic'
  | 'natural'
  | 'wildfire'
  | 'conflict'
  | 'protest'
  | 'military_air'
  | 'news_spike'
  | 'convergence'
  | 'anomaly';

export interface CiiComponents {
  unrest: number;
  conflict: number;
  security: number;
  information: number;
}

export interface CiiScore {
  iso3: string;
  name: string;
  score: number; // 0..100 (rounded)
  band: CiiBand;
  baseline: number;
  event: number;
  components: CiiComponents;
  boosts: Record<string, number>;
  floor: number;
  floorReason: string | null;
  change24h: number | null;
  spark: number[]; // last ~30 days, daily samples
}

export type CiiBand = 'CRITICAL' | 'HIGH' | 'ELEVATED' | 'NORMAL' | 'LOW';

export interface ConvergenceCell {
  id: string;
  lat: number; // cell centre
  lon: number;
  types: string[];
  events: number;
  score: number;
  priority: 'critical' | 'high';
  label: string;
}

export interface KeywordSpike {
  term: string;
  count2h: number;
  baselinePer2h: number;
  ratio: number;
  sources: string[];
  firedAt: number;
  headlines: { title: string; link: string; source: string }[];
}

export interface Anomaly {
  key: string; // type|region|weekday
  type: string;
  region: string;
  value: number;
  mean: number;
  std: number;
  z: number;
  severity: Severity;
  samples: number;
}

export interface HeaderMetrics {
  threatLevel: 1 | 2 | 3 | 4 | 5;
  threatScore: number; // 0..100 underlying roll-up
  threatInputs: { topCountries: { iso3: string; score: number }[]; criticalSignals: number };
  sentiment: number | null; // 0..100, 50 neutral
  sentimentChange: number | null;
  sentimentSource: 'gdelt' | 'lexicon' | null;
  computedAt: number;
}

export interface ChokepointStatus {
  id: string;
  name: string;
  lat: number;
  lon: number;
  status: 'DISRUPTED' | 'ELEVATED' | 'NORMAL';
  signals: number;
  newsMentions: number;
  reasons: string[];
}

export interface TheatrePosture {
  id: string;
  name: string;
  level: 'CRITICAL' | 'ELEVATED' | 'NORMAL';
  aircraft: number;
  signals: number;
  topCountries: { iso3: string; score: number }[];
  summary: string;
}

export interface BriefCitation {
  n: number;
  title: string;
  source: string;
  link: string;
  time: number;
}

export interface AiBrief {
  paragraphs: string[];
  citations: BriefCitation[];
  generatedAt: number;
  model: string;
  provider: string;
  thinData: boolean;
}

export interface CountryBrief extends AiBrief {
  iso3: string;
  name: string;
}

export interface Forecast {
  title: string;
  region: string;
  category: string;
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
}

export interface ForecastSet {
  items: Forecast[];
  generatedAt: number;
  model: string;
  provider: string;
}

/* Static reference layers */

export interface Citation {
  url: string;
  title?: string;
}

export interface RefPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  country: string; // ISO3
  kind?: string;
  operator?: string;
  note?: string;
  status?: string;
  cite: Citation[];
}

export interface RefLine {
  id: string;
  name: string;
  /** Array of [lon, lat] waypoints */
  coords: [number, number][];
  kind?: string;
  note?: string;
  cite: Citation[];
}

export interface Hotspot {
  id: string;
  name: string;
  lat: number;
  lon: number;
  countries: string[];
  baseline: 1 | 2 | 3 | 4 | 5;
  summary: string;
}

export interface Chokepoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  radiusKm: number;
  keywords: string[];
  lanes: { name: string; from: [number, number]; to: [number, number] }[]; // [lat, lon]
  note: string;
}

export interface StaticDataset<T> {
  version: string;
  updated: string; // ISO date
  description: string;
  approximate: boolean;
  items: T[];
}

/* API shapes */

export interface MeResponse {
  uid: string;
  email: string | null;
  tier: Tier;
  checkoutUrl: string;
}

export interface BootstrapResponse {
  tier: 'fast' | 'slow';
  generatedAt: number;
  data: Record<string, unknown>;
  meta: Record<string, FeedMeta | null>;
  locked: string[];
}

export interface HealthFeed {
  id: string;
  label: string;
  status: FeedStatus;
  ageMin: number | null;
  maxStaleMin: number;
  recordCount: number;
  ok: boolean;
  error?: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  checkedAt: number;
  counts: Record<FeedStatus, number>;
  feeds?: HealthFeed[];
}
