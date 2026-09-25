// Client-side gate: no signed-in user → /login.html?next=watchtower.
// The server re-checks every request; this is just the redirect.
import type { User } from 'firebase/auth';

// Public web config (same values as auth-guard.js — not secret).
const firebaseConfig = {
  apiKey: 'AIzaSyAK9MheMvSeOpscic4lXUsIwa0J5ubVf6w',
  authDomain: 'arcane-archives-3b0f5.firebaseapp.com',
  projectId: 'arcane-archives-3b0f5',
  storageBucket: 'arcane-archives-3b0f5.firebasestorage.app',
  messagingSenderId: '264237235055',
  appId: '1:264237235055:web:4a2e5605b0ffb5307f069a',
};

export interface Session {
  getToken(forceRefresh?: boolean): Promise<string>;
  signOut(): Promise<void>;
}

export const LOGIN_URL = '/login.html?next=watchtower';

export async function authGate(): Promise<Session> {
  // Dev server and the local 'lighthouse' perf build only; statically false in production builds.
  const devTier = import.meta.env.DEV || import.meta.env.MODE === 'lighthouse' ? (import.meta.env.VITE_WT_DEV_AUTH as string | undefined) : undefined;
  if (devTier) {
    const tier = new URLSearchParams(location.search).get('as') || devTier;
    return { getToken: async () => `dev-${tier}`, signOut: async () => undefined };
  }

  const [{ initializeApp, getApps, getApp }, authMod] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = authMod.getAuth(app);

  const user = await new Promise<User | null>((resolve) => {
    const off = authMod.onAuthStateChanged(auth, (u) => {
      off();
      resolve(u);
    });
  });
  if (!user) {
    location.replace(LOGIN_URL);
    return new Promise(() => undefined); // never resolves; we're navigating away
  }
  return {
    getToken: (force = false) => user.getIdToken(force),
    signOut: () => authMod.signOut(auth),
  };
}
