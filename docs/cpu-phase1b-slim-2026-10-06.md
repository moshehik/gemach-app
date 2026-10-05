# CPU שלב 1ב' - הקטנת תשובות ה-JSON הכבדות (6.10.2026)

ענף: `perf/phase1b-slim-2026-10-06` (מ-`origin/main` 491f71bb). לא נדחף, לא נפרס. אין שינוי סכימה, אין DDL, אין גישה ל-DB (כל הבדיקות מול prisma מדומה).

העיקרון בכל הסעיפים: **בלי הפרמטר החדש - הצורה הישנה בדיוק** (לקוחות ישנים, מטמוני דפדפן ישנים, העותקים הקפואים `Legacy*`). הצורה הרזה היא opt-in, ורק צרכן שנבדק אחד-אחד עובר אליה.

## 1. סיכום: מה נחסך (הערכה)

| # | שינוי | לפני (לפי הנתונים ב-14 ימים) | אחרי | נוגע ב |
|---|---|---|---|---|
| 1א | `GET /api/dresses?fields=summary` (רשימת הקטלוג) | נווה 382KB לקריאה, ראשי 1.36MB (מקס' 2.95MB); כל הפריטים של 50 דגמים + ספירת `orderItems` לכל פריט | ספירות בלבד, ~55KB על דמיית 121 דגמים (בדמיה המלאה 2,982KB); בלי תת-השאילתה `_count.orderItems` | `app/dashboard/dresses/page.js`, `buildDressesListParams` |
| 1ב | `GET /api/dresses?fields=kiosk` (עמדת הלקוחות, `limit=10000`) | כל ~13K פריטים | פריטים מקובצים לפי (מידה, לא-שמיש, זמין) עם `count`: ~203KB בדמיה לעומת 2,982KB (בנתונים אמיתיים פחות קבוצות) | `app/customer-interface/page.js` |
| 2 | `GET /api/error-report?take=50` + `?id=` | 115-350KB בכל פתיחת חלון (כל דיווח עם כל תגובותיו וצרופות, לעיתים data-URL) | עמוד ראשון ~46KB בדמיה (3,263KB מלא); שרשור נטען בפתיחה | `ErrorReportWindow.js` (החדש) |
| 3 | `GET /api/board/orders` | `/api/orders?limit=2000` ~531KB לקריאה | רק הזמנות שיכולות להיות באיחור + 5 שדות + 5 שדות פריט (בדמיה 91KB לעומת 576KB; בנתונים אמיתיים, שבהם רוב ההזמנות כבר הוחזרו, הרבה פחות) | `BoardPage.js` (החדש) |
| 4 | `GET /api/employees?slim=1` | 107-148KB (כל עמודות העובד, `themeColor`, תמונה, מחלקה מלאה, `approvals` עם כל המפתחות) | ~38KB בדמיה (196KB מלא); `select` ב-DB במקום `include` | 11 צרכני בחירה/אישור |
| 5 | כותרות מטמון + ETag/304 | לא ניתן למטמון בדפדפן | `private, max-age=60, stale-while-revalidate=300`; 304 על `If-None-Match` | settings (לא `?fresh=1`), labels, pricelists, categories, inventory/models, customers/locations |
| 6 | הערת המלצה ב-`/api/orders` | - | רק תיעוד | `app/api/orders/route.js` |

**הערה על סעיף 5 (חשוב לא להגזים בציפייה):** המטמון המשותף של האפליקציה (`lib/apiCache.js` `revalidate`) קורא תמיד `cache:'no-store'` - בכוונה, כדי שרענון אחרי כתיבה לא ייתקל בעותק ישן. לכן הכותרות החדשות חוסכות קריאות רק ל-`fetch` גולמי (עמדת הלקוחות: קטגוריות; מסך המחירון; חלונות הקיבולת: `/api/inventory/models`; `/api/settings` בקיוסק, בהדפסת שמלה ובפרופיל הישן). צעד המשך מומלץ (לא נעשה): ש-`revalidate` ישתמש בברירת המחדל של הדפדפן לכתובות ייחוס מאושרות בלבד, עם `cache:'reload'` לכל כתובת שבוטלה ב-`invalidate()`.

## 2. פירוט לפי סעיף

### 2.1 `/api/dresses` (`app/api/dresses/route.js`)
- `fields=summary`: אין `items`; במקומם `itemsCount` (פריטים לא מחוקים - עמודת "כמות פריטים"), `inUseItemsCount` (`notInUse=false`, כולל מחוקים - בדיוק התנאי הישן של "לא פעיל"), `activeItemsCount` (`notInUse=false` וגם לא מחוק - התראת "החזר לפעילות"), בנוסף `sizes` ו-`inStock` כמו קודם. תקרת `limit` 500 (בצורה הישנה נשארה 10000 כי הקיוסק צריך את כולו). בלי `_count.orderItems` (תת-שאילתה לכל שורה) - חוץ מכשיש `advRentalsCountMin` (שדורש אותה לסינון, ואינה מוחזרת).
- `fields=kiosk`: `items` מקובצים: `{ sizeText, quantity (0/1), isUnusable, count }`. זה כל מה שהקיוסק קורא (`sizeText`, `quantity>0`, `isUnusable`; `notInUse`/`isDeleted`/`inRepair`/מחסן/רזרבה כבר מקופלים לתוך `isUnusable`, והחיפוש לפי מידה עדיין רואה גם פריטים לא-שמישים). הקיוסק מחבר `item.count || 1`.
- ערך `fields` לא מוכר = הצורה הישנה (לא שגיאה).
- דף המודל הבודד (`/dashboard/dresses/[id]`) טוען `/api/dresses/<id>` ולא את הרשימה - לא נגע. אין "טעינה בהרחבה" נדרשת: הרשימה הרזה לא מציגה פריטים.
- `imageUrl` אינו data-URL: ההעלאה (`lib/dressImageStorage.js`, `app/api/upload`) שומרת כתובת `/api/attachment/<id>`. לא שונה דבר. בדיקה מומלצת לבעלים/למתכנת בלבד (קריאה, לא הורצה): `SELECT count(*) FROM "DressModel" WHERE "imageUrl" LIKE 'data:%'` בשני ה-DB.
- ה-`getBulkAvailableInventory` (העלות העיקרית בצד השרת עם `eventDate`) לא שונה.

### 2.2 `/api/error-report` (`app/api/error-report/route.js` + `lib/errorReportList.js`)
- בלי פרמטרים: הצורה הישנה (גם `?light=1` לא השתנה; `LegacyErrorReportButton.js` הקפוא ו-`ErrorReportButton.js` לא נערכו).
- `?take=N[&cursor=]` (N עד 100, ברירת מחדל 50): רשימה רזה, `updatedAt` יורד. כל דיווח: שדות הרשימה בלבד, `userText` מקוצר ל-240 תווים, **התגובה האחרונה בלבד** ומצומצמת (`id, isProgrammer, employeeId, isQuestion, createdAt` + `text:''`), `repliesCount`, `partial:true`. אין `attachmentUrls`/`lastButtons`/`queryParams`. התשובה כוללת `paging: { take, hasMore, nextCursor, total, archivedTotal }` (הספירות רק בעמוד הראשון).
- **המונים על האייקון נשארים מדויקים:** העמוד הראשון כולל תמיד גם את כל הדיווחים הפתוחים שדורשים תשומת לב: למתכנת - כל הפתוחים שלא נקראו; למדווח רגיל - כל הפתוחים שלו.
- `?id=<reportId>`: הדיווח המלא (כל התגובות, `hasSketch`, צרופות). אותו היקף הרשאה כמו הרשימה (מתכנת - הכל; אחרת רק שלו; אחרת 404).
- `ErrorReportWindow.js`: קורא `/api/error-report?take=50` (אותו מטמון 60 שנ' ואותו ביטול על כתיבה - הכתובת מתחילה באותו prefix); בוחרים/פותחים שרשור -> `loadDetail` מביא את המלא (עד אז מחוון "טוען את הפנייה…", בלי שדה תגובה); כפתור "טען עוד פניות" (וטעינה אוטומטית עמוד-אחר-עמוד בזמן חיפוש ובלשונית הארכיון, עד שיש בה עמוד); "ארכיון (N)" מהספירה של השרת; רענון הרשימה (`mergeReportLists` ב-`erModel.js`) שומר שרשור שכבר נטען כל עוד לא נוספה בו תגובה.
- **מגבלה ידועה:** חיפוש הטקסט בחלון מחפש בתיאור (240 התווים הראשונים), בכותרת, בכתובת, בשם המדווח ובתגובה האחרונה - לא בכל התגובות הישנות של דיווחים שלא נפתחו. החלופה (חיפוש בשרת) לא נעשתה.

### 2.3 לוח חודשי (`app/api/board/orders/route.js` + `lib/boardOrders.js`)
- הלוח החדש משתמש בהזמנות רק לסימן "איחור החזרה" (`isOrderLate`: `eventDate/toDate/returnDate` + `isDeleted/isTaken/takenDate/isReturned/returnDate` של הפריטים). הנתיב החדש מחזיר רק הזמנות לא מחוקות בטווח התאריכים שיש בהן פריט לא מחוק שנלקח (דגל או תאריך) ולא הוחזר (דגל) - על-קבוצה של התנאי הלקוח, והלקוח מריץ את `isOrderLate` שוב. הבדיקה מוכיחה שוויון מלא של סימני האיחור ליום מול הנתונים המלאים (3 ספים; עם ובלי `hide_taken_orders_from_orders_list`).
- שער: התחברות + `page:board` (כמו `/api/board/stages`).
- `BoardPage.js` קורא `/api/board/orders?<אותם פרמטרים של buildBoardMonthParams>` ושומר ב-namespace `board-slim`. **הלוח הישן (`LegacyBoardPage.js`, נעול) ו-`/api/orders` לא נגעו**, וה-prefetch של `/board` ב-`prefetchRoutes.js` עדיין מחמם את ה-namespace הישן (`board`).
- **חשוב לבעלים:** לפי הרישום המרכזי הלוח החדש הוא ברירת המחדל רק למתכנת; כל השאר על הלוח הישן, שממשיך למשוך `/api/orders?limit=2000`. החיסכון המלא כאן מגיע רק כשמעבירים את `ui_variant_board` ל-`a5` (החלטה שלכם) - לא שיניתי הגדרה.
- התנהגות קיימת שהועתקה בכוונה: כש-`hide_taken_orders_from_orders_list=true` הנתיב הישן מסתיר הזמנות שכל פריטיהן נלקחו גם מסימן האיחור בלוח; הנתיב החדש עושה אותו דבר (כדי שהסימן לא ישתנה). זו בעיה קיימת שמצדיקה החלטה נפרדת.
- ה-prefetch של `/board` בלבד ממשיך לטעון את הצורה הישנה לשימוש הלוח הישן: למשתמשי הלוח החדש זו קריאה מיותרת (רק ב-hover על הקישור). פתרון (מחוץ להיקף כאן, `PrefetchManager`/הרישום שייכים לשרשור אחר): לקבוע את ה-prefetch לפי הגרסה.

### 2.4 `/api/employees` (`app/api/employees/route.js`)
- `?slim=1` (מחובר, בלי `all=true`): `select` של `id, firstName, lastName, fullName, isActive, roleId, department{roleId,name}` + `canApproveWithoutPayment` + `approvals` **עם המפתחות המאושרים בלבד** (כל הצרכנים בודקים `approvals[key]` כאמת). `all=true` (דפי העובדים, כולל `LegacyEmployeesPage` הקפוא) ובלי פרמטר - הצורה המלאה כמו קודם (`slim` מתעלם כש-`all`).
- הקורא האנונימי (מסך כניסה/שעון נוכחות/קיוסק) מקבל תשובה זהה לקודמת; רק ה-query ב-DB צר עכשיו (`select` של 6 עמודות במקום `include`).
- עברו ל-`?slim=1` (שינוי שורה אחת בכל קובץ): PopupProvider, CcApproval, EcApproval, NoDialogs, OcApproval, OcItemsTab, SettingsDialogs, SendEmailModal, `app/messages`, `app/management/history`, הקיוסק. נשארו כפי שהם: דפי העובדים (`?all=true`), `PermissionsClient` (`?all=true`), ומסכי הכניסה/שעון הנוכחות (אנונימיים; כולל `LoginScreen`/`PunchClockLegacy` הישנים).

### 2.5 כותרות מטמון (`lib/httpCache.js`)
- `cachedJson(request, body, {cacheControl})` => `Cache-Control: private, max-age=60, stale-while-revalidate=300`, `Vary: Cookie`, ETag חלש (SHA-1 של הגוף), 304 על `If-None-Match` (גם `*`, רשימה, בלי `W/`). לא נוצר 304 לשגיאות. 401 לא מקבל כותרות.
- `GET /api/settings`: הגוף **זהה**; `?fresh=1` => `no-store` ובלי ETag. התשובה תלויה בהתחברות (הערות ימי אי-הפעילות מוסרות מאורח), לכן `private` + `Vary: Cookie` בלבד, ו-ETag שונה לאורח ולמחובר (נבדק); אין מטמון בין משתמשים.
- labels, `pricelists`, `pricelists/categories`, `inventory/models`, `customers/locations` (זה ה"locations" - אין `/api/locations`).
- מסכי עריכה: כל מסכי הגדרות קוראים `?fresh=1` (no-store); מסך המחירון (`dashboard/pricelist`) קורא `cache:'reload'` לרשימה ולקטגוריות אחרי כל כתיבה/מחיקה; apiCache קורא `no-store`. POST לאותה כתובת בדיוק מבטל גם את רשומת הדפדפן (כתובת זהה).
- **מגבלת ישן שהוגדרה בהחלטה:** קריאה גולמית של `/api/settings` (קיוסק, הדפסת שמלה, פרופיל ישן) או `/api/inventory/models` (חלונות הקיבולת) עלולה להציג נתון ישן עד דקה, ועד כ-6 דקות עם revalidate ברקע, אחרי שינוי שנעשה במקום אחר.

### 2.6 `/api/orders` - המלצה בלבד
הערה בקוד (`app/api/orders/route.js`, ליד `isUnpaidQuery`): המסלולים הסמארטי והחובות טוענים את כל ההזמנות התואמות ל-JS; כיוון מומלץ (`ORDER BY CASE` + `skip/take` ב-SQL; סכום תשלומים ב-SQL) ואינדקס מומלץ `Order(isDeleted, eventDate)` - לבדוק `EXPLAIN` ב-Neon לפני DDL. לא שונה דבר בשאילתה.

## 3. מטריצת צרכנים

| נתיב | צרכן | משתמש ב- | הערה |
|---|---|---|---|
| `/api/dresses` | `app/dashboard/dresses/page.js` (+ prefetch `buildDressesListParams`) | `fields=summary` | נופל לאחור ל-`items` אם במטמון תשובה ישנה |
| | `app/customer-interface/page.js` | `fields=kiosk` | `item.count \|\| 1` |
| | כל השאר (`[id]`, print, items, rentals, next-code, wizard) | נתיבי מזהה/פריט, לא הרשימה | לא שונו |
| `/api/error-report` | `ErrorReportWindow.js` | `?take=50`, `?id=`, `&cursor=` | החדש |
| | `ErrorReportButton.js` | `?light=1` | לא שונה |
| | `LegacyErrorReportButton.js` (קפוא) | ישן | לא שונה |
| `/api/board/orders` | `components/board/BoardPage.js` | חדש | |
| `/api/orders?limit=2000` | `LegacyBoardPage.js` (קפוא) + prefetch `/board` | ישן | לא שונה |
| `/api/employees` | 11 צרכני בחירה/אישור (סעיף 2.4) | `?slim=1` | |
| | דפי העובדים (חדש וקפוא), `PermissionsClient` | `?all=true` | לא שונו |
| | כניסה/שעון נוכחות (חדשים וישנים) | בלי פרמטרים (אנונימי) | לא שונו |
| ייחוס (סעיף 2.5) | כל הצרכנים | - | הגוף זהה; רק כותרות |

## 4. החזרה לאחור (rollback)
- הכי מהיר ובטוח: `git revert` של הקומיט הרלוונטי (כל סעיף בקומיט נפרד). כל נתיב רזה הוא תוספת: ה-API הישן עובד בלי הלקוח החדש, ולכן אפשר להחזיר רק צד לקוח (שורת ה-URL) בלי לגעת בשרת.
- סעיף 1: להסיר את `fields: 'summary'` מ-`buildDressesListParams` ואת `&fields=kiosk` מהקיוסק.
- סעיף 2: ב-`ErrorReportWindow.js` `REPORTS_LIST_URL = '/api/error-report'` (השרת מחזיר את הישן והלקוח מתנהג כצורה ישנה: אין `paging`/`partial`).
- סעיף 3: ב-`BoardPage.js` להחזיר `/api/orders?...` ו-`cacheNamespace('board')`.
- סעיף 4: להסיר `?slim=1` (או להפסיק לקרוא אותו בשרת).
- סעיף 5: להחליף `cachedJson(...)` ב-`NextResponse.json(...)` (או `REFERENCE_CACHE_CONTROL` ל-`no-store` במקום אחד: `lib/httpCache.js`). דפדפן שמחזיק עותק ימשיך להשתמש בו עד דקה/ -6 דקות.

## 5. רשימת בדיקה בדפדפן (לא בוצעה כאן - אין שרת פיתוח בפורט 3000, אין DB)
1. קטלוג שמלות (`/dashboard/dresses`): הרשימה נטענת; עמודת "כמות פריטים" נכונה; שורת "לא פעיל" (רקע צהוב) ו"החזר לפעילות" כמו קודם; סינון מתקדם עם "השכרות מינימום" עדיין עובד; ב-Network הבקשה מכילה `fields=summary` והתשובה קטנה.
2. עמדת הלקוחות (`/customer-interface`): הקטלוג נטען, מונה המידות בכרטיס, "מידה X" בחיפוש, מסנן מידות בצד, הדפסת הדוח, בחירת תאריך (מונים משתנים לפי זמינות) - ללא הבדל מול הישן.
3. חלון הדיווחים (מתכנת): נפתח מהר; שרשור נפתח עם כל התגובות והצרופות; "טען עוד פניות"; חיפוש; ארכיון; שליחת תגובה; סימון טופל/ארכוב; הנקודה האדומה/המספר על האייקון נכונים; פתיחה בנייד (גיליון תחתון); כניסה כמדווח רגיל.
4. לוח חודשי כמתכנת (גרסה חדשה): סימני "איחור החזרה" בתאים זהים לגרסה הישנה באותו חודש; מעבר חודשים; Network מציג `/api/board/orders` בלבד.
5. חלונות אישור (הנחה/ביטול וכו'), רשימת "מאשר" מכילה את אותם אנשים כמו קודם; הודעות (בחירת נמען); היסטוריית ניהול (סינון לפי עובד); קיוסק - רשימת העובדים בפתיחת הנעילה.
6. מחירון: שמירה/מחיקה מציגה מיד את השינוי; דף שמלה - רשימת הקטגוריות; הגדרות: שינוי והחזרה לרשימה מציגים את הערך החדש.
7. כניסה (לוגין) ושעון נוכחות: רשימת העובדים נטענת כרגיל.

## 6. התנגשויות מיזוג צפויות (שרשורים מקבילים)
- `app/api/error-report/route.js` - גם `wt-poll` נוגע ב-`?light` באותה פונקציה; ההוספה שלי היא בלוק אחד מיד אחרי `const isLight`.
- `app/lib/prefetchRoutes.js` - שורה אחת ב-`buildDressesListParams` (`fields: 'summary'`).
- `scripts/test_error_report_ui.mjs`, `scripts/test_board_page.mjs`, `scripts/test_cpu_reduction.mjs`, `scripts/order-card-tests/static.test.mjs` - שורות regex בודדות עודכנו.
- קבצי בדיקה חדשים בלבד ב-`scripts/cpu-phase1b-tests/` (הוק/shims משלהם - לא נוגעים ב-`cpu-reduction-tests`).

## 7. בדיקות שנוספו / שהורצו
```
node --no-warnings --import ./scripts/cpu-phase1b-tests/register.mjs --test scripts/cpu-phase1b-tests/<file>.test.mjs
```
`dresses-list` (11), `error-report-list` (10), `error-report-window` (7), `board-orders` (7), `employees-list` (7), `http-cache` (8) - הכל עובר. הורצו וממשיכים לעבור: `test_page_variant_switch`, `test_ui_variant`, `test_ui_variant_self_switch`, `test_menu_logic`, `test_home_css_guard`, `test_error_report_ui`, `test_cpu_reduction`, `test_employee_card_a5`, `test_punch_clock_logic`, `order-card-tests/run.mjs`, `new-order-tests/run.mjs`, `cpu-reduction-tests/*`, בדיקות stock-check, ו-eslint על הקבצים שהשתנו.
כשלים קיימים שאינם קשורים (נכשלים גם בלי השינויים - CRLF בעץ העבודה מול ה-blob/anchors): `test_board_page` (BD-O1, השוואת בייטים מול blob), `customer-card-tests` (`parity`: anchor not found / `extra is not defined`; `owner-answers` CC-O6).

## 8. מחוץ להיקף / צעדים הבאים
- `/api/inventory/preload` (248KB; items/models/הזמנות עתידיות), `/api/orders` הסמארטי והחובות (סעיף 2.6), prefetch לפי גרסה, `revalidate` של apiCache עם מטמון דפדפן לכתובות ייחוס, העברת `ui_variant_board` ל-`a5`.
