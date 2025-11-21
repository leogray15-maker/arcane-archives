#!/usr/bin/env python3
import os
import re
import sys

# Folder for the Reality Shifting course
COURSE_ROOT = sys.argv[1] if len(sys.argv) > 1 else \
    "notion-export-clean/The Arcane Archives/The Reality Shifting Entrepreneur ($995 Value)"

iframe_pattern = re.compile(
    r'<iframe[^>]*src="([^"]+)"[^>]*>.*?</iframe>',
    re.IGNORECASE | re.DOTALL,
)

def fix_file(path: str):
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()

    original = html

    def repl(match):
        src = match.group(1)
        # turn iframe into a simple clickable link
        return f'<p><a href="{src}" target="_blank" rel="noopener noreferrer">{src}</a></p>'

    html, count = iframe_pattern.subn(repl, html)

    if count > 0:
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"✅ {path} — converted {count} iframe(s) to links")

if not os.path.isdir(COURSE_ROOT):
    print(f"ERROR: {COURSE_ROOT} is not a directory")
    sys.exit(1)

for root, _, files in os.walk(COURSE_ROOT):
    for name in files:
        if name.lower().endswith(".html"):
            fix_file(os.path.join(root, name))

print("🎉 Reality Shifting course: iframe → link conversion complete.")
