# דו"ח אימות התאמה: משפחת misc

ענף: `origin/redesign/site-v3-pages-misc` מול `origin/main`. שיטה: `docs/redesign-v3/VERIFY-METHOD.md`. קריאה בלבד, לא הורצה אפליקציה.
קבצים: `app/page.js`, `app/messages/page.js`, `app/my-hours/page.js`, `app/punch-clock/page.js`, `app/profile/page.js`, `app/display-settings/page.js`, `app/components/v3misc/useAskDialog.js` (חדש; זה הקובץ היחיד תחת v3misc).

## פסק דין: ⚠️ תואם עם הערות

אין פער חוסם. יש סטייה אחת מהחוזה (ברירת מחדל של כותרת הבית) שמומלץ לתקן לפני מיזוג, ועוד הערות קטנות.

## שיטת הבדיקה (סקריפטים, לא קריאה בעין)

1. יוצאו שני העותקים של כל עמוד ל-scratchpad. מהקבצים נחתך חלק הלוגיקה (כל מה שלפני ה-`return` של ה-JSX) ובוצע `diff -w` בין ישן לחדש.
2. הושוו קבוצות הקריאות: `fetch|fetchJson|fetchSharedJson|invalidate` (URL), וכן כל `data-element-name` ו-`id`.
3. `@babel/parser` (jsx) על כל הקבצים החדשים. נבדקו class-ים של `v3-*` מול `components.css`/`tokens.css`/`icons.css`, ושמות איקונים מול `IconSprite.js` ו-`IconSpriteV3.js`.
4. נקראו במלואם רכיבי v3 שבהם העמודים משתמשים: Btn, IconBtn, Tabs, Switch, Field, Card, Chip, Dialog, Tip, Table, Row, Banner, Empty, V3Page, Icon.

### תוצאות מקוצרות

```
PARSE OK  (6 עמודים + useAskDialog.js)
fetch set identical   (6/6 עמודים)
data-element-name: punch-clock 4=4, profile 21=21, השאר 0=0, diff ריק
id="..." : diff ריק בכל 6 העמודים
icons: כל האיקונים קיימים בספרייט (התאמות i-grid/i-coin/i-activity/i-message/i-clock אומתו ידנית ב-IconSprite.js)
v3 classes: אין class חסר ב-CSS (ה"חסרים" בפלט הגולמי הם משתני CSS --v3-*, וכולם מוגדרים ב-tokens.css)

diff -w של הלוגיקה (לפני return):
  messages : רק הטקסטים של setError + טעינה + import. אפס שינוי ב-state/handlers/fetch/גוף JSON/מפתחות מטמון
  display-settings : שורה אחת import, ו-PreviewStrip (קוסמטי בלבד). כל ה-state/handlers זהים
  home (app/page.js) : imports, welcomeTitle default (ראו פער 1), class-ים ואיקוני סטטוס. אפס שינוי בלוגיקה/אחסון/קריאות
  my-hours, punch-clock, profile : לוגיקה זהה מלבד עטיפת ask() (ראו למטה)
```

## טבלת חוזה (תמצית לפי התחומים המבוקשים)

| פריט | קיים? (קובץ חדש:שורה) | זהה? |
|---|---|---|
| punch-clock פתוח ללא התחברות | `app/punch-clock/page.js`: אין PageGate, אין קריאת session; `app/layout.js` (bypass `isPunchClock`) לא שונה בענף | כן |
| punch-clock: `isError = statusMessage.includes('שגיאה')`, ההודעה `שגיאה: ${data.error}` | :~108 ו-`isError` :~119 | כן. הבדיקה והמחרוזת זהות. הודעות ההצלחה/ולידציה עדיין לא מכילות "שגיאה" (כמו בישן), ולכן מעוצבות כהצלחה בשני הענפים |
| punch-clock body ל-`/api/attendance` | `{ employeeId, password, action }`, POST, אותן כותרות | כן |
| punch-clock ענף כובסת (`/api/settings` ואז `/api/orders?filterStatus=archive&limit=50`) | :52-74 | כן. `window.customConfirm` הוחלף ב-`await ask({...cancelLabel})`. אישור מחזיר true, ביטול/Esc/scrim מחזיר false, ואז `setStatusMessage` ומעבר ליציאה מוקדמת (כמו הישן). גם נשמר ה-`try/catch` השקט |
| punch-clock combobox (מאפס `employeeId` בהקלדה, blur 200ms, mousedown+preventDefault, פוקוס לסיסמה) | :126-176 | כן |
| punch-clock `data-element-name` 4 + ids `punch-clock-employeeSearch/-password` | :129,130,190,191,207,218 | כן |
| messages כותרות שנשלחות לשרת | `'הודעת משמרת'` / `'הודעה להנהלה'` / `'הודעה חדשה'`, `category`, `receiverId:'all'` | כן, בדיקת diff: אף שורת body לא השתנתה |
| messages POST-ים: `/api/notifications` (+`/read`, `/handle`, `/archive`, `/tags`), `PATCH /api/me`, GETs עם `cache:'no-store'`, `messagesCache` keys + מחיקות | כל הלוגיקה לפני `return` (שורות 1-529) | כן |
| messages טאבים מותנים בהגדרות (`shift_handover_notes`, `management_messages`) | `tabItems` :505-515 | כן. `activeTab`, ערכי key זהים |
| messages מתג התראות מייל | `Switch` :~700, `handleSaveSettings(checked)`, מנוטרל כש-`isSavingSettings || !email` | כן. אותו boolean |
| my-hours (`GET /api/me/shifts`, סינון חודש/שנה, `years`, 401) | לוגיקה זהה 1:1 (diff ריק) | כן. hooks נשארו לפני ה-early-return של notLoggedIn |
| my-hours מצבי טעינה/ריק/לא מחובר | :53-58, :83-90 | כן. שורת "אין משמרות" הפכה ל-`Empty` במקום שורה בטבלה (קוסמטי) |
| profile PUT `/api/me/profile` body=`profile` כולו | :64-70 | כן |
| profile מתג `receiveEmailAlerts` | `Switch` :~146 (`name`, `id="receiveEmailAlerts"`, `data-element-name="שדה_profile_16"` עוברים ל-input) | כן. `onChange` שם `receiveEmailAlerts: checked` (boolean), בדיוק כמו `handleChange` עם `type==='checkbox'` בישן. אותו מפתח, אותו טיפוס |
| profile סיסמה: `POST /api/employees/${id}/password` `{oldPassword,newPassword}` | :~82-96 | כן. `window.alert` הפך ל-`await ask()` (ראו הערה 3) |
| profile תמונה, `show_employee_profile_image`, `data-element-name` (21) | :~213-235 | כן |
| display-settings: סדר תופעות לוואי סינכרוני, כתיבות `designPrefs`/`customPalette`/cookies/`pushPrefsToServer` | כל הלוגיקה (שורות 1-358) | כן. diff -w: רק import ו-`PreviewStrip` |
| display-settings שליטות: מצב, פלטות, פלטות שלי, צבעים, מתג ידני, גופנים, צפיפות, גודל טקסט | :375-597 | כן. `data-theme-mode`, `data-density-mode`, `data-text-scale-mode` נשמרו. `Switch.onChange(checked)` מזין את `toggleManualNeutral(checked)` באותה חתימה |
| home: `recentSearches` + `dashboardRecentSearches`/`dashboardAiMessages`/`dashboardSearchInput`/`dashboardSearchResults` | `app/page.js` :188-311 | כן. כל קריאות ה-storage זהות. הישן לא הציג את `recentSearches` ב-JSX והחדש גם לא |
| home: קריאות (`/api/me`, settings, חיפוש גלובלי, AI) ומפתחות הגדרה (`require_login`, `hide_internal_messaging`, `home_welcome_title`) | לוגיקה זהה | כן, מלבד פער 1 |
| home: מודאל פרטיות (הוחלף מ-`createPortal` ל-`Dialog variant=sheet`) | :~640 | מצב open/close זהה. הטקסט נכתב מחדש (לא נתון) |
| home: טבלת AI, ייצוא Excel, `_actionUrl`/`_actionLabel`, 15 שורות | :~447-478 | כן, ראו הערה 2 |

## פערים חוסמים

אין.

## פער מהחוזה (לא חוסם נתונים, מומלץ לתקן)

1. **ברירת מחדל של כותרת הבית**
   - ישן `app/page.js:83`: `useState('ברוכים הבאים למערכת ניהול הגמ"ח')`
   - חדש `app/page.js:84`: `useState('ברוכים הבאים לגמ"ח')`
   - החוזה (`home.md` שורות 31 ו-96) קובע את המחרוזת הישנה כברירת מחדל. הכותרת עדיין נדרסת על ידי `home_welcome_title` כשהוא קיים, אז ההשפעה היא רק בארגון בלי הגדרה וברגע הטעינה הראשון. תיקון מוצע: להחזיר את המחרוזת הישנה, או לעדכן את החוזה במפורש אם זו החלטת עיצוב.

## הערות לא חוסמות

1. **החלפות alert/confirm בחלונית awaited**: `useAskDialog` מחזיר Promise שנפתר ב-true/false. ב-messages/my-hours/profile אין ענף שתלוי בערך ההחזרה. ב-punch-clock הערך מכריע ונשמר. ב-profile `setSaving(false)` (ב-`finally`) מתעכב עד לסגירת חלונית ההצלחה, בעוד שב-`window.alert` הישן החסימה הייתה סינכרונית. אין חשיבות, כי החלונית מודאלית.
2. **home, טבלת AI**: הישן רינדר תאים לפי `Object.entries(row)` של כל שורה (התאמה לפי מיקום). החדש בונה עמודות מ-`Object.keys(msg.data[0])` ומרנדר `row[k]`. אם שורות לא מכילות בדיוק אותם מפתחות בסדר זהה, החדש מדויק יותר. אפשרות התנהגות שונה בקצה, ולא נצפתה בנתוני השאילתות המוכרות (כולן SELECT אחיד).
3. **חלוניות עם `cancelLabel`**: Esc/לחיצה על ה-scrim מחזירים `false` (ביטול, בטוח). בחלוניות הודעה (בלי cancelLabel) סגירה מחזירה `true`, כמו סגירת alert.
4. **מלל**: הודעות שגיאה/הצלחה רבות נוסחו מחדש (`setError` ב-messages, הודעת ולידציה בשעון). אף אחת לא נשלחת לשרת או מושווית, למעט `includes('שגיאה')` בשעון שנשמר. הסרת האימוג'י `✅` מהודעת הצלחה בשעון היא קוסמטית.
5. **punch-clock, מתג הצגת סיסמה**: `IconBtn` עם `aria-pressed`. כפתור הכניסה/יציאה משתמשים ב-`loading` (מנוטרל + ספינר), שקול ל-`disabled={isLoading}`. כפתור היציאה שונה מ-`btn-danger` ל-`secondary` (קוסמטי).
6. **punch-clock/profile `Tip` בתוך `<label>`**: לחיצה על כפתור ה-ⓘ עלולה להפעיל את התווית ולהעביר פוקוס לשדה. קוסמטי, כדאי לבדוק בדפדפן.
7. **RTL/עיצוב**: נראה תקין בקוד (`<bdi>` לשעות/תאריכים/מספרים, `dir="ltr"` למייל ולקודי צבע, ללא `left/right` קשיחים). ב-home נשארו `position:fixed` עם `insetInline:0` ו-`marginInline:auto` (תקין ל-RTL). נותרו `style={{...}}` אינליין רבים אבל דרך משתני `--v3-*`. אין `alert()`/`window.confirm` שנותרו ב-6 העמודים.
8. **display-settings**: כל ה-class-ים הישנים (`mode-btn`, `density-btn`, `swatch-btn`, `font-opt`, `settings-wrap`) כבר אינם בשימוש בעמוד. `git grep` לא מצא קוד שמאתר אותם דרך `querySelector`, ולכן אין תלות חיצונית.

## מה לא נבדק סטטית (דורש דפדפן)

- עיצוב בפועל של העמודים תחת `data-v3` מול מערכת הפלטות המותאמת אישית של display-settings (האם tokens v3 מגיבים לפלטה שנבחרה).
- Focus trap, Esc והחזרת פוקוס ב-`Dialog` בפועל, ובפרט ב-punch-clock (זרימת כובסת).
- שהעמוד `/punch-clock` נטען בלי cookie התחברות כשהאפליקציה בנויה עם `require_login` דלוק (הקוד וה-layout לא השתנו, אבל לא הורץ).
- Tip בתוך label, ואינטראקציית מגע/hover.
- מובייל: גיליון תחתון של `Dialog`, וכן פריסת `Tabs` ב-messages עם 7 טאבים.
