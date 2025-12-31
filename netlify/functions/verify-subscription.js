// netlify/functions/verify-subscription.js
// Checks if a Stripe subscription is still active

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event, context) => {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "application/json",
    };

    // Handle preflight
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
        const { subscriptionId } = JSON.parse(event.body || "{}");

        if (!subscriptionId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: "Missing subscriptionId" })
            };
        }

        console.log("🔍 Verifying subscription:", subscriptionId);

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        let status = "inactive";

        if (subscription?.status === "active" || subscription?.status === "trialing") {
            status = "active";
        } else if (subscription?.status === "past_due") {
            status = "past_due";
        } else if (subscription?.status === "canceled") {
            status = "cancelled";
        }

        console.log("📊 Subscription status:", status);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                status,
                subscription_status: subscription.status,
                current_period_end: subscription.current_period_end,
                cancel_at_period_end: subscription.cancel_at_period_end,
            })
        };
    } catch (err) {
        console.error("🔥 Subscription verify error:", err);

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: "Server error verifying subscription",
                message: err.message 
            })
        };
    }
};