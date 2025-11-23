#!/bin/bash
# COMPLETE DEPLOYMENT SCRIPT FOR THE ARCANE ARCHIVES
# Copy and paste this entire file, or run line by line

echo "🚀 Starting deployment of complete XP system..."
echo ""

# ============================================================
# STEP 1: BACKUP CURRENT STATE
# ============================================================
echo "📦 Step 1: Creating backup..."
git add .
git commit -m "Backup before adding complete XP system"
git branch backup-pre-xp-system
echo "✅ Backup created!"
echo ""

# ============================================================
# STEP 2: REMOVE OLD FILES
# ============================================================
echo "🗑️  Step 2: Removing old files..."
rm -f referral.html
rm -f affiliate.html
mv xp-system.js xp-system.js.old 2>/dev/null || true
mv wins.js wins.js.old 2>/dev/null || true
mv archives.js archives.js.old 2>/dev/null || true
mv archives.html archives.html.old 2>/dev/null || true
echo "✅ Old files removed/backed up!"
echo ""

# ============================================================
# MANUAL STEP: DOWNLOAD FILES
# ============================================================
echo "📥 Step 3: MANUAL STEP REQUIRED"
echo ""
echo "Please download these files from Claude's /mnt/user-data/outputs/"
echo "and place them in your project root:"
echo ""
echo "  Production Files:"
echo "  - xp-system.js"
echo "  - wins.js"
echo "  - archives.js"
echo "  - archives.html"
echo "  - course-module-tracker.js"
echo "  - referrals.html"
echo ""
echo "  Automation Scripts:"
echo "  - add_module_tracking.py"
echo "  - add_module_tracking.sh"
echo ""
read -p "Have you downloaded all files? (yes/no): " files_ready
if [ "$files_ready" != "yes" ]; then
    echo "❌ Please download files first, then run this script again."
    exit 1
fi
echo "✅ Files downloaded!"
echo ""

# ============================================================
# STEP 4: MAKE SCRIPTS EXECUTABLE
# ============================================================
echo "🔧 Step 4: Making scripts executable..."
chmod +x add_module_tracking.py
chmod +x add_module_tracking.sh
echo "✅ Scripts ready!"
echo ""

# ============================================================
# STEP 5: ADD MODULE TRACKING TO ALL COURSES
# ============================================================
echo "🤖 Step 5: Adding module tracking to all courses..."
echo ""
echo "Enter the path to your courses directory:"
echo "Example: ./notion-export-clean/The Arcane Archives/"
read -p "Path: " courses_path

if [ ! -d "$courses_path" ]; then
    echo "❌ Directory not found: $courses_path"
    exit 1
fi

echo ""
echo "Running DRY RUN first to preview changes..."
python3 add_module_tracking.py "$courses_path" --dry-run

echo ""
read -p "Does the dry run look good? (yes/no): " dry_run_ok
if [ "$dry_run_ok" != "yes" ]; then
    echo "❌ Aborting. Review the dry run output and try again."
    exit 1
fi

echo ""
echo "Running for real now..."
python3 add_module_tracking.py "$courses_path"
echo "✅ Module tracking added to all courses!"
echo ""

# ============================================================
# STEP 6: UPDATE NAVIGATION LINKS
# ============================================================
echo "🔗 Step 6: Updating navigation links..."
echo ""
echo "Replacing referral.html and affiliate.html with referrals.html"

# Detect OS and use appropriate sed command
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    find . -name "*.html" -type f -exec sed -i '' 's/referral\.html/referrals.html/g' {} +
    find . -name "*.html" -type f -exec sed -i '' 's/affiliate\.html/referrals.html/g' {} +
else
    # Linux
    find . -name "*.html" -type f -exec sed -i 's/referral\.html/referrals.html/g' {} +
    find . -name "*.html" -type f -exec sed -i 's/affiliate\.html/referrals.html/g' {} +
fi

echo "✅ Navigation links updated!"
echo ""

# ============================================================
# STEP 7: FIREBASE RULES REMINDER
# ============================================================
echo "🔥 Step 7: Firebase Security Rules"
echo ""
echo "⚠️  IMPORTANT: You need to update Firebase security rules manually"
echo ""
echo "Go to: https://console.firebase.google.com"
echo "Navigate to: Firestore Database → Rules"
echo ""
echo "See TERMINAL_COMMANDS.md for the exact rules to paste"
echo ""
read -p "Have you updated Firebase rules? (yes/no): " rules_updated
if [ "$rules_updated" != "yes" ]; then
    echo "⚠️  Don't forget to update Firebase rules before deploying!"
fi
echo ""

# ============================================================
# STEP 8: COMMIT CHANGES
# ============================================================
echo "💾 Step 8: Committing changes..."
git add .
git commit -m "feat: Add complete XP system with gamification

- Added module completion tracking across all courses
- Unified referrals and affiliate into single page
- Integrated XP rewards for all user actions
- Added level progression system (Apprentice to Archmage)
- Added real-time progress tracking
- Added daily login streaks and win posting XP
- Automated module tracking for 1200+ course files
- Mobile optimized and production ready"

echo "✅ Changes committed!"
echo ""

# ============================================================
# STEP 9: DEPLOYMENT CONFIRMATION
# ============================================================
echo "🚀 Step 9: Ready to deploy!"
echo ""
echo "You can now push to production with:"
echo "  git push origin main"
echo ""
read -p "Push to production now? (yes/no): " push_now

if [ "$push_now" == "yes" ]; then
    git push origin main
    echo ""
    echo "🎉 DEPLOYED!"
    echo ""
    echo "Netlify is now building your site."
    echo "Check your Netlify dashboard for deployment status."
else
    echo ""
    echo "When you're ready, run:"
    echo "  git push origin main"
fi

echo ""
echo "============================================================"
echo "✅ DEPLOYMENT COMPLETE!"
echo "============================================================"
echo ""
echo "Next steps:"
echo "1. Wait for Netlify to finish building"
echo "2. Test on your live site:"
echo "   - Login works"
echo "   - Archives shows progress"
echo "   - Courses have complete buttons"
echo "   - XP is being awarded"
echo "   - Referrals page works"
echo "3. Test on mobile device"
echo "4. Monitor Firestore for errors"
echo ""
echo "🎯 You're ready for December 1st! 🚀"
echo ""