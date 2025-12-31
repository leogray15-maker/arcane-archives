// auth-guard.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// ==========================
// FIREBASE INIT
// ==========================
const firebaseConfig = {
  apiKey: "AIzaSyAK9MheMvSeOpscic4lXUsIwa0J5ubVf6w",
  authDomain: "arcane-archives-3b0f5.firebaseapp.com",
  projectId: "arcane-archives-3b0f5",
  storageBucket: "arcane-archives-3b0f5.firebasestorage.app",
  messagingSenderId: "264237235055",
  appId: "1:264237235055:web:4a2e5605b0ffb5307f069a",
  measurementId: "G-YGPLQHDXMM"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };

// ==========================
// CENTRAL PAGE PROTECTOR
// ==========================
export function protectPage(options = {}) {
  const {
    onSuccess,
    onFailure,
    redirectToLogin = true,
    redirectToPricing = true
  } = options;

  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          console.warn("🚫 Not authenticated");

          if (redirectToLogin) {
            sessionStorage.setItem("aa_redirect_after_login", window.location.pathname);
            window.location.href = "login.html";
          }

          onFailure && onFailure("NOT_AUTHENTICATED");
          return reject(new Error("NOT_AUTHENTICATED"));
        }

        // Load Firestore profile
        const userRef = doc(db, "Users", user.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          console.warn("❌ User doc missing, treating as unpaid");

          if (redirectToPricing) {
            window.location.href = "index.html#pricing";
          }

          onFailure && onFailure("USER_DATA_MISSING");
          return reject(new Error("USER_DATA_MISSING"));
        }

        const data = snap.data();
        const hasActiveSubscription = data.subscriptionStatus === "active";
        const isPaid = data.isPaid === true;

        if (!hasActiveSubscription && !isPaid) {
          console.warn("🔒 Subscription inactive, redirecting to pricing");

          if (redirectToPricing) {
            window.location.href = "index.html#pricing";
          }

          onFailure && onFailure("PAYMENT_REQUIRED");
          return reject(new Error("PAYMENT_REQUIRED"));
        }

        // All good
        onSuccess && onSuccess(user, data);
        resolve({ user, userData: data });
      } catch (err) {
        console.error("Auth guard error:", err);
        onFailure && onFailure("AUTH_ERROR", err);
        reject(err);
      }
    });
  });
}

// ==========================
// AVATAR / LOGOUT HELPERS
// ==========================
export function updateUserAvatar(user, userData, avatarElementId = "userAvatar") {
  const avatarElement = document.getElementById(avatarElementId);
  if (!avatarElement) return;

  const username = userData?.Username || user.displayName || user.email.split("@")[0];
  const initial = username.charAt(0).toUpperCase();

  const customAvatarUrl = localStorage.getItem("customAvatarUrl");

  if (customAvatarUrl) {
    avatarElement.style.backgroundImage = `url(${customAvatarUrl})`;
    avatarElement.style.backgroundSize = "cover";
    avatarElement.style.backgroundPosition = "center";
    avatarElement.textContent = "";
  } else {
    avatarElement.textContent = initial;
  }
}

export async function logout() {
  try {
    await signOut(auth);
    localStorage.removeItem("customAvatarUrl");
    localStorage.removeItem("userAvatar");
    sessionStorage.clear();
    window.location.href = "index.html";
  } catch (err) {
    console.error("Logout error:", err);
    alert("Error logging out. Please try again.");
  }
}

export function setupLogoutButton(buttonId = "logoutBtn") {
  const btn = document.getElementById(buttonId);
  if (btn) {
    btn.addEventListener("click", logout);
  }
}

// Used after login to send paid users back to the page they tried to hit
export function handlePostLoginRedirect() {
  const redirectPath = sessionStorage.getItem("aa_redirect_after_login");
  if (redirectPath) {
    sessionStorage.removeItem("aa_redirect_after_login");
    window.location.href = redirectPath;
    return true;
  }
  return false;
}

// ==========================
// LOGIN RATE LIMITER
// ==========================
//
// login.html expects:
//   loginRateLimiter.isAllowed()
//   loginRateLimiter.getRemainingTime()
//
const RATE_LIMIT_KEY = "aa_login_rate_limit";

function loadRateLimitState() {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    if (!raw) return { attempts: 0, firstAttemptAt: null };
    return JSON.parse(raw);
  } catch {
    return { attempts: 0, firstAttemptAt: null };
  }
}

function saveRateLimitState(state) {
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(state));
}

export const loginRateLimiter = {
  maxAttempts: 8,           // how many tries
  windowMs: 15 * 60 * 1000, // 15 minutes

  isAllowed() {
    const now = Date.now();
    let state = loadRateLimitState();

    if (!state.firstAttemptAt || now - state.firstAttemptAt > this.windowMs) {
      // reset window
      state = { attempts: 0, firstAttemptAt: now };
    }

    if (state.attempts >= this.maxAttempts) {
      // still blocked
      saveRateLimitState(state);
      return false;
    }

    state.attempts += 1;
    if (!state.firstAttemptAt) state.firstAttemptAt = now;
    saveRateLimitState(state);
    return true;
  },

  getRemainingTime() {
    const state = loadRateLimitState();
    if (!state.firstAttemptAt) return 0;
    const now = Date.now();
    const diff = this.windowMs - (now - state.firstAttemptAt);
    return diff > 0 ? diff : 0;
  }
};
// Simple mobile menu helper for pages that import it
export function setupMobileMenu(
  toggleId = "menuToggle",
  menuSelector = ".nav-links"
) {
  const toggle = document.getElementById(toggleId);
  const menu = document.querySelector(menuSelector);
  if (!toggle || !menu) return;

  toggle.addEventListener("click", () => {
    menu.classList.toggle("open");
  });
}