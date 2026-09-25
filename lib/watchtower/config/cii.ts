// Country Instability Index configuration — edit freely. See METHODOLOGY.md.
//
// baseline: structural risk 0–100 (our editorial judgement of long-run
//   conditions: governance, recent conflict history, economic fragility).
// multiplier: dampens event scores in countries with very heavy media
//   coverage, so volume of reporting alone doesn't make a stable country
//   look unstable (1 = neutral, <1 = dampened).
// floor/floorReason: the score never drops below this during data gaps
//   (active wars, do-not-travel advisories).
// Review baselines and floors monthly (RUNBOOK.md).

export interface CiiCountry {
  iso3: string;
  name: string;
  baseline: number;
  multiplier: number;
  floor?: number;
  floorReason?: string;
}

export const CII_WEIGHTS = {
  event: { unrest: 0.25, conflict: 0.3, security: 0.2, information: 0.25 },
  combine: { baseline: 0.4, event: 0.6 },
  boostCaps: { quakes: 20, disasters: 12, fires: 6, outages: 8, newsUrgency: 5 },
  /** UCDP-derived floors (two-year window) */
  ucdpFloors: { war: 70, minor: 50 },
  bands: { critical: 81, high: 66, elevated: 51, normal: 31 },
} as const;

export const CII_COUNTRIES: CiiCountry[] = [
  { iso3: 'UKR', name: 'Ukraine', baseline: 72, multiplier: 0.85, floor: 70, floorReason: 'Active war (full-scale invasion)' },
  { iso3: 'RUS', name: 'Russia', baseline: 58, multiplier: 0.8, floor: 55, floorReason: 'Party to an active war; do-not-travel advisories' },
  { iso3: 'PSE', name: 'Palestine (Gaza & West Bank)', baseline: 78, multiplier: 0.85, floor: 75, floorReason: 'Active war in Gaza' },
  { iso3: 'ISR', name: 'Israel', baseline: 52, multiplier: 0.75, floor: 50, floorReason: 'Party to active conflicts' },
  { iso3: 'SDN', name: 'Sudan', baseline: 78, multiplier: 1.1, floor: 75, floorReason: 'Active civil war' },
  { iso3: 'SSD', name: 'South Sudan', baseline: 68, multiplier: 1.1, floor: 60, floorReason: 'Do-not-travel advisories; armed violence' },
  { iso3: 'YEM', name: 'Yemen', baseline: 74, multiplier: 1.05, floor: 70, floorReason: 'Active war; do-not-travel advisories' },
  { iso3: 'SYR', name: 'Syria', baseline: 70, multiplier: 1.0, floor: 60, floorReason: 'Do-not-travel advisories; ongoing armed violence' },
  { iso3: 'LBN', name: 'Lebanon', baseline: 58, multiplier: 1.0, floor: 50, floorReason: 'Reconsider-travel advisories' },
  { iso3: 'IRQ', name: 'Iraq', baseline: 55, multiplier: 1.0, floor: 50, floorReason: 'Do-not-travel advisories' },
  { iso3: 'IRN', name: 'Iran', baseline: 58, multiplier: 0.9, floor: 55, floorReason: 'Do-not-travel advisories' },
  { iso3: 'AFG', name: 'Afghanistan', baseline: 70, multiplier: 1.1, floor: 60, floorReason: 'Do-not-travel advisories' },
  { iso3: 'PAK', name: 'Pakistan', baseline: 55, multiplier: 1.0 },
  { iso3: 'IND', name: 'India', baseline: 35, multiplier: 0.7 },
  { iso3: 'MMR', name: 'Myanmar', baseline: 70, multiplier: 1.1, floor: 65, floorReason: 'Active civil war' },
  { iso3: 'CHN', name: 'China', baseline: 38, multiplier: 0.7 },
  { iso3: 'TWN', name: 'Taiwan', baseline: 32, multiplier: 0.9 },
  { iso3: 'PRK', name: 'North Korea', baseline: 60, multiplier: 1.2, floor: 55, floorReason: 'Do-not-travel advisories' },
  { iso3: 'KOR', name: 'South Korea', baseline: 25, multiplier: 0.9 },
  { iso3: 'COD', name: 'DR Congo', baseline: 70, multiplier: 1.15, floor: 65, floorReason: 'Active armed conflict in the east' },
  { iso3: 'ETH', name: 'Ethiopia', baseline: 58, multiplier: 1.1 },
  { iso3: 'SOM', name: 'Somalia', baseline: 70, multiplier: 1.15, floor: 60, floorReason: 'Do-not-travel advisories; insurgency' },
  { iso3: 'MLI', name: 'Mali', baseline: 65, multiplier: 1.15, floor: 60, floorReason: 'Do-not-travel advisories; insurgency' },
  { iso3: 'BFA', name: 'Burkina Faso', baseline: 65, multiplier: 1.15, floor: 60, floorReason: 'Do-not-travel advisories; insurgency' },
  { iso3: 'NER', name: 'Niger', baseline: 60, multiplier: 1.15, floor: 55, floorReason: 'Do-not-travel advisories' },
  { iso3: 'NGA', name: 'Nigeria', baseline: 52, multiplier: 1.0 },
  { iso3: 'LBY', name: 'Libya', baseline: 60, multiplier: 1.1, floor: 55, floorReason: 'Do-not-travel advisories' },
  { iso3: 'HTI', name: 'Haiti', baseline: 68, multiplier: 1.15, floor: 60, floorReason: 'Do-not-travel advisories; gang control of capital' },
  { iso3: 'VEN', name: 'Venezuela', baseline: 58, multiplier: 1.05, floor: 50, floorReason: 'Do-not-travel advisories' },
  { iso3: 'MEX', name: 'Mexico', baseline: 42, multiplier: 0.9 },
  { iso3: 'COL', name: 'Colombia', baseline: 42, multiplier: 1.0 },
  { iso3: 'TUR', name: 'Türkiye', baseline: 38, multiplier: 0.9 },
  { iso3: 'EGY', name: 'Egypt', baseline: 40, multiplier: 1.0 },
  { iso3: 'SAU', name: 'Saudi Arabia', baseline: 32, multiplier: 1.0 },
  { iso3: 'USA', name: 'United States', baseline: 22, multiplier: 0.5 },
];

export function band(score: number) {
  const b = CII_WEIGHTS.bands;
  return score >= b.critical ? 'CRITICAL' : score >= b.high ? 'HIGH' : score >= b.elevated ? 'ELEVATED' : score >= b.normal ? 'NORMAL' : 'LOW';
}
