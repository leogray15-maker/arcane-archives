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

// Derive page defaults from URL + title
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
  if (!user) return state;

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
    if (!buttons.length) return;

    let state = loadState();
    
    // Wait for auth and sync with Firestore
    if (auth.currentUser) {
      state = await syncWithFirestore(state);
    } else {
      // Wait for auth to initialize
      await new Promise(resolve => {
        const unsubscribe = auth.onAuthStateChanged(user => {
          unsubscribe();
          resolve();
        });
      });
      state = await syncWithFirestore(state);
    }

    const defaults = derivePageDefaults();

    buttons.forEach((button, index) => {
      const courseId = button.dataset.courseId || defaults.courseId;

      const rawModuleId =
        button.dataset.moduleId ||
        (index === 0 ? defaults.moduleId : `${defaults.moduleId}-${index + 1}`);
      const moduleId = slugify(rawModuleId) || `module-${index + 1}`;

      const key = getModuleKey(courseId, moduleId);
      const completed = !!state.modules[key];

      // Save IDs back onto button
      button.dataset.courseId = courseId;
      button.dataset.moduleId = moduleId;

      applyButtonState(button, completed);

      button.addEventListener("click", async () => {
        const current = !!state.modules[key];
        const next = !current;

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

        document.dispatchEvent(
          new CustomEvent("aa:moduleToggle", { detail })
        );

        // Check if course is now complete
        await checkCourseCompletion(courseId, state);
      });
    });
  } catch (err) {
    console.error("[AA] initModuleTracker error", err);
  }
}

// Check if all modules in a course are completed
async function checkCourseCompletion(courseId, state) {
  const allButtons = Array.from(document.querySelectorAll(".aa-pill-button"));
  const courseButtons = allButtons.filter(btn => btn.dataset.courseId === courseId);
  
  if (courseButtons.length === 0) return;

  const completed = courseButtons.every(btn => {
    const key = getModuleKey(btn.dataset.courseId, btn.dataset.moduleId);
    return state.modules[key] === true;
  });

  const previouslyCompleted = window.__aaLastCourseState?.[courseId] || false;
  window.__aaLastCourseState = window.__aaLastCourseState || {};
  window.__aaLastCourseState[courseId] = completed;

  if (completed && !previouslyCompleted) {
    // Course just became complete
    document.dispatchEvent(
      new CustomEvent("aa:courseComplete", {
        detail: { courseId }
      })
    );
  } else if (!completed && previouslyCompleted) {
    // Course became incomplete
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