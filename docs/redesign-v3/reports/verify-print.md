# אימות family=print — `origin/redesign/site-v3-pages-print` מול `origin/main`

## פסק דין: ✅ תואם 100% (עם הערות לא חוסמות)

מסמכי ההדפסה זהים ב-JSX, בלוגיקה ובנתונים. השינוי היחיד בקבצי `app/print/**`: `import PrintToolbar` + `<PrintToolbar />` (+ עטיפת Fragment ב-alterations). אין שינוי ב-`lib/`, `app/api/`, `app/layout.js`, `globals.css`, `AppShell`.

## ראיה — diff ללא רווחים (old vs new, בכל 4 הדפים)
```
order:            > import PrintToolbar ...   > <PrintToolbar />
alterations:      > import PrintToolbar ...   > <>  > <PrintToolbar />  > </>
delivery-bag:     > import PrintToolbar ...   > <PrintToolbar />
delivery-courier: > import PrintToolbar ...   > <PrintToolbar />
```
`git diff --name-status` בתחום app/components/lib: קבצים חדשים `app/print/PrintToolbar.js`, `app/v3/**`, `app/v3-gallery/**`; קבצים שונו: 4 דפי print + `app/version.json` (הערה: version.json מחוץ להיקף, נראה כבליעת bump אוטומטי). `@babel/parser` על 5 הקבצים: OK.

## טבלת חוזה
| פריט | קיים? | זהה? |
|---|---|---|
| print-order: `data-agy-id="print-order-container"`, `data-print-ready={loading?undefined:'true'}` (order/page.js:937-940 חדש) | כן | זהה, על ה-div של המסמך; התולבר (שורה 934) אח לו ולא בתוכו |
| print-alterations: `data-agy-id` + `data-print-ready` (alterations/page.js:220-225) | כן | זהה; ה-toolbar אח קודם (218), מחוץ לקונטיינר, ה-`<style>` המקומי עדיין בתוכו |
| delivery-bag: אין `data-print-ready` (לפי החוזה) — נשאר כך; `.bag-label-page:last-child` לא מושפע (toolbar קודם) | כן | זהה |
| delivery-courier: אין `data-print-ready`; `.courier-group` break-inside | כן | זהה |
| state / effects / fetch / auto-print (1000/400ms, `downloadPdf`) | כן | לא נגעו (diff ריק מחוץ להוספות) |
| `@page` / צבעים קשיחים / פונטים / כל ה-`@media print` | כן | זהה (בתוך ה-style של כל דף, לא נגעו) |

## בדיקות מיוחדות
1. **PrintToolbar מוסתר בהדפסה/PDF:** `@media print { .ptb-bar { display:none !important } }` (PrintToolbar.js:23). `lib/pdf.js` (לא שונה) משתמש ב-`page.pdf` עם `printBackground:true, preferCSSPageSize:true`, ואין `emulateMediaType('screen')` (grep) — ברירת המחדל של pdf היא media print, לכן הסרגל `display:none` ולא תופס מקום/עמוד. `data-print-ready` לא בתוכו ולא בתוך משהו מוסתר. `ALLOWED_URL_PATHS` = order+alterations בלבד (לא שונה); delivery-* לא ב-PDF. שמות המחלקות `ptb-*` (בלי "sidebar") — כללי ההסתרה `[class*="sidebar"]` לא פוגעים בהם/בסרגל.
2. **דליפת CSS של v3 לדף ההדפסה:** `V3Page` מייבא `tokens.css`+`components.css` (ו-`Icon` את `icons.css`) — הם נטענים גלובלית ב-route. סקריפט ניתוח סלקטורים (926 כללי components, 63 icons, 3 tokens):
   - כל הכללים תחומים ל-`[data-v3]` / `.v3-*` / `.v3n*`, למעט: `:root,[data-v3]{--v3-*}` (246 הצהרות, **כולן custom properties**, אפס non-custom) ; `:root{--v3-dir}` ו-`[dir=rtl]{--v3-dir}` (משתנים בלבד); `@property --v3-a`; `@keyframes` (שמות v3-*); `:where([class*="v3-"]){box-sizing}` — אין בדפי print אף class שמכיל `v3-` (grep) מחוץ לסרגל; `body:has(.v3-scrim.is-on) .v3-toast{z-index}` — לא רלוונטי.
   - כללי `body/font/background/color/direction` של v3 יושבים על `[data-v3]` בלבד = ה-div של הסרגל, לא ה-body ולא המסמך. לכן אין שינוי ב-page size / margins / צבעים / רקעים / פונטים בפלט. `[data-v3-mode="dark"]` רק אם מוגדר attribute (לא מוגדר).
   - הסרגל עצמו לא מחזיק `@page`.
3. **JSX של המסמכים זהה** (ראה diff למעלה).

## פערים חוסמים
אין.

## הערות לא חוסמות
- **[Icon]** `Icon name="print"` מתורגם ל-`i-printer` (קיים ב-`IconSprite` של main), `close`→`i-x` (קיים). `IconSpriteV3` בסרגל הוא `display:none` ולא מכיל את אלה — תלוי ב-`<IconSprite/>` מה-layout, שנטען גם ב-routes של print (AppShell/layout ללא שינוי). לוודא בדפדפן שהאיקונים מוצגים.
- על המסך (לא בהדפסה) הסרגל מוסיף בלוק מעל המסמך (max-width 960, margin-top) — שינוי חזותי מכוון; ב-order ה-`.print-container` בעל `margin:40px auto`, כך שיש רווח כפול קל.
- `window.close()` בכפתור "סגירה" עובד רק לחלון שנפתח ב-`window.open` (כל המקורות בחוזה פותחים כך).
- `app/version.json` שונה בענף — לא קשור ל-print; לוודא שלא מתנגש במיזוג.
- בהדפסת PDF ה-CSS הגלובלי הנוסף (~1900 שורות) נטען ב-route; משפיע רק על משקל הטעינה (`networkidle0`), לא על הפלט.

## לא נבדק סטטית (דורש דפדפן)
- רינדור PDF בפועל דרך `/api/pdf` (עמודים/שוליים/רקעים זהים ללפני) — ההנחה מבוססת על ניתוח CSS ו-media print.
- הופעת הסרגל ואיקוניו על המסך; טריגר ה-`window.print()` האוטומטי בפועל בדפי delivery-*.
- ש-`window.print()` הידני מהסרגל מייצר פלט זהה (מבנית כן).
