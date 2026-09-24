# דוח בנייה - login (LoginScreen)

קובץ בלבד: `app/components/LoginScreen.js`. ענף: `redesign/site-v3-pages-login`. state/effects/handlers/fetch לא שונו (שורות 1-242 המקוריות זהות, מלבד 11 מחרוזות מלל). לא הורץ דפדפן/שרת; אומת parse של Babel וקיום כל ה-tokens.

## צ'קליסט חוזה (43 שורות)
- 1-2 מצבי הצגה/עמוד מלא: `isModal` false -> מעטפת עמוד (V3Page + פס מותג + כרטיס + אייד).
- 3-4 חלונית: `Dialog variant=form` (בהיר), `closeOnScrim=false`, כפתור סגירה `title="סגירה"` רק עם `onClose`, קורא `onClose(false)`. Dialog עושה portal בעצמו אחרי mount (`mounted` נשמר).
- 5 דיאלוגי משנה: forgot/reset כ-`Dialog nested` בשני המצבים.
- 6 `dir=rtl` דרך V3Page/Dialog. 7 קישור punch-clock בעמוד מלא בלבד (`Btn href`). 8 תג מהימנות (Chip + Tip) בשני המצבים.
- 9-20 קומבובוקס: אותו state/handlers, `id=login-employee`, `name` אקראי + `autoComplete=new-password`, איקון משתמש לחיץ/ספינר, כפתור "נקה בחירה" (onMouseDown preventDefault), רשימה (טעינה/פריטים/ריק, נבחר מודגש), תיקון סינון, קליק-חוץ, `resolveEmployeeId`.
- 21-26 קוד/PIN: שני inputs עם אותו `id=login-password` (בכל רגע אחד), maxLength 4, slice, `••••`, letter-spacing, איקון מנעול, מתג מצב רק ב-`deviceTrusted`, "שכחתי סיסמה".
- 27-35 form+submit+ולידציה+POST+requireFullPassword+mustResetPassword+`finishLogin` (settings/notifications + reload) ללא שינוי.
- 36-38 forgot: כותרת+מייל, שם העובד או "לא נבחר עובד" (Row), תוצאה ירוק/אדום, סגירה/שליחה (loading), סגירה בלחיצה על הרקע.
- 39-43 reset: בלי סגירה (`onClose` ריק, ללא scrim-close), שני שדות `login-newpass1/2`, ולידציות, שמירה, callout שגיאה, כפתור שומר/loading.
- 3.7 כל `data-element-name` נשמרו (כולל איקוני כותרת וסגירה).

## מלל
11 הודעות שגיאה/מצב נכתבו מחדש + תוויות, placeholders, כותרות, כפתורים, אייד (3 יתרונות), קישור משמרת. הסברים (מהימן, קוד מקוצר, forgot) הועברו ל-Tip.

## חריגות / החלטות
- `finishLogin` נשאר עם `window.customAlert`/`alert` (בלי Provider ומיד אחריו reload - דיאלוג לא היה מספיק להיראות). מתאים ל-NOTIFICATIONS §3(2) שיחליף זאת ב-MessageCard בהמשך. אין זרימות שמירה ל-notify בקובץ זה.
- רשימת העובדים בזרימה (לא absolute) - בתוך Dialog גולל.
- במצב חלונית נוסף Esc = סגירה (כמו כפתור X, רק אם יש onClose).
- שגיאות מוצגות בקופסת inline (טוקנים) ולא Banner הכהה.
- רשימת היתרונות לא מוסתרת במובייל (אין media query ב-inline) -> REQ-1.
- לא נבדק חזותית בדפדפן (מגבלת שרת dev יחיד).

## בקשות פתוחות
`docs/redesign-v3/requests/login.md` (REQ-1..3).
