// archives.js
// Course library with progress tracking and XP integration

import { protectPage } from "./universal-auth.js";
import { getUserStats, XP_REWARDS, getLevelFromXP, getProgressToNextLevel } from "./xp-system.js";

protectPage({
  onSuccess: async (user, userData) => {
    // Get user stats
    const stats = await getUserStats(user.uid);
    if (stats) {
      updateProgressDisplay(stats);
      markCompletedCourses(stats.completedCourseIds);
      updateUserLevel(stats.xp);
    }
  },
  onFailure: () => {
    window.location.href = "login.html";
  }
});

function updateProgressDisplay(stats) {
  const totalCourses = document.querySelectorAll('.link-to-page').length;
  const completedCourses = stats.coursesCompleted;
  const percentage = totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0;

  // Calculate XP from different sources
  const moduleXP = (stats.modulesCompleted || 0) * XP_REWARDS.MODULE_COMPLETED;
  const courseXP = completedCourses * XP_REWARDS.COURSE_COMPLETED;
  const totalXP = stats.xp || 0;

  const progressContainer = document.getElementById('courseProgressStats');
  const progressBar = document.getElementById('progressBar');
  const progressPercentage = document.getElementById('progressPercentage');
  const coursesCompletedText = document.getElementById('coursesCompletedText');
  const xpEarnedText = document.getElementById('xpEarnedText');

  if (progressContainer) {
    progressContainer.style.display = 'block';
    if (progressBar) progressBar.style.width = `${percentage}%`;
    if (progressPercentage) progressPercentage.textContent = `${percentage}%`;
    if (coursesCompletedText) {
      coursesCompletedText.textContent = `${completedCourses} of ${totalCourses} courses completed`;
    }
    if (xpEarnedText) {
      xpEarnedText.textContent = `${totalXP.toLocaleString()} Total XP • ${stats.modulesCompleted || 0} Modules Completed`;
    }
  }
}

function markCompletedCourses(completedCourseIds) {
  document.querySelectorAll('.link-to-page').forEach(figure => {
    const courseId = figure.getAttribute('data-course-id');
    if (courseId && completedCourseIds.includes(courseId)) {
      const link = figure.querySelector('a');
      if (link) {
        link.classList.add('completed');
        
        // Add completion badge
        if (!link.querySelector('.completion-badge')) {
          const badge = document.createElement('span');
          badge.className = 'completion-badge';
          badge.innerHTML = '✅';
          badge.style.cssText = `
            margin-left: auto;
            font-size: 1.2rem;
          `;
          link.appendChild(badge);
        }
      }
    }
  });
}

function updateUserLevel(xp) {
  const level = getLevelFromXP(xp);
  const progress = getProgressToNextLevel(xp);

  // Create or update level display
  let levelDisplay = document.getElementById('user-level-display');
  
  if (!levelDisplay) {
    levelDisplay = document.createElement('div');
    levelDisplay.id = 'user-level-display';
    levelDisplay.style.cssText = `
      position: fixed;
      top: 1rem;
      right: 1rem;
      background: radial-gradient(circle, rgba(147, 51, 234, 0.15), rgba(15, 23, 42, 0.98));
      border: 1px solid rgba(148, 163, 184, 0.5);
      border-radius: 16px;
      padding: 1rem 1.25rem;
      z-index: 100;
      backdrop-filter: blur(12px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      min-width: 200px;
    `;
    document.body.appendChild(levelDisplay);
  }

  levelDisplay.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
      <div style="font-size: 1.5rem;">
        ${getLevelIcon(level)}
      </div>
      <div>
        <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af;">
          Level
        </div>
        <div style="font-size: 1rem; font-weight: 700; color: #a78bfa;">
          ${level}
        </div>
      </div>
    </div>
    <div style="margin-bottom: 0.4rem;">
      <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #9ca3af; margin-bottom: 0.25rem;">
        <span>${xp.toLocaleString()} XP</span>
        ${progress.percentage < 100 ? `<span>${progress.percentage}%</span>` : '<span>MAX</span>'}
      </div>
      <div style="background: rgba(15, 23, 42, 0.9); border-radius: 999px; height: 6px; overflow: hidden;">
        <div style="
          background: linear-gradient(90deg, #9333ea, #a78bfa, #fbbf24);
          height: 100%;
          width: ${progress.percentage}%;
          transition: width 0.5s ease;
          border-radius: 999px;
        "></div>
      </div>
    </div>
  `;
}

function getLevelIcon(level) {
  const icons = {
    'Apprentice': '🎯',
    'Scholar': '📚',
    'Adept': '⚡',
    'Master': '🔮',
    'Archmage': '👑'
  };
  return icons[level] || '🎯';
}