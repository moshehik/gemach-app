# Diagnosis 02 - ORDERS group (order card, orders list, new order, rentals, refunds, board, print-order)

Date 2026-09-24. Branch inspected: redesign/site-v3-2026-09-24 (read-only, worktree wt-redesign-v3). Method: static code comparison + existing contracts. Live comparison was NOT possible (dev server :3100 accepted connections but hung; real app needs login), so percentages, responsive and typography findings come from code, not screenshots.
Note: `scratch/design-v2` mocks are OBSOLETE per the user; every comparison to them below is HISTORICAL context only. The reference is `order-card-sketch-B.html` (identical to docs/redesign-v3/sketch/) + DESIGN-LANGUAGE / STEPPER-PATTERNS / UI-KIT.

## 0. Headline findings
1. **Missing v3 page-level references.** For every page except the order card the only page mocks were the (now obsolete) v2 ones, which use the old design system (`order-detail.html` still has the old 4 tabs "פרטים כלליים / פריטים והשכרות / תשלומים / מידע" and an items table). Root cause #1 of the "lazy integration": builders had no v3 structure to copy for 6 of 7 pages. Rebuild agents must be briefed from sketch B + docs only.
2. **Order card ~60% of the sketch structure (estimate).** On the v3 kit, zero hex colors, but 4 tabs instead of 5, no dated "today" timeline, HistoryFeed built but never plugged in, native alert()/old custom* windows remain.
3. **Other pages:** all hand-roll `<table class="v3-table">` (kit `Table`/`useSort`/`renderExpanded` used by none). Similarity: orders list ~65%, rentals ~70%, refunds ~68%, board ~60% (own `ops-*` CSS, no @media), new order ~80% (best), print-order n/a (neutral by decision Q5).
4. SCREEN-MAP.md still shows every row unstarted; verify-*.md checked logic parity only, never sketch parity.

## 1. Order card `/orders/[id]`
Files: app/orders/[id]/page.js (1909 l.), components/orders/modern/ModernOrderCard.js (443), ModernGeneralDetails.js (663), ModernItemsManager.js (1428), ModernPaymentsManager.js (1433), ModernInfoTab.js (206), orderCardDialogs.js, orderCardV3.css (40 l.).

### 1.1 Designed structure (sketch B)
- Topbar: back, h1 "הזמנה #N" (NO status chip: "status lives only in the stepper", S:2053), tools print menu / lock / delete.
- Timeline stepper S:2058-2093: הזמנה -> משלוח הלוך | לקיחה -> אירוע -> משלוח חזור | החזרה; nodes date-sorted with weekday+date, done/cur/fut, "today" pin, partial fill, rich tooltip.
- 5 tabs (S:1933): פרטים · פריטים(count) · משלוח · תשלומים · היסטוריה; tab markers (missing customer data, delivery ok, debt/credit).
- Details: לקוח card (rows, "חסר" marks, swap/open/quick-mail), אירוע (big date + Hebrew, regular/abroad seg), הערות (+ "מופיע ב" chips), collapsed accordion "פרטים מתקדמים" (מנהל chip: spacing, extra day, order date, performed by).
- Items: scan bar, sub-seg פעילים/תיקונים/נמחקו with counts, add-item panel, collapsible item cards (thumb, model, size, delivery-aware status tag, repair tags, price, actions).
- Delivery tab: hero switch, כיוון seg, יעד card (city combobox, address, "יוצא יום לפני").
- Payments: credit-countdown tile, מצב תשלום (36px balance + progress + button), חיובים (line per obligation + pending rows), תשלומים שהתקבלו, admin accordion.
- History: day-grouped feed, live search with mark, multi-select filter, before/after, amounts.
- Rail (left in RTL): glance tiles, change cart with per-change undo/redo and totals, dynamic CTA, discard.
- Dialogs: summary, payment, credit, bank, success, discard, delete, quick-mail (light), manager approval; toast/notice bar with gold timer.

### 1.2 Real structure (evidence)
- ModernOrderCard.js:35-40: 4 tabs; delivery is a card inside Details (ModernGeneralDetails.js:450-520).
- ModernOrderCard.js:176,244: status Chip + signature Chip in header/summary card (sketch removed status from header). Lines 235-284: extra summary card above the tabs (avatar+name+status+phone/mail/date rows+scan) duplicating Details customer data.
- ModernOrderCard.js:139-150,230: Stepper with 4 fixed nodes, values as counters ("3/5"), no date sort, no delivery nodes, no today marker, `showAnchor={false}`; Stepper.js:36 fixed fill 1/0.4/0.
- Rail ModernOrderCard.js:305-406: glance tiles OK; change list text-only (`getChangeRows`), single "שמור שינויים"/"בטל שינויים"/"שמירה וחזרה" buttons.
- Details: ModernGeneralDetails.js:233 spacing card, 269 customer, 312 event, 450 delivery, 535 manual pay/credit, 544 order date - loose cards, no advanced accordion.
- Items: ModernItemsManager.js:1077-1131 collapsible `v3-item` cards with thumb/tags (matches sketch); sub-tabs replaced by two toggle chips (l.1148-1152), no counts, scan not in tab.
- Payments: ModernPaymentsManager.js:823/865/924/952/984 - closest to sketch (~80%); missing pending rows and the faint explanation text; balance uses `v3-status__n` (24/600) not `v3-balance__n` (36/700).
- History: ModernInfoTab.js:105-198 "פרטי הביצוע" + plain `v3-list` with a submit-search form; `app/v3/history/HistoryFeed.js`+adapter.js exist and are used only by components/HistoryViewer.js.
- Old leftovers: native `alert()` x25 in ModernItemsManager.js (e.g. l.127,132,248,264,268,283), mocAuth.js:15,20, RentalReturnModal.js x20; window.customConfirm/customAuthPrompt/customThreeWayConfirm/customPrompt used in page.js (316,785,825,982,1103,1133,1336,1398,1435,1461,1503); page.js:1240 comment admits one alert() kept.

### 1.3 Gap list
| # | Gap | Evidence | Sev | Cosmetic-only? |
|---|---|---|---|---|
| O1 | No Delivery tab | ModernOrderCard.js:35-40 vs S:1933,2222 | High | Yes: extract delivery block into own tab; pass `enableDeliveries` from page.js (already fetches settings) |
| O2 | Stepper not the designed timeline | ModernOrderCard.js:139-150; Stepper.js:36 | High | Yes: dates from eventDate/fromDate/toDate/orderDate + isDelivery/deliveryDirection; omit courier/hours/late fee |
| O3 | History = old list; HistoryFeed unused | ModernInfoTab.js:141-198 | High | Yes: `loadOrderHistoryRows` + `HistoryFeed` (same GET /api/audit) |
| O4 | Rail cart: no amounts/undo/redo/dynamic CTA/totals | ModernOrderCard.js:352-404 | Med | See section 11 |
| O5 | Duplicate summary card above tabs; status chip in header | ModernOrderCard.js:176,235-284 | Med | Yes |
| O6 | No "פרטים מתקדמים" accordion; no "מופיע ב" chips; no ID row/updated chip | Gen:233,535,544 | Med | Yes (ID sensitive) |
| O7 | Items sub-seg with counts replaced by 2 chips; scan outside tab; add-panel | Items:1148-1152 | Med | Yes (client-side filters) |
| O8 | Item status not delivery-aware | Items renderStatusTag | Low | Yes |
| O9 | Payments pending rows missing | Pay:865-925 | Low | Only via existing `isPreview` rows |
| O10 | Native alert/custom* windows | see 1.2 | High (R19) | Yes: v3 implementations in PopupProvider + replace alert() |
| O11 | Save-success still local overlay; V3NotifyProvider mount was open request #8 | page.js:1573 | Med | Yes |
| O12 | Tab markers via label-node hack, 2 of 3 markers | ModernOrderCard.js:154-163 | Low | Needs Tabs `mark` prop |
| O13 | Small inline styles | ModernOrderCard.js:264,286 | Low | - |
| O14 | Sprite lacks `undo`, `redo`, `cart` | requests/ordercard.md #4 | Low | - |
| O15 | Old-style copy ("ביצע/ה: ...", "פרטי הביצוע") | Info:~160 | Low | - |

### 1.4 Similarity (30 designed elements)
Present ~15, degraded ~7, absent ~8 => weighted ~62%. Visual language ~90%, interaction richness ~35%.

### 1.5 Data/behaviour to keep 100% (contracts: orders-id.md, orders-id-items-payments.md, orders-id-sketch-diff.md A1-A54)
- page.js: GET/PUT/DELETE /api/orders/[id] (+/email, /employees, cancel-changes), /api/orders/validate-inventory, /api/auth/verify-pin, /api/customers/[id], /api/inventory/preload, /api/settings, /api/audit, preview-pricing. Refs `itemsManagerRef.scan`, `handleExitRef`, 60ms setTimeout order, `openedDebt`, `debtApproved`, `pendingDebtBlockRef`, three-way exit confirm, beforeunload + link interception, 409 dialog, ת"ז prompt, order-date approval, lock/unlock, drafts `gemachOrderDraft:*` (30d), signature = immediate PUT.
- Items: /api/rentals/toggle, /rentals/scan, /rentals/verify-item, /returns/report-issue, /audit/order-item/[id], /pricelists; fields isTaken/isReturned/returnedOk/isDeleted/isNew/isEditing, neck/sleeve/length alteration + alterationDetails + alterationDone, dressModelId, sizeText, finalPrice, 15-min edit window, swap-size, maxItems, unpaid gate.
- Payments: /api/payments, /refunds, /nedarim, /admin/recalculations; obligations (isManual, isPreview, isAutoGenerated), pending refunds (bank+branch+account+name), credit window from system minutes.
- Details: eventDate/eventDateHebrew/fromDate/toDate/returnDate/isAbroad/isWeekdayEvent/customSpacing/extraDay/notes/internalNotes/isDelivery/deliveryDirection/deliveryCity/deliveryAddress/deliveryOneDayBefore/orderDate/hasSignedRegulations/customerId; customer create/replace (POST /api/customers).
- Real-only features the sketch lacks: draft banner, active-employees modal, real manager approval (pick manager + password), 409, ת"ז, lock modal, internal notes, HebrewDatePicker/RangePicker, deleted-items toggle, credit-card modal, pending refunds table, manual charge + delivery charge buttons, recalculation.
- Sketch items needing NEW logic (skip/placeholder): free-text quick mail + templates, extra attachments, courier/hours/hall/late-fee in stepper, "save and pay" in one step, per-change undo across immediate actions, print/mail history categories, "email updated 2 months ago".

## 2. Orders list `/orders` (app/orders/page.js, 1044 l.)
- Real: 6 columns (l.606-624), hand-rolled table + manual sort + Fragment expanded row instead of kit `Table`; row tone via inline style (l.674-720); 8 inline style objects; hand pagination (l.800-816); ~8 native `title=`; hover popover hand-built.
- Gaps: L1 too dense cells (amount+paid+2 chips); L2 kit Table unused; L3 inline styles; L4 native titles -> Tip; L5 old text ("הקודם/הבא"); L6 popover -> Tip rich. Similarity ~65%.
- Keep: GET /api/orders (param order = cache key), /api/ai/smart-search, /api/settings, hash/URL params, unsavedDrafts tint + "לא נשמר" chip, PendingTimer, sort keys orderId/customerName/eventDate/totalAmount/totalPaid/status, ExportButtons onFetchData, advanced filter keys, calculateOrderStatus/calculatePaymentStatus, getLabel('order_*').

## 3. New order `/orders/new` (2668 l. + NewOrderShell.js)
- Best-built: NewOrderShell (Stepper + Banner + footer), Cards per section, Tabs for customer mode, summary with per-block "עריכה", question titles, backLabels.
- Gaps: N1 18 inline styles + inline sticky footer (Shell l.55); N2 ~45 native `title=`; N3 verify "שלב X מתוך N" anchor; N4 no mobile segmented bar; N5 still window.customConfirm (l.643)/customAuthPrompt (l.1182,1508); N6 summary items list not the item card; N7 dialog variants (form = light only). Similarity ~80%.
- Keep: POST /api/orders, /orders/draft, /reserve, /calculate, /pricing, /validate-inventory, /api/nedarim, /api/customers(+/locations), /api/deliveries, /inventory/preload, /auth/verify-pin; `key={step}` reset; returnToSummary; step locks; draftOrderId; duplicate-customer dialog; busy alertdialog; beforeunload/back guard; step 5 = only "סיום ויצירת ההזמנה".

## 4. Rentals / Refunds / Board
- Rentals (754 l.): Tabs rentals/returns + Seg + Tip (good), 4-col hand table, expanded `<Rows>` (good). Gaps: hand table + 4 inline styles + 7 titles; `ai-feature-element` old class (l.724); RentalReturnModal (1108 l., shared) full of alert() x20 and legacy OrderPrintMenu trigger; manual pagination. ~70%. Keep: /api/orders (buildRentalsListParams order), /api/returns/scan (postReturnScan), viewMode hash logic (rented/rented_partial/returned/returned_partial), RentedPastEventWidget, getLateReturnInfo, replaceState not push.
- Refunds (930 l.): Tabs+Seg, tables 5-6 cols (l.106-121, 708-712), Dialogs (l.874,899). Gaps: two hand tables, inline `color: accentColor` (l.120), too many columns (R16), 11 titles, verifyPin alert (mocAuth). ~68%. Keep: GET /api/refunds, PUT /api/refunds/[id], /api/orders (debts), /api/audit (DEBT_APPROVED/CANCEL_DEBT_APPROVAL), REFUNDS_PAGE_SIZE, PIN approval, bulk select.
- Board (935 l.): `components/ops-v3/ops.css` + 51 non-kit `ops-*` classes; hand popover (l.643); 1 alert; `anim={false}` x10. Gaps: calendar cell/legend/popover not on kit Card/Chip/Tip; long legend text. ~60%. Keep: GET /api/orders (buildBoardMonthParams, cache ns), hebcal (HDate/Sedra/Locale), month nav, RentalReturnModal host, PrintWizardModal, StatisticsModal, custom spacing marks, late "!" badge, hover data.

## 5. print-order `/print/order` (969 l.)
Neutral by decision Q5 (hard-coded colors, David Libre); only PrintToolbar is v3 (build-print.md). ~22 inline styles acceptable for print. Text is old copy (contract forbids rewriting without approval) - ask, do not rebuild. Keep `data-agy-id="print-order-container"`, `data-print-ready`, @page rules, fetches, email route relies on same HTML.

## 6. Root causes
1. No v3 page-level design for most pages (only obsolete v2 mocks + tokens + contracts).
2. Contracts framed as "preserve everything"; cosmetic items misclassified as logic (B4-B7, B11), so builders skipped them (build-ordercard.md "חריגים").
3. Kit gaps worked around, not fixed (requests/ordercard.md 1-7 still open).
4. No acceptance vs sketch (SCREEN-MAP all unstarted; verify = logic parity).
5. Shared old components not migrated (RentalReturnModal, mocAuth, PopupProvider windows, HistoryViewer/ChangesChips, HebrewDatePicker, CustomerSelector, ops.css).
6. HistoryFeed and Table built but never plugged into order pages.

## 7. Rebuild plan (15 steps)
Ground rules: (a) sketch B is the only structural source for the order card; other pages from DESIGN-LANGUAGE + UI-KIT + STEPPER-PATTERNS; design-v2 is obsolete; (b) props/handlers/state/API byte-identical; (c) "new logic" items skipped, not faked; (d) each step ends with side-by-side screenshot at 1280 and 390 + getBoundingClientRect RTL check.
1. Kit fixes first: Tabs `mark`, icons undo/redo/cart, Tip must not clobber child onClick, Dialog first-render guard, rail collapsed mode into kit, Stepper dates/today/rich tip.
2. Delivery tab: extract block, pass `enableDeliveries`; hero switch + כיוון seg + יעד card.
3. Details: remove summary card above tabs (move scan into Items); add "פרטים מתקדמים" accordion; "מופיע ב" chips; ID row only if allowed.
4. Stepper: dated, date-sorted, delivery nodes, today marker; drop header status chip.
5. Items: Seg פעילים/תיקונים/נמחקו with counts (client filters), add panel, delivery-aware tags, thumbnails from `dressItem.dress.thumbnailUrl`.
6. History: `loadOrderHistoryRows` + `HistoryFeed`; hide empty categories; "יש עוד" paging; keep server `search`.
7. Rail cart: lines with amounts (when preview loaded), per-change undo/redo (section 11), dynamic CTA label (text only), totals.
8. Payments: use `v3-balance__n`; pending rows from `isPreview`; admin accordion explanation; keep handlers. 8b: debts - read-only drift check of `Order.totalAmount` vs sum of obligations; UI-only 3-state helper or additive `balance` field.
9. Dialogs: v3 versions of customConfirm/customAuthPrompt/customThreeWayConfirm/customPrompt; replace alert() (ItemsManager 25, mocAuth 2, RentalReturnModal 20, board 1); mount V3NotifyProvider; save-success via `v3NoticeSaved` (15s gold timer), remove overlay/banner duplicates.
10. Lists (orders/rentals/refunds): kit `Table` + `renderExpanded`, fewer columns, tone via class, mobile card template.
11. Replace native `title=` by Tip/labels (~80 places); icons animated (remove `anim={false}`).
12. Board: re-skin ops-* onto kit; popover -> Tip/bottom sheet; add mobile agenda.
13. New order: remove inline styles, enable anchor, mobile progress bar, safe-area footer, v3 confirm/auth dialogs.
14. print-order: leave; ask owner about copy.
15. Acceptance: update SCREEN-MAP only after side-by-side screenshots; add 30-element sketch-parity checklist to VERIFY-METHOD.md; run responsive pass (section 9).

## 8. Information / history / saving / debts - design vs real
Verdict legend: UI = existing data suffices; ADD = additive read-only field/query (never schema-destructive, never new AuditLog write); LOGIC = changes save/flow behaviour (needs sign-off).

### 8.1 Saving
Sketch: everything staged (`cur` vs `saved`, S:2010-2100), pending lines dashed, one cart with net amount and undo/redo, CTA by money, success dialog + toast.
Real mixes: immediate = confirm-add item POST, rent/return, signature PUT, order-date PUT (approval), payments/nedarim/refunds, email/print; staged = order fields, item delete flag, item edit mode, unconfirmed new rows (`_localId`), manager list edits (verify). Tracking: `hasUnsavedChanges` + `savedSnapshotRef` (page.js:218,353,913-920,1018); draft `gemachOrderDraft:*` 600ms after edits (page.js:501-527); exit three-way confirm; save chain (banner 3/7s, overlay 5s, v3 notice, auto-jump to payments, "השלמת תשלום" dialog Neve only, bank modal, print prompt).
| Need | Verdict |
|---|---|
| pending change list | UI (`buildDraftRows`+`CHANGE_GROUPS`, page.js:114-146) |
| amount per line + net | preview-pricing exists and merges `isPreview` (page.js:400-460) but fires only when `activeTab==='payments'` (l.420): UI if shown only after preview ran; tiny LOGIC to widen gate |
| pending marking per item | UI (`isNew`/`_localId`); label immediate actions "נשמר מיד" |
| everything staged incl. add-item/signature | LOGIC - do not unify |
| per-change undo/redo | client-state work, see section 11 |
| CTA label by money | UI (same `onSave`) |
| single notice (R20) | UI/shell: mount provider, remove duplicates |
Risks: keep `saveMessage` error path (substring "שגיאה"/"בוטלה", Card:109); cart must read not write `hasUnsavedChanges`; keep `debtApproved`/`pendingDebtBlockRef` before PUT.

### 8.2 Recent actions / history
Real data: GET /api/audit rows (`action`, `changesJson`, `createdAt`, `employeeName`; filters entityType/entityId/entityIds/actions/search/page/limit). `loadOrderHistoryRows` (app/v3/history/adapter.js:692-703) = 5 parallel calls (Order merges uuid+number; OrderItem/Payment/PaymentObligation/Refund by ids page already holds). Built, self-tested, not wired.
| Element | Verdict |
|---|---|
| day grouping, category+icon, sentence, amount chip, actor | UI |
| before -> after | UI where `from/to` exists; otherwise replay from CREATE only if within 500 rows (HISTORY-DESIGN 6.2) |
| item name on OrderItem rows | UI via `itemsById`; hard-deleted -> generic "פריט" |
| filter "הדפסות" | not fillable (print not audited; only EMAIL_SENT) -> hide empty chips; no audit writes |
| >500 rows | UI (`page`, `totalAll`) |
| full-history search | UI (server `search`) |
| CANCEL_ORDER N+2 rows | UI (group in adapter) |
| list "last action" | ADD only if design shows it: list payload lacks `updatedAt` (schema.prisma:342) |
| bell durability | UI (/api/notifications exists) |
Card history is fully UI-only. (Derived bell items "rental returns tomorrow"/"alteration done" dropped per user.)

### 8.3 Debts (most important)
Four definitions: (1) card = sum non-deleted obligations (preview replaces auto; hides locally-deleted unsaved) minus sum non-deleted payments (page.js:400-415, Card:88); (2) list API: `Order.totalAmount` if >0 else sum obligations else sum payments (app/api/orders/route.js:558-562), status via `calculatePaymentStatus` with FOUR states (lib/orderStatus.js:84-90); (3) "לא שולם" tab SQL path uses only stored `totalAmount` (route.js:309-341); (4) refunds "approved" state only in AuditLog DEBT_APPROVED/CANCEL_DEBT_APPROVAL (refunds/page.js:285-297). `totalAmount` is a cache written by pricing engine (lib/pricingEngine.js:154-161) and PUT (orders/[id]/route.js:665); drift possible for legacy imports/manual-only orders.
| Need | Verdict |
|---|---|
| same numbers everywhere | UI if cache in sync; ADD if not: first read-only drift check on both orgs; if drift, additive `balance` in list response, keep `totalAmount` |
| 3-state grouping | UI mapping helper ('לא שולם'/'שולם חלקי'->debt, 'ממתין לזיכוי'->credit, 'שולם'->paid) |
| "לא שולם" tab consistency | ADD/accept - changes counts/paging/prefetch keys, needs sign-off |
| credit countdown | UI (system minutes from deletedAt, Pay:775-800, not fixed 15) |
| executed refunds | UI (approval creates payment row) |
Risks: sorting `aIsPaid` (orders/page.js:142-145), export columns, board hover "לתשלום", AI smart-search column names - add fields only.

### 8.4 Other information differences
Thumbnails: contract B13 ("no image") is wrong - `fetchOrderItemsWithDress` selects all DressModel scalars (orders/[id]/route.js:24-42), schema has imageUrl/thumbnailUrl (schema:242-243) -> UI. Customer ID is `Customer.zeout` (sensitive, never displayed; owner decision). Stepper dates: use existing lib/inventory buffer logic, not hard-coded -2/+3. Delivery nodes UI from isDelivery/deliveryDirection/deliveryOneDayBefore; courier/hours/hall/late fee do not exist. Order status (8 values + draftsAsDeleted) stays in lists/board. Email-freshness chip: no field, omit. Drafts in lists keep. Refunds "approved" tab and rentals viewMode deep links keep.

## 9. Responsive (from CSS; no live resize possible)
Kit breakpoints: 1020 (rail -> bottom sheet, 1 col), 767 (drawer), 640 (mobile: vertical timeline, paddings), 420 (seg), max-height 640 (dialog sticky actions). Sketch same set. Obsolete v2 mocks are no reference.
| Viewport | Order card | Lists | Board | New order |
|---|---|---|---|---|
| 360 | vertical stepper OK, tabs scroll, rail collapsed sheet (`oc-rail-toggle`); header wrap unverified | tables = horizontal-scroll containers (components.css:436), hover info unusable on touch | `ops-grid repeat(7,1fr)` with NO @media (ops.css:66) -> ~40px cells | vertical stepper eats height; inline sticky footer |
| 768 | rail already bottom sheet | tables borderline | ok | ok |
| 1024/1440 | sticky rail; container 1240 | ok | ok | ok |
| 1920 | 1240px cap (tokens.css:294), no wide layout | wasted space | fixed width | ok |
| short window | rail actions inside scrollable rail with hidden scrollbar (components.css:509) can scroll out of reach | - | tall | ok |
Gaps: R1 header wrap at 360; R2 sticky `.v3-rail__actions` + cart max-height; R6 table->card collapse at <=640; R7 hover-only info needs tap alt; R8 row icon buttons maybe <44px; R10 board mobile agenda; R11 popover -> bottom sheet; R13 footer class + safe-area; R14 mobile progress bar; R15 decide ultrawide width; R16 test 200% zoom. After rebuild: resize_window at 360/768/1024/1440/1920 + 1280x600, record scrollWidth<=innerWidth, tap sizes, screenshots.

## 10. Typography diff (order card)
Values from final CSS cascade (sketch last matching rule; kit components.css/tokens.css); no live computed dump. Font Rubik/Heebo (S:38 = tokens.css:170, loaded via @import line 1 of tokens.css), body 16/1.6 - kit scale matches sketch; problem is which class real markup uses.
| Element | Sketch | Kit | Real | Diff |
|---|---|---|---|---|
| h1 | 28/600 | .v3-h1 | v3-h1 | OK |
| Card title | 18/600 | .v3-card__title | Card title | OK |
| Customer name | .big 20/600 under h2 "לקוח" | .v3-big | used as Card title 18/600 (Card:237, Gen:272) | -2px, lost 2 levels |
| Event date | .big 20/600 + muted Hebrew | .v3-big | Row value 17/500 (Gen:341) | de-emphasised |
| Row label/value | 14 ink-3 / 17/500 | .v3-row__* | Row | OK |
| Field label | 15/500 | .v3-label | Field | OK |
| Balance amount | 36/700 ls -1 (S:560) | .v3-balance__n | v3-status__n 24/600 in navy block (Pay:829) | -12px, lighter |
| Rail status | 24/600 | .v3-status__n | same | OK |
| Item model/meta/tag/chip/tab | 20/600, 15, 14/500, 14/500, 16/500-600 | kit | kit | OK |
| Stepper label/sub | 16 semi / 14 ink-3 | 16/600, ink-2 | only 3 of 4 nodes, counters not dates | data missing |
| Payment lines | 16-17/500, 14, 17/600 | .v3-li__* | v3-li | OK |
| Cart line | text 15-16, small 14, em 16/600 | .v3-cl__t | text only, no em/small (Card:356-358) | 2 levels unused |
| History day header | 16/700 navy + small | HistoryFeed | none (flat v3-li) | missing |
| Table cells | (no table) | th 14/500, td 16 | bare `<b>` (700) + inline color/fontWeight (orders/page.js:673,715) | weight 700 vs token 600 |
Fixes: use `v3-balance__n`; card headings "לקוח/אירוע" + `v3-big` values; dated stepper values; cart `em`/`small`; wire HistoryFeed; replace bare `<b>`/inline weights by classes. Legacy leakage: globals.css:143-146 still sets h1-h6 to Frank Ruhl Libre/700 and body Assistant; v3 restores family for `[data-v3] :is(h1..h6)` (components.css:1381) but not weight for raw headings without a v3 class; user font prefs (`data-font`, design-system.css:908-922) no longer reach v3 pages (confirm intended). Inline typography counts: orders/page.js 1, refunds 4, ModernRentalsManager 2, others 0. To verify live: getComputedStyle dump and `document.fonts.check('16px Rubik')`. Typography similarity: scale 100%; right emphasis class in ~13 of 18 elements (~75%).

## 11. Change list + undo/redo + saving model (priority)
### 11.1 Sketch
"Left panel" = rail (last child of `.layout`, left in RTL; S:1908-1913, `_renderRail` S:2390-2433), cart "שינויים בהזמנה".
- Derived diff, not a log: `saved` vs `cur`; `changes()` (S:1996-2015) returns per key `{k, icon, text, note, amt}` with keys `add:<id>`, `rm:<id>`, `alt:<id>`, `del`, `delcfg`, `deladdr`, `delone`, `date`, `note`, `sig`. Editing back removes the line automatically; new-then-removed unsaved item is dropped. No actor/time/before-after per entry (only in text/note).
- Amounts are local constants (`FEE`, `CITY[]`, `ADD_PRICE`); `netDelta()` sums; totals "חיוב/זיכוי ממתין", "לתשלום אחרי שמירה"; tween, badge `bump`.
- Undo per line (`.cl-u`, `data-act="undo"`, aria "ביטול השינוי"): `undoChange(k)` (S:2017-2031) pushes `clone(cur)` on `REDO`, copies the key's value back from `saved`; 220ms `leaving` animation (S:2735).
- Redo (S:1570-1580, 2427, 2729): stack of whole-`cur` snapshots; button only when non-empty, tooltip "החזר ביטול", count badge if >1; any new edit clears it (`afterEdit` S:2673); commit/reset/leave clear it; discard is itself redoable (S:2737).
- Whole-cart: CTA by money ("שמור ושלם ₪X"/"שמור וקבל זיכוי"/"שמור"/"זכה"/"שלם"), "שלם ₪X בלבד", discard confirm, exit summary dialog (S:2470-2489), toast on every edit (S:2455-2464: 6.5s charge/credit, 2.6s info, gold bar, dismissal remembered per amount).
- Commit (S:2541+): `addLog` per change with the same text -> history feed is the persisted cart; `saved=clone(cur)`.
- Not all staged: take/give-back written to both `cur` and `saved` (S:2716), payments immediate as `session:true` info lines, credit/refund immediate with 15-min timed undo (`creditUndo`), mail/print log only. Signature and repair-done ARE staged in sketch (immediate in real).
- Wording: "נוספה/שוחזרה דגם X · מידה N", "הוסרה דגם X · דמי ביטול", "תיקון בוצע/בוטל", "נוסף/הוסר משלוח", "עודכן משלוח", "עודכנה כתובת משלוח", "המשלוח יוצא יום לפני/יומיים לפני", "תאריך האירוע", "הערות עודכנו", "חתימה על תקנון עודכנה".

### 11.2 Real today
`order/items/obligations/payments/refunds` in React state + `savedSnapshotRef` (same pair as cur/saved). Dirty flag is imperative (`setHasUnsavedChanges(true)` at page.js:1330,1805,1826,1843-1845) and never recomputed to false when edited back. Coarse list exists: `buildDraftRows` (page.js:130-146, `CHANGE_GROUPS` 114-123 + item/obligation/payment counts) passed as `getChangeRows`, stored in draft `rows`; no amounts/keys/undo. Drafts: `saveOrderDraft` {savedAt, baseUpdatedAt, summary, rows, state} written 600ms after edits, cleared when flag returns false (page.js:501-527); restore `handleRestoreDraft` (~1319-1335). Whole discard `handleCancelChanges` (~1347): confirm with chips, restore snapshot, `POST cancel-changes` (audit CANCEL_CHANGES).

### 11.3 Verdict
Sketch = staged-then-commit for the order document, apply-immediately for money and physical actions, timed undo only for credit. Real is the same hybrid with different membership (add-item confirm, signature, order date immediate). Keep staged-then-commit exactly for what is staged today; do not convert immediate actions (API timing, pricing, inventory). Apply-immediately-with-undo not recommended except the existing credit window.

### 11.4 Change entry and reversibility
Entry (client-only, derived each render): `{key, kind:'staged'|'committed', entity, ids, fields, icon, text, note, before, after, amt|null, at, actor, undoable, requiresApproval}`. Keys: `order:<groupId>`, `item:<id|_localId>:add|rm|edit|alt`, `oblig:<obligationIdentityKey>` (page.js:160), `pay:<id>`. before/after from snapshot vs state; amt from preview diff (when loaded). Committed entries come from audit feed (actor/time/text).
| Action | Staged? | Undo | Reversible? | Notes |
|---|---|---|---|---|
| Order fields | yes | set group fields back via `setOrder` (not via handlers that recompute extra-day/Hebrew/spacing) | yes, client-only | groups must include coupled fields; redo must not re-apply approval-gated values without approval |
| Unconfirmed new row | yes | remove from items | yes | - |
| Delete of saved item (local flag) | yes | restore flag | yes | preview recalculates |
| Item edit mode | yes | replace by snapshot copy | yes | edit-window rules evaluated at edit time |
| Confirmed new item (POST) | no | existing remove flow = cancellation with fee/credit policy | not an undo | 2 audit rows, possible fee (refund policy) |
| Rent/return | no | existing cancel endpoints (audited) | yes as new action | inventory changes; outside cart undo |
| Signature / order date | no | PUT again (+approval) | yes, audited both ways | keep immediate |
| Payments/manual obligations | mixed | staged: revert arrays; persisted: DELETE only `isManual !== false` | partly | Nedarim card charges never undoable in-app |
| Refund create/approve | no | none | no | new refund is only reversal |
| Email/print, notifications | n/a | none | no | side effects |
| Inventory holds | n/a | - | - | staged undo never touches inventory |
| Whole discard | yes | restore snapshot + POST cancel-changes | yes | do not make redoable |

### 11.5 Drafts and AuditLog
Undo/redo must use the same setters so draft writer, beforeunload, link interception and preview effect keep working. Required: (1) recompute `hasUnsavedChanges` after undo (diff length or pending row) so the draft is deleted (page.js:521-525) and exit guard stops; (2) redo stack in memory only; cleared on new dirty edit (single `markDirty()` around the five child callbacks), save/snapshot reset (`handleOrderUpdate`, handleSave), `reloadOrderFromServer`, discard, draft restore/discard. AuditLog: no manual writes; staged undo/redo never hits server, audit shows only the net result at save; cart and history text must share one dictionary (history adapter rules, HISTORY-DESIGN 3.4) since real cannot write `addLog` text; discard keeps `cancel-changes`. Preview-pricing re-fires on undo/redo (400ms debounce, `previewSeqRef`); show skeleton/`isLivePreviewing`.

### 11.6 Recommended design
1. Pure module e.g. `app/v3/orderChanges.js`: `diffOrder(snap, cur, {previewObligations}) -> Change[]`, `revertChange(state, snap, key)`; reuse `CHANGE_GROUPS`, `summarizeListDiffCounts`, `obligationIdentityKey`; node-testable like history-adapter-selftest.mjs.
2. page.js plumbing only: `changes` via useMemo; derived dirty OR imperative flag; in-memory undo/redo refs; `handleUndo(key)`, `handleRedo()`, `markDirty()`; pass `changes/onUndo/onRedo/redoCount` to ModernOrderCard (replace `getChangeRows`).
3. Rail: header (badge, net when known), line (icon, text, note, amount `em`, undo button), redo button with count, 220ms leaving / enter / bump, ARIA live "בוטל:/שוחזר:", section "בוצעו עכשיו" from `loadOrderHistoryRows` filtered by createdAt >= opened time (no undo, links to existing inverse buttons), totals only when preview loaded.
4. Keep single `onSave` and all gates.
5. Optional toast per edit, never a bell entry.
6. Do not stage immediate actions, no audit writes, do not persist redo.

### 11.7 Risks
1 coupled fields on revert (test against `changeDates`, `setExtraDay`, `applyTime`); 2 approval bypass via redo (spacing, item reopen, feature:*); 3 derived dirty flag may miss fields (manager list edits) - OR with imperative flag and test every setHasUnsavedChanges site; 4 snapshot drift after immediate actions (`handleOrderUpdate`) - clear stack; 5 mergePendingItems/in-flight save - block undo while `saving`; 6 preview race/stale amounts; widening gate is logic; 7 users may expect undo for signature/rent/payment - copy must say "נשמר מיד"; card charges have no inverse; 8 confirm audit trace expectations (per-change undo leaves none; discard still posts); 9 draft schema unchanged, keep `rows`; 10 Neve Yaakov summary/"השלמת תשלום" must consume same `changes`; 11 missing sprite icons; 12 fallback if not approved: cart lines + amounts + existing single "בטל שינויים".
