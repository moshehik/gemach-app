# חוזה עמוד: משלוחים — `/deliveries`

מקור: `app/deliveries/page.js` (481 שורות) + `layout.js`. API: `app/api/deliveries/route.js`, `app/api/deliveries/courier-email/route.js`.

## א. מטרה והרשאות
- תצוגת הזמנות עם משלוח הלוך/חזור ליום נבחר (או טווח), חיפוש/סינון מקומי, פילוח לפי עיר, ייצוא, והדפסה/שליחה למשלוחן / נתוני שקית.
- גישה: `layout.js:6` `<PageGate pageKey="page:deliveries">` (`permissionsMetadata.js:223`; ברירת מחדל: הנהלה ראשית/מתכנת). ה-API דורש `checkAuth` (courier-email: `courier-email/route.js:19`).
- אין שימוש ב-pageCache/apiCache/prefetch (כל fetch עם `cache:'no-store'`).

## ב. אזורים לפי סדר
1. `page-head`: `h1` "משלוחים" + "סה״כ רשומות: N/..." ; actions: "הדפסת משלוחים", `ExportButtons` (איקון).
2. toolbar ניווט תאריך: חץ יום קודם, "היום", חץ יום הבא, `HebrewDatePicker` (רוחב 260), רמז (רק `byEventDate`).
3. toolbar חיפוש חופשי.
4. `pill-tabs` כיוון: הכל / משלוח הלוך בלבד / משלוח חזור בלבד.
5. `pill-tabs` טווח (רק `rangeEnabled`): יום אחד / שבוע / שבועיים / חודש.
6. כרטיס "פילוח לפי ערים" (אם `!loading && cityBreakdown.length>0`).
7. תצוגת טווח (אם `rangeEnabled && rangeMode!=='day'`): `h3` + כרטיס+טבלה לכל יום שיש בו שורות.
8. טבלה ראשית (יום נבחר) + table-foot.
9. חלונית "הדפסת משלוחים" (portal).

## ג. שדות
| תווית | state | פורמט/ולידציה | שורה |
|---|---|---|---|
| בורר תאריך (HebrewDatePicker) | `selectedDate` (ברירת מחדל `todayIso()` מקומי, `YYYY-MM-DD`) | `onChange=setSelectedDate` | 56, 291 |
| חיפוש "חיפוש (הזמנה, לקוח, טלפון)..." | `search` → `debouncedSearch` (`hooks/useDebounce`, 300ms) | סינון מקומי: `orderId` includes, `customerName`, `customerPhone`, `customerPhone2`, `address` (lowercase; `trim`) | 58-59, 157-171, 300-305 |
| סינון כיוון | `directionFilter` `all\|out\|return` | מקומי; משפיע גם על עמודות מוצגות ועל cityBreakdown | 57 |
| מצב טווח | `rangeMode` `day\|week\|2weeks\|month` | ימים: 1/7/14/30 | 63, 132-134 |
| חלונית: סוג פעולה | `printAction` `courier-print\|courier-email\|bag-label` | טאבים | 73, 435-437 |
| חלונית: כיוון | `printDirection` `both\|out\|return` (ברירת `both`) | מוצג רק כש-`printAction!=='bag-label'` | 74, 447-454 |
| חלונית: טווח תאריכים | `printFrom`,`printTo` (מאותחלים ל-`selectedDate` בכל `openPrintModal`) | `HebrewDateRangePicker` | 75-76, 455-458 |
| חלונית: תאריך שקית | `printBagDate` | `HebrewDatePicker`; label משתנה עם `byEventDate` | 77, 441-444 |
- state נוספים: `loading`, `rows`, `rangeRows` (date→rows), `rangeEnabled`, `byEventDate`, `emailSending`, `emailResult {ok,message}`, `showPrintModal`.

## ד. כפתורים / פעולות
- "הדפסת משלוחים" (257): `openPrintModal('courier-print')` — מאפס from/to/bagDate ל-`selectedDate`, מנקה `emailResult`.
- ‹ יום קודם / "היום" / יום הבא › (283-289): `goPrevDay/goToday/goNextDay` (`addDaysToIso` מקומי; לא UTC).
- ניקוי חיפוש X (307, כש-`search`): `setSearch('')`.
- טאבי כיוון (318-326) וטווח (331): setters ישירים.
- לינק `#orderId` → `/orders/{orderId}` (202).
- חלונית: טאבי פעולה (מאפסים `emailResult`), טאבי כיוון, "ביטול", "הדפסה"/"שליחה" (`submitPrintModal`), X (disabled בזמן שליחה), backdrop click סוגר רק אם `!emailSending` (424).
- `submitPrintModal` (90-118):
  - `bag-label` → `window.open('/print/delivery-bag?date=${printBagDate}','_blank')` + סגירה.
  - `courier-print` → `window.open('/print/delivery-courier?direction=&from=&to=','_blank')` + סגירה.
  - `courier-email` → POST (למטה); החלונית נשארת פתוחה ומציגה `emailResult` (ירוק/אדום).
- **ExportButtons** (261-277): `data=exportData` (filteredRows + `directionsLabel`, `dressModelsLabel`, `dispatchLabel`, `chargeStatusLabel`), `filename="משלוחים"`, עמודות: orderId, customerName, customerPhone, customerPhone2, address, eventDateHebrew, dressModelsLabel, directionsLabel, (`dispatchLabel` "יציאה/איסוף" רק כש-`byEventDate`), chargeStatusLabel; `iconOnly`; **ללא** `onFetchData` (מייצא את מה שבזיכרון, מוגבל ל-exportLimit).

## ה. קריאות רשת
| # | שיטה+URL | trigger | גוף | שימוש | cache |
|---|---|---|---|---|---|
| 1 | `GET /api/settings` (`cache:'no-store'`) | mount (120-126) | — | מפתחות: `delivery_table_range_enabled==='true'`→`rangeEnabled`; `deliveries_select_by_event_date==='true'`→`byEventDate`; שגיאה מושתקת | none |
| 2 | `GET /api/deliveries?date=YYYY-MM-DD` × N (N=1 או 7/14/30 ב-`Promise.all`, ימים עוקבים מ-`selectedDate`) | useEffect על `[selectedDate,rangeMode,rangeEnabled]` (128-153), עם דגל `cancelled` | — | `data.data` לכל יום → `rangeRows`; `rows=map[selectedDate]`; שגיאה ליום → `[]`; שגיאה כללית → `rows=[]` | `no-store`, אין |
| 3 | `POST /api/deliveries/courier-email` | `submitPrintModal` במצב email | `{direction:printDirection, fromDate:printFrom, toDate:printTo}` | הצלחה: `נשלח בהצלחה ל-${data.sentTo}`; כשל: `data.error` או 'שגיאה בשליחת המייל' | — |
- צורת שורה מה-API: `orderId, customerName, customerPhone, customerPhone2, address, city, dressModelNames[], eventDateHebrew, directions[] ('out'/'return'), chargeExists{out,return}, dispatchDates{out,return}` (dispatchDates רק כש-`deliveries_select_by_event_date` דולקת).
- שגיאות שרת ל-email: "טווח תאריכים לא תקין", "מערכת המשלוחים כבויה בהגדרות הניהול", "לא הוגדרה כתובת מייל למשלוחן… (courier_email)", "אין משלוחים בטווח/כיוון שנבחרו - לא נשלח מייל" (SystemSetting: `courier_email`, הגדרת הפעלת משלוחים).

## ו. חלוניות
- חלונית "הדפסת משלוחים" (`createPortal`, גארד `typeof document!=='undefined'`, z-index 2000, max 480px): head כותרת + X; body: טאבי פעולה, תוכן לפי פעולה, `emailResult`; foot: ביטול / כפתור ראשי (spinner + "שולח..." בזמן שליחה). כל הפקדים disabled בזמן `emailSending`.
- אין confirm/alert/toast בעמוד. תאריכי HebrewDatePicker/RangePicker: רכיבים פנימיים בעלי popover משלהם.
- ExportButtons: חלונית ייצוא משלו (ר' alterations.md סעיף ה/ט).

## ז. מצבים
- loading: שורת טבלה `colSpan=7` "טוען נתונים..." ; ספירה מציגה "...".
- empty: `empty-state` עם `h4` + `p` שונים לפי `byEventDate` (ראו י).
- setting-driven: `byEventDate` (רמז בסרגל, כותרות "אירועים ב-", label חלונית, עמודת ייצוא, שורת `dispatchDates` "יוצא/נאסף <יום שבוע> <תאריך>" בעמודת כיוון), `rangeEnabled` (טאבי טווח + תצוגת טווח).
- עמודות טבלה (7): לקוח (שם + טלפונים `dir=ltr`), הזמנה (לינק), כתובת, דגמים (join ", "), תאריך אירוע (`eventDateHebrew`), כיוון משלוח (badge warning "משלוח הלוך"/info "משלוח חזור" לכל כיוון גלוי), חיוב משלוח (badge success "נוצר חיוב" / hint "טרם נוצר חיוב" לכל כיוון גלוי).
- תצוגת טווח: כותרת יום `formatRangeDayHeader` = לועזי + (עברי) ; ימים ריקים מדולגים; **הטבלה הראשית תמיד מוצגת גם בטווח** (ליום הנבחר).
- cityBreakdown: בטווח — כל הימים אחרי סינון כיוון (בלי חיפוש); ביום — `filteredRows`; עיר ריקה → "לא ידוע"; ממויין יורד.
- ספירה בכותרת/פוטר = `filteredRows.length` (יום נבחר בלבד).

## ח. URL / storage
- אין query params, אין localStorage/sessionStorage. יעדי פתיחה: `/print/delivery-bag?date=`, `/print/delivery-courier?direction=&from=&to=`.

## ט. הדפסה/ייצוא/AI
- הדפסה למשלוחן, שליחה במייל, נתוני שקית; ייצוא דרך ExportButtons. אין AI ייעודי בעמוד.

## י. מחרוזות
"משלוחים"; "סה״כ רשומות: N"; "הדפסת משלוחים"; "יום קודם", "היום", "יום הבא"; "מוצגים משלוחים להזמנות שתאריך האירוע שלהן הוא התאריך שנבחר"; "חיפוש (הזמנה, לקוח, טלפון)...", "נקה חיפוש"; "הכל", "משלוח הלוך בלבד", "משלוח חזור בלבד"; "יום אחד/שבוע/שבועיים/חודש"; "פילוח לפי ערים:", "לא ידוע"; "טבלת משלוחים לטווח (שבוע/שבועיים/חודש)", "אירועים ב-", "N משלוחים"; עמודות: לקוח/הזמנה/כתובת/דגמים/תאריך אירוע/כיוון משלוח/חיוב משלוח; "נוצר חיוב"/"טרם נוצר חיוב"; "יוצא"/"נאסף"; "טוען נתונים..."; "אין משלוחים ליום זה"/"אין משלוחים לאירועים ביום זה" + "לא נמצאו הזמנות עם משלוח הלוך או חזור בתאריך שנבחר." / "…שתאריך האירוע שלהן הוא התאריך שנבחר."; חלונית: "הדפסה למשלוחן", "שליחה במייל", "הדפסת נתונים לשקית", "כיוון משלוח", "הלוך וחזור", "הלוך בלבד", "חזור בלבד", "טווח תאריכים"/"טווח תאריכי אירוע", "תאריך (משלוחי הלוך בלבד)"/"תאריך אירוע (משלוחי הלוך בלבד)", "ביטול", "שליחה", "הדפסה", "שולח...", "נשלח בהצלחה ל-…", "שגיאה בשליחת המייל", "סגירה".

## יא. Risk notes
- `renderDeliveryRow` משותפת לטבלה הראשית ולטבלאות הטווח; שינוי מבנה עמודות חייב להתעדכן בשני ה-`thead`.
- סינון חיפוש/כיוון מקומי; `visibleDirections` משפיע על תצוגה וייצוא — לא להעביר לשרת.
- תאריכים מקומיים (`todayIso`/`addDaysToIso`), לא UTC — לא להחליף ב-`toISOString`.
- דגל `cancelled` באפקט מונע race בין ניווטי תאריך; שמור.
- `printFrom/To/BagDate` מאותחלים ב-`openPrintModal`, לא ב-state initial בלבד.
- `emailSending` נועל סגירה בכל 3 נתיבים (X, ביטול, backdrop).
- `window.open` בלי `noopener` — התנהגות קיימת.
- `dir="ltr"` + `textAlign:start` לטלפונים (RTL).
- ExportButtons ללא `onFetchData` — לא להוסיף.
