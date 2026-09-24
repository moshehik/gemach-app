# חוזה: המעטפת (SHELL)
קבצים: `app/layout.js` (652), `app/components/AppShell.js` (256), `navConfig.js` (81), `TopbarSearch.js` (260), `UserMenu.js` (226), `NotificationBell.js` (190), `ThemeToggle.js` (74), `PageGate.js` (13) + נלווים: `BrandLogo.js`, `MessageHistoryButton.js`, `ErrorReportButton.js` (1286), `OverdueRemindersWatcher.js`, `ShiftMessageWatcher.js`, `PrefetchManager.js`, `DevEnvBanner.js`, `PreviewModeBanner.js`, `OfflineIndicator.js`, `NoAccessMessage.js`, `PageTracker.js`, `DesignPrefsSync.js`, `PopupProvider.js`. שורות `file:N` (כל קובץ במספור משלו).

## 0. עיקרון
המעטפת מוחלת על **כל** העמודים; כל הרשאה/ניווט מחושבים **בשרת** ב-`layout.js` ומועברים כ-props. R8: אין לשנות חישובי gate, סדר, מפתחות localStorage/cookies.

## 1. `app/layout.js` — Server Component (חוזה)
### 1.1 מה מחושב (שורות 36-285)
| נושא | מקור | שורות |
|---|---|---|
| Auth cookie | `getVerifiedAuthCookie(cookieStore)` ⇒ `authToken`, `isAuthenticated` | 38-39 |
| נתיב נוכחי | header `x-pathname` (מ-`middleware.js`) — `isPublicKiosk` (`/customer-interface*`), `isPunchClock` (`/punch-clock*`) | 45-51 |
| הגדרות (במקביל, `getAllCachedSettings`) | `require_login`, `enable_alterations`, `hide_ai_features`, `hide_internal_messaging`, `hide_gregorian_calendar`, `enable_ai_specific_employees` (נקרא, לא משמש), `hide_error_reporting`, `enable_deliveries`, `enable_unreturned_orders_popup` | 71-156 |
| תפקיד | session token (`readVerifiedSession` ⇒ `session.r`) או fallback DB `employee.findFirst({id | legacyId})`; ספרות-בלבד בלבד ל-legacyId | 78-105 |
| דגלי תפקיד | `isManager` (roleId 1/2), `isHeadManagement` (0/2), `isProgrammer` (2) | 164-175 |
| AI | `hasAiPermission`: head ⇒ true; אחרת `resolvePageAccess(roleId, id, ['feature:ai'])`; אין ⇒ `hideAIFeatures=true` | 181-189 |
| גישה לעמודים | `NAV_PAGE_KEYS` = `page:refunds, page:dresses_catalog, page:board, page:orders, page:orders_new, page:rentals, page:customers, page:deliveries, page:alterations` ⇒ `pageAccess` (כישלון ⇒ `null`) | 199-203 |
| ערכי Gate | ראו 3.2 | 204-233 |
| ערכת נושא | cookie `theme_<employeeId>` ⇒ `themePreference` (ברירת מחדל `light`); cookie `designPrefs_<id>` (JSON, `decodeURIComponent`) ⇒ `data-palette/font/density/text-scale` (ערכי "כבוי" `wine`/`default`/`comfortable`/`normal` ⇒ אין attribute); `custom` ⇒ `<style id="custom-palette-style">` שנבנה בשרת (`buildCustomPaletteVars`) | 235-277 |
| `showLogin` | `requireLogin && !isAuthenticated && !isPublicKiosk && !isPunchClock` | 279 |
| body class | `hide-ai-features` (אם `hideAIFeatures`), `hide-gregorian-calendar` | 281-285 |

### 1.2 מבנה ה-DOM (שורות 287-650), לפי סדר
`<html lang="he" dir="rtl" data-theme data-palette data-font data-density data-text-scale suppressHydrationWarning>`
- `<head>`: (א) **סקריפט fetch-interceptor** (300-394): עוטף `window.fetch`; לכל `/api/*` (חוץ מ-`/api/log-visit`, `/api/queries-by-path`, ו-`light=1`) מדווח `agy_api_call` event + תור `window.__queueVisitLog` (נשלח ל-`POST /api/log-visit` כל 20 שנ' / 25 רשומות / `visibilitychange:hidden` / `pagehide` דרך `sendBeacon`). (ב) **סקריפט no-FOUC** (395-604): לאורח בלבד (`hasEmployeeCookie=false`) מחיל `localStorage['gemachDesignPrefs']` (`palette/font/density/textScale/customColors/mode`) לפני צביעה; בלוק `__CUSTOM_PALETTE_MATH_*` הוא **העתק מילולי** של `app/lib/customPalette.js` (נבדק ע"י `scratch/test_custom_palette_sync.mjs`). (ג) `<style id=custom-palette-style>` (בשרת, אם `!showLogin`).
- `<body className>`: `<IconSprite/>` → `UniqueNamesProvider` → [`ClipboardDebugger`, `DevEnvBanner`, `PreviewModeBanner`, `OfflineIndicator` (אם `process.env.IS_OFFLINE_MODE==='true'`), `<Suspense><PageTracker/></Suspense>`, `<Suspense><StickyTableHeaders/></Suspense>`, `DesignPrefsSync` (אם `!showLogin && isAuthenticated`)] → `showLogin ? <LoginScreen/> : <LabelsProvider><PopupProvider><AppShell ...>{children}</AppShell><PrefetchManager/>{!hideAIFeatures && <AIFloatingWidget hideAIFeatures employeeId/>}</PopupProvider></LabelsProvider>`.
- Props ל-`AppShell`: `navGroups, isProgrammer, isHeadManagement, hideErrorReporting, hideInternalMessaging, showOverdueRemindersPopup, authToken (=cookie value), themePreference`.
- `metadata`: title `גמ"ח שמלות - קטלוג וניהול`, description.
- **אין footer** בשום מקום במעטפת (נבדק).

## 2. `AppShell.js` — מבנה ומצב
### 2.1 אזורים (`div.app-shell`), לפי סדר
1. `OverdueRemindersWatcher` (אם `showOverdueRemindersPopup`) ; `ShiftMessageWatcher` (אם `!hideInternalMessaging`) — ראו 6.
2. `aside.sidebar[.open]`: `.brand`→`BrandLogo`; לכל קבוצה `.nav-group` (+`.nav-group-label` אם יש label); לכל פריט `<Link.nav-link[.active]>`: איקון `<svg><use href="#i-…">`, `.nav-label`, ו**אם `isHeadManagement`**: כפתור נעץ `.nav-pin-btn[.pinned]` (`#i-thumbtack`, title "הצמדה לתפריט העליון"/"הסרה מהתפריט העליון").
3. `div.main`: `div.topbar`:
   - כפתור `#menuToggle` `title="תפריט"` (`#i-menu`) → `handleMenuToggle`.
   - "אחורה" (`#i-chevron-end`): `history.length>1 ? router.back() : router.push('/')` (דיווח 2026-09-09).
   - "קדימה" (`#i-chevron-start`): `router.forward()`.
   - `.crumb` (איקון + `.topbar-title`) = הפריט הפעיל מ-`navGroups.flatMap(items).find(isActive)`; לא מוצג בעמודים שאין להם פריט מתאים (`/rentals` — פריטיו נושאים `#hash`, ראו סיכון 1; וגם `/profile`, `/messages`, `/display-settings` וכו').
   - `.topbar-pins` (אם `pinned.length>0`): `<Link.icon-btn.topbar-pin-icon[.active] title=label>` + כפתור `×` `.topbar-pin-remove` (title "הסרה מהתפריט העליון"; **פתוח לכולם**, בכוונה).
   - `<TopbarSearch/>`.
   - `.topbar-icon-cluster`: (1) "ריענון וניקוי פילטרים" (`#i-refresh`) ⇒ `window.location.href = window.location.pathname` (מנקה query+hash); (2) `<ThemeToggle employeeId={authToken} initialTheme/>`; (3) `isProgrammer && <MessageHistoryButton/>`; (4) `!hideErrorReporting && <ErrorReportButton/>`; (5) `authToken && !hideInternalMessaging && <NotificationBell employeeId/>`; (6) `<UserMenu hideInternalMessaging/>`.
4. `.sidebar-backdrop.open` (רק `mobileOpen`) — קליק סוגר.
5. `div.content` ← `{children}`.
### 2.2 State ואחסון
| מפתח | סוג | ערכים / התנהגות |
|---|---|---|
| `localStorage['gemachSidebarState']` | מחרוזת | `expanded`/`collapsed`/`hidden`; נקרא ב-mount; נכתב בכל toggle **בדסקטופ** (>900px); מוחל כ-`document.documentElement[data-sidebar]` |
| `localStorage['gemachPinnedNav']` | JSON `[{href,label,icon}]` | מפתח **משותף לדפדפן** (לא פר-עובד — בכוונה); נטען ב-mount + סנכרון בין לשוניות (`storage` event) |
| `mobileOpen` (state) | bool | רק ≤900px; נסגר ב-`handleNavClick` |
- `handleMenuToggle`: `window.innerWidth<=900` ⇒ toggle drawer; אחרת מחזור `expanded → collapsed → hidden → expanded`.
- `isActive(href)`: `'/'` ⇒ שוויון מדויק; אחרת `pathname?.startsWith(href)` — **`href` כולל `#hash` לפריטי rentals** ⇒ אף פעם לא מתאים (pathname לא כולל hash) — ראו סיכון 1.
- `handleNavClick`: סוגר drawer; אם href כולל `#` והנתיב זהה לנוכחי ⇒ `preventDefault` + עדכון `window.location.hash` ידני (כדי לירות `hashchange` — דיווח 4c01513e, `/rentals` מאזין ל-`hashchange`).
- אין קריאות רשת ב-AppShell עצמו.

## 3. מפת ניווט (NAV MAP)
### 3.1 טבלת הסרגל (מ-`navConfig.js:16-67`, סדר תצוגה מלמעלה למטה)
| # | קבוצה (key) / תווית | פריט (label) | route | איקון | Gate flag (`navConfig`) | מפתח הרשאה (`lib/permissions*`) | הערות |
|---|---|---|---|---|---|---|---|
| 1 | `general` (ללא תווית) | בית וחיפוש | `/` | `i-home` | — | `page:home` (קטלוג; אין gate בסרגל) | תמיד מוצג |
| 2 | `orders` (ללא תווית) | הזמנה חדשה | `/orders/new` | `i-plus` | `showOrdersNew` | `page:orders` **וגם** `page:orders_new` | מעל "רשימת הזמנות" (בקשת משתמשת 2026-09-09) |
| 3 | `orders` | רשימת הזמנות | `/orders` | `i-file` | `showOrders` | `page:orders` | |
| 4 | `orders` | השכרות | `/rentals#rented` | `i-truck` | `showRentals` | `page:rentals` | `#hash` (ראו 2.2) |
| 5 | `orders` | החזרות | `/rentals#returned` | `i-check` | `showRentals` | `page:rentals` | |
| 6 | `orders` | משלוחים | `/deliveries` | `i-box` | `showDeliveries` | `enable_deliveries` **וגם** `page:deliveries` | פיצ'ר כבוי כברירת מחדל (org) |
| 7 | `orders` | זיכויים וחובות | `/refunds` | `i-wallet` | `showRefundsTab` | `page:refunds` | ברירת מחדל סגורה: הנהלה בלבד |
| 8 | `orders` | תיקונים | `/alterations` | `i-scissors` | `enableAlterations` | `enable_alterations!=='false'` **וגם** `page:alterations` | |
| 9 | `inventory` / "מלאי" (תווית גלויה) | קטלוג דגמים | `/dashboard/dresses` | `i-bag` | `showDressesTab` | `page:dresses_catalog` | |
| 10 | `people` (ללא תווית) | לקוחות | `/customers` | `i-users` | `showCustomers` | `page:customers` | |
| 11 | `people` | עובדים ונוכחות | `/employees` | `i-user-check` | `showEmployeesTab` | הנהלה ראשית/מתכנת (`isHeadManagement`); שער-שרת ב-`employees/layout.js` (`checkPageAccess(HEAD_MANAGEMENT_ROLES)`) | |
| 12 | `people` | לוח חודשי | `/board` | `i-calendar` | `showBoardTab` | `page:board` | |
| 13 | `people` | עמדת לקוח | `/customer-interface` | `i-eye` | — | `page:customer_interface` (אין gate בסרגל) | ציבורי (ראו customer-interface.md) |
| 14 | `admin` / "ניהול" (תווית + gate ברמת הקבוצה `showAdminTab`) | לוח ניהול | `/admin` | `i-shield` | `showAdminTab` | הנהלה ראשית/מתכנת | |
- קבוצה שכל פריטיה מסוננים נעלמת (`buildNavGroups` `.filter(items.length>0)`).
- תוויות קבוצה גלויות: רק "מלאי" ו"ניהול" (השאר `''` בכוונה, 2026-09-09).
- `showMessages: !hideInternalMessaging` מועבר ל-`buildNavGroups` אך **אין פריט nav שמשתמש בו** (`messages` הוסר מהסרגל 2026-08-08; נגיש דרך תפריט המשתמש ופעמון).
- דפים שהוצאו מהסרגל (כרטיסי קיצור בדף הבית `app/page.js`): dashboard, messages, profile, punch-clock, display-settings, new-order, pricelist, employee-attendance-report (`/employees/report`) ; דפי משנה של ניהול ⇒ כרטיסים ב-`/admin`.
### 3.2 נוסחאות ה-Gate (`layout.js:204-233`) — חוזה מדויק
- `showAdminTab = showEmployeesTab = isAuthenticated ? isHeadManagement : !requireLogin`.
- `showRefundsTab / showDressesTab / showBoardTab = isAuthenticated ? (pageAccess ? pageAccess[key] : isHeadManagement) : !requireLogin`.
- `pageVisible(key) = (isAuthenticated && pageAccess) ? pageAccess[key] : true` ⇒ `showOrders`, `showRentals`, `showCustomers`, `showOrdersNew = pageVisible(orders)&&pageVisible(orders_new)`, `enableAlterations = setting && pageVisible(alterations)`, `showDeliveries = setting && pageVisible(deliveries)`.
- `hideAIFeatures` (מסתיר `AIFloatingWidget` + class גלובלי) — לפי `feature:ai`.
- **הנהלה ראשית** = roleId 0; **מתכנת** = 2; מנהל סניף = 1 (`isManager`) — לא מקבל הנהלה.
### 3.3 אכיפה בשרת (מקביל לסרגל; אי-הסתרה בלבד אינה הרשאה)
`PageGate pageKey=…` (`app/components/PageGate.js`, async server component: `canOpenPage(pageKey)` אחרת `<NoAccessMessage/>`) בשימוש ב-layouts: `alterations`(`page:alterations`), `board`, `customers`, `dashboard/dresses`(`page:dresses_catalog`), `deliveries`, `messages`, `orders`, `orders/new`, `refunds`, `rentals`. `employees/layout.js` ו-`admin/layout.js` משתמשים ב-`checkPageAccess(HEAD_MANAGEMENT_ROLES)` (לא PageGate). `NoAccessMessage`: `h1` "אין הרשאת גישה", כרטיס עם איקון `#i-lock` (52px), "אין לך הרשאה לצפות בעמוד זה", הסבר, כפתור "חזרה לדף הבית" (`/`).
### 3.4 התנהגות מובייל / רספונסיביות (`design-system.css`)
| רוחב | התנהגות |
|---|---|
| >900px | סרגל מימין (RTL) 3 מצבים: `expanded` (רגיל) / `collapsed` (68px, אייקונים בלבד; `.nav-label`,`.nav-group-label`,`.brand-text` מוסתרים; **`.nav-pin-btn` מוסתר**) / `hidden` (`display:none`). `--sidebar-current-w` |
| ≤900px | `--sidebar-current-w:0`; `.menu-toggle` מוצג; הסרגל **drawer** קבוע (`translateX(100%)`→`.open`; 280px/82vw); `sidebar-backdrop` כהה (z 85, סרגל z 90); ווידג'ט ה-AI מוסתר כל עוד הסרגל פתוח (`body:has(.sidebar.open)`, `!important`) |
| ≤640px | `.content` padding 14px; `.topbar` padding; `.page-head` בעמודה; **`.search-box{display:none}`** — תיבת החיפוש בשורת הטופ-בר **מוסתרת** בטלפון (אין דרך חיפוש גלובלי/החזרה בברקוד במובייל!) ; `.theme-panel` רוחב מלא |
- `@media (prefers-reduced-motion)` מבטל transition של הסרגל.

## 4. `TopbarSearch.js`
- **תיבה** `#topbarSearch.topbar-search[.open]`: `.search-box` (קליק/פוקוס פותח) + `input#topbarSearchInput` placeholder "חיפוש לקוח, הזמנה, ברקוד…" (`autoComplete=off`). פאנל `.topbar-search-panel` בשלושה מקטעים:
  1. **תוצאות חיפוש** (מוצג כש-`query.trim().length>=2`): טעינה (`spinner`) / "לא נמצאו תוצאות" / עד **15** תוצאות (`TOPBAR_PANEL_RESULT_CAP`): הזמנה (איקון `#i-file`, "הזמנה #N", שם לקוח) או לקוח (`#i-user`, שם, `phone1||city`); תג צבע info/success. כפתור "הצג את כל התוצאות (N) במסך מלא" ⇒ `router.push('/?q=<query>')`. לחיצה על תוצאה ⇒ סוגר, מנקה, `router.push('/orders/{id}')` (אם `item.orderId`) או `/customers/{id}`.
  2. **החזרה מהירה בברקוד**: טופס — input "סרוק או הקלד ברקוד פריט…" + כפתור submit (`#i-arrow-end`, title "בצע החזרה"). `POST /api/returns/scan` body `{barcode: barcode.replace(/\s+/g,'')}`; הצלחה ⇒ `alert('ההחזרה נקלטה בהצלחה!')`, סוגר, מנקה, `openRentalModal(data.orderId)` (מ-`usePopup`) או `router.push('/rentals?orderId=…')`; כישלון ⇒ `alert(data.error||'שגיאה בהחזרה')`; חריגה ⇒ `alert('שגיאת תקשורת')`. disabled בזמן `isReturning`.
  3. **נצפו לאחרונה** (`localStorage['agy_history']` JSON `[{type,id,name,subtext}]`; מתעדכן על event `agy_history_updated`): כותרת + כפתור "נקה" (מוחק המפתח); ריק "אין היסטוריה זמינה"; לחיצה: `rental` ⇒ `openRentalModal(id)` (או `/rentals?orderId=`), `customer` ⇒ `/customers/{id}`, `dress` ⇒ `/dashboard/dresses/{id}`, אחר ⇒ `/orders/{id}`.
- **חיפוש**: `useDebounce(query,350)`; `GET /api/global-search?q=<encoded trim>` (רק כש->=2 תווים); תשובה `{orders:[{id,orderId,firstName,lastName,...}], customers:[{id,firstName,lastName,phone1,city}]}` ⇒ `[...orders,...customers]`. שגיאות נבלעות. אין מטמון.
- סגירה: `mousedown` מחוץ / `Escape`.
- `agy_history` נכתב על-ידי `lib/historyManager.js` (נקרא מ-`customers/[id]`, `dashboard/dresses/[id]`, `orders/[id]`, `RentalReturnModal`); TopbarSearch קורא/מוחק בלבד.

## 5. `UserMenu.js`
- קריאה: `fetchSharedJson('/api/me',{ttl:TTL.STATIC})` (מטמון משותף גם עם `PopupProvider`/`ExportButtons`); תשובה `{success, employee:{firstName,lastName,department:{name}}, activeShift}`; **401** ⇒ אורח (לא נרשם כשגיאה).
- מצבים: טעינה = `div.avatar.skeleton` 34px; **אורח**: `user-chip` (אווטאר "א", title "אורח — התחברות לא פעילה") ⇒ dropdown עם "אורח / התחברות לא פעילה" + כפתור "היכנס למערכת" ⇒ `LoginScreen isModal`. **מחובר**: אווטאר עם ראשי תיבות (או `U`) + `status-dot online|offline` (לפי `activeShift`), title `"שם — בעבודה/לא בעבודה"`; spinner קטן אם אירוע `app-data-fetching-start` (event גלובלי; `-end` מכבה).
- dropdown (כשפתוח; נסגר ב-`mousedown` חוץ / `Escape`): head (אווטאר, שם, "בעבודה כעת"/"לא בעבודה" + " · {מחלקה}") ; פריטים (כולם `router.push` וסוגרים): **הפרופיל שלי** `/profile` (`#i-user`), **שעון נוכחות** `/punch-clock` (`#i-clock`), **שעות העבודה שלי** `/my-hours` (`#i-calendar`), **הודעות** `/messages` (`#i-message`; רק `!hideInternalMessaging`), **עיצוב ותצוגה — התאמה אישית** `/display-settings` (`#i-settings`); מפריד; **התנתקות** (`.danger`, `#i-logout`).
- `handleLogout`: (1) `GET /api/orders/overdue` (`no-store`); אם `orders.length>0` ⇒ `await window.customConfirm('יש N משפחות שעדיין לא החזירו שמלות ומועד ההחזרה שלהן עבר. לצאת בכל זאת?')` — `false` ⇒ נשארים (דיווח 749aaf87); שגיאות נבלעות. (2) `POST /api/logout`. (3) **`window.location.href='/'`** (רענון מלא — כי layout שרת + מטמון `/api/me`).
- כל הכפתורים `disabled={actionLoading}`.

## 6. `NotificationBell.js` (רק `authToken && !hideInternalMessaging`)
- כפתור `.icon-btn` `title="התראות"` + `#i-bell` + נקודה `.dot` אם `unreadCount>0`. פתיחה: `fetchNotifications()` (`GET /api/notifications`) ואז toggle.
- **פולינג**: `GET /api/notifications?light=1` כל **120,000ms** (רק טאב גלוי; `visibilitychange` עוצר/מחדש + טעינה מיידית בחזרה), וגם בכל שינוי `pathname`; תשובה `{success, unreadCount:number}` ⇒ `unreadFromPoll`; אם הפעמון סגור ⇒ מנקה רשימה מיושנת. (`light=1` מוחרג מ-interceptor ומ-log-visit.)
- `unreadCount` = רשימה טעונה ? (לא-נקראו ∧ לא-ארכיון) : `unreadFromPoll`.
- פאנל (`.user-menu-dropdown` 340-380px): head "התראות (N)" + קישור "פתח מרכז הודעות" (`/messages`, `#i-mail`); גוף (גובה 350 גלילה): ריק ⇒ "אין הודעות חדשות" (`#i-message`); שורה: אווטאר (אות ראשונה של השולח או "מ"; צבע info אם `receiverId` אחרת success), שם שולח / "מערכת", תג "לכולם" אם `receiverId===null`, שעה (`he-IL` HH:mm), תוכן (`pre-wrap`), כפתור "סמן כנקרא" (`#i-check`) ללא-נקראו ⇒ `POST /api/notifications/read` `{notificationId}`; `res.ok` ⇒ מעדכן מקומית ומפחית מונה. נסגר `mousedown` חוץ/`Escape`.
- **קשור**: `ShiftMessageWatcher` (ב-AppShell, `!hideInternalMessaging`): פעם אחת ב-mount `GET /api/notifications` (`no-store`), לכל `category==='shift_handover' && !handledAt` ⇒ `showConfirm('{content}\n\n(מאת {שולח}) — לסמן כטופל?','הודעה למשמרת הבאה')` ⇒ אישור ⇒ `POST /api/notifications/handle` `{notificationId,handled:true}`; ביטול משאיר פתוח לעובד הבא (f8a11b55).
- **`OverdueRemindersWatcher`** (רק `showOverdueRemindersPopup`=`enable_unreturned_orders_popup==='true'`, נווה יעקב): `GET /api/orders/overdue` (`no-store`) ב-mount ואז כל שעה; מוגבל ע"י `sessionStorage['overdueRemindersLastShownAt']` (שעה); פותח `OverdueOrdersModal` (חסום, ממוין) אם יש איחורים.

## 7. `ThemeToggle.js`
- כפתור `.icon-btn`, `title` "עבור למצב כהה"/"עבור למצב בהיר"; איקון **lucide** `Moon`/`Sun` size 17 (החריג היחיד מהספרייטה — אין sun/moon ב-`IconSprite`).
- state `theme` מ-`initialTheme` (cookie); לאורח: mount-effect קורא `localStorage['gemachDesignPrefs'].mode` (`dark|light|contrast`); מאזין ל-`DESIGN_PREFS_EVENT` (`mode` או `auto` ⇒ `prefers-color-scheme`); effect כותב `data-theme` על `<html>` ולמחובר גם cookie `theme_<employeeId>=<theme>; path=/; max-age=31536000; SameSite=Lax`.
- toggle: `dark ⇄ light` בלבד (contrast נשאר רק דרך display-settings); כותב `localStorage['gemachDesignPrefs'].mode`; למחובר `pushPrefsToServer({mode})` ⇒ (`lib/designPrefs`) `Employee.themeColor` JSON דרך `/api/me/design-prefs`.
- `DesignPrefsSync` (mount, מחובר): `GET /api/me/design-prefs` ⇒ `{success,employeeId,prefs}`; DB גובר: ממזג ל-localStorage, cookies (`designPrefs_<id>`, `theme_<id>`), `applyPrefsToDom`, אירוע `DESIGN_PREFS_EVENT`; אם DB ריק ויש local — מיגרציה חד-פעמית (`pushPrefsToServer`).

## 8. באנרים / סטטוסים / נלווים
| רכיב | תנאי | תוכן |
|---|---|---|
| `PreviewModeBanner` (שרת) | `VERCEL_ENV==='preview'` | `.preview-mode-banner[role=alert]` `#i-alert-tri` "גרסה זמנית לבדיקת תיקון — הקוד כאן זמני, אבל הנתונים הם הנתונים האמיתיים של הגמ״ח" — **חייב להישאר כנה: אל תכתבו "נתוני בדיקה"** |
| `DevEnvBanner` | `NODE_ENV==='development'` בלבד | widget קבוע: בורר Prod/Test (`GET/POST /api/dev/switch-env`, מרענן דף), פאנל קישורי DB עם העתקה (lucide) — מפתח dev; לא לעצב מחדש למשתמש קצה |
| `OfflineIndicator` | `IS_OFFLINE_MODE==='true'` | `.offline-indicator` (lucide `WifiOff`) "אופליין"; קליק מסתיר |
| `MessageHistoryButton` | `isProgrammer` | `#i-message`+נקודה אם `alertsHistory>0`; מודל (portal, z 999999) "היסטוריית הודעות מערכת" — 100 האחרונות מ-`PopupProvider.alertsHistory`, כל שורה `callout` (error/success/info) + שעה + כפתור "העתק הודעה" |
| `ErrorReportButton` | `!hideErrorReporting` | `#i-alert-circle`, title "מערכת דיווחי שגיאות", נקודה אם יש לא-נקראו; מודל (portal, z 999999, 600px): רשימת פניות/ארכיון/פנייה חדשה, תגובות, צילום מסך/הקלטה/בחירת אלמנט, מתג "סוכן תיקון אוטומטי" (מתכנת). קריאות: `GET /api/error-report[?light=1]`, `POST /api/error-report`, `POST /api/error-report/reply`, `GET/POST /api/agent/fix-loop`, `GET /api/settings`. **רכיב של 1286 שורות עם חוזה משלו — לא במסגרת ה-shell; שלב 5 (חלוניות) צריך חוזה נפרד** |
| `AIFloatingWidget` | `!hideAIFeatures` | FAB + פאנל (מחוץ ל-AppShell; ראו `feature:ai`); נסתר ב-`hide-global-nav` |
| `PopupProvider` | תמיד (חוץ מ-LoginScreen) | מחליף `window.alert/customConfirm/customPrompt/customAuthPrompt/customThreeWayConfirm`; **toast-stack** קבוע `top:20px; left:50%` (מרכז עליון) כל 4 שנ'; `POST /api/logs` `{action:'UI_ERROR_ALERT'}` לכל הודעה שסוג=error או שמכילה "שגיאה"; `openRentalModal(orderId)` גלובלי. ⚠ **R21** דורש הודעות "למטה-שמאל" — נדרשת החלטה איך זה מתיישב עם המיקום הנוכחי (מרכז-עליון) |
| `PageTracker` | תמיד (Suspense) | `window.__queueVisitLog({pageUrl, loadingError})` בכל ניווט (לא `/api`,`/_next`) + `error` event |
| `StickyTableHeaders` | תמיד (Suspense) | מחיל כותרות טבלה דביקות (ראו `globals.css` `table thead tr th !important`) |
| `ClipboardDebugger` | תמיד | כלי דיבוג |

## 9. Prefetch (`PrefetchManager` + `lib/prefetchRoutes.js`)
- מותקן פעם אחת, **לא פעיל בקיוסק** (`/customer-interface*`). (א) האזנת `mouseover/focusin/touchstart` (passive) על `document`: לינק פנימי (`a[href^=/]`, מוריד `?`/`#`) לנתיב רשום ב-`isPrefetchableRoute` ≠ הנוכחי ⇒ `prefetchRoute(route)`. (ב) 2.5 שנ' אחרי טעינת עמוד: `prefetchNeighbors(pathname)`.
- `ROUTE_NEIGHBORS`: `/`→[orders,customers]; `/orders`→[customers,board,rentals]; `/customers`→[orders]; `/board`,`/rentals`,`/alterations`,`/refunds`,`/dashboard/dresses`,`/employees`→[orders].
- נתיבים רשומים (`prefetchRoutes`): `/orders`, `/customers`, `/alterations`, `/dashboard/dresses`, `/board`, `/rentals`, `/refunds`, `/employees` (מחמם `GET /api/employees?all=true` ב-`TTL.STATIC`). **מפתח המטמון = `URLSearchParams.toString()` בסדר הוספה מדויק** — שינוי סדר פרמטרים בעמוד ללא סנכרון בונה-הפרמטרים שובר prefetch.
- Next `<Link>` עושה prefetch של קוד בנוסף.

## 10. `BrandLogo` (בראש הסרגל)
`<img src="/api/logo[?v=<localStorage.logo_timestamp>]" alt="לוגו" title="גירסא <version.json.version> | <date>">` (גובה 38px); אירוע `logoUpdated` (detail=timestamp) מרענן; `onError` ⇒ טקסט "גמ"ח שמלות". גרסה = `app/version.json` (נטען אחרי mount למניעת hydration mismatch).

## 11. קריאות רשת — סיכום מעטפת
| URL | רכיב | תדירות |
|---|---|---|
| `GET /api/me` (shared cache STATIC) | UserMenu, PopupProvider, ExportButtons | פעם למטמון |
| `GET /api/employees` (shared STATIC) | PopupProvider (auth prompt), LoginScreen | פעם |
| `GET /api/notifications?light=1` | NotificationBell | 120 שנ' + ניווט + חזרה לטאב |
| `GET /api/notifications` | פעמון (בפתיחה), ShiftMessageWatcher (mount), LoginScreen | לפי צורך |
| `POST /api/notifications/read` / `/handle` | פעמון / ShiftMessageWatcher | לפי פעולה |
| `GET /api/global-search?q=` | TopbarSearch | debounce 350ms |
| `POST /api/returns/scan` | TopbarSearch | submit |
| `GET /api/orders/overdue` | UserMenu.logout, OverdueRemindersWatcher | logout / שעתי |
| `POST /api/logout` | UserMenu | logout |
| `GET /api/me/design-prefs` (+`PUT` דרך `pushPrefsToServer`, body חלקי) | DesignPrefsSync, ThemeToggle | mount / toggle |
| `POST /api/log-visit` (batch) | interceptor+PageTracker | 20 שנ' / 25 / pagehide |
| `GET /api/logo` | BrandLogo | טעינה |
| `GET /api/error-report?light=1` | ErrorReportButton | (polling פנימי) |

## 12. מפתחות אחסון / cookies (חוזה)
localStorage: `gemachSidebarState`, `gemachPinnedNav`, `gemachDesignPrefs`, `agy_history`, `logo_timestamp`, `ai_statistics_chat_sessions_*`, `ka_zoom_level`, `ai_customer_chat`. sessionStorage: `overdueRemindersLastShownAt`. cookies: `auth_token`/`auth_session` (HMAC), `theme_<id>`, `designPrefs_<id>`. events (window): `agy_history_updated`, `agy_api_call`, `app-data-fetching-start/end`, `logoUpdated`, `DESIGN_PREFS_EVENT`, `storage`.

## 13. Risk notes לעיצוב מחדש של המעטפת
1. **`isActive` + hash**: פריטי `/rentals#rented|#returned` לעולם לא מסומנים כפעילים ואין להם `.crumb` (זה המצב הקיים). עיצוב מחדש שמסמן פעיל לפי hash = שינוי התנהגות; אם נדרש — לתאם.
2. **הסתרה ≠ הרשאה**: gate בסרגל תואם `PageGate`/`checkPageAccess` בשרת; אל תוסיפו פריט בלי המפתח המתאים ב-`lib/permissionsMetadata.js`.
3. `handleRefresh` = `location.href = pathname` (מאבד `?query` ו-`#hash`) — "ריענון וניקוי פילטרים" — חוזה.
4. **מובייל ≤640**: `.search-box{display:none}` — אין חיפוש ואין החזרה-בברקוד בטלפון. עיצוב מחדש חייב להחליט (חוזה = קיים).
5. `.nav-pin-btn` מוצג רק להנהלה ראשית/מתכנת, אך ה-"×" בטופ-בר פתוח לכולם; `gemachPinnedNav` משותף לדפדפן.
6. שורת ה-topbar תלויה בסדר: back, forward, crumb, pins, search, cluster. ה-`.topbar-icon-cluster` "ממוסגר" (design-system.css) והכפתורים שקופים — R13 (מסגרות) לתאם.
7. `LoginScreen` מחליף את כל ה-AppShell — אין topbar/פעמון/תפריט במסך כניסה; `data-theme` נכפה `light`.
8. `DevEnvBanner`/`PreviewModeBanner`/`OfflineIndicator`: לא לגעת בתוכן/תנאים; ניתן לעצב.
9. **`window.alert` מוחלף** ב-`PopupProvider` ⇒ כל `alert()` בעמודים הוא toast מרכזי-עליון 4 שנ' (לא native) — R20/R21 משפיעים על כל האתר דרך רכיב אחד.
10. סקריפטי `<head>` (interceptor + no-FOUC) ובלוק הפלטה המועתק — אין לגעת; עדכון `customPalette.js` דורש סנכרון (test קיים).
11. צבע האיקונים: ספריית `IconSprite` (67 סמלים) — R12 (איקונים מונפשים) דורש מיפוי `#i-*`→שם באיקון-ספרייה; ThemeToggle (lucide) ו-DevEnv/Offline (lucide) חריגים.
12. `useRouter().back()` fallback: `history.length>1` — לשמר.
13. RTL: חצי back/forward ממופים `chevron-end`(אחורה)/`chevron-start`(קדימה) — לא להפוך; הסרגל ב-`inset-inline-start` (ימין).
14. `PrefetchManager` מוצמד לנתיבי `<a href>` פשוטים; אם הסרגל יעבור ל-`onClick`+`router.push` ללא `<a href>` — prefetch יישבר.

## 14. מלל (רשימה לכתיבה מחדש)
תוויות ניווט (13 + "מלאי"/"ניהול"), tooltips של topbar (תפריט, אחורה, קדימה, ריענון וניקוי פילטרים, התראות, מצב כהה/בהיר, הצמדה/הסרה), placeholder חיפוש, כותרות מקטעי החיפוש (3), הודעות ריק/טעינה, תפריט משתמש (7 פריטים + כותרות), פעמון (4 מחרוזות), confirm של logout, NoAccessMessage (4), באנרים (2), Logo alt/title. **לא לשכתב**: הודעת PreviewModeBanner (כנות), כותרות `document.title`/`metadata`.
