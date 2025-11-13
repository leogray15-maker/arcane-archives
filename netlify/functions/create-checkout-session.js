// netlify/functions/create-checkout-session.js
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // Only POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error("Missing STRIPE_SECRET_KEY env var");
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error:
            "Server configuration error: STRIPE_SECRET_KEY is not set in Netlify.",
        }),
      };
    }

    // Parse body
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch (err) {
      console.error("JSON parse error:", err);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid JSON in request body" }),
      };
    }

    const { uid } = body; // Firebase UID from frontend

    if (!uid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "uid (Firebase user ID) is required" }),
      };
    }

    // Your live Stripe PRICE ID (not product id)
    const priceId = "price_1SRnIxCXghparoQFb0oQPUes";

    // Base URL for redirects
    const baseUrl =
      process.env.URL ||
      process.env.DEPLOY_PRIME_URL ||
      process.env.DEPLOY_URL ||
      "https://arcanearchives.netlify.app";

    console.log("Creating checkout session", { priceId, uid, baseUrl });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      // link to Firebase user
      client_reference_id: uid,
      metadata: { uid },

      allow_promotion_codes: true,
      billing_address_collection: "required",

      success_url: `${baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/#pricing`,
    });

    console.log("Checkout session created:", session.id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ id: session.id }),
    };
  } catch (error) {
    console.error("Stripe error:", error);
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
