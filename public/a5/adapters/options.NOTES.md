# options.js — הצעות לחיפוש המתקדם + הגדרה מהירה

קבצים: `public/a5/adapters/options.js`, וכן routes חדשים (קריאה בלבד): `app/api/a5/options/route.js`, `app/api/a5/settings/route.js`, `app/api/a5/settings/approvers/route.js`.
נבדק מול שרת הפיתוח (GET בלבד, עוגייה של רחלי בני ברק, הנהלה ראשית). לא בוצע שום POST.

## (א) מה מחובר

### `A5.adv.options(key, focus, typed) -> Promise<string[]>`
`GET /api/a5/options?key=&focus=&typed=` -> `{options:[...]}` עד 50, סינון בשרת, מיון עברי (מספרים: עולה). מטמון 60 שניות לכל (key,focus,typed). שגיאה = `Error` עם `.status`.
טקסט ריק = הנפוצים/האחרונים. עם טקסט = "מתחיל ב" קודם, ואם יש פחות מ-50 גם "מכיל".

| key | מקור אמיתי | בלי טקסט |
|---|---|---|
| first / last | `Customer.firstName` / `lastName` (לא מחוקים) | 50 הנפוצים ביותר (groupBy) |
| name | "פרטי משפחה" מ-Customer, כל מילה בטקסט חייבת להופיע בפרטי או במשפחה | 50 לקוחות שעודכנו לאחרונה |
| phone | `phone1`/`phone2` (ספרות בלבד בטקסט) | 50 טלפונים אחרונים |
| city | `Customer.city` | 50 הנפוצים |
| oid | `Order.orderId` (לא מחוקות), התחלה-של בלבד | 50 האחרונים (עולה) |
| item | ברקוד שמלה (`DressItem.dressBarcode`, התחלה-של) + שם דגם | ריק (יש 20K ברקודים; מחזיר שמות דגמים) |
| model | `DressModel.name` (לא מחוקים) | 50 שעודכנו לאחרונה |
| emp | עובדים פעילים, "פרטי משפחה" | מי שביצע הכי הרבה הזמנות |
| size | `DressItem.sizeText` (התחלה-של) | 50 הנפוצות |
| q | לפי `focus`: alterations = שמות+מס' הזמנה+דגמים; deliveries = שמות+טלפונים+מס' הזמנה; models; employees; settings = שמות ההגדרות (רק הנהלה/מנהלת סניף) | כמו הנ"ל, חלק שווה לכל מקור |

### `A5.settings`
- `get(key)` -> `GET /api/a5/settings?key=` -> `{key,name,category,location,pagePath,description,fieldType,currentValue,options?,limits?}`. נבדק: `daily_manager_report_hour` (text, "07:30"), `backup_interval_hours` (number + limits). 404 למפתח לא קיים, 403 לעובדת/אורחת.
- `approvers()` -> `GET /api/a5/settings/approvers` -> `[{id,name,role,roleId}]`: עובדים פעילים ב-roleId 0 או 2 (`HEAD_MANAGEMENT_ROLES`), ממוינים א-ב. הרשימה הנוכחית: 2 הנהלה ראשית + 4 מתכנתים (כולל חשבונות "משה-3/משה-4/מתכנד"). ראו GAPS.
- `validate(setting, value)` -> הודעת שגיאה או `null` (רק סוג number, אותם כללים כמו `app/lib/settingsValidation.js`).
- `save(key, value, {employeeId, pin})` -> **לא הורץ**. `POST /api/settings` עם `{items:[{key,value,name}], employeeId?, pin?}`. `value` = ערך תצוגה; ההיפוך למפתחות `hide_*` נעשה בפנים.

### התהליך האמיתי בשמירה (מ-SettingQuickPanel.js + POST /api/settings)
1. שולחים בלי אישור. השרת מאשר לפי העוגייה אם המשתמש הנהלה ראשית/מתכנת (`checkAuth('הנהלה ראשית')`, roleId 0/2).
2. אחרת 401 -> חלון אישור מנהל (`customAuthPrompt('...','הנהלה ראשית')`): בוחרים מאשר מהרשימה (roleId 0/2), מקלידים **את הסיסמה המלאה** שלו, ואז שולחים שוב עם `employeeId`+`pin`. **החלון האמיתי לא בודק את הסיסמה בנפרד**: השרת מאמת (`verifySecret`) בתוך אותו POST. (`/api/auth/verify-pin` קיים אבל לא בשימוש בשמירת הגדרה.) לכן "הסיסמה שגויה" מגיע כ-401 שני מה-POST.
3. מנהלת סניף (roleId 1) תמיד תגיע ל-401 בשלב 1, כלומר תמיד תצטרך אישור.

### סוגי שדות ותקינות (fieldType)
- `boolean`: 'true'/'false' (מתג). `select`: `options:[{value,label}]`; לפעמים רשימה סגורה (`gap_size_price_rule` = none|cheaper, שגיאת 400 אחרת). `number`: `limits:{min,max,allowDecimal?,allowEmpty?}`, שגיאות בעברית מ-`validate`. `multiline`/`text`: חופשי.
- קריאה בלבד (אין עריכה מהירה, יש רק "כל ההגדרות"): department, mandatoryFields, fieldGroups, secret, timestamp.
- שעות (`daily_manager_report_hour`, `pickup_reminder_hour` ועוד) הן `text` חופשי ללא ולידציה בשרת (הפורמט `HH:MM` שהאב-טיפוס בודק הוא בדיקה בצד לקוח בלבד).
- "כל ההגדרות" = `pagePath + '?tab=' + encodeURIComponent(category) + '&highlight=' + encodeURIComponent(key)` (שדות `pagePath`,`category` ב-get).

## (ב) GAPS
1. **"שעת הודעת הבוקר" אין לה מפתח באתר.** הקרובים: `daily_manager_report_hour` ("שעת דוח יומי", 07:30, נשלח למנהל במייל) ו-`pickup_reminder_hour` ("שעת תזכורת איסוף", 08:00). צריך החלטה איזה מהם האב-טיפוס מתכוון. עד אז אפשר לחווט את החלון ל-`daily_manager_report_hour` (כותרת מ-`name`, ערך מ-`currentValue`).
2. **"לא ברשימות" בכרטיס עובד לא קיים בקוד או בסכמה** (אין שדה כזה ב-`Employee`). לכן `emp` מחזיר את כל העובדים הפעילים (`isActive`), כולל חשבונות מערכת כמו "מנהל ." ו"פועל בשוד". לא הומצא סינון.
3. **הרשאת צפייה**: `GET /api/settings/guide` דורש roleId 1/2 ולכן נכשל להנהלה ראשית (0), בעוד האב-טיפוס מתיר 0 ו-1. לכן נוסף `/api/a5/settings` שמתיר 0/1/2 (אותו קטלוג בדיוק). אם רוצים ללכת בדיוק לפי הכלל הקיים, יש להחליף את הבדיקה בו.
4. רשימת המאשרים כוללת מתכנתים (roleId 2), כי כך `customAuthPrompt('הנהלה ראשית')` וגם `POST /api/settings` מגדירים. באב-טיפוס יש רק "הנהלה ראשית". אפשר לסנן ב-`roleId===0` אם רוצים, אבל אז זה שונה מהאתר.
5. שמות עובדים: `firstName lastName` (כמו ב-PopupProvider); ל-3 חשבונות הנתונים מוזנים הפוך (למשל "טיקוצ'ינסקי לאה") — זה הנתון במסד.
6. `item`: אין באתר "פריט" מובחן משם דגם/ברקוד, לכן זה ברקוד או שם דגם. הנתונים כוללים דגמים בשם "ללא שם - NNNN".
7. `oid`: סינון "מתחיל ב" בלבד (לא "מכיל"), כי המספר שמור כמספר.
8. אחרי שמירה אמיתית האתר קורא `invalidateSettings()` (מטמון צד-לקוח של האתר הרגיל, `app/lib/pageCache`). ב-/a5 אין את המטמון הזה; `A5.boot.settings` נשאר ישן עד רענון.

## (ג) הוראות שילוב ל-index.html

### הצעות
`advOpts(key)` (שורה 4424) סינכרוני וממיין הכול בלקוח. יש להחליף בגישה אסינכרונית עם טעינה בכל הקלדה:
1. `ADV_LOADED`/`ADV_LOADING`/timeout של 650ms (`advListOpen`, שורות 4465-4482): להסיר את ה-`ADV_LOADED` ואת ה-`setTimeout`. במקומם: להציג `ADV_LOADING()` בתוך ה-`ul`, לקרוא `A5.adv.options(key, ADV.focus, el.value.trim()).then(list => {...})`, ולצייר.
2. `advListPaint(el, ul)` (4458): במקום `advOpts(key)` + `all.filter(o => o.includes(q))` מקבלים `items` מוכנים מהשרת (כבר מסוננים וממוינים). שומרים את ה-`hl` (הדגשה) ואת "אין התאמות". מעבירים את `items` כפרמטר: `advListPaint(el, ul, items)`.
3. הבדיקה `if (!advOpts(key).length){ advListClose(); return; }` (4467) נמחקת (אי אפשר לדעת מראש). במקומה: אם התוצאה ריקה **והטקסט ריק** - `advListClose()`; אם ריקה עם טקסט - "אין התאמות".
4. מירוץ: לפני ציור בודקים שהתשובה עדיין רלוונטית: `if (ALX.list !== ul || el.value.trim() !== typedAtRequest) return;` (`ALX.loading` מתנהג כרגיל). בכל אירוע `input` נשלחת בקשה חדשה, ומומלץ debounce של כ-150ms (ה-`ALX.t` הקיים מתאים). האנימציה `ADV_LOADING` מוצגת רק כשאין עדיין רשימה על המסך (בהקלדה ממשיכים להציג את הקודמת עד שמגיעה החדשה, כדי שלא יהבהב).
5. שגיאה: `.catch(() => { ALX.loading = false; ul.innerHTML = '<li class="advo none" role="alert">אין חיבור לשרת. ההצעות לא נטענו.</li>'; })` במקום `serverFails()`.
6. `advOpts` ניתן להישאר כרשימת דמה לדמו; ב-/a5 האמיתי מוחלף בקריאה אסינכרונית. `EMPS` (4197) ו-`APPROVERS` (3831) לא נחוצים יותר להצעות.

### הגדרה מהירה
- `settingDlg` (4582): במקום `setTimeout(...600)` -> `A5.settings.get(KEY).then(s => { SET.s = s; SET.value = s.currentValue; SET.state = 'ready'; renderSetting('#spV'); }).catch(e => { SET.state = (e.status === 403 || e.status === 401) ? 'denied' : 'error'; renderSetting(); })`. `KEY` = מפתח ההגדרה (ראו GAP 1).
- `renderSetting` (4587): הכותרת `s.name` במקום 'שעת הודעת הבוקר' (וה-`aria`); העורך לפי `SET.s.fieldType` (text/number = שדה קיים; boolean = מתג; select = בחירה מ-`s.options`; קריאה בלבד = תצוגה ללא כפתור שמירה). כפתור "כל ההגדרות" (`set-full`, שורה 4678) פותח `SET.s.pagePath + '?tab=' + ... + '&highlight=' + key` במקום ה-toast.
- שמירה (`set-save`, שורה 4679): במקום בדיקת `^\d{1,2}:\d{2}$` בלבד: `A5.settings.validate(SET.s, SET.value)` (ובשעות: הבדיקה הקיימת). ואז `A5.settings.save(KEY, SET.value)`; אם `e.status === 401` -> `askApproval(...)` -> `A5.settings.save(KEY, SET.value, {employeeId: ok.id, pin: ok.pin})`. שגיאת 401 בניסיון השני = "הסיסמה לא נכונה, או שאין הרשאה לאשר" בתוך חלון האישור (כדאי לבצע את השמירה השנייה מתוך `apprOk` ולסגור את החלון רק בהצלחה).
- `askApproval` (4602): `APPROVERS` נטען ב-`A5.settings.approvers()` (במקום `setTimeout(...450)`); `id` = מזהה עובד אמיתי; `a.n`->`a.name`, `a.r`->`a.role`. `sel` ההתחלתי: העובד המחובר (`A5.boot.employee.id`) אם ברשימה, אחרת ריק (כמו באתר).
- `apprOk` (4624): `pw.value` נשלח כ-`pin` (הסיסמה המלאה) ולא נשמר בשום מקום. `apprFinish({id, name, pin})` (להוסיף `pin` לאובייקט). הטקסט "בהדגמה: 0000 = סיסמה שגויה" (`.ahint`) נמחק.
