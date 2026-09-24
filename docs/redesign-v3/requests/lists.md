# בקשות — משפחת "רשימות" (orders / rentals / refunds)

## REQ-1 · app/v3/components.css · טבלה · קוסמטי
מה: גוון שורה לפי מצב (טיוטה/ציפוף/ממתין/לא-שולם בהזמנות; הושכר/הוחזר בהשכרות) + פס התחלה צבעוני.
איפה: app/orders/page.js (ROW_TONES), app/rentals/page.js (STATUS_TONES, SPACING_TONE) — כרגע inline style עם tokens.
איך לתקן (הצעה): `.v3-table tr[data-tone="draft|spacing|pending|unpaid|out|back"]` + `td:first-child { border-inline-start }`.
סטטוס: פתוח

## REQ-2 · app/v3/ui/Table.js · רכיב · בינוני
מה: `Table` לא תומך בלחיצה על שורה (`onRowClick`), ב-`rowStyle`/tone ובכותרת עם כמה כפתורי מיון. לכן העמודים משתמשים ב-`<table className="v3-table">` ישירות.
איך לתקן: props `onRowClick`, `rowProps(row)`, ו-`header` כ-node.
סטטוס: פתוח

## REQ-3 · components/ExportButtons.js · משותף (מחוץ לתחום) · בינוני
מה: כפתור הייצוא עדיין בסגנון ישן (`btn btn-secondary`) וחלון הייצוא/ה-PDF ישנים. משותף ל-orders/rentals/customers/board ועוד.
סטטוס: פתוח

## REQ-4 · app/components/RentedPastEventWidget.js · משותף · בינוני
מה: הווידג'ט בראש /rentals עדיין בסגנון ישן (נטען כמו שהוא).
סטטוס: פתוח

## REQ-5 · components/orders/OrderModelSelector.js · משותף עם orders/new ו-ModernItemsManager · בינוני
מה: בורר הדגם (dropdown בפורטל, z 999999) עדיין בסגנון ישן; מוצג בתוך חלונית v3. לא הומר כי משותף.
סטטוס: פתוח

## REQ-6 · app/v3/ui/Dialog.js · התנהגות · בינוני
מה: Dialog לוכד Esc בשלב capture עם stopPropagation — כשחלונית "סינון מתקדם" פתוחה ו-HebrewDateRangePicker (פורטל ישן) פתוח, Esc לא סוגר את הלוח (נסגר החלון התחתון).
איך לתקן: אפשרות `escapeClose={false}` או להתעלם כשהיעד מחוץ לחלונית.
סטטוס: פתוח

## REQ-7 · app/v3/ui/Icon.js · כינויים · קוסמטי
מה: הכינויים `next`→chevron-end ו-`back`→chevron-start הפוכים ל-RTL (chevron-start מצביע שמאלה = "הבא"). בעמודים נעשה שימוש ב-id ישיר: הקודם=chevron-end, הבא=chevron-start.
סטטוס: פתוח

## REQ-8 · app/v3/ui (חדש) · Tip על כפתור · קוסמטי
מה: `Tip content=...` דורס `onClick` של הילד. נדרש wrapper של כפתור-איקון עם Tip. מומש מקומית ב-components/lists/listKit.js (`IconAction`); כדאי להעביר לספרייה.
סטטוס: פתוח

## REQ-9 · app/v3/ui · useDialogs · בינוני
מה: `useListDialogs` (confirm/notify/prompt כ-Promise) ב-components/lists/listKit.js — נדרש גם בעמודים אחרים; כדאי להעביר ל-app/v3/ui.
סטטוס: פתוח
