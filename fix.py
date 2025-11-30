#!/usr/bin/env python3
import os
import re

count = 0
for root, dirs, files in os.walk('.'):
    for file in files:
        if file.endswith('.html'):
            filepath = os.path.join(root, file)
            
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Skip if not a module page
                if 'aa-pill-button' not in content:
                    continue
                
                original = content
                
                # Remove the broken comment lines
                content = re.sub(r'\s*<!--.*?from.*?course-module-tracker.*?-->', '', content, flags=re.DOTALL)
                content = re.sub(r'\s*".*?from.*?course-module-tracker.*?"', '', content)
                content = re.sub(r'\s*\*.*?from.*?course-module-tracker.*?\*', '', content)
                
                # Remove broken import blocks
                content = re.sub(r'<script type="module">\s*import.*?initModuleTracker.*?</script>', '', content, flags=re.DOTALL)
                
                # Make sure we have the correct scripts before </body>
                if '/course-module-tracker.js' not in content:
                    # Add it before xp-module-listener
                    content = content.replace(
                        '<script type="module" src="/xp-module-listener.js">',
                        '<script type="module" src="/course-module-tracker.js"></script>\n<script type="module" src="/xp-module-listener.js">'
                    )
                
                if content != original:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(content)
                    count += 1
                    print(f'Fixed: {file}')
                    
            except Exception as e:
                print(f'Error with {file}: {e}')

print(f'\n✅ Fixed {count} files!')