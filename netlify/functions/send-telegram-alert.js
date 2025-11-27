// netlify/functions/send-telegram-alert.js
// Simple notifications with custom pips and notes

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: "Missing Telegram configuration" })
      };
    }

    const body = JSON.parse(event.body || '{}');
    const { type, payload } = body;

    let message = '';
    
    // Extract custom fields
    const pips = payload.customPips || '';
    const notes = payload.customNotes || '';
    
    switch(type) {
      case 'NEW_TRADE':
        message = "🟣 *New trade idea posted*\n\n" +
                  "A new trade idea has been added inside *The Arcane Archives*.\n" +
                  "Log in to your dashboard to view the full breakdown.";
        break;
        
      case 'TP1_HIT':
        message = "✅ *TP1 HIT*\n\n" +
                  `${payload.pair || 'Signal'} closed at first target.`;
        if (pips) message += `\n💰 ${pips}`;
        if (notes) message += `\n\n📝 ${notes}`;
        break;
        
      case 'TP2_HIT':
        message = "✅ *TP2 HIT*\n\n" +
                  `${payload.pair || 'Signal'} closed at second target.`;
        if (pips) message += `\n💰 ${pips}`;
        if (notes) message += `\n\n📝 ${notes}`;
        break;
        
      case 'TP3_HIT':
        message = "✅ *TP3 HIT*\n\n" +
                  `${payload.pair || 'Signal'} closed at third target.`;
        if (pips) message += `\n💰 ${pips}`;
        if (notes) message += `\n\n📝 ${notes}`;
        break;
        
      case 'LOSS_HIT':
        message = "❌ *STOP LOSS HIT*\n\n" +
                  `${payload.pair || 'Signal'} hit stop loss.`;
        if (pips) message += `\n📉 ${pips}`;
        if (notes) message += `\n\n${notes}`;
        else message += `\n\nOnto the next setup.`;
        break;
        
      case 'BE_HIT':
        message = "⚖️ *BREAK EVEN*\n\n" +
                  `${payload.pair || 'Signal'} closed at break even.`;
        if (notes) message += `\n\n${notes}`;
        else message += `\n\nNo gain, no loss.`;
        break;
        
      default:
        message = "🟣 *New trade idea posted*\n\n" +
                  "A new signal has been added inside *The Arcane Archives*.\n" +
                  "Log in to your dashboard to view the full breakdown.";
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
        disable_web_page_preview: true
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Telegram API error:", res.status, errorText);
      return { 
        statusCode: 502, 
        body: JSON.stringify({ error: "Failed to send Telegram message" })
      };
    }

    const result = await res.json();
    console.log("✅ Telegram message sent:", type);

    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        ok: true, 
        messageId: result.result?.message_id 
      })
    };
  } catch (err) {
    console.error("send-telegram-alert error:", err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Internal Server Error" })
    };
  }
};