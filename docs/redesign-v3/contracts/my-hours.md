# חוזה: `/my-hours` — "שעות העבודה שלי"
קובץ: `app/my-hours/page.js` (112 שורות, client, אין layout/PageGate). בסיס להתאמה 100% (R24). קוסמטי בלבד (R8).

## א. תכלית והרשאות
- עובד רואה את משמרות העבודה **שלו בלבד** לפי חודש לועזי + סה"כ שעות לחודש. בלי שכר/עובדים אחרים (page.js:14-15).
- אין מפתח הרשאה ב-`lib/permissionsMetadata.js` ואין `PageGate`. גישה = עוגיית auth תקפה; ה-API מחזיר 401 אחרת.
- כניסה: קישור ב-`app/components/UserMenu.js:192` (`router.push('/my-hours')`).

## ב. אזורים לפי סדר
1. `page-head` (:60-65): `<h1>` + `page-desc`.
2. כרטיס סינון (:67-79): select חודש, select שנה, סה"כ החודש (`marginInlineStart:auto`, bold).
3. גוף (:81-109): ספינר טעינה (`shifts===null`) או טבלת `data` בתוך `table-wrap`.
- מצב "לא מחובר" (:54-56): מחליף את כל העמוד ב-`div.empty-state` בלבד (בלי כותרת).

## ג. שדות
| תווית | state | ערכים/פורמט |
|---|---|---|
| (select חודש, בלי label) :69 | `filterMonth` (int 0-11), ברירת מחדל `new Date().getMonth()` | `MONTH_NAMES` (:5) ינואר..דצמבר; `parseInt(value,10)` |
| (select שנה, בלי label) :72 | `filterYear`, ברירת מחדל שנה נוכחית | אפשרויות = `years` (useMemo :47): סט של שנה נוכחית + שנות כל המשמרות, מיון יורד |
- ולידציה: אין. אין שדות חובה.
- סינון (:37-43): `new Date(shift.date)` `.getMonth()/.getFullYear()` מול הסטייט (זמן מקומי של הדפדפן, **לא** Israel-TZ — התנהגות קיימת, לא לשנות).
- סה"כ החודש (:45, :76): סכום `totalMinutes||0` של המשמרות המסוננות, `formatHoursMinutes` (:7-12) => `H:MM` (דקות ב-padStart 2) + הטקסט "שעות".

## ד. כפתורים/פעולות
אין כפתורים. רק שני `onChange` של ה-selects (setFilterMonth/Year).

## ה. קריאות רשת
| # | שיטה+URL | טריגר | שימוש בתשובה | מטמון |
|---|---|---|---|---|
| 1 | `GET /api/me/shifts` (:23) | useEffect ב-mount יחיד (deps `[]`) | 401 -> `setNotLoggedIn(true)`; אחרת `data.success` -> `setShifts(data.shifts)`; `catch(()=>{})` שקט (נשאר ספינר לנצח) | אין pageCache/apiCache/prefetch |
- צורת התשובה (route): `{success, shifts:[{id,date,hebrewDate,entryTime,exitTime,totalMinutes}]}` ממוין `date asc, entryTime asc`, `isDeleted:false`, של העובד המחובר (`getVerifiedAuthCookie`).

## ו. חלוניות/טוסטים/אישורים
אין.

## ז. מצבים מיוחדים
- טעינה: `shifts===null` -> `div.page-loading` + `span.spinner.lg`. הכרטיס והסינון מוצגים גם בזמן טעינה (סה"כ = 0:00).
- ריק: שורת `td colSpan=4 .empty-cell` "אין משמרות בחודש זה" (:103-105).
- שגיאת רשת / success=false: אין הודעה; ספינר נשאר.
- לא מחובר: :54.
- אין תלות ב-SystemSetting ואין הבדל נווה יעקב/ראשי.

## ח. URL / localStorage / sessionStorage
אין.

## ט. הדפסה/ייצוא/AI
אין.

## י. מחרוזות (לכתיבה מחדש)
כותרת "שעות העבודה שלי"; תיאור "רשימת המשמרות שלך לפי חודש, כולל סה"כ שעות"; "סה"כ החודש: X שעות"; עמודות "תאריך / כניסה / יציאה / סה"כ שעות"; "אין משמרות בחודש זה"; "יש להתחבר כדי לצפות בשעות העבודה שלך."; חודשים (12).

## יא. עמודות טבלה (פורמט מדויק)
- תאריך: `shift.hebrewDate || new Date(shift.date).toLocaleDateString('he-IL')` (:97).
- כניסה/יציאה: `toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})` או `'-'` אם ריק (:98-99).
- סה"כ שעות: `formatHoursMinutes(totalMinutes)` או `'-'` אם 0/ריק (:100).
- key = `shift.id`.

## יב. Risk notes
- ה-early-return של notLoggedIn (:54) בא אחרי כל ה-hooks — לא להזיז hooks מתחתיו.
- `years` נגזר מכל המשמרות — חייב לכלול שנה נוכחית גם כשאין משמרות.
- הסה"כ מחושב מהמסוננות; שמרו `H:MM` (לא עשרוני).
- אין label ל-selects (R18 דורש aria-label — הוספה מותרת, קוסמטית).
- 4 עמודות בלבד, כולן נחוצות (R16).
