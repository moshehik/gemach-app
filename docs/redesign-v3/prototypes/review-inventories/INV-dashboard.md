# Functional inventory: `/` (home) and `/dashboard`

Source: checkout of origin/main at `scratchpad/main`. All paths are relative to that root. Read-only; `docs/redesign-v3/` was not consulted.

---

## HOME PAGE `/` (app/page.js, client component `HomeDashboard`)

### 1. Gates / permissions

- **H-01 No page-level gate.** `app/page.js` is `'use client'` (line 1), and there is no `app/layout.js`-level page check for `/`. Anyone who gets past the root layout can open it.
- **H-02 Login wall (root layout).** `app/layout.js:279`: `showLogin = requireLogin && !isAuthenticated && !isPublicKiosk && !isPunchClock`. When `require_login`='true' and there is no verified `auth_token`, `<LoginScreen/>` renders in place of the page (layout.js:626-627). When `require_login` is off, anonymous visitors see the home page.
- **H-03 Catalog entry.** `lib/permissionsMetadata.js:162-173`: `page:home` has `enforced:false`, `notConfigurable` ("always open to every logged-in employee"), and `defaultForRoleId: () => true`. Its `description` says 'קטלוג הדגמים והזמינות.' This is inaccurate: the page is search, AI chat and quick links.
- **H-04 Sidebar entry.** `app/components/navConfig.js:22`: `{ href: '/', label: 'בית וחיפוש', icon: 'i-home' }` has no gate, so it is always visible.
- **H-05 Quick-link visibility (client-side only, fail-closed).** `app/page.js:36-41,79-109`:
  - `'/dashboard'`, `'/dashboard/pricelist'` and `'/employees/report'` show only when `headManagement` is true.
  - `'/messages'` shows only when `messagingEnabled` is true.
  - The initial state is `{headManagement:false, messagingEnabled:false}` (line 82), so the gated cards stay hidden until the data resolves.
  - `headManagement` = `me.success ? roleId∈{0,2} : !requireLogin` (lines 89, 100). An anonymous visitor in open mode therefore sees the head-management cards.
  - `messagingEnabled` = `hide_internal_messaging !== 'true'` (lines 92-93, 101).
  - These are cosmetic. The destination pages enforce their own gates.
- **H-06 AI access (server).** `POST /api/ai` requires `checkAuth()` and then `checkAiAccess()` (`app/api/ai/route.js:92-93`). `checkAiAccess` (`lib/permissions.js:220-230`) works as follows:
  - `hide_ai_features`='true' → nobody.
  - Logged-in employee → `hasPermission(employee,'feature:ai')`. Head management and programmers are always allowed; everyone else needs an override or a department row, because the catalog default is closed.
  - Anonymous → allowed only when `checkAuth()` passes (open mode).
- **H-07 AI access (UI) is NOT gated on the home page.**
  - The layout computes `hideAIFeatures` (layout.js:118-121, 181-189). It hides the floating widget (layout.js:644) and adds `body.hide-ai-features`, which hides only `.ai-feature-element` (globals.css:1820).
  - The home page's AI star toggle buttons (page.js:399, 425) and the AI form have no `ai-feature-element` class. Users without `feature:ai`, or orgs with `hide_ai_features`=true, still see the "חיפוש חכם (AI)" toggle. Submitting returns 403, and the UI shows "שגיאה בחיפוש חכם." (page.js:288-290).
- **H-08 Settings quick-edit gate.**
  - The AI adds `[OPEN_SETTING:key]` tags only when the SETTINGS_GUIDE action runs, which requires `isManager` (route.js:165, 206).
  - `isManager` = `hasPermission(employee,'feature:ai_financial_data')` (`lib/ai/aiCommon.js:338`).
  - For non-managers, `finalizeTagsAndText` strips any stray OPEN_SETTING tags (aiCommon.js:569-573).
  - Saving from the panel goes through the `POST /api/settings` auth. On a 401, the panel falls back to `window.customAuthPrompt(..., 'הנהלה ראשית')` (SettingQuickPanel.js:96-110).
- **H-09 Global search API gate.** `GET /api/global-search` → `checkAuth()` only (`app/api/global-search/route.js:7`). Any logged-in employee can use it (or anyone in open mode).

### 2. Fetches

| # | URL | Method / payload | Where |
|---|---|---|---|
| H-10 | `/api/me` | GET via `fetchJson` (in-flight dedupe, `app/lib/pageCache.js:55-67`). Errors are caught and treated as `{success:false}`. | page.js:86 |
| H-11 | `/api/settings` | GET via `getSettingsCached()` → `fetchSharedJson('/api/settings',{ttl:TTL.STATIC})` (pageCache.js:73-75). Errors are treated as `[]`. Note: `GET /api/settings` has **no auth check** (`app/api/settings/route.js:16-37`); it returns every row except `BRAND_LOGO`/`backup_requested_at`, with secret keys masked. | page.js:87 |
| H-12 | `/api/global-search?q=<encoded>` | GET, raw `fetch`. Not cached. | page.js:192 |
| H-13 | `/api/ai` | POST JSON `{ prompt, context:'User is in the general system home dashboard.', history:[{role,content}...all prior msgs] }` | page.js:274-282 |
| H-14 | `/api/settings/guide` | GET, from SettingQuickPanel on open | SettingQuickPanel.js:39 |
| H-15 | `/api/settings` | POST `{items:[{key,value,name}]}`. On a 401, the retry adds `employeeId`, `pin`. | SettingQuickPanel.js:88-110 |

- All of these pass through the global fetch interceptor in layout.js:331-390, which queues `/api/log-visit` rows. Only `light=1` URLs are skipped.
- **H-16 Global-search server logic** (`app/api/global-search/route.js`):
  - An empty `q` returns empty arrays (lines 12-14).
  - The three queries run in parallel (lines 30-94), each with LIMIT 50:
    - **customers**: `SELECT * FROM "Customer"` with `isDeleted=false`. Matches `firstName/lastName/phone1/phone2/city LIKE %q%` (case-sensitive LIKE), OR `id = q`, OR every word of `q` in first/last name (`buildMultiWordNameSql`, `lib/searchUtils.js`). Ordered by `updatedAt DESC`. It returns all Customer columns.
    - **orders**: `o.*` + customer first/last name + `itemCount` (a count of non-deleted OrderItems), with `o.isDeleted=false`. Matches customer first/last/phone1 LIKE, `eventDateHebrew` LIKE, `eventDate` formatted `DD/MM/YYYY` or `DD-MM-YYYY` LIKE, `orderId = numeric q`, `o.id = q`, or the multi-word name clause. Ordered by `orderId DESC`. It does **not** exclude draft/reserved placeholder statuses.
    - **rentals**: `OrderItem oi.*` + `catalogName` (COALESCE DressItem.dressName, DressModel.name) + `catalogBarcode`. Matches `description`, `sizeText`, name, `barcode`, `barcodePrefix` (both item and model), `oi.orderId = numeric q`, or `oi.id = q`, with `isDeleted=false`. Ordered by `createdAt DESC`. The parent order's `isDeleted` is not checked.
  - Errors return 500 `{error:'Failed to perform global search'}`.

### 3. Widgets / tiles / lists

- **H-17 Welcome title (h1).** The default is `'ברוכים הבאים למערכת ניהול הגמ"ח'`. The `home_welcome_title` SystemSetting overrides it when non-empty (page.js:83, 94-95).
- **H-18 Search card.** Two modes, toggled by the star button (page.js:348-355). The text is kept across modes: the AI input is seeded from `searchInput`, and switching back copies the AI text into `searchInput`.
  - **Regular mode** (page.js:408-430):
    - Placeholder "דוגמא משפחת כהן...".
    - A spinner replaces the search icon while `loadingSearch` is true.
    - An X ("נקה חיפוש") appears when there is text; it calls `clearSearch()`, which clears the input, results, AI chat, localStorage and sessionStorage.
    - The submit button reads "חיפוש".
  - **AI mode** (page.js:382-406):
    - Placeholder "בקש מה-AI למצוא נתונים (למשל: 'הזמנות של משפחת שיינועטר')...".
    - The spinner shows only while `aiLoading && aiMessages.length===0`.
    - The X only clears the AI text.
    - The submit button reads "חפש בחכמה", or "מייצר שאילתה..." while loading. The input is disabled while loading.
- **H-19 Quick links grid** (page.js:48-54, 436-448). Shown only in the initial state (`!searchResults && aiMessages.length===0`, line 363).
  - Cards: לוח בקרה→/dashboard, מחירון→/dashboard/pricelist, דוח נוכחות→/employees/report, הודעות→/messages, שעון נוכחות→/punch-clock.
  - Each card is a Next `<Link>`, filtered as described in H-05.
- **H-20 Global search results** (page.js:572-686). Rendered only when `searchResults && aiMessages.length===0`. The heading is `תוצאות חיפוש ל: "<searchInput>"`. There are three cards; each shows 5 rows, with a "הצג עוד"/"הצג פחות" toggle when there are more than 5. The API caps each list at 50.
  - **Customers** `לקוחות (N)`: row = `firstName lastName`, `phone1 • city`. Link `/customers/<uuid>`.
  - **Orders** `הזמנות (N)`:
    - Row line 1 = name + status icon.
    - Row line 2 = `קוד: #orderId | אירוע: eventDateHebrew||'-'`.
    - Row line 3 = `סה"כ: ₪{o.totalAmount||0} | פריטים: {itemCount}`.
    - `totalAmount` is the raw stored `Order.totalAmount` column. It is not computed from obligations or payments, and null shows as ₪0.
    - Link `/orders/<orderId>`.
  - **Rentals** `השכרות (N)`: row = `catalogName||description`, `ברקוד: barcode||catalogBarcode • מידה: sizeText`. Link `/orders/<oi.orderId>`.
  - **Status icon** (page.js:331-344):
    - The map covers 'הוחזר' (check-circle/success), 'מושכר' (tag/warning), 'בוטל' (x-circle/danger) and 'שולם' (check/info).
    - Anything else gets a clock icon with tooltip `status||'פעיל'`.
    - It reads the stored `o.status` column, which is NULL for almost every real order (see CLAUDE.md), so nearly every row shows a clock with "פעיל".
    - It does not use `lib/orderStatus.js` (the source of truth), and 'מושכר'/'שולם' are not values that module produces.
- **H-21 AI chat card** (page.js:451-547). Shown when `aiMessages.length>0`.
  - Title "צ'אט חכם מבוסס AI:", with an X button that runs `clearAiChat`.
  - The thread (max-height 600, scrolls) contains user and assistant bubbles. A typing indicator shows while loading, and the thread auto-scrolls to the bottom on every message change (lines 248-254).
- **H-22 Floating follow-up input** (page.js:550-569). Fixed at the bottom center, z-index 1000, shown when there are chat messages.
  - Placeholder "שאל שאלת המשך ל-AI...".
  - Enter or the send button calls `handleAiSearch(text, true)`. The send button is disabled while loading or when the input is empty.
  - Bug: pressing Enter with empty text is prevented only by the early return in `handleAiSearch`.
  - An X closes (clears) the chat.
- **H-23 Footer** has a "מדיניות פרטיות" button that opens a modal (see H-38).
- **H-24 Dead state and imports.**
  - `recentSearches` is written to state and to `localStorage.dashboardRecentSearches` (page.js:198-200, 242-245) but is **never rendered**.
  - `HDate` and `useCallback` are imported and never used (page.js:3, 7).

### 4. Actions / links

- **H-25 Deep link `/?q=<text>`.** On mount, a `q` param runs the global search right away and then strips the query string with `history.replaceState` (page.js:217-229). The source is TopbarSearch's "הצג את כל התוצאות" (`app/components/TopbarSearch.js:81-84`), whose own panel is capped at `TOPBAR_PANEL_RESULT_CAP`.
- **H-26 AI message links** (page.js:119-168):
  - Text matching `הזמנה\s*\d+` becomes a chip link to `/orders/<n>`.
  - Text matching `לקוח\s*[\w-]+` becomes a chip link to `/customers/<token>`.
  - A plain left-click navigates in-app with `router.push`; modifier keys and middle-click keep normal browser behaviour.
  - The customer regex takes whatever word follows "לקוח". `\w` is ASCII-only, so a Hebrew name does not match, while a legacyId digit string produces `/customers/<legacyId>`. That route expects the UUID, so the link is likely broken unless the AI wrote a UUID.
- **H-27 Table action column.** When any row has `_actionUrl`, a "פעולות" column renders `<Link href=_actionUrl>{_actionLabel}</Link>` (page.js:505, 514-522).
- **H-28 "הורד Excel".** Lazy-imports `xlsx`, strips `_action*` keys, runs `json_to_sheet`, and writes the sheet "נתונים" to `AI_Export.xlsx` (page.js:315-329, 494-496). It does not use `lib/xlsxExport.js`, so there is no RTL sheet flag and no Israel-time date handling, unlike the statistics assistant and ExportButtons.
- **H-29 Bubble copy button.** Copies `msg.content` (raw, including any tags) and shows a check icon for 1.5s (page.js:170-179, 468-475). Clipboard errors are silently ignored.
- **H-30 "פתח הגדרה" button.** One button per `[OPEN_SETTING:key]` tag; it opens `SettingQuickPanel` (page.js:477-491, 722-724).

### 5. Search / AI chat behaviour

- **H-31 Mutual exclusion and persistence.**
  - Running a global search clears the AI chat, including `localStorage.dashboardAiMessages` (page.js:188-189).
  - Starting a new (non-reply) AI query clears the search results and sessionStorage results, and sets `searchInput` (page.js:260-265).
  - On success, the search input and results are saved to **sessionStorage** (`dashboardSearchInput`, `dashboardSearchResults`). AI messages are saved to **localStorage** `dashboardAiMessages`, which is browser-wide and survives across employees on a shared terminal.
  - All three are restored on mount when there is no `?q` (page.js:231-240). An error AI reply is not written to localStorage (page.js:288-295).
- **H-32 Request contract.**
  - Body: `{prompt, context, history}`. `history` is every earlier message as `{role:'user'|'model', content}` (page.js:280).
  - Response: `{response, data, sqlQuery}` (route.js:244, 274, 438, 565). The page stores `{role:'model', content: result.response, data: result.data}` (page.js:285) and reads `data` correctly (see CLAUDE.md 2026-09-20).
  - A non-OK response gives the bubble "שגיאה בחיפוש חכם.". A network error gives "שגיאת תקשורת.".
- **H-33 Server pipeline** (`app/api/ai/route.js`). One Gemini call; its reply is dispatched to one of these branches:
  - (a) `ACTION: SETTINGS_GUIDE()` (managers only). Returns text with `[OPEN_SETTING:key]` tags validated against the catalog, and `data:null`.
  - (b) `ACTION: HOWTO_GUIDE()`. Returns text with `[OPEN_LINK:route|title]` tags and `data:null`.
  - (c) `ACTION: CHECK_AVAILABILITY({...})`:
    - Runs `getBulkAvailableInventory` for each resolved date. Hebrew month objects expand to every day of the month.
    - `data` = rows with keys `תאריך, תאריך עברי, דגם, מידה, זמינות_פנויה, מלאי_כולל, כמות_מוזמנת`.
  - (d) `SQL:` lines:
    - Each query is normalised (`processHebrewDateMacro` → `normalizeAiSql`), guarded by `assertReadOnlySelect`, and has secret columns stripped.
    - One self-healing retry runs on a DB error.
    - `data` = the **last** query's rows.
    - The follow-up prompt forbids customer names/phones in the text, and there is a "says none but rows exist" retry/fallback.
  - (e) Plain answer.
  - Every text passes through `finalizeTagsAndText` → `finalizeAiText`, which strips `SQL:`/`ACTION:` lines, markdown bold and sandbox links, and fixes date pairs (aiCommon.js:218-232, 567-576).
  - Image/recording inputs are supported by the route but never sent from the home page.
- **H-34 Table rendering** (page.js:492-535).
  - The table is inline inside the bubble, not a modal. Header = keys of `data[0]` except `_action*`. Shows the first 15 rows, then the note "מציג 15 תוצאות ראשונות (הורד קובץ לצפייה במלא)".
  - Cells go through `renderCopyable(val)`, which returns non-strings unchanged. Booleans therefore render blank in React, and a nested object/JSON value would throw "Objects are not valid as a React child".
- **H-35 Copy chips.** `splitCopyable` (`app/components/CopyableText.js:6-15`):
  - Emails and Israeli phones (`0(5x|7x|2-4,8,9)` + 7 digits, with an optional `-`/space) become click-to-copy `CopyChip` buttons. The copy falls back to `execCommand`, and the icon shows a 1.5s check.
  - Copy tokens are split out first; only the text between them goes through order/customer link parsing (page.js:126-133).
- **H-36 Tags the home page does not handle.**
  - `[OPEN_LINK:route|title]` (from HOWTO_GUIDE) and `[FILTER:term]` both survive server finalisation and are shown as raw text on the home page.
  - The follow-up prompts in route.js:425 and 536 explicitly ask the model to append `[FILTER:term]`.
  - `extractOpenSettingKeys` handles only `[OPEN_SETTING:]` (page.js:16-26).
  - `AIFloatingWidget.js:29-35` handles OPEN_LINK. Only `customer-interface` handles FILTER (customer-interface/page.js:898-900).

### 6. States

- **H-37**
  - **Initial:** top padding 16vh + quick links.
  - **Loading:** spinner in the search icon slot; inputs disabled; typing dots in the chat.
  - **Empty:** each result card shows an empty-state (`לא נמצאו לקוחות/הזמנות/השכרות`).
  - **Error (search):** a 500 or 401 JSON (`{error}`) is stored as `searchResults`, so all three cards show "(0)" and the empty states, with **no error message**. A thrown fetch error is only logged to the console.
  - **AI error:** a model bubble with a generic message.
  - **Settings/me load failure:** fail-closed quick links, default title.

### 7. Dialogs

- **H-38 Privacy policy modal** (page.js:695-720). Portal to `document.body`, z-index 9999. Closes on backdrop click, X, or "הבנתי". The content is **placeholder text**, including "* ניתן לערוך טקסט זה בהמשך בקוד המערכת.".
- **H-39 SettingQuickPanel** (`app/components/SettingQuickPanel.js`):
  - Loads `/api/settings/guide`. Possible errors: 401 "אין הרשאה...", "לא נמצאה הגדרה עם המפתח הזה.".
  - Field types `department/mandatoryFields/fieldGroups/secret/timestamp` are read-only, with a link to the full settings page (`pagePath?tab=&highlight=`).
  - Number fields are validated.
  - `hide_*` keys go through the display↔raw inversion (`toDisplayValue`).
  - Save → `invalidateSettings()` → success message "ההגדרה נשמרה בהצלחה.".
- **H-40 customAuthPrompt** (PopupProvider). Used by the panel on a 401.

### 8. SystemSetting keys / org dependence

- **H-41 Read by the home page directly:**
  - `require_login` (quick-link rule).
  - `hide_internal_messaging` (messages card).
  - `home_welcome_title` (h1). Metadata is in `lib/settingsMetadata.js:194,309`.
- **H-42 Read indirectly:**
  - `hide_ai_features` + `feature:ai` (API only; see H-07).
  - `feature:ai_financial_data` (settings-guide availability and the financial prompt context).
  - `inventory_include_warehouse` (AI warehouse rule, route.js:187-189).
  - `ai_screen_recording_enabled` (not used from home).
  - AI restriction config `main_chat` (`/admin/ai-restrictions`).
- **H-43 Layout-level settings** affecting what surrounds the page: `enable_alterations`, `hide_gregorian_calendar`, `enable_ai_specific_employees` (read but no longer used for gating), `hide_error_reporting`, `enable_deliveries`, `enable_unreturned_orders_popup` (layout.js:72-156).

### 9. Notable / buggy (summary)

- **H-44** The AI toggle is visible and usable in the UI even when AI is disabled or not permitted (H-07).
- **H-45** Raw `[FILTER:…]` and `[OPEN_LINK:…]` tags leak into home chat text (H-36).
- **H-46** Search errors look like "no results" (H-37).
- **H-47** The order status icon reads the NULL `status` column and not `lib/orderStatus.js` (H-20).
- **H-48** The customer link regex from AI text probably produces non-UUID `/customers/` links (H-26).
- **H-49** Global search does not exclude draft/reserved placeholder orders. It uses case-sensitive LIKE. Rentals ignore deleted parent orders. The customer query returns `SELECT *` (every column, sent to the client).
- **H-50** Dead code: `recentSearches` (never rendered), unused imports.
- **H-51** The Excel export has no RTL flag or date conversion, unlike `lib/xlsxExport.js`.
- **H-52** The privacy policy is placeholder text.
- **H-53** AI chat history lives in browser-wide localStorage and is restored for whichever employee opens `/` next on a shared machine.
- **H-54** `GET /api/settings`, which the home page uses, is unauthenticated.
- **H-55** Related, not on this page: `TopbarSearch.handleResultClick` pushes `/orders/<item.id>` (the UUID) for order results (TopbarSearch.js:89), while the home page uses `orderId`.

---

## DASHBOARD `/dashboard` (app/dashboard/page.js, async server component; `export const dynamic = 'force-dynamic'`, line 6)

### 1. Gates / permissions

- **D-01 Inline gate, not a layout.**
  - `app/dashboard/page.js:18`: `if (!(await checkPageAccess(HEAD_MANAGEMENT_ROLES))) return <NoAccessMessage/>`.
  - `HEAD_MANAGEMENT_ROLES = [0, 2]` (`lib/auth.js:33`).
  - There is no `app/dashboard/layout.js`, deliberately, so that `/dashboard/dresses` (own `PageGate pageKey="page:dresses_catalog"`, `app/dashboard/dresses/layout.js`) and `/dashboard/pricelist` (own layout) are not covered (page.js:8-16 comment).
- **D-02 checkPageAccess semantics** (`lib/auth.js:197-223` → `lib/authTokens.js:201-231`):
  - A signed, fresh `auth_session` whose role is in the list → allowed.
  - Otherwise the employee row is looked up by UUID, or by legacyId when the token is all digits. A found employee → allowed iff `roleId ∈ [0,2]`.
  - Orphan cookie or anonymous → allowed iff `require_login` is **off**. Anonymous visitors in open mode see revenue.
  - Any exception → `return true` (**fail-open**, auth.js:219-222).
- **D-03 Catalog.** `lib/permissionsMetadata.js:260-271`: `page:dashboard` has `enforced:false` and `notConfigurable` ("locked to head management + programmer"), with `defaultForRoleId: roleId ∈ HEAD_MANAGEMENT`. `/admin/permissions` cannot change it; the real gate is D-01.
- **D-04 Denied view.** `app/components/NoAccessMessage.js`: heading "אין הרשאת גישה", lock icon, text, and a "חזרה לדף הבית" button to `/`.
- **D-05 Entry points.**
  - There is no sidebar link (navConfig.js has none).
  - Home quick-link card "לוח בקרה" (headManagement only, page.js:37, 49).
  - `/admin/site` hub card "דשבורד / גרפים ומגמות" (`app/admin/site/page.js:14`; /admin is itself head-management-gated).
  - Direct URL.

### 2. Data fetching

- **D-06 No client fetches.** All data is loaded server-side with Prisma through the shared client (`import prisma from '../lib/prisma'`, page.js:1). Six queries run in parallel via `Promise.all` (page.js:27-61):
  1. `prisma.customer.count({ where:{ isDeleted:false } })`
  2. `prisma.employee.count({ where:{ isActive:true } })`
  3. `prisma.order.count()` (**no filter at all**)
  4. `prisma.payment.aggregate({ where:{isDeleted:false}, _sum:{amount:true} })`
  5. `prisma.payment.groupBy({ by:['paymentMethod'], where:{isDeleted:false,isRefund:false}, _sum:{amount:true}, _count:{id:true} })`
  6. `prisma.payment.findMany({ where:{isDeleted:false, paymentDate:{gte: trendSince}}, select:{paymentDate,amount}, orderBy:{paymentDate:'desc'} })`, where `trendSince` = now minus 13 months (page.js:24-25).
- **D-07 Orphan API.**
  - `app/api/dashboard/route.js` (GET) is **not used by this page**. The only other reference is a label string in `app/api/queries-by-path/route.js:376`.
  - It still uses the old `Order.totalAmount`/`Order.paymentMethod` approach, which the page comment (page.js:38-43) says is empty for live orders.
  - It is gated only by `checkAuth()`, so **any logged-in employee** can read company-wide revenue totals through it, even though the page is head-management-only.
- **D-08 Stale description.** `app/api/queries-by-path/route.js:372-384` (the "show the query behind this page" tool) describes the dashboard query as `order.count({isDeleted:false})` + `order.aggregate totalAmount` + `customer.count`, which does not match the real page.

### 3. KPIs and charts: exact computation

Page head: "אזור ניהול - סיכומים ופילוחים" (page.js:125). Sections: "מדדים מרכזיים" (KPIs) and "פילוח נתונים" (charts).

- **D-09 KPI "סה"כ הכנסות".**
  - Value: `₪ + totalRevenue.toLocaleString()`, where `totalRevenue = sum(Payment.amount)` over all time for every non-deleted Payment, including negative refund/credit rows (net of refunds) (page.js:44-47, 63, 137-138).
  - No join on Order: payments on deleted orders and on draft/reserved placeholder orders are counted.
  - `toLocaleString()` has no locale or rounding argument, so it uses the server/browser default and may show float decimals.
- **D-10 KPI "לקוחות פעילים".** `Customer.count(isDeleted=false)`. This is really "not deleted"; there is no activity criterion (page.js:35, 147-148).
- **D-11 KPI "סה"כ הזמנות".** `Order.count()` with **no `isDeleted` filter** and no placeholder-status exclusion. Deleted orders, drafts ('טיוטה') and reserved-number rows are all counted (page.js:37, 157-158).
- **D-12 KPI "עובדים פעילים".** `Employee.count(isActive=true)`. This includes system/test accounts such as the AI-agent employee (legacyId 999999) when present (page.js:36, 167-168).
- **D-13 Chart "התפלגות הכנסות לפי אמצעי תשלום" (pie).**
  - Data: `revenueByMethod`, one entry per `paymentMethod` → `{method: paymentMethod||'לא מוגדר', amount: sum, count}`, sorted by amount descending (page.js:65-69).
  - Excludes `isRefund=true` rows but includes non-refund negative amounts. All time.
  - Rendering: Recharts Pie, `dataKey=amount`, `nameKey=method`, label `method (xx%)`, tooltip `₪<value>` (raw number). Five colours cycle (`DashboardChartsImpl.js:8, 24-40`).
  - `count` is computed and never displayed.
- **D-14 Chart "הכנסות לפי תאריך תשלום (תקופה אחרונה)" (bar, daily).**
  - Grouped by `paymentDate.toISOString().split('T')[0]`, which is the **UTC** date, so a payment after midnight Israel time lands on the previous day. The sum includes refunds.
  - Keeps the **last 30 days that have payments**, not 30 calendar days; days with no payments are simply absent from the axis (page.js:71-86).
  - X axis = ISO date string. Bar name "הכנסות (₪)", primary colour (DashboardChartsImpl.js:46-69).
- **D-15 Chart "הכנסות שבועיות (תקופה אחרונה)" (bar, weekly).**
  - Week key = Sunday start computed with the server-local `getDay()`/`setDate()` (Vercel = UTC), then `toISOString` date.
  - Last 12 weeks that have data (page.js:88-111). X axis = week-start ISO date. Info colour.
- **D-16 Chart "הכנסות חודשיות (תקופה אחרונה)" (bar, monthly).**
  - Key `YYYY-MM` from server-local `getFullYear`/`getMonth` (UTC on Vercel).
  - Last 12 months that have data, within the 13-month query window (page.js:100-119). X axis = `YYYY-MM`. Success colour.
- **D-17 Refund treatment differs between charts.** The trend charts include refund payments (negative), while the pie excludes `isRefund` rows. Totals therefore do not reconcile across widgets.
- **D-18 Calendar.** Gregorian only; there are no Hebrew dates anywhere on the page. `hide_gregorian_calendar` does not affect it.

### 4. Actions / links

- **D-19 Read-only page.** There are no buttons, filters, date-range pickers, drill-down links, exports or refresh control. Chart interactivity is limited to Recharts hover tooltips and the legend (bar charts).

### 5. Search / AI

- **D-20 No search on the page.** The global `AIFloatingWidget` (layout.js:644, when AI is permitted) is present. It tags sessions saved from any path containing `/dashboard` with context 'דשבורד' (`app/components/AIFloatingWidget.js:342-346`); this also covers `/dashboard/dresses` and `/dashboard/pricelist`.

### 6. States

- **D-21 Chart loading.**
  - `DashboardCharts.js` loads `DashboardChartsImpl` via `next/dynamic` with `ssr:false`, keeping Recharts out of the base bundle.
  - While it loads, `ChartsSkeleton` shows four cards with the same titles and a 300px "טוען גרף..." spinner (DashboardCharts.js:10-72).
  - The KPIs are server-rendered, so they have no loading state. There is no `app/dashboard/loading.js`, so navigation waits for all six queries.
- **D-22 Empty.** Empty arrays render empty Recharts axes or an empty pie with no "no data" message. KPIs show ₪0 or 0.
- **D-23 Error.** There is no try/catch around `Promise.all`, and there is no `app/error.js`, `app/global-error.js` or `app/dashboard/error.js`. A DB failure produces Next's default server error page.

### 7. SystemSetting keys / org dependence

- **D-24 require_login only.** No setting is read by the page itself except `require_login`, through `checkPageAccess`'s cached `requireLoginCache` (the open-mode anonymous allowance). Both orgs share this code; the numbers differ only by each org's own DB.
- **D-25 Legacy comment.** The comment at page.js:38-43 records that Neve Yaakov report 58d71561 (empty charts) led to switching from `Order.totalAmount/paymentMethod/paymentDate`, which were only populated by the Access migration, to the `Payment` table.

### 8. Dialogs

- **D-26 None.**

### 9. Dead / related files

- **D-27 `app/dashboard/LogoSettings.js` is dead code.** It is not imported anywhere (grep: the only references are its own file and `SettingsClient.js`'s separate call to the same endpoint).
  - It posts `FormData{file}` to `POST /api/upload-logo`. On success it sets `localStorage.logo_timestamp` and dispatches the `logoUpdated` window event.
  - Messages: "הלוגו הועלה בהצלחה!", server error text / "שגיאה בהעלאת הלוגו", "שגיאת תקשורת". The button reads "העלה לוגו"/"מעלה...".
  - The logo-upload feature itself lives in `/admin/settings` (`app/admin/settings/SettingsClient.js:658`).
- **D-28 Sub-routes under the same folder, not part of this page:** `/dashboard/dresses` (page:dresses_catalog via PageGate) and `/dashboard/pricelist` (own head-management layout).

### 10. Notable / buggy (summary)

- **D-29** "סה"כ הזמנות" counts deleted and placeholder orders (D-11).
- **D-30** Revenue includes payments of deleted/draft orders. The pie excludes refunds while the trends include them, so they do not reconcile (D-09, D-17).
- **D-31** UTC day/week/month bucketing instead of Israel time. "Last 30/12" counts only periods with data, so the axes skip gaps silently (D-14 to D-16).
- **D-32** `checkPageAccess` fails open on exception, and anonymous visitors can see revenue when `require_login` is off (D-02).
- **D-33** The orphan `/api/dashboard` exposes revenue aggregates to any logged-in employee (D-07). The queries-by-path description is stale (D-08).
- **D-34** "לקוחות פעילים" is a mislabel (not deleted ≠ active). The employee count includes system accounts (D-10, D-12).
- **D-35** Currency formatting has no locale or rounding (`toLocaleString()` without arguments, tooltips show raw `₪${value}`). There are no Hebrew dates.
- **D-36** There is no error boundary or loading.js (D-23).
- **D-37** `LogoSettings.js` is dead code (D-27).
