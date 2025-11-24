// alerts.js
// Arcane Alerts – live trade signals + previous trades + admin tools

import { protectPage, db } from "./auth-guard.js";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// ======================================================================
// Global state
// ======================================================================
let currentUser = null;
let isAdmin = false;

// 🔐 Admins – by UID and/or email
const ADMIN_UIDS = [
  // "your-admin-uid-here",
];

const ADMIN_EMAILS = ["leogray15@gmail.com"];

// Collections (change names here if you already use something else)
const LIVE_ALERTS_COLLECTION = "alerts_live";
const HISTORY_COLLECTION = "alerts_history";
const NOTIFICATIONS_COLLECTION = "alerts_notifications";

// ======================================================================
// Entry – protect page & bootstrap
// ======================================================================

protectPage({
  onSuccess: (user, userData) => {
    currentUser = user;
    const email = (user.email || "").toLowerCase();
    isAdmin = ADMIN_UIDS.includes(user.uid) || ADMIN_EMAILS.includes(email);

    setupAdminForm();
    subscribeToLiveAlerts();
    subscribeToHistory();
  },
  onFailure: () => {
    window.location.href = "login.html";
  },
});

// ======================================================================
// Admin form – new trade signals
// ======================================================================

function setupAdminForm() {
  const formEl = document.getElementById("alertForm");
  const postBtn = document.getElementById("postAlertBtn");
  if (!formEl) return;

  if (!isAdmin) {
    // Hide the entire admin block for non-admins
    formEl.style.display = "none";
    return;
  }

  if (!postBtn) return;

  postBtn.addEventListener("click", async () => {
    const pairInput = document.getElementById("pairInput");
    const directionSelect = document.getElementById("directionSelect");
    const entryInput = document.getElementById("entryInput");
    const slInput = document.getElementById("slInput");
    const tp1Input = document.getElementById("tp1Input");
    const tp2Input = document.getElementById("tp2Input");
    const tp3Input = document.getElementById("tp3Input");
    const notesInput = document.getElementById("notesInput");

    const pair = pairInput?.value || "XAUUSD";
    const direction = directionSelect?.value || "Buy";
    const entry = (entryInput?.value || "").trim();
    const sl = (slInput?.value || "").trim();
    const tp1 = (tp1Input?.value || "").trim();
    const tp2 = (tp2Input?.value || "").trim();
    const tp3 = (tp3Input?.value || "").trim();
    const notes = (notesInput?.value || "").trim();

    if (!entry || !sl) {
      alert("Please add at least an entry and stop loss.");
      return;
    }

    try {
      await addDoc(collection(db, LIVE_ALERTS_COLLECTION), {
        pair,
        direction,
        entry,
        sl,
        tp1: tp1 || null,
        tp2: tp2 || null,
        tp3: tp3 || null,
        notes: notes || null,
        status: "open",
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid,
        createdByEmail: currentUser.email || null,
        reactions: {
          fire: [],
          rocket: [],
          eyes: [],
        },
      });

      // fire a lightweight notification doc that a new trade was posted
      await createNotification("NEW_TRADE", {
        pair,
        direction,
      });

      // Clear form
      if (entryInput) entryInput.value = "";
      if (slInput) slInput.value = "";
      if (tp1Input) tp1Input.value = "";
      if (tp2Input) tp2Input.value = "";
      if (tp3Input) tp3Input.value = "";
      if (notesInput) notesInput.value = "";

      alert("Trade posted. Members will see it on the live board.");
    } catch (e) {
      console.error("[AA] Failed to post trade signal", e);
      alert("Could not post trade signal. Check console for details.");
    }
  });
}

// ======================================================================
// Live alerts feed
// ======================================================================

function subscribeToLiveAlerts() {
  const container = document.getElementById("alertsContainer");
  if (!container) return;

  const q = query(
    collection(db, LIVE_ALERTS_COLLECTION),
    orderBy("createdAt", "desc")
  );

  onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        container.innerHTML = `
          <div class="alert-card">
            <div style="text-align:center; color:#9ca3af; padding: 1rem;">
              No live trades right now. When the next setup appears, it will be posted here.
            </div>
          </div>
        `;
        return;
      }

      container.innerHTML = "";

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const id = docSnap.id;
        const card = renderLiveAlertCard(id, data);
        if (card) container.appendChild(card);
      });
    },
    (err) => {
      console.error("[AA] Failed to subscribe to alerts", err);
      container.innerHTML = `
        <div class="alert-card">
          <div style="text-align:center; color:#ef4444; padding: 1rem;">
            Failed to load live signals. Refresh the page.
          </div>
        </div>
      `;
    }
  );
}

function renderLiveAlertCard(id, data) {
  const {
    pair,
    direction,
    entry,
    sl,
    tp1,
    tp2,
    tp3,
    notes,
    createdAt,
    reactions,
  } = data;

  const createdDate = createdAt?.toDate
    ? createdAt.toDate()
    : createdAt
    ? new Date(createdAt)
    : null;

  const timeString = createdDate
    ? createdDate.toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Live";

  const card = document.createElement("div");
  card.className = "alert-card";

  const dirColor =
    direction === "Buy" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)";
  const dirTextColor = direction === "Buy" ? "#22c55e" : "#ef4444";

  const r = reactions || {};
  const fireCount = Array.isArray(r.fire) ? r.fire.length : 0;
  const rocketCount = Array.isArray(r.rocket) ? r.rocket.length : 0;
  const eyesCount = Array.isArray(r.eyes) ? r.eyes.length : 0;

  card.innerHTML = `
    <div class="alert-header">
      <div>
        <div class="alert-title">${pair} <span style="font-size:0.85rem; color:#9ca3af;">• ${direction}</span></div>
        <div class="alert-subtitle">Live trade setup</div>
      </div>
      <div class="alert-badge" style="background:${dirColor}; color:${dirTextColor};">
        ${direction.toUpperCase()}
      </div>
    </div>

    <div class="trade-details">
      <div>
        <div class="trade-label">Entry</div>
        <div class="trade-value">${entry || "-"}</div>
      </div>
      <div>
        <div class="trade-label">Stop Loss</div>
        <div class="trade-value">${sl || "-"}</div>
      </div>
      <div>
        <div class="trade-label">TP1</div>
        <div class="trade-value">${tp1 || "-"}</div>
      </div>
      <div>
        <div class="trade-label">TP2</div>
        <div class="trade-value">${tp2 || "-"}</div>
      </div>
      <div>
        <div class="trade-label">TP3</div>
        <div class="trade-value">${tp3 || "-"}</div>
      </div>
    </div>

    ${
      notes
        ? `<div class="trade-notes">
             <div class="trade-label" style="margin-bottom:0.25rem;">Notes</div>
             <div class="trade-value">${escapeHtml(notes)}</div>
           </div>`
        : ""
    }

    <div class="trade-footer">
      <div class="trade-time">${timeString}</div>
      <div class="reactions">
        <button class="reaction-btn" data-reaction="fire">🔥 <span>${fireCount}</span></button>
        <button class="reaction-btn" data-reaction="rocket">🚀 <span>${rocketCount}</span></button>
        <button class="reaction-btn" data-reaction="eyes">👀 <span>${eyesCount}</span></button>
      </div>
    </div>

    ${
      isAdmin
        ? `
      <div class="admin-actions">
        <button class="admin-btn win" data-action="TP1">TP1 HIT</button>
        <button class="admin-btn win" data-action="TP2">TP2 HIT</button>
        <button class="admin-btn win" data-action="TP3">TP3 HIT</button>
        <button class="admin-btn loss" data-action="LOSS">LOSS</button>
        <button class="admin-btn be" data-action="BE">BREAK EVEN</button>
      </div>
    `
        : ""
    }
  `;

  // Hook reactions
  const reactionButtons = card.querySelectorAll(".reaction-btn");
  reactionButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const reactionType = btn.getAttribute("data-reaction");
      handleReaction(id, reactionType, btn);
    });
  });

  // Hook admin actions
  if (isAdmin) {
    const adminButtons = card.querySelectorAll(".admin-btn");
    adminButtons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const action = btn.getAttribute("data-action");
        await handleAdminAction(id, data, action);
      });
    });
  }

  return card;
}

// ======================================================================
// Reactions
// ======================================================================

async function handleReaction(alertId, type, btnElement) {
  if (!currentUser) return;
  if (!["fire", "rocket", "eyes"].includes(type)) return;

  try {
    const alertRef = doc(db, LIVE_ALERTS_COLLECTION, alertId);
    await updateDoc(alertRef, {
      [`reactions.${type}`]: arrayUnion(currentUser.uid),
    });
    // optimistic UI bump
    const span = btnElement.querySelector("span");
    const current = parseInt(span?.textContent || "0", 10);
    if (span) span.textContent = String(current + 1);
  } catch (e) {
    console.error("[AA] Failed to react to alert", e);
  }
}

// ======================================================================
// Admin actions – TP1/TP2/TP3/Loss/BE
// ======================================================================

async function handleAdminAction(alertId, data, action) {
  if (!isAdmin) return;

  const pair = data.pair;
  const direction = data.direction;
  const entry = data.entry;
  const sl = data.sl;
  const tp1 = data.tp1;
  const tp2 = data.tp2;
  const tp3 = data.tp3;

  let result = null;
  let tpHit = 0;
  let exit = null;
  let notificationType = null;

  if (action === "TP1") {
    result = "win";
    tpHit = 1;
    exit = tp1 || entry;
    notificationType = "TP1_HIT";
  } else if (action === "TP2") {
    result = "win";
    tpHit = 2;
    exit = tp2 || tp1 || entry;
    notificationType = "TP2_HIT";
  } else if (action === "TP3") {
    result = "win";
    tpHit = 3;
    exit = tp3 || tp2 || tp1 || entry;
    notificationType = "TP3_HIT";
  } else if (action === "LOSS") {
    result = "loss";
    tpHit = 0;
    exit = sl || entry;
    notificationType = "LOSS_HIT";
  } else if (action === "BE") {
    result = "be";
    tpHit = 0;
    exit = entry;
    notificationType = "BE_HIT";
  } else {
    return;
  }

  const pips = calculatePips(pair, direction, entry, exit);

  try {
    // 1) Add to history (previous trades table)
    await addDoc(collection(db, HISTORY_COLLECTION), {
      pair,
      direction,
      entry,
      exit,
      result,
      tpHit,
      pips,
      closedAt: serverTimestamp(),
      openedAt: data.createdAt || null,
    });

    // 2) Remove from live
    await deleteDoc(doc(db, LIVE_ALERTS_COLLECTION, alertId));

    // 3) Fire notification doc so Cloud Functions / bots can push to the group
    await createNotification(notificationType, {
      pair,
      direction,
      result,
      tpHit,
    });
  } catch (e) {
    console.error("[AA] Failed to close trade", e);
    alert("Could not update trade. Check console for details.");
  }
}

// ======================================================================
// Notifications helper – used for group / Telegram bot integrations
// ======================================================================

async function createNotification(type, payload) {
  try {
    await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
      type,
      payload,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn("[AA] Failed to create notification doc", e);
  }
}

// ======================================================================
// History + performance stats
// ======================================================================

function subscribeToHistory() {
  const tbody = document.getElementById("historyTableBody");
  const winsEl = document.getElementById("winsCount");
  const lossesEl = document.getElementById("lossesCount");
  const beEl = document.getElementById("beCount");
  const winRateEl = document.getElementById("winRate");
  const netPipsEl = document.getElementById("netPips");

  if (!tbody) return;

  const q = query(
    collection(db, HISTORY_COLLECTION),
    orderBy("closedAt", "desc")
  );

  onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align:center; color:#9ca3af; padding: 2rem;">
              No closed trades yet. Mark live signals as WIN/LOSS/BE/TP1/2/3 to track performance.
            </td>
          </tr>
        `;
        if (winsEl) winsEl.textContent = "0";
        if (lossesEl) lossesEl.textContent = "0";
        if (beEl) beEl.textContent = "0";
        if (winRateEl) winRateEl.textContent = "0%";
        if (netPipsEl) netPipsEl.textContent = "0";
        return;
      }

      tbody.innerHTML = "";

      let wins = 0;
      let losses = 0;
      let bes = 0;
      let netPips = 0;

      snapshot.forEach((docSnap) => {
        const rowData = docSnap.data();
        const row = renderHistoryRow(rowData);
        tbody.appendChild(row);

        if (rowData.result === "win") {
          wins += 1;
        } else if (rowData.result === "loss") {
          losses += 1;
        } else if (rowData.result === "be") {
          bes += 1;
        }

        if (typeof rowData.pips === "number") {
          netPips += rowData.pips;
        }
      });

      const totalClosed = wins + losses;
      const winRate =
        totalClosed > 0 ? Math.round((wins / totalClosed) * 100) : 0;

      if (winsEl) winsEl.textContent = String(wins);
      if (lossesEl) lossesEl.textContent = String(losses);
      if (beEl) beEl.textContent = String(bes);
      if (winRateEl) winRateEl.textContent = `${winRate}%`;
      if (netPipsEl) netPipsEl.textContent = String(Math.round(netPips));
    },
    (err) => {
      console.error("[AA] Failed to subscribe to trade history", err);
    }
  );
}

function renderHistoryRow(data) {
  const tr = document.createElement("tr");

  const closedDate = data.closedAt?.toDate
    ? data.closedAt.toDate()
    : data.closedAt
    ? new Date(data.closedAt)
    : null;

  const dateStr = closedDate
    ? closedDate.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
      })
    : "-";

  const result = data.result || "-";
  const pips = typeof data.pips === "number" ? data.pips : null;

  const resultLabel =
    result === "win" ? "WIN" : result === "loss" ? "LOSS" : result === "be" ? "B/E" : "-";

  const resultClass =
    result === "win"
      ? "win"
      : result === "loss"
      ? "loss"
      : result === "be"
      ? "be"
      : "";

  tr.innerHTML = `
    <td>${dateStr}</td>
    <td>${data.pair || "-"}</td>
    <td>${data.direction || "-"}</td>
    <td>${data.entry || "-"}</td>
    <td>${data.exit || "-"}</td>
    <td>
      <span class="result-badge ${resultClass}">
        ${resultLabel}
      </span>
    </td>
    <td>${pips !== null ? pips : "-"}</td>
  `;

  return tr;
}

// ======================================================================
// Helpers
// ======================================================================

function calculatePips(pair, direction, entryRaw, exitRaw) {
  const entry = parseFloat(entryRaw);
  const exit = parseFloat(exitRaw);
  if (!isFinite(entry) || !isFinite(exit)) return 0;

  const upperPair = (pair || "").toUpperCase();
  let multiplier = 1;

  if (upperPair.endsWith("JPY")) {
    multiplier = 100;
  } else if (
    upperPair.includes("XAU") ||
    upperPair.includes("XAG") ||
    upperPair.includes("BTC") ||
    upperPair.includes("ETH")
  ) {
    multiplier = 1;
  } else {
    multiplier = 10000; // standard FX pips
  }

  let diff = exit - entry;
  if (direction === "Sell") {
    diff = entry - exit;
  }

  return Math.round(diff * multiplier);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
