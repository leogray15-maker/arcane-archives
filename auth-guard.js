// auth-guard.js
// Authentication and protection system (NO XP)

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import { 
    getAuth, 
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    getDoc 
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

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
 * Protect a page - requires authentication + payment
 */
export function protectPage(options = {}) {
    const {
        onSuccess,
        onFailure,
        requirePayment = true
    } = options;

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            console.warn('🔒 No user authenticated');
            if (onFailure) onFailure();
            else window.location.href = 'login.html';
            return;
        }

        try {
            const userRef = doc(db, 'Users', user.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                console.warn('🔒 User profile not found');
                if (onFailure) onFailure();
                else window.location.href = 'login.html';
                return;
            }

            const userData = userSnap.data();

            // Check payment if required
            if (requirePayment) {
                const isPaid = userData.isPaid === true || userData.subscriptionStatus === 'active';
                
                if (!isPaid) {
                    console.warn('🔒 User not paid');
                    alert('🔒 This page requires an active subscription.');
                    window.location.href = 'index.html#pricing';
                    return;
                }
            }

            // Success!
            console.log('✅ Auth check passed');
            if (onSuccess) onSuccess(user, userData);

        } catch (error) {
            console.error('❌ Auth error:', error);
            if (onFailure) onFailure();
            else window.location.href = 'login.html';
        }
    });
}

/**
 * Check if user is authenticated (no payment check)
 */
export function checkAuth(callback) {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            callback(null, null);
            return;
        }

        try {
            const userRef = doc(db, 'Users', user.uid);
            const userSnap = await getDoc(userRef);
            const userData = userSnap.exists() ? userSnap.data() : null;
            callback(user, userData);
        } catch (error) {
            console.error('Error checking auth:', error);
            callback(null, null);
        }
    });
}

/**
 * Update user profile display
 */
export function updateUserAvatar(user, userData) {
    const username = userData?.Username || user.displayName || user.email.split('@')[0];
    
    // Update all username displays
    const usernameElements = document.querySelectorAll('[data-username]');
    usernameElements.forEach(el => {
        el.textContent = username;
    });
}

// Login rate limiting
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
            const attempts = JSON.parse(stored);
            const now = Date.now();
            return attempts.filter(time => now - time < this.windowMs);
        } catch {
            return [];
        }
    }

    saveAttempts() {
        try {
            localStorage.setItem('login_attempts', JSON.stringify(this.attempts));
        } catch (error) {
            console.error('Failed to save rate limit data:', error);
        }
    }

    addAttempt() {
        this.attempts.push(Date.now());
        this.saveAttempts();
    }

    isAllowed() {
        const now = Date.now();
        this.attempts = this.attempts.filter(time => now - time < this.windowMs);
        return this.attempts.length < this.maxAttempts;
    }

    getRemainingTime() {
        if (this.attempts.length === 0) return 0;
        const oldestAttempt = Math.min(...this.attempts);
        const timeElapsed = Date.now() - oldestAttempt;
        return Math.max(0, this.windowMs - timeElapsed);
    }

    reset() {
        this.attempts = [];
        this.saveAttempts();
    }
}

export const loginRateLimiter = new RateLimiter();

console.log('✅ auth-guard.js loaded');