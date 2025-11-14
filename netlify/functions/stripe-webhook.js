// netlify/functions/stripe-webhook.js

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = require("stripe")(stripeSecret || "");
const admin = require("firebase-admin");

let db;

// Initialise Firebase Admin using service account JSON
if (!admin.apps.length) {
  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountJson) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT env var is not set");
    }

    const serviceAccount = JSON.parse(serviceAccountJson);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    db = admin.firestore();
    console.log("✅ Firebase admin initialised");
  } catch (err) {
    console.error("❌ Failed to init Firebase admin:", err);
  }
}

exports.handler = async (event) => {
  if (!stripeSecret || !webhookSecret) {
    console.error("❌ Stripe env vars missing");
    return { statusCode: 500, body: "Server misconfigured" };
  }

  const sig = event.headers["stripe-signature"];

  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      webhookSecret
    );
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  try {
    const type = stripeEvent.type;
    const data = stripeEvent.data.object;

    console.log("📩 Webhook event received:", type);

    // Only handle relevant events
    if (type === "checkout.session.completed" || type === "invoice.payment_succeeded") {
      let customerId;
      let subscriptionId;
      let customerEmail;

      if (type === "checkout.session.completed") {
        customerId = data.customer;
        subscriptionId = data.subscription;
        customerEmail = data.customer_details?.email || data.customer_email;
      }

      if (type === "invoice.payment_succeeded") {
        customerId = data.customer;
        subscriptionId = data.subscription;
        customerEmail = data.customer_email;
      }

      // If we have Firestore + email, mark user as paid
      if (db && customerEmail) {
        console.log("💾 Updating Firestore for customer:", customerEmail);

        // Find user by email - in your setup, you create docs in "Users"
        const usersRef = db.collection("Users");
        const snapshot = await usersRef.where("email", "==", customerEmail).get();

        if (!snapshot.empty) {
          snapshot.forEach(async (docSnap) => {
            await docSnap.ref.set(
              {
                isPaid: true,
                subscriptionStatus: "active",
                stripeCustomerId: customerId || null,
                stripeSubscriptionId: subscriptionId || null,
                lastPaymentAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          });
        }
      }
    }

    return { statusCode: 200, body: "ok" };
  } catch (err) {
    console.error("🔥 Error handling webhook:", err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
