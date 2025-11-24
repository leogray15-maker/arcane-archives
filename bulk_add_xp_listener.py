from pathlib import Path
import re

ROOT = Path(__file__).parent / "notion-export-clean"

SCRIPT_TAG = '<script type="module" src="/xp-module-listener.js"></script>'

def process_file(path: Path) -> bool:
    html = path.read_text(encoding="utf-8")

    # If script already exists, skip
    if SCRIPT_TAG in html:
        return False

    # Insert before </body>
    new_html, count = re.subn(
        r'</body>',
        f'    {SCRIPT_TAG}\n</body>',
        html,
        flags=re.IGNORECASE
    )

    if count > 0:
        path.write_text(new_html, encoding="utf-8")
        print(f"Injected listener into: {path}")
        return True
    return False

def main():
    updated = 0

    # All HTML files in Notion export
    for p in ROOT.rglob("*.html"):
        if process_file(p):
            updated += 1

    # Add to dashboard + archives manually if they’re outside export root
    EXTRA = [
        Path(__file__).parent / "dashboard.html",
        Path(__file__).parent / "archives.html",
        Path(__file__).parent / "index.html"
    ]

    for p in EXTRA:
        if p.exists() and process_file(p):
            updated += 1

    print(f"\nDone. Script tag added to {updated} pages.")

if __name__ == "__main__":
    main()
