# חוזה: `/employees/report` — דוח נוכחות חודשי
קובץ: `app/employees/report/page.js` (308 שורות, `'use client'`).

## 1. מטרה וגישה
הפקת דוח נוכחות לכל העובדים לחודש נבחר: הדפסה/PDF (עמוד לכל עובד) וייצוא Excel. גישה: `app/employees/layout.js` (הנהלה ראשית/מתכנת). אין פריט ב-sidebar; הכניסה דרך כרטיס קיצור בדף הבית `app/page.js:51` (`label:'דוח נוכחות'`, `icon:'i-activity'`, מגבלה `'headManagement'` שורה 39), וגם `lib/permissionsMetadata.js:276` / `lib/howToGuide.js:97`. ⚠ `[id]/page.js` לא מיירט את `report` כי קיים סגמנט סטטי.

## 2. אזורים
1. `<style>` הדפסה (שורות 109-158) — כמו ב-`/employees` (`#print-area`, `.no-print`, `.employee-page`, `.bsd-header`).
2. `div.no-print`: כפתור "חזור לניהול עובדים" (`btn-ghost`, `#i-arrow-end`, `router.push('/employees')`) + `page-head` (`h1` "דוח נוכחות חודשי" + `page-desc`) + `page-actions`: בורר חודש, בורר שנה, כפתור הדפסה, כפתור אקסל.
3. `#print-area`: `.bsd-header` (בס"ד, רק בהדפסה) → טעינה (`spinner lg`) / ריק (`empty-state`+`#i-calendar`) / רשימת `card.employee-page` לכל עובד.

## 3. שדות
| שדה | id | בקרה | ערכים | state |
|---|---|---|---|---|
| חודש | `employees-report-month` | `select.select` | 1-12, תווית שם חודש עברי | `selectedMonth` (ברירת מחדל: חודש נוכחי) |
| שנה | `employees-report-year` | `select.select` | 5 שנים אחורה מהשנה הנוכחית (`currentDate.getFullYear() - i`) | `selectedYear` |
שינוי כל אחד מפעיל `useEffect` → `fetchData`.

## 4. כפתורים
| תווית/title | handler | אפקט | disabled |
|---|---|---|---|
| "חזור לניהול עובדים" | `router.push('/employees')` | ניווט | — |
| הדפס / PDF (`#i-printer`, icon-only) | `handlePrint` → `window.print()` | הדפסה של `#print-area` | `loading || data.length===0` |
| ייצוא לאקסל (`#i-download`) | `handleExportExcel` | ראו 6 | כנ"ל |

## 5. קריאות רשת
| Method+URL | טריגר | תשובה |
|---|---|---|
| `GET /api/employees/attendance?month=M&year=Y` (fetch רגיל, ללא מטמון) | mount + שינוי חודש/שנה | `{success,data:[{id,firstName,lastName,department:{name},shifts:[{id,date,entryTime,exitTime,totalMinutes,totalCalculated,hourlyWageSnapshot,travelExpensesSnapshot,notes}]}]}`. `!success` → `alert('שגיאה בטעינת הנתונים')`; חריגה → `alert('שגיאת תקשורת')` |
אין POST/PUT בדף. `loading` נדלק בכל fetch ונכבה ב-finally (בניגוד ל-`/employees`).

## 6. ייצוא Excel (לוגיקה מלאה — R24)
- `await import('xlsx')` דינמי בלחיצה (~900KB, לא ב-bundle הראשי).
- מיון עובדים לפי `firstName` (`localeCompare`).
- גיליון 1 "ריכוז נתונים": עמודות `'מזהה עובד'` (=`emp.id`), `'שם העובד'`, `'מספר משמרות'`, `'סה"כ שעות'` (דקות/60 ב-2 ספרות), `'סה"כ תשלום'`.
- גיליון לכל עובד עם משמרות (שם גיליון ≤31 תווים; ביטול-התנגשות: מוסיף `emp.id.substring(0,4)`; חריגה שנייה נבלעת): עמודות `'תאריך'` (`getHebrewDateString(shift.date)` מ-`lib/hebrewDate`), `'כניסה'`, `'יציאה'`, `'סה"כ דקות'`, `'שכר שעה'`, `'נסיעות'`, `'סה"כ יומי'`, `'הערות'`.
- קובץ: `דוח_נוכחות_{M}_{Y}.xlsx` (`XLSX.writeFile`). **שמות העמודות והגיליונות הם חוזה נתונים** — לא לשנות.

## 7. תצוגת הכרטיסים (מסך + הדפסה)
לכל עובד עם `shifts.length>0`: `card.employee-page` → `card-head` (avatar עם ראשי-תיבות, "דוח נוכחות עובד: שם", "תקופה: חודש שנה", badge `#i-category` "מחלקה: X" אם יש) → `table.data`: שורת thead "תקופה: ..." (`colSpan=5`, חוזרת בכל עמוד מודפס) + כותרות `תאריך`/`כניסה`/`יציאה`/`סה"כ שעות`/`סה"כ לתשלום`. שורה: תאריך עברי (`getHebrewDateString`), כניסה/יציאה `he-IL` HH:mm או `-`, שעות (דקות/60, 2 ספרות, `0.00` אם אין), `₪` 2 ספרות (`cell-primary`). `table-foot`: סה"כ משמרות / שעות / לתשלום (ירוק `var(--success)`).
- עובד בלי משמרות: מדולג (`return null`). אם כל התשובה ריקה: `empty-state` "לא נמצאו נתוני נוכחות לחודש המבוקש."

## 8. URL/אחסון/הגדרות
אין params, אין storage, אין SystemSetting, אין הבדלי org.

## 9. מלל
כפתור חזרה; כותרת+תיאור עמוד; תוויות חודש/שנה; tooltips 2 כפתורים; כותרת כרטיס/תקופה/מחלקה; 5 כותרות עמודה; תוויות ה-foot (3); הודעת ריק; 2 הודעות alert. (שמות עמודות אקסל = חוזה נתונים, לא מלל לשכתוב.)

## 10. Risk notes
1. `#print-area` חייב להישאר מחוץ ל-`.no-print`. ב-CSS ההדפסה יש override מקומי: `#print-area .card{background:#fff}` ו-`table.data thead th,.table-foot{background:#fff}` — אם משנים מחלקות `card`/`table.data` ל-`v3-*`, יש להעתיק את כללי ההדפסה (ראו R17/print-surfaces).
2. `page-break-after` על `.employee-page` — ה-wrapper של כל עובד חייב להיות אלמנט יחיד שמכיל את הכרטיס כולו.
3. תאריך עברי מחושב בלקוח (`getHebrewDateString`); לא להחליף בפורמט אחר בייצוא.
4. `alert()` native — R19/R20: אפשר להחליף בטוסט, אבל חייבים להישאר שני מצבי השגיאה.
5. אין לשמר את "בס"ד" כ-`display:none` inline — הוא מוצג בהדפסה ע"י `.bsd-header{display:block!important}`.
