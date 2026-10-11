# Independent fidelity / behaviour review 2 - departments, email log, data history, query history (2026-10-11)

Reviewer: independent agent (separate from the authors; the authors' fidelity docs were not used as evidence).
Scope: `/admin/departments`, `/admin/site-settings/email-logs`, `/admin/data-history`, `/management/history` (new design, programmer user, TEST DB, dev server :3073).
Question under test: do the four new screens keep the approved A5 list concept (same as employees / models / orders / customers lists) with no omitted or changed design details, and do they behave correctly.
The security audit is a separate track (`security-audit.md`) and is not repeated here.

## Method (re-measured, not trusted)
* Reference = the approved lists already on the site: `/admin/orders-list` (full set of states), plus `/employees`, `/dashboard/dresses`, `/admin/customers-list`. A script injected through `javascript_tool` saved, for each page and each state, the `getBoundingClientRect` + computed style of the key elements (filter trigger and popup, option rows, sort popup, row, expanded detail and its action buttons, table header / cells, empty state, variant toggle) into localStorage; a diff then listed every element whose rect/style differs from the orders-list baseline (> 0.6px).
* States compared at 1440x900: filter popup open, sort popup open, expanded row, table view, empty state (real "no results", not the loading state). Header / card / results-bar / row geometry also at 1920x1000. Overflow, popup and dialog geometry at 390x800.
* Behaviour driven by script on every screen: page 2 and back, sort option + direction flip, filter option + "all" clear + badge, search with hits / highlight marks / no hits + clear, expand arrow, table/list switch, print preview (email, data history), manage-records dialog and PIN dialog (query history), create dialog (departments), Escape and scrim close, focus return, legacy/new switch (departments set to `legacy` and back to `a5`, verified both render, left on `a5`).
* Date scan: every text of list, expanded detail and table scanned for a Gregorian date (regex) - none found on any screen (all dates are Hebrew).
* Severity: **blocker** = visible defect or omitted/changed element; **minor**; **justified** = deliberate (listed so the owner can veto).

## Result in one paragraph
Header, search slot, results bar, rows (113px), card, pager and popups are numerically identical to the approved lists at 1440 and 1920 on all four screens (title right edge 1493, back button 1507, search x955/w596, card x359/w1192, bar x389/w1132 - the same numbers as orders / customers / employees / models). Two real defects were found and **fixed** (print sheet broken by an HTML error body; long addresses / paths overflowing the row on a phone). Everything else is content-driven or justified.

## Findings

| # | Sev | Screen | What | Status |
|---|---|---|---|---|
| R1 | **blocker** | email log - print / PDF | Failed mails whose error is a whole HTML page (Apps Script / Google error page, 3-8K chars) were printed in full in the "failure reason" column: one row 1968px tall, rows overflowing the A4 sheet (6 sheets, overflowing rows; measured). | **FIXED** `emailLogsLogic.js` `shortReason()` (strips script/style/tags, collapses whitespace, cuts at 140 chars + "…") used only by the print/PDF sheet. Excel export and the expanded row keep the full text. Re-measured: 3 sheets, 0 overflowing rows, max row 109px. |
| R2 | **blocker** (clipping) | email log - expanded row | The same HTML error opened in the detail row was 1546px tall (pushed the action buttons off screen). | **FIXED** `email-logs.css` `.el-err{display:block;max-height:140px;overflow:auto;direction:ltr}` - scrolls inside the row. |
| R3 | **blocker** (phone) | email log, query history (390px) | Row title that has no break opportunity (`test@example.com`, `/api/dev/switch-env`) ran 196px wide in a 167px text column and spilled over the left edge / chevron; 47 of 50 rows on each screen (measured with Range rects). | **FIXED** `overflow-wrap:anywhere` on `.hres .li .t b` (email-logs.css scoped `.gm-eml`, history-lists.css scoped `.a5l`). Re-measured: 0 overflowing titles on both; data history 0 (Hebrew titles). |
| R4 | minor | all four at 1440, table view | The table is wider than the 1130px card on 3 of 4 screens and scrolls inside `.tblw`: email 1223px, query history 1169px, data history 1482px (in the TEST DB the AI-agent actor name is 328px wide and the "change" column is capped at 440px). Departments fits. The reference employees table also scrolls (1175px), so this is the accepted pattern; first (time) column stays visible in RTL. | open - owner's call (could cap the actor column with an ellipsis; not done, to avoid changing the shared table CSS) |
| R5 | minor | data history / email - print | Printing an unfiltered log: data history builds 187 sheets (5000 rows, the shared EXPORT_MAX) and blocks the main thread for ~60s while building; email builds 3. Same cap and warning toast as orders / customers ("first 5000 of N, narrow the filter"). | justified (consistent with the other lists); suggest a lower cap for the history log if the owner prefers |
| R6 | minor | query history - search | Searching a nonsense term returns rows: the log records the request that carries the term (`requestQuery` is searchable, as in the legacy page), so a "no results" state cannot be produced there. All other screens show the empty state correctly. | justified (legacy behaviour) |
| R7 | minor | data history - search | A hit on a changed value (e.g. "טלפון") shows 0 highlight marks because the matched text (old / new value) is inside the collapsed detail, not in the visible row line. | justified (search covers change details, stated in the placeholder) |
| R8 | justified | expanded row buttons | Employees / query history use a non-primary first button (`btn sm`, pale gold), models / orders / email / data history / departments use `btn primary sm` (gold). Matches the approved mocks (primary for the "open card" action, plain for destructive "delete record"). | none |
| R9 | justified | filter popup | Option lists, group headers, counts and default-checked options differ per screen (content); trigger button 122 -> 156px when a count badge shows; departments popup is 10px wider because it has no scrollbar. Hidden zero-count options are hidden as in orders. | none |
| R10 | justified | variant toggle | Gold swap icon beside the title on all four (owner rule); departments verified both ways (`legacy` shows the old page, `a5` the new one). | none |
| R11 | justified | mobile 390 | `innerWidth` 397 vs `clientWidth` 390 (7px) on every page including the references: emulation artefact, no horizontal page scroll. Create dialog is a bottom sheet (`gm-dlgSheet`, shared design-system behaviour; its slide-in is frozen in a hidden pane so it measured off-screen). | none |

## What was verified OK (numbers in the method above)
* Filter popup, sort popup, expanded row, table header/cells, empty state: no style difference against orders-list except the content/justified items R8-R9 (one grey-border width reading of 0.8px vs 1px appears only for `/employees`, which is outside this scope and was not investigated).
* Empty states (icon, bold text, "reset search and filter" button) identical on departments, email, data history; employees / customers / models / orders as reference.
* Behaviour: paging (email 2 pages, data history 70, query history 800+), sort + direction flip, filter + clear, search (email "example" 3 rows / 3 marks, "gmail" 48 / 48, "zzzqq" empty and clear back to 54; data history; query history "orders"), all produce a changed, consistent list and count.
* Dialogs: Escape closes (focus returns to the opener, a real click was needed - synthetic events do not reach the key handler), clicking the scrim closes, Tab is trapped, first field focused (department name, PIN field, first button of the manage dialog). Manage-records: select mode shows 50 checkboxes, "delete selected (0)" disabled until one is ticked; "older than 90 days" opens the PIN dialog with a single password field (`autocomplete=new-password`). No `alert` / `confirm` use.
* Departments: system roles 1 and 2 have the delete button disabled with tooltip; employee names listed per department; create dialog proposes the next number.
* Print preview opens for email and data history; sheets are grouped by Hebrew day.
* Unit / contract scripts re-run after the fixes: `test_a5_email_logs` 27, `test_a5_departments` 14, `test_a5_history_lists` 34, `test_a5_list_header` 5, `test_a5_staff_models_security` 79, `test_ui_variant` 49, `test_page_variant_switch` 35, `test_a5_floating_windows` 8 - all pass.

## Files changed by this review (CSS / markup-level only)
* `app/components/email-logs/emailLogsLogic.js` - `shortReason()` + print sheet uses it.
* `app/components/email-logs/email-logs.css` - `.el-err` clamp, row-title wrap.
* `app/components/history-lists/history-lists.css` - row-title wrap.
The measuring helper `public/_rv_m.js` used during the review was deleted (not part of the change).

## Not covered
Legacy pages' pixel appearance, tablet width, dark palette variants, real (non-TEST) data volumes, API/server hardening (security auditor), and the shared `/employees` 0.8px border reading.
