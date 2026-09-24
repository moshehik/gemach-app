# חוזה: `/employees` — ניהול עובדים ונוכחות
קובץ: `app/employees/page.js` (693 שורות, `'use client'`). שורות מצוינות כ-`page.js:N`.

## 1. מטרה וגישה
- מסך שני טאבים: **רשימת עובדים** (`activeTab='list'`, ברירת מחדל) ו-**נוכחות** (`'attendance'`) — סיכום חודשי + הדפסה + ייצוא. `page.js:42`.
- גישה: `app/employees/layout.js` → `checkPageAccess(HEAD_MANAGEMENT_ROLES)`; אחרת `<NoAccessMessage/>` (הנהלה ראשית roleId 0 / מתכנת 2 בלבד). גם קישור ה-nav `showEmployeesTab` (layout.js:205) שווה ל-`isHeadManagement` כשמחובר.
- ה-layout הוא שער-שרת: אין לגעת.

## 2. אזורים לפי סדר
1. `<style>` הדפסה מוטמע (`page.js:278-302`): `#print-area{display:none}`; ב-`@media print` מסתירים הכל חוץ מ-`#print-area`, גווני-אפור, `.no-print` מוסתר, `.employee-page` שובר-עמוד, `thead` חוזר.
2. `div.no-print` (מעטפת המסך):
   - `StatisticsModal` (מותנה `showStatistics`, `page.js:305`).
   - `page-head` עם `h1` "ניהול עובדים ונוכחות".
   - `div.tabs` — 2 כפתורי טאב (איקון `#i-users` / `#i-clock`).
   - טאב רשימה: `toolbar` (סרגל חיפוש רגיל/AI, `spacer`, `pill-tabs` סינון סטטוס, כפתור "עובד חדש") ← `table-wrap` (`table.data` + `table-foot`).
   - טאב נוכחות: `toolbar` (חודש קודם, תווית חודש+שנה, חודש הבא, `spacer`, תפריט הדפסה, `ExportButtons`) ← `table-wrap`.
3. `#print-area` (מחוץ ל-`no-print`; רק בטאב נוכחות, `page.js:586`): "בס"ד" (`.bsd-header`, מוצג רק בהדפסה) + מצב `summary` (טבלת סיכום) או `full` (עמוד לכל עובד).

## 3. State (חייב להישמר)
| state | ברירת מחדל | שימוש |
|---|---|---|
| `activeTab` | `'list'` | טאב פעיל |
| `employees`, `loading` | `[]`, `true` | רשימת עובדים; `loading` נכבה רק ב-fetch מוצלח |
| `search` / `searchInput` | `''` | `search` = הערך המוחל (ב-submit), `searchInput` = מה שהוקלד |
| `filterStatus` | `'active'` | `active`/`inactive`/`all` |
| `isAiModeActive` | false | התוצאות הגיעו מ-AI (מדלג על סינון טקסט, ועל fetch ה-list) |
| `aiLoading`, `aiInputMode`, `aiInputText` | false/false/'' | סרגל AI; מתאפסים בעזיבת טאב list (`page.js:74-79`) |
| `showStatistics` | false | `false` או `{x,y}` מיקום הקליק (מועבר כ-`position`) |
| `empSort`, `attSort` | `{key:null,direction:'asc'}` | מיון צד-לקוח; לחיצה חוזרת מהפכת כיוון |
| `selectedMonth` (1-12) / `selectedYear` | חודש/שנה נוכחיים | ניווט חודשים; חציית שנה ב-12↔1 (`page.js:203-219`) |
| `attendanceData`, `loadingAttendance` | `[]`, false | תשובת ה-API |
| `printEmployeeId`, `printMode`, `printMenuOpen` | null/'full'/false | הדפסה |

## 4. שדות וחיפוש
- **חיפוש רגיל** (`form onSubmit=handleSearch`): input טקסט, placeholder "חיפוש עובד (שם, טלפון, קוד)...". `handleSearch` מעתיק `searchInput→search` ומכבה `isAiModeActive`. כפתור "ניקוי" (`x`) מופיע כשיש טקסט → `handleClearSearch` (מאפס הכל, מכבה AI). לוגיקת הסינון (`page.js:163-172`): סטטוס לפי `isActive`; ואז אם לא AI — התאמה חלקית (lowercase) ב-`שם מלא`, `phone1`, `String(id)`, `String(legacyId)`.
- **חיפוש AI**: כפתור כוכב (`title="חיפוש חכם (AI)"`) → `toggleAiInputMode` (מעביר טקסט בין השדות). במצב AI: input + כפתור "נקה" (כשיש טקסט ולא טוען) + כפתור כוכב (מודגש) + "שאלות סטטיסטיקה" + submit "חפש בחכמה"/"מייצר שאילתה..." (disabled בזמן טעינה). submit ריק (trim) = לא עושה כלום.
- **כפתור סטטיסטיקה** (איקון `#i-activity`, `title="שאלות סטטיסטיקה"`): פותח `StatisticsModal pageContext="employees"` במיקום הקליק (`e.clientX/Y`). קיים בשני מצבי הסרגל.
- **pill-tabs סינון**: "פעילים" (`#i-user-check`), "לא פעילים" (`#i-user`), "הכל" (`#i-users`) — `title` = "עובדים פעילים"/"לא פעילים"/"הצג הכל".
- **"עובד חדש"** → `router.push('/employees/new')` (מנותב ל-`[id]/page.js` עם `id==='new'`).
- **ניווט חודשים**: כפתור הקודם משתמש ב-`#i-chevron-end` (RTL: ימין=אחורה) עם `title="חודש קודם"`; הבא `#i-chevron-start` `title="חודש הבא"`. שם החודש: `toLocaleDateString('he-IL',{month:'long'})`.

## 5. טבלאות
### 5.1 רשימת עובדים (`page.js:415-454`) — 6 עמודות, כולן ממויינות (`sortable`, `sort-active`, `SortIcon`)
| כותרת | מפתח מיון | תוכן שורה |
|---|---|---|
| קוד עובד | `code` = `legacyId || id` | `legacyId || id.substring(0,5)` (`cell-primary`) |
| שם מלא | `fullName` | `firstName lastName` |
| תפקיד | `department` = `department.name` או `roleId` | `department?.name ?? (roleId || 'עובד')` |
| טלפון | `phone1` | `phone1 || '-'` |
| סטטוס | `isActive` (1/0) | badge `badge-success` "פעיל" / `badge-neutral` "לא פעיל" |
| סיסמה | `needsPasswordReset` | אם `needsPasswordReset`: `badge-warning` + איקון + "יש לעדכן" + `title` הסבר (איפוס בכרטיס העובד) |
- שורה לחיצה: `router.push('/employees/'+employee.id)`.
- מצב ריק: שורת `colSpan=6` "לא נמצאו עובדים התואמים את החיפוש." (מוצג כשסינון = 0).
- טעינה: `page-loading` עם `spinner lg` + "טוען נתונים...". שורת `table-foot`: `סה"כ שורות מוצגות: N` (או `...` בטעינה).
- מיון: `compareSortValues` — מספרי אם שני הערכים מספרים, אחרת `localeCompare(...,'he')`. **אין מיון ברירת מחדל** (סדר השרת).

### 5.2 סיכום נוכחות (`page.js:520-575`) — 7 עמודות
`שם` (`fullName`), `ס"ה דקות` (`totalMinutes`, מוצג כ-`timeStr` = "X שעות ו Y דקות"), `כמות ימים` (`daysCount`=מספר משמרות), `תקלות` (`issues`, אדום + `#i-alert-tri` כש>0), `ס"ה` (`totalCalculated.toFixed(2)`), `נסיעות` (`hasTravels` "כן"/"לא"), `פעולות` (`no-print`, כפתור "הדפס" `title="הדפס דוח אישי לעובד זה"` → `handlePrintPdfs(emp.id)` עם `stopPropagation`).
- "תקלה" = משמרת עם כניסה xor יציאה (`page.js:250`). שורה עם תקלות מקבלת `className="row-flag"`.
- **מסוננים**: רק עובדים עם `daysCount>0` (`page.js:271`).
- שורה לחיצה → `/employees/{id}`. ריק: "לא נמצאו נתוני נוכחות לחודש זה." (`colSpan=7`). טעינה: spinner במרכז. `table-foot` כמו לעיל.

## 6. קריאות רשת
| מתי | Method+URL | פרמטרים | שימוש בתשובה / מטמון |
|---|---|---|---|
| טעינת טאב list כש-`!isAiModeActive` (גם בחזרה מ-AI ובמעבר טאב) | `GET /api/employees?all=true` דרך `fetchSharedJson(..., {ttl:TTL.STATIC})` (`lib/apiCache`) | `all=true` | מערך → `employees`. מטמון משותף (חימום גם ב-`prefetchRoutes['/employees']`). שגיאה: רק `console.error`, **`loading` נשאר true** (מלכודת) |
| טעינת/שינוי חודש בטאב attendance | `GET /api/employees/attendance?month=M&year=Y` (`fetch` רגיל) | month 1-12, year | `{success,data:[{id,firstName,lastName,department,shifts:[{id,date,entryTime,exitTime,totalMinutes,totalCalculated,travelExpensesSnapshot}]}]}`; רק אם `success` |
| submit חיפוש AI | `POST /api/ai/smart-search` | body `{prompt, pageContext:'employees'}` | `result.data` → `employees`, `isAiModeActive=true`. שגיאה: `alert(result.error||'שגיאה בחיפוש החכם')` / `alert('שגיאת תקשורת')` |
| `ExportButtons` (רכיב פנימי) | `GET /api/me`, `POST /api/auth/verify-pin`, `POST /api/ai/report` | — | רכיב משותף `components/ExportButtons.js`; props: `data=processedAttendance`, `filename='נוכחות_{M}_{Y}'`, `iconOnly`, columns: שם/ס"ה דקות/כמות ימים/תקלות/ס"ה/נסיעות |
| `StatisticsModal` | `POST /api/ai/statistics`, `POST /api/ai/sessions` | — | רכיב משותף; localStorage `ai_statistics_chat_sessions_employees` |

## 7. חלוניות / הודעות
- `StatisticsModal` (צף, ממוקם ליד הקליק).
- תפריט הדפסה (`card` אבסולוטי, `insetInlineEnd:0`, נסגר בקליק-חוץ דרך listener על `document`): "דוחות מלאים לכל עובד" → `handlePrintPdfs(null,'full')`; "טבלת סיכום בלבד (חודש שנה)" → `'summary'`. הכפתור disabled כש-`processedAttendance` ריק.
- `handlePrintPdfs`: סוגר תפריט, קובע `printEmployeeId`/`printMode`, ו-`setTimeout(window.print,100)`.
- `alert()` native בשגיאות AI (2 מקומות). אין toast.

## 8. מצב הדפסה (חייב להישמר ברמת מבנה)
- `#print-area` נראה רק בהדפסה. מצב `summary`: כותרת "טבלת סיכום נוכחות - כלל העובדים", "תקופה: חודש שנה", טבלה 6 עמודות (שם, סה"כ שעות, כמות ימים, תקלות, סה"כ לתשלום `₪x.xx`, נסיעות).
- מצב `full`: לכל עובד (או רק `printEmployeeId`) `div.employee-page`: "דוח נוכחות עובד: {שם}", תקופה, "מחלקה: X"; טבלה (תאריך `he-IL`, כניסה, יציאה — "חסר" באדום אם אין יציאה, שעות = דקות/60 ב-2 ספרות, לתשלום `₪`), ותחתית סיכום: סה"כ משמרות / שעות / לתשלום (ירוק `#10b981`).
- צבעי ההדפסה קשיחים (`#fff`,`#000`,`#eee`...) בכוונה — **אסור** להחליף ב-CSS vars (ראו כלל print-surfaces בזיכרון הפרויקט).

## 9. אחסון / URL
- אין URL params. אין localStorage/sessionStorage של הדף (רק של StatisticsModal). אין SystemSetting בדף. אין הבדלי org.

## 10. מלל (לכתיבה מחדש — לא להעתיק)
כותרת עמוד; 2 תוויות טאב; placeholder של 2 סרגלי חיפוש; 3 תוויות סינון + tooltips; "עובד חדש"; 6 כותרות עמודה + 7 כותרות נוכחות; badges פעיל/לא פעיל/יש לעדכן; מצבי ריק (2); הודעות שגיאת AI (2); כותרות הדפסה (בס"ד, דוח נוכחות עובד, טבלת סיכום...); תפריט הדפסה (2 פריטים); tooltips: חודש קודם/הבא, הדפסת נוכחות, ניקוי חיפוש, חיפוש חכם, שאלות סטטיסטיקה, הדפס דוח אישי; `table-foot` "סה"כ שורות מוצגות".

## 11. Risk notes לעיצוב מחדש
1. `loading` לעולם לא נכבה אם ה-fetch נכשל — לשמר (R8) או לתעד; אל "לתקן" בשקט.
2. מעבר טאב list→attendance→list מפעיל fetch מחדש ומאפס סרגל AI, אבל **לא** מאפס `isAiModeActive`/`employees` (נשארת תוצאת AI).
3. `printEmployeeId` נשאר אחרי הדפסה אישית; הדפסת "מלא לכולם" מאפסת אותו דרך הארגומנט `null` — חובה להעביר `null` בכל קריאה לכולם.
4. `#print-area` חייב להיות **אח** של `div.no-print` (לא בן שלו) — `.no-print{display:none}`. שינוי הורים שובר הדפסה.
5. עמודת "פעולות" ב-attendance היא `no-print`; `thead` חייב להישאר `table-header-group` בהדפסה.
6. R16: אפשר להעביר עמודות משניות (טלפון/סיסמה) לשורה מורחבת, אבל 6 מפתחות המיון חייבים להישאר זמינים.
7. RTL: כפתורי חודש ממופים `chevron-end`(קודם)/`chevron-start`(הבא) — לא להפוך; מספרים/טלפונים/₪ ב-`<bdi>`.
8. תפריט ההדפסה נסגר ב-`document click` (לא mousedown); כפתור הפתיחה עושה toggle — שים לב בסדר אירועים בחלונית חדשה.
9. ExportButtons מקבל `processedAttendance` (עם `timeStr`, `hasTravels`) — לא לשנות שמות שדות בו.
