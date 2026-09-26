// 2D map: MapLibre GL + deck.gl, lazy-loaded only when the user switches to 2D.
// The default basemap is drawn from Natural Earth country shapes (public domain)
// so there is no third-party tile dependency; set VITE_WT_BASEMAP=openfreemap to
// use OpenFreeMap vector tiles (free incl. commercial, © OpenStreetMap).
import * as maplibregl from 'maplibre-gl';
import type { Map as MlMap, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ArcLayer, GeoJsonLayer, PathLayer, ScatterplotLayer } from '@deck.gl/layers';
import type { View } from '../app/state';
import { loadCountryShapes, type CountryFeature } from '../lib/countries';
import { applyLod } from './lod';
import type { Area, MapRenderer, Marker, Scene } from './types';

const altToZoom = (alt: number) => Math.min(12, Math.max(0.3, Math.log2(4 / alt) + 0.3));
const zoomToAlt = (z: number) => 4 / 2 ** (z - 0.3);

function rgba(hex: string, a = 255): [number, number, number, number] {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  const alpha = hex.length > 7 ? parseInt(hex.slice(7, 9), 16) : a;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha];
}

/** Rings that jump across ±180° (e.g. Fiji) draw a line across the whole map in
 *  Web Mercator; shift their western half by +360° so the ring is continuous. */
function unwrapFeature(f: CountryFeature): CountryFeature {
  const fix = (ring: number[][]) => {
    const lons = ring.map((p) => p[0]);
    const lats = ring.map((p) => p[1]);
    if (Math.max(...lons) - Math.min(...lons) <= 180 || Math.min(...lats) < -60) return ring;
    return ring.map(([x, y]) => [x < 0 ? x + 360 : x, y]);
  };
  const g = f.geometry as any;
  if (g.type === 'Polygon') return { ...f, geometry: { ...g, coordinates: g.coordinates.map(fix) } };
  if (g.type === 'MultiPolygon') return { ...f, geometry: { ...g, coordinates: g.coordinates.map((p: number[][][]) => p.map(fix)) } };
  return f;
}

async function localStyle(): Promise<StyleSpecification> {
  const shapes = (await loadCountryShapes()).map(unwrapFeature);
  return {
    version: 8,
    sources: { countries: { type: 'geojson', data: { type: 'FeatureCollection', features: shapes } as any } },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#07060c' } },
      { id: 'land', type: 'fill', source: 'countries', paint: { 'fill-color': '#161422' } },
      { id: 'borders', type: 'line', source: 'countries', paint: { 'line-color': '#2e2944', 'line-width': 0.6 } },
    ],
  };
}

export class FlatRenderer implements MapRenderer {
  readonly kind = '2d' as const;
  private map!: MlMap;
  private overlay!: MapboxOverlay;
  private el!: HTMLElement;
  private scene: Scene = { markers: [], arcs: [], paths: [], areas: [], rings: [], totalPoints: 0 };
  private shapes: CountryFeature[] = [];
  private viewCbs: ((v: View) => void)[] = [];
  private clickCb: (m: Marker, x: number, y: number) => void = () => undefined;
  private areaCb: (iso3: string) => void = () => undefined;
  private drawn = 0;

  async mount(host: HTMLElement) {
    // MapLibre forces position:relative on its container, so give it a full-size child.
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;inset:0';
    host.appendChild(el);
    this.el = el;
    const useOfm = import.meta.env.VITE_WT_BASEMAP === 'openfreemap';
    this.shapes = (await loadCountryShapes()).map(unwrapFeature);
    this.map = new maplibregl.Map({
      container: el,
      style: useOfm ? 'https://tiles.openfreemap.org/styles/dark' : await localStyle(),
      center: [20, 22],
      zoom: 1.4,
      attributionControl: false,
      renderWorldCopies: true,
      dragRotate: false,
      pitchWithRotate: false,
    });
    this.overlay = new MapboxOverlay({ interleaved: false, layers: [] });
    this.map.addControl(this.overlay as any);
    this.map.on('moveend', () => {
      const v = this.getView();
      this.viewCbs.forEach((cb) => cb(v));
    });
    this.map.on('zoomend', () => this.draw());
    await new Promise<void>((r) => (this.map.loaded() ? r() : this.map.once('load', () => r())));
  }

  setScene(scene: Scene) {
    this.scene = scene;
    this.draw();
  }

  get renderedCount() {
    return this.drawn;
  }

  private draw() {
    if (!this.overlay) return;
    const markers = applyLod(this.scene.markers, this.getView().alt, 4000);
    this.drawn = markers.length;
    const byIso = new Map(this.scene.areas.map((a) => [a.iso3, a]));
    const areaFeatures = this.shapes.filter((f) => byIso.has(f.properties.iso3));
    this.overlay.setProps({
      layers: [
        new GeoJsonLayer({
          id: 'areas',
          data: areaFeatures as any,
          pickable: true,
          stroked: true,
          filled: true,
          getFillColor: (f: any) => rgba((byIso.get(f.properties.iso3) as Area).color, 80),
          getLineColor: (f: any) => rgba((byIso.get(f.properties.iso3) as Area).color, 170),
          lineWidthMinPixels: 1,
          onClick: (info: any) => info.object && this.areaCb(info.object.properties.iso3),
          updateTriggers: { getFillColor: [this.scene.areas], getLineColor: [this.scene.areas] },
        }),
        new PathLayer({
          id: 'paths',
          data: this.scene.paths,
          getPath: (d: any) => d.coords.map(([lat, lng]: [number, number]) => [lng, lat]),
          getColor: (d: any) => rgba(d.color, 170),
          getWidth: (d: any) => d.width * 3,
          widthUnits: 'pixels',
          widthMinPixels: 1,
          pickable: false,
        }),
        new ArcLayer({
          id: 'arcs',
          data: this.scene.arcs,
          getSourcePosition: (d: any) => [d.startLng, d.startLat],
          getTargetPosition: (d: any) => [d.endLng, d.endLat],
          getSourceColor: (d: any) => rgba(d.color, 200),
          getTargetColor: (d: any) => rgba(d.color, 60),
          getWidth: 1.5,
          greatCircle: true,
        }),
        new ScatterplotLayer({
          id: 'rings',
          data: this.scene.rings,
          getPosition: (d: any) => [d.lng, d.lat],
          getRadius: 14,
          radiusUnits: 'pixels',
          stroked: true,
          filled: false,
          getLineColor: (d: any) => rgba(d.color, 150),
          lineWidthMinPixels: 1.5,
        }),
        new ScatterplotLayer({
          id: 'markers',
          data: markers,
          pickable: true,
          getPosition: (d: Marker) => [d.lng, d.lat],
          getRadius: (d: Marker) => d.size / 2,
          radiusUnits: 'pixels',
          getFillColor: (d: Marker) => rgba(d.color, d.count ? 220 : 255),
          stroked: true,
          getLineColor: [11, 10, 16, 200],
          lineWidthMinPixels: 1,
          onClick: (info: any) => info.object && this.clickCb(info.object as Marker, info.x, info.y),
        }),
      ],
    });
  }

  flyTo(v: Partial<View>, ms = 1200) {
    const cur = this.getView();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.map.flyTo({ center: [v.lng ?? cur.lng, v.lat ?? cur.lat], zoom: altToZoom(v.alt ?? cur.alt), duration: reduced ? 0 : ms, essential: true });
  }

  zoomBy(factor: number) {
    this.map.zoomTo(this.map.getZoom() - Math.log2(factor), { duration: 300 });
  }

  getView(): View {
    const c = this.map.getCenter();
    return { lat: c.lat, lng: c.lng, alt: zoomToAlt(this.map.getZoom()) };
  }

  project(lat: number, lng: number) {
    const p = this.map.project([lng, lat]);
    return p.x >= 0 && p.y >= 0 && p.x <= this.el.clientWidth && p.y <= this.el.clientHeight ? { x: p.x, y: p.y } : null;
  }

  onViewChange(cb: (v: View) => void) {
    this.viewCbs.push(cb);
  }
  onMarkerClick(cb: (m: Marker, x: number, y: number) => void) {
    this.clickCb = cb;
  }
  onAreaClick(cb: (iso3: string) => void) {
    this.areaCb = cb;
  }
  resize() {
    this.map?.resize();
  }
  destroy() {
    this.overlay?.finalize();
    this.map?.remove();
    this.el.remove();
  }
}
