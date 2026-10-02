# pdf2png.py <file.pdf> <out-prefix> [zoom] — renders every PDF page to PNG (PyMuPDF), for visual checks of the print harness.
import sys, fitz
doc = fitz.open(sys.argv[1])
z = float(sys.argv[3]) if len(sys.argv) > 3 else 1.2
for i, p in enumerate(doc):
    p.get_pixmap(matrix=fitz.Matrix(z, z)).save(f"{sys.argv[2]}-p{i+1}.png")
print(len(doc), "pages")
