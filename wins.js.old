// wins.js
// Wins board with XP rewards

import { protectPage, db } from "./auth-guard.js";
import { awardXP, XP_REWARDS } from "./xp-system.js";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  limit,
  where,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

let currentUser = null;

protectPage({
  onSuccess: (user, userData) => {
    currentUser = user;
    setupWinForm();
    loadWinsFeed();
  },
  onFailure: () => {
    window.location.href = "login.html";
  },
});

function setupWinForm() {
  const postBtn = document.getElementById("postWinBtn");
  if (!postBtn) return;

  postBtn.addEventListener("click", async () => {
    const titleInput = document.getElementById("winTitle");
    const descInput = document.getElementById("winDescription");
    const categorySelect = document.getElementById("winCategory");

    const title = titleInput?.value.trim();
    const description = descInput?.value.trim();
    const category = categorySelect?.value || "general";

    if (!title) {
      alert("Please add a title for your win");
      return;
    }

    postBtn.disabled = true;
    postBtn.textContent = "Posting...";

    try {
      await addDoc(collection(db, "wins"), {
        title,
        description: description || null,
        category,
        createdAt: serverTimestamp(),
        userId: currentUser.uid,
        userEmail: currentUser.email,
        reactions: {
          fire: [],
          trophy: [],
          rocket: [],
        },
      });

      // Award XP for posting a win
      await awardXP(currentUser.uid, 'WIN_POSTED');

      // Clear form
      if (titleInput) titleInput.value = "";
      if (descInput) descInput.value = "";

      postBtn.textContent = "Post Win";
      postBtn.disabled = false;

      // Show success message with XP
      showSuccessMessage(`✅ Win posted! +${XP_REWARDS.WIN_POSTED} XP earned`);
    } catch (err) {
      console.error("Error posting win:", err);
      alert("Error posting win. Please try again.");
      postBtn.textContent = "Post Win";
      postBtn.disabled = false;
    }
  });
}

function loadWinsFeed() {
  const container = document.getElementById("winsContainer");
  if (!container) return;

  const winsRef = collection(db, "wins");
  const qWins = query(winsRef, orderBy("createdAt", "desc"), limit(50));

  onSnapshot(
    qWins,
    async (snapshot) => {
      if (snapshot.empty) {
        container.innerHTML = `
          <div class="win-card" style="text-align: center; padding: 3rem;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">🏆</div>
            <div style="font-size: 1.2rem; font-weight: 600; margin-bottom: 0.5rem;">No wins yet!</div>
            <div style="color: #9ca3af;">Be the first to share a victory</div>
          </div>
        `;
        return;
      }

      container.innerHTML = "";

      // Get all user data for display names
      const userIds = [...new Set(snapshot.docs.map(doc => doc.data().userId))];
      const userDataMap = {};
      
      for (const uid of userIds) {
        const userRef = doc(db, "Users", uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          userDataMap[uid] = userSnap.data();
        }
      }

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const id = docSnap.id;
        const userData = userDataMap[data.userId];
        container.appendChild(renderWinCard(id, data, userData));
      });

      attachReactionHandlers(container);
    },
    (err) => {
      console.error("Error loading wins:", err);
      container.innerHTML = `
        <div class="win-card" style="text-align: center; padding: 2rem;">
          <div style="color: #ef4444;">Error loading wins</div>
          <div style="font-size: 0.85rem; color: #9ca3af; margin-top: 0.5rem;">${err.message}</div>
        </div>
      `;
    }
  );
}

function renderWinCard(id, data, userData) {
  const card = document.createElement("div");
  card.className = "win-card";

  const username = userData?.Username || data.userEmail?.split("@")[0] || "Member";
  const userLevel = userData?.level || "Apprentice";
  const userInitial = username.charAt(0).toUpperCase();

  const reactions = data.reactions || { fire: [], trophy: [], rocket: [] };
  const userId = currentUser?.uid;

  const fireCount = reactions.fire?.length || 0;
  const trophyCount = reactions.trophy?.length || 0;
  const rocketCount = reactions.rocket?.length || 0;

  const userReactedFire = userId && reactions.fire?.includes(userId);
  const userReactedTrophy = userId && reactions.trophy?.includes(userId);
  const userReactedRocket = userId && reactions.rocket?.includes(userId);

  const categoryIcons = {
    trading: "📈",
    business: "💼",
    mindset: "🧠",
    health: "💪",
    general: "⭐",
  };

  const categoryIcon = categoryIcons[data.category] || "⭐";

  card.innerHTML = `
    <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
      <div style="
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: radial-gradient(circle, #a78bfa, #4c1d95);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.3rem;
        font-weight: 700;
        color: #fff;
        flex-shrink: 0;
      ">
        ${userInitial}
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
          <div style="font-weight: 600; font-size: 1rem;">${username}</div>
          <div style="font-size: 0.75rem; color: #9ca3af; padding: 0.15rem 0.5rem; border-radius: 4px; background: rgba(147, 51, 234, 0.2);">
            ${userLevel}
          </div>
          <div style="font-size: 1.1rem; margin-left: auto;">
            ${categoryIcon}
          </div>
        </div>
        <div style="font-size: 0.8rem; color: #9ca3af;">
          ${formatTimestamp(data.createdAt)}
        </div>
      </div>
    </div>

    <div style="margin-bottom: 1rem;">
      <h3 style="font-size: 1.2rem; margin-bottom: 0.5rem; color: #e5e5e5;">
        ${escapeHtml(data.title)}
      </h3>
      ${
        data.description
          ? `<p style="color: #9ca3af; line-height: 1.6;">${escapeHtml(
              data.description
            )}</p>`
          : ""
      }
    </div>

    <div style="display: flex; gap: 0.75rem; padding-top: 1rem; border-top: 1px solid rgba(148, 163, 184, 0.2);">
      <button 
        class="reaction-btn" 
        data-id="${id}" 
        data-type="fire"
        style="
          flex: 1;
          padding: 0.6rem;
          border-radius: 8px;
          border: 1px solid rgba(148, 163, 184, 0.3);
          background: ${userReactedFire ? 'rgba(251, 146, 60, 0.15)' : 'rgba(15, 23, 42, 0.5)'};
          color: ${userReactedFire ? '#fb923c' : '#9ca3af'};
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s;
        "
      >
        🔥 ${fireCount}
      </button>
      <button 
        class="reaction-btn" 
        data-id="${id}" 
        data-type="trophy"
        style="
          flex: 1;
          padding: 0.6rem;
          border-radius: 8px;
          border: 1px solid rgba(148, 163, 184, 0.3);
          background: ${userReactedTrophy ? 'rgba(234, 179, 8, 0.15)' : 'rgba(15, 23, 42, 0.5)'};
          color: ${userReactedTrophy ? '#eab308' : '#9ca3af'};
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s;
        "
      >
        🏆 ${trophyCount}
      </button>
      <button 
        class="reaction-btn" 
        data-id="${id}" 
        data-type="rocket"
        style="
          flex: 1;
          padding: 0.6rem;
          border-radius: 8px;
          border: 1px solid rgba(148, 163, 184, 0.3);
          background: ${userReactedRocket ? 'rgba(147, 51, 234, 0.15)' : 'rgba(15, 23, 42, 0.5)'};
          color: ${userReactedRocket ? '#a78bfa' : '#9ca3af'};
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s;
        "
      >
        🚀 ${rocketCount}
      </button>
    </div>
  `;

  return card;
}

function attachReactionHandlers(container) {
  const buttons = container.querySelectorAll(".reaction-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!currentUser) return;

      const id = btn.getAttribute("data-id");
      const type = btn.getAttribute("data-type");
      if (!id || !type) return;

      try {
        const winRef = doc(db, "wins", id);
        const snap = await getDoc(winRef);
        if (!snap.exists()) return;

        const data = snap.data();
        const reactions = data.reactions || { fire: [], trophy: [], rocket: [] };
        const arr = reactions[type] || [];

        if (arr.includes(currentUser.uid)) {
          // Remove reaction
          await updateDoc(winRef, {
            [`reactions.${type}`]: arrayRemove(currentUser.uid),
          });
        } else {
          // Add reaction
          await updateDoc(winRef, {
            [`reactions.${type}`]: arrayUnion(currentUser.uid),
          });
        }
      } catch (err) {
        console.error("Error updating reactions:", err);
      }
    });
  });
}

function formatTimestamp(ts) {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showSuccessMessage(message) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 2rem;
    right: 2rem;
    background: linear-gradient(135deg, #22c55e, #15803d);
    color: #fff;
    padding: 1rem 1.5rem;
    border-radius: 12px;
    font-size: 0.95rem;
    font-weight: 600;
    box-shadow: 0 8px 24px rgba(34, 197, 94, 0.4);
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
  `;
  
  toast.textContent = message;
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}