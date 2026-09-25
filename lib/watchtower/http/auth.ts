// Server-side auth for every /api/watchtower/* route (except cron, which uses
// CRON_SECRET). Verifies the Firebase ID token, then resolves the viewer's tier
// from Firestore using the same rule as auth-guard.js / firestore.rules:
//   paid  = Users/{uid}.isPaid === true || subscriptionStatus === 'active'
//   admin = uid in WT_ADMIN_UIDS (or the legacy list) || custom claim admin === true
import type { Tier } from '../../../shared/watchtower/types';
import type { Store } from '../store';
import { HttpError, type WtRequest } from './types';

export interface Principal {
  uid: string;
  email: string | null;
  tier: Tier;
}

// Same two UIDs as ADMIN_UIDS in auth-guard.js and isAdmin() in firestore.rules.
const LEGACY_ADMIN_UIDS = ['U4PvQ0dilBco97hgXp3Awl45JX92', 'liMx3vjGGrgAta12IlKclq3Xwvr2'];
const MEMBERSHIP_CACHE_SEC = 300;

export function adminUids(): string[] {
  const env = (process.env.WT_ADMIN_UIDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return env.length ? env : LEGACY_ADMIN_UIDS;
}

export interface UserDoc {
  isPaid?: unknown;
  subscriptionStatus?: unknown;
}

export function tierFor(uid: string, claims: Record<string, unknown>, user: UserDoc | null, admins = adminUids()): Tier {
  if (claims.admin === true || admins.includes(uid)) return 'admin';
  if (user && (user.isPaid === true || user.subscriptionStatus === 'active')) return 'member';
  return 'free';
}

export interface TokenVerifier {
  verify(token: string): Promise<{ uid: string; email?: string | null; claims: Record<string, unknown> }>;
  loadUser(uid: string): Promise<UserDoc | null>;
}

let verifier: TokenVerifier | null = null;

/** Test hook */
export function setTokenVerifier(v: TokenVerifier | null) {
  verifier = v;
}

function firebaseVerifier(): TokenVerifier {
  // Loaded lazily so tests and the dev server never need a service account.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const admin = require('firebase-admin') as typeof import('firebase-admin');
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new HttpError(500, 'Server auth is not configured', 'auth_unconfigured');
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  }
  return {
    async verify(token) {
      const t = await admin.auth().verifyIdToken(token);
      return { uid: t.uid, email: t.email ?? null, claims: t as unknown as Record<string, unknown> };
    },
    async loadUser(uid) {
      const snap = await admin.firestore().collection('Users').doc(uid).get();
      return snap.exists ? (snap.data() as UserDoc) : null;
    },
  };
}

export function devBypassEnabled() {
  return process.env.WT_DEV_AUTH_BYPASS === '1' && !process.env.VERCEL;
}

export async function authenticate(req: WtRequest, store: Store): Promise<Principal> {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new HttpError(401, 'Sign in required', 'unauthenticated');

  if (devBypassEnabled() && token.startsWith('dev-')) {
    const tier = token.slice(4) as Tier;
    if (tier === 'free' || tier === 'member' || tier === 'admin') return { uid: `dev-${tier}`, email: null, tier };
  }

  const v = verifier ?? (verifier = firebaseVerifier());
  let decoded;
  try {
    decoded = await v.verify(token);
  } catch {
    throw new HttpError(401, 'Session expired — please sign in again', 'bad_token');
  }

  const cacheKey = `wt:auth:${decoded.uid}`;
  let tier = await store.get<Tier>(cacheKey).catch(() => null);
  if (!tier) {
    const user = await v.loadUser(decoded.uid);
    tier = tierFor(decoded.uid, decoded.claims, user);
    await store.set(cacheKey, tier, { ex: MEMBERSHIP_CACHE_SEC }).catch(() => undefined);
  }
  return { uid: decoded.uid, email: decoded.email ?? null, tier };
}

export function requireTier(p: Principal, min: Tier) {
  const rank = { free: 0, member: 1, admin: 2 } as const;
  if (rank[p.tier] < rank[min]) {
    throw new HttpError(403, min === 'admin' ? 'Admins only' : 'Membership required', 'forbidden');
  }
}

/** Constant-time-ish compare for the cron secret. */
export function checkCronSecret(req: WtRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (devBypassEnabled()) return;
    throw new HttpError(500, 'CRON_SECRET not configured', 'cron_unconfigured');
  }
  const got = (req.headers['authorization'] || '').replace(/^Bearer\s+/, '');
  let diff = got.length ^ secret.length;
  for (let i = 0; i < Math.max(got.length, secret.length); i++) diff |= (got.charCodeAt(i) || 0) ^ (secret.charCodeAt(i) || 0);
  if (diff !== 0) throw new HttpError(401, 'Bad cron secret', 'unauthenticated');
}
