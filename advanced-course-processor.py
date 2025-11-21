#!/usr/bin/env python3
"""
🔮 THE ARCANE ARCHIVES - COMPLETE COURSE PROCESSOR
Processes Notion exports with:
- Nested course structure preservation
- Auth protection injection
- Arcane styling
- Working navigation between lessons
"""

import os
import re
import json
from pathlib import Path
from bs4 import BeautifulSoup

# Protection script to inject into ALL course pages
PROTECTION_SCRIPT = '''
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

# Arcane styling for course pages
ARCANE_COURSE_STYLE = '''
<style>
/* Arcane Archives Course Styling */
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

/* Back button */
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

/* Main content */
.page, article {
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

.page-header-icon {
    font-size: 3rem !important;
    margin-bottom: 1rem;
}

a {
    color: var(--purple-light) !important;
    text-decoration: none !important;
    transition: all 0.2s;
}

a:hover {
    color: var(--gold) !important;
}

/* Module/lesson links */
figure a, .link-to-page a, li a {
    display: block;
    padding: 1rem 1.2rem;
    margin: 0.8rem 0;
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(148, 163, 184, 0.5);
    border-radius: 12px;
    color: var(--text-light) !important;
    transition: all 0.2s;
}

figure a:hover, .link-to-page a:hover, li a:hover {
    border-color: rgba(147, 51, 234, 0.9);
    background: radial-gradient(circle at top left, rgba(147, 51, 234, 0.25), rgba(15, 23, 42, 0.98));
    transform: translateX(4px);
    text-decoration: none !important;
}

p {
    color: var(--text-light) !important;
    line-height: 1.7;
    margin: 1rem 0;
}

h2, h3, h4, h5, h6 {
    color: var(--text-light) !important;
    margin-top: 2rem;
    margin-bottom: 1rem;
}

h2 { font-size: 1.7rem !important; }
h3 { font-size: 1.4rem !important; }
h4 { font-size: 1.2rem !important; }

ul, ol {
    color: var(--text-light) !important;
    padding-left: 1.5rem;
}

li {
    color: var(--text-light) !important;
    margin: 0.5rem 0;
}

code, pre {
    background: rgba(15, 23, 42, 0.95) !important;
    border: 1px solid rgba(148, 163, 184, 0.3) !important;
    color: var(--purple-light) !important;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
}

pre {
    padding: 1rem !important;
    overflow-x: auto;
}

hr {
    border: none;
    border-top: 1px solid rgba(148, 163, 184, 0.3);
    margin: 2rem 0;
}

blockquote {
    border-left: 3px solid var(--purple);
    padding-left: 1.5rem;
    margin: 1.5rem 0;
    color: var(--text-dim) !important;
    font-style: italic;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin: 1.5rem 0;
}

th, td {
    padding: 0.8rem;
    border: 1px solid rgba(148, 163, 184, 0.3);
    color: var(--text-light) !important;
}

th {
    background: rgba(147, 51, 234, 0.2);
    font-weight: 600;
}

img {
    max-width: 100%;
    border-radius: 12px;
    margin: 1.5rem 0;
}

/* Embedded content (videos, iframes) */
iframe, video {
    max-width: 100%;
    border-radius: 12px;
    margin: 1.5rem 0;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
    .page, article {
        margin: 1.5rem 0.8rem;
        padding: 1.3rem;
    }

    .arcane-back-btn {
        position: static;
        display: block;
        margin: 1rem auto;
        width: fit-content;
    }

    h1, .page-title {
        font-size: 1.5rem !important;
    }

    h2 { font-size: 1.3rem !important; }
    h3 { font-size: 1.1rem !important; }
    h4 { font-size: 1rem !important; }

    figure a, .link-to-page a, li a {
        padding: 0.8rem 1rem;
        font-size: 0.9rem;
    }

    .page-header-icon {
        font-size: 2rem !important;
    }

    table {
        display: block;
        overflow-x: auto;
        white-space: nowrap;
    }

    th, td {
        padding: 0.6rem;
        font-size: 0.85rem;
    }

    pre {
        padding: 0.8rem !important;
        font-size: 0.85rem;
        overflow-x: auto;
    }
}

@media (max-width: 480px) {
    .page, article {
        margin: 1rem 0.5rem;
        padding: 1rem;
    }

    h1, .page-title {
        font-size: 1.3rem !important;
    }

    figure a, .link-to-page a, li a {
        padding: 0.7rem 0.8rem;
        font-size: 0.85rem;
    }

    .arcane-back-btn {
        font-size: 0.85rem;
        padding: 0.5rem 1rem;
    }
}
</style>
'''

def get_back_button_path(current_path, is_main_index=False):
    """Determine the correct back button path based on depth"""
    if is_main_index:
        return "/archives-new.html"
    
    # Count directory depth
    depth = len(Path(current_path).parts)
    
    if depth <= 2:  # Top level course
        return "/archives-new.html"
    else:  # Sub-course
        return "../index.html"  # Go back to parent course

def process_html_file(file_path, output_dir, is_main_course=False):
    """Process a single HTML file"""
    print(f"  Processing: {file_path.name}")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        soup = BeautifulSoup(content, 'html.parser')
        
        # Find or create head
        head = soup.find('head')
        if not head:
            head = soup.new_tag('head')
            if soup.html:
                soup.html.insert(0, head)
        
        # Add charset and viewport
        if not head.find('meta', attrs={'charset': True}):
            charset = soup.new_tag('meta', attrs={'charset': 'UTF-8'})
            head.insert(0, charset)
        
        existing_viewport = head.find('meta', attrs={'name': 'viewport'})
        if existing_viewport:
            existing_viewport.decompose()
        
        viewport = soup.new_tag('meta', attrs={
            'name': 'viewport',
            'content': 'width=device-width, initial-scale=1.0'
        })
        head.insert(0, viewport)
        
        # Remove existing styles
        for style_tag in head.find_all('style'):
            style_tag.decompose()
        
        # Add Arcane styling
        head.append(BeautifulSoup(ARCANE_COURSE_STYLE, 'html.parser'))
        
        # Inject protection script
        body = soup.find('body')
        if body:
            # Add back button
            relative_path = str(file_path.relative_to(output_dir.parent)) if not is_main_course else ""
            back_path = get_back_button_path(relative_path, is_main_course)
            
            back_btn_html = f'''
            <a href="{back_path}" class="arcane-back-btn">
                ← Back to {('Archives' if is_main_course or back_path == '/archives-new.html' else 'Course')}
            </a>
            '''
            back_btn = BeautifulSoup(back_btn_html, 'html.parser')
            body.insert(0, back_btn)
            
            # Add protection script at end of body
            protection = BeautifulSoup(PROTECTION_SCRIPT, 'html.parser')
            body.append(protection)
        
        # Fix links - make them work with Notion's export structure
        for link in soup.find_all('a', href=True):
            href = link['href']
            # Keep relative links as-is for Notion navigation
            # They're already in format like "../Lesson/Lesson.html"
            if not href.startswith(('http://', 'https://', '#', 'mailto:')):
                # Ensure .html extension
                if not href.endswith('.html') and '.' not in href.split('/')[-1]:
                    link['href'] = href + '.html'
        
        # Save processed file
        output_path = output_dir / file_path.name
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(str(soup.prettify()))
        
        return True
        
    except Exception as e:
        print(f"    ❌ Error: {e}")
        return False

def copy_assets(input_dir, output_dir):
    """Copy all non-HTML files (images, etc.)"""
    import shutil
    
    for root, dirs, files in os.walk(input_dir):
        for file in files:
            if not file.endswith('.html'):
                src_path = Path(root) / file
                rel_path = src_path.relative_to(input_dir)
                dest_path = output_dir / rel_path
                
                dest_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src_path, dest_path)
                print(f"  📎 Copied asset: {rel_path}")

def generate_course_manifest(output_dir):
    """Generate a JSON manifest of all courses for archives page"""
    courses = []
    
    for item in output_dir.iterdir():
        if item.is_dir() and not item.name.startswith('.'):
            # Look for index.html in this course folder
            index_path = item / (item.name + '.html')
            if not index_path.exists():
                # Try other common names
                for name in ['index.html', f"{item.name}.html"]:
                    test_path = item / name
                    if test_path.exists():
                        index_path = test_path
                        break
            
            if index_path.exists():
                # Extract course info
                try:
                    with open(index_path, 'r', encoding='utf-8') as f:
                        soup = BeautifulSoup(f.read(), 'html.parser')
                    
                    title = soup.find('h1') or soup.find('title')
                    title_text = title.get_text().strip() if title else item.name
                    
                    # Count lessons
                    lesson_links = soup.find_all('a', href=True)
                    lesson_count = len([l for l in lesson_links if '.html' in l['href']])
                    
                    courses.append({
                        'title': title_text,
                        'folder': item.name,
                        'path': f"courses/{item.name}/{index_path.name}",
                        'lessons': lesson_count,
                        'icon': '📚'  # Default icon
                    })
                    
                except Exception as e:
                    print(f"  ⚠️  Could not parse course: {item.name} - {e}")
    
    # Save manifest
    manifest_path = output_dir / 'course-manifest.json'
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(courses, f, indent=2)
    
    print(f"\n📋 Generated manifest with {len(courses)} courses")
    return courses

def process_directory(input_dir, output_dir):
    """Main processing function"""
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    
    output_path.mkdir(parents=True, exist_ok=True)
    
    print(f"\n🔮 THE ARCANE ARCHIVES COURSE PROCESSOR")
    print(f"=" * 50)
    print(f"📂 Input:  {input_path}")
    print(f"📂 Output: {output_path}\n")
    
    # Find all HTML files
    html_files = list(input_path.rglob('*.html'))
    
    if not html_files:
        print("❌ No HTML files found!")
        return
    
    print(f"📚 Found {len(html_files)} HTML files\n")
    
    # Process HTML files
    success_count = 0
    for html_file in html_files:
        relative_path = html_file.relative_to(input_path)
        file_output_dir = output_path / relative_path.parent
        
        is_main = len(relative_path.parts) == 1  # Top level file
        
        if process_html_file(html_file, file_output_dir, is_main):
            success_count += 1
    
    print(f"\n✅ Processed {success_count}/{len(html_files)} HTML files")
    
    # Copy assets
    print(f"\n📎 Copying assets...")
    copy_assets(input_path, output_path)
    
    # Generate manifest
    courses = generate_course_manifest(output_path)
    
    print(f"\n✨ COMPLETE!")
    print(f"=" * 50)
    print(f"📂 All files ready in: {output_path}")
    print(f"\n🚀 NEXT STEPS:")
    print(f"1. Upload the '{output_path.name}' folder to your site as 'courses/'")
    print(f"2. Update archives-new.html with the course data from course-manifest.json")
    print(f"3. Deploy and test!")
    print(f"\n🎉 Ready for December 1st launch!")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python advanced-course-processor.py <notion_export_folder> [output_folder]")
        print("\nExample:")
        print("  python advanced-course-processor.py ./notion-export ./processed-courses")
        sys.exit(1)
    
    input_dir = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "./processed-courses"
    
    if not Path(input_dir).exists():
        print(f"❌ Input directory not found: {input_dir}")
        sys.exit(1)
    
    process_directory(input_dir, output_dir)