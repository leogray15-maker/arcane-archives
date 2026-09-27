import type { Store } from '../store';
import { HttpError } from './types';

/** Fixed-window limiter: at most `limit` calls per `windowSec` for `id`. */
export async function rateLimit(store: Store, id: string, limit: number, windowSec: number) {
  const bucket = Math.floor(Date.now() / 1000 / windowSec);
  const n = await store.incr(`wt:rl:${id}:${bucket}`, 1, windowSec + 5);
  if (n > limit) throw new HttpError(429, 'Too many requests — slow down a little', 'rate_limited');
  return n;
}
