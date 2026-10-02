# pdfcheck.py <file.pdf> <json-out>  — page count + text per page (pypdf), for the render harness.
import json, sys
from pypdf import PdfReader

r = PdfReader(sys.argv[1])
out = {"pages": len(r.pages), "text": []}
for p in r.pages:
    try:
        out["text"].append(p.extract_text() or "")
    except Exception as e:  # noqa
        out["text"].append("")
with open(sys.argv[2], "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False)
print(json.dumps({"pages": out["pages"]}))
