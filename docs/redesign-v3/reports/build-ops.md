# דוח בנייה — משפחת ops (תפירות · לוח שנה · משלוחים)

ענף: `redesign/site-v3-pages-ops` (מתוך `redesign/site-v3-2026-09-24`). שכבת תצוגה בלבד (R8).

## קבצים
- `app/alterations/page.js`, `app/board/page.js`, `app/deliveries/page.js` — נבנו מחדש מול ה-kit.
- חדשים (משמשים רק את שלושת העמודים): `components/ops-v3/OpsKit.js` (`TipBtn`, `SearchBar`, `useOpsDialogs`), `components/ops-v3/ops.css` (קידומת `ops-`, tokens `--v3-*` בלבד).
- בקשות: `docs/redesign-v3/requests/ops.md`.
- לא נגענו: app/api, lib, prisma, app/v3, PrintWizardModal, StatisticsModal, RentalReturnModal, ExportButtons, בוררי התאריך.

## צ'קליסט חוזה
### תפירות
- [x] כל ה-state, useEffect (תלויות `[startDate,endDate,filterStatus,page,search,totalPages]`), prefetch, מטמון SWR, `buildAlterationsListUrl` — ללא שינוי.
- [x] `markDone` / `markAllDone`: אותן קריאות POST (`{orderItemId}` / `{date:startDate}`), אותו סדר; `window.customConfirm` ← חלונית v3 עם אותו await; `alert` ← חלונית הודעה.
- [x] `markAllDone` משתמש רק ב-`startDate`; כפתור מנוטרל בלי `startDate`.
- [x] טאבי סטטוס לא מאפסים `page`; בורר הטווח לא מאפס `page`.
- [x] `#alterationsListPageNum` (id + min/max + parseInt) נשמר; פאגר מוצג רק אם `totalPages>1`.
- [x] `showStatistics` נשאר bool/`{x,y}`; `mounted` נשאר (מקרא).
- [x] כפתור "בוצע" נסתר ב-`visibility:hidden` לשמירת רוחב; צבעי שורה לפי סטטוס (פס בצד + רקע).
- [x] ExportButtons: אותם `data`/`columns`/`filename`/`onFetchData`; נוסחאות תצוגה (שם שמלה, צ'יפים) זהות בתנאים.
- [x] PrintWizardModal: אותם props (`defaultStartDate/EndDate/getCurrentOrderIds`).
### לוח שנה
- [x] fetch חודשי + AbortController + `activeOrdersRequestRef` + מפתח מטמון `buildBoardMonthParams` + `isAiModeActive` — ללא נגיעה.
- [x] קטגוריות (`getOrderCategory`), איחור (>2 ימים), קיבוץ `en-CA`, פרשה ב-`j===6`, חגים — ללא שינוי; חצי חודש קודם/הבא (`chevron-end`/`chevron-start`) נשמרו.
- [x] "לקוח:" בפופאובר — תווית בלבד בלי ערך (quirk נשמר). `highlightedDate` — קוד מת נשמר.
- [x] פופאובר ריחוף: `position:fixed`, `pointer-events:none`, מעל הכול. תפריט פעולות: מעוגן ב-`top/left` של הכרטיס, שכבת סגירה, נפתח מעל חלונית היום; "כרטיס השכרה" סוגר את חלונית היום.
- [x] חיפוש מתקדם: `advFilters` חל מיידית (כמו קודם); "החל" רק סוגר / מפעיל AI; `#board-adv-ai-mode` + `.ai-feature-element` נשמרו.
- [x] `printDayOrders` עם `batch=1`; הגדרות (`enable_alterations`, `hide_custom_spacing`, `enable_batch_print_prep`) — הופעה מותנית.
### משלוחים
- [x] קריאות: `/api/settings`, `/api/deliveries?date=` × N עם דגל `cancelled`, POST courier-email (גוף זהה) — ללא שינוי. תאריכים מקומיים.
- [x] `openPrintModal` מאפס from/to/bagDate; `emailSending` נועל סגירה (ביטול, Esc, רקע).
- [x] `renderDeliveryRow` + `tableHead` משותפים לטבלה הראשית ולטבלאות הטווח.
- [x] ExportButtons ללא `onFetchData`; תוויות הייצוא (`DIRECTION_META.label`, "נוצר חיוב"/"טרם נוצר חיוב") ללא שינוי.

## שכתובי מלל בולטים
| היה | עכשיו |
|---|---|
| מקרא צבעים / "כתום = ממתין…" | "מקרא" + שורות עם פס צבע |
| "בקש מה-AI למצוא נתונים…" / "חפש בחכמה" | "תארו מה לחפש…" / "חיפוש חכם" |
| "מושכר/חלקית", "הזמנה פגומה (0 פריטים)" | "בהשכרה" (הסבר ב-Tip), "הזמנה ריקה" |
| "הדפסת משלוחים" (כפתור + חלונית) | "הדפסה ושליחה" |
| "נשלח בהצלחה ל-…" / "שגיאה בשליחת המייל" | "המייל נשלח אל …" / "שליחת המייל נכשלה" (מוצגים בלבד) |
| alerts | חלוניות: "החיפוש החכם לא הצליח", "העדכון נכשל", "אין תקשורת עם השרת" |

מחרוזות ייצוא, מפתחות API וטקסטים שנשלחים כנתונים לא שונו.

## חלוניות
- אישור/מקרא/הודעות/תוצאות גלובליות — `Dialog` כהה+בהיר לפי `data-theme` (`dlgMode()`).
- חיפוש מתקדם, הזמנות ליום, הדפסה ושליחה (משלוחים) — `variant="form"` בהיר בלבד.

## התראות (§4)
- תפירות: `enqueueNotice` (`persistToBell:false`, בתוך try/catch, אחרי נתיב ההצלחה) ב-`markDone` וב-`markAllDone`.
- לוח שנה ומשלוחים: אין פריטים ב-§4 (אין כתיבה / ניווט אחרי כתיבה). מייל למשלוחן ממשיך להציג תוצאה בתוך החלונית.

## סטיות / החלטות
1. תפירות: עמודת "מידה" אוחדה לתא "שמלה" (צ'יפ מתחת לשם) — R16 טבלה מינימלית; `colSpan` 6 במקום 7.
2. משלוחים: 7 עמודות ← 5 (כתובת/דגמים/אירוע נשארו; הזמנה+טלפונים בתוך "לקוח"; כיוון+חיוב בתוך "משלוח", שורה לכל כיוון).
3. משלוחים: ה-X של חלונית ההדפסה הוסר (ביטול + Esc + רקע, כולם חסומים בזמן שליחה) — REQ-4.
4. פופאובר לוח שנה: שורת תווית+ערך (לא תווית מעל ערך) כי 11 שורות במאונך גבוהות מדי; כל נתון בשורה נפרדת.
5. כפתורי-איקון קטנים בלוח: 44px (REQ-1). כרטיס הזמנה בתא עדיין ללא ניווט מקלדת (כמו במקור) — לא נוסף כדי לא לשנות התנהגות.
6. Tip בכפתורי כותרת/חיפוש; בשורות טבלה ובתאי לוח נשארו `title` + `aria-label` (עשרות Tip = כבד).

## ספקות
- לא הורצה בדיקה חזותית בדפדפן (אין node_modules/DB בעץ העבודה; ESLint רץ נקי — רק אזהרות שהיו קודם). מומלץ בדיקת RTL עם `getBoundingClientRect` על רשת הלוח (7 עמודות) ועל תפריט הפעולות.
- בורר התאריך בתוך `Dialog` (z-index 100000 משלו) — Esc בחלונית עלול לסגור אותה כשהבורר פתוח.
- הפופאובר/תפריט הפעולות משתמשים ב-`--v3-z-tip`/`--v3-z-menu` (מעל חלוניות ה-Dialog), אך מתחת ל-StatisticsModal / RentalReturnModal הישנים (z גבוה משלהם).
