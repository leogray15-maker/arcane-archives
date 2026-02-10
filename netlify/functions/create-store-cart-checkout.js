// netlify/functions/create-store-cart-checkout.js
// Handles MULTI-ITEM Arcane Store basket checkout (Stripe Checkout)

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
    const { items, userId, userEmail } = body;
    const orderId = `ord_${userId || 'guest'}_${Date.now()}`;

    if (!Array.isArray(items) || items.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Basket is empty" }),
      };
    }

    // Build Stripe line items
    const line_items = items.map((it) => {
      if (!it.priceId) throw new Error("Missing priceId for an item");
      return {
        price: it.priceId,
        quantity: Math.max(1, Number(it.qty || 1)),
      };
    });

    const baseUrl =
      process.env.URL ||
      process.env.DEPLOY_PRIME_URL ||
      process.env.DEPLOY_URL ||
      "https://arcanearchives.shop";

    // Stripe metadata has size limits — keep it compact.
    // If you later want unlimited cart size, switch to a server-side cartId.
    const compactItems = items.slice(0, 10).map((it) => ({
      productId: it.productId || "",
      name: it.name || "",
      priceId: it.priceId || "",
      qty: Math.max(1, Number(it.qty || 1)),
      color: it.color || null,
    }));

    console.log("🧺 Creating CART checkout for:", userEmail);
    console.log("🧾 Items:", compactItems.length);

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
      success_url: `${baseUrl}/store-success.html?order_id=${encodeURIComponent(orderId)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/arcane-store.html`,
      customer_email: userEmail || undefined,
      metadata: {
        source: "arcane_store_cart",
        orderId: orderId,
        firebaseUid: userId || "",
        email: userEmail || "",
        items: JSON.stringify(compactItems),
      },
    });

    console.log("✅ Cart checkout session created:", session.id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ sessionId: session.id, url: session.url }),
    };
  } catch (error) {
    console.error("🔥 Cart checkout error:", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || "An unexpected error occurred",
      }),
    };
  }
};
