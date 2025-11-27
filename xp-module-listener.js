// xp-module-listener.js
// Listens for module toggle events and syncs them with Firestore XP + profile data

import { auth } from "./auth-guard.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  markModuleCompleted,
  unmarkModuleCompleted
} from "./xp-system.js";

let currentUserId = null;
let listenersAttached = false;

async function handleModuleToggle(detail) {
  if (!currentUserId) return;

  const { courseId, moduleId, completed } = detail || {};

  if (!courseId || !moduleId) {
    console.warn("[Arcane] Missing courseId or moduleId", detail);
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
    console.error("[Arcane] XP sync error", err);
  }
}

function attachListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  document.addEventListener("aa:moduleToggle", (event) => {
    try {
      handleModuleToggle(event.detail || {});
    } catch (err) {
      console.error("[Arcane] Module toggle handler crashed", err);
    }
  });
}

onAuthStateChanged(auth, (user) => {
  currentUserId = user ? user.uid : null;

  if (user) {
    attachListeners();
  }
});
