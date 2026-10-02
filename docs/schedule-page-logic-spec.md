# לו״ז יומי — שכבת הנתונים והלוגיקה

> **שלב 2 (2.10.2026, ענף `feature/schedule-marks-2026-10-02`): סימון "בוצע"** — ר' הסעיף "סימון בוצע (ScheduleStageMark)" בסוף המסמך. השאר מתאר את שלב 1 (קריאה).

**מצב (2026-10-02, אחרי סקירה עצמאית של PR #212):** `GET /api/schedule?date=YYYY-MM-DD[&branch=…]` + `lib/schedule/*` + דף `/schedule` (קריאה בלבד). אין "סימון בוצע" (שלב 2 של הבנייה), אין שינוי סכימה, אין זריעת הגדרות.
**מקור האמת להחלטות:** `scratch/schedule-build/DECISIONS-לוז-יומי.md` (מחוץ לריפו), כולל "החלטות מדף שאלות פתוחות" (A1–A7, B1–B5), "החלטות הבעלים 1.10.2026" (1–4: חג במשלוחים, כלל אחיד, ימים ללא פעילות) ושתי החלטות מ-2.10.2026: **החזרה נוחתת תמיד על יום עובד** ו-**GQ-04: הלו״ז גלוי לכל העובדות**. מיפוי הנתונים הקיימים: `scratch/schedule-build/INVENTORY-stage-data.md`.
**ענף / PR:** `feature/schedule-page-2026-10-01`, PR #212.

### מה השתנה בסבב התיקונים (1–2.10.2026)
| # | שינוי | איפה |
|---|---|---|
| סקירה 1 | טיוטות (עגלה שנשמרה אוטומטית) מסוננות גם בשלבים 5/9 — אפשרות `excludeDrafts` ב-`getDeliveriesForDate` (ברירת מחדל כבויה: `/api/deliveries` לא השתנה), הלו״ז מעביר `true`. | `lib/deliveries.js`, `lib/schedule/loaders.js` |
| סקירה 4 | `date` תקין בצורתו אבל רחוק (למשל `9999-12-31`) → 400 בעברית ולא 500. טווח: ±3 שנים מהיום הישראלי (`MAX_YEARS_FROM_TODAY`). | `lib/schedule/dates.js` (`isWithinReasonableRange`), `lib/schedule/index.js` |
| סקירה 5 | "מי במשמרת" ליום עתידי/עבר — בלי משמרות פתוחות של היום; הסעיף "פתוחה מאתמול" רק כש-`date` = היום. | `lib/schedule/loaders.js` (`loadStaffOnShift`) |
| סקירה 6 | שורת שלב 1 נושאת `totalAmount` ו-`isPaid` (עמודות קיימות, בלי שאילתה נוספת). "יתרה לתשלום" עצמה דורשת את `Payment` — לא נטען (ר' "החלטות ברירת מחדל" 12). | `lib/schedule/loaders.js` |
| החלטות 3+4 (1.10) | **כלל אחד לכל השלבים:** `lib/schedule/dates.js` הוא עטיפה דקה על `lib/businessDays.js` (שישי, שבת, חג, ערב חג, רשימת הבעלים `non_working_days_extra`). אין יותר `schedule_skip_chag_all_stages`, `skipChag`, `skipChagDefault`, `dayFlags`. | `lib/schedule/dates.js`, `settings.js`, `stages.js`, `index.js` |
| החלטה 1 (1.10, PR #200) | משלוחים (5/9) מדלגים חג/ערב חג/רשימת הבעלים ב-`lib/deliveries.js` עצמו (כולל תיקון האי-סימטריה) — הפער מול B4 **נסגר**. | `lib/deliveries.js` |
| **2.10 — החזרה ביום עובד** | שלב 8 נוחת תמיד על יום עובד: גם תאריך מפורש (`toDate`/`returnDate`) וגם offset 0 מתגלגלים קדימה (`rollForwardToWorkingDay`). ר' "מועד ההחזרה". | `lib/schedule/dates.js`, `loaders.js` |
| **2.10 — GQ-04** | `page:schedule` **פתוח לכל העובדות כברירת מחדל** (מחליף את B1 "כמו בשאר הדפים"). | `lib/permissionsMetadata.js` |
| סקירה #212 (2) | הזמנת חו״ל/אמצע שבוע: גם `fromDate` בחלון ה-SQL של שלבי 2/4/6 (קודם רק `eventDate` — ההזמנה לא הגיעה ל-JS). | `lib/schedule/loaders.js` |
| סקירה #212 (3) | שדות הלו״ז בשורת המשלוח הם opt-in (`withScheduleFields`) — `/api/deliveries` זהה בית-לבית לקודם. | `lib/deliveries.js` |
| סקירה #212 (1) | אייקוני הדף מה-sprite המוטמע (`#gmi-`), לא מקובץ `sprite.svg` חיצוני (מסנני תוכן). | `app/components/schedule/ScheduleIcon.js` |
| A3 | שלב 8 מחזיר `dressCount` (כבר היה בשורה הבסיסית; עכשיו מתועד ונבדק). | — |
| A4 | `returnCondition` (`ok`/`not_ok`/`null`) גם בשלב 9 (מהפריטים שכבר נטענים ב-`getDeliveriesForDate`, רק עם `withScheduleFields`). | `lib/deliveries.js`, `lib/schedule/loaders.js` |
| A7 | הזמנות שלא שולמו מופיעות (לא היה סינון; עכשיו מתועד ונבדק). | — |
| ערב חג | ערב חג = יום לא עובד — **מכוון** (החלטת הבעלים), לא באג; מגיע מהכלל האחיד (`isErevChagKey`). | `lib/businessDays.js` |

## קבצים

| קובץ | תפקיד |
|---|---|
| `lib/schedule/stages.js` | הגדרות 8 השלבים (1,2,4,5,6,7,8,9 — שלב 3 "העברה בין סניפים" **לא קיים**, החלטה A1: אין לו מפתח, הגדרה או קבוע בשום מקום בקוד; בדיקה: "A1: nothing in the stage catalog refers to stage 3"), ברירות מחדל ל-offset/לוח/שדה "בוצע". |
| `lib/schedule/dates.js` | מפתחות ימים ישראליים (`YYYY-MM-DD`), חלונות יום (`getIsraelDayRange`), ועטיפות דקות על הכלל האחיד `lib/businessDays.js` (`isNonWorkingDay`, `dayStatus`, `addBusinessDays`, `sourceKeysForDay` = ההופכי, `rollForwardToWorkingDay` / `rolledSourceKeysForDay` לשלב 8). אין כאן חישוב חג או יום בשבוע משלו (נאכף בבדיקה). ללא תלות באזור הזמן של השרת. |
| `lib/schedule/settings.js` | קריאת `SystemSetting` (דרך `lib/settingsCache.js`) עם ברירות מחדל שאינן משנות התנהגות. |
| `lib/schedule/loaders.js` | השליפות: 4 שאילתות ליום (+1 לשמות דגמים). בלי N+1. |
| `lib/schedule/alerts.js` | התראות שורה. |
| `lib/schedule/index.js` | `getScheduleDay({date, branch, user})` — מרכיב הכל ל-JSON. |
| `app/api/schedule/route.js` | GET בלבד: `checkAuth()` + `canOpenPage('page:schedule')`, `maxDuration = 30`, `Cache-Control: no-store`. |
| `lib/permissionsMetadata.js` | פריט קטלוג חדש `page:schedule` (**פתוח לכל עובד כברירת מחדל**, GQ-04 — ר' "הרשאות"). |
| `lib/deliveries.js` | תוספת בלבד: אפשרויות `byDispatchDate`/`includeInternalNotes`/`excludeDrafts`/`withScheduleFields`. בלי אפשרויות — התוצאה, צורת השורה וה-`findMany` של `/api/deliveries` זהים בית-לבית לקודם (נאכף ב-`scripts/business-days-tests/deliveries-parity.test.mjs` D ו-`scripts/schedule-tests/deliveries-legacy.test.mjs`; כולל הצגת טיוטות שם — שינוי זה דורש אישור נפרד). `withScheduleFields` (רק הלו״ז) מוסיף `street`, `dressCount`, `branch`, `pickupBranch`, דגלי חו״ל/אמצע שבוע/יום נוסף/מרווח, `fromDate`/`toDate`, `returnCondition`. |
| `lib/apiCache.js` | `/api/schedule` מתיישן אחרי כל כתיבה ב-`/api/rentals`, `/api/returns`, `/api/orders`, `/api/alterations`, `/api/deliveries`. |
| `scripts/schedule-tests/` | בדיקות ללא DB (מוק בזיכרון), מורצות ב-3 אזורי זמן: `node scripts/schedule-tests/run.mjs`. |

## כלל "שייך ליום X" לכל שלב

כל התאריכים = ימים קלנדריים בישראל. `eventDate` נשמר לפעמים כחצות UTC ולפעמים כחצות ישראלית (21:00Z/22:00Z) — שתי הצורות מטופלות (`instantToKey` + `getIsraelDayRange`).
"תאריך התחלה אפקטיבי" (B21): הזמנת חו״ל/אמצע שבוע → `fromDate` (נופל ל-`eventDate`); אחרת `eventDate`. `extraDay` כבר מוטמע ב-`fromDate/toDate`; `customSpacing` לא מזיז תאריכים (מלאי בלבד) — שניהם מוחזרים כדגלים בלבד.

| # | שלב | מקור | כלל | ימי עסקים | שדה "בוצע" |
|---|---|---|---|---|---|
| 1 | הזמנה (מידע) | `Order.orderDate` | נרשמה ביום X (לפי שעון ישראל). **"אותו יום" בלבד — אין "ימים מהאירוע" לשלב 1 ואין מפתח `schedule_stage_order_days` (החלטה A2).** הזמנות שעוד לא שולמו **כן מופיעות** — אין סינון לפי `isPaid`/סטטוס, רק טיוטה/מחוקה (החלטה A7). השורה נושאת `totalAmount`, `isPaid`. | — | אין (החלטה) |
| 2 | תיקונים | `Order` + `OrderItem` עם תיקון (`neck>0` / `sleeve>0` / `length` לא ריק ולא `'null'`/`'0'` — כמו `/api/alterations`) | התחלה אפקטיבית = X + `schedule_stage_repair_days` ימי עסקים לפני (ברירת מחדל **0** = יום האירוע, כמו מסך התיקונים) | הכלל האחיד | `alterationDone` (פריט); שורה "בוצע" = כל פריטי התיקון |
| 4 | הכנה | `Order` (+`DressItem.location/inRepair`) | 3 ימי עסקים לפני ההתחלה האפקטיבית (= `getPrintPrepDate`, אומת על 90 ימים רצופים) | הכלל האחיד | **אין** (G1) |
| 5 | משלוח הלוך | `getDeliveriesForDate(X, {byDispatchDate, excludeDrafts, withScheduleFields})` | יום היציאה של השליח = אירוע − `delivery_days_before` (או 1 כש-`deliveryOneDayBefore`). גם כש-`deliveries_select_by_event_date` דולק (נווה יעקב) הלו״ז שואל "מה השליח עושה היום". טיוטות מסוננות (סקירה, ממצא 1). | הכלל האחיד בתוך `lib/deliveries.js` (שישי/שבת שם לפי `delivery_skip_weekends`; חג/ערב חג/רשימת הבעלים תמיד — החלטה 1, PR #200) | **אין** (G1) |
| 6 | איסוף מקומי | `Order` שאינו משלוח הלוך (`!isDelivery` או כיוון `'חזור'`) | 2 ימי עסקים לפני ההתחלה האפקטיבית (= "קבלת השמלות" בדף ההזמנה) | הכלל האחיד | `isTaken`‖`takenDate` (כל הפריטים) — ר' Q1 |
| 7 | אירוע (מידע) | `Order` | התחלה אפקטיבית = X, או תקופת חו״ל/אמצע-שבוע (`fromDate..toDate`) שמכילה את X | — | אין (החלטה) |
| 8 | החזרה ידנית | `Order` שאינו משלוח חזור | מועד ההחזרה הצפוי = (`toDate` ‖ `returnDate` ‖ אירוע + `schedule_stage_manret_days` ימי עסקים, ברירת מחדל 1) **ואז גלגול ליום עובד** (ר' "מועד ההחזרה"). השורה נושאת `dueKey` (היום), `dueKeyRaw` (המועד לפני הגלגול), `dressCount` (כמות בלבד — A3/B05) ו-`returnCondition` (A4). | הכלל האחיד + גלגול קדימה | `isReturned`‖`returnDate` (כל הפריטים) + מצב `ok`/`not_ok` |
| 9 | משלוח חזור | כמו 5 | יום האיסוף = אירוע + `delivery_days_after`. טיוטות מסוננות. השורה נושאת `returnCondition` (`ok`/`not_ok` אחרי שכל הפריטים הוחזרו, אחרת `null` — A4). | כמו 5 | **אין** (G1) |

הזמנות מסוננות תמיד: `isDeleted=false`, ולא טיוטה דרך `{ OR: [{status:null},{status:{not:'טיוטה'}}] }` (אף פעם לא `notIn`/`<>` על `status`). הזמנה בלי פריטים פעילים לא נכללת בשלבים 2/4/6/7/8.
**חלון ה-SQL של שלבי 2/4/6/8** (שאילתת `Order` אחת): הטווח המאוחד של כל מפתחות המקור על `eventDate` **וגם על `fromDate`** (הזמנת חו״ל/אמצע שבוע מתחילה ב-`fromDate` — בלי זה היא לא הגיעה ל-JS; סקירת #212, חוסם 2), + חפיפת תקופה ליום (שלב 7), + `toDate`/`returnDate` בחלון ההחזרה (ר' "מועד ההחזרה"). הסיווג הסופי ב-JS (`classifyEventOrder`).

### ימי עסקים — כלל אחד לכל המערכת (החלטות הבעלים 3+4, 1.10.2026)
ללו״ז **אין** לוח משלו. `lib/schedule/dates.js` עוטף את `lib/businessDays.js`: יום לא עובד = שישי, שבת, יום טוב, ערב יום טוב, או יום שהבעלים סימן ב-`non_working_days_extra` (רשימת הבעלים נקראת מאותה קריאת מטמון הגדרות ומועברת לכל ספירה — `ctx.nonWorkingDays`). `addBusinessDays(key, n, cfg)` לשני הכיוונים; `sourceKeysForDay(day, offset, cfg)` = ההופכי המדויק (`inverseBusinessDays`): כל תאריכי האירוע שנוחתים על יום נתון (אירועים בשישי/שבת/ראשון → הכנה בחמישי; יום שהבעלים סגר מצטרף לטווח), ו-`[]` ביום לא עובד. אין מתג לכל שלב ואין `schedule_skip_chag_all_stages` — הם היו מאפשרים ללו״ז לסטות מכרטיס ההזמנה ומרשימת האיחורים. כשהכלל יתרחב (גרסה 2: חול המועד, טווחים, תאריכים עבריים קבועים — PR #202) הלו״ז מקבל אותו אוטומטית, כולל `reasons` חדשים בתשובה.

> **ערב חג = יום לא עובד (החלטת הבעלים, 1.10.2026: "הגמ"ח לא עובד בערב חג").** מגיע מ-`isErevChagKey` בכלל האחיד (שקול ל-`isChagDay` הישן ב-`lib/hebrewDate.js`, שמסמן גם את ערב החג). **זו ההתנהגות הרצויה — לא באג.** דוגמאות (תשפ"ז): א' 20.9.2026 ערב יום כיפור, ד' 21.4.2027 ערב פסח, ה' 10.6.2027 ערב שבועות. חול המועד שאינו ערב חג (למשל 5.4.2026) נשאר יום עבודה בגרסה 1 של הכלל.

**משלוחים (5/9):** `lib/deliveries.js` מחיל את אותו כלל בעצמו (חג/ערב חג/רשימת הבעלים תמיד; שישי/שבת לפי `delivery_skip_weekends`) עם ההופכי המלא (`inverseBusinessDays`) — הפער "משלוחים מול B4" שהיה כאן **נסגר ב-PR #200** (החלטת הבעלים 1, 1.10.2026).

### מועד ההחזרה נוחת על יום עובד (החלטת הבעלים 2.10.2026)
"ההחזרה של אירוע בחמישי תהיה בראשון." בשלב 8 המועד הגולמי (`toDate` ‖ `returnDate` ‖ אירוע + offset ימי עסקים) עובר `rollForwardToWorkingDay`: יום עובד נשאר; שישי/שבת/חג/ערב חג/יום של הבעלים → יום העבודה הראשון אחריו. לכן: `toDate` שישי 16.10 → ראשון 18.10; `returnDate` שבת → ראשון; `toDate` ערב יום כיפור (א' 20.9) → ג' 22.9; offset 0 על אירוע בשישי → ראשון; ו-`toDate` על יום שהבעלים סגר → למחרת. חלון השאילתה של `toDate`/`returnDate` = היום + רצף הימים הסגורים שלפניו (`rolledSourceKeysForDay`), וביום סגור אין סעיף כזה בכלל. השורה נושאת `dueKeyRaw` (המועד המקורי) לתצוגת "מועד מקורי: שישי".
**התראת `late_not_done`** לשלב 8 נספרת מהיום המגולגל (`toDate` שישי 16.10, נצפה ב-25.10 → 7 ימי איחור, מ-18.10).
**פער מתועד — לא שונה בלי "כן" מפורש של הבעלים** (זה טקסט/ספירה שמגיעים ללקוחות ולכרטיס ההזמנה בשני הגמ"חים). להזמנות עם `toDate`/`returnDate` על יום סגור (חו״ל, אמצע שבוע, יום נוסף, ייבוא Access; להזמנה רגילה אין הבדל — `nextWorkingDay` כבר נוחת על יום עובד) המקומות הבאים ממשיכים להציג/לספור את התאריך המפורש **הלא-מגולגל**:
- `getExpectedReturnKey/Date` (`lib/lateReturn.js`): `app/print/order/page.js` (דף הזמנה מודפס), `app/api/orders/[id]/email/route.js` (מייל ללקוחה), `app/api/orders/route.js` (שורת "החזרה" בשמירת הזמנה), `lib/inventory.js` ("אמור לחזור מחר"), `app/api/a5/adv/route.js` (שבבי "החזרה היום/מחר").
- `getLateReturnInfo` (`lib/lateReturn.js`): `components/orders/RentalReturnModal.js` (כרטיס הזמנה), `app/rentals/page.js` (בר החזרה מהיר), `app/api/orders/overdue/route.js`, `app/api/cron/daily/route.js` (מייל יומי), `app/api/a5/adv/route.js`. דוגמה: `toDate` שישי 16.10, ב-25.10 — כרטיס ההזמנה סופר 9 ימי איחור, הלו״ז 7.
**התיקון המינימלי אם הבעלים יאשר:** גלגול גם ב-`getExpectedReturnKey` (שורת ה-`explicit`) וב-`getLateReturnInfo` (`dueDateRaw`), + מקרה ב-`scripts/business-days-tests/late-return-parity.test.mjs`. קצה לדיווח: `delivery_days_after=0` במשלוחים = יום האירוע עצמו גם כשהוא סגור (`n=0` מחזיר את היום).

## התראות שורה (S09)

| קוד | טקסט | מתי |
|---|---|---|
| `late_not_done` | באיחור - לא סומן כבוצע | שלב 8: `today − X ≥ late_return_threshold_days` (7) ולא הוחזר (B15/JDG-03). שלבים 2, 6: X כבר עבר ולא סומן. שלבים 4, 5, 9: **אין** (אין שדה "בוצע"). שלבים 1, 7: אין. |
| `missing_delivery_address` | חסרה כתובת משלוח | שלבים 5, 9: חסר רחוב **או** חסרה עיר (`deliveryAddress`/`deliveryCity` ואז כתובת הלקוחה). |

## הגדרות (`SystemSetting`, קריאה בלבד — לא נזרעו)

קיימות ונקראות: `enable_deliveries` (מכבה 5/9), `enable_alterations` (`'false'` מכבה 2), `branches_enabled` + `branch_list` (רשימת הסניפים לבורר, נשלחת ב-`settings.branches`), `late_return_threshold_days`, `standard_pickup_hours`, `non_working_days_extra` (רשימת הבעלים — הכלל האחיד), `delivery_*` (בתוך `lib/deliveries.js`).
חדשות (שורה חסרה = ברירת המחדל): `schedule_stage_<key>_enabled` (`'false'` מכבה), `schedule_stage_<key>_days` (repair/prep/pick/manret, גודל בימי עסקים, 0–60), `schedule_stage_<key>_shift` (`none`/`am`/`pm`/`all` — תגית בלבד, S08), `schedule_max_scan_rows` (3000). **אין** `schedule_skip_chag_all_stages` (בוטל — כלל אחיד).
כשייווצרו: בשני ה-DB בו-זמנית, לרשום ב-`lib/settingsMetadata.js` (`SETTINGS_HEBREW_NAMES`/`NOTES`/`ORDER`/`BOOLEAN_KEYS`/`NUMBER_KEYS`) ו-`app/lib/settingsValidation.js`.
**החלטה B3 — מי כותב הגדרות שלבים:** רק הנהלה ראשית. בשלב זה אין שום כתיבה (הנתיב הוא GET בלבד); כשייבנה מסך ההגדרות של השלבים, הכתיבה תעבור שער `isHeadManagement` (כמו `/admin/settings`), לא `page:schedule`.
**החלטה A2:** אין מפתח `schedule_stage_order_days` — שלב 1 אינו `offsetConfigurable` וערך כזה, אם ייכתב, מתעלמים ממנו (בדיקה: "A2: stage 1 has no days from event").

## הרשאות

- API: `checkAuth()` (401) ואז `canOpenPage('page:schedule')` (403) — אותו דפוס כמו `app/api/a5/adv-b/route.js`. עובד לא פעיל: עובר התחברות (התנהגות קיימת של `checkAuth`) ונחסם בשער העמוד (403).
- `page:schedule` ב-`PERMISSION_CATALOG` עם `defaultForRoleId: () => true` — **פתוח לכל עובד מחובר כברירת מחדל, לפי החלטת הבעלים GQ-04 (2.10.2026, מפורשת ומאוחרת; מחליפה את B1 "כמו בשאר הדפים" מ-1.10 ואת B01).** בניגוד לשאר עמודי `page:*` (סגורים מ-2026-09-22). המנגנון (`resolvePageAccess`): הנהלה ראשית/מתכנת תמיד; אחרת override של העובדת → שורת המחלקה → ברירת המחדל מהקטלוג. שורת `false` במחלקה או בעובדת **סוגרת**; אין צורך בשום שורת DB כדי לפתוח, בשני הגמ"חים בבת אחת. `/admin/permissions` מציג את ברירת המחדל הנכונה מהקטלוג. בדיקות: `route.test.mjs` ("OPEN to every employee by default", "200 for a department WITHOUT any page:schedule row", "403 for a department with an explicit page:schedule=false row").
- אורח (בלי התחברות): נכנס רק במצב פתוח (`require_login` כבוי) — כמו כל עמוד (`canOpenPage` מחזיר `checkAuth()` כשאין עוגייה).
- הערות פנימיות (`internalNotes`, B07): מוחזרות רק ל-roleId 0/1/2. אין היום פריט הרשאה ייעודי — ברירת מחדל מתועדת, מועמד ל-`feature:` חדש.
- **סינון סניף — החלטה B2: אין שיוך סניף לעובדת** (בלי שדה חדש, בלי הגבלת סניף לעובדות). לכן אין שום סינון לפי העובד המחובר. `?branch=` הוא **סינון תצוגה אופציונלי בלבד** לפי סניף ההזמנה (`Order.branch`; שלב 6: `pickupBranch` ואז `branch`), פעיל רק כש-`branches_enabled='true'`, לפי בחירה בבקשה. (מבטל את הנוסח "מנהלת סניף/עובדת רואות רק את הסניף שלהן" מ-JDG-04.)

## פורמט התשובה (`GET /api/schedule`)

```jsonc
{
  "date": "2026-10-01", "dateHebrew": "כ תשרי תשפ״ז", "weekday": "יום חמישי",
  "isToday": true, "today": "2026-10-01", "tomorrow": "2026-10-02",
  "nonWorkingDay": false,                                                     // הכלל האחיד (lib/businessDays.js)
  "dayStatus": { "working": true, "reasons": [], "titles": [], "note": null }, // reasons: friday|shabbat|chag|erev_chag|closed (+ בגרסה 2: chol_hamoed|range|recurring); titles: שמות החגים; note: הערת הבעלים
  "generatedAt": "2026-10-01T06:00:00.000Z",
  "settings": { "deliveriesEnabled": true, "alterationsEnabled": true, "branchesEnabled": true, "branches": ["נווה יעקב", "גב״ש"], "branchFilter": null,
                "lateReturnThresholdDays": 7, "pickupHours": "20:00-21:30",
                "deliveryDaysBefore": 1, "deliveryDaysAfter": 1, "includeInternalNotes": true },
  "staff": [ { "employeeId": "…", "name": "רחלי לוי", "entryTime": "…", "exitTime": null, "open": true } ],   // שמות בלבד, בלי שכר
  "stages": [
    { "key": "prep", "number": 4, "label": "הכנה", "plural": "הכנות", "what": "…", "infoOnly": false, "enabled": true,
      "offsetBusinessDays": -3, "shift": "none", "shiftLabel": "", "doneSource": null,
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
תוספות לפי שלב: 1 — `orderDate`, `registeredBy`, `totalAmount` (מספר/`null`), `isPaid`; 2 — `items[{orderItemId, model, modelPrefix, size, location, inRepair, neckAlteration, lengthAlteration, sleeveAlteration, alterationDetails, done, taken, returned}]`; 4, 7 — `items[{orderItemId, model, modelPrefix, size, location, inRepair}]`; 6 — אותו `items` + `taken`; 5 — `address{street, city, full}`, `dispatchDate`, `chargeExists` (B08), בלי דגם; 9 — כמו 5 + `returnCondition` (`ok`/`not_ok`/`null`, A4); 8 — `address` (מגורים), `dressCount` (A3), `takenCount`, `returnedCount`, `returnCondition` (`ok`/`not_ok`/`null`), `dueKey` (= היום), `dueKeyRaw` (המועד לפני הגלגול ליום עובד), בלי דגם.
`staff`: ליום שהוא "היום" — משמרות שנכנסו היום + משמרות פתוחות שנפתחו עד יממה קודם; ליום אחר — רק משמרות שנכנסו באותו יום (סקירה, ממצא 5).
שגיאות: `400` לתאריך לא תקין או מחוץ ל-±3 שנים מהיום הישראלי (הודעה בעברית ב-`error`), `401` בלי התחברות, `403` בלי הרשאה, `500` רק לשגיאה לא צפויה.
`counts`: `done`/`pending` לפי `done`, `unknown` = שלב בלי מקור "בוצע"; `alerts` = שורות עם התראה אחת לפחות.

## ביצועים
שאילתות ליום: `Order` לפי `orderDate` (אינדקס), `Order` אחת לפי `eventDate`/`fromDate`/`toDate`/`returnDate` על הטווח המאוחד (`take: schedule_max_scan_rows+1` → `truncated`), `getDeliveriesForDate` (אחת), `Shift` (אחת, `take 200`), `DressModel` לפי קידומות (אחת, רק כשצריך). `select` צר, `SAFE_EMPLOYEE_SELECT` לעובד. אין קריאה ל-`checkMissingDressForItem` (N+1) ואין `AuditLog`.

## החלטות ברירת מחדל שהתקבלו כאן (לדווח לבעלים)
1. שלב 1 = הזמנות שנרשמו **באותו יום** (`orderDate`), לא "ימים מהאירוע".
2. offset תיקונים = 0 (יום האירוע) עד שייקבע אחרת (`schedule_stage_repair_days`) — Q3.
3. לוח ימי העסקים = הכלל האחיד לכל השלבים (החלטות 3+4) — אין מתג; Q4 נסגרה.
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
- **ערב חג נחשב יום לא עובד — מכוון** (ר' "ימי עסקים"). `dayStatus.reasons` מכיל `erev_chag` ו-`titles` את "ערב <שם החג>" — זו ההתנהגות הרצויה.
- **אחרי רצף סגור ארוך** (סוכות תשפ"ז: שישי 25.9–שבת 3.10; בגרסה 2 של הכלל גם חול המועד) יום ראשון 4.10 שואב את כל ההחזרות המפורשות של הרצף לשאילתת ה-`Order` האחת (`take: schedule_max_scan_rows+1`). `truncated` נחתך לפי `orderBy: eventDate asc`, כלומר מפיל קודם הכנות/איסופים עתידיים ולא החזרות. סיכון מעשי קטן (3000 שורות).
- **שלבי 5/9 מול שלב 8:** משלוחים נוחתים על יום עובד כבר ב-`lib/deliveries.js` (ספירה ≥1), אבל `delivery_days_after=0` = יום האירוע עצמו גם כשהוא סגור — לדיווח לבעלים.
- `page:schedule` פתוח לכל העובדות; קישור "לכרטיס ההזמנה" בשורה דורש `page:orders` — עובדת עם הלו״ז בלבד תראה "אין הרשאה" שם.
- **`getIsraelDayRange` בימי מעבר שעון הקיץ (`lib/hebrewDate.js`) — נפתר (סקירה, ממצא 2).** עד PR #194 ההיסט נקבע לפי 12:00 ולכן ביום **סיום** שעון הקיץ (א' 25.10.2026) חלון היום התחיל שעה מאוחר מדי (`2026-10-24T22:00Z` במקום `21:00Z`) — תאריך שנשמר כחצות ישראלית (`2026-10-24T21:00Z`) נפל מחוץ לחלון של 24.10 **וגם** של 25.10; ביום **תחילת** שעון הקיץ החלון היה רחב בשעה. הענף הזה מבוסס על main **אחרי** #194 (`546a00ee`, 1.10.2026), והבדיקות ב-`dates.test.mjs` מוכיחות זאת ב-3 אזורי זמן: 25.10.2026 מתחיל ב-`2026-10-24T21:00Z` ונגמר ב-`2026-10-25T21:59:59.999Z` (יום של 25 שעות), 27.3.2026 מתחיל ב-`2026-03-26T22:00Z` (23 שעות), כל ימי 2026 רצופים בלי פער ובלי חפיפה, ו-`instantToKey` מסכים עם החלון בשני הקצוות.
- משלוח חזור להזמנת חו״ל מחושב מ-`eventDate` ולא מ-`toDate` (G16, התנהגות קיימת של המשלוחים).
- `OrderItem.isTaken/isReturned` לא תמיד מנורמלים אחרי הייבוא מ-Access — נבדק `דגל ‖ תאריך` כמו בכרטיס ההזמנה.
- `Shift.date` נכתב לפי שעון השרת — הלו״ז מסנן לפי `entryTime` ולא לפי `date`.
- לא נבדק מול DB אמיתי (רק מוק); מספרי השורות האמיתיים בנווה יעקב (2,174 הזמנות משלוח) לא נמדדו.

## סימון "בוצע" (ScheduleStageMark) — שלב 2 של הבנייה (2.10.2026)

**החלטות:** C1 (טבלה חדשה ל"בוצע, מי ומתי"; יצירתה בשני הגמ"חים אושרה 2.10.2026), C2 (איסוף מקומי = סימון חדש ופשוט), A4 ("בוצע" = הוחזר תקין, בריחוף "הוחזר לא תקין", שלבים 8 ו-9), S03/S04 (סימון + חלון "בטוח?" + ביטול, "הכל בוצע" לשלב, לא בשלבים 1 ו-7), B18 (מי סימן ומתי בהיסטוריה), JDG-04 (עובדת רגילה בלי "הכל בוצע"), B2 (בלי שיוך סניף — אין סינון לפי העובדת).

| קובץ | תפקיד |
|---|---|
| `prisma/schema.prisma` → `model ScheduleStageMark` | שורה לכל (הזמנה, שלב, יום ישראלי): `done`, `outcome` (`ok`/`not_ok`, שלבים 8/9), `source` (`row`/`all`), `markedById/markedAt`, `undoneById/undoneAt`. ייחודיות `(orderId, stageKey, dayKey)`, אינדקסים `(dayKey, stageKey)`, `(orderId)`. `orderId` סקלרי בלי `@relation`. |
| `prisma/migrations-pending/2026-10-02-schedule-stage-mark.sql` | ה-SQL (idempotent, `IF NOT EXISTS`) — **לא הורץ**; להריץ ידנית על שני ה-DB (+TEST) עם בדיקת host. עד אז הסימון מוסתר. |
| `lib/schedule/marks.js` | קריאה (`loadDayMarks`, `applyMarksToRows`), אימות קלט (`validateMarkInput`), כתיבה (`applyStageMark`, `writeMark`), היסטוריה להזמנה (`listOrderMarks`). |
| `app/api/schedule/marks/route.js` | `POST` סימון / ביטול / הכל-בוצע; `GET ?orderId=` הסימונים של הזמנה. |
| `lib/permissionsMetadata.js` | פריט חדש `feature:schedule_mark_all_done` (ברירת מחדל: הנהלה ראשית + מנהלת סניף). |
| `app/components/schedule/useStageMarks.js` | ה-hook בלקוח: עדכון אופטימי, החזרה לאחור, טוסט, ספירה מחדש. |
| `app/components/schedule/MarkControls.js` + `marks.css` | לחצן "בוצע" בשורה, "הוחזר לא תקין" בריחוף, "הכל בוצע", חלון "בטוח?", טוסט — מינימלי על רכיבי הפלטה. |
| `app/api/audit/route.js` | היסטוריית הזמנה (`entityType=Order`) כוללת גם את שורות היומן של הסימונים של אותה הזמנה. |
| `scripts/schedule-tests/marks.test.mjs` | 22 בדיקות × 3 אזורי זמן (כולל "הטבלה חסרה"). |

### מה "בוצע" עושה בכל שלב
| שלב | סימון | ביטול |
|---|---|---|
| 2 תיקונים | שורת סימון + `OrderItem.alterationDone=true` לפריטי התיקון שעוד לא סומנו (`ALTERATION_DONE`, כמו מסך התיקונים) | `alterationDone=false` לכולם (`ALTERATION_UNDONE`) + הסימון `done=false` |
| 4 הכנה | שורת סימון בלבד | `done=false` |
| 5 משלוח הלוך | שורת סימון בלבד ("יצא בשליח" ≠ הושכר; `isTaken` לא נוגעים) | `done=false` |
| 6 איסוף מקומי | שורת סימון בלבד (C2). שורה שכל פריטיה כבר נלקחו (`isTaken`) נחשבת "בוצע" גם בלי סימון (`doneVia: 'isTaken'`) | `done=false`; אם הפריטים נלקחו השורה נשארת "בוצע" לפי ההשכרה |
| 8 החזרה ידנית | "בוצע" = החזרה **תקינה** של כל הפריטים שעוד לא הוחזרו (`isReturned/returnedOk/returnDate`, `RETURN_RENTAL`, אותם שדות כמו `POST /api/rentals/toggle`), "הוחזר לא תקין" = `returnedOk=false`. **עובר דרך הגנת ההחזרה המוקדמת** (`checkEarlyReturn`): כשההגדרה דולקת והאירוע עוד לא הגיע — 409 `earlyReturn:true` ולא נכתב דבר (עקיפת מנהל אפשרית ב-`overridePin`/`overrideEmployeeId`, אין לה עדיין UI בלו״ז — מהכרטיס). פריט שכבר הוחזר קודם שומר את המצב שנקבע לו; `returnCondition` של השורה נגזר מהפריטים. | `CANCEL_RETURN` לכל פריט שהוחזר + `done=false`. (כמו ביטול החזרה מהכרטיס: `DressItem.location` לא משתנה.) |
| 9 משלוח חזור | שורת סימון בלבד + `outcome` על הסימון (A4). ההחזרה הפיזית נרשמת בסריקת ההחזרות; כשהפריטים כבר הוחזרו — מצב הפריטים גובר על הסימון. | `done=false` |
| 1, 7 | אין סימון (שלבי מידע) — הנתיב מחזיר 400 | — |

### שורה בתשובת `GET /api/schedule` (תוספות)
`done` (`true`/`false`; `null` רק כשהטבלה חסרה **וגם** אין שדה קיים), `doneVia` (`'mark'` | `'alterationDone'` | `'isTaken'` | `'isReturned'` | `null`), `doneBy` (שם, לא מזהה), `doneAt`, `outcome`, `mark` (`{done, outcome, source, markedBy, markedAt, undoneBy, undoneAt}` או `null`), `canMark`. בשלבים 8/9 `returnCondition` מקבל את `outcome` של הסימון רק כשהפריטים עצמם עוד לא "הוחזרו". ברמת התשובה: `marks: { available, canMark, canMarkAll }` — `available=false` כשהטבלה חסרה (אז הדף מציג את צ'יפי הקריאה-בלבד של V1, בלי לחצנים, ו-`warnings` מסביר).
**התראת "באיחור"** לשלבים 4/5/9 קיימת מרגע שיש טבלה (`row.canMark`): יום שעבר ולא סומן = `late_not_done` (כמו 2/6). שלב 8 נשאר לפי `late_return_threshold_days` מהיום המגולגל.
עלות: שאילתת `ScheduleStageMark` אחת ליום (אינדקס `dayKey`) + שאילתת שמות עובדים קטנה לפי מזהים (רק כשיש סימונים). הטבלה חסרה: `P2021`/`42P01` נתפס, `console.warn` אחד, ולא שואלים שוב 5 דקות.

### `POST /api/schedule/marks`
שער: `checkAuth()` (401) → `canOpenPage('page:schedule')` (403) → עובדת מחוברת ופעילה (`getSessionEmployee`, אחרת 401 — גם אורח במצב פתוח רואה אבל לא מסמן). גוף:
- `{ action: 'mark' | 'unmark', stageKey, dayKey: 'YYYY-MM-DD', orderId, outcome?: 'ok' | 'not_ok', source?: 'row' }`
- `{ action: 'mark_all', stageKey, dayKey, orderIds?: number[] }` — דורש `feature:schedule_mark_all_done` (403). `orderIds` = מה שהמשתמשת ראתה (סינון סניף); בלעדיו כל השורות הממתינות של השלב ביום. עד 200.
- `outcome` רק לשלבי 8/9 (ברירת מחדל `'ok'`); בשלב אחר — 400.
תשובה: `{ ok, status: 'marked'|'unmarked'|'unchanged', row }` / `{ ok, rows, skipped: [{orderId, reason:'early_return'}], counts: {marked, unchanged, blocked} }`. `row` = טלאי לשורה: `orderId, stage, done, doneVia, doneBy, doneAt, outcome, returnCondition, mark, alerts, items?`.
שגיאות: 400 קלט (שלב לא בר-סימון, תאריך לא תקין / מחוץ ל-±3 שנים, מזהה), 409 `notInStage:true` (השרת מריץ מחדש את אותו סיווג — `classifyEventOrder` / `getDeliveriesForDate` — ולא סומך על הלקוח), 409 שלב כבוי, 409 `earlyReturn:true`, 503 `unavailable:true` (הטבלה חסרה), 500 רק לשגיאה לא צפויה.
**אידמפוטנטיות ומקביליות:** אותו מצב = `unchanged` בלי כתיבה. `create` שנופל על `P2002` (שתי עובדות באותו רגע) ממשיך כ-`update` של השורה שהאחרת יצרה; הראשונה נשארת "מי סימן". בלי `$transaction`; "הכל בוצע" כותב הזמנה-הזמנה (כישלון באמצע משאיר חלק מסומן, ריצה חוזרת משלימה). AuditLog אוטומטי דרך `auditAs` (`SCHEDULE_STAGE_DONE` / `SCHEDULE_STAGE_UNDONE` עם `scheduleStage`, `scheduleDay`, `done`, `outcome`), בלי כתיבה ידנית.

### `GET /api/schedule/marks?orderId=` ושילוב בכרטיס ההזמנה (טאב "מידע")
מחזיר `{ available, marks: [{ stageKey, stageNumber, stageLabel, dayKey, done, outcome, markedBy, markedAt, undoneBy, undoneAt }] }` (שער: `page:schedule` או `page:orders`). בנוסף, `/api/audit?entityType=Order&entityId=<orderId>` כולל מעכשיו גם את שורות היומן של הסימונים (`entityType='ScheduleStageMark'`, מיפוי דרך `ScheduleStageMark.orderId`), כך שהטאב "מידע" הקיים מציג "סומן "בוצע" בלו״ז · שלב בלו״ז: הכנה · יום בלו״ז: 2026-10-01" בלי שינוי ב-UI. **רכיב השלבים עם לחצן בכרטיס** (החלטת הבעלים לשלב 4) — ממתין לאישור עיצוב כרטיס ההזמנה; צד הנתונים מוכן.

### בלקוח (`useStageMarks.js` ↔ `StageSection`/`StageRow`)
`ScheduleDay` יוצר `marks = useStageMarks({ data, setData })` ומעביר `marks` ל-`StageSection`; המקטע מחשב לכל שורה `doneState = marks.doneState(stage, row)` ומעביר `doneState` + `onMarkDone` ל-`StageRow`/`StageTableRow` (ול-`StatusChips`), ו-`MarkAllButton` בכותרת. בלי `marks.available` הכל נראה כמו V1. לחיצה → חלון "בטוח?" → `onMarkDone(stage, row, { done, outcome })` → עדכון אופטימי → `POST` → טלאי מהשרת (או החזרה לאחור + טוסט). המונים והסיכומים מחושבים מחדש מהשורות (`recount`).

### לא בגרסה הזו (שלב הבא)
שורת ברקוד בלו״ז + ברקוד הזמנה חדש (D1/D2, Code 39, פענוח נפרד מ-`parseBarcode`), התראות לו״ז בפעמון (S12/C3), UI לעקיפת מנהל בהחזרה מוקדמת מתוך הלו״ז, רכיב השלבים בכרטיס ההזמנה.
