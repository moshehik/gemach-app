# אימות התאמה: משפחת employees

ענף: `origin/redesign/site-v3-pages-employees` מול `origin/main` (base da56c88). קבצים: `app/employees/page.js`, `app/employees/[id]/page.js`, `app/employees/report/page.js`, `components/employees/ModernEmployeeHistoryTab.js`. חוזים: employees-list / employees-detail / employees-report. בדיקה סטטית בלבד (קריאה, diff, סקריפטי חילוץ ו-babel), לא הופעל דפדפן.

## פסק דין: ❌ פער חוסם אחד (תשתית, לא לוגיקת עמוד). הלוגיקה עצמה תואמת 100%.

כל ה-state/effects/fetch/handlers זהים לישן. הפער היחיד: כל ההמרות `alert` → `v3Toast` נשענות על `V3NotifyProvider`, שלא מחובר בשום מקום בענף. עד שיחובר, כל הודעה (הצלחה, שגיאה, ולידציה) שקטה לחלוטין.

## פערים חוסמים

### B1. `V3NotifyProvider` לא מחובר, כל ה-toasts (16 סוגי המרה, ראו טבלה) לא יוצגו
- ראיה: `app/v3/notify/README` שורה 1: "עדיין לא מחובר ל-app/layout.js". `git grep V3NotifyProvider|V3MessagesToast` על הענף מחוץ ל-`app/v3/notify` = 0 תוצאות. `app/layout.js` לא שונה בענף. (גם בענף `redesign/site-v3-2026-09-24`: 0.)
- `v3Toast`/`enqueueNotice` רק דוחפים ל-sessionStorage (`v3.notice.queue`) ואף רכיב לא מרנדר.
- השפעה על ההתנהגות: שגיאת שמירת משמרת (`[id]/page.js:279`), ולידציית "לא בחודש המוצג" (`:238`) ו"בחרו תאריך" (`:232`) חוסמות עם `return` אך שקטות: המשתמש לוחץ שמירה ולא קורה כלום ולא מוסבר למה. גם כשלי איפוס/קביעת/שינוי סיסמה, ולידציית 4 תווים, הודעת "הפרטים נשמרו", ושגיאות הדוח (`report/page.js:26,30`) נעלמות.
- תיקון: לחבר `<V3NotifyProvider>` ב-`app/layout.js` (בתוך PopupProvider, ראו README, "חיבור") לפני/עם מיזוג הענף. אם `persistToBell` נשאר `true` ב-`v3NoticeSaved` (`[id]/page.js:158`) חובה קודם ליישם `reports/notify-api-patch.md`.

## המרות alert → toast (רשימה מלאה, וסטטוס "חסם זרימה")

בישן אף `alert` לא החזיר ערך שמשמש את הזרימה. ה-`return` שאחרי ולידציה נשמר בכולן (זהה בחדש). "חסם" = הפסיק פעולה.

| # | ישן (`[id]/page.js` אלא אם צוין) | חדש | חסם זרימה בישן | נשמר |
|---|---|---|---|---|
| 1 | `:122` alert 'הפרטים נשמרו בהצלחה!' (ללא בדיקת res.ok) | `:164` enqueueNotice success | לא | כן, כולל ה-quirk (מוצג "נשמר" גם כש-PUT נכשל). `setPermissionsRefresh` נשאר לפני |
| 2 | `:125` 'שגיאה בשמירת נתונים' (catch) | `:168` v3Toast error | לא | כן |
| 3 | `:189` 'יש לבחור תאריך' + `return` | `:232` warn + `return` | **כן** (חוסם שמירה) | לוגיקה כן; נראות תלויה ב-B1 |
| 4 | `:195` חודש לא מוצג + `return` | `:238` warn 9s + `return` | **כן** | כמו לעיל |
| 5 | `:236` שגיאת שרת בשמירת משמרת (data.error) | `:279` | לא (אחרי fetch) | כן, data.error נשמר |
| 6 | `:239` 'שגיאה בתקשורת' | `:282` | לא | כן |
| 7 | `:248` שגיאת מחיקה | `:291` | לא | כן |
| 8 | `:250`, `:266` שגיאת תקשורת | `:293`, `:309` | לא | כן |
| 9 | `:264` שגיאת שחזור (data.error) | `:307` | לא | כן |
| 10 | `:443/445/448` reset-password (הצלחה/כישלון/חריגה) | `:500/502/505` | לא | כן. `data.message` של השרת נשמר, ובהצלחה כולל את כתובת המייל |
| 11 | `:484` 'יש להזין סיסמא חדשה' + `return` | `:528` warn + `return` | **כן** | כן |
| 12 | `:498/500/503` שינוי סיסמה | `:542/544/547` | לא | כן, סגירת הכרטיס וניקוי השדות רק בהצלחה (זהה) |
| 13 | `:523` 4 תווים + `return` | `:565` warn + `return` | **כן** | כן (`length < 4` זהה) |
| 14 | `:537/539/542` set-password | `:579/581/584` | לא | כן |
| 15 | `report:24` 'שגיאה בטעינת הנתונים' | `report:26` | לא | כן, `setLoading(false)` ב-finally |
| 16 | `report:28` 'שגיאת תקשורת' | `report:30` | לא | כן |

**לא הומרו (נשארו native `alert`)**: `app/employees/page.js:164,168` (חיפוש AI: `result.error`, 'שגיאת תקשורת'). זהה לישן, לא חוסם.

הערה: הודעות שגיאה נעלמות אחרי 8 שניות (הצלחה/אזהרה 4 שניות, `SHORT_MS`), לעומת alert שנשאר עד אישור. במיוחד `reset-password` שמחזיר 502 "הסיסמה אופסה אך שליחת המייל נכשלה" (הסיסמה כבר הוחלפה, המנהל חייב לקרוא). מומלץ `durationMs` ארוך לענף זה.

## טבלת חוזה

### /employees (list), `app/employees/page.js`
| פריט בחוזה | קיים? (חדש) | זהה? |
|---|---|---|
| טאבים list/attendance | `:325` `<Tabs onChange={setActiveTab}>` | כן |
| חיפוש רגיל: form onSubmit=handleSearch, שדה, ניקוי | `:370-383`, `:376` | כן (ה-handlers ללא שינוי) |
| חיפוש AI + ניקוי + toggle + submit + disabled בטעינה | `:341-364` (`Btn loading={aiLoading}` = disabled) | כן |
| כפתור סטטיסטיקה בשני המצבים (clientX/Y) | `:359`, `:382` | כן |
| סינון סטטוס active/inactive/all | `:388` `<Seg>` | כן. איבד `title` tooltips (הערה) |
| "עובד חדש" → `/employees/new` | `:398` | כן |
| 6 מפתחות מיון של הרשימה (code, fullName, department, phone1, isActive, needsPasswordReset) | `:411-416` | כן, כולם `handleEmpSort` |
| 6 מפתחות מיון של נוכחות + עמודת פעולות no-print | `:510-516` | כן (7 עמודות) |
| תוכן התאים (קוד, שם, תפקיד, טלפון, badge סטטוס, badge סיסמה) | `:425-445` | כן |
| שורה לחיצה → `/employees/{id}` | `:421-424` | כן. נוספו `tabIndex`+Enter |
| empty / loading / table-foot count | `:447-452`, `:430`, `:455` | כן (טקסט שונה) |
| ניווט חודשים (chevron-end=קודם, chevron-start=הבא) | `:466`, `:470` | כן, RTL נשמר |
| תפריט הדפסה (2 פריטים, `null` בקריאה לכולם, disabled בריק, ref + document click) | `:473-488`, `printMenuRef` | כן |
| ExportButtons (props/columns/data) | `:491` | זהה (הבלוק לא בדיף) |
| `#print-area` אח של `div.no-print`, thead חוזר, ללא CSS vars | `:315` / `:571`; CSS `:292-312` | כן, ללא שינוי |
| fetch list `all=true` דרך `fetchSharedJson TTL.STATIC` | `:118-126` | זהה |
| **quirk**: `loading` לא נכבה בכישלון fetch | `:123`, `:125` (`console.error` בלבד) | **נשמר** |
| attendance fetch `?month=&year=` | `:145` effect | זהה |
| smart-search POST body `{prompt,pageContext:'employees'}` + native alert | `:164,168` | זהה |

### /employees/[id] (detail), `app/employees/[id]/page.js`
| פריט | חדש | זהה? |
|---|---|---|
| data-agy-id: back-button, tab-employee-details/attendance/history, employee-form, save-employee-button | `:386`, `:400-402` (דרך `AgyTabs attrs`), `:408`, `:648` | כן (סקריפט attrs סימן את הטאבים כ"חסרים", זה false positive: הם מוזרקים ב-`{...t.attrs}`) |
| data-element-name | נשמרו בכל השדות/כפתורים. נמחקו רק 7 של `<svg>` איקונים (`רכיב_page_5/14/16/44_icon/63_icon/64_icon/66`) | הערה |
| id-ים `employee-detail-*` ב-input | דרך `Field id` (cloneElement/rest): `:411-414`, `:449`, `:484`, `:519-522`, `:559`, `:632-634`, `:660` | כן |
| שדות: firstName, lastName, fullName, joinDate, phone1, phone2, email, city, street, houseNum, notes, hourlyWage, paymentMethod | `:411-475`, `:441`, `:630-631` | כן, name/value/onChange זהים. `required` על firstName/lastName/phone1 בתוך `<form onSubmit>` |
| checkboxes (travelExpenses, isActive, receiveEmailAlerts) | `:632-634` `Switch` + `setFlag` → `handleChange({target:{name,value,type:'checkbox',checked}})` | כן, אותה הזנה ל-handleChange |
| email: העתק / שלח מייל / השלם @gmail.com | `:455`, `:456`, `:460-470` | כן, תנאים זהים |
| מחלקה: 3 מצבים (deptLoadFailed number / null disabled / select + "לא ברשימה") | `:416-439` | כן. טקסט האופציות שונה, הערכים זהים |
| profileImage: FileReader, תצוגה `data:image`, הסרה, showProfileImage | `:597-626` | כן |
| PUT/POST כל `employee` (כולל shifts, profileImage) | `:146-153` | זהה |
| כרטיסי סיסמה, 3 זרימות | `:479-594` | כן (ראו להלן) |
| הרשאות ספציפיות + `EmployeePermissionsPanel key={permissionsRefresh} employeeId={id}` רק `id!=='new'` | `:638-645` | כן. הרכיב עצמו לא בדיף |
| טאב נוכחות: checkbox מחוקות (מפעיל refetch), חודש 0-11, שנה 2024-2027 קשיח, הדפס, הוסף (disabled) | `:660-680` | כן |
| thead 8 עמודות + שורת "תקופה" colSpan=8 | `:689-703` | כן |
| add-row (HebrewDatePicker 250, time x2, מושבתים, notes, שמור/בטל), edit-row (רק entry/exit) | `:706-738`, `:746-775` | כן |
| מיון/סינון משמרות, incomplete shift, deleted (opacity + line-through) | `:336-347`, `:741-745` | כן |
| סיכום שכר `calculateMonthlySalary` | `:812-817` | כן |
| ריק "אין משמרות" colSpan 8 | `:801-807` | כן |
| היסטוריה `<ModernEmployeeHistoryTab employeeId>` | `:822-826` | כן |
| SendEmailModal רק `id!=='new'` | `:829-836` | כן |
| הדפסה `.print-area` / `.no-print` / thead חוזר | CSS `:358-381`, כרטיס `:656` | כן. נוספו כללי `.v3-table__wrap` |
| fetches: settings, departments, employee (+includeDeleted, אפקט `[id, router, showDeletedShifts]`), shifts POST/PUT/DELETE, password x3 | `:81-132`, `:223-311`, `:489-585` | זהים (סקריפט: היחידים שנוספו `useRef` ו-`confirmDlg`) |
| quirk: `fetchEmployee` ללא catch | `:121-127` | נשמר |
| quirk: הודעת "נשמר" ללא בדיקת res.ok | `:155-166` | נשמר (else = כל מה שאינו create עם id) |

### /employees/report
| פריט | חדש | זהה? |
|---|---|---|
| `#employees-report-month/-year` (id, value, onChange, 5 שנים) | `:183`, `:194` דרך `Field as="select" id` | כן |
| כפתור חזרה `/employees`, הדפס, אקסל + disabled `loading||data.length===0` | `:170`, `:208-217` | כן |
| `fetchData` + `useEffect` תלויות | `:15-36` | זהה |
| `handlePrint`, `handleExportExcel` (xlsx דינמי, שמות עמודות/גיליונות, מיון firstName, שם קובץ) | `:40-107` | זהה בית לבית (לא בדיף) |
| `#print-area` מחוץ ל-`.no-print`, `.employee-page` יחיד (Card), thead חוזר, `.bsd-header` | `:225`, `:242`, CSS `:108-165` | כן. כללי הדפסה הועברו ל-`.v3-card`/`.v3-table`/`.report-foot` כנדרש בחוזה |
| שגיאות: alert x2 | `:26`, `:30` toast | ראו B1 |

### ModernEmployeeHistoryTab
לוגיקה, fetch ותלויות זהים (סקריפט). שונה רק JSX ומיפוי `ACTION_BADGE_CLASS` (ערכי `done/attn/soft` תקפים ב-`Tag`). כל 18 המפתחות נשמרו. `import React` לא בשימוש (לא חוסם).

## שלושת כרטיסי הסיסמה (אבטחה)
1. **שינוי**: `POST /password` body `{oldPassword,newPassword}` זהה, ולידציית ריק, סגירה וניקוי רק בהצלחה (`:526-549`).
2. **איפוס + מייל**: `await window.customAuthPrompt(...)`, `null` = יציאה, body `{authPin,authEmployeeId}` (`:489-507`).
3. **קביעה ידנית**: `customAuthPrompt` שומר `setPasswordAuth`, פותח כרטיס, ולידציה ≥4, body `{authPin,authEmployeeId,newPassword}` עם `setPasswordAuth?.` (`:508-591`).

כפתורי ביטול מנקים state (כולל `setPasswordAuth(null)`). לא השתנו: endpoints, מפתחות, סדר בדיקות. `window.customAuthPrompt` עדיין מ-PopupProvider.

## מחיקה/שחזור משמרת, זרימת אישור
`window.customConfirm` הוחלף ב-`askConfirm` (Promise + Dialog v3, `:72-79`, `:286-311`, `:838-852`): `if (!await askConfirm(...)) return;` אותה צורת await. אישור → `resolve(true)`; ביטול, Esc או לחיצה על ה-scrim → `false` (`onClose={()=>settleConfirm(false)}`). ה-DELETE/PUT (`{isDeleted:false}`) ובדיקת `res.ok`→`fetchEmployee()` זהים. הדיאלוג מרונדר רק בענף הראשי, ואין unmount בזמן ההמתנה (`fetchEmployee` לא מדליק `loading`). לא תלוי ב-B1.

## ממשק חריגות הרשאה
`EmployeePermissionsPanel` ו-`SendEmailModal` לא שונו בענף (לא בדיף). נשמרו: `key={permissionsRefresh}`, `employeeId={id}`, התנאי `id!=='new'`, קישור `/admin/permissions`, והעלאת `permissionsRefresh` אחרי שמירה (`:162`). לא ניתן לבדוק סטטית את עיצוב הפאנל (מחלקות legacy בתוך `[data-v3]`).

## הערות לא חוסמות
1. list: `Tip` בתוך שורה לחיצה: Enter על כפתור ה-Tip מבעבע ל-`tr onKeyDown` ומנווט לכרטיס (`page.js` ~`:421-445`). מומלץ `onKeyDown` stopPropagation על ה-span (`stopPropagation` קיים רק ל-onClick).
2. list: לחיצה על ה-`th` מחוץ לכפתור לא ממיינת (בישן: כל ה-th). סף קטן.
3. list: `Seg` ללא tooltips; `row-flag` הוחלף בסגנון inline (`--v3-charge-bg`).
4. dedupe של `enqueueNotice`: אותה הודעה תוך אותו דלי 10 ש' נבלעת (לחיצה חוזרת על שמירה כושלת לא תציג שוב).
5. `[id]`: `v3NoticeSaved` ביצירת עובד חדש (`:158`) עם persistToBell (התנהגות חדשה, בישן לא היה משוב). תלוי ב-`notify-api-patch.md`.
6. `[id]`: Dialog המחיקה מתמקד ב"מחיקה" כברירת מחדל (`data-autofocus`). לוודא מול `customConfirm` הישן.
7. RTL: אין `left/right` קשיחים חדשים (`left:0` בכללי `#print-area` הישנים). `bdi` על תאריכים, שעות, ₪ ומספרים נוסף. כל האיקונים דרך `<Icon>` ואומתו מול הספרייט (סקריפט: 0 חסרים).
8. `app/version.json` שונה בענף (מחוץ לתחום, נוטה לקונפליקט מיזוג).
9. `SortHead` מוסיף `aria-sort` (שיפור).
10. `alert` native שנותרו: `app/employees/page.js:164,168`.

## לא נבדק סטטית (דורש דפדפן)
- רינדור toasts אחרי חיבור provider, ומיקומם מול Dialog פתוח.
- הדפסה בפועל של 3 המסכים (`#print-area` בתוך `[data-v3]`, `position:absolute` בתוך `.v3-page`, שבירת עמודים של `Card.employee-page`).
- מראה `EmployeePermissionsPanel`/`HebrewDatePicker`/`SendEmailModal`/`StatisticsModal`/`ExportButtons` בתוך `[data-v3]`.
- סדר אירועי תפריט ההדפסה (click על document מול toggle של `IconBtn`).
- התנהגות Esc/scrim של Dialog מול `customConfirm` הישן.

## ראיות (מקוצר)
- `git diff --name-status origin/main...B -- app components lib`: 3 עמודי employees + `ModernEmployeeHistoryTab` (M), `app/v3/**` (A), `app/version.json` (M). אין שינוי ב-`app/layout.js`, ב-`app/employees/layout.js`, בפאנל הרשאות או ב-lib.
- סקריפט חילוץ (`useState/useRef/useEffect/fetch/JSON.stringify/deps/method/headers/handle*`), ישן מול חדש:
  - `app/employees/page.js`: IDENTICAL (47 שורות).
  - `report/page.js`: IDENTICAL (9).
  - `ModernEmployeeHistoryTab.js`: IDENTICAL (7).
  - `[id]/page.js`: הפרש יחיד = `+useRef` (ל-`AgyTabs`) ו-`+confirmDlg` state.
- `@babel/parser` + `traverse` על 4 הקבצים: OK, ללא imports לא בשימוש (חוץ מ-`React` בהיסטוריה), ללא מזהים לא מוגדרים.
- איקונים: כל שמות ה-`Icon` קיימים ב-`app/components/IconSprite.js` (main) + `IconSpriteV3`.
- `git grep "V3NotifyProvider|V3MessagesToast"` על הענף מחוץ ל-`app/v3/notify`: 0.
