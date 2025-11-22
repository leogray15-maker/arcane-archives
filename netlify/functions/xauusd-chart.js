// netlify/functions/xauusd-chart.js
const fetch = require("node-fetch");

/**
 * Serverless proxy for AlphaVantage XAUUSD data.
 * Supports multiple timeframes dynamically.
 */
exports.handler = async function (event, context) {
  try {
    const apiKey = process.env.ALPHAVANTAGE_KEY;
    if (!apiKey) {
      console.error("❌ Missing ALPHAVANTAGE_KEY environment variable");
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing API key configuration" }),
      };
    }

    // Get interval from query params (default to 1min)
    const requestedInterval = event.queryStringParameters?.interval || "1min";
    console.log(`📊 Requested interval: ${requestedInterval}`);

    // Map frontend intervals to AlphaVantage supported intervals
    // AlphaVantage FX_INTRADAY supports: 1min, 5min, 15min, 30min, 60min
    // For others, we'll use the closest available
    const intervalMap = {
      "1min": "1min",
      "3min": "5min",    // Use 5min as closest
      "5min": "5min",
      "15min": "15min",
      "30min": "30min",
      "60min": "60min",
      "240min": "60min", // Use 60min as closest for 4H
      "daily": "daily"   // Will use different API endpoint
    };

    const avInterval = intervalMap[requestedInterval] || "5min";
    console.log(`🔄 Using AlphaVantage interval: ${avInterval}`);

    let url, seriesKey;

    // Use different API function for daily data
    if (requestedInterval === "daily") {
      url = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=XAU&to_symbol=USD&outputsize=full&apikey=${apiKey}`;
      seriesKey = "Time Series FX (Daily)";
    } else {
      url = `https://www.alphavantage.co/query?function=FX_INTRADAY&from_symbol=XAU&to_symbol=USD&interval=${avInterval}&outputsize=full&apikey=${apiKey}`;
      seriesKey = `Time Series FX (${avInterval})`;
    }

    console.log(`🌐 Fetching from AlphaVantage...`);
    const res = await fetch(url);
    
    if (!res.ok) {
      throw new Error(`AlphaVantage HTTP ${res.status}`);
    }

    const data = await res.json();
    
    // Check for API errors
    if (data["Error Message"]) {
      console.error("❌ AlphaVantage error:", data["Error Message"]);
      throw new Error(data["Error Message"]);
    }

    if (data["Note"]) {
      console.warn("⚠️ AlphaVantage rate limit:", data["Note"]);
      throw new Error("API rate limit reached. Please try again in a minute.");
    }

    const series = data[seriesKey] || {};
    
    if (Object.keys(series).length === 0) {
      console.error("❌ No data in response:", data);
      throw new Error("No market data available");
    }

    // Convert to array sorted by time ascending
    const points = Object.entries(series)
      .map(([time, candle]) => ({
        time,
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
        "Cache-Control": "public, max-age=60" // Cache for 1 minute
      },
      body: JSON.stringify({ 
        candles: points,
        interval: requestedInterval,
        source: "AlphaVantage"
      }),
    };
  } catch (err) {
    console.error("❌ Function error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        error: err.message,
        details: "Check Netlify function logs for more info"
      }),
    };
  }
};