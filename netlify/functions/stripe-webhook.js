const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const admin = require("firebase-admin");

let db;

// Initialise Firebase Admin safely
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    db = admin.firestore();
    console.log("✅ Firebase admin initialised");
  } catch (err) {
    console.error("❌ Failed to init Firebase admin:", err);
  }
} else {
  db = admin.firestore();
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const sig =
    event.headers["stripe-signature"] ||
    event.headers["Stripe-Signature"];

  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  console.log("📨 Received event:", stripeEvent.type);

  try {
    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;

      const uid =
        session.client_reference_id ||
        (session.metadata && session.metadata.uid);
      const customerId = session.customer || null;
      const subscriptionId = session.subscription || null;

      console.log("Session UID:", uid);

      if (!uid) {
        console.warn("⚠️ No uid on session, skipping Firestore update");
      } else if (!db) {
        console.error("⚠️ Firestore not initialised, cannot update user");
      } else {
        console.log(`✅ Marking user ${uid} as paid in Firestore`);

        // CRITICAL FIX: Changed "users" to "Users" (capital U)
        await db.collection("Users").doc(uid).set(
          {
            isPaid: true,
            subscriptionStatus: "active",
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            lastPaymentAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    }

    return { statusCode: 200, body: "ok" };
  } catch (err) {
    console.error("🔥 Error handling webhook:", err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};