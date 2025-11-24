// course-completion.js
// Per-course module checklist + completion → updates XP via xp-system

import { auth, db } from "./auth-guard.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { markCourseCompleted } from "./xp-system.js";

// Public entry – used by all course HTML pages
export function autoInitCourseCompletion() {
  const container = document.getElementById("courseCompletionContainer");
  if (!container) return;

  // Detect "course index" pages (lists of submodules) vs pure content pages
  const discovery = discoverCourseModules();
  if (!discovery || discovery.modules.length === 0) {
    // Content page – no checklist UI
    container.style.display = "none";
    return;
  }

  injectStylesOnce();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      container.innerHTML = `
        <div class="aa-course-progress-card">
          <div class="aa-course-progress-header">
            <span class="aa-course-title">${escapeHtml(
              discovery.courseName
            )}</span>
            <span class="aa-course-status">Sign in to track progress</span>
          </div>
        </div>
      `;
      return;
    }

    const progressDoc = await loadCourseProgress(
      user.uid,
      discovery.courseId,
      discovery.modules.length
    );

    renderCourseProgressUI(container, user.uid, discovery, progressDoc);
  });
}

// ------- Discovery: figure out course + modules from URL + DOM -------

function discoverCourseModules() {
  const path = window.location.pathname;
  const segments = path.split("/").filter(Boolean);

  // Example:
  // /notion-export-clean/the%20arcane%20archives/Mind%20HiJacking/index.html
  // → course folder is the segment before the filename
  if (segments.length < 2) return null;

  const filename = decodeURIComponent(segments[segments.length - 1]);
  const courseFolder = decodeURIComponent(segments[segments.length - 2]);

  const courseId = slugify(courseFolder);
  const courseName = courseFolder;

  // Find local .html links = "modules"
  const allLinks = Array.from(document.querySelectorAll("a"));
  const moduleLinks = allLinks.filter((a) => {
    const href = a.getAttribute("href") || "";
    if (!href.endsWith(".html")) return false;
    if (href.startsWith("http")) return false;
    return true;
  });

  // If there are only 0–2 links, it’s probably not a course index page
  if (moduleLinks.length < 3) {
    return null;
  }

  const modules = moduleLinks.map((a, idx) => {
    const href = a.getAttribute("href");
    const fileName = href.split("/").pop().replace(".html", "");
    const id = fileName;
    const title = (a.textContent || `Module ${idx + 1}`).trim();
    return { id, title };
  });

  return { courseId, courseName, modules };
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "");
}

// ------- Firestore helpers for course progress -------

function courseProgressRef(uid, courseId) {
  return doc(db, "courseProgress", `${uid}_${courseId}`);
}

// 🔧 helper: pick the best totalModules value
function normalizeTotalModules(savedValue, discoveredTotal) {
  const saved = Number.isFinite(savedValue) ? savedValue : 0;
  const discovered = Number.isFinite(discoveredTotal)
    ? discoveredTotal
    : 0;
  return Math.max(saved, discovered);
}

async function loadCourseProgress(uid, courseId, discoveredTotal) {
  const ref = courseProgressRef(uid, courseId);
  const snap = await getDoc(ref);

  // No doc yet → create a fresh one using discovered module count
  if (!snap.exists()) {
    const totalModules = normalizeTotalModules(null, discoveredTotal);
    const base = {
      userId: uid,
      courseId,
      completedModules: [],
      totalModules,
      completed: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, base);
    return base;
  }

  // Existing doc → merge with what we see on the page now
  const data = snap.data() || {};
  const completedModules = Array.isArray(data.completedModules)
    ? data.completedModules
    : [];

  const totalModules = normalizeTotalModules(
    data.totalModules,
    discoveredTotal
  );

  const completed = completedModules.length >= totalModules;

  // If we detected that totalModules should be higher, patch the doc
  if (totalModules !== data.totalModules) {
    await setDoc(
      ref,
      {
        totalModules,
        completed,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  return {
    userId: uid,
    courseId,
    completedModules,
    totalModules,
    completed,
  };
}

async function toggleModuleProgress(uid, discovery, moduleId, checked) {
  const ref = courseProgressRef(uid, discovery.courseId);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};

  // Use the largest of "saved total" vs "modules on page now"
  const discoveredTotal = discovery.modules.length;
  const totalModules = normalizeTotalModules(
    data.totalModules,
    discoveredTotal
  );

  const completedSet = new Set(
    Array.isArray(data.completedModules) ? data.completedModules : []
  );

  if (checked) {
    completedSet.add(moduleId);
  } else {
    completedSet.delete(moduleId);
  }

  const completedModules = Array.from(completedSet);
  const completed = completedModules.length >= totalModules;

  await setDoc(
    ref,
    {
      userId: uid,
      courseId: discovery.courseId,
      completedModules,
      totalModules,
      completed,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // If course just flipped from incomplete → complete, award XP
  if (completed && !data.completed) {
    try {
      await markCourseCompleted(uid, discovery.courseId);
    } catch (err) {
      console.error("Error awarding course XP:", err);
    }
  }

  return { completedModules, completed, totalModules };
}

// ------- UI rendering -------

function renderCourseProgressUI(container, uid, discovery, progress) {
  const total = progress.totalModules || discovery.modules.length;
  const done = progress.completedModules.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  container.innerHTML = `
    <div class="aa-course-progress-card">
      <div class="aa-course-progress-header">
        <span class="aa-course-title">${escapeHtml(
          discovery.courseName
        )}</span>
        <span class="aa-course-status">${
          progress.completed ? "✅ Course completed" : `${pct}% complete`
        }</span>
      </div>
      <div class="aa-course-progress-bar">
        <div class="aa-course-progress-bar-inner" style="width:${pct}%;"></div>
      </div>
      <ul class="aa-module-list">
        ${discovery.modules
          .map((m) => {
            const isDone = progress.completedModules.includes(m.id);
            return `
              <li class="aa-module-item">
                <label>
                  <input 
                    type="checkbox" 
                    class="aa-module-checkbox" 
                    data-module-id="${m.id}"
                    ${isDone ? "checked" : ""}
                  />
                  <span>${escapeHtml(m.title)}</span>
                </label>
              </li>
            `;
          })
          .join("")}
      </ul>
      <div class="aa-course-progress-footer">
        <span>${done} of ${total} modules completed</span>
        ${
          progress.completed
            ? `<span class="aa-course-done-pill">XP awarded for this course</span>`
            : ""
        }
      </div>
    </div>
  `;

  container
    .querySelectorAll(".aa-module-checkbox")
    .forEach((checkbox) => {
      checkbox.addEventListener("change", async (e) => {
        const moduleId = e.target.getAttribute("data-module-id");
        const checked = e.target.checked;

        try {
          const updated = await toggleModuleProgress(
            uid,
            discovery,
            moduleId,
            checked
          );
          // re-render with fresh data
          renderCourseProgressUI(container, uid, discovery, updated);
        } catch (err) {
          console.error("Error updating module progress:", err);
        }
      });
    });
}

// ------- Styles & helpers -------

let stylesInjected = false;

function injectStylesOnce() {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement("style");
  style.textContent = `
    .aa-course-progress-card {
      margin: 2rem auto 0 auto;
      max-width: 800px;
      background: radial-gradient(circle at top left, rgba(148, 163, 255, 0.25), rgba(15, 23, 42, 0.9));
      border-radius: 1.25rem;
      border: 1px solid rgba(148, 163, 184, 0.4);
      padding: 1.5rem 1.75rem 1.75rem 1.75rem;
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.65);
      color: #e5e5e5;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
    }
    .aa-course-progress-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 0.75rem;
    }
    .aa-course-title {
      font-size: 1.1rem;
      font-weight: 600;
      letter-spacing: 0.03em;
    }
    .aa-course-status {
      font-size: 0.9rem;
      color: #a78bfa;
      font-weight: 500;
    }
    .aa-course-progress-bar {
      width: 100%;
      height: 8px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.9);
      overflow: hidden;
      margin-bottom: 0.75rem;
      border: 1px solid rgba(148, 163, 184, 0.4);
    }
    .aa-course-progress-bar-inner {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, #4f46e5, #9333ea, #f97316);
      transition: width 0.25s ease-out;
    }
    .aa-module-list {
      list-style: none;
      margin: 0.25rem 0 0.75rem 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 0.35rem 1.25rem;
    }
    .aa-module-item label {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      font-size: 0.85rem;
      cursor: pointer;
      padding: 0.3rem 0.5rem;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.75);
      border: 1px solid rgba(148, 163, 184, 0.25);
    }
    .aa-module-item input[type="checkbox"] {
      width: 14px;
      height: 14px;
      accent-color: #a855f7;
    }
    .aa-course-progress-footer {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      color: #9ca3af;
      margin-top: 0.25rem;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .aa-course-done-pill {
      padding: 0.15rem 0.6rem;
      border-radius: 999px;
      border: 1px solid rgba(34, 197, 94, 0.8);
      color: #bbf7d0;
      background: rgba(22, 163, 74, 0.1);
      font-size: 0.75rem;
      font-weight: 500;
    }
    @media (max-width: 640px) {
      .aa-course-progress-card {
        padding: 1.25rem 1.25rem 1.5rem 1.25rem;
      }
      .aa-course-progress-header {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  `;
  document.head.appendChild(style);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
