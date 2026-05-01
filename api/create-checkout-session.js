const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: "Server misconfigured: STRIPE_SECRET_KEY is not set" });
  }

  try {
    const { priceId: bodyPriceId, uid, email } = req.body || {};

    const priceId = bodyPriceId || process.env.STRIPE_PRICE_ID || "price_1SkbkNCXghparoQFd6flbwip";
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : (process.env.URL || "https://arcanearchives.shop");

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
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

    return res.status(200).json({ id: session.id, url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return res.status(500).json({ error: error.message || "An unexpected error occurred" });
  }
};
