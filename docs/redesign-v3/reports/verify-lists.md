# אימות התאמה — משפחת lists (`/orders`, `/rentals`, `/refunds` + `components/lists/listKit.js`)

ענף: `origin/redesign/site-v3-pages-lists` מול `origin/main`. ביקורת קריאה בלבד לפי `VERIFY-METHOD.md`.
חוזים: `contracts/orders-list.md`, `rentals.md`, `refunds.md`. מספרי שורות בדו"ח הם של הקובץ בענף החדש (בקירוב ±5).

## פסק דין: ⚠️ תואם עם הערות (אין פערים חוסמים)

הלוגיקה (state, effects, handlers, fetch, מפתחות מטמון, ייצוא, הדפסה, הרשאות, הגדרות) זהה אחרי נרמול רווחים. כל ההבדלים הם JSX / מלל / עיצוב + החלפת `alert` / `window.customConfirm` / `customPrompt` בחלוניות v3 עם אותו זרם await.

## ראיות (סקריפטים)

חולצה הלוגיקה (כל מה שלפני ה-`return (` הראשי של הקומפוננטה) והורצה `diff -w` ישן מול חדש:

| קובץ | מה שונה בלוגיקה | מה **לא** שונה |
|---|---|---|
| `app/orders/page.js` | imports; `getStatusBadgeClass→getStatusChip`, `getPaymentBadgeClass→getPaymentChip`, `ROW_TONES` חדש; `PendingTimer` (Chip); `useListDialogs()` + state תצוגה `expandedRows`; `alert→v3Alert`, `customConfirm→v3Confirm`, `customPrompt/prompt→v3Prompt`; `statusTabs`, `handleStatusTab`, `sortHeader`, `ariaSort`; `renderSortIcon` | כל `fetch`/URL, `buildOrdersUrl`, `fetchOrders`, `fetchOrdersForExport`, `getCurrentFilteredOrderIds`, `sortPendingFirst`, `handleShowAll`, `handleSearch`, `handleSort`, כל מערכי התלות של useEffect/useCallback |
| `app/rentals/page.js` | imports (הוסרו `createPortal`, `getStatusColor`); `getStatusChip`, `STATUS_TONES`, `SPACING_TONE`; `useListDialogs`; `alert→v3Alert`; `customConfirm→v3Confirm` (בקוד ההחזרה המהירה); `sortHeader/ariaSort` | `buildRentalsListParams`, `rentalsCache`, hash `#rented/#returned`, `?orderId=`, debounce, `fetchOrders(page)`, `switchTabGroup`, `matchesRentalsViewMode` |
| `app/refunds/page.js` | imports; `ApprovalCell`/`DebtsTable` (JSX + state תצוגה `expanded`); `useListDialogs`, `expandedRefunds`; 8 `alert→v3Alert`, 5 `customConfirm→v3Confirm`; `closeApproveModal` (אותו גוף `setConfirmModal({open:false,orderIds:[],totalAmount:0})`) | כל ה-loaders והפאג'ינציה, `verifyPin`, `runFullExport`, `filteredRefunds`, `executeRefund/undo/cancel`, `confirmApproveSelected` |

- `@babel/parser`: 4 קבצים ✅ (JSX תקין).
- `@babel/traverse` (זיהוי identifiers לא מוגדרים + imports לא בשימוש): `UNDEF: []`, `UNUSED IMPORTS: []` בכל 4 הקבצים (כולל `Fragment`, `Seg`, `Switch`, `IconAction`).
- `eslint` (`no-undef`, `react/jsx-no-undef` כשגיאות): 0 errors. אזהרות בלבד על קוד מת שקיים גם בישן (`setSelectedOrder`, `handleQuickReturn`/`quickStatus`/`isProcessing`/`STATUS_DOT_COLORS`, `e` ב-refunds).
- כל מחלקות `v3-*` בשימוש קיימות ב-`components.css`/`tokens.css`; כל טוקני `--v3-*` בשימוש מוגדרים ב-`tokens.css`.
- `id`: `ordersListPageNum`, `rentalsListPageNum`, `orders-adv-ai-mode`, `rentals-adv-ai-mode` נשמרו (ה-`id` של ה-AI עובר דרך `Switch` אל ה-`input` ב-`...rest`). אין `alert(`, `window.confirm`, `window.prompt`, `customConfirm`, `customPrompt` שנותרו בשלושת העמודים.
- אין `localStorage`/`sessionStorage`/`querySelector` שהוסרו (נבדק: אותם שימושים כמו בישן; הטיוטות ב-`listOrderDrafts()` ללא שינוי).

## טבלת חוזה — /orders

| פריט בחוזה | קיים בחדש? | זהה? |
|---|---|---|
| מפתח מטמון = URL של `buildOrdersListParams` (סדר פרמטרים, `limit=50`), `readCache`/`fetchSharedJson`/`subscribe`, prefetch עמוד+1 | בלוגיקה ללא diff (`buildOrdersUrl`/`fetchOrders`) | ✅ URL זהה תו-בתו |
| ניווט שורה `router.push('/orders/'+orderId)` | `<tr onClick={() => router.push(...)}>` | ✅ |
| קישור "כרטיס הזמנה" + `stopPropagation` | `Link` בעמודת פעולות | ✅ |
| "מעבר להשכרה/החזרה" `setRentalModalOrderId` + `stopPropagation` | כפתור בעמודת פעולות | ✅ |
| מחיקה `handleDeleteOrder(order,e)` (חסימות, ת"ז, `DELETE` + `x-zeout`) | גוף זהה, רק חלוניות | ✅ |
| ⓘ popover (`getBoundingClientRect`, `left` פיזי, `translate(-50%,-100%)`, פורטל) | קיים; נוסף `onFocus/onBlur` (שיפור מקלדת) | ✅ |
| כותרות ממיינות ×6 (`orderId`,`customerName`,`eventDate`,`totalAmount`,`totalPaid`,`status`) | `sortHeader` ×6 + `handleSort` זהה | ✅ |
| טאבי סטטוס, `handleShowAll` מנקה הכל, טאבים מותנים (`drafts`, `not_taken`) | `statusTabs` שומר את אותם תנאים; `all` → `handleShowAll` | ✅ |
| חיפוש (`handleSearch`/`handleClearSearch`), שאלות סטטיסטיקה `{x,y}` | קיימים | ✅ |
| מודאל מתקדם: שדות 1-11, pills ×3 + בחר הכל, `HebrewDateRangePicker`, `OrderModelSelector`, `advAiMode` | כולם מקושרים ל-`advFilters`/`advAiMode` | ✅ |
| "נקה הכל" מרוקן גם `eventDateFrom` (לא ברירת מחדל) | כן | ✅ |
| "החל סינון": AI → `buildOrdersAiPrompt` → `handleAiSearch` | כן | ✅ |
| עימוד `#ordersListPageNum` (1..totalPages, disabled ב-AI) | כן | ✅ |
| ייצוא: `ExportButtons` ×11 עמודות, `onFetchData=fetchOrdersForExport`, `iconOnly`, filename | זהה לחוזה | ✅ |
| `PrintWizardModal` (props, `getCurrentOrderIds`), `CapacitySearchModal`, `StatisticsModal` (`contextQuery`, `position`) | קיימים | ✅ |
| `RentalReturnModal onUpdate={fetchOrders}` (בלי עטיפת arrow — סיכון 2 בחוזה) | `onUpdate={fetchOrders}` | ✅ |
| תג "לא נשמר" + tooltip, `PendingTimer`, עדיפות צביעה selected>draft>spacing>pending>unpaid | `ROW_TONES` + אותם תנאים | ✅ |
| **עמודות שהועברו לשורה מורחבת — אפס אובדן נתונים** | עמודות: קוד+לקוח / דגם / תאריך / סכום+שולם / סטטוס+תשלום / פעולות. "כמות פריטים" (`itemsCount`) → שורה מורחבת. סכום ושולם גם בשורה וגם במורחבת | ✅ |

## טבלת חוזה — /rentals

| פריט | קיים? | זהה? |
|---|---|---|
| h1 דינמי, סה"כ, `RentedPastEventWidget` רק ב-`rentals` | כן | ✅ |
| חיפוש רגיל/AI (2 מצבים), ניקוי, `toggleAiInputMode`, `handleAiInputSubmit` | כן | ✅ |
| `Tabs` → `switchTabGroup`; `Seg` ל-`viewMode` (4 ערכים) | כן | ✅ |
| כותרות ממיינות ×4 (+ `aria-sort` ל-`eventDateSmart`) | כן | ✅ |
| `tr onClick=openOrder`; כפתור box ו"פירוט" עם `stopPropagation` | כן | ✅ |
| **הערות (`ord.notes`)** — עמודה נפרדת הוסרה; מוצגת בשורה מורחבת "הערות להזמנה" | כן | ✅ נתון נשמר (הערה 2) |
| פריטים מורחבים: תיאור, ברקוד, סטטוס הוחזר/בחוץ/עוד לא נלקח, "אין פריטים פעילים" | כן | ✅ |
| צביעת שורה (`spacing` > סטטוס מארבעה, נגזר מ-`calculateOrderStatus`) | `SPACING_TONE`/`STATUS_TONES` | ✅ |
| עימוד `#rentalsListPageNum` + `goToPage` | כן | ✅ |
| מודאל מתקדם ×6 שדות + AI + "נקה" `defaultRentalsAdvFilters()` | כן | ✅ |
| `RentalReturnModal onUpdate={() => fetchOrders(page)}`; `StatisticsModal pageContext="rentals"` | כן | ✅ |
| `ExportButtons` (data ממופה, 5 עמודות, filename "השכרות") | כן | ✅ |
| קוד מת `handleQuickReturn` — נשמר; בדיקת האיחור זהה, `v3Confirm` true=פתיחת כרטיס | כן | ✅ |

## טבלת חוזה — /refunds

| פריט | קיים? | זהה? |
|---|---|---|
| 3 טאבים (`activeTab`), ייצוא רק ב-`refunds` | כן | ✅ (תווית טאב 3 שונתה) |
| חיפוש בצד לקוח + `Seg` הכל/ממתינים/בוצעו | כן | ✅ |
| שורת זיכוי: תאריך, "בוצע ב", לקוח+טלפון+קישור, קישור הזמנה, סכום, סטטוס, 3 כפתורי פעולה (`disabled={isProcessing}`) | כן | ✅ |
| סיבה / פרטי בנק / אשראי מקורי / אימייל → שורה מורחבת עם אותם תנאי הצגה ("לא הוזנו", "שם הבנק חסר", "מספר חשבון חסר", אימייל רק אם קיים) | כן | ✅ אפס אובדן |
| `DebtsTable`: תאריך, לקוח, הזמנה, יתרת חוב, `ApprovalCell`, בחירה מרובה + בחר הכל; סה"כ להזמנה ושולם → שורה מורחבת | כן | ✅ |
| bulk-bar (ביטול בחירה / אישור תשלום → `onOpenApproveModal(list)`), "טען עוד" | כן | ✅ |
| מודאל אישור: `confirmApproveSelected`, נעילה ב-`isApproving` (scrim + Esc) | `Dialog` `closeOnScrim={!isApproving}` + guard ב-`onClose` | ✅ |
| מודאל ייצוא: 3 שדות מקושרים ל-`exportFromDate/ToDate/Status`, ערכי option זהים, `runFullExport`, נעילה ב-`isExporting` | כן | ✅ |
| `verifyPin('feature:debt_approval')`, `undoDebtApproval`, `executeRefund/undo/cancel` | ללא diff מלבד חלוניות | ✅ |

## פערים חוסמים

אין.

## חלוניות ואישורים (בדיקה 5)

`useListDialogs` ב-`listKit.js`: `confirm` מחזיר `Promise<boolean>` (ביטול / Esc / scrim = `false`), `notify` מחזיר `Promise<void>`, `prompt` מחזיר `Promise<string|null>` (`null` = ביטול, `''` = אישור ריק, Enter = אישור) — תואם ההבחנה שהחוזה דורש (orders §k.15). ענפי ביטול נשמרו: מחיקת הזמנה (`if (await v3Confirm(...))`; ת"ז ריקה → הודעה ויציאה), החזרה באיחור (`true` = פתיחת כרטיס, `false` = ממשיך להחזיר; תווית "להחזיר בכל זאת" תואמת), 5 ה-confirm ב-refunds (`if (!(await ...)) return`). `open()` על חלונית קיימת פותר את הקודמת בערך הביטול — אין Promise תקוע.

## הערות לא חוסמות

1. **/orders**: סכום ושולם מוצגים כפולים (בשורה ובמורחבת) — כפילות, לא אובדן.
2. **/rentals**: הערות ההזמנה כבר לא נראות בשורה סגורה, רק בפירוט — שינוי בגילוי בלבד.
3. **`alert` הפסיק לחסום**: `v3Alert` שאינו ב-`await` (שגיאות רשת, "הזיכוי סומן בהצלחה" וכו') לא עוצר קוד שאחריו כמו `alert()` הישן. לא נמצא קוד תלוי-סדר אחרי ההודעות, אך זה שינוי התנהגות עקרוני. במחיקת הזמנה ענפי החסימה כן ממתינים.
4. **Esc סוגר חלוניות עכשיו** (בישן לא נסגרו ב-Esc, orders §f.1). `Dialog` מאזין ב-capture ועושה `stopPropagation`, ולכן Esc בזמן שה-`HebrewDateRangePicker` (פורטל נפרד) פתוח בתוך "סינון מתקדם" עלול לסגור את חלונית הסינון לפני/במקום הפיקר. לבדוק בדפדפן.
5. מלל שונה בלבד: טאבים ("מחוק→מחוקות", "ארכיון/עבר→ארכיון", "לא-נלקחו→לא נלקחו"), טאב refunds 3, כותרות עמודות, תוויות option בייצוא. מפתחות וערכים הנשלחים לקוד/API לא שונו (`soon/archive/deleted/unpaid/drafts/not_taken/all`, `all/executed/pending`). הסברי טאבים ו-callout של טאב "approved" עברו ל-`Tip` (גלוי רק בריחוף/מיקוד).
6. `ROW_TONES.selected` נשאר קוד מת (כמו בישן).
7. RTL: פס הצד עבר ל-`borderInlineStart` (ימין ב-RTL) — לאמת ב-`getBoundingClientRect` (R17). `left` פיזי נשאר רק ב-popover של ⓘ (בכוונה). ספרות עטופות ב-`<bdi>`. אין hex קשיח ואין אייקון מחוץ ל-`<Icon>`.
8. `Tip` על `Chip` (טיוטה) נשען על `ref` כ-prop (React 19.2 / Next 16.2 — נתמך), לא נבדק בריצה.

## לא ניתן לבדוק סטטית (דורש דפדפן)

- רינדור אמיתי ו-RTL של הטבלאות (סדר עמודות, פס הצד, cluster בעמודה 1), מיקום popover של ⓘ, `Tip` על Chip.
- Focus trap / Esc של `Dialog` מול פורטלים פנימיים (`HebrewDateRangePicker`, dropdown של `OrderModelSelector`).
- התאמת מפתח המטמון בטעינה ראשונה מול prefetch בפועל (ה-URL לא שונה, לא הורצה בקשה).
- מובייל (`Dialog` כ-sheet) וניווט מקלדת בשורות הלחיצות (`tr onClick` בלבד, כמו בישן).
