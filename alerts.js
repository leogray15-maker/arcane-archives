// alerts.js
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
  arrayRemove
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

const ADMIN_EMAIL = "leograybusiness@gmail.com"; // only this email can post

let currentUser = null;
let isAdmin = false;

const storage = getStorage();      // uses default app from auth-guard
const messaging = getMessaging();  // uses same app

let latestAlertTimestamp = null;

// ==========================================
// PROTECT PAGE + INIT
// ==========================================
protectPage({
  onSuccess: async (user, userData) => {
    currentUser = user;
    isAdmin = user.email === ADMIN_EMAIL;

    if (isAdmin) {
      document.getElementById("alertForm").style.display = "block";
    }

    initPushNotifications();
    setupAdminForm();
    loadAlerts();
  },
  onFailure: (reason) => {
    console.error("Arcane Alerts access denied:", reason);
    const feed = document.getElementById("alertsFeed");
    if (feed) {
      feed.innerHTML = `
        <div style="padding:2rem;text-align:center;color:#f87171;">
          <p>⚠️ Access denied: ${reason}</p>
          <p style="font-size:0.9rem;margin-top:0.5rem;">You must be logged in with an active subscription.</p>
          <a href="login.html" style="display:inline-block;margin-top:1rem;padding:0.7rem 1.4rem;border-radius:8px;background:#7b2ff7;color:#fff;text-decoration:none;">Go to Login</a>
        </div>
      `;
    }
  }
});

// ==========================================
// PUSH NOTIFICATIONS – CLIENT
// ==========================================
async function initPushNotifications() {
  const pushInfo = document.getElementById("pushInfo");
  try {
    if (!("serviceWorker" in navigator)) {
      if (pushInfo) pushInfo.textContent = "Service workers not supported in this browser.";
      return;
    }

    // 1) register SW
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

    // 2) ask permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      if (pushInfo) {
        pushInfo.textContent = "Notifications are blocked. Enable them in your browser settings to get instant Arcane Alerts.";
      }
      return;
    }

    // 3) get FCM token using your VAPID key
    const token = await getToken(messaging, {
      vapidKey: "BD2Db4LFDMB4ynZPK0TmXHzPf2cG-uhHk9zaQCVejBVIo7S-StCqqUn6DwEx-hfHo2MlJnbLqLcTNFZ8_4PDKvE",
      serviceWorkerRegistration: registration
    });

    if (!token) {
      console.warn("No FCM token received.");
      return;
    }

    // 4) save token to Firestore
    const tokensRef = collection(db, "pushTokens");
    await addDoc(tokensRef, {
      uid: currentUser.uid,
      email: currentUser.email,
      token,
      createdAt: serverTimestamp()
    });

    if (pushInfo) {
      pushInfo.textContent =
        "Notifications enabled. You’ll receive Arcane Alerts when new setups go live.";
    }

    // foreground messages (optional)
    onMessage(messaging, (payload) => {
      console.log("Foreground push received:", payload);
    });
  } catch (err) {
    console.error("Error initializing push notifications:", err);
    if (pushInfo) {
      pushInfo.textContent =
        "Could not enable notifications. You can still view alerts on this page.";
    }
  }
}

// ==========================================
// LOAD ALERTS LIVE
// ==========================================
function loadAlerts() {
  const feed = document.getElementById("alertsFeed");
  if (!feed) return;

  const q = query(collection(db, "alerts"), orderBy("timestamp", "desc"));

  onSnapshot(
    q,
    (snapshot) => {
      feed.innerHTML = "";

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const id = docSnap.id;

        if (
          data.timestamp?.toMillis &&
          (!latestAlertTimestamp || data.timestamp.toMillis() > latestAlertTimestamp)
        ) {
          if (latestAlertTimestamp) showNewAlertNotification();
          latestAlertTimestamp = data.timestamp.toMillis();
        }

        const card = createAlertCard(id, data);
        feed.appendChild(card);
      });
    },
    (err) => {
      console.error("Error loading alerts:", err);
      feed.innerHTML =
        '<div style="padding:1.5rem;text-align:center;color:#f87171;">Error loading alerts. Please refresh.</div>';
    }
  );
}

// ==========================================
// CREATE ALERT CARD
// ==========================================
function createAlertCard(id, data) {
  const div = document.createElement("div");
  div.className = "alert-card";

  const reactions = data.reactions || {};
  const fireCount = reactions.fire?.length || 0;
  const bearCount = reactions.bear?.length || 0;
  const eyesCount = reactions.eyes?.length || 0;

  const userId = currentUser?.uid;
  const userReactedFire = reactions.fire?.includes(userId);
  const userReactedBear = reactions.bear?.includes(userId);
  const userReactedEyes = reactions.eyes?.includes(userId);

  const timeString = data.timestamp?.toDate
    ? data.timestamp.toDate().toLocaleString()
    : "";

  const entry = data.entry || "-";
  const sl = data.sl || "-";
  const tp1 = data.tp1 || "-";
  const tp2 = data.tp2 || "-";
  const tp3 = data.tp3 || "-";

  div.innerHTML = `
    <div class="alert-header-line">
      <span>ARCANE ALERT • XAUUSD</span> • ${timeString}
    </div>
    ${data.imageUrl ? `<img src="${data.imageUrl}" class="alert-image" alt="Alert image">` : ""}
    <div class="alert-text">${escapeHtml(data.text || "")}</div>
    <div class="trade-grid">
      <div class="trade-pill">
        <span class="label">ENTRY</span>
        <span class="value">${entry}</span>
      </div>
      <div class="trade-pill">
        <span class="label">STOP LOSS</span>
        <span class="value">${sl}</span>
      </div>
      <div class="trade-pill">
        <span class="label">TP 1</span>
        <span class="value">${tp1}</span>
      </div>
      <div class="trade-pill">
        <span class="label">TP 2</span>
        <span class="value">${tp2}</span>
      </div>
      <div class="trade-pill">
        <span class="label">TP 3</span>
        <span class="value">${tp3}</span>
      </div>
    </div>
    <div class="alert-reactions">
      <div class="reaction ${userReactedFire ? "reaction-active" : ""}" data-type="fire">
        🔥 <span class="count">${fireCount}</span>
      </div>
      <div class="reaction ${userReactedBear ? "reaction-active" : ""}" data-type="bear">
        📉 <span class="count">${bearCount}</span>
      </div>
      <div class="reaction ${userReactedEyes ? "reaction-active" : ""}" data-type="eyes">
        👀 <span class="count">${eyesCount}</span>
      </div>
    </div>
  `;

  div.querySelectorAll(".reaction").forEach((el) => {
    el.addEventListener("click", () => {
      const type = el.getAttribute("data-type");
      toggleReaction(id, type);
    });
  });

  return div;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ==========================================
// REACTIONS
// ==========================================
async function toggleReaction(alertId, reaction) {
  if (!currentUser) return;

  const alertRef = doc(db, "alerts", alertId);
  const userId = currentUser.uid;
  const reactionKey = `reactions.${reaction}`;

  await updateDoc(alertRef, {
    [reactionKey]: arrayUnion(userId)
  });

  const otherReactions = ["fire", "bear", "eyes"].filter((r) => r !== reaction);
  for (const r of otherReactions) {
    await updateDoc(alertRef, {
      [`reactions.${r}`]: arrayRemove(userId)
    });
  }
}

// ==========================================
// ADMIN FORM – POST NEW ALERT
// ==========================================
function setupAdminForm() {
  const btn = document.getElementById("postAlertBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    if (!isAdmin) return;

    const textEl = document.getElementById("alertText");
    const entryEl = document.getElementById("entryInput");
    const slEl = document.getElementById("slInput");
    const tp1El = document.getElementById("tp1Input");
    const tp2El = document.getElementById("tp2Input");
    const tp3El = document.getElementById("tp3Input");
    const fileEl = document.getElementById("alertImage");

    const text = textEl.value.trim();
    const entry = entryEl.value.trim();
    const sl = slEl.value.trim();
    const tp1 = tp1El.value.trim();
    const tp2 = tp2El.value.trim();
    const tp3 = tp3El.value.trim();
    const file = fileEl.files[0];

    if (!text && !entry) {
      alert("Please add at least some analysis or an entry price.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Posting…";

    let imageUrl = null;

    try {
      if (file) {
        const filePath = `alerts/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, filePath);
        const snapshot = await uploadBytes(storageRef, file);
        imageUrl = await getDownloadURL(snapshot.ref);
      }

      await addDoc(collection(db, "alerts"), {
        text,
        entry: entry || null,
        sl: sl || null,
        tp1: tp1 || null,
        tp2: tp2 || null,
        tp3: tp3 || null,
        imageUrl: imageUrl || null,
        timestamp: serverTimestamp(),
        createdBy: currentUser.uid,
        reactions: {
          fire: [],
          bear: [],
          eyes: []
        }
      });

      // reset form
      textEl.value = "";
      entryEl.value = "";
      slEl.value = "";
      tp1El.value = "";
      tp2El.value = "";
      tp3El.value = "";
      fileEl.value = "";

      btn.textContent = "Post Arcane Alert";
      btn.disabled = false;
    } catch (err) {
      console.error("Error posting alert:", err);
      alert("Error posting alert. Check console.");
      btn.disabled = false;
      btn.textContent = "Post Arcane Alert";
    }
  });
}

// ==========================================
// NEW ALERT BANNER
// ==========================================
function showNewAlertNotification() {
  const notif = document.getElementById("newAlertNotification");
  if (!notif) return;
  notif.style.display = "block";
  notif.onclick = () => {
    notif.style.display = "none";
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
}
