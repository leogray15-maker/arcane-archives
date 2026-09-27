// Outbound HTTP for seed jobs: timeout, one retry on network/5xx, polite UA.
export const USER_AGENT = 'ArcaneWatchtower/1.0 (+https://arcanearchives.shop)';

export interface FetchOpts {
  timeoutMs?: number;
  headers?: Record<string, string>;
  retries?: number;
}

export class UpstreamError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export async function fetchRaw(url: string, opts: FetchOpts = {}): Promise<Response> {
  const retries = opts.retries ?? 1;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15000);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, ...opts.headers }, signal: ctrl.signal });
      if (res.status >= 500 && attempt < retries) {
        lastErr = new UpstreamError(`HTTP ${res.status}`, res.status);
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  const msg = lastErr instanceof Error ? (lastErr.name === 'AbortError' ? 'timeout' : lastErr.message) : 'fetch failed';
  throw new UpstreamError(`${host(url)}: ${msg}`);
}

export async function fetchJson<T = any>(url: string, opts?: FetchOpts): Promise<T> {
  const res = await fetchRaw(url, opts);
  if (!res.ok) throw new UpstreamError(`${host(url)}: HTTP ${res.status}`, res.status);
  try {
    return (await res.json()) as T;
  } catch {
    throw new UpstreamError(`${host(url)}: invalid JSON`);
  }
}

export async function fetchText(url: string, opts?: FetchOpts): Promise<string> {
  const res = await fetchRaw(url, opts);
  if (!res.ok) throw new UpstreamError(`${host(url)}: HTTP ${res.status}`, res.status);
  return res.text();
}

export function host(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Removes credentials from a URL before it is logged or stored. */
export function redact(s: string) {
  return s.replace(/(api_key|apikey|key|token|MAP_KEY)=([^&\s]+)/gi, '$1=***').replace(/\/api\/area\/csv\/[^/]+\//, '/api/area/csv/***/');
}
