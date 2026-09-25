// DEV/TEST ONLY: replaces global fetch so seed jobs read local fixture files
// (tests/watchtower/fixtures) instead of upstream APIs. Refuses to run on Vercel.
//
// Fixture files use relative-time tokens so they never go stale:
//   "__MS-15__"      → epoch ms, 15 minutes ago (quoted token → JSON number)
//   __ISO-15__       → ISO 8601        __RFC-15__   → RFC 822 (RSS pubDate)
//   __GDELT-15__     → YYYYMMDDHHMMSS  __GDELTISO-15__ → YYYYMMDDTHHMMSSZ
//   __YMD-15__       → YYYY-MM-DD      __YMDC-15__  → YYYYMMDD   __HHMM-15__ → HHMM
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';

export type FixtureRoute = [RegExp, string, ('zip' | 'tle')?];

export const FIXTURE_ROUTES: FixtureRoute[] = [
  [/summary\/4\.5_day\.geojson/, 'usgs-4.5_day.json'],
  [/summary\/significant_week\.geojson/, 'usgs-significant_week.json'],
  [/eonet\.gsfc\.nasa\.gov\/api\/v3\/events/, 'eonet.json'],
  [/gdacs\.org\/gdacsapi/, 'gdacs.json'],
  [/firms\.modaps\.eosdis\.nasa\.gov\/api\/area\/csv/, 'firms-viirs.csv'],
  [/gdeltv2\/lastupdate\.txt/, 'gdelt-lastupdate.txt'],
  [/gdeltv2\/\d{14}\.export\.CSV\.zip/, 'gdelt-export.tsv', 'zip'],
  [/api\.gdeltproject\.org\/api\/v2\/doc/, 'gdelt-tone.json'],
  [/ucdpapi\.pcr\.uu\.se/, 'ucdp.json'],
  [/GROUP=stations/, 'tle-stations.tle', 'tle'],
  [/GROUP=military/, 'tle-military.tle', 'tle'],
  [/GROUP=gnss/, 'tle-gnss.tle', 'tle'],
  [/GROUP=weather/, 'tle-weather.tle', 'tle'],
  [/GROUP=resource/, 'tle-resource.tle', 'tle'],
  [/api\.adsb\.lol\/v2\/mil/, 'adsb-mil.json'],
  [/feeds\.bbci\.co\.uk/, 'rss-bbc.xml'],
  [/theguardian\.com\/world\/rss/, 'rss-guardian.xml'],
  [/rss\.dw\.com/, 'rss-dw.xml'],
  [/aljazeera\.com\/xml\/rss/, 'rss-aljazeera.xml'],
  [/bellingcat\.com\/feed/, 'atom-bellingcat.xml'],
  [/series_id=DFF&/, 'fred-DFF.json'],
  [/series_id=DGS2&/, 'fred-DGS2.json'],
  [/series_id=DGS10&/, 'fred-DGS10.json'],
  [/series_id=T10Y2Y&/, 'fred-T10Y2Y.json'],
  [/series_id=DTWEXBGS&/, 'fred-DTWEXBGS.json'],
  [/series_id=DCOILWTICO&/, 'fred-DCOILWTICO.json'],
  [/series_id=UNRATE&/, 'fred-UNRATE.json'],
  [/series_id=CPIAUCSL&/, 'fred-CPIAUCSL.json'],
];

const p2 = (n: number) => String(n).padStart(2, '0');
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function renderTokens(src: string, now: number): string {
  const at = (m: string) => new Date(now - Number(m) * 60000);
  return src
    .replace(/"__MS-(\d+)__"/g, (_, m) => String(at(m).getTime()))
    .replace(/__MS-(\d+)__/g, (_, m) => String(at(m).getTime()))
    .replace(/__ISO-(\d+)__/g, (_, m) => at(m).toISOString())
    .replace(/__RFC-(\d+)__/g, (_, m) => {
      const d = at(m);
      return `${DAYS[d.getUTCDay()]}, ${p2(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())} GMT`;
    })
    .replace(/__GDELTISO-(\d+)__/g, (_, m) => {
      const d = at(m);
      return `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}00Z`;
    })
    .replace(/__GDELT-(\d+)__/g, (_, m) => {
      const d = new Date(Math.floor(at(m).getTime() / 900000) * 900000);
      return `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}00`;
    })
    .replace(/__YMDC-(\d+)__/g, (_, m) => at(m).toISOString().slice(0, 10).replace(/-/g, ''))
    .replace(/__YMD-(\d+)__/g, (_, m) => at(m).toISOString().slice(0, 10))
    .replace(/__HHMM-(\d+)__/g, (_, m) => {
      const d = at(m);
      return `${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}`;
    });
}

/** Rewrites TLE epochs to "now" so SGP4 propagation stays accurate. */
function freshTle(text: string, now: number): string {
  const d = new Date(now);
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const doy = (now - start) / 86400000;
  const epoch = `${String(d.getUTCFullYear()).slice(2)}${doy.toFixed(8).padStart(12, '0')}`;
  return text
    .split('\n')
    .map((l) => (l.startsWith('1 ') && l.length >= 32 ? l.slice(0, 18) + epoch + l.slice(32) : l))
    .join('\n');
}

export function installFixtureFetch(dir: string, routes: FixtureRoute[] = FIXTURE_ROUTES, clock: () => number = Date.now) {
  if (process.env.VERCEL) throw new Error('Fixture fetch is dev-only');
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const hit = routes.find(([re]) => re.test(url));
    if (!hit) return new Response('fixture not found', { status: 404 });
    const file = join(dir, hit[1]);
    if (!existsSync(file)) return new Response('fixture missing', { status: 404 });
    const now = clock();
    let text = renderTokens(readFileSync(file, 'utf8'), now);
    if (hit[2] === 'tle') text = freshTle(text, now);
    if (hit[2] === 'zip') {
      const zip = zipSync({ [hit[1].replace('.tsv', '.CSV')]: strToU8(text) });
      return new Response(zip, { status: 200, headers: { 'Content-Type': 'application/zip' } });
    }
    const type = file.endsWith('.json') ? 'application/json' : file.endsWith('.xml') ? 'application/xml' : 'text/plain';
    return new Response(text, { status: 200, headers: { 'Content-Type': type } });
  }) as typeof fetch;
  return () => {
    globalThis.fetch = real;
  };
}
