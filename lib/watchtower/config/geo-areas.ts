// Regions (for signal clustering and anomaly baselines) and strategic theatres
// (for the Strategic Posture panel). Boxes are [minLat, minLon, maxLat, maxLon].

export type Box = [number, number, number, number];

export const REGIONS: { id: string; name: string; boxes: Box[] }[] = [
  { id: 'eeur', name: 'Eastern Europe', boxes: [[44, 22, 60, 45]] },
  { id: 'eur', name: 'Europe', boxes: [[35, -25, 72, 22], [60, 22, 72, 45]] },
  { id: 'mena', name: 'Middle East & North Africa', boxes: [[12, 34, 42, 63], [18, -17, 38, 34]] },
  { id: 'ssa', name: 'Sub-Saharan Africa', boxes: [[-35, -18, 18, 52]] },
  { id: 'casia', name: 'Central Asia & Caucasus', boxes: [[36, 45, 56, 88], [38, 38, 44, 50]] },
  { id: 'sasia', name: 'South Asia', boxes: [[5, 60, 36, 98]] },
  { id: 'easia', name: 'East Asia', boxes: [[20, 98, 55, 150]] },
  { id: 'seasia', name: 'Southeast Asia', boxes: [[-11, 92, 20, 142]] },
  { id: 'oce', name: 'Oceania & Pacific', boxes: [[-50, 110, -11, 180], [-50, -180, 30, -120], [-11, 142, 20, 180]] },
  { id: 'nam', name: 'North America', boxes: [[14, -170, 72, -50]] },
  { id: 'lam', name: 'Latin America & Caribbean', boxes: [[-56, -120, 14, -30], [14, -90, 24, -58]] },
  { id: 'arctic', name: 'Arctic', boxes: [[72, -180, 90, 180]] },
];

export const inBox = (lat: number, lon: number, [a, b, c, d]: Box) => lat >= a && lat <= c && lon >= b && lon <= d;

export function regionOf(lat: number, lon: number): string | null {
  for (const r of REGIONS) if (r.boxes.some((b) => inBox(lat, lon, b))) return r.name;
  return null;
}

export interface Theatre {
  id: string;
  name: string;
  box: Box;
  countries: string[];
}

export const THEATRES: Theatre[] = [
  { id: 'gulf', name: 'Iran / Gulf', box: [22, 46, 32, 62], countries: ['IRN', 'IRQ', 'SAU', 'ARE', 'QAT', 'BHR', 'KWT', 'OMN'] },
  { id: 'taiwan', name: 'Taiwan Strait', box: [20, 115, 28, 125], countries: ['TWN', 'CHN'] },
  { id: 'baltic', name: 'Baltic', box: [53, 9, 62, 31], countries: ['RUS', 'EST', 'LVA', 'LTU', 'POL', 'FIN', 'SWE'] },
  { id: 'blacksea', name: 'Black Sea', box: [40, 27, 47.8, 42], countries: ['UKR', 'RUS', 'TUR', 'ROU', 'BGR', 'GEO'] },
  { id: 'korea', name: 'Korean Peninsula', box: [33, 123, 43.5, 132], countries: ['PRK', 'KOR'] },
  { id: 'redsea', name: 'Red Sea', box: [10.5, 32, 28.5, 46], countries: ['YEM', 'SAU', 'ERI', 'DJI', 'SDN', 'EGY'] },
];
