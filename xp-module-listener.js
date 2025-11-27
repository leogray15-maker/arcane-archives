// xp-module-listener.js
// Listens ONLY for course completion events (not individual modules)
// Module completion is handled directly by course-modules.js

import { auth, db } from "./auth-guard.js";
import {
  doc,
  updateDoc,
  increment,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

let currentUserId = null;

// ✅ This now ONLY handles course completion events
// Module events are handled by the xp-system.js directly
function handleCourseCompletion(detail) {
  if (!currentUserId) return;

  const { courseId, completed } = detail;
  if (!courseId) return;

  const userRef = doc(db, "Users", currentUserId);

  if (completed) {
    // Course was just completed
    updateDoc(userRef, {
      Xp: increment(100), // Course completion bonus
      CoursesCompleted: increment(1),
    }).catch((err) => {
      console.error("[AA] Failed to update XP for course completion", err);
    });
  } else {
    // Course was uncompleted (rare, but handle it)
    updateDoc(userRef, {
      Xp: increment(-100),
      CoursesCompleted: increment(-1),
    }).catch((err) => {
      console.error("[AA] Failed to update XP for course uncompletion", err);
    });
  }
}

function attachListeners() {
  // Only listen for course-level events
  document.addEventListener("aa:courseToggle", (evt) => {
    try {
      handleCourseCompletion(evt.detail || {});
    } catch (e) {
      console.error("[AA] courseToggle handler error", e);
    }
  });
}

onAuthStateChanged(auth, (user) => {
  currentUserId = user ? user.uid : null;
  if (user) {
    attachListeners();
  }
});