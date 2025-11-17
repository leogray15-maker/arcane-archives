// alerts.js - Arcane Alerts System - FIXED VERSION
import { protectPage, auth, db } from "./auth-guard.js";
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
  arrayRemove,
  limit,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

import {
  getMessaging,
  getToken,
  onMessage
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";

// Configuration
// 👑 Admin email – only this account sees the "Post Arcane Alert" form
const ADMIN_EMAIL = "leogray15@gmail.com";

const VAPID_KEY =
  "BD2Db4LFDMB4ynZPK0TmXHzPf2cG-uhHk9zaQCVejBVIo7S-StCqqUn6DwEx-hfHo2MlJnbLqLcTNFZ8_4PDKvE";

// Global state
let currentUser = null;
let isAdmin = false;
let latestAlertTimestamp = null;
let isFirstLoad = true;

const storage = getStorage();
const messaging = getMessaging();

// ==========================================
// MAIN INITIALIZATION
// ==========================================
protectPage({
  onSuccess: async (user, userData) => {
    currentUser = user;
    isAdmin = user.email === ADMIN_EMAIL;

    console.log("✅ Arcane Alerts access granted");
    console.log("👤 User:", user.email, "| Admin:", isAdmin);

    if (isAdmin) {
      const form = document.getElementById("alertForm");
      if (form) form.classList.add("visible");
    }

    initPushNotifications();
    setupAdminForm();
    loadAlerts();
  },

  onFailure: (reason) => {
    console.error("🚫 Access denied:", reason);
    const feed = document.getElementById("alertsFeed");
    if (feed) {
      feed.innerHTML = `
        <div style="padding: 3rem; text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🔒</div>
          <h3 style="color: #ef4444; margin-bottom: 1rem;">Access Denied</h3>
          <p style="color: #a3a3a3; margin-bottom: 2rem;">
            You must be logged in with an active subscription to view Arcane Alerts
          </p>
          <a href="login.html" style="
            display: inline-block;
            padding: 1rem 2rem;
            background: linear-gradient(135deg, #9333ea, #7e22ce);
            color: white;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 600;
          ">Go to Login</a>
        </div>
      `;
    }
  }
});

// ==========================================
// PUSH NOTIFICATIONS
// ==========================================
async function initPushNotifications() {
  const pushInfo = document.getElementById("pushInfo");

  try {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
      updatePushInfo(
        "⚠️ Push notifications not supported in this browser",
        "error"
      );
      return;
    }

    console.log("📱 Registering service worker...");
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );
    console.log("✅ Service worker registered");

    const permission = await Notification.requestPermission();
    console.log("🔔 Notification permission:", permission);

    if (permission !== "granted") {
      updatePushInfo(
        "🔕 Notifications blocked. Enable them in browser settings for instant alerts",
        "error"
      );
      return;
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });

    if (!token) {
      console.warn("⚠️ No FCM token received");
      updatePushInfo(
        "⚠️ Could not enable notifications. Alerts will still appear on this page",
        "error"
      );
      return;
    }

    console.log("🎯 FCM token received:", token.substring(0, 20) + "...");

    await saveUserToken(token);

    updatePushInfo(
      "✅ Notifications enabled! You'll receive instant Arcane Alerts",
      "enabled"
    );

    onMessage(messaging, (payload) => {
      console.log("📬 Foreground message:", payload);
      showNewAlertNotification();
    });
  } catch (error) {
    console.error("❌ Push notification error:", error);
    updatePushInfo(
      "⚠️ Could not enable notifications. Alerts will still appear on this page",
      "error"
    );
  }
}

async function saveUserToken(token) {
  try {
    const tokensRef = collection(db, "pushTokens");
    await addDoc(tokensRef, {
      uid: currentUser.uid,
      email: currentUser.email,
      token,
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp()
    });
    console.log("✅ Token saved to Firestore");
  } catch (error) {
    console.error("❌ Error saving token:", error);
  }
}

function updatePushInfo(message, status) {
  const pushInfo = document.getElementById("pushInfo");
  if (!pushInfo) return;
  pushInfo.textContent = message;
  pushInfo.className = "";
  if (status) pushInfo.classList.add(status);
}

// ==========================================
// LOAD & DISPLAY ALERTS
// ==========================================
function loadAlerts() {
  const feed = document.getElementById("alertsFeed");
  if (!feed) return;

  const alertsQuery = query(
    collection(db, "alerts"),
    orderBy("timestamp", "desc"),
    limit(50)
  );

  const unsubscribe = onSnapshot(
    alertsQuery,
    (snapshot) => {
      if (isFirstLoad) {
        feed.innerHTML = "";
        isFirstLoad = false;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === "added" && !isFirstLoad) {
          const data = change.doc.data();
          if (
            data.timestamp?.toMillis &&
            data.timestamp.toMillis() > (latestAlertTimestamp || 0)
          ) {
            showNewAlertNotification();
            latestAlertTimestamp = data.timestamp.toMillis();
          }
        }
      });

      feed.innerHTML = "";

      if (snapshot.empty) {
        feed.innerHTML = `
          <div style="text-align: center; padding: 3rem; color: #a3a3a3;">
            <div style="font-size: 2rem; margin-bottom: 1rem;">📭</div>
            <p>No alerts yet. Check back soon!</p>
          </div>
        `;
        return;
      }

      snapshot.forEach((docSnap) => {
        const alertCard = createAlertCard(docSnap.id, docSnap.data());
        feed.appendChild(alertCard);
      });

      if (!snapshot.empty) {
        const firstDoc = snapshot.docs[0];
        const data = firstDoc.data();
        if (data.timestamp?.toMillis) {
          latestAlertTimestamp = Math.max(
            latestAlertTimestamp || 0,
            data.timestamp.toMillis()
          );
        }
      }
    },
    (error) => {
      console.error("❌ Error loading alerts:", error);
      feed.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: #ef4444;">
          <p>Error loading alerts. Please refresh the page.</p>
        </div>
      `;
    }
  );

  window.addEventListener("beforeunload", () => unsubscribe());
}

// ==========================================
// CREATE ALERT CARD UI
// ==========================================
function createAlertCard(alertId, data) {
  const div = document.createElement("div");
  div.className = "alert-card";
  div.id = `alert-${alertId}`;

  const reactions = data.reactions || {};
  const fireCount = reactions.fire?.length || 0;
  const bearCount = reactions.bear?.length || 0;
  const eyesCount = reactions.eyes?.length || 0;

  const userId = currentUser?.uid;
  const userReactedFire = userId && reactions.fire?.includes(userId);
  const userReactedBear = userId && reactions.bear?.includes(userId);
  const userReactedEyes = userId && reactions.eyes?.includes(userId);

  const timeString = data.timestamp?.toDate
    ? formatTimeAgo(data.timestamp.toDate())
    : "Just now";

  const pair = data.pair || "XAUUSD";
  const entry = data.entry || "-";
  const sl = data.sl || "-";
  const tp1 = data.tp1 || "-";
  const tp2 = data.tp2 || "-";
  const tp3 = data.tp3 || "-";

  div.innerHTML = `
    <div class="alert-header-line">
      <span class="badge">${escapeHtml(pair)}</span>
      <span>ARCANE ALERT</span>
      <span>•</span>
      <span>${timeString}</span>
    </div>

    ${data.imageUrl ? `<img src="${data.imageUrl}" class="alert-image" alt="Chart" loading="lazy">` : ""}

    ${data.text ? `<div class="alert-text">${escapeHtml(data.text)}</div>` : ""}

    <div class="trade-grid">
      <div class="trade-pill entry">
        <span class="label">Entry</span>
        <span class="value">${escapeHtml(entry)}</span>
      </div>
      <div class="trade-pill sl">
        <span class="label">Stop Loss</span>
        <span class="value">${escapeHtml(sl)}</span>
      </div>
      <div class="trade-pill tp">
        <span class="label">TP 1</span>
        <span class="value">${escapeHtml(tp1)}</span>
      </div>
      <div class="trade-pill tp">
        <span class="label">TP 2</span>
        <span class="value">${escapeHtml(tp2)}</span>
      </div>
      <div class="trade-pill tp">
        <span class="label">TP 3</span>
        <span class="value">${escapeHtml(tp3)}</span>
      </div>
    </div>

    <div class="alert-reactions">
      <div class="reaction ${userReactedFire ? "active" : ""}" data-reaction="fire" data-alert="${alertId}">
        🔥 <span class="count">${fireCount}</span>
      </div>
      <div class="reaction ${userReactedBear ? "active" : ""}" data-reaction="bear" data-alert="${alertId}">
        🐻 <span class="count">${bearCount}</span>
      </div>
      <div class="reaction ${userReactedEyes ? "active" : ""}" data-reaction="eyes" data-alert="${alertId}">
        👀 <span class="count">${eyesCount}</span>
      </div>
    </div>
  `;

  div.querySelectorAll(".reaction").forEach((btn) => {
    btn.addEventListener("click", handleReaction);
  });

  return div;
}

// ==========================================
// HANDLE REACTIONS
// ==========================================
async function handleReaction(event) {
  if (!currentUser) {
    alert("Please log in to react to alerts");
    return;
  }

  const button = event.currentTarget;
  const alertId = button.dataset.alert;
  const reactionType = button.dataset.reaction;
  const isActive = button.classList.contains("active");

  button.style.pointerEvents = "none";

  try {
    const alertRef = doc(db, "alerts", alertId);
    const userId = currentUser.uid;

    const updates = {};

    if (isActive) {
      updates[`reactions.${reactionType}`] = arrayRemove(userId);
    } else {
      updates[`reactions.${reactionType}`] = arrayUnion(userId);

      ["fire", "bear", "eyes"].forEach((type) => {
        if (type !== reactionType) {
          updates[`reactions.${type}`] = arrayRemove(userId);
        }
      });
    }

    await updateDoc(alertRef, updates);
    console.log("✅ Reaction updated successfully");
  } catch (error) {
    console.error("❌ Error updating reaction:", error);
    alert("Error updating reaction. Please try again.");
  } finally {
    setTimeout(() => {
      button.style.pointerEvents = "auto";
    }, 300);
  }
}

// ==========================================
// ADMIN: POST NEW ALERT
// ==========================================
function setupAdminForm() {
  const btn = document.getElementById("postAlertBtn");
  if (!btn || !isAdmin) return;

  btn.addEventListener("click", async () => {
    const pairEl = document.getElementById("pairSelect");
    const textEl = document.getElementById("alertText");
    const entryEl = document.getElementById("entryInput");
    const slEl = document.getElementById("slInput");
    const tp1El = document.getElementById("tp1Input");
    const tp2El = document.getElementById("tp2Input");
    const tp3El = document.getElementById("tp3Input");
    const fileEl = document.getElementById("alertImage");

    const pair = pairEl.value;
    const text = textEl.value.trim();
    const entry = entryEl.value.trim();
    const sl = slEl.value.trim();
    const file = fileEl.files[0];

    if (!text && !entry) {
      alert("Please add analysis or at least an entry price");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Posting Alert...";

    try {
      let imageUrl = null;

      if (file) {
        console.log("📸 Uploading image...");
        const timestamp = Date.now();
        const fileName = `alerts/${timestamp}_${file.name}`;
        const storageRef = ref(storage, fileName);
        const snapshot = await uploadBytes(storageRef, file);
        imageUrl = await getDownloadURL(snapshot.ref);
        console.log("✅ Image uploaded");
      }

      const alertData = {
        pair: pair,
        text: text || null,
        entry: entry || null,
        sl: sl || null,
        tp1: tp1El.value.trim() || null,
        tp2: tp2El.value.trim() || null,
        tp3: tp3El.value.trim() || null,
        imageUrl: imageUrl,
        timestamp: serverTimestamp(),
        createdBy: currentUser.uid,
        createdByEmail: currentUser.email,
        reactions: {
          fire: [],
          bear: [],
          eyes: []
        }
      };

      console.log("📤 Posting alert...");
      const docRef = await addDoc(collection(db, "alerts"), alertData);
      console.log("✅ Alert posted with ID:", docRef.id);

      // Try sending push notifications (optional Cloud Function)
      try {
        await sendPushNotifications(pair, text, entry);
      } catch (notifError) {
        console.error(
          "⚠️ Push notification error (alert still posted):",
          notifError
        );
      }

      pairEl.value = "XAUUSD";
      textEl.value = "";
      entryEl.value = "";
      slEl.value = "";
      tp1El.value = "";
      tp2El.value = "";
      tp3El.value = "";
      fileEl.value = "";

      btn.textContent = "✅ Alert Posted!";
      setTimeout(() => {
        btn.textContent = "Post Arcane Alert";
        btn.disabled = false;
      }, 2000);
    } catch (error) {
      console.error("❌ Error posting alert:", error);
      alert("Error posting alert. Please try again.");
      btn.textContent = "Post Arcane Alert";
      btn.disabled = false;
    }
  });
}

// ==========================================
// SEND PUSH NOTIFICATIONS VIA NETLIFY FUNCTION (optional)
// ==========================================
async function sendPushNotifications(pair, text, entry) {
  try {
    const cloudFunctionUrl = "/.netlify/functions/send-notification"; // optional
    const bodyText = text || `New ${pair} setup - Entry: ${entry}`;

    const response = await fetch(cloudFunctionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `⚡ ARCANE ALERT - ${pair}`,
        body:
          bodyText.substring(0, 100) + (bodyText.length > 100 ? "..." : "")
      })
    });

    if (response.ok) {
      console.log("✅ Push notifications request sent");
    } else {
      console.warn("⚠️ Push notification function returned error");
    }
  } catch (error) {
    console.error("❌ Error sending push notifications:", error);
  }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
function showNewAlertNotification() {
  const notif = document.getElementById("newAlertNotification");
  if (!notif) return;

  notif.style.display = "block";
  notif.onclick = () => {
    notif.style.display = "none";
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  setTimeout(() => {
    notif.style.display = "none";
  }, 10000);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return date.toLocaleDateString();
}

// Debug helper
window.arcaneAlerts = {
  getCurrentUser: () => currentUser,
  isAdmin: () => isAdmin,
  reload: loadAlerts
};
