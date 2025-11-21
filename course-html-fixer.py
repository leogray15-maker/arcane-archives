#!/usr/bin/env python3
import os
import re
import sys

# directory that holds all your course html files
COURSES_ROOT = sys.argv[1] if len(sys.argv) > 1 else "./The Arcane Archives"

def fix_file(path: str):
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()

    original = html

    # --- 1) Fix existing "Back" buttons so they point to archives.html ---
    def fix_back_link(match):
        tag = match.group(0)
        # replace any href="..." inside this tag with archives.html
        tag = re.sub(r'href="[^"]*"', 'href="../archives.html"', tag)
        return tag

    html = re.sub(
        r'<a[^>]*>[^<]*back[^<]*</a>',
        fix_back_link,
        html,
        flags=re.IGNORECASE
    )

    # --- 2) Turn iframes back into plain links ---
    # <iframe src="URL"></iframe> → <p><a href="URL" target="_blank">URL</a></p>
    def iframe_to_link(match):
        src = match.group(1)
        return f'<p><a href="{src}" target="_blank" rel="noopener noreferrer">{src}</a></p>'

    html = re.sub(
        r'<iframe[^>]*src="([^"]+)"[^>]*></iframe>',
        iframe_to_link,
        html,
        flags=re.IGNORECASE,
    )

    if html != original:
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        print("fixed", path)


for dirpath, dirnames, filenames in os.walk(COURSES_ROOT):
    for name in filenames:
        if name.lower().endswith(".html"):
            fix_file(os.path.join(dirpath, name))

print("✅ Finished fixing course HTML")