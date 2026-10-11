# Print preview + PDF download (a5-print) - notes

Owner: print / PDF agent (11.10.2026). Source of truth for the look: `scratch/emp-models-build/print-kit.js|css` (approved mock). Fidelity numbers: `print-fidelity.md`.

## What exists
`app/components/a5-print/`
| file | role |
|---|---|
| `pkCore.js` | **pure** (no DOM / React / alias, node-importable): `shell` (one A4 sheet), `table` atoms (row / group / total), `block`, `heading`, `paginate` (the pagination engine over an injected adapter), `filterLine`, `bc` / `bcCell` (Code 39 SVG), `plural`, `fixN` |
| `pkSpecs.js` | **pure** document builders: `employeesListDoc`, `modelsListDoc`, `modelCardDoc`, `modelItemsDoc`, `modelRentalsDoc`, `modelLabelsDoc`, `ordersListDoc`, `customersListDoc` (+ `deptOrder`, `itemAtoms`, `rentAtoms`, `rentWindow`, `money`). Input = on-screen data, output = `{kind:'flow', head, atoms}` / `{kind:'pages', pages}` / `{empty}` |
| `pkRegistry.js` | `PRINT_DOCS = { id: { build, surface } }` - **adding a screen = one builder + one line here + one surface in `lib/printAccessKeys.js`** |
| `pkCss.js` | `SHEET_CSS` (the `.pk-*` sheet rules), `PRINT_CSS` (`@page` + `@media print`), `PDF_DOC_CSS` - strings, so the preview, the measurement, the browser print and the server PDF use byte-identical CSS |
| `a5-print.css` | the dark overlay (`#pkv ...`), `#pkMeasure`, `#pkPrint` |
| `pkDom.js` / `pkContext.js` | DOM adapter for `paginate` (measures the real layout in a hidden `#pkMeasure` sheet), font wait, header context (gm name / address / phone from `/api/settings`, user from `/api/me`, Israel date, Hebrew formatters) |
| `PrintPreview.js` / `openPrintPreview.js` / `runPrint.js` | the overlay (React), the imperative entry `openPrintPreview({doc, kind, data, say})` (own React root on `document.body > #pk-host`, independent of the screen's dialog context), and the lazy wrapper pages call: `runPrint({ doc, kind: 'print'|'download', data, say })` |
| `pkPdf.js` | builds the standalone HTML and posts it to `/api/pdf` |

Wiring: employees list + models list (`exportSpec.onPrint / onDownload`, Excel stays `runListExport`), model card (`dcPrint.js` `registerDressDoc` handlers for card / items / rentals / labels x print / download; the topbar download icon = card PDF; the items and rentals tab icons pass the tab's rows + filter state), orders list + customers list (one `runPrint` line after Agent O's `EXPORT_HOOK`). `EXPORT_HOOK` was removed from the employees / models lists (replaced by the direct hooks); it still exists, unused by me, in the orders / customers lists.
Tests: `scripts/test_a5_print_pagination.mjs` (15), `scripts/test_a5_print_specs.mjs` (28, incl. the registry-vs-server surface manifest).

## Decisions
1. **PDF = the browser's sheets, rendered by the existing server Chromium in `html` mode - not new `/print/*` routes.** Reason: pagination is a measurement of real layout, so the browser already holds the exact sheets; a print route would have to re-fetch the data and re-run the engine (and the filtered / sorted / AI-search rows, the 12-month rentals window and the tab's filter state only exist in the client). A "short-lived server-side payload" does not work on serverless (no shared memory), and a query string would carry data. `html` mode is the same mechanism the customer-history PDF already uses (JS disabled, network blocked except Google Fonts, 3MB cap), so the PDF is byte-for-byte the previewed sheets. Gate = the new `surface` parameter: `POST /api/pdf {html, surface, filename}`; `lib/printAccessKeys.js` `PDF_HTML_SURFACE_KEYS` maps each surface to its page permission (`a5-employees-list` -> `page:employees`, `a5-models-list` / `a5-model-card` -> `page:dresses_catalog`, `a5-orders-list` -> `page:admin_orders_list`, `a5-customers-list` -> `page:admin_customers_list`); `lib/printAccess.js` `pdfHtmlSurfaceKeys()` (own-property lookup only); unknown surface = 400; no `surface` = the old order/customer gate, unchanged. A new designed document **must** be added to `PDF_HTML_SURFACE_KEYS` or its PDF is refused (the node test fails if the registry names a surface the server does not know).
2. **Rubik** is the sheet font (like `print/order`, `print/customer`...), listed before the mock's Segoe UI. The measurement waits for Rubik (`document.fonts.load`, max 2.5s). Page counts equal the mock's with either font.
3. **Printing never leaks into other prints.** The `@page` / `@media print` rules and the `html.pk-printing` class exist only between the click on "הדפסה" and `afterprint` (injected `<style id="pk-print-css">`). The mock's unconditional `@media print{body>*{display:none}}` would have blanked any other `window.print()` on a page that loaded the CSS.
4. **Group order in the employees sheet**: when the list is sorted by department - the list's order; otherwise by `roleId` ascending (head management first) then name. `roleId` was added to `employeeRow` (`employeesLogic.js`, additive). Departments are dynamic in the real data (the mock had a fixed array).
5. **Models list prints every filtered row** (client-paging mode: the kit hands the whole filtered + sorted list, not the page of 50). Verified with 51 rows on TEST (> 1 page) and 242 / 312 synthetic rows.
6. **History tab icons are unchanged** (`runListExport`): the owner's rules say the change log is not a printed document and the mock only prints card / items / rentals / labels.
7. The menu "רשימת השכרות" prints the last 12 months (like the mock); with none it says so ("לא היו השכרות ב-12 החודשים האחרונים") instead of printing an empty page; from the rentals tab it prints the tab's rows (all history, tab sort / filters).
8. Header: gemach name / address / phone from the `gmach_*` settings (blank address / phone omitted); "הדפיסה: <user>" omitted when `/api/me` fails; any fetch failure falls back to defaults - a header never blocks a print.
9. Errors: no `window.alert/confirm`. "nothing to print" = the screen's toast (`say`); PDF failure = a status line inside the overlay + automatic fallback to the browser's print dialog ("בוחרים שמירה כ-PDF").

## Bugs found on the way (fixed, shared files)
* `app/api/pdf/route.js`: a Hebrew `filename` made `new NextResponse` throw ("Cannot convert argument to a ByteString") **after** the 9s Chromium render, so every PDF with a Hebrew name returned 500. Now `Content-Disposition: inline; filename="<ascii>.pdf"; filename*=UTF-8''<encoded>`.
* `lib/pdf.js` + route: html mode always applied a 10mm page margin; designed A4 sheets need `margin:0` (new optional `margin` argument, passed only for `surface` requests).

## Security check (curl-equivalent, minted `auth_session` cookies for existing TEST employees, `POST /api/pdf`)
| surface | anonymous | secretary(4) | seamstress(3) | branch mgr(1) | head mgmt(0) | programmer(2) | deactivated head |
|---|---|---|---|---|---|---|---|
| a5-employees-list / a5-models-list / a5-model-card | 401 | 403 | 403 | 403 | 200 | 200 | 401 |
Unknown surface, `__proto__`, a number, `surface` with `path` (no html): 400. No `surface`: legacy gate unchanged (programmer 200). On TEST the dresses catalog default is closed for low roles (PROD has explicit rows), so low roles are refused there; on PROD whoever holds `page:dresses_catalog` can print / download the catalog and cards, exactly like the page. The orders / customers surfaces use the management pages' keys (not curl-tested with all roles; same code path).
Residual: because the HTML is built in the browser, a signed-in user with the page permission can ask the server to render **any** markup (JS off, network blocked) into a PDF - they cannot read anything they could not already read; the document is not a signed record.

## Limits / gotchas
* Server PDF is capped at 3MB of HTML (`MAX_HTML_LENGTH`): about 300 table sheets. Orders / customers lists export up to 10,000 rows (418 / 401 sheets): the preview and the browser print work, the server PDF answers 413 and the overlay falls back to the browser's print dialog with the reason shown. Raising the cap for `surface` requests is a one-line change if the owner wants it.
* In the Claude Browser pane `window.print()` blocks the page (a native dialog): tests stub it. In real browsers it behaves normally.
* `afterprint` is relied on to remove `html.pk-printing`; if a browser never fires it, reload restores the page (the class is never persisted).
* The measurement host is `#pkMeasure` (fixed, off-screen, `visibility:hidden`); the global `div:has(> table){max-height:75vh}` must stay neutralised in `.pk-body` (see fidelity doc) - any new global rule on `table` / `th` / `td` can leak into the sheets; re-run the numeric comparison after touching `globals.css` table rules.
* Mock harness recipe (to repeat the comparison): copy `employees.html` / `models.html` / `model-card.html` to `public/_mock/`, expose the real registry + `buildSheets` on `window` from a temporary page, load the mock in a same-origin iframe, read its sheets from `#pkvBox`, render both sets in their own documents at zoom 1 and diff rects + computed styles; delete both temporary pieces afterwards.

## Documentation points (for CLAUDE.md / owner docs)
* New print / PDF documents go through `a5-print` (spec builder + registry + `PDF_HTML_SURFACE_KEYS`); do not add an ad-hoc `window.open` print page for the new design.
* `POST /api/pdf` now also accepts `surface` (html mode); Hebrew file names are safe.
* Unverified here: Vercel serverless Chromium (the server PDF was verified only against the local Chrome of the dev machine; Rubik is fetched from Google Fonts inside the sandboxed page, as for the existing order PDFs); a real printer / the browser's own print preview UI (verified through `page.pdf()` with the same CSS state).
