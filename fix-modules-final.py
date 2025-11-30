import os
import re

# Find all HTML files
for root, dirs, files in os.walk('.'):
    for file in files:
        if file.endswith('.html') and '27a7f6a404fe' in file:
            filepath = os.path.join(root, file)
            
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Only process if it has xp-module-listener
            if 'xp-module-listener.js' not in content:
                continue
            
            # Remove any broken imports/comments
            content = re.sub(r'<!--.*?from.*?course-module-tracker.*?-->', '', content, flags=re.DOTALL)
            content = re.sub(r'<script type="module">\s*import.*?initModuleTracker.*?</script>', '', content, flags=re.DOTALL)
            
            # Make sure we have both scripts before </body>
            if 'course-module-tracker.js' not in content:
                content = content.replace(
                    '<script type="module" src="/xp-module-listener.js"></script>',
                    '<script type="module" src="/course-module-tracker.js"></script>\n<script type="module" src="/xp-module-listener.js"></script>'
                )
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f'Fixed: {file}')

print('Done!')