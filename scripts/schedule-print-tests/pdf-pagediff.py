# pdf-pagediff.py <a.pdf> <pageA> <b.pdf> <pageB> [zoom] — rasterises one page of each PDF (PyMuPDF) and prints the share of pixels
# that differ (grey level moves by more than 48) as JSON {"diffPct":..,"size":[w,h]}. Used by render.mjs "combined": a sheet printed
# inside the combined document must be pixel-identical to its standalone PDF page apart from the page number in the footer
# (same @page margins - also for the sticker pages' named page - same breaks, same fonts).
import json, sys
import fitz
import numpy as np

z = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0
def raster(path, page):
    doc = fitz.open(path)
    p = doc[int(page) - 1]
    pix = p.get_pixmap(matrix=fitz.Matrix(z, z), colorspace=fitz.csGRAY)
    return np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width)

a = raster(sys.argv[1], sys.argv[2])
b = raster(sys.argv[3], sys.argv[4])
h = min(a.shape[0], b.shape[0]); w = min(a.shape[1], b.shape[1])
d = np.abs(a[:h, :w].astype(np.int16) - b[:h, :w].astype(np.int16))
print(json.dumps({"diffPct": round(float((d > 48).sum()) * 100.0 / d.size, 3), "size": [int(w), int(h)], "sizeA": [int(a.shape[1]), int(a.shape[0])], "sizeB": [int(b.shape[1]), int(b.shape[0])]}))
