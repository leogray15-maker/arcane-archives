// xp-module-listener.js
// Listens to module toggle events and handles XP + Firestore sync

import { 
  markModuleCompleted, 
  unmarkModuleCompleted,
  markCourseCompleted,
  unmarkCourseCompleted 
} from "./xp-system.js";
import { auth } from "./universal-auth.js";

// Track if we've shown popup this session to avoid spam
const shownPopupsThisSession = new Set();

window.addEventListener("aa:moduleToggle", async (e) => {
  const { courseId, moduleId, completed } = e.detail;

  // Wait for auth to be ready
  const user = auth.currentUser;
  if (!user) {
    console.warn("⚠️ No user logged in, skipping XP sync");
    return;
  }

  try {
    if (completed === true) {
      // ✅ Module toggled ON
      console.log("✅ Module completed:", courseId, moduleId);
      
      const result = await markModuleCompleted(user.uid, courseId, moduleId);
      
      // Show congratulations popup (only once per module per session)
      const popupKey = `${courseId}::${moduleId}`;
      if (!result.alreadyCompleted && !shownPopupsThisSession.has(popupKey)) {
        showCongratulationsPopup(50); // 50 XP for module
        shownPopupsThisSession.add(popupKey);
      }

    } else {
      // ❌ Module toggled OFF
      console.log("❌ Module uncompleted:", courseId, moduleId);
      
      await unmarkModuleCompleted(user.uid, courseId, moduleId);
      
      // Optional: show a subtle "XP removed" notification
      showXPRemovedNotification(50);
    }

  } catch (err) {
    console.error("❌ Failed to sync module completion:", err);
  }
});

// Listen for course completion events
window.addEventListener("aa:courseComplete", async (e) => {
  const { courseId } = e.detail;

  const user = auth.currentUser;
  if (!user) return;

  try {
    console.log("🏆 Course completed:", courseId);
    const wasNew = await markCourseCompleted(user.uid, courseId);
    
    if (wasNew) {
      showCongratulationsPopup(100, true); // 100 XP for course, special styling
    }
  } catch (err) {
    console.error("❌ Failed to mark course completed:", err);
  }
});

// Listen for course un-completion
window.addEventListener("aa:courseUncomplete", async (e) => {
  const { courseId } = e.detail;

  const user = auth.currentUser;
  if (!user) return;

  try {
    console.log("📉 Course uncompleted:", courseId);
    await unmarkCourseCompleted(user.uid, courseId);
    showXPRemovedNotification(100);
  } catch (err) {
    console.error("❌ Failed to unmark course:", err);
  }
});

// 🎉 Congratulations popup
function showCongratulationsPopup(xp, isCourse = false) {
  const popup = document.createElement("div");
  popup.className = "aa-xp-popup";
  
  const icon = isCourse ? "🏆" : "✨";
  const message = isCourse ? "Course Completed!" : "Module Completed!";
  
  popup.innerHTML = `
    <div class="aa-xp-popup-content">
      <div class="aa-xp-popup-icon">${icon}</div>
      <div class="aa-xp-popup-title">${message}</div>
      <div class="aa-xp-popup-xp">+${xp} XP</div>
    </div>
  `;
  
  document.body.appendChild(popup);
  
  // Animate in
  setTimeout(() => popup.classList.add("aa-xp-popup--show"), 10);
  
  // Remove after 3 seconds
  setTimeout(() => {
    popup.classList.remove("aa-xp-popup--show");
    setTimeout(() => popup.remove(), 300);
  }, 3000);
}

// 📉 XP removed notification (subtle)
function showXPRemovedNotification(xp) {
  const notification = document.createElement("div");
  notification.className = "aa-xp-notification aa-xp-notification--removed";
  
  notification.innerHTML = `
    <div class="aa-xp-notification-content">
      <span>Module unchecked</span>
      <span class="aa-xp-notification-xp">-${xp} XP</span>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => notification.classList.add("aa-xp-notification--show"), 10);
  
  setTimeout(() => {
    notification.classList.remove("aa-xp-notification--show");
    setTimeout(() => notification.remove(), 300);
  }, 2500);
}

// Add styles for popups (inject once)
if (!document.getElementById("aa-xp-popup-styles")) {
  const style = document.createElement("style");
  style.id = "aa-xp-popup-styles";
  style.textContent = `
    .aa-xp-popup {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.8);
      z-index: 10000;
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      pointer-events: none;
    }

    .aa-xp-popup--show {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }

    .aa-xp-popup-content {
      background: linear-gradient(135deg, rgba(147, 51, 234, 0.95), rgba(126, 34, 206, 0.95));
      border: 2px solid rgba(168, 85, 247, 0.8);
      border-radius: 24px;
      padding: 2rem 3rem;
      text-align: center;
      box-shadow: 0 20px 60px rgba(147, 51, 234, 0.6), 0 0 80px rgba(147, 51, 234, 0.4);
      backdrop-filter: blur(12px);
    }

    .aa-xp-popup-icon {
      font-size: 4rem;
      margin-bottom: 0.5rem;
      animation: aa-bounce 0.6s ease;
    }

    .aa-xp-popup-title {
      font-size: 1.8rem;
      font-weight: 700;
      color: #fff;
      margin-bottom: 0.3rem;
      text-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }

    .aa-xp-popup-xp {
      font-size: 2.5rem;
      font-weight: 800;
      color: #fbbf24;
      text-shadow: 0 2px 12px rgba(251, 191, 36, 0.6);
    }

    @keyframes aa-bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-20px); }
    }

    /* Subtle notification for XP removal */
    .aa-xp-notification {
      position: fixed;
      top: 2rem;
      right: 2rem;
      z-index: 9999;
      opacity: 0;
      transform: translateX(100px);
      transition: all 0.3s ease;
    }

    .aa-xp-notification--show {
      opacity: 1;
      transform: translateX(0);
    }

    .aa-xp-notification-content {
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid rgba(239, 68, 68, 0.5);
      border-radius: 12px;
      padding: 0.8rem 1.2rem;
      display: flex;
      align-items: center;
      gap: 0.8rem;
      color: #e5e5e5;
      font-size: 0.9rem;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    }

    .aa-xp-notification-xp {
      color: #ef4444;
      font-weight: 700;
    }

    @media (max-width: 768px) {
      .aa-xp-popup-content {
        padding: 1.5rem 2rem;
      }

      .aa-xp-popup-title {
        font-size: 1.4rem;
      }

      .aa-xp-popup-xp {
        font-size: 2rem;
      }

      .aa-xp-notification {
        top: 1rem;
        right: 1rem;
        left: 1rem;
      }
    }
  `;
  document.head.appendChild(style);
}