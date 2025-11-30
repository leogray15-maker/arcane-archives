#!/bin/bash
# add_module_tracking.sh
# Automatically adds module tracking to all course HTML files

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if directory argument provided
if [ -z "$1" ]; then
    echo -e "${RED}Usage: ./add_module_tracking.sh <directory> [--dry-run]${NC}"
    echo ""
    echo "Example:"
    echo "  ./add_module_tracking.sh ./notion-export-clean/The\\ Arcane\\ Archives/"
    echo "  ./add_module_tracking.sh ./courses/ --dry-run"
    exit 1
fi

DIRECTORY="$1"
DRY_RUN=false

# Check for dry-run flag
if [ "$2" == "--dry-run" ] || [ "$2" == "-n" ]; then
    DRY_RUN=true
    echo -e "${YELLOW}🔍 DRY RUN MODE - No files will be modified${NC}\n"
fi

# Check if directory exists
if [ ! -d "$DIRECTORY" ]; then
    echo -e "${RED}❌ Directory not found: $DIRECTORY${NC}"
    exit 1
fi

echo -e "${BLUE}Directory: $DIRECTORY${NC}\n"

# Function to extract course ID from filename
get_course_id() {
    local filename="$1"
    local basename=$(basename "$filename" .html)
    
    # Convert to lowercase and replace spaces/special chars with hyphens
    course_id=$(echo "$basename" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')
    
    # Limit to 50 chars
    course_id=${course_id:0:50}
    
    echo "$course_id"
}

# Count total HTML files
total_files=$(find "$DIRECTORY" -name "*.html" -type f | wc -l)
echo -e "${BLUE}Found $total_files HTML files${NC}\n"

if [ $total_files -eq 0 ]; then
    echo -e "${RED}No HTML files found!${NC}"
    exit 1
fi

# Ask for confirmation if not dry run
if [ "$DRY_RUN" = false ]; then
    read -p "Process $total_files files? (yes/no): " confirm
    if [ "$confirm" != "yes" ] && [ "$confirm" != "y" ]; then
        echo "Cancelled."
        exit 0
    fi
    echo ""
fi

processed=0
skipped=0
errors=0

# Process each HTML file
while IFS= read -r file; do
    # Check if file already has module tracker
    if grep -q "initModuleTracker" "$file"; then
        echo -e "${YELLOW}⏭️  Skipped (already has tracker): $file${NC}"
        ((skipped++))
        continue
    fi
    
    # Check if file has </body> tag
    if ! grep -q "</body>" "$file"; then
        echo -e "${YELLOW}⏭️  Skipped (no </body> tag): $file${NC}"
        ((skipped++))
        continue
    fi
    
    # Get course ID
    course_id=$(get_course_id "$file")
    
    if [ "$DRY_RUN" = true ]; then
        echo -e "${BLUE}🔍 Would add tracker to: $file${NC}"
        echo -e "   Course ID: $course_id"
        ((processed++))
    else
        # Create the script to inject
        script_to_inject="
  <script type=\"module\">
    <!-- XP System Scripts -->
<script type="module" src="/course-module-tracker.js"></script>
<script type="module" src="/xp-module-listener.js"></script> from '../../course-module-tracker.js';
    initModuleTracker('$course_id');
  </script>
"
        
        # Create backup
        cp "$file" "$file.backup"
        
        # Insert script before </body>
        if sed -i.tmp "s|</body>|$script_to_inject</body>|" "$file"; then
            rm -f "$file.tmp"
            rm -f "$file.backup"
            echo -e "${GREEN}✅ Added tracker: $file${NC}"
            echo -e "   Course ID: $course_id"
            ((processed++))
        else
            # Restore from backup if failed
            mv "$file.backup" "$file" 2>/dev/null
            echo -e "${RED}❌ Error processing: $file${NC}"
            ((errors++))
        fi
    fi
    
done < <(find "$DIRECTORY" -name "*.html" -type f)

# Summary
echo ""
echo "===================================================================="
echo "SUMMARY:"
echo "  Total files: $total_files"
if [ "$DRY_RUN" = true ]; then
    echo "  Would process: $processed"
else
    echo "  Processed: $processed"
fi
echo "  Skipped: $skipped"
echo "  Errors: $errors"
echo "===================================================================="
echo ""

if [ "$DRY_RUN" = false ] && [ $processed -gt 0 ]; then
    echo -e "${GREEN}✅ Module tracking successfully added to $processed files!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Test one course to verify it works"
    echo "2. Deploy to your site"
    echo "3. Check Firestore for XP updates"
fi