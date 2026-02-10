// auth-guard.js
// Authentication and protection system - Silicon Valley Edition
// Handles auth, subscription verification, admin detection, and page locking

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

// Admin UIDs - centralized whitelist
export const ADMIN_UIDS = ['U4PvQ0dilBco97hgXp3Awl45JX92', 'liMx3vjGGrgAta12IlKclq3Xwvr2'];

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * Check if user is admin
 */
export function isUserAdmin(uid) {
    return ADMIN_UIDS.includes(uid);
}

/**
 * Protect a page - requires authentication + payment
 * Now with smooth locked overlay for non-subscribers
 */
export function protectPage(options = {}) {
    const {
        onSuccess,
        onFailure,
        requirePayment = true,
        allowAdmin = true  // Admins can bypass payment requirement
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
            const isAdmin = isUserAdmin(user.uid);

            // Check payment if required (admins bypass if allowAdmin is true)
            if (requirePayment) {
                const isPaid = userData.isPaid === true || userData.subscriptionStatus === 'active';

                if (!isPaid && !(allowAdmin && isAdmin)) {
                    console.warn('🔒 User not paid - showing locked overlay');
                    showLockedOverlay();
                    return;
                }
            }

            // Success! Add user metadata
            userData.isAdmin = isAdmin;
            console.log('✅ Auth check passed', isAdmin ? '(Admin)' : '');
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

/**
 * Inject the locked page overlay CSS and HTML
 * This provides a smooth, modern locking experience
 */
export function injectLockedPageOverlay() {
    // Don't inject if already exists
    if (document.getElementById('arcane-locked-overlay')) return;

    const styles = document.createElement('style');
    styles.id = 'arcane-locked-styles';
    styles.textContent = `
        #arcane-locked-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(10, 10, 10, 0.95);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            animation: arcaneLockedFadeIn 0.4s ease forwards;
        }

        @keyframes arcaneLockedFadeIn {
            to { opacity: 1; }
        }

        .arcane-locked-container {
            text-align: center;
            padding: 3rem;
            max-width: 480px;
            animation: arcaneLockedSlideUp 0.5s ease forwards;
            animation-delay: 0.1s;
            opacity: 0;
            transform: translateY(30px);
        }

        @keyframes arcaneLockedSlideUp {
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .arcane-locked-icon {
            font-size: 5rem;
            margin-bottom: 1.5rem;
            animation: arcaneLockedPulse 2s ease-in-out infinite;
        }

        @keyframes arcaneLockedPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }

        .arcane-locked-title {
            font-size: 2rem;
            font-weight: 800;
            background: linear-gradient(135deg, #a78bfa, #9333ea);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 1rem;
        }

        .arcane-locked-message {
            color: #a1a1a1;
            font-size: 1.125rem;
            line-height: 1.6;
            margin-bottom: 2rem;
        }

        .arcane-locked-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 1rem 2rem;
            border-radius: 12px;
            font-weight: 700;
            font-size: 1rem;
            text-decoration: none;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            margin: 0.5rem;
        }

        .arcane-locked-btn-primary {
            background: linear-gradient(135deg, #9333ea, #7e22ce);
            color: white;
            border: none;
        }

        .arcane-locked-btn-primary:hover {
            transform: translateY(-3px);
            box-shadow: 0 15px 40px rgba(147, 51, 234, 0.4);
        }

        .arcane-locked-btn-secondary {
            background: transparent;
            border: 1px solid rgba(148, 163, 184, 0.3);
            color: #a1a1a1;
        }

        .arcane-locked-btn-secondary:hover {
            border-color: #9333ea;
            color: #a78bfa;
            background: rgba(147, 51, 234, 0.1);
        }

        .arcane-locked-features {
            margin-top: 2.5rem;
            padding-top: 2rem;
            border-top: 1px solid rgba(148, 163, 184, 0.2);
        }

        .arcane-locked-features-title {
            font-size: 0.875rem;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-bottom: 1rem;
        }

        .arcane-locked-features-list {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 0.75rem;
        }

        .arcane-locked-feature {
            background: rgba(147, 51, 234, 0.1);
            border: 1px solid rgba(147, 51, 234, 0.3);
            padding: 0.5rem 1rem;
            border-radius: 50px;
            font-size: 0.875rem;
            color: #a78bfa;
        }
    `;
    document.head.appendChild(styles);

    const overlay = document.createElement('div');
    overlay.id = 'arcane-locked-overlay';
    overlay.innerHTML = `
        <div class="arcane-locked-container">
            <div class="arcane-locked-icon">🔒</div>
            <h1 class="arcane-locked-title">Premium Content</h1>
            <p class="arcane-locked-message">
                This feature requires an active Arcane Archives subscription.
                Unlock access to the complete vault and start your transformation today.
            </p>
            <div>
                <a href="index.html#pricing" class="arcane-locked-btn arcane-locked-btn-primary">
                    ⚡ Unlock Access
                </a>
                <a href="dashboard.html" class="arcane-locked-btn arcane-locked-btn-secondary">
                    ← Back to Dashboard
                </a>
            </div>
            <div class="arcane-locked-features">
                <div class="arcane-locked-features-title">What you'll unlock</div>
                <div class="arcane-locked-features-list">
                    <span class="arcane-locked-feature">📚 3,330+ Modules</span>
                    <span class="arcane-locked-feature">📈 Live Alerts</span>
                    <span class="arcane-locked-feature">⚡ Daily Insights</span>
                    <span class="arcane-locked-feature">🎙️ Live Calls</span>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

/**
 * Show the locked overlay
 */
export function showLockedOverlay() {
    injectLockedPageOverlay();
}

/**
 * Add smooth page transition
 */
export function addPageTransition() {
    // Don't inject if already exists
    if (document.getElementById('arcane-page-transition')) return;

    const styles = document.createElement('style');
    styles.id = 'arcane-transition-styles';
    styles.textContent = `
        #arcane-page-transition {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #0a0a0a;
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: opacity 0.3s ease;
        }

        #arcane-page-transition.hidden {
            opacity: 0;
            pointer-events: none;
        }

        .arcane-loader {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1.5rem;
        }

        .arcane-loader-spinner {
            width: 48px;
            height: 48px;
            border: 3px solid rgba(147, 51, 234, 0.2);
            border-top-color: #9333ea;
            border-radius: 50%;
            animation: arcaneLoaderSpin 0.8s linear infinite;
        }

        @keyframes arcaneLoaderSpin {
            to { transform: rotate(360deg); }
        }

        .arcane-loader-text {
            color: #a1a1a1;
            font-size: 0.875rem;
            font-weight: 500;
        }
    `;
    document.head.appendChild(styles);

    const transition = document.createElement('div');
    transition.id = 'arcane-page-transition';
    transition.innerHTML = `
        <div class="arcane-loader">
            <div class="arcane-loader-spinner"></div>
            <span class="arcane-loader-text">Loading...</span>
        </div>
    `;
    document.body.appendChild(transition);

    // Hide after page loads
    setTimeout(() => {
        transition.classList.add('hidden');
    }, 100);
}

// Auto-add page transition on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addPageTransition);
} else {
    addPageTransition();
}

console.log('✅ auth-guard.js loaded (enhanced)');