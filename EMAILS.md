# מיילים של המערכת

כל מייל שהמערכת שולחת עובר דרך **מנגנון אחד**: Google Apps Script ("מערכת מייל פתוח", scriptId
`17NBtcK5BmFq21mqzp_nCFxEu4ujSYvCWVgLo8lGdrLGYvGDEkUEjjder`) שמקבל JSON ב-POST ושולח את הודעת ה-Gmail.
כתובת ה-`/exec` נקבעת בהגדרות `email_link_a` / `email_link_b` / `email_routing_strategy` ומחושבת **במקום
אחד בלבד** - `resolveScriptUrl()` ב-[lib/mailer.js](lib/mailer.js) (כולל כתובת ה-fallback הקשיחה, שכבר לא
משוכפלת בקבצים אחרים).

## הספרייה האחידה (נוצרה 2026-09-22)

| קובץ | תפקיד |
|---|---|
| [lib/emailCatalog.js](lib/emailCatalog.js) | **מקור האמת ל"אילו מיילים יש"** - רשומה לכל מייל (מפעיל, נמענים, נושא, תבנית, מתג הגדרות, קבצים, קבצי מקור). הנושאים מוגדרים **רק כאן**: `emailSubject('id', params)`. `listEmailCatalog()` לרשימה מלאה. |
| [lib/emailTemplates.js](lib/emailTemplates.js) | תבניות HTML משותפות + עזרי RTL (`textToHtml`, `rtlPlainText`, `stripManagementGreeting`). |
| [lib/emailSamples.js](lib/emailSamples.js) | מיילים לדוגמה לכל סוג (למסך `/admin/email-test`). |
| [lib/mailer.js](lib/mailer.js) | השליחה עצמה: `sendSystemEmail` (שליחה + רישום ב-EmailLog), `postToMailer` (נקודת היציאה היחידה ל-Apps Script), `buildGasPayload`, `resolveScriptUrl`. |

**חוקים:**
1. אף קוד לא עושה `fetch` ישיר ל-`script.google.com`. כל מייל עובר `sendSystemEmail` (או `postToMailer` כשצריך payload מיוחד, כמו כרטיס ההזמנה).
2. אף קוד לא כותב נושא מייל בעצמו - רשומה ב-`emailCatalog.js` + `emailSubject(...)`.
3. גוף המייל ב-HTML נבנה מ-`renderGenericEmailHtml` (או תבנית ייעודית בקובץ התבניות) - לא מחרוזת HTML ידנית באתר השליחה.
4. **להוספת מייל חדש:** רשומה בקטלוג ← עיצוב בתבנית ← שליחה דרך `sendSystemEmail` ← דוגמה ב-`emailSamples.js` ← שורה בטבלה למטה.

## טבלת כל המיילים (16)

| # | מייל | מזהה בקטלוג | מה מפעיל | נמען | נושא | מתג הגדרה | קבצים מצורפים | קובץ שליחה |
|---|---|---|---|---|---|---|---|---|
| 1 | איפוס סיסמה - עצמי | `passwordResetSelf` | "שכחתי סיסמה" | העובד | איפוס סיסמה - מערכת הגמ"ח | - | ללא | `app/api/auth/forgot-password/route.js` |
| 2 | איפוס סיסמה - ע"י מנהל | `passwordResetManager` | מנהל מאפס בכרטיס עובד | העובד | איפוס סיסמה - מערכת הגמ"ח | - | ללא | `app/api/employees/[id]/reset-password/route.js` |
| 3 | מייל חופשי ("שלח מייל") | `managerFreeText` | מנהל/מתכנת בחלון "שלח מייל" | כתובת שהוקלדה (+עותק) | הנושא שהוקלד | - | קבצים שצורפו (מייל/דרייב) | `app/api/send-email/route.js` |
| 4 | כרטיס הזמנה / השכרה | `orderCard` | "מייל הזמנה" / "מייל השכרה" | מייל הלקוח | הזמנה #N - גמ"ח שמלות | - | PDF של ההזמנה | `app/api/orders/[id]/email/route.js` |
| 5 | אישור יצירת הזמנה | `orderCreatedAuto` | הזמנה חדשה נקלטה | הלקוח | הזמנה #N - <שם הגמח> | `auto_email_on_order_create` | ללא | `app/api/orders/route.js` |
| 6 | תזכורת איסוף | `pickupReminder` | Cron יומי, אירוע מחר | הלקוח | תזכורת איסוף - הזמנה #N - <שם הגמח> | `pickup_reminder_enabled` | ללא | `app/api/cron/daily/route.js` |
| 7 | תזכורת החזרה באיחור | `lateReturnReminder` | Cron יומי (פעם אחת להזמנה) | הלקוח | תזכורת החזרה - הזמנה #N | `late_return_email_enabled` | ללא | `app/api/cron/daily/route.js` |
| 8 | הודעה המונית לפי תאריך אירוע | `bulkEventDate` | `/admin/bulk-email` | לקוחות עם אירוע בטווח | <נושא> [bulk-…] | `bulk_email_by_event_date` | ללא (כפתור "אישור קבלה") | `app/api/bulk-email/route.js` |
| 9 | אישור ביצוע זיכוי | `refundExecuted` | זיכוי סומן "בוצע" | הלקוח | אישור ביצוע זיכוי - מערכת הגמ"ח | - | ללא | `app/api/refunds/[id]/route.js` |
| 10 | דוח יומי למנהל | `dailyManagerReport` | Cron יומי | `daily_manager_report_email` / `main_email` | דוח יומי <תאריך עברי> - N הזמנות | `daily_manager_report_enabled` | ללא | `app/api/cron/daily/route.js` |
| 11 | ברקודים שהוקלדו ידנית | `manualBarcodesReport` | Cron יומי | כנ"ל | ברקודים ידניים <תאריך> - N | `manual_barcode_daily_report` | ללא | `app/api/cron/daily/route.js` |
| 12 | הודעה פנימית במייל | `internalMessageAlert` | הודעה במסך ההודעות | נמען / כל העובדים עם `receiveEmailAlerts` | כותרת ההודעה | `receiveEmailAlerts` בכרטיס עובד | ללא | `app/api/notifications/route.js` |
| 13 | נתוני משלוחים למשלוחן | `courierDeliveries` | "הדפסת משלוחים" ← מייל | `courier_email` | כותרת קבוצת המשלוח | `enable_deliveries` + `courier_email` | ללא | `app/api/deliveries/courier-email/route.js` |
| 14 | דיווח תקלה חדש | `errorReportNew` | דיווח תקלה | כל המתכנתים (roleId=2) | דיווח תקלה ממערכת הגמח - לטיפול AI | - | ללא | `app/api/error-report/route.js` |
| 15 | התבקש מענה אנושי | `errorReportHumanRequested` | דגל "מענה אנושי" | המתכנתים | <שם> מבקש/ת מענה אנושי - דיווח תקלה | - | ללא | `app/api/error-report/route.js` |
| 16 | סיכום שינויי קוד ממתינים | `agentDigest` | Cron פעמיים ביום (לא שבת/חג) | המתכנתים | N שינויים ממתינים לאישור מיזוג - מערכת הגמ"ח | `agent_digest_email_enabled` (גמח ראשי בלבד) | ללא | `lib/agentDigest.js` |

כל 16 המיילים נרשמים ב-`EmailLog` (מסך `app/management/email-logs`) - כולל דיווחי התקלה וההודעות
הפנימיות, שעד 2026-09-22 לא נרשמו בכלל.

## עיצוב ופריסה כללית (2026-09-22)

כל 16 המיילים נבנים על **פריסה אחת** (`renderEmail` ב-[lib/emailTemplates.js](lib/emailTemplates.js)): כותרת צבעונית עם בס"ד
ושם הגמ"ח ותגית סוג המייל, עיגול אייקון + כותרת ראשית + שורת פתיחה, תוכן בבלוקים, וכותפת עם כתובת/טלפון.
הצבע והאייקון נקבעים לפי סוג המייל, והתוכן בנוי מבלוקים משותפים (`kvCard` כרטיס שורות, `callout` תיבת הדגשה,
`dataTable`, `statTiles`, `codeBox`, `numberedList`, `button`). הכול ב-inline style וטבלאות (Gmail/Outlook), עם RTL על כל בלוק. **גופן: Tahoma** (עם Arial כגיבוי) בכל המייל, כולל הכותרות - נבחר 2026-09-22 מתוך 10 אפשרויות.

| מייל | צבע | אייקון | תוכן ייעודי |
|---|---|---|---|
| איפוס סיסמה (2) | אינדיגו | 🔑 | תיבת סיסמה גדולה, 3 שלבים, אזהרה "לא ביקשתם?" |
| מייל חופשי | בורדו | 📎 | טקסט חופשי (הקבצים מצורפים למייל) |
| כרטיס הזמנה/השכרה | בורדו | 📄 | כרטיס פרטים + הודעה שה-PDF מצורף |
| אישור יצירת הזמנה | בורדו | 🎉 | פרטי הזמנה, רשימת פריטים, סיכום תשלום (יתרה מודגשת), כתובת |
| תזכורת איסוף | כתום | ⏰ | תאריך האירוע בגדול, פרטי הזמנה |
| תזכורת איחור | אדום | ⚠️ | הודעת החזרה בתיבה אדומה |
| הודעה המונית | בורדו | 📣 | טקסט + כפתור "אישור קבלת ההודעה" |
| אישור זיכוי | ירוק | 💸 | הסכום בגדול, בנק/סניף |
| דוח יומי / ברקודים ידניים | טורקיז | 📊 / 🏷️ | אריחי מספרים + טבלת הזמנות/ברקודים |
| הודעה פנימית | סגול | 💬 | שולח ההודעה + גוף ההודעה |
| נתוני משלוחים | ירוק | 🚚 | טבלה לכל קבוצה (טלפונים LTR) |
| דיווח תקלה / מענה אנושי | כתום / אדום | 🐞 / 🙋 | פרטי מדווח, 5 פעולות אחרונות, תיאור |
| סיכום שינויי קוד | סגול | 🤖 | כרטיס לכל PR עם קישור |

**להוספת מייל חדש:** `renderGenericEmailHtml` (טקסט חופשי, עם `tone`/`icon`/`actionButton`) או פונקציית תבנית חדשה
שמרכיבה בלוקים ל-`renderEmail`. אין לכתוב HTML ידני באתר השליחה. `renderEmailGallery` מאחד את כל המיילים למייל אחד (לדוגמאות).

## יישור RTL (תיקון 2026-09-22)

הבעיה: Gmail/Outlook מסירים את תגיות `<html>`/`<body>` (ואת ה-`dir` שעליהן), וגוף ההודעות החופשיות
נכתב כטקסט רגיל - ולכן טקסט עברי הוצג מיושר לשמאל, וסימני פיסוק/מספרים "קפצו" (נקודה בסוף שורה
בצד הלא נכון וכד').

הפתרון, כולו ב-`lib/emailTemplates.js` ו-`lib/mailer.js` (חל אוטומטית על כל מייל):
- **HTML:** `dir="rtl"` + `direction:rtl;text-align:right;unicode-bidi:embed` **inline** על תיבת המייל ועל כל בלוק
  טקסט; `textToHtml` מרנדר כל שורה כבלוק RTL משלה (שורות ריקות = מרווח קבוע). טבלאות מקבלות `dir="rtl"`.
- **טקסט פשוט** (`body`, מה שמוצג בקליינטים בלי HTML): `rtlPlainText` עוטף כל שורה ב-RLE…PDF (U+202B/U+202C)
  כך שפיסוק, רווחים ומספרים נקבעים לפי כללי העברית. נעשה ב-`postToMailer`, לא נשמר כך ב-EmailLog.
- `rtlBody: false` ב-`sendSystemEmail` משאיר גוף בלי תווי כיוון - בשימוש רק ב"דיווח תקלה חדש", שגופו הטקסטואלי
  כולל בלוק `---AI_DATA_START---` (JSON) שסוכן AI קורא כמכונה.
- מיילים שהיו בנויים מ-HTML ידני (`cron/daily`, `bulk-email`, אישור יצירת הזמנה) עברו ל-`renderGenericEmailHtml`
  כדי לקבל את אותו טיפול. `renderGenericEmailHtml` תומך כעת גם ב-`footnote` ו-`actionButton`.
- **לא נגע:** דוח ה-PDF המלא של הזמנה/השכרה (`app/api/orders/[id]/email/route.js`, מסמך HTML→PDF נפרד שכבר `dir="rtl"`).
  רק הגוף המלווה במייל עבר לתבנית המשותפת.

## הודעת טקסט מיותרת / צרופה מיותרת (תיקון 2026-09-22)

מה נמצא: כל מייל בלי קובץ אמיתי נשלח עם **צרופה בדויה `הודעה.txt`** (תוכן: "נשלח ממערכת הגמ"ח" / "הודעה" /
"Error Report"), כי ה-Apps Script החי מפענח `fileContent` ללא בדיקה ונופל בלעדיו. בנוסף, אותה צרופה בדויה
הופיעה בגוף המייל כשורה **"קבצים מצורפים - הוראות הורדה: 1. הודעה.txt (מצורף למייל)"** - בגרסת הטקסט
(`sendSystemEmail`) ובטבלת ההוראות ב-HTML (מייל חופשי).

מה תוקן בקוד:
- **הוסרה לחלוטין** טבלת/שורת "קבצים מצורפים - הוראות הורדה" (HTML וטקסט) מכל המיילים, לבקשת הבעלים - היא מיותרת. הקבצים פשוט מצורפים למייל.
- הצרופה הבדויה נשלחת עכשיו עם הדגל `noAttachment: true` (`buildGasPayload`).
- `courier-email` הפסיק לצרף קובץ טקסט שהכפיל את הטבלה שכבר בגוף המייל.
- `stripManagementGreeting` מסיר שורה ראשונה "שלום להנהלת הגמ"ח" מכל `body` ומכל תבנית (`renderGenericEmailHtml`).
  **הערה:** המחרוזת הזו לא נמצאה בשום מקום בקוד המערכת, בסקריפט החי, או ב-`EmailLog` - ההגנה היא לפי התבנית.

### ✅ ה-Apps Script עודכן ופרוס (2026-09-22, באישור הבעלים)

הגרסה המתוקנת ([docs/gas-mailer-live.gs](docs/gas-mailer-live.gs) - העתק של הסקריפט החי + 6 שורות, תואם לאחור)
נדחפה ב-`clasp push` ופרוסה בגרסה חדשה **לשתי** הפריסות שבשימוש: `AKfycbyBDs…` (email_link_b, גרסה 6) ו-
`AKfycbw8CJ…` (email_link_a, גרסה 7); באותו יום נוספה תמיכה **בכמה צרופות** (`data.attachments`, גרסאות 8/9) - עד אז צורף רק הקובץ הראשון. ה-URL של ה-`/exec` לא השתנה. הדגל `noAttachment` מדלג על הצרופה;
בקשות בלי הדגל (מערכות אחרות שמשתמשות באותו סקריפט) - בדיוק כמו קודם. לחזרה אחורה: `clasp deploy -i <id>` עם
`--versionNumber 4`/`5` (הגרסאות הקודמות נשמרות ב-Apps Script).

## מסך בדיקת מיילים - `/admin/email-test`

מסך תחת "ניהול האתר" (הנהלה ראשית/מתכנת): מקלידים כתובת מייל אחת, ושולחים אליה מייל **לדוגמה** מכל אחד
מ-16 הסוגים בקטלוג - הכול, מסומנים בלבד, או כל סוג בנפרד. הנמען הוא תמיד הכתובת שהוקלדה, אף פעם לא לקוח/עובד
אמיתי. הנושא מסומן "[דוגמה]", והשליחות נרשמות ב-`EmailLog`.
- קוד: [app/admin/email-test/page.js](app/admin/email-test/page.js), [app/api/admin/email-test/route.js](app/api/admin/email-test/route.js) (שליחה אחת לבקשה), [lib/emailSamples.js](lib/emailSamples.js) (נתוני הדמה והטקסטים).
- הדוגמאות משתמשות באותן תבניות ובאותה שליחה כמו המיילים האמיתיים. **טקסט הגוף של כל דוגמה משוכפל** מאתר
  השליחה - שינוי ניסוח באתר שליחה מחייב לעדכן גם את `emailSamples.js`.
- דוגמאות "מייל חופשי" ו"כרטיס הזמנה" מצרפות **מסמך אמיתי** של ההזמנה האחרונה במערכת (PDF שמופק ב-Chromium כמו ב-`/api/pdf`; אם ההפקה נכשלת - PDF ריק). כרטיס ההזמנה נשלח בנתיב האמיתי (Apps Script הופך את ה-HTML ל-PDF).
- כפתור "שלח את כולם במייל אחד" (`id: 'ALL'`) שולח גלריה של כל 16 המיילים + שתי הצרופות בהודעה אחת (`buildSampleGallery`, ~64KB - מתחת לחיתוך של Gmail ב-102KB).

## עדכון הבנה: `htmlBody` נתמך

בעבר תועד כ"לא מאומת" אם הפעולה הרגילה של הסקריפט מכבדת `htmlBody`. נבדק מול הקוד החי: **כן** -
`if (data.htmlBody) mailOptions.htmlBody = data.htmlBody`. (`docs/gas-mail-drive.gs` הוא סקריפט אחר, מורחב עם דרייב,
שאינו פרוס - ר' CLAUDE.md, "Cloud backup to Drive".)

## פערים ידועים (לא טופלו)

- `ModernSendEmailModal` (`components/customers/modern/ModernSendEmailModal.js`) אינו מאפשר צירוף קובץ.
- תזכורת איסוף/דוחות ה-cron מתבססים על `EmailLog` לדה-דופליקציה ב-`lateReturnReminder` לפי **נושא מדויק** -
  שינוי הניסוח ב-`emailCatalog.js` יגרום לשליחה חוזרת חד-פעמית של תזכורות שכבר נשלחו.
- הודעות פנימיות במייל נשלחות כעת **בהמתנה** (במקביל) ולא "ירה ושכח" - שליחה לכל העובדים עשויה להאריך מעט את זמן התגובה של שליחת ההודעה.
