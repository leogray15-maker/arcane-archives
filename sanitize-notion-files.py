#!/usr/bin/env python3
import os
import sys

# characters Netlify tends to hate in file paths
DISALLOWED_CHARS = ['#', '\n', '\r']

def sanitize_name(name: str) -> str:
    new = name
    for ch in DISALLOWED_CHARS:
        new = new.replace(ch, '')
    return new.strip()

def build_mappings(base_dir: str):
    """
    Walk base_dir, rename any files/dirs with disallowed chars.
    Returns a mapping: {old_name: new_name} for basenames.
    """
    mappings = {}

    for root, dirs, files in os.walk(base_dir, topdown=True):
        # fix directories first
        for i, d in enumerate(dirs):
            new_d = sanitize_name(d)
            if new_d != d:
                old_path = os.path.join(root, d)
                new_path = os.path.join(root, new_d)
                print(f"[dir] {old_path} -> {new_path}")
                os.rename(old_path, new_path)
                dirs[i] = new_d
                mappings[d] = new_d

        # then files
        for f in files:
            new_f = sanitize_name(f)
            if new_f != f:
                old_path = os.path.join(root, f)
                new_path = os.path.join(root, new_f)
                print(f"[file] {old_path} -> {new_path}")
                os.rename(old_path, new_path)
                mappings[f] = new_f

    return mappings

def update_html_links(base_dir: str, mappings: dict):
    """
    For every .html file under base_dir, replace old basenames with new ones.
    """
    if not mappings:
        print("No filenames changed, skipping HTML rewrite.")
        return

    for root, _, files in os.walk(base_dir):
        for f in files:
            if not f.lower().endswith(".html"):
                continue
            path = os.path.join(root, f)
            with open(path, "r", encoding="utf-8") as fh:
                html = fh.read()
            original = html
            for old_name, new_name in mappings.items():
                if old_name in html:
                    html = html.replace(old_name, new_name)
            if html != original:
                with open(path, "w", encoding="utf-8") as fh:
                    fh.write(html)
                print(f"[html] updated links in {path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 sanitize-notion-files.py <courses-root>")
        print("Example: python3 sanitize-notion-files.py 'notion-export-clean/The Arcane Archives'")
        sys.exit(1)

    base = sys.argv[1]
    if not os.path.isdir(base):
        print(f"Error: {base} is not a directory")
        sys.exit(1)

    print(f"🔍 Sanitizing filenames under: {base}")
    mapping = build_mappings(base)
    print("✅ Renaming complete. Now updating HTML links...")
    update_html_links(base, mapping)
    print("🎉 Done. You can now commit and deploy.")
