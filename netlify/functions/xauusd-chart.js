// netlify/functions/xauusd-chart.js

/**
 * Serverless proxy for AlphaVantage XAUUSD data.
 * Supports multiple timeframes dynamically.
 *
 * IMPORTANT:
 * - Requires ALPHAVANTAGE_KEY in Netlify environment variables
 */

exports.handler = async function (event, context) {
  try {
    const apiKey = process.env.ALPHAVANTAGE_KEY;
    if (!apiKey) {
      console.error("❌ Missing ALPHAVANTAGE_KEY environment variable");
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Missing API key configuration" }),
      };
    }

    // Get interval from query params (default to 15min)
    const requestedInterval = event.queryStringParameters?.interval || "15min";
    console.log(`📊 Requested interval: ${requestedInterval}`);

    const intervalMap = {
      "1min": "1min",
      "3min": "5min", // closest
      "5min": "5min",
      "15min": "15min",
      "30min": "30min",
      "60min": "60min",
      "240min": "60min", // closest to 4H
      "daily": "daily",
    };

    const avInterval = intervalMap[requestedInterval] || "15min";
    console.log(`🔄 Using AlphaVantage interval: ${avInterval}`);

    let url;
    let seriesKey;

    if (requestedInterval === "daily") {
      url = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=XAU&to_symbol=USD&outputsize=full&apikey=${apiKey}`;
      seriesKey = "Time Series FX (Daily)";
    } else {
      url = `https://www.alphavantage.co/query?function=FX_INTRADAY&from_symbol=XAU&to_symbol=USD&interval=${avInterval}&outputsize=full&apikey=${apiKey}`;
      seriesKey = `Time Series FX (${avInterval})`;
    }

    console.log("🌐 Fetching from AlphaVantage:", url);

    // Use native fetch (Node 18+ on Netlify supports this)
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`AlphaVantage HTTP ${res.status}`);
    }

    const data = await res.json();

    if (data["Error Message"]) {
      console.error("❌ AlphaVantage error:", data["Error Message"]);
      throw new Error(data["Error Message"]);
    }

    if (data["Note"]) {
      console.warn("⚠️ AlphaVantage rate limit:", data["Note"]);
      throw new Error(
        "API rate limit reached. Please wait a minute and refresh the page."
      );
    }

    const series = data[seriesKey] || {};

    if (Object.keys(series).length === 0) {
      console.error("❌ No data in response:", data);
      throw new Error("No market data available");
    }

    // Convert to array sorted by time ascending
    const points = Object.entries(series)
      .map(([time, candle]) => ({
        time, // "YYYY-MM-DD HH:mm:ss"
        open: parseFloat(candle["1. open"]),
        high: parseFloat(candle["2. high"]),
        low: parseFloat(candle["3. low"]),
        close: parseFloat(candle["4. close"]),
      }))
      .sort((a, b) => new Date(a.time) - new Date(b.time));

    console.log(`✅ Returning ${points.length} candles`);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        candles: points,
        interval: requestedInterval,
        source: "AlphaVantage",
      }),
    };
  } catch (err) {
    console.error("❌ Function error:", err);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: err.message,
        details: "Check Netlify function logs for more info",
      }),
    };
  }
};
