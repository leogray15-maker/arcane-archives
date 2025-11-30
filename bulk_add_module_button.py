from pathlib import Path
import re

# Adjust if your exports live somewhere else
ROOT = Path(__file__).parent / "notion-export-clean"

CSS_SNIPPET = """
/* ==== Arcane Archives – Complete Module pill ==== */
.aa-module-actions {
  margin: 12px 0 8px;
  display: flex;
  justify-content: flex-end;
}

.aa-pill-button {
  padding: 8px 18px;
  border-radius: 999px;
  border: 1px solid rgba(216, 180, 254, 0.6);
  background: linear-gradient(135deg, #7c3aed, #a855f7);
  color: #f9f5ff;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 0 20px rgba(168, 85, 247, 0.6);
  transition: transform 0.08s ease, box-shadow 0.08s ease, opacity 0.12s ease;
}

.aa-pill-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 0 28px rgba(168, 85, 247, 0.9);
}

.aa-pill-button:disabled {
  opacity: 0.65;
  cursor: default;
  box-shadow: none;
}
"""

BUTTON_TEMPLATE = """
<div class="aa-module-actions">
  <button id="complete-module-btn"
          class="aa-pill-button"
          data-module-id="{module_id}">
    ✅ Complete Module
  </button>
</div>
"""


def process_file(path: Path):
  html = path.read_text(encoding="utf-8")

  # Only touch real module pages that call initModuleTracker
  if "initModuleTracker(" not in html:
    return False

  # Already processed? (button exists)
  if "complete-module-btn" in html:
    return False

  # --- 1) Find module id from existing script ---
  m = re.search(r"initModuleTracker\(['\\\"]([^'\\\"]+)['\\\"]\)", html)
  if m:
    module_id = m.group(1)
  else:
    # Fallback: use filename
    module_id = path.stem

  # --- 2) Inject CSS snippet once into <style> ---
  if "aa-pill-button" not in html:
    if "</style>" in html:
      html = html.replace("</style>", CSS_SNIPPET + "\n</style>", 1)
    else:
      # No style block? add one in <head>
      html = html.replace(
        "</head>",
        f"<style>{CSS_SNIPPET}</style>\n</head>",
        1
      )

  # --- 3) Insert button right after </header> inside <article> ---
  header_pos = html.find("</header>")
  if header_pos == -1:
    return False

  insert_pos = header_pos + len("</header>")
  button_html = BUTTON_TEMPLATE.format(module_id=module_id)
  html = html[:insert_pos] + button_html + html[insert_pos:]

  # --- 4) Normalise module tracker import & call ---
  # import path
  html = re.sub(
    r"import\s+\{\s*initModuleTracker\s*\}\s+from\s+['\\\"][^'\\\"]+['\\\"];",
    "<!-- XP System Scripts -->
<script type="module" src="/course-module-tracker.js"></script>
<script type="module" src="/xp-module-listener.js"></script> from '/course-module-tracker.js';",
    html
  )

  # call with the correct module id
  html = re.sub(
    r"initModuleTracker\(['\\\"][^'\\\"]+['\\\"]\);",
    f"initModuleTracker('{module_id}');",
    html
  )

  path.write_text(html, encoding="utf-8")
  print("Updated:", path)
  return True


def main():
  updated_count = 0
  for html_file in ROOT.rglob("*.html"):
    if process_file(html_file):
      updated_count += 1

  print(f"\nDone. Updated {updated_count} module page(s).")


if __name__ == "__main__":
  main()
