"""Apply exact text replacements inside demo/presentation.pptx (slides and speaker notes).

    python scripts/video/edit_pptx_text.py <replacements.json>

The JSON file is a list of [old, new] pairs; prefix both with "RAW:" to match raw XML instead of text. Every pair must match at least once,
otherwise the script stops, so a stale edit cannot pass silently.
"""

import json
import re
import shutil
import sys
import zipfile
from html import escape, unescape
from pathlib import Path

PPTX = Path(__file__).resolve().parents[2] / "demo" / "presentation.pptx"


def main(spec: str) -> None:
    pairs = json.loads(Path(spec).read_text(encoding="utf-8"))
    tmp = PPTX.with_suffix(".tmp")
    hits = {old: 0 for old, _ in pairs}
    with zipfile.ZipFile(PPTX) as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if re.match(r"ppt/(slides|notesSlides)/\w+\d+\.xml$", item.filename):
                text = data.decode("utf-8")
                for old, new in pairs:
                    raw = old.startswith("RAW:")
                    o = old[4:] if raw else escape(old, quote=False)
                    n = new[4:] if raw else escape(new, quote=False)
                    if o in text:
                        hits[old] += text.count(o)
                        text = text.replace(o, n)
                data = text.encode("utf-8")
            zout.writestr(item, data)
    missing = [o for o, c in hits.items() if c == 0]
    if missing:
        tmp.unlink()
        raise SystemExit(f"no match for: {missing}")
    shutil.move(tmp, PPTX)
    print({k[:40]: v for k, v in hits.items()})


if __name__ == "__main__":
    main(sys.argv[1])
