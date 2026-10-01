# לו״ז יומי — שכבת הנתונים והלוגיקה (שלב 1: קריאה בלבד)

**מצב (2026-10-01, אחרי סקירה עצמאית + החלטות הבעלים מדף "שאלות פתוחות"):** `GET /api/schedule?date=YYYY-MM-DD[&branch=…]` + `lib/schedule/*` — קריאה בלבד. אין UI, אין "סימון בוצע" (שלב 2 של הבנייה), אין שינוי סכימה, אין זריעת הגדרות.
**מקור האמת להחלטות:** `scratch/schedule-build/DECISIONS-לוז-יומי.md` (מחוץ לריפו), כולל הסעיף "החלטות מדף שאלות פתוחות" (A1–A7, B1–B5) **שמעדכן** החלטות קודמות (B01 → B1). מיפוי הנתונים הקיימים: `scratch/schedule-build/INVENTORY-stage-data.md`. סקירה: `REVIEW-WP1-data-layer.md`; תיקונים: `REPORT-WP1-fixes.md`.
**ענף:** `feature/schedule-data-layer-2026-10-01` (לא נדחף, לא PR).

### מה השתנה בסבב התיקונים (1.10.2026)
| # | שינוי | איפה |
|---|---|---|
| סקירה 1 | טיוטות (עגלה שנשמרה אוטומטית) מסוננות גם בשלבים 5/9 — אפשרות `excludeDrafts` ב-`getDeliveriesForDate` (ברירת מחדל כבויה: `/api/deliveries` לא השתנה), הלו״ז מעביר `true`. | `lib/deliveries.js`, `lib/schedule/loaders.js` |
| סקירה 4 | `date` תקין בצורתו אבל רחוק (למשל `9999-12-31`) → 400 בעברית ולא 500. טווח: ±3 שנים מהיום הישראלי (`MAX_YEARS_FROM_TODAY`). | `lib/schedule/dates.js` (`isWithinReasonableRange`), `lib/schedule/index.js` |
| סקירה 5 | "מי במשמרת" ליום עתידי/עבר — בלי משמרות פתוחות של היום; הסעיף "פתוחה מאתמול" רק כש-`date` = היום. | `lib/schedule/loaders.js` (`loadStaffOnShift`) |
| סקירה 6 | שורת שלב 1 נושאת `totalAmount` ו-`isPaid` (עמודות קיימות, בלי שאילתה נוספת). "יתרה לתשלום" עצמה דורשת את `Payment` — לא נטען (ר' "החלטות ברירת מחדל" 12). | `lib/schedule/loaders.js` |
| B1 | `page:schedule` **סגור כברירת מחדל** כמו שאר הדפים (היפוך). | `lib/permissionsMetadata.js` |
| B4 | `schedule_skip_chag_all_stages` ברירת מחדל **פעיל** → גם החזרה ידנית (8) מדלגת חג וערב חג. משלוחים (5/9) — ר' "ימי עסקים". | `lib/schedule/settings.js` |
| A3 | שלב 8 מחזיר `dressCount` (כבר היה בשורה הבסיסית; עכשיו מתועד ונבדק). | — |
| A4 | `returnCondition` (`ok`/`not_ok`/`null`) גם בשלב 9 (מהפריטים שכבר נטענים ב-`getDeliveriesForDate`). | `lib/deliveries.js`, `lib/schedule/loaders.js` |
| A7 | הזמנות שלא שולמו מופיעות (לא היה סינון; עכשיו מתועד ונבדק). | — |
| ערב חג | `isChagDay` מסמן גם ערב חג — **מכוון** (החלטת הבעלים), לא באג. נוסח התיעוד והבדיקה עודכנו. | `lib/schedule/dates.js`, `scripts/schedule-tests/dates.test.mjs` |

## קבצים

| קובץ | תפקיד |
|---|---|
| `lib/schedule/stages.js` | הגדרות 8 השלבים (1,2,4,5,6,7,8,9 — שלב 3 "העברה בין סניפים" **לא קיים**, החלטה A1: אין לו מפתח, הגדרה או קבוע בשום מקום בקוד; בדיקה: "A1: nothing in the stage catalog refers to stage 3"), ברירות מחדל ל-offset/לוח/שדה "בוצע". |
| `lib/schedule/dates.js` | מפתחות ימים ישראליים (`YYYY-MM-DD`), חלונות יום (`getIsraelDayRange`), ימי עסקים לשני הכיוונים כולל חג. ללא תלות באזור הזמן של השרת. |
| `lib/schedule/settings.js` | קריאת `SystemSetting` (דרך `lib/settingsCache.js`) עם ברירות מחדל שאינן משנות התנהגות. |
| `lib/schedule/loaders.js` | השליפות: 4 שאילתות ליום (+1 לשמות דגמים). בלי N+1. |
| `lib/schedule/alerts.js` | התראות שורה. |
| `lib/schedule/index.js` | `getScheduleDay({date, branch, user})` — מרכיב הכל ל-JSON. |
| `app/api/schedule/route.js` | GET בלבד: `checkAuth()` + `canOpenPage('page:schedule')`, `maxDuration = 30`, `Cache-Control: no-store`. |
| `lib/permissionsMetadata.js` | פריט קטלוג חדש `page:schedule` (סגור כברירת מחדל כמו שאר הדפים — ר' "הרשאות"). |
| `lib/deliveries.js` | תוספת בלבד: אפשרויות `byDispatchDate`/`includeInternalNotes`/`excludeDrafts` ושדות `street`, `dressCount`, `branch`, `pickupBranch`, `returnCondition`, דגלי חו״ל ועוד לכל שורה. בלי אפשרויות — ההתנהגות של `/api/deliveries` זהה לקודם (כולל הצגת טיוטות שם — שינוי זה דורש אישור נפרד). |
| `lib/apiCache.js` | `/api/schedule` מתיישן אחרי כל כתיבה ב-`/api/rentals`, `/api/returns`, `/api/orders`, `/api/alterations`, `/api/deliveries`. |
| `scripts/schedule-tests/` | בדיקות ללא DB (מוק בזיכרון), מורצות ב-3 אזורי זמן: `node scripts/schedule-tests/run.mjs`. |

## כלל "שייך ליום X" לכל שלב

כל התאריכים = ימים קלנדריים בישראל. `eventDate` נשמר לפעמים כחצות UTC ולפעמים כחצות ישראלית (21:00Z/22:00Z) — שתי הצורות מטופלות (`instantToKey` + `getIsraelDayRange`).
"תאריך התחלה אפקטיבי" (B21): הזמנת חו״ל/אמצע שבוע → `fromDate` (נופל ל-`eventDate`); אחרת `eventDate`. `extraDay` כבר מוטמע ב-`fromDate/toDate`; `customSpacing` לא מזיז תאריכים (מלאי בלבד) — שניהם מוחזרים כדגלים בלבד.

| # | שלב | מקור | כלל | ימי עסקים | שדה "בוצע" |
|---|---|---|---|---|---|
| 1 | הזמנה (מידע) | `Order.orderDate` | נרשמה ביום X (לפי שעון ישראל). **"אותו יום" בלבד — אין "ימים מהאירוע" לשלב 1 ואין מפתח `schedule_stage_order_days` (החלטה A2).** הזמנות שעוד לא שולמו **כן מופיעות** — אין סינון לפי `isPaid`/סטטוס, רק טיוטה/מחוקה (החלטה A7). השורה נושאת `totalAmount`, `isPaid`. | — | אין (החלטה) |
| 2 | תיקונים | `Order` + `OrderItem` עם תיקון (`neck>0` / `sleeve>0` / `length` לא ריק ולא `'null'`/`'0'` — כמו `/api/alterations`) | התחלה אפקטיבית = X + `schedule_stage_repair_days` ימי עסקים לפני (ברירת מחדל **0** = יום האירוע, כמו מסך התיקונים) | שישי/שבת/חג | `alterationDone` (פריט); שורה "בוצע" = כל פריטי התיקון |
| 4 | הכנה | `Order` (+`DressItem.location/inRepair`) | 3 ימי עסקים לפני האירוע (= `getPrintPrepDate`, אומת על 90 ימים רצופים) | שישי/שבת/חג | **אין** (G1) |
| 5 | משלוח הלוך | `getDeliveriesForDate(X, {byDispatchDate:true, excludeDrafts:true})` | יום היציאה של השליח = אירוע − `delivery_days_before` (או 1 כש-`deliveryOneDayBefore`), `delivery_skip_weekends` כקיים. גם כש-`deliveries_select_by_event_date` דולק (נווה יעקב) הלו״ז שואל "מה השליח עושה היום". טיוטות מסוננות (סקירה, ממצא 1). | לפי הגדרות המשלוחים (ללא חג — ר' "ימי עסקים") | **אין** (G1) |
| 6 | איסוף מקומי | `Order` שאינו משלוח הלוך (`!isDelivery` או כיוון `'חזור'`) | 2 ימי עסקים לפני האירוע (= "קבלת השמלות" בדף ההזמנה) | שישי/שבת/חג | `isTaken`‖`takenDate` (כל הפריטים) — ר' Q1 |
| 7 | אירוע (מידע) | `Order` | התחלה אפקטיבית = X, או תקופת חו״ל/אמצע-שבוע (`fromDate..toDate`) שמכילה את X | — | אין (החלטה) |
| 8 | החזרה ידנית | `Order` שאינו משלוח חזור | מועד ההחזרה הצפוי = `toDate` ‖ `returnDate` ‖ אירוע + 1 יום עסקים (`schedule_stage_manret_days`). השורה נושאת `dressCount` (כמות בלבד, בלי דגמים — A3/B05) ו-`returnCondition` (A4). | שישי/שבת **וחג (כולל ערב חג)** — ברירת המחדל של B4; עם `schedule_skip_chag_all_stages='false'` חוזר לשישי/שבת בלבד (כמו `lib/lateReturn.js`) | `isReturned`‖`returnDate` (כל הפריטים) + מצב `ok`/`not_ok` |
| 9 | משלוח חזור | `getDeliveriesForDate(X, {byDispatchDate:true, excludeDrafts:true})` | יום האיסוף = אירוע + `delivery_days_after`. טיוטות מסוננות. השורה נושאת `returnCondition` (`ok`/`not_ok` אחרי שכל הפריטים הוחזרו, אחרת `null` — A4). | לפי הגדרות המשלוחים (ללא חג — ר' "ימי עסקים") | **אין** (G1) |

הזמנות מסוננות תמיד: `isDeleted=false`, ולא טיוטה דרך `{ OR: [{status:null},{status:{not:'טיוטה'}}] }` (אף פעם לא `notIn`/`<>` על `status`). הזמנה בלי פריטים פעילים לא נכללת בשלבים 2/4/6/7/8.

### ימי עסקים
`addBusinessDays(key, n, {skipChag})` ב-`lib/schedule/dates.js` — שני הכיוונים, מדלג שישי/שבת, ועם `skipChag` גם יום טוב (`isChagDay` הקיים, לא חול המועד). **ב-`lib/hebrewDate.js` יש רק אחורה-עם-חג (`subtractSkippingWeekendsAndChag`) ו-`addDaysSkippingWeekends` בלי חג; "קדימה כולל חג" לא היה קיים ונוסף כאן.** `sourceKeysForDay(day, offset)` מחזיר את כל תאריכי האירוע שנוחתים על יום נתון (אירועים בשישי/שבת/ראשון → הכנה בחמישי) — שאילתה אחת על הטווח המאוחד וסיווג ב-JS.

**לוח לכל שלב — החלטה B4 (1.10.2026): דילוג על חג בכל השלבים.** `schedule_skip_chag_all_stages` הוא **פעיל כברירת מחדל** (שורה חסרה = `'true'`): תיקונים (2), הכנה (4), איסוף (6) **והחזרה ידנית (8)** מדלגים שישי, שבת וחג. זה שינוי התנהגות לעומת `lib/lateReturn.js` (שישי/שבת בלבד) — בלו״ז בלבד; `lib/lateReturn.js` עצמו (איחורים בכרטיס ההזמנה/`/api/orders/overdue`) לא שונה. `'false'` מחזיר כל שלב ללוח הקיים שלו (`skipChagDefault` ב-`stages.js`).

> **ערב חג = יום לא עובד (החלטת הבעלים, 1.10.2026: "הגמ"ח לא עובד בערב חג").** `isChagDay` ב-`lib/hebrewDate.js` מסמן גם את ערב החג כיום חג (`HebrewCalendar.calendar({start: day, end: next})` כולל את שני הקצוות). **זו ההתנהגות הרצויה — לא באג, לא לתקן ולא להציע לתקן.** היא חלה על הלו״ז (כל השלבים עם `skipChag`, וגם `dayFlags.isChag`), על "הכנות להיום" בהדפסה (`getPrintPrepDate`) ועל מועד "קבלת השמלות" בדף ההזמנה ובמייל (`subtractSkippingWeekendsAndChag`). דוגמאות (תשפ"ז): א' 20.9.2026 ערב יום כיפור, ד' 21.4.2027 ערב פסח, ה' 10.6.2027 ערב שבועות — ימים לא עובדים. חול המועד שאינו ערב חג (למשל 5.4.2026) נשאר יום עבודה. בדיקה שמקבעת זאת: `scripts/schedule-tests/dates.test.mjs` ("erev chag is a NON-working day").

**משלוחים (5/9) — פער מול B4, לא נסגר כאן:** תאריכי המשלוח (יום יציאה/איסוף של השליח) מחושבים ב-`lib/deliveries.js` לפי `delivery_skip_weekends` בלבד, בלי חג, וחלון יחיד "תאריך ± ימים" (לא חיפוש כמו `sourceKeysForDay`). הקוד הזה משותף לדף המשלוחים, להדפסות השליח ולמייל לשליח בשני הגמ"חים. הוספת דילוג חג שם היא שינוי התנהגות בדף המשלוחים (ולא רק בלו״ז) ודורשת גם טיפול בא-סימטריה של החלון היחיד (אירוע מיד אחרי חג/ערב חג לא היה נמצא בחלון "היום + ימים"). לכן `stages[5|9].skipChag` מדווח `false` — מה שחל בפועל — גם כשההגדרה פעילה. **שאלה פתוחה לבעלים/לשלב הבא:** להחיל חג גם על דף המשלוחים (שינוי ב-`lib/deliveries.js` עם חיפוש דו-כיווני) או להשאיר.

## התראות שורה (S09)

| קוד | טקסט | מתי |
|---|---|---|
| `late_not_done` | באיחור - לא סומן כבוצע | שלב 8: `today − X ≥ late_return_threshold_days` (7) ולא הוחזר (B15/JDG-03). שלבים 2, 6: X כבר עבר ולא סומן. שלבים 4, 5, 9: **אין** (אין שדה "בוצע"). שלבים 1, 7: אין. |
| `missing_delivery_address` | חסרה כתובת משלוח | שלבים 5, 9: חסר רחוב **או** חסרה עיר (`deliveryAddress`/`deliveryCity` ואז כתובת הלקוחה). |

## הגדרות (`SystemSetting`, קריאה בלבד — לא נזרעו)

קיימות ונקראות: `enable_deliveries` (מכבה 5/9), `enable_alterations` (`'false'` מכבה 2), `branches_enabled`, `late_return_threshold_days`, `standard_pickup_hours`, `delivery_*` (בתוך `lib/deliveries.js`).
חדשות (שורה חסרה = ברירת המחדל): `schedule_stage_<key>_enabled` (`'false'` מכבה), `schedule_stage_<key>_days` (repair/prep/pick/manret, גודל בימי עסקים, 0–60), `schedule_stage_<key>_shift` (`none`/`am`/`pm`/`all` — תגית בלבד, S08), `schedule_skip_chag_all_stages`, `schedule_max_scan_rows` (3000).
כשייווצרו: בשני ה-DB בו-זמנית, לרשום ב-`lib/settingsMetadata.js` (`SETTINGS_HEBREW_NAMES`/`NOTES`/`ORDER`/`BOOLEAN_KEYS`/`NUMBER_KEYS`) ו-`app/lib/settingsValidation.js`.
**החלטה B3 — מי כותב הגדרות שלבים:** רק הנהלה ראשית. בשלב זה אין שום כתיבה (הנתיב הוא GET בלבד); כשייבנה מסך ההגדרות של השלבים, הכתיבה תעבור שער `isHeadManagement` (כמו `/admin/settings`), לא `page:schedule`.
**החלטה A2:** אין מפתח `schedule_stage_order_days` — שלב 1 אינו `offsetConfigurable` וערך כזה, אם ייכתב, מתעלמים ממנו (בדיקה: "A2: stage 1 has no days from event").

## הרשאות

- API: `checkAuth()` (401) ואז `canOpenPage('page:schedule')` (403) — אותו דפוס כמו `app/api/a5/adv-b/route.js`. עובד לא פעיל: עובר התחברות (התנהגות קיימת של `checkAuth`) ונחסם בשער העמוד (403).
- `page:schedule` ב-`PERMISSION_CATALOG` עם `defaultForRoleId: () => false` — **סגור כברירת מחדל כמו כל שאר עמודי `page:*` (מדיניות 2026-09-22), לפי החלטת הבעלים B1 (1.10.2026, "כמו בשאר הדפים"; מחליפה את B01 "כולם").** בלי שורת הרשאה רק הנהלה ראשית/מתכנת (`ALWAYS_ALLOWED_ROLE_IDS`) נכנסים; כל גישה אחרת נקבעת בשורת `DepartmentPermission`/`EmployeePermissionOverride` ב-`/admin/permissions` (יש ליצור שם שורה; הטבלאות לא נזרעות). **לפני שה-UI יעלה: ליצור שורות `page:schedule` למחלקות הרלוונטיות בשני הגמ"חים**, אחרת אף עובדת לא תראה את הדף. בדיקות: `route.test.mjs` ("CLOSED by default", "403 for a department WITHOUT any page:schedule row").
- אורח (בלי התחברות): נכנס רק במצב פתוח (`require_login` כבוי) — כמו כל עמוד (`canOpenPage` מחזיר `checkAuth()` כשאין עוגייה).
- הערות פנימיות (`internalNotes`, B07): מוחזרות רק ל-roleId 0/1/2. אין היום פריט הרשאה ייעודי — ברירת מחדל מתועדת, מועמד ל-`feature:` חדש.
- **סינון סניף — החלטה B2: אין שיוך סניף לעובדת** (בלי שדה חדש, בלי הגבלת סניף לעובדות). לכן אין שום סינון לפי העובד המחובר. `?branch=` הוא **סינון תצוגה אופציונלי בלבד** לפי סניף ההזמנה (`Order.branch`; שלב 6: `pickupBranch` ואז `branch`), פעיל רק כש-`branches_enabled='true'`, לפי בחירה בבקשה. (מבטל את הנוסח "מנהלת סניף/עובדת רואות רק את הסניף שלהן" מ-JDG-04.)

## פורמט התשובה (`GET /api/schedule`)

```jsonc
{
  "date": "2026-10-01", "dateHebrew": "כ תשרי תשפ״ז", "weekday": "יום חמישי",
  "isToday": true, "today": "2026-10-01", "tomorrow": "2026-10-02",
  "dayFlags": { "isFridayOrShabbat": false, "isChag": false },
  "generatedAt": "2026-10-01T06:00:00.000Z",
  "settings": { "deliveriesEnabled": true, "alterationsEnabled": true, "branchesEnabled": true, "branchFilter": null,
                "skipChagAllStages": false, "lateReturnThresholdDays": 7, "pickupHours": "20:00-21:30",
                "deliveryDaysBefore": 1, "deliveryDaysAfter": 1, "includeInternalNotes": true },
  "staff": [ { "employeeId": "…", "name": "רחלי לוי", "entryTime": "…", "exitTime": null, "open": true } ],   // שמות בלבד, בלי שכר
  "stages": [
    { "key": "prep", "number": 4, "label": "הכנה", "plural": "הכנות", "what": "…", "infoOnly": false, "enabled": true,
      "offsetBusinessDays": -3, "skipChag": true, "shift": "none", "shiftLabel": "", "doneSource": null,
      "showModel": true, "showAddress": false,
      "counts": { "total": 2, "done": 0, "pending": 0, "unknown": 2, "alerts": 0 },
      "items": [ /* שורות, ר' למטה */ ] }
  ],
  "totals": { "total": 9, "done": 1, "pending": 4, "unknown": 4, "alerts": 1 },   // בלי שלבי המידע 1 ו-7
  "truncated": false,
  "warnings": [ "לשלב 4 (הכנה) אין עדיין שדה \"בוצע\" במסד - …" ]
}
```

שורה (משותף לכל השלבים):
`orderId`, `stage`, `customer{name, firstName, lastName, phone1, phone2}`, `eventDate` (instant), `eventKey` (`YYYY-MM-DD`), `eventDateHebrew`, `dressCount` (מספר בלבד, B05), `branch`, `pickupBranch`, `flags{isAbroad, isWeekdayEvent, extraDay, customSpacing}`, `notes`, `internalNotes` (לפי הרשאה), `done` (`true`/`false`/`null`=אין מקור), `doneSource`, `alerts[{code, label, daysLate?}]`.
תוספות לפי שלב: 1 — `orderDate`, `registeredBy`, `totalAmount` (מספר/`null`), `isPaid`; 2 — `items[{orderItemId, model, modelPrefix, size, location, inRepair, neckAlteration, lengthAlteration, sleeveAlteration, alterationDetails, done, taken, returned}]`; 4, 7 — `items[{orderItemId, model, modelPrefix, size, location, inRepair}]`; 6 — אותו `items` + `taken`; 5 — `address{street, city, full}`, `dispatchDate`, `chargeExists` (B08), בלי דגם; 9 — כמו 5 + `returnCondition` (`ok`/`not_ok`/`null`, A4); 8 — `address` (מגורים), `dressCount` (A3), `takenCount`, `returnedCount`, `returnCondition` (`ok`/`not_ok`/`null`), `dueKey`, בלי דגם.
`staff`: ליום שהוא "היום" — משמרות שנכנסו היום + משמרות פתוחות שנפתחו עד יממה קודם; ליום אחר — רק משמרות שנכנסו באותו יום (סקירה, ממצא 5).
שגיאות: `400` לתאריך לא תקין או מחוץ ל-±3 שנים מהיום הישראלי (הודעה בעברית ב-`error`), `401` בלי התחברות, `403` בלי הרשאה, `500` רק לשגיאה לא צפויה.
`counts`: `done`/`pending` לפי `done`, `unknown` = שלב בלי מקור "בוצע"; `alerts` = שורות עם התראה אחת לפחות.

## ביצועים
שאילתות ליום: `Order` לפי `orderDate` (אינדקס), `Order` אחת לפי `eventDate`/`fromDate`/`toDate`/`returnDate` על הטווח המאוחד (`take: schedule_max_scan_rows+1` → `truncated`), `getDeliveriesForDate` (אחת), `Shift` (אחת, `take 200`), `DressModel` לפי קידומות (אחת, רק כשצריך). `select` צר, `SAFE_EMPLOYEE_SELECT` לעובד. אין קריאה ל-`checkMissingDressForItem` (N+1) ואין `AuditLog`.

## החלטות ברירת מחדל שהתקבלו כאן (לדווח לבעלים)
1. שלב 1 = הזמנות שנרשמו **באותו יום** (`orderDate`), לא "ימים מהאירוע".
2. offset תיקונים = 0 (יום האירוע) עד שייקבע אחרת (`schedule_stage_repair_days`) — Q3.
3. לוח ימי העסקים לכל שלב = ההתנהגות הקיימת של אותו תהליך; B04 "כולל חג לכולם" מאחורי `schedule_skip_chag_all_stages` — Q4.
4. שלבים 5/9 = יום השליח גם בנווה יעקב (שם `/deliveries` מסודר לפי תאריך אירוע).
5. "בוצע" בשלב 6 = `isTaken` (נגזר מהמלאי/ברקוד) — Q1 פתוחה; שלבים 4/5/9 בלי "בוצע" (ממתין להחלטה על טבלה חדשה, INVENTORY 3.2).
6. "באיחור" לשלבים 2/6 = היום עבר ולא סומן; לשלב 8 = סף 7 ימים.
7. "חסרה כתובת" = חסר רחוב או עיר.
8. הערות פנימיות ל-roleId 0/1/2 בלבד.
9. הזמנת חו״ל שהתקופה שלה מכילה את היום מופיעה בשלב 7 בכל יום בתקופה.
10. הזמנה בלי פריטים פעילים לא מופיעה בשלבים 2/4/6/7/8.
11. `maxDuration = 30` לנתיב.
12. **"יתרה לתשלום" בשורת שלב 1 (העיצוב מציג `יתרה לתשלום ₪X / שולם במלואו`):** השורה נושאת `totalAmount` ו-`isPaid` (עמודות על `Order`, בלי שאילתה נוספת). היתרה עצמה = `totalAmount − Σ Payment.amount` (כמו `/api/orders`, `totalPaid`) דורשת את יחס `payments` — **לא נטען** כדי לא להוסיף שליפה. אפשרויות: (א) להוסיף `payments: {where:{isDeleted:false}, select:{amount:true}}` ל-select של שלב 1 (יחס נוסף באותה קריאת Prisma, שאילתת SQL נוספת קטנה); (ב) להציג רק `isPaid`. **ממתין להחלטה.**
13. טווח `date`: ±3 שנים מהיום הישראלי (סקירה, ממצא 4).

## סיכונים / ממצאים
- **ערב חג נחשב יום לא עובד — מכוון** (ר' "ימי עסקים"). `dayFlags.isChag` נגזר מאותו `isChagDay` ולכן גם ערב חג מסומן `isChag: true` — זו ההתנהגות הרצויה.
- **`getIsraelDayRange` בימי מעבר שעון הקיץ (`lib/hebrewDate.js`) — נפתר (סקירה, ממצא 2).** עד PR #194 ההיסט נקבע לפי 12:00 ולכן ביום **סיום** שעון הקיץ (א' 25.10.2026) חלון היום התחיל שעה מאוחר מדי (`2026-10-24T22:00Z` במקום `21:00Z`) — תאריך שנשמר כחצות ישראלית (`2026-10-24T21:00Z`) נפל מחוץ לחלון של 24.10 **וגם** של 25.10; ביום **תחילת** שעון הקיץ החלון היה רחב בשעה. הענף הזה מבוסס על main **אחרי** #194 (`546a00ee`, 1.10.2026), והבדיקות ב-`dates.test.mjs` מוכיחות זאת ב-3 אזורי זמן: 25.10.2026 מתחיל ב-`2026-10-24T21:00Z` ונגמר ב-`2026-10-25T21:59:59.999Z` (יום של 25 שעות), 27.3.2026 מתחיל ב-`2026-03-26T22:00Z` (23 שעות), כל ימי 2026 רצופים בלי פער ובלי חפיפה, ו-`instantToKey` מסכים עם החלון בשני הקצוות.
- משלוח חזור להזמנת חו״ל מחושב מ-`eventDate` ולא מ-`toDate` (G16, התנהגות קיימת של המשלוחים).
- `OrderItem.isTaken/isReturned` לא תמיד מנורמלים אחרי הייבוא מ-Access — נבדק `דגל ‖ תאריך` כמו בכרטיס ההזמנה.
- `Shift.date` נכתב לפי שעון השרת — הלו״ז מסנן לפי `entryTime` ולא לפי `date`.
- לא נבדק מול DB אמיתי (רק מוק); מספרי השורות האמיתיים בנווה יעקב (2,174 הזמנות משלוח) לא נמדדו.
