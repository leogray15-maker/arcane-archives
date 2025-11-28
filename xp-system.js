// xp-system.js
// Central XP + course completion utilities for The Arcane Archives

import { db } from "./universal-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// 🔮 XP reward values for different actions (BASE amounts, before multiplier)
export const XP_REWARDS = {
  MODULE_COMPLETED: 50,      // Per module completed
  COURSE_COMPLETED: 100,     // Bonus when all modules in a course are done
  WIN_POSTED: 75,            // Posting a win
  LIVE_CALL_ATTENDED: 50,    // Attending a live call
  REFERRAL_SIGNUP: 50,       // When someone signs up with your ref
  REFERRAL_ACTIVE: 200,      // When referral becomes paying member
  DAILY_LOGIN: 10,           // Daily login streak
};

// 🧬 Level thresholds – NEW RANKS
export const LEVELS = {
  SEEKER: {
    min: 0,
    max: 199,
    name: "Seeker",
    icon: "🕯️",
  },
  APPRENTICE: {
    min: 200,
    max: 599,
    name: "Apprentice",
    icon: "📘",
  },
  ADVANCED_APPRENTICE: {
    min: 600,
    max: 1499,
    name: "Advanced Apprentice",
    icon: "📗",
  },
  AWAKENED_APPRENTICE: {
    min: 1500,
    max: 2999,
    name: "Awakened Apprentice",
    icon: "📙",
  },
  AWAKENED_MASTER: {
    min: 3000,
    max: 4999,
    name: "Awakened Master",
    icon: "⚡",
  },
  ARCANE_MASTER: {
    min: 5000,
    max: Infinity,
    name: "Arcane Master",
    icon: "👑",
  },
};

export function getLevelFromXP(xp = 0) {
  for (const level of Object.values(LEVELS)) {
    if (xp >= level.min && xp <= level.max) {
      return level.name;
    }
  }
  return "Seeker";
}

// 🔥 Streak multiplier: every 7 days adds +10% XP, capped at 2x
export function getStreakMultiplier(loginStreak = 0) {
  if (!loginStreak || loginStreak < 1) return 1;
  const tiers = Math.floor(loginStreak / 7);
  const multiplier = 1 + tiers * 0.1;
  return Math.min(multiplier, 2);
}

// For the dashboard XP bar
export function getProgressToNextLevel(xp = 0) {
  const currentLevel = Object.values(LEVELS).find(
    (level) => xp >= level.min && xp <= level.max
  );

  if (!currentLevel || currentLevel.max === Infinity) {
    return {
      current: xp,
      total: xp || 1,
      percentage: 100,
      nextLevelXP: xp,
    };
  }

  const current = xp - currentLevel.min;
  const total = currentLevel.max - currentLevel.min + 1;
  const percentage = Math.min(100, Math.round((current / total) * 100));
  const nextLevelXP = currentLevel.max + 1;

  return { current, total, percentage, nextLevelXP };
}

export async function getUserStats(uid) {
  const userRef = doc(db, "Users", uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    const base = {
      Xp: 0,
      Level: "Seeker",
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
  const xp = data.Xp || 0;

  return {
    id: uid,
    Xp: xp,
    Level: getLevelFromXP(xp),
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

// 🎮 Central XP award – handles wins/calls/daily login
export async function awardXP(uid, action, metadata = {}) {
  const baseXP = XP_REWARDS[action];
  if (!baseXP) {
    console.warn(`Unknown XP action: ${action}`);
    return false;
  }

  const userRef = doc(db, "Users", uid);
  const snap = await getDoc(userRef);
  const currentData = snap.exists() ? snap.data() : {};

  const currentXP = currentData.Xp || 0;
  const oldLevel = getLevelFromXP(currentXP);
  const loginStreak = currentData.loginStreak || 0;

  const multiplier = getStreakMultiplier(loginStreak);
  const gainedXP = Math.round(baseXP * multiplier);

  const newXP = currentXP + gainedXP;
  const newLevel = getLevelFromXP(newXP);

  const updates = {
    Xp: newXP,
    Level: newLevel,
    updatedAt: serverTimestamp(),
  };

  if (action === "WIN_POSTED") {
    updates.WinsPosted = increment(1);
  } else if (action === "LIVE_CALL_ATTENDED") {
    updates.CallAttended = increment(1);
  }

  await setDoc(userRef, updates, { merge: true });

  if (oldLevel !== newLevel) {
    console.log(`🎉 LEVEL UP! ${oldLevel} → ${newLevel}`);
  }

  console.log(
    `✅ Awarded ${gainedXP} XP (base ${baseXP} x${multiplier.toFixed(
      1
    )}) for ${action}. New total: ${newXP} XP (${newLevel})`
  );
  return true;
}

// ✅ Mark module completed (with XP and counter update)
export async function markModuleCompleted(uid, courseId, moduleId) {
  const userRef = doc(db, "Users", uid);
  const snap = await getDoc(userRef);
  const data = snap.exists() ? snap.data() : {};

  const completedModuleIds = Array.isArray(data.completedModuleIds)
    ? data.completedModuleIds
    : [];

  const fullModuleId = `${courseId}::${moduleId}`;

  if (completedModuleIds.includes(fullModuleId)) {
    return { alreadyCompleted: true };
  }

  // Calculate XP with streak multiplier
  const loginStreak = data.loginStreak || 0;
  const multiplier = getStreakMultiplier(loginStreak);
  const baseXP = XP_REWARDS.MODULE_COMPLETED;
  const gainedXP = Math.round(baseXP * multiplier);

  const currentXP = data.Xp || 0;
  const newXP = currentXP + gainedXP;
  const newLevel = getLevelFromXP(newXP);

  await setDoc(
    userRef,
    {
      Xp: newXP,
      Level: newLevel,
      completedModuleIds: arrayUnion(fullModuleId),
      ModulesCompleted: increment(1),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`✅ Module completed: +${gainedXP} XP (base ${baseXP} x${multiplier.toFixed(1)})`);
  return { alreadyCompleted: false };
}

// ❌ Unmark module (deduct XP)
export async function unmarkModuleCompleted(uid, courseId, moduleId) {
  const userRef = doc(db, "Users", uid);
  const snap = await getDoc(userRef);
  const data = snap.exists() ? snap.data() : {};

  const completedModuleIds = Array.isArray(data.completedModuleIds)
    ? data.completedModuleIds
    : [];

  const fullModuleId = `${courseId}::${moduleId}`;

  if (!completedModuleIds.includes(fullModuleId)) {
    return { alreadyCompleted: false };
  }

  // Deduct base XP (no multiplier on removal for simplicity)
  const baseXP = XP_REWARDS.MODULE_COMPLETED || 0;
  const currentXP = data.Xp || 0;
  const newXP = Math.max(0, currentXP - baseXP);
  const newLevel = getLevelFromXP(newXP);

  const currentModules =
    typeof data.ModulesCompleted === "number" ? data.ModulesCompleted : 0;
  const newModules = currentModules > 0 ? currentModules - 1 : 0;

  const updates = {
    Xp: newXP,
    Level: newLevel,
    ModulesCompleted: newModules,
    completedModuleIds: arrayRemove(fullModuleId),
    updatedAt: serverTimestamp(),
  };

  await setDoc(userRef, updates, { merge: true });

  console.log(`❌ Module uncompleted: -${baseXP} XP`);
  return { alreadyCompleted: true };
}

// 🏆 Mark course completed (with XP bonus)
export async function markCourseCompleted(uid, courseId) {
  const userRef = doc(db, "Users", uid);
  const snap = await getDoc(userRef);
  const data = snap.exists() ? snap.data() : {};

  const currentCompleted = Array.isArray(data.completedCourseIds)
    ? data.completedCourseIds
    : [];

  if (currentCompleted.includes(courseId)) {
    return false;
  }

  // Calculate bonus XP with streak multiplier
  const loginStreak = data.loginStreak || 0;
  const multiplier = getStreakMultiplier(loginStreak);
  const baseXP = XP_REWARDS.COURSE_COMPLETED;
  const gainedXP = Math.round(baseXP * multiplier);

  const currentXP = data.Xp || 0;
  const newXP = currentXP + gainedXP;
  const newLevel = getLevelFromXP(newXP);

  await setDoc(
    userRef,
    {
      Xp: newXP,
      Level: newLevel,
      completedCourseIds: arrayUnion(courseId),
      CoursesCompleted: increment(1),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`🏆 Course completed: +${gainedXP} XP (base ${baseXP} x${multiplier.toFixed(1)})`);
  return true;
}

// 📉 Unmark course (deduct bonus XP)
export async function unmarkCourseCompleted(uid, courseId) {
  const userRef = doc(db, "Users", uid);
  const snap = await getDoc(userRef);
  const data = snap.exists() ? snap.data() : {};

  const completedCourseIds = Array.isArray(data.completedCourseIds)
    ? data.completedCourseIds
    : [];

  if (!completedCourseIds.includes(courseId)) {
    return false;
  }

  // Deduct base course XP
  const baseXP = XP_REWARDS.COURSE_COMPLETED || 0;
  const currentXP = data.Xp || 0;
  const newXP = Math.max(0, currentXP - baseXP);
  const newLevel = getLevelFromXP(newXP);

  const currentCourses =
    typeof data.CoursesCompleted === "number" ? data.CoursesCompleted : 0;
  const newCourses = currentCourses > 0 ? currentCourses - 1 : 0;

  const updates = {
    Xp: newXP,
    Level: newLevel,
    CoursesCompleted: newCourses,
    completedCourseIds: arrayRemove(courseId),
    updatedAt: serverTimestamp(),
  };

  await setDoc(userRef, updates, { merge: true });

  console.log(`📉 Course uncompleted: -${baseXP} XP`);
  return true;
}

// 🔥 Daily login streak + auto XP
export async function updateLoginStreak(uid) {
  const userRef = doc(db, "Users", uid);
  const snap = await getDoc(userRef);
  const data = snap.exists() ? snap.data() : {};

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const lastLoginDate =
    data.lastLoginDate && data.lastLoginDate.toDate
      ? data.lastLoginDate.toDate()
      : null;

  let loginStreak = data.loginStreak || 0;

  if (!lastLoginDate) {
    loginStreak = 1;
  } else {
    const lastStr = lastLoginDate.toISOString().slice(0, 10);

    if (lastStr === todayStr) {
      return; // Already logged in today
    }

    const diffMs = today - lastLoginDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      loginStreak += 1;
    } else {
      loginStreak = 1;
    }
  }

  await awardXP(uid, "DAILY_LOGIN");

  await updateDoc(userRef, {
    loginStreak,
    lastLoginDate: serverTimestamp(),
  });

  console.log(`🔥 Login streak updated: ${loginStreak} days`);
}