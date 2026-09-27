// Key/value store for the Watchtower. Production uses Upstash Redis over its REST
// API (plain fetch, no SDK). Local dev and tests use an in-memory store.
// Values are JSON-encoded.

export interface SetOpts {
  /** Expiry in seconds */
  ex?: number;
  /** Only set when the key does not exist */
  nx?: boolean;
}

export interface Store {
  readonly kind: 'upstash' | 'memory';
  get<T>(key: string): Promise<T | null>;
  mget<T = unknown>(keys: string[]): Promise<(T | null)[]>;
  set(key: string, value: unknown, opts?: SetOpts): Promise<boolean>;
  del(...keys: string[]): Promise<void>;
  /** INCRBY with an optional expiry applied on first increment. */
  incr(key: string, by?: number, ex?: number): Promise<number>;
}

const decode = <T>(raw: unknown): T | null => {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
};

export class UpstashStore implements Store {
  readonly kind = 'upstash' as const;
  constructor(private url: string, private token: string) {}

  private async call(body: unknown, path = ''): Promise<any> {
    const res = await fetch(this.url + path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json: any = await res.json().catch(() => null);
    if (!res.ok || !json) throw new Error(`upstash ${res.status}: ${json?.error ?? 'bad response'}`);
    if (Array.isArray(json)) {
      for (const r of json) if (r?.error) throw new Error(`upstash: ${r.error}`);
      return json.map((r: any) => r.result);
    }
    if (json.error) throw new Error(`upstash: ${json.error}`);
    return json.result;
  }

  async get<T>(key: string) {
    return decode<T>(await this.call(['GET', key]));
  }

  async mget<T>(keys: string[]) {
    if (!keys.length) return [];
    const out: unknown[] = await this.call(['MGET', ...keys]);
    return out.map((v) => decode<T>(v));
  }

  async set(key: string, value: unknown, opts: SetOpts = {}) {
    const cmd: (string | number)[] = ['SET', key, JSON.stringify(value)];
    if (opts.ex) cmd.push('EX', Math.max(1, Math.round(opts.ex)));
    if (opts.nx) cmd.push('NX');
    const r = await this.call(cmd);
    return r === 'OK';
  }

  async del(...keys: string[]) {
    if (keys.length) await this.call(['DEL', ...keys]);
  }

  async incr(key: string, by = 1, ex?: number) {
    const cmds: (string | number)[][] = [['INCRBY', key, Math.round(by)]];
    if (ex) cmds.push(['EXPIRE', key, ex, 'NX']);
    const [n] = await this.call(cmds, '/pipeline');
    return Number(n);
  }
}

export class MemoryStore implements Store {
  readonly kind = 'memory' as const;
  private data = new Map<string, { v: string; exp: number | null }>();
  private now: () => number;
  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  private live(key: string) {
    const e = this.data.get(key);
    if (!e) return null;
    if (e.exp !== null && e.exp <= this.now()) {
      this.data.delete(key);
      return null;
    }
    return e;
  }

  async get<T>(key: string) {
    const e = this.live(key);
    return e ? decode<T>(e.v) : null;
  }

  async mget<T>(keys: string[]) {
    return Promise.all(keys.map((k) => this.get<T>(k)));
  }

  async set(key: string, value: unknown, opts: SetOpts = {}) {
    if (opts.nx && this.live(key)) return false;
    this.data.set(key, { v: JSON.stringify(value), exp: opts.ex ? this.now() + opts.ex * 1000 : null });
    return true;
  }

  async del(...keys: string[]) {
    keys.forEach((k) => this.data.delete(k));
  }

  async incr(key: string, by = 1, ex?: number) {
    const e = this.live(key);
    const n = (e ? Number(JSON.parse(e.v)) : 0) + by;
    this.data.set(key, { v: JSON.stringify(n), exp: e?.exp ?? (ex ? this.now() + ex * 1000 : null) });
    return n;
  }

  keys() {
    return [...this.data.keys()].filter((k) => this.live(k));
  }
}

let shared: Store | null = null;

/** Upstash when configured; otherwise an in-memory store (dev/tests only). */
export function getStore(): Store {
  if (shared) return shared;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  shared = url && token ? new UpstashStore(url.replace(/\/$/, ''), token) : new MemoryStore();
  return shared;
}

export function setStore(s: Store | null) {
  shared = s;
}
