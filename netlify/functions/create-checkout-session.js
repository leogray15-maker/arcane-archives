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
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    // Check if Stripe is configured
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
    
    // Price ID - allow override or use env var or default
    const priceId = body.priceId || 
                    process.env.STRIPE_PRICE_ID || 
                    "price_1SRnIxCXghparoQFb0oQPUes";

    // Determine base URL
    const baseUrl = process.env.URL ||
                    process.env.DEPLOY_PRIME_URL ||
                    process.env.DEPLOY_URL ||
                    "https://arcanearchives.netlify.app";

    console.log("🧾 Creating checkout session");
    console.log("   Price ID:", priceId);
    console.log("   Base URL:", baseUrl);

    // Create Stripe checkout session
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
      
      // Additional metadata for better tracking
      metadata: {
        source: "arcane_archives",
      },
    });

    console.log("✅ Checkout session created:", session.id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        id: session.id,
        url: session.url 
      }),
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