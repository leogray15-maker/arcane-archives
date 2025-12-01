#!/bin/bash

echo "🔥 NUCLEAR OPTION - TradingView Chart Fix"
echo "==========================================="
echo ""
echo "This will:"
echo "  1. Delete ALL _headers files everywhere"
echo "  2. Verify netlify.toml has correct CSP"
echo "  3. Force push and clear cache"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Step 1: Nuclear delete of _headers
echo "🧹 Deleting ALL _headers files..."
find . -name "_headers" -type f -delete
find . -name ".headers" -type f -delete
echo "   ✅ Deleted"

# Step 2: Verify netlify.toml
echo ""
echo "🔍 Checking netlify.toml..."
if grep -q "frame-src 'self' https://www.tradingview.com" netlify.toml; then
    echo "   ✅ CSP is correct"
else
    echo "   ❌ CSP is WRONG - stopping"
    echo ""
    echo "Your netlify.toml /alerts.html section MUST have:"
    echo 'frame-src '"'"'self'"'"' https://www.tradingview.com https://*.tradingview.com;'
    exit 1
fi

# Step 3: Force commit everything
echo ""
echo "💾 Committing..."
git add -A
git commit -m "NUCLEAR: Force TradingView CSP fix - remove all _headers"

# Step 4: Push
echo ""
echo "🚀 Pushing..."
git push origin main

echo ""
echo "✅ PUSHED!"
echo ""
echo "=========================================="
echo "NOW DO THIS IN NETLIFY DASHBOARD:"
echo "=========================================="
echo ""
echo "1. Go to: https://app.netlify.com"
echo "2. Select your site"
echo "3. Click 'Deploys' tab"
echo "4. Click 'Trigger deploy' button"
echo "5. Select 'Clear cache and deploy site'"
echo ""
echo "⏱️  Wait 3-4 minutes for deploy to finish"
echo ""
echo "Then test:"
echo "  • Go to alerts page"
echo "  • Hard refresh: Cmd+Shift+R"
echo "  • Chart WILL load"
echo ""
echo "If it STILL doesn't work, the problem is in your Netlify"
echo "project settings, not the code."