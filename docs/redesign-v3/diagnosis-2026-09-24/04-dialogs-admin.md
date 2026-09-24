# Diag 04 - Floating windows + Admin (read-only), branch redesign/site-v3-2026-09-24 @ e861963

Note: scratch/design-v2 is OBSOLETE per the user. Every comparison below to the design-v2 mocks is historical only; the current reference is sketch B + docs/redesign-v3.

Method: read RULES / UI-KIT / DIALOG-INVENTORY / NOTIFICATIONS-DESIGN / HISTORY-DESIGN; grep of app/** and components/** in the worktree; read Dialog.js, notify/*, PopupProvider.js, icon sprite, notifications+audit routes, components.css responsive rules. No dev server, nothing executed against a DB or browser. Claims from code reading are marked "(code)".

## 1. Headline findings

1. **The global dialog layer is untouched.** `app/components/PopupProvider.js` has no v3 code and is unchanged vs main. `window.customConfirm / customPrompt / customAuthPrompt / customThreeWayConfirm / alert` still render legacy `.modal-backdrop` / `.modal` and the top-centre `.toast-stack` (4s, memory-only history). DIALOG-INVENTORY conclusion #1 (one `<DialogProvider>` keeping the same signatures, plus a `window.confirm` override) was never built. Still on the old layer: ~57 confirm / 8 prompt / 24 auth-code call sites (RentalReturnModal 22 refs, orders/[id] 14, ModernItemsManager 9, orders/new 5, ModernRentalsManager 4...) and 112 bare `alert(` calls (ModernItemsManager 25, RentalReturnModal 20, ModernRentalsManager 11, admin/departments 8, PrintWizardModal 7, admin/recalculations 7...).
2. **Instead of one provider, each area got a private ask-hook**, all wrapping `Dialog` with different defaults: `useAskDialog` (v3misc), `useV3Dialogs` (orderCardDialogs.js), `customerDialogs.js`, `useDressDialogs`, `useOpsDialogs` (OpsKit), `useListDialogs` (listKit). Six copies. Nothing routes `window.customConfirm` to them, so a v3 page that renders a shared component (ModernItemsManager, PaymentsManager, RentalReturnModal) still pops old dialogs.
3. **Dark mode is not foundational.** `Dialog` takes `mode` per call (default `'light'`) and never reads the site theme. Three policies coexist: hard `mode="light"` (customerDialogs, orderCardDialogs, most of ModernPaymentsManager), hard `mode:'dark'` (dresses pages), theme-following only in OpsKit `dlgMode()` (read once at render, not reactive). `tokens.css` / `components.css` contain no `data-theme` / `prefers-color-scheme` rule; dark exists only as the `[data-v3-mode="dark"]` block scoped to dialogs (tokens.css:11, :343). QUESTIONS Q3 approved "pages light-only, dialog follows the theme switch"; the second half was not implemented. Net: the top-bar ThemeToggle flips legacy `data-theme=dark`, v3 cards stay light (mixed page), and dialogs are randomly light or dark.
4. **R20 saved-notice flow: client side done, server side not; currently misbehaves (code).** Wired: `V3NotifyHost` in layout.js inside PopupProvider; `enqueueNotice` (sessionStorage queue, dedupe, absolute `expiresAt`, pause/resume, beacon flush); `NoticeItem` with gold draining bar (15s, reduced-motion steps); call sites in orders/new:1371, orders/[id]:970/972/1282/1290/1420, customers/[id], employees/[id], dresses/[id], alterations. **But** `reports/notify-api-patch.md` (self-only `activity_note` branch of POST /api/notifications) was NOT applied (`activity_note` appears nowhere outside app/v3/notify). `persistNote` posts `{category:'activity_note', title, content}` with no receiverId. In route.js:136-171 the category is not in ALLOWED_CATEGORIES so it becomes null and receiverId becomes null = **a broadcast Notification to all employees plus an email to every employee with receiveEmailAlerts, on each order save**. `/messages` does not filter `activity_note`; NotificationBell only has the `v3:bell-refresh` listener; `hideInternalMessaging` is not honored by the persist path. Apply the patch or set `persistToBell:false` before any deploy.
5. **R21 (internal messages bottom-left) is visuals only.** `V3MessagesToast` is mounted with no props (renders null); nothing feeds it. `ShiftMessageWatcher` still uses the centre `showConfirm`; `LoginScreen.js:116` still calls native `alert`.
6. **Two competing toast systems + a leftover.** `.v3n-*` (notify.css, used) vs `.v3-toast` (components.css:924), which orders/[id]:1601 still renders as the old 5s "saved" overlay beside the new notice (double confirmation; its comment says remove). `alert()`/showAlert never go through `v3Toast` (bridge used in 12 files; PopupProvider.showAlert never redirected). ErrorReportButton has its own top toast.
7. **Code dialog (`variant="code"`, `CodeInput`) is unused in the app** (gallery only). The approver+PIN prompt (24 call sites) is the legacy `showAuthPrompt`.
8. **No Popover/combobox primitive** (UI-KIT: "not built"). CustomerSelector, OrderModelSelector, HebrewDatePicker and HebrewDateRangePicker (still full `modal-backdrop`, z 100000), board hover card/action menu, AI-widget menu, permission ItemInfo are bespoke. `v3-combo__*` exists only inside LoginScreen.
9. **~24 hand-rolled `modal-backdrop` files remain unrestyled.** The brief's own example, SendEmailModal ("quick mail", data entry -> light `form` variant), is untouched; only ModernSendEmailModal moved to Dialog.
10. **Native dialogs remain**: 7 `window.confirm` with no fallback in admin (bulk-email, email-test, nedarim-hok-edit x2, nedarim-hok-test, WebBackupModeToggle, trusted-devices), `customConfirm || window.confirm` fallbacks (ModernOrderCard:124, ModernItemsManager:289, ModernRentalsManager:84), RentalReturnModal:469/511, `window.prompt` ModernItemsManager:692.
11. **RTL arrow direction is wrong through the aliases.** Sprite geometry (IconSprite.js:27-28,69): `i-chevron-start` = `<` (points left), `i-chevron-end` = `>` (points right), `i-arrow-end` = arrow pointing right. Icon.js:11-12 aliases `back -> chevron-start` (points LEFT) and `next -> chevron-end` (points RIGHT): the LTR convention; no CSS mirrors it (`[dir=rtl]` only sets `--v3-dir` for animations). Some agents hand-swapped (pagination, month nav, browser back/forward use raw chevron-end = previous, chevron-start = next: RTL-correct; AppShell.js:299 comments it), so two opposite conventions coexist. ~15 of ~58 usages wrong (2c).
12. **Admin is legacy, as scheduled (R6/Q1).** Zero admin/management files use v3 imports/classes. The 20 changed admin files are feature merges from main (nedarim-*, refund-planner/simulator, email-test, settings field picker), not redesign.

## 2. Inventory

Legend: Prim = built on shared v3 `Dialog`; D/L = follows the rule (confirm/code/view = dark+light, data entry = light only); Tok = tokens only; Arrow = RTL-correct (n.a. = none).

### 2a. Infrastructure
| Component | File | Prim | D/L | Tok | Arrow |
|---|---|---|---|---|---|
| Dialog (confirm/code/form/sheet) | app/v3/ui/Dialog.js + components.css | is the primitive | PARTIAL (mode is a prop, default light; form forced light OK) | OK | n.a. |
| CodeInput | Dialog.js | yes | OK | OK | n.a. (unused in app) |
| PopupProvider confirm/3-way/prompt/auth/toast-stack | app/components/PopupProvider.js | NO | NO | NO (inline px, zIndex 10000) | n.a. |
| NoticeBar + store | app/v3/notify/* | own component | PARTIAL (navy only, no light variant) | OK | bar drains toward start, correct |
| MessageCard (R21) | notify/V3MessagesToast.js | own | as above | OK | never fed |
| Tip | app/v3/ui/Tip.js | own portal | OK | OK | n.a. |
| Popover / combobox / BusyOverlay | - | MISSING | - | - | - |
| Six ask-hooks | v3misc, orderCardDialogs, customerDialogs, useDressDialogs, OpsKit, listKit | duplicated wrappers | 3 policies | OK | n.a. |

### 2b. Modals / popovers by inventory code
| Component | File | Prim | D/L | Tok | Arrow |
|---|---|---|---|---|---|
| A1-A5 orders/new confirms + busy | orders/new/page.js (9 Dialogs) | yes | mixed | OK | back/next via alias WRONG |
| A6 save success overlay | orders/[id]/page.js:1601 | NO (.v3-toast leftover) | n.a. | OK | n.a. |
| A7/A8 summary + payment-continue | orders/[id] | yes | hard light | OK | n.a. |
| A9 unlock | ModernOrderCard | yes (+ window.confirm fallback :124) | - | OK | n.a. |
| A10, B10-B14 payments/general | ModernPaymentsManager (11), ModernGeneralDetails (2) | yes | 6 hard-coded modes | OK | n.a. |
| A11/A12/B15 items | ModernItemsManager | partial (4 Dialogs, 25 alert, 9 custom*, window.prompt) | mixed | OK | n.a. |
| Rentals manager | ModernRentalsManager | NO (2 modal-backdrop, 11 alert) | NO | NO | n.a. |
| A16/B18 RentalReturnModal | components/orders/ | NO (3 modal-backdrop, 20 alert, 22 custom*) | NO | NO | n.a. |
| A18/A19 active employees, capacity | ActiveEmployeesModal, ItemCapacityModal | yes | light | OK | n.a. |
| A20 CapacitySearchModal | components/ | NO | NO | NO | n.a. |
| A21-A24 Overdue / MessageHistory / Statistics / AI table | app/components/*.js | NO | NO | NO | n.a. |
| A25 privacy, A26 legend, A27/A28/B22 board, A29/B17 dress, A35 kiosk, B23 deliveries, B16 refunds | respective pages | yes | per-call | OK | month/day/page nav OK; home cards `next` x3 WRONG |
| A30-A34 admin viewers | admin/ai, ai-history, data-explorer, inventory-alerts, email-test, management/history | NO | NO | NO | n.a. |
| A36 PermissionRowWizard | app/components/permissions | NO | NO | NO | n.a. |
| A37/B25 login windows | LoginScreen.js | own login skin | light | OK | submit arrow-end points right WRONG; 1 native alert |
| B1 SendEmailModal | components/ | NO (untouched) | NO | NO | n.a. |
| B2 ModernSendEmailModal | customers/modern | yes | light OK | OK | n.a. |
| B3/B4 email prompt, print menu | orders/[id], OrderPrintMenu | yes | - | OK | n.a. |
| B5 PrintWizardModal, B6 SettingQuickPanel, B19 ExportButtons, B20 FullEmailList | app/components, components/ | NO | NO | NO | n.a. |
| B7-B9 card charge | orders/new, PaymentsManager | yes | light | OK | n.a. |
| B21 HebrewDatePicker / RangePicker | components/ | NO (modal-backdrop) | NO | NO | " <- " separator OK |
| B24 ErrorReportButton (+own toast, recorder bar) | app/components | NO | NO | NO | n.a. |
| C2 AI floating chat + FAB | AIFloatingWidget.js | NO | NO | NO | n.a. |
| C10 ShiftMessageWatcher | app/components | NO (showConfirm) | NO | NO | n.a. |
| D1-D3 bell / user menu / topbar search | app/components | shell panels `v3-tb-*` | light | OK | TopbarSearch submit arrow-end WRONG |
| D4/D5 CustomerSelector, OrderModelSelector | components/ | NO shared popover | - | partial | OK |
| D6 permission ItemInfo | permissions/ItemInfo.js | NO (role=dialog, not Tip) | NO | NO | n.a. |
| C9 legacy CSS | globals.css:936/1001/1065/1327 | not cleaned | - | - | - |

### 2c. Arrow / chevron inventory (RTL: previous -> right, next/forward -> left)
| Location | Glyph direction | Meaning | RTL-correct? |
|---|---|---|---|
| Pagination (alterations, customers, dresses, orders, rentals, refunds); month/day nav (board, deliveries, employees, kiosk); AppShell back/forward | prev = chevron-end (right), next = chevron-start (left) | prev/next | OK |
| `icon="back"` (-> chevron-start, LEFT): orders/new:1668, orders/[id]:1064, customers/[id]:278, profile:146, ModernCustomerCard:76, StepNav back (Stepper.js:63) | left | back | WRONG |
| `next` (-> chevron-end, RIGHT): orders/new:1660 and :2419, home page.js:567/600/628, StepNav next (Stepper.js:60) | right | forward | WRONG |
| `arrow-end` (right) as BACK: employees/[id]:386, employees/report:169, ModernDressCard:57 | right | back | OK (accidental) |
| `arrow-end` as FORWARD/submit: LoginScreen:420, TopbarSearch:207 | right | go | WRONG |
| Banner action chevron-end (Feedback.js:26) | right | "more" | WRONG |
| Accordion/sort/expand chevron-down + rotate(180) | vertical | - | OK |
| Text " <- " before/after and ranges (ChangesChips:101, ModernItemsManager:1381, HebrewDateRangePicker:320, HistoryFeed:77, history/adapter.js x4, refund-planner/shared:248) | left | from -> to in RTL run | OK |
| `&raquo;` breadcrumb ModernNewDressWizard:277 | bidi-mirrored | - | OK |

StepNav is the most damaging (every stepper flow). Root cause: alias names `back/next/arrow` defined LTR-style, never validated in RTL; R17's getBoundingClientRect check verifies layout, not glyph geometry.

## 3. Root causes
1. Work split by page family; shared layers (PopupProvider, Modern*Manager, RentalReturnModal, date pickers) belonged to nobody, so each family built local wrappers.
2. R19/R20 delivered as "visuals + design docs"; wiring (PopupProvider redirect, API patch, bell, MessageCard feed) skipped or half done. The notify README says "not yet connected".
3. An API-touching item was parked for a user decision (Q-N1) while the client half shipped anyway (finding 4).
4. Q3 reduced dark mode to a dialog-only prop and left base tokens light-only, so "dark foundational" was structurally impossible.
5. Icon vocabulary inherited from LTR, never validated in RTL.
6. Verification reports (reports/verify-*.md) checked call-signature parity (R24), not whether the designed dialog/notice/message structure exists, so re-skinned content passed.

## 4. Proposed rebuild sequence (8 steps)
1. **Defuse the risk (hours):** apply notify-api-patch.md (self-only, no email, dedupe, `isRead:true`) + `/messages` filter + bell styling, or default `persistToBell:false` until then. Delete the `.v3-toast` leftover at orders/[id]:1601.
2. **Theme foundation:** real dark token layer (`html[data-theme="dark"]` remaps surface/ink/line/sky tokens); `Dialog` derives mode from the document theme (context + MutationObserver) for confirm/code/sheet, `form` forced light; delete per-call `mode=` and `dlgMode()`.
3. **One `DialogProvider`** replacing PopupProvider's UI with identical `window.customConfirm/Prompt/AuthPrompt/ThreeWayConfirm/alert` signatures plus a `window.confirm/prompt` override; build `Dialog.Code` (approver combobox + CodeInput). The six hooks become thin re-exports. Converts ~100 call sites and closes all native-confirm gaps.
4. **Route `alert()`/showAlert to the notify layer**; feed `V3MessagesToast` from ShiftMessageWatcher and the login "N messages" flag (same `/api/notifications/handle`); NoticeBar gets light/dark variants per theme.
5. **Popover + Combobox primitives**; migrate date pickers (light popover/sheet), CustomerSelector, OrderModelSelector, permission ItemInfo (-> Tip).
6. **Sweep the ~24 modal-backdrop files** onto Dialog (SendEmailModal, RentalReturnModal, ModernRentalsManager, PrintWizardModal, ExportButtons, CapacitySearchModal, ErrorReportButton, SettingQuickPanel, Overdue/MessageHistory/Statistics/FullEmailList, AI widget), then delete legacy `.modal-*`, `.popup-*`, `.global-popover` CSS.
7. **Arrow fix in one place:** `back` = right-pointing, `next`/`arrow` = left-pointing under `[dir=rtl]` (swap alias targets or mirror via CSS); migrate hand-swapped usages to semantic names; gallery test checks glyph geometry, not only rects.
8. **Per-file acceptance:** no `modal-backdrop`, no `alert(` / `confirm(`, Dialog imported, dark+light screenshot pair for confirm/code, light-only for form.

## 5. Admin (lower priority)
- HISTORICAL (design-v2 obsolete): the 21 old mocks (18 admin-*, 3 mgmt-*) were the v2 design system, not sketch B; they are not a target. The admin-hub mock grouped ~20 tiles into four sections (insights, control/alerts, data, system); real `/admin` is four cards + EmailListCard with legacy inline styles, grouping lives in `/admin/site`.
- Real state: zero v3 usage in app/admin and app/management. Routes: access-import, ai, ai-history, ai-restrictions, audit-system, backups, barcode-invalid, bulk-email, data-explorer(+full-view), data-history, database, departments, email-test, inventory-alerts, labels, nedarim-* (6), permissions, recalculations, refund-planner, refund-policy, refund-simulator, settings(+help), setup-new-machine, site, site-settings, statistics, trusted-devices; management: database, email-logs, history.
- Leftovers: 5 admin viewers on modal-backdrop/portals; 7 native `window.confirm`; raw `alert(` in departments (8), recalculations (7), data-explorer (5); nothing uses Dialog/Tip/Card/Table; refund-planner (365 lines) and refund-simulator (169 lines) ship private CSS instead of kit components.
- Suggested order after non-admin: hub -> settings -> permissions(+wizard) -> statistics/data-explorer -> small tool pages, reusing DialogProvider/Popover.

## 6. Information / history / notification data: needs vs what exists

Per the user: flag a data-shaping need only where the comparison proves it; never schema-destructive.

| # | Designed behavior | What exists (evidence) | Verdict | Least invasive supply |
|---|---|---|---|---|
| 1 | Save -> toast (15s gold timer) -> note in notifications log | Timer/queue/dedupe are client-only (store.js): UI-only, done. `Notification` model (schema.prisma:176) has receiverId/title/content/free-string category/isRead: no schema change needed. But `POST /api/notifications` (route.js:128-171) always emails (`sendEmail` destructured, unused) and unknown category + no receiverId = broadcast (code). | Needs a small API branch (behavior, not schema). | (a) Recommended: ~10-line `activity_note` branch drafted in reports/notify-api-patch.md (self sender+receiver, no email, 60s dedupe, isRead:true). (b) Zero-server interim: per-employee note log in localStorage rendered in the bell (no cross-device, no data risk). |
| 1b | Bell note with link | No href column; design encodes `\n↩ /path` in content. `tags` are per-employee user tags, not a fit. | UI-only parsing, brittle. | Parse last line in bell. |
| 1c | Bell counts/refresh | `GET ?light=1` returns unreadCount for own receiverId; `isRead:true` notes never light the dot; list returns latest 150 (own + broadcast). | Available. Risk: many notes crowd real messages out of the 150 window; `/messages` needs `!== 'activity_note'`. | Client filter; if crowding measured, add read-only category-exclusion param to GET. |
| 1d | Audit side effect | Prisma extension logs every write except AuditLog/PageVisitLog/Shift/BackupRun (app/lib/prisma.js:108): each note adds a `Notification CREATE` AuditLog row. | Compat side effect, not a blocker; adapter already maps Notification to category `sys` (adapter.js:48). | Filter entityType=Notification in feeds; no manual AuditLog writes. |
| 2 | Per-entity history feed (hf-*) | `/api/audit` supports entityType/entityId/entityIds/actions/dates/search/page/limit; adapter does replay, sentences, day grouping, amounts on the client from 5 parallel existing GETs; HistoryViewer already imports it. | UI-only / already available (order, customer, dress, employee cards). | none |
| 2b | Global recent-actions feed (admin/data-history, dashboard) | No-entityType `/api/audit` works, but OrderItem/Payment/PaymentObligation/Refund rows lack the order number in a column (HISTORY-DESIGN 1.4) and item names; Employee rows filtered for non-head-management. | Data-shaping need proven, read-side only. | Read-only enrichment endpoint (e.g. GET /api/audit/recent) batching entityIds -> Order/Item lookups, returning orderId, customer name, item label. No schema change, no new writes. |
| 3 | Debts through alerts | Debt is derived, not an event: `/refunds` debts tab loads `/api/orders?...` (refunds/page.js:36,346), approvals from `/api/audit?actions=DEBT_APPROVED,...` (:285); orders/[id] computes balance client-side; the only "new debt" moment is the save-time dialog/warn notice (orders/[id]:970). `notifyManagers` writes Notification rows only for rentals, never debts. | Save-time debt notice: UI-only, done. Standing "open debts" alert: needs a read endpoint or event-time writes. | Read-only count/summary GET reusing the debts-tab query, shown as a bell/topbar chip. Avoid writing Notification rows from order/payment routes (touches core logic, violates R8, duplicates derivable state). Persisting the save-time note via item 1 is fine. |
| 4 | Sketch bell items: rental returns tomorrow, credit registered, alteration done | Not persisted as notifications. Sources exist: `/api/orders/overdue`, audit actions AUTO_CREDIT_REFUND_CREATED / ALTERATION_DONE, orders with return date tomorrow. | Sketch demo content; not a feed today. Confirm with the user whether the bell must show derived events. | If required: read-only "derived alerts" GET unioning the sources; no backfill writes. |
| 5 | R21 bottom-left messages | `GET /api/notifications` returns sender, title, content, category, handled state; `/handle` and `/read` exist. | UI-only / available. | Feed V3MessagesToast from the existing poll + ShiftMessageWatcher; "arrived while working" popup compares `unreadCount` from `?light=1`, no API change. |

Compatibility risks: (1) current client + current route = broadcast + email spam; (2) 150-item window crowding; (3) `/messages` and bell must ignore/style `activity_note`; (4) extra `Notification CREATE` audit rows in global history; (5) noise-row suppression changes visible counts vs the old viewer (keep a "show all" switch for managers); (6) `FIELD_TRANSLATIONS`/`ACTION_TRANSLATIONS` exports used by 5 files; (7) `/refunds` reads audit for debt logic, never alter those calls; (8) `hideInternalMessaging` orgs must not persist notes; (9) both gemachs deploy the same code, so any new branch must be inert where settings are off.

## 7. Responsive behavior (phone / tablet / desktop / short windows)

Good (components.css): `Dialog` <=640px = bottom sheet (90dvh, grab handle, sticky actions with `env(safe-area-inset-bottom)`); `form` = full-screen 100dvh with sticky action bar; desktop `max-height: calc(100dvh - 24px)` with inner scroll and `overscroll-behavior: contain`; `max-height:640px` rule keeps actions sticky; combobox/filter panels become bottom sheets (<=640, 75-80vh/dvh); tap token 44px; focus trap and scroll lock.

Gaps:
| # | Component | Gap |
|---|---|---|
| R1 | Notice region `.v3n-region` | Only `left:24px;bottom:24px` and <=640 `bottom:88px`; no safe-area insets; physical `left` ignores landscape notch. At 641-1020px the order-card rail is a fixed bottom sheet (components.css:586-592, up to 82vh) and the notice overlaps/hides behind it; on phones 88px is a guess and can cover rail actions or sticky StepNav. Needs a shared bottom-stack offset var. |
| R2 | Notice hit targets | Close button 30px (+6px pseudo = 42px) below the 44px token; no max-height for 3 stacked items on short windows (~330px of a 500px-tall landscape phone). |
| R3 | Notice vs dialogs | `body:has(.v3-scrim.is-on)` drops region to z 90 (under scrim): a notice raised while a dialog is open is hidden while its absolute 15s timer runs, so it can expire unseen. `:has()` support on older tablets. |
| R4 | Bell panel | `.v3-tb-bell` 380px (capped 100vw-16px) and `.v3-tb-scroll {max-height:350px}` (v3-shell.css:53,86) not dvh-aware: on ~500px height the panel overflows; no bottom-sheet form on phones. |
| R5 | Topbar panels / user menu / search results | Absolute dropdowns with horizontal cap but no vertical cap or flip. |
| R6 | Tip / rich-tip | `max-height: calc(100vh - 16px)` + `overflow:hidden` (clips, no scroll), `vh` not `dvh`; untested at 320px. |
| R7 | Legacy modals (24 files + PopupProvider) | Old `.modal` sizing: no bottom sheet, no safe-area, inline zIndex 10000, fixed-pixel panels (AI widget 380x550 exceeds short/phone viewports). |
| R8 | Full-screen form dialogs on phones | `100dvh` but on-screen keyboard (visual viewport) not handled; sticky actions can hide behind the keyboard on iOS. |
| R9 | Landscape phones (641-900w, <=420h) | Desktop centered mode with only the max-height:640 patch; badge+title+rows can exceed height; no compact variant. |
| R10 | vh vs dvh | rail `calc(100vh...)`, `.v3-popover` 70vh, combo 75vh/55vh, rich-tip: mixed; iOS toolbar collapse clips sheets. |

Not verified in a browser (no dev servers per the brief); a gallery pass with resize presets plus a custom 375x500 size would confirm R1-R4, R8, R9.

## 8. Evidence pointers
PopupProvider legacy: app/components/PopupProvider.js (alert override ~:199, toast-stack, modals). Notice flow: app/v3/notify/store.js (persistNote:76-95), V3NotifyProvider.js, app/components/V3NotifyHost.js, app/layout.js:640. API gap: app/api/notifications/route.js:128-171 vs docs/redesign-v3/reports/notify-api-patch.md. Dialog: app/v3/ui/Dialog.js. Arrows: app/v3/ui/Icon.js:11-12, app/components/IconSprite.js:27-28,69, app/v3/ui/Stepper.js:60-63. Theme scope: app/v3/tokens.css:11,343; QUESTIONS.md Q3. Responsive: app/v3/components.css:586-598, 740-744, 900-916, 971; app/components/v3-shell.css:53,86; notify.css. History: HISTORY-DESIGN.md sections 1.4, 3.1, 5, 6; app/v3/history/adapter.js:48; app/lib/prisma.js:108.
