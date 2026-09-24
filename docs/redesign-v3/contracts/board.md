# חוזה: `/board` — "לוח שנה" (לוח חודשי עברי של הזמנות)
קבצים: `app/board/page.js` (1115 שורות, client), `app/board/layout.js` (PageGate). בסיס להתאמה 100% (R24).
רכיבים חיצוניים שהעמוד מפעיל: `HebrewDatePicker` (`components/HebrewDatePicker.js`), `StatisticsModal` (`app/components/StatisticsModal.js`), `RentalReturnModal` (`components/orders/RentalReturnModal.js`), `PrintWizardModal` (`app/components/PrintWizardModal.js`). מודולים: `app/lib/pageCache.js`, `app/lib/prefetchRoutes.js`, `lib/apiCache.js`, `lib/hebrewDate.js`.

## א. תכלית והרשאות
- לוח חודש עברי (7 עמודות ראשון..שבת) שבו כל תא-יום מציג את ההזמנות לפי `eventDate`, עם חיפוש (רגיל/AI/גלובלי/מתקדם), פתיחת כרטיס הזמנה/לקוח/השכרה, הדפסת הכנה, ושאלות סטטיסטיקה.
- הרשאה: `layout.js:5-7` -> `<PageGate pageKey="page:board">`; מפתח `page:board` ב-`lib/permissionsMetadata.js:150` (`enforced:true`, ברירת מחדל סגור: רק הנהלה ראשית/מתכנת; אחרים דרך שורות הרשאה ב-`/admin/permissions`). הקישור בתפריט הצדדי נגזר מאותה החלטה (`canOpenPage`).
- בעמוד עצמו אין בדיקות הרשאה נוספות.

## ב. אזורים לפי סדר
1. `page-head` (:589-613): כותרת `h1` "לוח שנה" + אייקון `#i-calendar`; `page-actions`: חץ חודש קודם, תווית חודש-שנה עברי + `HebrewDatePicker iconOnly`, חץ חודש הבא, כפתור הדפסת הכנה (מותנה).
2. `toolbar` חיפוש (:616-678): טופס חיפוש (רגיל או AI), spacer, חיפוש גלובלי, חיפוש מתקדם.
3. `toolbar` מקרא צבעים (:681-692).
4. גוף: `loading` -> `page-loading` ספינר + "טוען נתונים..." (:694-698); אחרת `renderCalendar()` (:408-583): שורת כותרות ימים + רשת 7 עמודות של תאי יום (ריק / יום).
5. פורטלים (מעל הכל): popover פרטי הזמנה (hover), חלונית חיפוש מתקדם, חלונית תוצאות גלובליות, `StatisticsModal`, חלונית "הזמנות ליום" (תצוגה מורחבת), `RentalReturnModal`, `PrintWizardModal`, תפריט פעולות הזמנה.

## ג. שדות (state) — כולם
| תווית/מקום | state | פורמט / ולידציה |
|---|---|---|
| תאריך מוצג | `selectedDate` (Date, ברירת מחדל היום) | קובע את החודש העברי המוצג |
| קפיצה לתאריך (`HebrewDatePicker`, `iconOnly`, placeholder "קפוץ לתאריך...") :602 | `jumpDate` | ה-picker קורא `onChange("YYYY-MM-DD")`; `useEffect([jumpDate])` (:124-128) עושה `setSelectedDate(new Date(jumpDate))`. גם חיפוש גלובלי מציב `jumpDate=new Date(order.eventDate)` |
| חיפוש הזמנה "חיפוש הזמנה (מספר הזמנה, שם לקוח)..." :649 | `searchInput` (טיוטה), `search` (מוחל) | `search` מוגדר רק בשליחה (`handleSearch`, Enter/כפתור "חיפוש"); בלי ולידציה; משמש גם לחיפוש גלובלי ולטקסט חלונית תוצאות ריקות |
| חיפוש AI "בקש מה-AI למצוא נתונים (למשל: 'הזמנות של משפחת שיינועטר')..." :622 | `aiInputMode` (bool), `aiInputText` | submit ריק (`trim()`) — נבלע. `toggleAiInputMode` מעתיק טקסט בין `searchInput` <-> `aiInputText` בשני הכיוונים (:244-251) |
| מתאריך אירוע (`HebrewDatePicker`, "מתאריך...") :834 | `advFilters.eventDateFrom` | מחרוזת `YYYY-MM-DD` |
| עד תאריך אירוע ("עד תאריך...") :838 | `advFilters.eventDateTo` | כנ"ל |
| מספר הזמנה ("חפש לפי מספר...") :844 | `advFilters.advOrderId` | text |
| ברקוד/פרטי פריט ("ברקוד או תיאור...") :851 | `advFilters.itemDetails` | text |
| שם לקוח ("שם הלקוח...") :861 | `advFilters.customerName` | text |
| טלפון לקוח ("מספר טלפון...") :865 | `advFilters.customerPhone` | text |
| עיר מגורים ("עיר...") :871 | `advFilters.customerCity` | text |
| לשונית מתקדם | `advTab` (`'basic'`\|`'details'`) | basic="תאריך והזמנה"; details="פרטי לקוח" |
| checkbox "חפש עם AI על השדות שמולאו" `#board-adv-ai-mode` :879 | `advAiMode` | עטוף ב-`.ai-feature-element` (מוסתר גלובלית ע"י `body.hide-ai-features`, `globals.css:1820`) |
| סינון בחלונית יום "חיפוש הזמנה ביום זה (שם, טלפון, מספר)..." :1004 | `dayOrdersFilter` | client-only, case-insens.: שם (`customerName` או `customer.firstName+lastName`) / `customerPhone` / `String(orderId)` |
- אין שדות חובה בעמוד. כל השדות סינון בלבד. `advFilters` בלי ולידציה; ערכים ריקים לא נשלחים ב-API.

## ד. כפתורים / פעולות
| תווית / title | מיקום | handler | מה קורה |
|---|---|---|---|
| חודש קודם (`#i-chevron-end`) | :597 | `changeMonth(-1)` | חישוב HDate: יום 15 של החודש הנוכחי +/-30 יום -> יום 1 של אותו חודש -> `setSelectedDate`; catch: `setMonth(+-1)` |
| חודש הבא (`#i-chevron-start`) | :604 | `changeMonth(1)` | כנ"ל |
| "הדפסת הזמנות להכנה" `#i-printer` | :608 (רק `enableBatchPrintPrep`) | `setShowPrintWizard(true)` | פותח `PrintWizardModal` |
| "חיפוש" (submit) | :667 | `handleSearch` | `setSearch(searchInput)`; `setIsAiModeActive(false)` |
| "ניקוי חיפוש" `#i-x` (מוצג כש-`searchInput`) | :657 | `handleClearSearch` | מאפס `searchInput`+`search`; מכבה `isAiModeActive` |
| "חיפוש חכם (AI)" `#i-star` (בשני המצבים) | :635, :661 | `toggleAiInputMode` | מחליף מצב סרגל; ב-AI מסומן ב-accent-tint |
| "שאלות סטטיסטיקה" `#i-activity` (בשני המצבים) | :638, :664 | `setShowStatistics({x:e.clientX,y:e.clientY})` | פותח StatisticsModal בנקודת הלחיצה |
| "נקה" `#i-x` בשדה AI (כש-`aiInputText` ולא `aiLoading`) | :631 | `setAiInputText('')` | |
| "חפש בחכמה" / "מייצר שאילתה..." (submit ב-AI) | :641 | `handleAiInputSubmit` -> `handleAiSearch(aiInputText)` | `disabled` בזמן `aiLoading`; הקלט disabled בזמן טעינה |
| "חיפוש בכל החודשים (גלובלי)" `#i-search` | :672 | `handleGlobalSearch` | ראו ה'; `alert` אם `searchInput` ריק |
| "חיפוש מתקדם" `#i-list` | :675 | `setShowAdvSearch(true)` | |
| "נקה הכל" (חלונית מתקדם) | :884 | `setAdvFilters({כל 7 המפתחות: ''})` | לא סוגר, לא משנה `advTab`/`advAiMode` |
| "החל סינון" `#i-check` | :887 | אם `advAiMode`: `prompt=buildBoardAiPrompt(advFilters)` (:23-35), סוגר, ו-אם `prompt` לא ריק -> `handleAiSearch(prompt)`; אחרת רק סוגר (הסינון חל אוטומטית דרך `advFilters` ב-`fetchOrdersForMonth` בזמן ההקלדה, לא בלחיצה) | |
| "סגירה" `#i-x` (כל חלונית) | :811, :913, :992, StatisticsModal | סגירה | |
| "קפוץ לחודש" (תוצאה גלובלית) | :932-943 | אם יש `eventDate`: `setJumpDate(new Date(eventDate))` + סוגר חלונית | בלי `eventDate` — לא עושה כלום |
| "צפה בהזמנה" (`Link` `/orders/{orderId}` `target=_blank`) | :944 | ניווט | |
| "תצוגה מורחבת ליום זה" `#i-expand` (בתא יום עם **>2** הזמנות) | :531 | `setSelectedDayOrders({date:cellGreg, hebrewDate:hebrewDayStr, orders:dayOrders})` (עם stopPropagation) | |
| "הדפסת פרוט ההזמנות ליום זה" `#i-printer` (בתא: `dayOrders.length>0 && enableBatchPrintPrep`; גם בכותרת חלונית היום) | :550, :988 | `printDayOrders(dayOrders)` | `window.open('/print/order?orderId=<ids מופרד פסיק>&type=order&batch=1','_blank')` (batch=1 חובה — תיקון f4b54afc) |
| כרטיס הזמנה בתא (לחיצה על כל הכרטיס) | :356-371 | onClick: `setActionPos({top:rect.bottom+scrollY, left:rect.left+scrollX})`, `setActionOrder(order)` | פותח תפריט פעולות |
| "פרטים נוספים" `#i-info` בכרטיס | :389-402 | `onMouseEnter` (חישוב `popoverPos` = מרכז-מעל הכפתור, `setHoveredOrder({order,category})`), `onMouseLeave` (null), `onClick` = stopPropagation בלבד | popover ריחוף בלבד |
| בתפריט הפעולות: "כרטיס הזמנה" | :1080 | `Link /orders/{orderId}` (אותו טאב) | |
| "כרטיס לקוח" (מותנה `actionOrder.customerId \|\| customer?.id`) | :1087 | `Link /customers/{id}` | |
| "כרטיס השכרה" `#i-box` | :1096 | `setSelectedRentalOrderId(orderId)`, `setActionOrder(null)`, סוגר חלונית יום אם פתוחה | פותח RentalReturnModal |

## ה. קריאות רשת
| # | שיטה + URL | טריגר | שימוש בתשובה | מטמון |
|---|---|---|---|---|
| 1 | `fetchSharedJson('/api/settings', {ttl: TTL.STATIC})` (:100) | mount | קורא 3 מפתחות: `enable_alterations` (רק `'false'` מכבה `enableAlterations`; ברירת מחדל true), `hide_custom_spacing` (`'true'` -> `hideCustomSpacing`), `enable_batch_print_prep` (`'true'` -> `enableBatchPrintPrep`, ברירת מחדל false); שגיאה -> `console.error` | `lib/apiCache` משותף |
| 2 | `GET /api/orders?<buildBoardMonthParams(selectedDate,{search,advFilters})>` עם `signal` של AbortController (:178) | mount ובכל שינוי של `selectedDate`/`search`/`advFilters`/`isAiModeActive` (`fetchOrdersForMonth` deps :200) | `data.data` או `data.orders` -> `setOrders` | `boardCache = cacheNamespace('board')` (`app/lib/pageCache.js`), מפתח = `queryParams.toString()`. cache-hit: מציג מיד (בלי `setLoading(true)`) **ובכל זאת** מרענן ברשת ומעדכן מטמון (SWR); miss: `setLoading(true)`. מפתח נבנה ב-`app/lib/prefetchRoutes.js:168-199`; ה-prefetch של `/board` (שורה ~244) מחמם `buildBoardMonthParams(new Date())` — הסדר והמפתחות חייבים להישאר זהים |
| | query keys: `eventDateFrom` (ISO של יום 1 עברי -14 ימים), `eventDateTo` (ISO של היום האחרון +14), `filterStatus=all`, `limit=2000`, אופציונלי `search`, ולכל ערך לא-ריק ב-`advFilters`: `customerName, customerPhone, customerCity, advOrderId, itemDetails, eventDateFrom(!), eventDateTo(!)` (`append` — מוסיף כפול לשם המפתח של הטווח כשמסננים לפי תאריך; להשאיר כפי שהוא) | | | |
| 3 | `POST /api/ai/smart-search` JSON `{prompt, pageContext:'board'}` (:215) | `handleAiSearch` (מהסרגל או מ"החל סינון" עם `advAiMode`) | `res.ok`: `setOrders(result.data||[])`, `setIsAiModeActive(true)`, `setAiQueryUsed(result.query||'')`; אחרת `alert(result.error||'שגיאה בחיפוש החכם')`; חריג: `alert('שגיאת תקשורת')` | אין. בזמן `isAiModeActive` `fetchOrdersForMonth` מדלג (return מוקדם) ולכן ההזמנות שנטענו ע"י ה-AI נשארות עד `handleSearch`/`handleClearSearch` |
| 4 | `GET /api/orders?search=<encodeURIComponent(searchInput)>&limit=100&filterStatus=all` (:138) | `handleGlobalSearch` | `data.data || data.orders || []` -> `globalSearchResults`; `finally` `globalSearchLoading=false` | אין. החלונית נפתחת (`showGlobalSearchModal=true`) **לפני** הקריאה |
| 5 | קריאות פנימיות של `StatisticsModal`: `POST /api/ai/statistics` (:158), `/api/ai/sessions` (:179), + `localStorage` | בתוך הרכיב | ראו ז/ח | |
| 6 | קריאות פנימיות של `RentalReturnModal`: `/api/orders/{id}`, `/api/rentals/scan`, `/api/rentals/confirm` (POST/DELETE), `/api/returns/scan`, `/api/rentals/cancel`, `/api/audit/order-item/{id}`, `/api/returns/report-issue`, `/api/rentals/toggle`, `/api/customers/{id}` | בתוך הרכיב | `onUpdate` = `fetchOrdersForMonth` (:1042) | |
| 7 | קריאות פנימיות של `PrintWizardModal`: `/api/orders/print-prep?...` (ועוד) | בתוך הרכיב | | |
- אין polling.

## ו. חלוניות / popups / הודעות
1. **Popover פרטי הזמנה** (:703-801, `createPortal`→body, `position:fixed`, `pointerEvents:none`, z 10000): מופיע ב-hover על "פרטים נוספים". שורות (כל אחת label+value): כותרת "פרטים על הזמנה #id"; "לקוח:" (הערך לא מוצג — קיים רק label; לוודא בפרזנטציה), "טלפון:" `customerPhone||'לא הוזן'` (`dir=ltr`); "תאריך עברי:" `eventDateHebrew||'לא צוין'`; "תאריך לועזי:" `toLocaleDateString('he-IL')`; "ציפוף ימים:" (רק אם `!hideCustomSpacing` וגם `customSpacing != null`; badge-warning "N יום/ימים" — 1 => "יום"); "פריטים בהזמנה:" (לא נמחקו); "הושכר:" (`isTaken`); "הוחזר:" (`isReturned`); "סה"כ לתשלום: ₪totalAmount||0"; "שולם: ₪totalPaid||0" (ירוק אם שולם מלא ו-`totalAmount>0`, כתום אם `>0`, אדום אחרת); "סטטוס:" תווית קטגוריה בצבע `CATEGORY_STYLE[cat].text`.
2. **חלונית חיפוש מתקדם** (:803-903): backdrop לחיצה סוגר; `modal` maxWidth 640; head "חיפוש מתקדם" + X; `tabs` (2 לשוניות); body (`form-grid`) לפי לשונית + checkbox AI; foot: "נקה הכל", "החל סינון". **חלונית עם הזנת מידע -> בהיר בלבד (R19)**.
3. **חלונית תוצאות חיפוש גלובלי** (:905-960): head "תוצאות חיפוש גלובלי"; body: טעינה ("טוען תוצאות..." + ספינר) / רשימת `list-card` (שורה: "הזמנה #id - first last" (`customer.firstName`, `customer.lastName||customerName`), תאריך עברי או לועזי, כפתור "קפוץ לחודש", לינק "צפה בהזמנה") / ריק: `empty-state` `#i-search` + `לא נמצאו תוצאות לחיפוש: "{searchInput}"`.
4. **`StatisticsModal`** (:962-968): props `isOpen={!!showStatistics}`, `onClose={()=>setShowStatistics(false)}`, `pageContext="board"`, `position` (אובייקט `{x,y}` אם `showStatistics` הוא אובייקט, אחרת null), `contextQuery={aiQueryUsed}`. התנהגות: צ'אט AI סטטיסטיקה, ברכה, היסטוריית סשנים ב-`localStorage['ai_statistics_chat_sessions_board']` + סנכרון `/api/ai/sessions`; `pageContext='board'` בברכה מנוסחת "המערכת".
5. **חלונית "הזמנות ליום X"** (:970-1036, z 9998): head `הזמנות ליום {date.toLocaleDateString('he-IL')} ({hebrewDate})`, כפתור הדפסה (מותנה `enableBatchPrintPrep`), סגירה (מאפסת גם `dayOrdersFilter`); backdrop click סוגר ומאפס סינון; body: שדה חיפוש + X ניקוי + רשימת `renderOrderCard` מסוננת. לחיצה על כרטיס בתוכה פותחת תפריט פעולות (z 9999 מעל).
6. **`RentalReturnModal`** (:1038-1044): props `orderId={selectedRentalOrderId}`, `onClose`, `onUpdate={fetchOrdersForMonth}`. מוצג כל עוד `selectedRentalOrderId` truthy. כרטיס השכרה/החזרה מלא (סריקה, אישור, ביטול, דיווח בעיה, היסטוריה).
7. **`PrintWizardModal`** (:1046-1052): props `onClose`, `defaultReportType={enableBatchPrintPrep ? 'order_prep_by_date' : undefined}`, `enableBatchPrintPrep={enableBatchPrintPrep}`. מוצג רק אחרי לחיצה (`showPrintWizard`). אין `defaultStartDate/EndDate/getCurrentOrderIds`.
8. **תפריט פעולות הזמנה** (:1054-1112): overlay שקוף fixed (z 9998, לחיצה סוגרת) + כרטיס `position:absolute` ב-`actionPos` (z 9999): כותרת "הזמנה #id", "כרטיס הזמנה", "כרטיס לקוח" (מותנה), "כרטיס השכרה". ה-Link לא סוגר את התפריט (הניווט מחליף עמוד).
9. `alert()` דפדפן: "נא להזין טקסט לחיפוש גלובלי (לפי מספר הזמנה או שם לקוח)"; שגיאות AI (ראו ה'3). אין `customConfirm`/טוסט בעמוד.

## ז. מצבים מיוחדים
- **טעינה** (`loading` מתחיל true): "טוען נתונים...". `finally` מנקה רק אם הבקשה עדיין הנוכחית (`activeOrdersRequestRef===controller`); `AbortError` מתעלם. טעינת חודש עם cache-hit לא מציגה ספינר.
- **שגיאת רשת**: `console.error` בלבד, אין הודעה למשתמש; ההזמנות הקודמות נשארות.
- **ריק**: אין הודעת "אין הזמנות" — פשוט תאי יום ריקים; תאים "ריקים" (לפני 1 בחודש/אחרי סוף) מוצגים כרטיס מקווקו `--surface-alt`.
- **מצב AI פעיל** (`isAiModeActive`): הלוח מציג את תוצאות ה-AI (בכל חודש שנבחר לא נטענים נתונים). אין באנר/תג המציין שמצב AI פעיל בסרגל (אין UI ל-`aiQueryUsed` מלבד העברה ל-StatisticsModal כ-`contextQuery`).
- **מצב הגדרות (SystemSetting)**:
  - `enable_alterations`: אם `'false'` — קטגוריית `repairs` ("יש תיקונים") לא נחשבת ב-`getOrderCategory` ונעלמת מהמקרא.
  - `hide_custom_spacing`: מסתיר שורת "ציפוף ימים" ב-popover.
  - `enable_batch_print_prep` (ברירת מחדל false; נדלק לנווה יעקב — דיווח לקוח בגמח הראשי): מציג כפתור הדפסת הכנה בראש, כפתור הדפסה בתא (כשיש הזמנות) ובחלונית יום, וקובע ל-PrintWizardModal את `order_prep_by_date`.
  - הגמח הראשי מול נווה יעקב: ההבדל היחיד הוא ערכי ההגדרות הנ"ל (אין `org` בעמוד).
  - `body.hide-ai-features` (הגדרת מערכת, ב-`app/layout.js`) מסתיר `.ai-feature-element` (רק ה-checkbox של AI במתקדם; כפתורי ה-AI בסרגל **אינם** מסומנים בכלל ולכן נשארים גלויים).
- **קטגוריות הזמנה** (`getOrderCategory` :287-306, סדר עדיפויות): `empty` (אין פריטים) > `returned` (כל הלא-נמחקים הוחזרו) > `rented` (הכל/חלק נלקח או חלק הוחזר) > `repairs` (אם `enableAlterations` ויש `neck/length/sleeveAlteration` או `alterationDetails`) > `unpaid` (`totalPaid<totalAmount`) > `completed` (`totalAmount>0 && totalPaid>=totalAmount`) > `other`. תוויות: 'הזמנה פגומה (0 פריטים)', 'יש תיקונים', 'לא שולם', 'הוחזר', 'מושכר/חלקית', 'הושלם (שולם)', 'אחר'. תג הקטגוריה בכרטיס לא מוצג ל-`other`; קטגוריה `empty` לא במקרא.
- **איחור** (`isOrderLate` :337-350, ובתא :463-479): פריט `isTaken && !isReturned` (לא-נמחק) וגם `ceil((היום00:00 - eventDate00:00)/יום) > 2`. כרטיס: מסגרת 2px danger, שם ומספר באדום + אייקון `#i-alert-circle`; תא: מסגרת+צל danger + עיגול "!" בפינה (`insetInlineEnd:-10px`, top -10).
- **תא היום**: `isToday` — מסגרת primary 2px + צל; `isHighlighted` (`highlightedDate === dateStr`) — צל primary-tint-2 (ה-state `highlightedDate` לא מוגדר לשום ערך בעמוד — תמיד '', קוד מת; `setHighlightedDate` אינו בשימוש).
- **תא יום**: מספר עברי (`renderGematriya().split(' ')[0]`), ספירת הזמנות (title "מספר הזמנות ליום זה") כש->0, תאריך לועזי `d/m` בצד, תג פרשה בשבת בלבד (עמודה j===6; `Sedra(hYear,true).lookup`, `Locale.gettext(...,'he')`, מחובר במקף), תגי חגים (`HebrewCalendar.getHolidaysOnDate(cellHDate,true)`; מסנן: flags 8192 מודרניים לא; שמות המכילים 'בנות'/'מעשר בהמה'/'סליחות' לא; מקבל רק דגלים 1|524288|2097152|16384|256), רשימת כרטיסי הזמנה `maxHeight:150px; overflowY:auto`; `minHeight:130px`.
- **קיבוץ לתאים**: `ordersByDate` לפי `new Date(eventDate).toLocaleDateString('en-CA')` (זמן מקומי) — הזמנה ללא `eventDate` לא מוצגת.
- הכרטיס (`title` native): `סטטוס: <תווית>\nסה"כ: ₪X\nשולם: ₪Y`. שם: `customerName || customer.firstName+lastName`; מספר `#orderId`; `borderInlineStart:3px` בצבע הקטגוריה (`CATEGORY_STYLE`), או מסגרת מלאה אדומה באיחור.
- חודש מוצג: `getHebrewMonthYear(selectedDate)` (`lib/hebrewDate.js`).

## ח. URL / localStorage / sessionStorage
- אין query params בעמוד עצמו, אין localStorage/sessionStorage משלו.
- `StatisticsModal`: `localStorage['ai_statistics_chat_sessions_board']`.
- מטמון זיכרון (לא storage): `cacheNamespace('board')`, `lib/apiCache` (`/api/settings`).
- ניווט החוצה: `/orders/{id}` (טאב חדש מתוצאות גלובליות; אותו טאב מתפריט פעולות), `/customers/{id}`, `/print/order?orderId=...&type=order&batch=1` (טאב חדש).

## ט. הדפסה / ייצוא / AI
- הדפסה: `printDayOrders` (ישירה) + `PrintWizardModal` (`order_prep_by_date` כברירת מחדל כשההגדרה דלוקה).
- AI: (1) חיפוש חכם `/api/ai/smart-search` `pageContext:'board'`; (2) חיפוש מתקדם עם `advAiMode` + `buildBoardAiPrompt`: משפט "הזמנות" + חלקים: `מספר הזמנה X`, `של לקוח בשם X`, `עם טלפון X`, `בעיר X`, `עם פריט/ברקוד X`, טווח `בטווח תאריכי אירוע מ-A עד B` / `מתאריך אירוע A` / `עד תאריך אירוע B`, מופרדים בפסיק; (3) `StatisticsModal`.
- אין ייצוא (`ExportButtons` לא בשימוש).

## י. מחרוזות (לכתיבה מחדש)
- כותרות: "לוח שנה", "חיפוש מתקדם", "תוצאות חיפוש גלובלי", "הזמנות ליום ...", "פרטים על הזמנה #", "הזמנה #".
- title-ים: "חודש קודם/הבא", "הדפסת הזמנות להכנה", "הדפסת פרוט ההזמנות ליום זה", "תצוגה מורחבת ליום זה", "מספר הזמנות ליום זה", "פרטים נוספים", "ניקוי חיפוש", "חיפוש חכם (AI)", "שאלות סטטיסטיקה", "נקה", "נקה סינון", "סגירה"/"סגור", "חיפוש בכל החודשים (גלובלי)", "חיפוש מתקדם".
- placeholders: כל אלה שבטבלת ג'.
- כפתורים: "חיפוש", "חפש בחכמה", "מייצר שאילתה...", "נקה הכל", "החל סינון", "קפוץ לחודש", "צפה בהזמנה", "כרטיס הזמנה", "כרטיס לקוח", "כרטיס השכרה".
- מקרא: "מקרא:" + 5-6 תוויות קטגוריה. ימי שבוע: ראשון..שבת.
- popover: כל תוויות ו.1.
- הודעות: "טוען נתונים...", "טוען תוצאות...", `לא נמצאו תוצאות לחיפוש: "..."`, alerts (ו.9).
- תוויות מתקדם: "תאריך והזמנה", "פרטי לקוח", "מתאריך אירוע", "עד תאריך אירוע", "מספר הזמנה", "ברקוד/פרטי פריט", "שם לקוח", "טלפון לקוח", "עיר מגורים", "חפש עם AI על השדות שמולאו".

## יא. Risk notes
1. **המפתח של המטמון** = `buildBoardMonthParams(...).toString()` ומשותף עם `prefetchRoutes.js` — לא לשנות שמות/סדר params או ה-URL.
2. `fetchOrdersForMonth` מחובר ל-AbortController + `activeOrdersRequestRef` + מדלג ב-`isAiModeActive`; ההיגיון בתוך `useCallback` עם deps — לא לפצל/להזיז.
3. `advFilters` חל **מיידית** ב-`fetchOrdersForMonth` בזמן הקלדה (כל שינוי -> בקשה חדשה עם ביטול קודמת). "החל סינון" רק סוגר (או מפעיל AI). אל תהפכו לסינון "בהחלה" בלי לשמר את ההתנהגות.
4. `advFilters.eventDateFrom/To` נשלחים כ-append נוסף לאותם שמות שכבר נקבעו לטווח החודש — שרת מקבל את הראשון/האחרון לפי `URLSearchParams.get`; לא לגעת.
5. **רשת 7 עמודות ב-RTL**: `firstDayOfWeek` מ-`HDate.getDay()` (0=ראשון) וכותרות "ראשון..שבת" באותו סדר; פרשה מחושבת ב-`j===6`. שינוי כיוון/סדר רשת ישבור את זיהוי שבת ואת יישור הכותרות — לבדוק ב-`getBoundingClientRect` (R17). הימנעו מ-`order` ב-flex/grid על התאים.
6. **חצים**: "חודש קודם" משתמש ב-`#i-chevron-end` ו"הבא" ב-`#i-chevron-start` (מכוון ל-RTL); לא להחליף.
7. תפריט הפעולות ממוקם ב-`position:absolute` עם `rect.bottom + scrollY` ו-`rect.left + scrollX` (ולא inset-inline) — תלוי ב-`left`; במעבר ל-Dialog חדש יש לשמר מיקום ליד הכרטיס וסגירה בלחיצה מחוץ.
8. popover ה-hover: `pointerEvents:none` + `translate(-50%,-100%)` מעל הכפתור; לא להפוך לחלונית שבולעת אירועים. `onMouseLeave` מאפס.
9. כרטיס הזמנה: `onClick` על הכרטיס כולו; הכפתור הפנימי חייב `stopPropagation`. כפתורי התא (הרחבה/הדפסה) גם `stopPropagation`.
10. סדר z-index: popover 10000 > תפריט פעולות 9999 > overlay/חלונית יום 9998 > חלונות מתקדם/גלובלי 1000. תפריט הפעולות נפתח מעל חלונית היום, וכשבוחרים "כרטיס השכרה" חלונית היום נסגרת.
11. `showStatistics` הוא bool/אובייקט `{x,y}` — `isOpen={!!showStatistics}`; `position` תלוי ב-`typeof === 'object'`.
12. "לקוח:" ב-popover מוצג כ-label בלבד בלי ערך (חסר בקוד הקיים — להחליט אם לתקן; זה שינוי תצוגה לא לוגיקה, יש לתעד ב-IDEAS-LOG).
13. `highlightedDate`/`setHighlightedDate` — לא בשימוש בפועל (ערך תמיד ''); אין צורך לשחזר אבל אין להסיר בשלב הזה בלי אישור.
14. `useEffect([jumpDate])` — כל קפיצה (גם מחיפוש גלובלי) עוברת דרכו; ה-picker מקבל `value={jumpDate}` ולכן מציג את התאריך שנבחר.
15. סימון הקטגוריות בכרטיס (border-inline-start + badge + `CATEGORY_STYLE`) הוא הייצוג הצבעוני היחיד של סטטוס — המקרא צריך להתאים אחד-לאחד לאותם צבעים (R2: לעבור ל-tokens).
16. הגדרות נטענות אסינכרונית מ-`fetchSharedJson` (TTL.STATIC) — עד הגעתן `enableAlterations=true`/`enableBatchPrintPrep=false`, כך שכפתורי ההדפסה מופיעים "בקפיצה" אחרי טעינה; לשמר הופעה מותנית ולא להסתיר בשלד קבוע.
17. גלילה פנימית בכל תא (`maxHeight:150px`) — הכרטיסים בתא מוגבלים בגובה ובחלונית היום מוצגים ללא הגבלה; שמרו על שתי התצוגות.
18. שימוש ב-`toLocaleDateString('en-CA')` כמפתח יום — לא להחליף ל-UTC (`toISOString`), אחרת ימים יזוזו.
