// user-init.js
// User profile initialization with referral tracking

import { db } from './auth-guard.js';
import { 
    doc, 
    setDoc, 
    getDoc,
    serverTimestamp,
    updateDoc,
    increment
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

export async function ensureUserProfile(user) {
    if (!user) return;

    const userRef = doc(db, "Users", user.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
        console.log("User profile already exists for:", user.uid);
        
        // Update last login
        await updateDoc(userRef, {
            lastLoginDate: serverTimestamp()
        });
        
        return;
    }

    // New user - create profile
    const email = user.email;
    const username = user.displayName || email.split("@")[0];
    
    // Generate default referral code (first 8 chars of UID)
    const defaultReferralCode = user.uid.slice(0, 8).toUpperCase();

    // Check for referral code in session storage
    let referredBy = null;
    let referredAt = null;
    
    try {
        const storedReferralCode = sessionStorage.getItem('referralCode');
        if (storedReferralCode) {
            referredBy = storedReferralCode.toUpperCase();
            referredAt = serverTimestamp();
            sessionStorage.removeItem('referralCode');
        }
    } catch (e) {
        console.warn('Could not read referral code from session:', e);
    }

    const newUserData = {
        Username: username,
        Email: email,
        referralCode: defaultReferralCode,
        subscriptionStatus: "none",
        isPaid: false,
        stripeCustomerId: null,
        joinedAt: serverTimestamp(),
        lastLoginDate: serverTimestamp()
    };

    // Add referral info if present
    if (referredBy) {
        newUserData.referredBy = referredBy;
        newUserData.referredAt = referredAt;
    }

    await setDoc(userRef, newUserData);
    console.log("🔥 New user profile created:", username);
    
    // If user was referred, update referrer's stats
    if (referredBy) {
        try {
            await updateReferrerStats(referredBy);
        } catch (error) {
            console.error('Error updating referrer stats:', error);
        }
    }
}

async function updateReferrerStats(referralCode) {
    // Find user with this referral code
    const usersQuery = query(
        collection(db, 'Users'),
        where('referralCode', '==', referralCode)
    );
    
    const snapshot = await getDocs(usersQuery);
    
    if (snapshot.empty) {
        console.log('Referrer not found for code:', referralCode);
        return;
    }
    
    const referrerId = snapshot.docs[0].id;
    
    // Update or create Affiliates document
    const affiliateRef = doc(db, 'Affiliates', referrerId);
    const affiliateDoc = await getDoc(affiliateRef);
    
    if (affiliateDoc.exists()) {
        // Update existing
        await updateDoc(affiliateRef, {
            totalReferrals: increment(1),
            lastUpdated: serverTimestamp()
        });
    } else {
        // Create new
        await setDoc(affiliateRef, {
            userId: referrerId,
            referralCode: referralCode,
            availableBalance: 0,
            pendingBalance: 0,
            totalEarnings: 0,
            totalWithdrawn: 0,
            activeReferrals: 0,
            totalReferrals: 1,
            createdAt: serverTimestamp(),
            lastUpdated: serverTimestamp()
        });
    }
    
    console.log('✅ Updated referrer stats for:', referralCode);
}