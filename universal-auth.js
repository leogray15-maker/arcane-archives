// universal-auth.js - Bulletproof authentication for all pages
// Use this on EVERY page that requires login + subscription

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

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
export const auth = getAuth(app);
export const db = getFirestore(app);

// Check if user is logged in AND has paid subscription
export function protectPage(options = {}) {
    const { requirePaid = true, onSuccess, onFailure } = options;

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            console.log('❌ Not logged in - redirecting to login');
            if (onFailure) onFailure();
            else window.location.href = 'login.html';
            return;
        }

        // User is logged in, now check if they've paid
        if (requirePaid) {
            try {
                const userRef = doc(db, 'Users', user.uid);
                const userSnap = await getDoc(userRef);

                if (!userSnap.exists()) {
                    console.log('❌ No user data - redirecting');
                    if (onFailure) onFailure();
                    else window.location.href = 'login.html';
                    return;
                }

                const userData = userSnap.data();
                const isPaid = userData.isPaid === true || userData.subscriptionStatus === 'active';

                if (!isPaid) {
                    console.log('❌ Not subscribed - redirecting to payment');
                    window.location.href = 'index.html#pricing';
                    return;
                }

                // ✅ User is logged in AND paid
                console.log('✅ Access granted:', user.email);
                if (onSuccess) onSuccess(user, userData);

            } catch (err) {
                console.error('Error checking subscription:', err);
                if (onFailure) onFailure();
                else window.location.href = 'login.html';
            }
        } else {
            // No payment check required, just logged in
            if (onSuccess) onSuccess(user);
        }
    });
}

// Update avatar across entire site
export function updateUserAvatar(user, userData) {
    const avatarElements = document.querySelectorAll('.user-avatar, .welcome-avatar, #welcomeAvatar');
    const usernameElements = document.querySelectorAll('.user-name, #username');

    const username = userData?.Username || user?.displayName || user?.email?.split('@')[0] || 'User';
    const customAvatar = localStorage.getItem('customAvatarUrl');
    const emojiAvatar = localStorage.getItem('userAvatar');

    avatarElements.forEach(el => {
        if (customAvatar) {
            el.style.backgroundImage = `url(${customAvatar})`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
            el.textContent = '';
        } else if (emojiAvatar) {
            el.style.backgroundImage = 'none';
            el.textContent = emojiAvatar;
        } else {
            el.style.backgroundImage = 'none';
            el.textContent = username.charAt(0).toUpperCase();
        }
    });

    usernameElements.forEach(el => {
        el.textContent = username;
    });
}

// Export for use in other modules
export { doc, getDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";