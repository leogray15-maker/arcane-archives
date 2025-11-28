// course-module-tracker.js
// Tracks per-module completion with Firestore sync + localStorage backup
// Emits events that xp-module-listener.js catches

import { auth } from "./universal-auth.js";
import { getUserStats } from "./xp-system.js";

const STORAGE_KEY = "aa_module_progress_v2";

function slugify(text) {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { modules: {} };
    
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { modules: {} };
    }
    return {
      modules:
        parsed.modules && typeof parsed.modules === "object"
          ? parsed.modules
          : {},
    };
  } catch (err) {
    console.warn("[AA] Failed to load module progress from localStorage", err);
    return { modules: {} };
  }
}

function saveState(state) {
  try {
    const payload = {
      modules: state.modules || {},
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("[AA] Failed to save module progress to localStorage", err);
  }
}

function getModuleKey(courseId, moduleId) {
  return `${courseId}::${moduleId}`;
}

function applyButtonState(button, completed) {
  if (!button) return;

  button.dataset.completed = completed ? "true" : "false";

  let primary = button.querySelector(".aa-pill-primary");
  let secondary = button.querySelector(".aa-pill-secondary");

  if (!primary) {
    primary = document.createElement("span");
    primary.className = "aa-pill-primary";
    button.appendChild(primary);
  }
  if (!secondary) {
    secondary = document.createElement("span");
    secondary.className = "aa-pill-secondary";
    button.appendChild(secondary);
  }

  if (completed) {
    button.classList.add("aa-pill-button--completed");
    primary.textContent = "✅ Module Completed";
    secondary.textContent = "+50 XP awarded";
  } else {
    button.classList.remove("aa-pill-button--completed");
    primary.textContent = "Complete Module";
    secondary.textContent = "+50 XP";
  }
}

function derivePageDefaults() {
  const body = document.body || document.documentElement;
  const bodyCourse = body.getAttribute("data-aa-course");
  const bodyModule = body.getAttribute("data-aa-module");

  const urlPath = window.location.pathname || "";
  const segments = urlPath.split("/").filter(Boolean);

  const rawCourse =
    segments.length > 1 ? segments[segments.length - 2] : segments[0] || "course";
  const rawModule =
    document.querySelector("h1, .page-title")?.textContent ||
    document.title ||
    "module";

  const courseId = bodyCourse || slugify(rawCourse);
  const moduleId = bodyModule || slugify(rawModule);

  return { courseId, moduleId };
}

// Sync localStorage state with Firestore on page load
async function syncWithFirestore(state) {
  const user = auth.currentUser;
  if (!user) {
    console.warn("[AA] No user logged in, skipping Firestore sync");
    return state;
  }

  try {
    const stats = await getUserStats(user.uid);
    const firestoreModules = stats.completedModuleIds || [];

    // Merge: Firestore is source of truth
    const merged = { modules: {} };
    
    firestoreModules.forEach(fullId => {
      merged.modules[fullId] = true;
    });

    // Save merged state back to localStorage
    saveState(merged);
    console.log("[AA] Synced with Firestore:", firestoreModules.length, "modules");
    return merged;

  } catch (err) {
    console.warn("[AA] Could not sync with Firestore, using localStorage", err);
    return state;
  }
}

// Initialize buttons on the current page
export async function initModuleTracker() {
  try {
    const buttons = Array.from(document.querySelectorAll(".aa-pill-button"));
    if (!buttons.length) {
      console.log("[AA] No module buttons found on page");
      return;
    }

    console.log("[AA] Found", buttons.length, "module buttons");

    let state = loadState();
    
    // 🔥 CRITICAL: Wait for auth to be ready
    const user = await new Promise((resolve) => {
      if (auth.currentUser) {
        resolve(auth.currentUser);
      } else {
        const unsubscribe = auth.onAuthStateChanged((user) => {
          unsubscribe();
          resolve(user);
        });
      }
    });

    if (!user) {
      console.warn("[AA] No user logged in after auth check");
      return;
    }

    console.log("[AA] User authenticated:", user.uid);
    
    // Store user globally for xp-module-listener
    window.currentUser = user;

    // Sync with Firestore
    state = await syncWithFirestore(state);

    const defaults = derivePageDefaults();
    console.log("[AA] Course defaults:", defaults);

    // ✅ Get the courseId from the FIRST button (all buttons on same page = same course)
    const mainCourseId = buttons[0].dataset.courseId || defaults.courseId;

    buttons.forEach((button, index) => {
      // ✅ All buttons on this page belong to the SAME course
      const courseId = mainCourseId;

      const rawModuleId =
        button.dataset.moduleId ||
        (index === 0 ? defaults.moduleId : `${defaults.moduleId}-${index + 1}`);
      const moduleId = slugify(rawModuleId) || `module-${index + 1}`;

      const key = getModuleKey(courseId, moduleId);
      const completed = !!state.modules[key];

      // Save IDs back onto button
      button.dataset.courseId = courseId;
      button.dataset.moduleId = moduleId;

      console.log("[AA] Button", index, ":", courseId, "/", moduleId, "- completed:", completed);

      applyButtonState(button, completed);

      button.addEventListener("click", async () => {
        const current = !!state.modules[key];
        const next = !current;

        console.log("[AA] Button clicked:", courseId, "/", moduleId, "- toggle to:", next);

        // Update localStorage immediately for snappy UI
        state.modules[key] = next;
        saveState(state);
        applyButtonState(button, next);

        // Dispatch event for XP system to handle Firestore
        const detail = {
          courseId,
          moduleId,
          completed: next,
        };

        console.log("[AA] Dispatching aa:moduleToggle event:", detail);

        document.dispatchEvent(
          new CustomEvent("aa:moduleToggle", { detail })
        );

        // ✅ Check if THIS PAGE's modules are all complete
        await checkPageCompletion(courseId, state, buttons);
      });
    });

    console.log("[AA] Module tracker initialized successfully");
  } catch (err) {
    console.error("[AA] initModuleTracker error", err);
  }
}

// ✅ NEW: Check if all modules on THIS PAGE are completed (not the whole course)
async function checkPageCompletion(courseId, state, pageButtons) {
  // Check if ALL buttons on this page are completed
  const allCompleted = pageButtons.every(btn => {
    const key = getModuleKey(btn.dataset.courseId, btn.dataset.moduleId);
    return state.modules[key] === true;
  });

  const pageCompletionKey = `__page_${courseId}_${window.location.pathname}`;
  const previouslyCompleted = window[pageCompletionKey] || false;
  window[pageCompletionKey] = allCompleted;

  // ✅ Only fire course complete if ALL modules on this page are done
  // AND we haven't already marked this course as complete
  if (allCompleted && !previouslyCompleted) {
    // Check if this course was already completed in Firestore
    const user = window.currentUser;
    if (user) {
      const stats = await getUserStats(user.uid);
      const completedCourses = stats.completedCourseIds || [];
      
      if (!completedCourses.includes(courseId)) {
        console.log("[AA] 🏆 All modules on page completed - marking course complete:", courseId);
        document.dispatchEvent(
          new CustomEvent("aa:courseComplete", {
            detail: { courseId }
          })
        );
      } else {
        console.log("[AA] Course already completed in Firestore:", courseId);
      }
    }
  } else if (!allCompleted && previouslyCompleted) {
    // User unchecked a module - uncomplete the course
    console.log("[AA] 📉 Module unchecked - unmarking course:", courseId);
    document.dispatchEvent(
      new CustomEvent("aa:courseUncomplete", {
        detail: { courseId }
      })
    );
  }
}

// Helper for dashboards/archives
export function getStoredCourseProgress() {
  const state = loadState();
  const modules = state.modules || {};
  const courses = {};

  Object.entries(modules).forEach(([fullKey, completed]) => {
    const [courseId, moduleId] = fullKey.split("::");
    if (!courseId || !moduleId) return;

    if (!courses[courseId]) {
      courses[courseId] = {
        totalModules: 0,
        completedModules: 0,
        completed: false,
      };
    }

    const course = courses[courseId];
    course.totalModules += 1;
    if (completed) {
      course.completedModules += 1;
    }
  });

  Object.values(courses).forEach((course) => {
    course.completed =
      course.totalModules > 0 && course.completedModules === course.totalModules;
  });

  return courses;
}

// Auto-init
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initModuleTracker());
  } else {
    initModuleTracker();
  }
}