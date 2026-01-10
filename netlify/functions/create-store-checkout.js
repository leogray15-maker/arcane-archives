// netlify/functions/create-store-checkout.js
// Handles one-time product purchases from the Arcane Store (SINGLE item)

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
    const { priceId, userId, userEmail, productName, productId, color } = body;

    if (!priceId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing priceId" }),
      };
    }

    const baseUrl =
      process.env.URL ||
      process.env.DEPLOY_PRIME_URL ||
      process.env.DEPLOY_URL ||
      "https://thearcanearchives.netlify.app";

    console.log("🛍️ Creating store checkout for:", userEmail);
    console.log("📦 Product:", productName);
    console.log("💰 Price ID:", priceId);

    // Create Stripe Checkout Session for ONE-TIME payment
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      billing_address_collection: "required",
      shipping_address_collection: {
        allowed_countries: [
          "US","CA","GB","AU","NZ","IE",
          "FR","DE","IT","ES","NL","BE",
          "CH","AT","PT","DK","SE","NO","FI"
        ],
      },
      success_url: `${baseUrl}/store-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/arcane-store.html`,
      customer_email: userEmail || undefined,
      metadata: {
        source: "arcane_store",
        productName: productName || "",
        productId: productId || "",
        priceId: priceId || "",
        color: color || "",
        firebaseUid: userId || "",
        email: userEmail || "",
      },
    });

    console.log("✅ Store checkout session created:", session.id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ sessionId: session.id, url: session.url }),
    };
  } catch (error) {
    console.error("🔥 Store checkout error:", error);

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
