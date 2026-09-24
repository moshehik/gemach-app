# אינדקס חוזים — חלק C (עובדים · קיוסק · הדפסות · כניסה · מעטפת)

| חוזה | קובץ מקור | סוג | הערות מפתח |
|---|---|---|---|
| [employees-list.md](employees-list.md) | `app/employees/page.js` | עמוד (2 טאבים) | הנהלה/מתכנת בלבד; מיון צד-לקוח; הדפסת נוכחות ב-`#print-area`; חיפוש AI + סטטיסטיקה |
| [employees-detail.md](employees-detail.md) | `app/employees/[id]/page.js` (גם `/employees/new`) | עמוד (3 טאבים) | PUT שולח `employee` שלם; 3 זרימות סיסמה; עריכת משמרות; `data-agy-id` |
| [employees-report.md](employees-report.md) | `app/employees/report/page.js` | עמוד + הדפסה + Excel | אין פריט sidebar; שמות עמודות xlsx = חוזה נתונים |
| [customer-interface.md](customer-interface.md) | `app/customer-interface/page.js` + `kiosk.css` + `KIOSK.md` | עמוד ציבורי | שכבת נעילה בדפדפן, לוח עברי, AI, רישום עצמי, הדפסת popup |
| [print-order.md](print-order.md) | `app/print/order/page.js` | משטח הדפסה | `data-print-ready` ל-Puppeteer; batch; PII ב-`formatPaymentNotes` |
| [print-alterations.md](print-alterations.md) | `app/print/alterations/page.js` | משטח הדפסה | 5 סוגי דוחות; `downloadPdf`; `orderIds` גובר על תאריכים |
| [print-delivery-bag.md](print-delivery-bag.md) | `app/print/delivery-bag/page.js` | משטח הדפסה (A4 לרוחב) | עמוד לכל משלוח הלוך |
| [print-delivery-courier.md](print-delivery-courier.md) | `app/print/delivery-courier/page.js` | משטח הדפסה | קיבוץ ב-`lib/deliveryCourier.js` (משותף למייל) |
| [login-screen.md](login-screen.md) | `app/components/LoginScreen.js` | מסך + חלונית | PIN במחשב מהימן; אוטופיל; איפוס חוסם |
| [shell.md](shell.md) | `app/layout.js`, `AppShell.js`, `navConfig.js`, `TopbarSearch.js`, `UserMenu.js`, `NotificationBell.js`, `ThemeToggle.js`, `PageGate.js` (+נלווים) | מעטפת | מפת ניווט מלאה, נוסחאות gate, מובייל, prefetch, אחסון |

## ממצאים רוחביים (לבעלי הסגנון ולסוקרים)
1. **פערי חוזה שדורשים החלטת משתמש (QUESTIONS):** (א) R21 "הודעות למטה-שמאל" מול toast-stack הקיים מרכז-עליון ב-`PopupProvider` (משפיע על כל `alert()` באתר); (ב) הקיוסק מוגדר בערכת "אטלייה חמה" עצמאית (`ka-*`) — האם להעבירו ל-tokens או להשאיר זהות נפרדת; (ג) חלונית כניסה = "הזנת מידע" ⇒ בהיר בלבד (R19).
2. **מסכי הדפסה** (`print/*`, וגם פלט ההדפסה של `/employees`, `/employees/report`, popup הקיוסק) אינם חלק ממערכת ה-tokens: צבעים קשיחים, פונטי David/Frank Ruhl (Google Fonts), `@media print` מקומי. לא להמיר ל-`v3-*` (R17/print-surfaces). חובה: `data-print-ready` + `data-agy-id` ב-`print/order` וב-`print/alterations` (Puppeteer `/api/pdf`).
3. **קוד מקביל שחייב להישאר מסונכרן:** `app/api/orders/[id]/email/route.js` (HTML שקול ל-`print/order`), `app/api/deliveries/courier-email/route.js` (מקבץ כמו `print/delivery-courier`), `lib/prefetchRoutes.js` (מפתחות מטמון = סדר params בעמודים).
4. **חריגות התנהגות קיימות שאין "לתקן" בשקט (R8):** `/employees` `loading` נשאר true בכשל; `[id]` PUT מציג "נשמר" בלי בדיקת `res.ok`; `print/alterations` `dateMode=today` ב-UTC; sidebar `isActive` לא מתאים ל-`#hash`; `.search-box` מוסתר ב-≤640px (אין חיפוש/החזרה בברקוד במובייל); בורר שנה קשיח 2024-2027 בכרטיס עובד.
5. **רכיבים שנגעו בחוזים אבל דורשים חוזה נפרד** (חלוניות, שלב 5): `ErrorReportButton` (1286 שורות), `StatisticsModal`, `ExportButtons`, `SendEmailModal`, `EmployeePermissionsPanel`, `ModernEmployeeHistoryTab`, `HebrewDatePicker`, `PopupProvider` (confirm/prompt/auth/three-way), `OverdueOrdersModal`, `AIFloatingWidget`, `PrintWizardModal`.
6. **חוזי מפתחות אחסון:** ראו `shell.md §12` (רשימה מלאה של localStorage/sessionStorage/cookies/events).
