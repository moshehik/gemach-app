# Functional inventory: `/orders` list page (production truth = origin/main checkout)

Code root: `scratchpad/main`. All paths are relative to it. Line numbers are from that checkout.
Main files: `app/orders/page.js` (1038 lines, client component), `app/orders/layout.js`, `app/api/orders/route.js` (GET 18-650),
`lib/orderStatus.js`, `app/lib/prefetchRoutes.js`, `lib/apiCache.js`, `app/lib/orderDrafts.js`, plus the child components listed in section 6/9.
Everything below is from reading the code, not from running it. Where I am unsure I say so.

---

## 1. Route, gates, permissions

- **I-01 Server page gate `page:orders`.** `app/orders/layout.js:7-9` wraps everything under `/orders` (list, `/orders/[id]`, `/orders/new`) in `<PageGate pageKey="page:orders">`. `app/components/PageGate.js:8-13` calls `canOpenPage(key)` and renders `NoAccessMessage` on false.
- **I-02 Resolution order** (`lib/permissions.js:271-306`). No verified cookie: falls back to `checkAuth()` (true only while `require_login` is off). Logged in: roleId comes from the signed session (`session.r`), or from the DB if that fails. Then `resolvePageAccess`: roleId 0/2 (`ALWAYS_ALLOWED_ROLE_IDS`) always allowed → the employee's own override → the department's row → catalog default. Any exception returns false (fail closed, `:302-305`).
- **I-03 Catalog default is closed.** `lib/permissionsMetadata.js:175-185`: `page:orders` has `enforced: true` and `defaultForRoleId: () => false`. With no row, only head management and the programmer can open it.
- **I-04 Sidebar link uses the same rule.** In `app/layout.js:199-230`, `showOrders = pageVisible('page:orders')` and `showOrdersNew = pageVisible('page:orders') && pageVisible('page:orders_new')`. If the `resolvePageAccess` lookup fails, or the visitor is anonymous, `pageVisible` returns **true** (`:212`). That fail-open applies only to the link. The layout gate itself fails closed.
- **I-05 No-permission state.** `app/components/NoAccessMessage.js`: heading "אין הרשאת גישה", lock icon, text "אין לך הרשאה לצפות בעמוד זה…", and a "חזרה לדף הבית" button to `/`.
- **I-06 The data API does not check `page:orders`.** `GET /api/orders` checks only `checkAuth()` (`app/api/orders/route.js:19`, 401 JSON when it fails). Any logged-in employee (or an anonymous visitor while `require_login` is off) can read the full list through the API, even without `page:orders`. The same is true of `DELETE /api/orders/[id]` (`app/api/orders/[id]/route.js:1037`) and `GET /api/orders/print-prep` (`print-prep/route.js:34`).
- **I-07 "הזמנה חדשה" is shown to everyone.** The button (`page.js:531-534`) is always rendered. The page does not check `page:orders_new`. A user without it gets the NoAccess card from `app/orders/new/layout.js`.
- **I-08 No role or permission checks inside the page.** `page.js` has no roleId checks. The delete, rental/return and print buttons show for everyone who can open the page. Deleting has no catalog permission key, only the settings in I-60/I-61.
- **I-09 AI features.** These are hidden by the body class `hide-ai-features` (`app/layout.js:281`, CSS `app/globals.css:1820` `.ai-feature-element {display:none}`), which depends on `feature:ai` and the `hide_ai_features` setting. The page marks two elements with that class: the "חפש עם AI על השדות שמולאו" checkbox (`page.js:738`) and the AI tab inside ExportButtons. **The "שאלות סטטיסטיקה" toolbar button (`page.js:554`) does NOT have `ai-feature-element`**, so it shows even when AI is off. Its API `/api/ai/statistics` then returns 403 (`checkAiAccess`, `app/api/ai/statistics/route.js:63`), and the modal shows "מצטער, חלה שגיאה בהפקת הסטטיסטיקה."
- **I-10 Smart search is gated server-side.** `/api/ai/smart-search` calls `checkAiAccess()` (`route.js:70`, 403). With the `ai_restrictions_smart_search` setting's `financial_columns_orders` restriction on, a non-manager (roleId not 1/2) gets no financial fields (`smart-search/route.js:85-103, 279-285`). **Note:** that route checks `roleId !== 1 && roleId !== 2`, so head management (0) counts as a "non-manager" there.

## 2. Data loading

- **I-11 Main list fetch.** `GET /api/orders?<params>` goes through `fetchSharedJson(url, {ttl: TTL.LIST})` (`page.js:290`, TTL 15s at `lib/apiCache.js:56`). The URL comes from `buildOrdersListParams` (`app/lib/prefetchRoutes.js:34-55`). Params in fixed order: `page, limit, search, sort, order, filterStatus`, then each non-empty advFilter except rentalStatus (`customerName, customerPhone, customerCity, advOrderId, itemDetails, advModelName, advSize, eventDateFrom, eventDateTo`), then `activeOnly=true` / `returnedOnly=true` / `pendingOnly=true` from `rentalStatus`. The order matters because the URL is the cache key (comment `prefetchRoutes.js:5-6`).
- **I-12 Initial state.** `page=1`, `limit=50` (fixed, cannot be changed, `page.js:153`), `search=''`, `sort='eventDate'`, `order='asc'`, `filterStatus='soon'` (`:152-162`). `advFilters = defaultOrdersAdvFilters()`, which is **`eventDateFrom = today - 3 months`** as a UTC `toISOString().split('T')[0]` string (`prefetchRoutes.js:16-32`). So a **hidden 3-month event-date floor applies on first load in every tab**, with no UI indicator (see I-83).
- **I-13 Response shape** (`route.js:639-645`): `{ data, total, page, limit, totalPages: ceil(total/limit) }`. Each row (`:564-634`) has: `orderId, legacyId, customerId, totalAmount (derived, I-40), totalPaid, paymentDate, paymentMethod, status (DB status || (paymentDate ? 'שולם' : 'ממתין לתשלום')), notes, eventDate, eventDateHebrew, orderDate, returnDate, isAbroad, fromDate, toDate, customSpacing, items[], customerName, customerPhone (phone1||phone2), customerEmail, customerCity`. Each item has: `id, dressId, itemId, dressName, description (built), price, isTaken, isReturned, isDeleted, barcode, cartStatus, cartStatusDate, neck/sleeve/lengthAlteration, alterationDetails`. **The response has no `customer` object and no `zeout`**, even though they are selected (see I-90).
- **I-14 SWR cache.** If the URL is already cached, rows show at once with no spinner and a background revalidation follows (`page.js:273-285`). Otherwise `loading=true`. For a fetch that is not a prefetch and has no cache entry, the page dispatches `app-data-fetching-start` / `app-data-fetching-end` window events for a global spinner (`:288-291, 300`).
- **I-15 Next-page prefetch.** 1.5 s after each load, if `page < totalPages`, the page runs `fetchOrders(true, page+1)` (warms the cache only, no state change) (`page.js:309-315`).
- **I-16 Live refresh by subscription.** `subscribe(url, …)` updates rows whenever the cache entry for the current URL changes (`page.js:320-331`). It is off while AI mode is active. The apiCache fetch interceptor invalidates `/api/orders*` after any non-GET to `/api/orders`, `/api/rentals`, `/api/returns`, `/api/payments`, `/api/refunds`, `/api/customers` or `/api/pricelists` from anywhere in the app (`lib/apiCache.js:163-175`). It also revalidates subscribed keys older than 60s on window focus, and flushes everything on login/logout (header comment `:17-24`).
- **I-17 Cross-page prefetch.** `routePrefetchers['/orders']` warms `GET /api/orders?<default params>` and `/api/settings` (`prefetchRoutes.js:224-228`). `/orders` neighbors are `/customers`, `/board` and `/rentals` (`:273`).
- **I-18 Settings fetch.** `fetchSharedJson('/api/settings', {ttl: TTL.STATIC})` (5 min), once on mount (`page.js:220-244`). `GET /api/settings` has **no auth check** (`app/api/settings/route.js:16-37`). It returns every SystemSetting except `BRAND_LOGO` / `backup_requested_at`, with secret keys masked. Keys read are listed in section 8.
- **I-19 Labels.** `useLabels().getLabel(key, fallback)` gets its values from `GET /api/settings/labels` (the `ui_labels_mapping` setting, JSON) through the shared cache (`app/components/LabelsContext.js:17-20`, `app/api/settings/labels/route.js:12-25`). Keys used: `order_id`, `order_customerName`, `order_totalAmount`, `order_status`.
- **I-20 Local drafts (localStorage).** `listOrderDrafts()` scans localStorage keys starting with `gemachOrderDraft:` and returns `{orderId: {savedAt, summary}}` (`app/lib/orderDrafts.js:12, 55-74`). Drafts older than 30 days, or corrupt, are deleted during the scan. The page re-reads them on mount, on window `focus` and on `storage` events (`page.js:181-191`). There is no server involvement.
- **I-21 Timers.** `nowTick` updates every 1 s for the whole page lifetime (`page.js:171-176`), which re-renders the full table every second. Each `PendingTimer` badge also runs its own 1 s interval (`:91-125`). Otherwise there is no polling; freshness comes from I-16.
- **I-22 Export/print fetch.** `fetchOrdersForExport(limit)` builds its own `URLSearchParams` with the same fields as I-11 and `page=1`, and calls `fetch('/api/orders?…', {cache:'no-store'})`, bypassing the shared cache (`page.js:450-481`).
- **I-23 AI smart search fetch.** `POST /api/ai/smart-search` with body `{prompt, pageContext:'orders'}` (`page.js:340-361`). Server flow: Gemini writes a WHERE clause, the server runs `SELECT … FROM "Order" WHERE "isDeleted"=false AND (clause) LIMIT PAGE_SIZE`, then re-fetches full orders and maps them to rows (`smart-search/route.js:132-339`). The response is `{data, query, whereClause(signed), total, page, totalPages}`. The page uses only `data` and `query`, and **ignores `total`/`totalPages`/`whereClause`** (so there is no paging of AI results).
- **I-24 Other fetches by child components.** These are covered in section 6: `/api/inventory/models?hasActiveItems=true` and `/api/inventory/sizes` (CapacitySearchModal fetches them on page mount because it is always mounted), `/api/inventory/capacity`, `/api/inventory/models?q=` (OrderModelSelector), `/api/me` (ExportButtons, on mount), `/api/auth/verify-pin`, `/api/ai/report`, `/api/ai/statistics`, `/api/ai/sessions`, `/api/orders/print-prep`, `/api/orders/[orderId]` (DELETE; GET in RentalReturnModal), and the rental endpoints in I-58.

## 3. Header and actions

- **I-25 Title.** "ניהול הזמנות", with the subtitle `סה"כ רשומות: {totalCount}`. totalCount is the server `total`, or the AI result length in AI mode (`page.js:494-498`).
- **I-26 Icon buttons, in order** (`page.js:499-535`):
  1. "חיפוש מתקדם" (list icon) opens the advanced-filter modal (I-33).
  2. "חיפוש תפוסה" (calendar icon) opens `CapacitySearchModal` (I-55).
  3. "הדפסת דוחות" (printer icon) opens `PrintWizardModal` (I-53).
  4. `ExportButtons` (icon only, "מערכת הורדה ל-XL ודוחות") opens the export modal (I-52).
  5. "הזמנה חדשה" (primary, plus icon) is a `Link` to `/orders/new`.
- **I-27 Search toolbar** (`page.js:539-560`): a text input with placeholder "חיפוש הזמנה (מספר הזמנה, שם לקוח, דגם)...", an X (clear) that shows only when `searchInput` is non-empty, "שאלות סטטיסטיקה" (activity icon; opens StatisticsModal positioned at the click point), and submit "חיפוש". The search runs only on submit (Enter or the button), not while typing.

## 4. Search, filters, tabs, counts

- **I-28 Status tabs (pill-tabs)** (`page.js:563-598`). Each one sets `filterStatus` and `page=1`:
  - "בקרוב" (`soon`, default; title "בקרוב (החל מהיום ואילך)")
  - "ארכיון/עבר" (`archive`)
  - "מחוק" (`deleted`)
  - "לא שולם" (`unpaid`; title "לא שולם (חודשים אחרונים)")
  - "טיוטות" (`drafts`; **shown only when `draftsAsDeleted` is false**)
  - "לא-נלקחו" (`not_taken`; **shown only when `show_not_taken_orders` is on**)
  - "הכל" (`all`; its handler `handleShowAll` also clears search, resets advFilters to defaults (including the 3-month floor again), and leaves AI mode, `:378-385`)
  - **No tab shows a count.** The only counts are the header total (I-25) and "סה"כ שורות מוצגות" (I-49).
- **I-29 Stale-tab fallbacks.** If `draftsAsDeleted && filterStatus==='drafts'`, or `!showNotTakenOrders && filterStatus==='not_taken'`, the page resets to `soon` (`page.js:248-260`). The server also returns an empty result for `not_taken` when the setting is `'false'` (`route.js:66-73`).
- **I-30 Server-side meaning of each tab.** Conditions are ANDed into one `conditions` array (`route.js:141-299`):
  - Every tab except `deleted`: `isDeleted:false`. `deleted`: `isDeleted:true`, or with `draft_orders_show_as_deleted='true'` (read server-side), `isDeleted:true OR status='טיוטה'` (`:59-63, 142-146`).
  - `drafts`: `status = DRAFT_ORDER_STATUS` (from `lib/orderReservation`; `lib/orderStatus.js` compares to the same constant).
  - `not_taken`: some item with `isDeleted:false, isTaken:false`.
  - `archive`: `eventDate < today` (today = server local midnight).
  - `soon`: `eventDate IS NULL OR eventDate >= today`.
  - `all`: only when no search and no advOrderId/customerName/phone/city/eventDateFrom/To are set, adds `eventDate >= now-3 months OR eventDate IS NULL`. With the default advFilters `eventDateFrom` is always set, so this branch **never applies in practice** from this page.
  - `unpaid` (and `unpaid_all` / `unpaid_approved`, not used by this page): `eventDate IS NULL OR eventDate >= now-3 months`. Then **in JS memory**: load every matching order (no cap) with payments and items, keep those with `sum(non-deleted payments) < totalAmount AND totalAmount > 0` (**raw stored `Order.totalAmount`, not the derived one**). Sort is fixed at `eventDate desc nulls last` (the `sort`/`order` params are ignored), then page by `skip/limit` (`:306-352`).
  - Setting `hide_taken_orders_from_orders_list='true'`, only for `soon` and `all`: adds "some item not deleted and not taken", so fully taken orders drop off the list (`:293-298`).
- **I-31 Text search** (`route.js:113-131, 204-218`). One OR group:
  - `orderId = int(search)` (when numeric)
  - customer firstName contains search, or lastName contains search
  - multi-word full name: every word must match firstName or lastName (`lib/searchUtils.js:46-59`)
  - some non-deleted item with `dressItem.dress.name` contains search
  - some non-deleted item whose `barcodePrefix` is in the prefixes of DressModels whose name contains search, or whose `barcodePrefix == int(search)`
  - **Not searched:** phone, city, email, barcode. The placeholder does not promise these. All matching uses `contains` with no `mode: 'insensitive'`.
- **I-32 Search combines with tab and advanced filters** (AND). The search term does not clear when you switch tabs. Only "הכל", the X button, or a new submit changes it.
- **I-33 Advanced-filter modal** (portal, `page.js:600-763`). Title "סינון מתקדם". Two inner tabs:
  - "תאריך וסטטוס":
    - "טווח תאריכי אירוע" (`HebrewDateRangePicker`, local ISO dates)
    - "סטטוס פריטים" multi-select pills: ממתינים (`pendingOnly`), מושכרים (`activeOnly`), מוחזרים (`returnedOnly`), plus a "בחר הכל" / "בטל בחירת הכל" toggle
  - "פרטי הזמנה ולקוח":
    - מספר הזמנה (`advOrderId`)
    - ברקוד/פרטי פריט (`itemDetails`)
    - דגם (`OrderModelSelector`, stores only `m.name` into `advModelName`)
    - מידה (`advSize`)
    - שם לקוח (`customerName`)
    - טלפון לקוח (`customerPhone`)
    - עיר מגורים (`customerCity`)
  - Checkbox "חפש עם AI על השדות שמולאו" (`ai-feature-element`).
  - Footer: "נקה הכל", which sets **every** field to empty, **including eventDateFrom** (different from the default 3-month floor; `:744-746`), and "החל סינון".
- **I-34 Advanced filters apply as you type.** `advFilters` is a dependency of `buildOrdersUrl` → `fetchOrders` → the effect (`page.js:264-316`). Every keystroke or pill toggle fires a new list request right away. "החל סינון" only closes the modal, or, in AI mode, builds a prompt and runs the AI search (`:747-755`). Changing an advanced filter **does not reset `page` to 1** (only the tabs and search submit do). If you are on page N and the filtered result has fewer pages, you see an empty page (see I-85).
- **I-35 Server meaning of the advanced fields** (`route.js:219-284`):
  - `advOrderId`: `orderId = parseInt`
  - `customerName`: firstName/lastName contains, plus the multi-word rule
  - `customerPhone`: phone1 or phone2 contains
  - `customerCity`: city contains
  - `eventDateFrom`/`To`: `gte new Date(from)` / `lte new Date(to)` (UTC midnight of the date string; `lte` excludes events later on the "to" day if stored with a time)
  - Item conditions are all inside **one** `items.some` AND block: rental-status OR group (pending = `isTaken:false`; active = `isTaken && !isReturned`; returned = `isReturned`; all require `!isDeleted`); `itemDetails` = barcode, description or `dressItem.dress.name` contains; `advModelName` = `dressItem.dress.name` contains (**does not match items booked only by barcodePrefix with no dressItem**, unlike the free-text search); `advSize` = `sizeText` or `dressItem.sizeText` contains
  - The server also supports `modelBarcodePrefix`, `partiallyRentedOnly`, `partiallyReturnedOnly`, `excludeArchiveAndPast`, `archiveAndPastOnly`, `forRentals` and `eventDateSmart`. **This page sends none of them.**
- **I-36 AI prompt builder.** `buildOrdersAiPrompt` turns the filled fields into Hebrew text such as "הזמנות מספר הזמנה X, של לקוח בשם …, בטווח תאריכי אירוע מ-… עד …, בסטטוס ממתינים או …" (`page.js:71-89`). It sends nothing if no field is filled. The default eventDateFrom counts as filled, so the prompt almost always includes "מתאריך אירוע <3 months ago>".
- **I-37 Sorting.** Clickable headers, first click ascending, next click toggles (`page.js:387-394`). Sortable columns: orderId, customerName (server sorts by `customer.firstName` only), eventDate (`nulls: 'last'`), totalAmount (**the stored column, not the derived value shown**), totalPaid (**there is no such column on `Order`**, see I-87), and status (**the stored `Order.status`, mostly NULL, not the derived status shown**) (`route.js:512-513`). "דגם" and "כמות פריטים" are not sortable. The active column shows a chevron that rotates for desc, others show a sort icon. Changing sort does not reset the page.
- **I-38 Pending-first reorder on the client.** `sortPendingFirst` moves rows with a live pending cart hold to the top of the **current page only**, keeping the rest in order (`page.js:128-140`). A row is "pending" when all of these hold: `!legacyId`; it is not "paid" (paid = `totalPaid>=totalAmount>0 || totalPaid>0 || status in ('שולם','שולם חלקי')`); and some item has `cartStatus==='pending'` with `cartStatusDate + holdMinutes > now`. This is not applied to AI results.

## 5. Table columns and derived values

- **I-39 Columns, in order** (`page.js:776-784, 815-890`):
  1. **קוד הזמנה** (`getLabel('order_id')`): `#orderId`, plus an optional "לא נשמר" badge (I-45), a PendingTimer (I-44) and an info-icon hover target (I-47). Text color: danger if unpaid, accent if pending.
  2. **לקוח**: `customerName` = `firstName + ' ' + lastName` trimmed, or 'לא ידוע' when there is no customer (`route.js:628`).
  3. **דגם**: unique `dressName`s of the non-deleted items, comma-separated, or '—' (`getOrderModelNames`, `page.js:47-52`). Server-side dressName is `dressItem.dress.name`. If it is a placeholder (empty or starts with 'ללא שם'), the server looks up the DressModel by barcodePrefix, and falls back to the **prefix number as a string** (`route.js:590-596`).
  4. **כמות פריטים**: count of non-deleted items.
  5. **תאריך אירוע**: **only the stored `eventDateHebrew` string**. No Gregorian date is shown, and nothing is computed client-side (`page.js:847`).
  6. **סכום לחיוב** (`order_totalAmount`): `₪{totalAmount}` in muted small text.
  7. **שולם**: `₪{totalPaid}`. Green when fully paid (`totalPaid>=totalAmount>0`), red and bold when unpaid, muted otherwise.
  8. **סטטוס** (`order_status`): two badges, the order status (I-41) and the payment status (I-42).
  9. Unlabeled actions column (I-50).
- **I-40 Derived totalAmount/totalPaid on the server** (`route.js:557-569`). `totalPaid` = sum of non-deleted `payments.amount`. Refunds are not subtracted: there is no Refund model involvement. `totalAmount` = stored `totalAmount` if > 0, else the sum of non-deleted obligations if > 0, else `paymentsSum`. So an order with no amount and no obligations but some payments gets "totalAmount = totalPaid" and shows as paid. **In the `unpaid` tab, payments and obligations are not selected in the full-row query** (`route.js:386-447`), so there `totalPaid` is always **0** and totalAmount is the stored value only (I-86).
- **I-41 Order status**, `calculateOrderStatus(order, {draftsAsDeleted})` (`lib/orderStatus.js:3-55`):
  - 'מחוק' if `order.isDeleted` (**not in the list payload**, so effectively only when every item is deleted)
  - otherwise, looking at non-deleted items: all returned → 'הוחזר'; some returned → 'הוחזר חלקי'; all taken → 'הושכר'; some taken → 'הושכר חלקי'
  - otherwise `status === 'טיוטה'` → 'מחוק' when draftsAsDeleted, else 'טיוטה'
  - otherwise eventDate before today (client local midnight) → 'עבר'
  - otherwise 'בקרוב' (including a null eventDate)
  - Badge class mapping is local to the page (`page.js:22-43`): הוחזר=success, הוחזר חלקי=warning, הושכר=info, הושכר חלקי=accent, בקרוב=warning, עבר/מחוק/טיוטה/other=neutral.
  - Because `isDeleted` is not returned, rows in the "מחוק" tab whose items are not deleted show 'בקרוב'/'עבר'/'הושכר…', not 'מחוק'. DELETE soft-deletes the items too, so for orders deleted through the app the items are deleted and 'מחוק' shows. **Unverified** for orders marked deleted by the legacy import.
- **I-42 Payment status**, `calculatePaymentStatus(totalAmount||0, totalPaid||0)` (`lib/orderStatus.js:84-90`):
  - paid > required > 0, or paid > 0 with required == 0 → 'ממתין לזיכוי' (info)
  - required > 0 and paid >= required → 'שולם' (success)
  - 0 < paid < required → 'שולם חלקי' (warning)
  - else → 'לא שולם' (danger) (`page.js:54-66`)
- **I-43 Row highlight priority** (`page.js:799-812`):
  1. `selectedOrder` match: dead code, `setSelectedOrder` is never called
  2. unsaved local draft: info tint + 4px info right border
  3. custom spacing (`!hide_custom_spacing && customSpacing != null`): warning tint + border
  4. live pending hold: accent tint + border
  5. unpaid (`totalPaid < totalAmount && totalAmount > 0`): class `row-flag` + danger border
- **I-44 PendingTimer badge.** Shown when the row is not legacy, not "paid" (I-38 definition), and has an item with `cartStatus==='pending'`. It counts down `mm:ss` to `cartStatusDate + holdMinutes`, turns danger 'פג תוקף' once expired, and hides when there is no date (`page.js:91-125, 790, 828`).
- **I-45 "לא נשמר" badge.** Shown when localStorage has a draft for this orderId. Tooltip: save time (he-IL), the summary lines, and "פתח את הכרטיס כדי לשחזר או למחוק אותם" (`page.js:819-827`).
- **I-46 Dates.** Only `eventDateHebrew` appears in the table and the popover. `orderDate` appears only in export (he-IL date and HH:MM time, `page.js:474-475`). eventDate (Gregorian), fromDate/toDate/isAbroad and returnDate are returned but not displayed.
- **I-47 Hover popover** (portal, fixed, `pointerEvents:none`, `page.js:964-1035`). Opens on mouseenter of the info icon, closes on mouseleave. Clicking the icon only stops propagation. It shows:
  - "הזמנה #id"
  - לקוח
  - טלפון (`customerPhone` or 'לא הוזן', LTR)
  - תאריך עברי (or 'לא צוין')
  - ציפוף ימים (only when customSpacing is set and the setting allows; "N יום/ימים")
  - הושכר (count taken), הוחזר (count returned)
  - סה"כ לתשלום
  - שולם (green if full, warning if partial, danger if 0)
  - סטטוס פריטים badge, סטטוס תשלום badge
  - Hover only, so it is not reachable by touch or keyboard.
- **I-48 Row click** navigates to `/orders/{orderId}` via `router.push` (`page.js:815`).
- **I-49 Footer** (`page.js:900-929`): "סה"כ שורות מוצגות: {orders.length}". Pagination controls show only when `totalPages > 1`: "הקודם", a numeric input "עמוד [n] מתוך {totalPages}" (accepts only 1..totalPages), and "הבא". All three are disabled in AI mode.

## 6. Row actions, links, bulk, print, export

- **I-50 Per-row actions** (`page.js:858-890`):
  1. "כרטיס הזמנה" (edit icon), a `Link` to `/orders/{orderId}`.
  2. "מעבר להשכרה/החזרה" (truck icon, green) opens `RentalReturnModal` with that orderId.
  3. "מחיקת הזמנה" (trash icon, red), see I-51.
  - All three stop propagation. They show for every row, including rows in the "מחוק" tab (you can delete an already deleted order again).
- **I-51 Delete flow** (`page.js:407-448`):
  1. Client blocks when the derived status is הוחזר/הוחזר חלקי/הושכר/הושכר חלקי, with alert "לא ניתן למחוק הזמנה לאחר השכרה חלקית/מלאה או לאחר שנלקח והוחזר".
  2. Client blocks when `!allow_edit_partially_rented` and any item is taken. This is unreachable, because step 1 already catches it.
  3. `window.customConfirm('האם אתה בטוח שברצונך למחוק הזמנה זו?')`.
  4. If `require_id_for_edit_cancel` is on **and `order.customer?.zeout`** is set, prompt for the ID number; if empty, alert "ביטול בוטל - לא הוזנה תעודת זהות.". **`order.customer` is never in the list payload, so this prompt never appears** (I-90).
  5. `DELETE /api/orders/{orderId}`, with header `x-zeout` and body `{zeout}` when provided.
  6. On success: `fetchOrders()`. On failure: alert with the server `error`, or 'שגיאה במחיקת הזמנה'.
  - Server (`app/api/orders/[id]/route.js:1036-1160+`): 404 if not found. 403 on a partially rented order when the setting forbids it. The ID check (only when the customer has a stored zeout): 401 "דרוש אימות תעודת זהות…" when missing, 403 "תעודת הזהות אינה תואמת…" when wrong. 400 **English** "Cannot delete order with rental history" when any item is taken or returned. Otherwise, in a transaction, it soft-deletes the Order (`isDeleted:true`, audit `CANCEL_ORDER`) and all of its OrderItems and PaymentObligations, and writes explicit audit rows. Payments are not touched.
- **I-52 Export (ExportButtons)** (`components/ExportButtons.js`, used at `page.js:509-530`).
  - Columns: קוד הזמנה, לקוח, טלפון, אימייל, עיר, תאריך ביצוע ההזמנה, שעת ביצוע ההזמנה, סכום לחיוב, שולם, סטטוס תשלום, סטטוס.
  - Data always comes from `onFetchData` (`fetchOrdersForExport(exportLimit)`), which **re-queries the server with the current filters from page 1**. AI-mode results are ignored.
  - The row limit input defaults to 100. More than `feature:export_max_rows` (from `/api/me`, `employee.exportMaxRows`, default 200 before it loads) needs manager approval: a PIN field, then `/api/auth/verify-pin` with `requiredLevel:'feature:export_over_limit_approval'`.
  - Actions: Excel (`downloadRowsAsXlsx`, filename "הזמנות"); PDF/print (a popup HTML table that calls `window.print()`, alert if popups are blocked); AI tab (textarea prompt, then `POST /api/ai/report`, then Excel or print).
  - An empty result gives **no message** when `onFetchData` is set (`ExportButtons.js:151-154`).
  - The `data` prop (current rows plus status) is computed on every render but is not used, because onFetchData exists.
- **I-53 Print wizard** (`app/components/PrintWizardModal.js`). Title "אשף הדפסה".
  - Report types: רשימת תיקונים (טרם בוצעו) (default when `enable_batch_print_prep` is off); כל התיקונים; הזמנות ללא תיקונים; דוח הזמנות כללי; תוויות לתופרות; and **"פירוט הזמנות להכנה"**, shown only when `enable_batch_print_prep` is on, in which case it is also the default (`page.js:941-942`).
  - Date modes: "הנתונים המוצגים כעת" (calls `getCurrentFilteredOrderIds` = `fetchOrdersForExport(2000)` → orderIds, alert "לא נמצאו רשומות התואמות לסינון הנוכחי." if none; **capped at 2000 ids, put in the URL query**, and ignores AI mode); "אירועים להיום בלבד"; "טווח מותאם אישית" (needs both dates, alert).
  - Output: opens `/print/alterations?reportType=…&dateMode=…[&orderIds|startDate&endDate]` in a new tab, or a server PDF download through `downloadPdf({path})` (the `/api/pdf` route) named after the report.
  - Prep mode: "הכנות להיום" (default) / "תאריך אחר" / "טווח תאריכים", calls `GET /api/orders/print-prep?date=…` or `…&mode=event`, then opens `/print/order?orderId=a,b,c&type=order&batch=1`. Alert when there are no results.
- **I-54 Statistics modal** (`app/components/StatisticsModal.js`, `pageContext='orders'`, `contextQuery=aiQueryUsed`).
  - Chat with the greeting "שלום! אני עוזר הסטטיסטיקה של ההזמנות…".
  - `POST /api/ai/statistics {prompt, history, contextQuery, pageContext}`.
  - Result rows show as a table (first 100) with CSV/XLSX download.
  - Session sync: `POST /api/ai/sessions`. Session list is in localStorage.
- **I-55 Capacity search** (`components/CapacitySearchModal.js`). Always mounted, so it fetches `/api/inventory/models?hasActiveItems=true` as soon as the orders page loads.
  - Fields: model, size (from `/api/inventory/sizes?barcodePrefix=`), date range (defaults to today..+6 months), customer name, employee code.
  - `GET /api/inventory/capacity?barcodePrefix&size&fromDate&toDate`, list or calendar view.
  - Search history (up to 50) in localStorage `capacity_search_history`. Error "יש להזין דגם ומידה".
- **I-56 No bulk actions.** There are no row checkboxes and no multi-select. The only "bulk" outputs are export and the print wizard's "current data" mode.
- **I-57 Model selector.** `OrderModelSelector` in advanced search: a debounced `fetchSharedJson('/api/inventory/models?q=…')` (TTL 2 min). Only the model **name** is kept.
- **I-58 RentalReturnModal** (`components/orders/RentalReturnModal.js`, 1108 lines; opened from a row).
  - Loads `GET /api/orders/{id}`, and settings `enable_alterations` / `late_return_threshold_days`.
  - Scan and take: `POST/PUT /api/rentals/scan`, `POST /api/rentals/confirm`, then a confirm "השכרה אושרה בהצלחה! להדפיס…" that can open `/print/order?orderId=`.
  - Other calls: `DELETE /api/rentals/confirm`; return undo `PUT /api/returns/scan`; cancel take `PUT /api/rentals/cancel`; item history `/api/audit/order-item/{id}`; report issue `POST /api/returns/report-issue`; `POST /api/rentals/toggle`; block customer.
  - Many `customConfirm`/`customPrompt`/`alert` dialogs (`:168-527`).
  - `onUpdate={fetchOrders}`. The modal calls `onUpdate(data)` with the order object (`:92`), so `fetchOrders(isPrefetch=<object>)` runs **as a prefetch** and does not update state. The table still refreshes through cache invalidation and I-16. This is a harmless quirk.

## 7. States

- **I-59 Loading.** Only when `loading && orders.length===0`: `.page-loading` with a large spinner and "טוען נתונים..." (`page.js:767-771`). When cached rows exist, the old rows stay visible while the refetch runs, with no indicator. Header totals show 0 until the first load.
- **I-60 Empty.** **There is no empty-state message.** The table renders headers and an empty tbody. The footer says "סה"כ שורות מוצגות: 0" and the pager is hidden (`page.js:773-929`).
- **I-61 Error.** A failed list fetch (non-2xx, which `revalidate` throws, `lib/apiCache.js:92-95`) is only `console.error`-ed (`page.js:298-301`). There is no UI error. The previous rows stay, or the table is empty. 401 and 500 look the same as "no data". Failed settings fetch: swallowed, defaults are used. AI search failure: `alert(result.error || 'שגיאה בחיפוש החכם')` or `alert('שגיאת תקשורת')`.
- **I-62 No-permission.** See I-05 (server layout). The API has no separate permission state for this page.
- **I-63 AI mode.** Rows come from AI results. Pagination is disabled, the subscription is off, and `totalCount` is the result length. There is **no visible banner saying AI mode is active and no dedicated exit**. The X clear button only shows when `searchInput` is non-empty. "הכל" and a new text search exit AI mode. A tab click changes the URL and refetches regular data, but leaves `isAiModeActive=true`, so pagination stays disabled (see I-88).

## 8. SystemSetting keys and org-dependent behavior

| # | Key | Read where | Effect | Default when row missing |
|---|---|---|---|---|
| I-64 | `inventory_hold_minutes` | page.js:225-227 | pending-hold countdown and pending highlight | 15 (only a positive integer overrides) |
| I-65 | `draft_orders_show_as_deleted` | client page.js:229-230; server route.js:60-63 (only for the `deleted` tab) | hides the "טיוטות" tab, drafts show as 'מחוק', `deleted` tab includes `status='טיוטה'` | **client: true; server: false**, so when missing the tab is hidden but drafts are NOT in the "מחוק" tab (they stay in בקרוב/הכל with an 'מחוק' badge) |
| I-66 | `hide_custom_spacing` | page.js:231-232 | suppresses the custom-spacing highlight and the popover line | false |
| I-67 | `show_not_taken_orders` | page.js:233-234; route.js:66-73 | shows the "לא-נלקחו" tab | client true; server empties the result only on `'false'` |
| I-68 | `require_id_for_edit_cancel` | page.js:235-236; `[id]/route.js:1066` | ID check before delete | false |
| I-69 | `allow_edit_partially_rented` | page.js:237-238; `[id]/route.js:1067` | blocks deleting a partially rented order | true (server: anything but `'false'`) |
| I-70 | `enable_batch_print_prep` | page.js:239-240 | "פירוט הזמנות להכנה" option in the print wizard, and it becomes the default | false (org2=true per CLAUDE.md, not verified here) |
| I-71 | `hide_taken_orders_from_orders_list` | route.js:293-298 | בקרוב/הכל hide orders whose every item is taken | off |
| I-72 | `ui_labels_mapping` | labels route | custom header labels | `{}` → Hebrew fallbacks |
| I-73 | `require_login` | checkAuth / canOpenPage / layout | anonymous access to the page and API | (see lib/auth.js) |
| I-74 | `hide_ai_features` + `feature:ai` | app/layout.js | hides the AI checkbox and export AI tab (not the stats button) | — |
| I-75 | `ai_restrictions_smart_search` | smart-search route | `financial_columns_orders` removes money fields from AI results | registry default |
| I-76 | `enable_alterations`, `late_return_threshold_days` | RentalReturnModal:110-118 | modal behavior | alterations on; threshold = constant |

- **I-77** Permission items that affect this page: `page:orders` (gate), `page:orders_new` (the new-order target), `feature:export_max_rows` (number), `feature:export_over_limit_approval` (approver), `feature:ai` (AI UI and APIs).
- **I-78** Org-dependent code paths: every row above is a per-DB setting. There is no hardcoded org check in `page.js` or the GET route.

## 9. Dialogs, alerts, confirms

- **I-79 Modals and portals:** advanced filter, CapacitySearchModal, PrintWizardModal, ExportButtons modal (with manager-PIN sub-prompt), RentalReturnModal, StatisticsModal, hover popover.
- **I-80 `window.customConfirm`** (PopupProvider, `app/components/PopupProvider.js:200`): the delete confirm. RentalReturnModal uses several more.
- **I-81 `window.customPrompt`**, falling back to `window.prompt`: the ID prompt on delete (unreachable, I-90).
- **I-82 Native `alert()` messages from the page:**
  - delete blocked (status)
  - delete blocked (setting)
  - "ביטול בוטל - לא הוזנה תעודת זהות."
  - server delete error, or "שגיאה במחיקת הזמנה"
  - AI "שגיאה בחיפוש החכם"/server error, "שגיאת תקשורת"
  - Also from children: print wizard date/no-results/PDF errors, export errors and PIN errors, and "אנא אפשר חלונות קופצים…".

## 10. Notable findings and likely bugs (code reading only, not runtime-verified)

- **I-83 Hidden 3-month event-date floor.** The default `advFilters.eventDateFrom = today-3mo` is sent on every tab (I-12). Effects:
  - "ארכיון/עבר" shows only the last 3 months.
  - "מחוק", "טיוטות", "לא-נלקחו" and "הכל" are limited to events from the last 3 months onward.
  - Prisma `gte` excludes NULL, so **orders with no eventDate never appear in any tab by default**, even though `soon` explicitly ORs in `eventDate: null`.
  - "הכל" re-applies this floor. Only "נקה הכל" inside the modal clears it.
  - Nothing on screen shows that a filter is active.
  - The date string comes from UTC `toISOString`, so between 00:00 and 03:00 Israel time it is one day earlier.
- **I-84 Advanced filters fire on every keystroke.** "החל סינון" is really just "close" (I-34). This means many requests, and in AI mode a normal filtered fetch races the AI call.
- **I-85 Page not reset** on advanced-filter or sort change, so a filtered result can land on an empty, out-of-range page with the pager hidden (when `totalPages <= 1`) and no way back except the tabs.
- **I-86 "לא שולם" tab money columns are wrong.** The unpaid branch's full-row `select` has no `payments`/`obligations` (`route.js:386-447`), so every row shows `שולם ₪0` and the payment badge 'לא שולם', even for partially paid orders. The debt test uses the stored totalAmount (the display uses derived values elsewhere). Export in this tab has the same problem. Sorting is ignored in this tab.
- **I-87 Sorting by "שולם" breaks the list.** `orderBy: { totalPaid: … }`, but `Order` has no `totalPaid` column (`prisma/schema.prisma` model Order has only `totalAmount`). This most likely makes Prisma throw, the route returns 500, and the page silently keeps the old rows (I-61). Sorting by "סטטוס" sorts the mostly-NULL stored column, not the displayed status. Sorting by "סכום" sorts the stored column, not the derived value. Sorting by customer sorts first name only.
- **I-88 AI mode is fragile.**
  - After the AI search, `setTotalPages(1)` changes a dependency of the fetch effect (`page.js:306-316`). If the previous `totalPages` was not 1, `fetchOrders` re-runs and **overwrites the AI results with the regular list** (it has no AI-mode guard). High confidence from reading; not runtime-verified.
  - AI rows have no `dressName`, `cartStatus` or `customSpacing` (`smart-search/route.js:287-335`), so "דגם" shows '—'.
  - AI `totalAmount` = the obligations sum when any obligations exist, else stored. That is a different formula from the list's (I-40).
  - Server paging (`total`/`totalPages`/`whereClause`) is ignored.
  - Tab clicks leave `isAiModeActive` true (the pager stays disabled and live refresh stays off).
- **I-89 `draft_orders_show_as_deleted` default differs** between client (true) and server (false) when the row is missing (I-65).
- **I-90 The ID check on delete is dead on the client.** The page reads `order.customer?.zeout`, but the GET response never includes `customer` (`route.js:564-634`). With `require_id_for_edit_cancel` on and a customer that has a stored ID, delete fails with a 401 alert "דרוש אימות תעודת זהות…" and there is no way to enter the ID from the list.
- **I-91 Other delete issues.** The client `allow_edit_partially_rented` check is unreachable (I-51). The delete button shows in the "מחוק" tab and re-deletes (re-writing audit rows). The server's blocking error is in English. There is no restore action.
- **I-92 Stats button is not AI-gated in the UI** (I-09), so it 403s when AI is off.
- **I-93 `nowTick` re-renders every second.** It re-renders the whole table, and each row calls `calculateOrderStatus` twice and `calculatePaymentStatus` twice per render.
- **I-94 Dead code.** `selectedOrder` state (never set), `setSelectedOrder`, the `getStatusBadgeClass` 'טיוטה' case (the default handles it), `forRentals` payloads, and the ExportButtons `data` prop.
- **I-95 The "paid" test for pending holds is loose.** `totalPaid > 0` counts as paid, and the check also uses the DB `status in ('שולם','שולם חלקי')`.
- **I-96 `customerPhone` is phone1 or phone2** (only one number is shown). Email and city appear only in the export.
- **I-97 The API returns more than the table shows.** `GET /api/orders` returns `notes`, `paymentMethod`, item prices and customer email/city to any logged-in user, regardless of `page:orders` (I-06).
- **I-98 Uncertain.** The free-text search puts `{ orderId: undefined }` in its OR list for non-numeric input (`route.js:210`). Prisma drops undefined fields. I believe an empty object inside an OR that has other conditions is harmless, but I did not verify this at runtime.
