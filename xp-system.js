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

export const XP_VALUES = {
  COURSE_COMPLETED: 100, // tweak if you want more/less XP per finished course
};

// Ensure a sane user doc exists and return merged stats
export async function getUserStats(uid) {
  const userRef = doc(db, "Users", uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    const base = {
      xp: 0,
      level: "Apprentice",
      coursesCompleted: 0,
      completedCourseIds: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(userRef, base, { merge: true });
    return {
      id: uid,
      ...base,
      completedCourseIds: [],
    };
  }

  const data = snap.data() || {};
  return {
    id: uid,
    xp: data.xp || 0,
    level: data.level || "Apprentice",
    coursesCompleted: data.coursesCompleted || 0,
    completedCourseIds: data.completedCourseIds || [],
    ...data,
  };
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

  await setDoc(
    userRef,
    {
      xp: increment(XP_VALUES.COURSE_COMPLETED),
      coursesCompleted: increment(1),
      completedCourseIds: arrayUnion(courseId),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return true;
}
