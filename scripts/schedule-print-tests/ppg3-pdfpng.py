# ppg3-pdfpng.py <in.pdf> <out-prefix> [max-pages]  — renders the printed PDF pages to PNG (PyMuPDF) as evidence of what the printer gets.
import sys
import fitz

doc = fitz.open(sys.argv[1])
n = min(len(doc), int(sys.argv[3]) if len(sys.argv) > 3 else 3)
for i in range(n):
    doc[i].get_pixmap(dpi=80).save(f"{sys.argv[2]}-{i + 1}.png")
print(n)
