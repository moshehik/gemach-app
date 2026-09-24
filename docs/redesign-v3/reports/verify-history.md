# verify-history — אימות התאמה: פיד ההיסטוריה v3

ענף: `origin/redesign/site-v3-pages-history` (3a12043) מול `origin/main`. קבצים: `components/HistoryViewer.js`, `app/v3/history/{adapter,HistoryFeed,index}.js` (+ history.css, ולידציה של תלויות UI-kit). ביקורת קריאה בלבד; לא הורצו שרת/דפדפן.

## פסק דין: ❌ פערים חוסמים (3 חוסמים בליבת המתאם, כולם "שינוי אמיתי שלא מוצג")

הפרוטוקול/התאימות לאחור (exports, קריאות `/api/audit`, אפס כתיבות) **תקינים**. הבעיות הן בשכבת ה-replay/ההסתרה של `adapter.js` שמסתירה או משחיתה נתונים אמיתיים. התיקונים קטנים (ר' להלן).

---

## 1. תאימות לאחור (grep על `origin/main`)

| צרכן | מה מייבא | סטטוס |
|---|---|---|
| `app/admin/data-history/page.js:2` | default `HistoryViewer`, בלי props (`data-element-name` בלבד, מתעלם בשני הצדדים) | ✅ מסלול "קריאה יחידה" זהה, `showEntity`+`canShowAll` מופעלים (מצב גלובלי) |
| `components/customers/modern/ModernCustomerHistoryTab.js:5` | `ACTION_TRANSLATIONS` | ✅ |
| `components/dresses/modern/ModernDressInfoTab.js:5` | `ACTION_TRANSLATIONS` | ✅ |
| `components/employees/ModernEmployeeHistoryTab.js:5` | `ACTION_TRANSLATIONS` | ✅ |
| `components/modern/ChangesChips.js:5` | `FIELD_TRANSLATIONS` | ✅ |
| `components/orders/RentalReturnModal.js:11` | שניהם | ✅ |
| `components/orders/modern/ModernInfoTab.js:6` | `ACTION_TRANSLATIONS` | ✅ |
| `components/orders/modern/ModernItemsManager.js:8` | שניהם | ✅ |

- הטבלאות: `diff` בין שורות 3-150 (ישן) ל-8-155 (חדש) = **זהות תו-בתו** (`TABLES_IDENTICAL`).
- `export default function HistoryViewer({entityType, entityId})` נשמר; props חדשים כולם אופציונליים. אף קורא ב-main לא מעביר `entityType`/`entityId` ל-default export כיום (רק data-history גלובלי) — מסלולי Order/DressModel המאוחדים **לא נבדקים בשום מסך קיים** עד שיחוברו.
- הצרכנים של הטבלאות מייבאים כעת גם (טרנזיטיבית) `@/app/v3/ui/components` + `HistoryFeed` + 3 קבצי CSS גלובליים. נבדק: `tokens.css` תחת `[data-v3]`/`[data-v3-mode]`, `components.css` בעיקר `.v3-*`; החריגים: `:root{--v3-dir}` (icons.css) ו-`body:has(.v3-scrim.is-on) .v3-toast` — לא משפיעים על המסכים הישנים. **הערה:** כל מסך שייבא רק את המילונים גורר עכשיו את כל ה-bundle של הפיד; מומלץ להוציא את המילונים לקובץ נפרד (`historyTranslations.js`) ולהשאיר re-export מ-HistoryViewer.
- קומפילציה: `@babel/parser` על 4 הקבצים = OK. `Banner kind=alert|info`, `Btn variant=quiet`, `IconBtn label`, `Card icon/title/tip/actions`, `Field as=select` — כולם קיימים ב-UI-kit.

## 2. קריאות רשת (`/api/audit` וחדשות)

ישן: קריאה אחת `GET /api/audit?entityType&entityId&action&startDate&endDate&search` (סדר הפרמטרים הזה, ללא limit/page → default 100).
חדש, מסלול "כל השאר" (ובכלל זה data-history): `buildQuery()` — **אותו סדר פרמטרים בדיוק**, בלי `page` בקריאה ראשונה ⇒ זהה לישן ✅.

נוספו (כולן `GET`, ללא `method`/`body` בשום מקום בקבצי הענף; `git grep` על `method:|PUT|POST` = 0 בקוד):

| קריאה | מתי | הערה |
|---|---|---|
| `/api/audit?...&page=N` | "טעינת עוד" (מצב קריאה יחידה בלבד) | `page`/`limit` קיימים בשרת ב-main; דה-דופליקציה לפי id |
| `/api/orders/{id}` | `entityType==='Order'` ואין prop `order` | GET קריאה בלבד (נקרא route.js עד סופו; אין כתיבה) |
| `/api/audit?entityType=Order&entityId={orderId\|id}&limit=500[&filters]` | מסלול Order מאוחד | השרת כבר ממפה uuid/orderId |
| `/api/audit?entityType={OrderItem\|Payment\|PaymentObligation\|Refund}&entityIds=..&limit=500` | כנ"ל | `entityIds` נתמך בשרת ב-main; ה-GET של ההזמנה מחזיר גם פריטים/תשלומים/זיכויים **מחוקים** (אומת בקוד ה-route) ⇒ אין שורות "יתומות" |
| `/api/dresses/{id}?includeDeleted=true` + `/api/audit?entityType=DressModel...&limit=100` + `DressItem&entityIds&limit=200` | `entityType==='DressModel'` | כמו `ModernDressInfoTab` |

- `git diff --name-status` על `app/api`, `app/lib`, `prisma` = ריק: **שום שינוי שרת, שום כתיבת AuditLog** (ר' `AuditLog` ב-`grep`: אפס `auditLog.create|update`). ✅
- הפרמטרי filter (`action/startDate/endDate/search`) נוספים בסוף לכל 5 הקריאות המאוחדות (`withExtra`) — התנהגות סינון עקבית.
- **הערות:** (א) במסלול המאוחד `total = merged.length` ואין "טעינת עוד": עבור הזמנה עם >500 שורות לישות (או >200 ל-DressItem) ההיסטוריה נחתכת **בשקט** בלי אינדיקציה. (ב) תלות `order` (זהות אובייקט) במערך ה-effect: אם המסך המארח מעביר אובייקט חדש בכל רינדור — ייטענו 5 קריאות בכל רינדור. יש להעביר `useMemo`/state יציב. (ג) `loadMore` אינו מבטל כשמסננים משתנים בזמן הטעינה (append של דף ישן) — קוסמטי.

## 3. State / effects / מטפלים

| ישן | חדש |
|---|---|
| `logs, loading, error, isExpanded, filterAction/StartDate/EndDate/Search, searchInput` | + `rows,total,ctx,unified,loadedOnce,forbidden,page,loadingMore`; `searchInput` הוסר (החיפוש עבר לשדה client-side בפיד) |
| effect deps `[entityType, entityId, filterAction, filterStartDate, filterEndDate, filterSearch]` | אותו + `order` (ר' הערה ב') ; נוסף `cancelled` ✅ |
| `resetFilters` מאפס 5 | מאפס 4 ✅ |
| `handleSubmit` חיפוש שרת (form) | הוחלף: חיפוש client על השורות הטעונות (כולל `raw` changesJson) + כפתור "חיפוש בכל ההיסטוריה" **רק** כש-`hasMore` ו-`q`. במסלול המאוחד אין חיפוש שרת בכלל (`hasMore=false`) — הנתונים הטעונים מכוסים ע"י חיפוש client, אך רק עד 500 השורות. ⚠️ שינוי התנהגות מתועד |
| 403 מ-API (Employee) | הישן: הודעת שגיאה כללית; חדש: באנר הרשאה ✅ (שיפור) |

- מזהי `data-agy-id`: `history_viewer_container`, `_action_filter_select`, `_start_date_input`, `_end_date_input`, `_clear_filters_btn` — כולם נשמרו ✅. שדה הפעולה בפילטר: אותם 4 ערכי option.

## 4. סקריפט אימות ה-adapter (node, נתונים מבוססי schema + `app/lib/prisma.js`)

בניתי שורות AuditLog ריאליסטיות לפי מבני `changesJson` שהתוסף כותב: `CREATE` = `result` מלא (snapshot), `UPDATE` = `args.data` בלי "לפני" (`values`), `auditAs` = `{field:{from,to}}`, `DELETE` = `{deleted:true}`. ב-`prisma.js` (שורות 112-130) רק `create/update/delete` נרשמים; `updateMany`/`upsert`/`createMany` **אינם** עוברים בתוסף (ההערה בשורה 64 מאשרת זאת). הרצה: `node t1.mjs`, `node t2.mjs` (ב-scratchpad).

### 4.1 מה נחתך/מוסתר בדיוק (רשימה מלאה)

1. **UPDATE שכל שדותיו "חבויים" או זהים למצב ידוע** → הרשומה כולה נזרקת (`toFeedEntry → null`). המסך הישן הציג "לא בוצעו שינויים מהותיים". רק במסך הגלובלי (`canShowAll`) אפשר להציג עם מתג; בפיד של הזמנה/דגם/לקוח/עובד **אין מתג ואין `raw`** ⇒ אי אפשר לשחזר.
2. **שדות `hidden` (כל UPDATE, גם כשיש לצדם שדות גלויים):** `hokDetails, deletedAt, dressItemId, dressModelId, barcodePrefix, cartStatus, cartStatusDate, productId, orderItemId, executedBy, paymentId, sendMode, driveLinks, emailSuffix, imageUrl, thumbnailUrl, themeColor, profileImage, hebrewDate, hourlyWageSnapshot, travelExpensesSnapshot, employeeId, pageUrl, employeeName, timestamp, id, legacyId, customerId, createdAt, updatedAt`.
   מתוכם **תורגמו והוצגו במסך הישן** (`FIELD_TRANSLATIONS`): `emailSuffix, barcodePrefix, imageUrl, productId, pageUrl, employeeName, timestamp, id, customerId, dressModelId, dressItemId, employeeId, deletedAt, createdAt, updatedAt, hebrewDate, hourlyWageSnapshot, travelExpensesSnapshot`.
3. **Replay:** שדה ב-`values`/`snapshot` ש-`to` שלו שווה (`String()`) ל"מצב האחרון הידוע" של אותה ישות נזרק — בכל action, לא רק UPDATE (ר' חוסם B2).
4. CREATE snapshot: שדות עם `false`/`0`/ריק לא מוצגים (הישן הציג `false`/`0`).
5. השוואת `String(from)===String(to)`: אובייקטים ומערכי אובייקטים ("[object Object]") נחשבים זהים ונזרקים (גם בישן, ל-from/to; אך בחדש גם ב-replay).
6. קיפול ילדי `CANCEL_ORDER` (סעיף 4.5).
7. שורה שאינה JSON: מוצגת בלי הטקסט הגולמי (הישן הציג אותו ב-monospace); הגולמי נגיש רק ב-`canShowAll+showNoise`.
8. שניות נחתכו מהשעה (הישן HH:MM:SS, החדש HH:MM).

### 4.2 חוסמים (כל אחד שוחזר בסקריפט)

**B1 — שינוי אמיתי בשדה "חבוי" נעלם לגמרי (S5).** שבע רשומות UPDATE — `DressModel.barcodePrefix`, `DressModel.imageUrl+thumbnailUrl`, `OrderItem.dressItemId` (גם כ-`{from,to}`), `Order.hokDetails`, `Employee.themeColor`, `Customer.emailSuffix` — הניבו **0 רשומות מתוך 7**. החלפת פריט-מלאי בהזמנה (dressItemId), שינוי קידומת ברקוד של דגם ופרטי הוראת קבע נמחקים מההיסטוריה. הישן הציג את כולם.
תיקון: שדה `hidden` יוצג בפירוט כשהוא היחיד/כשיש שינוי אמיתי (`from!=to` או `hasFrom=false`) — להשאיר `hidden` רק ל-`id/createdAt/updatedAt/legacyId/employeeName/timestamp` ו-`themeColor/profileImage`; לפחות: אם `visible.length===0` אבל יש `hidden` עם שינוי אמיתי, להציג שורה עם התוויות (לא לזרוק). וכן להעביר `canShowAll`/מתג "הצג הכל + גולמי" גם לפיד הישות (לפחות `raw` להנהלה).

**B2 — replay מוחק נתונים של פעולות חוזרות בעלות אותם ערכים (S4).** `EMAIL_SENT` שני לאותה הזמנה עם אותם `to/subject/body` (ואותם `files` — כל מערך אובייקטים שווה "[object Object]") → הרשומה מוצגת **בלי נמען/נושא/תוכן/קבצים** (`det: []`, `sub: ''`). `ADD_PAYMENT` שני על אותה הזמנה באותו סכום → "נרשם זיכוי ₪0" וללא סכום; מייל שלישי לנמען אחר מוצג כ"לפני a@b.c ← אחרי z@b.c" (מצב שאינו קיים). הסיבה: `replay` מחיל "שדה שווה למצב ⇒ לא שינוי" על כל action, אבל `EMAIL_SENT/ADD_PAYMENT/CANCEL_*/CONFIRM_RENTAL...` הם **אירועים** ולא עדכוני מצב.
תיקון: להחיל את ה-replay/סינון-שווה **רק** כש-`row.action==='UPDATE'` (מבנה `values`); לשורות action אחרות להעתיק את השדות כמו שהם ולא לעדכן `state` מהן (או לעדכן אך לא לסנן). בנוסף `String()` → השוואה עמוקה (`JSON.stringify`) לערכי אובייקט.

**B3 — "מצב ידוע" מיושן מסתיר שינוי אמיתי (S3).** ה-replay מתבסס על CREATE/UPDATE שנרשמו בלבד. כתיבה שלא נרשמה (`updateMany`, `upsert`, `createMany`, ייבוא Access, גיבוי/שחזור) משנה את ה-DB בלי לעדכן את `state`. סקריפט: CREATE branch=A → (updateMany: A→B, לא נרשם) → UPDATE `{branch:'A'}` (שינוי אמיתי B→A) ⇒ הרשומה **נזרקה** (1 מתוך 2). לעומת זאת, כשאין שום מצב ידוע (רשומה מיובאת ללא CREATE — S2) שדה A→B **כן** מוצג כ"נקבע: B" — כלומר ההסתרה מתרחשת רק כש-state מוטעה, אך זה בדיוק המקרה המסוכן ("A→B בעדכון אוטומטי בלי before"): אי אפשר להוכיח סטטית שלכל ישות ב-prod אין כתיבות לא-רשומות (ידוע ש-`app/api/orders/[id]` ו-Access import משתמשים ב-`updateMany`/`$executeRaw` בחלק מהזרימות).
תיקון (בטוח): לעולם לא להסתיר רשומה שלמה בגלל replay — במקום `continue` בשדה זהה, לשמור אותו כ"ללא שינוי" ולהציג במתג "הצג הכל". לפחות: להסתיר רק כש-`state` נבנה מ-**רשומה קודמת ברצף מלא** (אין פער `createdAt`/`updatedAt`) — לא ניתן לדעת, ולכן עדיף מתג.

### 4.3 ממצאים לא-חוסמים (נבדקו בסקריפט)

- **S1 (מחזור הזמנה):** UPDATE שולח snapshot מלא + שינוי `eventDate` → נשארת רק שורת "תאריך האירוע שונה 2.7←1.7" ✅; UPDATE זהה נזרק ✅ (רעש מתועד).
- **S7:** UPDATE עם `{notes:null, branch:''}` בלי state → מוצג "הערה —/סניף —" (הישן הסתיר ערכים ריקים). מוסיף רעש, לא מסתיר.
- **S7b:** ניקוי אחרי CREATE מוצג נכון "A ← —" ✅.
- **S8 (Payment/Obligation/Refund):** CREATE/UPDATE/`EXECUTE` מנוסחים נכון וסכומים נכונים. **באג ניסוח:** `UPDATE Refund {bankAccount}` מוצג כ"נוצר זיכוי ₪100" עם צ'יפ זיכוי −100 (ספירה כפולה של הסכום בסיכום חזותי). יש להגביל את ניסוח "נוצר" ל-`CREATE`.
- **S9:** action/ישות לא מוכרים נופלים ל-fallback (`x עודכן`, מפתח גולמי) ונרשמים ב-`missingLabels` ✅; `UPDATE {}` נזרק (מתועד).
- אין מילון חסר: כל 113 מפתחות `FIELD_TRANSLATIONS` וכל action ב-`ACTION_TRANSLATIONS` קיימים במילון החדש (`missing` ריק).
- **4.5 קיפול ביטול הזמנה:** `CANCEL_ORDER` של ילדים (פריט/חיוב) מקופל לאב אם `|Δt|≤5s` — **ללא בדיקת orderId**. במסך הגלובלי (שורות של הזמנות שונות) ילד של הזמנה Y בטווח 5 שניות מ-`CANCEL_ORDER` של הזמנה X ייבלע לתוך X. במסלול הזמנה מאוחד תקין. תיקון: לקפל רק כש-`changesJson.orderId`/פריט שייך לאותה הזמנה, ובגלובלי לא לקפל. בנוסף סכומי החיובים שבוטלו אובדים (נשארת רק ספירה).

### 4.4 אזורי זמן ישראל (`t2.mjs`, node 24; חזרה עם `TZ=` אחר לא משנה — נשען על `timeZone:'Asia/Jerusalem'`)

| UTC | dayKey | ts |
|---|---|---|
| 2026-06-10T20:59:59Z (קיץ, +3) | 06-10 | 23:59 |
| 2026-06-10T21:00:00Z | **06-11** | 00:00 |
| 2026-06-10T23:30Z | 06-11 | 02:30 |
| 2026-01-10T21:59:59Z (חורף, +2) | 01-10 | 23:59 |
| 2026-01-10T22:00Z | **01-11** | 00:00 |
| 2026-03-26T23:30Z (יום לפני מעבר לקיץ) | 03-27 | 01:30 |
| 2026-03-27T00:05Z (אחרי 02:00→03:00) | 03-27 | 03:05 |
| 2026-03-27T22:00Z | 03-28 | 01:00 |
| 2026-10-24T22:30Z / 23:30Z (סיום קיץ, שעת 01:30 כפולה) | 10-25 / 10-25 | 01:30 / 01:30 |
| 2026-10-25T22:00Z | 10-26 | 00:00 |

- קיבוץ יום ✅ (23:30 UTC בקיץ נופל ליום הבא בישראל; גבול חצות 21:00Z/22:00Z נכון). מיון: `rawTs` ISO מחרוזת יורד + שוויון לפי id יורד ✅ (`x2,x1`).
- השעה הכפולה בסיום DST: שתי רשומות מציגות `01:30` זהה, אך המיון לפי `rawTs` מדויק ✅ (קוסמטי).
- `00:xx` מוצג `00:05` ולא `24:05` (node 24/ICU). **לא נבדק בדפדפני יעד** (Chrome ישן הציג `24:xx` עם `hour12:false` בלוקאלים מסוימים) — מומלץ `hourCycle:'h23'` במקום `hour12:false`.
- `dayTitle` בונה `T12:00:00Z` ומעביר ל-`getHebrewDateString`/`getDay` (לוקאלי) — תקין בכל אזור UTC−11..+11; תאריך עברי לא מתחשב בשקיעה (כמו בישן).
- ערכי תאריך-בלבד (eventDate 00:00Z) מוצגים כיום הנכון (`1.7.2026`) בישראל ✅; ב-datetime בלי שעון ישראל בצד הישן הוצג לפי אזור הדפדפן — שינוי מכוון ותקין.

## 5. חוזה / שדות ופקדים

| פריט | קיים? | זהה? |
|---|---|---|
| כותרת "היסטוריית שינויים" + כיווץ/הרחבה (`isExpanded`) | HistoryViewer.js (Card actions, `IconBtn`) | ✅ (קליק על כל הכותרת → כפתור בלבד; `aria-expanded` נוסף) |
| מונה במצב מכווץ | Chip `total \|\| rows.length` | ⚠️ הישן `logs.length` |
| חיפוש (טקסט + "חפש") | שדה client בפיד (`HistoryFeed`) | ⚠️ שינוי התנהגות מתועד (סעיף 3); ההסבר "החיפוש בתוך הערך שהשתנה" נעלם — `hay` כולל `raw` אז ההתנהגות נשמרת בשורות הטעונות |
| פילטר פעולה / מתאריך / עד תאריך / נקה | HistoryViewer.js (`v3-hadv`) | ✅ אותם state ופרמטרים |
| הצגת עובד/"מערכת"/"עובד שנמחק" | adapter `who` | ✅ |
| תווית פעולה (`ACTION_TRANSLATIONS`) | `ACTIONS[].badge` (נוסח חדש) | ⚠️ נוסח שונה בפיד; המילון הישן נשאר לצרכנים אחרים |
| טעינה / שגיאה / ריק | Banner / `v3-hempty` | ✅ |
| raw JSON כשלא JSON | רק `canShowAll+showNoise` | ⚠️ (סעיף 4.1 #7) |

## 6. הרשאות והגדרות
`checkAuth('הנהלה ראשית')` לעובדים נשאר בשרת בלבד (לא שונה); 403 → באנר. סודות (`password/pinHash`) מוחלפים ב-`***` בשרת ומוצגים `••••`. אין `hasPermission`/`SystemSetting`/localStorage/`document.querySelector` בקבצי הענף ⇒ לא נשבר דבר.

## 7. RTL / עיצוב (הערות)
`dir="rtl"` על השורש; `<bdi>` לספרות/סכומים ✅; `style={{opacity}}` inline קטן; כל האיקונים דרך `<Icon>`; אין `alert()`.

## 8. מה לא נבדק סטטית (דורש דפדפן)
- רינדור בפועל, אנימציות, פילטר קטגוריות, ניווט מקלדת, מצב כהה.
- שמות אייקונים שבמילון (`cal,cart,bank,sig,undo…`) מול ה-sprite הקיים (ממופים דרך `ICON`/`ICON_ALIASES`; לא אומתו ויזואלית).
- נתוני prod אמיתיים: האם קיימות ישויות עם כתיבות לא-רשומות (B3) ואיזה אחוז משורות UPDATE מכילים אך ורק שדות חבויים (B1).
- 24:xx בדפדפנים ישנים; ביצועי 5 קריאות מקבילות ב-Neon קר.

## 9. סיכום תיקונים נדרשים (לפני מיזוג)
1. B1: לא לזרוק UPDATE כשיש שינוי אמיתי בשדה `hidden`; להנגיש מתג/`raw` גם בפיד הישות.
2. B2: replay+סינון-שווה רק ל-`action==='UPDATE'`; השוואה עמוקה לאובייקטים.
3. B3: לא להסתיר רשומות שלמות על סמך state — להציג במתג "שמירות ללא שינוי".
4. קיפול CANCEL_ORDER לפי orderId; ניסוח `Refund UPDATE`; `hourCycle:'h23'`; אינדיקציית חיתוך ב-500/200; לפצל את המילונים לקובץ נפרד.
