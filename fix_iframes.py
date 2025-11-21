from pathlib import Path
import re

root = Path("The Arcane Archives")

# Matches ANY <iframe ...>...</iframe> (multiline, any attributes)
iframe_re = re.compile(r"<iframe.*?</iframe>", re.IGNORECASE | re.DOTALL)

# Also clean up some common Notion embed wrappers if they exist
embed_figure_re = re.compile(
    r"<figure[^>]*class=[\"'][^\"']*embed[^\"']*[\"'][^>]*>.*?</figure>",
    re.IGNORECASE | re.DOTALL,
)

def clean_embeds(html: str):
    original = html

    # 1) Remove full embed <figure> blocks (if Notion wrapped them like that)
    html = embed_figure_re.sub("", html)

    # 2) Remove any leftover raw iframe tags
    html = iframe_re.sub("", html)

    changed = html != original
    return html, changed

changed_count = 0

for path in root.rglob("*.html"):
    text = path.read_text(encoding="utf-8", errors="ignore")
    new_text, changed = clean_embeds(text)

    if changed:
        path.write_text(new_text, encoding="utf-8")
        changed_count += 1
        print(f"Removed embeds in: {path}")

print(f"Done. Files changed: {changed_count}")
