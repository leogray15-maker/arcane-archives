#!/usr/bin/env python3
"""
🚨 EMERGENCY FIX SCRIPT FOR ARCANE ARCHIVES
Run this on your DEPLOYED site files to fix critical issues
"""

import os
import re
from pathlib import Path

def fix_firestore_collection_name(content):
    """Fix Firestore 'users' to 'Users' everywhere"""
    # Match doc(db, "users" or doc(db, 'users'
    content = re.sub(
        r'doc\s*\(\s*db\s*,\s*["\']users["\']',
        'doc(db, "Users"',
        content,
        flags=re.IGNORECASE
    )
    
    # Match collection("users"
    content = re.sub(
        r'collection\s*\(\s*["\']users["\']',
        'collection("Users"',
        content,
        flags=re.IGNORECASE
    )
    
    return content

def add_course_auth_protection(filepath):
    """Add auth protection to course HTML files"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Skip if already protected
        if 'protectPage' in content:
            return False
        
        # Add protection before </body>
        protection = '''
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
        
        if '</body>' in content:
            content = content.replace('</body>', f'{protection}</body>')
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        
        return False
        
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False

def fix_archives_path(content):
    """Fix archives page path references"""
    # Fix back button paths
    content = re.sub(
        r'href=["\']archives\.html["\']',
        'href="archives-new.html"',
        content
    )
    return content

def emergency_fix():
    """Run all emergency fixes"""
    print("🚨 ARCANE ARCHIVES EMERGENCY FIX")
    print("=" * 50)
    print()
    
    fixes_applied = {
        'firestore': 0,
        'auth_protection': 0,
        'archives_path': 0
    }
    
    # Get all HTML and JS files
    files_to_fix = []
    
    # Check common locations
    for pattern in ['*.html', '*.js', 'courses/**/*.html']:
        files_to_fix.extend(Path('.').glob(pattern))
    
    print(f"📁 Found {len(files_to_fix)} files to check\n")
    
    for filepath in files_to_fix:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original = content
            changed = False
            
            # Apply fixes
            if filepath.suffix in ['.html', '.js']:
                # Fix Firestore collection names
                fixed_content = fix_firestore_collection_name(content)
                if fixed_content != content:
                    content = fixed_content
                    fixes_applied['firestore'] += 1
                    changed = True
                
                # Fix archives paths
                fixed_content = fix_archives_path(content)
                if fixed_content != content:
                    content = fixed_content
                    fixes_applied['archives_path'] += 1
                    changed = True
            
            # Add auth protection to course files
            if 'courses/' in str(filepath) and filepath.suffix == '.html':
                if add_course_auth_protection(filepath):
                    fixes_applied['auth_protection'] += 1
                    changed = True
            
            # Save if changed
            if changed and content != original:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"  ✅ Fixed: {filepath}")
                
        except Exception as e:
            print(f"  ⚠️  Error processing {filepath}: {e}")
    
    print()
    print("=" * 50)
    print("📊 SUMMARY")
    print("=" * 50)
    print(f"Firestore fixes:      {fixes_applied['firestore']}")
    print(f"Auth protection adds: {fixes_applied['auth_protection']}")
    print(f"Archives path fixes:  {fixes_applied['archives_path']}")
    print()
    print("✅ Emergency fixes complete!")
    print()
    print("🚀 NEXT STEPS:")
    print("1. Upload login.html to your site root")
    print("2. Deploy these fixed files")
    print("3. Test login at yoursite.com/login.html")
    print("4. Process and upload your courses")

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == '--help':
        print("""
🚨 ARCANE ARCHIVES EMERGENCY FIX SCRIPT

Usage:
  python emergency-fix.py [directory]

If no directory specified, fixes current directory.

What it fixes:
  ✅ Firestore collection name (users → Users)
  ✅ Adds auth protection to course pages
  ✅ Fixes archives page path references
  
Run this in your site's root directory before deployment!
        """)
        sys.exit(0)
    
    # Change to specified directory if provided
    if len(sys.argv) > 1:
        target_dir = sys.argv[1]
        if os.path.exists(target_dir):
            os.chdir(target_dir)
            print(f"📂 Working in: {os.getcwd()}\n")
        else:
            print(f"❌ Directory not found: {target_dir}")
            sys.exit(1)
    
    emergency_fix()