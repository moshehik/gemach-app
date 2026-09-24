# חוזה: `/print/alterations` — דוחות תיקונים / תוויות תופרות (הדפסה)
קובץ: `app/print/alterations/page.js` (713 שורות, `'use client'`). משטח הדפסה (ראו print-order.md: צבעים קשיחים, `@media print`).

## 1. מטרה וגישה
דוחות להדפסה: "רשימת תיקונים לביצוע", "כל התיקונים", "רשימת הזמנות ללא תיקונים", "דוח הזמנות כללי", "תוויות לתופרות". נפתח מ-`PrintWizardModal` (`app/components/PrintWizardModal.js:129-181`) ב-`window.open('/print/alterations'+query,'_blank')`, או כ-PDF דרך `POST /api/pdf` `{path:'/print/alterations?...&downloadPdf=true'}` (Puppeteer; `ALLOWED_URL_PATHS`). `PrintWizardModal` (ה-אשף) מחוץ להיקף החוזה הזה אבל הוא היחיד שיוצר את ה-URL.

## 2. URL params
| param | ברירת מחדל | משמעות |
|---|---|---|
| `reportType` | `alterations_pending` | `alterations_pending` / `alterations_all` / `orders_no_alterations` / `orders_all` / `labels` |
| `dateMode` | `today` | `today` ⇒ start=end=`new Date().toISOString().split('T')[0]` (**UTC**, לא ישראל!); `custom` / `current` |
| `startDate`, `endDate` | — | `YYYY-MM-DD` (מתעלמים אם יש `orderIds`) |
| `orderIds` | — | רשימת מזהים מופרדת בפסיק (רק `dateMode=current`); גובר על התאריכים — הדוח תואם למה שמוצג במסך |
| `downloadPdf` | false | `'true'` ⇒ **לא** מפעיל `window.print()`; רק מסמן `data-print-ready` ל-Puppeteer |

## 3. State
`items`, `loading`, `error`, `enableAlterations` (true; `enable_alterations==='false'` ⇒ false ומוצגת הודעה "מערכת התיקונים מכובה בהגדרות. לא ניתן להפיק דוח תיקונים."), `printSettings` (`gmach_name`/`gmach_address`/`gmach_phone`/`main_email`), `logoBust`.

## 4. קריאות רשת
| Method+URL | הערות |
|---|---|
| `GET /api/alterations?showOnlyPending={reportType∈(alterations_pending,labels)}&hideNoAlterations={reportType==='orders_no_alterations'}&showAllOrders={reportType==='orders_all'}` + (`&orderIds=..` **או** `&startDate=..&endDate=..`) | במקביל ל-settings; `!ok` ⇒ `Error('Failed to fetch data')`. **שים לב:** אין `hideTakenReturned` (בניגוד למסך `/alterations` — ראו `buildAlterationsListUrl` ב-prefetchRoutes) — דוחות לא מסננים פריטים שנלקחו/הוחזרו |
| `GET /api/settings` (`no-store`) | כנ"ל; אם תיקונים כבויים ⇒ מסיים בלי לטעון alterations |
| `POST /api/log-visit` `{pageUrl:'[הדפסת דוח] {כותרת} (תאריכים: s - e)'}` | אחרי טעינה מוצלחת (גם `items` ריק) |
| `GET /api/logo?v=` | onError מסתיר |
הדפסה אוטומטית 1000ms (רק `!downloadPdf`, `!loading && !error`). `data-print-ready` על `[data-agy-id=print-alterations-container]` כש-`!loading`.

## 5. מבנה
מעטפת `table`: **thead** (חוזר בכל עמוד): בס"ד, `.print-header` (לוגו, שם גמ"ח, כתובת|טלפון|דוא"ל), `.report-title-block` (`h2` כותרת דוח לפי `reportType`; `h3` "תאריך: {היום העברי}" (today) / "הנתונים המוצגים כעת (לפי הסינון הנוכחי)" (orderIds) / "מתאריך: ... | עד תאריך: ..."; שורת סיכום "N הזמנות | M פריטים" כש-`items.length>0`), **tfoot** רווח 30px, **tbody** — תוכן לפי סוג.
### 5.1 מיון (Access legacy — חוזה)
- `labels`: תאריך אירוע → דגם (`dressLabelOf`, `numeric`) → מידה → לקוח.
- אחרים: תאריך אירוע → לקוח → מס' הזמנה → דגם → מידה. `localeCompare(...,'he')`.
- קיבוץ לפי `toIsraelDateKey(order.eventDate)` (`Asia/Jerusalem`, `en-CA`); בלי תאריך ⇒ "ללא תאריך". `dressLabelOf`: `{dressModelName||dressItem.dress.name||dressName||description} - {prefix}` / רק שם / `דגם {prefix}` / `-`. `sizeLabelOf`: `sizeText||size||dressItem.sizeText||'-'`. `lengthAltOf`: ריק/`'null'`/`'0'` ⇒ ''.
### 5.2 `reportType='labels'` — תוויות
לכל קבוצת תאריך: `h3.group-title` "תאריך אירוע: {eventDateHebrew || עברי מהתאריך}"; גריד **4 עמודות** (`repeat(4,1fr)`, gap 8px) של `.label-card`: "בס"ד" קטן, שם לקוח, "דגם: X", "מידה: Y", שורת תיקונים (`צוואר: הצרה N | שרוול: הארכה N | אורך: X`, מפרידים " | ") + "פירוט: {alterationDetails}". ריק: "לא נמצאו תיקונים להדפסה".
### 5.3 שאר הדוחות
לכל קבוצת תאריך: `h3.group-title` "{יום-בשבוע} - {תאריך עברי}" (`weekdayOf` — `he-IL` weekday ב-UTC בצהריים); לכל הזמנה `.order-block`: כותרת (שם | טלפון `dir=ltr` | "הזמנה מס' N"), הערות אם יש, טבלה: דגם שמלה / מידה / כמות / [אם `showAlterationCols` (⇔ `reportType!=='orders_no_alterations'`): תיקון צוואר ("הצרה N") / תיקון אורך / תיקון שרוול ("הארכה N") / תיאור תיקון] / [אם `showDoneCol` (⇔ `alterations_all`||`orders_all`): "בוצע" ✔]. בסוף קבוצה (אם `showAlterationCols`) `.date-summary`: "כמות תיקוני צוואר: A | כמות תיקוני אורך: B | כמות תיקוני שרוול: C" (סכום `quantity||1` לפריט עם תיקון>0). ריק: "לא נמצאו רשומות".
### 5.4 תחתית
`.print-footer` מחוץ לטבלה: "הופק על ידי מערכת גמ"ח שמלות בתאריך: {עברי}".

## 6. CSS הדפסה (חוזה)
`@page A4 portrait margin 15mm`; `.print-table thead{table-header-group}`; `.print-table tr,.order-block,.date-summary{break-inside:avoid}`; `.group-title,.print-header,.report-title-block{break-after:avoid-page}`; הסתרה: `nav.navbar,.topbar,.dev-env-container,.offline-indicator,.ai-floating-widget` (+ sidebar selectors על המסך). דריסת `.print-table th` נגד sticky-header של globals. פונטים David Libre / Frank Ruhl Libre (Google Fonts). `.label-card` `page-break-inside:avoid`, גודל צומצם (דיווח לקוח "תוויות גדולות מדי").

## 7. מלל
כותרות דוחות (5), כותרות עמודות (10), תוויות label (דגם/מידה/פירוט), שורות סיכום, הודעות ריק/כבוי/טעינה. הכל תוכן מודפס — שכתוב רק באישור.

## 8. Risk notes
1. `dateMode=today` משתמש בתאריך **UTC** (`toISOString`) — בין 00:00–03:00 בישראל נותן "אתמול". לשמר או לדווח (R8: לא מתקנים כאן).
2. `orderIds` גובר על תאריכים — חייב להישמר; ה-effect תלוי ב-`[reportType,startDate,endDate,orderIds]`.
3. `downloadPdf=true` מדלג על הדפסה — חובה לשמר עבור `/api/pdf`.
4. ה-`<style>` בתוך `.print-container` (בתוך div) ולא ב-`<head>` — עובד; אל תעביר ל-CSS גלובלי בלי לבדוק את דריסת `th`.
5. `mailer`: `app/api/orders/[id]/email/route.js:289` מזכיר "same convention" מול הדף — לתאם.
6. סמנטיקה של `neckAlteration/sleeveAlteration` **מספרית** כאן ("הצרה N"/"הארכה N") לעומת בוליאנית ב-`print/order`.
7. R17: טלפון עם `unicodeBidi:embed` — לשמר את הכיווניות.
