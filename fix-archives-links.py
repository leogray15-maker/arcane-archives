#!/usr/bin/env python3
import re

path = "archives.html"

with open(path, "r", encoding="utf-8") as f:
    html = f.read()

original = html

def rewrite_href(match):
    url = match.group(1)

    # Don't touch absolute or root links
    if url.startswith("http") or url.startswith("/"):
        return match.group(0)

    # Don't touch the footer / other non-course pages
    skip = {
        "index.html",
        "dashboard.html",
        "Privacy-policy.html",
        "terms-of-service.html",
        "refund-policy.html",
    }
    if url in skip:
        return match.group(0)

    # Already prefixed? leave it
    if url.startswith("The%20Arcane%20Archives/"):
        return match.group(0)

    # Otherwise, treat it as a course file inside "The Arcane Archives"
    return f'href="The%20Arcane%20Archives/{url}"'

html = re.sub(r'href="([^"]+)"', rewrite_href, html)

if html != original:
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    print("✅ archives.html course links updated")
else:
    print("ℹ️ archives.html was already pointing to the right place")
