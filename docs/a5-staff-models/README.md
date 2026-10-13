# A5 staff screens — employees list, models list, model card, new model, orders/customers admin lists, print/PDF (2026-10-11)

Index and the points worth remembering. Details live in the per-area files next to this one.

**Open items (what is still undone, with first steps): [open-items.md](open-items.md).**

## What shipped
| Screen | Route | Variant id | Default |
|---|---|---|---|
| Employees list | `/employees` (list tab) | `employees_list` | programmer = new, everyone else = old |
| Models list | `/dashboard/dresses` | `models_list` | same |
| Model card | `/dashboard/dresses/[id]` | `model_card` | same |
| New model wizard | `/dashboard/dresses/new` | `model_new` | same |
| Orders list (admin) | `/admin/orders-list` | none (no legacy page) | head management + programmer only |
| Customers list (admin) | `/admin/customers-list` | none (no legacy page) | head management + programmer only |
| Data history (audit log) | `/admin/data-history` | `data_history` | programmer = new, everyone else = old (self-switch for all) - `data-history-notes.md` |
| API / visit history | `/management/history` | `management_history` | same - `management-history-notes.md` (also tightened `GET /api/history` to head management) |
Print / PDF sheets (`app/components/a5-print/`) for employees list, models list, model card, orders list, customers list.

**Who may choose the new design (owner decision 2026-10-11):** every active employee, for themselves, per screen (icon `PageVariantToggle` / "עיצוב ותצוגה"); until they choose they stay on the old design, only the programmer defaults to the new one. One rule, one place: `canEmployeeSelfSwitch` in `lib/uiVariantSelfSwitch.js` (narrow it again with `SELF_SWITCH_ONLY_ROLE_IDS`). The new design grants no permission. Details: `security-audit.md` section 8, `docs/page-variant-switch-2026-10-04.md`.

Turning a screen on for everyone = org setting `ui_variant_<id>='a5'` (rollback: `'legacy'`) — nothing was changed in any DB. **`/employees` is shared with the `attendance` screen:** the old attendance tab lives inside the legacy page, so both `ui_variant_attendance` and `ui_variant_employees_list` must be `a5` for non-programmers to get the new list.

## Pattern (same as customer/order card)
Registry entry in `lib/uiVariantScreens.js` + `*Switch` + byte-identical frozen `Legacy*.js` (asserted by tests) + new component tree under `app/components/<area>/` with its own CSS; `PageVariantToggle` in the new header. Admin lists have no legacy and are listed in `NO_LEGACY_PAGES`.

## Shared kit
`app/components/a5-list/` — search bar (AI + statistics buttons), ONE grouped "סינון" popup (zero-count options hidden unless selected), sort popup, rows/table switch, sticky results bar (turns peach when stuck), 50-per-page pager capsule, row anatomy 21px/14px with icon+number pairs (zero values never shown), chevron expander, export trio (XL / download / print). `kit-notes.md` = props and "what a new list screen needs".

## Owner rules baked into the designs
No tags/pills; explanations as tooltips; Hebrew dates only; rows like the main-search results; one control height in the results bar; every table column sortable; dark dialogs everywhere (no `window.confirm/alert/prompt` in new flows); two-state controls = `.seg.pill`; model card follows the LIVE order card structure (not the 4.10 static mock); print sheets: no duplicated data, no irrelevant data.

## Fidelity protocol (the answer to "designs were omitted/changed on the way to the site")
Every screen has `<screen>-fidelity.md` (every element/state of the mock → identical / adapted / missing; no `missing` left) built from numeric `getBoundingClientRect` + `getComputedStyle` diffs against the mock, plus `independent-review-1.md` (a separate reviewer re-measured everything; 4 blockers: 3 fixed, 1 fixed afterwards by wiring the AI/statistics buttons in the card lists). Known intended differences are listed in that file (card 26px lower = follows live order card; toggle icon in every header; mock dark-dialog texts that were unreadable were corrected). **When touching `globals.css` / `design-overrides.css` table rules, re-run the comparison** — global `table tbody td{border-bottom-color:…!important}` already leaked into the lists once and into the print sheets (fixed with sheet-level overrides).

## Behaviour decisions
- **Model card save semantics:** the old page saved item edits immediately; the new card batches everything as lines in "שינויים בכרטיס" and saves together (same endpoints/payloads; a failed step stays in the cart with an explanation). See `model-card-notes.md`.
- **Models list** loads the whole catalog and pages 50/page in the browser (option counts and derived sorts are impossible with the paged API); search stays server-side.
- **Employees "connected now":** new read-only route `app/api/employees/presence` (open shift); "last entry" = last shift entry. No DDL anywhere.
- **Admin lists** use new read-only APIs (`/api/admin/orders-list`, `/api/admin/customers-list`, `…/counts`) built on one aggregate snapshot cached 30 s per server instance (order membership/sort/totals/counts can be up to 30 s old; the 50 visible rows are read fresh), counts load lazily when the filter popup opens, `statement_timeout` + concurrency cap + 503 "צמצמו את הסינון", page size ≤100 (export ≤500 per page, ≤5000 rows). Before: 15–87 DB statements per request, 7–14 s sorts; after: 1 cheap lookup. Derived order status is expressed as Prisma `where` clauses and was verified identical to `calculateOrderStatus` on all 27,397 TEST orders. Customer "created" filter uses the first-order date (no creation timestamp exists).
- **StatisticsModal** is now a dark dialog everywhere (it is shared: old orders/customers/rentals/alterations/board pages show it dark too).

## Print / PDF
Registry `pkRegistry.js` (+ `PDF_HTML_SURFACE_KEYS` in `lib/printAccessKeys.js`): a new document = one spec builder + one registry line + one server permission entry, otherwise `/api/pdf` refuses it. The client paginates by measuring real layout (header/footer/table header repeat, group "(המשך)", totals never alone) and posts the finished sheets to `/api/pdf` (JS disabled in the renderer, only data:/about: and Google Fonts allowed); fallback = browser print dialog. HTML cap 3 MB (~300 sheets). Gotchas: Hebrew PDF filenames need an ASCII fallback + `filename*`; sheets must not depend on page-level `box-sizing`; PDF margin 0 for designed sheets. `print-specs.md` has the content rules per document.

## Security (see `security-audit.md`)
Fixed in this work: stored XSS via upload/attachment content types; full employee rows (wages, phones…) to every signed-in user; wage rows in the audit-log API; deactivated employees keeping API access up to 7 days; `next-code` unauthenticated; dev routes (`switch-env`, `fix-employees`, `db-import`) open to any user in `next dev`; PUT dress 500 on bad JSON; `/api/pdf` filename length. **D1 resolved 2026-10-11** (see "Item permission" below). **Open owner decisions:** R1 both prod orgs must keep `require_login=true`. **R4 resolved 2026-10-11:** the employees AI search ("חיפוש חכם", `POST /api/ai/smart-search` with `pageContext:'employees'`, used by the legacy and the new list) no longer answers from the Customer table - it has its own context, head management + programmer only (403 otherwise), that runs the model's WHERE fragment against a safe projection of employees (code, name, department, active, phone, email, shift entry times, "in a shift now") behind an allow-list guard in a read-only transaction; passwords, wages and personal data are unreachable. Code: `lib/ai/employeesSearch.js`; tests: `scripts/test_ai_employees_context.mjs` (offline) and `scripts/test_ai_employees_live.mjs` (live, TEST DB). The new list shows an inline message for an empty / refused search and widens the status filter so "עובדים לא פעילים" works. R4b (the other AI endpoints could read any table) was closed 2026-10-11 by the table allow-list `lib/ai/sqlTablePolicy.js` (see `security-audit.md` section 4, R4b). Residual: no per-user rate limit on PDF/heavy admin calls; PDF render timeout ~30 s for very large tables.

## Operations / gotchas
- Work was done in worktree `C:\wt\wt-a5-staff-models` on `.active-db=test`; after a machine restart the dev server once came up in PROD mode — always check `GET /api/dev/switch-env` before any write.
- **Item permission (D1, 2026-10-11):** creating / editing / deleting / restoring dress ITEMS (`DressItem`: add item, location, carton, in-repair, not-in-use, delete, restore, quick location) needs the new action permission `feature:dress_items_manage` ("ניהול פריטי דגם (הוספה, עריכה ומחיקה)"). Default closed; head management + programmer always; anyone else by a personal exception on the employee card ("הרשאות ספציפיות" > "קטלוג ותיקונים") or by a permission row in `/admin/permissions` ("שורת הרשאה חדשה"). Enforced server-side by `requireDressItemManager()` (`lib/dressItemAccess.js`) in `POST /api/dresses/[id]/items` and `PUT`/`DELETE /api/dresses/items/[itemId]`; the cards read `employee.canManageDressItems` from `/api/me` and show items read-only without it. Rental / return / daily-schedule flows that set `DressItem.location` stay open (they are order actions, not catalog edits). Tests: `scripts/test_dress_items_permission.mjs`.
- **Duplicate model name (2026-10-11):** `DressModel.name` is unique in the DB (soft-deleted rows included). `POST /api/dresses` and the rename in `PUT /api/dresses/[id]` now answer 400 `{error:"דגם בשם «X» כבר קיים (קוד N)", field:"name"}` (or "...קיים ברשימת המחוקים (קוד N) — אפשר לשחזר אותו") before writing (`lib/dressNameConflict.js`, also maps Prisma P2002). The new wizard and the new card show it inline under the name field; the old wizard / card show it through their existing error display.
- Statistics/AI buttons inside the model card lists are scoped to the model (smart-search with the model code in the prompt; rentals tab sends `pageContext:'rentals'` on purpose).
- Disk C: was nearly full (98 MB free at one point); `.next` of a dev worktree is ~600 MB.

## Addendum 2026-10-11 - email log + departments (admin pages on the same kit)
| Screen | Route | Variant id | Notes |
|---|---|---|---|
| Email log | `/admin/site-settings/email-logs` | `email_logs` | programmer only; type derived from the subject; password-mail bodies never returned; `email-logs-notes.md` / `email-logs-fidelity.md` |
| Departments | `/admin/departments` | `departments` | same APIs and server rules; create / rename / delete in dark dialogs; `departments-notes.md` / `departments-fidelity.md` |
Registry also holds `management_history` and `data_history` (built by the other agent). Shared shell for every list page: `A5ListPage` (`kit-notes.md`, "Uniform page header"). Print docs: `email-log`, `departments-employees` (`pkSpecsAdmin.js`, surfaces `a5-email-log` / `a5-departments` -> `page:admin`).

**Security audit of this addendum (2026-10-11, `security-audit.md` section 10):** go for upload after F10-F15 were fixed. Main points: the audit twin of every password-reset mail held the clear-text temporary password and was readable through `/api/audit` by any signed-in employee (now masked at write + read, not searchable); `DELETE /api/history` now needs a head-management / programmer session in addition to the manager code, `GET /api/history` is head-only and bounded; text searches over `changesJson` / `pageUrl` can no longer be used as a secret oracle; NUL bytes in a search no longer 500. Open owner decision: stop storing the temporary password in `EmailLog.body` (exact change in 10.5). Tests: `scripts/test_a5_staff_models_security.mjs` (static, 79) and `ADMIN_LOGS_LIVE=1 node scripts/test_a5_admin_logs_security_live.mjs` (live, TEST only).
