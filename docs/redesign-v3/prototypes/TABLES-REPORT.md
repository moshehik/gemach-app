# TABLES-REPORT — table-screen prototypes (orders + customers)

> Autonomous run 2026-09-24 on branch `redesign/v3-proto-tables`, started from `origin/redesign/v3-protos-polish` at `144ddfa` (POLISH-DONE, shell `v1 sha:d7c2b5b7b88b`). Only files under `docs/redesign-v3/prototypes/` were added or changed. No app code, API, Prisma, data or settings were touched, and nothing was deployed.
> Everything marked **PASS** below comes from a command that was actually run on this branch (Playwright 1.63 + Chromium at `/opt/pw-browsers/chromium-1194`, Google Fonts blocked in the sandbox, so the fallback font was used). **not run** means not run.

## 1. What was delivered
| File | What |
|---|---|
| `TABLES-PATTERN.md` | The one table-screen pattern (anatomy, filters, sort, columns, one-chip rule, actions, paging, states, counts, export/print, keyboard/touch, phone card mode, wide screens, org variance, acceptance). |
| `tables/tables.css`, `tables/tables.js` | The shared table layer (`tp-*` classes + `TP` renderer). It sits on top of the shell and never restyles a shell selector. |
| `tools/build-tables.cjs` | Injects the table layer into every list prototype. It also copies the shell block into list files that `build-shell.cjs` does not know. `--check` fails on drift. |
| `tools/tables-check.cjs`, `tools/tables-flow.cjs` | Verification: generic pattern checks and page-specific flows. Results go to `tools/tables-results.json`. |
| `archetype-customers-list.html` | **New** prototype of `/customers`. |
| `archetype-list.html` | Orders list **rebuilt** on the same pattern. It replaces the page part of the polish pass's version; the shell block is unchanged and still maintained by `build-shell.cjs`. |
| `archetype-customers-list.contract.md` | New inventory of `/customers` (CL-1…CL-50), plus UI-only vs needs-data and declared changes CQ-1…5. |
| `archetype-list.contract.md` | Existing orders contract **re-verified against `main`**. New §יא: 9 corrections, drifted line references, 20 new items LI-68…LI-87, and the verified status values. |
| `TABLES-QUESTIONS.md` | T-Q1…T-Q22, each with the default applied. T-Q14 and T-Q18 differ from the polish pass (L-2, L-3). |
| `screenshots/tables/` | 18 check screenshots (4 widths × 2 pages; expanded, error, empty and smart-search at 1440; open phone card at 360) + 4 dialog screenshots at 390 + 9 flow screenshots. |

## 2. Results
| Check | How | Orders | Customers |
|---|---|---|---|
| Same shell block as all 7 archetypes | `node tools/build-shell.cjs --check` | PASS (`d7c2b5b7b88b`) | PASS (copied byte-identical by `build-tables.cjs`, verified by `--check`) |
| Same table layer in both lists | `node tools/build-tables.cjs --check` | PASS (`v1 sha:878f219c77cc`) | PASS (same) |
| **Parity with the sketch** (style + motion + one-field-per-line + overflow + static + contrast) | `node tools/parity-check.cjs --only=<file>` (the polish agent's tool) | PASS: style 18/17/15 PASS, 0 FAIL at 1440/1024/390; motion 9 PASS, 0 FAIL; fields PASS; overflow ok at 360/390/768/1024/1440; page `@media` bad = none; page physical = 0; contrast 0 below AA of 392 sampled; 0 page errors | PASS: style 15/14/14 PASS, 0 FAIL; motion 10 PASS, 0 FAIL; fields PASS; overflow ok; page `@media` bad = none; physical = 0; contrast 0 of 223; 0 errors |
| No page-level horizontal overflow at 360/768/1024/1440, default + "extreme" profile | `tables-check.cjs` (O) | PASS (8/8) | PASS (8/8) |
| Table never scrolls inside its box at 768/1024/1440 (default data) | `tables-check.cjs` (C) | PASS | PASS |
| ≤ 5 data columns at ≥1024; card mode below 640 | `tables-check.cjs` (C) | PASS (5 columns; cards at 360) | PASS (5 at ≥1024, 4 below 1024; cards at 360) |
| Chips: ≤1 `.tag` per row and per card, ≤1 tag column, 0 tags outside rows, no `.chip` class | `tables-check.cjs` (T), every width and every orders view | PASS in all 6 org-1 views (soon 50 rows, archive 49, deleted 8, unpaid 43, not_taken 50, all 50) and all widths | PASS (tags only on blocked customers) |
| Table header / cell / actions cell / footer / sort button / expanded-row paddings identical between the two screens | `tables-check.cjs` (P) | PASS: `th` 12/16, 14px 600, h=49 · `td` 16/16, 16px · actions 8/8/16 · footer 16px top · sort button fills `th` (12/16) · expanded row 24 | same |
| Only allowed breakpoints; logical properties only | `tables-check.cjs` (S) + parity static | PASS (page + table CSS: 0 bad widths, 0 physical) | PASS |
| Filter and export windows: one field per line, light window | `tables-check.cjs` (F) at 390 and 1440 | PASS (filter 9 fields, 0 overlaps) | PASS (filter 5 fields) |
| Interactions: sort flips `aria-sort`; expand (sketch `.3s` transition), Esc returns focus; row menu by keyboard; pager; error `role=alert` + retry; empty state + action; no-results names the search; smart search disables sort; phone card expands with the sketch `.det-wrap`; export above the limit asks for approval on the 2nd layer | `tables-check.cjs` (I) | PASS (all) | PASS (all; the customers page has no row menu) |
| Page flows | `tables-flow.cjs` | PASS (13 checks) | PASS (11 checks) |

Orders flows (PASS): org-1 views; one tag per row with payment as text; cart countdown and "לא נשמר" text; 3-month default shown as text + button; "לא שולם" note, no payment text and fixed sort; filter → 2 removable pills + count "2" on "סינון"; removing a pill re-queries; delete → confirm → toast and the row disappears; org 2 hides "לא נלקחו"; org 2 asks for the ID number before deleting (wrong ID → error, right ID → deleted); "extreme" shows "טיוטות", hides AI and the Gregorian line, and uses the long label; org 2 print window defaults to the prep report with no PDF button.
Customers flows (PASS): no views row, and "חסום" is the only tag; export lists the "קוד לקוח" column; two-word name search; search + filter combine with a pill; AI off hides the star and statistics buttons; the marketing-consent line appears for org 2 and not for org 1; a blocked customer's reason shows in the expanded row; the name header sorts by last name ascending; 0 JS errors.

**Not run / limits:** no axe or screen reader; no real device or touch hardware (touch checked only through layout at 360/390); no pixel diff (motion frames only by computed values); 1920 not measured (the container is capped at 1240, and 1440 was measured); no live DB (org profiles are demo values, **not** read from either gemach's settings); Hebrew web font not loaded (fallback font).

## 3. Honest deviations and open points
- **C-1.14 "at most 3 tags in one screen area":** every order has a real status, so a 50-row page shows up to ~12 tags in the viewport (one per row, one status column). This is the same open point as POLISH-QUESTIONS L-1, and T-Q1 records it. Customers show a tag only for blocked customers.
- **The shell's own top-bar breakpoints** (1180/1040/900) still appear as "shell @media bad" in the parity tool. This is a deviation the polish pass documented; it is not in the page or table CSS.
- **The orders list replaces the polish pass's list content.** The shell block is untouched. Two choices differ from POLISH-QUESTIONS: the row "עוד" menu is kept at ≥1024 (T-Q14 vs L-2), and the item-state filter stays in the filter window (T-Q18 vs L-3). The same actions and filters exist in both versions.
- **Behaviour changes waiting for a yes** (all UI-only; the same API calls): filters apply on "הצגת התוצאות" and go back to page 1 (T-Q3); a Gregorian date line (T-Q5); "חסום" in the list (T-Q6); AI buttons hidden when unavailable (T-Q11); export writes `legacyId` (T-Q12); sorting disabled in smart search (T-Q13).
- **Capacity search, the statistics window and rental/return** are only entry points in these prototypes; their own windows are designed separately. Stated in each window.

## 4. Traceability: every contract item → prototype
**Customers (CL):**
| Items | Where in `archetype-customers-list.html` |
|---|---|
| CL-1, CL-2, CL-3 | Page gate and API auth: server-side, no UI. Out of scope for a static prototype (no screen change). |
| CL-4, CL-5, CL-47 | AI buttons only when AI is available (demo checkbox "חיפוש חכם זמין"); the filter window's AI checkbox follows the same rule. |
| CL-6…CL-10, CL-12 | Simulated server with the same fields, search rules, sort and 50-row pages. The cache and prefetch have no UI, so they are shown as the "refresh" state (rows stay, loading line). |
| CL-11, CL-16 | No UI (cache warming / no auto-refresh). Out of scope; nothing to show. |
| CL-13, CL-14, CL-15 | Skeleton, refresh line, error notice + "לנסות שוב", three empty states (demo "שגיאת שרת", "אין לקוחות"). |
| CL-17 | Title count `(137)` = total. |
| CL-18, CL-29…CL-35 | "סינון" trigger → filter window (5 fields, 2 headings, one per line); pills + count; apply-on-button (CQ-2/T-Q3); "ניקוי השדות"; ✕/Esc closes without changes. |
| CL-19, CL-20, CL-49 | Export window (row count, Excel/print/smart report, approval above the limit, per-org limit 200/500/50); `legacyId` column (T-Q12). |
| CL-21 | "לקוח חדש" → toast naming `/customers/new` (the form is the customer-card prototype). |
| CL-22…CL-28 | `.hf-s` search on submit; clear; smart-search mode with a banner and paging; statistics entry. |
| CL-36…CL-41 | 5 columns (code, name, phone, city, status) + expanded row (second phone, e-mail, address, masked ID, consent, blocked reason); link on the code; row opens the card (UUID route); no row actions. |
| CL-42…CL-46 | Sort headers + phone sort select (last/first name, e-mail); sort disabled in smart search; pager; range text. |
| CL-48, CL-50 | Labels by profile (extreme = long labels); form settings do not affect the list (stated). |

**Orders (LI):**
| Items | Where in `archetype-list.html` |
|---|---|
| LI-1, LI-2, LI-3, LI-10, LI-11, LI-15, LI-86, LI-87 | Server, cache or global-event behaviour with no screen of its own. Out of scope (nothing to show); the refresh state stands in for LI-8/LI-10. |
| LI-4…LI-9, LI-12…LI-14, LI-16 | Simulated server with the same rules; skeleton, refresh, error, empty states; carts with a live timer go to the top. |
| LI-17…LI-22 | Title count; capacity (entry point), print window (6 report types, prep only with `enable_batch_print_prep`, PDF), export window (11 columns listed), "הזמנה חדשה". |
| LI-23…LI-30, LI-84 | Search on submit; clear; statistics; 5–7 views by profile (`drafts`, `not_taken`); "הכול" clears; fallback to "בקרוב"; taken orders hidden (org 2). State is not persisted, as today. |
| LI-31…LI-39, LI-68 | Cart countdown / "השמירה פגה"; "לא נשמר" + summary in the expanded row; 5 columns; one edge marker by priority; one order-status tag (8 values); payment as text (4 values); hover card → expanded row; smart-search rows without models ("—"). |
| LI-40…LI-45 | Row and link open the order; "עוד" menu (rental → entry point, delete); delete blocks, confirm, 401 → ID window → retry. |
| LI-46…LI-50, LI-67, LI-72, LI-73 | Sort (no "שולם"), fixed sort and hidden paid amounts in "לא שולם", pager, range text; latest request wins; refresh line on view switch. |
| LI-51…LI-55, LI-81, LI-82 | Filter window (dates, item state, order/item, customer; one per line), smart search on the filled fields; apply-on-button (T-Q3). Unsent params and UTC bounds are server items: out of scope. |
| LI-56…LI-66, LI-79 | The demo profiles org1/org2/min/max drive every key; child-component settings belong to their own windows (out of scope). |
| LI-69…LI-71, LI-74…LI-78, LI-83, LI-85 | Smart-search banner with a way out; export failure toast; export in smart mode uses the regular filter (stated in the window); print "current" empty → message; capacity and statistics entry points; keyboard (sort buttons, Esc, menu); the timer updates text only. |
| LI-80 | Unused response fields: nothing to show. |

## 5. How to re-run
```bash
cd <scratch> && npm i --no-save playwright           # once
export PW=<scratch>/node_modules/playwright
cd docs/redesign-v3/prototypes
node tools/build-shell.cjs --check && node tools/build-tables.cjs --check
node tools/tables-check.cjs --shots=screenshots/tables
node tools/tables-flow.cjs --shots=screenshots/tables
node tools/parity-check.cjs --only=archetype-list && node tools/parity-check.cjs --only=archetype-customers-list
```
(`parity-check.cjs` overwrites `tools/parity-results.json`. The polish pass's committed copy was restored after these runs.)
