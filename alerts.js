// alerts.js – simplified Arcane Alerts + Trade Ideas
import { protectPage, db } from "./auth-guard.js";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  limit
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// Only this email can post new trade ideas
const ADMIN_EMAIL = "leogray15@gmail.com";

let currentUser = null;
let isAdmin = false;

// Entry point
protectPage({
  onSuccess: (user, userData) => {
    currentUser = user;
    isAdmin = user.email === ADMIN_EMAIL;

    console.log("✅ Alerts access:", user.email, "Admin:", isAdmin);

    setupAdminForm();
    initAlertsFeed();
  },
  onFailure: () => {
    window.location.href = "login.html";
  }
});

/**
 * Show / wire the "New Trade Idea" form for admin
 */
function setupAdminForm() {
  const formWrapper = document.getElementById("alertForm");
  const postBtn = document.getElementById("postAlertBtn");
  if (!formWrapper || !postBtn) return;

  if (!isAdmin) {
    // Hide form for non-admins
    formWrapper.style.display = "none";
    return;
  }

  // Show form for admin
  formWrapper.classList.add("visible");

  postBtn.addEventListener("click", async () => {
    const pairEl = document.getElementById("pairInput");
    const directionEl = document.getElementById("directionSelect");
    const entryEl = document.getElementById("entryInput");
    const slEl = document.getElementById("slInput");
    const tp1El = document.getElementById("tp1Input");
    const tp2El = document.getElementById("tp2Input");
    const notesEl = document.getElementById("notesInput");

    const pair = pairEl.value.trim() || "XAUUSD";
    const direction = directionEl.value || "Long";
    const entry = entryEl.value.trim();
    const sl = slEl.value.trim();
    const tp1 = tp1El.value.trim();
    const tp2 = tp2El.value.trim();
    const notes = notesEl.value.trim();

    if (!entry) {
      alert("Please add at least an entry price.");
      return;
    }

    postBtn.disabled = true;
    postBtn.textContent = "Posting...";

    try {
      const alertData = {
        type: "trade_idea",
        pair,
        direction,
        entry: entry || null,
        sl: sl || null,
        tp1: tp1 || null,
        tp2: tp2 || null,
        notes: notes || null,
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid,
        createdByEmail: currentUser.email,
        readBy: [],
        reactions: {
          fire: [],
          bear: [],
          eyes: []
        }
      };

      await addDoc(collection(db, "alerts"), alertData);

      // Reset form
      entryEl.value = "";
      slEl.value = "";
      tp1El.value = "";
      tp2El.value = "";
      notesEl.value = "";

      postBtn.textContent = "Post Trade Idea";
      postBtn.disabled = false;
      alert("✅ Trade idea posted");
    } catch (err) {
      console.error("Error posting alert:", err);
      alert("Error posting trade idea. Please try again.");
      postBtn.textContent = "Post Trade Idea";
      postBtn.disabled = false;
    }
  });
}

/**
 * Listen to alerts collection and render list
 */
function initAlertsFeed() {
  const container = document.getElementById("alertsContainer");
  if (!container) {
    console.warn("⚠️ alertsContainer not found");
    return;
  }

  const alertsRef = collection(db, "alerts");
  const q = query(alertsRef, orderBy("createdAt", "desc"), limit(50));

  onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        container.innerHTML = `
          <div class="alert-card">
            <div style="font-size:1rem;font-weight:600;">No alerts yet</div>
            <div style="font-size:0.85rem;color:#9ca3af;margin-top:0.25rem;">
              Once you post trade ideas or system alerts, they will appear here.
            </div>
          </div>
        `;
        return;
      }

      container.innerHTML = "";

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const id = docSnap.id;
        container.appendChild(renderAlertCard(id, data));
      });

      attachReactionHandlers(container);
    },
    (err) => {
      console.error("Error loading alerts:", err);
      container.innerHTML = `
        <div class="alert-card">
          <div style="color:#fca5a5;">Error loading alerts.</div>
          <div style="font-size:0.85rem;color:#9ca3af;">${err.message}</div>
        </div>
      `;
    }
  );
}

function renderAlertCard(id, data) {
  const isTrade = data.type === "trade_idea";
  const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
  const timeText = formatTimeAgo(createdAt);

  const card = document.createElement("div");
  card.className = "alert-card";

  const pair = data.pair || "XAUUSD";
  const direction = data.direction || "Long";
  const entry = data.entry || "-";
  const sl = data.sl || "-";
  const tp1 = data.tp1 || "-";
  const tp2 = data.tp2 || "-";
  const notes = data.notes || data.message || "";

  const reactions = data.reactions || { fire: [], bear: [], eyes: [] };
  const userId = currentUser?.uid;
  const fireCount = reactions.fire?.length || 0;
  const bearCount = reactions.bear?.length || 0;
  const eyesCount = reactions.eyes?.length || 0;

  const userReactedFire = userId && reactions.fire?.includes(userId);
  const userReactedBear = userId && reactions.bear?.includes(userId);
  const userReactedEyes = userId && reactions.eyes?.includes(userId);

  const typeLabel = isTrade ? "Trade Idea" : "Alert";

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">
      <div style="display:flex;align-items:center;gap:0.5rem;">
        <span style="
          font-size:0.75rem;
          padding:0.15rem 0.6rem;
          border-radius:999px;
          border:1px solid rgba(148,163,184,0.7);
          text-transform:uppercase;
          letter-spacing:0.08em;
          color:#9ca3af;
        ">
          ${typeLabel}
        </span>
        <span style="font-size:0.8rem;color:#9ca3af;">${pair}</span>
      </div>
      <div style="font-size:0.8rem;color:#9ca3af;">${timeText}</div>
    </div>

    ${
      isTrade
        ? `
      <div style="font-size:0.9rem;margin-bottom:0.6rem;">
        <strong>${direction}</strong> | Entry: <strong>${entry}</strong> · SL: ${sl} · TP1: ${tp1}${tp2 ? " · TP2: " + tp2 : ""}
      </div>
      `
        : ""
    }

    ${
      notes
        ? `<div style="font-size:0.9rem;color:#e5e7eb;margin-bottom:0.6rem;white-space:pre-wrap;">${notes}</div>`
        : ""
    }

    <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.8rem;color:#9ca3af;margin-top:0.3rem;">
      <div>By ${data.createdByEmail || "System"}</div>
      <div style="display:flex;gap:0.35rem;">
        <button class="reaction-btn" data-id="${id}" data-type="fire" style="
          background:transparent;border:none;color:${userReactedFire ? "#f97316" : "#9ca3af"};
          cursor:pointer;display:inline-flex;align-items:center;gap:0.2rem;
        ">🔥 ${fireCount}</button>
        <button class="reaction-btn" data-id="${id}" data-type="bear" style="
          background:transparent;border:none;color:${userReactedBear ? "#f97316" : "#9ca3af"};
          cursor:pointer;display:inline-flex;align-items:center;gap:0.2rem;
        ">🐻 ${bearCount}</button>
        <button class="reaction-btn" data-id="${id}" data-type="eyes" style="
          background:transparent;border:none;color:${userReactedEyes ? "#f97316" : "#9ca3af"};
          cursor:pointer;display:inline-flex;align-items:center;gap:0.2rem;
        ">👀 ${eyesCount}</button>
      </div>
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
        const ref = doc(db, "alerts", id);
        const snap = await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js")
          .then(m => m.getDoc(ref));
        if (!snap.exists()) return;

        const data = snap.data();
        const reactions = data.reactions || { fire: [], bear: [], eyes: [] };
        const arr = reactions[type] || [];
        let newArr;

        if (arr.includes(currentUser.uid)) {
          newArr = arr.filter((uid) => uid !== currentUser.uid);
        } else {
          newArr = [...arr, currentUser.uid];
        }

        await updateDoc(ref, {
          [`reactions.${type}`]: newArr
        });
      } catch (err) {
        console.error("Error updating reaction:", err);
      }
    });
  });
}

function formatTimeAgo(date) {
  if (!date) return "";
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return date.toLocaleDateString();
}

// Debug helper
window.arcaneAlerts = {
  getCurrentUser: () => currentUser,
  isAdmin: () => isAdmin
};
