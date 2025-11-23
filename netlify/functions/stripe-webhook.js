// netlify/functions/stripe-webhook.js
// Automatic user activation + subscription updates

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "");
const admin = require("firebase-admin");

let db;

// Initialise Firebase Admin once
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      admin.initializeApp(); // uses default creds if configured
    }
    db = admin.firestore();
    console.log("✅ Firebase Admin initialized");
  } catch (err) {
    console.error("❌ Failed to initialize Firebase Admin:", err);
  }
} else {
  db = admin.firestore();
}

// Create or update a user by Firebase UID
async function upsertUserByUid(firebaseUid, email, updates) {
  if (!db || !firebaseUid) return;

  const userRef = db.collection("Users").doc(firebaseUid);
  const snap = await userRef.get();

  const baseData = {
    Email: email || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...updates,
  };

  if (!snap.exists) {
    console.log("🆕 Creating Users doc for uid:", firebaseUid);
    await userRef.set({
      xp: 0,
      level: "Apprentice",
      winsPosted: 0,
      callsAttended: 0,
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...baseData,
    });
  } else {
    console.log("📝 Updating Users doc for uid:", firebaseUid);
    await userRef.update(baseData);
  }
}

// Update any user docs that match an email
async function updateUserByEmail(email, updates) {
  if (!db || !email) return;

  const snap = await db
    .collection("Users")
    .where("Email", "==", email)
    .limit(10)
    .get();

  if (snap.empty) {
    console.warn("⚠️ No user with Email:", email);
    return;
  }

  const ops = [];
  snap.forEach((doc) => {
    console.log("📝 Updating user by email:", doc.id);
    ops.push(
      doc.ref.update({
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...updates,
      })
    );
  });
  await Promise.all(ops);
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Stripe-Signature",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("❌ Stripe env vars missing");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Stripe not configured" }),
    };
  }

  const sig =
    event.headers["stripe-signature"] ||
    event.headers["Stripe-Signature"] ||
    event.headers["STRIPE-SIGNATURE"];

  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook signature error:", err.message);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: `Webhook signature error: ${err.message}` }),
    };
  }

  const { type, data } = stripeEvent;
  console.log("⚡ Stripe event received:", type);

  try {
    // 1) Initial signup – checkout complete
    if (type === "checkout.session.completed") {
      const session = data.object;
      const email =
        session.customer_details?.email || session.customer_email || null;
      const firebaseUid = session.metadata?.firebaseUid || null;

      const updates = {
        isPaid: true,
        subscriptionStatus: "active",
        stripeCustomerId: session.customer || null,
        stripeSubscriptionId: session.subscription || null,
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (firebaseUid) {
        await upsertUserByUid(firebaseUid, email, updates);
      } else if (email) {
        await updateUserByEmail(email, updates);
      }
    }

    // 2) Subscription cancelled or updated
    if (
      type === "customer.subscription.deleted" ||
      type === "customer.subscription.updated"
    ) {
      const subscription = data.object;
      const status = subscription.status; // 'active', 'canceled', etc.
      const customerId = subscription.customer;

      let email = null;
      try {
        const customer = await stripe.customers.retrieve(customerId);
        email = customer.email || null;
      } catch (e) {
        console.warn("⚠️ Could not fetch customer:", customerId);
      }

      const updates = {
        subscriptionStatus: status,
        stripeSubscriptionId: subscription.id,
      };

      if (status !== "active") {
        updates.isPaid = false;
      }

      if (email) {
        await updateUserByEmail(email, updates);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ received: true }),
    };
  } catch (err) {
    console.error("🔥 Error handling webhook:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Webhook handler failed" }),
    };
  }
};
