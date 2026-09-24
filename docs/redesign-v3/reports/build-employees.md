# דוח בנייה — משפחת employees

ענף: `redesign/site-v3-pages-employees` (מבוסס `redesign/site-v3-2026-09-24`).
קבצים שהוחלפו (שכבת תצוגה בלבד): `app/employees/page.js`, `app/employees/[id]/page.js` (כולל `/employees/new`), `app/employees/report/page.js`, `components/employees/ModernEmployeeHistoryTab.js`.
לא נגעתי: `layout.js` (שער שרת), `app/api`, `lib`, `prisma`, `app/v3`, רכיבים משותפים.

## צ'קליסט חוזה
### employees-list
- [x] state / effects / fetch (`fetchSharedJson` ל-`/api/employees?all=true`, `/api/employees/attendance`, `POST /api/ai/smart-search`) — ללא שינוי, כולל `loading` שנשאר true בכישלון (מלכודת ידועה נשמרה).
- [x] חיפוש רגיל / AI, איפוס מצב AI ביציאה מטאב הרשימה, כפתור סטטיסטיקה במיקום הקליק (`StatisticsModal` ללא שינוי).
- [x] 6 מפתחות מיון ברשימה + 6 בנוכחות, אותה לחיצה-חוזרת-הופכת-כיוון (`compareSortValues` ללא שינוי), ללא מיון ברירת מחדל.
- [x] סינון סטטוס פעילים/לא פעילים/כולם; "עובד חדש" → `/employees/new`; שורה לחיצה (נוסף: Enter במקלדת).
- [x] ניווט חודשים: קודם = `chevron-end`, הבא = `chevron-start` (לא הפוכים); שנה נחצית ב-12↔1.
- [x] תפריט הדפסה נסגר ב-`document click` (אותו `ref` ואותו listener); `handlePrintPdfs(null,...)` בכל קריאה "לכולם".
- [x] `#print-area` נשאר אח של `div.no-print`; כל מבנה ההדפסה (ושמות המחלקות/הצבעים הקשיחים) הועתק כמו שהוא.
- [x] `ExportButtons` מקבל את אותם `data`/`columns`/`filename`.
### employees-detail
- [x] אותו אובייקט `employee` נשלח ב-`POST`/`PUT` (state יחיד, `handleChange` ללא שינוי; מתגים קוראים ל-`handleChange` עם אובייקט target זהה).
- [x] ולידציית `required` על שם פרטי/משפחה/נייד בתוך `<form onSubmit>`.
- [x] "שמור" מציג הצלחה גם על שגיאת שרת (חוזה קיים, לא נבדק `res.ok`).
- [x] 3 זרימות סיסמה (שינוי / איפוס+שליחה / קביעה ידנית) — אותם endpoints, גופים וולידציות (4 תווים).
- [x] בורר מחלקה: 3 מצבים (נכשל/נטען/רגיל) + אופציה למחלקה שאינה ברשימה.
- [x] נוכחות: `showDeletedShifts` מפעיל fetch מחדש; בורר שנה קשיח 2024-2027 נשמר; `saveShift` (payload, בדיקת חודש מוצג, חציית חצות) ללא שינוי; מחיקה/שחזור אותה זרימת await.
- [x] `data-agy-id` / `data-element-name` נשמרו (גם בטאבים — דרך `AgyTabs` מקומי), מזהי `employee-detail-*` נשמרו.
- [x] `.print-area` + `no-print` + שורת `thead` כפולה נשמרו.
### employees-report
- [x] ייצוא Excel: שמות עמודות/גיליונות ולוגיקה ללא שינוי; `getHebrewDateString` בתצוגה ובייצוא.
- [x] מזהי `employees-report-month` / `-year`, 5 שנים אחורה, `disabled` כש-`loading || data.length===0`.
- [x] `.employee-page` עוטף יחיד לכל עובד; כללי הדפסה הועתקו למחלקות v3 (`.v3-card`, `.v3-table th`).

## שכתובי מלל בולטים
- "ניהול עובדים ונוכחות" → "עובדים ונוכחות"; טאבים "הצוות" / "שעות עבודה"; "שאלות סטטיסטיקה" → "שאלות על הנתונים"; "חפש בחכמה" → "חיפוש חכם".
- הסברים הועברו ל-`Tip` (כותרת עמוד, שם לתצוגה, מחלקה, סיסמה, הרשאות, "לעדכן" בטבלה).
- כרטיס עובד: "פרטי העובד / יצירת קשר וכתובת / סיסמה לשעון הנוכחות / שכר והגדרות / הרשאות אישיות"; טאבים "פרטים / שעות ושכר / היסטוריה".
- כל `alert()` הוחלף ב-`v3Toast` (שגיאה/אזהרה/הצלחה) בנוסח חדש; הודעות שמגיעות מהשרת (`data.message`, `data.error`) לא שונו.

## התראות (§4 שורה 8)
- יצירת עובד: `v3NoticeSaved` (נשמר בפעמון) ממש לפני `router.push`, בתוך try/catch.
- שמירת עובד קיים: `enqueueNotice` kind success, בלי פעמון (אין ניווט) — הוחלף `alert('הפרטים נשמרו…')`.

## חלוניות
- אישור מחיקת משמרת / שחזור משמרת: `Dialog` מסוג confirm, מצב כהה, אותה זרימת `await` (Promise) — `askConfirm` מקומי.
- כרטיסי הסיסמה נשארו inline (חוזה: לא modal; Enter בשדה שלהם ממשיך לשלוח את הטופס כמו קודם).

## חריגות / סטיות
1. טבלאות: 6/7/8 עמודות נשמרו (מפתחות המיון והדפסה מחייבים); לא הועברו לשורה מורחבת. הטבלה בנויה מ-`v3-table` ולא מ-`<Table>` (חסר `onRowClick`, ראו REQ-4).
2. `AgyTabs` מקומי במקום `Tabs` (REQ-1).
3. רוחב 250px קשיח סביב `HebrewDatePicker` (רכיב משותף) — נשמר.
4. טבלת ההדפסה ב-/employees (`#print-area`) נשארת בצבעי inline קשיחים — בכוונה (חוזה, print-surfaces).
5. מרכיבי `ExportButtons`, `SendEmailModal`, `HebrewDatePicker`, `EmployeePermissionsPanel`, `StatisticsModal`, `ChangesChips` נשארו בסגנון הישן.

## בקשות פתוחות
`docs/redesign-v3/requests/employees.md` (REQ-1 עד REQ-6).

## ספקות
- ההודעות (`v3Toast`) לא יוצגו עד חיבור `V3NotifyProvider` (REQ-6) — עד אז שגיאות שהיו alert נבלעות בתור.
- לא הרצתי את הדפים בדפדפן (נדרש login + שרת יחיד); עברו `eslint` נקי (אזהרת `<img>` קיימת מראש). מומלץ סקירת RTL ב-getBoundingClientRect והדפסה בפועל.
- `customAuthPrompt` נשאר (REQ-2).
