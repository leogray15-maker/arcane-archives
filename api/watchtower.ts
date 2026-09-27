// Vercel function for every /api/watchtower/* path. vercel.json rewrites
// /api/watchtower/:path* → /api/watchtower?route=:path*  so the whole API is one
// function sharing warm Redis / Firebase Admin clients.
import type { IncomingMessage, ServerResponse } from 'http';
import { handle } from '../lib/watchtower/routes';

type VReq = IncomingMessage & { query?: Record<string, string | string[]>; body?: unknown };

export default async function watchtower(req: VReq, res: ServerResponse) {
  const url = new URL(req.url || '/', 'http://local');
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (query[k] = v));
  const route = query.route ?? url.pathname.replace(/^\/api\/watchtower\/?/, '');
  delete query.route;

  const headers: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(req.headers)) headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;

  const out = await handle({ method: req.method || 'GET', route, query, headers, body: req.body });

  const etag = out.headers['ETag'];
  if (etag && headers['if-none-match'] === etag) {
    res.statusCode = 304;
    for (const [k, v] of Object.entries(out.headers)) if (k !== 'Content-Type') res.setHeader(k, v);
    res.end();
    return;
  }
  res.statusCode = out.status;
  for (const [k, v] of Object.entries(out.headers)) res.setHeader(k, v);
  res.end(typeof out.body === 'string' ? out.body : JSON.stringify(out.body));
}

export const config = { maxDuration: 60 };
