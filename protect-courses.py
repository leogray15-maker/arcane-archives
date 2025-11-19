#!/usr/bin/env python3
import os
import re

PROTECTION_SCRIPT = '''
<script type="module">
import { protectPage } from '/universal-auth.js';

protectPage({
    requirePaid: true,
    onFailure: () => {
        window.location.href = '/login.html';
    }
});
</script>
'''

def add_protection(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'protectPage' in content:
        return False
    
    if '</body>' in content:
        content = content.replace('</body>', f'{PROTECTION_SCRIPT}\n</body>')
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

# Walk all directories
count = 0
for root, dirs, files in os.walk('.'):
    for file in files:
        if file.endswith('.html') and file not in ['index.html', 'login.html', 'success.html']:
            filepath = os.path.join(root, file)
            if add_protection(filepath):
                count += 1
                if count % 100 == 0:
                    print(f"Protected {count} files...")

print(f"✅ Protected {count} course pages!")