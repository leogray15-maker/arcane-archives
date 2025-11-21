#!/bin/bash
# 🔮 THE ARCANE ARCHIVES - FIXED AUTO-DEPLOY SCRIPT
# Handles macOS pip3 and path issues

set -e  # Exit on error

echo "🔮 THE ARCANE ARCHIVES - AUTOMATIC FIX & DEPLOY"
echo "================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${BLUE}📂 Working directory: $(pwd)${NC}"
echo ""

# Step 1: Check Python
echo -e "${PURPLE}[1/5]${NC} Checking Python..."
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Python 3 found: $(python3 --version)${NC}"
echo ""

# Step 2: Install dependencies - TRY MULTIPLE METHODS
echo -e "${PURPLE}[2/5]${NC} Installing beautifulsoup4..."

# Try method 1: pip3 with --break-system-packages
if pip3 install beautifulsoup4 --break-system-packages &>/dev/null; then
    echo -e "${GREEN}✅ Installed with pip3${NC}"
elif pip3 install beautifulsoup4 --user &>/dev/null; then
    echo -e "${GREEN}✅ Installed with pip3 --user${NC}"
elif python3 -m pip install beautifulsoup4 --user &>/dev/null; then
    echo -e "${GREEN}✅ Installed with python3 -m pip${NC}"
else
    echo -e "${YELLOW}⚠️  beautifulsoup4 may already be installed or installation failed${NC}"
fi
echo ""

# Step 3: Check if we have a Notion export
echo -e "${PURPLE}[3/5]${NC} Checking for Notion export..."

NOTION_DIR=""
if [ -d "notion-export" ]; then
    NOTION_DIR="notion-export"
    echo -e "${GREEN}✅ Found: $NOTION_DIR${NC}"
elif [ -d "Notion-Export" ]; then
    NOTION_DIR="Notion-Export"
    echo -e "${GREEN}✅ Found: $NOTION_DIR${NC}"
else
    echo -e "${YELLOW}⚠️  No notion-export folder found in current directory${NC}"
    echo -e "${YELLOW}   You'll need to process courses manually later${NC}"
fi
echo ""

# Step 4: Process courses if we have the export
if [ ! -z "$NOTION_DIR" ] && [ -f "advanced-course-processor.py" ]; then
    echo -e "${PURPLE}[4/5]${NC} Processing courses from $NOTION_DIR..."
    
    if python3 advanced-course-processor.py "$NOTION_DIR" "./courses"; then
        echo -e "${GREEN}✅ Courses processed successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  Course processing had issues, check output above${NC}"
    fi
else
    echo -e "${PURPLE}[4/5]${NC} Skipping course processing"
    
    if [ -z "$NOTION_DIR" ]; then
        echo -e "${YELLOW}   Reason: No notion-export folder found${NC}"
    fi
    
    if [ ! -f "advanced-course-processor.py" ]; then
        echo -e "${YELLOW}   Reason: advanced-course-processor.py not found${NC}"
    fi
fi
echo ""

# Step 5: Run emergency fixes on current directory only
echo -e "${PURPLE}[5/5]${NC} Applying emergency fixes..."

if [ -f "emergency-fix.py" ]; then
    # Only fix files in current directory, not subdirectories
    if python3 emergency-fix.py . 2>/dev/null; then
        echo -e "${GREEN}✅ Emergency fixes applied${NC}"
    else
        echo -e "${YELLOW}⚠️  Some fixes may not have applied${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  emergency-fix.py not found, skipping${NC}"
fi
echo ""

# Summary
echo "================================================"
echo -e "${GREEN}🎉 SETUP COMPLETE!${NC}"
echo "================================================"
echo ""

# Check critical files
echo "Checking critical files..."
MISSING=()

if [ ! -f "login.html" ]; then
    MISSING+=("login.html")
fi

if [ ! -f "archives.html" ]; then
    MISSING+=("archives.html")
fi

if [ ! -f "auth-guard.js" ]; then
    MISSING+=("auth-guard.js")
fi

if [ ${#MISSING[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ All critical files present${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review your changes"
    echo "2. Deploy: git add . && git commit -m 'Launch ready' && git push"
    echo ""
    echo -e "${PURPLE}🚀 Ready to deploy!${NC}"
else
    echo -e "${RED}❌ Missing critical files:${NC}"
    for file in "${MISSING[@]}"; do
        echo "   - $file"
    done
    echo ""
    echo "Download missing files from the chat and place them here"
fi

echo ""