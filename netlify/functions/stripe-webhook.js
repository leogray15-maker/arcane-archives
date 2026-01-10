// netlify/functions/stripe-webhook.js
// Enhanced with AFFILIATE COMMISSION TRACKING + STORE ORDERS
// UPDATED: Store Orders are idempotent + support cart items[]

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
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function processAffiliateCommission(email) {
  console.log("💰 Processing affiliate commission for:", email);

  if (!db) {
    console.error("❌ Database not ready");
    return;
  }

  try {
    const usersSnapshot = await db
      .collection("Users")
      .where("Email", "==", email)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.log("⚠️ User not found:", email);
      return;
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();
    const referralCode = userData.referredBy;

    if (!referralCode) {
      console.log("ℹ️ No referral code for this user");
      return;
    }

    console.log("🔗 User was referred by:", referralCode);

    const referrerSnapshot = await db
      .collection("Users")
      .where("referralCode", "==", referralCode)
      .limit(1)
      .get();

    if (referrerSnapshot.empty) {
      console.log("⚠️ Referrer not found for code:", referralCode);
      return;
    }

    const referrerId = referrerSnapshot.docs[0].id;
    console.log("👤 Referrer ID:", referrerId);

    const affiliateRef = db.collection("Affiliates").doc(referrerId);
    const affiliateDoc = await affiliateRef.get();

    const commission = 25;

    if (affiliateDoc.exists()) {
      await affiliateRef.update({
        balance: admin.firestore.FieldValue.increment(commission),
        totalEarned: admin.firestore.FieldValue.increment(commission),
        activeReferrals: admin.firestore.FieldValue.increment(1),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log("✅ Updated affiliate balance +£" + commission);
    } else {
      await affiliateRef.set({
        userId: referrerId,
        referralCode: referralCode,
        balance: commission,
        totalEarned: commission,
        totalWithdrawn: 0,
        activeReferrals: 1,
        totalReferrals: 1,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log("✅ Created affiliate profile with £" + commission);
    }

    await db.collection("CommissionHistory").add({
      affiliateId: referrerId,
      referralCode: referralCode,
      referredUserId: userDoc.id,
      referredUserEmail: email,
      amount: commission,
      type: "new_subscription",
      status: "paid",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("✅ Commission recorded in history");
  } catch (error) {
    console.error("❌ Affiliate commission error:", error.message);
  }
}

async function removeAffiliateCommission(email) {
  console.log("💸 Removing affiliate commission for:", email);

  if (!db) return;

  try {
    const usersSnapshot = await db
      .collection("Users")
      .where("Email", "==", email)
      .limit(1)
      .get();

    if (usersSnapshot.empty) return;

    const userData = usersSnapshot.docs[0].data();
    const referralCode = userData.referredBy;

    if (!referralCode) return;

    const referrerSnapshot = await db
      .collection("Users")
      .where("referralCode", "==", referralCode)
      .limit(1)
      .get();

    if (referrerSnapshot.empty) return;

    const referrerId = referrerSnapshot.docs[0].id;
    const affiliateRef = db.collection("Affiliates").doc(referrerId);
    const affiliateDoc = await affiliateRef.get();

    if (!affiliateDoc.exists()) return;

    const commission = 25;

    await affiliateRef.update({
      balance: admin.firestore.FieldValue.increment(-commission),
      activeReferrals: admin.firestore.FieldValue.increment(-1),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("✅ Removed commission -£" + commission);

    await db.collection("CommissionHistory").add({
      affiliateId: referrerId,
      referralCode: referralCode,
      amount: -commission,
      type: "subscription_cancelled",
      status: "reversed",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("❌ Remove commission error:", error.message);
  }
}

async function createFirebaseUser(email) {
  console.log("🔐 createFirebaseUser:", email);

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
          url: "https://thearcanearchives.netlify.app/login.html",
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
      ops.push(
        doc.ref.update({
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          ...updates,
        })
      );
    });

    await Promise.all(ops);
    console.log("✅ Users updated");
  } catch (err) {
    console.error("❌ updateUserByEmail error:", err.message);
  }
}

exports.handler = async (event) => {
  console.log("📨 WEBHOOK TRIGGERED");

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
    // ============================================
    // SUBSCRIPTION CHECKOUT
    // ============================================
    if (
      type === "checkout.session.completed" &&
      data.object.mode === "subscription"
    ) {
      const session = data.object;
      const email =
        session.customer_details?.email || session.customer_email || null;

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

      await processAffiliateCommission(email);
      console.log("✅ Subscription processing complete");
    }

    // ============================================
    // STORE PURCHASES (One-time payments) - SINGLE + CART
    // Idempotent: Orders/{session.id}
    // ============================================
    if (
      type === "checkout.session.completed" &&
      data.object.mode === "payment"
    ) {
      const session = data.object;
      const metadata = session.metadata || {};

      const isStoreSingle = metadata.source === "arcane_store";
      const isStoreCart = metadata.source === "arcane_store_cart";

      if (isStoreSingle || isStoreCart) {
        console.log("🛍️ Store purchase detected:", metadata.source);

        const email =
          session.customer_details?.email || session.customer_email;
        const shippingAddress = session.shipping_details?.address || {};
        const customerName =
          session.shipping_details?.name ||
          session.customer_details?.name ||
          "";

        if (!email) {
          console.error("❌ No email for store order");
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "No email for store order" }),
          };
        }

        try {
          // ✅ Idempotency: use Orders/{session.id}
          const orderRef = db.collection("Orders").doc(session.id);
          const existing = await orderRef.get();

          if (existing.exists) {
            console.log("⏭️ Order already exists, skipping:", session.id);
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({ received: true, deduped: true }),
            };
          }

          // Build items[]
          let items = [];

          if (isStoreCart) {
            // Cart items stored as JSON in metadata.items
            try {
              const parsed = JSON.parse(metadata.items || "[]");
              if (Array.isArray(parsed)) {
                items = parsed.map((it) => ({
                  productId: it.productId || "",
                  name: it.name || "",
                  priceId: it.priceId || "",
                  qty: Number(it.qty || 1),
                  color: it.color || null,
                }));
              }
            } catch (e) {
              console.warn("⚠️ Failed to parse cart metadata.items");
            }
          }

          // Fallback to single-item schema if needed
          if (isStoreSingle || items.length === 0) {
            items = [
              {
                productId: metadata.productId || "",
                name: metadata.productName || "",
                priceId: metadata.priceId || "",
                qty: 1,
                color: metadata.color || null,
              },
            ];
          }

          const orderData = {
            source: metadata.source || "arcane_store",
            items,
            userId: metadata.firebaseUid || "",
            userEmail: email,
            customerName: customerName,

            shippingAddress: {
              line1: shippingAddress.line1 || "",
              line2: shippingAddress.line2 || "",
              city: shippingAddress.city || "",
              state: shippingAddress.state || "",
              postal_code: shippingAddress.postal_code || "",
              country: shippingAddress.country || "",
            },

            stripeSessionId: session.id,
            stripePaymentIntentId: session.payment_intent || "",
            amountTotal: (session.amount_total || 0) / 100,
            currency: session.currency || "usd",
            paymentStatus: session.payment_status,

            orderStatus: "pending", // pending, processing, shipped, delivered
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          };

          await orderRef.set(orderData);
          console.log("✅ Store order created:", session.id);
        } catch (error) {
          console.error("❌ Failed to create store order:", error.message);
        }
      }
    }

    // ============================================
    // SUBSCRIPTION CANCELLED
    // ============================================
    if (type === "customer.subscription.deleted") {
      const subscription = data.object;
      const customerId = subscription.customer;

      let email = null;
      try {
        const customer = await stripe.customers.retrieve(customerId);
        email = customer.email || null;
      } catch (e) {
        console.warn("⚠️ Customer not found");
      }

      const updates = {
        subscriptionStatus: "cancelled",
        isPaid: false,
      };

      if (email) {
        await updateUserByEmail(email, updates);
        await removeAffiliateCommission(email);
      }

      console.log("✅ Subscription cancellation processed");
    }

    // ============================================
    // SUBSCRIPTION UPDATED
    // ============================================
    if (type === "customer.subscription.updated") {
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

      console.log("✅ Subscription update processed");
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
