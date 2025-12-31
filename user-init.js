// user-init.js
// Clean referral system (NO XP, Stripe-ready)

import { db } from './auth-guard.js';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

/**
 * Create user profile on first signup
 */
export async function ensureUserProfile(user) {
  if (!user) return;

  const userRef = doc(db, 'Users', user.uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) return;

  const email = user.email;
  const username = user.displayName || email.split('@')[0];

  // Clean referral code (short + readable)
  const referralCode = user.uid.slice(0, 8).toUpperCase();

  // Capture referral from URL
  const urlParams = new URLSearchParams(window.location.search);
  const referredBy = urlParams.get('ref');

  await setDoc(userRef, {
    Username: username,
    Email: email,

    // Stripe
    subscriptionStatus: 'none',
    isPaid: false,
    stripeCustomerId: null,
    stripeSubscriptionId: null,

    // Referral system
    referralCode,
    referredBy: referredBy || null,
    referralConverted: false,
    referralConvertedAt: null,

    // Meta
    joinedAt: serverTimestamp(),
    lastLoginDate: serverTimestamp(),
    role: 'member'
  });

  console.log('🔥 User created:', username);

  if (referredBy) {
    console.log('👥 Referred by:', referredBy);
  }
}

/**
 * Call AFTER Stripe subscription becomes ACTIVE
 * (from webhook or success page)
 */
export async function handleReferralConversion(userId) {
  if (!userId) return;

  const userRef = doc(db, 'Users', userId);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) return;

  const userData = userSnap.data();

  // Stop if no referral or already converted
  if (!userData.referredBy || userData.referralConverted) return;

  // Find referrer by referralCode
  const usersRef = collection(db, 'Users');
  const q = query(usersRef, where('referralCode', '==', userData.referredBy));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    console.warn('Referrer not found:', userData.referredBy);
    return;
  }

  const referrerDoc = snapshot.docs[0];
  const referrerRef = doc(db, 'Users', referrerDoc.id);

  // Mark referral as converted
  await updateDoc(userRef, {
    referralConverted: true,
    referralConvertedAt: serverTimestamp()
  });

  // Track referral success on referrer
  await updateDoc(referrerRef, {
    successfulReferrals: (referrerDoc.data().successfulReferrals || 0) + 1
  });

  console.log('✅ Referral conversion completed');
}
