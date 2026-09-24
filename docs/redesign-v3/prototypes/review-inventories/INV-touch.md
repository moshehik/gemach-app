# Functional inventory — `/customer-interface` (kiosk) and `/punch-clock`

Source: checkout of origin/main at `scratchpad/main`. Read-only code reading, nothing run. All paths are relative to that root.
Key files: `app/customer-interface/page.js` (1683 lines), `app/customer-interface/kiosk.css` (442), `KIOSK.md`, `scripts/kiosk/launch-kiosk.bat`, `app/layout.js`, `middleware.js`, `app/punch-clock/page.js` (238), `app/api/attendance/route.js`, and the APIs each page calls.
Neither page has its own `layout.js` or page gate. `page:customer_interface` and `page:punch_clock` are catalog items with `enforced: false` (`lib/permissionsMetadata.js:247`, `:298`).

---

## A. Customer kiosk — `/customer-interface`

### 1. Access, lock, exit

- **K-01 Public route, no login wall.** `middleware.js` sets the `x-pathname` header on page requests, not on `/api` (matcher excludes `api`). `app/layout.js:46` sets `isPublicKiosk = x-pathname startsWith('/customer-interface')`, and `:279` computes `showLogin = requireLogin && !isAuthenticated && !isPublicKiosk && !isPunchClock`. The page therefore renders without a login even when `require_login` is on. The full `AppShell` (sidebar, topbar, error-report button, bell, AI widget) still wraps it (`layout.js:627-645`).
- **K-02 `require_login` interplay: the data APIs are not exempt.** Only the page shell is public:
  - `GET /api/dresses` calls `checkAuth()` (`app/api/dresses/route.js:11`). An anonymous visitor with `require_login` on gets a 401. The client does not treat that as an error: `list` becomes null, `dresses` stays `[]`, and the page shows "לא נמצאו דגמים מתאימים" (`page.js:491-495`, `:1401`).
  - `GET /api/orders` (history popup), `POST /api/customers` (registration) and `POST /api/ai` also need `checkAuth()`.
  - Public, no auth: `GET /api/settings` (`app/api/settings/route.js:16`), `GET /api/employees` (anonymous callers get id and name only, `app/api/employees/route.js:34-37`), and `GET /api/pricelists/categories`.
  - In practice, with `require_login` on the kiosk only works while an employee is logged in in that browser. `launch-kiosk.bat` starts an isolated, empty profile (`KIOSK_PROFILE`), so someone must log in there first. When unlocked, the "exit" button goes to `/` → login screen.
- **K-03 Anonymous visitor with `require_login` off.** Nothing on the page is gated. The page loads unlocked (`isLocked=false`, `page.js:306`), so clicking any model opens the order-history popup. That popup shows customer names, order numbers and payment status (K-24). This is reachable by anyone who has the URL.
- **K-04 Lock button.** Icon-only 🔒 button, visible only in the stage-2 toolbar, with title "נעילת מסך ללקוח — מעבר למסך מלא…" (`page.js:1122-1131`). It closes the orders modal, sets `isLocked=true` and calls `document.documentElement.requestFullscreen()`. KIOSK.md calls this button "תפיסת מסך ללקוח", which is not the label in the code.
- **K-05 What locking changes.**
  - `body.hide-global-nav` hides `.navbar`, `.app-shell>.sidebar`, `.main>.topbar`, `.sidebar-backdrop`, `.ai-widget-fab` and `.ai-widget-panel` (`page.js:365-372`, `app/globals.css:167-174`).
  - Right-click `contextmenu` is blocked, which also blocks long-press on touch (`page.js:397-403`).
  - Model and size clicks stop opening the history popup (`handleModelDoubleClick` returns early, `:650`).
  - The "exit to system" (`:1101`) and print buttons (main `:1111`, per-model `:1483`, `:1531`) open the unlock modal instead of acting.
  - These remain usable while locked: "חיפוש חדש" (`:1105`), the stepper (`:1016`, `:1023`), refresh, filters, zoom and AI. KIOSK.md says "חיפוש חדש" is gated, but the code does not gate it.
- **K-06 Re-lock on Esc.** A `fullscreenchange` listener re-opens the unlock modal when the page is locked, fullscreen has been exited, the modal is not already open, and no authorized print is in progress (`page.js:381-393`).
- **K-07 Unlock modal.**
  - Fields: employee `<select>` (from `/api/employees`) and "קוד גישה" password field with an eye toggle (`page.js:1580-1623`).
  - Submit sends `POST /api/login {employeeId, password}` (`:536-540`). Only the full password works; the `pin` field is never sent, so the 4-character short code does not work here even on a trusted device.
  - Errors shown: "נא לבחור עובד", then the server's `message` or "שם עובד או סיסמא שגויים", or "שגיאת תקשורת".
  - "ביטול" closes the modal and the page stays locked (`:1615`).
  - Buttons: "שחרר" or "אשר והדפס", with "בודק..." while loading.
- **K-08 Unlocking logs the employee in as a side effect.** `/api/login` sets `auth_token` and `auth_session` (`app/api/login/route.js:89-103`). A successful unlock, or even a print approval, switches the whole browser session to that employee. After a print-intent unlock the kiosk stays locked but now holds that employee's session. The `mustResetPassword` flag in the response is ignored.
- **K-09 Print while locked.** `unlockIntent='print'` plus `suppressRelockRef` means the fullscreen exit caused by the print popup does not re-open the modal. After 2.5 s the page tries `requestFullscreen()` again, which may be rejected without a user gesture (`page.js:549-563`). `printModelRef` holds a single model for a per-model print.
- **K-10 Exit codes.** There are none. Unlock uses a normal employee login, and there is no kiosk-specific code, no PIN and no setting for one.
- **K-11 Lock holes (by code reading).**
  - `isLocked` is plain React state and is never persisted. A reload (F5 or Ctrl+R) returns the page unlocked, with the staff navigation back.
  - Esc → modal → "ביטול" leaves the page locked but not fullscreen. No further `fullscreenchange` event fires, so the browser chrome stays reachable in a non-`--kiosk` browser.
  - Keyboard shortcuts are not intercepted.
  - The lock and unlock buttons exist only in the stage-2 toolbar.
  - `OverdueRemindersWatcher` and `ShiftMessageWatcher` are mounted in `AppShell` outside the hidden topbar (`app/components/AppShell.js:140-141`) and are not excluded by path. If an employee session is active in the kiosk browser and the relevant settings are on, their popups (overdue families with customer names, shift-handover notes) can appear over a locked kiosk. `enable_unreturned_orders_popup` fires hourly on Neve Yaakov.
- **K-12 OS layer (KIOSK.md).** `scripts/kiosk/launch-kiosk.bat` runs Chrome/Edge with `--kiosk`, an isolated `--user-data-dir`, `--disable-pinch`, `--overscroll-history-navigation=0`, `--noerrdialogs` and related flags. `KIOSK_URL` defaults to the main gemach's production `/customer-interface`. Alt+F4 still exits. Ctrl+Shift+Esc opens Task Manager.

### 2. Every fetch

| # | Call | When | Evidence |
|---|---|---|---|
| K-13 | `GET /api/settings` → array reduced to a `{key:value}` map; default `hide_dress_images:'false'` | mount | `page.js:350-363` |
| K-14 | `GET /api/dresses?eventDate=<selectedDate.toISOString()>&limit=10000&filterStatus=active` (without a date: `?limit=10000&filterStatus=active`; `selectedDate` is always set) | mount, on every `selectedDate` change, and the refresh button | `:476-505`, `:1108` |
| K-15 | `GET /api/employees` (unlock picker) | mount | `:507-514` |
| K-16 | `GET /api/pricelists/categories` (distinct `PriceList.category`) | mount | `:516-523` |
| K-17 | `POST /api/login {employeeId,password}` | unlock / print approval | `:536` |
| K-18 | `POST /api/customers` with body `regForm` `{firstName,lastName,phone1,email,city,street,houseNum,marketingConsent}` | registration submit | `:626-630` |
| K-19 | `GET /api/orders?itemDetails=<model.name>[&modelBarcodePrefix=<prefix>]&eventDateFrom=<date−7d ISO>&eventDateTo=<date+7d ISO>&filterStatus=all` (no `limit`, so the server default of **50** applies) | click on a model or size pill (unlocked only) | `:649-684`, `app/api/orders/route.js:26` |
| K-20 | `POST /api/ai {prompt, history, context}`. `context` holds today's date, a restriction to orders/stock/prices/alterations with no management or other-customer data, and a `[FILTER:term]` tip | AI submit | `:439-474` |

- Every fetch passes through the global interceptor in `layout.js:331-390`, which queues a `PageVisitLog` entry. For POSTs without a query string it stores the **request body** as `requestQuery` (`layout.js:344-346`, `:353`). No endpoint is excluded besides `log-visit`, `queries-by-path` and `light=1`.
- So the unlock body `{employeeId,password}` is queued with the plaintext password and flushed about 20 s later to `/api/log-visit`, which stores it unmasked (`app/api/log-visit/route.js:16-27`). By then the unlock has set a session cookie, so the log-visit call passes `checkAuth`.
- The same applies to the punch clock (P-13) and to any login screen that uses `fetch`.

### 3. Screens, fields, filters, cards

- **K-21 Shell.**
  - The root is `.katelier`; the page adds `body.katelier-bg` on mount and removes it on unmount (`page.js:376-379`).
  - The top bar always shows the brand "עמדת לקוחות" and a two-step stepper: "שלב 1 · בחירת תאריך" and "שלב 2 · קטלוג ותוצאות". Both steps are always clickable (`:1009-1028`).
  - Inline SVG symbols `ka-i-send`, `ka-i-table` and `ka-i-filter` are defined at `:1000-1004`.
- **K-22 Stage 1 (date).**
  - AI search pill with placeholder "לדוגמה: שמלה שחורה מידה 12..." (`:1141-1158`), shown only while `aiEnabled` and no chat has started. After the first message, the chat card appears instead (`:1161`).
  - Card "מתי האירוע שלכם?" containing `AtelierCalendar` (`:100-284`):
    - Three selects: יום (Hebrew letters), חודש (leap-aware אדר א'/ב'), שנה (gematriya, current year −1 to +30).
    - Header: prev/next buttons and the range label "תשרי תשפ״ו - כסלו תשפ״ו".
    - **Three consecutive month grids.** Each cell shows the Hebrew day and a small Gregorian number (hidden by `body.hide-gregorian-calendar`, `kiosk.css:198`). Leading and trailing days from adjacent months are muted and not clickable. Today has a gold border; the selected day is filled terracotta.
    - Footer: Hebrew date plus "פרשת X" (the Shabbat on or after the date), and a "ניקוי" button that resets to today.
    - Past dates are selectable; there is no minimum date.
    - **Any change (select, day click or ניקוי) calls `onSelect` → `setSelectedDate` and `setStage(2)` immediately** (`:1171-1174`). The code comment at `:98-99` promises a "הצג מלאי" button that does not exist, so changing day, then month, then year means bouncing to stage 2 each time.
  - With `kiosk_customer_self_service`: the registration card (K-27) and the self-order stub card (K-28).
- **K-23 Stage-2 toolbar** (`:1030-1135`), left to right:
  - Title "קטלוג שמלות זמינות".
  - Date chip: Hebrew date plus `he-IL` Gregorian date.
  - Count line: "N דגמים · M פנויות". M is the sum of `totalAvailable` over the displayed models (`:778-780`).
  - AI ask input "שאל את ה-AI...", or "העוזר החכם פעיל - לחץ לסגירה" when the chat is open.
  - "סינון ותצוגה" toggles the sidebar. A dot appears when any filter is active.
  - Zoom popover: range 0.5–1.5, step 0.1, persisted in `localStorage.ka_zoom_level` (`:296-300`, `:1086-1090`). It closes on an outside `mousedown`. The zoom is applied as CSS `zoom` on the results container only.
  - Icon cluster: exit ("חזור למערכת" → `router.push('/')`), "חיפוש חדש" (stage 1), "רענון מלאי", print, lock/unlock.
- **K-24 Sidebar** (`:1308-1391`). It is closed by default (`:330-332`). While open, the layout is a two-column grid 270px/1fr, which collapses to one column below 900px.
  - **Search** (placeholder "שם דגם, מספר, או מידה…", hint "מידה 40"). Matching rules, in `displayDresses` (`:686-730`):
    - `^מידה\s*X` is an exact size match, ignoring unusable items.
    - Otherwise: name contains the term, OR `barcodePrefix` equals the term, OR any item's size contains the term (this item scan does not exclude unusable items).
  - **Category** checkboxes from `/api/pricelists/categories`. The count per category is models in the whole unfiltered stock with that `priceCategory`; a zero count renders at 50% opacity. The filter matches `d.priceCategory`.
  - **Size chips** ("סינון מהיר לפי מידה"): distinct non-empty `sizeText` values over the unfiltered stock, excluding `notInUse`, `isDeleted` and `isUnusable` items. The count is the number of models carrying that size, not units. Selecting several chips is an OR. Items with an empty size become 'כללי' in the filter but never get a chip.
  - **Switch** "הצג גם מידות ללא מלאי פנוי" (`showZeroSizes`, default off).
  - **View toggle** (icon-only, labels only in `title`): grid "כרטיסים גדולים", rows "רשימה מפורטת" (the **default**) and table "טבלה קומפקטית". The view choice is not persisted.
  - "נקה את כל הסינונים" clears search, categories and sizes. It does not reset the zero-sizes switch.
  - Sort: display name, `localeCompare` numeric (`:724-728`).
- **K-25 Availability computation.**
  - Server (`app/api/dresses/route.js:152-190`): `getBulkAvailableInventory(eventDate, modelIds)` (`lib/inventory.js:380`) uses the settings `inventory_buffer_days` (default 3), `inventory_skip_weekends` (default true), `inventory_include_warehouse`, `allow_renting_reserve_items` and `inventory_hold_minutes` (default 15). It works from shared `buildBookingsWhere` bookings with a ±14-day search window. Per size, the route then assigns available units to items in order. Each item's `quantity` is replaced by its available count, which is 0 for unusable items: `inRepair`, `notInUse`, `isDeleted`, warehouse location unless included, reserve location unless allowed. The route also returns an `isUnusable` flag.
  - Client (`getModelSizeInfo`, `page.js:760-774`): per size (`sizeText||'כללי'`), skipping `notInUse`, `isDeleted` and `isUnusable` items, `total` is the item count and `available` is the number of items with `quantity>0`. This counts items, not the sum of quantities.
  - Additional client filter: `!exitDateFromRepo && items.length>0` (`:493`).
  - `filterStatus=active` on the server excludes deleted models, exited models and models with no in-use item.
- **K-26 Three views.**
  - **Table** (`:1411-1459`). Columns: avatar (sm, 40px), שם דגם, מק״ט (`#prefix`), קטגוריה badge, סה״כ פנוי (green if >0, red if 0), size pills "size · n". A row click opens history; a pill click opens history filtered to that size. Empty cells read "אין מידות רשומות" or "אין מלאי פנוי". There is no per-model print in this view.
  - **Rows** (`:1460-1517`). Avatar (md, 64px); name, `#prefix` badge and category badge (hidden when the category is 'כללי'), shown only when `modelHasRealName`; per-model print button; availability line "N יחידות פנויות" or "אין יחידות פנויות לתאריך זה"; size pills.
  - **Grid** (`:1518-1572`). Card with a print button in the corner, avatar (lg, 88px), name and category badge, code line, availability line and size pills. On hover the card lifts.
  - **Avatar** (`:62-76`): the thumbnail (`getDressThumbUrl`) falls back to `imageUrl` via `onError`. Images are shown unless `hide_dress_images==='true'`. Without an image the avatar shows initials: two words give two first letters, a numeric name gives up to 3 digits, anything else gives 2 characters.
  - **Display name**: "ללא שם…" or an empty name falls back to `barcodePrefix` (`:42-46`).
- **K-27 Self-registration card** (`:1181-1272`), shown only when `kiosk_customer_self_service==='true'`.
  - Fields: שם פרטי*, שם משפחה*, טלפון*, אימייל (* if `require_customer_email`), עיר/רחוב/מספר בית (* if `require_full_address`), and a marketing-consent checkbox (hidden if `hide_marketing_consent_field`, * if `require_marketing_consent`).
  - Client validation (`:597-614`) also honours `mandatory_fields` aliases. Error text: "שדות חובה חסרים: …".
  - A 401 shows "הרישום דורש עובד מחובר במערכת…"; a server `error` is shown as-is.
  - Success: "נרשמתם בהצלחה!", plus "מספר לקוח: <legacyId>" and a "רישום לקוח נוסף" button.
  - The server enforces rules the form cannot satisfy: `require_customer_id_number` (there is no ID field; the rule is on for Neve Yaakov per CLAUDE.md), `mandatory_field_groups`, and format and duplicate checks (`app/api/customers/route.js:116-175`). With those rules on, kiosk registration fails with the server's error text.
- **K-28 Self-order stub** (`:1277-1291`). Shown when `kiosk_customer_self_service` is on, not `kiosk_allow_self_order`. Text: "בקרוב…", with a disabled button "הזמנה עצמאית תיפתח בקרוב". `kioskAllowOrder` is computed at `:348` and never used. The header comment at `:11-12` describes an "off" banner that does not exist.
- **K-29 Order-history popup** (`:1626-1680`).
  - Opened by a **single** click on a row, card or table row, despite the name `handleModelDoubleClick`, and never while locked. There is no `onDoubleClick` anywhere.
  - Title: "הזמנות - <model> (מידה X)". Hint: "טווח: שבוע לפני ואחרי תאריך האירוע".
  - Size filtering happens on the client by description substring: `'מידה: X'` or just `X` anywhere, a loose match where "40" also matches "140". The model match is `item.dressId===model.id || description.includes(model.name)`.
  - Each row shows "הזמנה #orderId - first last", "תאריך אירוע: <he-IL Gregorian only>", a payment badge from `calculatePaymentStatus(totalAmount,totalPaid)` coloured by `getPaymentStatusColor`, and a link icon to `/orders/<orderId>` that opens in a **new tab**.
  - Capped at 50 orders by the server default.
  - States: spinner "טוען נתונים...", empty "לא נמצאו הזמנות לדגם זה בטווח התאריכים הנבחר.". A non-OK response or an error also shows the empty text; there is no error state. The close button is an X icon; there is no backdrop-click close.
- **K-30 AI on the kiosk.**
  - `aiEnabled = hide_ai_features!=='true' && enable_ai_specific_employees!=='true'` (`:346`). The page still reads the retired `enable_ai_specific_employees`.
  - Every AI element carries the class `ai-feature-element`, which `body.hide-ai-features` hides (`globals.css:1820`). The layout sets that class whenever the viewer lacks `feature:ai`, including every anonymous visitor (`layout.js:181-189`). So kiosk AI is visible only when the logged-in employee has `feature:ai`.
  - The server requires `checkAuth()` plus `checkAiAccess()` (`app/api/ai/route.js:92-93`).
  - There is a separate chat per stage (`aiChats[1]`, `aiChats[2]`) with fixed greetings. The chat closes on a stage change (`:414`). A "שיחה חדשה" (+) button resets it.
  - Tags in replies: `[DATE:yyyy-mm-dd]` becomes the button "הצג מלאי לתאריך …" (sets the date at noon and goes to stage 2). `[FILTER:x]` becomes "סנן והצג: x", which sets the search, optionally the date, and goes to stage 2 (`:891-944`).
  - The chat thread is capped at max-height 400px and scrolls. A typing indicator shows while waiting. Errors: "שגיאה בחיבור למערכת ה-AI." / "שגיאת תקשורת.".
  - The client stores `data.tableData` (a field that does not exist; rows are in `data`) and never renders a table.
  - Messages are written to `localStorage.ai_customer_chat` (`:429-433`) and never read back, so a customer's chat persists on a shared machine.
- **K-31 Print report** (`handleCatalogPrint`, `:784-888`).
  - Opens `window.open('')`; if popups are blocked, `alert("נא לאפשר חלונות קופצים…")`.
  - A4 HTML: "בס"ד", heading "דוח זמינות דגמים - גמ"ח שמלות", the requested Hebrew date, and a filter description. The filter description reflects only `search` or the single model; category and size filters are ignored.
  - Table: שם הדגם, קידומת ברקוד, כמות זמינה, sizes "(n)". The code column falls back to `model.id` (a **UUID**, against the ID display rule).
  - Footer: "סה"כ דגמים מוצגים: N". Prints automatically after 300 ms, then closes.
  - Model and size strings are interpolated into the HTML without escaping.

### 4. Idle / screensaver / auto-reset

- **K-32 None.** There is no idle timer, no inactivity reset of stage, search, filters or chat, and no screensaver. The only timers are the 2.5 s post-print fullscreen restore (`:555`) and the 300 ms print delay. After a customer leaves, the previous date, filters, chat and registration state remain for the next customer.

### 5. States

- **K-33 Loading and empty.** Catalog loading: spinner "טוען נתונים..." (`:1396-1400`). Empty: "לא נמצאו דגמים מתאימים / נסו לנקות את החיפוש או את סינון הקטגוריה" plus "נקה סינון ונסה שוב" (`:1401-1410`).
- **K-34 Errors are silent.** Every fetch error is only `console.error`. A 401 or 500 from `/api/dresses` renders as the empty state. Settings, employees and categories failures leave defaults or empty lists.

### 6. SystemSetting keys read

- **K-35 Page-level keys.**
  - `hide_dress_images` (default shown).
  - `hide_ai_features`, `enable_ai_specific_employees` (both gate AI).
  - `kiosk_customer_self_service` (registration and stub).
  - `kiosk_allow_self_order` (read, unused).
  - `mandatory_fields`, `require_customer_email`, `require_full_address`, `hide_marketing_consent_field`, `require_marketing_consent` (registration).
  - Metadata labels are at `lib/settingsMetadata.js:120-121`, `:154`, `:372-373`.
- **K-36 Indirect keys.**
  - Via layout: `require_login`, `hide_gregorian_calendar` (hides Gregorian numbers in the calendar), `hide_ai_features` and `enable_unreturned_orders_popup` (see K-11).
  - Via the dresses API: `inventory_include_warehouse`, `allow_renting_reserve_items`, `inventory_buffer_days`, `inventory_skip_weekends`, `inventory_hold_minutes`.
  - Via the customers API: `require_customer_id_number`, `mandatory_field_groups`, `strict_mandatory_fields`.
  - All are org-dependent by DB value; there is no org-specific code path in the page.

### 7. Dialogs and prompts

- **K-37 Full list.** Unlock/print modal (K-07); order-history modal (K-29); zoom popover; the popup-blocked `alert`; the print window. No confirm dialogs.

### 8. Touch specifics

- **K-38 Target sizes** (`kiosk.css`):
  - Icon buttons 38×38 (`:139-147`); calendar nav buttons 32×32 (`:183`); the modal close button 32px (inline style).
  - Size pills: 11px font, 4×9px padding (`:340`), so tap targets are about 22px.
  - Checkboxes 17px; the switch 40×22.
  - Calendar days are square cells inside a 420px-max calendar, about 55px each.
  - Size chips are a three-column grid, about 8px padding.
- **K-39 Hover-only information.** All toolbar icon buttons (exit, new search, refresh, print, lock/unlock, zoom, the view toggle, the per-model print and the eye toggle) are icon-only; their meaning is only in `title` tooltips, which touch users never see. The per-size "מידה X: N פנויות" is also a `title`. Hover lift and highlight effects exist on cards, rows, table rows and calendar days (`:195`, `:320`, rows `:11` of the tail block).
- **K-40 Other touch behaviour.** The zoom popover closes on outside `mousedown`, which works through emulated mouse events. `user-select:none` is set only on avatars (`kiosk.css:327`). There is no `touch-action` CSS; pinch zoom is disabled only by the `.bat` flag. The results zoom slider is the in-app size control. At 900px and 640px widths the layout switches to one column and the modals get 14px padding.

### 9. Notable or buggy (summary)

- **K-41**
  1. A reload unlocks the kiosk (K-11).
  2. Cancel in the unlock modal leaves the page locked but not fullscreen (K-11).
  3. Unlocking or approving a print logs that employee into the kiosk browser (K-08).
  4. Plaintext passwords from the unlock form are stored in `PageVisitLog.requestQuery` (section 2).
  5. With `require_login` on and nobody logged in, the page shows "no models" instead of an auth error (K-02).
  6. With `require_login` off, anyone with the URL can see customer names and payment status through the unlocked history popup (K-03).
  7. Every calendar change jumps to stage 2; the comment promises a "הצג מלאי" button (K-22).
  8. KIOSK.md is inaccurate: "חיפוש חדש" is not gated and the button name differs (K-05).
  9. `kiosk_allow_self_order` is unused, and the promised "off" banner does not exist (K-28).
  10. Registration cannot satisfy the ID-number requirement (K-27).
  11. The history popup's size match is loose and capped at 50 orders (K-29).
  12. The print report can show a UUID, ignores category and size filters, and has unescaped HTML (K-31).
  13. `tableData` is never rendered, and the AI chat persists in localStorage (K-30).
  14. The page still reads the retired `enable_ai_specific_employees` (K-30).
  15. Search by size substring includes unusable items (K-24).
  16. Size chips omit 'כללי' (K-24).
  17. No idle reset (K-32).
  18. `AppShell` watchers can pop up over a locked kiosk (K-11).

---

## B. Punch clock — `/punch-clock`

### 1. Access

- **P-01 Public, no login wall.** `layout.js:51` sets `isPunchClock`, excluded from `showLogin` at `:279`. The page renders inside the normal `AppShell`, even for anonymous visitors. It has no `layout.js`, and `page:punch_clock` has `enforced:false`.
- **P-02 Entry points.** Login screen link "רק לרישום כניסה/יציאה למשמרת? לחצו כאן" (`app/components/LoginScreen.js:480-485`); `UserMenu` (`app/components/UserMenu.js:183`); home tiles (`app/page.js:53`).
- **P-03 Navigation shown to anonymous visitors.** With `require_login` on, an anonymous visitor still sees the sidebar links for orders, rentals and customers: `pageVisible()` returns true when not authenticated (`layout.js:213`). Following one lands on the login screen.

### 2. Fetches

- **P-04 Employee list.** `fetchSharedJson('/api/employees', {ttl: TTL.STATIC})`, shared client cache of 5 minutes (`page.js:29-31`, `lib/apiCache.js:54`). Anonymous callers get active employees' id and name only. Logged-in callers get full safe rows, still active-only because `all` is not passed.
- **P-05 Device trust.** `GET /api/auth/device-status` → `{trusted,label}` (public). On a trusted device the password label becomes "סיסמא או קוד מקוצר (4 תווים)" (`page.js:32-35`, `:181`).
- **P-06 OUT button only, laundress check** (`page.js:48-65`):
  - `GET /api/settings` (no-store), looking for `laundress_return_check_on_exit==='true'`.
  - If that is on: `GET /api/orders?filterStatus=archive&limit=50`. That is the 50 most recent orders with `eventDate < today`, sorted by eventDate desc, and it needs auth. The client keeps orders with any item `!isDeleted && isTaken && !isReturned`.
  - If any remain: `window.customConfirm("יש N משפחות שלא החזירו (לדוגמה: <up to 5 customerName>). האם לוודא שהן אכן לא החזירו?")`, falling back to `window.confirm`. Cancelling gives "יציאה בוטלה - בדוק החזרות" and aborts the punch.
  - Any error, including a 401 for anonymous visitors under `require_login`, is swallowed and the check is skipped.
  - The check runs before any identity or password check and for every employee, not just laundresses. It can expose customer names on the public page.
- **P-07 Punch.** `POST /api/attendance {employeeId, password, action:'IN'|'OUT'}` (`page.js:71-75`).

### 3. Screen and fields

- **P-08 Single centred card, max-width 420** (`page.js:98-237`):
  - Header "שעון נוכחות" with description "בחירת עובד והזנת סיסמא לרישום כניסה או יציאה מהעבודה".
  - Live clock: `toLocaleTimeString('he-IL')` HH:MM:SS, updated every second, "..." before the first tick. It shows the **client** clock and label "השעה כעת".
  - Employee combobox (P-09).
  - Password field with a lock icon, an eye toggle (title "הצג סיסמה") and `autoComplete="new-password"`.
  - Two large buttons: "כניסה" (primary, check icon) and "יציאה" (danger, logout icon). Both show a spinner while loading.
  - Status callout (P-15).
  - There is no `<form>`: **Enter does nothing**, and both buttons are `type="button"`.
- **P-09 Employee identification.**
  - A type-to-filter combobox over "firstName lastName" (plain case-sensitive substring, `:38-39`). The dropdown opens on focus or typing; placeholder "טוען רשימת עובדים..." or "הקלד לחיפוש שם...".
  - Picking uses `onMouseDown`, fills the name, stores `emp.id` and focuses the password field. Typing again clears the selection. Blur closes the list after 200 ms.
  - No results: "לא נמצאו תוצאות".
  - The input has `autoComplete` specified twice (`:131`, `:143`; duplicate JSX prop).
  - Identity proof is the employee's full password, or on a **trusted device** the 4-character short code (`pinHash`). The UI does not accept a badge, a PIN pad or a no-password session punch, even though the API supports session punches.

### 4. Punch logic (server, `app/api/attendance/route.js:60-198`)

- **P-10 No blanket auth, by design.** POST has no `checkAuth` (comment `:55-59`). Validation:
  - `employeeId` required and `action ∈ {IN,OUT}`, otherwise 400.
  - Lookup by UUID, or by legacyId when the value is digits only. Not found: 404 "עובד לא נמצא".
  - With a password: bcrypt `verifySecret` against `employee.password`. If that fails and the device is trusted and the employee has a `pinHash`, the short code is tried. Not trusted and length ≤4: 401 "קוד מקוצר אפשרי רק ממחשב מערכת מהימן - יש להזין את הסיסמה המלאה". Otherwise 401 "סיסמה שגויה".
  - Without a password: the session must be that employee, otherwise 401 "רישום נוכחות ללא סיסמה אפשרי רק לעובד המחובר". The page never uses this path.
  - Inactive employee: 403 "חשבון העובד אינו פעיל". This is checked only after the password check.
  - There is no rate limiting or lockout. Combined with public employee ids, this is an anonymous password-guessing endpoint.
- **P-11 Open-shift detection.**
  - `shift.findFirst({employeeId, exitTime:null}, orderBy id desc)` across any date, so a shift opened before midnight is still found.
  - There is no `isDeleted:false` filter, so a soft-deleted open shift blocks IN and would be the one closed by OUT.
  - `orderBy id desc` sorts by UUID, which is arbitrary, not the newest shift when several are open.
- **P-12 IN and OUT.**
  - **IN:** if an open shift exists, 400 "כבר נרשמה כניסה - יש לרשום יציאה קודם". Otherwise it creates a Shift with `date = todayStart` (server-local midnight; on Vercel that is UTC, so an Israel punch between 00:00 and about 03:00 gets the previous date), `entryTime=now`, `hourlyWageSnapshot=hourlyWage||0` and `travelExpensesSnapshot`.
  - **OUT:** with no open shift, 400 "לא נמצאה משמרת פתוחה לרישום יציאה". Otherwise:
    - `totalMinutes = floor((now-entry)/60000)`.
    - `totalCalculated = minutes/60*wage`, plus the travel allowance, credited only on the first shift of that `date`, where the earlier-shift lookup does filter `isDeleted:false`.
    - Rounded to 2 decimals.
    - There is no maximum shift length and no guard for a forgotten punch-out: the next day's OUT closes a shift of about 24 hours or more.
  - `Shift` is excluded from the audit extension (CLAUDE.md), so punches leave no `AuditLog` row.
- **P-13 Passwords in `PageVisitLog`.** The global fetch interceptor logs the POST body `{employeeId,password,action}` as `requestQuery`. That body contains the plaintext password. It is stored whenever `/api/log-visit`'s `checkAuth` passes: when someone is logged in on that machine, or whenever `require_login` is off (same mechanism as section A.2).

### 5. Messages

- **P-14 Messages shown** (`page.js:41-94`).
  - Missing field: "אנא בחר עובד והזן סיסמא".
  - Server error: "שגיאה: <error>".
  - Success: "✅ כניסה נרשמה בהצלחה" or "✅ יציאה נרשמה בהצלחה". After success the form clears (employee, search, password) and the message clears after 3 s. That timeout is never cancelled and can also wipe a later message.
  - Network failure: "שגיאת תקשורת, אנא נסה שוב.".
  - Laundress cancel: "יציאה בוטלה - בדוק החזרות".
  - The success message does not show the entry or exit time, the shift length, or who punched.
- **P-15 Callout colour bug.** The colour is chosen by `statusMessage.includes('שגיאה')` (`:96`). "אנא בחר עובד והזן סיסמא", "שגיאת תקשורת…" ("שגיאת" is not "שגיאה") and "יציאה בוטלה…" therefore render in the **green success** callout with a check icon (`:227-232`).
- **P-16 No current-status display.** The page never shows whether the selected employee is currently in or out.

### 6. Idle / timers

- **P-17 Timers.** A 1 s clock interval, a 3 s success-message clear and a 200 ms blur delay. There is no idle reset: a typed but unsubmitted password stays in the field, masked, until the page is left.

### 7. States

- **P-18 Loading, empty, error.**
  - Employees loading: `employees===null`, placeholder text and a spinner row in the dropdown.
  - Employee fetch failure: `[]`, shown as "לא נמצאו תוצאות" with no error text.
  - Punch in flight: both buttons disabled with spinners.

### 8. SystemSetting keys and org behaviour

- **P-19 Keys.**
  - `laundress_return_check_on_exit` ("בדיקת כובסת ביציאה", category הודעות, `lib/settingsMetadata.js:117`, `:369`, `:410`); default off when the row is missing.
  - Via layout: `require_login` (does not block this page, but affects the laundress check's 401 and log-visit), plus the usual shell toggles.
  - Via server: the trusted-device registry (not a SystemSetting).
  - No org-specific code; behaviour differs only by DB values.

### 9. Dialogs

- **P-20 Dialogs.** Only the laundress `customConfirm` (from `PopupProvider`, `app/components/PopupProvider.js:200`) with its `window.confirm` fallback. The AppShell's `ShiftMessageWatcher` may also prompt shift-handover notes if a session exists.

### 10. Touch

- **P-21 Touch specifics.** Uses design-system classes (`btn-lg`, `input`, `combobox`). Options are selected via `onMouseDown`, which works through emulated mouse events. The eye toggle is icon-only with a `title`. There is no on-screen PIN pad, so typing requires the device keyboard. The dropdown's 200 ms blur delay is a known source of missed taps on slow devices (not verified).

### 11. Notable or buggy (summary)

- **P-22**
  1. Plaintext password stored in `PageVisitLog` (P-13).
  2. No lockout or rate limit on public password checks (P-10).
  3. Server-local midnight dating (UTC on Vercel) (P-12).
  4. Open-shift lookup ignores `isDeleted` and uses UUID ordering (P-11).
  5. No forgotten-punch-out guard (P-12).
  6. Validation and network errors render green (P-15).
  7. Enter does not submit (P-08).
  8. The laundress check runs before authentication, for every employee, covers only the last 50 archived orders, and silently skips for anonymous visitors under `require_login` (P-06).
  9. No in/out status or time confirmation (P-14, P-16).
  10. Duplicate `autoComplete` prop (P-09).
  11. Anonymous visitors see nav links under `require_login` (P-03).
