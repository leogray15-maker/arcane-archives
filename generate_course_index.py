from pathlib import Path
import json
import re

ROOT = Path(__file__).parent
EXPORT_ROOT = ROOT / "notion-export-clean" / "The Arcane Archives"

def slugify(name: str) -> str:
    name = name.strip().lower()
    name = re.sub(r"[^a-z0-9]+", "-", name)
    return re.sub(r"-+", "-", name).strip("-")

def extract_module_id(html: str) -> str | None:
    m = re.search(r"initModuleTracker\(['\"]([^'\"]+)['\"]\)", html)
    return m.group(1) if m else None

def main():
    index = {}

    for path in EXPORT_ROOT.rglob("*.html"):
        try:
            html = path.read_text(encoding="utf-8")
        except Exception:
            continue

        module_id = extract_module_id(html)
        if not module_id:
            continue  # not a real module page

        # Course directory = folder directly under "The Arcane Archives"
        try:
            course_name = path.relative_to(EXPORT_ROOT).parts[0]
        except Exception:
            continue

        course_id = slugify(course_name)

        if course_id not in index:
            index[course_id] = {
                "name": course_name,
                "modules": []
            }

        if module_id not in index[course_id]["modules"]:
            index[course_id]["modules"].append(module_id)

    out_path = ROOT / "course-index.json"
    out_path.write_text(json.dumps(index, indent=2), encoding="utf-8")
    print(f"Wrote course-index.json with {len(index)} courses at {out_path}")

if __name__ == "__main__":
    main()
