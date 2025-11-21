#!/usr/bin/env python3
import os
import re
import sys

COURSES_ROOT = sys.argv[1] if len(sys.argv) > 1 else "notion-export-clean/The Arcane Archives"

# Match ANY iframe with src in single or double quotes, any attributes, any content
IFRAME_RE = re.compile(
    r'<iframe[^>]*src=(["\'])(.*?)\1[^>]*>.*?</iframe>',
    re.IGNORECASE | re.DOTALL,
)

def fix_file(path: str):
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()

    original = html

    def repl(m):
        src = m.group(2).strip()
        return f'<p><a href="{src}" target="_blank" rel="noopener noreferrer">{src}</a></p>'

    html, count = IFRAME_RE.subn(repl, html)

    if count > 0:
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"✅ {path} — converted {count} iframe(s) to links")

for root, _, files in os.walk(COURSES_ROOT):
    for name in files:
        if not name.lower().endswith(".html"):
            continue
        fix_file(os.path.join(root, name))

print("🎉 Brutal iframe fixer complete.")
