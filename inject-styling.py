#!/usr/bin/env python3
"""
Script to inject Arcane Archives styling into all course HTML files
Run this in your "Arcane Archives" directory
"""

import os
import re

# The styling injection code
INJECT_CODE = '''
<!-- Arcane Archives Styling -->
<link rel="stylesheet" href="/arcane-course-style.css">
<script>
(function() {
    // Add back to archives button
    const backBtn = document.createElement('a');
    backBtn.href = '/archives.html';
    backBtn.className = 'arcane-back-btn';
    backBtn.innerHTML = '← Back to Archives';
    backBtn.style.cssText = `
        position: fixed;
        top: 1.5rem;
        left: 1.5rem;
        z-index: 1000;
        padding: 0.6rem 1.2rem;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.4);
        background: rgba(15, 23, 42, 0.9);
        color: #a3a3a3;
        text-decoration: none;
        font-size: 0.9rem;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        backdrop-filter: blur(12px);
        transition: all 0.2s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    backBtn.onmouseover = function() {
        this.style.color = '#a78bfa';
        this.style.borderColor = 'rgba(147, 51, 234, 0.8)';
        this.style.transform = 'translateX(-2px)';
    };
    
    backBtn.onmouseout = function() {
        this.style.color = '#a3a3a3';
        this.style.borderColor = 'rgba(148, 163, 184, 0.4)';
        this.style.transform = 'translateX(0)';
    };
    
    document.body.insertBefore(backBtn, document.body.firstChild);
})();
</script>
'''

def inject_styling(file_path):
    """Inject Arcane styling into an HTML file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check if already injected
        if 'arcane-course-style.css' in content:
            print(f"  ⏭️  Skipped (already styled): {file_path}")
            return False
        
        # Inject before </head> if possible, otherwise before </body>
        if '</head>' in content:
            content = content.replace('</head>', f'{INJECT_CODE}\n</head>')
        elif '</body>' in content:
            content = content.replace('</body>', f'{INJECT_CODE}\n</body>')
        else:
            print(f"  ⚠️  Warning: No </head> or </body> found in {file_path}")
            return False
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"  ✅ Styled: {file_path}")
        return True
        
    except Exception as e:
        print(f"  ❌ Error processing {file_path}: {e}")
        return False

def main():
    print("🎨 Arcane Archives Course Styling Injector\n")
    print("This will add Arcane Archives styling to all course HTML files.\n")
    
    # Get current directory
    current_dir = os.getcwd()
    print(f"Working directory: {current_dir}\n")
    
    # Files to skip
    skip_files = {
        'index.html', 'dashboard.html', 'archives.html', 'login.html',
        'community.html', 'wins.html', 'alerts.html', 'settings.html',
        'affiliate.html', 'referral.html', 'journey.html', 'live-calls.html',
        'success.html', 'loading-screen.html'
    }
    
    styled_count = 0
    total_count = 0
    
    # Walk through all directories
    for root, dirs, files in os.walk(current_dir):
        for file in files:
            if file.endswith('.html') and file not in skip_files:
                file_path = os.path.join(root, file)
                relative_path = os.path.relpath(file_path, current_dir)
                total_count += 1
                
                if inject_styling(file_path):
                    styled_count += 1
    
    print(f"\n🎉 Complete!")
    print(f"Styled {styled_count} out of {total_count} course files")
    print(f"\nNext steps:")
    print(f"1. Upload 'arcane-course-style.css' to your site root")
    print(f"2. Deploy all updated HTML files")
    print(f"3. Test a course page!")

if __name__ == '__main__':
    main()