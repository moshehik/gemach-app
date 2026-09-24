# חוזה עמוד: תפירות ותיקונים — `/alterations`

מקור: `app/alterations/page.js` (622 שורות) + `app/alterations/layout.js`. שורות מצוינות כ-`page.js:N`.

## א. מטרה והרשאות
- רשימת פריטי הזמנה (OrderItem) עם תיקוני תפירה (צוואר/אורך/שרוול/תיאור חופשי), סימון "בוצע", הדפסה, ייצוא, חיפוש רגיל וחכם (AI), ושאלות סטטיסטיקה.
- גישה: `layout.js:6` → `<PageGate pageKey="page:alterations">` (נאכף בשרת; `lib/permissionsMetadata.js:235`; ברירת מחדל: הנהלה ראשית/מתכנת). ה-API `GET /api/alterations` דורש `checkAuth()`.
- Prefetch: `lib/prefetchRoutes.js:233` (`'/alterations'` → warm של אותו URL ב-namespace `alterations`); `prefetchRoutes.js:279` מפעיל `/orders` ביחד עמו.
- ללא הבדל בין גמח ראשי ל"נווה יעקב" בקוד העמוד; ללא SystemSetting.

## ב. אזורים לפי סדר
1. `page-head`: כותרת `h1` + שורת ספירה (`totalCount`) + `page-actions`: כפתור "סמן יום כבוצע", אשף הדפסה (איקון), מקרא (איקון), `ExportButtons` (איקון).
2. `toolbar` (`alignItems: stretch`): בורר טווח תאריכים (`HebrewDateRangePicker className="range-flat"`) + סרגל חיפוש (רגיל או AI — מצב מתחלף).
3. `pill-tabs` סטטוס: הכל / ממתינים / בוצע.
4. גוף: loading → error callout → טבלה (`table.data`) + `table-foot` (סיכום + pager).
5. חלוניות: `PrintWizardModal`, מקרא צבעים (portal), `StatisticsModal`.

## ג. שדות / קלטים
| תווית/placeholder | state | פורמט / ולידציה | שורה |
|---|---|---|---|
| בורר טווח: "בחר תאריך התחלה"/"בחר תאריך סיום" | `startDate`,`endDate` (`YYYY-MM-DD`, '' כברירת מחדל) | `onChange(start,end)` מציב את שניהם; לא מאפס `page` (!) | 342-352 |
| חיפוש רגיל "חיפוש (מספר הזמנה, שם לקוח, דגם שמלה)..." | `searchInput` (נשלח ל-`search` רק ב-submit) | ללא ולידציה | 385-392 |
| חיפוש AI "בקש מה-AI למצוא נתונים..." | `aiInputText` (disabled בזמן `aiLoading`) | submit ריק (trim) = no-op (215-219) | 360-366 |
| מספר עמוד `#alterationsListPageNum` (label "עמוד") | `page` | `parseInt`; מתקבל רק אם `1<=v<=totalPages`; `min/max`; מוצג רק אם `totalPages>1` | 550-560 |
- קבוע: `limit = 60` (27). מצב: `filterStatus` ∈ `all|pending|done` (34).

## ד. כפתורים / פעולות
- **"סמן יום כבוצע"** (287-296): `markAllDone`; `disabled={!startDate}`; בלי startDate → `alert('יש לבחור תאריך…')`; `customConfirm` עם תאריך עברי (`getHebrewDateString(startDate)`); POST `{date:startDate}`; הצלחה → `fetchAlterations()`. שימו לב: משתמש רק ב-`startDate` (לא בטווח).
- **אשף הדפסה** (297): `setIsPrintWizardOpen(true)`.
- **מקרא** (300): `setIsLegendOpen(true)`.
- **ExportButtons** (303-333): props `data` (items ממופים), `filename="תפירות"`, `columns` (10 עמודות: orderId, customerName, dressName, sizeText, eventDate, neckAlterationText, lengthAlterationText, sleeveAlterationText, alterationDetails, alterationStatus), `iconOnly`, `onFetchData={fetchForExport}`.
- **חיפוש**: submit → `handleSearch` (162): `setSearch(searchInput)`, `setPage(1)`, `setIsAiModeActive(false)`.
- **X ניקוי חיפוש** (395, רק כש-`searchInput`): `handleClearSearch` (195): מאפס input/search/page; אם `isAiModeActive` → מכבה ו-`fetchAlterations()`.
- **כוכב AI** (399 / 373): `toggleAiInputMode` (206) — מעתיק טקסט בין `searchInput` ל-`aiInputText`.
- **X ניקוי בחיפוש AI** (369, כש-`aiInputText && !aiLoading`): `setAiInputText('')`.
- **פעילות/סטטיסטיקה** (376, 402): `setShowStatistics({x:e.clientX,y:e.clientY})` (אובייקט מיקום).
- **"חפש בחכמה"** (379): submit → `handleAiInputSubmit` → `handleAiSearch(query)`; טקסט בזמן טעינה "מייצר שאילתה...".
- **טאבי סטטוס** (413/417/421): `setFilterStatus(...)` — **לא מאפסים `page`**.
- **שורה**: קישור `Link href=/orders/{order.orderId}` (title "כרטיס הזמנה"); כפתור ✓ "סמן שבוצע" רק לפריט שלא בוצע (`markDone(item.id)`), לפריט שבוצע — כפתור מוסתר `visibility:hidden` לשמירת רוחב (516).
- **Pager** (545-566): הקודם (`disabled page<=1`), הבא (`disabled page>=totalPages`), `setPage(p±1)`.
- **מקרא**: X ו"הבנתי" סוגרים; לחיצה על ה-backdrop סוגרת.

## ה. קריאות רשת
| # | שיטה+URL | trigger | גוף/query | שימוש בתשובה | cache |
|---|---|---|---|---|---|
| 1 | `GET buildAlterationsListUrl({filterStatus,page,limit:60,startDate,endDate,search})` → `/api/alterations?showOnlyPending=<filterStatus==='pending'>&page=&limit=60[&startDate][&endDate][&search]&hideTakenReturned=true` (`prefetchRoutes.js:78-91`) | useEffect (94-104) על `[startDate,endDate,filterStatus,page,search,totalPages]` | — | `data.data`→`items`, `totalPages`, `total`→`totalCount`; שגיאה: `!res.ok` → `error` | SWR: `cacheNamespace('alterations')`, מפתח = ה-URL; cache-hit מציג מיד וממשיך לרענן. `set` אחרי כל fetch |
| 2 | אותה קריאה ל-`page+1` (prefetch) | `setTimeout 1500ms` אם `page<totalPages` | — | רק ל-cache; שגיאות מושתקות | כותב ל-cache בלבד |
| 3 | `POST /api/alterations/mark-done` | `markDone` | `{orderItemId}` | הצלחה: אם `filterStatus==='pending'` מסיר מהרשימה, אחרת `alterationDone:true` מקומי (לא מעדכן `totalCount`/cache!) ; שגיאה: `alert('שגיאה בעדכון התיקון: …')` | אין invalidate |
| 4 | `POST /api/alterations/mark-done` | `markAllDone` | `{date:startDate}` | `fetchAlterations()` | — |
| 5 | `POST /api/ai/smart-search` | `handleAiSearch` | `{prompt, pageContext:'alterations'}` | הצלחה: `items=result.data`, `totalCount=data.length`, `totalPages=1`, `isAiModeActive`, `aiQueryUsed=result.query`; `!ok` → `alert(result.error \|\| 'שגיאה בחיפוש החכם')`; catch → `alert('שגיאת תקשורת')` | ללא |
| 6 | `GET /api/alterations?showOnlyPending=&page=1&limit=<exportLimit>&hideTakenReturned=true[&startDate][&endDate][&search]` | `fetchForExport` (מ-ExportButtons) | — | ממפה לשורות ייצוא; שגיאה→`[]` | ללא |
| 7 | `GET /api/alterations?...&limit=2000&hideTakenReturned=true…` | `getCurrentAlterationOrderIds` (מ-PrintWizard במצב "current") | — | מחזיר `orderId` ייחודיים | ללא |
- חשוב: מצב AI מחליף את `items` אבל אפקט (1) ירוץ מחדש ויכתוב אותם אם `totalPages`/פרמטרים משתנים — התנהגות קיימת, לא לשנות.
- ExportButtons קורא גם `GET /api/me` (מגבלת שורות) ו-`POST /api/ai/report`, `POST /api/auth/verify-pin` (ר' ExportButtons). PrintWizardModal: `GET /api/orders/print-prep` (רק לסוג order_prep_by_date), ו-`downloadGeneratedPdf` (`/api/pdf`).

## ו. חלוניות / אישורים / הודעות
- `window.customConfirm('האם לאשר ביצוע תיקון?')` (107) ; `window.customConfirm('בטוח שבוצעו כל התיקונים לתאריך {date}?')` (134) — פונקציה גלובלית; החוזה: promise→boolean.
- `alert` (native): 123, 129-131 (בחר תאריך), 145, 185, 189.
- **PrintWizardModal** (`app/components/PrintWizardModal.js`, 573-580): props `onClose`, `defaultStartDate={startDate}`, `defaultEndDate={endDate}`, `getCurrentOrderIds={getCurrentAlterationOrderIds}` (לא מועבר `defaultReportType`/`enableBatchPrintPrep`). התנהגות: סוגי דוח (`alterations_pending` ברירת מחדל, `alterations_all`, `orders_no_alterations`, `orders_all`, `labels`, `order_prep_by_date`), מצבי תאריך (`current`/`today`/`custom`; להכנות: `prep_today`/`single`/`custom`), פותח `window.open('/print/alterations?reportType=&dateMode=&orderIds|startDate|endDate','_blank')` או PDF (`downloadPdf=true`) או `/print/order?orderId=..&type=order&batch=1`. z-index 1100.
- **מקרא צבעים** (582-611, `createPortal` ל-body, רק אם `mounted`): כותרת "מקרא צבעים", שתי שורות (badge ממתין / badge בוצע + הסבר), כפתור "הבנתי"; z-index 9999; backdrop-click סוגר.
- **StatisticsModal** (`app/components/StatisticsModal.js`, 613-619): props `isOpen={!!showStatistics}`, `onClose`, `pageContext="alterations"`, `contextQuery={aiQueryUsed}`, `position` (אם אובייקט). פנימית: `POST /api/ai/statistics`, `POST /api/ai/sessions`; localStorage `ai_statistics_chat_sessions_alterations`.

## ז. מצבים מיוחדים
- **loading** (427): `.page-loading` + spinner + "טוען נתונים..." — מחליף את כל הטבלה. cache-hit מבטל loading מיד.
- **error** (432): callout-danger, כותרת "שגיאה בטעינת נתונים" + הודעה.
- **empty** (456): שורה בודדת `colSpan=7` + "לא נמצאו תיקונים העונים לחתך החיפוש".
- **צבעי שורה**: בוצע = רקע `--success-tint` + פס ימני 4px `--success`; ממתין = `--warning-tint`/`--warning` (inline style, hover מנוטרל בכוונה).
- פריט ללא שמלה: `item.description || item.dressItem?.dressName`. תאריך אירוע: `order.eventDateHebrew` או `getHebrewDateString(order.eventDate)` או `-`.
- שמלה: `dress.name (קוד: <barcodePrefix מ-dress|dressItem|item>)` — נוסחה מוכפלת ב-3 מקומות (309, 484, 235) ובאחד `fetchForExport`.
- צ'יפים בפירוט: צוואר `neckAlteration>0` "צוואר: הצרה N"; שרוול `sleeveAlteration>0` "שרוול: הארכה N"; אורך `lengthAlteration` (truthy) "אורך: X"; `alterationDetails` צ'יפ ניטרלי; אחרת "-".
- מידה: `badge-neutral` עם `sizeText || size`.
- הפריטים המוצגים מסוננים בשרת ל-`hideTakenReturned=true` (רק פריטים שלא נלקחו/הוחזרו).

## ח. URL / storage
- אין query params בעמוד. אין localStorage/sessionStorage בעמוד (StatisticsModal בלבד: מפתח למעלה). state בלבד בזיכרון + `alterationsCache` (מודול).

## ט. הדפסה / ייצוא / AI
- הדפסה: PrintWizardModal → `/print/alterations`, `/print/order`, `/api/pdf`. ייצוא: ExportButtons (אקסל/PDF/CSV/AI, אישור PIN מעל `exportMaxRows`; הרשאה `feature:export_over_limit_approval`). AI: חיפוש חכם `/api/ai/smart-search` + סטטיסטיקות.

## י. מחרוזות (מלאי)
כותרת: "תפירות ותיקונים"; "סה״כ תיקונים תואמים: N"; "סמן יום כבוצע" (title: "סמן את כל התפירות של היום שנבחר כבוצעו"); titles: "אשף הדפסה", "מקרא", "סינון לפי טווח תאריכי אירוע", "נקה", "חיפוש חכם (AI)", "שאלות סטטיסטיקה", "ניקוי חיפוש", "הצג הכל", "ממתינים", "בוצע", "כרטיס הזמנה", "סמן שבוצע", "עמוד קודם/הבא", "סגירה"; כפתורים: "חיפוש", "חפש בחכמה", "מייצר שאילתה...", "הכל", "ממתינים", "בוצע", "הקודם", "הבא", "הבנתי"; עמודות: תאריך אירוע / לקוח / דגם שמלה / מידה / פירוט תיקונים / סטטוס; badges: "בוצע"/"ממתין"; foot: "סה״כ מוצג בעמוד: N · סה״כ תיקונים תואמים: M", "עמוד … מתוך N"; מקרא: "מקרא צבעים", "כתום / ממתין: התיקון טרם בוצע.", "ירוק / בוצע: התיקון בוצע בהצלחה."; שגיאות/אישורים ר' סעיף ו/ה.

## יא. Risk notes
- `page` לא מתאפס בשינוי `startDate/endDate/filterStatus` — קיים; ריסטייל לא לתקן/לשנות.
- אפקט טעינה תלוי גם ב-`totalPages` (מעורר טעינה חוזרת + prefetch); אל תעביר state לרכיב אחר בלי לשמר את מערך התלויות.
- `markDone` משנה `items` ישירות ולא cache/`totalCount`.
- `mounted` נדרש ל-portal של המקרא (SSR). `showStatistics` הוא boolean או `{x,y}` — לא לפשט ל-boolean (position).
- מיפוי ExportButtons וה-`fetchForExport` משכפלים נוסחאות תצוגה — כל שינוי תצוגה של שם שמלה/צ'יפים לא חייב להשפיע על הייצוא.
- כפתור "בוצע" נסתר ב-`visibility:hidden` לשמירת יישור עמודת הפעולות — חובה לשמר רוחב.
- inline `onMouseEnter/Leave` מנטרלים hover של שורה — במעבר ל-CSS לוודא צבע סטטוס לא נדרס.
- `.range-flat` על ה-DateRangePicker ו-`alignItems: stretch` — יישור גובה עם סרגל החיפוש.
- `window.customConfirm` / `alert` — הפעולות בפועל תלויות בהחזר boolean; החלפה לחלונית מחייבת שמירת חוזה async.
