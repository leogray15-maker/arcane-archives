#!/usr/bin/env python3
import os
import re
import sys

# Default to your Notion course folder
COURSES_ROOT = sys.argv[1] if len(sys.argv) > 1 else "notion-export-clean/The Arcane Archives"

def fix_file(path: str):
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()

    original = html

    # 1) Inject Arcane course stylesheet (root-absolute so it works in any folder)
    if "/arcane-course-style.css" not in html:
        # insert just before </head>
        html, count = re.subn(
            r"</head>",
            '  <link rel="stylesheet" href="/arcane-course-style.css">\n</head>',
            html,
            count=1,
            flags=re.IGNORECASE,
        )
        if count == 0:
            # no </head> (weird export) – stick it at the top instead
            html = '<link rel="stylesheet" href="/arcane-course-style.css">\n' + html

    # 2) Convert iframes -> normal links
    # <iframe src="URL"></iframe> -> <p><a href="URL">URL</a></p>
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


for dirpath, _, filenames in os.walk(COURSES_ROOT):
    for name in filenames:
        if not name.lower().endswith(".html"):
            continue
        fix_file(os.path.join(dirpath, name))

print("✅ Finished: styles injected + iframes converted to links")
