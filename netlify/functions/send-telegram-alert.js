// netlify/functions/send-telegram-alert.js
// Enhanced to handle all trade notification types

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

    // Parse the request body
    const body = JSON.parse(event.body || '{}');
    const { type, payload } = body;

    // Format message based on type
    let message = '';
    
    switch(type) {
      case 'NEW_TRADE':
        message = formatNewTrade(payload);
        break;
      case 'TP1_HIT':
        message = formatTPHit(payload, 1);
        break;
      case 'TP2_HIT':
        message = formatTPHit(payload, 2);
        break;
      case 'TP3_HIT':
        message = formatTPHit(payload, 3);
        break;
      case 'LOSS_HIT':
        message = formatLoss(payload);
        break;
      case 'BE_HIT':
        message = formatBreakEven(payload);
        break;
      default:
        // Fallback for backward compatibility
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

// Message formatters
function formatNewTrade(payload) {
  const { pair, direction, entry, sl, tp1, tp2, tp3, notes } = payload;
  
  const emoji = direction === 'Buy' ? '🟢' : '🔴';
  
  let msg = `🔮 *NEW TRADE SIGNAL*\n\n`;
  msg += `${emoji} *${pair}* | ${direction.toUpperCase()}\n\n`;
  msg += `📍 Entry: \`${entry}\`\n`;
  msg += `🛑 Stop Loss: \`${sl}\`\n\n`;
  
  if (tp1) msg += `🎯 TP1: \`${tp1}\`\n`;
  if (tp2) msg += `🎯 TP2: \`${tp2}\`\n`;
  if (tp3) msg += `🎯 TP3: \`${tp3}\`\n`;
  
  if (notes) {
    msg += `\n📝 _${notes}_`;
  }
  
  msg += `\n\n⚡ *The Arcane Archives*`;
  
  return msg;
}

function formatTPHit(payload, tpNumber) {
  const { pair, direction } = payload;
  
  let msg = `✅ *TARGET HIT!*\n\n`;
  msg += `🎯 TP${tpNumber} reached on *${pair}*\n`;
  msg += `Direction: ${direction}\n\n`;
  msg += `💰 Well done to everyone who took this trade!\n\n`;
  msg += `⚡ *The Arcane Archives*`;
  
  return msg;
}

function formatLoss(payload) {
  const { pair, direction } = payload;
  
  let msg = `❌ *STOP LOSS HIT*\n\n`;
  msg += `🛑 ${pair} (${direction}) hit stop loss\n\n`;
  msg += `This is part of trading. Onto the next setup.\n\n`;
  msg += `⚡ *The Arcane Archives*`;
  
  return msg;
}

function formatBreakEven(payload) {
  const { pair, direction } = payload;
  
  let msg = `⚖️ *BREAK EVEN*\n\n`;
  msg += `${pair} (${direction}) closed at break even\n\n`;
  msg += `No gain, no loss. Onto the next.\n\n`;
  msg += `⚡ *The Arcane Archives*`;
  
  return msg;
}