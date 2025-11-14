// netlify/functions/create-checkout-session.js

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const priceIdEnv   = process.env.STRIPE_PRICE_ID;

// Guard: if secret key missing, fail clearly
if (!stripeSecret) {
  console.error("❌ STRIPE_SECRET_KEY is not set in environment");
}

const stripe = require("stripe")(stripeSecret || "");

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
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    if (!stripeSecret) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "Server misconfigured: STRIPE_SECRET_KEY is not set",
        }),
      };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    // allow optional override, but default to env
    const priceId = body.priceId || priceIdEnv || "price_1SRnIxCXghparoQFb0oQPUes";

    if (!priceId) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "Server misconfigured: STRIPE_PRICE_ID is not set",
        }),
      };
    }

    const baseUrl =
      process.env.URL ||
      process.env.DEPLOY_PRIME_URL ||
      process.env.DEPLOY_URL ||
      "https://arcanearchives.netlify.app";

    console.log("🧾 Creating checkout session with price:", priceId);

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
    });

    console.log("✅ Checkout session created:", session.id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ id: session.id }),
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
