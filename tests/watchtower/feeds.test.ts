import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { FEED_BY_ID } from '../../shared/watchtower/feeds';
import type { Aircraft, ConflictEvent, FireSummary, MacroPoint, NaturalEvent, NewsItem, SatGroup } from '../../shared/watchtower/types';
import { runSeed } from '../../lib/watchtower/seed/framework';
import { adsbJob } from '../../lib/watchtower/seed/jobs/adsb';
import { celestrakJob, parseTle } from '../../lib/watchtower/seed/jobs/celestrak';
import { firmsJob } from '../../lib/watchtower/seed/jobs/firms';
import { fredJob } from '../../lib/watchtower/seed/jobs/fred';
import { gdeltEventsJob, gdeltToneJob, mergeWindow, type ToneSummary } from '../../lib/watchtower/seed/jobs/gdelt';
import { eonetJob, gdacsJob } from '../../lib/watchtower/seed/jobs/natural';
import { canonicalLink, rssJob } from '../../lib/watchtower/seed/jobs/rss';
import { ucdpJob, type UcdpSummary } from '../../lib/watchtower/seed/jobs/ucdp';
import { MemoryStore } from '../../lib/watchtower/store';
import { installFixtureFetch } from '../../lib/watchtower/dev/fixture-fetch';
import { countryAt } from '../../lib/watchtower/geo/countries';
import { geotag } from '../../lib/watchtower/text/geotag';

const FIX = join(__dirname, 'fixtures');
let store: MemoryStore;
let restore: () => void;
const get = <T>(feed: string) => store.get<T>(FEED_BY_ID[feed].redisKey);

beforeEach(() => {
  store = new MemoryStore();
  restore = installFixtureFetch(FIX);
  for (const k of ['NASA_FIRMS_MAP_KEY', 'UCDP_ACCESS_TOKEN', 'FRED_API_KEY']) process.env[k] = 'test';
});
afterEach(() => restore());

describe('geo helpers', () => {
  it('finds countries, snapping coastal points to land', () => {
    expect(countryAt(50.45, 30.52)).toBe('UKR');
    expect(countryAt(48.86, 2.35)).toBe('FRA');
    expect(countryAt(31.5, 34.47)).toMatch(/PSE|ISR/); // Gaza, coarse shapes
    expect(countryAt(0, -30)).toBeNull(); // mid-Atlantic
  });
  it('geo-tags headlines by name, demonym and place without double counting', () => {
    expect(geotag('Ukrainian drones hit Russian refinery near Moscow')).toEqual(expect.arrayContaining(['UKR', 'RUS']));
    expect(geotag('South Sudan and Sudan agree border talks').sort()).toEqual(['SDN', 'SSD']);
    expect(geotag('Chad Smith wins tennis final')).toEqual([]);
  });
});

describe('feed jobs against fixtures', () => {
  it('EONET: takes the latest geometry and polygon centroids', async () => {
    expect((await runSeed(eonetJob, store)).outcome).toBe('ok');
    const ev = (await get<NaturalEvent[]>('natural'))!;
    expect(ev).toHaveLength(3);
    const storm = ev.find((e) => e.id === 'EONET_FX1')!;
    expect(storm).toMatchObject({ lat: 19.0, lon: 127.9, category: 'Severe Storms', source: 'EONET' });
    expect(ev.find((e) => e.id === 'EONET_FX3')!.lat).toBeCloseTo(55.4, 1);
  });

  it('GDACS: orange/red alerts with country codes', async () => {
    expect((await runSeed(gdacsJob, store)).outcome).toBe('ok');
    const ev = (await get<NaturalEvent[]>('disasters'))!;
    expect(ev.map((e) => e.alertLevel).sort()).toEqual(['Orange', 'Red']);
    expect(ev.find((e) => e.alertLevel === 'Red')).toMatchObject({ country: 'BGD', category: 'Flood' });
  });

  it('FIRMS: keeps high-confidence detections and counts them per country', async () => {
    expect((await runSeed(firmsJob, store)).outcome).toBe('ok');
    const f = (await get<FireSummary>('fires'))!;
    expect(f.total).toBeGreaterThan(40);
    expect(f.points.length).toBe(f.total);
    expect(f.points[0][2]).toBeGreaterThanOrEqual(f.points[f.points.length - 1][2]); // sorted by FRP
    expect(f.byCountry.BRA).toBeGreaterThan(0);
  });

  it('GDELT events: filters to geolocated conflict/protest events and attributes countries', async () => {
    expect((await runSeed(gdeltEventsJob, store)).outcome).toBe('ok');
    const ev = (await get<ConflictEvent[]>('conflict'))!;
    const ids = ev.map((e) => e.id);
    expect(ids).toContain('1');
    expect(ids).not.toContain('15'); // too few mentions
    expect(ids).not.toContain('16'); // country-level geo
    expect(ids).not.toContain('17'); // not a conflict code
    expect(ev.find((e) => e.id === '1')).toMatchObject({ kind: 'military', country: 'UKR' });
    expect(ev.find((e) => e.id === '5')).toMatchObject({ kind: 'protest', country: 'IRN' });
  });

  it('GDELT window drops events older than 24h and merges duplicates', () => {
    const now = Date.now();
    const base: ConflictEvent = { id: 'a', lat: 1, lon: 1, time: now - 1000, kind: 'protest', country: null, mentions: 5, tone: 0, goldstein: 0, url: '', place: '' };
    const merged = mergeWindow([{ ...base, id: 'old', time: now - 25 * 3600e3 }, base], [{ ...base, id: 'b', mentions: 9 }], now);
    expect(merged).toHaveLength(1);
    expect(merged[0].mentions).toBe(9);
  });

  it('GDELT tone: averages the last 24h against the 24h before', async () => {
    expect((await runSeed(gdeltToneJob, store)).outcome).toBe('ok');
    const t = (await get<ToneSummary>('tone'))!;
    expect(t.avg24!).toBeLessThan(t.prev24!);
  });

  it('adsb.lol: drops stale and position-less aircraft', async () => {
    expect((await runSeed(adsbJob, store)).outcome).toBe('ok');
    const ac = (await get<Aircraft[]>('aircraft'))!;
    expect(ac.map((a) => a.hex)).toEqual(['ae1234', '43c6f1', 'ae5678', 'ae9abc', 'ae0ff0']);
    expect(ac[0]).toMatchObject({ callsign: 'RCH123', type: 'C17', altFt: 31000 });
  });

  it('CelesTrak: parses 3-line TLE groups', async () => {
    expect((await runSeed(celestrakJob, store)).outcome).toBe('ok');
    const g = (await get<SatGroup[]>('satellites'))!;
    expect(g.find((x) => x.group === 'stations')!.tles[0][0]).toBe('ISS (ZARYA)');
    expect(g.reduce((a, x) => a + x.tles.length, 0)).toBe(2 + 8 + 12 + 6 + 10);
    expect(parseTle('junk\n1 x\n', 10)).toEqual([]);
  });

  it('RSS: parses RSS 2.0, RDF and Atom; strips tracking params; geo-tags; never stores body text', async () => {
    const r = await runSeed(rssJob, store);
    expect(r.outcome).toBe('ok');
    const n = (await get<NewsItem[]>('news'))!;
    expect(new Set(n.map((x) => x.source))).toEqual(new Set(['BBC World', 'Guardian World', 'DW', 'Al Jazeera', 'Bellingcat']));
    expect(n.every((x) => !x.link.includes('utm_'))).toBe(true);
    expect(JSON.stringify(n)).not.toContain('ignored body text');
    const kharkiv = n.find((x) => x.title.includes('Kharkiv energy site'))!;
    expect(kharkiv.countries).toEqual(expect.arrayContaining(['UKR', 'RUS']));
    expect(n.find((x) => x.source === 'Al Jazeera')!.ownership).toBe('state');
    expect(canonicalLink('https://a.com/x/?utm_source=y#top')).toBe('https://a.com/x');
  });

  it('FRED: latest and previous observations', async () => {
    expect((await runSeed(fredJob, store)).outcome).toBe('ok');
    const m = (await get<MacroPoint[]>('macro'))!;
    expect(m.find((p) => p.id === 'DGS10')).toMatchObject({ value: 4.12, prev: 4.08 });
  });

  it('UCDP: aggregates events and deaths per country', async () => {
    expect((await runSeed(ucdpJob, store)).outcome).toBe('ok');
    const u = (await get<UcdpSummary>('ucdp'))!;
    expect(u.byCountry.UKR.events).toBe(2);
    expect(u.byCountry.SDN.deaths).toBe(85);
  });
});

describe('static datasets', () => {
  it('every entry has coordinates, a country code and at least one citation', async () => {
    const { getStatic } = await import('../../lib/watchtower/static-data');
    await import('../../lib/watchtower/static-register');
    for (const id of ['bases', 'nuclear', 'spaceports', 'datacenters']) {
      const s = getStatic(id)!;
      expect(s.data.items.length).toBeGreaterThan(5);
      for (const p of s.data.items as any[]) {
        expect(Math.abs(p.lat)).toBeLessThanOrEqual(90);
        expect(Math.abs(p.lon)).toBeLessThanOrEqual(180);
        expect(p.country).toMatch(/^[A-Z]{3}$/);
        expect(p.cite.length).toBeGreaterThan(0);
        expect(p.cite[0].url).toMatch(/^https:\/\//);
      }
    }
    for (const id of ['cables', 'pipelines']) {
      for (const l of getStatic(id)!.data.items as any[]) {
        expect(l.coords.length).toBeGreaterThan(1);
        for (const [lon, lat] of l.coords) expect(Math.abs(lat) <= 90 && Math.abs(lon) <= 180).toBe(true);
      }
    }
    const hs = getStatic('hotspots')!.data.items as any[];
    expect(hs.every((h) => h.baseline >= 1 && h.baseline <= 5 && h.summary.length > 20)).toBe(true);
  });
});
