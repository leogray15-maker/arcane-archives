// Server-side country lookup: point-in-country (Natural Earth 110m via world-atlas,
// public domain) and ISO code/name helpers (i18n-iso-countries, MIT).
import countries from 'i18n-iso-countries';
import { feature } from 'topojson-client';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const en = require('i18n-iso-countries/langs/en.json');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const topo = require('world-atlas/countries-110m.json');

countries.registerLocale(en);

type Ring = [number, number][];
interface Shape {
  iso3: string;
  polys: Ring[][];
  bbox: [number, number, number, number]; // minLon, minLat, maxLon, maxLat
}

let shapes: Shape[] | null = null;

function load(): Shape[] {
  if (shapes) return shapes;
  const fc = feature(topo, topo.objects.countries) as any;
  shapes = [];
  for (const f of fc.features) {
    const iso3 = countries.numericToAlpha3(String(f.id).padStart(3, '0')) ?? (f.properties?.name === 'Kosovo' ? 'XKX' : null);
    if (!iso3) continue;
    const g = f.geometry;
    const polys: Ring[][] = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    let minX = 180, minY = 90, maxX = -180, maxY = -90;
    for (const p of polys) for (const [x, y] of p[0]) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    shapes.push({ iso3, polys, bbox: [minX, minY, maxX, maxY] });
  }
  return shapes;
}

function inRing(lon: number, lat: number, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function exact(lat: number, lon: number): string | null {
  for (const s of load()) {
    const [a, b, c, d] = s.bbox;
    if (lon < a || lon > c || lat < b || lat > d) continue;
    for (const p of s.polys) if (inRing(lon, lat, p[0]) && !p.slice(1).some((h) => inRing(lon, lat, h))) return s.iso3;
  }
  return null;
}

const OFFSETS: [number, number][] = [];
for (const r of [0.35, 0.8, 1.4]) for (let k = 0; k < 8; k++) OFFSETS.push([r * Math.cos((k * Math.PI) / 4), r * Math.sin((k * Math.PI) / 4)]);

// Attribution follows internationally recognised (UN) borders. The bundled
// Natural Earth build draws some occupied/annexed areas inside another
// country's polygon, so those areas are corrected here.
const RECOGNITION_OVERRIDES: { name: string; box: [number, number, number, number]; from: string; to: string }[] = [
  // Crimea (annexed by Russia in 2014; recognised by the UN General Assembly as Ukraine)
  { name: 'Crimea', box: [44.3, 32.4, 46.25, 36.7], from: 'RUS', to: 'UKR' },
];

function recognised(iso: string | null, lat: number, lon: number): string | null {
  for (const o of RECOGNITION_OVERRIDES) {
    const [a, b, c, d] = o.box;
    if (iso === o.from && lat >= a && lat <= c && lon >= b && lon <= d) return o.to;
  }
  return iso;
}

/** ISO3 of the country containing the point. The 110m shapes are coarse, so
 *  coastal/island points that fall just offshore are snapped to land within ~1.5°. */
export function countryAt(lat: number, lon: number): string | null {
  const hit = exact(lat, lon);
  if (hit) return recognised(hit, lat, lon);
  for (const [dy, dx] of OFFSETS) {
    const h = exact(lat + dy, lon + dx);
    if (h) return recognised(h, lat, lon);
  }
  return null;
}

export const iso3Name = (iso3: string): string =>
  countries.getName(iso3, 'en', { select: 'alias' }) ?? countries.getName(iso3, 'en') ?? iso3;

export const iso2to3 = (iso2: string) => countries.alpha2ToAlpha3(iso2.toUpperCase()) ?? null;

export function allIso3(): string[] {
  return Object.keys(countries.getAlpha3Codes());
}

export function countryNames(iso3: string): string[] {
  const n = countries.getName(iso3, 'en', { select: 'all' });
  return Array.isArray(n) ? n : n ? [n] : [];
}
