// Framework-neutral request/response used by the router. Adapted to Vercel's
// (req, res) in api/watchtower.ts and to Vite's dev server in watchtower-app.

export interface WtRequest {
  method: string;
  /** Route after /api/watchtower/, e.g. "bootstrap" or "cron/fast" */
  route: string;
  query: Record<string, string>;
  headers: Record<string, string | undefined>;
  body?: unknown;
}

export interface WtResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = 'error') {
    super(message);
  }
}

/** Cache tiers from the brief. Every Watchtower response is member-gated, so
 *  it may only be cached privately (in the viewer's browser), never by a CDN. */
export const CACHE_TIERS = {
  none: 0,
  fast: 300,
  medium: 600,
  slow: 1800,
  static: 7200,
  daily: 86400,
} as const;

export type CacheTier = keyof typeof CACHE_TIERS;

export function json(body: unknown, status = 200, cache: CacheTier = 'none', extra: Record<string, string> = {}): WtResponse {
  const maxAge = CACHE_TIERS[cache];
  return {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': maxAge ? `private, max-age=${maxAge}` : 'private, no-store',
      Vary: 'Authorization',
      'X-Content-Type-Options': 'nosniff',
      ...extra,
    },
    body,
  };
}

/** FNV-1a hash, used for ETags and cache keys where crypto isn't needed. */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
