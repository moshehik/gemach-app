# דוח בנייה - משפחת "לקוחות"

ענף: `redesign/site-v3-pages-customers` (מתוך `redesign/site-v3-2026-09-24`).
היקף: `app/customers/page.js`, `app/customers/[id]/page.js` (כולל `/customers/new`), `components/customers/modern/**`.
קובץ חדש: `components/customers/modern/customerDialogs.js` (הוקים `useAlertDialog` / `useConfirmDialog` - חלוניות v3 במקום alert/customConfirm).

## רשימת חוזה - `customers-list.md`
- [x] state/effects/fetch: `GET /api/customers` (סדר הפרמטרים, `_t`, `cache:no-store`), prefetch עמוד+1 אחרי 1500ms, guard של `isAiModeActive`, `?search=` ב-mount - הקוד ללא שינוי.
- [x] `handleSort` (לא מאפס עמוד), `handleSearch`/`handleClearSearch`/`toggleAiInputMode`/`handleAiInputSubmit`/`handleAiPageChange`, `POST /api/ai/smart-search` - ללא שינוי.
- [x] שש עמודות בסדר המקורי, כל כותרת ממוינת דרך `getLabel`; עמודת "קוד לקוח" מציגה `legacyId` או "חדש"; מייל ריק = `-`.
- [x] כל השורה לחיצה (`onClick`), נוסף גם Enter במקלדת.
- [x] עימוד רק כש-`totalPages>1`; `#customers-page-num` (אותה ולידציה), כפתורי הקודם/הבא עם `disabled` זהה.
- [x] חיפוש מתקדם: שתי לשוניות, אותם 5 שדות עם אותם id, מעבר AI ("סיום" = "סגור והחל סינון"), "ניקוי הכול"; `.ai-feature-element` נשמר סביב המתג.
- [x] `ExportButtons` (אותם props כולל `id` ל"קוד לקוח" - אי-ההתאמה מול `legacyId` נשמרה בכוונה) ו-`StatisticsModal` - נשארו ללא שינוי.
- [x] `alert` (2 מקומות) הוחלפו בחלונית הודעה; אין שינוי בזרימה.

## רשימת חוזה - `customers-id.md`
- [x] `handleSave`: אותה ולידציה, אותו סדר, `true` בהצלחה / `undefined` בכשל (לשונית הפרטים תלויה בכך), אין `setCustomer(data)` אחרי PUT, גוף PUT כולל `orders`.
- [x] כל 5 הלשוניות נשארות mounted (רק `hidden` + `display:none` ללא פעילה); `ModernCustomerHistoryTab` ממשיך למשוך `/api/audit` ברקע.
- [x] `cancelSignal` / `attemptSave` / כפתור V בכותרת שומר וסוגר רק בהצלחה.
- [x] `datalist` + `autoComplete="new-password"` בעיר/רחוב נשמרו; `onBlur=handleEmailBlur`; "השלמה ל-@gmail.com" מכניס את אותו ערך.
- [x] `require_*`, `mandatory_field_groups`, `hide_marketing_consent_field` - אותם תנאים; כוכביות דינמיות ביצירה בלבד.
- [x] ביטול חסימה: אותו PATCH, נראה רק לפי `isHeadManagement`, אישור דרך חלונית v3 (אותה זרימת await).
- [x] שליחת מייל: `verifyPin` (ללא שינוי), אותו POST ל-`/api/send-email` (כל המפתחות, `username/password`), סגירה אוטומטית אחרי 2400ms, הגנת `!loading` על סגירה.
- [x] "חזור" = `router.back()`; "חזרה" ב-new = `router.back()`.
- [x] `renderCustomerNotes`: אותו regex בדיוק; הקישור `/orders/{id}` עם `title` נשמר.
- [x] לשונית תשלומים: אותם חישובי חוב/זכות/מאוזן; לשונית הזמנות: אותו מיון ואותם חישובים, הקישור עם `stopPropagation`.
- [x] localStorage `agy_history` (`addHistory`) - ללא שינוי.

## התראות (NOTIFICATIONS-DESIGN סעיף 4, שורה 7)
- יצירת לקוח: `enqueueNotice({kind:'success', ..., href:'/customers/{id}', persistToBell:true})` אחרי `POST` מוצלח, לפני `router.push`.
- עדכון: `enqueueNotice(...)` במקום `alert('הפרטים נשמרו בהצלחה!')`.
- שניהם בתוך try/catch. שגיאות ואימותים נשארו חלוניות.

## שכתובי מלל בולטים
- "ניהול לקוחות" -> "לקוחות"; "סה"כ רשומות: N" -> צ'יפ "N במערכת".
- "חיפוש לקוח (שם, טלפון, עיר)..." -> "שם, טלפון או עיר"; "חפש בחכמה" -> "חיפוש חכם".
- "לבטל את חסימת הלקוח מהזמנות חדשות?" -> "לבטל את החסימה?" + "הלקוח יוכל שוב לבצע הזמנות חדשות."
- "שמור פרטים" -> "שמירת הלקוח"; "שמור פרטי בנק" -> "שמירת פרטי בנק".
- הסברים ארוכים (2 אמצעי קשר, תעודת זהות "לעריכה/ביטול", כפתור V, יתרת חוב, החצים בטבלאות) עברו ל-`Tip`.
- לא שונה: מחרוזות שנשלחות/נבדקות בקוד (`דוא"ל` בהודעת שדות חסרים, `זיכוי` כ-paymentMethod, סטטוסים מ-`orderStatus`).

## סטיות מכוונות
1. **טבלת הרשימה**: נשארו 6 העמודות (כל הנתונים בהן, כולן ממוינות-שרת) ולכן אין מה להעביר לשורה מורחבת; נבנתה עם מחלקות `v3-table` ולא ברכיב `Table` כי הוא לא תומך בלחיצת שורה ומיון-שרת (REQ-C6).
2. **הזמנות בכרטיס לקוח**: כרטיסי `v3-item` (לחיצה = מעבר להזמנה; חץ = סכומים וסטטוס תשלום) במקום טבלה של 6 עמודות. אותם נתונים.
3. **תשלומים / זיכויים**: טבלת `Table` מינימלית (תאריך, סוג, סכום / תאריך, הזמנה, סכום, סטטוס); הזמנה מקושרת, אופן תשלום, הערות, סיבה - בשורה מורחבת.
4. **KPI בתשלומים**: אריחי `v3-status` בטור (נתון בשורה), במקום רשת KPI.
5. **מתגי הפעלה**: "מאשר/ת קבלת דיוורים" ו"חיפוש חכם לפי מה שמילאתי" הם `Switch` (input `role=switch`, אותם `id`) ולא checkbox רגיל.
6. **בורר יעד קבצים במייל**: `Seg` (כפתורי לחיצה) במקום רדיו; אותו state `sendMode`.
7. **מייל בזמן טעינה/שיתוף**: הודעות הצלחה/שגיאה כ-`Banner` בתוך חלונית הטופס.
8. הודעות חוסם (`alert`) הוחלפו בחלונית v3 מקומית ולא ב-`v3Toast`, כי ה-Provider עדיין לא מחובר (הודעת שגיאה שקטה לא מקובלת).

## בקשות פתוחות
ראו `docs/redesign-v3/requests/customers.md` (REQ-C1..C7). החשובה: REQ-C1 - בלי חיבור ה-`V3NotifyProvider` אין משוב על שמירה.

## ספקות
- כפתור "חזרה" משתמש באיקון `back` (chevron-start); המקור השתמש ב-`i-arrow-end`. לאמת כיווון ב-RTL בדפדפן.
- לא בוצעה בדיקה חזותית בדפדפן (אין התחברות/שרת בסביבת העבודה); בוצעו `eslint` על כל הקבצים (נקי). מומלץ לסקור RTL ב-`getBoundingClientRect`.
- `Tabs` של הקיט מציג את ה-badge של ספירת הזמנות רק ללשונית "הזמנות" (כמו המקור).
