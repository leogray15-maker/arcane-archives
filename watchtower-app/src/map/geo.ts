import { loadCountryShapes, type CountryFeature } from '../lib/countries';

type Ring = number[][];

function inRing(lng: number, lat: number, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function featureContains(f: CountryFeature, lng: number, lat: number) {
  const g = f.geometry as any;
  const polys: Ring[][] = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  return polys.some((p) => inRing(lng, lat, p[0]) && !p.slice(1).some((hole) => inRing(lng, lat, hole)));
}

/** Country name at a point (for the VIEW chip), or null over open water.
 *  Uses UN-recognised borders: the bundled Natural Earth build places Crimea
 *  inside Russia's polygon, so that area is corrected (same rule as the server). */
export async function countryAt(lat: number, lng: number): Promise<string | null> {
  if (lat >= 31.22 && lat <= 31.6 && lng >= 34.2 && lng <= 34.57) return 'Gaza Strip';
  const shapes = await loadCountryShapes();
  const f = shapes.find((s) => featureContains(s, lng, lat));
  if (f?.properties.iso3 === 'RUS' && lat >= 44.3 && lat <= 46.25 && lng >= 32.4 && lng <= 36.7) return 'Ukraine';
  return f?.properties.name ?? null;
}
