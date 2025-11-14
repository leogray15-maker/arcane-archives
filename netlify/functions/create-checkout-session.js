const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");

    if (!body.priceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing priceId" }),
      };
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: body.priceId,
          quantity: 1,
        },
      ],
      success_url: "https://arcanearchives.netlify.app/success.html?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://arcanearchives.netlify.app/cancel.html",
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ id: session.id }),
    };
  } catch (err) {
    console.error("Checkout session error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
