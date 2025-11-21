#!/bin/bash
# 🔮 The Arcane Archives - Complete Deployment Script
# This script processes all Notion HTML files and prepares them for deployment

echo "🔮 THE ARCANE ARCHIVES - AUTOMATIC COURSE PROCESSOR"
echo "===================================================="
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python first."
    exit 1
fi

# Check if beautifulsoup4 is installed
echo "📦 Checking dependencies..."
python3 -c "import bs4" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "📦 Installing beautifulsoup4..."
    pip3 install beautifulsoup4 --break-system-packages
else
    echo "✅ beautifulsoup4 is installed"
fi

echo ""
echo "📁 Setup Instructions:"
echo "====================="
echo ""
echo "Your folder structure should be:"
echo ""
echo "  your-project-folder/"
echo "  ├── process-notion-exports.py (the processor script)"
echo "  ├── deploy-all-courses.sh (this script)"
echo "  ├── notion-export/ (YOUR EXTRACTED NOTION ZIP)"
echo "  │   ├── The Arcane Archives/"
echo "  │   │   ├── Mind HiJacking 267..."
echo "  │   │   ├── Course 1/"
echo "  │   │   ├── Course 2/"
echo "  │   │   └── etc..."
echo "  │   └── The_Arcane_Archives_231...html"
echo "  └── (other files)"
echo ""
echo "After processing, you'll get:"
echo ""
echo "  processed-courses/ (READY TO UPLOAD)"
echo "  ├── Mind-HiJacking.html"
echo "  ├── Mind-HiJacking/"
echo "  ├── Course-Name.html"
echo "  ├── Course-Name/"
echo "  └── etc..."
echo ""
echo ""

# Ask user for input directory
read -p "📂 Enter the path to your Notion export folder (default: ./notion-export): " input_dir
input_dir=${input_dir:-./notion-export}

if [ ! -d "$input_dir" ]; then
    echo "❌ Directory not found: $input_dir"
    echo ""
    echo "Please:"
    echo "1. Extract your Notion ZIP file"
    echo "2. Make sure the folder path is correct"
    echo "3. Run this script again"
    exit 1
fi

# Output directory
output_dir="./processed-courses"

echo ""
echo "🔮 Processing Configuration:"
echo "=========================="
echo "📂 Input:  $input_dir"
echo "📂 Output: $output_dir"
echo ""
read -p "Press ENTER to start processing..."

# Run the processor
echo ""
echo "🔮 Processing all Notion files..."
python3 process-notion-exports.py "$input_dir" "$output_dir"

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Processing failed. Check the error messages above."
    exit 1
fi

echo ""
echo "✨ Processing complete!"
echo ""
echo "📂 Your processed courses are in: $output_dir"
echo ""
echo "🚀 NEXT STEPS:"
echo "============="
echo ""
echo "1. Copy processed-courses/* to your website's courses/ folder"
echo ""
echo "2. Update your archives.html file with course data"
echo ""
echo "3. Deploy to your site:"
echo "   git add ."
echo "   git commit -m 'Added processed courses'"
echo "   git push"
echo ""
echo "4. Test on your live site!"
echo ""
echo "✅ Ready for December 1st launch! 🎉"