# אימות התאמה: משפחת login (`app/components/LoginScreen.js`)

ענף: `origin/redesign/site-v3-pages-login` מול `origin/main`. שיטה: `VERIFY-METHOD.md`. קריאה בלבד, ללא דפדפן.
קבצי המשפחה ששונו בפועל: `app/components/LoginScreen.js` בלבד (בנוסף: קבצי `app/v3/**` חדשים, `app/v3-gallery/**`, `app/version.json`; אין נגיעה ב-`layout.js`, `UserMenu.js` או API).

## פסק דין: ⚠️ תואם עם הערות

אין פערים חוסמים. כל ה-state, ה-effects, קריאות הרשת, המטפלים, ה-`id`/`data-element-name`, הגנת ה-autofill וזרימת `finishLogin` זהים. שני נושאים שדורשים החלטה/בדיקת דפדפן: (1) Esc סוגר את חלונית הכניסה (שינוי התנהגות), (2) ה-CSS של v3 נטען כעת בכל עמוד באתר (ראו הערות).

## ראיות (סקריפטי השוואה)

1. **Parse**: `@babel/parser` (jsx) על ישן וחדש: OK בשניהם. כל הייבואים (`V3Page, Btn, Chip, Dialog, Row, Tip, Icon`) מיוצאים מ-`app/v3/ui/components.js` ומשמשים; `createPortal` הוסר ואינו בשימוש. `@/` מוגדר ב-`jsconfig.json`.
2. **diff מנורמל-רווחים של שורות 1-242 (כל ה-state/effects/handlers/סינון)** ישן מול חדש: הפערים היחידים הם שורת ייבוא (`createPortal` הוסר, `V3Page...` נוסף) ו-11 מחרוזות (טבלה למטה). מערכי תלות של כל ה-`useEffect` (`[]` x5) זהים. רשימת `useState/useRef` זהה (חיפוש ידני, 18 state + `dropdownRef`).
3. **`data-element-name`**: 10 ערכים ייחודיים (11 מופעים), זהים בישן ובחדש: `כפתור_LoginScreen_1`, `_10`, `לחיץ_LoginScreen_6`, `_7`, `רכיב_LoginScreen_11`, `_2`, `_3` (x2), `שדה_LoginScreen_4`, `_8`, `_pin`.
4. **`id`**: `login-employee`, `login-newpass1`, `login-newpass2`, `login-password` (x2, מותנה) זהים.
5. **CSS**: כל מחלקות `v3-*` וכל משתני `--v3-*` שבשימוש קיימים ב-`tokens.css`/`components.css`/`icons.css` (בדיקה אוטומטית: 0 חסרים; `data-v3-anim-host` הוא attribute בלבד). כל האיקונים (`lock, user, x, check, mail, shield, clock, coin, box, arrow-end, alert-circle, check-circle, shirt`) קיימים ב-`IconSprite` הישן או ב-`IconSpriteV3`; `IconSprite` נטען ב-`layout.js:610` גם במצב `showLogin`, ו-`sprite={!isModal}` טוען את V3 בעמוד המלא.
6. **צרכנים חיצוניים**: `git grep` על הענף: אף קובץ אחר לא מפנה ל-`login-employee`/`login-password`/`LoginScreen_*`, ולא משווה או מפרסר את המחרוזות ששונו (כל ההתאמות של "שגיאת תקשורת" וכו' הן במסכים אחרים עם מחרוזות משלהם). `UserMenu.js:104` קורא `<LoginScreen isModal onClose>` בלבד; `layout.js:627` קורא ללא props.

## בדיקת הטענה: "רק מחרוזות שנראות למשתמש השתנו"

**אושרה** (ברמת ההיגיון). בשורות 1-242 ההבדלים הם אך ורק:

| שורה | ישן | חדש | משמש כנתון? |
|---|---|---|---|
| 114 | `יש N הודעה/ות חדשה/ות שלא טופלו` | `מחכות לכם N הודעות חדשות שלא טופלו` | לא (הערה: דקדוק ב-N=1 "1 הודעות", ר' הערות) |
| 139 | `נא לבחור עובד ולהזין 4 תווים` / `...סיסמה` | `בחרו את שמכם והקלידו 4 תווים` / `...את הקוד` | לא |
| 171 | `שגיאה בהתחברות` (fallback) | `ההתחברות לא הצליחה` | לא |
| 174, 197, 229 | `שגיאת תקשורת` | `אין קשר עם השרת, נסו שוב` | לא |
| 183 | `יש לבחור קודם עובד מהרשימה` | `קודם בוחרים את שמכם ברשימה` | לא |
| 195 | `נשלח בהצלחה` / `שליחה נכשלה` | `הסיסמה הזמנית בדרך למייל` / `לא הצלחנו לשלוח, נסו שוב` | לא |
| 207 | `...קצרה מדי (לפחות 4 תווים)` | `הסיסמה צריכה לכלול לפחות 4 תווים` | לא |
| 211 | `הסיסמאות אינן תואמות` | `שתי הסיסמאות צריכות להיות זהות` | לא |
| 226 | `שגיאה בשמירת הסיסמה` (fallback) | `לא הצלחנו לשמור את הסיסמה` | לא |

ערכי `data.message` מהשרת עדיין מקבלים עדיפות. הלוגיקה (תנאים, הסתעפויות, בדיקת אורך `<4`, השוואת `newPass1 !== newPass2`, `requireFullPassword`, `mustResetPassword`, `reload()`) לא השתנתה. מלל ה-JSX שונה (תוויות, placeholders, כפתורים) בהתאם ל-R10 ו-§7 בחוזה ("לכתיבה מחדש").

## בדיקת התנהגות Esc

**שינוי התנהגות אמיתי, קטן, ללא אובדן נתונים.**
- ישן: חלונית הכניסה (`isModal`) לא הגיבה ל-Esc; נסגרה רק בכפתור X (`onClose(false)`).
- חדש: `<Dialog open closeOnScrim={false} onClose={() => { if (onClose) onClose(false); }}>` ו-`Dialog.js` מאזין ל-Esc (capture, `stopPropagation`) וקורא ל-`onClose` ⇒ Esc = בדיוק כמו לחיצה על X (`UserMenu` מכבה `showLoginModal`; ה-state של הטופס נזרק, זהה ל-X).
- לחיצה על הרקע עדיין **לא** סוגרת (`closeOnScrim={false}`) ⇒ תואם לישן.
- חלונית "סיסמה חדשה" (חובה): `onClose={() => {}}` + `closeOnScrim={false}`; היא בראש ה-`stack` של Dialog, ולכן Esc נבלע ולא סוגר גם את חלונית ההתחברות מתחתיה ⇒ נשמרת החסימה (סיכון 4 בחוזה). מאומת סטטית ב-`Dialog.js` (`stack[stack.length-1] !== token`).
- "שכחתי סיסמה": Esc סוגר רק אותה (בראש ה-stack); הרקע סוגר אותה (`closeOnScrim` ברירת מחדל) ⇒ תואם לישן (שם `onClick` על ה-backdrop).
- עמוד מלא: אין Dialog ראשי ⇒ Esc לא עושה דבר, כמו בישן.
- Esc גם בולע את ה-handler של `UserMenu` (סגירת התפריט) כשהחלונית פתוחה: לא משנה.
- **המלצה**: להחליט אם ה-Esc רצוי (סיכון: איבוד הקלדת סיסמה בלחיצה מקרית). אם לא, `onClose={() => {}}` בחלונית הראשית (כפתור ה-X נשאר עם `onClick` נפרד). לא חוסם.

## טבלת חוזה: 43 השורות ב-`LOGIN-DESIGN.md` §3 (קובץ:שורה בקובץ החדש)

| # | פריט | קיים | זהה |
|---|---|---|---|
| 1 | props `isModal=false, onClose` | :8 | כן |
| 2 | עמוד מלא, `reload()` | :456-496, :129 | כן |
| 3 | חלונית, כותרת, X רק אם `onClose`, `onClose(false)`, `title="סגירה"` | :433-454 | כן (+Esc, ר' לעיל; z-index 100 במקום 9999, ר' הערות) |
| 4 | portal רק אחרי mount | Dialog עושה portal אחרי `mounted` משלו; `mounted` שלנו `void` (:573) | כן פונקציונלית (לא inline ב-SSR, אך החלונית נפתחת רק בלחיצה בצד לקוח) |
| 5 | דיאלוגי משנה | :499-569 (תמיד portal דרך Dialog) | כן |
| 6 | `dir="rtl"` | `V3Page`/`Dialog` מציבים `dir=rtl` | כן |
| 7 | קישור `/punch-clock` בעמוד מלא בלבד | :473 (`Btn href`, `<a>`) | כן |
| 8 | תג "מחשב מהימן" (`deviceTrusted`) בשני המצבים | :246-251, :452, :469 | כן (Chip+Tip) |
| 9 | `fetchSharedJson('/api/employees',{ttl:TTL.STATIC})` | :71-81 | זהה בית-בית |
| 10 | `input#login-employee` + label `htmlFor` | :266, :273-296 | כן |
| 11 | placeholders + `disabled` בטעינה | :283-284 | כן (מלל חדש) |
| 12 | הגנת autofill (`name` אקראי ב-effect, `autoComplete="new-password"`) | :31-34, :294-295 | זהה, כולל ההערות |
| 13 | `onChange` (searchTerm/reset/פתיחה) | :278-282 | זהה |
| 14 | `onFocus`/`onClick` | :285-286 | זהה |
| 15 | איקון משתמש לחיץ + ספינר | :268-272 (`Icon onClick`, צבע לפי בחירה) | כן. האיקון absolute, `.v3-input` לא ממוקם ⇒ האיקון מעל הקלט וניתן ללחיצה |
| 16 | כפתור "נקה בחירה" (aria-label, title, `onMouseDown preventDefault`, איפוס+פתיחה) | :297-309 | זהה |
| 17 | רשימת תוצאות: טעינה/רשימה/ריק, נבחר מודגש, קליק קובע וסוגר | :312-347 | זהה (מחלקות v3; ראשי-תיבות במקום איקון) |
| 18 | תיקון סינון "הצג הכל" | :235-241 | זהה |
| 19 | סגירה בקליק-חוץ (`mousedown`, `dropdownRef`) | :56-64, :265 | זהה |
| 20 | `resolveEmployeeId` | :92-102 | זהה |
| 21 | מצב סיסמה: `id`, סוג, placeholder, `autoComplete` | :387-397 | כן |
| 22 | מצב PIN: `maxLength=4`, `slice(0,4)`, `••••`, `letterSpacing:.6em`, ממורכז | :371-386 | כן |
| 23 | איקון מנעול מוביל | :370 | כן |
| 24 | `GET /api/auth/device-status` ⇒ `deviceTrusted`+`usePinMode` | :83-89 | זהה |
| 25 | מתג מצב PIN/סיסמה (איפוס error/password/pin) רק אם `deviceTrusted` | :358-367 | זהה (Btn `type=button`) |
| 26 | "שכחתי סיסמה" (פותח + מאפס `forgotResult`) | :400-409 | זהה |
| 27 | `form onSubmit=handleLogin autoComplete="off"`, Enter שולח | :261 | כן; כל שאר הכפתורים בטופס `type=button` (Btn ברירת מחדל, Tip, clear) ⇒ Enter לא מפעיל אותם |
| 28 | ולידציית חסר עובד/קוד | :132-141 | לוגיקה זהה, מלל חדש |
| 29 | `POST /api/login` `{employeeId,pin}`/`{employeeId,password}`, headers | :147-153 | זהה |
| 30 | הצלחה: `mustResetPassword` / `finishLogin` | :157-164 | זהה |
| 31 | כישלון: `requireFullPassword`, `data.message` | :164-172 | זהה |
| 32 | שגיאת רשת, `finally` | :173-177 | זהה |
| 33 | תיבת שגיאה מעל השדות | :253-258 (`role="alert"`) | כן |
| 34 | "היכנס למערכת": `submit`, disabled בטעינה, ספינר/חץ, רוחב מלא | :412-423 (`Btn type=submit block loading`) | כן |
| 35 | `finishLogin`: settings → notifications → `customAlert`/`alert`, אחר כך `reload()` | :104-130 | זהה (מלל ההודעה בלבד) |
| 36 | forgot: dialog, סגירה ברקע, שם העובד/"לא נבחר עובד" | :499-521 | כן (`Row` + `Tip` במקום פסקה) |
| 37 | `POST /api/auth/forgot-password` `{employeeId}`, callout | :180-201, :522-527 | זהה |
| 38 | כפתורי "סגור"/"שלח", `disabled` בזמן שליחה | :508-515 | כן (`loading={forgotSending}` = disabled+ספינר) |
| 39 | reset: לא ניתן לסגירה, איקון מגן, הסבר | :531-542 | כן (`onClose` ריק, `closeOnScrim={false}`) |
| 40 | `login-newpass1/2`, password, `autoComplete`, מנעול | :550-563 | זהה |
| 41 | ולידציה (<4, אי-התאמה) | :206-213 | זהה |
| 42 | `POST /api/employees/${resetEmployeeId}/password` `{newPassword}` | :216-232 | זהה |
| 43 | callout `resetError`, "שמור והמשך" disabled בזמן `resetSaving` | :543-566 | כן (`loading={resetSaving}`) |
| 3.7 | `data-element-name` (כולם) | ראו ראיה 3 | זהה |

חוזה §5 (רשת): 6 הקריאות (`/api/employees`, `device-status`, `login`, `forgot-password`, `employees/{id}/password`, `settings`->`notifications`) זהות ב-URL, method, body, headers, `cache:'no-store'`. אין localStorage/sessionStorage בישן ובחדש. `useRouter` מיובא ולא בשימוש בשניהם.

## פערים חוסמים

אין.

## הערות לא חוסמות

1. **CSS גלובלי**: `LoginScreen` מיובא סטטית מ-`layout.js` ומ-`UserMenu.js` ⇒ `tokens.css`, `components.css`, `icons.css` (~1,870 שורות) נטענים כעת בכל עמוד ובכל ארגון, גם למשתמשים מחוברים. מבדיקת הקבצים: המשתנים בתחום `--v3-*` בלבד, והכללים בקידומת `.v3-`; שלושה כללים לא-ממוקדים: `button:active > .v3-ic`, `[dir="rtl"]{--v3-dir}`, `body:has(.v3-scrim.is-on) .v3-toast` - כולם בלתי מזיקים לקוד ישן. אין סיכון עיצובי מאומת, אך יש משקל בנדל, ועדיף לבדוק ב-build שאין רגרסיה בעמודים אחרים (דורש דפדפן).
2. **z-index**: חלונית הכניסה כעת 100 (`--v3-z-scrim`) במקום 9999; forgot/reset 140 במקום 10001/10002. `.navbar` הוא 100 (ה-portal מאוחר ב-DOM ולכן מעליו), אבל `.popup-toast-container`/`.global-popover` (9999) ובאנרים (10000) יופיעו מעל החלונית. עקרונית כמו בישן לגבי הבאנרים; לבדוק בדפדפן שתפריט/פופאובר גלובלי לא חוצה את החלונית.
3. **דקדוק**: ההודעה `מחכות לכם ${N} הודעות חדשות` נשברת ב-N=1 ("1 הודעות"), והישן טיפל בזה עם `הודעה/ות`. מלל בלבד; מומלץ להעדיף ניסוח ניטרלי למספר (`יש N הודעות...` נשאר שבור; עדיף `ההודעות שממתינות לטיפול: N`).
4. **פוקוס בפתיחה**: `Dialog` ממקד את האלמנט הראשון שניתן למיקוד: בחלונית הכניסה הוא כפתור X (בסדר). בחלונית "שכחתי סיסמה" הראשון הוא כפתור ה-`Tip` שב-`Row` ⇒ ה-tooltip ייפתח אוטומטית בפתיחה (`onFocus`). מומלץ `data-autofocus` על כפתור "שלחו לי סיסמה זמנית" או `initialFocus`. בעמוד המלא אין autofocus, כבישן.
5. **Tip בתוך הטופס**: הכפתור מסוג `type=button`, אין שליחה בשוגג. Esc על tooltip פתוח בתוך חלונית: ה-Dialog קודם (capture) ולכן ה-tooltip לא נסגר לבד לפני החלונית.
6. **RTL/עיצוב (קוד)**: אין `left/right` קשיחים בקובץ; צבעים דרך `--v3-*` (תיקון סיכון 5 בחוזה: הצבעים הקשיחים `#fff/#f3f4f6` של כפתור הניקוי הוסרו). ה-`<bdi>` לספרות: ה-PIN ו-`initialsOf` (עטוף `<bdi>`). אין `alert()` חדש; `alert(msg)` ב-`finishLogin` נשאר כפי שנדרש (סיכון 7 בחוזה; `usePopup` לא הוכנס).
7. **רשימת העובדים**: כעת בזרימה רגילה (לא absolute overlay כמו `.combobox-results` הישן) ⇒ מדחפת את התוכן שמתחתיה; תצוגתי בלבד, מגובלת ב-`max-height:280px` בתוך `.v3-combo__list`.
8. **שינויי מבנה**: `Btn href` מרנדר `<a>` (ניווט מלא) כמו קודם; מחלקות ישנות (`combobox*`, `password-field`, `callout-*`, `field`, `input`) כבר לא בשימוש בקומפוננטה (אין צרכנים חיצוניים לפי ראיה 6).

## מה לא נבדק סטטית (דורש דפדפן)

- רינדור בפועל של עמוד מלא ושל חלונית מעל האפליקציה (z-index, blur, תפריט משתמש פתוח, באנרים).
- Hydration בעמוד המלא (SSR של `V3Page`/`Icon`/`Tip`; ה-`name` האקראי עדיין רק ב-effect, אך יש להריץ ולוודא שאין אזהרת hydration) והתנהגות autofill/היסטוריית Chrome בפועל (דיווחים 2a4a2af4 / 0a88cf56 / 5cb73cc0).
- Esc/Tab/פוקוס-trap בפועל, כולל מסך "סיסמה חדשה" כחוסם (סבירות טובה מהקוד).
- רגרסיה ויזואלית בעמודים אחרים מהטעינה הגלובלית של קבצי ה-CSS של v3 (הערה 1).
- מסך מובייל (sheet תחתון של Dialog) ושדה ה-PIN עם `letterSpacing`.
