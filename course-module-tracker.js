// course-module-tracker.js
// Tracks per-module completion in localStorage and derives per-course completion
// Emits DOM events so other scripts (XP, dashboard, archives) can react.
//
// Events:
//  - "aa:moduleToggle" detail = {
//        courseId, moduleId, completed,
//        course: {
//          totalModules,
//          completedModules,
//          completed,          // course state AFTER toggle
//          previouslyCompleted // course state BEFORE toggle
//        }
//    }
//  - "aa:courseStateChanged" detail = { courseId, state }
//
// Storage format (localStorage[STORAGE_KEY]):
// {
//   modules: { [moduleId]: true|false },
//   courses: {
//     [courseId]: {
//       totalModules: number,
//       completedModules: number,
//       completed: boolean
//     }
//   }
// }

const STORAGE_KEY = "aa_module_progress_v1";

let courseIndexPromise = null;
let moduleToCourseMap = null;

function loadCourseIndex() {
  if (!courseIndexPromise) {
    courseIndexPromise = fetch("/course-index.json")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load course-index.json");
        return res.json();
      })
      .then((index) => {
        moduleToCourseMap = {};
        Object.entries(index).forEach(([courseId, course]) => {
          (course.modules || []).forEach((mod) => {
            if (mod.id) {
              moduleToCourseMap[mod.id] = courseId;
            }
          });
        });
        return index;
      })
      .catch((err) => {
        console.error("[AA] loadCourseIndex error", err);
        return {};
      });
  }
  return courseIndexPromise;
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { modules: {}, courses: {} };
    }
    const parsed = JSON.parse(raw);
    return {
      modules: parsed.modules || {},
      courses: parsed.courses || {},
    };
  } catch (e) {
    console.warn("[AA] Failed to parse module progress, resetting", e);
    return { modules: {}, courses: {} };
  }
}

function saveProgress(progress) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        modules: progress.modules || {},
        courses: progress.courses || {},
      })
    );
  } catch (e) {
    console.warn("[AA] Failed to save module progress", e);
  }
}

function recomputeCourseProgress(progress, courseIndex, courseId) {
  const course = courseIndex[courseId];
  if (!course) return;

  const modules = course.modules || [];
  let completedModules = 0;

  modules.forEach((mod) => {
    if (progress.modules[mod.id]) {
      completedModules += 1;
    }
  });

  const totalModules = modules.length;
  const completed = totalModules > 0 && completedModules === totalModules;

  progress.courses[courseId] = {
    totalModules,
    completedModules,
    completed,
  };

  return progress.courses[courseId];
}

function dispatchModuleToggle(detail) {
  document.dispatchEvent(
    new CustomEvent("aa:moduleToggle", {
      detail,
    })
  );
}

function dispatchCourseState(courseId, state) {
  document.dispatchEvent(
    new CustomEvent("aa:courseStateChanged", {
      detail: {
        courseId,
        state,
      },
    })
  );
}

// PUBLIC: init tracking for a single module page
export async function initModuleTracker(moduleId) {
  try {
    const button =
      document.getElementById("complete-module-btn") ||
      document.querySelector("[data-module-id]");
    if (!button) {
      console.warn("[AA] initModuleTracker: no button found for module", moduleId);
      return;
    }

    // If the button itself carries the id, prefer that
    const effectiveModuleId =
      button.dataset.moduleId && button.dataset.moduleId.trim().length
        ? button.dataset.moduleId.trim()
        : moduleId;

    const index = await loadCourseIndex();
    const courseId = moduleToCourseMap
      ? moduleToCourseMap[effectiveModuleId]
      : null;

    if (!courseId) {
      console.warn(
        "[AA] initModuleTracker: no courseId found for module",
        effectiveModuleId
      );
    }

    const progress = loadProgress();
    // Ensure we have a course entry
    if (courseId && !progress.courses[courseId]) {
      recomputeCourseProgress(progress, index, courseId);
    }

    // Initial UI state
    const initiallyCompleted = !!progress.modules[effectiveModuleId];
    applyButtonState(button, initiallyCompleted);

    // Click handler – toggle completion
    button.addEventListener("click", () => {
      const newCompleted = !progress.modules[effectiveModuleId];
      const prevCourseState =
        courseId && progress.courses[courseId]
          ? { ...progress.courses[courseId] }
          : null;

      progress.modules[effectiveModuleId] = newCompleted;

      let courseState = null;
      if (courseId) {
        courseState = recomputeCourseProgress(progress, index, courseId);
      }

      saveProgress(progress);
      applyButtonState(button, newCompleted);

      if (courseId && courseState) {
        dispatchModuleToggle({
          courseId,
          moduleId: effectiveModuleId,
          completed: newCompleted,
          course: {
            totalModules: courseState.totalModules,
            completedModules: courseState.completedModules,
            completed: courseState.completed,
            previouslyCompleted: prevCourseState
              ? !!prevCourseState.completed
              : false,
          },
        });

        // Fire course state changed event if completion flipped
        const prevCompleted = prevCourseState
          ? !!prevCourseState.completed
          : false;
        if (prevCompleted !== courseState.completed) {
          dispatchCourseState(courseId, courseState);
        }
      } else {
        // Still emit module toggle so XP can react even if courseId missing
        dispatchModuleToggle({
          courseId: courseId || null,
          moduleId: effectiveModuleId,
          completed: newCompleted,
          course: null,
        });
      }
    });
  } catch (err) {
    console.error("[AA] initModuleTracker error", err);
  }
}

function applyButtonState(button, completed) {
  if (!button) return;
  button.classList.toggle("aa-module-completed", completed);

  const primary = button.querySelector(".aa-label-primary");
  const secondary = button.querySelector(".aa-label-secondary");

  if (completed) {
    if (primary) primary.textContent = "✅ Module Completed";
    if (secondary) secondary.textContent = "+25 XP Awarded";
  } else {
    if (primary) primary.textContent = "🟣 Complete Module";
    if (secondary) secondary.textContent = "+25 XP";
  }
}

// Helper for dashboards / archives
export function getStoredCourseProgress() {
  const { courses } = loadProgress();
  return courses || {};
}
