// Authenticated fetch for /api/watchtower/*. The browser never calls upstream
// sources directly.
import { LOGIN_URL, type Session } from './auth-gate';

let session: Session | null = null;
export function setSession(s: Session) {
  session = s;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export async function api<T>(path: string, opts: { timeoutMs?: number; method?: string; body?: unknown } = {}): Promise<T> {
  if (!session) throw new ApiError(0, 'No session');
  const attempt = async (force: boolean) => {
    const token = await session!.getToken(force);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 10000);
    try {
      return await fetch(`/api/watchtower/${path}`, {
        method: opts.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: ctrl.signal,
        // Revalidate with the ETag every time; the server answers 304 when unchanged.
        cache: 'no-cache',
      });
    } finally {
      clearTimeout(timer);
    }
  };

  let res: Response;
  try {
    res = await attempt(false);
    if (res.status === 401) res = await attempt(true);
  } catch (e) {
    throw new ApiError(0, (e as Error).name === 'AbortError' ? 'Timed out' : 'Network error');
  }
  if (res.status === 401) {
    location.replace(LOGIN_URL);
    throw new ApiError(401, 'Signed out');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body?.error || `HTTP ${res.status}`, body?.code);
  return body as T;
}
