# Print / PDF sheets - fidelity checklist (approved mock vs real site)

Mock = `scratch/emp-models-build/print-kit.js` + `print-kit.css` (pages `employees.html`, `models.html`, `model-card.html`, print / download icons).
Real = `app/components/a5-print/` (+ the wiring in the employees list, models list, model card, orders list, customers list).
Status: `identical` / `adapted (why)`. No `missing`.

## Method (numeric, same document origin)
Temporary harness (a page under `app/` + the three mock pages copied to `public/_mock/`, both **deleted afterwards**): the mock page runs in a same-origin iframe next to the real page
(same DPR, no cross-tab flip). For each scenario the mock's own sheets (read from its `#pkvBox`) and the real sheets (real registry builder + real `buildSheets` on the
**same data**, mapped from the mock's rows) are rendered at zoom 1 in their own documents and walked element by element (`getBoundingClientRect` relative to the sheet +
23 computed-style properties). The real page had `.pk-sheet *{font-family:"Segoe UI"...!important}` injected for the comparison only (the mock lays out in Segoe UI; the real
site ships Rubik) and the header context (gm name / address / phone / user) was set equal to the mock's.

| scenario | data | mock sheets (rows incl. group rows) | real sheets | rect diffs > 0.6px | style diffs |
|---|---|---|---|---|---|
| employees, all 128 | sort name | 6: 25,25,25,25,25,14 | 6: 25,25,25,25,25,14 | 0 | 0 |
| employees, all 128 | sort by department | 6: 25,25,24,25,25,14 | same | 0 | 0 |
| employees, active 73 | default filter | 4: 25,26,26,5 | same | 0 (the filter line text is not passed by the harness, see below) | 0 |
| models, default 242 | active | 10: 25 x9, 18 | same | 0 (same note) | 0 |
| models, all 312 | no filter | 13: 25 x12, 13 | same | 0 | 9 = `border-bottom-color` of the totals row (width 0, invisible) |
| model card | seeded mock model, 12 items, 9 rentals | 2 sheets | 2 | 0 | 0 |
| items list | same | 1 | 1 | 0 | 0 |
| rentals list | same | 1 | 1 | 0 | 0 |
| barcode labels | same | 1 | 1 | 1 (the hidden address `<span>` of the slim header, `display:none`) | 0 |

With Rubik (no override) the page counts / rows per sheet are unchanged (employees 128 -> 6 sheets, models 312 -> 13): row height is fixed by font-size + padding, not by glyph widths.
The only text difference in every sheet is the footer clock (`הופק מהמערכת · HH:MM`), by design.
The "active 73" / "default 242" rows differ from the mock only by the `.pk-sub` filter line ("פעילים") because the harness passed an empty filter definition; the filter-line logic itself is covered by
`scripts/test_a5_print_specs.mjs` (identical algorithm to `PK.filterLine`).

## Overlay (`#pkv`) - measured against the mock overlay at the same viewport
Bar, title / count, tone switch, zoom controls, primary button, scroll area, sheet boxes: **identical** (all `x/y/w/h` within 1px after normalising the 200px viewport difference of the iframe; all
colours, borders, radii, paddings, min-heights equal). Differences, all intentional:
* font: Rubik first (the other new print pages use Rubik), then the mock's stack (adapted, per the brief);
* `z-index` 20000 instead of 3000 (legacy site layers go up to 10000);
* the extra "הורדה כ-PDF" / "הדפסה" button (server PDF + browser print are both offered), and the mock's demo hint ("באתר האמיתי הקובץ ייווצר בשרת") is replaced by a status line that only appears
  after a download / fallback;
* `#pkv button{font-family:inherit!important}` (globals.css forces `Assistant` on every button).

## Element checklist
| element / state of the mock | status |
|---|---|
| full-screen dark navy overlay, gold bottom border on the bar, real A4 sheets (794x1123 css px = 210mm x 296.5mm, measured 793.7 x 1120.6) with shadow, scrollable | identical |
| title (document name; in download mode the PDF file name `<name> · dd-mm-yyyy.pdf`), "N עמודים" / "עמוד אחד" | identical |
| tone switch "שחור-לבן" (default) / "צבע עדין", `aria-pressed` | identical |
| zoom − / % / + / "התאם", fit = width-based (cap 110%), < 560px wide = 100% | identical |
| primary button "הדפסה" (print mode) / "הורדה כ-PDF" (download mode) + the other one as secondary, "סגירה" | adapted (PDF button added) |
| Esc closes, click on the dark scrim closes, click on a sheet does not, Tab / Shift+Tab trapped, focus to the primary button, focus returned to the opener, page scroll locked while open | identical |
| sheet header: "בס״ד", gemach name (+ address · phone when set), Hebrew + Gregorian date, barcode only on the model card / items-style header | identical (name/address/phone/user come from `/api/settings`, `/api/me`) |
| title bar: chip, title, filter line (only when a filter / search is active), count once | identical |
| footer: "הופק מהמערכת · HH:MM · הדפיסה: <user>", "עמוד X מתוך Y" | identical |
| table header repeats on every sheet, group rows with "(המשך)" on continuation, group heading never last on a sheet, totals row never alone | identical (engine = same algorithm; node test `scripts/test_a5_print_pagination.mjs`) |
| employees: dept as group row, no dept column, status column only when mixed, code / name / phone / email / last entry, count once | identical |
| models: code, name, entry date, items / not-in-use / reserve / repair / rentals, zero = "—", one totals row (sums only), status column only when mixed | identical |
| model card: title once, code once (header barcode), identity block, non-zero inventory chips ("זמינים" only when different from total), items by size with status column only when needed, rentals of the last 12 months, notes; no change log / image / UI state | identical |
| items list, rentals list (from the tab with the tab's filter line, from the menu with "ב-12 החודשים האחרונים"), labels 18 per sheet (3x6, 60 x 39.6mm, slim header) | identical |
| `@media print`: only the sheets print, `@page` A4 margin 0, fixed colours, no theme variables | adapted (see notes: injected only while printing, scoped to `html.pk-printing`) |
| fonts | adapted (Rubik first) |
| orders list / customers list sheets (not in the mock - `print-specs.md`) | new, same engine / CSS; node-tested |

## Real-site leaks found and fixed (the reason for the numeric comparison)
1. `globals.css` `div:has(> table){max-height:75vh;overflow-y:auto}` squeezed `.pk-body` to 75% of the viewport height -> 19 rows per sheet instead of 25 and 8 sheets instead of 6. Fixed: `.pk-body{max-height:none}`.
2. `globals.css` `table thead tr th{position:sticky;background;border-bottom;box-shadow;z-index !important}` + `table thead th{color !important}` + `table tbody td{border-bottom-color:var(--divider) !important}`: header cells took theme colours. Fixed with `!important` (higher specificity) on the sheet's own th / td rules.
3. `globals.css` button font (`Assistant`) on the overlay buttons. Fixed (`font-family:inherit!important` inside `#pkv`).
4. The sheet was `content-box` in a bare document (the mock inherited `*{box-sizing:border-box}` from its page): in the server PDF every sheet became 315mm tall and printed on two pages. Fixed: `.pk-sheet{box-sizing:border-box}`.

## Verification of the print / PDF paths
* Browser print path: opened a 70-row preview in headless Chrome against the dev server (minted session), ran the real `#pkvPrint` handler (state `html.pk-printing` + injected `@media print` / `@page` rules kept), `page.pdf()` -> **3 sheets = 3 PDF pages**. CSSOM check in the dev browser: rules `@page{size:A4;margin:0}` + `@media print` list; with the class set only `#pk-host` survives among the 30 `body` children, `#pkv` is hidden, `#pkPrint` shown; afterprint removes class, style and the copied sheets.
* Server PDF (`POST /api/pdf`, html mode + `surface`): 3 sheets -> 3 A4 pages (594.96 x 841.92pt); 60 employees -> 3 sheets / 227KB; Hebrew file name OK (see notes, header bug fixed).
* Mobile (390px): bar wraps, zoom 100%, sheet scrolls horizontally inside the preview as in the mock, no page-level horizontal scroll.
