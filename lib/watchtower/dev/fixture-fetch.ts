// DEV/TEST ONLY: replaces global fetch so seed jobs read local fixture files
// (tests/watchtower/fixtures) instead of upstream APIs. Refuses to run on Vercel.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export type FixtureRoute = [RegExp, string];

export const FIXTURE_ROUTES: FixtureRoute[] = [
  [/summary\/4\.5_day\.geojson/, 'usgs-4.5_day.json'],
  [/summary\/significant_week\.geojson/, 'usgs-significant_week.json'],
];

export function installFixtureFetch(dir: string, routes: FixtureRoute[] = FIXTURE_ROUTES) {
  if (process.env.VERCEL) throw new Error('Fixture fetch is dev-only');
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const hit = routes.find(([re]) => re.test(url));
    if (!hit) return new Response('fixture not found', { status: 404 });
    const file = join(dir, hit[1]);
    if (!existsSync(file)) return new Response('fixture missing', { status: 404 });
    const body = readFileSync(file);
    const type = file.endsWith('.json') ? 'application/json' : file.endsWith('.xml') ? 'application/xml' : 'text/plain';
    return new Response(body, { status: 200, headers: { 'Content-Type': type } });
  }) as typeof fetch;
  return () => {
    globalThis.fetch = real;
  };
}
