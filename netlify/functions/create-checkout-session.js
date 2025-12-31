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

    // Use body priceId, env price, or hard-coded fallback
    const priceId =
      bodyPriceId ||
      process.env.STRIPE_PRICE_ID ||
      "price_1SRnIxCXghparoQFb0oQPUes"; // <- change if needed

    const baseUrl =
      process.env.URL ||
      process.env.DEPLOY_PRIME_URL ||
      process.env.DEPLOY_URL ||
      "https://thearcanearchives.netlify.app";

    console.log("🧾 Creating checkout session for:", email, "uid:", uid);

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