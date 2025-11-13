const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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

  try {
    const { sessionId } = JSON.parse(event.body || "{}");

    if (!sessionId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Session ID is required" }),
      };
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        customer_email: session.customer_details?.email || null,
        customer: session.customer || null,
        subscription: session.subscription || null,
        payment_status: session.payment_status,
        status: session.status,
      }),
    };
  } catch (error) {
    console.error("Error verifying session:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || "Error verifying session",
      }),
    };
  }
};