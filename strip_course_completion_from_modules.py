from pathlib import Path
import re

ROOT = Path(__file__).parent / "notion-export-clean"

SNIPPET_PATTERN = re.compile(
    r'<div id="courseCompletionContainer"></div>\s*'
    r'<script type="module">\s*'
    r'import\s+\{\s*autoInitCourseCompletion\s*\}\s+from\s+[\'"]/course-completion\.js[\'"];\s*'
    r'autoInitCourseCompletion\(\);\s*'
    r'</script>',
    re.DOTALL
)

def is_module_page(html: str) -> bool:
    # We only treat as "module page" if it uses the module tracker
    return "initModuleTracker(" in html

def process_file(path: Path) -> bool:
    html = path.read_text(encoding="utf-8")
    if not is_module_page(html):
        return False  # likely a course index or something else

    new_html, count = SNIPPET_PATTERN.subn("", html)
    if count == 0:
        return False

    path.write_text(new_html, encoding="utf-8")
    print(f"Cleaned courseCompletion block from: {path}")
    return True

def main():
    updated = 0
    for p in ROOT.rglob("*.html"):
        if process_file(p):
            updated += 1
    print(f"\nDone. Updated {updated} module page(s).")

if __name__ == "__main__":
    main()
