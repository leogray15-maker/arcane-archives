#!/bin/bash

echo "📈 Deploying TradingView Chart..."
echo ""

# Add files
git add alerts.html alerts.js netlify.toml

# Commit
git commit -m "✨ Switch to TradingView chart - simpler and more reliable"

# Push
git push origin main

echo ""
echo "✅ Deployed!"
echo ""
echo "Changes:"
echo "  • Removed custom chart with AlphaVantage API"
echo "  • Added TradingView embedded widget"
echo "  • Users can change timeframes directly in chart"
echo "  • No more API rate limits!"
echo ""
echo "Wait 30 seconds, then refresh alerts page 🚀"