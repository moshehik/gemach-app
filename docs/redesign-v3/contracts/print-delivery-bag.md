# חוזה: `/print/delivery-bag` — נתונים לשקית (משלוחים)
קובץ: `app/print/delivery-bag/page.js` (142 שורות, `'use client'`). משטח הדפסה A4 **לרוחב**.

## 1. מטרה וגישה
עמוד A4 לרוחב לכל הזמנה עם משלוח **הלוך** בתאריך נבחר, להדבקה על שקית האריזה. נפתח מ-`app/deliveries/page.js:92` (`printAction==='bag-label'`): `window.open('/print/delivery-bag?date=YYYY-MM-DD','_blank')`. תלוי בפיצ'ר המשלוחים (`enable_deliveries` — nav gate `showDeliveries`). אין gate בדף עצמו.

## 2. URL params
`date` — `YYYY-MM-DD` חובה. לא תקין (`/^\d{4}-\d{2}-\d{2}$/`) ⇒ שגיאה "תאריך לא תקין" (אין קריאת רשת).

## 3. קריאות רשת
| `GET /api/deliveries?date={date}` (`no-store`) | תשובה: `{data:[row], selectByEventDate}`; מסנן `row.directions.includes('out')`; `selectByEventDate`→`setSelectByEventDate`. כשל ⇒ "שגיאה בטעינת נתוני המשלוחים". |
|---|---|
שדות שורה בשימוש: `orderId`, `customerFirstName`, `customerLastName`, `address`, `customerPhone`, `customerPhone2`, `eventDate`, `eventDateHebrew`, `dispatchDates.out`, `notes`. אין קריאת settings.
הדפסה אוטומטית 400ms כש-`!loading && !error && rows.length>0`. **אין** `data-print-ready` (לא נגיש ל-`/api/pdf` — לא ב-allowlist).

## 4. מבנה (עמוד לכל הזמנה, `.bag-label-page`, מפוצל `break-after:page`)
1. שם: `{first} {last}` (46px, מודגש).
2. כתובת: `address || '-'` (30px).
3. טלפונים: עד שניים, `dir=ltr` (26px, gap 40px).
4. "תאריך אירוע:" `{יום-שבוע מלא} {eventDateHebrew} ({לועזי he-IL Asia/Jerusalem})`.
5. אם `dispatchDates.out`: "משלוח יוצא: {יום מלא} {תאריך he-IL}" (`isoToLocalDate` מונע הזזת יום).
6. "שקית ____ מתוך ____" — 2 קווים ריקים למילוי בכתב יד (אין נתון מספר שקיות במערכת).
7. "הערות:" `notes` (`white-space:pre-wrap`) אם יש.
מצבים: טעינה "טוען נתונים..."; שגיאה (אדום); ריק: "אין משלוחי הלוך לאירועים בתאריך זה." (אם `selectByEventDate`) / "אין משלוחי הלוך בתאריך זה.".
פונקציות: `getHebrewWeekdayFullName` מ-`lib/hebrewDate`.

## 5. CSS (חוזה)
`@page{size:A4 landscape;margin:10mm}`; במסך `.bag-label-page` ברוחב 277mm; בהדפסה `width:100%`, `height:calc(100vh - 20mm)`, `break-after:page` (חוץ מהאחרון); הסתרת `nav.navbar,.topbar,.ai-floating-widget,[class*=sidebar]`. צבעים קשיחים; פונט David Libre (ללא `@import` בדף הזה — נופל ל-Times/serif).

## 6. Risk notes
1. אין `data-print-ready`; אם ירצו PDF — להוסיף גם ל-`ALLOWED_URL_PATHS` (שינוי API — מחוץ להיקף).
2. גדלי הגופן (46/30/26) הם חלק מהשימושיות הפיזית (קריאה מרחוק על שקית) — לא לצמצם לפי scale של ה-tokens.
3. הפרדת `dir=ltr` לטלפונים חובה ב-RTL.
4. תאריך אירוע: `eventDate` נשמר כ-`T21:00Z` — הפורמט משתמש `timeZone:'Asia/Jerusalem'`; לשמר.
5. מלל: כל התוויות מודפסות; "שקית/מתוך" — שדה פיזי.
