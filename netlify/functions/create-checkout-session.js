// netlify/functions/create-checkout-session.js

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
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

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error("❌ STRIPE_SECRET_KEY is not set");
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "Server misconfigured: STRIPE_SECRET_KEY is not set",
        }),
      };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const { priceId: bodyPriceId, uid, email } = body;

    // Security: Input validation
    const validateEmail = (email) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const validatePriceId = (id) => !id || /^price_[a-zA-Z0-9]+$/.test(id);
    const validateUid = (uid) => !uid || /^[a-zA-Z0-9]{20,40}$/.test(uid);

    if (email && !validateEmail(email)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid email format" }),
      };
    }

    if (bodyPriceId && !validatePriceId(bodyPriceId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid price ID format" }),
      };
    }

    if (uid && !validateUid(uid)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid user ID format" }),
      };
    }

    // Use body priceId, env price, or hard-coded fallback (NEW £128 PRICE)
    const priceId =
      bodyPriceId ||
      process.env.STRIPE_PRICE_ID ||
      "price_1SkbkNCXghparoQFd6flbwip"; // £128/month price

    const baseUrl =
      process.env.URL ||
      process.env.DEPLOY_PRIME_URL ||
      process.env.DEPLOY_URL ||
      "https://arcanearchives.shop";

    console.log("🧾 Creating checkout session for:", email, "uid:", uid);
    console.log("💰 Using price ID:", priceId);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      billing_address_collection: "required",
      success_url: `${baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/#pricing`,
      customer_email: email || undefined,
      metadata: {
        source: "arcane_archives",
        firebaseUid: uid || "",
        email: email || "",
      },
    });

    console.log("✅ Checkout session created:", session.id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ id: session.id, url: session.url }),
    };
  } catch (error) {
    console.error("🔥 Stripe checkout error:", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || "An unexpected error occurred",
        type: error.type,
        code: error.code,
      }),
    };
  }
};