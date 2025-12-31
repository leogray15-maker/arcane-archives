// netlify/functions/verify.js
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

  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch (e) {}

  const sessionId = body.sessionId || "test-session";

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      id: sessionId,
      status: "complete",
      payment_status: "paid",
      customer: null,
      subscription: null,
      debug: "minimal verify.js reached successfully",
    }),
  };
};
