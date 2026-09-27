// Macro indicators from FRED (St. Louis Fed). Only public-domain US government
// series are used — third-party copyrighted series (e.g. S&P, ICE, Cboe VIX,
// LBMA gold) need their owners' permission for commercial display.
import type { MacroPoint } from '../../../../shared/watchtower/types';
import { fetchJson } from '../fetch';
import type { SeedJob } from '../framework';

export const FRED_SERIES: { id: string; label: string; unit: string; source: string }[] = [
  { id: 'DFF', label: 'Fed funds (effective)', unit: '%', source: 'Board of Governors of the Federal Reserve' },
  { id: 'DGS2', label: 'US 2Y Treasury', unit: '%', source: 'Board of Governors of the Federal Reserve' },
  { id: 'DGS10', label: 'US 10Y Treasury', unit: '%', source: 'Board of Governors of the Federal Reserve' },
  { id: 'T10Y2Y', label: '10Y − 2Y spread', unit: ' pp', source: 'Federal Reserve Bank of St. Louis' },
  { id: 'DTWEXBGS', label: 'Broad US dollar index', unit: '', source: 'Board of Governors of the Federal Reserve' },
  { id: 'DCOILWTICO', label: 'WTI crude (spot)', unit: ' $/bbl', source: 'U.S. Energy Information Administration' },
  { id: 'UNRATE', label: 'US unemployment', unit: '%', source: 'U.S. Bureau of Labor Statistics' },
  { id: 'CPIAUCSL', label: 'US CPI (index)', unit: '', source: 'U.S. Bureau of Labor Statistics' },
];

export const fredJob: SeedJob<MacroPoint[]> = {
  id: 'fred',
  feed: 'macro',
  tier: 'daily',
  intervalMin: 60 * 20,
  requiresEnv: ['FRED_API_KEY'],
  async run() {
    const key = process.env.FRED_API_KEY!;
    const out: MacroPoint[] = [];
    for (const s of FRED_SERIES) {
      const r = await fetchJson<{ observations?: { date: string; value: string }[] }>(
        `https://api.stlouisfed.org/fred/series/observations?series_id=${s.id}&api_key=${key}&file_type=json&sort_order=desc&limit=6`,
        { timeoutMs: 12000 },
      );
      const obs = (r.observations ?? []).filter((o) => o.value !== '.' && isFinite(Number(o.value)));
      out.push({
        id: s.id,
        label: s.label,
        unit: s.unit,
        source: `FRED · ${s.source}`,
        value: obs[0] ? Number(obs[0].value) : null,
        prev: obs[1] ? Number(obs[1].value) : null,
        date: obs[0]?.date ?? null,
      });
    }
    return out;
  },
  validate: (d) => {
    const n = d.filter((p) => p.value !== null).length;
    return n === 0 ? { ok: false, count: 0, reason: 'no observations' } : { ok: true, count: n };
  },
};
