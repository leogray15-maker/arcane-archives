// user-init.js
// Enhanced with referral tracking

import { db } from './auth-guard.js';
import { 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { awardXP } from './xp-system.js';

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
    
    // Generate referral code from UID
    const referralCode = user.uid.slice(0, 8).toUpperCase();
    
    // Check URL for referral parameter
    const urlParams = new URLSearchParams(window.location.search);
    const referredByCode = urlParams.get('ref');

    const newUserData = {
        Username: username,
        Email: email,
        Xp: 0,
        Level: "Seeker",          // 🔮 NEW default rank
        WinsPosted: 0,
        CallAttended: 0,
        CoursesCompleted: 0,
        ModulesCompleted: 0,
        completedCourseIds: [],
        completedModuleIds: [],
        subscriptionStatus: "none",
        isPaid: false,
        stripeCustomerId: null,
        referralCode: referralCode,
        joinedAt: serverTimestamp(),
        lastLoginDate: serverTimestamp(),
        loginStreak: 1
    };

    // If user was referred, add referredBy field
    if (referredByCode) {
        newUserData.referredBy = referredByCode;
        console.log(`👥 User referred by: ${referredByCode}`);
    }

    await setDoc(userRef, newUserData);
    console.log("🔥 New user profile created:", username);

    // Award referral XP to referrer if applicable
    if (referredByCode) {
        await awardReferralXP(referredByCode);
    }
}

// Award XP to the person who made the referral
async function awardReferralXP(referralCode) {
    try {
        // Find user with this referral code
        const { collection, query, where, getDocs } = await import(
            'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js'
        );

        const usersRef = collection(db, 'Users');
        const q = query(usersRef, where('referralCode', '==', referralCode));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.warn('No user found with referral code:', referralCode);
            return;
        }

        const referrerDoc = snapshot.docs[0];
        const referrerId = referrerDoc.id;

        // Award signup XP (50 XP)
        await awardXP(referrerId, 'REFERRAL_SIGNUP');
        console.log(`✅ Awarded 50 XP to referrer: ${referralCode}`);

    } catch (err) {
        console.error('Error awarding referral XP:', err);
    }
}

// Call this when a user upgrades to paid
export async function handleReferralUpgrade(userId) {
    try {
        const userRef = doc(db, 'Users', userId);
        const snap = await getDoc(userRef);
        
        if (!snap.exists()) return;
        
        const userData = snap.data();
        const referredByCode = userData.referredBy;
        
        if (!referredByCode) {
            console.log('User was not referred');
            return;
        }

        // Find referrer and award active referral bonus
        const { collection, query, where, getDocs } = await import(
            'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js'
        );

        const usersRef = collection(db, 'Users');
        const q = query(usersRef, where('referralCode', '==', referredByCode));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.warn('Referrer not found:', referredByCode);
            return;
        }

        const referrerDoc = snapshot.docs[0];
        const referrerId = referrerDoc.id;

        // Award active referral bonus (200 XP)
        await awardXP(referrerId, 'REFERRAL_ACTIVE');
        console.log(`✅ Awarded 200 XP to referrer for active referral: ${referredByCode}`);

        // Update user to mark referral as processed
        await updateDoc(userRef, {
            referralXPAwarded: true,
            referralAwardedAt: serverTimestamp()
        });

    } catch (err) {
        console.error('Error handling referral upgrade:', err);
    }
}
