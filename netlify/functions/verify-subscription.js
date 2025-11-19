// netlify/functions/verify-subscription.js

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event, context) => {
    try {
        const { subscriptionId } = JSON.parse(event.body || "{}");

        if (!subscriptionId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing subscriptionId" })
            };
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        let status = "inactive";

        if (subscription?.status === "active" || subscription?.status === "trialing") {
            status = "active";
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                status,
                current_period_end: subscription.current_period_end
            })
        };
    } catch (err) {
        console.error("Subscription verify error:", err);

        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Server error verifying subscription" })
        };
    }
};
