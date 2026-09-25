// 3D globe (globe.gl / Three.js). All point markers go through ONE html-elements
// array with a `kind` discriminator; arcs, paths, polygons and rings use
// globe.gl's WebGL layers. Level of detail is applied by altitude.
import type { GlobeInstance } from 'globe.gl';
import type { View } from '../app/state';
import { debounce, prefersReducedMotion } from '../lib/dom';
import { loadCountryShapes, type CountryFeature } from '../lib/countries';
import { applyLod } from './lod';
import { starfieldDataUrl } from './stars';
import type { Area, MapRenderer, Marker, Ring, Scene } from './types';

const TEX_2K = `${import.meta.env.BASE_URL}textures/earth-blue-marble-2k.jpg`;
const TEX_4K = `${import.meta.env.BASE_URL}textures/earth-blue-marble-4k.jpg`;
const IDLE_RESUME_MS = 60_000;

export class GlobeRenderer implements MapRenderer {
  readonly kind = '3d' as const;
  private g!: GlobeInstance;
  private el!: HTMLElement;
  private scene: Scene = { markers: [], arcs: [], paths: [], areas: [], rings: [], totalPoints: 0 };
  private elCache = new Map<string, HTMLElement>();
  private shapes: CountryFeature[] = [];
  private viewCbs: ((v: View) => void)[] = [];
  private clickCb: (m: Marker, x: number, y: number) => void = () => undefined;
  private areaCb: (iso3: string) => void = () => undefined;
  private idleTimer: number | null = null;
  private lastAlt = 2.4;
  private ro: ResizeObserver | null = null;
  private reduced = prefersReducedMotion();

  async mount(el: HTMLElement) {
    this.el = el;
    const { default: Globe } = await import('globe.gl');
    const g = new Globe(el, { animateIn: false, rendererConfig: { antialias: true, powerPreference: 'high-performance', alpha: false } });
    this.g = g;
    g.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    g.backgroundColor('#05040a')
      .backgroundImageUrl(starfieldDataUrl())
      .globeImageUrl(TEX_2K)
      .showAtmosphere(true)
      .atmosphereColor('#8b7cf6')
      .atmosphereAltitude(0.2)
      .showGraticules(false);

    // Swap in the 4K texture after first paint on large/high-DPI screens.
    if ((window.devicePixelRatio || 1) > 1.4 && el.clientWidth > 700) {
      window.setTimeout(() => {
        const img = new Image();
        img.onload = () => g.globeImageUrl(TEX_4K);
        img.src = TEX_4K;
      }, 4000);
    }

    g.htmlElementsData([])
      .htmlLat('lat')
      .htmlLng('lng')
      .htmlAltitude(0.004)
      .htmlTransitionDuration(0)
      .htmlElement((d: object) => this.markerEl(d as Marker));

    g.arcsData([])
      .arcStartLat('startLat').arcStartLng('startLng').arcEndLat('endLat').arcEndLng('endLng')
      .arcColor((d: any) => [`${d.color}cc`, `${d.color}33`])
      .arcStroke(0.35)
      .arcAltitudeAutoScale(0.25)
      .arcDashLength(0.35)
      .arcDashGap(0.12)
      .arcDashAnimateTime(this.reduced ? 0 : 5000)
      .arcLabel('label');

    g.pathsData([])
      .pathPoints('coords')
      .pathPointLat((p: any) => p[0])
      .pathPointLng((p: any) => p[1])
      .pathColor((d: any) => d.color)
      .pathStroke((d: any) => d.width)
      .pathDashLength((d: any) => (d.dashed ? 0.02 : 1))
      .pathDashGap((d: any) => (d.dashed ? 0.01 : 0))
      .pathTransitionDuration(0)
      .pathLabel('label');

    g.polygonsData([])
      .polygonGeoJsonGeometry((f: any) => f.geometry)
      .polygonCapColor((f: any) => `${(f.__area as Area).color}55`)
      .polygonSideColor(() => 'rgba(0,0,0,0)')
      .polygonStrokeColor((f: any) => `${(f.__area as Area).color}aa`)
      .polygonAltitude(0.004)
      .polygonsTransitionDuration(0)
      .polygonLabel((f: any) => (f.__area as Area).label)
      .onPolygonClick((f: any) => this.areaCb((f.__area as Area).iso3));

    g.ringsData([])
      .ringLat('lat').ringLng('lng')
      .ringColor((r: any) => (t: number) => hexA((r as Ring).color, 1 - t))
      .ringMaxRadius('maxRadius')
      .ringPropagationSpeed(1.6)
      .ringRepeatPeriod(1600)
      .ringAltitude(0.003);

    const controls = g.controls() as any;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 101 + 12;
    controls.maxDistance = 100 * 7;
    controls.autoRotate = !this.reduced;
    controls.autoRotateSpeed = 0.35;
    controls.addEventListener('start', () => this.pauseRotate());
    el.addEventListener('wheel', () => this.pauseRotate(), { passive: true });

    const emitView = debounce(() => {
      const v = this.getView();
      this.viewCbs.forEach((cb) => cb(v));
    }, 250);
    g.onZoom(() => {
      const alt = this.getView().alt;
      if (Math.abs(alt - this.lastAlt) / this.lastAlt > 0.15) {
        this.lastAlt = alt;
        this.flushMarkers();
      }
      emitView();
    });

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(el);
    this.resize();

    loadCountryShapes().then((s) => {
      this.shapes = s;
      this.flushAreas();
    });
  }

  private pauseRotate() {
    if (this.reduced) return;
    const controls = this.g.controls() as any;
    controls.autoRotate = false;
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => (controls.autoRotate = true), IDLE_RESUME_MS);
  }

  private markerEl(m: Marker): HTMLElement {
    const key = `${m.id}|${m.color}|${m.size}|${m.count ?? 1}|${m.rotation ?? ''}`;
    const cached = this.elCache.get(key);
    if (cached) return cached;
    const el = document.createElement('div');
    el.className = `wt-mk ${m.shape} ${m.count ? 'cluster' : ''}`;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `${m.label}: ${m.title}`);
    el.style.pointerEvents = 'auto';
    el.style.color = m.color;
    const core = document.createElement('span');
    core.className = 'core';
    const s = m.count ? m.size : m.size;
    core.style.width = `${s}px`;
    core.style.height = `${s}px`;
    core.style.background = m.count ? `${m.color}dd` : m.color;
    if (m.shape === 'tri' && m.rotation !== undefined) core.style.transform = `rotate(${m.rotation - 90}deg)`;
    if (m.count) core.textContent = m.count > 999 ? `${Math.round(m.count / 1000)}k` : String(m.count);
    el.appendChild(core);
    const fire = (e: Event) => {
      e.stopPropagation();
      const r = el.getBoundingClientRect();
      const host = this.el.getBoundingClientRect();
      this.clickCb(m, r.left + r.width / 2 - host.left, r.top + r.height / 2 - host.top);
    };
    el.addEventListener('click', fire);
    el.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && fire(e));
    if (this.elCache.size > 4000) this.elCache.clear();
    this.elCache.set(key, el);
    return el;
  }

  setScene(scene: Scene) {
    this.scene = scene;
    if (!this.g) return;
    this.flushMarkers();
    this.g.arcsData(scene.arcs);
    this.g.pathsData(scene.paths);
    this.g.ringsData(this.reduced ? [] : scene.rings);
    this.flushAreas();
  }

  get renderedCount() {
    return (this.g?.htmlElementsData() as unknown[] | undefined)?.length ?? 0;
  }

  private flushMarkers() {
    if (!this.g) return;
    this.g.htmlElementsData(applyLod(this.scene.markers, this.getView().alt));
  }

  private flushAreas() {
    if (!this.g) return;
    const byIso = new Map(this.scene.areas.map((a) => [a.iso3, a]));
    const feats = this.shapes.filter((f) => byIso.has(f.properties.iso3)).map((f) => ({ ...f, __area: byIso.get(f.properties.iso3) }));
    this.g.polygonsData(feats);
  }

  flyTo(v: Partial<View>, ms = 1200) {
    this.pauseRotate();
    const cur = this.getView();
    this.g.pointOfView({ lat: v.lat ?? cur.lat, lng: v.lng ?? cur.lng, altitude: v.alt ?? cur.alt }, this.reduced ? 0 : ms);
  }

  zoomBy(factor: number) {
    const v = this.getView();
    this.flyTo({ alt: Math.min(6, Math.max(0.15, v.alt * factor)) }, 400);
  }

  getView(): View {
    const p = this.g.pointOfView();
    return { lat: p.lat, lng: p.lng, alt: p.altitude };
  }

  project(lat: number, lng: number) {
    const c = this.g.getScreenCoords(lat, lng, 0.004) as { x: number; y: number } | null;
    return c && isFinite(c.x) ? c : null;
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
    if (!this.g || !this.el) return;
    this.g.width(this.el.clientWidth).height(this.el.clientHeight);
  }

  destroy() {
    this.ro?.disconnect();
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    (this.g as any)?._destructor?.();
    this.el.innerHTML = '';
    this.elCache.clear();
  }
}

function hexA(hex: string, a: number) {
  const h = hex.replace('#', '').slice(0, 6);
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, a).toFixed(2)})`;
}
