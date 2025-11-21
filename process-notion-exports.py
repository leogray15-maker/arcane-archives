#!/usr/bin/env python3
"""
The Arcane Archives - Notion HTML Processor
Automatically applies Arcane styling to exported Notion pages
"""

import os
import re
from pathlib import Path
from bs4 import BeautifulSoup

# Arcane styling CSS to inject
ARCANE_STYLE = """
<style>
/* Arcane Archives Universal Styling */
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

/* Override Notion's default white background */
html, body {
    background: radial-gradient(circle at top, #111827 0, #02010a 45%, #000 100%) !important;
    color: var(--text-light) !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    min-height: 100vh;
    margin: 0;
    padding: 0;
}

/* Back to Archives button */
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

/* Main content container */
.page, article {
    max-width: 900px;
    margin: 4rem auto;
    padding: 2rem;
    background: radial-gradient(circle at top, rgba(147, 51, 234, 0.12), rgba(15, 23, 42, 0.98));
    border-radius: 24px;
    border: 1px solid rgba(148, 163, 184, 0.5);
    box-shadow: 0 30px 120px rgba(15, 23, 42, 0.85);
}

/* Course title */
h1, .page-title {
    font-size: 2.2rem !important;
    color: var(--text-light) !important;
    margin-bottom: 1.5rem !important;
    background: linear-gradient(135deg, var(--purple-light), var(--gold));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

/* Course icon */
.page-header-icon {
    font-size: 3rem !important;
    margin-bottom: 1rem;
}

/* Sub-module links */
a {
    color: var(--purple-light) !important;
    text-decoration: none !important;
    transition: all 0.2s;
}

a:hover {
    color: var(--gold) !important;
    text-decoration: underline !important;
}

/* Module links styling */
figure a, .link-to-page a {
    display: block;
    padding: 1rem 1.2rem;
    margin: 0.8rem 0;
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(148, 163, 184, 0.5);
    border-radius: 12px;
    color: var(--text-light) !important;
    transition: all 0.2s;
}

figure a:hover, .link-to-page a:hover {
    border-color: rgba(147, 51, 234, 0.9);
    background: radial-gradient(circle at top left, rgba(147, 51, 234, 0.25), rgba(15, 23, 42, 0.98));
    transform: translateX(4px);
    text-decoration: none !important;
}

/* Text styling */
p {
    color: var(--text-light) !important;
    line-height: 1.7;
    margin: 1rem 0;
}

/* Headers */
h2, h3, h4, h5, h6 {
    color: var(--text-light) !important;
    margin-top: 2rem;
    margin-bottom: 1rem;
}

h2 { font-size: 1.7rem !important; }
h3 { font-size: 1.4rem !important; }
h4 { font-size: 1.2rem !important; }

/* Lists */
ul, ol {
    color: var(--text-light) !important;
    padding-left: 1.5rem;
}

li {
    color: var(--text-light) !important;
    margin: 0.5rem 0;
}

/* Code blocks */
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

/* Dividers */
hr {
    border: none;
    border-top: 1px solid rgba(148, 163, 184, 0.3);
    margin: 2rem 0;
}

/* Blockquotes */
blockquote {
    border-left: 3px solid var(--purple);
    padding-left: 1.5rem;
    margin: 1.5rem 0;
    color: var(--text-dim) !important;
    font-style: italic;
}

/* Tables */
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

/* Images */
img {
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

    figure a, .link-to-page a {
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

    figure a, .link-to-page a {
        padding: 0.7rem 0.8rem;
        font-size: 0.85rem;
    }

    .arcane-back-btn {
        font-size: 0.85rem;
        padding: 0.5rem 1rem;
    }
}
</style>
"""

# Back button HTML to inject
BACK_BUTTON_HTML = """
<a href="archives.html" class="arcane-back-btn">
    ← Back to Archives
</a>
"""


def process_html_file(file_path, output_dir):
    """Process a single HTML file and apply Arcane styling"""
    print(f"Processing: {file_path.name}")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f.read(), 'html.parser')
        
        # Find or create head tag
        head = soup.find('head')
        if not head:
            head = soup.new_tag('head')
            if soup.html:
                soup.html.insert(0, head)
        
        # Remove existing viewport meta if present
        existing_viewport = head.find('meta', attrs={'name': 'viewport'})
        if existing_viewport:
            existing_viewport.decompose()
        
        # Add proper viewport meta
        viewport_meta = soup.new_tag('meta', attrs={
            'name': 'viewport',
            'content': 'width=device-width, initial-scale=1.0'
        })
        head.insert(0, viewport_meta)
        
        # Add charset if not present
        if not head.find('meta', attrs={'charset': True}):
            charset_meta = soup.new_tag('meta', attrs={'charset': 'UTF-8'})
            head.insert(0, charset_meta)
        
        # Inject Arcane styling (remove existing Notion styles first)
        for style_tag in head.find_all('style'):
            style_tag.decompose()
        
        # Add our Arcane style
        head.append(BeautifulSoup(ARCANE_STYLE, 'html.parser'))
        
        # Find body and inject back button at the start
        body = soup.find('body')
        if body:
            back_btn = BeautifulSoup(BACK_BUTTON_HTML, 'html.parser')
            body.insert(0, back_btn)
        
        # Fix relative links to maintain navigation
        # Notion exports use relative paths like "../Page/Subpage.html"
        # We want to preserve these
        
        # Save processed file
        output_path = output_dir / file_path.name
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(str(soup.prettify()))
        
        print(f"✅ Saved: {output_path.name}")
        return True
        
    except Exception as e:
        print(f"❌ Error processing {file_path.name}: {e}")
        return False


def process_directory(input_dir, output_dir):
    """Process all HTML files in a directory"""
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    
    # Create output directory if it doesn't exist
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Find all HTML files
    html_files = list(input_path.rglob('*.html'))
    
    if not html_files:
        print(f"❌ No HTML files found in {input_dir}")
        return
    
    print(f"\n🔮 Found {len(html_files)} HTML files")
    print(f"📁 Input: {input_path}")
    print(f"📁 Output: {output_path}\n")
    
    success_count = 0
    for html_file in html_files:
        # Recreate directory structure in output
        relative_path = html_file.relative_to(input_path)
        file_output_dir = output_path / relative_path.parent
        file_output_dir.mkdir(parents=True, exist_ok=True)
        
        if process_html_file(html_file, file_output_dir):
            success_count += 1
    
    print(f"\n✨ Complete! Processed {success_count}/{len(html_files)} files")
    print(f"📂 Output directory: {output_path}")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python process-notion-exports.py <input_directory> [output_directory]")
        print("\nExample:")
        print("  python process-notion-exports.py ./notion-export ./processed-courses")
        sys.exit(1)
    
    input_dir = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "./processed-courses"
    
    process_directory(input_dir, output_dir)