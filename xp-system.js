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
  MODULE_COMPLETED: 75,      // Per module completed
  WIN_POSTED: 100,           // Posting a win
  LIVE_CALL_ATTENDED: 250,   // Attending a live call
  CHAT_MESSAGE: 10,          // Per chat message (capped at 50/day)
  REFERRAL_SIGNUP: 50,       // When someone signs up with your ref
  REFERRAL_ACTIVE: 200,      // When referral becomes paying member
  DAILY_LOGIN: 10,           // Daily login streak
};

// Daily caps
export const DAILY_CAPS = {
  CHAT_MESSAGES: 50,         // Max 50 messages/day = 500 XP max from chat
};

// 🧬 Level thresholds – 28 RANKS
export const LEVELS = {
  SEEKER: {
    min: 0,
    max: 299,
    name: "Seeker",
    icon: "🕯️",
  },
  BEGINNER: {
    min: 300,
    max: 749,
    name: "Beginner",
    icon: "📿",
  },
  APPRENTICE: {
    min: 750,
    max: 1499,
    name: "Apprentice",
    icon: "📘",
  },
  ADVANCED_APPRENTICE: {
    min: 1500,
    max: 2499,
    name: "Advanced Apprentice",
    icon: "📗",
  },
  AWAKENED_APPRENTICE: {
    min: 2500,
    max: 3999,
    name: "Awakened Apprentice",
    icon: "📙",
  },
  JOURNEYMAN: {
    min: 4000,
    max: 5999,
    name: "Journeyman",
    icon: "⚒️",
  },
  EXPERT: {
    min: 6000,
    max: 8499,
    name: "Expert",
    icon: "🎯",
  },
  VETERAN: {
    min: 8500,
    max: 11499,
    name: "Veteran",
    icon: "⚔️",
  },
  ELITE: {
    min: 11500,
    max: 14999,
    name: "Elite",
    icon: "🛡️",
  },
  MASTER: {
    min: 15000,
    max: 19499,
    name: "Master",
    icon: "⚡",
  },
  ADVANCED_MASTER: {
    min: 19500,
    max: 24499,
    name: "Advanced Master",
    icon: "💫",
  },
  AWAKENED_MASTER: {
    min: 24500,
    max: 29999,
    name: "Awakened Master",
    icon: "✨",
  },
  GRANDMASTER: {
    min: 30000,
    max: 36499,
    name: "Grandmaster",
    icon: "👑",
  },
  NEO: {
    min: 36500,
    max: 43499,
    name: "Neo",
    icon: "🕶️",
  },
  CONQUEROR: {
    min: 43500,
    max: 51499,
    name: "Conqueror",
    icon: "🏆",
  },
  CHAMPION: {
    min: 51500,
    max: 60499,
    name: "Champion",
    icon: "🔥",
  },
  TITAN: {
    min: 60500,
    max: 69999,
    name: "Titan",
    icon: "💪",
  },
  LEGEND: {
    min: 70000,
    max: 79999,
    name: "Legend",
    icon: "⭐",
  },
  MYTHIC: {
    min: 80000,
    max: 89999,
    name: "Mythic",
    icon: "🌟",
  },
  IMMORTAL: {
    min: 90000,
    max: 99999,
    name: "Immortal",
    icon: "💀",
  },
  AURA: {
    min: 100000,
    max: 109999,
    name: "Aura",
    icon: "⚡",
  },
  ESCAPEE: {
    min: 110000,
    max: 119999,
    name: "Escapee",
    icon: "🚪",
  },
  ASCENDANT: {
    min: 120000,
    max: 129999,
    name: "Ascendant",
    icon: "🦅",
  },
  SUPREME: {
    min: 130000,
    max: 139999,
    name: "Supreme",
    icon: "👁️",
  },
  DIVINE: {
    min: 140000,
    max: 149999,
    name: "Divine",
    icon: "💎",
  },
  CELESTIAL: {
    min: 150000,
    max: 164999,
    name: "Celestial",
    icon: "✨",
  },
  ARCANE_SOVEREIGN: {
    min: 165000,
    max: 184999,
    name: "Arcane Sovereign",
    icon: "🔱",
  },
  ARCANE_MASTER: {
    min: 185000,
    max: Infinity,
    name: "Arcane Master",
    icon: "👁️‍🗨️",
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

// 💬 Award XP for chat messages (with daily cap)
export async function awardChatXP(uid) {
  const userRef = doc(db, "Users", uid);
  const snap = await getDoc(userRef);
  const currentData = snap.exists() ? snap.data() : {};

  const today = new Date().toISOString().slice(0, 10);
  const lastChatDate = currentData.lastChatDate || null;
  const chatMessagesToday = currentData.chatMessagesToday || 0;

  // Reset counter if it's a new day
  let newChatCount = chatMessagesToday;
  if (lastChatDate !== today) {
    newChatCount = 0;
  }

  // Check if user has hit daily cap
  if (newChatCount >= DAILY_CAPS.CHAT_MESSAGES) {
    console.log(`⚠️ Daily chat XP cap reached (${DAILY_CAPS.CHAT_MESSAGES} messages)`);
    return false;
  }

  // Award XP
  const baseXP = XP_REWARDS.CHAT_MESSAGE;
  const loginStreak = currentData.loginStreak || 0;
  const multiplier = getStreakMultiplier(loginStreak);
  const gainedXP = Math.round(baseXP * multiplier);

  const currentXP = currentData.Xp || 0;
  const newXP = currentXP + gainedXP;
  const newLevel = getLevelFromXP(newXP);
  const oldLevel = getLevelFromXP(currentXP);

  await setDoc(
    userRef,
    {
      Xp: newXP,
      Level: newLevel,
      chatMessagesToday: newChatCount + 1,
      lastChatDate: today,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  if (oldLevel !== newLevel) {
    console.log(`🎉 LEVEL UP! ${oldLevel} → ${newLevel}`);
  }

  console.log(
    `💬 Chat XP awarded: +${gainedXP} XP (${newChatCount + 1}/${DAILY_CAPS.CHAT_MESSAGES} today)`
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