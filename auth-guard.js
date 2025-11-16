// ============================================
// ARCANE ARCHIVES - CENTRALIZED AUTH GUARD
// ============================================
// This module provides secure authentication and paywall protection
// for all protected pages in The Arcane Archives

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import { 
  getAuth, 
  onAuthStateChanged, 
  signOut 
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import { 
  getFirestore, 
  doc, 
  getDoc 
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

// Firebase Configuration
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
const auth = getAuth(app);
const db = getFirestore(app);

// Export auth and db for use in other scripts
export { auth, db };

// ============================================
// CORE AUTH PROTECTION FUNCTION
// ============================================
export async function protectPage(options = {}) {
  const {
    onSuccess,
    onFailure,
    redirectToLogin = true,
    redirectToPricing = true
  } = options;

  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      try {
        // Check if user is authenticated
        if (!user) {
          console.warn('🚫 No authenticated user detected');
          
          if (redirectToLogin) {
            sessionStorage.setItem('aa_redirect_after_login', window.location.pathname);
            window.location.href = 'login.html';
          }
          
          if (onFailure) onFailure('NOT_AUTHENTICATED');
          reject(new Error('NOT_AUTHENTICATED'));
          return;
        }

        console.log('✅ User authenticated:', user.uid);

        // Fetch user data from Firestore - USING 'Users' (capital U)
        const userDocRef = doc(db, 'Users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
          console.error('❌ User document not found in Firestore');
          alert('⚠️ Your account data is missing. Please contact support.');
          
          if (onFailure) onFailure('USER_DATA_MISSING');
          reject(new Error('USER_DATA_MISSING'));
          return;
        }

        const userData = userDoc.data();
        console.log('📄 User data loaded:', { 
          uid: user.uid, 
          subscriptionStatus: userData.subscriptionStatus,
          isPaid: userData.isPaid 
        });

        // Verify subscription status
        const hasActiveSubscription = userData.subscriptionStatus === 'active';
        const isPaid = userData.isPaid === true;

        // 🔒 HARD LOCK: if not paid, instantly send to pricing
        if (!hasActiveSubscription && !isPaid) {
          console.warn('🔒 User has not paid for access, redirecting to pricing...');
          
          if (redirectToPricing) {
            // Hard redirect, no alert, no flicker
            window.location.replace('index.html#pricing');
          }
          
          if (onFailure) onFailure('PAYMENT_REQUIRED');
          reject(new Error('PAYMENT_REQUIRED'));
          return;
        }

        // Success - User has access
        console.log('✅ Access granted to user:', user.uid);
        
        if (onSuccess) {
          onSuccess(user, userData);
        }
        
        resolve({ user, userData });

      } catch (error) {
        console.error('❌ Auth error:', error);
        alert('⚠️ Error verifying your account. Please refresh the page.');
        
        if (onFailure) onFailure('AUTH_ERROR', error);
        reject(error);
      }
    });
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function updateUserAvatar(user, userData, avatarElementId = 'userAvatar') {
  const avatarElement = document.getElementById(avatarElementId);
  if (!avatarElement) return;

  const username = userData?.Username || user.displayName || user.email.split('@')[0];
  const initial = username.charAt(0).toUpperCase();

  const customAvatarUrl = localStorage.getItem('customAvatarUrl');
  
  if (customAvatarUrl) {
    avatarElement.style.backgroundImage = `url(${customAvatarUrl})`;
    avatarElement.style.backgroundSize = 'cover';
    avatarElement.style.backgroundPosition = 'center';
    avatarElement.textContent = '';
  } else {
    avatarElement.textContent = initial;
  }
}

export async function logout() {
  try {
    await signOut(auth);
    localStorage.removeItem('customAvatarUrl');
    localStorage.removeItem('userAvatar');
    sessionStorage.clear();
    window.location.href = 'index.html';
  } catch (error) {
    console.error('Logout error:', error);
    alert('Error logging out. Please try again.');
  }
}

export function setupLogoutButton(buttonId = 'logoutBtn') {
  const logoutBtn = document.getElementById(buttonId);
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
}

export function handlePostLoginRedirect() {
  const redirectPath = sessionStorage.getItem('aa_redirect_after_login');
  if (redirectPath) {
    sessionStorage.removeItem('aa_redirect_after_login');
    window.location.href = redirectPath;
  }
}

export function setupMobileMenu() {
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('active');
    });
    
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768) {
        if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
          sidebar.classList.remove('active');
        }
      }
    });
  }
}

class RateLimiter {
  constructor(maxAttempts = 5, timeWindow = 300000) {
    this.maxAttempts = maxAttempts;
    this.timeWindow = timeWindow;
    this.attempts = [];
  }

  isAllowed() {
    const now = Date.now();
    this.attempts = this.attempts.filter(time => now - time < this.timeWindow);
    
    if (this.attempts.length >= this.maxAttempts) {
      return false;
    }
    
    this.attempts.push(now);
    return true;
  }

  getRemainingTime() {
    if (this.attempts.length === 0) return 0;
    const oldestAttempt = Math.min(...this.attempts);
    const remainingTime = this.timeWindow - (Date.now() - oldestAttempt);
    return Math.max(0, Math.ceil(remainingTime / 1000));
  }
}

export const loginRateLimiter = new RateLimiter();

export default { 
  protectPage, 
  updateUserAvatar, 
  logout, 
  setupLogoutButton,
  handlePostLoginRedirect,
  setupMobileMenu,
  loginRateLimiter,
  auth, 
  db 
};
