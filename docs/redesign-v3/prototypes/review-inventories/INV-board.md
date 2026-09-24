# Functional inventory: `/board` (לוח חודשי)

Source: checkout of origin/main at `scratchpad/main`. All paths are relative to that root. Main file: `app/board/page.js` (1115 lines, one client component, `'use client'`).

---

## 1. Route, gates, permissions

- **I-01** Server gate: `app/board/layout.js:5-6` wraps the page in `<PageGate pageKey="page:board">`. `app/components/PageGate.js:8-12` calls `canOpenPage(key)` and renders `<NoAccessMessage/>` (page head "אין הרשאת גישה", `app/components/NoAccessMessage.js:11-17`) when it returns false.
- **I-02** `canOpenPage` (`lib/permissions.js:286-305`): with no verified auth cookie it returns `checkAuth()` (so an anonymous visitor gets in only while `require_login` is off). For a verified employee, roleId comes from the signed session (or the DB employee row), then `resolvePageAccess(roleId, employeeId, ['page:board'])`. Any exception means deny.
- **I-03** Resolution order (`lib/permissions.js:271-282`): roleId 0/2 (`ALWAYS_ALLOWED_ROLE_IDS`) always allowed. Then the employee override, then the department row (an explicit false denies), then the catalog default. There is an 8s per-instance cache (`lib/permissions.js:44-45, 255-269`).
- **I-04** Catalog item `page:board` (`lib/permissionsMetadata.js:149-160`): label "לוח חודשי", route `/board`, `enforced: true`, `defaultForRoleId: () => false`. Since 2026-09-22 it is closed by default: only head management and programmer get in unless a permission row grants access.
- **I-05** Sidebar link: `app/components/navConfig.js:56` (`{ href: '/board', label: 'לוח חודשי', icon: 'i-calendar', gate: 'showBoardTab' }`), in the unlabeled "people" group. `app/layout.js:199,215-218` sets `showBoardTab = isAuthenticated ? (pageAccess ? pageAccess['page:board'] : isHeadManagement) : !requireLogin`. The link therefore uses the same rule as the gate. If the permission lookup fails, the fallback is head-management-only.
- **I-06** `restrict_board_to_managers` is **not read anywhere in code**. It appears only in `lib/settingsMetadata.js:199` (label), `:265` (help text: "לא בשימוש (2026-09-22) … ההגדרה הזו כבר לא נקראת בשום קוד") and `:440` (the "unused" list). `app/layout.js:162` also has a comment saying the restrict_* settings are no longer read.
- **I-07** Data-API auth is separate from the page gate. `GET /api/orders` only requires `checkAuth()` (`app/api/orders/route.js:19`), and so does `GET /api/orders/print-prep` (`app/api/orders/print-prep/route.js:34`). `page:board` does not protect the data.
- **I-08** AI search needs `checkAiAccess()` (`app/api/ai/smart-search/route.js:70`); without it the route returns 403.

## 2. Data loading

- **I-09** Main fetch: `fetchOrdersForMonth` (`app/board/page.js:149-200`) → `GET /api/orders?<params>` (`:178`). An AbortController cancels the previous in-flight request when the month changes quickly (`:119-122, 152-157, 189-198`).
- **I-10** Params come from `buildBoardMonthParams(selectedDate, { search, advFilters })` (`app/lib/prefetchRoutes.js:168-199`):
  - Range: the Hebrew month containing `selectedDate` (day 1 to `daysInMonth`), **padded by 14 days on each side** (`:176-183`).
  - `eventDateFrom`/`eventDateTo` as ISO strings, `filterStatus=all`, `limit=2000` (`:185-190`).
  - `search` is added when set (`:192`), and every non-empty `advFilters` entry is appended (`:194-196`).
  - No `sort`/`order` is sent, so the API defaults apply: `sort=eventDate`, `order=desc` (`app/api/orders/route.js:23-24`).
- **I-11** Server filtering for these params (`app/api/orders/route.js:141-297`):
  - `isDeleted:false` (`:145`).
  - The eventDate gte/lte range (`:231-237`).
  - The default "last 3 months" clamp is skipped because date params are present (`:151`).
  - `search`: orderId exact, first/last name contains, dress model name, model-barcode prefixes, multi-word full name (`:202-217`).
  - Advanced filters: `advOrderId` exact (`:219`), `customerName` (`:220-229`), `customerPhone` phone1/phone2 (`:230-...`), `customerCity` (`:231`), `itemDetails` barcode/description/model name (`:239-...`).
- **I-12** `hide_taken_orders_from_orders_list` also applies to the board because it runs for `filterStatus==='all'` without `forRentals` (`app/api/orders/route.js:293-298`). When that setting is `'true'`, orders whose active items are **all taken** (including fully returned ones) disappear from the board.
- **I-13** Draft (`'טיוטה'`) and reserved-placeholder (`'שמור לחיוב'`) orders are **not excluded** by this GET. The only extra condition is `isDeleted:false`. `DRAFT_ORDER_STATUS`/`RESERVED_ORDER_STATUS` (`lib/orderReservation.js:5,19`) are filtered only for `filterStatus=drafts|deleted` (`route.js:142-147`).
- **I-14** Response fields the board uses (`app/api/orders/route.js:562-634`):
  - Order: `orderId`, `customerId`, `totalAmount`, `totalPaid`, `eventDate`, `eventDateHebrew`, `customSpacing`, `customerName`, `customerPhone`.
  - `items[]`: `isTaken`, `isReturned`, `isDeleted`, `neckAlteration`, `lengthAlteration`, `sleeveAlteration`, `alterationDetails`.
  - `totalAmount` is `order.totalAmount` if > 0, otherwise the sum of obligations, otherwise the sum of payments (`:560-562`). `totalPaid` is the sum of non-deleted payments.
  - `customerPhone` is phone1, falling back to phone2 (`:629`).
- **I-15** The page reads `data.data`, falling back to `data.orders` (`page.js:184-188`).
- **I-16** Cache: `boardCache = cacheNamespace('board')` (`page.js:13,18`), keyed by the query string (`:164`). On a cache hit, orders are shown instantly without a spinner and still re-fetched (SWR), then the cache is updated (`:166-182`). pageCache has no TTL (`app/lib/pageCache.js:7`).
- **I-17** Prefetch: the `'/board'` prefetcher warms the current month's key (`app/lib/prefetchRoutes.js:243-247`). `ROUTE_NEIGHBORS['/orders']` includes `/board`, and `/board` warms `/orders` (`:275,277`).
- **I-18** Settings: `fetchSharedJson('/api/settings', { ttl: TTL.STATIC })` (5 min, `lib/apiCache.js:54`) on mount (`page.js:99-112`). It reads `enable_alterations`, `hide_custom_spacing` and `enable_batch_print_prep`. Errors only go to `console.error`.
- **I-19** Other fetches:
  - Global search: `GET /api/orders?search=<text>&limit=100&filterStatus=all` (`page.js:138`). `search` is set, so the server skips its default "eventDate ≥ 3 months ago" clamp (`route.js:151`) and the search covers all time.
  - AI: `POST /api/ai/smart-search {prompt, pageContext:'board'}` (`page.js:215-219`).
  - Statistics: `POST /api/ai/statistics` from StatisticsModal (`app/components/StatisticsModal.js:158`) with `pageContext:'board'`.
  - RentalReturnModal: `GET /api/orders/{orderId}` plus the rentals/returns endpoints (`components/orders/RentalReturnModal.js:56,88,140,169,353,381,391,410,430,445,480,534`).
  - Print wizard: `GET /api/orders/print-prep` (`app/components/PrintWizardModal.js:104`).

## 3. Period navigation

- **I-20** **Month view only.** There is no week, day or list view. The period is always one **Hebrew** month (`renderCalendar`, `page.js:408-441`).
- **I-21** Initial state is `selectedDate = new Date()` (today) (`page.js:51`). No URL param or persisted month exists: the page always opens on the current Hebrew month.
- **I-22** Prev/next buttons (`page.js:597-606`, titles "חודש קודם"/"חודש הבא", chevron icons) call `changeMonth(±1)` (`:259-271`). It takes the 15th of the current Hebrew month, adds ±30 days, then goes to the first of that Hebrew month. If hebcal fails, it falls back to a Gregorian `setMonth`. Hebrew leap years (Adar I/II) are handled by hebcal.
- **I-23** The header label is `getHebrewMonthYear(selectedDate)` (`page.js:585,601`; `lib/hebrewDate.js:94-107`), e.g. "תשרי תשפ״ז". Hebrew only: the Gregorian month is not shown in the header.
- **I-24** Jump to date: `<HebrewDatePicker value={jumpDate} onChange={setJumpDate} iconOnly placeholder="קפוץ לתאריך...">` next to the month label (`page.js:602`). The picker emits `YYYY-MM-DD` (`components/HebrewDatePicker.js:132,152`). A `useEffect` on `jumpDate` sets `selectedDate` (`page.js:124-128`).
- **I-25** There is no "back to today" button.
- **I-26** Today marker: the cell whose Gregorian date's `toDateString()` equals today gets a 2px `--primary-solid` border with a ring, and its day number turns primary (`page.js:460,510,526`). A late or highlighted style overrides it (I-37).
- **I-27** Week starts on Sunday. The header row is "ראשון … שבת" (`page.js:444-448`); the page is RTL, so Sunday is on the right.

## 4. Grid and cells

- **I-28** The grid is `repeat(7, minmax(0,1fr))` with an 8px gap (`page.js:450`). Leading and trailing blanks are dashed `--surface-alt` placeholder cards with `minHeight:130px` (`:425-440,453`). Only the days of the Hebrew month are shown; padding days from neighboring months are **not** rendered, even though their orders are fetched (I-10).
- **I-29** Each cell (`page.js:514-576`) shows:
  - The Hebrew day in gematriya: the first token of `renderGematriya()` (`:481-484`).
  - An order-count number (muted, title "מספר הזמנות ליום זה") when the day has more than 0 orders (`:527-529`).
  - An expand button when there are **more than 2** orders (`:530-546`).
  - A per-day print button when there is at least one order **and** `enableBatchPrintPrep` is on (`:547-559`).
  - The Gregorian `d/m` on the far side (`:561`).
- **I-30** Parasha badge: only in the Saturday column (`j===6`), from `new Sedra(hYear, true)` (Israel schedule), with Hebrew names joined by "-" (`page.js:486-495,566`).
- **I-31** Holiday badges: `HebrewCalendar.getHolidaysOnDate(cellHDate, true)` (Israel) (`page.js:497-507,567-569`).
  - Excluded: modern holidays (flag 8192) and names containing "בנות", "מעשר בהמה" or "סליחות".
  - Kept: flags 1 (CHAG), 524288 (MINOR_HOLIDAY), 2097152 (CHOL_HAMOED), 16384 (MAJOR_FAST), 256 (MINOR_FAST).
  - Rosh Chodesh and Erev days are therefore not shown.
- **I-32** Orders are placed by **`eventDate` only**. They are grouped by `new Date(order.eventDate).toLocaleDateString('en-CA')` (browser-local YYYY-MM-DD) (`page.js:321-333`).
  - Orders with no `eventDate` are dropped.
  - `fromDate`/`toDate` (abroad or range orders) and delivery dates are **not** used, so a multi-day rental shows only on its event day.
  - Placement depends on the browser timezone. It is correct for Israel-time browsers, given the stored 21:00/22:00 UTC and 00:00 UTC conventions.
- **I-33** Order order within a day follows the API response: `eventDate desc` (I-10). There is no secondary sort.
- **I-34** Order card (`renderOrderCard`, `page.js:335-406`):
  - Row 1: customer name (`customerName`, falling back to `customer.firstName lastName`, ellipsis) and `#orderId`.
  - Row 2: a category badge with icon (hidden for category `other`) and an info (ⓘ) button.
  - The native `title` tooltip is "סטטוס / סה"כ ₪ / שולם ₪" (`:365`).
  - Styling: a 3px inline-start border in the category color, or a full 2px danger border plus a danger-colored name/number and an alert icon when the order is late (`:363,373-378`).
- **I-35** Category logic, local to this page (`getOrderCategory`, `page.js:287-306`). It does **not** use `lib/orderStatus.js`. Checked in priority order:
  1. `empty`: no items at all. Deleted items count here, because `order.items.length` is used unfiltered.
  2. `returned`: all non-deleted items returned.
  3. `rented`: any item taken or returned (all/some taken, or some returned).
  4. `repairs`: `enable_alterations` on and any item with neck/length/sleeve alteration or alterationDetails. Deleted items are included.
  5. `unpaid`: `totalPaid < totalAmount`.
  6. `completed`: `totalAmount > 0` and paid ≥ total.
  7. `other`.
- **I-36** Category style map (`CATEGORY_STYLE`, `page.js:39-47`):

  | Category | Label | Badge | Icon |
  |---|---|---|---|
  | empty | "הזמנה פגומה (0 פריטים)" | danger | alert-tri |
  | repairs | "יש תיקונים" | primary | scissors |
  | unpaid | "לא שולם" | warning | alert-circle |
  | returned | "הוחזר" | success | check-circle |
  | rented | "מושכר/חלקית" | info | truck |
  | completed | "הושלם (שולם)" | success | wallet |
  | other | "אחר" | neutral | more |

  Labels are at `:308-318`. `returned` and `completed` share the same success color and differ only by icon.
- **I-37** "Late" rule, duplicated in the card (`page.js:337-350`) and the cell (`:463-479`): an order with any non-deleted item that is taken but not returned, and today minus the event day (local midnight) greater than 2 days.
  - Late cell: 2px danger border and ring, plus a red round "!" badge at the top inline-end corner (`:511,516-523`).
  - Style precedence: today < late < highlighted (`:510-512`).
- **I-38** Legend row "מקרא:" (`page.js:680-692`): badges for repairs (only when `enableAlterations`), unpaid, rented, returned, completed, other. **`empty` is not in the legend.** The legend has no explanation for late (red border / "!") or the today marker.
- **I-39** Overflow: the cell is `minHeight:130px; overflow:hidden` and the order list is `maxHeight:150px; overflowY:auto` (`page.js:509,573`). The list scrolls inside the cell; the expand modal is also available for more than 2 orders.
- **I-40** Unused CSS: `--cat-*-bg/border/text` tokens are defined for the board in `app/globals.css:49-58` but are no longer referenced; the page uses semantic `--danger/--primary/...` via `CATEGORY_STYLE`.

## 5. Interactions

- **I-41** Clicking a card opens the action menu popover (`page.js:366-370,1054-1112`). It is portaled to body, `position:absolute` at the card's bottom-left in page coordinates, with no viewport clamping. A transparent full-screen overlay closes it on outside click. Contents:
  - Header "הזמנה #orderId".
  - "כרטיס הזמנה": a Link to `/orders/{orderId}`, same tab.
  - "כרטיס לקוח": a Link to `/customers/{customerId UUID}`, only if a customerId exists.
  - "כרטיס השכרה": opens `RentalReturnModal` for the orderId and closes the day modal (`:1096-1108`).
- **I-42** Hovering the ⓘ button opens a portaled `position:fixed` popover above the button (`pointerEvents:none`, max 320px) (`page.js:389-402,703-801`). Clicking ⓘ only stops propagation. Popover rows:
  - "פרטים על הזמנה #…".
  - "לקוח:" label, then "טלפון:" `customerPhone` or "לא הוזן". The customer name is never rendered (see I-66).
  - "תאריך עברי:" `eventDateHebrew`.
  - "תאריך לועזי:" (he-IL).
  - "ציפוף ימים": a warning badge, only if `customSpacing` is non-null and `hide_custom_spacing` is not 'true'.
  - "פריטים בהזמנה" (non-deleted count), "הושכר" (taken count), "הוחזר" (returned count).
  - "סה"כ לתשלום" ₪.
  - "שולם" ₪, colored green if fully paid and total > 0, orange if partially paid, red if nothing paid.
  - "סטטוס" (category label in the category color).
- **I-43** RentalReturnModal (`page.js:1038-1044`) is the full rental/return scan modal (`components/orders/RentalReturnModal.js`, 1108 lines). `onUpdate` re-fetches the month.
- **I-44** Per-day quick print (`printDayOrders`, `page.js:278-285`) opens `window.open('/print/order?orderId=<comma list of the cell's orderIds>&type=order&batch=1', '_blank')`. It uses the cell's loaded orders, which may be filtered by search/advFilters or AI, and makes no API call. It is shown in the cell header (`:547-559`) and in the day-modal header (`:987-991`), only when `enable_batch_print_prep` is on.
- **I-45** Header print button "הדפסת הזמנות להכנה" is shown only when `enableBatchPrintPrep` is on (`page.js:607-611`). It opens `PrintWizardModal` with `defaultReportType='order_prep_by_date'` (`:1046-1052`). With the setting off there is **no way to open the print wizard from the board**.
- **I-46** PrintWizardModal from the board (`app/components/PrintWizardModal.js`):
  - Report types: alterations_pending, alterations_all, orders_no_alterations, orders_all, labels, and order_prep_by_date (the last only when enabled) (`:18-27,49`).
  - Prep date modes: "הכנות להיום" (default, `/api/orders/print-prep?date=today`, prep mode = 3 business days before the event), "תאריך אחר" (`mode=event`) and "טווח תאריכים" (`from/to&mode=event`) (`:38-42,80-121`). Results open `/print/order?orderId=…&type=order&batch=1`.
  - Other report types go to `/print/alterations?reportType&dateMode…` or a server PDF (`:124-183`).
  - The board passes no `getCurrentOrderIds` or default dates, so "הנתונים המוצגים כעת" for non-prep reports sends no date or ids (`:141-157`). It does **not** reflect the displayed month.
- **I-47** The expand-day modal (`page.js:970-1036`, see I-56) re-uses the same order cards, so card clicks, hover and the action menu work inside it.
- **I-48** No drag-and-drop, no multi-select, no inline editing, no "new order on this day" action, and no keyboard navigation in the grid. `useRouter` is imported and assigned but never used (`page.js:5,50`).

## 6. Filters, search, toggles

- **I-49** Normal search form (`page.js:647-669`): placeholder "חיפוש הזמנה (מספר הזמנה, שם לקוח)...". Submit sets `search` and `isAiModeActive=false` (`:206-210`), which re-fetches the **current month** filtered.
  - An X button (shown only when the input has text) clears search and AI mode (`:236-242,656-660`).
  - No indicator shows that the grid is currently filtered.
- **I-50** The AI toggle (star) swaps the bar to AI input mode (`page.js:244-251,617-645`). Placeholder "בקש מה-AI למצוא נתונים…", submit "חפש בחכמה" / "מייצר שאילתה...", with a spinner while loading. On success, `orders = result.data` and `isAiModeActive=true`, and the monthly fetch is suppressed (`:150,221-224`). Errors are shown via `alert` (`:226,230`).
- **I-51** The stats button (activity icon) is in both bar modes and opens `StatisticsModal` at the click position, with `pageContext="board"` and `contextQuery=aiQueryUsed` (`page.js:638-640,664-666,962-968`). The greeting falls back to "…של המערכת" (`StatisticsModal.js:89`).
- **I-52** Global search button (search icon, title "חיפוש בכל החודשים (גלובלי)") (`page.js:672-674`). It alerts if the search input is empty, otherwise opens the global-results modal (I-57).
- **I-53** Advanced search button (list icon) opens the modal (I-55). The advanced filters live in `advFilters`, which is a dependency of `fetchOrdersForMonth`. **Every keystroke in the modal re-fetches immediately.** "החל סינון" only closes the modal, or runs the AI prompt.
- **I-54** There are no status, category, employee, branch or delivery filters and no toggles (such as hiding returned orders) on the board.

## 7. Dialogs

- **I-55** Advanced search modal "חיפוש מתקדם" (`page.js:803-903`), portaled, 640px, closes on backdrop click.
  - Tab "תאריך והזמנה": מתאריך אירוע / עד תאריך אירוע (HebrewDatePicker), מספר הזמנה, ברקוד/פרטי פריט.
  - Tab "פרטי לקוח": שם לקוח, טלפון לקוח, עיר מגורים.
  - Checkbox "חפש עם AI על השדות שמולאו" (`ai-feature-element`, hidden when `hide_ai_features`). When checked, "החל סינון" builds a Hebrew prompt (`buildBoardAiPrompt`, `:23-35`) and calls AI search.
  - Buttons "נקה הכל" and "החל סינון".
- **I-56** Day modal "הזמנות ליום <he-IL date> (<gematriya day>)" (`page.js:970-1036`), 520px/90%, max 80vh, z-index 9998. It has an optional print button, a close button, and a local filter input "חיפוש הזמנה ביום זה (שם, טלפון, מספר)…" (name, phone or orderId substring) with a clear X, and lists the order cards. Closing resets the filter. It is only reachable when the day has more than 2 orders.
- **I-57** Global search results modal "תוצאות חיפוש גלובלי" (`page.js:905-960`). It shows a spinner "טוען תוצאות...", or a list: "הזמנה #id - name" plus the Hebrew or Gregorian event date.
  - "קפוץ לחודש" sets `jumpDate`, which navigates the grid, and closes the modal. It only works when `eventDate` exists.
  - "צפה בהזמנה" opens `/orders/{orderId}` in a new tab.
  - Empty state: "לא נמצאו תוצאות לחיפוש: "…"".
- **I-58** Also: StatisticsModal (I-51), RentalReturnModal (I-43), PrintWizardModal (I-46), the action menu (I-41) and the hover popover (I-42).

## 8. Loading, empty and error states

- **I-59** Loading: the initial `loading=true`, so the first render shows the spinner "טוען נתונים..." instead of the grid (`page.js:53-55,694-701`).
  - When changing to an uncached month, the grid is replaced by the spinner.
  - A cached month shows instantly with no spinner.
  - Only the current (non-aborted) request clears loading (`:195-198`).
  - AI search has a spinner in the bar but the grid stays.
- **I-60** Empty: there is **no empty-state message**. A month (or filtered search) with no orders renders an empty grid. AI results with no `eventDate` (see I-65) also render an empty grid.
- **I-61** Error: the monthly fetch shows **no UI**; errors are only `console.error` (`page.js:189-192`).
  - A non-OK JSON response (for example 401 `{error}`) has neither `data` nor `orders`, so the **previous month's orders stay displayed** under the new month label (`:184-188`).
  - Global search errors are logged only, and the modal then shows the "no results" state.
  - AI and stats errors use `alert`.

## 9. SystemSetting keys and org-dependent behavior

- **I-62** Settings keys the board and its APIs use:

  | Key | Where read | Effect | Default |
  |---|---|---|---|
  | `enable_alterations` | client, `page.js:102-105` | When 'false': no "repairs" category, repairs badge removed from the legend | true (anything but 'false') |
  | `hide_custom_spacing` | client, `page.js:106-107,746` | When 'true': the "ציפוף ימים" row is hidden in the popover | false. Semantics are inverted in the admin label: `lib/settingsMetadata.js:58` "אפשר ציפוף ימים מיוחד", `:310` says ON = spacing allowed, `app/admin/settings/help/page.js:4` documents the inversion. The board treats 'true' as hide. |
  | `enable_batch_print_prep` | client, `page.js:108-109` | Header print wizard button, per-day print buttons, day-modal print button, and the `order_prep_by_date` option | false. Per CLAUDE.md: org1 = false, org2 (Neve Yaakov) = true. |
  | `hide_taken_orders_from_orders_list` | server, `route.js:294` | Fully-taken orders disappear from the board too | off |
  | `hide_ai_features` | `app/layout.js:281`, class `hide-ai-features` → `.ai-feature-element{display:none}` (`app/globals.css:1820`) | On the board this hides only the advanced-modal AI checkbox | — |
  | `require_login` | via `checkAuth`/`canOpenPage` | Anonymous access allowed only when off | — |
  | `restrict_board_to_managers` | nowhere | Retired (I-06) | — |

- **I-63** The practical org difference on the board: Neve Yaakov sees the print buttons and batch print prep (and possibly hidden fully-taken orders, if `hide_taken_orders_from_orders_list` is on there); the main gemach sees none of the print UI. Access per org is decided by `page:board` DepartmentPermission rows, which are closed by default.

## 10. Responsive and mobile behavior today

- **I-64** There are no board-specific media queries.
  - The grid is always 7 columns (`minmax(0,1fr)`) with 130px minimum cell height. On a phone each column is about 40px wide, so cards (name, #id, badge, ⓘ) are heavily truncated by ellipsis and `overflow:hidden`.
  - The generic design-system rules at ≤640px (`app/design-system.css:1275-1287`) stack `.page-head`, make `.page-actions` full width and stretch its buttons. The `.toolbar` wraps (`:333`); the search form has `minWidth:260px`.
  - The hover popover depends on `mouseenter`, which is unreliable on touch.
  - The action menu is absolute-positioned with no viewport clamping, so it can overflow off-screen near the left edge.
  - Modals get `max-width:100%` and 14px padding at ≤640px.

## 11. Notable, buggy or surprising (facts from code)

- **I-65** **AI search on the board queries the wrong table.** `pageContext:'board'` is not in `SCHEMA_MAP`/`TABLE_MAP` (`app/api/ai/smart-search/route.js:32-37,61-66`), so the route falls back to `customers`/`"Customer"` (`:82-83`). It returns Customer rows, and order hydration runs only for `pageContext==='orders'` (`:237`). The board groups by `order.eventDate`, which customers do not have, so AI results render as an **empty grid**. The advanced-modal "AI on filled fields" path has the same problem.
- **I-66** The hover popover's "לקוח:" row has a label but **no customer name value**: the phone label and value are placed in the same row instead (`page.js:722-729`).
- **I-67** **The advanced "event date from/to" filters have no effect.** `buildBoardMonthParams` first sets `eventDateFrom/To` to the month range, then *appends* the advanced values under the same keys (`prefetchRoutes.js:185-196`). The server uses `searchParams.get()`, which returns the first value (`route.js:41-42`), so the month range always wins.
- **I-68** Leaving AI mode is awkward. The monthly fetch is suppressed while `isAiModeActive` (`page.js:150`), and navigating months keeps showing the AI result set. Only a normal search submit or the X (shown only when the normal input has text) resets it (`:206-210,236-242`). Toggling the star back does not. There is no visual "AI results" indicator.
- **I-69** Advanced filters re-fetch on every keystroke (I-53), and there is no "active filters" indicator. Closing the modal leaves them applied.
- **I-70** `jumpDate` re-selection: picking the same date string again does not fire the effect (`page.js:124-128`), so after navigating away, re-jumping to the same date does nothing.
- **I-71** Orders from the ±14-day buffer are fetched but never displayed, because only the Hebrew-month days render. `limit=2000` truncates silently with no warning.
- **I-72** `highlightedDate` state is never set (always `''`) (`page.js:80,461,512`), so it is dead code. `router` is unused.
- **I-73** Category logic is duplicated and diverges from `lib/orderStatus.js`, which CLAUDE.md calls the source of truth for order status.
  - `empty` counts deleted items as present or absent inconsistently: `items.length` is unfiltered, and `hasRepairs` includes deleted items.
  - "Late" math is duplicated in two places.
- **I-74** Drafts (`טיוטה`) and `שמור לחיוב` placeholders are included in the board data (I-13).
- **I-75** The legend omits `empty`, "late" and "today". `returned` and `completed` share the same success color.
- **I-76** The print wizard's "הנתונים המוצגים כעת" does not use the board's visible month or orders (I-46). With `enable_batch_print_prep` off, the alterations reports are not reachable from the board at all.
- **I-77** The AI star and statistics buttons lack the `ai-feature-element` class (`page.js:635-640,661-666`), so they stay visible when `hide_ai_features` is on. Only the advanced-modal checkbox is hidden.
- **I-78** The `queries-by-path` debug descriptor for `/board` claims the page runs `prisma.notification.findMany` ("לוח משימות ותזכורות") (`app/api/queries-by-path/route.js:401-412`). That is inaccurate: the board uses `/api/orders`. `lib/howToGuide.js:107-111` describes the board as "הזמנות/משמרות לפי יום", but shifts are not shown.
- **I-79** Grouping uses the browser's local timezone (`toLocaleDateString('en-CA')`, `page.js:327,457`). Correct only for Israel-timezone clients.
- **I-80** On a failed or unauthorized month fetch, the previous month's orders stay displayed under the new month label (I-61).
