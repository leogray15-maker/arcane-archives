// course-modules.js
// Auto-add "Complete Module" purple pill buttons to every course page

import { protectPage } from "./universal-auth.js";

protectPage({
  onSuccess: (user) => {
    const uid = user.uid;
    const storageKey = `aa_modules_${uid}`;
    const pageKey = window.location.pathname.replace(/^\//, "");

    function slugify(text) {
      return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
    }

    function loadCompletedSet() {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return new Set();
        return new Set(JSON.parse(raw));
      } catch {
        return new Set();
      }
    }

    function saveCompletedSet(set) {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(set)));
    }

    const completed = loadCompletedSet();

    // 1) Find module headings
    // - This is generic: every H2/H3 becomes a "module"
    // - If a heading should NOT be a module, give it data-aa-ignore="true" in the HTML.
    const allHeadings = Array.from(document.querySelectorAll("h2, h3"));
    const moduleHeadings = allHeadings.filter((h) => {
      const txt = (h.textContent || "").trim();
      if (!txt) return false;
      if (h.dataset.aaIgnore === "true") return false;
      // Optional: only treat things containing "Module" or "Lesson" as modules:
      // return /module|lesson/i.test(txt);
      return true;
    });

    if (moduleHeadings.length === 0) return;

    // 2) Optional: add a "Course Progress" pill at very top
    addCourseProgressPill();

    // 3) Enhance each heading with a purple pill button
    moduleHeadings.forEach((heading, index) => {
      const title = (heading.textContent || "").trim();
      const baseId = slugify(title) || `module-${index + 1}`;
      const moduleId = `${pageKey}::${baseId}::${index}`;

      heading.dataset.aaModuleId = moduleId;

      const alreadyDone = completed.has(moduleId);

      const btn = document.createElement("button");
      btn.className = "aa-complete-module-btn";
      btn.textContent = "Complete Module";

      if (alreadyDone) {
        markCompleted(heading, btn);
      }

      btn.addEventListener("click", () => {
        if (completed.has(moduleId)) return;
        completed.add(moduleId);
        saveCompletedSet(completed);
        markCompleted(heading, btn);
        updateCourseProgressPill(moduleHeadings, completed);
      });

      // Insert button right under the heading
      heading.insertAdjacentElement("afterend", btn);
    });

    // Initial progress set
    updateCourseProgressPill(moduleHeadings, completed);

    function markCompleted(heading, btn) {
      btn.classList.add("aa-completed");
      btn.innerHTML = "Completed ✓";
      heading.classList.add("aa-module-heading-completed");
    }

    function addCourseProgressPill() {
      // Try to place it near the first H1 or main title
      const h1 =
        document.querySelector("h1") ||
        document.querySelector(".notion-title") ||
        document.body.querySelector("h2");

      if (!h1) return;

      let pill = document.querySelector(".aa-course-progress-pill");
      if (!pill) {
        pill = document.createElement("div");
        pill.className = "aa-course-progress-pill";
        pill.innerHTML = `
          <span>📘 Course Progress</span>
          <span class="aa-course-progress-text"></span>
        `;
        h1.insertAdjacentElement("afterend", pill);
      }
    }

    function updateCourseProgressPill(moduleHeadings, completedSet) {
      const pillTextEl = document.querySelector(".aa-course-progress-text");
      if (!pillTextEl) return;

      const total = moduleHeadings.length;
      let done = 0;

      moduleHeadings.forEach((h, idx) => {
        const title = (h.textContent || "").trim();
        const baseId = slugify(title) || `module-${idx + 1}`;
        const mid = `${pageKey}::${baseId}::${idx}`;
        if (completedSet.has(mid)) done++;
      });

      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      pillTextEl.textContent = `${done}/${total} modules • ${pct}% complete`;
    }
  },
  onFailure: () => {
    // If someone hits a course URL without being logged in, send to login
    window.location.href = "../login.html";
  },
});
