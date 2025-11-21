#!/usr/bin/env python3
"""
Fix broken images and iframes in processed courses
"""

import os
import re
from pathlib import Path
from urllib.parse import unquote

def fix_file(filepath):
    """Fix images and iframe issues in HTML"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original = content
        
        # Fix 1: Decode URL-encoded paths
        if '%20' in content or '%2F' in content:
            # Find all href and src attributes with encoding
            content = re.sub(
                r'(href|src)="([^"]*%[0-9A-F]{2}[^"]*)"',
                lambda m: f'{m.group(1)}="{unquote(m.group(2))}"',
                content
            )
        
        # Fix 2: Convert iframe embeds to proper links
        # Look for Notion iframe patterns
        iframe_pattern = r'<iframe[^>]*src="([^"]*)"[^>]*></iframe>'
        
        def replace_iframe(match):
            url = match.group(1)
            # If it's a YouTube/Vimeo/etc embed, keep it
            if any(domain in url.lower() for domain in ['youtube', 'vimeo', 'loom', 'drive.google']):
                return match.group(0)  # Keep original iframe
            # Otherwise convert to link
            return f'<a href="{url}" target="_blank" style="display:block;padding:1rem;background:rgba(147,51,234,0.1);border-radius:8px;margin:1rem 0;">🔗 View Content</a>'
        
        content = re.sub(iframe_pattern, replace_iframe, content, flags=re.IGNORECASE)
        
        # Fix 3: Fix broken image paths
        # Look for src="../../../" type paths and simplify
        content = re.sub(
            r'src="(\.\./)+([^"]*)"',
            lambda m: f'src="/{m.group(2)}"',
            content
        )
        
        # Save if changed
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        
        return False
        
    except Exception as e:
        print(f"Error: {filepath}: {e}")
        return False

def fix_all_courses(courses_dir):
    """Fix all HTML files in courses directory"""
    print("\n🔧 FIXING COURSE ISSUES")
    print("=" * 60)
    
    courses_path = Path(courses_dir)
    if not courses_path.exists():
        print(f"❌ Directory not found: {courses_dir}")
        return
    
    html_files = list(courses_path.rglob("*.html"))
    print(f"📄 Found {len(html_files)} HTML files\n")
    
    fixed_count = 0
    for html_file in html_files:
        if fix_file(html_file):
            fixed_count += 1
            if fixed_count % 50 == 0:
                print(f"  ✅ Fixed {fixed_count} files...")
    
    print(f"\n✅ Fixed {fixed_count} files total")
    print("\n🚀 Now redeploy:")
    print("   git add courses/")
    print("   git commit -m 'Fixed images and iframes'")
    print("   git push")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python3 course-fixer.py <courses-directory>")
        print("\nExample:")
        print("  python3 course-fixer.py ./courses")
        sys.exit(1)
    
    fix_all_courses(sys.argv[1])