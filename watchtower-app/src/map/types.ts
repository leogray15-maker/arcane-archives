// Renderer-neutral scene. The globe (globe.gl) and flat map (MapLibre + deck.gl)
// both draw from this, built once from app state + the layer registry.
import type { View } from '../app/state';

export type MarkerShape = 'dot' | 'diamond' | 'square' | 'tri';

export interface Marker {
  id: string;
  /** Layer id (the `kind` discriminator for the merged marker array) */
  kind: string;
  lat: number;
  lng: number;
  color: string;
  size: number; // px
  shape: MarkerShape;
  /** 0–100, higher survives level-of-detail culling */
  priority: number;
  title: string;
  label: string; // category label for the popover
  meta: string[];
  source: string;
  time?: number;
  url?: string;
  country?: string | null;
  rotation?: number;
  /** Cluster size when this marker represents several */
  count?: number;
}

export interface Arc {
  id: string;
  kind: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
  label: string;
}

export interface PathLine {
  id: string;
  kind: string;
  /** [lat, lng] */
  coords: [number, number][];
  color: string;
  width: number;
  label: string;
  dashed?: boolean;
}

export interface Area {
  iso3: string;
  color: string;
  label: string;
  score: number;
}

export interface Ring {
  id: string;
  lat: number;
  lng: number;
  color: string;
  maxRadius: number; // degrees
}

export interface Scene {
  markers: Marker[];
  arcs: Arc[];
  paths: PathLine[];
  areas: Area[];
  rings: Ring[];
  totalPoints: number;
}

export interface MapRenderer {
  readonly kind: '3d' | '2d';
  mount(el: HTMLElement): Promise<void>;
  setScene(scene: Scene): void;
  flyTo(v: Partial<View>, ms?: number): void;
  zoomBy(factor: number): void;
  getView(): View;
  /** Screen position of a lat/lng inside the map element, or null if hidden */
  project(lat: number, lng: number): { x: number; y: number } | null;
  onViewChange(cb: (v: View) => void): void;
  onMarkerClick(cb: (m: Marker, x: number, y: number) => void): void;
  onAreaClick(cb: (iso3: string) => void): void;
  resize(): void;
  destroy(): void;
}
