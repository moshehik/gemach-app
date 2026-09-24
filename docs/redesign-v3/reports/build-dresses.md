# דוח בנייה - משפחת dresses (ענף redesign/site-v3-pages-dresses)

## קבצים שנבנו מחדש (שכבת תצוגה בלבד, R8)
- app/dashboard/page.js, DashboardCharts.js, DashboardChartsImpl.js (+ dashboard-v3.css מקומי)
- app/dashboard/dresses/page.js (קטלוג), [id]/page.js (כרטיס/אשף), [id]/print/page.js (הדפסה)
- app/dashboard/pricelist/page.js
- components/dresses/modern/*: Card, DetailsTab, ItemsTab, ItemModal, RentalsTab, InfoTab, Modals, NewDressWizard
- חדשים בתחום: components/dresses/useDressDialogs.js (confirm/notice מבוססי-הבטחה על v3 Dialog), components/dresses/dresses-v3.css
- לא נגעתי: LogoSettings.js, app/api, lib, prisma, app/v3.

## רשימת חוזה (contracts/dashboard*.md)
- דשבורד: אותן 6 שאילתות Prisma, אותו גארד, חישובי מגמה, 4 KPI + 4 גרפים, `dynamic ssr:false` + שלד; צבעי הגרפים הומרו ל-tokens. נשמר: KPI רביעי בלי toLocaleString, Tooltip `₪value`, Legend.
- קטלוג: אותו `buildDressesListParams`, `fetchSharedJson/readCache`, debounce, prefetch, סדר ה-effects, `isHeadManagement`, "החזר לפעילות" פתוח לכולם, היררכיה שחזר|החזר|מחק, `onError` של תמונה תלוי ב-nextSibling ו-dataset.fellBack (img ואחריו div), ids של השדות, `getLabel`, הגדרות useModelNames/hide_dress_images.
- כרטיס דגם: כל ה-state/handlers/fetch ללא שינוי; מחרוזות `שגיאה`/`בוטל` שהקוד מתאים נשארו; 4 טאבים תמיד mounted (`hidden` במקום `tab-panel`); ACTIVITY_TOGGLE_FIELDS ו-MODEL_FIELDS כמו שהיו; premium-checkbox ללא gating (כפי בעץ).
- מחירון: startDate/endDate נשארים בגוף השמירה בלי שדות.
- הדפסה: נשארה ניטרלית (inline, בלי V3Page ובלי משתני theme), `button.no-print` נשמר בשביל ה-`:has`, `window.print` אוטומטי 500ms.

## שכתובי מלל בולטים (ישן ← חדש)
מאגר שמלות - קטלוג ראשי ← קטלוג הדגמים · סינון מתקדם ← סינון מפורט · כרטיס שמלה ← לכרטיס · אזור ניהול - סיכומים ופילוחים ← סיכום כספי וניתוח נתונים · הדפסת כרטיס שמלה ← הדפסת כרטיס · שמור שינויים ← שמירה · פריטים ומלאי ← מלאי · מידע ← יומן · ניהול מחירון ← מחירון · הוסף פריט ← פריט חדש · צור דגם ← יצירת הדגם.

## חלוניות ואזהרות
- כל `customConfirm` / `customPrompt` / `alert` ב-scope הוחלפו ב-`Dialog` (אישור: בהיר/כהה; עם קלט: form בהיר) עם אותו `await`. `customAuthPrompt` במחירון (נעילת מחיקה) לא הוחלף - מחוץ לרשימה.
- Notifications: `v3NoticeSaved` ביציאה משמורה (#9) וביצירת דגם (#10, +חלונית לפריטים שנכשלו); מחירון - הצלחה משנית ללא פעמון.

## סטיות / ספקות
- הודעות `alert` של הצלחה (שחזור/החזרה לפעילות בקטלוג, פעולות בטאב פריטים ובמחירון) הפכו ל-`v3Toast` ולא חוסמות; שגיאות בקטלוג/כרטיס נשארו חלונית חוסמת. עד חיבור ה-Provider (REQ-1) הטוסטים לא נראים.
- הטבלה בטאב הפריטים נשארה טבלה (עריכה בשורה, מעבר מיקום, קרטון ב-blur) ולא כרטיסים מתקפלים.
- כותרת הדגם: פרטי "קוד · קטגוריה · פריטים" הועברו לשורת טקסט; לא נעשה כרטיס-רייל "עגלת שינויים" (דורש מצב חדש).
- `Field required` מוסיף אטריביוט required בלי form - ללא השפעה.
- HebrewDatePicker (משותף) לא שונה; התווית שלו קבוצה ללא id.
- לא נבדק בדפדפן (ללא סשן מחובר); eslint: 0 שגיאות, 4 אזהרות img קיימות.

## בקשות פתוחות
requests/dresses.md, dresses-items.md, dresses-wizard.md.
