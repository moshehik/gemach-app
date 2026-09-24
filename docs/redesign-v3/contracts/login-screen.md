# חוזה: מסך כניסה — `app/components/LoginScreen.js`
584 שורות, `'use client'`. שני מצבי רינדור: **דף מלא** (`isModal=false`) ו-**חלונית** (`isModal=true`, נפתחת מתפריט המשתמש כשאורח).

## 1. מתי מוצג
- **דף מלא**: `app/layout.js:279` — `showLogin = requireLogin && !isAuthenticated && !isPublicKiosk && !isPunchClock`. כשמוצג: `<LoginScreen/>` **מחליף** את כל ה-AppShell (אין sidebar/topbar/PrefetchManager/AI/DesignPrefsSync), ה-`<html>` מקבל `data-theme="light"` ובלי palette/font/density (`layout.js:291-295`), וסקריפט ה-CSS המותאם לא נכתב. ה-URL נשאר של העמוד המבוקש (לא ניווט) ⇒ אחרי התחברות `window.location.reload()` חוזר לאותו עמוד (דיווח 2026-09-23).
- פטורים: `/customer-interface*` (קיוסק), `/punch-clock*` (שעון נוכחות, PIN משלו).
- **חלונית**: `UserMenu.js:~104` — אורח (`/api/me` החזיר 401/אין user) ⇒ "היכנס למערכת" ⇒ `<LoginScreen isModal onClose>`. `require_login=false` בלבד (אחרת לא היו אורחים).

## 2. State
`employees`, `isFetchingEmployees`, `selectedEmployee` (id), `password`, `pinValue`, `error`, `loading`, `mounted`, `searchTerm`, `isDropdownOpen`, `employeeAutofillGuardName` (שם אקראי `no-autofill-<rand>` נקבע ב-`useEffect` בלבד — למניעת hydration mismatch ותפריט היסטוריית Chrome; דיווחים 2a4a2af4/0a88cf56), `deviceTrusted`, `usePinMode`, `forgotOpen/forgotSending/forgotResult`, `resetRequired/resetEmployeeId/newPass1/newPass2/resetError/resetSaving`.

## 3. אזורים לפי סדר
### דף מלא (`page.js` שורות 458-489)
רקע מסך מלא (`min-height:100vh`, gradient רדיאלי מ-`--primary`/`--accent`), כרטיס 440px: לוגו-מנעול (ריבוע gradient 64px, `#i-lock`), `h1` "כניסת עובדים", תת-כותרת, תג "מחשב זה מוגדר כמערכת מהימנה" (כש-`deviceTrusted`), הטופס, וקישור `<a href="/punch-clock">` "רק לרישום כניסה/יציאה למשמרת? לחצו כאן".
### חלונית
`modal-backdrop` (z 9999, blur) → `modal` 440px: head "כניסת עובדים" + כפתור סגירה (`onClose(false)`, `title="סגירה"`, רק אם `onClose`) → body: תת-כותרת + תג מהימנות + טופס. ב-`mounted` נעשה `createPortal` ל-`document.body` (לפני כן inline).
### הטופס (`form onSubmit=handleLogin autoComplete=off`)
1. `callout-danger` עם `error` (אם יש).
2. **שם העובד** — combobox: `input#login-employee.input` (`name=<guard>`, `autoComplete="new-password"`, disabled בזמן טעינה, placeholder "טוען רשימת עובדים..." / "הקלד או בחר מהרשימה"), איקון משתמש לחיץ (toggle dropdown; spinner בזמן טעינה), כפתור "נקה בחירה" (`aria-label`+`title`) כשנבחר עובד. `combobox-results`: רשימת עובדים מסוננת לפי `"first last".includes(searchTerm)` (אם הערך בשדה = השם הנבחר והרשימה פתוחה — מציג את **כולם**), פריט נבחר מודגש, "טוען רשימת עובדים..." / "לא נמצאו עובדים". הקלדה מאפסת `selectedEmployee`. סגירה בקליק-חוץ (`mousedown`).
3. **סיסמה**: תווית `קוד כניסה` או `4 התווים האחרונים בסיסמה` (מצב PIN); אם `deviceTrusted` — כפתור-טקסט מחליף מצב ("השתמש בקוד מקוצר (4 תווים)" / "השתמש בסיסמה המלאה"; מאפס error/password/pin). קלט: `input#login-password` סיסמה (placeholder "הזן את הקוד שלך") או PIN (`maxLength=4`, `slice(0,4)`, placeholder `••••`, letter-spacing). `autoComplete="new-password"` בשניהם. כפתור-טקסט "שכחתי סיסמה".
4. **submit** "היכנס למערכת" (`btn-primary btn-lg`, איקון `#i-arrow-end` / spinner בזמן `loading`, disabled בזמן `loading`).
### חלונית "שכחתי סיסמה" (`forgotDialog`, z 10001)
כותרת "שכחתי סיסמה" (`#i-mail`); טקסט הסבר עם שם העובד הנבחר (`searchTerm` או "לא נבחר עובד"); `callout` הצלחה/כישלון עם `forgotResult.message`; כפתורים: "סגור", "שלח סיסמה זמנית"/"שולח..." (disabled בזמן שליחה). לחיצה על הרקע סוגרת.
### חלונית "יש להגדיר סיסמה חדשה" (`resetDialog`, z 10002 — **לא ניתנת לסגירה**)
כותרת (`#i-shield`); הסבר; `callout` שגיאה; שדות `#login-newpass1` "סיסמה חדשה", `#login-newpass2` "אימות סיסמה חדשה" (`autoComplete=new-password`); כפתור "שמור והמשך"/"שומר...".

## 4. ולידציה והודעות
| מצב | הודעה |
|---|---|
| אין עובד/אין credential | `נא לבחור עובד ולהזין 4 תווים` (PIN) / `נא לבחור עובד ולהזין סיסמה` |
| תשובת שרת כושלת | `data.message || 'שגיאה בהתחברות'` |
| חריגת רשת | `שגיאת תקשורת` |
| forgot בלי עובד | `יש לבחור קודם עובד מהרשימה` |
| forgot תשובה | `data.message || (success ? 'נשלח בהצלחה' : 'שליחה נכשלה')` |
| סיסמה חדשה קצרה (<4) | `הסיסמה החדשה קצרה מדי (לפחות 4 תווים)` |
| אי-התאמה | `הסיסמאות אינן תואמות` |
| שמירת סיסמה נכשלה | `data.message || 'שגיאה בשמירת הסיסמה'` / `שגיאת תקשורת` |
`resolveEmployeeId`: אם לא נבחר id אבל `searchTerm` תואם בדיוק (trim) שם מלא של עובד — משתמש בו (הקלדה ידנית בלי לחיצה על הרשימה).

## 5. קריאות רשת
| Method+URL | מתי | body / תשובה |
|---|---|---|
| `GET /api/employees` דרך `fetchSharedJson(...,{ttl:TTL.STATIC})` | mount | מערך `{id,firstName,lastName,...}`; כשל ⇒ רשימה ריקה (רק `console.error`). **מוצג לאורח לא-מחובר** — הקריאה חייבת לעבוד ללא session (לא נבדק שדות התשובה ב-API) |
| `GET /api/auth/device-status` | mount | `{trusted}` ⇒ `deviceTrusted` + `usePinMode=trusted` |
| `POST /api/login` | submit | `{employeeId, pin}` **או** `{employeeId, password}`; תשובה `{success, mustResetPassword?, requireFullPassword?, message?}`. `requireFullPassword` ⇒ חוזר לסיסמה מלאה ומנקה PIN. `mustResetPassword` ⇒ חלונית סיסמה חדשה (ללא `finishLogin`) |
| `POST /api/auth/forgot-password` | "שלח סיסמה זמנית" | `{employeeId}` ⇒ `{success,message}` |
| `POST /api/employees/{id}/password` | "שמור והמשך" | `{newPassword}` (ללא `oldPassword`) ⇒ `{success,message}`; הצלחה ⇒ `finishLogin` |
| `GET /api/settings` (`no-store`) → `GET /api/notifications` (`no-store`) | בתוך `finishLogin` | אם `notify_on_new_message_at_login==='true'` ויש הודעות לא נקראות/לא בארכיון ⇒ `window.customAlert || alert('יש N הודעה/ות חדשה/ות שלא טופלו')` **ולפני** ה-reload (best-effort) |
מטמון: רשימת עובדים משותפת (TTL.STATIC) — אותה קריאה משרתת גם `PopupProvider` (`/api/employees`).
`finishLogin` ⇒ תמיד `window.location.reload()` (לא `router.refresh`, לא `href='/'`). ה-`useRouter` מיובא אך לא בשימוש.

## 6. אחסון / URL
אין localStorage/sessionStorage. אין URL params. הגדרות: `require_login` (ב-layout), `notify_on_new_message_at_login`. **Org**: אין הבדל בקוד; מסך ה-PIN תלוי ב-`/admin/trusted-devices` פר-DB.

## 7. מלל (לכתיבה מחדש)
כותרת מסך/חלונית, תת-כותרת, 4 תוויות שדה (עובד/קוד/PIN/החלפה), placeholders (3), כפתורים (התחברות/שכחתי/סגור/שלח/שמור), תג מהימנות, קישור שעון נוכחות, ~12 הודעות שגיאה/מצב (בטבלה 4), הסבר forgot, הסבר reset, "לא נמצאו עובדים", "טוען רשימת עובדים...".

## 8. Risk notes
1. **אוטופיל**: `autoComplete="new-password"` + `name` אקראי + ללא `id` יציב כמפתח היסטוריה — אל תחליפו לשדות "סטנדרטיים" (דיווח 2a4a2af4 שחזר; זיכרון: פריט #1 של feedback batch 2026-09-22 עדיין לא נסגר — לבדוק סטטוס לפני נגיעה).
2. `input#login-employee` הוא combobox מותאם — **לא** `<select>`. ה-`onMouseDown preventDefault` על כפתור הניקוי מונע איבוד fokus/סגירה.
3. שני inputs שונים עם אותו `id="login-password"` (PIN/סיסמה) ב-conditional — לשמר יחיד בכל רגע (label `htmlFor`).
4. חלונית איפוס-סיסמה **חוסמת** (אין סגירה): המשתמש כבר מחובר בשרת (cookie נקבע ב-`/api/login`) אך הדף לא נטען מחדש עד הצלחה. אל תוסיפו כפתור סגירה.
5. R19: חלונית "שכחתי סיסמה" ו"סיסמה חדשה" כוללות הזנת מידע ⇒ **בהיר בלבד**; מסך הכניסה עצמו מוצג תמיד `data-theme=light`. בכפתור ה-clear הצבעים קשיחים (`#fff`,`#f3f4f6`) — יש להחליף ל-tokens.
6. `z-index` 9999/10001/10002 סדר-שכבות: חלונית התחברות < forgot < reset. `createPortal` רק בחלונית.
7. בדף המלא **אין** ה-Provider של `PopupProvider` (`layout.js:626-647`) — לכן `window.customAlert` לא קיים ולכן ה-fallback ל-`alert()`; אל תכניסו `usePopup` לרכיב.
8. R17: תווית "4 התווים האחרונים", מספרים/`••••` — `letterSpacing:0.6em` + `textAlign:center` ל-PIN.
9. `mustResetPassword` מגיע רק אחרי סיסמה זמנית (forgot-password) — קשור ל-`Employee.mustResetPassword`.
