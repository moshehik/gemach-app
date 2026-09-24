# בקשות — משפחת employees

## REQ-1 · app/v3/ui/Tabs.js · ספרייה · קוסמטי
מה: `Tabs` לא מאפשר להעביר תכונות לכל טאב (`data-agy-id`, `data-element-name`) — סוכן ה-AI והאוטומציה נשענים עליהן בכרטיס עובד.
איפה: `app/v3/ui/Tabs.js` (רכיב `Tabs`, מיפוי `items`). כרגע: `AgyTabs` מקומי ב-`app/employees/[id]/page.js`.
איך לתקן: תמיכה ב-`item.attrs` (spread על הכפתור). אחרי זה אפשר להחליף את `AgyTabs` ב-`Tabs`.
סטטוס: פתוח

## REQ-2 · חלונית קוד מנהל (`window.customAuthPrompt`) · חלוניות · בינוני
מה: `customAuthPrompt` (PopupProvider, בחירת מנהל + קוד) נקרא פעמיים ב-`employees/[id]` (איפוס סיסמה, קביעת סיסמה ידנית). נשאר כמו שהוא — הלוגיקה חיה ב-PopupProvider.
איפה: `app/components/PopupProvider.js` (`showAuthPrompt`).
איך לתקן: החלפה גלובלית בחלונית `Dialog variant="code"` — ללא שינוי בחתימה (`{pin, employeeId}` או null).
סטטוס: פתוח

## REQ-3 · רכיבים משותפים בסגנון ישן · עיצוב · בינוני
מה: נשארו בעיצוב הישן (מחוץ לתחום): `components/SendEmailModal`, `components/HebrewDatePicker` (בשורת הוספת משמרת; עטיפה ברוחב 250px קשיח), `app/components/permissions/EmployeePermissionsPanel`, `components/ExportButtons` (טאב נוכחות ב-/employees), `app/components/StatisticsModal`, `components/modern/ChangesChips` + `components/HistoryViewer` (`ACTION_TRANSLATIONS`) בטאב ההיסטוריה.
סטטוס: פתוח

## REQ-4 · app/v3/ui/Table.js · ספרייה · קוסמטי
מה: אין `onRowClick`, ואין מיון דו-מצבי (asc/desc בלבד) כמו בדפים אלה; הרכיב מחזיר מיון לשלושה מצבים. לכן טבלאות /employees נבנו עם מחלקות `v3-table` + כותרת ממויינת מקומית (`SortHead`).
איך לתקן: `onRowClick(row)` (עם `tabIndex=0` + Enter) ואפשרות `sortCycle="two"`.
סטטוס: פתוח

## REQ-5 · app/v3/components.css · CSS · קוסמטי
מה: (א) אין מחלקה לשורת טבלה מודגשת ("תשומת לב") — כרגע `style={{background:'var(--v3-charge-bg)'}}`. (ב) אין כללי `@media print` לרכיבי v3 — כל דף הדפסה נושא עקיפות מקומיות (`.v3-card`, `.v3-table th` ל-#fff).
סטטוס: פתוח

## REQ-6 · חיבור מנגנון ההתראות · תשתית · חוסם-להצגה
מה: הדפים קוראים ל-`v3Toast` / `v3NoticeSaved` / `enqueueNotice` במקום `alert()`. עד ש-`V3NotifyProvider` מחובר ב-`app/layout.js` (ו-PopupProvider כבר לא מנתב alert) — ההודעות נכנסות לתור ולא מוצגות. ל-`persistToBell` נדרש גם `reports/notify-api-patch.md`.
סטטוס: פתוח
