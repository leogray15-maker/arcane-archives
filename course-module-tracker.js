// course-module-tracker.js
// Tracks per-module completion for Arcane Archives.
// Uses localStorage as the single source of truth and emits a DOM event
// so the XP system + dashboard/archives can react.
//
// Event:
//   "aa:moduleToggle" detail = {
//      courseId: string,
//      moduleId: string,
//      completed: boolean
//   }

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
    if (!raw) {
      return { modules: {} };
    }
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

// Try to derive sensible default IDs from URL + page title.
// You can override these by adding data attributes:
//
//   <body data-aa-course="mind-hijacking" data-aa-module="read-before-starting">
//
function derivePageDefaults() {
  const body = document.body || document.documentElement;

  const bodyCourse = body.getAttribute("data-aa-course");
  const bodyModule = body.getAttribute("data-aa-module");

  const urlPath = window.location.pathname || "";
  const segments = urlPath.split("/").filter(Boolean);

  // Heuristic: parent folder = course, file name / title = module
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

// Initialise buttons on the current page.
export function initModuleTracker() {
  try {
    const buttons = Array.from(document.querySelectorAll(".aa-pill-button"));
    if (!buttons.length) return;

    const state = loadState();
    const defaults = derivePageDefaults();

    buttons.forEach((button, index) => {
      const courseId = button.dataset.courseId || defaults.courseId;

      // If multiple buttons on a page, give them unique module IDs based on index
      const rawModuleId =
        button.dataset.moduleId ||
        (index === 0 ? defaults.moduleId : `${defaults.moduleId}-${index + 1}`);
      const moduleId = slugify(rawModuleId) || `module-${index + 1}`;

      const key = getModuleKey(courseId, moduleId);
      const completed = !!state.modules[key];

      // Save IDs back onto the button for debugging / other scripts
      button.dataset.courseId = courseId;
      button.dataset.moduleId = moduleId;

      applyButtonState(button, completed);

      button.addEventListener("click", () => {
        const current = !!state.modules[key];
        const next = !current;

        state.modules[key] = next;
        saveState(state);
        applyButtonState(button, next);

        const detail = {
          courseId,
          moduleId,
          completed: next,
        };

        document.dispatchEvent(
          new CustomEvent("aa:moduleToggle", {
            detail,
          })
        );
      });
    });
  } catch (err) {
    console.error("[AA] initModuleTracker error", err);
  }
}

// Helper for dashboards / archives – derive per-course stats from stored modules.
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

// Auto-init when used as a side-effect module
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initModuleTracker());
  } else {
    initModuleTracker();
  }
}
