# חוזה עמוד: הפרופיל שלי — `/profile`

מקור: `app/profile/page.js` (313 שורות). אין `layout.js` ואין PageGate: כל עובד מחובר. נכנסים מ-`UserMenu.js:174` (`router.push('/profile')`). API: `app/api/me/profile/route.js`, `app/api/employees/[id]/password/route.js`.

## א. מטרה והרשאות
- עריכת פרטים אישיים של העובד המחובר בלבד (בלי שכר/תפקיד/AI/נוכחות). זיהוי בשרת רק לפי cookie (`getVerifiedAuthCookie`) — אין id בבקשה. 401/403 (לא מחובר / עובד לא פעיל) → מסך "לא מחובר".
- ללא cache/prefetch/localStorage.

## ב. אזורים לפי סדר
מצב loading → מצב לא-מחובר → מצב רגיל: `page-head` (כותרת, תיאור + badge מחלקה, כפתור חזרה) ← `form.card.card-pad > .form-grid` (שדות) ← כפתור שמירה.

## ג. שדות (ב-`.form-grid`; כולם `autoComplete="new-password"` חוץ מהסיסמאות)
| תווית | id / name | state | פורמט |
|---|---|---|---|
| שם פרטי | `profile-firstName` / `firstName` | `profile.firstName` | text |
| שם משפחה | `profile-lastName` / `lastName` | | text |
| שם מלא | `profile-fullName` / `fullName` | | text |
| תאריך כניסה לארגון | `profile-joinDate` | קריאה בלבד (`disabled`), `toLocaleDateString('he-IL')` או '—'; לא נשלח לשינוי | אייקון calendar |
| טלפון 1 | `profile-phone1` / `phone1` | | text, אייקון phone |
| טלפון 2 | `profile-phone2` / `phone2` | | text |
| מייל | `profile-email` / `email` | | `type=email` |
| עיר | `profile-city` / `city` | | text |
| רחוב | `profile-street` / `street` | | text |
| מספר בית | `profile-houseNum` / `houseNum` | | text |
| סיסמא לשעון נוכחות | `profile-pwDisplay` | `value="********"` disabled (תצוגה בלבד) | full-width |
| סיסמא ישנה | `profile-oldPassword` | `oldPasswordInput`, `showOldPassword` | type toggles password/text |
| סיסמא חדשה | `profile-newPassword` | `newPasswordInput`, `showNewPassword` | |
| תמונת פרופיל (העלאת קובץ) | `profile-avatarInput` (`type=file accept=image/*`, מוסתר; label=`upload-zone`) | `profile.profileImage` (data URL דרך `FileReader.readAsDataURL`) | מוצג רק אם `showProfileImage` |
| קבלת התראות למייל | `receiveEmailAlerts` checkbox | `!!profile.receiveEmailAlerts` (בוליאני) | |
- `handleChange` (52) גנרי לפי `name`; checkbox → `checked`.
- ולידציה בצד לקוח: אין (חוץ מסיסמה חדשה ריקה). בשרת: `PUT` מקבל רק רשימה סגורה של שדות מחרוזת: `firstName,lastName,fullName,phone1,phone2,email,emailSuffix,city,street,houseNum,profileImage` + `receiveEmailAlerts` בוליאני. סיסמה חדשה בשרת: חובה ואורך >=4 ("הסיסמה החדשה קצרה מדי"); סיסמא ישנה חובה אלא אם `mustResetPassword`.
- הטקסט "PNG או JPG · עד 5MB" מידעי בלבד — אין אכיפה בקוד.
- **גוף ה-PUT הוא כל אובייקט `profile`** כפי שנטען (כולל id, joinDate, department, וכו'; השרת מסנן).

## ד. כפתורים / פעולות
- חזרה (157): `router.back()` (איקון בלבד, title "חזרה").
- שמירה (`type=submit`, 306): `handleSave` — `disabled={saving}`, טקסט "שומר..."/"שמירת פרטים".
- "שינוי סיסמא" (239): `setShowChangePassword(true)` — פותח כרטיס inline (לא חלונית).
- טוגלי עין (249, 259): מציגים/מסתירים סיסמה (title "הצג סיסמה").
- "ביטול" (265): סוגר ומאפס שני שדות הסיסמה.
- "אשר שינוי" (266): `handlePasswordConfirm`.
- "הסר" תמונה (288, רק כש-`profile.profileImage`): מאפס `profileImage:''` (מקומי עד שמירה).
- העלאת קובץ: `handleAvatarUpload` → data URL. תצוגה: אם מתחיל ב-`data:image` → `<img>` עגול 56px, אחרת `avatar lg` עם ראשי תיבות (`initials` = אות ראשונה של firstName+lastName).

## ה. קריאות רשת
| # | שיטה+URL | trigger | גוף | שימוש בתשובה |
|---|---|---|---|---|
| 1 | `GET /api/settings` | mount (26-34) | — | מפתח `show_employee_profile_image`: `value!=='false'` → `showProfileImage` (ברירת מחדל true אם אין שורה); שגיאה מושתקת |
| 2 | `GET /api/me/profile` | mount (36-50) | — | 401/403 → `notLoggedIn`; אחרת `setProfile(data)` אם אין `data.error`; תמיד `loading=false` (גם בשגיאה → מסך לא-מחובר כי `profile` null) |
| 3 | `PUT /api/me/profile` | submit | `JSON.stringify(profile)` | `data.success` → `invalidate(['/api/me'])` (`lib/apiCache`) + `alert('הפרטים נשמרו בהצלחה!')`; אחרת `alert(data.error \|\| 'שגיאה בשמירת נתונים')`; catch: 'שגיאה בשמירת נתונים' |
| 4 | `POST /api/employees/${profile.id}/password` | "אשר שינוי" | `{oldPassword,newPassword}` | `success` → סוגר, מנקה, `alert('הסיסמא שונתה בהצלחה')`; אחרת `alert(data.message \|\| 'שינוי הסיסמה נכשל')`; catch 'שגיאה בשינוי הסיסמה' |
- cache: רק `invalidate(['/api/me'])` אחרי שמירה (כדי שתפריט משתמש/שם יתעדכנו).

## ו. הודעות
- כולן `window.alert` native: 'יש להזין סיסמא חדשה' (עוד לפני קריאה), הצלחה/כשלון שמירה, הצלחה/כשלון סיסמה. אין modal/toast/confirm.
- כרטיס שינוי סיסמה: בלוק inline מותנה `showChangePassword`, ב-`field` של הסיסמה.

## ז. מצבים מיוחדים
- loading (116): רק `page-head` עם "טוען נתונים..." (בלי טופס).
- לא מחובר / שגיאת טעינה (127): כרטיס עם "כדי לצפות בפרופיל האישי יש להתחבר למערכת עם המשתמש שלך."
- setting-driven: `show_employee_profile_image` מסתיר את כל בלוק התמונה (דיווח c764bef4). ללא הבדלי ארגון בקוד; ההגדרה פר-DB (main/Neve).
- badge מחלקה: `profile.department.name` אם קיים, ב-page-desc.
- הערה בקוד (228): בורר פלטה הוסר; עיצוב אישי ב-`/display-settings` — לא להחזיר.

## ח. URL / storage
- ללא query params, ללא localStorage/sessionStorage. `data-element-name` (ראו קוד: `כפתור_profile_back`, `שדה_profile_1..16`, `כפתור_profile_pw`, `_pw_cancel`, `_pw_ok`, `_img_rm`, `_save`) — אלה מזהי כלי בדיקה/דיווח; **לשמר**.

## ט. הדפסה/ייצוא/AI
- אין.

## י. מחרוזות
"הפרופיל שלי"; "טוען נתונים..."; "פרטים אישיים, אבטחה והעדפות תצוגה של המשתמש המחובר"; "חזרה"; "שם פרטי/שם משפחה/שם מלא/תאריך כניסה לארגון/טלפון 1/טלפון 2/מייל/עיר/רחוב/מספר בית"; "סיסמא לשעון נוכחות", "שינוי סיסמא", "סיסמא ישנה", "סיסמא חדשה", "הצג סיסמה", "ביטול", "אשר שינוי"; "תמונת פרופיל (העלאת קובץ)", "גרור/י תמונה לכאן או לחצ/י לבחירה", "PNG או JPG · עד 5MB", "לחיצה או גרירת קובץ להעלאת תמונת פרופיל", "הסר", "הסרת תמונת הפרופיל"; "קבלת התראות למייל"; "שמירת פרטים", "שומר..."; alerts ר' ה/ו; מסך לא-מחובר.

## יא. Risk notes
- ה-PUT שולח את כל אובייקט `profile` (כולל `profileImage` כ-data URL גדול) — לא לצמצם/לשנות שמות שדות (`name` attributes = מפתחות state).
- `handleChange` נשען על `name`/`type` של האלמנט: שינוי ל-Field מותאם חייב לשמר `name` ואירוע `target.checked`.
- הסיסמה משתמשת ב-`profile.id` (מה-GET); השרת מאמת מחדש מול cookie.
- `label htmlFor="profile-avatarInput"` + input מוסתר `display:none` — ה-upload-zone הוא label; לשמר קישור.
- `autoComplete="new-password"` על שדות רגילים כדי למנוע autofill דפדפן (ראו משוב login-autofill) — לשמר.
- הסתרת בלוק התמונה תלויה ב-`showProfileImage`; מצב ברירת מחדל true לפני טעינת ההגדרה (הבלוק מהבהב ואז נעלם).
- שגיאת רשת ב-GET מציגה מסך "לא מחובר" (אותו ענף כמו 401).
- `window.alert` חוסם — החלפה ל-toast/חלונית (R20/R19) חייבת לא לשנות את סדר: alert→setSaving(false).
- בורר/כרטיס הסיסמה inline, לא modal — כדי להפוך לחלונית (R19: הזנת מידע = בהיר בלבד) שמרו שני state של show + ניקוי בביטול.
