// alerts.js – Arcane Alerts + Trade Ideas + XAUUSD chart (AlphaVantage via Netlify)

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
  limit,
  getDoc,
  where,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const ADMIN_EMAIL = "leogray15@gmail.com";

let currentUser = null;
let isAdmin = false;

/**
 * Entry point – protect page and then init
 */
protectPage({
  onSuccess: (user) => {
    currentUser = user;
    isAdmin = user.email === ADMIN_EMAIL;

    console.log("✅ Alerts access:", user.email, "Admin:", isAdmin);

    setupAdminForm();
    initAlertsFeed();
    initPerformanceTracking();
    initXauusdChart();
  },
  onFailure: () => {
    window.location.href = "login.html";
  },
});

/**
 * Admin-only form for posting trade ideas
 */
function setupAdminForm() {
  const formWrapper = document.getElementById("alertForm");
  const postBtn = document.getElementById("postAlertBtn");
  if (!formWrapper || !postBtn) return;

  if (!isAdmin) {
    formWrapper.style.display = "none";
    return;
  }

  formWrapper.classList.add("visible");

  postBtn.addEventListener("click", async () => {
    const pairEl = document.getElementById("pairInput");
    const directionEl = document.getElementById("directionSelect");
    const entryEl = document.getElementById("entryInput");
    const slEl = document.getElementById("slInput");
    const tp1El = document.getElementById("tp1Input");
    const tp2El = document.getElementById("tp2Input");
    const tp3El = document.getElementById("tp3Input");
    const notesEl = document.getElementById("notesInput");

    const pair = pairEl?.value || "XAUUSD";
    const direction = directionEl?.value || "Buy";
    const entry = entryEl?.value.trim();
    const sl = slEl?.value.trim();
    const tp1 = tp1El?.value.trim();
    const tp2 = tp2El?.value.trim();
    const tp3 = tp3El?.value.trim();
    const notes = notesEl?.value.trim();

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
        tp3: tp3 || null,
        notes: notes || null,
        createdAt: serverTimestamp(),
        createdBy: {
          uid: currentUser.uid,
          email: currentUser.email,
        },
        reactions: {
          fire: [],
          bear: [],
          eyes: [],
        },
        status: "open", // "win" / "loss" / "be" / "open"
        closedAt: null,
        pips: null,
      };

      await addDoc(collection(db, "alerts"), alertData);

      // Clear form
      entryEl.value = "";
      slEl.value = "";
      tp1El.value = "";
      tp2El.value = "";
      tp3El.value = "";
      notesEl.value = "";

      postBtn.textContent = "Post Trade Signal";
      postBtn.disabled = false;
      alert("✅ Trade signal posted");
    } catch (err) {
      console.error("Error posting alert:", err);
      alert("Error posting trade signal. Please try again.");
      postBtn.textContent = "Post Trade Signal";
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
  const q = query(
    alertsRef,
    where("status", "==", "open"),
    orderBy("createdAt", "desc"),
    limit(20)
  );

  onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        container.innerHTML = `
          <div class="alert-card">
            <div style="text-align: center; font-size:1rem;font-weight:600;">No active signals</div>
            <div style="text-align: center; font-size:0.85rem;color:#9ca3af;margin-top:0.25rem;">
              New trade signals will appear here once posted.
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
      attachAdminHandlers(container);
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

/**
 * Render a single alert / trade idea card
 */
function renderAlertCard(id, data) {
  const card = document.createElement("div");
  card.className = "alert-card";

  const pair = data.pair || "XAUUSD";
  const direction = data.direction || "Buy";
  const entry = data.entry || "";
  const sl = data.sl || "";
  const tp1 = data.tp1 || "";
  const tp2 = data.tp2 || "";
  const tp3 = data.tp3 || "";
  const notes = data.notes || "";

  const reactions = data.reactions || { fire: [], bear: [], eyes: [] };
  const userId = currentUser?.uid;
  const fireCount = reactions.fire?.length || 0;
  const bearCount = reactions.bear?.length || 0;
  const eyesCount = reactions.eyes?.length || 0;

  const userReactedFire = userId && reactions.fire?.includes(userId);
  const userReactedBear = userId && reactions.bear?.includes(userId);
  const userReactedEyes = userId && reactions.eyes?.includes(userId);

  card.innerHTML = `
    <div class="trade-header">
      <div class="trade-pair">${pair}</div>
      <div class="trade-direction ${direction.toLowerCase()}">${direction.toUpperCase()}</div>
    </div>

    <div class="trade-details">
      ${entry ? `<div class="trade-detail"><div class="trade-detail-label">Entry</div><div class="trade-detail-value">${entry}</div></div>` : ""}
      ${sl ? `<div class="trade-detail"><div class="trade-detail-label">Stop Loss</div><div class="trade-detail-value">${sl}</div></div>` : ""}
      ${tp1 ? `<div class="trade-detail"><div class="trade-detail-label">TP1</div><div class="trade-detail-value">${tp1}</div></div>` : ""}
      ${tp2 ? `<div class="trade-detail"><div class="trade-detail-label">TP2</div><div class="trade-detail-value">${tp2}</div></div>` : ""}
      ${tp3 ? `<div class="trade-detail"><div class="trade-detail-label">TP3</div><div class="trade-detail-value">${tp3}</div></div>` : ""}
    </div>

    ${notes ? `<div class="trade-notes">${notes}</div>` : ""}

    <div class="trade-footer">
      <div class="trade-time">${formatTimestamp(data.createdAt)}</div>
      <div class="reactions">
        <button class="reaction-btn" data-id="${id}" data-type="fire" style="color:${
    userReactedFire ? "#f97316" : "#9ca3af"
  }">🔥 ${fireCount}</button>
        <button class="reaction-btn" data-id="${id}" data-type="bear" style="color:${
    userReactedBear ? "#f97316" : "#9ca3af"
  }">🐻 ${bearCount}</button>
        <button class="reaction-btn" data-id="${id}" data-type="eyes" style="color:${
    userReactedEyes ? "#f97316" : "#9ca3af"
  }">👀 ${eyesCount}</button>
      </div>
    </div>

    ${
      isAdmin
        ? `
    <div class="admin-actions">
      <button class="admin-btn win" data-id="${id}" data-action="win">Win</button>
      <button class="admin-btn loss" data-id="${id}" data-action="loss">Loss</button>
      <button class="admin-btn be" data-id="${id}" data-action="be">Break Even</button>
    </div>
    `
        : ""
    }
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
        const snap = await getDoc(ref);
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

        reactions[type] = newArr;

        await updateDoc(ref, { reactions });
      } catch (err) {
        console.error("Error updating reactions:", err);
      }
    });
  });
}

function attachAdminHandlers(container) {
  if (!isAdmin) return;

  const adminButtons = container.querySelectorAll(".admin-btn");
  adminButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");
      if (!id || !action) return;

      // Get pip value from user
      const pipsInput = prompt(`Enter pips for this ${action.toUpperCase()} trade (e.g., +50, -30, 0):`);
      if (pipsInput === null) return; // User cancelled

      const pips = parseFloat(pipsInput) || 0;

      try {
        const ref = doc(db, "alerts", id);
        await updateDoc(ref, {
          status: action,
          closedAt: serverTimestamp(),
          pips: pips,
        });

        alert(`✅ Trade marked as ${action.toUpperCase()} with ${pips} pips`);
      } catch (err) {
        console.error("Error closing trade:", err);
        alert("Error closing trade. Please try again.");
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

/**
 * Initialize XAUUSD chart using LightweightCharts + Netlify function
 */
async function initXauusdChart() {
  const container = document.getElementById("xauusdChart");
  const errorEl = document.getElementById("chartError");

  if (!container) {
    console.error("❌ xauusdChart container not found");
    return;
  }

  if (typeof LightweightCharts === "undefined") {
    console.error("❌ LightweightCharts library not loaded");
    if (errorEl) {
      errorEl.style.display = "flex";
      errorEl.textContent = "Chart library failed to load.";
    }
    return;
  }

  console.log("📈 Initializing XAUUSD chart (AlphaVantage)...");

  // Create chart
  const chart = LightweightCharts.createChart(container, {
    layout: {
      background: { color: "#020617" },
      textColor: "#e5e7eb",
    },
    grid: {
      vertLines: { color: "#0f172a" },
      horzLines: { color: "#0f172a" },
    },
    timeScale: {
      borderColor: "#1f2933",
      timeVisible: true,
      secondsVisible: false,
    },
    rightPriceScale: {
      borderColor: "#1f2933",
    },
  });

  const candleSeries = chart.addCandlestickSeries({
    upColor: "#22c55e",
    downColor: "#ef4444",
    borderUpColor: "#22c55e",
    borderDownColor: "#ef4444",
    wickUpColor: "#22c55e",
    wickDownColor: "#ef4444",
  });

  // Resize handler
  function resizeChart() {
    const { width, height } = container.getBoundingClientRect();
    chart.applyOptions({ width, height });
  }

  window.addEventListener("resize", resizeChart);
  resizeChart();

  try {
    const res = await fetch("/.netlify/functions/xauusd-chart?interval=15min");
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const payload = await res.json();

    if (!Array.isArray(payload.candles) || payload.candles.length === 0) {
      throw new Error("No candle data returned");
    }

    const formatted = payload.candles.map((candle) => ({
      time: Math.floor(new Date(candle.time).getTime() / 1000),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));

    candleSeries.setData(formatted);
    console.log(`✅ Loaded ${formatted.length} candles from AlphaVantage`);
  } catch (err) {
    console.error("❌ Error loading chart data:", err);
    if (errorEl) {
      errorEl.style.display = "flex";
      errorEl.textContent =
        "Error loading chart data. AlphaVantage might be rate limiting. Try refreshing in a minute.";
    }
  }
}

/**
 * Performance tracking - listen to closed trades and update stats
 */
function initPerformanceTracking() {
  const alertsRef = collection(db, "alerts");
  const closedQuery = query(
    alertsRef,
    where("status", "in", ["win", "loss", "be"]),
    orderBy("closedAt", "desc"),
    limit(100)
  );

  onSnapshot(closedQuery, (snapshot) => {
    let wins = 0;
    let losses = 0;
    let breakEvens = 0;
    let totalPips = 0;

    const historyRows = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const status = data.status;
      const pips = data.pips || 0;

      if (status === "win") wins++;
      else if (status === "loss") losses++;
      else if (status === "be") breakEvens++;

      totalPips += pips;

      // Build history row
      const closedDate = data.closedAt
        ? data.closedAt.toDate().toLocaleDateString()
        : "N/A";
      historyRows.push({
        date: closedDate,
        pair: data.pair || "XAUUSD",
        direction: data.direction || "Buy",
        entry: data.entry || "N/A",
        exit:
          status === "win"
            ? data.tp1 || data.tp2 || data.tp3 || "N/A"
            : data.sl || "N/A",
        status: status,
        pips: pips,
      });
    });

    // Update stats
    document.getElementById("winsCount").textContent = wins;
    document.getElementById("lossesCount").textContent = losses;
    document.getElementById("beCount").textContent = breakEvens;

    const totalTrades = wins + losses;
    const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : 0;
    document.getElementById("winRate").textContent = `${winRate}%`;
    document.getElementById("netPips").textContent = totalPips > 0 ? `+${totalPips}` : totalPips;

    // Update history table
    updateHistoryTable(historyRows);
  });
}

function updateHistoryTable(rows) {
  const tbody = document.getElementById("historyTableBody");
  if (!tbody) return;

  if (rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: #9ca3af; padding: 2rem;">
          No closed trades yet. Mark live signals as WIN/LOSS/BE to track performance.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows
    .map(
      (row) => `
    <tr>
      <td>${row.date}</td>
      <td>${row.pair}</td>
      <td>${row.direction}</td>
      <td>${row.entry}</td>
      <td>${row.exit}</td>
      <td><span class="result-badge ${row.status}">${row.status.toUpperCase()}</span></td>
      <td style="color: ${row.pips > 0 ? "#22c55e" : row.pips < 0 ? "#ef4444" : "#a855f7"}; font-weight: 600;">
        ${row.pips > 0 ? "+" : ""}${row.pips}
      </td>
    </tr>
  `
    )
    .join("");
}

// Debug helper in console
window.arcaneAlerts = {
  getCurrentUser: () => currentUser,
  isAdmin: () => isAdmin,
};