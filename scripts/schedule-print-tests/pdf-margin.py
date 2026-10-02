# pdf-margin.py <file.pdf> - the @page margins must be white paper on every page. A dark theme's color-scheme:dark makes Chrome paint
# the page margin area dark (html/body background does not reach it), which also hides the "עמוד X מתוך Y" margin-box counter.
# Samples a 6x6px block at each of the 4 page corners (zoom 0.5); prints {"pages": N, "dark": [[page, corner, lum], ...]}.
import sys, json, fitz
doc = fitz.open(sys.argv[1])
dark = []
for i, p in enumerate(doc):
    pix = p.get_pixmap(matrix=fitz.Matrix(0.5, 0.5))
    w, h = pix.width, pix.height
    for name, (x0, y0) in {'tl': (1, 1), 'tr': (w - 7, 1), 'bl': (1, h - 7), 'br': (w - 7, h - 7)}.items():
        vals = []
        for y in range(y0, y0 + 6):
            for x in range(x0, x0 + 6):
                c = pix.pixel(x, y)
                vals.append(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2])
        lum = sum(vals) / len(vals)
        if lum < 240:
            dark.append([i + 1, name, round(lum, 1)])
print(json.dumps({'pages': len(doc), 'dark': dark}))
