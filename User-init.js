// user-init.js
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

    await setDoc(userRef, {
        Username: username,
        Email: email,
        Xp: 0,
        Level: "Apprentice",
        WinsPosted: 0,
        CallAttended: 0,
        CoursesCompleted: 0,
        subscriptionStatus: "none",
        isPaid: false,
        stripeCustomerId: null,
        joinedAt: serverTimestamp()
    });

    console.log("🔥 New user profile created:", username);
}
