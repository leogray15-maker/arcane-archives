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

/** Country name at a point (for the VIEW chip), or null over open water. */
export async function countryAt(lat: number, lng: number): Promise<string | null> {
  const shapes = await loadCountryShapes();
  return shapes.find((f) => featureContains(f, lng, lat))?.properties.name ?? null;
}
