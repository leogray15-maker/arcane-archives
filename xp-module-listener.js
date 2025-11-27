// xp-module-listener.js
// Bridges module + course toggle events into Firestore XP + stats.
//
// Events from course-module-tracker.js:
//  - "aa:moduleToggle" detail = { courseId, moduleId, completed, course: {...} }
//  - "aa:courseStateChanged" detail = { courseId, state: { completed, previouslyCompleted, ... } }

import { auth } from "./auth-guard.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  markModuleCompleted,
  unmarkModuleCompleted,
  markCourseCompleted,
  unmarkCourseCompleted,
} from "./xp-system.js";

let currentUserId = null;

/**
 * Handle single-module toggle (pill button)
 */
async function handleModuleToggle(detail) {
  if (!currentUserId) return;

  const { courseId, moduleId, completed } = detail || {};
  if (!courseId || !moduleId) {
    console.warn("[Arcane] moduleToggle missing courseId/moduleId", detail);
    return;
  }

  try {
    if (completed) {
      console.log("[Arcane] Marking module completed:", courseId, moduleId);
      await markModuleCompleted(currentUserId, courseId, moduleId);
    } else {
      console.log("[Arcane] Unmarking module completed:", courseId, moduleId);
      await unmarkModuleCompleted(currentUserId, courseId, moduleId);
    }
  } catch (err) {
    console.error("[Arcane] XP module sync error", err);
  }
}

/**
 * Handle whole-course state changes (all modules done / undone)
 */
async function handleCourseStateChanged(detail) {
  if (!currentUserId) return;

  const { courseId, state } = detail || {};
  if (!courseId || !state) return;

  const completed =
    typeof state.completed === "boolean" ? state.completed : false;
  const previouslyCompleted =
    typeof state.previouslyCompleted === "boolean"
      ? state.previouslyCompleted
      : false;

  // Only react when the course actually flips state
  if (completed && !previouslyCompleted) {
    console.log("[Arcane] Marking course completed:", courseId);
    try {
      await markCourseCompleted(currentUserId, courseId);
    } catch (err) {
      console.error("[Arcane] XP course-complete error", err);
    }
  } else if (!completed && previouslyCompleted) {
    console.log("[Arcane] Unmarking course completed:", courseId);
    try {
      await unmarkCourseCompleted(currentUserId, courseId);
    } catch (err) {
      console.error("[Arcane] XP course-uncomplete error", err);
    }
  }
}

/**
 * Attach DOM event listeners – but only once per page load.
 */
function attachListenersOnce() {
  if (window.__AA_XP_LISTENERS_ATTACHED__) {
    // Prevent double listeners (which caused double counting)
    console.log("[Arcane] XP listeners already attached – skipping duplicate.");
    return;
  }
  window.__AA_XP_LISTENERS_ATTACHED__ = true;

  document.addEventListener("aa:moduleToggle", (evt) => {
    try {
      handleModuleToggle(evt.detail || {});
    } catch (err) {
      console.error("[Arcane] moduleToggle handler crashed", err);
    }
  });

  document.addEventListener("aa:courseStateChanged", (evt) => {
    try {
      handleCourseStateChanged(evt.detail || {});
    } catch (err) {
      console.error("[Arcane] courseStateChanged handler crashed", err);
    }
  });

  console.log("[Arcane] XP module listeners attached.");
}

onAuthStateChanged(auth, (user) => {
  currentUserId = user ? user.uid : null;
  if (user) {
    attachListenersOnce();
  }
});
