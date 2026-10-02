# הדפסה והורדה בלו״ז היומי: ארכיטקטורה וחוזה

**קומיט התשתית (תשתית + 2 דפי ייחוס, ענף מקומי `feature/schedule-print-core-2026-10-02`):** `INFRA_COMMIT_PLACEHOLDER`
**קומיטים נוספים (אשף, הורדה):** ראו בסוף המסמך.

מסמך זה הוא החוזה בין תשתית ההדפסה של הלו״ז לבין 13 הדפים שעדיין נבנים. מי שבונה דף חדש קורא את החלק
"איך מוסיפים דף" ומעתיק את אחד משני דפי הייחוס. שום דבר כאן לא דורש DB, שרת פיתוח או פריסה.

## חלק א: בעברית פשוטה (לבעלים)

- בדף **לוח זמנים** (`/schedule`) יש עכשיו, ליד בורר התאריך, שני כפתורים עגולים כמו בדוגמה: **הורדה** (ורוד, חץ למטה)
  ו**הדפסה** (תכלת, מדפסת). שניהם פותחים את אותו **אשף**: בוחרים אילו דפים (לפי שלב או "כל דפי היום"), גרסה
  (בדפים 03 ו-07), ולוחצים "הדפס נבחרים" או "הורד נבחרים".
- **הדפסה** פותחת חלון חדש עם הדפים שנבחרו, אחד אחרי השני, וחלון ההדפסה של הדפדפן נפתח לבד.
- **הורדה** נותנת קובץ **Excel** (גיליון לכל דף, מסודר מימין לשמאל) או **PDF** (אותם דפים כקובץ).
  לייצוא Excel יש מגבלת שורות (ההגדרה "כמות שורות מרבית לייצוא") והיא נבדקת **בשרת**: מעל המגבלה נדרשת
  סיסמה של מי שמורשה לאשר ייצוא, כמו בשאר הייצואים באתר.
- כל הדפים באותה שפה עיצובית שאושרה בתצוגה "דפי הדפסה": בס״ד, שם הגמ״ח, כתובת וטלפון, התאריך העברי והלועזי,
  תג השלב, שם הדף, סיכום, ברקוד "כל הדף" (רק בדפים שיש בהם "בוצע"), ובתחתית "הופק מהמערכת · תאריך · שעה · מי
  הדפיס/ה" ו"עמוד X מתוך Y". הכותרת והתחתית חוזרות בכל עמוד, שורה בטבלה לא נחתכת בין עמודים, וכותרת הטבלה
  חוזרת בראש כל עמוד. המרווח בין שורות הטבלה הוגדל כפי שביקשת.
- **מה כבר עובד:** דף 15 (רשימת אירועים) ודף 01 (דוח הזמנות כללי). **13 הדפים האחרים** מופיעים באשף כ"בבנייה"
  ונבנים עכשיו על אותה תשתית.
- **הרשאות:** מי שרואה את הלו״ז יכול להדפיס את הדפים שמציגים רק מה שהלו״ז מציג. דפים עם כסף (01, 02, 13)
  דורשים גם את הרשאת דף ההזמנות; דפי משלוח (10, 11, 12, 18, 19) את הרשאת דף המשלוחים; דפי תיקונים (03, 04) את
  הרשאת דף התיקונים, בדיוק כמו ההדפסות הקיימות.

## חלק ב: קוד

### 1. קבצים

| קובץ | תפקיד |
|---|---|
| `lib/schedule/print/registry.js` | **מקור האמת** ל-15 הדפים: מפתח `PP-xx`, תווית, שלבים מזינים, גרסאות, ברקוד, כיוון, `extraPageKeys`, `extras`, `status`. פונקציות: `getPrintPage`, `pagesForStage`, `parsePageList`, `parseVersions`, `versionsParam`, `isPerOrderPage`, `publicPageInfo`. טהור (שרת + דפדפן). |
| `lib/schedule/print/barcode.js` | Code 39 טהור: `code39Bars`, `code39Svg`, `isValidCode39`; סכימת הקודים `orderCode`/`itemCode`/`dayCode`/`parseScheduleCode` (D1, נפרד מ-`parseBarcode` של השמלות). |
| `lib/schedule/print/format.js` | תאריכים (`hLong`, `hDay`, `hFull`, `hShort`, `greg`), `israelTime`, `money`, `cnt`, `customerName`, `customerPhones`. |
| `lib/schedule/print/pages/PP-xx.js` | מודול דף: `build()`, `toRows()`, `SHEET_NAME`. קיימים: `PP-01`, `PP-15`. |
| `lib/schedule/print/pages/index.js` | מפת המודולים (`PAGE_MODULES`, `getPageModule`). |
| `lib/schedule/print/data.js` | `loadExtras(day, defs)` (שאילתת extras אחת), `buildPrintPayload(...)`, `payloadToRows(payload)`. |
| `app/api/schedule/print/route.js` | `GET`/`POST` - ר' סעיף 3. |
| `app/components/schedule/print/print.css` | ה-CSS של הדף המודפס (צבעים קבועים, `--rp`, `@page`, thead/tfoot חוזרים). |
| `app/components/schedule/print/PrintShell.js` | `PrintDocument`, `Sheet`, `SheetTable`, `GroupRow`, `Stats`, `Money`, `Phone`, `Check`, `Flag`, `Line`, `Note`, `EmptyBody`. |
| `app/components/schedule/print/Code39.js` | `<Code39 code height unit label note />`. |
| `app/components/schedule/print/pages/PPxx.js` | תבנית React לדף. קיימות: `PP01.js`, `PP15.js`. |
| `app/components/schedule/print/templates.js` | מפת התבניות (`getTemplate`). |
| `app/schedule/print/[page]/page.js` + `layout.js` | דף ההדפסה (לקוח): מושך את ה-API, מרנדר, `window.print()`. |
| `app/components/schedule/ScheduleToolbarActions.js` (+`.css`) | שני הכפתורים (הורדה, הדפסה) + פתיחת האשף. |
| `app/components/schedule/print/PrintWizard.js` | האשף (בחירת דפים/גרסה, תצוגה מקדימה, הדפסה, הורדה Excel/PDF). |
| `scripts/schedule-print-tests/` | בדיקות (`run.mjs`) + harness רינדור (`render.mjs`). |

### 2. רשומת דף ב-registry

```js
{ key:'PP-15', num:'15', label:'רשימת אירועים', chip:'אירוע', stages:['event'], info:true, barcode:null,
  orientation:'portrait', extraPageKeys:[], extras:['orderInfo'], status:'ready', desc:'…' }
{ key:'PP-07', …, barcode:{ prefix:'PRP', page:true, rows:'order' },
  versions:[{k:'a',label:'א: דף מרוכז'},{k:'b',label:'ב: כל הזמנה בעמוד נפרד'}], perOrderPage:{ version:'b' }, … }
```
- `barcode.page` = ברקוד "כל הדף" בכותרת (`ALL-<PFX>-YYMMDD`, מחושב ב-`buildPrintPayload` ל-`pageCode`);
  `barcode.rows` = `'order'` (קוד `PFX-<orderId>` בכל שורה) | `'item'` (`PFX-<orderId>-<n>`) | `null`.
- `extraPageKeys`: מערך any-of של `page:*` נוסף ל-`page:schedule` (מ-`lib/printAccess.js`). ריק = הלו״ז מספיק.
- `extras`: `['orderInfo']` = ה-API טוען `extras.orderInfo[orderId] = { totalPaid, delivery:{isDelivery,direction}, city }`
  להזמנות הדף בשאילתה אחת. extra חדש = להוסיף ל-`loadExtras` ב-`data.js` (רק אם הדף באמת צריך).
- `status`: `'ready'` כשיש מודול + תבנית; אחרת `'todo'` (האשף מציג "בבנייה", ה-API מחזיר 501).
- מפתחות שהוסרו (14, 17) ב-`REMOVED_PAGE_KEYS` בלבד. 05/06 לא קיימים.

### 3. API: `GET /api/schedule/print`

`?page=PP-01[,PP-15]&date=YYYY-MM-DD[&branch=…][&version=b | PP-03:b,PP-07:a][&format=json|rows]`

- שערים (fail-closed): `checkAuth` → `canOpenPage('page:schedule')` → לכל דף `canOpenAnyPage(extraPageKeys)` → 401/403.
- 400 פרמטר שגוי · 404 מפתח לא קיים/הוסר · 501 דף `todo`.
- `getScheduleDay` רץ **פעם אחת** לכל הבקשה (לא לכל דף), ואז `loadExtras` (שאילתה אחת לכל extra), ואז `build()`
  של כל דף. אין N+1, אין `AuditLog`, אין קריאות HTTP פנימיות.
- `format=json` (ברירת מחדל) מחזיר:
  ```js
  { meta: { date, dateHebrew, dateGreg, weekday, isToday, nonWorkingDay, branch, pickupHours,
            gmach:{name,address,phone}, printedBy, producedAt, producedKey, producedTime, truncated, warnings },
    pages: [ { key:'PP-15', version:null, def:<publicPageInfo>, data:<build()>, pageCode:'ALL-…'|null } ] }
  ```
- `format=rows` מחזיר `{ meta, sheets:[{ key, label, version, sheetName, rows:[{עמודה:ערך}] }], total, limit }`.
  **מגבלת ייצוא בשרת (D6):** `total > feature:export_max_rows` של העובד → `403 { code:'EXPORT_LIMIT', total, limit }`.
  `POST /api/schedule/print { page, date, branch, version, format:'rows', approvalPin }` - אותה בקשה עם סיסמת
  מאשר/ת (`feature:export_over_limit_approval`, בדיקה כמו `/api/auth/verify-pin`) באותה בקשה שמחזירה את השורות.

### 4. דף ההדפסה: `/schedule/print/<PP-01 | PP-01,PP-15>?date=…&branch=…&version=…`

- `downloadPdf=true`: בלי `window.print()`; `data-print-ready="true"` כשהנתונים נטענו (ל-`lib/pdf.js`).
- `preview=1`: בלי הדפסה אוטומטית ובלי סרגל (ל-iframe של האשף).
- `body.hide-global-nav` + `body.pp-print-mode` מוסתרים את המעטפת; `app/schedule/layout.js` (האב) אוכף `page:schedule`.
- כמה דפים = גיליון אחד אחרי השני, `break-before: page` ביניהם; מספור העמודים רציף לכל המסמך.

### 5. המעטפת (`PrintShell.js` + `print.css`)

- גיליון = `<table class="pp-sheet">` עם `thead` (כותרת + פס הכותרת), `tfoot` (תחתית), `tbody` (גוף). בהדפסה
  thead/tfoot חוזרים בכל עמוד (Chrome, וגם `page.pdf()` של puppeteer). `@page { size:A4; margin:10mm 12mm 12mm;
  @bottom-left { content:"עמוד " counter(page) " מתוך " counter(pages) } }` - תיבות השוליים נתמכות ב-Chrome 131+;
  בדפדפן ישן יותר פשוט אין מספור (הכול השאר זהה).
- `globals.css` מגדיר בהדפסה `tr{break-inside:avoid}` לכל הטבלאות; `print.css` מחזיר `auto` לשורת המעטפת
  (אחרת Chrome מקצץ לעמוד אחד) ומשאיר `avoid` לשורות הנתונים `.pp-t tr`. כותרת טבלה חוזרת: `.pp-t thead{display:table-header-group}`.
- **אסור** להשתמש במשתני ערכת הנושא (`--gm-*`, `--navy` וכו') או במחלקות `.gm-ds`: רק `--pp-*` ו-`--rp` (2.3mm).
  `design-overrides.css` כופה גופנים ב-`!important`; `.pp-root *{font-family:inherit!important}` מנטרל.
  גופן: `"Segoe UI","Noto Sans Hebrew"(Google Fonts),Arial` - בחלונות Segoe (זהה לתצוגה), ב-Chromium של Vercel Noto.
- כל המחלקות בקידומת `pp-` (ה-`.t`, `.note`, `.ck` של התצוגה הן `.pp-t`, `.pp-note`, `.pp-ck`): אותם ערכים.

### 6. איך מוסיפים דף (העתקה מדף ייחוס)

1. `lib/schedule/print/pages/PP-xx.js`: `export function build({ day, page, version, extras, now })` → אובייקט עם
   `title`, `sub`, `sum`, `empty` ומה שהתבנית צריכה; `export function toRows(data)` → שורות שטוחות בעמודות עבריות
   (מספרים כמספרים, טלפון כמחרוזת); `export const SHEET_NAME`. טהור: אין Prisma, אין `new Date()` (יש `now`).
   השורות של השלב: `day.stages.find(s => s.key === '<stage>').items` (צורת השורה: `docs/schedule-page-logic-spec.md`).
   - טבלה פשוטה: העתיקו `PP-15.js`. סיכום + טבלה: `PP-01.js`.
   - ברקוד שורה: `orderCode(page.barcode.prefix, orderId)` / `itemCode(prefix, orderId, n)` מ-`barcode.js`
     (שימו את הקוד בנתונים, התבנית מציירת `<Code39 code={…} height={6} unit={0.19} />`).
   - "הזמנה בכל עמוד" (07ב, 12): `build` מחזיר `orders:[…]`; התבנית מחזירה `<Sheet>` לכל הזמנה עם
     `code={orderCode(...)}` `codeNote="סימון ההזמנה כמוכנה"` ו-`sheetIndex/sheetCount`.
2. שורה ב-`lib/schedule/print/pages/index.js`.
3. `app/components/schedule/print/pages/PPxx.js`: `export default function PPxx({ meta, page })` שמחזיר
   `<Sheet meta={meta} page={page}>…</Sheet>` עם `SheetTable`/`GroupRow`/`Stats`/`Note`/`Check`/`Flag`/`Line`.
4. שורה ב-`app/components/schedule/print/templates.js`.
5. ברשומת ה-registry: `status:'ready'`.
6. בדיקות: `node scripts/schedule-print-tests/run.mjs` (הטסט `registry.test.mjs` דורש מודול לכל דף `ready`),
   והרצת ה-harness על הדף: `node --import ./scripts/schedule-print-tests/register-render.mjs scripts/schedule-print-tests/render.mjs PP-xx [long]`
   (צילום מסך + PDF + בדיקות סגנון/עימוד ב-`scripts/schedule-print-tests/out/`). הוסיפו מקרה `long` ל-`render.mjs`
   אם הדף שלכם צריך שורות סינתטיות משלו, ו-`checkPdf` יודע לקרוא `data.rows` או `data.groups[].rows`.

### 7. בדיקות ו-harness

- `node scripts/schedule-print-tests/run.mjs [filter]` - `registry`, `barcode`, `route` (401/403/404/501/400, תוכן
  PP-15/PP-01 מול `scripts/schedule-tests/fixtures.mjs`, `format=rows` + מגבלת ייצוא) ב-3 אזורי זמן, בלי DB.
- `render.mjs` - Chrome headless (`puppeteer-core`, Chrome מותקן), ה-CSS הגלובלי האמיתי + `print.css`, `renderToStaticMarkup`
  של התבניות האמיתיות (JSX דרך SWC של Next), בדיקת סגנונות מחושבים תחת `print` (רקע לבן, גופן, `--rp`, אין רקעים
  צבעוניים, thead/tfoot, אין navbar), `page.pdf()` + pypdf: מספר עמודים, כותרת/תחתית בכל עמוד, מוני עמודים,
  אף שורה לא נחתכת. `long` = ~50 שורות → 3 עמודים.
- לא נבדק כאן (דורש שרת פיתוח/DB): הדף החי `/schedule/print/...` בתוך המעטפת של Next, ו-PDF בשרת על Vercel.

### 8. ברקודים

- Code 39, `PFX-<orderId>` לשורה/הזמנה, `PFX-<orderId>-<n>` לפריט (n = סידורי בתוך ההזמנה, לא מזהה DB),
  `ALL-PFX-YYMMDD` לכל הדף. קידומות: REP תיקונים, PRP הכנה, DOT משלוח הלוך, PCK איסוף, MRT החזרה ידנית, DBK משלוח חזור.
  דפי מידע (01, 02, 15) בלי ברקוד (PQ-02, PQ-07).
- הפענוח `parseScheduleCode` נפרד מ-`parseBarcode` של ברקוד השמלה (ספרות בלבד) ולא נוגע בו (D1).
  הסריקה עצמה (סימון "בוצע" מברקוד) שייכת לעבודת ה-marks ולא לתשתית ההדפסה.

### 9. גבולות ומה לא נעשה

- דף 12 מחליף את "נתונים לשקית" ודפים 03/04/10/18 את `/print/alterations`/`/print/delivery-courier` **בעיצוב בלבד**:
  המשטחים הישנים לא הוסרו (ראו `replaces` ב-registry).
- PDF בשרת (`POST /api/pdf` במצב `path`) דורש הוספת `/schedule/print` ל-`PRINT_PATH_PAGE_KEYS` + התאמת
  ההשוואה לקידומת - ר' סעיף הקומיטים בסוף.
- ללא שינוי ב-`lib/schedule/*`, ב-`app/api/schedule/route.js`, ב-`schedule.css` או ב-`app/api/schedule/marks/*`.

## קומיטים

- תשתית + PP-01 + PP-15 + בדיקות: `INFRA_COMMIT_PLACEHOLDER`
- אשף + כפתורים: (יתעדכן)
- הורדה (Excel/PDF): (יתעדכן)
