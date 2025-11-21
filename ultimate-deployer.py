#!/usr/bin/env python3
"""
🔮 ULTIMATE COURSE DEPLOYER
Takes your processed-courses folder and makes it production-ready
"""

import os
import re
import json
from pathlib import Path

# Auth protection to inject
PROTECTION = '''
<script type="module">
import { protectPage } from "/auth-guard.js";
protectPage({
    onSuccess: (user, userData) => {
        console.log("✅ Course access granted");
    },
    onFailure: () => {
        window.location.href = "/login.html";
    }
});
</script>
'''

def add_protection_to_file(filepath):
    """Add auth protection if not present"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if 'protectPage' in content:
            return False
        
        if '</body>' in content:
            content = content.replace('</body>', f'{PROTECTION}</body>')
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        
        return False
    except Exception as e:
        return False

def scan_courses(source_dir):
    """Scan all courses and create manifest"""
    courses = []
    
    source_path = Path(source_dir)
    if not source_path.exists():
        print(f"❌ Directory not found: {source_dir}")
        return courses
    
    # Find all top-level course folders
    for item in source_path.iterdir():
        if item.is_dir() and not item.name.startswith('.'):
            # Look for main HTML file
            main_html = None
            
            # Try common patterns
            patterns = [
                item / f"{item.name}.html",
                item / "index.html"
            ]
            
            for pattern in patterns:
                if pattern.exists():
                    main_html = pattern
                    break
            
            # If no main HTML, find first HTML file
            if not main_html:
                html_files = list(item.glob("*.html"))
                if html_files:
                    main_html = html_files[0]
            
            if main_html:
                # Count all HTML files in this course
                all_htmls = list(item.rglob("*.html"))
                lesson_count = len(all_htmls)
                
                title = item.name.replace('-', ' ').replace('_', ' ').title()
                
                # Detect category
                title_lower = title.lower()
                if any(word in title_lower for word in ['trading', 'market', 'chart']):
                    category = 'trading'
                elif any(word in title_lower for word in ['business', 'money', 'sales']):
                    category = 'business'
                elif any(word in title_lower for word in ['mind', 'psychology', 'mental']):
                    category = 'mindset'
                else:
                    category = 'strategy'
                
                # Estimate duration
                hours = max(2, min(12, lesson_count // 3))
                
                courses.append({
                    'title': title,
                    'folder': item.name,
                    'path': f"courses/{item.name}/{main_html.name}",
                    'lessons': lesson_count,
                    'duration': f"{hours}h",
                    'icon': '📚',
                    'description': f"Complete course with {lesson_count} lessons",
                    'category': category
                })
                
                print(f"  ✅ {title} ({lesson_count} lessons)")
    
    return courses

def process_all_courses(source_dir, output_dir):
    """Process all courses and add protection"""
    print("\n🔮 ULTIMATE COURSE DEPLOYER")
    print("=" * 60)
    
    source_path = Path(source_dir)
    output_path = Path(output_dir)
    
    if not source_path.exists():
        print(f"❌ Source directory not found: {source_dir}")
        return
    
    # Create output directory
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Scan courses first
    print("📋 Scanning courses...")
    courses = scan_courses(source_dir)
    print(f"\n✅ Found {len(courses)} courses\n")
    
    # Copy everything
    print("📦 Copying files...")
    import shutil
    
    for item in source_path.iterdir():
        if item.is_dir() and not item.name.startswith('.'):
            dest = output_path / item.name
            if dest.exists():
                shutil.rmtree(dest)
            shutil.copytree(item, dest)
    
    # Add protection to all HTML files
    print("\n🔒 Adding protection...")
    html_files = list(output_path.rglob("*.html"))
    protected_count = 0
    
    for html_file in html_files:
        if add_protection_to_file(html_file):
            protected_count += 1
    
    print(f"✅ Protected {protected_count} files\n")
    
    # Create manifest
    manifest_path = output_path / "course-manifest.json"
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(courses, f, indent=2)
    
    print("=" * 60)
    print("🎉 COMPLETE!")
    print(f"✅ {len(courses)} courses ready")
    print(f"✅ {len(html_files)} total pages")
    print(f"✅ Manifest created\n")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python3 ultimate-deployer.py <source> <output>")
        sys.exit(1)
    
    source = sys.argv[1]
    output = sys.argv[2] if len(sys.argv) > 2 else "./courses"
    
    process_all_courses(source, output)
