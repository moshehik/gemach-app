# חוזה: `/punch-clock` — "שעון נוכחות"
קובץ: `app/punch-clock/page.js` (238 שורות, client). בסיס להתאמה 100% (R24).

## א. תכלית והרשאות
- רישום כניסה/יציאה של עובד: בוחרים עובד + סיסמה (או קוד מקוצר 4 תווים במחשב מערכת מהימן) ולוחצים כניסה/יציאה.
- **פתוח ללא התחברות בכוונה**: `app/layout.js:47-51` (`isPunchClock` לפי `x-pathname`) עוקף את מסך ההתחברות גם כש-`require_login` דלוק. אסור להוסיף PageGate/הגבלה, ואסור לעטוף בדבר שדורש session.
- מטא-דאטה: `lib/permissionsMetadata.js:~301` מפתח `page:punch_clock`, `enforced:false`, `notConfigurable`, ברירת מחדל true.
- ה-API (`app/api/attendance/route.js`): בלי `checkAuth()` גורף ב-POST; הסיסמה היא הזיהוי. בלי סיסמה -> רק העובד המחובר עצמו (401 אחרת, :100-109).

## ב. אזורים לפי סדר
1. `page-head` (:100-105): h1 + page-desc.
2. כרטיס ממורכז `maxWidth 420px` (:107-108):
   a. שעון חי (:110-116): אייקון `#i-clock` ב-`kpi-icon`, `kpi-value` (40px) עם `currentTime || '...'`, `kpi-label` "השעה כעת".
   b. שדה עובד (combobox) :118-178.
   c. שדה סיסמה :180-200.
   d. שורת שני כפתורים :202-225.
   e. callout סטטוס (מותנה) :227-232.

## ג. שדות
| תווית | state | פרטים |
|---|---|---|
| עובד (`#punch-clock-employeeSearch`, `data-element-name="שדה_punch-clock_1"`) | `employeeSearch` (טקסט), `employeeId` (string id נבחר), `isDropdownOpen` | text; placeholder "טוען רשימת עובדים..." בזמן `employees===null` אחרת "הקלד לחיפוש שם..."; `autoComplete="new-password"` (מוגדר פעמיים ב-:131,:143 — בכוונה, נגד dropdown native של כרום; דיווח 60de1c60). onChange: מעדכן חיפוש, פותח dropdown, **מאפס `employeeId=''`** (חובה לבחור מהרשימה). onFocus פותח; onBlur סוגר אחרי 200ms. |
| סיסמא / "סיסמא או קוד מקוצר (4 תווים)" (`#punch-clock-password`, `data-element-name="שדה_punch-clock_2"`) | `password`, `showPassword` | התווית תלויה ב-`deviceTrusted`; `type` password/text לפי `showPassword`; `dir="auto"`; placeholder "הזן סיסמא"; `autoComplete="new-password"`; ref `passwordInputRef` (focus אחרי בחירת עובד). כפתור עין `toggle-visibility` title "הצג סיסמה" (type=button) מחליף `showPassword`; אייקון `#i-lock` מוביל. |
- סינון רשימה (:38-39): `` `${firstName} ${lastName}`.includes(employeeSearch) `` (substring, case-sensitive).
- בחירת אופציה: `onMouseDown` + `preventDefault` (חובה, אחרת blur סוגר לפני בחירה): `employeeId=String(emp.id)`, `employeeSearch="first last"`, סוגר, focus לסיסמה. אייקון `#i-user` בכל אופציה.
- ולידציה בלבד ב-handlePunch (:42-45): `!employeeId || !password` -> `statusMessage='אנא בחר עובד והזן סיסמא'` (ללא קריאת רשת). שם שהוקלד ללא בחירה מהרשימה = לא נחשב.

## ד. כפתורים
| תווית | data-element-name | handler | הערות |
|---|---|---|---|
| כניסה (`btn btn-primary btn-lg`, אייקון `#i-check-circle`) | `כפתור_punch-clock_3` | `handlePunch('IN')` | `disabled={isLoading}`; בטעינה ספינר במקום אייקון |
| יציאה (`btn btn-danger btn-lg`, אייקון `#i-logout`) | `כפתור_punch-clock_4` | `handlePunch('OUT')` | כנ"ל; מפעיל בדיקת כובסת (ראו ה) |
| עין הצגת סיסמה | — | toggle `showPassword` | |
- אין form/submit: שני הכפתורים type=button; אין Enter-to-submit.

## ה. קריאות רשת
| # | שיטה+URL | טריגר | שימוש | מטמון |
|---|---|---|---|---|
| 1 | `fetchSharedJson('/api/employees', {ttl: TTL.STATIC})` (:29) | mount | Array -> `setEmployees(list)`, אחרת/שגיאה `[]` | `lib/apiCache` (משותף, TTL.STATIC); ה-URL הוא מפתח המטמון — לא לשנות (שונה מ-`/api/employees?all=true` של /employees) |
| 2 | `GET /api/auth/device-status` (:32) | mount | `setDeviceTrusted(!!data.trusted)`, שגיאה -> false | אין |
| 3 | `GET /api/settings` `{cache:'no-store'}` (:50) | רק ביציאה, לפני הרישום | מחפש `key==='laundress_return_check_on_exit'` עם `value==='true'` | ללא מטמון (בכוונה) |
| 4 | `GET /api/orders?filterStatus=archive&limit=50` `{cache:'no-store'}` (:54) | רק אם #3 דלוק | `d.data` מסונן: `items.some(i=>!i.isDeleted && i.isTaken && !i.isReturned)`; `.catch(()=>[])` | ללא |
| 5 | `POST /api/attendance` `Content-Type: application/json`, body `{employeeId, password, action:'IN'|'OUT'}` (:71-75) | כפתורים | `!res.ok` -> `שגיאה: ${data.error}`; הצלחה -> הודעה, איפוס שדות, מחיקת ההודעה אחרי 3000ms; חריג רשת -> "שגיאת תקשורת, אנא נסה שוב." | ללא |
- שגיאות שרת אפשריות (route): "עובד לא נמצא"(404), "סיסמה שגויה"(401), "קוד מקוצר אפשרי רק ממחשב מערכת מהימן - יש להזין את הסיסמה המלאה"(401), "חשבון העובד אינו פעיל"(403), "כבר נרשמה כניסה - יש לרשום יציאה קודם"(400), "לא נמצאה משמרת פתוחה לרישום יציאה"(400). מוצגות כפי שהן אחרי "שגיאה: ".
- try/catch של בדיקת הכובסת (:64) בולע שגיאות ומתקדם לרישום.

## ו. חלוניות / אישורים
- **אישור כובסת ביציאה** (:58-62): כש-`laundress_return_check_on_exit` דלוק ויש `overdue.length>0`: `window.customConfirm(...)` (נפילה ל-`window.confirm`). טקסט: "יש N משפחות שלא החזירו (לדוגמה: עד 5 שמות מופרדים בפסיק, `customerName||'?'`). האם לוודא שהן אכן לא החזירו?". דחייה -> `statusMessage='יציאה בוטלה - בדוק החזרות'` וחזרה בלי רישום. (`customConfirm` גלובלי מה-layout; R19: חלונית אישור = כהה+בהיר.)
- אין טוסט; ההודעה היא callout בעמוד.

## ז. מצבים מיוחדים
- טעינת עובדים: placeholder ייעודי + בתוך ה-dropdown שורת ספינר "טוען רשימת עובדים...".
- אין תוצאות: אופציה לא-לחיצה "לא נמצאו תוצאות".
- `isLoading` נועל שני הכפתורים; קריאות #3/#4 (כובסת) רצות **לפני** `setIsLoading(true)`, כלומר הכפתורים עדיין פעילים בזמן זה.
- שעון: `setInterval` 1s, `toLocaleTimeString('he-IL',{hour,minute,second: '2-digit'})`; לפני הטיק הראשון `...`.
- צבע ההודעה: `isError = statusMessage.includes('שגיאה')` קובע `callout-danger` + `#i-alert-circle` מול `callout-success` + `#i-check-circle`. הודעות "אנא בחר עובד והזן סיסמא" ו-"יציאה בוטלה - בדוק החזרות" אינן מכילות "שגיאה" ולכן מוצגות **ירוק** בפועל; "שגיאת תקשורת" ו-"שגיאה: ..." אדום. שמרו על ההתנהגות או דווחו על שינוי.
- הצלחה: `✅ כניסה נרשמה בהצלחה` / `✅ יציאה נרשמה בהצלחה`.
- הגדרות: `laundress_return_check_on_exit` (לפי ה-DB של כל גמח). `deviceTrusted` מנוהל ב-`/admin/trusted-devices`. אין קוד ייחודי לנווה יעקב בעמוד.
- אופליין: אין טיפול ייעודי בעמוד.

## ח. URL / storage
אין query params, אין localStorage/sessionStorage.

## ט. הדפסה/ייצוא/AI
אין.

## י. מחרוזות
כותרת "שעון נוכחות"; תיאור "בחירת עובד והזנת סיסמא לרישום כניסה או יציאה מהעבודה"; "השעה כעת"; "עובד"; placeholders; "סיסמא" / "סיסמא או קוד מקוצר (4 תווים)"; "הזן סיסמא"; title "הצג סיסמה"; "כניסה"/"יציאה"; "לא נמצאו תוצאות"; כל הודעות הסטטוס והאישור לעיל.

## יא. Risk notes
- בחירה חייבת להיות מהרשימה: `employeeId` מתאפס בכל הקלדה. ה-dropdown חייב `onMouseDown`+preventDefault ו-blur עם 200ms; החלפה ל-`onClick`/`<select>` תשבור.
- `autoComplete="new-password"` בשני השדות — לא להחליף ל-off.
- זיהוי שגיאה לפי `includes('שגיאה')` — שינוי מלל משנה צבע/סמנטיקה.
- `data-element-name` על 4 אלמנטים (בשימוש כלי דיווח) — לשמר.
- ההודעה נמחקת ב-`setTimeout` 3s (לא מנוקה ב-unmount); שדות מתאפסים רק בהצלחה.
- סדר: ולידציה -> (יציאה בלבד) settings -> orders -> confirm -> setIsLoading -> POST. לא לשנות.
- `password` נשלח ללא trim.
- העמוד חייב להישאר נגיש בלי session (ראו א').
