// xp-system.js
// Central XP + course completion utilities for The Arcane Archives

import { db } from "./auth-guard.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment,
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// XP reward values for different actions
export const XP_REWARDS = {
  MODULE_COMPLETED: 50,      // Per module completed
  COURSE_COMPLETED: 100,     // Bonus when all modules in a course are done
  WIN_POSTED: 75,            // Posting a win
  LIVE_CALL_ATTENDED: 50,    // Attending a live call
  REFERRAL_SIGNUP: 50,       // When someone signs up with your ref
  REFERRAL_ACTIVE: 200,      // When referral becomes paying member
  DAILY_LOGIN: 10,           // Daily login streak
};

// Level thresholds
export const LEVELS = {
  APPRENTICE: { min: 0, max: 499, name: "Apprentice", icon: "🎯" },
  SCHOLAR: { min: 500, max: 1499, name: "Scholar", icon: "📚" },
  ADEPT: { min: 1500, max: 2999, name: "Adept", icon: "⚡" },
  MASTER: { min: 3000, max: 4999, name: "Master", icon: "🔮" },
  ARCHMAGE: { min: 5000, max: Infinity, name: "Archmage", icon: "👑" },
};

// Get level based on XP
export function getLevelFromXP(xp) {
  for (const [key, level] of Object.entries(LEVELS)) {
    if (xp >= level.min && xp <= level.max) {
      return level.name;
    }
  }
  return "Apprentice";
}

// Get progress to next level
export function getProgressToNextLevel(xp) {
  const currentLevel = Object.values(LEVELS).find(
    level => xp >= level.min && xp <= level.max
  );
  
  if (!currentLevel || currentLevel.max === Infinity) {
    return { current: xp, total: xp, percentage: 100 };
  }

  const current = xp - currentLevel.min;
  const total = currentLevel.max - currentLevel.min + 1;
  const percentage = Math.min(100, Math.round((current / total) * 100));

  return { current, total, percentage };
}

// Ensure a sane user doc exists and return merged stats
export async function getUserStats(uid) {
  const userRef = doc(db, "Users", uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    const base = {
      Xp: 0,
      Level: "Apprentice",
      CoursesCompleted: 0,
      ModulesCompleted: 0,
      completedCourseIds: [],
      completedModuleIds: [],
      WinsPosted: 0,
      CallAttended: 0,
      loginStreak: 0,
      lastLoginDate: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(userRef, base, { merge: true });
    return {
      id: uid,
      ...base,
      completedCourseIds: [],
      completedModuleIds: [],
    };
  }

  const data = snap.data() || {};
  return {
    id: uid,
    Xp: data.Xp || 0,
    Level: data.Level || "Apprentice",
    CoursesCompleted: data.CoursesCompleted || 0,
    ModulesCompleted: data.ModulesCompleted || 0,
    completedCourseIds: data.completedCourseIds || [],
    completedModuleIds: data.completedModuleIds || [],
    WinsPosted: data.WinsPosted || 0,
    CallAttended: data.CallAttended || 0,
    loginStreak: data.loginStreak || 0,
    lastLoginDate: data.lastLoginDate,
    ...data,
  };
}

// Award XP for any action
export async function awardXP(uid, action, metadata = {}) {
  const xpAmount = XP_REWARDS[action];
  if (!xpAmount) {
    console.warn(`Unknown XP action: ${action}`);
    return false;
  }

  const userRef = doc(db, "Users", uid);
  const snap = await getDoc(userRef);
  const currentData = snap.exists() ? snap.data() : {};
  
  const currentXP = currentData.Xp || 0;
  const oldLevel = currentData.Level || "Apprentice";
  const newXP = currentXP + xpAmount;
  const newLevel = getLevelFromXP(newXP);

  const updates = {
    Xp: newXP,
    Level: newLevel,
    updatedAt: serverTimestamp(),
  };

  // Track specific action counts
  if (action === 'WIN_POSTED') {
    updates.WinsPosted = increment(1);
  } else if (action === 'LIVE_CALL_ATTENDED') {
    updates.CallAttended = increment(1);
  } else if (action === 'MODULE_COMPLETED') {
    updates.ModulesCompleted = increment(1);
  }

  await setDoc(userRef, updates, { merge: true });

  // Log level up
  if (oldLevel !== newLevel) {
    console.log(`🎉 LEVEL UP! ${oldLevel} → ${newLevel}`);
  }

  console.log(`✅ Awarded ${xpAmount} XP for ${action}. New total: ${newXP} XP (${newLevel})`);
  return true;
}

// Mark a module as completed
export async function markModuleCompleted(uid, courseId, moduleId) {
  const userRef = doc(db, "Users", uid);
  const snap = await getDoc(userRef);
  const data = snap.exists() ? snap.data() : {};

  const completedModuleIds = Array.isArray(data.completedModuleIds)
    ? data.completedModuleIds
    : [];

  const fullModuleId = `${courseId}::${moduleId}`;

  // Already completed - no double XP
  if (completedModuleIds.includes(fullModuleId)) {
    return { alreadyCompleted: true, courseCompleted: false };
  }

  // Award module XP
  await awardXP(uid, 'MODULE_COMPLETED');

  // Add to completed modules
  await setDoc(
    userRef,
    {
      completedModuleIds: arrayUnion(fullModuleId),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return { alreadyCompleted: false, courseCompleted: false };
}

// Mark a course as completed for a user + award XP ONCE
export async function markCourseCompleted(uid, courseId) {
  const userRef = doc(db, "Users", uid);
  const snap = await getDoc(userRef);
  const data = snap.exists() ? snap.data() : {};

  const currentCompleted = Array.isArray(data.completedCourseIds)
    ? data.completedCourseIds
    : [];

  // Already counted → no XP double-dip
  if (currentCompleted.includes(courseId)) {
    return false;
  }

  // Award course completion bonus
  await awardXP(uid, 'COURSE_COMPLETED');

  await setDoc(
    userRef,
    {
      CoursesCompleted: increment(1),
      completedCourseIds: arrayUnion(courseId),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return true;
}

// Check and update daily login streak
export async function updateLoginStreak(uid) {
  const userRef = doc(db, "Users", uid);
  const snap = await getDoc(userRef);
  const data = snap.exists() ? snap.data() : {};

  const lastLogin = data.lastLoginDate?.toDate ? data.lastLoginDate.toDate() : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let shouldAwardXP = false;
  let newStreak = data.loginStreak || 0;

  if (!lastLogin) {
    // First ever login
    newStreak = 1;
    shouldAwardXP = true;
  } else {
    const lastLoginDate = new Date(lastLogin);
    lastLoginDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((today - lastLoginDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Same day - no change
      return;
    } else if (diffDays === 1) {
      // Next day - continue streak
      newStreak += 1;
      shouldAwardXP = true;
    } else {
      // Streak broken
      newStreak = 1;
      shouldAwardXP = true;
    }
  }

  await setDoc(
    userRef,
    {
      loginStreak: newStreak,
      lastLoginDate: serverTimestamp(),
    },
    { merge: true }
  );

  if (shouldAwardXP) {
    await awardXP(uid, 'DAILY_LOGIN');
  }
}

// Get module progress for a specific course
export async function getCourseProgress(uid, courseId) {
  const userRef = doc(db, "Users", uid);
  const snap = await getDoc(userRef);
  
  if (!snap.exists()) {
    return { completedModules: [], totalModules: 0, percentage: 0 };
  }

  const data = snap.data();
  const completedModuleIds = data.completedModuleIds || [];
  
  const courseModules = completedModuleIds.filter(id => id.startsWith(`${courseId}::`));
  
  return {
    completedModules: courseModules.map(id => id.split('::')[1]),
    totalCompleted: courseModules.length,
  };
}