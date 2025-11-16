// xp-system.js
// Small XP engine for Arcane Archives

import { db } from './auth-guard.js';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  increment 
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

// How much XP each action gives
const XP_CONFIG = {
  community_message: 1,
  win_posted: 5,
  call_attended: 3,
  course_completed: 10
};

// Simple level ladder
const LEVELS = [
  { name: 'Apprentice', minXp: 0 },
  { name: 'Initiate',   minXp: 50 },
  { name: 'Adept',      minXp: 150 },
  { name: 'Magus',      minXp: 400 },
];

function getLevelForXp(xp) {
  let level = LEVELS[0].name;
  for (const l of LEVELS) {
    if (xp >= l.minXp) level = l.name;
  }
  return level;
}

export async function awardXP(userId, actionKey) {
  const amount = XP_CONFIG[actionKey];
  if (!amount) return;

  try {
    const userRef = doc(db, 'Users', userId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      console.warn('No user doc when awarding XP');
      return;
    }

    const data = snap.data();
    const currentXp = data.Xp || 0;
    const newTotal = currentXp + amount;
    const newLevel = getLevelForXp(newTotal);
    const currentLevel = data.Level || 'Apprentice';

    const updateData = {
      Xp: increment(amount)
    };

    if (newLevel !== currentLevel) {
      updateData.Level = newLevel;
    }

    await updateDoc(userRef, updateData);
    console.log(`✨ Awarded ${amount} XP for ${actionKey}. New XP ≈ ${newTotal}, Level = ${newLevel}`);
  } catch (err) {
    console.error('Error awarding XP:', err);
  }
}
