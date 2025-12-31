// user-init.js
// User profile initialization (NO XP SYSTEM)

import { db } from './auth-guard.js';
import { 
    doc, 
    setDoc, 
    getDoc,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

export async function ensureUserProfile(user) {
    if (!user) return;

    const userRef = doc(db, "Users", user.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
        console.log("User profile already exists for:", user.uid);
        return;
    }

    const email = user.email;
    const username = user.displayName || email.split("@")[0];

    const newUserData = {
        Username: username,
        Email: email,
        subscriptionStatus: "none",
        isPaid: false,
        stripeCustomerId: null,
        joinedAt: serverTimestamp(),
        lastLoginDate: serverTimestamp()
    };

    await setDoc(userRef, newUserData);
    console.log("🔥 New user profile created:", username);
}