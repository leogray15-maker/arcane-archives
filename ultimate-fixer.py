#!/usr/bin/env python3
"""
ULTIMATE ARCANE ARCHIVES SITE FIXER
Fixes ALL issues across ALL pages in one go
"""

import os
import re

# Universal styles to inject
UNIVERSAL_CSS = """
/* UNIVERSAL FIXES - Footer + Mobile */
html, body {
    min-height: 100vh;
}

body {
    display: flex;
    flex-direction: column;
}

main, .main-content {
    flex: 1;
}

footer {
    margin-top: auto !important;
    width: 100%;
}

@media (max-width: 768px) {
    .back-btn {
        position: static !important;
        display: block;
        margin: 1rem auto !important;
        width: fit-content;
    }

    .header {
        margin-top: 1rem !important;
        padding: 1rem !important;
    }

    .logo {
        font-size: 0.8rem !important;
    }

    .logo img {
        height: 28px !important;
        width: 28px !important;
    }

    .main-content, main {
        padding: 0 1rem !important;
    }

    .page-card {
        padding: 1.5rem 1rem !important;
    }

    .page-header h1 {
        font-size: 1.6rem !important;
    }

    .calls-grid, .wins-grid, .affiliate-grid, .nav-grid, .stats-grid {
        grid-template-columns: 1fr !important;
    }

    footer {
        padding: 1.5rem 1rem !important;
    }

    .footer-links {
        flex-direction: column;
        gap: 1rem;
    }

    input, textarea, select {
        font-size: 16px !important;
    }
}

@media (max-width: 480px) {
    .page-header h1 {
        font-size: 1.4rem !important;
    }
}
"""

def fix_firestore_references(content):
    """Fix all Firestore 'users' to 'Users'"""
    content = re.sub(r"doc\(db,\s*['\"]users['\"]", "doc(db, 'Users'", content)
    return content

def add_universal_css(content):
    """Add universal CSS before closing </style>"""
    if 'UNIVERSAL FIXES' in content:
        return content
    
    if '</style>' in content:
        content = content.replace('</style>', f'{UNIVERSAL_CSS}\n    </style>', 1)
    
    return content

def fix_back_button(content):
    """Ensure back button points to dashboard.html"""
    # Fix various back button formats
    content = re.sub(
        r'href=["\'](?!dashboard\.html)[^"\']*["\'](\s*class=["\']back-btn["\'])',
        r'href="dashboard.html"\1',
        content
    )
    return content

def process_file(filepath):
    """Process a single HTML file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original = content
        
        # Apply fixes
        content = fix_firestore_references(content)
        content = add_universal_css(content)
        content = fix_back_button(content)
        
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
        
    except Exception as e:
        print(f"  ❌ Error: {filepath} - {e}")
        return False

def main():
    print("🔥 ULTIMATE ARCANE ARCHIVES FIXER\n")
    print("Fixing:")
    print("✅ Footer positioning (all pages)")
    print("✅ Mobile optimization (all pages)")
    print("✅ Firestore references ('Users' not 'users')")
    print("✅ Back to Dashboard buttons")
    print()
    
    pages = [
        'dashboard.html',
        'archives.html',
        'affiliate.html',
        'alerts.html',
        'community.html',
        'journey.html',
        'referral.html',
        'settings.html',
        'wins.html',
        'live-calls.html'
    ]
    
    fixed_count = 0
    for page in pages:
        if os.path.exists(page):
            if process_file(page):
                print(f"  ✅ Fixed: {page}")
                fixed_count += 1
            else:
                print(f"  ⏭️  No changes: {page}")
        else:
            print(f"  ⚠️  Not found: {page}")
    
    print(f"\n🎉 Complete! Fixed {fixed_count}/{len(pages)} files")
    print("\nAll pages now have:")
    print("✅ Footer stuck to bottom")
    print("✅ Mobile responsive")
    print("✅ Correct Firestore refs")
    print("✅ Working back buttons")

if __name__ == '__main__':
    main()