// netlify/functions/send-telegram-alert.js
// Ultra-private Telegram ping: no trade details, just "new idea posted"

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  try {
    // ✅ Read from ENV VARS (set in Netlify)
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
      return {
        statusCode: 500,
        body: "Missing Telegram configuration",
      };
    }

    const text =
      "🟣 *New trade idea posted*\n\n" +
      "A new signal has been added inside *The Arcane Archives*.\n" +
      "Log in to your dashboard to view the full breakdown.";

    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Telegram API error:", res.status, errorText);
      return {
        statusCode: 502,
        body: "Failed to send Telegram message",
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error("send-telegram-alert error:", err);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};
