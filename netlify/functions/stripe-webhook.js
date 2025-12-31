// netlify/functions/stripe-webhook.js
// Enhanced with comprehensive logging

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "");
const admin = require("firebase-admin");

let db;
let auth;

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    console.log("🔧 Initializing Firebase Admin...");
    
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("✅ Firebase initialized with service account");
    } else {
      console.error("❌ FIREBASE_SERVICE_ACCOUNT not found");
      admin.initializeApp();
    }
    
    db = admin.firestore();
    auth = admin.auth();
    console.log("✅ Firebase Admin initialized");
  } catch (err) {
    console.error("❌ Firebase init error:", err.message);
  }
} else {
  db = admin.firestore();
  auth = admin.auth();
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function createFirebaseUser(email) {
  console.log("📝 createFirebaseUser:", email);
  
  if (!auth || !db) {
    console.error("❌ Firebase not ready");
    return null;
  }

  try {
    let user;
    let isNewUser = false;

    try {
      user = await auth.getUserByEmail(email);
      console.log("👤 User exists:", user.uid);
    } catch (err) {
      const password = generatePassword();
      user = await auth.createUser({
        email: email,
        password: password,
        emailVerified: false,
      });
      isNewUser = true;
      console.log("✅ Auth user created:", user.uid);
    }

    const userRef = db.collection("Users").doc(user.uid);
    const snap = await userRef.get();

    const userData = {
      Email: email,
      isPaid: true,
      subscriptionStatus: "active",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (!snap.exists) {
      await userRef.set({
        Username: email.split("@")[0],
        Xp: 0,
        Level: "Seeker",
        WinsPosted: 0,
        CallAttended: 0,
        ModulesCompleted: 0,
        completedModuleIds: [],
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLoginDate: admin.firestore.FieldValue.serverTimestamp(),
        loginStreak: 1,
        ...userData,
      });
      console.log("✅ Firestore doc created");
    } else {
      await userRef.update(userData);
      console.log("✅ Firestore doc updated");
    }

    if (isNewUser) {
      try {
        await auth.generatePasswordResetLink(email, {
          url: 'https://thearcanearchives.netlify.app/login.html',
        });
        console.log("✅ Password reset sent");
      } catch (emailErr) {
        console.error("❌ Email error:", emailErr.message);
      }
    }

    return user.uid;
  } catch (err) {
    console.error("❌ createFirebaseUser error:", err.message);
    return null;
  }
}

async function updateUserByEmail(email, updates) {
  if (!db || !email) return;

  try {
    const snap = await db
      .collection("Users")
      .where("Email", "==", email)
      .limit(10)
      .get();

    if (snap.empty) {
      console.warn("⚠️ No users with email:", email);
      return;
    }

    const ops = [];
    snap.forEach((doc) => {
      ops.push(doc.ref.update({
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...updates,
      }));
    });
    
    await Promise.all(ops);
    console.log("✅ Users updated");
  } catch (err) {
    console.error("❌ updateUserByEmail error:", err.message);
  }
}

exports.handler = async (event) => {
  console.log("🔔 WEBHOOK TRIGGERED");
  
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Stripe-Signature",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

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
    console.log("✅ Signature verified");
  } catch (err) {
    console.error("❌ Signature error:", err.message);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }

  const { type, data } = stripeEvent;
  console.log("📦 Event:", type);

  try {
    if (type === "checkout.session.completed") {
      const session = data.object;
      const email = session.customer_details?.email || session.customer_email || null;
      
      console.log("📧 Email:", email);
      console.log("💰 Payment:", session.payment_status);

      if (!email) {
        console.error("❌ No email");
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "No email" }),
        };
      }

      await createFirebaseUser(email);
      await updateUserByEmail(email, {
        isPaid: true,
        subscriptionStatus: "active",
        stripeCustomerId: session.customer || null,
        stripeSubscriptionId: session.subscription || null,
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log("✅ Processing complete");
    }

    if (
      type === "customer.subscription.deleted" ||
      type === "customer.subscription.updated"
    ) {
      const subscription = data.object;
      const status = subscription.status;
      const customerId = subscription.customer;

      let email = null;
      try {
        const customer = await stripe.customers.retrieve(customerId);
        email = customer.email || null;
      } catch (e) {
        console.warn("⚠️ Customer not found");
      }

      const updates = {
        subscriptionStatus: status,
        stripeSubscriptionId: subscription.id,
      };

      if (status !== "active" && status !== "trialing") {
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
    console.error("❌ Handler error:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};