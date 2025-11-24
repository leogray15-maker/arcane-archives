from pathlib import Path
import json
import re

ROOT = Path(__file__).parent
EXPORT_ROOT = ROOT / "notion-export-clean" / "The Arcane Archives"


def slugify(name):
    """Turn a course folder name into a simple slug."""
    name = name.strip().lower()
    name = re.sub(r"[^a-z0-9]+", "-", name)
    return re.sub(r"-+", "-", name).strip("-")


def extract_module_id(html):
    """
    Find the moduleId passed into initModuleTracker('...') in the html.
    Returns the id string or None if not found.
    """
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
            # Not a module page (no initModuleTracker call)
            continue

        # Course directory = folder directly under "The Arcane Archives"
        try:
            rel_parts = path.relative_to(EXPORT_ROOT).parts
        except Exception:
            continue

        if not rel_parts:
            continue

        course_name = rel_parts[0]
        course_id = slugify(course_name)

        if course_id not in index:
            index[course_id] = {
                "name": course_name,
                "modules": []
            }

        # Avoid duplicate module entries
        existing_ids = {m["id"] for m in index[course_id]["modules"]}
        if module_id not in existing_ids:
            index[course_id]["modules"].append({"id": module_id})

    out_path = ROOT / "course-index.json"
    out_path.write_text(json.dumps(index, indent=2), encoding="utf-8")
    print(f"Wrote course-index.json with {len(index)} courses at {out_path}")


if __name__ == "__main__":
    main()
