#!/usr/bin/env python3
"""
🔮 THE ARCANE ARCHIVES - ULTIMATE PROCESSOR
Processes Notion exports perfectly - fixes images, embeds, navigation, everything
"""

import os
import re
import json
import shutil
from pathlib import Path
from urllib.parse import unquote

# Complete Arcane styling
ARCANE_STYLE = """
<style>
:root {
    --bg-dark: #02010a;
    --bg-card: rgba(15, 23, 42, 0.96);
    --purple: #9333ea;
    --purple-dark: #7e22ce;
    --purple-light: #a78bfa;
    --gold: #fbbf24;
    --text-light: #e5e5e5;
    --text-dim: #a3a3a3;
    --border-color: rgba(148, 163, 184, 0.5);
}

html, body {
    background: radial-gradient(circle at top, #111827 0, #02010a 45%, #000 100%) !important;
    color: var(--text-light) !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    min-height: 100vh;
    margin: 0;
    padding: 0;
}

.arcane-back-btn {
    position: fixed;
    top: 1.5rem;
    left: 1.5rem;
    z-index: 1000;
    padding: 0.6rem 1.2rem;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.4);
    background: rgba(15, 23, 42, 0.9);
    color: var(--text-dim);
    text-decoration: none;
    font-size: 0.9rem;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    backdrop-filter: blur(12px);
    transition: all 0.2s ease;
}

.arcane-back-btn:hover {
    color: var(--purple-light);
    border-color: rgba(147, 51, 234, 0.8);
    transform: translateX(-2px);
}

.page, article, body > div {
    max-width: 900px;
    margin: 4rem auto;
    padding: 2rem;
    background: radial-gradient(circle at top, rgba(147, 51, 234, 0.12), rgba(15, 23, 42, 0.98));
    border-radius: 24px;
    border: 1px solid rgba(148, 163, 184, 0.5);
    box-shadow: 0 30px 120px rgba(15, 23, 42, 0.85);
}

h1, .page-title {
    font-size: 2.2rem !important;
    color: var(--text-light) !important;
    margin-bottom: 1.5rem !important;
    background: linear-gradient(135deg, var(--purple-light), var(--gold));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

a {
    color: var(--purple-light) !important;
    text-decoration: none !important;
    transition: all 0.2s;
}

a:hover {
    color: var(--gold) !important;
}

figure a, .link-to-page a, ul li a {
    display: block;
    padding: 1rem 1.2rem;
    margin: 0.8rem 0;
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(148, 163, 184, 0.5);
    border-radius: 12px;
    color: var(--text-light) !important;
    transition: all 0.2s;
}

figure a:hover, .link-to-page a:hover, ul li a:hover {
    border-color: rgba(147, 51, 234, 0.9);
    background: radial-gradient(circle at top left, rgba(147, 51, 234, 0.25), rgba(15, 23, 42, 0.98));
    transform: translateX(4px);
}

p, li, td {
    color: var(--text-light) !important;
    line-height: 1.7;
}

h2, h3, h4, h5, h6 {
    color: var(--text-light) !important;
    margin-top: 2rem;
    margin-bottom: 1rem;
}

img {
    max-width: 100%;
    border-radius: 12px;
    margin: 1.5rem 0;
}

iframe, video, embed {
    max-width: 100%;
    border-radius: 12px;
    margin: 1.5rem 0;
    border: 1px solid rgba(148, 163, 184, 0.3);
}

code, pre {
    background: rgba(15, 23, 42, 0.95) !important;
    border: 1px solid rgba(148, 163, 184, 0.3) !important;
    color: var(--purple-light) !important;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
}

@media (max-width: 768px) {
    .page, article, body > div {
        margin: 1.5rem 0.8rem;
        padding: 1.3rem;
    }
    
    .arcane-back-btn {
        position: static;
        display: block;
        margin: 1rem auto;
        width: fit-content;
    }
    
    h1 { font-size: 1.5rem !important; }
}
</style>
"""

# Auth protection
PROTECTION = """
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
"""

def get_back_button_path(file_path, base_dir):
    """Calculate correct back button path based on file depth"""
    try:
        rel_path = file_path.relative_to(base_dir)
        depth = len(rel_path.parts) - 1  # -1 for the filename itself
        
        if depth == 0:
            # Top level file
            return "/archives.html"
        elif depth == 1:
            # One level deep - go back to archives
            return "/archives.html"
        else:
            # Multiple levels deep - go to parent
            return "../" * (depth - 1) + "index.html"
    except:
        return "/archives.html"

def fix_html_file(file_path, base_dir):
    """Fix a single HTML file"""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        # Remove existing Notion styles
        content = re.sub(r'<style>.*?</style>', '', content, flags=re.DOTALL)
        
        # Fix URL encoding in paths
        content = re.sub(
            r'(href|src)="([^"]*%[0-9A-Fa-f]{2}[^"]*)"',
            lambda m: f'{m.group(1)}="{unquote(m.group(2))}"',
            content
        )
        
        # Fix relative image paths
        content = re.sub(
            r'src="(\.\./)+(.*?\.(?:png|jpg|jpeg|gif|webp|svg))"',
            r'src="/courses/\2"',
            content,
            flags=re.IGNORECASE
        )
        
        # Keep video embeds but fix broken iframes
        def fix_iframe(match):
            full_iframe = match.group(0)
            src = match.group(1)
            
            # Keep legit embeds
            if any(x in src.lower() for x in ['youtube', 'vimeo', 'loom', 'drive.google', 'player']):
                return full_iframe
            
            # Convert others to links
            return f'<a href="{src}" target="_blank" class="embed-link">🔗 View External Content</a>'
        
        content = re.sub(
            r'<iframe[^>]*src="([^"]*)"[^>]*>.*?</iframe>',
            fix_iframe,
            content,
            flags=re.DOTALL | re.IGNORECASE
        )
        
        # Add back button
        back_path = get_back_button_path(file_path, base_dir)
        back_button = f'<a href="{back_path}" class="arcane-back-btn">← Back</a>'
        
        # Remove old back buttons
        content = re.sub(r'<a[^>]*class="arcane-back-btn"[^>]*>.*?</a>', '', content)
        
        # Inject everything
        if '<head>' in content:
            # Add styling after <head>
            content = content.replace('<head>', f'<head>\n{ARCANE_STYLE}')
        
        if '<body>' in content:
            # Add back button after <body>
            content = content.replace('<body>', f'<body>\n{back_button}')
        
        if '</body>' in content and 'protectPage' not in content:
            # Add protection before </body>
            content = content.replace('</body>', f'{PROTECTION}\n</body>')
        
        # Write fixed content
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return True
        
    except Exception as e:
        print(f"  ⚠️  Error fixing {file_path.name}: {e}")
        return False

def process_notion_export(input_dir, output_dir):
    """Main processing function"""
    print("\n🔮 THE ARCANE ARCHIVES - ULTIMATE PROCESSOR")
    print("=" * 70)
    
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    
    if not input_path.exists():
        print(f"❌ Input directory not found: {input_dir}")
        return
    
    # Create output
    output_path.mkdir(parents=True, exist_ok=True)
    
    print(f"📂 Input:  {input_path}")
    print(f"📂 Output: {output_path}\n")
    
    # Copy everything first
    print("📦 Copying all files...")
    
    for item in input_path.rglob('*'):
        if item.is_file():
            rel_path = item.relative_to(input_path)
            dest = output_path / rel_path
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, dest)
    
    print("✅ Files copied\n")
    
    # Fix all HTML files
    print("🔧 Fixing HTML files...")
    html_files = list(output_path.rglob("*.html"))
    
    fixed = 0
    for html_file in html_files:
        if fix_html_file(html_file, output_path):
            fixed += 1
            if fixed % 100 == 0:
                print(f"  ✅ Fixed {fixed} files...")
    
    print(f"✅ Fixed {fixed} HTML files\n")
    
    # Scan for courses
    print("📋 Scanning courses...")
    courses = []
    
    for folder in output_path.iterdir():
        if folder.is_dir() and not folder.name.startswith('.'):
            # Find main HTML
            main_html = None
            for pattern in [folder / f"{folder.name}.html", folder / "index.html"]:
                if pattern.exists():
                    main_html = pattern
                    break
            
            if not main_html:
                html_files_in_folder = list(folder.glob("*.html"))
                if html_files_in_folder:
                    main_html = html_files_in_folder[0]
            
            if main_html:
                lesson_count = len(list(folder.rglob("*.html")))
                title = folder.name.replace('-', ' ').replace('_', ' ').title()
                
                # Smart category detection
                title_lower = title.lower()
                if 'trading' in title_lower or 'market' in title_lower:
                    category = 'trading'
                elif 'business' in title_lower or 'sales' in title_lower:
                    category = 'business'
                elif 'mind' in title_lower or 'psychology' in title_lower:
                    category = 'mindset'
                else:
                    category = 'strategy'
                
                courses.append({
                    'title': title,
                    'folder': folder.name,
                    'path': f"courses/{folder.name}/{main_html.name}",
                    'lessons': lesson_count,
                    'duration': f"{max(2, lesson_count // 3)}h",
                    'icon': '📚',
                    'description': f"Complete course with {lesson_count} lessons",
                    'category': category
                })
    
    # Create manifest
    manifest = output_path / "course-manifest.json"
    with open(manifest, 'w') as f:
        json.dump(courses, f, indent=2)
    
    print(f"✅ Found {len(courses)} courses\n")
    
    # Summary
    print("=" * 70)
    print("🎉 PROCESSING COMPLETE!")
    print("=" * 70)
    print(f"\n✅ {len(courses)} courses processed")
    print(f"✅ {len(list(output_path.rglob('*.html')))} HTML pages fixed")
    print(f"✅ {len(list(output_path.rglob('*.png')))} images copied")
    print(f"✅ Manifest created\n")
    
    print("🚀 NEXT STEPS:")
    print(f"1. cd to your site directory")
    print(f"2. git add {output_dir}/")
    print(f"3. git commit -m 'Complete course library'")
    print(f"4. git push\n")
    print("✨ All courses will appear on archives page!")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python3 ultimate-processor.py <notion-export-folder> [output]")
        print("\nExample:")
        print("  python3 ultimate-processor.py ./notion-export ./courses")
        sys.exit(1)
    
    input_dir = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "./courses"
    
    process_notion_export(input_dir, output_dir)