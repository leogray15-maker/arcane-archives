// netlify/functions/stripe-webhook.js
// Handles automatic user activation when Stripe processes payments

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "");
const admin = require("firebase-admin");

let db;

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    // Try full service account JSON first
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      // Fall back to individual fields
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }

    db = admin.firestore();
    console.log("✅ Firebase admin initialized for webhooks");
  } catch (err) {
    console.error("❌ Failed to init Firebase admin:", err);
  }
}

exports.handler = async (event) => {
  // Check environment
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("❌ Stripe env vars missing");
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Server misconfigured" })
    };
  }

  const sig = event.headers["stripe-signature"];
  let stripeEvent;

  try {
    // Verify webhook signature
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return { 
      statusCode: 400, 
      body: JSON.stringify({ error: `Webhook Error: ${err.message}` })
    };
  }

  try {
    const type = stripeEvent.type;
    const data = stripeEvent.data.object;

    console.log("📩 Webhook event received:", type);

    // Handle payment events
    if (type === "checkout.session.completed") {
      const customerEmail = data.customer_details?.email || data.customer_email;
      const customerId = data.customer;
      const subscriptionId = data.subscription;

      console.log("💳 Checkout completed for:", customerEmail);

      if (db && customerEmail) {
        await updateUserSubscription(customerEmail, {
          isPaid: true,
          subscriptionStatus: 'active',
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    if (type === "invoice.payment_succeeded") {
      const customerEmail = data.customer_email;
      const customerId = data.customer;
      const subscriptionId = data.subscription;

      console.log("💰 Payment succeeded for:", customerEmail);

      if (db && customerEmail) {
        await updateUserSubscription(customerEmail, {
          isPaid: true,
          subscriptionStatus: 'active',
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          lastPaymentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    if (type === "customer.subscription.deleted") {
      const customerEmail = data.customer_email;
      
      console.log("🚫 Subscription cancelled for:", customerEmail);

      if (db && customerEmail) {
        await updateUserSubscription(customerEmail, {
          isPaid: false,
          subscriptionStatus: 'cancelled',
          cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    return { 
      statusCode: 200, 
      body: JSON.stringify({ received: true })
    };
  } catch (err) {
    console.error("🔥 Error handling webhook:", err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Internal Server Error" })
    };
  }
};

// Helper function to update user by email
async function updateUserSubscription(email, updates) {
  try {
    const usersRef = db.collection("Users");
    
    // Try matching with "Email" field (your schema)
    let snapshot = await usersRef.where("Email", "==", email).get();
    
    // Also try lowercase "email" just in case
    if (snapshot.empty) {
      snapshot = await usersRef.where("email", "==", email).get();
    }

    if (!snapshot.empty) {
      const updatePromises = [];
      snapshot.forEach((doc) => {
        console.log("📝 Updating user:", doc.id);
        updatePromises.push(doc.ref.update(updates));
      });
      await Promise.all(updatePromises);
      console.log("✅ User subscription updated");
      return true;
    } else {
      console.warn("⚠️ No user found with email:", email);
      return false;
    }
  } catch (err) {
    console.error("❌ Error updating user:", err);
    return false;
  }
}