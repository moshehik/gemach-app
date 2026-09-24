# חוזה: רשימת הזמנות — `/orders`

> מקור: `app/orders/page.js` (1038 שורות, קומפוננטת `OrdersPage`) + `app/orders/layout.js`.
> קומפוננטות שהעמוד מרנדר (נקראו במלואן): `components/CapacitySearchModal.js` (+`CapacityCalendar.js`), `components/ExportButtons.js`, `app/components/StatisticsModal.js`, `components/HebrewDateRangePicker.js`, `components/orders/RentalReturnModal.js` (+`OrderPrintMenu.js`, `returnScanClient.js`, `modern/mocAuth.js`), `components/orders/OrderModelSelector.js`, `app/components/PrintWizardModal.js` (+`HebrewDatePicker`), `app/components/LabelsContext.js`.
> עזרים: `lib/orderStatus.js`, `lib/apiCache.js`, `app/lib/prefetchRoutes.js`, `app/lib/orderDrafts.js`.
> כל הפניות שורה הן ל-`app/orders/page.js` אלא אם צוין אחרת.

---

## (a) מטרה והרשאות

- מטרה: רשימת כל ההזמנות בטבלה עם טאבי סטטוס, חיפוש טקסט, סינון מתקדם, חיפוש AI, חיפוש תפוסה, אשף הדפסה, ייצוא, שאלות סטטיסטיקה, מעבר להשכרה/החזרה ומחיקה מהירה.
- שער גישה: `app/orders/layout.js:9` — `<PageGate pageKey="page:orders">` (שרת, `canOpenPage`). אין גישה = `NoAccessMessage`. ברירת מחדל (לפי `lib/permissionsMetadata.js:175-182`): הנהלה ראשית/מתכנת בלבד; אחרת לפי שורת הרשאה. `/orders/new` דורש בנוסף `page:orders_new` (layout נפרד).
- הרשאות/מפתחות שנוגעים בעמוד (בתוך הרכיבים):
  - `feature:export_max_rows` (ערך `employee.exportMaxRows` מ-`GET /api/me`, ברירת מחדל 200) + `feature:export_over_limit_approval` (verify-pin) — ב-ExportButtons.
  - `feature:reserve_rental_approval`, `feature:warehouse_rental_approval`, `feature:barcode_mismatch_override`, `feature:early_return_approval` — ב-RentalReturnModal (אישור מנהל בעקיפות).
  - מחיקת הזמנה: `DELETE /api/orders/[id]` — אכיפה בשרת (`checkAuth`); בצד לקוח רק הבדלי סטטוס/הגדרות (ר' d).
- קומפוננטת שורש: Client Component (`'use client'`, שורה 1). אין props.

## (b) אזורים בסדר תצוגה

1. `.page-head` (494-536): כותרת `h1` "ניהול הזמנות" + `.page-desc` "סה"כ רשומות: {totalCount}" | `.page-actions`: 3 כפתורי איקון (חיפוש מתקדם / חיפוש תפוסה / הדפסת דוחות), `<ExportButtons iconOnly>`, קישור `<Link href="/orders/new">` "הזמנה חדשה" (primary).
2. `.toolbar > form.search-toolbar` (539-560): איקון חיפוש, input טקסט, פעולות: כפתור ניקוי (רק אם `searchInput`), כפתור "שאלות סטטיסטיקה" (איקון activity), כפתור submit "חיפוש".
3. `.pill-tabs` טאבי סטטוס (563-598) (margin-bottom 20px): בקרוב · ארכיון/עבר · מחוק · לא שולם · [טיוטות — רק אם `!draftsAsDeleted`] · [לא-נלקחו — רק אם `showNotTakenOrders`] · הכל.
4. מודאל "סינון מתקדם" (600-763) — פורטל, רק כש-`showAdvSearch`.
5. `.table-wrap > .table-scroll` (765-897): מצב טעינה (`.page-loading` + spinner + "טוען נתונים...") או `table.data` בן 9 עמודות.
6. `.table-foot` (900-929): "סה"כ שורות מוצגות: {orders.length}" + עימוד (רק כש-`totalPages > 1`).
7. מודאלים/פורטלים (932-1035): `CapacitySearchModal`, `PrintWizardModal`, `RentalReturnModal`, `StatisticsModal`, Popover ריחוף פרטי הזמנה.

**עמודות הטבלה** (776-784, לפי סדר): קוד הזמנה (ממיין `orderId`) · לקוח (`customerName`) · דגם (לא ממיין) · כמות פריטים (לא ממיין) · תאריך אירוע (`eventDate`) · סכום לחיוב (`totalAmount`, צבע text-3 + weight 500 בכותרת) · שולם (`totalPaid`) · סטטוס (`status`) · עמודת פעולות (ריקה בכותרת).

## (c) שדות וקלטים

| # | תווית / מיקום | state var | סוג / פורמט | ולידציה / חובה | שורות |
|---|---|---|---|---|---|
| 1 | placeholder "חיפוש הזמנה (מספר הזמנה, שם לקוח, דגם)..." (שורת חיפוש) | `searchInput` (טיוטה) → `search` (מוחל) | text | לא חובה; מוחל רק ב-submit/Enter (`handleSearch`); לא נשלח בכל הקשה | 154-155, 333-338, 542-547 |
| 2 | "טווח תאריכי אירוע" (מודאל, לשונית basic) | `advFilters.eventDateFrom` / `eventDateTo` (מחרוזות `YYYY-MM-DD`) | `HebrewDateRangePicker` (ר' f) | `onChange(start,end)` שניהם נכתבים יחד; ברירת מחדל `from = לפני 3 חודשים` (`getThreeMonthsAgoDateString`), `to=''` | 627-634; prefetchRoutes.js:24-32 |
| 3 | "סטטוס פריטים" — 3 pill-tabs רב-בחירה: ממתינים (`pendingOnly`, i-clock), מושכרים (`activeOnly`, i-bag), מוחזרים (`returnedOnly`, i-check) | `advFilters.rentalStatus` (מערך) | toggle כל pill | — ; כפתור "בחר הכל"/"בטל בחירת הכל" (מוחלף לפי `length===3`) | 636-681 |
| 4 | "{getLabel('order_id','מספר הזמנה')}" placeholder "חפש לפי מספר..." | `advFilters.advOrderId` | text עם איקון | לא חובה | 687-693 |
| 5 | "ברקוד/פרטי פריט" placeholder "ברקוד או תיאור..." | `advFilters.itemDetails` | text | — | 694-700 |
| 6 | "דגם" — `OrderModelSelector` placeholder "בחר דגם..." | `advFilters.advModelName` (שם בלבד; `onChange: m ? m.name : ''`) | combobox (ר' f) | — | 701-708 |
| 7 | "מידה" placeholder "לדוגמה: 38..." | `advFilters.advSize` | text | — | 709-715 |
| 8 | "{getLabel('order_customerName','שם לקוח')}" placeholder "שם הלקוח..." | `advFilters.customerName` | text (בלי איקון) | — | 716-719 |
| 9 | "טלפון לקוח" placeholder "מספר טלפון..." | `advFilters.customerPhone` | text | — | 720-726 |
| 10 | "עיר מגורים" placeholder "עיר..." | `advFilters.customerCity` | text | — | 727-733 |
| 11 | checkbox `#orders-adv-ai-mode` "חפש עם AI על השדות שמולאו" | `advAiMode` | checkbox; עטוף ב-`.ai-feature-element` (מוסתר ב-CSS כש-`body.hide-ai-features`, globals.css:1820, לפי SystemSetting `hide_ai_features`) | — | 738-741 |
| 12 | "עמוד" `#ordersListPageNum` בעימוד | `page` | number min 1, max `totalPages`, width 52px | `onChange`: מתקבל רק אם `1<=v<=totalPages` (NaN נזרק); disabled כש-`isAiModeActive` | 909-920 |

- `advTab` ('basic' | 'details') — בורר לשונית מודאל (196); לשונית basic = שדות 2-3; details = שדות 4-10. שדה 11 מוצג בשתיהן.
- ערכי state ללא UI ישיר: `sort` (ברירת 'eventDate'), `order` ('asc'), `filterStatus` ('soon'), `limit` קבוע 50 (`const [limit]`), `holdMinutes` (15), `nowTick`, `unsavedDrafts`, `orders`, `totalPages`, `totalCount`, `loading`, `selectedOrder` (לעולם לא נקבע — `setSelectedOrder` לא נקרא; הענף הראשון של `rowStyle` קוד מת בפועל), `hoveredOrder`, `popoverPos`, `aiQueryUsed`, `isAiModeActive`, `showStatistics` (false | `{x,y}`).
- בניית פרומפט AI (`buildOrdersAiPrompt`, 72-89): חלקי משפט בסדר: `מספר הזמנה`, `של לקוח בשם`, `עם טלפון`, `בעיר`, `בדגם`, `במידה`, `עם פריט/ברקוד`, טווח אירוע (מ-…עד / מתאריך / עד), `בסטטוס ממתינים|מושכרים|מוחזרים (או)`; מחזיר `''` אם אין חלקים → אז "החל סינון" רק סוגר (אין קריאת AI).

## (d) כפתורים ופעולות

| כפתור (title / תווית) | handler | פעולה / קריאה | שורות |
|---|---|---|---|
| "חיפוש מתקדם" (איקון i-list) | `setShowAdvSearch(true)` | פותח מודאל סינון | 500 |
| "חיפוש תפוסה" (i-calendar) | `setShowCapacitySearch(true)` | פותח `CapacitySearchModal` | 503 |
| "הדפסת דוחות" (i-printer) | `setShowPrintWizard(true)` | פותח `PrintWizardModal` | 506 |
| ייצוא (`ExportButtons iconOnly`, title "מערכת הורדה ל-XL ודוחות") | פנימי | ר' f | 509-530 |
| "הזמנה חדשה" | `<Link href="/orders/new">` | ניווט | 531 |
| "ניקוי חיפוש" (i-x, רק כש-`searchInput`) | `handleClearSearch` | מאפס `searchInput`,`search`,`page=1`; אם `isAiModeActive` — מכבה AI וקורא `fetchOrders()` | 363-371, 549-553 |
| "שאלות סטטיסטיקה" (i-activity) | `setShowStatistics({x:e.clientX,y:e.clientY})` | פותח StatisticsModal ממוקם ליד הלחיצה | 554 |
| "חיפוש" (submit) | `handleSearch` | `search=searchInput`, `page=1`, `isAiModeActive=false` | 333-338, 557 |
| טאב "בקרוב" (title "בקרוב (החל מהיום ואילך)") | `setFilterStatus('soon'); setPage(1)` | | 564 |
| טאב "ארכיון/עבר" (title "ארכיון / עבר") | `'archive'` | | 568 |
| טאב "מחוק" | `'deleted'` | | 572 |
| טאב "לא שולם" (title "לא שולם (חודשים אחרונים)") | `'unpaid'` | | 576 |
| טאב "טיוטות" | `'drafts'` | רק אם `!draftsAsDeleted` | 581-586 |
| טאב "לא-נלקחו" (title "הזמנות שלא נלקחו או נלקחו חלקית") | `'not_taken'` | רק אם `showNotTakenOrders` | 588-593 |
| טאב "הכל" | `handleShowAll` | **מנקה הכל**: `searchInput`,`search`, `advFilters=defaultOrdersAdvFilters()`, `isAiModeActive=false`, `filterStatus='all'`, `page=1` (לא רק מחליף טאב — תיקון באג 3) | 378-385, 594 |
| כותרת עמודה ממיינת (`orderId`,`customerName`,`eventDate`,`totalAmount`,`totalPaid`,`status`) | `handleSort(col)` | אותה עמודה → הפיכת `order` asc/desc; עמודה חדשה → `sort=col`, `order='asc'`. איקון: `#i-sort` אם לא פעיל, אחרת `#i-chevron-down` (מסובב 180° ב-desc, צבע `--primary-solid`) | 387-405 |
| שורה (לחיצה) | `router.push('/orders/'+orderId)` | ניווט לכרטיס | 815 |
| איקון ⓘ בשורה (title "פרטי הזמנה") | `onMouseEnter` מחשב `popoverPos={top:rect.top-12,left:rect.left+rect.width/2}` + `setHoveredOrder(order)`; `onMouseLeave` מנקה; `onClick` = `stopPropagation` בלבד | popover ריחוף (ר' f) | 829-841 |
| "כרטיס הזמנה" (i-edit, Link) | `href=/orders/{orderId}`, `stopPropagation` | ניווט | 860-867 |
| "מעבר להשכרה/החזרה" (i-truck, ירוק) | `setRentalModalOrderId(order.orderId)` + stopPropagation | פותח RentalReturnModal | 868-879 |
| "מחיקת הזמנה" (i-trash, אדום) | `handleDeleteOrder(order,e)` | ר' זרימה מטה | 880-888, 407-448 |
| "הקודם" (i-chevron-end) | `setPage(p=>p-1)` | disabled אם `page<=1 \|\| isAiModeActive`; title "עמוד קודם" | 904-907 |
| "הבא" (i-chevron-start) | `setPage(p=>p+1)` | disabled אם `page>=totalPages \|\| isAiModeActive`; title "עמוד הבא" | 923-926 |
| מודאל מתקדם: "בחר הכל"/"בטל בחירת הכל" | ר' c.3 | | 639-651 |
| מודאל מתקדם: pill ממתינים/מושכרים/מוחזרים | toggle בערך `rentalStatus` | | 661-677 |
| מודאל מתקדם: לשוניות "תאריך וסטטוס" / "פרטי הזמנה ולקוח" | `setAdvTab('basic'\|'details')` | | 616-621 |
| מודאל מתקדם: "נקה הכל" | `setAdvFilters({...כל השדות ''..., eventDateFrom:'', eventDateTo:'', rentalStatus:[]})` | **שים לב**: מרוקן גם את `eventDateFrom` (לא חוזר לברירת "לפני 3 חודשים"; שונה מ-`defaultOrdersAdvFilters`) | 744-746 |
| מודאל מתקדם: "החל סינון" (i-check) | אם `advAiMode`: `prompt=buildOrdersAiPrompt(advFilters)`, סוגר, ואם `prompt` — `handleAiSearch(prompt)`; אחרת רק `setShowAdvSearch(false)` | הסינון עצמו כבר חי ב-`advFilters` (משנה את מפתח ה-URL אוטומטית ← fetch) | 747-758 |
| מודאל מתקדם: "סגירה" (i-x) / לחיצה על backdrop | `setShowAdvSearch(false)` | | 601, 608 |

**זרימת `handleDeleteOrder`** (407-448):
1. `status = calculateOrderStatus(order,{draftsAsDeleted})`; אם `הוחזר|הוחזר חלקי|הושכר|הושכר חלקי` → `alert('לא ניתן למחוק הזמנה לאחר השכרה חלקית/מלאה או לאחר שנלקח והוחזר')` וחזרה.
2. אם `!allowEditPartially` וקיים פריט `!isDeleted && isTaken` → `alert('...חסום בהגדרות (allow_edit_partially_rented).')`.
3. `await window.customConfirm('האם אתה בטוח שברצונך למחוק הזמנה זו?')`.
4. אם `requireIdForEdit && order.customer?.zeout`: `window.customPrompt(msg,'','text')` (נפילה ל-`window.prompt`), טרימינג; ריק → `alert('ביטול בוטל - לא הוזנה תעודת זהות.')` וחזרה.
5. `DELETE /api/orders/{orderId}`; עם ת"ז: headers `x-zeout` + `Content-Type: application/json`, body `{zeout}`. ok → `fetchOrders()`; אחרת `alert(data.error || 'שגיאה במחיקת הזמנה')`; חריגה → `alert('שגיאה במחיקת הזמנה')`.

**זרימת `handleAiSearch(query)`** (340-361): `POST /api/ai/smart-search` body `{prompt: query, pageContext: 'orders'}`. ok → `setOrders(result.data||[])`, `totalCount=length`, `totalPages=1`, `isAiModeActive=true`, `aiQueryUsed=result.query||''`. שגיאת שרת → `alert(result.error||'שגיאה בחיפוש החכם')`; חריגה → `alert('שגיאת תקשורת')`. במצב AI: מנוי המטמון מושבת, עימוד disabled, ניקוי חיפוש/חיפוש טקסט/"הכל" מחזירים למצב רגיל.

## (e) קריאות רשת

| # | Method + URL | פרמטרים / גוף | מתי | שימוש בתשובה | מטמון |
|---|---|---|---|---|---|
| 1 | `GET /api/settings` | — | mount (220-244) | מחפש לפי `key`: `inventory_hold_minutes`→`holdMinutes` (parseInt>0), `draft_orders_show_as_deleted`→`draftsAsDeleted`, `hide_custom_spacing`→`hideCustomSpacing`, `show_not_taken_orders`→`showNotTakenOrders`, `require_id_for_edit_cancel`→`requireIdForEdit`, `allow_edit_partially_rented`→`allowEditPartially`, `enable_batch_print_prep`→`enableBatchPrintPrep` (כולם `value==='true'`). שגיאה נבלעת. | `fetchSharedJson(..., {ttl: TTL.STATIC})` (5 דק'); מחומם גם מ-prefetch ב-`prefetchRoutes.js:227` |
| 2 | `GET /api/orders?{qs}` | `qs = buildOrdersListParams({page,limit:50,search,sort,order,filterStatus,advFilters})` **בסדר**: `page,limit,search,sort,order,filterStatus` ואז כל `advFilters` עם ערך truthy מלבד `rentalStatus` (בסדר מפתחות האובייקט: customerName, customerPhone, customerCity, advOrderId, itemDetails, advModelName, advSize, eventDateFrom, eventDateTo), ואז `activeOnly=true` / `returnedOnly=true` / `pendingOnly=true` לפי `rentalStatus` **בסדר זה** | mount + כל שינוי של `page/search/sort/order/filterStatus/advFilters/holdMinutes` (`fetchOrders` תלוי ב-`buildOrdersUrl`) (271-316) | `data.data`→`orders` (אחרי `sortPendingFirst`), `totalPages`, `total`→`totalCount` | `readCache(url)` SWR: אם יש — מציג מיד בלי spinner; `fetchSharedJson(url,{ttl:TTL.LIST})` (15 שנ'). **מפתח המטמון = ה-URL המדויק; סדר פרמטרים הוא חלק מהמפתח** ואסור לשנותו (prefetchRoutes.js:1-9, 225-226 מחמם את `/orders`). אירועי חלון `app-data-fetching-start/end` נשלחים כש-`!isPrefetch && !cached`. |
| 3 | `GET /api/orders?{qs עמוד+1}` (prefetch) | כמו 2 עם `page+1` | 1.5 שנ' אחרי טעינה אם `page<totalPages` (`setTimeout`, 310-316) | רק מחמם מטמון (לא מעדכן state) | כנ"ל |
| 4 | (מנוי) `subscribe(url, …)` | — | effect 320-331; מושבת כש-`isAiModeActive` | כשהמטמון מתעדכן (mutation כלשהו באפליקציה → interceptor ב-apiCache מבטל) — קורא `readCache` ומעדכן orders/totalPages/totalCount | apiCache |
| 5 | `POST /api/ai/smart-search` | `{prompt, pageContext:'orders'}` | `handleAiSearch` | ר' d | ללא |
| 6 | `DELETE /api/orders/{orderId}` | ר' d (`x-zeout`, `{zeout}` אופציונלי) | מחיקה | `res.ok`→`fetchOrders()` (הרענון בפועל בא גם מה-interceptor) | invalidate אוטומטי |
| 7 | `GET /api/orders?page=1&limit={exportLimit}&search&sort&order&filterStatus&…advFilters…` `{cache:'no-store'}` | **בניה ידנית** (450-481) — אותו סדר כמו 2 אך `limit=exportLimit`; ללא שימוש ב-`buildOrdersListParams` | מתוך `ExportButtons.onFetchData(exportLimit)` וגם מ-`getCurrentFilteredOrderIds` (limit 2000) | ממפה כל הזמנה ל: `status=calculateOrderStatus`, `paymentStatus=calculatePaymentStatus`, `orderDateFormatted=toLocaleDateString('he-IL')`, `orderTimeFormatted=toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})`; שגיאה → `[]` | ללא (no-store) |

קריאות של רכיבי-הבן (ראה f): `GET /api/me` (ExportButtons), `POST /api/auth/verify-pin`, `POST /api/ai/report`, `GET /api/inventory/models?q=…[&hasActiveItems=true]` (OrderModelSelector, `TTL.REFERENCE`), `GET /api/inventory/models?hasActiveItems=true`, `GET /api/inventory/sizes?barcodePrefix=`, `GET /api/inventory/capacity?barcodePrefix&size&fromDate&toDate` (Capacity), `POST /api/ai/statistics`, `POST /api/ai/sessions`, `GET /api/orders/print-prep?…`, `GET /api/orders/{id}`, `POST/PUT /api/rentals/scan`, `POST/DELETE /api/rentals/confirm`, `PUT /api/rentals/cancel`, `POST /api/rentals/toggle`, `POST /api/returns/scan`, `PUT /api/returns/scan`, `POST /api/returns/report-issue`, `GET /api/audit/order-item/{id}`, `PATCH /api/customers/{id}`, `PUT /api/orders/{id}`, `POST /api/orders/{id}/email`, `PUT /api/customers/{id}`, `GET /api/settings/labels` (LabelsProvider), `/api/pdf` (דרך `downloadPdf` ב-`app/lib/pdfClient`).

### לוגיקת מיון מקומית
`sortPendingFirst(list, holdMinutes)` (128-140): מציב בראש הרשימה הזמנות "ממתינות" — `!legacyId && !isPaid && items.some(cartStatus==='pending' && cartStatusDate+holdMinutes*60000 > now)`; `isPaid = (totalPaid>=totalAmount && totalAmount>0) || totalPaid>0 || status==='שולם'|'שולם חלקי'`. שאר הסדר נשמר מהשרת (sort יציב). לא להוציא מהמסלול — הוא חל על שלושת מקורות הנתונים (fetch, מטמון, מנוי).

## (f) מודאלים / פופאפים / הודעות

**1. מודאל "סינון מתקדם"** (inline בעמוד, פורטל ל-`document.body`, 600-763) — backdrop `.modal-backdrop` z-index 1000 (לחיצה מסגירה), `.modal` maxWidth 760px. כותרת: איקון i-list + "סינון מתקדם" + X. לשוניות (`.tabs`/`.tab`, סגנון inline overrides): "תאריך וסטטוס" / "פרטי הזמנה ולקוח". גוף: ר' c. תחתית: "נקה הכל", "החל סינון". ללא סגירה ב-Esc (אין handler).

**2. `HebrewDateRangePicker`** (`components/HebrewDateRangePicker.js`) — טריגר `.date-range-trigger` (קטעים "מתאריך:" / "עד תאריך:" + חץ + איקון לוח; מציג תאריך עברי דרך `getHebrewDateString`, placeholder "מתאריך..."/"עד תאריך..."). לחיצה פותחת מודאל פורטל z-index 100000 `.range-cal-modal`: כותרת "בחירת טווח תאריכים" + סיכום ("בחרו תאריך התחלה בלוח" / "{התחלה} ← בחרו תאריך סיום..." / "{התחלה} ← {סיום} ({N} ימים)"); "בחירה מהירה": שבוע(7)/שבועיים(14)/חודש(30)/3 חודשים(90) (מהיום); ניווט: חודש קודם, select חודש עברי, select שנה (±30, גימטריה), "חזרה להיום", חודש הבא; שני לוחות חודשיים עוקבים (ימי שבוע א'-ש', פרשת שבוע בשבת ב-title/טקסט, hover preview, `selected/in-range/today`). תחתית: "נקה בחירה" (disabled בלי בחירה), "ביטול", "אישור בחירה" (disabled בלי התחלה+סיום; קורא `onChange(tempStart,tempEnd)`). לוגיקה קריטית: הקליק הראשון בכל פתיחה מתחיל בחירה חדשה (באג 6 — `selectionStarted`), בחירת תאריך מוקדם מההתחלה מהפכת; Esc סוגר; נרמול `T` מהערכים. **`onChange` כותב רק ב"אישור"** — ה-state של העמוד לא משתנה בזמן בחירה.

**3. `OrderModelSelector`** (`components/orders/OrderModelSelector.js`) — input + איקון חיפוש/spinner + כפתור "נקה בחירה" (כש-`value.name`); dropdown פורטל `.combobox-results` fixed ממוקם לפי `getBoundingClientRect` של העטיפה (top/left/width, `right:auto`, z 999999, maxHeight 250) — נסגר בלחיצה מחוץ. `GET /api/inventory/models?q={effectiveQuery}` דחוי 300ms (`TTL.REFERENCE`); כשהשדה מציג את השם שנבחר ופתוח — שאילתה ריקה (רשימה מלאה). Enter ללא בחירה → `resolveTypedValue`: התאמה מדויקת לפי שם/קוד ברקוד (לא רגיש לרישיות) או `alert('לא נמצא דגם עם השם/קוד "…". יש לבחור דגם מהרשימה הנפתחת.')`. דגם ששמו מתחיל "ללא שם" מוצג לפי `barcodePrefix`. `name=no-autofill-{random}` נגד autofill. פריט: איקון tag + שם + "קוד: {barcodePrefix}". `onChange(model|null)`.

**4. `CapacitySearchModal`** (`isOpen`,`onClose`) — לא מרנדר כש-`!isOpen`. כותרת "חיפוש תפוסה" + כפתור "חיפושים קודמים"/"הסתר חיפושים קודמים" + X. Esc **חסום** (`stopPropagation`+`preventDefault` בקפצ'ר) — לא נסגר ב-Esc. היסטוריה: `localStorage['capacity_search_history']` (50 אחרונים; כל רשומה `{id,timestamp,employeeCode,customerName,barcodePrefix,size,fromDate,toDate}`); שורה מציגה דגם/מידה/תאריכים עבריים/עובד/זמן + "בחר" (ממלא ומריץ `performSearch`); ריק: "לא נמצאו חיפושים". טופס: combobox דגם (`GET /api/inventory/models?hasActiveItems=true` פעם אחת; סינון מקומי לפי name/barcodePrefix; פריט: שם + prefix; נקה "נקה בחירה"), select מידה (`GET /api/inventory/sizes?barcodePrefix=`, `required`, disabled בלי דגם או בלי מידות; אפשרויות "בחר דגם תחילה"/"אין מידות לדגם"/"בחר מידה..."), `HebrewDateRangePicker` (`fromDate`,`toDate`), callout שגיאה. כפתורים: "נקה הכל", "חפש"/"מחפש...". ולידציה: דגם+מידה חובה, אחרת `error='יש להזין דגם ומידה'`; ברירות: `fromDate=היום (ISO)`, `toDate=+6 חודשים`. `GET /api/inventory/capacity?barcodePrefix&size&fromDate&toDate`. תוצאות: 3 KPI (במלאי `inStock`, בתפוסה `occupiedCount`, רזרבה `reserve`); מתג "תצוגת רשימה"/"תצוגת לוח"; רשימה: טבלה (תאריך אירוע לועזי + עברי, שם לקוח, כמות `badge-danger`, "פתח" — `<a href=/orders/{orderId} target=_blank>`) או empty-state "אין הזמנות תפוסות בטווח התאריכים הנבחר / הפריט פנוי לחלוטין בתאריכים אלו."; לוח: `CapacityCalendar` (ימי שבוע, חגים, "{N} תפוס", תא עם הזמנה אחת לחיץ, tooltip עם רשימת לקוחות). מקושר: `localStorage`.

**5. `PrintWizardModal`** (props: `onClose`, `defaultReportType` (`'order_prep_by_date'` רק כש-`enableBatchPrintPrep`), `enableBatchPrintPrep`, `getCurrentOrderIds`) — כותרת "אשף הדפסה". "סוג הדוח" (radio): alterations_pending "רשימת תיקונים (טרם בוצעו)" [ברירת מחדל], alterations_all "רשימת כל התיקונים (כולל בוצעו)", orders_no_alterations "רשימת הזמנות ללא תיקונים", orders_all "דוח הזמנות כללי (כל ההזמנות)", labels "הדפסת תוויות לתופרות (לתיקונים שטרם בוצעו)", **order_prep_by_date** "פירוט הזמנות להכנה (עמוד נפרד לכל הזמנה, לפי תאריך)" — **מוצג רק כש-`enable_batch_print_prep=true`** (גמח נווה יעקב; אחרת מסונן מהרשימה). תאריכים לסוגים רגילים: radio `current` "הנתונים המוצגים כעת" / `today` "אירועים להיום בלבד" / `custom` "טווח מותאם אישית" (שני `HebrewDatePicker` מתאריך/עד תאריך — opacity .5 + pointer-events none כשלא custom). לסוג prep: `prep_today` "הכנות להיום" (הסבר: 3 ימי עסקים לפני האירוע, מדלג שישי/שבת/חג) / `single` "תאריך אחר" / `custom` "טווח תאריכים"; תווית "תאריך ההכנה"/"תאריך האירוע". איפוס `dateMode` בעת מעבר בין קבוצות סוגים. כפתורים: "ביטול", איקון "הורד כ-PDF" (מוסתר ב-prep; `disabled={isPreparing}`), איקון "הכן להדפסה". התנהגות:
  - לא-prep: query `?reportType=…&dateMode=…`; `custom` דורש שני תאריכים (`alert('יש להזין תאריך התחלה וסיום.')`) ומוסיף `&startDate&endDate`; `current` עם `getCurrentOrderIds` → **`getCurrentFilteredOrderIds()` (limit 2000 לפי הסינון הנוכחי)**; ריק → `alert('לא נמצאו רשומות התואמות לסינון הנוכחי.')`; מוסיף `&orderIds=1,2,…`. PDF: `&downloadPdf=true` → `downloadGeneratedPdf({path:'/print/alterations'+query}, '{שם דוח}.pdf')` (שרת Puppeteer `/api/pdf`). הדפסה: `window.open('/print/alterations'+query,'_blank')` ואז `onClose()`.
  - prep: `single` → `date=&mode=event` (`alert('יש לבחור תאריך.')`); `custom` → `from=&to=&mode=event`; `prep_today` → `date={today en-CA}`; `GET /api/orders/print-prep?{query}` (`no-store`); ריק → `alert('לא נמצאו הזמנות התואמות לתאריך/טווח שנבחר.')`; הצלחה → `window.open('/print/order?orderId={ids}&type=order&batch=1','_blank')`, `onClose()`.

**6. `ExportButtons`** (`iconOnly`, `data`, `filename="הזמנות"`, `columns`, `onFetchData=fetchOrdersForExport`) — כפתור title "מערכת הורדה ל-XL ודוחות" (i-download; בלי טקסט ב-iconOnly). מודאל (פורטל z 1000, ללא סגירה בלחיצה על backdrop): "מערכת דוחות וייצוא נתונים". עמודות (`columns`): `orderId` (label `getLabel('order_id','קוד הזמנה')`), `customerName` (`getLabel('order_customerName','לקוח')`), `customerPhone` "טלפון", `customerEmail` "אימייל", `customerCity` "עיר", `orderDateFormatted` "תאריך ביצוע ההזמנה", `orderTimeFormatted` "שעת ביצוע ההזמנה", `totalAmount` (`getLabel('order_totalAmount','סכום לחיוב')`), `totalPaid` "שולם", `paymentStatus` "סטטוס תשלום", `status` (`getLabel('order_status','סטטוס')`). לשוניות "רגיל" / "AI" (מוצגות רק כש-`!hideAi`; `hideAi` נקרא מ-`body.classList.contains('hide-ai-features')` ב-mount). "רגיל": `#export-limit-input` "כמות שורות לייצוא:" (min 1, ברירת 100; NaN→100; שינוי מאפס `isAdminVerified`), תגיות "דורש מנהל" (כש-`exportLimit>maxRowsWithoutApproval`) / "אושר מנהל"; כפתורי "ייצוא לאקסל" (`downloadRowsAsXlsx(rows, filename)` דרך `lib/xlsxExport`) ו-"ייצוא ל-PDF" (חלון print עצמאי, HTML RTL עם "בס"ד" + כותרת + "הופק בתאריך…"; חסימת popup → `alert('אנא אפשר חלונות קופצים (Popups) עבור אתר זה כדי להדפיס.')`). "AI" (`.ai-feature-element`): textarea `placeholder="הכנס את בקשתך לדוח..."`, כפתורי "אקסל (AI)" / "PDF (AI)" → `POST /api/ai/report` `{data, prompt, columns:[labels], format:'excel'|'pdf'}` → `processedData` (HTML או מערך); prompt ריק → `alert('אנא פרט כיצד תרצה שה-AI יארגן את הנתונים.')`. מעל מכסה (`exportMaxRows` מ-`GET /api/me` → `employee.exportMaxRows`, ברירת 200): פאנל "נדרש אישור מנהל" עם input password "סיסמת מנהל" + "אישור"/"ביטול" → `POST /api/auth/verify-pin` `{pin, requiredLevel:'feature:export_over_limit_approval'}`; `data.success` → ממשיך את `pendingAction`. `getExportData`: עם `onFetchData` מחזיר את `fetchOrdersForExport(exportLimit)` (קריאת רשת חדשה — **לא** `data` שהועבר); רשימה ריקה → יציאה שקטה (רק בלי onFetchData: `alert('אין נתונים לייצוא')`). הפרופ `data` (הזמנות עמוד נוכחי + סטטוס מחושב) בפועל לא בשימוש כי `onFetchData` קיים.

**7. `StatisticsModal`** (`isOpen={!!showStatistics}`, `pageContext="orders"`, `contextQuery={aiQueryUsed}`, `position={x,y}|null`) — מודאל צ'אט "סטטיסטיקות מתקדמות AI" בגודל 600×(80vh≤600) ממוקם ליד נקודת הלחיצה (top=min(y, innerHeight-620), left=clamp(x-300, 20, innerWidth-620)). כותרת: איקוני היסטוריה / חדש (`startNewChat`, שומר שיחה נוכחית ל-localStorage) / מחק (`customConfirm('האם אתה בטוח שברצונך למחוק את השיחה הנוכחית?')`) / סגירה. ברכה: "שלום! אני עוזר הסטטיסטיקה של ההזמנות. שאל אותי שאלות על הנתונים (…)". שליחה: `POST /api/ai/statistics` `{prompt, history:[{role,content}], contextQuery, pageContext}`; ואז סנכרון שיחה `POST /api/ai/sessions` `{sessionId, context:'דוח AI - orders', messages}`. תשובה עם `data[]` → `ResultTable` (עד 100 שורות, כפתורי "הורדה לאקסל (XLSX)" ו-"CSV" עם BOM, עמודת פעולה `_actionUrl`/`_actionLabel`). היסטוריה: `localStorage['ai_statistics_chat_sessions_orders']` (עד 10 שיחות). שגיאות: 'מצטער, חלה שגיאה בהפקת הסטטיסטיקה.' / 'שגיאת תקשורת עם השרת.'; טעינה: "מנתח נתונים...". `contextQuery` מקושר לשאילתת ה-AI האחרונה של העמוד.

**8. `RentalReturnModal`** (`orderId`, `onClose`, `onUpdate={fetchOrders}`) — פורטל z 1100 (+פרטי פריט z 1200, כפילויות z 1300). `onDoubleClick` על ה-backdrop = `attemptCloseCard` (לא click יחיד). טוען `GET /api/orders/{id}` (`cache:'default'`) + `addHistory({type:'rental',id,name:'השכרה #N',subtext})`; שגיאה → `alert('שגיאה בטעינת פרטי הזמנה')` + `onClose`. כותרת: "השכרה והחזרה — הזמנה #N" + תג סטטוס כולל (`calculateOrderStatus` + `getStatusColor`), spinner מעבד, קישור "פתח כרטיס הזמנה בטאב חדש" (`/orders/{id}` `_blank`), `OrderPrintMenu` (title "הדפסה ומייל"; `skipRegulationsCheck`; `preConfirm=handlePrintPreConfirm`; תפריט: הזמנה / השכרה / מייל הזמנה / מייל השכרה; פותח `/print/order?orderId&type=order|rental`; מייל: `POST /api/orders/{id}/email`; מודאל תקנון "האם הלקוח חתם על התקנון?" [לא נראה כאן כי skip], מודאל "שליחת מייל…" עם קבצים נוספים + יעד `email|drive|both`, עדכון `PUT /api/customers/{id}`), סגור. גוף: שורת לקוח/טלפון/תאריך אירוע (עברי; חו"ל/חול: `fromDate — toDate`); **תיבת סריקה מהירה** (autofocus, `placeholder="סריקה מהירה — השכרה / החזרה"`, מסיר רווחים; Enter=`handleGlobalBarcodeScan`: אם ברקוד תואם פריט `isTaken && !isReturned` → החזרה (אחרי `checkLateReturnPrompt`), אחרת השכרה); callout "הערות להזמנה:"; callout "{N} פריטים נסרקו וממתינים לאישור השכרה" + "אשר את הפריטים שנסרקו (N)" (`confirmRental`); טבלה: פריט (תיאור + מידה + ברקוד [+הוזן ידנית] + לקיחה/הוחזר תאריכים עבריים; labels `item_size`,`item_barcode`), תיקונים (רק כש-`enable_alterations` לא `'false'`; תג "תיקונים"/"ללא תיקונים"), סטטוס (`badge-*`: הוחזר / הוחזר - לא תקין / מושכר / נסרק - ממתין לאישור / ממתין), פעולות (ר' מטה), פרטים (איקון ⓘ → מודאל פרטי פריט). תחתית: "בטל שינויים וסגור" (`handleHeaderCancel`), "שמור וסגור" (`handleHeaderSave`).
  - פעולות בשורה: "השכרה" → שדה "סרוק ברקוד" + "אשר" + X + "הברקוד לא עובד? הקלדה ידנית" (טופס: 2 שדות ברקוד "הקלד את מספר הברקוד"/"הקלד שוב לאימות", checkbox "אני מאשרת שהשמלה אכן בידי עכשיו", "אשר הקלדה ידנית"/"ביטול"; ולידציות alert: 'יש להקליד את מספר הברקוד פעמיים' / 'הברקודים שהוקלדו אינם תואמים - יש להקליד שוב את שני השדות' / 'יש לאשר בסימון התיבה…'); "חובה להזין ברקוד"; תג "ממתין לאישור השכרה"; מתג `toggle-btn-group` "החזרה תקינה" (`handleMarkReturnGood`, confirm 'לסמן את "X" כהוחזר תקין?') / "לא תקין" (`handleMarkReturnBad`, prompt הערה ← `returned-bad` + הצעת חסימת לקוח `PATCH /api/customers/{id}` `{isBlocked:true, blockedReason}`); "ביטול השכרה" (`PUT /api/rentals/cancel`); "ביטול החזרה" (`PUT /api/returns/scan` `{orderItemId}`); "דווח על בעיה" (`POST /api/returns/report-issue` `{orderItemId,issueType,note}`); "סמן כתקין" (`POST /api/rentals/toggle` `{itemId,action:'setReturnCondition',returnedOk:true}`).
  - קריאות: `POST /api/rentals/scan` `{orderId,barcode,[itemIdToForce],[overridePin,overrideEmployeeId],[manualEntry,manualConfirm,manualSignature]}`; תגובות מיוחדות: `duplicateAlterations`→מודאל "נמצאו מספר פריטים זהים" (בחר איזה — z 1300, כפתור "ביטול"), `unreturned`→confirm + `PUT /api/rentals/scan {unreturnedItemId}` + ניסיון חוזר, `reservedLocation`→`verifyPin` (`feature:reserve_rental_approval` אם `reserveOnly` אחרת `feature:warehouse_rental_approval`), `barcodeMismatch`→`verifyPin('feature:barcode_mismatch_override')`, `barcodeInvalid`→פתיחת הקלדה ידנית. `POST /api/returns/scan` דרך `postReturnScan` (409 `earlyReturn`→`verifyPin('feature:early_return_approval')`). `POST /api/rentals/confirm` `{orderId}` (אישור; מבקש אישור אם יש פריטים בלי ברקוד: `לא נסרקו כל הפריטים (N חסרים). להמשיך בכל זאת?`; אחרי הצלחה confirm "השכרה אושרה בהצלחה! להדפיס את פרטי ההשכרה?" → `window.open('/print/order?orderId=…')`, `onClose(); onUpdate()`), `DELETE /api/rentals/confirm?orderId=` (מחיקת סריקות ממתינות). איחור החזרה (`lib/lateReturn`, סף `late_return_threshold_days`) → confirm "החזרה באיחור".
  - מודאל "פרטי פריט": 4-5 KPI (תאריך אירוע/לקיחה/החזרה, חזר תקין?, מחרוזת תיקונים), "היסטוריית פעולות" מ-`GET /api/audit/order-item/{id}` עם `FIELD_TRANSLATIONS`/`ACTION_TRANSLATIONS` (מ-`components/HistoryViewer`).
  - `onUpdate` נקרא: אחרי `refreshOrder` (עם הנתונים) ואחרי `confirmRental` (בלי ארגומנטים) — בעמוד `onUpdate={fetchOrders}` (הארגומנט מתעלמים; `fetchOrders(isPrefetch)` — ארגומנט truthy יהפוך לקריאת prefetch! ר' Risk).

**9. Popover ריחוף "הזמנה #N"** (964-1035) — פורטל `.card` fixed, `translate(-50%,-100%)`, `pointerEvents:none`, maxWidth 320, z 1000. תוכן: כותרת; לקוח; טלפון (`dir=ltr`, "לא הוזן"); תאריך עברי ("לא צוין"); ציפוף ימים (רק כש-`!hideCustomSpacing && customSpacing != null`; "יום"/"ימים"); הושכר (מניית `!isDeleted && isTaken`); הוחזר (`isReturned`); סה"כ לתשלום; שולם (צבע: ירוק כשמלא, אזהרה כשחלקי, סכנה אחרת); סטטוס פריטים (תג); סטטוס תשלום (תג).

**10. `window.alert/confirm/prompt`**: כל ההתראות בעמוד הן `alert(...)` דפדפן. אישורים: `window.customConfirm` (PopupProvider). ת"ז: `window.customPrompt` (fallback `window.prompt`). אין toast בעמוד.

## (g) מצבים מיוחדים

- **טעינה**: `loading && orders.length===0` → `.page-loading` + `.spinner.lg` + "טוען נתונים...". אם יש מטמון — אין spinner כלל (SWR).
- **ריק**: **אין empty-state מפורש** — `tbody` פשוט ריק (הכותרות מוצגות) והפוטר "סה"כ שורות מוצגות: 0". (RentalReturnModal וCapacity כן מציגים empty-state.)
- **שגיאה בטעינה**: `console.error` בלבד + `app-data-fetching-end`; אין הודעה למשתמש. שגיאת settings נבלעת.
- **אופליין**: אין טיפול בקוד העמוד (מצב אופליין הוא בשרת — Prisma→SQLite).
- **הרשאה**: שער `page:orders` בשרת (ר' a). אין הסתרת אלמנטים לפי הרשאה בתוך העמוד עצמו, מלבד מחיקה/ייצוא/AI (ר' d/f).
- **SystemSetting (מ-`GET /api/settings`)**:
  - `inventory_hold_minutes` (ברירת 15) — משפיע על ספירה לאחור של `PendingTimer`, על `isPending`, על `sortPendingFirst`, ועל מפתח ה-`useCallback` של `fetchOrders`.
  - `draft_orders_show_as_deleted` (ברירת `true`) — כש-true: טאב "טיוטות" מוסתר, סטטוס `טיוטה` מוצג כ"מחוק" (`calculateOrderStatus(order,{draftsAsDeleted})`), ו-effect (248-253) מחזיר `filterStatus==='drafts'` ל-`'soon'` + `page=1`.
  - `show_not_taken_orders` (ברירת `true`) — כש-false: טאב "לא-נלקחו" מוסתר; effect (255-260) מחזיר `'not_taken'` ל-`'soon'`.
  - `hide_custom_spacing` (ברירת `false`) — כש-true: אין צביעת שורה "ציפוף" ואין שורת ציפוף ב-popover.
  - `require_id_for_edit_cancel` (ברירת `false`) — בקשת ת"ז במחיקה אם ללקוח יש `zeout`.
  - `allow_edit_partially_rented` (ברירת `true`) — חסימת מחיקה בצד לקוח.
  - `enable_batch_print_prep` (ברירת `false`) — **ספציפי לנווה יעקב** (פותח דוח "פירוט הזמנות להכנה" ומגדיר `defaultReportType='order_prep_by_date'`); בגמח הראשי לא מופעל.
  - גלובלי (layout): `hide_ai_features` → `body.hide-ai-features` → מסתיר `.ai-feature-element` (checkbox AI במודאל מתקדם, לשונית AI ב-Export) ; `enable_alterations` (RentalReturnModal).
- **תוויות דינמיות** (`useLabels().getLabel(key, default)`; ניתנות לעריכה ב-`/api/settings/labels`): `order_id` (ברירת 'קוד הזמנה' בטבלה/ייצוא, 'מספר הזמנה' בסינון), `order_customerName` ('לקוח' בטבלה, 'שם לקוח' בסינון), `order_totalAmount` ('סכום לחיוב'), `order_status` ('סטטוס'), `item_size`, `item_barcode`.
- **צביעת שורות** (799-812), סדר עדיפויות: (1) `selectedOrder` (קוד מת) → `--surface-alt`; (2) `unsavedDraft` → רקע `--info-tint` + `borderRight: 4px solid var(--info)`; (3) `hasCustomSpacing` (`!hideCustomSpacing && customSpacing != null`) → `--warning-tint` + border warning; (4) `isPending` → `--accent-tint` + border accent; (5) `isUnpaid` (`totalPaid<totalAmount && totalAmount>0`) → מחלקה `row-flag` + `borderRight 4px solid var(--danger)`. צבע טקסט מספר ההזמנה: `--danger` אם unpaid, `--accent` אם pending. עמודת "שולם": ירוק כשמלא ובכיר, אדום מודגש (700) כשחסר, אחרת text-3 קטן (12.5px). `cell-primary` על מספר הזמנה ועל הדגם.
- **תג "לא נשמר"**: `badge-info` + איקון i-edit 10px + tooltip (title) "שינויים שלא נשמרו מ-{תאריך he-IL | 'ביקור קודם'}[:\n{שורות summary}]\nפתח את הכרטיס כדי לשחזר או למחוק אותם".
- **`PendingTimer`** (91-125): מונה לאחור `m:ss` (עדכון כל שנייה) מ-`cartStatusDate + holdMinutes`; `badge-warning`; ב-0: "פג תוקף" `badge-danger`; לא מרנדר כשאין זמן. מוצג כש-`pendingItem` (פריט עם `cartStatus==='pending'`, בהזמנה חדשה `!legacyId` ולא שולמה) — **גם אם פג** (התג "פג תוקף" מוצג), בעוד `isPending` (צביעה) דורש שהתוקף עדיין בתוקף לפי `nowTick`.
- **תגי סטטוס** (`getStatusBadgeClass`): הוחזר→success; הוחזר חלקי→warning; הושכר→info; הושכר חלקי→accent; בקרוב→warning; עבר/מחוק/טיוטה/אחר→neutral. תגי תשלום (`getPaymentBadgeClass`): שולם→success; שולם חלקי→warning; ממתין לזיכוי→info; לא שולם→danger. שני התגים מוצגים זה לצד זה בעמודת "סטטוס" (`flex nowrap`).
- **גבולות אפס**: `order.items` יכול להיות undefined (→ "—"/0); דגם: `getOrderModelNames` (ייחודיים, ללא `isDeleted`, ללא ריקים, מחובר ב-", "); "כמות פריטים" = פריטים שאינם מחוקים.
- **RTL**: `borderRight` פיזי (בכוונה — בצד ימין ב-RTL); `marginRight:'auto'` על ⓘ; popover משתמש ב-`left` פיזי מחושב.

## (h) פרמטרי URL / אחסון

- **פרמטרי URL של העמוד עצמו**: אין (לא קורא `searchParams`). כל ה-state (חיפוש, טאב, מיון, עמוד, סינון) הוא React state בלבד ולא נשמר ב-URL — רענון מחזיר לברירת מחדל: טאב `soon`, מיון `eventDate asc`, `eventDateFrom = לפני 3 חודשים`.
- `localStorage`:
  - `gemachOrderDraft:{orderId}` — נקרא דרך `listOrderDrafts()` (app/lib/orderDrafts.js): מחזיר `{[orderId]:{savedAt,summary}}`; מוחק טיוטות > 30 יום; נטען ב-mount ורענון ב-`window focus` וב-`storage`. (נכתב בכרטיס ההזמנה, לא כאן).
  - `capacity_search_history` (CapacitySearchModal).
  - `ai_statistics_chat_sessions_orders` (StatisticsModal).
- `sessionStorage`: אין.
- אירועי חלון: `app-data-fetching-start` / `app-data-fetching-end` (מחוון טעינה גלובלי), `focus`/`storage` (טיוטות).
- ניווטים יוצאים: `/orders/new`, `/orders/{orderId}` (שורה, איקון כרטיס), `/print/alterations?…`, `/print/order?orderId=…&type=…[&batch=1]`.
- `prefetch`: `/orders` נכלל ב-`prefetchRoutes.js` (מחמם `GET /api/orders?{buildOrdersListParams()}` + `/api/settings`) — ה-URL המחושב חייב להיות זהה תו-בתו ל-URL שהעמוד בונה בטעינה ראשונה (ברירות מחדל: page=1, limit=50, search='', sort=eventDate, order=asc, filterStatus=soon, advFilters ברירת מחדל).

## (i) הדפסה / ייצוא / AI

- **ייצוא**: Excel (`downloadRowsAsXlsx`), PDF (חלון print RTL A4 עצמאי — צבעי print קשיחים בכוונה, לא לגעת ב-CSS vars), Excel/PDF-AI (`/api/ai/report`). מגבלת שורות לפי `exportMaxRows` + אישור מנהל.
- **הדפסה**: אשף הדפסה → `/print/alterations` (רגיל/PDF שרתי) / `/print/order` (prep). הדפסת הזמנה/השכרה/מייל מתוך RentalReturnModal→OrderPrintMenu.
- **AI**: (1) חיפוש חכם `POST /api/ai/smart-search` — נקרא רק מ"החל סינון" עם `advAiMode`; מציג תוצאות ומעביר למצב AI (עימוד/מנוי כבויים); (2) `StatisticsModal` צ'אט סטטיסטיקה עם `contextQuery=aiQueryUsed`; (3) לשונית AI בייצוא. כולם ניתנים להסתרה גלובלית עם `hide_ai_features`. **הערה**: StatisticsModal אינו עטוף ב-`.ai-feature-element` ואינו מוסתר ב-CSS — כפתור "שאלות סטטיסטיקה" ב-toolbar נשאר גלוי גם כש-AI מוסתר (כפי שבקוד הקיים).
- **אין** בעמוד הדפסת CSS ישירה (`@media print`) — המסכים מודפסים מדפי `/print/*`.

## (j) מלל הממשק (לניסוח מחדש — לא להעתקה)

כותרות: ניהול הזמנות; סה"כ רשומות; סינון מתקדם; אשף הדפסה; חיפוש תפוסה; סטטיסטיקות מתקדמות AI; השכרה והחזרה; מערכת דוחות וייצוא נתונים.
טאבים: בקרוב · ארכיון/עבר · מחוק · לא שולם · טיוטות · לא-נלקחו · הכל.
עמודות: קוד הזמנה · לקוח · דגם · כמות פריטים · תאריך אירוע · סכום לחיוב · שולם · סטטוס.
תגים: סטטוסי הזמנה (בקרוב, עבר, מחוק, טיוטה, הושכר, הושכר חלקי, הוחזר, הוחזר חלקי); סטטוסי תשלום (שולם, שולם חלקי, לא שולם, ממתין לזיכוי); "לא נשמר"; "פג תוקף"; ספירה m:ss.
כפתורים/כותרות איקון: חיפוש מתקדם; חיפוש תפוסה; הדפסת דוחות; הזמנה חדשה; חיפוש; ניקוי חיפוש; שאלות סטטיסטיקה; כרטיס הזמנה; מעבר להשכרה/החזרה; מחיקת הזמנה; פרטי הזמנה; הקודם/הבא/עמוד קודם/עמוד הבא; נקה הכל; החל סינון; בחר הכל/בטל בחירת הכל; סגירה.
placeholder: חיפוש הזמנה (מספר הזמנה, שם לקוח, דגם)...; חפש לפי מספר...; ברקוד או תיאור...; בחר דגם...; לדוגמה: 38...; שם הלקוח...; מספר טלפון...; עיר...
תוויות שדות: טווח תאריכי אירוע; סטטוס פריטים (ממתינים/מושכרים/מוחזרים); מספר הזמנה; ברקוד/פרטי פריט; דגם; מידה; שם לקוח; טלפון לקוח; עיר מגורים; חפש עם AI על השדות שמולאו; לשוניות: תאריך וסטטוס / פרטי הזמנה ולקוח.
הודעות/אישורים: "האם אתה בטוח שברצונך למחוק הזמנה זו?"; "לא ניתן למחוק הזמנה לאחר השכרה…"; "…חסום בהגדרות (allow_edit_partially_rented)"; "ביטול הזמנה דורש אימות תעודת זהות…"; "ביטול בוטל - לא הוזנה תעודת זהות."; "שגיאה במחיקת הזמנה"; "שגיאה בחיפוש החכם"; "שגיאת תקשורת"; "טוען נתונים..."; "סה"כ שורות מוצגות"; "עמוד X מתוך Y".
Popover: הזמנה #; לקוח; טלפון (לא הוזן); תאריך עברי (לא צוין); ציפוף ימים (יום/ימים); הושכר; הוחזר; סה"כ לתשלום; שולם; סטטוס פריטים; סטטוס תשלום.
(מחרוזות מודאלי-הבן מפורטות ב-f.)

## (k) הערות סיכון לרסטייל

1. **מפתח מטמון = URL**. `buildOrdersUrl`/`buildOrdersListParams` הם הקשר בין העמוד, ה-prefetch של דפים אחרים ומנוי ה-`subscribe`. אין לשנות סדר פרמטרים, שמות, או `limit=50`. `fetchOrdersForExport` בונה ידנית (כפילות בכוונה, ללא `rentalStatus` כמפתח) — לשמור זהה.
2. **`onUpdate={fetchOrders}`**: `RentalReturnModal.refreshOrder` קורא `onUpdate(data)` עם אובייקט הזמנה כארגומנט ראשון = `isPrefetch` (truthy) → `fetchOrders(true, page)` — מתנהג כ-prefetch שלא מעדכן state (רענון בפועל מגיע מה-interceptor + `subscribe`). `confirmRental` קורא בלי ארגומנטים (רענון מלא). שינוי החתימה או עטיפה ב-arrow שמעבירה ארגומנט ישנה התנהגות.
3. **לחיצת שורה מול פעולות פנימיות**: `tr onClick` = ניווט; כל כפתור/קישור/ⓘ בתוך שורה חייב `stopPropagation` (יש ב-Link כרטיס, כפתור השכרה, ⓘ; `handleDeleteOrder` מקבל `e` וקורא `e.stopPropagation()` בתחילתו). בעיצוב מחדש של השורה כ"כרטיס" יש לשמור על כך.
4. **Popover ⓘ**: מיקום מחושב ב-JS מתוך `getBoundingClientRect` של ה-span (fixed, `left` פיזי, `translate(-50%,-100%)`) ומרונדר בפורטל — לא CSS-tooltip. המרת ל-tooltip CSS (R11) חייבת לשמר את שדות התוכן ואת חיווט `hoveredOrder`, ולוודא נגישות במקלדת (כיום ריחוף בלבד).
5. **צביעת שורה בסדר עדיפויות** (draft > spacing > pending > unpaid) מוטמעת inline בתוך `.map` ותלויה ב-`nowTick` (מונה שנייה) ו-`unsavedDrafts` (localStorage) — שינוי לקלאס CSS חייב לשמר את הסדר ואת התנאים המדויקים, כולל `hideCustomSpacing`.
6. **`sortPendingFirst`** חייב לרוץ על כל שלושת מקורות ה-`setOrders` (fetch/מטמון/מנוי); במצב AI מוגדר `setOrders(result.data)` ישירות בלי המיון.
7. **`handleShowAll`** מנקה חיפוש+מתקדם+AI — לא רק טאב. **"נקה הכל"** במודאל מרוקן גם `eventDateFrom` (לא כמו ברירת המחדל). שתי ההתנהגויות (לא עקביות) חלק מהחוזה.
8. **Effects שמתקנים מצב לא חוקי** (`drafts`/`not_taken` כשהטאב מוסתר) — תלויים בשני ה-settings; אם מסתירים טאבים בשיטה אחרת חובה לשמר את החזרה ל-`'soon'`.
9. **`HebrewDateRangePicker` כותב רק ב"אישור"**, ו-`selectionStarted` מבטיח שקליק ראשון מתחיל טווח חדש; שינוי ההתנהגות ישבור בחירת יום בודד (באג 6). ברירת מחדל `eventDateFrom` לפני 3 חודשים חלק מהחוזה (הטאב "ארכיון"/"הכל" מוגבלים בפועל לפי תאריך זה עד "נקה"/"הכל").
10. **`OrderModelSelector`** — dropdown בפורטל עם מיקום JS פיזי; `onChange(null)` = ניקוי (העמוד מפרש `m ? m.name : ''`); `name` אקראי נגד autofill; Enter בלי בחירה נפתר/נכשל בהתראה. לא להחליף ב-`<select>`.
11. **מודאל מתקדם**: `advTab` הוא state שמרנדר תנאי (לא מסתיר) — ערכי השדות נשמרים ב-`advFilters` בין לשוניות; הסינון חי בזמן אמת (כל הקשה משנה URL ← fetch מיידי, ללא debounce) — כפתור "החל סינון" בפועל רק סוגר (או מפעיל AI). אם מעצבים מחדש כ"טופס עם החלה" יש לשמר את הסינון החי או להחליט במודע (R8).
12. **`ai-feature-element`** ו-`body.hide-ai-features` — מנגנון הסתרה ב-CSS גלובלי; ExportButtons קורא את הקלאס ב-mount בלבד (`hideAi`).
13. **ExportButtons**: `data` לא בשימוש בפועל (יש `onFetchData`); לשמר את `exportLimit` (100), `exportMaxRows` מ-`/api/me`, ואת שלב אישור המנהל לפני `executeAction`. חלון ה-PDF הוא מסמך הדפסה עצמאי — צבעים קשיחים בכוונה.
14. **RentalReturnModal**: `onDoubleClick` על ה-backdrop (לא click) סוגר עם הגנות שינויים לא-שמורים; `isMountedRef` מגן מפני כתיבה אחרי סגירה בזמן PIN; ריבוי מודאלים מקוננים עם z-index 1100/1200/1300; `data-agy-id` על אלמנטים (כלי אוטומציה/בדיקות — לשמר). ממשק זה מורכב מאד וכולל הרבה alert/confirm/prompt גלובליים (`window.customConfirm/customPrompt/customAuthPrompt`) — חלק מהזרימה הוא `await` על הפופאפ; מחליפים את הפופאפ, לא את החוזה (Promise שמחזיר true/false/מחרוזת/`null`).
15. **`window.customConfirm/customPrompt`** מחזירים Promise; `customPrompt` מחזיר `null` לביטול ו-`''` לאישור ריק — `handleMarkReturnBad`/`reportIssue` תלויים בהבחנה (`note === null`).
16. **`selectedOrder` קוד מת** ו-`useState(limit)` קבוע — אפשר להשאיר; אך אין למחוק את `limit` ממפתח ה-URL.
17. **תלות ב-sprite של איקונים**: כל האיקונים `<svg><use href="#i-…"/>` (i-list, i-calendar, i-printer, i-plus, i-search, i-x, i-activity, i-folder, i-trash, i-alert-circle, i-edit, i-clock, i-bag, i-check, i-tag, i-phone, i-pin, i-info, i-truck, i-sort, i-chevron-down, i-chevron-start, i-chevron-end, i-alert-tri, i-card, i-check-circle, i-box, i-history, i-link, i-download, i-file, i-star, i-mail, i-scissors, i-refresh, i-user, i-arrow-end, i-home) מ-sprite גלובלי; StatisticsModal גם משתמש ב-lucide (`X`, `Send`, `MessageSquare`, `BarChart3`). החלפה ל-`Icon` של v3 חייבת לכסות את כולם.
18. **RTL**: `borderRight`, `marginRight:'auto'`, כיוון חצי עימוד (`chevron-end` = הקודם, `chevron-start` = הבא), `dir="ltr"` לטלפון/ברקוד, `direction:ltr` בשדות ברקוד — נבדקים ב-`getBoundingClientRect` (R17).
