// alerts.js – Arcane Alerts + Trade Ideas + XAUUSD chart
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
  limit,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const ADMIN_EMAIL = "leogray15@gmail.com";

let currentUser = null;
let isAdmin = false;

// Entry point – protect page and then init
protectPage({
  onSuccess: (user) => {
    currentUser = user;
    isAdmin = user.email === ADMIN_EMAIL;

    console.log("✅ Alerts access:", user.email, "Admin:", isAdmin);

    setupAdminForm();
    initAlertsFeed();
    
    // Wait for chart library to be available
    if (typeof window.LightweightCharts !== 'undefined') {
      console.log("✅ LightweightCharts loaded");
      initXauusdChart();
    } else {
      console.warn("⚠️ LightweightCharts not loaded, waiting...");
      // Wait a bit and try again
      setTimeout(() => {
        if (typeof window.LightweightCharts !== 'undefined') {
          console.log("✅ LightweightCharts loaded (delayed)");
          initXauusdChart();
        } else {
          console.error("❌ LightweightCharts failed to load");
          const fallback = document.getElementById("chartFallback");
          if (fallback) {
            fallback.style.display = "flex";
            fallback.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 48px; height: 48px; color: #a855f7;">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div style="text-align: center;">
                <div style="font-weight: 600; margin-bottom: 0.25rem;">Chart library failed to load</div>
                <div style="font-size: 0.875rem; color: #9ca3af;">Please refresh the page</div>
              </div>
            `;
          }
        }
      }, 2000);
    }
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
    const notesEl = document.getElementById("notesInput");

    const pair = (pairEl?.value || "XAUUSD").trim();
    const direction = directionEl?.value || "Long";
    const entry = entryEl?.value.trim();
    const sl = slEl?.value.trim();
    const tp1 = tp1El?.value.trim();
    const tp2 = tp2El?.value.trim();
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
        status: "open", // "win" / "loss" / "be" later
      };

      await addDoc(collection(db, "alerts"), alertData);

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
            <div style="font-size:1rem;font-weight:600;">No trade ideas yet</div>
            <div style="font-size:0.85rem;color:#9ca3af;margin-top:0.25rem;">
              Once you post trade ideas, they will appear here.
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

/**
 * Render a single alert / trade idea card
 */
function renderAlertCard(id, data) {
  const card = document.createElement("div");
  card.className = "alert-card";

  const isTrade = data.type === "trade_idea";
  const pair = data.pair || "XAUUSD";
  const direction = data.direction || "";
  const entry = data.entry || "";
  const sl = data.sl || "";
  const tp1 = data.tp1 || "";
  const tp2 = data.tp2 || "";
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
    <div class="alert-top">
      <div class="alert-type">${typeLabel}</div>
      <div class="alert-timestamp">${formatTimestamp(data.createdAt)}</div>
    </div>

    <div class="alert-main">
      <div class="alert-title">
        <span class="pair">${pair}</span>
        ${
          direction
            ? `<span class="direction ${direction.toLowerCase()}">${direction}</span>`
            : ""
        }
      </div>
      <div class="alert-entries">
        ${entry ? `<div><span>Entry:</span> ${entry}</div>` : ""}
        ${sl ? `<div><span>SL:</span> ${sl}</div>` : ""}
        ${tp1 ? `<div><span>TP1:</span> ${tp1}</div>` : ""}
        ${tp2 ? `<div><span>TP2:</span> ${tp2}</div>` : ""}
      </div>
      ${notes ? `<div class="alert-notes">${notes}</div>` : ""}
    </div>

    <div class="alert-footer">
      <div class="reactions">
        <button class="reaction-btn" data-id="${id}" data-type="fire" style="
          background:transparent;border:none;color:${
            userReactedFire ? "#f97316" : "#9ca3af"
          };
          cursor:pointer;display:inline-flex;align-items:center;gap:0.2rem;
        ">🔥 ${fireCount}</button>

        <button class="reaction-btn" data-id="${id}" data-type="bear" style="
          background:transparent;border:none;color:${
            userReactedBear ? "#f97316" : "#9ca3af"
          };
          cursor:pointer;display:inline-flex;align-items:center;gap:0.2rem;
        ">🐻 ${bearCount}</button>

        <button class="reaction-btn" data-id="${id}" data-type="eyes" style="
          background:transparent;border:none;color:${
            userReactedEyes ? "#f97316" : "#9ca3af"
          };
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
 * XAUUSD chart with proper timeframe handling
 */
function initXauusdChart() {
  const container = document.getElementById("xauChart");
  const fallback = document.getElementById("chartFallback");
  
  if (!container) {
    console.warn("⚠️ xauChart container not found");
    return;
  }

  if (!window.LightweightCharts) {
    console.error("❌ LightweightCharts not loaded");
    if (fallback) {
      fallback.style.display = "flex";
      fallback.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 48px; height: 48px; color: #a855f7;">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div style="text-align: center;">
          <div style="font-weight: 600; margin-bottom: 0.25rem;">Chart library not available</div>
          <div style="font-size: 0.875rem; color: #9ca3af;">Please refresh the page</div>
        </div>
      `;
    }
    return;
  }

  console.log("🎨 Initializing chart...");

  const chart = window.LightweightCharts.createChart(container, {
    layout: {
      background: { type: "solid", color: "#020617" },
      textColor: "#e5e7eb",
      fontSize: 11,
      fontFamily:
        "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro', sans-serif",
    },
    rightPriceScale: {
      borderColor: "#1f2937",
    },
    timeScale: {
      borderColor: "#1f2937",
      timeVisible: true,
      secondsVisible: false,
    },
    grid: {
      vertLines: { color: "#0f172a" },
      horzLines: { color: "#0f172a" },
    },
    crosshair: {
      mode: window.LightweightCharts.CrosshairMode.Normal,
    },
  });

  const candleSeries = chart.addCandlestickSeries({
    upColor: "#22c55e",
    downColor: "#ef4444",
    borderVisible: false,
    wickUpColor: "#22c55e",
    wickDownColor: "#ef4444",
  });

  const lineSeries = chart.addLineSeries({
    color: "#a855f7",
    lineWidth: 2,
    visible: false,
  });

  function resizeChart() {
    const rect = container.getBoundingClientRect();
    chart.applyOptions({
      width: rect.width,
      height: rect.height,
    });
  }

  resizeChart();
  window.addEventListener("resize", resizeChart);

  // Timeframe mapping: button value -> API interval
  const timeframeMap = {
    "1": "1min",
    "3": "3min",
    "5": "5min",
    "15": "15min",
    "30": "30min",
    "60": "60min",
    "240": "240min",
    "D": "daily"
  };

  async function loadData(timeframe = "1") {
    try {
      if (fallback) fallback.style.display = "none";

      const interval = timeframeMap[timeframe] || "1min";
      console.log(`📊 Loading chart data for interval: ${interval}`);

      const res = await fetch(
        `/.netlify/functions/xauusd-chart?interval=${encodeURIComponent(interval)}`
      );
      
      if (!res.ok) {
        throw new Error(`API error: ${res.status} - ${res.statusText}`);
      }

      const json = await res.json();
      console.log("📈 Chart API response received:", { 
        hasCandles: !!json.candles, 
        hasData: !!json.data,
        hasValues: !!json.values
      });

      const raw = json.candles || json.data || json.values || [];

      if (!Array.isArray(raw) || raw.length === 0) {
        throw new Error("No data returned from API");
      }

      const candles = raw
        .map((c) => {
          let time;
          
          // Handle different time formats
          if (c.time) {
            time = typeof c.time === 'string' ? new Date(c.time).getTime() / 1000 : c.time;
          } else if (c.timestamp) {
            time = typeof c.timestamp === 'string' ? new Date(c.timestamp).getTime() / 1000 : c.timestamp;
          } else if (c.date) {
            time = new Date(c.date).getTime() / 1000;
          } else if (c.datetime) {
            time = new Date(c.datetime).getTime() / 1000;
          }

          return {
            time: Math.floor(time),
            open: parseFloat(c.open),
            high: parseFloat(c.high),
            low: parseFloat(c.low),
            close: parseFloat(c.close),
          };
        })
        .filter((c) => c.time && !isNaN(c.open) && !isNaN(c.close))
        .sort((a, b) => a.time - b.time);

      console.log(`✅ Processed ${candles.length} candles`);

      if (candles.length === 0) {
        throw new Error("No valid candles after processing");
      }

      candleSeries.setData(candles);
      lineSeries.setData(
        candles.map((c) => ({
          time: c.time,
          value: c.close,
        }))
      );

      chart.timeScale().fitContent();
      console.log("✅ Chart loaded successfully");
      
    } catch (err) {
      console.error("❌ Error loading XAUUSD chart:", err);
      if (fallback) {
        fallback.style.display = "flex";
        fallback.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 48px; height: 48px; color: #a855f7;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <div style="text-align: center;">
            <div style="font-weight: 600; margin-bottom: 0.25rem;">Chart temporarily unavailable</div>
            <div style="font-size: 0.875rem; color: #9ca3af;">${err.message}</div>
            <div style="font-size: 0.75rem; color: #6b7280; margin-top: 0.5rem;">Powered by AlphaVantage - updates periodically</div>
          </div>
        `;
      }
    }
  }

  // Default load
  loadData("1");

  // Timeframe buttons
  const tfButtons = document.querySelectorAll(".tf-btn");
  tfButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tf = btn.dataset.timeframe || "1";
      tfButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      loadData(tf);
    });
  });

  // Mode buttons – candles / line
  const modeButtons = document.querySelectorAll(".chart-toggle");
  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.chartMode || "candle";
      modeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      if (mode === "line") {
        candleSeries.applyOptions({ visible: false });
        lineSeries.applyOptions({ visible: true });
      } else {
        candleSeries.applyOptions({ visible: true });
        lineSeries.applyOptions({ visible: false });
      }
    });
  });
}

// Debug helper in console
window.arcaneAlerts = {
  getCurrentUser: () => currentUser,
  isAdmin: () => isAdmin,
  checkChart: () => {
    console.log("LightweightCharts available:", typeof window.LightweightCharts !== 'undefined');
    console.log("Container exists:", !!document.getElementById("xauChart"));
  }
};