# ppg3-pdftail.py <in.pdf> <marker> — for every page except the last: is the LAST body line (just above the "הופק מהמערכת" footer)
# a group-title row (contains <marker>)? A title stranded at the bottom of a page means break-after:avoid did not hold.
import json, sys
import fitz

doc = fitz.open(sys.argv[1])
marker = sys.argv[2]
out = []
for pi, page in enumerate(doc):
    blocks = [(b[1], b[3], b[4]) for b in page.get_text("blocks") if b[4].strip()]
    foot = [b for b in blocks if "הופק" in b[2] or "מערכת" in b[2]]
    foot_y = min((b[0] for b in foot), default=page.rect.height)
    body = [b for b in blocks if b[1] <= foot_y + 0.5 and b not in foot]
    body.sort(key=lambda b: b[1])
    last = body[-1][2].strip().replace("\n", " ") if body else ""
    out.append({"page": pi + 1, "stranded": bool(pi < len(doc) - 1 and marker in last), "last": last[:60]})
print(json.dumps({"pages": out}, ensure_ascii=True))
