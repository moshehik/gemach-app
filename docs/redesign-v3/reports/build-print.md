# דוח בנייה: דפי הדפסה (`app/print/**`) — ענף `redesign/site-v3-pages-print`

## עיקרון
החלטה Q5: מסמך ההדפסה נשאר ניטרלי (צבעים קשיחים, David Libre, בלי tokens, בלי ערכת נושא, בלי מצב כהה).
בפועל אין בדפים האלה סרגל מסך/כפתורים קיימים (ההדפסה אוטומטית) — לכן נוסף **רכיב מסך יחיד** ואליו בלבד הוחל שפת v3.

## מה נוסף
- `app/print/PrintToolbar.js` — סרגל מסך בלבד: כותרת "תצוגה מקדימה להדפסה" + הסבר קצר, כפתור ראשי "הדפסה" (`window.print()`, איקון `print`) וכפתור שקט "סגירה" (`window.close()`). רכיבי v3 `V3Page`/`Btn` (איקונים מונפשים), מסגרת דקה `--v3-line-soft`, RTL, `@media print { display:none !important }`. הסרגל יושב **מחוץ** למכולה עם `data-print-ready`.
- שם המחלקות `ptb-*` (ללא המחרוזת "sidebar" — הדפים מסתירים `[class*="sidebar"]`).

## צ'קליסט לכל דף
| דף | שונה | במכוון לא שונה |
|---|---|---|
| `/print/order` | הוספת `<PrintToolbar/>` לפני המכולה + import | `data-agy-id="print-order-container"`, `data-print-ready`, כל ה-CSS/`@page`/שבירות עמוד, `@import` הגופנים, צבעים קשיחים, כל ה-fetch (orders/settings/missing-dresses/log-visit/logo), הדפסה אוטומטית 1000ms, `formatPaymentNotes`, לוגיקת תאריכים, כל מלל המסמך |
| `/print/alterations` | עטיפת ה-return ב-Fragment + `<PrintToolbar/>` | `data-agy-id="print-alterations-container"`, `data-print-ready`, `downloadPdf`, תאריך UTC ל-`dateMode=today` (לא תוקן), מיון/קיבוץ, כל ה-fetch, CSS הדפסה, כל מלל המסמך |
| `/print/delivery-bag` | `<PrintToolbar/>` אחרי ה-`<style>` | A4 לרוחב, גדלי גופן 46/30/26 (שימושיות פיזית), `dir=ltr` לטלפונים, שדות "שקית __ מתוך __", אין `data-print-ready` (כמו קודם), fetch זהה |
| `/print/delivery-courier` | `<PrintToolbar/>` אחרי ה-`<style>` | קיבוץ (`lib/deliveryCourier`), `break-inside:avoid`, כותרות עמודות, fetch זהה (N קריאות + settings) |

## לא נעשה (בכוונה)
- לא הוחלף פונט המסמך ל-Rubik/tokens, לא שונו רקעי דף (`#fafafa`) ולא מסגרת ה"נייר" — כדי לא לשנות PDF/הדפסה או התאמה למייל (`api/orders/[id]/email`).
- לא נכתבו מחדש טקסטי המסמך (חוזי print-* אוסרים ללא אישור); רק מלל הסרגל החדש.
- איקוני v3 מונפשים רק בסרגל (המסמך עצמו סטטי — ICONS-USAGE).

## ספקות
1. אימות: בסביבת העבודה אין `node_modules`, לכן ה-build המלא לא הורץ; רק בדיקת תחביר TS (0 שגיאות) על 5 הקבצים. יש להריץ `next build`/דפדפן לפני מיזוג, ובפרט לוודא ש-`/api/pdf` עדיין מוציא PDF בלי הסרגל (`page.pdf` = מדיית print).
2. ייבוא `tokens.css`/`components.css` (דרך `V3Page`) מוסיף CSS לדפי ההדפסה; כללי `:root` שם רק מגדירים משתנים, אבל `components.css` כולל כללי `button:active`/`body:has(...)` גלובליים — לא משפיעים על המסמך, ראוי לעין בבדיקה חזותית.
3. `window.close()` עובד רק בטאב שנפתח ב-`window.open` (כל המקורות הקיימים כך); בפתיחה ישירה הכפתור לא יעשה כלום.
4. `/print/delivery-*` אינם ב-`ALLOWED_URL_PATHS` של PDF (מחוץ להיקף).
