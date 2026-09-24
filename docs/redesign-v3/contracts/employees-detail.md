# חוזה: `/employees/[id]` (וגם `/employees/new`) — כרטיס עובד
קובץ: `app/employees/[id]/page.js` (872 שורות, `'use client'`). `id==='new'` = מצב יצירה (אותו קובץ; אין `app/employees/new`).

## 1. מטרה וגישה
כרטיס עובד: פרטים + שכר + הרשאות ספציפיות; טאב נוכחות וסיכום שכר עם עריכת משמרות; טאב היסטוריה. גישה: `app/employees/layout.js` (הנהלה ראשית/מתכנת בלבד). ניווט אליו: שורת טבלה ב-`/employees`, כפתור "עובד חדש".

## 2. אזורים לפי סדר
1. `<style>` הדפסה (`page.js:303-323`): `.print-area` נראה בהדפסה; `.no-print` מוסתר.
2. `page-head.no-print`: `h1` = `'עובד חדש'` או `כרטיס עובד: {firstName} {lastName}` + כפתור חזרה (`#i-arrow-end`, `title="חזרה"`, `router.back()`, `data-agy-id="back-button"`).
3. `div.tabs.no-print` — **רק כש-`id!=='new'`**: "פרטי עובד" (`#i-id`, `data-agy-id=tab-employee-details`), "נוכחות וסיכום" (`#i-clock`), "היסטוריה" (`#i-history`). `activeTab` ברירת מחדל `'details'`.
4. טאב `details`: `form.card.card-pad.no-print` (`data-agy-id="employee-form"`, `onSubmit=handleSave`) — ראו 4.
5. טאב `attendance`: `div.print-area.card.card-pad` — ראו 5.
6. טאב `history`: `<ModernEmployeeHistoryTab employeeId={id}/>` (קומפוננטה פנימית: `GET /api/employees/{id}/history`).
7. `<SendEmailModal isOpen onClose defaultTo={employee.email} employeeId={id}>` — רק כש-`id!=='new'`.

## 3. State
`employee` (אובייקט מלא — נשלח כמו שהוא ב-PUT/POST), `loading`, `activeTab`, `saving`, `permissionsRefresh` (מפתח re-mount לפאנל הרשאות), `emailModalOpen`; נוכחות: `filterMonth` (0-11), `filterYear`, `editingShiftId` (`null`/id/`'new'`), `editShiftData`, `isAddingShift`, `showDeletedShifts`; סיסמה: `showChangePassword`, `oldPasswordInput`, `newPasswordInput`, `showSetPassword`, `setPasswordInput`, `setPasswordAuth`; `departments` (`null`=נטען), `deptLoadFailed`, `showProfileImage` (ברירת מחדל true).
ברירת מחדל ל-new (`page.js:71-78`): כל המחרוזות ריקות, `travelExpenses:false`, `isActive:true`, `receiveEmailAlerts:false`, `shifts:[]`.

## 4. טאב "פרטי עובד" — כל שדה
כולם `name=<key>` ו-`handleChange` (checkbox → `checked`, אחרת `value`), מזהי `employee-detail-<name>`.
| תווית | name | סוג | חובה | הערות |
|---|---|---|---|---|
| שם פרטי * | `firstName` | text | `required` | |
| שם משפחה * | `lastName` | text | `required` | |
| שם מלא (מחושב/לתצוגה) | `fullName` | text | — | |
| תאריך כניסה לארגון | `joinDate` | date | — | ערך: `new Date(joinDate).toISOString().split('T')[0]` |
| טלפון נייד * | `phone1` | text | `required` | |
| טלפון נוסף | `phone2` | text | — | |
| דוא"ל | `email` | email | — | ברוחב 620; כשיש ערך: כפתור "העתק כתובת מייל" (`#i-link`, `navigator.clipboard`) + "שלח מייל" (`#i-mail` → `setEmailModalOpen(true)`). כשאין `@`: כפתור "השלם ל- @gmail.com" (מוסיף `@gmail.com` למה שהוקלד) |
| עיר / רחוב / בית | `city`,`street`,`houseNum` | text | — | |
| סיסמא לשעון נוכחות | `password` (רק ב-new) | text | — | ב-new: input חופשי (`maxWidth 460`). בקיים: ראו 4.1 |
| מחלקה (תפקיד) | `roleId` | select / number | — | ראו 4.2 |
| תמונת פרופיל / מסמך | `profileImage` (data-URL) | file `image/*,.pdf` | — | מוצג רק אם `showProfileImage`; FileReader→`readAsDataURL`; תצוגה מקדימה רק אם מתחיל ב-`data:image`, אחרת avatar ראשי-תיבות; כפתור "הסר" מנקה |
| הערות | `notes` | textarea | — | `gridColumn: span 2` |
| **נתוני שכר** (`h2.section-title`) | | | | |
| שכר לשעה (₪) | `hourlyWage` | number step .01 | — | |
| אופן תשלום | `paymentMethod` | text | — | |
| זכאות לנסיעות | `travelExpenses` | checkbox | — | |
| עובד פעיל במערכת | `isActive` | checkbox | — | |
| קבלת התראות מערכת למייל | `receiveEmailAlerts` | checkbox | — | |
- "הרשאות ספציפיות" (`h2`, רק כש-`id!=='new'`) + `<EmployeePermissionsPanel key={permissionsRefresh} employeeId={id}/>` + קישור `<a href="/admin/permissions">` בטקסט.
- שמירה: כפתור submit "שמור פרטים" / "שומר..." (`btn-primary btn-lg`, `data-agy-id="save-employee-button"`, disabled בזמן `saving`).

### 4.1 סיסמה (רק כש-`id!=='new'`) — 3 זרימות (כולן חוזה אבטחה)
- שדה מושבת `********` (`#employee-detail-pwDisplay`) + 3 כפתורים + הסבר `hint`.
- **"שינוי סיסמא"** → פותח כרטיס: סיסמא ישנה (`oldPasswordInput`) + חדשה (`newPasswordInput`), "ביטול" / "אשר שינוי". ולידציה: חדשה ריקה → `window.alert('יש להזין סיסמא חדשה')`. `POST /api/employees/{id}/password` body `{oldPassword,newPassword}`; `data.success` → סוגר, מנקה, alert "הסיסמא שונתה בהצלחה"; אחרת alert `data.message||'שינוי הסיסמה נכשל'`; חריגה: "שגיאה בשינוי הסיסמה".
- **"אפס ושלח למייל"** (`#i-refresh`): `await window.customAuthPrompt('הזן קוד מנהל לאיפוס הסיסמה ושליחתה למייל העובד:','מנהל')` (חלון PopupProvider). null → יוצא. `POST /api/employees/{id}/reset-password` body `{authPin: authResult.pin, authEmployeeId: authResult.employeeId}`; `window.alert(data.message||...)`.
- **"קבע סיסמה ידנית"** (`#i-lock`): `customAuthPrompt('הזן קוד מנהל לקביעת סיסמה ישירות לעובד:','מנהל')` → שומר `setPasswordAuth` ופותח כרטיס "סיסמה חדשה לעובד". ולידציה: אורך ≥4 (`alert('הסיסמה חייבת להכיל לפחות 4 תווים')`). `POST /api/employees/{id}/set-password` body `{authPin, authEmployeeId, newPassword}`.

### 4.2 מחלקה
- `deptLoadFailed` → `input type=number` (name `roleId`) + hint אדום "רשימת המחלקות לא נטענה...".
- `departments===null` → select מושבת "טוען מחלקות...".
- אחרת select: "ללא מחלקה" (value ''), `{dept.name} ({dept.roleId})` לכל מחלקה, ואם הערך הקיים לא ברשימה: אופציה "מחלקה לא מוכרת (X)" (כדי לא לדרוס בשקט).

## 5. טאב "נוכחות וסיכום" (`page.js:676-853`) — `.print-area`
- Toolbar: `h2` "דוח נוכחות וסיכום - שם"; checkbox "הצג מחוקות" (`showDeletedShifts` — **מפעיל fetch מחדש** עם `?includeDeleted=true`); select חודש (0-11, שמות עבריים); select שנה (**קשיח**: 2024-2027); "הדפס / ייצא PDF" (`window.print()`); "הוסף משמרת" (disabled כש-`isAddingShift||editingShiftId!==null`).
- טבלה `table.data`, `thead`: שורת "תקופה: חודש שנה" (`colSpan=8`) + 8 כותרות: תאריך לועזי, תאריך עברי, שעת כניסה, שעת יציאה, סה"כ דקות, לתשלום (₪), הערות, פעולות (`no-print`).
- מיון שורות: לפי `date` ואז `entryTime||date` (ישן→חדש). סינון: חודש+שנה נבחרים; מחוקות רק אם `showDeletedShifts`.
- שורה רגילה: תאריך `he-IL`, `hebrewDate||'-'`, כניסה/יציאה HH:mm, `totalMinutes||'-'`, `₪totalCalculated`, הערות. צבעים: שורה לא שלמה (`entry xor exit`, לא מחוקה) רקע `warning-tint`; מחוקה `opacity .6 + line-through`. פעולות: עריכה (`#i-edit`, title "ערוך רק כניסה ויציאה"), מחיקה (`#i-trash`, אדום, "מחק"); למחוקה: שחזור (`#i-refresh`, ירוק, "שחזר").
- **שורת הוספה** (`isAddingShift`): `HebrewDatePicker` (`selectedDate=editShiftData.date`, `onChange=handleHebrewDateChange`, ברוחב 250, `colSpan=2`), `input time entryTime`, `input time exitTime`, שני inputs מושבתים "מחושב אוטומטית", `notes`, "שמור"/"בטל".
- **שורת עריכה** (`editingShiftId===shift.id`): תאריך/עברי/דקות/תשלום/הערות **מושבתים**; רק `entryTime`/`exitTime` ניתנים לעריכה; "שמור"/"בטל".
- **סיכום שכר**: כרטיס ירוק (`#i-coin`, "סיכום שכר", תווית חודש, `₪` = סכום `totalCalculated` של משמרות לא-מחוקות בחודש/שנה — `calculateMonthlySalary`, `toFixed(2)`).
- ריק: "אין משמרות לחודש זה." (`colSpan=8`).

### 5.1 `saveShift` (`page.js:180-241`) — חוזה מדויק
1. Add: `POST /api/employees/{id}/shifts`; edit: `PUT /api/employees/{id}/shifts/{editingShiftId}`.
2. ולידציה בהוספה: אין תאריך → `alert('יש לבחור תאריך למשמרת')`; תאריך מחוץ לחודש/שנה המוצגים → alert ארוך עם שם החודש המוצג.
3. payload = `editShiftData` **בלי** `totalMinutes`,`totalCalculated`; בהוספה: `displayedMonth`,`displayedYear` (=filterMonth 0-11, filterYear); `date`→`toISOString()`; `entryTime`=`new Date(dateBase+'T'+entryTime).toISOString()` או `null`; `exitTime` כנ"ל, ואם יציאה<כניסה מוסיפים 24 שעות (משמרת חוצת חצות) או `null`.
4. הצלחה (`res.ok`) → `cancelEditShift()` + `fetchEmployee()`. אחרת `alert(data.error||'שגיאה בשמירת משמרת')`; חריגה: `alert('שגיאה בתקשורת')`.
5. שדות נוספים ב-payload (נשלחים): `hebrewDate`, `notes`, `isDeleted`.
- **מחיקה**: `await window.customConfirm('האם אתה בטוח שברצונך למחוק משמרת זו? ההיסטוריה תישמר במערכת אך השורה תוסתר.')` → `DELETE /api/employees/{id}/shifts/{shiftId}`; `res.ok`→`fetchEmployee()` אחרת `alert('שגיאה במחיקת משמרת')`.
- **שחזור**: `customConfirm('האם לשחזר משמרת זו?')` → `PUT /api/employees/{id}/shifts/{shift.id}` body `{isDeleted:false}`.

## 6. קריאות רשת (טבלה מלאה)
| Method+URL | טריגר | body/params | תשובה |
|---|---|---|---|
| `GET /api/settings` | mount | — | מחפש `key==='show_employee_profile_image'`; `value!=='false'` → `showProfileImage`. שגיאה נבלעת. |
| `GET /api/departments` | mount | — | מערך `{roleId,name}`; כישלון → `deptLoadFailed` |
| `GET /api/employees/{id}` (+`?includeDeleted=true`) | mount, שינוי `id`, שינוי `showDeletedShifts`, אחרי כל שמירה/מחיקה/שחזור משמרת | — | אובייקט עובד+`shifts`; `data.error` → `router.push('/employees')`. ⚠ אין catch: כישלון רשת משאיר `loading` |
| `POST /api/employees` | שמירה ב-new | body = `employee` כולו | `data.id` → `router.push('/employees/'+id)` |
| `PUT /api/employees/{id}` | שמירה בקיים | body = `employee` כולו (כולל `shifts`, `profileImage`) | הצלחה: `setPermissionsRefresh(n+1)` + `alert('הפרטים נשמרו בהצלחה!')`. ⚠ לא בודק `res.ok` — alert הצלחה גם על שגיאת שרת (חוזה קיים!) |
| `POST /api/employees/{id}/password` / `reset-password` / `set-password` | ראו 4.1 | | |
| `POST/PUT/DELETE /api/employees/{id}/shifts[/{sid}]` | ראו 5.1 | | |
| `GET /api/employees/{id}/history` | טאב היסטוריה (רכיב פנימי) | | |
| `GET/PUT/DELETE /api/admin/permissions/employees/{id}` (`?key=`) | `EmployeePermissionsPanel` | | alert על כשל |
| `GET /api/employees`, `POST /api/send-email` | `SendEmailModal` | | |
מטמון: אין (fetch רגיל).

## 7. חלוניות
`SendEmailModal`; `customAuthPrompt` (שתי פעמים), `customConfirm` (מחיקה/שחזור) — חלוניות PopupProvider גלובליות; `window.alert`/`alert` native בכ-15 מקומות (ראו לעיל). כרטיסי סיסמה הם inline (לא modal).

## 8. URL/אחסון/הגדרות
- Path param `id` (UUID או `'new'`; ה-API מקבל גם legacyId). אין query. אין storage.
- SystemSetting: `show_employee_profile_image` (בדף). org: אין הבדל בקוד; ההגדרה פר-DB.
- `data-agy-id` (`back-button`, `tab-employee-details`/`-attendance`/`-history`, `employee-form`, `save-employee-button`) — קיימים לסוכן ה-AI/אוטומציה: **לשמר**. גם `data-element-name` (כלי דיבוג) — מומלץ לשמר.

## 9. מלל
כותרות: עובד חדש / כרטיס עובד; 3 טאבים; ~22 תוויות שדה; hints (סיסמה, מחלקות); 2 כותרות סקשן (נתוני שכר, הרשאות ספציפיות) + פסקת הסבר; כפתורי סיסמה (5+) ותוויות; כותרות טבלה (8); מצבי ריק; ~15 הודעות alert/confirm/prompt (רשימה בסעיפים 4-5).

## 10. Risk notes
1. **`PUT` שולח את `employee` כולו** — כולל `shifts` ו-`profileImage` (data-URL כבד). עיצוב מחדש שמפרק את ה-form לכמה כרטיסים חייב עדיין לשלוח אובייקט אחד עם אותם מפתחות.
2. `alert('הפרטים נשמרו בהצלחה!')` מוצג בלי בדיקת `res.ok` — R8: לא לשנות התנהגות; אם מחליפים ב-toast (R20) — להשאיר אותה לוגיקה.
3. `required` על firstName/lastName/phone1 הוא ולידציית HTML5 של ה-form — חייבים להישאר בתוך `<form onSubmit>`.
4. עובד חדש: הטאבים מוסתרים ואין `SendEmailModal`/פאנל הרשאות; אחרי POST הדף מנווט ל-`/employees/{id}` (remount).
5. `filterMonth` הוא 0-11 בדף הזה ו-1-12 ב-`/employees` ו-`/employees/report` — אל תאחדו.
6. בורר שנה קשיח 2024-2027 (יישבר בתחילת 2028) — לשמר או לתעד כבאג ידוע.
7. הדפסה: `.print-area` = הכרטיס בטאב נוכחות; `no-print` על עמודת פעולות ועל הכפתורים. השורה הכפולה ב-thead ("תקופה") נועדה לחזור בכל עמוד מודפס.
8. `HebrewDatePicker` (portal) מקבל/מחזיר מחרוזת `YYYY-MM-DD`; רוחב 250px עטוף ב-`position:relative` — חלונית שנפתחת בתוך תא טבלה.
9. R17: תאריכי `he-IL`/שעות/₪ בתוך `<bdi>`.
