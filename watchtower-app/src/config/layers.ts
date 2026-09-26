// Layer registry — the one place that defines every map layer. The layer panel,
// ⌘K search, legend, tier gating and both renderers read from here.
// Count badges come from real record counts in the loaded data.
import { FEED_BY_ID, TIER_RANK } from '../../../shared/watchtower/feeds';
import type { Tier } from '../../../shared/watchtower/types';

export type Renderer = 'globe' | 'flat';
export type LayerCategory = 'live' | 'infra' | 'analysis';
export type Geometry = 'points' | 'paths' | 'arcs' | 'polygons';

export interface LayerDef {
  id: string;
  label: string;
  category: LayerCategory;
  color: string;
  shape: 'dot' | 'diamond' | 'square' | 'tri' | 'line' | 'area';
  renderers: Renderer[];
  defaultOn: boolean;
  /** Feed ids (shared/watchtower/feeds.ts) this layer draws from */
  dataKeys: string[];
  geometry: Geometry;
  description: string;
  /** Set when a layer is intentionally unavailable (e.g. licence pending) */
  disabledReason?: string;
  count: (get: (id: string) => unknown) => number | null;
}

const len = (v: unknown) => (Array.isArray(v) ? v.length : null);
const items = (v: unknown) => (v && typeof v === 'object' && Array.isArray((v as any).items) ? (v as any).items.length : null);
const sum = (...n: (number | null)[]) => (n.every((x) => x === null) ? null : n.reduce<number>((a, b) => a + (b ?? 0), 0));

export const LAYERS: LayerDef[] = [
  // ── LIVE EVENTS ──────────────────────────────────────────────
  { id: 'hotspots', label: 'Intel Hotspots', category: 'live', color: '#a78bfa', shape: 'diamond', renderers: ['globe', 'flat'], defaultOn: true, dataKeys: ['hotspots'], geometry: 'points', description: 'Curated watch areas with a baseline escalation level (1–5).', count: (g) => items(g('hotspots')) },
  { id: 'conflict', label: 'Conflict & Protest', category: 'live', color: '#f0526b', shape: 'dot', renderers: ['globe', 'flat'], defaultOn: true, dataKeys: ['conflict'], geometry: 'points', description: 'Geolocated conflict, coercion and protest events from GDELT, last 24h.', count: (g) => len(g('conflict')) },
  { id: 'seismic', label: 'Seismic', category: 'live', color: '#f59e42', shape: 'dot', renderers: ['globe', 'flat'], defaultOn: true, dataKeys: ['seismic'], geometry: 'points', description: 'USGS earthquakes M4.5+ in the past day plus significant events.', count: (g) => len(g('seismic')) },
  { id: 'natural', label: 'Natural Events', category: 'live', color: '#5ee3d4', shape: 'dot', renderers: ['globe', 'flat'], defaultOn: true, dataKeys: ['natural', 'disasters'], geometry: 'points', description: 'Open NASA EONET events and GDACS disaster alerts.', count: (g) => sum(len(g('natural')), len(g('disasters'))) },
  { id: 'wildfires', label: 'Wildfires', category: 'live', color: '#fb7c4a', shape: 'dot', renderers: ['globe', 'flat'], defaultOn: false, dataKeys: ['fires'], geometry: 'points', description: 'High-confidence VIIRS fire detections (NASA FIRMS), last 24h.', count: (g) => (g('fires') as any)?.points?.length ?? null },
  { id: 'aircraft', label: 'Military Aircraft', category: 'live', color: '#e9e6f2', shape: 'tri', renderers: ['globe', 'flat'], defaultOn: true, dataKeys: ['aircraft'], geometry: 'points', description: 'Aircraft flagged as military in the open adsb.lol network.', count: (g) => len(g('aircraft')) },
  { id: 'outages', label: 'Internet Outages', category: 'live', color: '#93c5fd', shape: 'dot', renderers: ['globe', 'flat'], defaultOn: false, dataKeys: [], geometry: 'points', description: 'Off until a commercially licensed outage source is in place.', disabledReason: 'Licence pending', count: () => null },
  { id: 'satellites', label: 'Satellites', category: 'live', color: '#c4b5fd', shape: 'square', renderers: ['globe', 'flat'], defaultOn: false, dataKeys: ['satellites'], geometry: 'points', description: 'Positions propagated in your browser from CelesTrak orbital elements.', count: (g) => (Array.isArray(g('satellites')) ? (g('satellites') as any[]).reduce((a, s) => a + s.tles.length, 0) : null) },

  // ── INFRASTRUCTURE ───────────────────────────────────────────
  { id: 'chokepoints', label: 'Chokepoints', category: 'infra', color: '#7dd3fc', shape: 'diamond', renderers: ['globe', 'flat'], defaultOn: true, dataKeys: ['chokepoints'], geometry: 'arcs', description: 'Nine maritime chokepoints with main shipping lanes.', count: (g) => items(g('chokepoints')) },
  { id: 'cables', label: 'Undersea Cables', category: 'infra', color: '#38bdf8', shape: 'line', renderers: ['globe', 'flat'], defaultOn: true, dataKeys: ['cables'], geometry: 'paths', description: 'Simplified routes of major submarine cable systems (approximate).', count: (g) => items(g('cables')) },
  { id: 'pipelines', label: 'Pipelines', category: 'infra', color: '#b8a36a', shape: 'line', renderers: ['globe', 'flat'], defaultOn: false, dataKeys: ['pipelines'], geometry: 'paths', description: 'Major oil and gas trunk pipelines (approximate routes).', count: (g) => items(g('pipelines')) },
  { id: 'datacenters', label: 'AI Data Centres', category: 'infra', color: '#93c5fd', shape: 'square', renderers: ['globe', 'flat'], defaultOn: false, dataKeys: ['datacenters'], geometry: 'points', description: 'Publicly announced large AI compute campuses.', count: (g) => items(g('datacenters')) },
  { id: 'spaceports', label: 'Spaceports', category: 'infra', color: '#c4b5fd', shape: 'diamond', renderers: ['globe', 'flat'], defaultOn: false, dataKeys: ['spaceports'], geometry: 'points', description: 'Orbital launch sites.', count: (g) => items(g('spaceports')) },
  { id: 'nuclear', label: 'Nuclear Sites', category: 'infra', color: '#fde68a', shape: 'dot', renderers: ['globe', 'flat'], defaultOn: false, dataKeys: ['nuclear'], geometry: 'points', description: 'Nuclear power plants and other publicly listed nuclear facilities.', count: (g) => items(g('nuclear')) },
  { id: 'bases', label: 'Military Bases', category: 'infra', color: '#a9a4b8', shape: 'square', renderers: ['globe', 'flat'], defaultOn: false, dataKeys: ['bases'], geometry: 'points', description: 'Major military installations from public sources, cited per entry.', count: (g) => items(g('bases')) },

  // ── ANALYSIS ─────────────────────────────────────────────────
  { id: 'cii', label: 'Instability Choropleth', category: 'analysis', color: '#f0788a', shape: 'area', renderers: ['globe', 'flat'], defaultOn: true, dataKeys: ['cii'], geometry: 'polygons', description: 'Country Instability Index shaded by band.', count: (g) => len(g('cii')) },
  { id: 'convergence', label: 'Convergence Cells', category: 'analysis', color: '#f5b36b', shape: 'square', renderers: ['globe', 'flat'], defaultOn: true, dataKeys: ['convergence'], geometry: 'points', description: '1°×1° cells where 3+ event types coincide in 24h.', count: (g) => len(g('convergence')) },
];

export const LAYER_BY_ID: Record<string, LayerDef> = Object.fromEntries(LAYERS.map((l) => [l.id, l]));

export const CATEGORY_LABEL: Record<LayerCategory, string> = {
  live: 'LIVE EVENTS',
  infra: 'INFRASTRUCTURE',
  analysis: 'ANALYSIS',
};

/** Minimum tier needed to see a layer = the strictest of its feeds. */
export function layerAccess(l: LayerDef): Tier {
  let t: Tier = 'free';
  for (const k of l.dataKeys) {
    const a = FEED_BY_ID[k]?.access ?? 'member';
    if (TIER_RANK[a] > TIER_RANK[t]) t = a;
  }
  return l.dataKeys.length ? t : 'member';
}

export const DEFAULT_LAYERS = LAYERS.filter((l) => l.defaultOn && !l.disabledReason).map((l) => l.id);
