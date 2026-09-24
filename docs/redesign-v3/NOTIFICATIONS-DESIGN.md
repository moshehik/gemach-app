# תכנון מנגנון התראות — R20 + R21 (2026-09-24)

ניתוח קריאה-בלבד של הקוד הקיים + תכנון. **קוסמטי + תוספת תואמת-לאחור בלבד; ללא שינוי סכמה.**

## 1. מצב קיים

### 1.1 הודעות "נשמר" ומעבר עמוד
| מקום | מה קורה היום |
|---|---|
| `app/orders/new/page.js:1341-1345` (יצירת הזמנה) | אחרי `POST /api/orders` — **אין שום הודעת הצלחה**; רק `router.push(resolveOrderRedirectHref(settings.order_new_redirect_screen \|\| 'order', {orderId, customerId}))`. `data.warning` מוצג ב-`alert` (1333). הדפסה אוטומטית ב-`window.open` אם `auto_print_on_order_create`. |
| `lib/orderRedirectScreens.js` | 6 יעדים: `order / new_order / orders_list / customer / rentals / dashboard`. ההגדרות: `order_new_redirect_screen` (יצירה), `order_edit_redirect_screen` (יציאה מכרטיס; ברירת מחדל `orders_list`) — נטענות ב-`orders/[id]/page.js:296`. |
| `app/orders/[id]/page.js` `handleSave` 904-975 | נשארים בעמוד. `setSaveMessage` (טקסט inline, 3s / 7s אם נוצר חוב) + `showSaveSuccessOverlay` (חלונית מרכז מסך "ההזמנה נשמרה בהצלחה!", 5s, `pointer-events:none`, שורות 1571-1588). אם נוצר חוב + נווה יעקב: מדלגים על ההודעות ופותחים `paymentContinueAmount` (1677). `promptPrint` ← `customConfirm` "להדפיס?" (966). |
| `orders/[id]/page.js` `handleExit` 1052-1270 | שמירה (PUT ~1191) ואז `router.push(destinationHref \|\| fallbackExitHref)` (1267/1269). לפני כן — `alert` חוב חדש (1219) / `alert` "מגיע זיכוי" (1234). **אין הודעת "נשמר" בכלל ביציאה** — המשתמש פשוט מגיע לעמוד היעד. |
| `orders/[id]/page.js:1395` | מחיקת הזמנה ← `router.push('/orders')` בלי הודעה. |
| `customers/[id]:217`, `employees/[id]:119`, `dashboard/dresses/[id]:394` (`router.replace`) | יצירה ← push ללא הודעה. עדכון (ללא ניווט) ← `alert('הפרטים נשמרו בהצלחה!')` (customers:220, employees:121). |
| `dashboard/dresses/[id]:252` | `handleExit`: `saveDress()` שקט ← `router.push('/dashboard/dresses')`. |
| `pendingBalance toast` | **לא קיים בקוד בשם הזה** (grep `pendingBalance` = 0). המקבילות: `paymentContinueAmount` (חלונית חוב), `orders/new:371` (`alert` "תשלום חלקי עבר… יש להשלים"), `orders/[id]:1234` (זיכוי). |
| "הודעת Toast" הכללית | `PopupProvider.showAlert` ← `.toast-stack` **למעלה-מרכז**, 4s, נשמר ב-`alertsHistory` (100, זיכרון בלבד, רק למתכנת דרך `MessageHistoryButton`). ≈281 קריאות `alert()` מנותבות אליו. |

**הפערים:** (א) ביציאה/יצירה+ניווט אין משוב; (ב) המשוב שכן קיים נעלם ואינו נשמר; (ג) `showSaveSuccessOverlay` חוסם מבחינה חזותית ונעלם בעזיבת העמוד — אם יש ניווט, לא רואים אותו.

### 1.2 הודעות פנימיות
* מודל `Notification` (`prisma/schema.prisma:176`): `senderId, receiverId (null = שידור), title?, content, isRead, readBy[JSON], isArchived, archivedBy[JSON], category? ('shift_handover'|'management'|null), handledAt/handledById, tags[]`. **`category` הוא `String?` חופשי** — אין enum במסד.
* API `app/api/notifications/route.js`: `GET` (150 אחרונות; `?light=1` מחזיר רק `unreadCount`), `POST` (יוצר; `ALLOWED_CATEGORIES=['shift_handover','management']` ← שידור + בדיקת הגדרה; **תמיד שולח מייל** לנמענים עם `receiveEmailAlerts` דרך `sendSystemEmail`), `read`, `archive`, `handle`, `tags`. עוד יוצרים: `lib/notifyManagers.js` (per-manager, ישיר ב-Prisma, בלי מייל).
* **הפופאפ שמופיע היום:** `ShiftMessageWatcher.js` (מותקן ב-`AppShell.js:141`, רק אם `!hideInternalMessaging`) — בכניסה, עבור כל `shift_handover` שלא טופל, קורא `showConfirm(...)` = **חלונית מרכז מסך חוסמת** ("אישור" = סימון טופל). `OverdueRemindersWatcher` (מודל, כל שעה). `LoginScreen.js:110-118` — `alert("יש N הודעות")` אם `notify_on_new_message_at_login`.
* **לא נמצא בקוד פופאפ צף "למטה-שמאל"** להודעות — הקיים הוא (א) חלונית מרכז, (ב) toast למעלה-מרכז, (ג) dropdown של הפעמון. ← R21 = מקום חדש (ראו §5); הסקיצה כבר מגדירה `#toast{position:fixed;left:24px;bottom:24px}` (שמאל פיזי = תואם RTL).

### 1.3 `NotificationBell` (`app/components/NotificationBell.js`)
* מותקן פעם אחת ב-`AppShell` (`:241`, רק אם `authToken && !hideInternalMessaging`) — **לא נטען מחדש בניווט**.
* poll קל `?light=1` כל 120s (מושהה בטאב מוסתר) + בכל שינוי `pathname`; רשימה מלאה נטענת רק בפתיחה. `markAsRead` ← `POST /api/notifications/read`.
* מציג כל הנתונים (לא מסנן `category`), נקודה אדומה לפי `unreadCount`.
* `/messages` (`app/messages/page.js:72-76`) מפצל: כללי = `category` שאינו `shift_handover`/`management`.

## 2. מנגנון R20 — `NoticeBar` + תור + שמירה בפעמון

### 2.1 עקרונות
1. **מקור אחד**: `enqueueNotice()` — פונקציה טהורה ב-`app/v3/notice/notice.js` (לא hook), נקראת מכל מקום, גם ממש לפני `router.push`.
2. **שרידות בניווט**: (א) `<NoticeProvider>` יושב ב-`app/layout.js` בתוך `PopupProvider` (כמו `AppShell`, לא נטען מחדש בניווט SPA); (ב) התור נשמר ב-`sessionStorage` כדי לשרוד גם ניווט קשה (`window.location.reload/href` — `AppShell.handleRefresh`, `LoginScreen`), וריענון F5.
3. **הזמן מוחלט**: לכל הודעה `expiresAt` (חותמת זמן) — ה-progress והטיימר מחושבים ממנו, כך שאין "איפוס" בניווט/ריענון.
4. **תצוגה מיד** ב-enqueue (לא מחכים לניווט): בדרך כלל ה-`push` קורה באותו רגע, והרכיב כבר בשורש ה-layout.

### 2.2 מבנה נתונים (sessionStorage `v3.notice.queue`, JSON array)
```js
{
  id: 'n_<ts>_<rand>',          // client id
  dedupeKey: 'saved:order:1234:<10s-bucket>',
  kind: 'created'|'saved'|'deleted'|'info'|'warn',
  title: 'ההזמנה נשמרה',        // קצר (R10), נכתב מחדש
  text: 'הזמנה #1234 · שרה כהן',
  entity: { type:'order', id:1234 },  // אופציונלי
  href: '/orders/1234',              // כפתור "פתח" (כמו .tbtn בסקיצה)
  createdAt: 1727200000000,
  expiresAt: createdAt + 15000,      // ברירת מחדל 15s
  remainingMs: null,                 // נשמר בזמן pause
  persist: true,                     // לשמור בפעמון
  persisted: false                   // הושלם POST
}
```
`v3.notice.seen` — `{dedupeKey: ts}` ל-60s (למניעת כפל).

### 2.3 זרימה
```
enqueueNotice(n)
 ├─ dedupe? (queue/seen) → מחזיר
 ├─ push → sessionStorage + dispatchEvent('v3:notice')
 └─ Provider: מציג NoticeBar, מתחיל טיימר (expiresAt − now)
router.push(...)  → Provider לא נטען מחדש; הפס ממשיך מאותו expiresAt
hide (פג/נסגר/נדחה)  → persistNote(n)  ← POST (ראו 2.4) ← persisted=true ← הסרה מהתור
pagehide/visibilitychange:hidden → sendBeacon לכל הלא-persisted
טעינה/כניסה → flush של פריטים שפג תוקפם ולא נשמרו (טאב נסגר בין לבין)
```
* סגירה ידנית (X) = נחשב hide ← נשמר בפעמון (המשתמש ביקש: "נעלמת → הערה בפעמון").
* עד 3 הודעות בערימה (מעל: "+N נוספות"), חדשה למעלה.
* פס הזהב: אלמנט `::after`/`<i class="v3-notice__bar">` ברוחב 100%→0 באנימציית CSS `linear` במשך `remaining`. צבע `var(--v3-gold)` (token, R2). RTL: הפס יורד לכיוון ההתחלה (`inset-inline-start`/`transform-origin: inline-end`).
* כפתור "פתח" (`href`) — ניווט באותו טאב; לחיצה עוצרת את ההודעה ושומרת מיד.

### 2.4 שמירה בפעמון — ללא שינוי סכמה
**החלטה מומלצת: שימוש במודל `Notification` הקיים עם `category='activity_note'`** (השדה הוא `String?` חופשי; אין migration).

הבעיה עם `POST /api/notifications` כפי שהוא: (1) שולח **מייל** לנמען (`receiveEmailAlerts`) — מייל לעצמך על כל שמירה = ספאם; (2) `category` לא ברשימה המותרת מתנהג כהודעה כללית (`null`), ו-`receiverId` נדרש מפורש; (3) יופיע בתיבת `/messages` כהודעה יוצאת.

**נדרש שינוי קטן ותואם-לאחור בצד שרת** (הוא לא "שינוי סכמה", אבל כן נגיעה ב-API — R8 אומר "ללא שינוי לוגיקת ליבה"; זו הוספת ענף חדש שלא משפיע על קיים ← **שאלה Q-N1 למשתמש**):
```js
// app/api/notifications/route.js POST — ענף חדש לפני parsedCategory:
if (category === 'activity_note') {
  // שלח לעצמי בלבד; בלי מייל; בלי בדיקת הגדרה; dedupe שרת
  const dup = await prisma.notification.findFirst({ where:{ senderId: employeeId, receiverId: employeeId, category, title, content, createdAt:{ gt: new Date(Date.now()-60000) } } });
  if (dup) return NextResponse.json({ success:true, notification: dup, deduped:true });
  const n = await prisma.notification.create({ data:{ senderId: employeeId, receiverId: employeeId, title, content, category } });
  return NextResponse.json({ success:true, notification:n });
}
```
(ה-AuditLog נכתב אוטומטית ע"י התוסף של Prisma — לא לכתוב ידנית, ראו זיכרון audit-log-no-manual-writes.)

**אם המשתמש לא מאשר נגיעה ב-route:** חלופה ללא שום שינוי צד-שרת: `POST /api/notifications` עם `receiverId=<self>` — מקבלים מייל ל-`receiveEmailAlerts=true` (מתפשר על ספאם) ו-`category:null`. לא מומלץ.

**צורת ה-payload:** `{ receiverId:<self id>, category:'activity_note', title:'ההזמנה נשמרה', content:'הזמנה #1234 · שרה כהן\n↩ /orders/1234' }`. הקישור = שורה אחרונה טקסטואלית `↩ /path` (אין שדה href בסכמה; קריא גם בפעמון הישן/`/messages`). הפעמון ב-v3 מפרסר ומציג כפתור.

**השפעות בצד הקריאה (שינויים קוסמטיים/סינון בלבד):**
* `app/messages/page.js:72-73` — להוסיף `&& n.category !== 'activity_note'` כדי שהתיבה הכללית לא תתמלא (ו-`outgoing` אותו דבר).
* `NotificationBell` v3 — אייקון/צבע ייעודי ל-`activity_note`; אפשרות "סמן הכל כנקרא". `isRead=false` ← נקודה אדומה (**Q-N2: האם שמירות עצמיות צריכות להדליק נקודה אדומה? המלצה: כן אבל עם `isRead:true` כברירת מחדל = הערות שקטות**; ניתן להחליף ע"י `read` מיידי בענף השרת).
* ניקוי: הערות `activity_note` מעל 30 יום — cron קיים (`app/api/cron`) או סינון בצד קריאה; לא חובה בשלב זה.

### 2.5 קריאות API
| קריאה | מתי |
|---|---|
| `POST /api/notifications` (`category:'activity_note'`) | ב-hide / pagehide (beacon) / flush |
| `GET /api/notifications?light=1` | אחרי POST מוצלח — הפעמון מרענן מונה (`window.dispatchEvent('v3:bell-refresh')`; היום הוא מתרענן רק בשינוי pathname ובפולינג 120s) |
| (ללא) | הצגת הבר עצמה — ללא קריאת רשת |

### 2.6 Dedupe
* לקוח: `dedupeKey = kind:entityType:entityId:floor(ts/10000)`; בדיקה מול התור ו-`v3.notice.seen` (60s) — מכסה React StrictMode ולחיצה כפולה.
* שרת: ענף ה-`findFirst` ב-60s (למעלה).
* שמירה+יציאה שמפעילים גם `handleSave` וגם `handleExit` על אותה הזמנה ← אותו מפתח ← הודעה אחת.

### 2.7 נגישות
* מיכל: `<div role="region" aria-label="התראות מערכת">`; כל הודעה `role="status"` (`aria-live="polite"`, `aria-atomic="true"`). הודעת `warn` חוסמת-קריאה: `role="alert"`.
* פס הזהב `aria-hidden="true"` (קישוט). טקסט מוסתר חזותית לקורא מסך: "ההודעה תישמר בפעמון".
* **עצירה**: `mouseenter`/`focusin` על ההודעה ← `pause` (שומרים `remainingMs`, `animation-play-state:paused`); `mouseleave`/`focusout` ← ממשיכים מ-`remainingMs` (מחשבים `expiresAt` חדש). מגע: לחיצה ארוכה/נגיעה עוצרת.
* כפתורים: "סגור" עם `aria-label`, "פתח" עם `aria-label` מלא ("פתח הזמנה 1234"); `Esc` בתוך ההודעה סוגר; מיקוד נראה (R18) — `outline` מ-tokens.
* `prefers-reduced-motion`: בלי החלקה/דעיכה; הפס מתעדכן בקפיצות של שנייה או מוחלף בטקסט "נשארו N שנ'"; המשך הטיימר זהה.
* WCAG 2.2.1: 15s + ניתן לעצירה + התוכן נשמר בפעמון ← עומד בדרישה.

### 2.8 מיקום ועיצוב
אותו אזור צף של הסקיצה (`#toast`: navy, פינה שמאלית-תחתונה `left:24px;bottom:24px`, `.tb` ריבוע אייקון 44px, `.tbtn` כפתור). במובייל: `left:12px; bottom:88px` (מעל סרגל תחתון, כפי בסקיצה :379). אזור אחד `#v3-toast-region` — גם `NoticeBar` (R20) וגם `MessageCard` (R21) נערמים בו כלפי מעלה; מרווח מה-FAB של ה-AI (ב-RTL ה-`insetInlineStart` הוא **ימין**, אין התנגשות; סרגל הקלטת שלבים של `ErrorReportButton` במרכז-תחתון — בסדר).

## 3. R21 — הודעות פנימיות למטה-שמאל
* **`MessageCard`** באותו `#v3-toast-region`: וריאנט **מתמשך** (לא נעלם לבד): שולח, נושא, תוכן (עד 3 שורות + "עוד"), כפתורי "סמן כטופל" / "קראתי" / "פתח". `role="alertdialog"`? — לא: `role="status"` + פוקוס לא נגנב.
* מחליף: (1) `ShiftMessageWatcher` (`showConfirm` חוסם במרכז) ← MessageCard לכל `shift_handover` שלא טופל (אותו `POST /api/notifications/handle` בלחיצת "טופל" — **התנהגות זהה**: "ביטול" משאיר את ההודעה לעובד הבא); (2) `LoginScreen.js:110-118` `alert` "יש N הודעות" ← MessageCard סיכומי אחרי הכניסה (הכניסה היא reload ← נדרש דגל sessionStorage `v3.login.notify` כי הרכיב נטען מחדש); (3) (רעיון, לא נדרש) הודעה חדשה שהגיעה בזמן העבודה: כשה-poll (`?light=1`) מחזיר `unreadCount` גבוה מהקודם ← טעינת רשימה וקפיצת MessageCard. **דורש החלטה** (Q-N3) — היום אין פופאפ להודעות שהגיעו תוך כדי עבודה.
* `OverdueOrdersModal` נשאר כמודל (טבלה + קישורים) — לא "הודעה פנימית".
* התור והפרסיסטנס נפרדים: הודעות פנימיות מגיעות מהשרת (כבר שמורות) — אין POST חוזר; רק `handle`/`read`.

## 4. כל המקומות שיצטרכו `enqueueNotice`
| # | file:line | אירוע | kind | הערות |
|---|---|---|---|---|
| 1 | `app/orders/new/page.js:1342` | אחרי `POST /api/orders` מוצלח, לפני `router.push(resolveOrderRedirectHref(...))` | created | href = היעד לפי `order_new_redirect_screen`; אם כבר בכרטיס — בלי כפתור "פתח". גם `data.warning` (1333) ← kind warn |
| 2 | `app/orders/[id]/page.js:952-958` | `handleSave` הצליח (מחליף `setSaveMessage` + `showSaveSuccessOverlay` 1571) | saved | נשארים בעמוד; מדלגים אם `showsPaymentContinuePrompt` (כמו היום) |
| 3 | `orders/[id]/page.js` ~1191-1267 | `handleExit` — אחרי PUT מוצלח, לפני `router.push` (1267/1269) | saved | **חסר משוב לגמרי היום**; `hasUnsavedChanges=false` ← אין PUT ← אין הודעה |
| 4 | `orders/[id]/page.js:1234` | `alert` "מגיע זיכוי ₪X" ביציאה | info | קיים כ-alert; להפוך ל-Notice+persist |
| 5 | `orders/[id]/page.js:1395` | מחיקת הזמנה → `/orders` | deleted | |
| 6 | `orders/[id]/page.js:1087-1090` (discard) | "זנח" — אין שמירה | (לא) | בלי הודעה |
| 7 | `app/customers/[id]/page.js:217` | יצירת לקוח → `/customers/{id}` | created | וגם :220 `alert('הפרטים נשמרו…')` ← saved (ללא ניווט) |
| 8 | `app/employees/[id]/page.js:119` | יצירת עובד → `/employees/{id}`; :121 עדכון | created / saved | |
| 9 | `app/dashboard/dresses/[id]/page.js:252` | `handleExit` אחרי `saveDress()` | saved | |
| 10 | `dashboard/dresses/[id]/page.js:394` | יצירת דגם (`router.replace`) | created | + `failedItems` alert ← warn |
| 11 | `orders/[id]/page.js:1219` | חוב חדש אחרי שמירה (alert; בנווה יעקב — `paymentContinueAmount`) | warn | הדיאלוג נשאר (פעולה נדרשת); Notice רק בגמח בלי הדיאלוג |
| מועמדים משניים (ללא ניווט, כיום `alert`) | `refunds/page.js:458,483`, `alterations/page.js:107,134`, `dashboard/pricelist`, `admin/settings/SettingsClient.js` שמירה, `admin/labels:105` | saved/info | להמיר ל-`enqueueNotice({persist:false})` או `toast` — לפי החלטה |

**כלל אצבע לסוכנים:** ניווט (`router.push/replace` או `location.href`) מיד אחרי פעולת כתיבה מוצלחת ← `enqueueNotice`. שגיאות ואישורי-מנהל נשארים `toast`/Dialog (לא נשמרים בפעמון).

## 5. ארכיטקטורה — קבצים חדשים (`app/v3/`)
* `notice/notice.js` — `enqueueNotice`, `readQueue`, `flushPending`, dedupe, `persistNote`.
* `notice/NoticeProvider.js` — טיימר, pause/resume, ערימה, `usePathname` לסנכרון.
* `ui/NoticeBar.js`, `ui/MessageCard.js`, `ui/ToastRegion.js` + CSS ב-`components.css` (`.v3-notice`, `.v3-notice__bar`).
* חיבור: `app/layout.js` בתוך `PopupProvider` (ליד `AppShell`), prop `persistToBell={!hideInternalMessaging}`.

## 6. שאלות פתוחות (לרשום ב-QUESTIONS.md)
* **Q-N1** — לאשר הוספת ענף `category:'activity_note'` ל-`POST /api/notifications` (בלי מייל, לעצמי, dedupe)? בלי זה — ספאם מיילים.
* **Q-N2** — הערות שמירה: `isRead=false` (נקודה אדומה) או שקטות?
* **Q-N3** — הודעה פנימית חדשה שהגיעה תוך כדי עבודה — להקפיץ MessageCard (חדש) או רק נקודה בפעמון (כמו היום)?
* **Q-N4** — האם `NoticeBar` מוצג גם בשמירה ללא ניווט (`handleSave`) — המלצה: כן, לאחידות, ולהסיר את `showSaveSuccessOverlay`.
