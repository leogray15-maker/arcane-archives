// netlify/functions/verify.js
// Verifies a Stripe checkout session and activates the user's account via Firebase Admin SDK

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "");
const admin = require("firebase-admin");

// Initialize Firebase Admin (shared pattern with stripe-webhook.js)
let db;
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } else {
      console.error("❌ FIREBASE_SERVICE_ACCOUNT not set");
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

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const { sessionId, uid } = body;

  if (!sessionId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing sessionId" }) };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("❌ STRIPE_SECRET_KEY not set");
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Server misconfigured" }) };
  }

  try {
    // 1. Verify with Stripe
    console.log("🔍 Retrieving Stripe session:", sessionId);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    console.log("📊 Session status:", session.status, "| payment_status:", session.payment_status);

    const isPaid = session.payment_status === "paid" && session.status === "complete";

    if (!isPaid) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          payment_status: session.payment_status,
          status: session.status,
          activated: false,
        }),
      };
    }

    // 2. Find the Firebase user to activate
    const email =
      session.customer_details?.email ||
      session.metadata?.email ||
      session.customer_email ||
      null;

    console.log("📧 Customer email:", email, "| UID from client:", uid);

    if (!db) {
      console.error("❌ Firestore not ready");
      // Still return payment info even if DB write fails
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          payment_status: session.payment_status,
          status: session.status,
          customer: session.customer,
          subscription: session.subscription,
          activated: false,
          error: "Database not available",
        }),
      };
    }

    let userRef = null;

    // Try by UID first (most reliable)
    if (uid) {
      userRef = db.collection("Users").doc(uid);
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        console.log("⚠️ No Users doc for uid:", uid, "— will create one");
      } else {
        console.log("✅ Found user by UID:", uid);
      }
    }

    // Fallback: look up by email
    if (!userRef && email) {
      const snap = await db.collection("Users").where("Email", "==", email).limit(1).get();
      if (!snap.empty) {
        userRef = snap.docs[0].ref;
        console.log("✅ Found user by email:", email);
      }
    }

    // Also try metadata firebaseUid from checkout session
    if (!userRef && session.metadata?.firebaseUid) {
      const metaUid = session.metadata.firebaseUid;
      userRef = db.collection("Users").doc(metaUid);
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        console.log("⚠️ No Users doc for metadata uid:", metaUid);
        userRef = null;
      } else {
        console.log("✅ Found user by metadata UID:", metaUid);
      }
    }

    // 3. Activate the account via Admin SDK (bypasses Firestore security rules)
    let activated = false;
    if (userRef) {
      await userRef.set(
        {
          isPaid: true,
          subscriptionStatus: "active",
          stripeCustomerId: session.customer || null,
          stripeSubscriptionId: session.subscription || null,
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      console.log("✅ User activated in Firestore");
      activated = true;
    } else {
      console.error("❌ Could not locate user to activate. email:", email, "uid:", uid);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        payment_status: session.payment_status,
        status: session.status,
        customer: session.customer,
        subscription: session.subscription,
        activated,
      }),
    };
  } catch (err) {
    console.error("❌ verify error:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
