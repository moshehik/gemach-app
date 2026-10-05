# הדפסה והורדה בלו״ז היומי: ארכיטקטורה וחוזה

**קומיט התשתית (תשתית + 2 דפי ייחוס, ענף מקומי `feature/schedule-print-core-2026-10-02`):** `76a548ac`
**הורדה (xlsx + שער PDF):** `007245fc` · **אשף + כפתורים:** `ace0625e` (פירוט בסוף המסמך).
**מצב סופי (2.10.2026):** ענף מקומי `feature/schedule-print-integrated-2026-10-02` = התשתית + ארבע קבוצות הדפים, **כל 15 הדפים `ready`**.
בדיקות האיכות לכל דף: `docs/schedule-print-qa-2026-10-02.md`.

מסמך זה הוא החוזה בין תשתית ההדפסה של הלו״ז לבין הדפים. מי שבונה דף חדש קורא את החלק "איך מוסיפים דף" ומעתיק דף
דומה (טבלה: 15/01; בלוק לכל הזמנה: 03א/16; הזמנה בכל עמוד: 07ב/12; מדבקות: 04/08). שום דבר כאן לא דורש DB, שרת פיתוח או פריסה.

## חלק א: בעברית פשוטה (לבעלים)

- בדף **לוח זמנים** (`/schedule`) יש עכשיו, ליד בורר התאריך, שני כפתורים עגולים כמו בדוגמה: **הורדה** (ורוד, חץ למטה)
  ו**הדפסה** (תכלת, מדפסת). שניהם פותחים את אותו **אשף**: בוחרים אילו דפים (לפי שלב או "כל דפי היום"), גרסה
  (בדפים 03 ו-07), ולוחצים "הדפס נבחרים" או "הורד נבחרים".
- **הדפסה** פותחת חלון חדש עם הדפים שנבחרו, אחד אחרי השני, וחלון ההדפסה של הדפדפן נפתח לבד.
- **הורדה** נותנת קובץ **Excel** (גיליון לכל דף, מסודר מימין לשמאל) או **PDF** (אותם דפים כקובץ).
  לייצוא Excel יש מגבלת שורות (ההגדרה "כמות שורות מרבית לייצוא") והיא נבדקת **בשרת**: מעל המגבלה נדרשת
  סיסמה של מי שמורשה לאשר ייצוא, כמו בשאר הייצואים באתר. PDF והדפסה - בלי מגבלה (החלטת הבעלים 4.10.2026, SCH-XL-LIMIT = ב').
- כל הדפים באותה שפה עיצובית שאושרה בתצוגה "דפי הדפסה": בס״ד, שם הגמ״ח, כתובת וטלפון, התאריך העברי והלועזי,
  תג השלב, שם הדף, סיכום, ברקוד "כל הדף" (רק בדפים שיש בהם "בוצע"), ובתחתית "הופק מהמערכת · תאריך · שעה · מי
  הדפיס/ה" ו"עמוד X מתוך Y". הכותרת והתחתית חוזרות בכל עמוד, שורה בטבלה לא נחתכת בין עמודים, וכותרת הטבלה
  חוזרת בראש כל עמוד. המרווח בין שורות הטבלה הוגדל כפי שביקשת.
- **מה עובד:** כל 15 הדפים (01, 02, 03 א/ב, 04, 07 א/ב, 08, 09, 10, 11, 12, 13, 15, 16, 18, 19). אף דף לא מופיע עוד
  כ"בבנייה". כמה דפים נבחרים יחד = מסמך אחד, והמספור "עמוד X מתוך Y" רץ לאורך כולו.
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
| `lib/schedule/print/pages/PP-xx.js` | מודול דף: `build()`, `toRows()`, `SHEET_NAME`. לכל 15 הדפים. |
| `lib/schedule/print/pages/index.js` | מפת המודולים (`PAGE_MODULES`, `getPageModule`). |
| `lib/schedule/print/data.js` | `loadExtras(day, defs)` (שאילתה אחת לכל extra מבוקש; `orderInfo`, `orderBalance`, `prepInfo` כאן), `buildPrintPayload(...)`, `payloadToRows(payload)`. |
| `lib/schedule/print/extras/itemInfo.js` · `extras/manretDetail.js` | שני ה-extras הגדולים (ר' סעיף 2). |
| `app/api/schedule/print/route.js` | `GET`/`POST` - ר' סעיף 3. |
| `app/components/schedule/print/print.css` | ה-CSS של הדף המודפס (צבעים קבועים, `--rp`, `@page`, thead/tfoot חוזרים). |
| `app/components/schedule/print/PrintShell.js` | `PrintDocument`, `Sheet`, `SheetTable`, `GroupRow`, `Stats`, `Money`, `Phone`, `Check`, `Flag`, `Line`, `Note`, `EmptyBody`. |
| `app/components/schedule/print/Code39.js` | `<Code39 code height unit label note />`. |
| `app/components/schedule/print/pages/PPxx.js` | תבנית React לדף, לכל 15 הדפים. |
| `app/components/schedule/print/pages/pp*.css` | CSS ייחודי לדף (02, 03, 07, 09, 11, 12, 16, 19), מיובא מהתבנית. **רק** מה שאין במעטפת - כל תיקון שמשותף ליותר מדף אחד שייך ל-`print.css`. |
| `app/components/schedule/print/pages/ppStickers.js` · `ppCode.js` | עזרים משותפים: גיליונות מדבקות (04, 08) · ברקוד שורה/מדבקה כמו `rowbc()` בעיצוב. |
| `app/components/schedule/print/templates.js` | מפת התבניות (`getTemplate`). |
| `app/schedule/print/[page]/page.js` + `layout.js` | דף ההדפסה (לקוח): מושך את ה-API, מרנדר, `window.print()`. |
| `app/components/schedule/ScheduleToolbarSlots.js` (PageTools / SectionTools, של קו הלו״ז) + `ScheduleDay.js` | לחצני XL / הורדה / הדפסה בכותרת הדף ובכל שלב; ScheduleDay מחבר אותם לאשף. |
| `app/components/schedule/print/PrintWizard.js` (+`PrintWizard.css`) | האשף (בחירת דפים/גרסה, תצוגה מקדימה, הדפסה, הורדה Excel/PDF). |
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
- `extras`: נתונים שאין בשורות השלב של `getScheduleDay`. כל extra = **שאילתה אחת** (או מעט קבוע) לכל הבקשה, רק אם דף מבוקש
  הצהיר עליו, להזמנות שבשלבים של הדפים המבקשים; קריאה בלבד, בלי `$transaction`, `Order.status` בטוח ל-NULL. הרשימה הסופית:

  | extra | צורה | דפים | שאילתות |
  |---|---|---|---|
  | `orderInfo` | `[orderId] = { totalPaid, delivery:{isDelivery,direction}, city }` | 01, 02, 08, 15 | 1 (`Order` + תשלומים לא מחוקים) |
  | `orderBalance` | `[orderId] = { total, paid, balance }` | 13 | 1 |
  | `itemInfo` | `[orderId][itemId] = { n, alt }` - n סידורי 1..k בהזמנה (לברקוד פריט), alt = יש תיקון | 03, 04, 08, 09 | 1 (`OrderItem`, take 8000) |
  | `prepInfo` | `[orderId] = { isDelivery, direction, items:{[itemId]:{neck,length,sleeve,details}} }` | 07 | 1 (בלי תשלומים) |
  | `manretDetail` | `{ items:{[orderId]:[{id,model,size,returned,ok}]}, late:[…], returnHour }` | 16 | 3 (פריטי היום, הזמנות באיחור take 150 / 60 יום, שמות דגמים) + 2 הגדרות מהמטמון |

  דפים 10, 11, 12, 18, 19 בלי extras (שורות השלב מספיקות). extra חדש = להוסיף ל-`loadExtras` (קטן: ב-`data.js`; גדול: קובץ
  ב-`extras/`) ולהצהיר עליו ברשומה - רק אם הדף באמת צריך.
- `perOrderPage`: `'always'` (12) או `{ version:'b' }` (07) - "הזמנה בכל עמוד" (ר' סעיף 6).
- `slim: true` (04, 08): כותרת צרה לגיליונות מדבקות.
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
- **סדר הטעינה בדף החי:** `pages/pp*.css` (מיובאים מהתבניות) **לפני** `print.css` (מיובא אחרון ב-`app/schedule/print/[page]/page.js`).
  כלל של דף שרוצה לדרוס את המעטפת צריך סלקטור חזק יותר, לא רק סדר. כל ה-harness-ים טוענים באותו סדר.
- **כללי המעטפת המשותפים נגד דליפות מהאתר** (כל אחד נמצא בבדיקות ותוקן פעם אחת ב-`print.css`; פירוט ב-QA, ממצאים 1-14):
  - קו כותרת טבלה שחור .5 מ"מ, קווי שורות אפורים קבועים (#b9b9b9 / #888 לשורת קבוצה), צבע כותרת העמודה `--pp-ink`, בלי `outline`
    - הכול `!important` מול `globals.css` / `design-overrides.css`.
  - `.pp-root div:has(> table){max-height:none;overflow:visible}` - מבטל את "הכותרת הדביקה" של `globals.css` (75vh + גלילה); תבנית
    רשאית לעטוף טבלה ב-div.
  - `.pp-root{text-align:start;color-scheme:light}`; בהדפסה `html,body{background:#fff;color-scheme:light}!important` - בלי זה
    ערכת נושא כהה (או מצב כהה של מערכת ההפעלה) צובעת את שולי `@page` בשחור ומעלימה את מספור העמודים.
  - `.pp-t tr.g{break-after:avoid}` (כותרת קבוצה לא נשארת לבד בתחתית עמוד; על ה-`tr`, לא על ה-`td`); `.pp-t tr{break-inside:avoid}`.
  - ברקוד שורה: `.pp-t td.bcc` (מ-`ppCode.js`, בלי עטיפת `.pp-bc`).
  - במסך בלבד `.pp-paper .pp-sheet{border-collapse:separate}` (שולי 12 מ"מ בתצוגה המקדימה); בהדפסה השוליים מ-`@page`.
  - `--pp-page-body:220mm` = גובה **מינימלי** של גוף עמוד ב"הזמנה בכל עמוד" (07ב `.pp-body:has(> .pp-p7-mark)`, 12 `.pp-dn-wrap`), כדי
    שהתחתית תשב בתחתית העמוד כמו בעיצוב.
- **מעבר עמוד בין גיליונות:** `:is(.pp-sheet,.pp-sticker-sheet)+:is(.pp-sheet,.pp-sticker-sheet){break-before:page}` - מכסה כל שילוב
  של גיליון רגיל וגיליון מדבקות במסמך משולב.
- **דף נקוב למדבקות:** `@page pp-sticker{margin:8mm 12mm 9mm}` + `.pp-sticker-sheet{page:pp-sticker}` (שוליים כמו בעיצוב כדי ש-6 שורות
  של 39.6 מ"מ ייכנסו). מונה העמודים של המסמך כולו ממשיך דרכו.

### 6. איך מוסיפים דף (העתקה מדף ייחוס)

1. `lib/schedule/print/pages/PP-xx.js`: `export function build({ day, page, version, extras, now })` → אובייקט עם
   `title`, `sub`, `sum`, `empty` ומה שהתבנית צריכה; `export function toRows(data)` → שורות שטוחות בעמודות עבריות
   (מספרים כמספרים, טלפון כמחרוזת); `export const SHEET_NAME`. טהור: אין Prisma, אין `new Date()` (יש `now`).
   השורות של השלב: `day.stages.find(s => s.key === '<stage>').items` (צורת השורה: `docs/schedule-page-logic-spec.md`).
   - טבלה פשוטה: העתיקו `PP-15.js`. סיכום + טבלה: `PP-01.js`.
   - ברקוד שורה: `orderCode(page.barcode.prefix, orderId)` / `itemCode(prefix, orderId, n)` מ-`barcode.js`
     (שימו את הקוד בנתונים, התבנית מציירת `<Code39 code={…} height={6} unit={0.19} />`).
   - "הזמנה בכל עמוד" (07ב, 12; registry `perOrderPage`): `build` מחזיר `orders:[…]`; התבנית מחזירה `<Sheet>` לכל הזמנה עם
     `code={orderCode(...)}` (ברקוד הכותרת = ההזמנה, לא `ALL-…`), `codeNote` ו-`sheetIndex/sheetCount`. גוף בגובה מינימלי
     `var(--pp-page-body)`; הזמנה ארוכה ממשיכה לעמוד הבא באותו גיליון. בדיקת `qa-all-pages`: `rows:null` + `perOrderPage` = קוד הזמנה
     בכותרת הגיליון מותר.
   - בלוק לכל הזמנה/משפחה (03א, 16): `.pp-ob` (כותרת `.pp-ob-h` + טבלה) עם `break-inside:avoid`; ב-`rows:'item'` מותר קוד הזמנה
     בכותרת הבלוק.
   - מדבקות (04, 08): `<StickerSheets meta page render />` מ-`pages/ppStickers.js` - כל 18 מדבקות (3x6) = `<section class="pp-sticker-sheet">` שעוטף
     `<Sheet>` נפרד (`section` ולא `div` בגלל `div:has(> table)` של האתר). אסור רשת אחת ארוכה: כרום לא חותך רשת בתוך תא הגיליון.
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
  אף שורה לא נחתכת. `long` = ~50 שורות → 3 עמודים. `all` = כל דף `ready` (שתי הגרסאות של 03/07); `PP_THEME=dark` = ערכת הנושא
  הכהה; `combined` = מסמך אחד עם כל הדפים (מונים רציפים, סכום עמודים, כל גיליון זהה ל-PDF שלו לבד); סריקת דליפות במסך ובהדפסה;
  שולי עמוד לבנים בכל עמוד PDF (`pdf-margin.py`).
- `qa-all-pages.test.mjs` (ב-`run.mjs`): לכל דף `ready` - חוזה המודול, סכמת הברקוד מול ה-registry, שער ההרשאות (401/403/403/200).
- נאמנות לעיצוב המאושר (`תצוגות-עיצוב/סיימתי-לעבוד/דפי-הדפסה-עיצוב.html`, `PP_DESIGN` לדריסה), עם נתוני הדוגמה של העיצוב:
  `pp02-13-19.render.mjs` + `.design-compare.mjs` (02/13/19, גיאומטריה), `pp-g2.render.mjs` + `pp-g2.design-compare.mjs` (03/04/08/09 + 01/15,
  סגנונות מחושבים; פלט `out/g2-*`), `ppg3-design-ref.mjs` + `ppg3-render.mjs` (07/10/11/12/18, גיאומטריה + פיקסלים + PDF),
  `pp16-fidelity.mjs` (16, צומת-צומת). לכולם מצב `long` חוץ מ-16 (שב-`render.mjs long`).
- לא נבדק כאן (דורש שרת פיתוח/DB): הדף החי `/schedule/print/...` בתוך המעטפת של Next, ו-PDF בשרת על Vercel.

### 8. ברקודים

- Code 39, `PFX-<orderId>` לשורה/הזמנה, `PFX-<orderId>-<n>` לפריט (n = סידורי בתוך ההזמנה, לא מזהה DB),
  `ALL-PFX-YYMMDD` לכל הדף. קידומות: REP תיקונים, PRP הכנה, DOT משלוח הלוך, PCK איסוף, MRT החזרה ידנית, DBK משלוח חזור.
  דפי מידע (01, 02, 15) בלי ברקוד (PQ-02, PQ-07). לפי דף: 03 REP (א: הזמנה בכותרת בלוק, ב: פריט בשורה), 04 REP פריט למדבקה,
  07 PRP (א: הזמנה בשורה, ב: הזמנה בכותרת העמוד), 08 PRP פריט למדבקה, 09 PRP הזמנה, 10/11 DOT הזמנה, 12 DOT הזמנה בכותרת כל
  עמוד (בלי ברקוד בתוך התעודה), 13 PCK, 16 MRT בכותרת כל בלוק, 18/19 DBK.
- הפענוח `parseScheduleCode` נפרד מ-`parseBarcode` של ברקוד השמלה (ספרות בלבד) ולא נוגע בו (D1).
  הסריקה עצמה (סימון "בוצע" מברקוד) שייכת לעבודת ה-marks ולא לתשתית ההדפסה.

### 9. גבולות ומה לא נעשה

- דף 12 מחליף את "נתונים לשקית" ודפים 03/04/10/18 את `/print/alterations`/`/print/delivery-courier` **בעיצוב בלבד**:
  המשטחים הישנים לא הוסרו (ראו `replaces` ב-registry).
- PDF בשרת: `POST /api/pdf { path:'/schedule/print/PP-01,PP-15?date=…&downloadPdf=true' }` - `lib/printAccess.js`
  `printPathPageKeys()` מתיר בדיוק `/schedule/print/<מקטע אחד של מפתחות>` (לא `/schedule/print` עצמו, לא נתיבים
  מקוננים) עם `page:schedule`; ה-API של הנתונים בודק שוב את ההרשאות של כל דף בתוך ה-Chromium. לא נבדק על Vercel.
- ללא שינוי ב-`lib/schedule/*`, ב-`app/api/schedule/route.js`, ב-`schedule.css` או ב-`app/api/schedule/marks/*`.

### 10. האשף והכפתורים (`ScheduleToolbarSlots.js` + `ScheduleDay.js`, `print/PrintWizard.js`, `print/PrintWizard.css`)

- הכפתורים (מאוחד 2.10.2026 במיזוג עם קו הלו״ז): `PageTools` בכותרת הדף ו-`SectionTools` בכותרת כל שלב
  (`ScheduleToolbarSlots.js`, נאמנים לתצוגה המאושרת - 36px, אייקונים 18px; נבדק ב-`toolbar-check.mjs`). `ScheduleDay.js`
  מחבר את `onPrint` / `onDownload` / `onExport` (`{ stageKey, mode }`) לאשף: הדפסה -> מצב הדפסה, הורדה -> מצב הורדה,
  XL -> מצב הורדה עם Excel; מכותרת שלב - `initialTab` = אותו שלב ורק דפי השלב מסומנים; מכותרת הדף - "כל דפי היום".
  handler מבחוץ (props של ScheduleDay) גובר. `ScheduleToolbarActions.js` (שני הכפתורים הכפולים של ענף ההדפסה) הוסר;
  כללי האשף עברו ל-`print/PrintWizard.css` (תחום ל-`.gm-ds.gm-lz`, האשף מרונדר בתוך שורש הדף).
- האשף: `mode` (הדפסה/הורדה, `seg.pill`), בהורדה גם `Excel`/`PDF`; לשוניות (`כל דפי היום` + שלבים עם מונה
  מ-`stageData.counts.total`); רשימת `li.lz-wr` עם מתג `.sw`, תיאור, "N פריטים", "עם ברקוד", צ'יפ "בבנייה" לדפי
  `todo` (לא ניתנים לבחירה), בורר גרסה ל-03/07; תצוגה מקדימה = `iframe` ל-`/schedule/print/<key>?…&preview=1`
  (נטען רק לדף שהמשתמש/ת בחר/ה - לא אוטומטית בפתיחה); דפים שאין הרשאה להם (`format=access`) מנוטרלים עם "אין הרשאה"; "הדפס נבחרים (n)" / "הדפס את כל דפי היום" (= כל דף `ready` של שלב עם פריטים).
- הדפסה: `window.open('/schedule/print/<keys>?date&branch&version')`. Excel: `POST /api/schedule/print format=rows`
  → `403 EXPORT_LIMIT` → שדה סיסמת מאשר/ת באשף → אותו POST עם `approvalPin` → `downloadScheduleXlsx` (xlsx נטען
  בעצלתיים בלחיצה בלבד). PDF: `downloadPdf({ path })` מ-`app/lib/pdfClient.js`.

## קומיטים (ענף מקומי, לא נדחף)

- תשתית + PP-01 + PP-15 + בדיקות + harness: `76a548ac`
- הורדה: xlsx רב-גיליוני RTL + שער הנתיב ל-PDF: `007245fc`
- אשף + כפתורי הדפסה/הורדה + הטמעה ב-ScheduleDay: `ace0625e`
- ארבע קבוצות הדפים (02/13/19 · 03/04/08/09 · 07/10/11/12/18 · 16 + בדיקות חוצות-דפים), ממוזגות ב-`--no-ff` לענף
  `feature/schedule-print-integrated-2026-10-02`; תיקוני המעטפת המשותפים `82dacfac` ואחרי הבדיקה הסופית (text-align, שולי עמוד במצב כהה);
  harness משולב `fd9afa9f`, `b72b3464`.

## 11. מצב הזמנה בודדת (`orderId`) - כרטיס ההזמנה החדש (W7, A3/A4)

מתפריט ההדפסה של כרטיס ההזמנה החדש (`app/components/order-card/parts/OcPrintMenu.js`) נפתחים שני דפי הלו״ז **להזמנה אחת**, בלי קשר ליום:
`/schedule/print/PP-07?orderId=N&version=PP-07:b` (דף הכנה, גרסה ב׳, ברקוד `PRP-N`) ו-`/schedule/print/PP-12?orderId=N` (תעודת משלוח, ברקוד `DOT-N`).

- **API:** `GET /api/schedule/print?page=PP-07|PP-12&orderId=N` (`format=json` בלבד). רק PP-07 ו-PP-12 (אחרת 400); `orderId` שגוי = 400 (לא מתעלמים בשקט);
  הזמנה לא קיימת = 404; PP-12 להזמנה בלי משלוח הלוך / כש-`enable_deliveries` כבוי = 400; PP-07 מקבל גרסה ב׳ בכפייה. אותם שערים כמו כל דף (`page:schedule`, ו-PP-12 גם `page:deliveries`).
- **הנתונים:** `lib/schedule/print/singleOrder.js` טוען את ההזמנה (findUnique אחד) ובונה "יום" סינתטי באותה צורה ש-`getScheduleDay` מחזיר - שורת שלב ההכנה דרך `buildEventStageRow` של הלו״ז עצמו, ושורת המשלוח באותם שדות כמו `deliveryRow`. כך ההזמנה מודפסת גם כשהיום אינו יום ההכנה
  וגם כששלב ההכנה כבוי בהגדרות הלו״ז. התאריך שבכותרת = יום ההכנה / יום יציאת המשלוח המחושב מתאריך האירוע (או היום כשאין תאריך אירוע). `meta.orderId` נושא את מספר ההזמנה.
- **רישום בהיסטוריה (AMB-20, החלטת הבעלים - מחליפה את ברירת המחדל של התכנית):** דף ההדפסה רושם `ORDER_PRINTED` דרך `POST /api/orders/events` (העוזר היחיד `writeOrderEvents`,
  INSERT אחד לכל קבוצה של עד 200 הזמנות), פעם אחת בטעינה שמדפיסה בפועל (לא ב-`downloadPdf=true`, לא ב-`preview=1`, לא בדפדפן ראש-חסר):
  - **עם `orderId`:** אירוע אחד להזמנה - `{doc:'prep'|'delivery', sheet, source:'print-page', batch:false}`.
  - **הדפסת יום (בלי `orderId`):** אירוע בהיסטוריית **כל הזמנה שמופיעה בכל דף** שבמסמך - `{doc, sheet, source:'print-page', batch:true, count:<הזמנות בדף>}`; PP-07 = `prep`, PP-12 = `delivery`,
    כל דף אחר = `doc:'schedule'` + `sheet` (חוזה W0 הורחב: `SCHEDULE_SHEET_KEYS`). מספרי ההזמנות נאספים מנתוני הדף עצמו (`collectPrintedOrderIds`); `clientEventId` נפרד לכל דף ולכל קבוצה.
  - נפח: הדפסת יום של 40 הזמנות = 40 שורות AuditLog ב-INSERT אחד (דף עם 400 הזמנות = 2 בקשות). ההיסטוריה מציגה "הודפס דף הכנה (הדפסת יום)".
- **PDF (תעודת משלוח כצרופת מייל מהיר):** `POST /api/pdf {path:'/schedule/print/PP-12?orderId=N&downloadPdf=true'}` - הנתיב כבר מותר (`printPathPageKeys`).
- קבצים: `lib/schedule/print/orderMode.js` (טהור: פרמטר, כתובות, גוף האירוע), `lib/schedule/print/singleOrder.js` (שרת), בדיקות `scripts/schedule-print-tests/order-mode.test.mjs`.
