// ============================================
// ARCANE ARCHIVES - CENTRALIZED AUTH GUARD
// ============================================

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

// Init
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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
        // 1) Not logged in → send to login
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

        // 2) Load Firestore profile
        const userDocRef = doc(db, 'Users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
          console.error('❌ User document not found in Firestore');

          // Treat as unpaid: push to pricing
          if (redirectToPricing) {
            window.location.href = 'index.html#pricing';
          }

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

        const hasActiveSubscription = userData.subscriptionStatus === 'active';
        const isPaid = userData.isPaid === true;

        // 3) No active sub → HARD REDIRECT TO PRICING (no popup)
        if (!hasActiveSubscription && !isPaid) {
          console.warn('🔒 User has not paid for access');

          if (redirectToPricing) {
            window.location.href = 'index.html#pricing';
          }

          if (onFailure) onFailure('PAYMENT_REQUIRED');
          reject(new Error('PAYMENT_REQUIRED'));
          return;
        }

        // 4) All good
        console.log('✅ Access granted to user:', user.uid);
        if (onSuccess) onSuccess(user, userData);
        resolve({ user, userData });

      } catch (error) {
        console.error('❌ Auth error:', error);

        if (onFailure) onFailure('AUTH_ERROR', error);
        reject(error);
      }
    });
  });
}

// ============================================
// UTILITIES
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
