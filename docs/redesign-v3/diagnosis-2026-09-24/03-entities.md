# 03 - Entity + Operations pages: designed structure vs real (branch redesign/site-v3-2026-09-24)

Read-only diagnostic, 2026-09-24. Real tree analysed: `C:\Users\moshe\Desktop\wt-redesign-v3` (paths below relative to it).
**Note (added on re-creation):** `scratch/design-v2` mocks are OBSOLETE per the user. Every comparison below to "the mock" is HISTORICAL: it explains why the integration agents produced what they did. The live reference is sketch B + `docs/redesign-v3`.

---

## 0. Method and limits
- Static analysis only. No live comparison: localhost:3100 served the MAIN tree behind login, 3000 was down; mock pages opened via file:/// render unstyled. No screenshots.
- Percentages are judgement, not measurement. "vs mock" = share of the old mock's sections/controls/columns/tabs present in the real page. "vs brief" = how many of R10-R16 plus the sketch-B model (card + label-over-value rows, rail with changes list, expandable rows, history feed) are applied.

## 1. Headline finding (root cause of "lazy agents")
A. (historical) The design-v2 mocks were the OLD pages re-skinned: customer card = same 5 tabs, dress card = same 4 tabs, messages = same tabs, employee card = same 3 tabs, old copy retained ("צ'אט חכם מבוסס AI", "סה"כ שורות מוצגות"), and design-v2 wine palette rather than sketch-B navy/sky/gold.
B. `docs/redesign-v3` never pointed agents at the mocks. RULES/ARCHITECTURE/SCREEN-MAP name sketch B + `contracts/*.md`, and the contracts were extracted from the OLD code. Build reports (`reports/build-ops.md`, `build-print.md`) are "checklist vs contract" with tiny deviation lists ("column merged", "7 columns -> 5"). Agents therefore kept the old information architecture 1:1 (R7/R8/R24) and swapped classes, copy, icons.
C. Nobody wrote a per-page structural spec for entity pages in sketch-B language. DESIGN-LANGUAGE sec. 11 lists ideas only (#2 changes cart for customer/dress/employee, #3 expandable rows instead of wide tables, #4 history feed, #14 at-a-glance tiles).
D. The shared floating-window family was never touched. `git diff origin/main...HEAD` shows no change to `app/components/{StatisticsModal,PrintWizardModal,UploadZone,PopupProvider}.js`, `components/{SendEmailModal,HebrewDatePicker,HebrewDateRangePicker,ExportButtons,CapacityCalendar,CapacitySearchModal,CustomerSelector,FullEmailListModal}.js`. 17 non-admin files still render `.modal-backdrop` (list in sec. 7).

## 2. Scorecard (judgement)
| Page | vs old mock | vs brief + sketch B | Gap | Verdict |
|---|---|---|---|---|
| Home `/` (app/page.js) | ~85% | ~60% | Med | v3 kit, same search+AI+3 result cards; fixed-position chat bar; no at-a-glance |
| Dashboard `/dashboard` | ~90% | ~60% | Low-Med | Genuinely rebuilt (tokens-only css). No debts, no recent activity |
| Dresses list | ~85% | ~50% | Med | kit Table, Seg; 6 cols + 3-4 action buttons per row; no expandable rows |
| Dress card | ~85% | ~40% | High | same 4 tabs; two action clusters; save/delete duplicated in header and tab; items table 8 cols |
| Customers list | ~90% | ~45% | Med-High | hand-rolled 6-col table (first/last split), row-click, 2-tab dialog for 5 fields |
| Customer card | ~85% | ~40% | High | good hero card then old 5 tabs; no changes rail; back = `router.back()` silent discard |
| Alterations | ~90% | ~50% | Med | 6-col table; old PrintWizard/Statistics/DateRange modals; status filter as Tabs (should be Seg) |
| Pricelist | ~90% | ~65% | Low | good; inline edit row in wide table |
| Messages | ~85% | ~55% | Med | 7-tab strip incl. compose and settings as tabs |
| Employees list | ~85% | ~45% | Med-High | 2 tabs, 6-7 col tables, embedded print sheet with ~40 hex colours |
| Employee card | ~85% | ~40% | High | old 3 tabs, 8-col shifts table, `AgyTabs` fork of kit Tabs |
| Employees report | ~85% | ~55% | Low-Med | fine |
| Punch clock | ~90% | ~70% | Low-Med | good form; card stretches to 1240px on wide screens |
| My hours / Profile / Display settings | n/a / ~90% / n/a | 65 / 75 / 55 | Low / Low / Med | profile best of group (save = blocking dialog); display-settings keeps 28 hex |
| Kiosk | ~75% | ~60% | Med | 2-stage stepper done; 1595-line file; width capped 1240 |
| Print dress card | ~60% | n/a (Q5) | Med | copy-only diff (14 lines); no PrintToolbar |
| Print alterations | ~85% | n/a | Low | PrintToolbar added, document unchanged by design |
| No-access / Not-found | 100% verbatim copy | ~5% | High, cheap | old classes `page-head/card/btn`, inline px, no V3Page (`app/components/NoAccessMessage.js`, `app/not-found.js:4-8` says "copied as-is") |
| mgmt-* | out of scope (Q1) | - | - | `app/management/{database,history}` zero v3 refs |
Aggregate: ~85% vs old mocks, ~50% vs brief/sketch B.

## 3. Per-page findings (Designed / Real / Gaps / Must keep)
### 3.1 Home (`app/page.js`)
Real: one search card toggling AI mode, AI chat card + `position:fixed` reply bar (~553-575), results as `Card` + `v3-link` rows, quick links. Gaps: fixed bar overlaps content/keyboard on phones; 15 inline styles; AI result table headers are raw keys; privacy as footer button; no at-a-glance. Keep: `?q=` hydration + `replaceState` order, `agy_history`, `SettingQuickPanel`, `exportTableToExcel`, AI `_actionUrl/_actionLabel`, `require_login/hide_internal_messaging/home_welcome_title`.
### 3.2 Dashboard (`app/dashboard/page.js`)
Best built. KPI Cards + `DashboardCharts` + `dashboard-v3.css`. Missing: debts, recent activity (sec. 6). Keep: inline `checkPageAccess(HEAD_MANAGEMENT_ROLES)` (19-22), server Prisma aggregates (29-63), 13-month window.
### 3.3 Dresses list
Seg for status, filter Card of 7 fields, kit Table with 6 columns; action cell up to 4 controls (300-314); thumbnail cell uses old `file-icon` class + inline style. Keep: `catalogSort`, restore/delete/return handlers, head-management gating, `getLabel('item_*')`, `useModelNames`/`showImages`, advanced-filter semantics.
### 3.4 Dress card (`app/dashboard/dresses/[id]/page.js` + `components/dresses/modern/*`)
Same 4 tabs (`ModernDressCard.js:8-13,96-112`). Two header action clusters (53-83) and again save+delete at bottom of details tab. Items tab 8 columns + filter row (`ModernDressItemsTab.js:572-586`), 910 lines, hand-rolled table. History tab hand-made (`ModernDressInfoTab.js:58-62`) though `loadDressHistoryRows` (`app/v3/history/adapter.js:706`) exists. `handleExit` silently SAVES on exit (249-262). Few Tips. Keep: `MODEL_FIELDS`, `ACTIVITY_TOGGLE_FIELDS` == server list, items save immediately (separate from model save), `itemsRevisionRef`, `dressCache` SWR, barcode-scan highlight, `?includeDeleted=true`, new-model wizard, CSV export, print route.
### 3.5 Customers list
Hand-rolled table (~336-364), 6 columns, row-click, adv-search dialog uses Tabs for 5 fields, old StatisticsModal, no balance. Keep: server pagination/sort, AI mode + `handleAiPageChange`, `advFilters`, `getLabel('customer_*')`, `isBlocked`.
### 3.6 Customer card
Hero `Card variant="cust"` + Rows is good (`ModernCustomerCard.js:47-84`), then same 5 tabs. Gaps: "חזרה" = `router.back()` without guard/beforeunload (silent discard); details tab has local `isEditing` sub-mode on top of header save/cancel (two edit models); `ModernSendEmailModal` duplicates `components/SendEmailModal`. Keep: `hasUnsavedChanges` JSON compare, `cancelTick`, `normalizeEmail`, mandatory groups (create only), block/unblock (head-mgmt), 409 Data Collision on `updatedAt`, refunds from `/api/refunds?customerId=`.
### 3.7 Alterations
Faithful v3 build, `ops-*` css (113 lines, 0 media queries). Old PrintWizard/Statistics/DateRange/Export modals; dress cell display logic as inline ternary. Keep: effect deps `[startDate,endDate,filterStatus,page,search,totalPages]`, mark-done payloads, `#alterationsListPageNum`, `buildAlterationsListUrl`, export columns.
### 3.8 Pricelist
Good. Minor: edit row inside 5-col table; gap-rule panels use raw `v3-note`. Keep: delete-lock code flow, `GAP_RULE_CHEAPER`/`gapsByCategory`, layout guard.
### 3.9 Messages
7 tabs (~527-538), compose and settings as tabs, raw `v3-banner` markup. Keep: shift/management categories gated by settings; mark-read/archive/tag endpoints.
### 3.10 Employees list
Two tabs, two 6-7 col tables, hidden print sheet in page (572-670) with hard-coded hex, `SortHead` local, inline `cursor` styles. Keep: month/year state, `handlePrintPdfs`, Export columns, issues highlighting.
### 3.11 Employee card
`AgyTabs` fork (lines 12-40) to keep `data-agy-id`; 3 tabs; 8-col shifts table with inline add/edit; three password sub-flows; `EmployeePermissionsPanel`; old SendEmailModal; update notice `persistToBell:false` (164) vs customer/dress true. Keep: `data-agy-id`/`data-element-name` hooks, shift flows, `showDeletedShifts`, department load fallback, password >=4.
### 3.12 Report, punch clock, my-hours, profile, display-settings
Report fine. Punch clock identifies by name combobox (real behaviour; keep). Profile removed palette select (moved to /display-settings). Display-settings: 28 hex - verify data vs chrome.
### 3.13 Kiosk
2 stages with `v3k-steps`, `kiosk.css` tokens. Gaps: 1595-line component, 6 media queries only on 900/640, table view hand-rolled. Keep Layer-1 lock semantics (`KIOSK.md`), self-registration and self-order cards, availability computation.
### 3.14 Print, no-access, not-found
Print dress card: add PrintToolbar + org header/"בס״ד", keep neutral colours (Q5). No-access/not-found: rebuild on `V3Page + Empty + Btn href`.

## 4. Cross-cutting gaps
1. Tabs: sketch B ITSELF has a 5-tab strip on the order card (`contracts/orders-id-sketch-diff.md` 1.3). The missing piece on entity cards is the RAIL (tiles, pending-changes list, status, save) and tab markers - not removal of tabs.
2. Wide tables: kit `Table` (supports `renderExpanded`) used in ~8 places, `renderExpanded` in 2 (`ModernCustomerPaymentsTab.js:91`, `ModernCustomerRefundsTab.js:49`); rest hand-rolled. Only pricelist (5) and report (5) meet the ~5-column ceiling.
3. Copy: mostly rewritten; still old in NoAccess/NotFound, PrintWizard, StatisticsModal, footers, tab labels.
4. Help: few `<Tip>`s; much help is `title=` or inline hints.
5. Hard-coded values (non-print): `app/employees/page.js` (48 inline, 40 hex, print sheet), `display-settings` (28 hex), `CustomerSelector` 11 inline, `SendEmailModal` 36, `ExportButtons` 30+7 hex, `CapacitySearchModal` 25, `StatisticsModal` 26, `PrintWizardModal` 14 + old classes `btn/modal/field/checkbox-row`.
6. Native `alert/confirm` remain in PrintWizardModal, ExportButtons, StatisticsModal, AIFloatingWidget, PopupProvider.
7. Forks and old naming (`Modern*`, `AgyTabs`, `SortHead`, `ops-*`, `v3k-*`, `dr3-*`, `dv3-*`) - each fork is a place the kit is not the single source (R2).

## 5. SAVING and CHANGE/UNDO/REDO model
### 5.1 Live-risk defect (by code reading; verify on TEST DB first)
Client `persistNote` (`app/v3/notify/store.js:77-92`) POSTs `{category:'activity_note',title,content}` with no `receiverId`; `app/api/notifications/route.js:12` allows only `shift_handover|management`, so `parsedCategory=null` and `parsedReceiver` is undefined -> NULL = broadcast to everyone, then emails all active employees with `receiveEmailAlerts` (155-180). `reports/notify-api-patch.md` says "not applied". Callers with `persistToBell:true`: customer create/save (`customers/[id]/page.js:225,232`), employee create (158), dress exit/create (`dresses/[id]/page.js:258,405`). Fix: apply the additive `activity_note` branch or set `persistToBell:false`; add `activity_note` filter in `messages/page.js`.
### 5A. The sketch model (reference) and where entity pages stand
Sketch B: `saved` vs `cur` (1957-1958); `changes()` (1996) derives keyed pending rows (`add:id`, `rm:id`, `alt:id`, `del`, `delcfg`, `deladdr`, `delone`, `date`, `note`, `sig`) with icon/sentence/note/money; per-row `undoChange(k)` (2017) pushes clone to `REDO`; redo pops (2729); any new edit clears REDO (`afterEdit` 2673); round gold redo button with count (`.redo` 1573-1580, v3 `.v3-redo` `components.css:262-270`); discard-all; primary save inside the rail with adaptive label; status tile debt/credit/ok. History tab = separate feed of SAVED events (hf-*); cart = pending, history = persisted.
Old mocks for customer/dress/employee: NO cart/undo/redo (only generic "ביטול שינויים"; employee none). Only DESIGN-LANGUAGE idea #2 mentions it; no undo/redo requirement is written for these pages.
Real order card: has rail + read-only change rows (`ModernOrderCard.js:346-372`, `buildChangeRows` `app/orders/[id]/page.js:1312`), save + discard-all; per-row undo and redo are NOT implemented (`.v3-redo` css unused; only unrelated API `undoRent/undoReturn`).
Real entity save models today:
| Page | Working copy | Cancel | Save | Feedback | Sub-entities |
|---|---|---|---|---|---|
| Customer | `customer` vs `originalCustomer`, JSON compare | reset all + `cancelTick` | PUT whole object, 409 on `updatedAt` | notice (bell flag) / alert | refunds tab edits bank fields on same object |
| Dress | `dress` vs `savedSnapshotRef`, boolean via `patchDress` | confirm + snapshot restore | PUT `MODEL_FIELDS` (or activity subset) | inline 3s flash; notice only on exit | items save IMMEDIATELY (`onItemsChange`) |
| Employee | form state, no snapshot compare | none | PUT/POST | toast | shifts/password/permissions save on their own |
| Order | cur-like + `buildChangeRows` | discard-all | PUT | notice + overlay | inline managers |
Requirements to share ONE mechanism with the order card:
1. One hook `useChangeSet({saved,cur,setCur,defs})` in `app/v3/`; defs `{key,diff,revert,label,icon}`; owns derived list, `undo(key)`, `redo()`, `discard()`, new-edit-clears-redo. Migrate the order card's `buildChangeRows` first (order gains undo/redo), then customer/dress/employee. UI-only; save payload builders untouched (R8).
2. Flat entities fit (customer fields, employee fields, dress MODEL fields); labels from adapter `FIELDS` (`adapter.js:100`) so cart wording = history wording.
3. Sub-entities saved immediately (dress items, shifts, passwords, permissions) do not fit a pending cart; undo would need compensating writes that do not exist generically. Owner decision: (a) keep out of cart, show in history feed (recommended, R8-safe); (b) deferred save (NOT cosmetic, needs approval).
4. ONE primary save, in the rail. Status tile only where a balance exists (order, customer).
5. Redo is client-memory only (lost on reload); persisted equivalent is history. Optional localStorage draft restore as for orders (UI-only).
6. History recording needs no new writes: Prisma extension already audits CREATE/UPDATE/DELETE (`app/lib/prisma.js`); UPDATE rows carry values without "from", feed derives before/after by `replay` (`adapter.js:349`); adapter drops identical values (IDEAS-LOG #20). No manual AuditLog writes.
7. History readers to converge: dress/customer/employee tabs and the order card's `ModernInfoTab` all still hand-render `ChangesChips`; `HistoryFeed` is mounted only in `components/HistoryViewer.js:291` (used by `app/admin/data-history`).
### 5.2 Other saving items
| Need | Exists? | Verdict |
|---|---|---|
| Dashed "pending" field styling | no | UI-only |
| Notice bar 15s + bell (R20) | client wired on customer/dress/employee/alterations/pricelist | inconsistent (dress notice only on exit; profile blocking `ask()`; employee update bell false) - UI-only harmonise; bell needs 5.1 |
| Leave-page guard | dress only (`beforeunload` line 160) | UI-only; owner must choose exit=save (dress) vs exit=discard (customer) |
| Draft restore | orders only | UI-only if wanted |
| 409 collision UX | API yes (`app/api/customers/[id]/route.js:63-75`), UI generic alert | UI-only |

## 6. History feeds and DEBTS
### 6.1 Feeds
| Page | Real | Verdict |
|---|---|---|
| Dress | `ModernDressInfoTab.js:58-62` two `/api/audit` calls | UI-only: `loadDressHistoryRows` does the same two calls; wire `HistoryFeed` (mind limit 100/200 truncation) |
| Customer | `ModernCustomerHistoryTab.js:47-56` `entityType=Customer` only | Partial. Order/payment events live under other entity types (HISTORY-DESIGN 1.4). Assemblable client-side from `customer.orders[]` ids (`api/customers/[id]/route.js:23-38`) with N calls, but `entityType=Order`+`entityIds` matches only uuid form, missing numeric-orderId manual rows (`api/audit/route.js:58-70` dual identity only for single `entityId`). Complete fix = one additive read param (e.g. `customerId=`) unioning Order/OrderItem/Payment/PaymentObligation/Refund; no writes. Interim: Customer-only feed via HistoryFeed, labelled |
| Employee | `/api/employees/[id]/history` Employee+Shift, take 100, head-mgmt only | UI-only: adapter `ENTITIES` has Employee/Shift; move `normalizeChangesForDisplay` into `parseChanges`; secrets already redacted |
| Dashboard recent activity | none | Partial: global `/api/audit` + `HistoryFeed showEntity`; rows lack entity display name/amount/orderId so lines say "payment created" without customer/order. Options: derive from `changesJson` (UI-only) or reuse orphaned endpoint |
| Orphaned endpoint | `app/api/dashboard/debts/route.js` returns `{debts, recentPayments(10), recentOrders(10), recentRentals(10)}` with customer names and remaining balance; no page consumes it (consumer removed in commit 8731735) | UI-only source for a dashboard activity+debts block; debts capped `take:100` so no grand total from it |
### 6.2 Debts - four formulas today
- Customer payments tab: `debt = totalRequired - (payments - refunds)`; required = non-deleted obligations else `totalAmount` (`ModernCustomerPaymentsTab.js:6-19`, `customers/[id]/page.js:95-100`).
- Orders list `unpaid*`: `totalPaid < totalAmount` in JS (`app/api/orders/route.js:329-341`).
- Refunds page: `totalAmount - totalPaid` (`app/refunds/page.js:133`).
- `/api/dashboard/debts`: obligations minus payments, `isPaid=false`, excludes current `DEBT_APPROVED >= remaining-1`, `take:100`.
- Helper `calculatePaymentStatus` (`lib/orderStatus.js:84`) is status only.
Suspected double-count on customer card: executing a refund creates a NEGATIVE reverse Payment (`app/api/refunds/[id]/route.js:91-98`, `isRefund:true`); card includes all order payments (incl. the negative row) AND subtracts Refund rows again, and pending refunds too. `dashboard/page.js:40-50` comment says negative payments already net refunds. Unverified; resolve with owner before reuse.
Needs: debt tile on card (UI-only, one shared pure function in `lib/`, after resolving double-count); balance per customer in list (needs additive API shaping - grouped aggregate, not per-row client fetches; `api/customers/route.js:66-90` selects no balance); total open debt/top debtors on dashboard (orphaned endpoint UI-only; exact total needs additive `_sum`; keep approved-debt exclusion); group by customer (UI-only grouping); colours: `--v3-charge-*` (rose page / plum dialog) - attendance misuses charge bg for "issues".
### 6.3 Compatibility risks (read-side only, never schema-destructive)
(a) extra fields in `GET /api/customers` change payload and cache shapes (param order is cache key); (b) new formula helper must be checked against Neve Yaakov `paymentContinueAmount`; (c) HistoryFeed on customer/dress must respect the Employee-entity 403 split in `api/audit`; (d) changesJson parsing stays in read layer; no manual AuditLog writes.

## 7. Floating windows still old (used by this group)
`modal-backdrop` files: `app/components/{AIFloatingWidget,ErrorReportButton,MessageHistoryButton,OverdueOrdersModal,PrintWizardModal,SettingQuickPanel,StatisticsModal,PopupProvider}.js`, `app/components/permissions/PermissionRowWizard.js`, `components/{CapacitySearchModal,ExportButtons,FullEmailListModal,HebrewDatePicker,HebrewDateRangePicker,SendEmailModal}.js`, `components/orders/{RentalReturnModal,modern/ModernRentalsManager}.js`. Impact: alterations (PrintWizard, Statistics, DateRange, Export), customers/employees (Statistics, Export), dress card (HebrewDatePicker, UploadZone), home (SettingQuickPanel), employee card (SendEmail, HebrewDatePicker, PermissionsPanel). `DIALOG-INVENTORY.md:173` already flags date pickers.

## 8. Responsive (from CSS; not measured live)
Facts: `--v3-container:1240px` (`tokens.css:294`), gutters 24/16, tap token 44 (`tokens.css:284`), 17 media blocks in `components.css` (420/640/900/1020/1040/1180 + one max-height 640 for dialogs at 914), `.v3-table__wrap{overflow-x:auto}` (436), no card mode for tables (0 `data-label`).
| Page | Phone 360 | Wide 1440-1920 | Notes |
|---|---|---|---|
| Home | fixed bottom chat bar covers content/keyboard | 65% of 1240 centred | AI table scrolls |
| Dashboard | auto-fit KPI/charts OK | 1240 cap, empty margins | no media queries; relies on auto-fit |
| Dresses/customers lists | 6-col scroll; up to 4 buttons per row | fine | need stacked/expandable row |
| Dress/customer/employee cards | 4-5 tab strip overflow unverified; items 8-col and shifts 8-col tables heavy scroll; `dr3-two--img` 2-col only >=900 good | fine | employee attendance worst |
| Alterations | picker min 320px in 328px box; `ops.css` 0 media queries | fine | |
| Pricelist | inline edit row with 6 inputs unusable at 360 | fine | needs card layout |
| Punch clock (touch) | good, 52px block buttons | card stretches to full 1240 | cap to ~480-560 |
| Kiosk (touch) | <=640 single column; <=900 filters static | 1240 cap: 340px empty bands at 1920, 288px cards small for wall screen | no landscape/short-height rules; tap 52 |
Gaps: (1) kit Table `collapse="cards"` mode for <=640; (2) narrow-page wrapper for punch clock/no-access/not-found/profile and wider container for kiosk; (3) page css has 0-1 media queries; (4) only Dialog has short-height rules - kiosk/punch/rail need `dvh` handling; (5) fixed elements (home chat bar, AIFloatingWidget) need `env(safe-area-inset-bottom)`; (6) unverified: tab-strip overflow at 360, employees print popover override (`employees/page.js:481`), Tip tap behaviour.

## 9. Rebuild plan
0. Blocker: write ONE per-page structural spec in sketch-B language (sections in order, rows vs tables max 5 cols with expansion, rail/cart contents, primary/secondary actions, Tip content). Pilot 3 pages (customer card, dress card, customers list), get sign-off, then scale. Mark design-v2 as historical in SCREEN-MAP.
1. Live-risk first: bell `activity_note` (5.1); customer-balance double-count question (6.2).
2. Kit once (R2): `useChangeSet` + `ChangesRail` (migrate order card first); `Table` mobile card mode + default expansion; `EntityHero` with status tile; `useEntityHistory` + `HistoryFeed` for dress/employee/customer(+order card); narrow/wide page wrappers; use `Banner` not raw markup; `NoAccess`/`NotFound` on V3Page.
3. Floating windows in order: StatisticsModal, PrintWizardModal, SendEmailModal (merge with ModernSendEmailModal), date pickers (Popover/Sheet), ExportButtons, UploadZone, CapacityCalendar/SearchModal, CustomerSelector; keep prop/callback signatures (orders pages import them).
4. Pages: no-access/not-found; customer card (rail + changes + history feed, unify edit models); customers list (name+phone cell, expansion, debt badge after API shaping, no tabs in adv search); dress card (single save in rail, items as expandable cards, keep immediate item saves); dresses list; employee card/list/report (move print sheet to `/print/*`, replace `AgyTabs`); alterations (Seg, phone cards); messages (compose as Dialog, settings as popover); pricelist (card edit row on phone); home/dashboard debts + activity blocks; kiosk split by stage + width/height rules; print dress card toolbar/header.
5. Verify (R24): contract checklist per page, RTL via `getBoundingClientRect`, viewport passes 360/768/1024/1440/1920 on a worktree dev server (none existed), identical API URLs/params/bodies.
Do-not-lose: SWR page caches (param order = cache key), `data-agy-id`/`data-element-name` hooks, head-management gating, `getLabel()` overrides, settings-driven visibility (`require_*`, `hide_*`, `useModelNames`, `hide_dress_images`), Israel-timezone helpers, no manual AuditLog writes, no reads inside Prisma transactions.

## 10. Evidence index
`docs/redesign-v3/{RULES,SCREEN-MAP,UI-KIT,DESIGN-LANGUAGE,HISTORY-DESIGN,NOTIFICATIONS-DESIGN}.md`, `reports/{build-ops,build-print,notify-api-patch}.md`, `contracts/orders-id-sketch-diff.md`; `components/dresses/modern/*`, `components/customers/modern/*`, `components/employees/ModernEmployeeHistoryTab.js`, `components/orders/modern/ModernOrderCard.js`; `app/v3/history/adapter.js`, `app/v3/notify/{store,bridge}.js`, `components/HistoryViewer.js:291`; `app/api/{notifications,audit,dashboard/debts,customers/[id],refunds/[id]}/route.js`; CSS `app/v3/tokens.css`, `components.css`, `components/ops-v3/ops.css`, `app/customer-interface/kiosk.css`, `app/dashboard/dashboard-v3.css`; sketch `order-card-sketch-B.html` lines 1957-2017, 2427-2441, 2673, 2729.
