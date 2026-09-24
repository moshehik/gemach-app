# חוזה עמוד: /refunds (זיכויים וחובות)

מקור: `app/refunds/page.js` (934 שורות), `app/refunds/layout.js`. תלויות: `components/orders/modern/mocAuth.js` (verifyPin), `app/lib/pageCache.js`, `app/lib/prefetchRoutes.js` (REFUNDS_PAGE_SIZE=50, שורות 201-203, 252-255), `lib/hebrewDate.js`. רכיבים מקומיים בקובץ: `hebrewDateFor`, `fetchDebtOrdersPage`, `ApprovalCell`, `DebtsTable`. אין רכיבי modal משותפים חיצוניים; שני המודלים (אישור חוב, ייצוא) מוגדרים inline.

## א. תכלית והרשאות
- ניהול זיכויים (בקשות החזר כספי: סימון בוצע/ביטול/מחיקה, ייצוא לחשבונאות) ומעקב חובות פתוחים + אישור מנהל ליתרת חוב.
- גישה: `PageGate pageKey="page:refunds"` (layout.js:6; lib/permissionsMetadata.js:113, ברירת מחדל הנהלה ראשית/מתכנת).
- אישור/ביטול אישור חוב: `verifyPin(..., 'feature:debt_approval')` (`canApproveDebt` בשרת, permissionsMetadata.js:344).

## ב. אזורים לפי סדר
1. `.page-head` (610-622): h1 "זיכויים וחובות", `.page-desc` "ניהול זיכויים ומעקב חובות פתוחים"; `.page-actions`: כפתור ייצוא (רק בטאב 'refunds').
2. `.tabs` (624-637): "זיכויים" (#i-coin) / "חובות פתוחים" (#i-alert-circle) / "הזמנות מאושרות ללא תשלום מלא" (#i-shield). state `activeTab` ('refunds' ברירת מחדל).
3. טאב refunds (639-787): toolbar (חיפוש + pill-tabs סטטוס + spacer); טבלת זיכויים או loading; table-foot.
4. טאב debts (789-810): `DebtsTable` עם `accentColor=var(--danger)`.
5. טאב approved (812-839): `.callout.callout-warning` הסבר + `DebtsTable` עם `accentColor=var(--warning)`.
6. מודל אישור תשלום (841-878) ומודל ייצוא (880-931) - inline, בסוף העמוד.

## ג. שדות
| תווית | state | פורמט/ולידציה | שורה |
|---|---|---|---|
| חיפוש זיכויים "חיפוש לפי שם לקוח, טלפון, הזמנה או סכום..." | `searchTerm` | **סינון בצד לקוח** בלבד על `refunds` הטעונות: `includes` על customer.firstName / lastName / phone1 / orderId.toString() / amount.toString() (594-606) | 644-650 |
| pill סטטוס: הכל / ממתינים / בוצעו | `filterStatus` ('all'\|'pending'\|'executed') | מסנן `!isExecuted` / `isExecuted` בצד לקוח | 652-656 |
| חיפוש חובות "חיפוש חוב לפי שם לקוח, טלפון, או הזמנה..." | `debtsSearchTerm` | נשלח לשרת (ראו ה); דיבאונס 400ms (0 כשריק) | 799 |
| חיפוש מאושרות "חיפוש לפי שם לקוח, טלפון, או הזמנה..." | `approvedSearchTerm` | כנ"ל | 827 |
| checkbox "בחר הכל" בכותרת DebtsTable | `selectedIds` (Set) | כולל רק שורות שעדיין לא מאושרות (`selectableIds`); disabled כשאין; `allSelected` = כולם נבחרו | 100-108 |
| checkbox שורה (title "בחר הזמנה #N") | `selectedIds` | שורה מאושרת מציגה איקון #i-check-circle במקום checkbox | 136-145 |
| מודל ייצוא: "מתאריך" | `exportFromDate` | `type=date`, אופציונלי | 898 |
| "עד תאריך" | `exportToDate` | `type=date`, אופציונלי | 902 |
| "סטטוס" select | `exportStatus` ('all'\|'executed'\|'pending') | "הכל", "בוצע בלבד", "ממתין בלבד" | 906-910 |
- state נוסף: `isProcessing` (פעולות זיכוי), `isApproving` (פעולות חוב), `isExporting`, `confirmModal {open, orderIds, totalAmount}`, `approvalsByOrderId {orderId: {isApproved, approvedAt, approvedBy, approvedAmount}}`.
- איפוס `selectedIds` בכל החלפת לשונית (250).

## ד. כפתורים / פעולות
| כפתור | handler | פעולה |
|---|---|---|
| איקון הורדה (title "ייצוא זיכויים לאקסל (טווח תאריכים מלא)") | `setShowExportModal(true)` | רק כש-`activeTab==='refunds'` |
| לשוניות | `setActiveTab(...)` | טריגר לטעינת הטאב (useEffect) |
| pill-tabs סטטוס | `setFilterStatus` | |
| "סמן כבוצע" (איקון check-circle; רק ל-`!isExecuted`) | `executeRefund(id)` | `window.customConfirm('האם אתה בטוח שברצונך לסמן זיכוי זה כ"בוצע"?\nפעולה זו תיצור תשלום הפכי (מינוס) בכרטיס ההזמנה המקושר.')` -> PUT `{isExecuted:true}`; `alert('הזיכוי סומן כבוצע בהצלחה והתעדכן בכרטיס ההזמנה.')`; עדכון שורה מקומי `{...r, ...updatedRefund}` |
| "בטל ביצוע" (איקון refresh; רק ל-`isExecuted`) | `undoExecuteRefund(id)` | confirm "האם אתה בטוח שברצונך לבטל את אישור ביצוע הזיכוי?\nהפעולה תחזיר את הזיכוי לסטטוס ממתין ותמחק את תנועת ההחזר מכרטיס ההזמנה." -> PUT `{isExecuted:false}`; alert "ביצוע הזיכוי בוטל והתעדכן בכרטיס ההזמנה." |
| "בטל בקשה" (איקון x-circle, `btn-danger-ghost`) | `cancelRefund(id)` | confirm שונה אם `refund.isExecuted` ("זיכוי זה כבר בוצע ויש תשלום הפכי... להמשיך?") או "האם אתה בטוח שברצונך לבטל ולמחוק בקשת זיכוי זו לחלוטין?"; DELETE; מסיר מהרשימה; alert "בקשת הזיכוי בוטלה." |
- שלושת הכפתורים `disabled={isProcessing}`.

| כפתור | handler | פעולה |
|---|---|---|
| "טען זיכויים ישנים יותר" ("טוען..." בזמן) | `loadMoreRefunds` | מוצג כש-`refundsHasMore`; GET עמוד הבא ומצרף |
| "טען עוד" ב-DebtsTable | `onLoadMore` -> `loadDebts/loadApprovedDebts(page+1, term, {append:true})` | |
| "בטל אישור" (ב-ApprovalCell, אמבר, `disabled={isApproving}`) | `undoDebtApproval(orderId)` | confirm "לבטל את אישור יתרת החוב עבור הזמנה זו? ניתן יהיה לאשר שוב בכל עת." -> `verifyPin('ביטול אישור חוב דורש הרשאת מנהל. אנא בחר מנהל והזן סיסמה:', 'feature:debt_approval')` -> DELETE; רענון approvals |
| "ביטול בחירה" (ב-bulk-bar) | `clearSelection` | |
| "אשר תשלום שנבחרו (N)" | `onOpenApproveModal(list)` | מחשב `totalAmount = Σ max(0, totalAmount - totalPaid)` לשורות נבחרות; פותח confirmModal. `disabled={isApproving}` |
| מודל אישור: "ביטול" / "אשר תשלום" | `setConfirmModal(closed)` / `confirmApproveSelected` | ראו ו |
| מודל ייצוא: "ביטול" / "ייצא לאקסל" | `setShowExportModal(false)` / `runFullExport` | |
| קישורים | `Link /customers/{customerId}`, `Link /orders/{orderId}` (badge-info + #i-link) | ניווט; בטבלת זיכויים orderId עשוי להיות ריק ('-') |

## ה. קריאות רשת
| # | שיטה + URL | מפתחות | טריגר | שימוש | מטמון |
|---|---|---|---|---|---|
| 1 | GET `/api/refunds?page=1&limit=50` | | mount (`fetchRefunds`, 453-455) | `data.data`->refunds, `page=1`, `hasMore = 1<totalPages`; אם `data.data` לא מערך -> `[]`; שגיאה ל-console | SWR `refundsCache = cacheNamespace('refunds')` מפתח `'refunds'` (התשובה כולה); hit -> מציג מיד. prefetch: `routePrefetchers['/refunds']` (אותו URL); שכן: `/refunds`->`/orders` |
| 2 | GET `/api/refunds?page=N&limit=50` | | `loadMoreRefunds` | מצרף `data.data`; `hasMore = nextPage<totalPages` | לא נכתב למטמון |
| 3 | PUT `/api/refunds/{id}` | body `{isExecuted:true\|false}` | executeRefund / undoExecuteRefund | תשובה ממוזגת לשורה. execute: `!ok` -> `updatedRefund.error\|\|'Failed to execute refund'`; undo: 'Failed to undo refund execution' | לא מעדכן refundsCache (cache ישן עד mount הבא) |
| 4 | DELETE `/api/refunds/{id}` | | cancelRefund | מסיר מקומית; `!ok` -> 'Failed to cancel refund' | |
| 5 | GET `/api/refunds?export=true[&fromDate=][&toDate=][&status=executed\|pending]` | fromDate/toDate מסננים לפי createdAt; status רק אם != 'all' | runFullExport | `json.data` -> CSV והורדה; שגיאה `alert('שגיאה בייצוא: '+msg)` | ללא |
| 6 | GET `/api/orders?filterStatus=unpaid_all&page=N&limit=50[&customerPhone=X\|&search=X]` | מ-`fetchDebtOrdersPage`: trim; אם `/^\d{7,}$/` -> `customerPhone`, אחרת `search` | טאב debts: כניסה + שינוי `debtsSearchTerm` (setTimeout 400/0, cleanup); "טען עוד" | `data.data`, `hasMore = page < totalPages`; append/החלפה | **ללא מטמון** |
| 7 | GET `/api/orders?filterStatus=unpaid_approved&page&limit&(customerPhone\|search)` | כנ"ל | טאב approved | כנ"ל | ללא |
| 8 | GET `/api/audit?entityType=Order&entityIds=id1,id2,...&actions=DEBT_APPROVED,CANCEL_DEBT_APPROVAL&limit=500` | | אחרי כל טעינת חובות (`fetchApprovalsForOrders`) ואחרי אישור/ביטול | `data.logs` ממוין desc; הרשומה הראשונה לכל `entityId` קובעת: `DEBT_APPROVED` -> `{isApproved:true, approvedAt:createdAt, approvedBy:employeeId, approvedAmount: JSON.parse(changesJson).approvedDebtAmount}` אחרת `{isApproved:false}`; שגיאה ל-console | ללא (state ממוזג ב-`approvalsByOrderId`, משותף לשני הטאבים) |
| 9 | POST `/api/orders/{orderId}/debt-approval` | body `{employeeId: auth.employeeId}` | `confirmApproveSelected`, **סדרתי** לכל orderId | `!ok` -> throw `errData.error\|\|'שגיאה באישור הזמנה #N'` (עוצר לולאה; אישורים קודמים נשארים) | ללא |
| 10 | DELETE `/api/orders/{orderId}/debt-approval` | body `{employeeId}` | undoDebtApproval | `!ok` -> 'שגיאה בביטול אישור החוב' | ללא |
| 11 | POST `/api/auth/verify-pin` | `{pin, employeeId, requiredLevel}` | בתוך `verifyPin` (mocAuth.js:4-23) אחרי `window.customAuthPrompt(message, level)` | `data.success` אחרת `alert(data.error\|\|'סיסמה שגויה או הרשאה לא מספקת.')` | |
- אין כתיבת AuditLog ידנית בעמוד (השרת כותב).

## ו. חלוניות / אישורים
1. **`window.customAuthPrompt`** (דרך verifyPin): "אישור תשלום עבור החובות שנבחרו דורש הרשאת מנהל. אנא בחר מנהל והזן סיסמה:" (feature:debt_approval); "ביטול אישור חוב דורש הרשאת מנהל. אנא בחר מנהל והזן סיסמה:". מחזיר `{pin, employeeId}`; ביטול -> null -> הפעולה נעצרת בשקט.
2. **מודל אישור תשלום** (`confirmModal.open`, `.modal-backdrop` > `.modal.confirm-modal`): איקון shield בעיגול `--primary-tint`; h3 "אישור יתרת חוב לתשלום"; "מסמן N הזמנה/הזמנות בסך כולל של ₪{totalAmount.toLocaleString()} כמאושרות לתשלום ע״י מנהל."; פסקה קטנה על תיעוד בהיסטוריה, שאין תשלום בפועל ושניתן לבטל. כפתורים "ביטול" / "אשר תשלום" ("מאשר..." + spinner בזמן `isApproving`). backdrop-click סוגר רק אם `!isApproving`. **סדר:** לחיצה על "אשר תשלום" -> verifyPin -> לולאת POST -> `fetchApprovalsForOrders` -> איפוס בחירה וסגירה. שגיאה -> `alert(err.message\|\|'שגיאה באישור החובות.')` והמודל נשאר פתוח.
3. **מודל ייצוא**: איקון download; h3 `ייצוא זיכויים להנה"ח`; הסבר "הייצוא מביא את כל הזיכויים התואמים ישירות מהשרת ... ניתן להשאיר את שדות התאריך ריקים..."; `.form-grid` עם 3 שדות; "ביטול"/"ייצא לאקסל" ("מייצא..." בזמן). backdrop-click סוגר אם `!isExporting`. הצלחה -> סוגר.
4. `window.customConfirm` (3 בזיכויים + 1 בביטול אישור חוב) ו-`alert` לכל תוצאה - ראו ד'. אין טוסטים.

## ז. מצבים מיוחדים
- **loading:** `.page-loading` + `.spinner.lg` "טוען נתונים..." (מחליף את כל הטבלה, גם ב-DebtsTable). `loadingMore*` משנה טקסט כפתור בלבד.
- **ריק:** זיכויים: `.empty-state` #i-search "לא נמצאו זיכויים תואמים."; חובות: #i-alert-circle "לא נמצאו חובות תואמים."; מאושרות: "לא נמצאו הזמנות מאושרות עם יתרת חוב." (colSpan 9 / 8).
- **שגיאות:** נבלעות ל-console בטעינות; alert בפעולות כתיבה.
- **חיפוש:** בטאב זיכויים **מקומי** (רק על מה שנטען); בחובות/מאושרות **שרת**. טלפון = ספרות 7+ -> `customerPhone`.
- **תאריכים:** זיכויים - `toLocaleDateString('he-IL')` על `createdAt` (+ "בוצע: {executionDate}" אם `isExecuted`). חובות - `eventDate` he-IL או "ללא תאריך" + `hebrewDateFor(order)` (`eventDateHebrew` או `getHebrewDateString(eventDate)`, שורה קטנה).
- **חישוב חוב:** `debtAmount = (totalAmount||0) - (totalPaid||0)` בלקוח, בלי floor בתצוגה (floor רק בסכום המודל). סכומים `₪{value}` בלי עיצוב מספרים.
- **ApprovalCell:** לא מאושר -> "לא אושר" (cell-muted); מאושר -> badge-success "מאושר לתשלום" + כפתור "בטל אישור".
- **שורת זיכוי:** אימייל `refund.email` עם איקון #i-mail; בנק: `bankName (סניף bankBranch)` / `bankAccount` / `bankAccountName` או "לא הוזנו"; אשראי מקורי `paymentDetails` עם #i-card או '-'.
- **ארגונים:** אין הבדל בקוד בין הגמח"ים; נתונים והרשאות פר-DB.
- **הרשאה:** PageGate; אישור חוב תלוי ב-`feature:debt_approval`.

## ח. URL / storage
- אין query params, hash, localStorage או sessionStorage. מטמון זיכרון בלבד (`cacheNamespace('refunds')`, מפתח 'refunds').

## ט. הדפסה / ייצוא / AI
- **ייצוא CSV** (`runFullExport` -> `buildRefundsCSV` + `downloadCSV`): BOM, `Blob text/csv;charset=utf-8`, קובץ `refunds_export_{YYYY-MM-DD}.csv` (UTC). 14 עמודות לפי הסדר: תאריך בקשה, לקוח, טלפון, מייל, מספר הזמנה, סכום לזיכוי, סיבה, בנק, סניף, חשבון, שם בעל החשבון, פרטי אשראי מקורי, סטטוס ("בוצע"/"ממתין"), תאריך ביצוע. לקוח = `firstName lastName` trim; טלפון = `customer.phone1`; מייל = `r.email || customer.email`. הכפתור "ייצא לאקסל" אך הפלט CSV. ערכים עטופים ב-`"` ללא escape של `"` פנימי (התנהגות קיימת, לא לתקן).
- אין AI ואין הדפסה בעמוד.

## י. מלל
"זיכויים וחובות", "ניהול זיכויים ומעקב חובות פתוחים", "זיכויים", "חובות פתוחים", "הזמנות מאושרות ללא תשלום מלא", callout: "הזמנות שכבר יצאו בפועל (לפחות פריט אחד נמסר ללקוח) ועדיין נותרת בהן יתרת חוב פתוחה - להבדיל מטאב "חובות פתוחים" שמציג גם הזמנות עתידיות שטרם יצאו.", "הכל / ממתינים / בוצעו". עמודות זיכויים: תאריך, לקוח, הזמנה, סכום, סיבה, פרטי בנק, אשראי מקורי, סטטוס, (פעולות). עמודות חובות: (checkbox), תאריך אירוע, לקוח, הזמנה, סה"כ להזמנה, שולם, יתרת חוב, סטטוס אישור. תאים: "לקוח לא ידוע", "בנק חסר", "חשבון חסר", "(סניף X)", "לא הוזנו", "בוצע"/"ממתין לביצוע", "בוצע: תאריך", "ללא תאריך", "לא אושר", "מאושר לתשלום", "בטל אישור". bulk: "N הזמנה נבחרה"/"הזמנות נבחרו", "ביטול בחירה", "אשר תשלום שנבחרו (N)". foot: "סה"כ שורות מוצגות: N", "טען עוד", "טען זיכויים ישנים יותר", "טוען...". שאר ההודעות ב-ד'/ו'.

## יא. Risk notes
1. `DebtsTable` משותפת לשני טאבים עם ~20 props (רשימה, callbacks, `accentColor`, טקסטים). שינוי חתימה שובר את שניהם. `approvalsByOrderId` ו-`selectedIds` משותפים (selectedIds מתאפס בהחלפת טאב).
2. הטעינה ב-useEffect `[activeTab, debtsSearchTerm]` / `[activeTab, approvedSearchTerm]` עם `setTimeout` + cleanup; אם הטאבים יהפכו לנתיבים/רכיבים נפרדים - טעינה מחדש בכל כניסה חייבת להישמר (אין מטמון לחובות).
3. סדר אישור: verifyPin אחרי פתיחת המודל ולפני הלולאה; לולאה סדרתית עם עצירה בשגיאה. אל תחליף ב-Promise.all ואל תסיר `isApproving`.
4. `undoDebtApproval` = customConfirm ואז verifyPin (שני אישורים) - שמור על שניהם.
5. `selectableIds` מוציא שורות מאושרות; "בחר הכל" תלוי ב-`allSelected`. איקון V מחליף את ה-checkbox בשורה מאושרת.
6. חיפוש זיכויים בלקוח מול חיפוש חובות בשרת - לא לאחד; ה-regex `^\d{7,}$` קובע customerPhone.
7. cache של refunds נכתב רק ב-fetch הראשון; PUT/DELETE/load-more לא מעדכנים אותו (קיים; לא "לתקן" בלי החלטה).
8. `isProcessing` גלובלי - כל כפתורי הזיכוי disabled יחד.
9. `entityId` ב-audit מחרוזת (`String(orderId)`) ואילו מפתחות `approvalsByOrderId` הם orderId מקורי; `changesJson` מפוענח ב-try/catch ריק.
10. צבעים inline (`var(--danger)`/`--warning` כ-accentColor, `--primary-tint` בעיגול המודל) - בעיצוב חדש להעביר ל-tokens ולשמור על ההבחנה בין הטאבים (אדום מול כתום).
11. תאריכים ב-`toLocaleDateString('he-IL')` (אזור הדפדפן) - לא לשנות בלי החלטה (R8).
12. כפתור הייצוא מוצג בכותרת רק בטאב refunds; המודל מותנה רק ב-`showExportModal`.
