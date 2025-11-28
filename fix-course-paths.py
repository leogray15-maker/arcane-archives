import os
import re

# Find all HTML files in subdirectories
for root, dirs, files in os.walk('.'):
    # Skip root directory and hidden directories
    if root == '.' or '/.git' in root or '/node_modules' in root:
        continue
    
    for file in files:
        if file.endswith('.html'):
            filepath = os.path.join(root, file)
            
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Replace relative imports with absolute imports
            updated = content
            updated = re.sub(r'src="\./([^"]+\.js)"', r'src="/\1"', updated)
            updated = re.sub(r"src='./([^']+\.js)'", r"src='/\1'", updated)
            updated = re.sub(r'href="\./([^"]+\.css)"', r'href="/\1"', updated)
            updated = re.sub(r"href='./([^']+\.css)'", r"href='/\1'", updated)
            
            if updated != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(updated)
                print(f'✅ Fixed: {filepath}')

print('Done!')
