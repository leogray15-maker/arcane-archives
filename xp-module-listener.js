// xp-module-listener.js
// Listens for aa:moduleToggle events and updates XP + stats.

import { auth, db } from "./auth-guard.js";
import {
  doc,
  updateDoc,
  increment,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

let currentUserId = null;

function handleModuleToggle(detail) {
  if (!currentUserId) return;

  const { completed, course } = detail;

  const moduleDelta = completed ? 1 : -1; // ModulesCompleted
  let xpDelta = completed ? 25 : -25;
  let courseCountDelta = 0;

  // Check if this toggle flips the whole course from incomplete <-> complete
  if (course && typeof course.completed === "boolean") {
    const nowCompleted = !!course.completed;
    const wasCompleted = !!course.previouslyCompleted;

    if (!wasCompleted && nowCompleted) {
      xpDelta += 100;
      courseCountDelta += 1;
    } else if (wasCompleted && !nowCompleted) {
      xpDelta -= 100;
      courseCountDelta -= 1;
    }
  }

  if (xpDelta === 0 && moduleDelta === 0 && courseCountDelta === 0) return;

  const userRef = doc(db, "Users", currentUserId);

  // 🔥 Use field names that match your Firestore rules exactly
  updateDoc(userRef, {
    Xp: increment(xpDelta),
    ModulesCompleted: increment(moduleDelta),
    CoursesCompleted: increment(courseCountDelta),
  }).catch((err) => {
    console.error("[AA] Failed to update XP for module toggle", err);
  });
}

function attachListeners() {
  document.addEventListener("aa:moduleToggle", (evt) => {
    try {
      handleModuleToggle(evt.detail || {});
    } catch (e) {
      console.error("[AA] moduleToggle handler error", e);
    }
  });
}

onAuthStateChanged(auth, (user) => {
  currentUserId = user ? user.uid : null;
  if (user) {
    attachListeners();
  }
});
