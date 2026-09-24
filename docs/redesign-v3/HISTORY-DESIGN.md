# HISTORY-DESIGN — התאמת פיד ההיסטוריה (R23)

> ניתוח של איך ההיסטוריה נכתבת ומוצגת היום + מפרט מתאם (adapter) לפיד החדש `hf-*` מסקיצה B.
> **עקרון:** אין שינוי בכתיבת AuditLog. התוסף ב-`app/lib/prisma.js` כותב הכול, ואין להוסיף כתיבות ידניות. כל ההתאמה בשכבת הקריאה/התצוגה.
> קוד השלד (לא מחובר): [`reports/history-adapter-skeleton.js`](reports/history-adapter-skeleton.js) — הוא המקור לטבלאות סעיף 4 (מועתקות לכאן אוטומטית). נבדק תחבירית ורץ על נתוני דוגמה.

---

## 1. איך רשומה נכתבת היום, ומה צורת הנתונים

### 1.1 המודל
`AuditLog` (`prisma/schema.prisma:58`): `id` (uuid), `legacyId?`, `entityType` (שם מודל), `entityId` (מחרוזת), `action`, `changesJson` (מחרוזת JSON), `createdAt`, `employeeId?` (**המבצע**, לא הישות; ללא relation), `updatedAt`. אינדקסים: `[entityType, entityId]`, `[employeeId]`. **אין** שדה לשם הישות, לתיאור, לסכום, ל-orderId או לקטגוריה — כל אלה חייבים להיגזר בקריאה.

### 1.2 נתיבי כתיבה
1. **התוסף האוטומטי** (`app/lib/prisma.js`, `$allOperations`): על `create` / `update` / `delete` של כל מודל **חוץ** מ-`AuditLog`, `PageVisitLog`, `Shift`, `BackupRun`. `action` = `CREATE|UPDATE|DELETE`, או שם מפורש כש-`auditAs(action, args, changes)` נקרא. `entityId = result.id || result.orderId`. נכתב באותה טרנזקציה (AsyncLocalStorage). `employeeId` מהעוגייה (`getActingEmployeeId`). `changes` ריק ב-`auditAs` = לא נכתבת שורה. **סודות עובד** (`password`, `pinHash`) מוחלפים ב-`***` בכתיבה וגם בקריאה (`redactSecrets` ב-`app/lib/auditLog.js`).
2. **כתיבות ידניות קיימות** (לא נוגעים; מתועדות כדי לדעת מה מגיע): `POST /api/orders` (שורות nested-create של `OrderItem` ו-`Payment`, צילום מלא), `PUT /api/orders/[id]` (`DEBT_APPROVED`), `DELETE /api/orders/[id]` (`CANCEL_ORDER` ל-Order+OrderItem+PaymentObligation ב-`createMany`), `debt-approval`, `cancel-changes`, `orders/[id]/email` + `send-email` (`EMAIL_SENT`), `refunds/[id]` (`EXECUTE`, `ADD_PAYMENT`, `REMOVE_PAYMENT`), `rentals/confirm` (`CONFIRM_RENTAL`, `CANCEL_SCAN`), `returns/scan` (`CANCEL_RETURN`), `alterations/mark-done` (`ALTERATION_DONE`), משמרות (`Shift` CREATE/UPDATE/DELETE), `lib/offlineSync.js`.
3. `auditAs` בקריאות: `CANCEL_ITEM/RESTORE_ITEM`, `CANCEL_OBLIGATION/RESTORE_OBLIGATION`, `CANCEL_PAYMENT/RESTORE_PAYMENT` (`cancelActionFor`), `CANCEL_ORDER`, `AUTO_CREDIT_REFUND_CREATED/UPDATED/CLEARED` (`lib/creditRefundSync.js`), `UPDATE` ללקוח (עם from/to).
4. שורות מיובאות/ישנות (`legacyId`) — צורות לא מובטחות.

### 1.3 שבעת המבנים של `changesJson`
| מבנה | דוגמה | מי כותב | בעיה לפיד |
|---|---|---|---|
| **diff** | `{"phone1":{"from":"050","to":"052"}}` | `auditAs`+changes, לקוח, `Shift` UPDATE, `CANCEL_ORDER` | הטוב ביותר |
| **values** | `{"eventDate":"…","isDelivery":true,"branch":"…"}` | UPDATE אוטומטי = `args.data` (למשל `tx.order.update` ב-`PUT /api/orders/[id]`) | **אין "לפני"**, ואין סינון: ה-PUT שולח כמעט כל שדה בכל שמירה — רעש. נדרש replay (§3.2) |
| **snapshot** | כל עמודות השורה | CREATE אוטומטי + nested-create | מלא בברירות-מחדל (`isDeleted:false`…); מקור מצב ראשוני ל-replay |
| **deleted** | `{"deleted":true}` | DELETE אוטומטי | אין תוכן |
| **legacy** | `{"from":{…},"to":{…}}` | משמרות ישנות | קיים נרמול ב-`ModernEmployeeHistoryTab.normalizeChangesForDisplay` |
| **note/extras** | `{isDeleted:{…}, orderId, note, description}` | ביטולים ידניים | `note` חופשי בעברית; `orderId` בתוך ה-JSON |
| **email** | `{subject,to,cc?,body?,type,sendMode,files:[{fileName,sizeBytes,dest}],driveLinks}` | מייל | `files` מערך אובייקטים |

### 1.4 זהות ישות — מלכודות
- `Order`: שורות אוטומטיות תחת **uuid**; ידניות (`DEBT_APPROVED`, `CANCEL_ORDER`, `EMAIL_SENT`, `CANCEL_CHANGES`) תחת **מספר הזמנה**. `GET /api/audit?entityType=Order&entityId=<מספר>` כבר מאחד את שניהם.
- `OrderItem`/`Payment`/`PaymentObligation`/`Refund`: תחת ה-uuid שלהם. **מספר ההזמנה לא נשמר בעמודה** (רק לפעמים בתוך `changesJson.orderId`). לכן טאב ההיסטוריה של ההזמנה (`ModernInfoTab`) מציג היום **רק** `entityType=Order` — פריטים/תשלומים/חיובים **לא מופיעים בו** (הפריטים רק בחלונית פריט דרך `/api/audit/order-item/[id]`). הפיד החדש חייב לאחד ישויות (§3.1).
- `Shift`: לפי `entityId`=מזהה משמרת; ה-API של העובד מחפש לפי רשימת משמרות.
- פעולות שאינן ב-`ACTION_TRANSLATIONS` היום: `UI_ERROR_ALERT`, `AUTO_CREDIT_*`, `ALTERATION_DONE`, `EXECUTE` — מוצגות כמפתח אנגלי גולמי.

### 1.5 שכבות הקריאה והתצוגה היום
| רכיב | מה עושה |
|---|---|
| `GET /api/audit` (`app/api/audit/route.js`) | סינון `entityType/entityId/entityIds/action/actions/startDate/endDate/search` (search = `contains` ב-`changesJson`, ללא רגישות לאותיות), `limit` ברירת מחדל 100, `page`, מיון `createdAt desc`, מחזיר `{logs,total}` + `employeeName`. **הרשאה:** `entityType=Employee` או בלי סוג → רק "הנהלה ראשית"; אחרת מחריג Employee. |
| `GET /api/audit/order-item/[id]` | מערך חשוף של שורות OrderItem, בלי שמות מבצעים. משמש `ModernItemsManager` ו-`RentalReturnModal`. |
| `GET /api/employees/[id]/history` | Employee+Shift, 100 אחרונות, הנהלה ראשית בלבד. |
| `components/HistoryViewer.js` | `FIELD_TRANSLATIONS` (~120 שדות), `ACTION_TRANSLATIONS`, ציר-זמן כרטיסים, חיפוש + פעולה (CREATE/UPDATE/DELETE) + תאריכים, `formatValue` (bool→כן/לא, ISO→`toLocaleDateString('he-IL')`, אובייקט→JSON). |
| `components/modern/ChangesChips.js` | `ChangesChips`, `formatValue` (תאריך + עברי), `ACTION_TONES`; מסנן ריקים/זהים; שדות ארוכים (`body`,`notes`,`orderNotes`,`officeNotes`) כבלוק. |
| טאבים "אריג" | `ModernInfoTab` (הזמנה), `ModernCustomerHistoryTab`, `ModernDressInfoTab` (DressModel + DressItem[] בבקשה נפרדת), `ModernEmployeeHistoryTab` (נרמול legacy) — כל אחד משכפל `ACTION_BADGE_CLASS`, שורה "X ביצע/ה Y", חיפוש שרת. |
| קיבוץ | **אין**. רשימה שטוחה ממוינת יורד. |
| `/admin/data-history` | `<HistoryViewer/>` בלי entityType — כל היומן (למנהלים). |
| `/management/history`, `/api/history` | **לא AuditLog** — זה `PageVisitLog` (ביקורים בדפים). מחוץ להיקף הפיד. |
| `/refunds` | קורא `/api/audit?actions=DEBT_APPROVED,CANCEL_DEBT_APPROVAL` לחישוב מצב חוב, לא לתצוגה. |

---

## 2. מה הפיד בסקיצה מצפה לו, והפער

### 2.1 צורת רשומה בסקיצה (`let logs = […]`, שורה ~1965)
```js
{ id, ts:'2026-09-23T10:13', cat:'items|pay|del|dates|docs', icon:'dress|card|truck|cal|mail|print|sig|scissors|undo|bank|file|cash|clock',
  text:'נוסף פריט: דגם 4512, מידה 38',       // משפט קצר (השורה הסגורה)
  sub:'סניף נווה יעקב',                       // אופציונלי, בפירוט
  who:'רחל כהן', amt:150, kind:'pay'|undefined, // צ'יפ סכום: kind=pay ניטרלי, amt>0 חיוב, amt<0 זיכוי
  det:[['מחיר','₪150'],['לפני','ללא משלוח'],['אחרי','…']], isNew? }
```
תצוגה: `.hgrp > .hday` (כותרת יום עברי + לועזי, sticky) ואחריה `article.itm.hfe` (אחים; סגור = תג-אייקון + משפט + צ'יפ סכום + חץ; פתוח = `מבצע`, `שעה`, `פרטים` (sub), `שינוי: לפני ← אחרי` או שורות `det`). סינון: `HCATS` = הכול/פריטים/תשלומים/משלוח/תאריכים/מסמכים + `HF_EXTRA` לפי **אייקון** (חתימות/הדפסות/מיילים/תיקונים — מופיעים רק אם קיימת רשומה כזו). חיפוש: מילים (AND) על `text+sub+who+שעה+תאריך+det`, הדגשה `<mark>`, פתיחה אוטומטית כשהמילה נמצאת רק בפירוט. מיון `ts` יורד ואז `id` יורד. **ה-redo** בסקיצה (`.redo`, `REDO.pop()`) שייך ל**עגלת השינויים שלפני שמירה** — לא לפיד.

### 2.2 הפער
| הסקיצה צריכה | היום | פער |
|---|---|---|
| `cat` + `icon` | אין | גזירה מ-(entityType, action, שדות ששונו) |
| `text` משפט אנושי | תג "עדכון" + "X ביצע/ה עדכון" | ניסוח מחדש מכללים |
| `amt`/`kind` | ערכים גולמיים בצ'יפים | גזירה מ-`amount`/`price`/`totalAmount`, וסימן לפי סוג |
| `det` לפני/אחרי | חצי מהשורות בלי `from` | replay |
| היום (`.hday`) | אין קיבוץ, `toLocaleString` | מפתח יום בשעון ישראל |
| איחוד ישויות בהזמנה | רק `Order` | 5 קריאות מקבילות |
| שם פריט ("דגם 4512, מידה 38") | לא נשמר בשורות OrderItem | מנתוני הכרטיס (`itemsById`) או מצילום CREATE |
| סינון לפי קטגוריות | פעולה CREATE/UPDATE/DELETE בלבד | קטגוריות + אייקון |
| שם מבצע | `employeeName` או "עובד שנמחק"/"מערכת" | זהה, נשמר |
| כותרת יום עברית | ב-`ChangesChips` בלבד | `dayTitle` מהסקיצה + `getHebrewDateString` |

---

## 3. מפרט המתאם (קריאה/תצוגה בלבד)

### 3.1 טעינה
בכרטיס הזמנה: `loadOrderHistoryRows(order)` — **אפס שינוי שרת**: 5 קריאות מקבילות ל-`/api/audit` הקיים: `Order` לפי `orderId`, ו-`OrderItem`/`Payment`/`PaymentObligation`/`Refund` לפי `entityIds` שנשלפים מנתוני ההזמנה שכבר בכרטיס (כולל מחוקים), `limit=500`, איחוד לפי `id`. (חלופה עתידית: ראוט קריאה יחיד `/api/orders/[id]/history` — תוספת קריאה בלבד; דורש אישור לפי R24.) לקוחה: `entityType=Customer`. דגם: `DressModel` + `DressItem` (כבר נעשה כך). עובד: `/api/employees/[id]/history`. מנהל גלובלי: `/api/audit` בלי סוג. **השרת ממשיך לאכוף הרשאות; המתאם לא עוקף.**

### 3.2 צינור (`buildFeed`)
1. **`parseChanges`** — מזהה את המבנה (§1.3) ומחזיר `fields:{שם:{from,to,hasFrom}}` אחיד.
2. **`replay`** — עובר כרונולוגית לפי `entityType:entityId`, מחזיק מצב אחרון ידוע (מתחיל מ-snapshot), משלים `from` לשורות `values`, **זורק שדות זהים** (רעש השמירה), ומדלג על ברירות-מחדל ריקות ביצירה. כשאין מצב ידוע → "נקבע: X" (בלי חץ). המצב משמש גם לניסוח (מחיר/תיאור של פריט שהוסר).
3. **`toFeedEntry`** — כללי ניסוח לפי (ישות, פעולה, שדות): קטגוריה, אייקון, `text`, `sub`, `amt/kind`, `det`, `badge/tone`, `redo`.
4. **דחיית רעש** — UPDATE ללא שדות מוצגים לא הופך לרשומה (§6 פריט 1).
5. **מיון וקיבוץ** — `dayKey` בשעון `Asia/Jerusalem` (לא UTC — ר' `getIsraelDayRange` ב-`lib/hebrewDate.js`), ואז `.hday`.

בדיקת עשן שרצה על השלד: הזמנה שנוצרה, UPDATE שהוסיף משלוח, תשלום ₪300, ו-UPDATE זהה לחלוטין ביום אחר. התוצאה: 3 רשומות ביום אחד (תשלום עם צ'יפ 300, "נוסף משלוח" עם לפני `לא` ← אחרי `כן`, "ההזמנה נוצרה"), וה-UPDATE הזהה **נדחה**.

### 3.3 קטגוריה / אייקון / תג
סדר עדיפויות: `ACTIONS[action].cat/icon` ← קבוצת השדות ששונו (כשכולם מאותה קבוצה) ← ברירת מחדל של הישות. `badge` קצר מ-`ACTIONS`, `tone` (`ok|bad|neutral`) → ירוק/אדום/ניטרלי. קטגוריות הסקיצה נשמרות (`items,pay,del,dates,docs`); הרחבות: `rental`, `info`, `cust`, `dress`, `emp`, `sys`. **המסנן מציג רק קטגוריות שיש להן רשומה** (כמו `hfCats`), כך שבמסכי לקוחה/דגם/עובד יופיעו רק הרלוונטיות. תתי-סינון לפי אייקון (חתימות/הדפסות/מיילים/תיקונים) נשמרים.

### 3.4 משפט אנושי — כללים (נוסחו מחדש, לא הועתקו)
| מצב | משפט | סכום |
|---|---|---|
| OrderItem CREATE | `נוסף פריט: {דגם} · מידה {מידה}` | +מחיר סופי (חיוב) |
| CANCEL_ITEM / RESTORE_ITEM | `הוסר פריט: …` / `שוחזר פריט: …` | — (הסכום מגיע מ-`PaymentObligation` המתאים) |
| שינוי מידה / תיקון | `שונתה מידה: …` (sub `38 ← 40`) / `עודכנה בקשת תיקון` | — |
| ALTERATION_DONE | `התיקון סומן כהושלם` | — |
| CONFIRM_RENTAL / RETURN / CANCEL_RETURN / CANCEL_SCAN | `הפריט נלקח` / `הפריט הוחזר` / `בוטלה החזרה` / `בוטלה סריקה` | — |
| Payment CREATE | `התקבל תשלום ב{אמצעי}` (או `זיכוי ₪X` כש-isRefund/שלילי) | pay / crd |
| PaymentObligation | `נוסף חיוב: {תיאור}` / `בוטל חיוב: …` / `שוחזר חיוב: …` (תיאור "משלוח" → קטגוריית `del`) | chg / crd |
| Refund | `נוצר זיכוי ₪X` / `הזיכוי בוצע` / `זיכוי אוטומטי בוטל` | crd |
| DEBT_APPROVED / CANCEL_DEBT_APPROVAL | `אושרה יתרת חוב` / `אישור החוב בוטל` | סכום החוב |
| Order UPDATE | לפי קבוצת השדות: `נקבע/שונה תאריך האירוע`, `נוסף/הוסר משלוח`, `נחתם התקנון`, `הערה עודכנה`, `תאריכי ההשכרה עודכנו`, אחרת `פרטי ההזמנה עודכנו` | Δ`totalAmount` אם יש from |
| CANCEL_ORDER / CANCEL_CHANGES | `ההזמנה בוטלה` / `בוטלו שינויים שלא נשמרו` (sub = מה בוטל) | — |
| EMAIL_SENT | `נשלח מייל ללקוחה` (sub = נמען; בפירוט: נושא, קבצים, גוף) | — |
| לקוחה/עובד/דגם | `{שדה} עודכן` (שדה יחיד) / `עודכנו: א, ב, ג` (עד 3) / `X עודכן/ה` | — |

**צ'יפ סכום:** `kind:'pay'` → ניטרלי (`.hamt.pay`); `chg` → חיוב; `crd` → זיכוי. בלי סכום — אין צ'יפ (`.noamt`).
**פירוט מורחב:** שדה יחיד עם from/to → `לפני`/`אחרי` (הסקיצה מרנדרת "שינוי: א ← ב" עם `<bdi>`); כמה שדות → שורה לכל שדה `תווית: לפני ← אחרי`; יצירה → `תווית: ערך`. שדות ארוכים (`body`, `notes`, `orderNotes`, `officeNotes`, `alterationDetails`) בשורה מלאה. הערכים דרך `fmtValue` לפי `fmt` (₪, dd.mm.yyyy בשעון ישראל, כן/לא, enum, סוד → `••••`).

### 3.5 חיפוש וסינון
`searchHay(entry)` = הטקסטים של הסקיצה **+ `raw` (changesJson הגולמי)**, כדי לשמר את חיפוש-בתוך-הערך של המסך הישן (למשל טלפון שאינו מוצג). סינון קטגוריות לפי `entry.cat` / אייקון. הכול בצד לקוח על מה שנטען (עד 500 לישות). אם `total` גדול ממה שנטען: "טען עוד" (`page=2`), ובחיפוש — נפילה לשרת (`search=`) כמו היום.

### 3.6 קיבוץ יום
`dayKey(createdAt)` (`sv-SE` ב-`Asia/Jerusalem`) → `[{day, entries}]`; כותרת = `dayTitle(day)` (עברי) + `greg(day)` כמו בסקיצה. מיון `createdAt` יורד, ובשוויון `id` יורד.

### 3.7 זכאות "redo" בפיד
אין ב-AuditLog מידע לשחזור אמין ואין נתיב "ביטול רשומה", ולכן `redo.eligible=false` לכל רשומה כברירת מחדל (היסטוריה קריאה-בלבד). ה-`.redo` בסקיצה הוא מחסנית העגלה לפני שמירה, לא חלק מהפיד. החריג היחיד: **חלונות "ביטול מיידי" קיימים** (מדיניות זיכוי — `/admin/refund-policy`, זיכוי לניצול 15 דק'): `ctx.liveUndo['Refund:<id>'] = {untilTs, kind}` מגיע ממצב הכרטיס (לא מהיומן) ← הרשומה מקבלת `redo:{eligible:true,untilTs}`; הפיד רק מציג את הכפתור ומפעיל את הקריאה הקיימת (`credit-undo`) ואינו כותב יומן. **שאלה לשמירה ב-QUESTIONS:** האם ה"redo" בפיד מיועד לזה, או שהפיד תצוגה בלבד?

---

## 4. מילון — כל השדות / ישויות / פעולות (JS מוכן)
> מועתק אוטומטית מהשלד; עריכה — בשלד. שדה שאינו במילון → מוצג בשם הגולמי, ומומלץ לתעד ב-console בפיתוח (`missingLabels`) לגילוי פערים.

```js
/** קטגוריות פיד. שלוש הראשונות בסקיצה; השאר הרחבה. tone נקבע לפי הפעולה, לא לפי הקטגוריה. */
export const CATEGORIES = {
  items:  { label: 'פריטים',    icon: 'dress'    },
  pay:    { label: 'תשלומים',   icon: 'card'     },
  del:    { label: 'משלוח',     icon: 'truck'    },
  dates:  { label: 'תאריכים',   icon: 'cal'      },
  docs:   { label: 'מסמכים',    icon: 'file'     }, // מיילים/הדפסות/חתימות/הערות (תתי-סינון לפי icon, כמו HF_EXTRA)
  rental: { label: 'לקיחה והחזרה', icon: 'bag'   }, // חדש: מחזור החיים של הפריט
  info:   { label: 'פרטי הזמנה', icon: 'pencil'  }, // חדש: סניף, סטטוס, הערות
  cust:   { label: 'פרטי לקוחה', icon: 'user'    },
  dress:  { label: 'דגם ופריט מלאי', icon: 'dress' },
  emp:    { label: 'עובד ומשמרות', icon: 'clock' },
  sys:    { label: 'מערכת והגדרות', icon: 'lock'  },
};

/** שם ישות (AuditLog.entityType) -> תווית קצרה + קטגוריית ברירת מחדל + אייקון ברירת מחדל. */
export const ENTITIES = {
  Order:             { label: 'הזמנה',        cat: 'info',   icon: 'file'  },
  OrderItem:         { label: 'פריט',         cat: 'items',  icon: 'dress' },
  PaymentObligation: { label: 'חיוב',         cat: 'pay',    icon: 'cart'  },
  Payment:           { label: 'תשלום',        cat: 'pay',    icon: 'card'  },
  Refund:            { label: 'זיכוי',        cat: 'pay',    icon: 'undo'  },
  Customer:          { label: 'לקוחה',        cat: 'cust',   icon: 'user'  },
  DressModel:        { label: 'דגם',          cat: 'dress',  icon: 'dress' },
  DressItem:         { label: 'פריט מלאי',    cat: 'dress',  icon: 'dress' },
  Employee:          { label: 'עובד',         cat: 'emp',    icon: 'user'  },
  Shift:             { label: 'משמרת',        cat: 'emp',    icon: 'clock' },
  SystemSetting:     { label: 'הגדרה',        cat: 'sys',    icon: 'lock'  },
  PriceList:         { label: 'מחירון',       cat: 'sys',    icon: 'cash'  },
  PriceRule:         { label: 'כלל מחיר',     cat: 'sys',    icon: 'cash'  },
  Department:        { label: 'מחלקה',        cat: 'sys',    icon: 'lock'  },
  DepartmentPermission:       { label: 'הרשאת מחלקה', cat: 'sys', icon: 'lock' },
  EmployeePermissionOverride: { label: 'הרשאה אישית', cat: 'sys', icon: 'lock' },
  TrustedDevice:     { label: 'מכשיר מהימן',  cat: 'sys',    icon: 'lock'  },
  Notification:      { label: 'התראה',        cat: 'sys',    icon: 'info'  },
  NedarimHok:        { label: 'הוראת קבע',    cat: 'pay',    icon: 'bank'  },
  ErrorReport:       { label: 'דיווח שגיאה',  cat: 'sys',    icon: 'alert' },
  System:            { label: 'מערכת',        cat: 'sys',    icon: 'info'  }, // send-email ללא לקוח/עובד
};

/**
 * פעולה (AuditLog.action) -> ניסוח. tone: ok|bad|neutral (צבע תג).
 * verb: פועל קצר לשימוש בניסוח משפט כשאין תבנית ייעודית. cat/icon דורסים את ברירת המחדל של הישות.
 * kind: איך הפעולה משפיעה על צ'יפ הסכום (pay=תשלום, chg=חיוב, crd=זיכוי, null=אין).
 */
export const ACTIONS = {
  CREATE:              { badge: 'נוצר',        verb: 'נוצר',        tone: 'ok'      },
  UPDATE:              { badge: 'עודכן',       verb: 'עודכן',       tone: 'neutral' },
  DELETE:              { badge: 'נמחק',        verb: 'נמחק',        tone: 'bad'     },
  EMAIL_SENT:          { badge: 'מייל',        verb: 'נשלח מייל',   tone: 'neutral', cat: 'docs', icon: 'mail' },
  ADD_PAYMENT:         { badge: 'תשלום',       verb: 'נרשם תשלום',  tone: 'ok',      cat: 'pay',  icon: 'card', kind: 'pay' },
  UPDATE_PAYMENT:      { badge: 'תשלום',       verb: 'עודכן תשלום', tone: 'neutral', cat: 'pay',  icon: 'card' },
  DELETE_PAYMENT:      { badge: 'הוסר',        verb: 'נמחק תשלום',  tone: 'bad',     cat: 'pay',  icon: 'card' },
  REMOVE_PAYMENT:      { badge: 'הוסר',        verb: 'הוסר תשלום זיכוי', tone: 'bad', cat: 'pay', icon: 'undo' },
  REFUND:              { badge: 'זיכוי',       verb: 'נרשם זיכוי',  tone: 'neutral', cat: 'pay',  icon: 'undo', kind: 'crd' },
  EXECUTE:             { badge: 'זיכוי בוצע',  verb: 'בוצע זיכוי',  tone: 'ok',      cat: 'pay',  icon: 'bank' },
  AUTO_CREDIT_REFUND_CREATED: { badge: 'זיכוי אוטו׳', verb: 'נוצר זיכוי אוטומטי', tone: 'neutral', cat: 'pay', icon: 'undo', kind: 'crd' },
  AUTO_CREDIT_REFUND_UPDATED: { badge: 'זיכוי אוטו׳', verb: 'עודכן זיכוי אוטומטי', tone: 'neutral', cat: 'pay', icon: 'undo', kind: 'crd' },
  AUTO_CREDIT_REFUND_CLEARED: { badge: 'זיכוי אוטו׳', verb: 'זיכוי אוטומטי בוטל', tone: 'bad', cat: 'pay', icon: 'undo' },
  CONFIRM_RENTAL:      { badge: 'נלקח',        verb: 'סומן כנלקח',  tone: 'ok',      cat: 'rental', icon: 'bag' },
  RETURN_RENTAL:       { badge: 'הוחזר',       verb: 'הוחזר',       tone: 'ok',      cat: 'rental', icon: 'undo' },
  RETURN_CONDITION:    { badge: 'מצב בהחזרה',  verb: 'עודכן מצב בהחזרה', tone: 'neutral', cat: 'rental', icon: 'check' },
  CANCEL_RENTAL:       { badge: 'בוטלה לקיחה', verb: 'בוטלה לקיחה', tone: 'bad',     cat: 'rental', icon: 'x' },
  CANCEL_RETURN:       { badge: 'בוטלה החזרה', verb: 'בוטלה החזרה', tone: 'bad',     cat: 'rental', icon: 'x' },
  CANCEL_SCAN:         { badge: 'בוטלה סריקה', verb: 'בוטלה סריקה', tone: 'bad',     cat: 'rental', icon: 'x' },
  ADD_AUTO_NOTE:       { badge: 'הערה',        verb: 'נוספה הערה אוטומטית', tone: 'neutral', cat: 'docs', icon: 'file' },
  DEBT_APPROVED:       { badge: 'חוב אושר',    verb: 'אושרה יתרת חוב', tone: 'ok',   cat: 'pay', icon: 'check' },
  CANCEL_DEBT_APPROVAL:{ badge: 'אישור בוטל',  verb: 'בוטל אישור חוב', tone: 'bad',  cat: 'pay', icon: 'x' },
  CANCEL_ITEM:         { badge: 'הוסר',        verb: 'הוסר פריט',   tone: 'bad',     cat: 'items', icon: 'dress' },
  RESTORE_ITEM:        { badge: 'שוחזר',       verb: 'שוחזר פריט',  tone: 'ok',      cat: 'items', icon: 'dress' },
  CANCEL_OBLIGATION:   { badge: 'חיוב בוטל',   verb: 'בוטל חיוב',   tone: 'bad',     cat: 'pay',   icon: 'cart' },
  RESTORE_OBLIGATION:  { badge: 'חיוב שוחזר',  verb: 'שוחזר חיוב',  tone: 'ok',      cat: 'pay',   icon: 'cart' },
  CANCEL_PAYMENT:      { badge: 'תשלום בוטל',  verb: 'בוטל תשלום',  tone: 'bad',     cat: 'pay',   icon: 'card' },
  RESTORE_PAYMENT:     { badge: 'תשלום שוחזר', verb: 'שוחזר תשלום', tone: 'ok',      cat: 'pay',   icon: 'card' },
  CANCEL_ORDER:        { badge: 'בוטלה',       verb: 'ההזמנה בוטלה', tone: 'bad',    cat: 'info',  icon: 'x' },
  CANCEL_CHANGES:      { badge: 'בוטל',        verb: 'בוטלו שינויים שלא נשמרו', tone: 'bad', cat: 'info', icon: 'undo' },
  ALTERATION_DONE:     { badge: 'תיקון בוצע',  verb: 'התיקון בוצע', tone: 'ok',      cat: 'items', icon: 'scissors' },
  UI_ERROR_ALERT:      { badge: 'שגיאה',       verb: 'התראת שגיאה', tone: 'bad',     cat: 'sys',   icon: 'alert' },
};

/**
 * שם שדה (מפתח ב-changesJson) -> תווית קצרה. [label, cat?, icon?, fmt?, hidden?]
 * fmt: money|date|datetime|bool|text|long|phone|dir|status|enum:<name>
 * hidden=true: לא מוצג בפירוט (רעש/טכני/סוד). cat/icon מכריעים סיווג רשומה כשהשדה הוא היחיד שהשתנה.
 * מקור התרגומים הישנים: FIELD_TRANSLATIONS ב-components/HistoryViewer.js (לא הועתק - נוסח מחדש).
 */
export const FIELDS = {
  // --- הזמנה ---
  orderId: ['מס׳ הזמנה', 'info', 'file', 'text'],
  totalAmount: ['סה״כ הזמנה', 'pay', 'cash', 'money'],
  status: ['מצב תשלום', 'pay', 'card', 'status'],
  isPaid: ['שולם', 'pay', 'card', 'bool'],
  paymentDate: ['תאריך תשלום', 'pay', 'cal', 'date'],
  paymentMethod: ['אמצעי תשלום', 'pay', 'card', 'text'],
  eventDate: ['תאריך אירוע', 'dates', 'cal', 'date'],
  eventDateHebrew: ['תאריך אירוע (עברי)', 'dates', 'cal', 'text'],
  fromDate: ['תחילת השכרה', 'dates', 'cal', 'date'],
  toDate: ['סוף השכרה', 'dates', 'cal', 'date'],
  returnDate: ['החזרה עד', 'dates', 'cal', 'date'],
  orderDate: ['תאריך הזמנה', 'dates', 'cal', 'date'],
  customSpacing: ['ריווח ימים', 'dates', 'cal', 'text'],
  extraDay: ['יום נוסף', 'dates', 'cal', 'enum:extraDay'],
  isAbroad: ['אירוע בחו״ל', 'info', 'info', 'bool'],
  isWeekdayEvent: ['אירוע באמצע שבוע', 'info', 'info', 'bool'],
  isPhoneOrder: ['הזמנה טלפונית', 'info', 'info', 'bool'],
  branch: ['סניף', 'info', 'pencil', 'text'],
  pickupBranch: ['סניף איסוף', 'info', 'pencil', 'text'],
  notes: ['הערה', 'docs', 'file', 'long'],
  orderNotes: ['הערת הזמנה', 'docs', 'file', 'long'],
  internalNotes: ['הערה פנימית', 'docs', 'lock', 'long'],
  hasSignedRegulations: ['חתימה על התקנון', 'docs', 'sig', 'bool'],
  isDelivery: ['משלוח', 'del', 'truck', 'bool'],
  deliveryDirection: ['כיוון משלוח', 'del', 'truck', 'enum:deliveryDirection'],
  deliveryAddress: ['כתובת משלוח', 'del', 'truck', 'text'],
  deliveryCity: ['עיר משלוח', 'del', 'truck', 'text'],
  deliveryOneDayBefore: ['משלוח יום לפני', 'del', 'truck', 'bool'],
  hokDetails: ['הוראת קבע', 'pay', 'bank', 'text', true],
  isDeleted: ['בוטל', null, 'x', 'bool'],
  deletedAt: ['זמן ביטול', null, 'x', 'datetime', true],
  approvedDebtAmount: ['חוב שאושר', 'pay', 'check', 'money'],
  discarded: ['מה בוטל', 'info', 'undo', 'text'],
  note: ['הערה', 'docs', 'file', 'text'],
  // --- פריט הזמנה ---
  dressItemId: ['פריט מלאי', 'items', 'dress', 'text', true],
  dressModelId: ['דגם', 'items', 'dress', 'text', true],
  description: ['תיאור', 'items', 'dress', 'text'],
  sizeText: ['מידה', 'items', 'dress', 'text'],
  size: ['מידה', 'items', 'dress', 'text'],
  price: ['מחיר', 'items', 'cash', 'money'],
  basePrice: ['מחיר בסיס', 'items', 'cash', 'money'],
  finalPrice: ['מחיר סופי', 'items', 'cash', 'money'],
  quantity: ['כמות', 'items', 'dress', 'text'],
  repairs: ['תיקונים', 'items', 'scissors', 'text'],
  neckAlteration: ['תיקון צוואר', 'items', 'scissors', 'bool'],
  sleeveAlteration: ['תיקון שרוול', 'items', 'scissors', 'bool'],
  lengthAlteration: ['תיקון אורך', 'items', 'scissors', 'text'],
  alterationDetails: ['פירוט תיקון', 'items', 'scissors', 'long'],
  alterationDone: ['תיקון הושלם', 'items', 'scissors', 'bool'],
  barcode: ['ברקוד', 'rental', 'bag', 'text'],
  barcodePrefix: ['קידומת ברקוד', 'rental', 'bag', 'text', true],
  isTaken: ['נלקח', 'rental', 'bag', 'bool'],
  takenDate: ['תאריך לקיחה', 'rental', 'bag', 'datetime'],
  isReturned: ['הוחזר', 'rental', 'undo', 'bool'],
  returnedOk: ['הוחזר תקין', 'rental', 'check', 'bool'],
  isDamagedReturn: ['הוחזר פגום', 'rental', 'alert', 'bool'],
  barcodeInvalid: ['ברקוד לא תקין', 'rental', 'alert', 'bool'],
  barcodeInvalidHandled: ['ברקוד טופל', 'rental', 'check', 'bool'],
  manualBarcodeEntry: ['ברקוד הוקלד ידנית', 'rental', 'pencil', 'bool'],
  manualBarcodeConfirmed: ['ברקוד ידני אושר', 'rental', 'check', 'bool'],
  cartStatus: ['מצב עגלה', 'items', 'cart', 'enum:cartStatus', true],
  cartStatusDate: ['תאריך מצב עגלה', null, null, 'datetime', true],
  // --- חיוב / תשלום / זיכוי ---
  amount: ['סכום', 'pay', 'cash', 'money'],
  productId: ['מק״ט מחירון', 'pay', 'cart', 'text', true],
  isRefund: ['זיכוי', 'pay', 'undo', 'bool'],
  isManual: ['חיוב ידני', 'pay', 'pencil', 'bool'],
  orderItemId: ['פריט משויך', 'pay', 'dress', 'text', true],
  reason: ['סיבה', 'pay', 'file', 'text'],
  bankName: ['בנק', 'pay', 'bank', 'text'],
  bankBranch: ['סניף בנק', 'pay', 'bank', 'text'],
  bankAccount: ['חשבון', 'pay', 'bank', 'text'],
  bankAccountName: ['שם בעל החשבון', 'pay', 'bank', 'text'],
  paymentDetails: ['פרטי תשלום', 'pay', 'card', 'text'],
  isExecuted: ['הזיכוי בוצע', 'pay', 'bank', 'bool'],
  executionDate: ['תאריך ביצוע', 'pay', 'bank', 'datetime'],
  executedBy: ['מבצע הזיכוי', 'pay', 'bank', 'text', true],
  paymentId: ['תשלום משויך', 'pay', 'card', 'text', true],
  isAutoGenerated: ['נוצר אוטומטית', 'pay', 'undo', 'bool'],
  // --- מייל (EMAIL_SENT) ---
  to: ['נמען', 'docs', 'mail', 'text'],
  cc: ['העתק', 'docs', 'mail', 'text'],
  subject: ['נושא', 'docs', 'mail', 'text'],
  body: ['תוכן המייל', 'docs', 'mail', 'long'],
  type: ['סוג מסמך', 'docs', 'print', 'text'],
  sendMode: ['אופן שליחה', 'docs', 'mail', 'text', true],
  files: ['קבצים מצורפים', 'docs', 'file', 'files'],
  driveLinks: ['קישורי Drive', 'docs', 'file', 'text', true],
  // --- לקוחה ---
  firstName: ['שם פרטי', 'cust', 'user', 'text'],
  lastName: ['שם משפחה', 'cust', 'user', 'text'],
  fullName: ['שם מלא', 'cust', 'user', 'text'],
  phone1: ['טלפון', 'cust', 'user', 'phone'],
  phone2: ['טלפון נוסף', 'cust', 'user', 'phone'],
  email: ['מייל', 'cust', 'mail', 'text'],
  emailSuffix: ['סיומת מייל', 'cust', 'mail', 'text', true],
  city: ['עיר', 'cust', 'user', 'text'],
  street: ['רחוב', 'cust', 'user', 'text'],
  houseNum: ['מס׳ בית', 'cust', 'user', 'text'],
  officeNotes: ['הערת משרד', 'cust', 'file', 'long'],
  registrationDate: ['תאריך רישום', 'cust', 'cal', 'date'],
  isBlocked: ['חסימה', 'cust', 'lock', 'bool'],
  blockedReason: ['סיבת חסימה', 'cust', 'lock', 'text'],
  // --- דגם / פריט מלאי ---
  name: ['שם דגם', 'dress', 'dress', 'text'],
  priceCategory: ['קטגוריית מחיר', 'dress', 'cash', 'text'],
  inInspection: ['בבדיקה', 'dress', 'dress', 'bool'],
  imageUrl: ['תמונה', 'dress', 'dress', 'text', true],
  thumbnailUrl: ['תמונה ממוזערת', 'dress', 'dress', 'text', true],
  entryDateToRepo: ['כניסה למלאי', 'dress', 'cal', 'date'],
  exitDateFromRepo: ['יציאה מהמלאי', 'dress', 'cal', 'date'],
  inactiveReason: ['סיבת אי-פעילות', 'dress', 'info', 'text'],
  isSplit: ['שמלה דו-חלקית', 'dress', 'dress', 'bool'],
  isPremium: ['פרימיום', 'dress', 'dress', 'bool'],
  serialNumber: ['מס׳ סידורי', 'dress', 'dress', 'text'],
  dressBarcode: ['ברקוד פריט', 'dress', 'dress', 'text'],
  dressName: ['שם שמלה', 'dress', 'dress', 'text'],
  location: ['מיקום', 'dress', 'dress', 'text'],
  locationNum: ['מס׳ מיקום', 'dress', 'dress', 'text'],
  cartonNumber: ['מס׳ קרטון', 'dress', 'dress', 'text'],
  inRepair: ['בתיקון', 'dress', 'scissors', 'bool'],
  notInUse: ['לא בשימוש', 'dress', 'lock', 'bool'],
  notInUseSince: ['לא בשימוש מאז', 'dress', 'cal', 'date'],
  notInUseReason: ['סיבה', 'dress', 'info', 'text'],
  // --- עובד / משמרת ---
  roleId: ['מחלקה', 'emp', 'user', 'text'],
  isActive: ['פעיל', 'emp', 'user', 'bool'],
  hourlyWage: ['שכר לשעה', 'emp', 'cash', 'money'],
  travelExpenses: ['נסיעות', 'emp', 'cash', 'bool'],
  joinDate: ['תאריך הצטרפות', 'emp', 'cal', 'date'],
  password: ['סיסמה', 'emp', 'lock', 'secret'],
  pinHash: ['קוד קצר', 'emp', 'lock', 'secret'],
  mustResetPassword: ['חובת איפוס סיסמה', 'emp', 'lock', 'bool'],
  themeColor: ['העדפות עיצוב', 'emp', 'pencil', 'text', true],
  profileImage: ['תמונת פרופיל', 'emp', 'user', 'text', true],
  receiveEmailAlerts: ['התראות במייל', 'emp', 'mail', 'bool'],
  showAi: ['הרשאת AI', 'emp', 'lock', 'bool'],
  canReportErrors: ['דיווח שגיאות', 'emp', 'alert', 'bool'],
  date: ['תאריך', 'emp', 'cal', 'date'],
  hebrewDate: ['תאריך עברי', 'emp', 'cal', 'text', true],
  entryTime: ['כניסה', 'emp', 'clock', 'datetime'],
  exitTime: ['יציאה', 'emp', 'clock', 'datetime'],
  totalMinutes: ['דקות', 'emp', 'clock', 'text'],
  totalCalculated: ['לתשלום', 'emp', 'cash', 'money'],
  hourlyWageSnapshot: ['שכר בעת המשמרת', 'emp', 'cash', 'money', true],
  travelExpensesSnapshot: ['נסיעות בעת המשמרת', 'emp', 'cash', 'money', true],
  employeeId: ['עובד', null, 'user', 'text', true],
  // --- הגדרות ---
  key: ['מפתח הגדרה', 'sys', 'lock', 'text'],
  value: ['ערך', 'sys', 'lock', 'text'],
  category: ['קטגוריה', 'sys', 'lock', 'text'],
  // --- שדות טכניים משותפים (לא מוצגים) ---
  id: ['מזהה', null, null, 'text', true],
  legacyId: ['מזהה ישן', null, null, 'text', true],
  customerId: ['לקוחה', null, null, 'text', true],
  createdAt: ['נוצר', null, null, 'datetime', true],
  updatedAt: ['עודכן', null, null, 'datetime', true],
};

/** ערכי enum שמוצגים כמילים. */
export const ENUMS = {
  extraDay: { before: 'יום לפני', after: 'יום אחרי' },
  deliveryDirection: { 'הלוך': 'הלוך', 'חזור': 'חזור', 'הלוך-חזור': 'הלוך-חזור' },
  cartStatus: { pending: 'ממתין', confirmed: 'מאושר' },
};
```

**הערות למילון:** (א) `Order.hokDetails`, מזהים, תמונות ושדות `Snapshot` מוסתרים (`hidden`). (ב) `themeColor` (העדפות עיצוב של עובד — נכתב בכל שינוי פלטה דרך `/api/me/design-prefs`) מוסתר כרעש. (ג) `SystemSetting` שומר `{value}` בלי שם ההגדרה — שם תצוגה דורש שליפת `settingsById` (`name`,`key`) ב-`/admin/data-history`; בלעדיה: "הגדרה עודכנה". (ד) מודל שאינו ב-`ENTITIES` נופל ל-`sys` עם שם המודל הגולמי. (ה) `PriceList`/`PriceRule`/`Department*`/`Notification`/`NedarimHok`/`ErrorReport` נכללים כי התוסף כותב אליהם; מבנה `values` והניסוח הגנרי מספיק.

---

## 5. כל המסכים שמציגים היסטוריה וצריכים את הפיד
| # | מסך / קובץ | מקור נתונים | הערות למעבר |
|---|---|---|---|
| 1 | **כרטיס הזמנה — טאב היסטוריה** `app/orders/[id]/page.js` → `components/orders/modern/ModernInfoTab.js` | `/api/audit?entityType=Order` | **היעד הראשי.** מורחב לאיחוד 5 ישויות. בקרת שינוי תאריך הזמנה (`onOrderDateSave`) שמעל הרשימה נשארת. |
| 2 | חלונית פריט `ModernItemsManager.js` (~שורות 738/1386) | `/api/audit/order-item/[id]` | פיד מצומצם לפריט; שם המבצע חסר בראוט — להשלים דרך `/api/audit?entityType=OrderItem&entityId=` (קיים) |
| 3 | חלונית החזרה `components/orders/RentalReturnModal.js` (~430/657/1047) | `/api/audit/order-item/[id]` | כנ"ל |
| 4 | **כרטיס לקוחה** `ModernCustomerHistoryTab.js` (`ModernCustomerCard`, `app/customers/[id]`) | `/api/audit?entityType=Customer` | קטגוריות `cust` (+`docs` למיילים) |
| 5 | **כרטיס דגם** `ModernDressInfoTab.js` (`app/dashboard/dresses/[id]`) | `DressModel` + `DressItem` (entityIds) | איחוד ב-`buildFeed` |
| 6 | פריט מלאי `ModernDressItemModal.js` | `/api/dresses/items/[id]/history` — **לא AuditLog** (היסטוריית השכרות) | מחוץ לפיד; אפשר רשימת השכרות בסגנון הפיד |
| 7 | **כרטיס עובד** `components/employees/ModernEmployeeHistoryTab.js` | `/api/employees/[id]/history` (Employee+Shift) | לשמר נרמול legacy + הרשאת הנהלה ראשית |
| 8 | **/admin/data-history** (`HistoryViewer` גלובלי) | `/api/audit` בלי סוג | פיד גלובלי: חובה תג/שם ישות בכל שורה; סינון תאריכים (`startDate/endDate`) נשמר — הפיד המקומי אינו כולל |
| 9 | `components/HistoryViewer.js` | — | מוחלף; **`FIELD_TRANSLATIONS`/`ACTION_TRANSLATIONS` מיובאים ע"י 5 קבצים** — להשאיר export תואם עד שכולם עוברים |
| 10 | `components/modern/ChangesChips.js` | — | מיובא ע"י 4 טאבים; מוחלף בפירוט הפיד |
| 11 | `/refunds` (`app/refunds/page.js`) | `/api/audit?actions=DEBT_*` | **לוגיקה, לא תצוגה** — אסור לשבור את הקריאה |
| 12 | `/admin/audit-system`, `/admin/data-explorer` | סטטוס / טבלת "יומן אירועים" גולמית | טבלת נתונים; בהיקף רק אם תעוצב כטבלה |
| — | `/management/history` + `/api/history` | `PageVisitLog` | **לא AuditLog** — מחוץ לפיד |
| — | `lib/historyManager.js` (`agy_history`) | localStorage "נצפו לאחרונה" | לא קשור |

---

## 6. סיכוני התאמה (R24)
1. **הסתרת רשומות רעש:** היום כל UPDATE מוצג (גם "לא בוצעו שינויים מהותיים"). דחייה בפיד משנה ספירות — לאשר מול הבעלים; לשמור מתג "הצג הכול (מנהלים)" שמציג גולמי.
2. **ללא `from` בשורות `values`:** "נקבע: X" במקום "א ← ב" עלול להטעות. replay מדויק רק אם נטענו **כל** השורות מאז ה-CREATE (limit 500; הזמנות ישנות/מיובאות אולי בלי CREATE).
3. **הרשאות:** Employee ו"בלי סוג" → 403/סינון בשרת; ה-UI חייב לטפל ב-403 בשקט (הסתרת כרטיסייה).
4. **זהות Order כפולה** (uuid/מספר): רק `entityId=<מספר>` דרך `/api/audit` מאחד; לא להחליף בקריאה ישירה.
5. **חיפוש שרת מול לקוח:** הישן = `contains` על JSON גולמי על **כל** ההיסטוריה עם דפדוף; הלקוח רק על מה שנטען. `raw` ב-hay מצמצם אך לא מבטל מעל 500 שורות.
6. **פעולות לא מוכרות** (`EXECUTE`, `AUTO_CREDIT_*`, `ALTERATION_DONE`, `UI_ERROR_ALERT` ומה שיתווסף) — נפילה לתווית גנרית + `missingLabels`. פעולה חדשה בקוד חייבת להיכנס ל-`ACTIONS`.
7. **שעון:** `createdAt` ב-UTC; יום/שעה חייבים `Asia/Jerusalem`. שורות `createMany` באותה שנייה — סדר ביניהן לפי `id` אקראי (לא דטרמיניסטי) — מקובל.
8. **שם הפריט:** שורות OrderItem אינן נושאות דגם; נדרש `itemsById` מהכרטיס. פריט שאינו בנתונים → "פריט" גנרי.
9. **שם מבצע:** `employeeId` שאינו בטבלה → "עובד שנמחק"; `null` → "מערכת". להשאיר בדיוק כך (כלל ה-ID: לעולם לא UUID גולמי).
10. **סודות:** `redactSecrets` נשאר שלב ראשון (שורות ישנות עם hash); המתאם מציג `••••`.
11. **`EMAIL_SENT.body`** ארוך/רגיש — לפירוט הפתוח בלבד; `raw` ב-hay כולל אותו כרגע (להחליט).
12. **ביטול הזמנה** כותב Order+OrderItem+Obligation, כלומר N+2 שורות באותה שנייה — הצעה: לקבץ `CANCEL_ORDER` לרשומה אחת ("ההזמנה בוטלה — X פריטים"). **לא ממומש בשלד.**
13. **נרמול legacy** של משמרות (`ModernEmployeeHistoryTab`) עובר לשלב `parseChanges` (מכוסה במבנה `legacy`).
14. **מחיקה מוקדמת של `HistoryViewer` exports** שוברת build (`ModernItemsManager`, `RentalReturnModal`, `ChangesChips`, 4 טאבים).
15. **ביצועים:** 5 קריאות + replay על עד ~2500 שורות בלקוח — סביר; cold-start של Neon בפיתוח אינו בעיית אינדקס.
16. **`lib/offlineSync.js:200`** כותב שורות שלא נבדקו כאן — לבדוק צורתן לפני הטמעה.
17. **אין כתיבה ידנית חדשה:** ההתאמה לא מוסיפה ולא משנה שום `auditLog.create`. מידע חסר (למשל מספר הזמנה בשורות פריט) נפתר בקריאה, לא בכתיבה.
