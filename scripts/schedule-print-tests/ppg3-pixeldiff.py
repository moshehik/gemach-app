# ppg3-pixeldiff.py <design.png> <mine.png> <bottom-px>  — compares the head+body region (0..bottom) of the approved design sheet
# against the real template render of the same sample data; prints {"diffPct":..,"meanAbs":..,"size":[w,h]} as JSON.
import json, sys
from PIL import Image, ImageChops
import numpy as np

a = Image.open(sys.argv[1]).convert('L')
b = Image.open(sys.argv[2]).convert('L')
bottom = int(sys.argv[3])
w = min(a.width, b.width)
h = min(bottom, a.height, b.height)
a = a.crop((0, 0, w, h)); b = b.crop((0, 0, w, h))
d = np.abs(np.asarray(a, dtype=np.int16) - np.asarray(b, dtype=np.int16))
# tolerance for sub-pixel anti-aliasing: a pixel "differs" when the grey level moves by more than 48
pct = float((d > 48).sum()) * 100.0 / d.size
if len(sys.argv) > 4:
    # red = only in the design, blue = only in the render, grey = same ink
    A = np.asarray(a); B = np.asarray(b)
    img = np.stack([np.where(A < 128, 255, 255) * 0 + 255, np.zeros_like(A) + 255, np.zeros_like(A) + 255], axis=-1).astype(np.uint8)
    both = (A < 128) & (B < 128); onlyA = (A < 128) & ~(B < 128); onlyB = ~(A < 128) & (B < 128)
    img[both] = [150, 150, 150]; img[onlyA] = [230, 30, 30]; img[onlyB] = [30, 60, 230]
    Image.fromarray(img).save(sys.argv[4])
print(json.dumps({"diffPct": round(pct, 2), "meanAbs": round(float(d.mean()), 2), "size": [w, h], "designSize": [Image.open(sys.argv[1]).width, Image.open(sys.argv[1]).height], "mineSize": [Image.open(sys.argv[2]).width, Image.open(sys.argv[2]).height]}))
