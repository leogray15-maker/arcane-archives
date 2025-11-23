// netlify/functions/verify.js
// Verifies a Stripe Checkout session from success.html

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
      console.error("❌ STRIPE_SECRET_KEY not set");
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Stripe not configured" }),
      };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const { sessionId } = body;

    if (!sessionId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing sessionId" }),
      };
    }

    console.log("🔍 Verifying Stripe session:", sessionId);

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    console.log("✅ Session retrieved:", session.id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        id: session.id,
        status: session.status,
        payment_status: session.payment_status,
        customer: session.customer,
        subscription: session.subscription?.id || session.subscription || null,
        customer_email:
          session.customer_details?.email || session.customer_email || null,
        metadata: session.metadata || {},
      }),
    };
  } catch (err) {
    console.error("🔥 Error verifying session:", err);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Stripe verify failed",
        message: err.message,
      }),
    };
  }
};
