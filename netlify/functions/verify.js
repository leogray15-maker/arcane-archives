// netlify/functions/verify.js

const stripeSecret = process.env.STRIPE_SECRET_KEY;

const stripe = require("stripe")(stripeSecret || "");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
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
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  if (!stripeSecret) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Server misconfigured: STRIPE_SECRET_KEY is not set",
      }),
    };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { sessionId } = body;

    if (!sessionId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "sessionId is required" }),
      };
    }

    console.log("🔍 Verifying Stripe session:", sessionId);

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["customer", "subscription"],
    });

    const customer = session.customer || session.customer_details || null;
    const subscription = session.subscription || null;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        id: session.id,
        payment_status: session.payment_status,
        status: session.status,
        customer_email:
          session.customer_details?.email ||
          customer?.email ||
          null,
        customer: customer,
        subscription: subscription,
      }),
    };
  } catch (error) {
    console.error("❌ Error verifying session:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || "Error verifying session",
      }),
    };
  }
};
