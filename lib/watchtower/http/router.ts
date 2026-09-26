// The single entry point for /api/watchtower/*. Every route except cron/* and
// the public health summary requires a verified Firebase ID token.
import { getStore, type Store } from '../store';
import { authenticate, type Principal } from './auth';
import { rateLimit } from './ratelimit';
import { HttpError, json, type WtRequest, type WtResponse } from './types';

export type Handler = (ctx: Ctx) => Promise<WtResponse>;

export interface Ctx {
  req: WtRequest;
  store: Store;
  principal: Principal | null;
  params: Record<string, string>;
}

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  auth: boolean;
  handler: Handler;
}

const routes: Route[] = [];

export function route(method: string, path: string, auth: boolean, handler: Handler) {
  const keys: string[] = [];
  const pattern = new RegExp(
    '^' + path.replace(/:([a-zA-Z]+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '/?$',
  );
  routes.push({ method, pattern, keys, auth, handler });
}

export const checkoutUrl = () => process.env.WT_CHECKOUT_URL || '/membership-assessment.html';

route('GET', 'me', true, async ({ principal }) =>
  json({ uid: principal!.uid, email: principal!.email, tier: principal!.tier, checkoutUrl: checkoutUrl() }),
);

export async function handle(req: WtRequest, store: Store = getStore()): Promise<WtResponse> {
  try {
    const path = req.route.replace(/^\/+|\/+$/g, '');
    let matched: Route | null = null;
    let m: RegExpMatchArray | null = null;
    let methodMismatch = false;
    for (const r of routes) {
      const mm = path.match(r.pattern);
      if (!mm) continue;
      if (r.method !== req.method && !(r.method === 'GET' && req.method === 'HEAD')) {
        methodMismatch = true;
        continue;
      }
      matched = r;
      m = mm;
      break;
    }
    if (!matched || !m) throw new HttpError(methodMismatch ? 405 : 404, methodMismatch ? 'Method not allowed' : 'Not found');
    const params: Record<string, string> = {};
    matched.keys.forEach((k, i) => (params[k] = decodeURIComponent(m![i + 1])));

    let principal: Principal | null = null;
    if (matched.auth) {
      principal = await authenticate(req, store);
      await rateLimit(store, `u:${principal.uid}`, 240, 60);
    }
    return await matched.handler({ req, store, principal, params });
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message, code: err.code }, err.status);
    console.error('[watchtower]', err);
    return json({ error: 'Internal error', code: 'internal' }, 500);
  }
}
