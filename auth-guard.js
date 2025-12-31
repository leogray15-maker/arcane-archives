// auth-guard.js
// Authentication and protection system (NO XP)

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyAK9MheMvSeOpscic4lXUsIwa0J5ubVf6w",
  authDomain: "arcane-archives-3b0f5.firebaseapp.com",
  projectId: "arcane-archives-3b0f5",
  storageBucket: "arcane-archives-3b0f5.firebasestorage.app",
  messagingSenderId: "264237235055",
  appId: "1:264237235055:web:4a2e5605b0ffb5307f069a",
  measurementId: "G-YGPLQHDXMM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * Protect a page – requires auth + (optional) payment
 */
export function protectPage(options = {}) {
  const { onSuccess, onFailure, requirePayment = true } = options;

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      console.warn('🔒 No user authenticated');
      onFailure ? onFailure() : (window.location.href = 'login.html');
      return;
    }

    try {
      const userRef = doc(db, 'Users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        console.warn('🔒 User profile not found');
        onFailure ? onFailure() : (window.location.href = 'login.html');
        return;
      }

      const userData = userSnap.data();

      if (requirePayment) {
        const isPaid =
          userData.isPaid === true ||
          userData.subscriptionStatus === 'active';

        if (!isPaid) {
          alert('🔒 This page requires an active subscription.');
          window.location.href = 'index.html#pricing';
          return;
        }
      }

      console.log('✅ Auth check passed');
      onSuccess && onSuccess(user, userData);

    } catch (err) {
      console.error('❌ Auth error:', err);
      onFailure ? onFailure() : (window.location.href = 'login.html');
    }
  });
}

/**
 * Auth-only check (no payment)
 */
export function checkAuth(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null, null);
      return;
    }

    try {
      const snap = await getDoc(doc(db, 'Users', user.uid));
      callback(user, snap.exists() ? snap.data() : null);
    } catch (err) {
      console.error('Error checking auth:', err);
      callback(null, null);
    }
  });
}

/**
 * Update username display
 */
export function updateUserAvatar(user, userData) {
  const username =
    userData?.Username ||
    user.displayName ||
    user.email.split('@')[0];

  document
    .querySelectorAll('[data-username]')
    .forEach(el => (el.textContent = username));
}

/**
 * Login rate limiting
 */
class RateLimiter {
  constructor(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.attempts = this.loadAttempts();
  }

  loadAttempts() {
    try {
      const stored = localStorage.getItem('login_attempts');
      if (!stored) return [];
      const now = Date.now();
      return JSON.parse(stored).filter(t => now - t < this.windowMs);
    } catch {
      return [];
    }
  }

  saveAttempts() {
    localStorage.setItem('login_attempts', JSON.stringify(this.attempts));
  }

  addAttempt() {
    this.attempts.push(Date.now());
    this.saveAttempts();
  }

  isAllowed() {
    const now = Date.now();
    this.attempts = this.attempts.filter(t => now - t < this.windowMs);
    return this.attempts.length < this.maxAttempts;
  }

  reset() {
    this.attempts = [];
    this.saveAttempts();
  }
}

export const loginRateLimiter = new RateLimiter();

console.log('✅ auth-guard.js loaded');
