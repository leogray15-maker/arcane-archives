#!/usr/bin/env python3
import os
import re

ARCHIVES_ROOT = "notion-export-clean/The Arcane Archives"
ARCHIVES_INDEX = "archives.html"

SNIPPET = '''
<script type="module">
  import { protectPage } from "/auth-guard.js";
  protectPage({
    onFailure: () => {
      window.location.href = "/login.html";
    }
  });
</script>
'''.strip()


def protect_file(path: str):
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()

    # already protected?
    if "auth-guard.js" in html or "protectPage(" in html:
        return False

    # insert before </body>, or append if missing
    if re.search(r"</body>", html, flags=re.IGNORECASE):
        html = re.sub(
            r"</body>",
            SNIPPET + "\n</body>",
            html,
            count=1,
            flags=re.IGNORECASE,
        )
    else:
        html = html + "\n" + SNIPPET

    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    print("🔒 protected:", path)
    return True


def main():
    changed = 0

    # protect archives.html
    if os.path.isfile(ARCHIVES_INDEX):
        if protect_file(ARCHIVES_INDEX):
            changed += 1

    # protect every course page under archives root
    if os.path.isdir(ARCHIVES_ROOT):
        for root, _, files in os.walk(ARCHIVES_ROOT):
            for name in files:
                if not name.lower().endswith(".html"):
                    continue
                path = os.path.join(root, name)
                if protect_file(path):
                    changed += 1

    print(f"✅ Done. Files updated: {changed}")


if __name__ == "__main__":
    main()
