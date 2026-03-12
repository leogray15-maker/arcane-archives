// netlify/functions/sync-subscription.js
// Checks the live Stripe subscription status and syncs it to Firestore.
// Called by auth-guard.js as a safety net alongside webhooks.

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "");
const admin = require("firebase-admin");

let db;
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } else {
      admin.initializeApp();
    }
    db = admin.firestore();
  } catch (err) {
    console.error("❌ Firebase init error:", err.message);
  }
} else {
  db = admin.firestore();
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) {}

  const { uid } = body;
  if (!uid) return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing uid" }) };
  if (!db) return { statusCode: 500, headers, body: JSON.stringify({ error: "Database not available" }) };
  if (!process.env.STRIPE_SECRET_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Server misconfigured" }) };
  }

  try {
    const userDoc = await db.collection("Users").doc(uid).get();
    if (!userDoc.exists) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: "User not found" }) };
    }

    const userData = userDoc.data();
    const subscriptionId = userData.stripeSubscriptionId;

    // No subscription on file — not a paying user
    if (!subscriptionId) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ isPaid: false, subscriptionStatus: "none" }),
      };
    }

    // Fetch live status from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const stripeStatus = subscription.status; // active, past_due, canceled, unpaid, paused, trialing
    const isActive = stripeStatus === "active" || stripeStatus === "trialing";

    console.log(`🔍 Stripe sub ${subscriptionId}: ${stripeStatus} | isPaid=${isActive}`);

    // Map Stripe status to our Firestore field
    const mappedStatus = stripeStatus === "canceled" ? "cancelled" : stripeStatus;

    // Always update the sync timestamp; only change isPaid/subscriptionStatus if different
    const firestoreIsPaid = userData.isPaid === true;
    const firestoreStatus = userData.subscriptionStatus;
    const changed = firestoreIsPaid !== isActive || firestoreStatus !== mappedStatus;

    await userDoc.ref.update({
      isPaid: isActive,
      subscriptionStatus: mappedStatus,
      lastSubSyncAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(changed && !isActive ? { cancelledAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
    });

    if (changed) {
      console.log(`✅ Synced user ${uid}: isPaid=${isActive}, status=${mappedStatus}`);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ isPaid: isActive, subscriptionStatus: mappedStatus, changed }),
    };
  } catch (err) {
    console.error("❌ sync-subscription error:", err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
