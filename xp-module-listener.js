// xp-module-listener.js - MINIMAL VERSION FOR LAUNCH
import { 
  markModuleCompleted
} from "./xp-system.js";

const shownPopupsThisSession = new Set();

console.log("[XP Listener] Module loaded");

document.addEventListener("aa:moduleToggle", async (e) => {
  console.log("[XP Listener] ✅ Event received:", e.detail);
  
  const { courseId, moduleId, completed } = e.detail;

  let user = window.currentUser;
  
  if (!user) {
    console.warn("[XP Listener] Waiting for user...");
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      user = window.currentUser;
      if (user) break;
    }
  }
  
  if (!user) {
    console.error("[XP Listener] ❌ No user logged in");
    return;
  }

  console.log("[XP Listener] User found:", user.uid);

  try {
    if (completed === true) {
      console.log("[XP Listener] ✅ Marking module completed");
      const result = await markModuleCompleted(user.uid, courseId, moduleId);
      
      console.log("[XP Listener] Result:", result);
      
      const popupKey = `${courseId}::${moduleId}`;
      if (!result.alreadyCompleted && !shownPopupsThisSession.has(popupKey)) {
        showCongratulationsPopup(75);
        shownPopupsThisSession.add(popupKey);
      }
    }
  } catch (err) {
    console.error("[XP Listener] ❌ Error:", err);
  }
});

function showCongratulationsPopup(xp) {
  console.log("[XP Listener] 🎉 Showing popup:", xp, "XP");
  
  const popup = document.createElement("div");
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10000;
    background: linear-gradient(135deg, rgba(147, 51, 234, 0.95), rgba(126, 34, 206, 0.95));
    border: 2px solid rgba(168, 85, 247, 0.8);
    border-radius: 24px;
    padding: 2rem 3rem;
    text-align: center;
    box-shadow: 0 20px 60px rgba(147, 51, 234, 0.6);
    animation: popupIn 0.3s ease-out forwards;
  `;
  
  popup.innerHTML = `
    <div style="font-size: 4rem; margin-bottom: 0.5rem;">✨</div>
    <div style="font-size: 1.5rem; font-weight: 700; color: white; margin-bottom: 0.5rem;">Module Completed!</div>
    <div style="font-size: 2.5rem; font-weight: 800; color: #fbbf24;">+${xp} XP</div>
  `;
  
  document.body.appendChild(popup);
  
  setTimeout(() => {
    popup.style.animation = 'popupOut 0.3s ease-in forwards';
    setTimeout(() => popup.remove(), 300);
  }, 2500);
}

const style = document.createElement("style");
style.textContent = `
  @keyframes popupIn {
    from { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
    to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  }
  @keyframes popupOut {
    from { transform: translate(-50%, -50%) scale(1); opacity: 1; }
    to { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
  }
`;
document.head.appendChild(style);