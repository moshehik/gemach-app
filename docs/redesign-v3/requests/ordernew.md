# בקשות — משפחת ordernew (הזמנה חדשה)

## REQ-1 · רכיבים משותפים בעיצוב ישן בתוך עמוד v3 · חומרה בינוני
`components/CustomerSelector.js`, `components/orders/OrderModelSelector.js`, `components/HebrewDatePicker.js`, `components/HebrewDateRangePicker.js`, `components/orders/ItemCapacityModal.js`, `components/CapacitySearchModal.js` משמשים גם עמודים אחרים (orders-list, rentals, order card, alterations, deliveries...) ולכן לא שונו. בעמוד ההזמנה החדשה הם מרונדרים בעיצוב הישן בתוך מעטפת v3. נדרש: סוכן הבעלים של הרכיבים המשותפים (combobox / date-picker / חלוניות תפוסה) יבנה גרסת v3. כולל: `z-index` של `ItemCapacityModal` (1100) ו-`CapacitySearchModal` מול `--v3-z-scrim` (100).

## REQ-2 · מחלקת גוף שלב (fade-up) · חומרה קוסמטי
העמוד משתמש ב-inline `animation: v3-rowin var(--v3-dur-med) var(--v3-ease) both` על `<section key={step}>`. מבוקש `.v3-step-body` ב-components.css (כולל `prefers-reduced-motion`), וגם מחלקת רוחב עמודה צרה (`.v3-narrow`) במקום `maxWidth: var(--v3-dlg-w)` inline.

## REQ-3 · פוטר ניווט דביק גם בדסקטופ · חומרה קוסמטי
`.v3-stepnav` דביק רק ב-≤640px. בעמוד עובד inline (`position: sticky; bottom: 0`). מבוקש וריאנט `.v3-stepnav--fixed` בקיט.

## REQ-4 · `Stepper`: הסתרת שורת הערך ופס מקטעים במובייל · חומרה קוסמטי
לפי STEPPER-PATTERNS §2.6 (צמתים 34px, שורת ערך מוסתרת מחוץ לצומת הנוכחי). לוודא שה-CSS של `.v3-timeline` מכסה זאת; בעמוד עצמו אין קוד מובייל נפרד.

## REQ-5 · `Banner.text` כצומת · חומרה קוסמטי
העמוד מעביר קישור (`<a>`) בתוך `text` של `Banner`. לוודא שהקיט מאשר צומת (כרגע פועל).

## REQ-6 · אריחי בחירת מידה עם מצב "אזל" · חומרה קוסמטי
משתמשים ב-`.v3-option[disabled]`; מבוקש עיצוב מפורש (קו חוצה / עמעום) ב-CSS לאופציה מושבתת.
