// Firebase ID-token verification and membership lookup that need NO service
// account. Used when FIREBASE_SERVICE_ACCOUNT is not set:
//   · the token's RS256 signature is checked against Google's public
//     securetoken certificates, plus aud / iss / exp / sub, as Firebase documents;
//   · Users/{uid} is read through the Firestore REST API with the viewer's own
//     ID token, so firestore.rules still decide what the server can see.
import { createPublicKey, createVerify } from 'crypto';
import type { TokenVerifier, UserDoc } from './auth';

const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

/** The site's public Firebase project (same id as every page's firebaseConfig). */
export const firebaseProjectId = () => process.env.FIREBASE_PROJECT_ID || 'arcane-archives-3b0f5';

let certs: { keys: Record<string, string>; exp: number } | null = null;

async function getCerts(now: number): Promise<Record<string, string>> {
  if (certs && certs.exp > now) return certs.keys;
  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new Error(`certs ${res.status}`);
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') || '')?.[1] ?? 3600);
  certs = { keys: (await res.json()) as Record<string, string>, exp: now + maxAge * 1000 };
  return certs.keys;
}

const b64url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export async function verifyIdToken(token: string, projectId = firebaseProjectId(), now = Date.now()) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('malformed token');
  const header = JSON.parse(b64url(parts[0]).toString('utf8'));
  const claims = JSON.parse(b64url(parts[1]).toString('utf8')) as Record<string, any>;
  if (header.alg !== 'RS256' || !header.kid) throw new Error('bad header');

  const pem = (await getCerts(now))[header.kid];
  if (!pem) throw new Error('unknown key id');
  const ok = createVerify('RSA-SHA256').update(`${parts[0]}.${parts[1]}`).verify(createPublicKey(pem), b64url(parts[2]));
  if (!ok) throw new Error('bad signature');

  const sec = Math.floor(now / 1000);
  if (claims.aud !== projectId) throw new Error('wrong audience');
  if (claims.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('wrong issuer');
  if (typeof claims.sub !== 'string' || !claims.sub) throw new Error('no subject');
  if (typeof claims.exp !== 'number' || claims.exp <= sec - 60) throw new Error('expired');
  if (typeof claims.iat !== 'number' || claims.iat > sec + 300) throw new Error('issued in the future');
  return { uid: claims.sub as string, email: (claims.email as string) ?? null, claims };
}

/** Decode one Firestore REST value into plain JS (only the shapes auth needs). */
function fsValue(v: any): unknown {
  if (!v || typeof v !== 'object') return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  return null;
}

export async function loadUserWithToken(uid: string, token: string, projectId = firebaseProjectId()): Promise<UserDoc | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/Users/${encodeURIComponent(uid)}?mask.fieldPaths=isPaid&mask.fieldPaths=subscriptionStatus`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`firestore ${res.status}`);
  const doc: any = await res.json();
  const f = doc.fields ?? {};
  return { isPaid: fsValue(f.isPaid), subscriptionStatus: fsValue(f.subscriptionStatus) };
}

/** A TokenVerifier that works from public keys and the viewer's own token. */
export function liteVerifier(): TokenVerifier {
  const tokens = new Map<string, string>();
  return {
    async verify(token) {
      const out = await verifyIdToken(token);
      tokens.set(out.uid, token);
      return out;
    },
    async loadUser(uid) {
      const token = tokens.get(uid);
      tokens.delete(uid);
      if (!token) return null;
      return loadUserWithToken(uid, token);
    },
  };
}
