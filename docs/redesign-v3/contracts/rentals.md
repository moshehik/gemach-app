# חוזה עמוד: /rentals (השכרות והחזרות)

מקור: `app/rentals/page.js` (765 שורות), `app/rentals/layout.js`. רכיבים: `components/ExportButtons.js`, `app/components/StatisticsModal.js`, `components/orders/RentalReturnModal.js` (1108 שורות), `components/orders/OrderModelSelector.js`, `app/components/RentedPastEventWidget.js`, `lib/lateReturn.js`, `components/orders/returnScanClient.js`, `app/lib/prefetchRoutes.js`, `app/lib/pageCache.js`.

## א. תכלית והרשאות
- מעקב אחר פריטים שיצאו (לשונית "השכרות") ופריטים שהוחזרו (לשונית "החזרות"); פתיחת כרטיס השכרה/החזרה (RentalReturnModal) לכל הזמנה.
- גישה: `PageGate pageKey="page:rentals"` (layout.js:6; קטלוג lib/permissionsMetadata.js:199; ברירת מחדל הנהלה ראשית/מתכנת). הקישור בסיידבר לפי אותה החלטה.
- הרשאות פנימיות דרך חלוניות: `feature:early_return_approval` (returnScanClient.js:19, דרך `verifyPin`), `feature:export_max_rows` (ExportButtons, מ-`/api/me`).

## ב. אזורים לפי סדר (DOM)
1. `.page-head` (370-397): h1 דינמית (`activeTabGroup==='returns' ? 'החזרות' : 'השכרות'`), `.page-desc` "סה"כ רשומות: {loading ? '...' : totalCount}"; `.page-actions`: כפתור חיפוש מתקדם + `ExportButtons`.
2. `RentedPastEventWidget` (399) - רק כש-`activeTabGroup==='rentals'`.
3. `.toolbar` סרגל חיפוש (402-460) - שני מצבים: רגיל / AI.
4. `.tabs` לשוניות ראשיות (465-472): השכרות / החזרות.
5. `.pill-tabs` תת-סינון (475-495): בלשונית השכרות "הכל"/"הושכר חלקי בלבד"; בהחזרות "הכל"/"הוחזר חלקי בלבד".
6. חלונית סינון מתקדם (portal ל-body, 497-593), מותנה `showAdvSearch`.
7. `.table-wrap` טבלה + `.table-foot` עימוד (595-746).
8. `RentalReturnModal` (748-754) מותנה `selectedOrderId`; `StatisticsModal` (756-762) תמיד מורכב, `isOpen={!!showStatistics}`.

## ג. שדות / קלטים
| תווית | state | פורמט/ולידציה | שורה |
|---|---|---|---|
| חיפוש חופשי (placeholder "חיפוש חופשי (הזמנה, לקוח, דגם)...") | `search` | טקסט חופשי; מוזן ל-`useDebounce(search,350)` = `debouncedSearch` שמפעיל fetch | 438-443 |
| חיפוש AI (placeholder "בקש מה-AI למצוא נתונים...") | `aiInputText`, `aiInputMode` | `disabled={aiLoading}`; submit ריק (trim) נחסם (299-301) | 408-414 |
| סינון: `getLabel('order_id','מספר הזמנה')` | `advFilters.advOrderId` | טקסט | 525-526 |
| ברקוד/פרטי פריט | `advFilters.itemDetails` | טקסט + איקון #i-tag | 529-534 |
| דגם | `advFilters.advModelName` | `OrderModelSelector` (`value={{name}}`, `onChange(m)=> m ? m.name : ''`, placeholder "בחר דגם...") | 535-542 |
| `getLabel('order_customerName','שם לקוח')` | `advFilters.customerName` | טקסט | 549-551 |
| טלפון לקוח | `advFilters.customerPhone` | טקסט | 553-557 |
| עיר מגורים | `advFilters.customerCity` | טקסט | 560-564 |
| checkbox "חפש עם AI על השדות שמולאו" (`#rentals-adv-ai-mode`, מחלקה `ai-feature-element`; מוסתר כש-body.hide-ai-features) | `advAiMode` | - | 570-573 |
| מספר עמוד `#rentalsListPageNum` (type=number min=1 max=totalPages) | `page` | `parseInt`; מתקבל רק 1..totalPages, ואז `goToPage(v)` | 727-736 |
- שדות שקיימים ב-`defaultRentalsAdvFilters()` ואין להם UI: `eventDateFrom`, `eventDateTo` (prefetchRoutes.js:120-124) - נשלחים ל-API רק אם מולאו (לא ניתן למלא בעמוד).
- כל שדות ה-advFilters נשמרים ב-state בלבד (אין localStorage).

## ד. כפתורים / פעולות
| כפתור | handler | פעולה |
|---|---|---|
| איקון רשימה (title "חיפוש מתקדם") | `setShowAdvSearch(true)` | פותח חלונית סינון |
| "חיפוש" (submit, מצב רגיל) | inline (434) | `preventDefault`; אם `isAiModeActive` -> `setIsAiModeActive(false)` (חוזר לרשימה רגילה); אחרת אין קריאה (החיפוש כבר חי דרך debounce) |
| X "נקה חיפוש" (מוצג כש-search לא ריק) | `handleClearSearch` | `setSearch('')` + כיבוי AI mode |
| כוכב "חיפוש חכם (AI)" | `toggleAiInputMode` | מעבר בין מצבים; בכניסה מעתיק search->aiInputText, ביציאה aiInputText->search (עדכון `search` מפעיל fetch) |
| "חפש בחכמה" (submit ב-AI mode) | `handleAiInputSubmit` -> `handleAiSearch(aiInputText)` | ראו ה'. טקסט בזמן טעינה "מייצר שאילתה..." + disabled |
| X ב-AI mode ("נקה") | `setAiInputText('')` | מוצג כש-`aiInputText && !aiLoading` |
| איקון activity "שאלות סטטיסטיקה" (בשני המצבים) | `setShowStatistics({x:e.clientX,y:e.clientY})` | פותח StatisticsModal ממוקם ליד הלחיצה |
| לשונית "השכרות"/"החזרות" | `switchTabGroup('rentals'\|'returns')` | `setViewMode('rented'\|'returned')` + `history.replaceState(null,'','#rented'\|'#returned')` (ללא רשומת היסטוריה) |
| pill "הכל" / "הושכר חלקי בלבד" / "הוחזר חלקי בלבד" | `setViewMode('rented'\|'rented_partial'\|'returned'\|'returned_partial')` | לא מעדכנים hash. title-ים: "כל ההזמנות עם פריט שנמצא כרגע בחוץ (כולל הושכר חלקי)", "רק הזמנות עם חלק מהפריטים בחוץ וחלק שטרם נלקח", "כל ההזמנות עם פריט שהוחזר (כולל הוחזר חלקי)", "רק הזמנות עם חלק מהפריטים שהוחזרו וחלק שעדיין לא" |
| שורת טבלה (כל ה-tr, cursor pointer) | `openOrder(ord.orderId)` | `setSelectedOrderId` |
| איקון box בתא לקוח (title "פתח השכרה/החזרה") | `stopPropagation` + `openOrder` | כנ"ל |
| "פירוט" בתא פריטים | `stopPropagation` + toggle `expandedOrders[orderId]` | שורת פירוט מתחת; החץ מסתובב 180; title "הצג רשימה"/"הסתר רשימה" |
| כותרות עמודה (מספר הזמנה, לקוח, תאריך אירוע, סטטוס) | `handleSort(col)` | אותה עמודה = היפוך `order`; אחרת `sort=col`, `order='asc'`. תאריך אירוע קורא `handleSort('eventDate')` |
| "הקודם" / "הבא" | `goToPage(page∓1)` | מוגבל 1..totalPages; disabled בקצוות; מוצג רק כש-`totalPages>1` |
| חלונית מתקדם: "נקה הכל" | `setAdvFilters(defaultRentalsAdvFilters())` | לא סוגר; לא מאפס advAiMode |
| חלונית מתקדם: "סגור והחל סינון" | inline 577-585 | אם `advAiMode`: `prompt=buildRentalsAiPrompt(advFilters)`, סוגר, ואם prompt לא ריק -> `handleAiSearch(prompt)`; אחרת רק סוגר (הסינון חי כבר בזמן ההקלדה דרך `advFilters` ב-useEffect deps) |
| חלונית מתקדם: X / לחיצה על backdrop | `setShowAdvSearch(false)` | |
| לשוניות חלונית "הזמנה ופריט" / "פרטי לקוח" | `setAdvTab('basic'\|'details')` | |
| `ExportButtons` | ראו ט' | |
- **קוד מת:** `handleQuickReturn`, `quickBarcode`, `quickStatus`, `isProcessing` (122-125, 304-362) מוגדרים אך **אין להם UI ב-JSX** (בר החזרה מהיר הוסר מהתצוגה). ההיגיון (בדיקת איחור דרך `GET /api/returns/scan?barcode=`, `window.customConfirm` "החזרה באיחור", `postReturnScan`) נשאר בקוד; אם מחזירים UI - חייבים לשמור אותו כפי שהוא.

## ה. קריאות רשת
| # | שיטה + URL | מפתחות | טריגר | שימוש בתשובה | מטמון |
|---|---|---|---|---|---|
| 1 | GET `/api/settings` | - | mount (150-159) | `rentals_sort_recent_first`=='true' -> `sort='eventDate', order='desc'`; `hide_custom_spacing`=='true' -> `hideCustomSpacing`; `late_return_threshold_days` -> `lateReturnThresholdDays` (Number, נפילה ל-7). שגיאה נבלעת | fetch רגיל (בלי apiCache) |
| 2 | GET `/api/orders?{params}&_t={timestamp}` (`cache:'no-store'`) | מ-`buildRentalsListParams`: `search, sort, order, page, limit=50, forRentals=true`; לפי viewMode אחד מ-`activeOnly=true` (rented) / `partiallyRentedOnly=true` / `returnedOnly=true` / `partiallyReturnedOnly=true` ('all' - ללא); ועוד כל advFilter לא-ריק כמפתח משלו: `customerName, customerPhone, customerCity, advOrderId, itemDetails, advModelName, eventDateFrom, eventDateTo` | `fetchOrders(1)` ב-useEffect (244-248) על שינוי `[debouncedSearch, viewMode, advFilters, isAiModeActive, sort, order]` כש-`!isAiModeActive`; `fetchOrders(page)` מ-`onUpdate` של RentalReturnModal; `goToPage(p)` | `data.data`->orders, `totalPages`, `total` -> totalCount; שגיאה: console.error בלבד, ה-loading מסתיים | SWR: `rentalsCache = cacheNamespace('rentals')`, מפתח = `queryParams.toString()` לפני הוספת `_t` (סדר הפרמטרים ב-prefetchRoutes הוא מפתח המטמון!). Hit -> מציג מיד ואז מרענן. prefetch: `routePrefetchers['/rentals']` מחמם `buildRentalsListParams()` הדיפולטי (viewMode='all', שונה מדיפולט העמוד 'rented' - כלומר החימום לא פוגע במפתח הטעינה הראשונה); שכנים: `/orders`->`/rentals` |
| 3 | POST `/api/ai/smart-search` | body `{prompt, pageContext:'rentals'}` | `handleAiSearch` | `result.data` מסונן בצד לקוח ע"י `matchesRentalsViewMode(o, viewMode)`; `result.query`->`aiQueryUsed` (מועבר ל-StatisticsModal כ-contextQuery). `!res.ok` -> `alert(result.error\|\|'שגיאה בחיפוש החכם')`; חריגה -> `alert('שגיאת תקשורת')` | ללא. במצב AI: totalPages=1, page=1, isAiModeActive=true (עוצר את ה-fetch האוטומטי) |
| 4 | GET `/api/orders/rented-past-event` (`no-store`) | - | mount של RentedPastEventWidget | `data.orders` (מוצגות 10 ראשונות); כישלון/ריק -> לא מוצג כלום | ללא |
| 5 | GET `/api/me` | - | mount של ExportButtons | `employee.exportMaxRows` | ללא |
| 6 | GET/POST `/api/returns/scan` | GET `?barcode=`; POST `{barcode, orderId?, overridePin?, overrideEmployeeId?}` | רק בקוד המת handleQuickReturn | - | - |
| 7 | POST `/api/auth/verify-pin` | `{pin, employeeId, requiredLevel}` | דרך `verifyPin` (ייצוא מעל המגבלה) | | |
- אחרי כל שינוי מצב בכרטיס ההשכרה: `onUpdate` -> `fetchOrders(page)` (נשאר בעמוד הנוכחי). `onClose` לבד לא מרענן.

## ו. חלוניות / פופאפים / אישורים
1. **חלונית סינון מתקדם** (createPortal, `.modal-backdrop`/`.modal`, maxWidth 640): כותרת "חיפוש מתקדם" + איקון; 2 לשוניות; גוף `.form-grid`; פוטר: "נקה הכל", "סגור והחל סינון". backdrop-click סוגר; `stopPropagation` על התוכן.
2. **RentalReturnModal** (`components/orders/RentalReturnModal.js`): props `orderId`, `onClose={()=>setSelectedOrderId(null)}`, `onUpdate={()=>fetchOrders(page)}`. קריאות בתוכו (כותרת בלבד): `GET /api/orders/{id}`, `GET /api/settings` דרך `fetchSharedJson` (`enable_alterations`, `late_return_threshold_days`), סריקת ברקוד `POST/PUT /api/rentals/scan`, אישור `POST /api/rentals/confirm` (+`DELETE ?orderId=`), ביטול החזרה `POST /api/returns/scan`, ביטול לקיחה `POST /api/rentals/cancel`, `POST /api/rentals/toggle`, `POST /api/returns/report-issue`, `GET /api/audit/order-item/{id}`, חסימת לקוח `PUT /api/customers/{id}`; `window.customConfirm` רבים (שמירה/יציאה/ביטול/איחור/"להדפיס את פרטי ההשכרה?") ו-`verifyPin` (רזרבה/מחסן/החזרה מוקדמת). נפתח גם דרך קישור עומק `?orderId=`. **לחוזה נפרד לחלונית.**
3. **StatisticsModal**: props `isOpen`, `onClose`, `pageContext="rentals"`, `contextQuery={aiQueryUsed}`, `position={typeof showStatistics==='object' ? showStatistics : null}` (ממוקם ליד הלחיצה). צ'אט AI: `POST /api/ai/statistics` `{prompt,history,contextQuery,pageContext}`, סנכרון `POST /api/ai/sessions`; localStorage `ai_statistics_chat_sessions_rentals`.
4. **ExportButtons** - ראו ט'.
5. `alert(...)`: "שגיאה בחיפוש החכם", "שגיאת תקשורת" (והקוד המת: "שגיאה בהחזרת פריט"). `window.customConfirm` בקוד המת: "ההחזרה מאוחרת ב-N ימים ... לפתוח את כרטיס ההזמנה?" (כותרת "החזרה באיחור").
6. אין טוסטים בעמוד עצמו.

## ז. מצבים מיוחדים
- **טעינה:** שורה יחידה `colSpan=6` עם `.loading-inline` + `.spinner` "טוען נתונים..."; סה"כ מציג '...'.
- **ריק:** **אין** מצב ריק מפורש - `orders` ריק מציג גוף טבלה ריק (בעיצוב חדש אפשר להוסיף empty-state בלי לשנות לוגיקה).
- **שגיאת רשת:** נבלעת ל-console; הרשימה נשארת כפי שהייתה.
- **שורה מקושטת:** אם `hasCustomSpacing` (`!hideCustomSpacing && customSpacing != null`): רקע `--warning-tint` + `borderRight 4px --warning` + איקון #i-alert-tri (title "מרווח החזרה מותאם אישית להזמנה זו") ליד מספר הזמנה. אחרת אם `totalItems>0` וסטטוס אחד מארבע (הושכר/הושכר חלקי/הוחזר/הוחזר חלקי): צבעי `getStatusColor(status)` {bg,text} כרקע ו-borderRight. הצבע נגזר תמיד מ-`calculateOrderStatus` (מקור אמת יחיד).
- **הגדרות SystemSetting:** `rentals_sort_recent_first`, `hide_custom_spacing`, `late_return_threshold_days` (נפילה 7), `require_approval_for_early_return` (בשרת דרך returnScanClient), `enable_alterations` (בתוך המודל). `hide-ai-features` על body מסתיר `.ai-feature-element` (checkbox AI במתקדם; לשונית AI ב-ExportButtons).
- **מיון חכם:** ברירת מחדל `sort='eventDateSmart'`; `buildRentalsListParams` מוריד אותו ל-`eventDate desc` כשיש `search` או advFilter כלשהו (prefetchRoutes.js:133-137). האייקון בכותרת "תאריך אירוע" מוצג כ"עולה" תחת eventDateSmart (renderSortIcon 178).
- **נווה יעקב מול ראשי:** אין הבדל בקוד העמוד; RentedPastEventWidget נוסף לבקשת נווה יעקב (דיווח 7dad77c4) אך מוצג בשני האתרים. ההגדרות עשויות להיות שונות פר-ארגון.
- **מצב AI פעיל** (`isAiModeActive`): מעכב את ה-fetch האוטומטי; יציאה: כפתור "חיפוש" ב-toolbar הרגיל / clear. שינוי לשונית במצב AI לא מסנן מחדש תוצאות שכבר נטענו (סינון רק בזמן ה-AI search).
- **הרשאה:** PageGate חוסם ברמת layout.

## ח. URL / storage
- **hash** `#rented` / `#returned`: קריאה ב-init של `viewMode` (81-85), האזנה ל-`hashchange` (92-99), כתיבה ב-`switchTabGroup` דרך `replaceState`. 'rented_partial'/'returned_partial' לא נכתבים ל-hash.
- **query** `?orderId=X`: (191-201) `setSearch(X)`, `setViewMode('all')` (ערך פנימי שלא מוצג בלשוניות; activeTabGroup -> 'rentals'), `setSelectedOrderId(X)` -> נפתח RentalReturnModal.
- localStorage: רק בתוך StatisticsModal (`ai_statistics_chat_sessions_rentals`). אין sessionStorage בעמוד.

## ט. הדפסה / ייצוא / AI
- **ExportButtons** (`iconOnly`, `filename="השכרות"`): data = `orders` הטעונים (העמוד הנוכחי בלבד) ממופים ל-`{...o, status: calculateOrderStatus(o), eventDateFormatted: o.eventDateHebrew || getHebrewDateString(o.eventDate) || 'לא צוין', itemsSummary: "תיאור (ברקוד|ללא ברקוד) | ..." }` (פריטים שאינם isDeleted). עמודות: `orderId` (`getLabel('order_id','קוד הזמנה')`), `customerName` (`getLabel('order_customerName','לקוח')`), `eventDateFormatted` (`getLabel('order_eventDate','תאריך אירוע')`), `status` (`getLabel('order_status','סטטוס')`), `itemsSummary` ("פריטים"). פנימית: חלונית עם לשוניות "רגיל" (כמות שורות `exportLimit` + Excel/PDF; מעל `maxRowsWithoutApproval` נדרש אישור מנהל דרך `POST /api/auth/verify-pin` + שדה "סיסמת מנהל") ו-AI (`POST /api/ai/report`, placeholder "הכנס את בקשתך לדוח..."; `excel_ai`/`pdf_ai`). `downloadRowsAsXlsx` מ-`lib/xlsxExport`; PDF דרך חלון קופץ + הדפסה. title הכפתור "מערכת הורדה ל-XL ודוחות".
- **AI:** חיפוש חכם, AI על שדות מתקדם, StatisticsModal, ייצוא AI.
- אין הדפסה ישירה מהעמוד (הדפסת פרטי השכרה בתוך RentalReturnModal אחרי אישור).

## י. מלל (למפרט ולכתיבה מחדש)
כותרות: "השכרות"/"החזרות"; "סה"כ רשומות: N"; "חיפוש מתקדם"; "שאלות סטטיסטיקה"; "חיפוש חכם (AI)"; "נקה חיפוש"; "נקה"; "חיפוש"; "חפש בחכמה"; "מייצר שאילתה..."; "הזמנה ופריט"; "פרטי לקוח"; "ברקוד/פרטי פריט"; "דגם"; "בחר דגם..."; "טלפון לקוח"; "עיר מגורים"; "חפש עם AI על השדות שמולאו"; "נקה הכל"; "סגור והחל סינון"; "סגירה". עמודות: "מספר הזמנה", "לקוח", "תאריך אירוע", "סטטוס", "פריטים (מתוך סה"כ)", "הערות". שורה: "#N", "לא צוין תאריך", "סה"כ: N", "מושכרים: N", "הוחזרו: N", "פירוט", "הצג רשימה", "הסתר רשימה", "פתח השכרה/החזרה", "אין פריטים פעילים"; פריט: "הוחזר"/"מושכר"/"טרם נלקח". "טוען נתונים...". עימוד: "הקודם", "עמוד", "מתוך N", "הבא", "עמוד קודם/הבא". סטטוסים (lib/orderStatus): הושכר, הושכר חלקי, הוחזר, הוחזר חלקי, מחוק, טיוטה, עבר, בקרוב (STATUS_DOT_COLORS 57-66 לא בשימוש בפועל; הצבע מ-`getStatusColor(...).text`). ווידג'ט: "מושכר שצריך לחזור - האירוע כבר עבר (N)", "האירוע היה אתמול", "האירוע לפני N ימים", "הזמנה #N", "... ועוד N הזמנות" (קישור `/orders/{orderId}`). תבנית AI (buildRentalsAiPrompt): "השכרות מספר הזמנה X, של לקוח בשם..., עם טלפון..., בעיר..., בדגם..., עם פריט/ברקוד...".

## יא. Risk notes
1. `fetchOrders` תלוי ב-closure של state; ה-useEffect מחזיק deps ידנית; `onUpdate={()=>fetchOrders(page)}` תלוי ב-`page`. אל תפצל לקומפוננטה בלי להעביר אותם.
2. **מפתח מטמון = סדר הפרמטרים** ב-`buildRentalsListParams`. שינוי סדר/שם שובר SWR/prefetch.
3. החלת viewMode על AI בצד הלקוח (`matchesRentalsViewMode`) משכפלת לוגיקת שרת; סטטוס דרך `calculateOrderStatus`.
4. `viewMode` נכתב בשלוש דרכים (hash init, hashchange, switchTabGroup) + `'all'` מקישור עומק; pill-ים משנים רק state. לשוניות חדשות חייבות לשמור על `switchTabGroup` ולא ליצור navigation אמיתי.
5. `window.history.replaceState` ללא רשומת היסטוריה - לא להחליף ב-`router.push`.
6. תת-סינון "חלקי" אינו לשונית ראשית: `activeTabGroup` נגזר מ-`viewMode`; ה-h1 והווידג'ט תלויים בו.
7. כל `tr` לחיץ; "פירוט" ו-box משתמשים ב-`stopPropagation`. במעבר לכרטיסים חובה לשמור הפרדה זו.
8. `OrderModelSelector` מקבל `value={{name}}` ומחזיר אובייקט/`null`; ממופה לשם בלבד.
9. חלונית המתקדם בפורטל `zIndex:1000`; "סגור והחל" לא קוראת ל-fetch (חי) למעט AI mode. `advAiMode`/`advTab` שורדים בין פתיחות.
10. צבע השורה inline עם `borderRight` פיזי - במעבר ל-logical properties לוודא שהפס נשאר בימין (R17).
11. קוד מת של החזרה מהירה - לא למחוק בלי החלטה (R7/R8), ולא לחבר ל-UI בלי לשמור את בדיקת האיחור.
12. ExportButtons מקבל רק את העמוד הנוכחי (אין `onFetchData`); `hideAi` נקרא מ-`document.body.classList` פעם אחת ב-mount.
