// archives.js
// Arcane Archives – course progress + XP badge

import { protectPage } from "./universal-auth.js";
import {
  getUserStats,
  XP_REWARDS,
  getLevelFromXP,
  getProgressToNextLevel,
} from "./xp-system.js";

// Protect page: must be logged in + paid (universal-auth handles that)
protectPage({
  onSuccess: async (user, userData) => {
    try {
      // Prefer the same data the dashboard uses (userData),
      // fall back to getUserStats if needed
      let stats = null;

      if (userData) {
        // If userData already looks like a stats object, use it directly.
        if (
          typeof userData.xp === "number" ||
          typeof userData.coursesCompleted === "number" ||
          Array.isArray(userData.completedCourseIds)
        ) {
          stats = userData;
        } else if (userData.stats) {
          // or nested stats
          stats = userData.stats;
        }
      }

      if (!stats) {
        stats = await getUserStats(user.uid);
      }

      if (!stats) return;

      updateProgressDisplay(stats);
      markCompletedCourses(stats.completedCourseIds || []);
      updateUserLevel(stats.xp || 0);
    } catch (err) {
      console.error("Error loading archive stats:", err);
    }
  },
  onFailure: () => {
    // If not allowed in, send back to login
    window.location.href = "login.html";
  },
});

/**
 * Update the purple "Your Progress" box
 */
function updateProgressDisplay(stats) {
  const totalCourses = document.querySelectorAll("figure.link-to-page").length;

  const completedCourses =
    typeof stats.coursesCompleted === "number"
      ? stats.coursesCompleted
      : (stats.completedCourseIds || []).length;

  const percentage =
    totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0;

  const totalXP = typeof stats.xp === "number" ? stats.xp : 0;
  const modulesCompleted =
    typeof stats.modulesCompleted === "number" ? stats.modulesCompleted : 0;

  const progressContainer = document.getElementById("courseProgressStats");
  const progressBar = document.getElementById("progressBar");
  const progressPercentage = document.getElementById("progressPercentage");
  const coursesCompletedText = document.getElementById("coursesCompletedText");
  const xpEarnedText = document.getElementById("xpEarnedText");

  if (!progressContainer) return;

  progressContainer.style.display = "block";

  if (progressBar) progressBar.style.width = `${percentage}%`;
  if (progressPercentage) progressPercentage.textContent = `${percentage}%`;

  if (coursesCompletedText) {
    coursesCompletedText.textContent = `${completedCourses} of ${totalCourses} courses completed`;
  }

  if (xpEarnedText) {
    xpEarnedText.textContent = `${totalXP.toLocaleString()} Total XP • ${modulesCompleted} Modules Completed`;
  }
}

/**
 * Mark completed courses visually inside the list
 * (uses your existing .completed CSS + ✓ ::after)
 */
function markCompletedCourses(completedCourseIds) {
  const completedSet = new Set(completedCourseIds || []);

  document.querySelectorAll("figure.link-to-page").forEach((figure) => {
    const courseId = figure.getAttribute("data-course-id");
    if (!courseId) return;

    if (completedSet.has(courseId)) {
      const link = figure.querySelector("a");
      if (!link) return;

      link.classList.add("completed");
    }
  });
}

/**
 * XP / Level badge under the title (non-floating, mobile-safe)
 * Uses the same XP + level logic as dashboard via getLevelFromXP().
 */
function updateUserLevel(xpRaw) {
  const xp = typeof xpRaw === "number" ? xpRaw : 0;
  const level = getLevelFromXP(xp);
  const progress = getProgressToNextLevel(xp);

  const titleEl = document.querySelector(".page-title");
  if (!titleEl) return;

  let badge = document.getElementById("user-level-badge");

  // Create badge once and insert just under the title
  if (!badge) {
    badge = document.createElement("div");
    badge.id = "user-level-badge";
    badge.style.marginTop = "0.45rem";
    badge.style.display = "inline-flex";
    badge.style.alignItems = "center";
    badge.style.gap = "0.45rem";
    badge.style.padding = "0.25rem 0.75rem";
    badge.style.borderRadius = "999px";
    badge.style.border = "1px solid rgba(147, 51, 234, 0.85)";
    badge.style.background =
      "radial-gradient(circle at top left, rgba(147,51,234,0.35), rgba(15,23,42,0.96))";
    badge.style.fontSize = "0.8rem";
    badge.style.color = "#e5e5e5";
    badge.style.boxShadow = "0 8px 30px rgba(15,23,42,0.9)";
    badge.style.backdropFilter = "blur(10px)";

    // Lives inside header, directly under the H1
    titleEl.insertAdjacentElement("afterend", badge);
  }

  const icon = getLevelIcon(level);

  let pctText = "";
  if (progress && typeof progress.percentage === "number") {
    const pct = Math.round(progress.percentage);
    pctText = pct < 100 ? `${pct}% to next` : "MAX";
  }

  badge.innerHTML = `
    <span style="font-size: 1rem;">${icon}</span>
    <span>Level: <strong style="color:#a78bfa;">${level}</strong></span>
    <span style="font-size: 0.7rem; color:#9ca3af;">
      ${xp.toLocaleString()} XP${pctText ? " • " + pctText : ""}
    </span>
  `;
}

/**
 * Level icons – supports your new ladder:
 * Seeker → Apprentice → Advanced Apprentice → Awakened Apprentice → Awakened Master → Arcane Master
 * and also falls back to older names if they still exist in the DB.
 */
function getLevelIcon(level) {
  const map = {
    // New system
    Seeker: "📜",
    Apprentice: "🪄",
    "Advanced Apprentice": "⚔️",
    "Awakened Apprentice": "🌌",
    "Awakened Master": "🔮",
    "Arcane Master": "👑",

    // Old names (if any user still has them)
    Scholar: "📚",
    Adept: "⚡",
    Master: "🔮",
    Archmage: "👑",
  };

  return map[level] || "📜";
}
