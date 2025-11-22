#!/bin/bash

echo "🔧 Fixing Chart 404 Error..."
echo ""

# Check if netlify directory exists
if [ ! -d "netlify/functions" ]; then
    echo "📁 Creating netlify/functions directory..."
    mkdir -p netlify/functions
fi

# Copy the fixed function
echo "📝 Deploying fixed xauusd-chart.js function..."

# Git commands
git add netlify/functions/xauusd-chart.js netlify.toml
git commit -m "🔧 Fix: Update xauusd-chart function to handle all intervals"
git push origin main

echo ""
echo "✅ Deployed! Wait 30 seconds for Netlify to build."
echo ""
echo "Next steps:"
echo "1. Go to Netlify dashboard → Functions"
echo "2. Verify ALPHAVANTAGE_KEY is set in Environment Variables"
echo "3. Check function logs if still not working"
echo "4. Hard refresh alerts page (Cmd+Shift+R)"