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
        availableBalance: admin.firestore.FieldValue.increment(commission),
        totalEarned: admin.firestore.FieldValue.increment(commission),
        activeReferrals: admin.firestore.FieldValue.increment(1),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log("✅ Updated affiliate balance +£" + commission);

      // Log balance transaction
      await db.collection("BalanceTransactions").add({
        userId: referrerId,
        type: "commission",
        amount: commission,
        note: `Referral commission for ${email}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    } else {
      await affiliateRef.set({
        userId: referrerId,
        referralCode: referralCode,
        balance: commission,
        availableBalance: commission,
        totalEarned: commission,
        totalWithdrawn: 0,
        activeReferrals: 1,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log("✅ Created new affiliate with balance: £" + commission);

      await db.collection("BalanceTransactions").add({
        userId: referrerId,
        type: "commission",
        amount: commission,
        note: `Referral commission for ${email}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // CommissionHistory (existing)
    await db.collection("CommissionHistory").add({
      affiliateId: referrerId,
      amount: commission,
      type: "referral",
      note: `Commission for referral signup: ${email}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  } catch (err) {
    console.error("❌ Commission processing error:", err.message);
  }
}

exports.handler = async (event) => {
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

  let stripeEvent;

  try {
    const sig = event.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("❌ STRIPE_WEBHOOK_SECRET is not set");
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Webhook secret not set" }),
      };
    }

    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      webhookSecret
    );
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: `Webhook Error: ${err.message}` }),
    };
  }

  const type = stripeEvent.type;
  const data = stripeEvent.data;

  console.log("📩 Stripe Event:", type);

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
        console.error("❌ No email in checkout session");
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "No email found" }),
        };
      }

      // Mark user as paid (existing behavior)
      const usersSnapshot = await db
        .collection("Users")
        .where("Email", "==", email)
        .limit(1)
        .get();

      if (!usersSnapshot.empty) {
        const userRef = usersSnapshot.docs[0].ref;
        await userRef.update({
          isPaid: true,
          subscriptionStatus: "active",
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          stripeCustomerId: session.customer || "",
        });
        console.log("✅ User marked as paid:", email);

        // Process affiliate commission for subscription payments
        await processAffiliateCommission(email);
      } else {
        console.log("⚠️ User not found in Users collection:", email);
      }
    }

    // ============================================
    // ONE-TIME STORE PURCHASES (SINGLE + CART)
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
          session.customer_details?.email ||
          session.customer_email;
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
          // ✅ Idempotency: use Orders/{orderId} (fallback to session.id)
          const orderId = metadata.orderId || session.id;
          const orderRef = db.collection("Orders").doc(orderId);
          const existing = await orderRef.get();

          if (existing.exists) {
            console.log("⏭️ Order already exists, skipping:", orderId);
          } else {
            let items = [];

            if (isStoreCart && metadata.items) {
              try {
                items = JSON.parse(metadata.items);
              } catch {
                items = [];
              }
            } else {
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
              orderId: orderId,
              source: metadata.source,

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

              orderStatus: "pending",
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            await orderRef.set(orderData);
            console.log("✅ Store order created:", orderId);
          }
        } catch (error) {
          console.error("❌ Failed to create store order:", error.message);
        }
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
