// netlify/functions/create-store-cart-checkout.js
// Handles MULTI-ITEM Arcane Store basket checkout

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "");

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
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }

    const body = JSON.parse(event.body || "{}");
    const { items, userId, userEmail } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Basket is empty" }),
      };
    }

    const baseUrl =
      process.env.URL ||
      process.env.DEPLOY_PRIME_URL ||
      process.env.DEPLOY_URL ||
      "https://thearcanearchives.netlify.app";

    // Build Stripe line items
    const line_items = items.map((item) => {
      if (!item.priceId) {
        throw new Error("Missing priceId for item");
      }

      return {
        price: item.priceId,
        quantity: Math.max(1, item.qty || 1),
      };
    });

    // Optional metadata (visible in Stripe dashboard)
    const metadata = {
      source: "arcane_store_cart",
      firebaseUid: userId || "",
      email: userEmail || "",
      items: JSON.stringify(
        items.map((i) => ({
          productId: i.productId || "",
          name: i.name || "",
          qty: i.qty || 1,
          color: i.color || null,
        }))
      ),
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items,
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
      metadata,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        sessionId: session.id,
        url: session.url,
      }),
    };

  } catch (error) {
    console.error("🔥 Cart checkout error:", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || "Failed to create cart checkout",
      }),
    };
  }
};
