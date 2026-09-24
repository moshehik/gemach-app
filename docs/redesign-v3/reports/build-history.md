# build-history — פיד ההיסטוריה v3 (R23)

ענף: `redesign/site-v3-pages-history` (מבוסס על `redesign/site-v3-2026-09-24`).

## מה נבנה
| קובץ | תפקיד |
|---|---|
| `app/v3/history/adapter.js` | גרסת ייצור של השלד: מילון מלא (קטגוריות, ישויות, פעולות, ~170 שדות, enum), `parseChanges` (7 מבנים), `replay`, `toFeedEntry`, `buildFeed`, `searchHay`, טעינת הזמנה/דגם/איחוד שורות. קובץ טהור (בלי imports), רץ גם ב-node. |
| `app/v3/history/HistoryFeed.js` | קומפוננטת הפיד: קבוצות יום (כותרת עברית + לועזית), חיפוש חי עם הדגשה, סינון קטגוריות מרובה (פאנל listbox, מונים, pills, מקלדת, bottom-sheet במובייל), רשומה מקופלת = אייקון + משפט + צ'יפ סכום + חץ, פאנל מורחב (מבצע/ת, שעה, פרטים, לפני←אחרי, שורות פירוט), מתג "הצג הכול" למנהלים. |
| `app/v3/history/history.css` | 4 השלמות קטנות בלבד (`--v3-*` בלבד): איפוס פילטר, scrim/foot למובייל, מיקוד מקלדת, שורת פעולות. |
| `app/v3/history/index.js` | ייצוא מרוכז. |
| `components/HistoryViewer.js` | עטיפה חדשה סביב הפיד. `FIELD_TRANSLATIONS`/`ACTION_TRANSLATIONS` נשארו כ-export זהה (7 קבצים מייבאים אותם). props ישנים (`entityType`, `entityId`) עובדים כמו קודם; חדשים אופציונליים: `order`, `liveUndo`, `onUndo`, `embedded`. |
| `docs/redesign-v3/reports/history-adapter-selftest.mjs` | בדיקת עשן: `node docs/redesign-v3/reports/history-adapter-selftest.mjs` (מדפיס 7 רשומות מתוך 9 שורות, מאשר שרעש וילדי ביטול-הזמנה נדחו). |
| `docs/redesign-v3/requests/history.md` | בקשות לספריית ה-UI. |

## איך זה מתחבר (ללא שינוי בכתיבה או ב-API — R8)
- הקריאות: אותן קריאות `GET /api/audit` עם אותם פרמטרים (`entityType/entityId/action/startDate/endDate/search/page`). לא נגעתי ב-`app/api`, `lib`, `prisma`.
- **הזמנה** (`entityType=Order`): מתקבלות 5 קריאות מקבילות ל-`/api/audit` (Order, OrderItem, Payment, PaymentObligation, Refund) לפי המזהים מ-`GET /api/orders/[id]` הקיים (או מ-prop `order` אם המסך המארח כבר מחזיק אותו). איחוד לפי `id`. נפילה לקריאה אחת אם הזמנה לא נטענה.
- **דגם** (`DressModel`): DressModel + DressItem, כמו הטאב הקיים.
- **גלובלי** (בלי entityType): תג ישות בכל שורה, מתג "הצג הכול + גולמי", סינון פעולה/תאריכים מהשרת נשמר.
- שאר הישויות (לקוחה, עובד, ועוד): קריאה אחת, כמו קודם.
- **לגבי "כל מסך מקבל את הפיד":** הטאבים בכרטיסי הזמנה/לקוחה/דגם/עובד ורכיבי הפריט/החזרה הם קבצים של סוכנים אחרים ומשכפלים היום תצוגה משלהם; אני לא עורך אותם. כדי לקבל את הפיד הם צריכים להחליף את גוף הרינדור ב-`<HistoryViewer entityType entityId order={order} embedded />` (או ישירות `HistoryFeed rows={...}`). ה-`/admin/data-history` מקבל את הפיד מיד, ללא שינוי בעמוד.

## 17 סיכוני ההתאמה (HISTORY-DESIGN §6)
1. **רעש:** UPDATE שכל שדותיו זהים/מוסתרים נדחה; מתג "הצג גם שמירות ללא שינוי" (גלובלי/מנהלים) מציג אותם ואת ה-JSON הגולמי. ספירות משתנות בכוונה. **פתוח:** אישור בעלים.
2. **ללא from:** `replay` משלים "לפני" ממצב קודם שנטען; אחרת מוצג "נקבע: X" (ללא חץ). מדויק רק אם נטענו כל השורות (limit 500 לישות).
3. **הרשאות:** 403 מטופל בשקט בבאנר מידע (לא שגיאה); השרת ממשיך לאכוף; המתאם לא עוקף.
4. **זהות Order כפולה:** הקריאה נשארת `entityType=Order&entityId=<מספר>` שהשרת מאחד.
5. **חיפוש שרת מול לקוח:** חיפוש חי על מה שנטען (כולל `raw`), ובנוסף כפתור "חיפוש בכל ההיסטוריה" שמפעיל את `search=` בשרת כמו המסך הישן, ו"טעינת עוד" (`page=`) בקריאה יחידה.
6. **פעולות לא מוכרות:** נפילה לתווית גנרית + `missingLabels` (console.info בפיתוח). נוספו למילון: EXECUTE, AUTO_CREDIT_*, ALTERATION_DONE, UI_ERROR_ALERT.
7. **שעון:** יום ושעה ב-`Asia/Jerusalem` (`sv-SE`/`he-IL` עם timeZone); כותרת יום עברית מ-`lib/hebrewDate.js`. סדר באותה שנייה לפי id (לא דטרמיניסטי, מקובל).
8. **שם פריט:** `itemsById` נבנה מנתוני ההזמנה (`itemsIndexFromOrder`); פריט לא ידוע = "פריט".
9. **שם מבצע:** `null` = "מערכת", `employeeId` בלי שם = "עובד שנמחק"; לעולם לא UUID.
10. **סודות:** `fmt=secret` מציג `••••`; `redactSecrets` בשרת נשאר.
11. **גוף מייל:** מוצג רק בפאנל הפתוח; נשאר ב-`raw` לחיפוש (החלטה: לשמר התנהגות ישנה). **פתוח:** אישור בעלים אם להוציא מהחיפוש.
12. **ביטול הזמנה:** `CANCEL_ORDER` של Order מקבץ את ילדיו (OrderItem/חיוב באותן ±5 שניות) לרשומה אחת עם "פריטים שבוטלו". מומש (בשלד לא).
13. **legacy משמרות:** מבנה `legacy` בשלב `parseChanges`.
14. **exports:** `FIELD_TRANSLATIONS`/`ACTION_TRANSLATIONS` נשמרו במקומם — אין שבירת build לקבצים המייבאים.
15. **ביצועים:** 5 קריאות מקבילות + replay בלקוח, `useMemo`; ללא קריאות נוספות.
16. **`lib/offlineSync.js:200`:** לא נבדק; שורות בצורה לא מוכרת יורדות לכלל הגנרי (ללא קריסה — `parseChanges` מחזיר `unparsable`). **פתוח:** לבדוק צורת השורות.
17. **אין כתיבה:** אפס `auditLog.create`; רק קריאה ותצוגה.

## Redo / ביטול מיידי
`redo.eligible=false` תמיד, למעט כש-`ctx.liveUndo['Refund:<id>']` (prop `liveUndo`) עדיין בתוקף — אז מוצג "ביטול מיידי" והלחיצה קוראת ל-`onUndo(entry)` של המסך המארח. ב-HistoryViewer הישן לא היה שום ביטול/שחזור, לכן אין התנהגות קיימת שנפגעה.

## אימות
- `eslint` נקי על `components/HistoryViewer.js` ו-`app/v3/history`.
- `history-adapter-selftest.mjs` עובר (OK).
- רינדור SSR של `HistoryFeed` ב-node (בדיקה חד-פעמית, ללא שרת) — מבנה DOM תקין.
- **לא נבדק בדפדפן:** לענף אין שרת פיתוח (שרת יחיד, R4). ראו `requests/history.md` סעיף 6.

## פתוח
- אישור בעלים: הסתרת רעש (1), חיפוש בגוף מייל (11).
- החלפת רינדור הטאבים (הזמנה/לקוחה/דגם/עובד, חלונות פריט/החזרה) ל-HistoryViewer/HistoryFeed — אצל בעלי העמודים. טאב עובד דורש גם `/api/employees/[id]/history` (Employee+Shift): `HistoryFeed` מקבל את השורות כמו שהן, כולל מבנה legacy.
- `/refunds` (קריאת DEBT_* ללוגיקה) לא נגע.
- זיכוי `ctx.liveUndo`/`onUndo`: המסך המארח חייב לספק אותם (הכרטיס החדש).
- העברת מחלקות ה-CSS ל-components.css (requests סעיף 1-2).
