// netlify/functions/create-store-balance-order.js
// Creates a STORE ORDER paid with the user's affiliate balance (no Stripe)
// Requires Firebase ID token in Authorization: Bearer <token>

const admin = require("firebase-admin");

let db;

function initFirebase() {
  if (db) return db;

  if (!admin.apps.length) {
    try {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log("✅ Firebase initialized with service account");
      } else {
        admin.initializeApp();
        console.log("✅ Firebase initialized with default creds");
      }
    } catch (e) {
      console.error("❌ Firebase init error:", e.message);
      throw e;
    }
  }

  db = admin.firestore();
  return db;
}

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  };
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const db = initFirebase();

    // Auth
    const authHeader = event.headers.authorization || event.headers.Authorization || "";
    const m = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!m) return json(401, { error: "Missing Authorization Bearer token" });

    const idToken = m[1].trim();
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email || "";

    const body = event.body ? JSON.parse(event.body) : {};
    const items = Array.isArray(body.items) ? body.items : [];

    if (!uid) return json(401, { error: "Invalid token" });
    if (!items.length) return json(400, { error: "Cart is empty" });

    // Load product prices from Firestore to prevent client tampering
    // Expected schema: Products/{productId}.price (number, in GBP)
    const productIds = [...new Set(items.map((it) => String(it.productId || "").trim()).filter(Boolean))];
    if (!productIds.length) return json(400, { error: "Missing productId(s)" });

    const productSnaps = await Promise.all(
      productIds.map((pid) => db.collection("Products").doc(pid).get())
    );

    const priceMap = {};
    productSnaps.forEach((snap, i) => {
      const pid = productIds[i];
      if (!snap.exists) throw new Error(`Product not found: ${pid}`);
      const p = snap.data() || {};
      const price = Number(p.price || 0);
      if (!Number.isFinite(price) || price <= 0) throw new Error(`Invalid price for product: ${pid}`);
      priceMap[pid] = price;
    });

    const normalizedItems = items.map((it) => {
      const productId = String(it.productId || "").trim();
      const qty = Math.max(1, Number(it.qty || 1));
      const unitPrice = priceMap[productId] ?? 0;

      return {
        productId,
        name: String(it.name || ""),
        qty,
        color: it.color ? String(it.color) : null,
        unitPrice,
      };
    });

    const subtotal = normalizedItems.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);

    // Read affiliate balance
    const affiliateRef = db.collection("Affiliates").doc(uid);
    const orderId = `bal_${uid}_${Date.now()}`;

    await db.runTransaction(async (tx) => {
      const affiliateSnap = await tx.get(affiliateRef);
      const affiliate = affiliateSnap.exists ? affiliateSnap.data() : {};

      const current = Number(affiliate.availableBalance ?? affiliate.balance ?? 0);
      if (!Number.isFinite(current)) throw new Error("Invalid affiliate balance");
      if (current < subtotal) throw new Error("Insufficient balance");

      // Debit balance (keep both fields for compatibility)
      tx.set(
        affiliateRef,
        {
          userId: uid,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      tx.update(affiliateRef, {
        availableBalance: admin.firestore.FieldValue.increment(-subtotal),
        balance: admin.firestore.FieldValue.increment(-subtotal),
      });

      // Create order
      const orderRef = db.collection("Orders").doc(orderId);
      tx.set(orderRef, {
        orderId,
        source: "arcane_store_balance",
        items: normalizedItems,
        userId: uid,
        userEmail: email,
        customerName: "",
        shippingAddress: null,

        stripeSessionId: null,
        stripePaymentIntentId: null,

        amountTotal: subtotal,
        currency: "gbp",
        paymentStatus: "paid",
        orderStatus: "pending",

        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Balance transaction log
      const txRef = db.collection("BalanceTransactions").doc();
      tx.set(txRef, {
        userId: uid,
        type: "purchase",
        amount: -subtotal,
        note: `Store purchase (${normalizedItems.length} item${normalizedItems.length === 1 ? "" : "s"})`,
        orderId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return json(200, { orderId });
  } catch (e) {
    console.error("🔥 Balance order error:", e);
    const msg = String(e.message || "Balance checkout failed");

    const status = /insufficient balance|cart is empty|missing product|invalid price|product not found/i.test(msg)
      ? 400
      : 500;

    return json(status, { error: msg });
  }
};
