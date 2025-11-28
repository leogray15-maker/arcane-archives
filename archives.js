// archives.js
// Arcane Archives – course progress + XP badge

import { protectPage } from "./auth-guard.js";
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
      const stats = await getUserStats(user.uid);
      if (!stats) return;

      updateProgressDisplay(stats);
      markCompletedCourses(stats.completedCourseIds || []);
      updateUserLevel(stats.Xp || 0); // ✅ Pass XP, not stored Level
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
    typeof stats.CoursesCompleted === "number"
      ? stats.CoursesCompleted
      : (stats.completedCourseIds || []).length;

  const percentage =
    totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0;

  const totalXP = stats.Xp || 0;
  const modulesCompleted = stats.ModulesCompleted || 0;

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
 */
function updateUserLevel(xp) {
  // ✅ ALWAYS calculate level from XP
  const level = getLevelFromXP(xp);
  const progress = getProgressToNextLevel(xp);

  const titleEl = document.querySelector(".page-title");
  if (!titleEl) return;

  let badge = document.getElementById("user-level-badge");

  // Create badge once and insert just under the title
  if (!badge) {
    badge = document.createElement("div");
    badge.id = "user-level-badge";
    badge.style.marginTop = "0.5rem";
    badge.style.display = "inline-flex";
    badge.style.alignItems = "center";
    badge.style.gap = "0.5rem";
    badge.style.padding = "0.35rem 0.85rem";
    badge.style.borderRadius = "999px";
    badge.style.border = "1px solid rgba(147, 51, 234, 0.8)";
    badge.style.background = "rgba(15, 23, 42, 0.96)";
    badge.style.fontSize = "0.85rem";
    badge.style.color = "#e5e5e5";
    badge.style.boxShadow = "0 4px 12px rgba(147, 51, 234, 0.25)";

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
    <span style="font-size: 1.1rem;">${icon}</span>
    <span>Level: <strong style="color:#a78bfa;">${level}</strong></span>
    <span style="font-size: 0.75rem; color:#9ca3af;">
      ${xp.toLocaleString()} XP${pctText ? " • " + pctText : ""}
    </span>
  `;
}

function getLevelIcon(level) {
  const icons = {
    "Seeker": "🕯️",
    "Beginner": "📿",
    "Apprentice": "📘",
    "Advanced Apprentice": "📗",
    "Awakened Apprentice": "📙",
    "Journeyman": "⚒️",
    "Expert": "🎯",
    "Veteran": "⚔️",
    "Elite": "🛡️",
    "Master": "⚡",
    "Advanced Master": "💫",
    "Awakened Master": "✨",
    "Grandmaster": "👑",
    "Neo": "🕶️",
    "Conqueror": "🏆",
    "Champion": "🔥",
    "Titan": "💪",
    "Legend": "⭐",
    "Mythic": "🌟",
    "Immortal": "💀",
    "Aura": "⚡",
    "Escapee": "🚪",
    "Ascendant": "🦅",
    "Supreme": "👁️",
    "Divine": "💎",
    "Celestial": "✨",
    "Arcane Sovereign": "🔱",
    "Arcane Master": "👁️‍🗨️",
  };
  return icons[level] || "🕯️";
}