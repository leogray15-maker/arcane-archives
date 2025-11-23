#!/usr/bin/env python3
"""
Automated Course Module Tracker Injector
Adds the module completion tracking script to all course HTML files

Usage:
    python3 add_module_tracking.py /path/to/notion-export-clean/The\ Arcane\ Archives/
"""

import os
import sys
import re
from pathlib import Path

# Course ID mapping from archives.html data-course-id attributes
COURSE_ID_MAP = {
    # TRADING
    "XAUUSD Price Action Mastery": "xauusd-price-action-mastery",
    "FULL TRADING COURSE": "full-trading-course",
    
    # MINDSET / LIFESTYLE
    "The High Performance System": "the-high-performance-system",
    "TRANSCEND": "transcend",
    "Disciplined Man System": "disciplined-man-system",
    "The Secrets Of The Rich": "the-secrets-of-the-rich",
    "dark psych": "dark-psych",
    
    # BUSINESS / COPYWRITING
    "Copywriting Accelerator": "copywriting-accelerator",
    "Copywriting Ebook": "copywriting-ebook",
    "COPYWRITING MASTERY": "copywriting-mastery",
    "30 Day Build A Profitable Business": "30-day-build-a-profitable-business",
    "Make A Product That Prints": "make-a-product-that-prints",
    "The Inbound Method": "the-inbound-method",
    "THE SALES MASTERY PROTOCOL": "the-sales-mastery-protocol-14447",
    "ADVANCED CONTENT PLAYBOOK": "advanced-content-playbook-200",
    "PERSONAL BRAND MASTERY": "personal-brand-mastery-300",
    "Self Learning AI": "self-learning-ai-behaviour-emotion-vault",
    "Diving Into The Writing Psychology": "diving-into-the-writing-psychology",
    
    # HEALTH
    "Terminate Playlist": "terminate-playlist-30",
    "BULKING PROTOCOL": "bulking-protocol",
    "Health Ascendance": "health-ascendance-300-value",
    "BIOHACKING": "biohacking",
    
    # INVESTING
    "Full Investing Guide": "full-investing-guide",
    
    # EXTRA
    "Daily Quests": "daily-quests",
    "+ COURSES": "courses",
    "FULL AI GIRL COURSE": "full-ai-girl-course",
}

# Script template to inject
SCRIPT_TEMPLATE = """
  <script type="module">
    import {{ initModuleTracker }} from '../../course-module-tracker.js';
    initModuleTracker('{course_id}');
  </script>
"""

def find_course_id(file_path, file_content):
    """Try to determine the course ID from the file name or content"""
    
    # Try to extract from file name
    file_name = Path(file_path).stem
    
    # Check exact matches first
    for course_name, course_id in COURSE_ID_MAP.items():
        if course_name.lower() in file_name.lower():
            return course_id
        
        # Also check in page title
        title_match = re.search(r'<title>(.*?)</title>', file_content, re.IGNORECASE)
        if title_match and course_name.lower() in title_match.group(1).lower():
            return course_id
    
    # Try to extract from the page-title class
    page_title_match = re.search(r'<h1[^>]*class="[^"]*page-title[^"]*"[^>]*>(.*?)</h1>', 
                                   file_content, re.IGNORECASE | re.DOTALL)
    if page_title_match:
        title_text = re.sub(r'<[^>]+>', '', page_title_match.group(1)).strip()
        for course_name, course_id in COURSE_ID_MAP.items():
            if course_name.lower() in title_text.lower():
                return course_id
    
    # Fallback: create ID from filename
    # Remove special chars and convert to kebab-case
    clean_name = re.sub(r'[^a-zA-Z0-9\s]', '', file_name)
    clean_name = re.sub(r'\s+', '-', clean_name.strip())
    return clean_name.lower()[:50]  # Limit length

def has_module_tracker(content):
    """Check if the file already has the module tracker script"""
    return 'initModuleTracker' in content

def add_module_tracker(file_path, dry_run=False):
    """Add the module tracker script to a course HTML file"""
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"❌ Error reading {file_path}: {e}")
        return False
    
    # Skip if already has tracker
    if has_module_tracker(content):
        print(f"⏭️  Skipped (already has tracker): {file_path}")
        return False
    
    # Check if it's actually an HTML file with a body tag
    if '</body>' not in content:
        print(f"⏭️  Skipped (no </body> tag): {file_path}")
        return False
    
    # Find the course ID
    course_id = find_course_id(file_path, content)
    
    # Create the script with the course ID
    script = SCRIPT_TEMPLATE.format(course_id=course_id)
    
    # Insert before closing </body> tag
    updated_content = content.replace('</body>', script + '</body>')
    
    if dry_run:
        print(f"🔍 Would add tracker to: {file_path}")
        print(f"   Course ID: {course_id}")
        return True
    
    # Write the updated content
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(updated_content)
        print(f"✅ Added tracker: {file_path}")
        print(f"   Course ID: {course_id}")
        return True
    except Exception as e:
        print(f"❌ Error writing {file_path}: {e}")
        return False

def process_directory(directory, dry_run=False):
    """Process all HTML files in the directory recursively"""
    
    directory_path = Path(directory)
    if not directory_path.exists():
        print(f"❌ Directory not found: {directory}")
        return
    
    print(f"\n{'🔍 DRY RUN MODE - No files will be modified' if dry_run else '🚀 PROCESSING FILES'}\n")
    print(f"Directory: {directory}\n")
    
    # Find all HTML files
    html_files = list(directory_path.rglob('*.html'))
    total_files = len(html_files)
    
    print(f"Found {total_files} HTML files\n")
    
    if total_files == 0:
        print("No HTML files found!")
        return
    
    # Ask for confirmation if not dry run
    if not dry_run:
        response = input(f"\nProcess {total_files} files? (yes/no): ")
        if response.lower() not in ['yes', 'y']:
            print("Cancelled.")
            return
    
    processed = 0
    skipped = 0
    errors = 0
    
    for html_file in html_files:
        try:
            if add_module_tracker(str(html_file), dry_run):
                processed += 1
            else:
                skipped += 1
        except Exception as e:
            print(f"❌ Unexpected error processing {html_file}: {e}")
            errors += 1
    
    print(f"\n{'=' * 60}")
    print(f"SUMMARY:")
    print(f"  Total files: {total_files}")
    print(f"  {'Would process' if dry_run else 'Processed'}: {processed}")
    print(f"  Skipped: {skipped}")
    print(f"  Errors: {errors}")
    print(f"{'=' * 60}\n")

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 add_module_tracking.py <directory> [--dry-run]")
        print("\nExample:")
        print("  python3 add_module_tracking.py ./notion-export-clean/The\\ Arcane\\ Archives/")
        print("  python3 add_module_tracking.py ./courses/ --dry-run")
        sys.exit(1)
    
    directory = sys.argv[1]
    dry_run = '--dry-run' in sys.argv or '-n' in sys.argv
    
    process_directory(directory, dry_run)

if __name__ == '__main__':
    main()