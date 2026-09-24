# חוזה: `/print/delivery-courier` — נתונים למשלוחן
קובץ: `app/print/delivery-courier/page.js` (119 שורות, `'use client'`), לוגיקת קיבוץ: `lib/deliveryCourier.js` (`groupDeliveryRowsForCourier`, `isoRangeToDates`, `buildCourierGroupTitle`). משטח הדפסה A4 **לאורך**.

## 1. מטרה וגישה
טבלת שם/כתובת/2 טלפונים לכל קבוצת (כיוון + תאריך אירוע [+ יום יציאה]) בטווח נבחר. נפתח מ-`app/deliveries/page.js:97`: `window.open('/print/delivery-courier?direction={out|return|both}&from=YYYY-MM-DD&to=YYYY-MM-DD','_blank')`. גם `app/api/deliveries/courier-email/route.js` מקבץ באותה לוגיקה (מייל למשלוחן) — לתאם שינויים.

## 2. URL params
`direction` (`out`/`return`/`both`; ערך אחר ⇒ `both`), `from` (`YYYY-MM-DD`), `to` (ברירת מחדל = `from`). `isoRangeToDates` ריק ⇒ שגיאה "טווח תאריכים לא תקין".

## 3. קריאות רשת
| Method+URL | הערות |
|---|---|
| `GET /api/deliveries?date=YYYY-MM-DD` (`no-store`) **לכל יום בטווח** (N קריאות במקביל) | `{data:[row]}`; כשל ליום בודד נבלע (שורות ריקות); ⇒ `{dispatchDate, rows}` |
| `GET /api/settings` (`no-store`) | `gmach_name` בלבד (ברירת מחדל `גמ"ח שמלות`) |
הקיבוץ בצד לקוח (`groupDeliveryRowsForCourier(rowsByDispatchDate, direction)`): לכל שורה × כיוון ב-`row.directions` (מסונן לפי `direction`); מפתח = `direction|eventDateKey[|dispatchIso]` כש-`eventDateKey` = יום קלנדרי ישראלי (`en-CA`, `Asia/Jerusalem`); כשמצב `deliveries_select_by_event_date` דולק השרת מחזיר `row.dispatchDates` ויום היציאה משתנה לכל שורה. כותרת קבוצה מ-`buildCourierGroupTitle`.
הדפסה אוטומטית 400ms כש-`!loading && !error && groups.length>0`. אין `data-print-ready`.

## 4. מבנה
`.print-container` (max 900px): `h1` `{gmachName} — נתוני משלוחים למשלוחן`; מצבים: טעינה "טוען נתונים..."; שגיאה; ריק "אין משלוחים בטווח/כיוון שנבחרו."; לכל קבוצה `div.courier-group`: `h2` = `group.title` + טבלה `courier-table`: **שם מלא** (`customerName`), **כתובת** (`address||'-'`), **טלפון 1**, **טלפון 2** (`dir=ltr`, `'-'` אם חסר). מפתח שורה `orderId`.

## 5. CSS
`@page A4 portrait margin 10mm`; `.courier-group{break-inside:avoid}` (קבוצה שלמה בעמוד אחד); הסתרת sidebar/topbar; גבולות `#ccc`, כותרת `#f0f0f0`; פונט David Libre.

## 6. Risk notes
1. `.courier-group{break-inside:avoid}` — קבוצה ארוכה מעמוד תיחתך; לשמר את ההתנהגות הקיימת.
2. בלי `data-print-ready`.
3. אל תשנו את סדר/מפתח הקיבוץ — משמש גם להדפסה וגם למייל.
4. מלל מודפס: כותרת H1 ושמות עמודות (אפשר לשכתב רק באישור; משתמשים במשלוחן חיצוני).
5. R17: טלפונים `dir=ltr`.
