# שליחת קבצים למייל / לדרייב דרך GAS - טבלת הוראות + הרשאות הורדה מלאה

## מה נוסף?

בכל מסך שליחת מייל ניתן כעת לבחור **יעד בהתאמה** לכל הקבצים:
| יעד | מה קורה בפועל |
|---|---|
| צרופה למייל | הקבצים מצורפים כרגיל למייל (Gmail) |
| העלאה לדרייב + שיתוף | הקבצים עולים לתיקיית הדרייב, משותפים ישירות עם כתובת הנמען + קישור פתוח, והמייל מכיל טבלת הוראות עם קישורי הורדה |
| גם וגם | צרופה למייל **וגם** עותק בדרייב עם קישור |

בכל שליחה מצורפת אוטומטית **טבלת הוראות מסודרת** בגוף המייל (HTML + טקסט):
| # | שם הקובץ | גודל | יעד | איך מורידים? |
|---|---|---|---|---|
| 1 | הזמנה 25747.pdf | 1.2 MB | מצורף למייל | פתחו את הצרופה בתחתית המייל ולחצו הורדה |
| 2 | תקנון.pdf | 300 KB | נשמר בדרייב | קישור להורדה - פתוח עם הרשאת הורדה מלאה |

## קבצים ששונו במערכת

- `lib/emailTemplates.js` - `renderAttachmentsGuideTable` + `renderAttachmentsGuideText` + `formatFileSizeHebrew`
- `lib/mailer.js` - `normalizeAttachments` + `buildGasPayload`, תמיכה ב-`attachments[]`, `sendMode`, `driveFolderId`, `grantFullDownload`
- `app/api/send-email/route.js` - מקבל `attachments`, `sendMode`, `driveFolderId`, שולח ל-GAS + שומר `driveLinks` ב-EmailLog/AuditLog
- `app/api/orders/[id]/email/route.js` - מקבל `extraAttachments` + `sendMode` בנוסף ל-PDF ההזמנה
- `components/SendEmailModal.js` + `ModernSendEmailModal.js` - בחירת קבצים מרובים, טבלת תצוגה מקדימה, בחירת יעד
- `components/orders/OrderPrintMenu.js` - מודאל אפשרויות לפני שליחת מייל הזמנה/השכרה (קבצים נוספים + יעד)
- הגדרה חדשה: `email_drive_folder_id` (מסך ניהול -> הגדרות -> מיילים)

## פריסת ה-GAS (חובה לעדכן פעם אחת)

הקוד המלא נמצא ב: `docs/gas-mail-drive.gs` - להעתיק ל-script.google.com.

### צעדים:

1. לפתוח https://script.google.com -> הפרויקט הקיים של הגמ"ח (זה שה-URL שלו שמור ב-`email_link_a`).
2. להחליף את תוכן `Code.gs` בתוכן של `docs/gas-mail-drive.gs`.
3. **הפעלת שירותים (פעם אחת):**
   - Services (+) -> `Drive API` (לא חובה, אבל מומלץ כדי לאכוף `viewersCanCopyContent:true`).
   - אין צורך בספריות חיצוניות.
4. **Deploy -> Manage deployments -> Edit -> New version**, לוודא:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. להעתיק את ה-Web app URL החדש להגדרות המערכת (`email_link_a`, ובמידת הצורך `email_link_b`).
6. **תיקיית דרייב (רשות):**
   - לפתוח Google Drive -> ליצור תיקייה (למשל "גמח שמלות - קבצים ללקוחות") -> להעתיק את ה-ID מה-URL (`.../folders/XXXX`).
   - להדביק ב-ניהול -> הגדרות -> `תיקיית דרייב לשליחת קבצים`. אם ריק - נשמר בשורש הדרייב של חשבון ה-GAS.
7. בדיקה: לשלוח לעצמך מייל עם קובץ אחד ביעד "גם וגם" -> לוודא שמגיע מייל עם צרופה + טבלה + קישור דרייב שנפתח בגלישה בסתר (הוכחה שהקישור פתוח).

### הרשאות הורדה מלאה - איך זה עובד?

לכל קובץ שעולה לדרייב ה-GAS מבצע:
```js
file.addViewer(shareEmail); // שיתוף ישיר לנמען
file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); // קישור פתוח
// + אם Drive API מופעל: viewersCanCopyContent:true, copyRequiresWriterPermission:false
```
- `VIEW` ב-Drive = צפייה **והורדה** (כל עוד לא ננעל במפורש) - לכן הנמען יכול להוריד בלי לבקש גישה.
- אם בארגון שלך יש מדיניות שחוסמת הורדה - הפעלת ה-Drive API בקוד פותחת אותה ברמת הקובץ.

### תאימות לאחור

- פריסת GAS ישנה מתעלמת מהשדות החדשים (`attachments`, `sendMode`, `driveFolderId`) וממשיכה לשלוח את `fileName/fileContent` הראשון - לכן המערכת תמשיך לעבוד גם לפני עדכון ה-GAS.
- אחרי עדכון ה-GAS מתקבל `driveLinks` בתשובה (`{status:'success', driveLinks:[{fileName,url,id}]}`) והמערכת מציגה אותו במודאל ושומרת ב-EmailLog.
