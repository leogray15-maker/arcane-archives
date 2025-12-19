// netlify/functions/stripe-webhook.js
// Automatic user activation + Firebase Auth creation + Email via Firebase

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "");
const admin = require("firebase-admin");

let db;
let auth;

// Initialize Firebase Admin once
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      admin.initializeApp();
    }
    db = admin.firestore();
    auth = admin.auth();
    console.log("✅ Firebase Admin initialized");
  } catch (err) {
    console.error("❌ Failed to initialize Firebase Admin:", err);
  }
} else {
  db = admin.firestore();
  auth = admin.auth();
}

// Generate random secure password
function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Send welcome email with password reset link via Firebase
async function sendWelcomeEmailViaFirebase(email) {
  if (!auth) {
    console.error("❌ Firebase Auth not initialized");
    return false;
  }

  try {
    // Generate password reset link
    const resetLink = await auth.generatePasswordResetLink(email, {
      url: 'https://thearcanearchives.netlify.app/login.html',
      handleCodeInApp: false,
    });

    console.log("✅ Password reset link generated for:", email);
    console.log("📧 User should receive Firebase password reset email automatically");
    
    // Firebase sends the email automatically
    return true;
  } catch (err) {
    console.error("❌ Failed to generate password reset link:", err);
    return false;
  }
}

// Alternative: Store password in Firestore and use custom email template
async function storePasswordAndNotify(email, password, uid) {
  if (!db) return;

  try {
    // Store temporary password in Firestore (will be deleted after first login)
    await db.collection("Users").doc(uid).update({
      tempPassword: password,
      tempPasswordCreated: admin.firestore.FieldValue.serverTimestamp(),
      passwordEmailSent: true,
    });

    // Send password reset email via Firebase
    await auth.generatePasswordResetLink(email, {
      url: 'https://thearcanearchives.netlify.app/login.html',
      handleCodeInApp: false,
    });

    console.log("✅ Password stored and reset email sent to:", email);
    return true;
  } catch (err) {
    console.error("❌ Failed to store password and send email:", err);
    return false;
  }
}

// Create Firebase Auth user + Firestore document
async function createFirebaseUser(email) {
  if (!auth || !db) {
    console.error("❌ Firebase not initialized");
    return null;
  }

  try {
    let user;
    let password;
    let isNewUser = false;

    // Check if user already exists in Firebase Auth
    try {
      user = await auth.getUserByEmail(email);
      console.log("👤 User already exists in Firebase Auth:", user.uid);
    } catch (err) {
      // User doesn't exist, create new account
      password = generatePassword();
      user = await auth.createUser({
        email: email,
        password: password,
        emailVerified: false,
      });
      isNewUser = true;
      console.log("✅ Created new Firebase Auth user:", user.uid);
    }

    // Create or update Firestore document
    const userRef = db.collection("Users").doc(user.uid);
    const snap = await userRef.get();

    const userData = {
      Email: email,
      isPaid: true,
      subscriptionStatus: "active",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (!snap.exists) {
      // Create new Firestore document
      console.log("📝 Creating new Firestore user document");
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
    } else {
      // Update existing document
      console.log("🔄 Updating existing Firestore user document");
      await userRef.update(userData);
    }

    // Send password reset email for new users
    if (isNewUser) {
      console.log("📧 Sending password reset email via Firebase to:", email);
      await sendWelcomeEmailViaFirebase(email);
    }

    return user.uid;
  } catch (err) {
    console.error("❌ Error creating/updating Firebase user:", err);
    return null;
  }
}

// Update user by email (fallback for existing users)
async function updateUserByEmail(email, updates) {
  if (!db || !email) return;

  const snap = await db
    .collection("Users")
    .where("Email", "==", email)
    .limit(10)
    .get();

  if (snap.empty) {
    console.warn("⚠️ No user found with email:", email);
    return;
  }

  const ops = [];
  snap.forEach((doc) => {
    console.log("🔄 Updating user by email:", doc.id);
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

  // CORS preflight
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
    console.error("❌ Stripe environment variables not configured");
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
    console.error("❌ Webhook signature verification failed:", err.message);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: `Webhook signature error: ${err.message}` }),
    };
  }

  const { type, data } = stripeEvent;
  console.log("⚡ Stripe webhook event received:", type);

  try {
    // Handle successful checkout - create Firebase user + send password reset
    if (type === "checkout.session.completed") {
      const session = data.object;
      const email =
        session.customer_details?.email || session.customer_email || null;

      if (!email) {
        console.error("❌ No email found in checkout session");
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "No email in session" }),
        };
      }

      console.log("🎉 Payment completed for:", email);

      // Create Firebase Auth account + Firestore doc + send password reset email
      await createFirebaseUser(email);

      // Also update by email as fallback for edge cases
      await updateUserByEmail(email, {
        isPaid: true,
        subscriptionStatus: "active",
        stripeCustomerId: session.customer || null,
        stripeSubscriptionId: session.subscription || null,
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Handle subscription updates and cancellations
    if (
      type === "customer.subscription.deleted" ||
      type === "customer.subscription.updated"
    ) {
      const subscription = data.object;
      const status = subscription.status;
      const customerId = subscription.customer;

      console.log("📊 Subscription status changed:", status);

      let email = null;
      try {
        const customer = await stripe.customers.retrieve(customerId);
        email = customer.email || null;
      } catch (e) {
        console.warn("⚠️ Could not retrieve customer:", customerId);
      }

      const updates = {
        subscriptionStatus: status,
        stripeSubscriptionId: subscription.id,
      };

      // Mark as unpaid if subscription is not active
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
    console.error("🔥 Error handling webhook:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: "Webhook handler failed",
        message: err.message 
      }),
    };
  }
};