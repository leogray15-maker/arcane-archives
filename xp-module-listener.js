// xp-module-listener.js
// Listens for aa:moduleToggle events from course-module-tracker.js
// and updates Firestore XP + stats.
//
// XP rules:
//   +25 XP when module completed
//   -25 XP when module un-ticked
//   +100 XP when course flips incomplete -> complete
//   -100 XP when course flips complete -> incomplete

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

  const moduleDelta = completed ? 1 : -1; // modulesCompleted
  let xpDelta = completed ? 25 : -25;
  let courseCountDelta = 0;

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

  updateDoc(userRef, {
    xp: increment(xpDelta),
    modulesCompleted: increment(moduleDelta),
    coursesCompleted: increment(courseCountDelta),
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
