# Customer card (`/customers/[id]`): functional inventory (production `main`, /home/user/wt-main)

Scope: `app/customers/[id]/page.js` and everything it reaches. All paths are relative to `/home/user/wt-main`.
Citation form: `file:line`. Abbreviations: P = `app/customers/[id]/page.js`, CARD = `components/customers/modern/ModernCustomerCard.js`,
DET = `.../ModernCustomerDetailsTab.js`, ORD = `.../ModernCustomerOrdersTab.js`, PAY = `.../ModernCustomerPaymentsTab.js`,
REF = `.../ModernCustomerRefundsTab.js`, HIS = `.../ModernCustomerHistoryTab.js`, MAIL = `.../ModernSendEmailModal.js`,
API-C = `app/api/customers/[id]/route.js`, API-CS = `app/api/customers/route.js`, API-R = `app/api/refunds/route.js`,
API-A = `app/api/audit/route.js`, API-M = `app/api/send-email/route.js`, API-V = `app/api/auth/verify-pin/route.js`.

The page has two modes. **Existing customer** (`id` = UUID) renders the tabbed card. **`id === 'new'`** renders a plain creation form with no tabs (P:98-101, P:252-347).

---

## 0. Page shell, routing and data loading

- **I-01** Client component (`'use client'`, P:1). Route param `id` is unwrapped with React `use(params)` (P:20).
- **I-02** The URL `id` is the customer **UUID** (`Customer.id`), not `legacyId`. Every entry point links by UUID: the list at `app/customers/page.js:372`, `app/board/page.js:1089`, `app/components/TopbarSearch.js:100`, `app/page.js:587`, and `app/orders/new/page.js:1710,1722,1767`. The list's "new" button pushes `/customers/new` (`app/customers/page.js:275`).
- **I-03** Initial load for an existing customer is a parallel `Promise.all` of `GET /api/customers/${id}` and `GET /api/refunds?customerId=${id}`. Both use plain `fetch`, not the shared cache (P:105-108).
- **I-04** If the customer response has `.error`, the page calls `router.push('/customers')` with no message (P:110-111). This covers 401, 404 and 500, because each returns an `{error}` JSON body (API-C:9,40,48).
- **I-05** On success it sets both `customer` and `originalCustomer` to the response (P:113-114). It then calls `addHistory({type:'customer', id, name:'לקוח: <first last>' (skipping null or "null" strings), subtext: phone1||''})` (P:115-120). This is the recent-items list in localStorage `agy_history`: duplicates are removed by type+id, max 7 items, and it fires window event `agy_history_updated` (`lib/historyManager.js:10-27`). It is **not** the audit history.
- **I-06** Refunds are stored only if the response is an array (P:122). An error object is silently ignored and refunds stay `[]`.
- **I-07** Network failure: `console.error` and `loading=false` (P:125-128). Customer stays `null`, so the page renders **nothing** (`return null`, P:249). There is no error message.
- **I-08** Mount-time side fetches go through the shared SWR cache (`lib/apiCache.js:120-131`) with `TTL.STATIC` = 5 min (`lib/apiCache.js:54`):
  - `/api/me` sets `isHeadManagement = roleId===0 || roleId===2` (P:40-46).
  - `/api/settings` becomes a key→value map in `settings` (P:48-54).
  - Errors from either are swallowed.
- **I-09** Loading state: `<div className="page-loading"><span className="spinner lg"/>טוען נתונים...</div>` (P:241-247).
- **I-10** For `id==='new'` the initial customer is `{firstName,lastName,phone1,phone2,email,city,street,houseNum,notes}`, all `''`, with no fetch (P:98-101). `originalCustomer` stays `null` (see I-111).
- **I-11** Tabs are always mounted. An inactive `tab-panel` is hidden by CSS only, so each tab keeps its internal state (CARD:16-18, CARD:112-116). The History tab therefore fetches on page load, not on first click (HIS:44-67).
- **I-12** Cache invalidation: a successful non-GET to `/api/customers*` invalidates the cached `/api/customers` and `/api/orders` prefixes (`lib/apiCache.js:168`, interceptor at `lib/apiCache.js:210-233`). The card's own main data is not cached (I-03), so this has no effect on the card itself. `/api/send-email` and `/api/auth/` are in the skip list (`lib/apiCache.js:181,186`). A window focus event revalidates subscribed cache keys older than 60 s (`lib/apiCache.js:235-242`). The card uses no subscriptions, so the main data is never auto-refreshed.

## 1. Header / summary card (CARD)

- **I-13** Avatar with initials: `firstName[0] + lastName[0]`, or `'?'` (CARD:35, CARD:41).
- **I-14** H1 customer name: `[firstName,lastName]` with falsy and literal `"null"` (any case) values removed, joined by a space. Fallback `'לקוח ללא שם'` (CARD:26-28, CARD:43).
- **I-15** Description line: `לקוח #{customer.legacyId || customer.id} · {ordersCount} הזמנות` (CARD:45).
  - If `legacyId` is null, the **UUID is shown**, which breaks the ID display rule.
  - `ordersCount = (customer.orders||[]).length` (CARD:24). It counts **all** orders, including soft-deleted ones and drafts (see I-122).
- **I-16** Appended only when `updatedAt` exists: `· עודכן לאחרונה: {getHebrewDateString(updatedAt)} · {HH:MM he-IL}` (CARD:31-33, CARD:46). The Hebrew date format is `"<day> <month> <year>"` (`lib/hebrewDate.js:43-54`). No Gregorian date is shown here.
- **I-17** Contact row, where each part appears only if it has a value:
  - `phone1` with icon `i-phone`, LTR (CARD:49-53).
  - `email` with icon `i-mail`, LTR (CARD:54-58).
  - address with icon `i-pin`. Address = `"<street> <houseNum>"` trimmed (only if `street` is set), then `, city` (CARD:29, CARD:59-63). `houseNum` without `street` is not shown.
  - `phone2`, `zeout`, `isBlocked`, balance and `marketingConsent` are **not** shown in the header.
- **I-18** Header action buttons, in DOM order (CARD:67-90):
  - "שמירת שינויים" (primary). Shows a spinner while saving and is disabled while saving (CARD:68-73). It calls `handleSave` (see I-51).
  - "ביטול שינויים" (secondary). Disabled when `!hasUnsavedChanges || saving`. Title switches between `'ביטול שינויים שלא נשמרו'` and `'אין שינויים לביטול'` (CARD:74-79). See I-58.
  - "שליחת מייל" (secondary) (CARD:80-85). See I-62.
  - "חזור" (ghost) calls `router.back()` (CARD:86-89, P:355). There is **no** unsaved-changes check.
- **I-19** Tab bar, in order (CARD:6-12, CARD:93-110):
  - `details` "פרטים אישיים" (`i-id`)
  - `orders` "הזמנות" (`i-bag`), with a neutral badge showing `ordersCount` (CARD:107)
  - `payments` "תשלומים" (`i-card`)
  - `refunds` "זיכויים ופרטי בנק" (`i-refresh`)
  - `history` "היסטוריה" (`i-history`)

  The default tab is `details` (P:25). The active tab lives in React state only: it is not in the URL and is not persisted.
- **I-20** Not present anywhere on the card: a delete-customer action, a "new order for this customer" button, a block action (only unblock exists), a balance KPI in the header, a print action, or a link to the customer's `/refunds` page.

## 2. Tabs

### 2a. Details tab (DET)
- **I-21** Blocked banner. It renders when `customer.isBlocked` is true (DET:102-117):
  - A `callout-danger` with the `i-alert-tri` icon, the text "לקוח חסום מהזמנות חדשות", and ` — {blockedReason}` if one is set.
  - A "ביטול חסימה" button, shown only when `isHeadManagement` is true (DET:111-115). See I-60.
- **I-22** "Personal details" card title (DET:119-132):
  - Icon `i-id`.
  - Heading: the customer name (DET:97, which filters falsy values only, **not** the literal `"null"`, unlike CARD) or `'לקוח ללא שם'`. While editing it reads "עריכת פרטים אישיים".
  - Icon button on the end: `i-edit` (title 'עריכת פרטים אישיים') when not editing, `i-check` (title 'סגור עריכה') when editing.
- **I-23** Read-only summary line (not editing) (DET:134-138): `[phone1, phone2, email, address].filter(Boolean).join(' · ')`. When empty it shows `'אין פרטי קשר או כתובת'`. The same text is in the `title` tooltip. `zeout`, `marketingConsent` and bank details are not shown read-only.
- **I-24** Edit form (`isEditing`), with fields in order (DET:140-238):
  - `firstName`: "שם פרטי *", `required` (HTML5) (DET:143-146)
  - `lastName`: "שם משפחה *", `required` (DET:147-150)
  - `phone1`: "טלפון *", `required`, LTR, phone icon (DET:151-157)
  - `phone2`: "טלפון נוסף", LTR (DET:158-164)
  - `email`: 'דוא"ל', `type=email`, LTR, `onBlur` normalization (see I-72) (DET:165-195). Next to it:
    - "העתק כתובת מייל" button: `navigator.clipboard.writeText(customer.email)`, with no toast (P:369, DET:176-178).
    - "שלח מייל" button: the same flow as the header (P:370, DET:179-181).
    - Both appear only when email is non-empty (DET:174).
    - "השלם ל- @gmail.com" button, shown when email is empty or has no `@` (DET:185-194). It sets email to `"<current>@gmail.com"`.
  - `city`: text input with datalist `modern-cust-city-list` (DET:196-202)
  - `street`: text input with datalist `modern-cust-street-list` (DET:203-209)
  - `houseNum`: "מספר בית", `type=number` (DET:210-213)
  - `zeout`: "תעודת זהות (לעריכה/ביטול)", LTR, placeholder "ת״ז" (DET:214-217)
  - `marketingConsent` checkbox "מאשר/ת קבלת דיוורים", hidden when `hide_marketing_consent_field==='true'` (DET:218-223)
  - `notes` textarea "הערות", 4 rows (DET:226-229)
  - Full-width submit "שמירת שינויים" at the bottom, with a spinner and disabled while saving (DET:234-237)
- **I-25** Fields that exist on the model but are **not editable anywhere on the card**:
  - `officeNotes`, `registrationDate`, `emailSuffix`, `isDeleted`
  - `hokBankName`, `hokBankBranch`, `hokBankAccount`, `hokConsent`
  - `isBlocked` / `blockedReason` (can only be cleared, see I-60)
  - `legacyId`
- **I-26** Location suggestions: `GET /api/customers/locations` via the shared cache with `TTL.REFERENCE` = 2 min (DET:50-54, `lib/apiCache.js:55`). The server returns distinct, trimmed, non-empty `city` and `street` values from non-deleted customers, sorted with Hebrew collation (`app/api/customers/locations/route.js:6-19`). City and street suggestions are independent (no city→street filtering). `autoComplete="new-password"` suppresses browser autofill (DET:198,205).
- **I-27** Notes card, shown when not editing and `notes` is non-empty (DET:242-250). The title is "הערות הלקוח" with icon `i-file`. Each line of `notes` renders separately (DET:7-43):
  - Lines matching `/\[(d.m.yyyy)\] אוטומטי: שמלה (\d+) \(הזמנה (\d+)\) (.*)/` render as an "auto-note" chip containing:
    - the Hebrew date converted from d.m.yyyy
    - "אוטומטי:"
    - "דגם {barcode[0..3]} מידה {barcode[3..5]}"
    - the rest of the text
    - a link icon to `/orders/{orderId}` (numeric orderId) (DET:12-38)
  - Other lines render as plain text (DET:41).
- **I-28** Edit-mode transitions:
  - The pencil opens edit mode (DET:83-88).
  - The check button **saves**. It runs the same `handleSave` and closes edit mode only if save returns `true` (DET:71-90).
  - Submitting the form does the same (DET:92-95).
  - The header "ביטול שינויים" closes edit mode through the `cancelSignal` counter (DET:56-65, P:236). The first signal on mount is ignored (DET:48, DET:60-63).
- **I-29** The header "שמירת שינויים" also works when the details form is closed or another tab is active. It saves the whole customer object (P:357).

### 2b. Orders tab (ORD)
- **I-30** Toolbar: title "הזמנות הלקוח" and a count `{orders.length} הזמנות` (ORD:57-61).
- **I-31** Data source: `customer.orders` from GET /api/customers/[id] (P:378). The server returns **all** the customer's orders, including `isDeleted` ones and drafts, each with `items` (+`dressItem`), non-deleted `payments` and non-deleted `obligations` (API-C:17-37). There is no pagination or limit.
- **I-32** Sorting, client side, descending by the "event sort date" (ORD:48-53):
  - If `isWeekdayEvent || isAbroad`: `fromDate || eventDate || orderDate || createdAt`.
  - Otherwise: `eventDate || orderDate || createdAt`.
  - `Order` has no `createdAt` column in the schema (`prisma/schema.prisma:290-353`), so that fallback is always undefined, which becomes 0.
  - The server's `orderBy: {id:'desc'}` is by UUID, which is meaningless (API-C:21).
- **I-33** There is no search, filter or column-sort UI.
- **I-34** Columns (ORD:68-75, cells ORD:87-111):
  1. "קוד הזמנה": numeric `orderId` as a `Link` to `/orders/{orderId}`. The whole row is also clickable and does `router.push('/orders/{orderId}')` (ORD:87-91).
  2. "תאריך אירוע/השכרה":
     - If `isWeekdayEvent`: two lines, "לקיחה: {fromDate he-IL}" and "החזרה: {(toDate||returnDate) he-IL}", with '-' fallbacks (ORD:94-98).
     - Otherwise: `eventDateHebrew` or `eventDate` (he-IL) or `orderDate` (he-IL) or '-' (ORD:100).
     - `isAbroad` orders are **not** given the from/to layout (only `isWeekdayEvent` is).
  3. "סטטוס פריטים": badge from `calculateOrderStatus(order)` (ORD:83, ORD:104). The value is one of `מחוק / הוחזר / הוחזר חלקי / הושכר / הושכר חלקי / טיוטה / עבר / בקרוב` (`lib/orderStatus.js:3-55`). Badge classes: success for הוחזר*, info for הושכר*, warning for בקרוב, neutral otherwise (ORD:10-29). The `draftsAsDeleted` option is **not** passed, so drafts show as "טיוטה" regardless of the `draft_orders_show_as_deleted` setting.
  4. "סכום לחיוב": `₪` + calculatedTotalAmount (ORD:79-81, ORD:106). See I-95.
  5. "שולם": `₪` + totalPaid (ORD:82, ORD:107). Green if paid ≥ total and total > 0, red if paid < total, default colour otherwise.
  6. "סטטוס תשלום": badge from `calculatePaymentStatus(total, paid)`, one of `ממתין לזיכוי / שולם / שולם חלקי / לא שולם` (`lib/orderStatus.js:84-90`). Classes: success, warning, info, danger (ORD:31-43, ORD:109).
- **I-35** Amounts are not formatted with thousand separators, unlike the Payments tab KPIs (ORD:106-107).
- **I-36** Footer: `סה"כ הזמנות מוצגות: {n}` (ORD:117-119).
- **I-37** Empty state: icon `i-bag` and "אין הזמנות ללקוח זה." (ORD:121-125). No loading or error state (the data comes from the parent).

### 2c. Payments tab (PAY)
- **I-38** Input `payments = allPayments`, built in P:90-95 by merging:
  - every `order.payments` row across all of the customer's orders, tagged `{orderId: order.orderId, entryType:'payment'}`
  - every Refund row, tagged `{entryType:'refund', paymentDate: r.createdAt, paymentMethod:'זיכוי'}`

  The list is sorted descending by `paymentDate || createdAt`. Payments linked to the customer only through `Payment.customerId` with no order are **not** included.
- **I-39** KPI cards (PAY:28-58):
  - "סך הכל חיובים": `₪ totalRequired` (he-IL separators)
  - 'סה"כ שולם': `₪ totalPayments`
  - 'סה"כ זיכויים': `₪ totalRefunds`, shown only when `totalRefunds > 0`
  - Balance card, whose label, icon and colour depend on the sign of `debt`:
    - `debt > 0`: "יתרת חוב", danger colour, alert icon, badge "חובה"
    - `debt < 0`: "יתרת זכות", info colour, wallet icon, badge "זכות"
    - `debt = 0`: "מאוזן", success colour, check icon, no badge

    The value is `₪ |debt|` (PAY:21-24, PAY:46-57). See section 7 for the formulas.
- **I-40** Toolbar: "היסטוריית תשלומים" and `{payments.length} רשומות` (PAY:60-64).
- **I-41** Columns (PAY:71-78, cells PAY:81-96):
  1. "תאריך": `paymentDate` (he-IL). For refunds this is `createdAt`.
  2. "סוג": badge "זיכוי" (danger) or "תשלום" (success).
  3. "הזמנה מקושרת": plain text `הזמנה {orderId}`, **not a link**, or '-'.
  4. "אופן תשלום": for a refund, `reason || 'זיכוי'`; otherwise `paymentMethod`.
  5. "סכום": for a refund, red `-₪amount`; otherwise `₪amount`. Executed-refund reversal payments (`isRefund=true`, negative amount, method 'החזר/זיכוי', created at `app/api/refunds/[id]/route.js:90-99`) appear as type "תשלום" with a raw negative amount (`₪-100`).
  6. "הערות": for a refund, "בוצע" or "ממתין לביצוע" (from `isExecuted`); otherwise `notes || '-'` (muted when empty).
- **I-42** Row key is `${entryType}-${id}` (PAY:84). No row actions: rows are not clickable and cannot be edited or deleted. No filter or search.
- **I-43** Footer: `סה"כ רשומות מוצגות: {n}`. Empty state: icon `i-card` and "אין היסטוריית תשלומים ללקוח זה." (PAY:101-110).

### 2d. Refunds & bank details tab (REF)
- **I-44** Bank-details form card "פרטי חשבון בנק לזיכויים" (REF:9-35):
  - `bankName` "שם בנק", placeholder "למשל: לאומי"
  - `bankBranch` "סניף", placeholder "מספר סניף"
  - `bankAccount` "מספר חשבון"
  - `bankAccountName` "שם בעל החשבון"

  None of these are validated or required on the card. The submit button "שמור פרטי בנק" ("שומר..." while saving) calls the **same** `handleSave`, which sends a PUT of the whole customer object and runs all the page validations (P:384-390).
- **I-45** Toolbar: "היסטוריית זיכויים" and `{refunds.length} זיכויים` (REF:38-42).
- **I-46** Data: `GET /api/refunds?customerId=<uuid>` (P:107). The server applies:
  - `isDeleted:false`, `customerId`
  - order `createdAt desc`, **`take: 100`** (default `limit`), with no paging (API-R:14,22,90-95)
  - includes `customer{firstName,lastName,phone1,email}` and `order{orderId}` (API-R:34-48)
- **I-47** Columns (REF:49-75):
  - "תאריך בקשה": `createdAt` (he-IL)
  - "מס' הזמנה": `Refund.orderId` (numeric) as a Link to `/orders/{orderId}`, or '-'
  - "סכום": red `₪amount`
  - "סיבה": `reason || '-'`
  - "סטטוס": badge "בוצע ({executionDate he-IL})" (success) or "ממתין לביצוע" (warning)
- **I-48** Fields on the Refund model that are **not shown**: `bankName/bankBranch/bankAccount/bankAccountName` per refund, `paymentDetails`, `email`, `executedBy`, `paymentId`, `isAutoGenerated` (`prisma/schema.prisma:658-690`).
- **I-49** No action on this tab creates, executes or cancels a refund. Creating refunds is `POST /api/refunds` (API-R:103-160), which is not called from the card. Footer: `סה"כ זיכויים מוצגים: {n}`. Empty state: icon `i-refresh` and "אין זיכויים ללקוח זה." (REF:80-89).

### 2e. History tab (HIS)
- **I-50** See section 8 for full detail. Toolbar: "היסטוריית שינויים" and `{logs.length} תיעודי פעולות` (HIS:71-75). There is a search form (HIS:77-89), a list of log rows (HIS:107-124), and loading, error and empty states (HIS:92-105).

## 3. Actions / buttons

- **I-51** **Save (existing customer)**: `handleSave` (P:145-232), called by the header "שמירת שינויים", the details-tab check button, the details-form submit, and the bank-form submit.
  1. `e.preventDefault()` (P:146).
  2. For `id==='new'` only: the field-group check (see I-75).
  3. For `id==='new'` only: required-field checks (see I-76).
  4. Format validation for **both** new and existing customers (see I-78).
  5. `setSaving(true)`, then `PUT /api/customers/${id}` with `Content-Type: application/json`. The body is the **entire `customer` state object** spread, with `email` replaced by `normalizeEmail(email, emailSuffix)` (P:190-203). It therefore also sends `orders` (with nested items, payments and obligations), `updatedAt`, `legacyId`, `isBlocked`, and so on. The server whitelists fields (see I-54).
  6. On `!res.ok`:
     - 409 with `data.message`: `alert(message)` and return (P:207-209).
     - Otherwise: `throw Error(data.error || data.message || 'שגיאה בשמירת נתונים')`, which the catch turns into `alert(e.message)` (P:213, P:227-228).
  7. On success (existing): `setOriginalCustomer(data)` and `alert('הפרטים נשמרו בהצלחה!')` (P:218-220). **`customer` state is not replaced** with the server response. Returns `true` (P:226).
  8. `finally`: `setSaving(false)`.
  9. There is no confirm dialog and no PIN on save.
- **I-52** **Save (new customer)**: the same function. It sends `POST /api/customers` with the normalized body (P:190-191). On success with `data.id` it navigates with `router.push('/customers/<new uuid>')` and shows **no** success alert (P:216-217).
- **I-53** Server PUT (API-C:52-188):
  - `checkAuth()` (any logged-in user) (API-C:53).
  - 404 if the customer is not found (API-C:64-67).
  - **Collision check:** if `body.updatedAt` is later than the server's `updatedAt + 1000ms`, it returns 409 `{error:'Data Collision', message:'לקוח זה עודכן בשרת לאחר הסנכרון האחרון שלך...'}` (API-C:70-80).
  - Validation, then a 400 `{error: errors.join(', ')}` (see I-79).
  - The validation block **fails open**: an exception is only logged (API-C:138-140).
- **I-54** PUT data whitelist (API-C:142-163). Written unconditionally: `firstName, lastName, phone1, phone2, email (normalized), city, street, houseNum (parseInt, or null if ''/null), notes, bankName, bankBranch, bankAccount, bankAccountName`. Written only if present in the body: `zeout ('' becomes null), marketingConsent (!!), hokBankName, hokBankBranch, hokBankAccount, hokConsent`. Not writable via PUT: `officeNotes, emailSuffix, isBlocked, blockedReason, isDeleted, legacyId, registrationDate`.
- **I-55** PUT audit: the diff `{field:{from,to}}` is computed over whitelisted fields that are not `undefined` and differ (strict `!==`). It is written through `auditAs('UPDATE', ..., changes)` as a single AuditLog row (API-C:166-181). The response is the updated Customer row with **no `orders` include** (API-C:183). `email` in the response is the stored normalized value.
- **I-56** Known consequence of I-51 step 7 and I-55: after a successful save, `originalCustomer` (the response, which has no `orders` and a new `updatedAt`) no longer deep-equals `customer`, which still has `orders` and the old `updatedAt`. As a result:
  - `hasUnsavedChanges` stays `true`, so "ביטול שינויים" remains enabled (P:239).
  - Clicking "ביטול שינויים" then sets `customer = originalCustomer`, which has **no `orders`**. The orders, payments and header counts drop to 0 until reload (P:234-236).
  - A second save in the same page session sends the stale `updatedAt`. The server's `updatedAt` is now newer by more than 1 s, so it returns the **409 collision** alert (API-C:70-80).
  - These are observations from code reading. They have not been exercised in a browser.
- **I-57** The same stale-`updatedAt` effect follows an unblock: PATCH bumps the server `updatedAt`, and the client state updates only `isBlocked`/`blockedReason` (P:71-72). The next PUT in the same session therefore returns 409.
- **I-58** **Cancel changes** ("ביטול שינויים"): if `originalCustomer` exists, `setCustomer(originalCustomer)`. Then `cancelTick+1` closes the details edit mode (P:234-237). There is no confirm dialog and no API call.
- **I-59** **Back** ("חזור"): `router.back()` with no dirty check (P:355, CARD:86-89). The new-customer form's back button is icon-only, titled "חזרה", and also calls `router.back()` (P:260-262).
- **I-60** **Unblock** (`handleUnblockCustomer`, P:57-77):
  1. Button visible only when `isBlocked && isHeadManagement` (DET:102, DET:111).
  2. `await window.customConfirm('לבטל את חסימת הלקוח מהזמנות חדשות?', 'ביטול חסימה')` (P:59). The provider's `customConfirm` takes only `message`; the title argument is ignored (`app/components/PopupProvider.js:200`).
  3. `PATCH /api/customers/${customer.id}` with body `{isBlocked:false, blockedReason:null}` (P:61-65).
  4. On `!res.ok`: `alert(data.error || 'שגיאה בביטול החסימה')` (P:66-69). On network error: `alert('שגיאת רשת בביטול החסימה')` (P:73-76).
  5. On success: local `customer` and `originalCustomer` get `isBlocked:false, blockedReason:null`. There is no success toast. The banner disappears (P:71-72).
- **I-61** Server PATCH (API-C:194-241):
  - `isBlocked===false` requires `checkAuth('הנהלה ראשית')`, i.e. roleId 0 or 2 (`lib/auth.js:24-28`). Otherwise it returns 403 `'פעולה זו מוגבלת להנהלה ראשית בלבד'` (API-C:204-207).
  - Any other body (e.g. blocking) needs only `checkAuth()` (API-C:208-210).
  - Only `isBlocked` and `blockedReason` are written. An empty body returns 400 'No fields to update'.
  - Writes an audited UPDATE with a diff (API-C:217-234).
  - Blocking itself is done elsewhere: `components/orders/RentalReturnModal.js:519-537` (the flow that marks a return as not OK). It is not done from the card.
- **I-62** **Send email** (`handleSendEmailClick`, P:79-88). Triggered by the header "שליחת מייל" and the details-tab "שלח מייל":
  1. If `!customer.email`: `alert("ללקוח זה לא מעודכנת כתובת מייל. אנא עדכן ב'פרטים אישיים' ושמור תחילה.")` and stop. This checks the **current local state**, so an unsaved typed email passes this check.
  2. `verifyPin('שליחת מייל דורשת אישור מנהל. אנא הזן סיסמה:', 'feature:customer_email_approval')` (P:84).
  3. If that returns null, stop. Otherwise store `{employeeId, pin}` and open `ModernSendEmailModal` (P:85-87).
- **I-63** `verifyPin` (`components/orders/modern/mocAuth.js:4-23`):
  1. `window.customAuthPrompt(message, level)`: the PopupProvider auth dialog. Its employee picker is filtered to `e.approvals['feature:customer_email_approval']` (`app/components/PopupProvider.js:156-159`), and it defaults to the current user if they are in the list (`PopupProvider.js:161-168`).
  2. If there is no pin, return null.
  3. `POST /api/auth/verify-pin` with `{pin, employeeId, requiredLevel:'feature:customer_email_approval'}` (mocAuth.js:8-12).
  4. If `!success`: `alert(data.error || 'סיסמה שגויה או הרשאה לא מספקת.')` and return null. On a thrown error: `alert('שגיאה באימות מול השרת.')`.
  5. Returns `authResult` (`{employeeId, pin}`).
- **I-64** Server verify-pin (API-V:8-107):
  - Requires a session (`checkAuth()`), else 401 (API-V:13-15).
  - The pin is the employee's **full password**, checked with bcrypt against the chosen employee. With no `employeeId` it scans all active employees (API-V:29-44).
  - Wrong pin returns 401 `'סיסמה שגויה או משתמש לא פעיל'`.
  - For `feature:*` levels: the catalog item must be `approver:true`, else 400. `hasPermission(employee, key)` must pass, else 403 `אין הרשאה לאשר פעולה זו (<label>)` (API-V:92-100).
- **I-65** **Email modal** (MAIL), rendered with `createPortal` into `document.body` (MAIL:93-198):
  - Title: "שליחת מייל - {firstName} {lastName}" (MAIL:101-104).
  - Clicking the backdrop or the X closes it unless loading (MAIL:97, MAIL:105). The "ביטול" button is disabled while loading (MAIL:188).
  - Fields:
    - "נושא ההודעה" (required) (MAIL:131-141)
    - "תוכן" textarea, 6 rows (required) (MAIL:143-153)
    - "קבצים מצורפים (ניתן לבחור כמה)": multi-file input. Selected names are listed with the note "טבלת הוראות תצורף אוטומטית למייל" (MAIL:155-163).
    - Radio "יעד הקבצים בהתאמה": `email` "צרופה למייל", `drive` "דרייב + שיתוף", `both` "גם וגם" (MAIL:165-178).
    - For drive/both: an optional "מזהה תיקיית דרייב (רשות)" field (LTR) and the hint "הקבצים ישותפו עם הנמען בהרשאת הורדה מלאה." (MAIL:179-184).
  - Recipient: always `customer.email`, which cannot be edited in the modal. There is no CC field.
- **I-66** Modal submit (MAIL:26-91):
  1. Client check that subject and body are non-empty after trim, else `'חובה למלא נושא ותוכן'` (MAIL:28-31).
  2. Files are converted to base64 (MAIL:19-24, MAIL:39-48).
  3. `POST /api/send-email` with body:
     `{to: customer.email, subject, emailBody: body, username: authResult.employeeId, password: authResult.pin, customerId: customer.id, fileName: attachments[0]?.fileName||'', fileContent: attachments[0]?.fileContent||'', attachments:[{fileName,fileContent,mimeType,sizeBytes,dest:sendMode}], sendMode, driveFolderId}` (MAIL:49-65).
  4. On `success`: a green callout, either "המייל נשלח בהצלחה!" or "המייל נשלח! N קבצים בדרייב עם הרשאת הורדה מלאה.", plus a list of Drive links. After 2.4 s it auto-closes and resets its fields (MAIL:68-81). The page's `onClose` also clears `emailAuthResult` (P:400-403).
  5. On failure: `data.message || 'שגיאה בשליחת המייל'`. On a thrown error: 'שגיאת תקשורת' (MAIL:82-88).
  6. Field state is **not** reset when the modal is closed without sending, so a draft persists while the page is open. The send button shows "שולח..." while loading.
- **I-67** Server send-email (API-M:11-145):
  - **No session `checkAuth`.** Authentication is only the password: `verifyEmployeeCredentials(username, password)`. With a blank username it falls back to scanning all active employees (API-M:24-51).
  - `hasPermission(validEmployee, 'feature:customer_email_approval')` must pass, else 403 'אין הרשאה לאשר שליחת מייל' (API-M:55-57).
  - Attachments are normalized (API-M:64). Reads settings `gmach_name` (default 'גמ"ח שמלות') and `email_drive_folder_id` (API-M:67-70).
  - HTML body comes from `renderGenericEmailHtml` with subtitle 'הודעה מהגמ"ח'. The subject goes through `emailSubject('managerFreeText', {subject})`. The request is sent with `postToMailer` (API-M:72-87).
  - Always writes an `EmailLog` row with `customerId` (API-M:91-106).
  - On success only, writes an `AuditLog` row with `entityType:'Customer', entityId:customerId, action:'EMAIL_SENT'`. Its `changesJson` holds `{subject,to,cc,body,sendMode,files,driveLinks}` and its `employeeId` is the approver (API-M:109-134). This row then shows in the History tab.
  - Mailer failure returns 500 `'השליחה נכשלה: …'` (API-M:136-138).
- **I-68** **Copy email**: `navigator.clipboard.writeText(customer.email)` with no feedback (P:369).
- **I-69** **History search**: see I-104.
- **I-70** **Order navigation**:
  - Orders tab row or link goes to `/orders/{orderId}` (numeric) (ORD:87-89).
  - Refunds tab link goes to `/orders/{Refund.orderId}` (REF:63).
  - Auto-note link goes to `/orders/{orderId}` (DET:31).
  - The Payments tab has **no** links (PAY:89).

## 4. Validation

- **I-71** Client HTML5 `required`:
  - Existing edit form: `firstName`, `lastName`, `phone1` (DET:145,149,155). These are enforced **only** when the details form itself is submitted. The header save and the bank-form save bypass them, because the header button is not a form submit and the bank form does not contain those inputs. There is no JS required check for these fields, and the PUT server does not require them unless `strict_mandatory_fields` is on (see I-79).
  - New form: also `firstName`, `lastName`, `phone1`. Plus `email` when `require_customer_email`, `city`/`street`/`houseNum` when `require_full_address`, and `zeout` when `require_customer_id_number` (P:270-324).
- **I-72** Email normalization, `normalizeEmail(raw, suffix)` (`lib/emailUtils.js:7-78`):
  - Returns null for empty input, for a bare `@gmail(.com)`, or for `@` or `.`.
  - Converts `/COM`, `/ORG`, `/CO.IL`, `/ORG.IL`, `/NET` to dot forms, and any other `/` to `.`.
  - With no `@`: appends `@<suffix>` if the suffix contains a dot, otherwise `@gmail.com`.
  - Ending in `@`: appends the suffix or `gmail.com`.
  - A domain with no dot: gmail, outlook, hotmail or yahoo get `.com`; walla gets `.co.il`; anything else gets `.com`.
  - Collapses repeated `@`.

  It runs:
  - on email blur, in both the edit and new forms (P:136-143)
  - on the body before save (P:193-196)
  - on the server for PUT and POST (API-C:82, API-CS:201)
  - on GET output (API-C:43)
- **I-73** Format validation, `validateCustomerFieldFormats` (`lib/customerValidation.js:97-109`). Empty fields pass. Rules:
  - `phone1` and `phone2`: digits-only must match `/^0\d{8,9}$/` (lib:5-9). Messages: 'מספר הטלפון הראשי אינו תקין' / 'מספר הטלפון הנוסף אינו תקין'.
  - `email`: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (lib:11-15). Message: 'כתובת הדוא"ל אינה תקינה'.
  - `zeout`: Israeli ID check digit, at most 9 digits, padded to 9 (lib:18-30). Message: 'מספר תעודת הזהות אינו תקין'.
  - `phone1 === phone2` (digits compared): 'טלפון נוסף זהה לטלפון הראשי - יש להזין מספר שונה' (lib:104-106).
- **I-74** Where format validation runs:
  - Client, for both new and existing customers, **before** normalization: it validates the raw `customer.email`, which is normalized only on blur (P:182-186).
  - Server, on PUT and POST (API-C:119, API-CS:170).
- **I-75** Field groups: `parseFieldGroups(settings.mandatory_field_groups)` (lib:50-62).
  - Missing, null or '' falls back to `[['phone2','email']]`. Invalid JSON or a non-array also falls back to the default.
  - `'[]'` is valid and disables the requirement.
  - Enforced on the client only for **new** customers, via `unsatisfiedFieldGroupErrors`, which produces `'חובה למלא לפחות אחד מבין: טלפון נוסף / אימייל'` (P:148-155, lib:74-78). Enforced on the server in POST (API-CS:139). **Not** enforced on PUT, deliberately (API-C:88-91).
- **I-76** Required-by-setting on the client, **new customer only** (P:161-179), collected into `alert('שדות חובה חסרים: ...')`:
  - `require_customer_email==='true'` requires email ('דוא"ל').
  - `require_full_address==='true'` requires city, street and house number ('עיר', 'רחוב', 'מספר בית').
  - `require_customer_id_number==='true'` requires zeout ('תעודת זהות').
- **I-77** Server POST checks (API-CS:124-192):
  - `require_customer_email` requires an email containing `@` (it also accepts `emailSuffix` if that contains `@`).
  - `require_full_address` requires city, street and houseNum.
  - `require_marketing_consent` (unless `hide_marketing_consent_field`) requires consent: 'חובה לאשר קבלת דיוורים'.
  - The field groups.
  - `require_customer_id_number` requires zeout.
  - `strict_mandatory_fields` together with the `mandatory_fields` CSV, via an alias map.
  - Format checks.
  - **Duplicate zeout** among non-deleted customers.

  Any error returns 400 `{error: joined}`. Validation fails open on an exception (API-CS:190-192). On success it creates the customer with `legacyId = max(legacyId)+1` (API-CS:195-199, API-CS:203-223).
- **I-78** Error display: every client and server validation error is shown with `alert()`, which PopupProvider overrides into an in-app dialog (`app/components/PopupProvider.js:199`). Messages are joined with `\n` on the client and `', '` on the server. There is **no inline per-field error UI**, only the red `*` markers on the new form.
- **I-79** Server PUT checks (API-C:92-140), for **existing** customers:
  - Marketing consent is required only if `hide_marketing_consent_field!=='true' && require_marketing_consent==='true'`: 'חובה לאשר קבלת דיוורים' (API-C:96-98). The card's checkbox can be hidden by `hide_marketing_consent_field` but not otherwise forced.
  - `strict_mandatory_fields` + `mandatory_fields` alias check: "<label> חובה" (API-C:99-117).
  - Format checks (API-C:119).
  - Duplicate `zeout` against other non-deleted customers (`NOT {id}`): 'מספר תעודת זהות זה כבר קיים במערכת אצל לקוח אחר (<name>)' (API-C:123-133).
  - `require_customer_email`, `require_full_address` and `require_customer_id_number` are **not** enforced on edit (API-C:84-91). The same is true on the client (P:158-160, DET:166-167).
- **I-80** Dynamic asterisks on the new form (P:284-325):
  - `phone2` gets `*` when `require_customer_email!=='true'` and phone2 is required by a group (i.e. the other group members are empty) (P:286).
  - `email` gets `*` when `require_customer_email==='true'` or email is required by a group (P:298).
  - City, street and house number get `*` when `require_full_address` is on. Zeout gets `*` when `require_customer_id_number` is on.
  - The existing-customer edit form shows **no** dynamic asterisks: only the static `*` on first name, last name and phone (DET:144-152).
- **I-81** Static hint on the new form: "כל הזמנה מחייבת 2 אמצעי תקשורת — יש למלא לפחות אחד מבין טלפון נוסף / אימייל." (P:307-309). The text is hard-coded and does not follow `mandatory_field_groups`.
- **I-82** Refund-request server rule (not reachable from the card): bank name and branch are required (API-R:123-125).

## 5. Permission gates

- **I-83** Page gate. `app/customers/layout.js:5-6` wraps every `/customers/**` route, including `/customers/[id]` and `/customers/new`, in `<PageGate pageKey="page:customers">`. Without access it renders `NoAccessMessage` (`app/components/PageGate.js:8-12`).
- **I-84** `canOpenPage` (`lib/permissions.js:287-306`):
  - With no verified cookie: returns `checkAuth()` (anonymous access only while `require_login` is off).
  - Otherwise it resolves the role from the signed session and calls `resolvePageAccess`.
  - Any error returns false.
- **I-85** Catalog item `page:customers` (`lib/permissionsMetadata.js:210-221`): `enforced:true`, `defaultForRoleId: () => false`. With no permission row, only head management and programmer (roleId 0/2, which are always allowed) can open it. Other departments need an explicit row on `/admin/permissions`. The sidebar link uses the same decision (`app/layout.js:199,232`).
- **I-86** API gates:
  - GET, PUT customer: `checkAuth()`, any logged-in employee (API-C:9, API-C:53).
  - PATCH unblock: `checkAuth('הנהלה ראשית')` = roles [0,2]. Block: `checkAuth()` (API-C:204-210).
  - GET refunds, POST refunds: `checkAuth()` (API-R:9, API-R:105).
  - GET audit: `checkAuth()`. `entityType=Employee` is restricted to head management (API-A:8, API-A:31-39). Customer history is open to any logged-in user.
  - GET locations: `checkAuth()`.
  - POST customers: `checkAuth()`.
  - **The API routes do not check `page:customers`.** An employee denied the page can still call these APIs directly (this matches the documented "pages are not an API firewall" boundary).
- **I-87** `GET /api/settings` has **no auth check** and returns every setting except `BRAND_LOGO`/`backup_requested_at`, with secret values masked (`app/api/settings/route.js:16-37`).
- **I-88** `/api/me` requires a verified cookie, else 401 (`app/api/me/route.js:9-14`). The client uses it only to set `isHeadManagement` (P:40-46). This is UI-only; the server enforces the rule in I-61.
- **I-89** Send-email approval: `feature:customer_email_approval` (`lib/permissionsMetadata.js:458-465`), built with `approverItem`: `enforced:true, approver:true`, closed by default, so only roleId 0/2 are always allowed unless a row grants more (`lib/permissionsMetadata.js:65-79`). It is checked in three places:
  - client picker filter (`PopupProvider.js:156-159`)
  - `verify-pin` (API-V:92-100)
  - `send-email` itself (API-M:55-57)
- **I-90** Unblock is restricted to roleId 0/2 by a hard-coded role check on both client and server (P:43, API-C:205). It is **not** a catalog item, which conflicts with the standing rule in CLAUDE.md.
- **I-91** Refund history and bank details are visible and editable by anyone who can open the page. There is no separate gate.

## 6. SystemSetting / org-dependent behaviour

Keys read from `/api/settings`. The client compares values as strings, and a missing key is treated as off.

- **I-92** Client-side keys:
  - `mandatory_field_groups` (P:148, P:286, P:298). Missing: default `[['phone2','email']]`. Affects new-customer group enforcement and asterisks (see I-75, I-80).
  - `require_customer_email` (P:162, P:286, P:298, P:304). Missing: off. New form only: email required plus a `*`, and it suppresses phone2's group asterisk.
  - `require_full_address` (P:165, P:311-320). Missing: off. New form only.
  - `require_customer_id_number` (P:173, P:323-324). Missing: off. New form only. Documented as Neve Yaakov only (CLAUDE.md).
  - `hide_marketing_consent_field` (P:326, DET:218). Missing: checkbox shown. Hides the consent checkbox on both the new and edit forms.
- **I-93** Server-side keys (read with `getAllCachedSettings`, 30 s cache):
  - PUT: `hide_marketing_consent_field`, `require_marketing_consent`, `strict_mandatory_fields`, `mandatory_fields` (API-C:93-117).
  - POST: those, plus `require_customer_email`, `require_full_address`, `mandatory_field_groups`, `require_customer_id_number` (API-CS:122-168).
  - Send-email: `gmach_name` (default 'גמ"ח שמלות') and `email_drive_folder_id` (default '', used when the modal's folder field is blank) (API-M:67-70).
- **I-94** Not used by the card, although the task asked about them:
  - `hide_gregorian_calendar`: not read. Gregorian `he-IL` dates are always shown in the orders, payments, refunds and history tabs.
  - `useLabels` / `getLabel` / `/api/settings/labels`: not used. All labels are hard-coded Hebrew.
  - `require_marketing_consent`: server only (see I-93).
  - `draft_orders_show_as_deleted`: not applied (see I-34).
  - `require_id_for_edit_cancel`: not read.
  - `enable_deliveries` and delivery fields: not shown.

## 7. Debt, balance and total computation

- **I-95** Per-order "סכום לחיוב" (ORD:79-81 and PAY:7-9, identical code). If the order has at least one obligation, it is `Σ obligation.amount` over obligations with `!isDeleted`. Otherwise it is `order.totalAmount || 0`. The server already filters `obligations: {isDeleted:false}` (API-C:31-33). Refund-type obligations (`isRefund`) are summed with their stored sign, with no special handling.
- **I-96** Per-order "שולם" (ORD:82): `Σ payment.amount` over payments with `!isDeleted` (the server also filters `isDeleted:false`, API-C:28-30). This **includes** executed-refund reversal payments (`isRefund:true`, negative amount, `app/api/refunds/[id]/route.js:90-99`), so the per-order paid figure is net of executed refunds.
- **I-97** Per-order payment status is `calculatePaymentStatus(total, paid)` (`lib/orderStatus.js:84-90`), evaluated in this order:
  1. `paid > total && total > 0` gives 'ממתין לזיכוי'.
  2. `paid > 0 && total === 0` gives 'ממתין לזיכוי'.
  3. `total > 0 && paid ≥ total` gives 'שולם'.
  4. `0 < paid < total` gives 'שולם חלקי'.
  5. Anything else gives 'לא שולם'.
- **I-98** Customer-level totals (PAY:6-19):
  - `totalRequired = Σ over ALL customer.orders of orderTotal (I-95)`. This includes soft-deleted (`isDeleted`) orders and drafts, because the GET does not filter orders.
  - `totalPayments = Σ amount of allPayments where entryType!=='refund'`. This is every non-deleted payment on the customer's orders, including negative reversal payments.
  - `totalRefunds = Σ amount of all Refund rows` (non-deleted, executed **and** pending, at most 100) (P:93, API-R:22,90-95).
  - `effectivePaid = totalPayments − totalRefunds`.
  - `debt = totalRequired − effectivePaid`. Displayed as `|debt|` with the sign label described in I-39.
- **I-99** Consequence of I-96 and I-98: an **executed** refund linked to an order is subtracted twice, once as its negative reversal Payment and once as the Refund row. A **pending** refund is subtracted as though it were already paid out. Both push `debt` upward. The formula differs from the per-order statuses in the Orders tab, which ignore Refund rows entirely.

  Also missing from this tab: Payments linked only by `Payment.customerId` (no order), the order-level `isPaid`/`status`/`paymentDate`, and any debt approval (`DEBT_APPROVED`).
- **I-100** Refund records are shown in two places: the Payments tab (merged into the list, I-38 and I-41) and the Refunds tab (I-47).

## 8. History tab

- **I-101** Source: `GET /api/audit?entityType=Customer&entityId=<uuid>[&search=<text>]` with plain fetch, re-run whenever `customerId` or `filterSearch` changes. A `cancelled` flag guards against races (HIS:44-67).
- **I-102** Server (API-A:7-96):
  - Filters `entityType='Customer'` and `entityId=<uuid>`.
  - `search` becomes `changesJson contains <text>`, case-insensitive (API-A:75-78).
  - Order `createdAt desc`, **limit 100 and page 1 by default**. The client sends no paging, and the `total` field in the response is ignored by the client (API-A:25-26, API-A:80-91).
  - `attachEmployeeNames` redacts secrets and adds `employeeName` (`app/lib/auditLog.js:34-49`).
- **I-103** Only rows whose `entityType` is Customer are included. That covers:
  - customer CREATE, UPDATE and DELETE rows from the Prisma audit extension, and PUT/PATCH diffs through `auditAs` (API-C:177-181, API-C:230-234)
  - `EMAIL_SENT` rows (API-M:115-132)

  Order, payment and refund events for this customer are **not** shown here.
- **I-104** Search UI: a text input with placeholder "חיפוש בהיסטוריה..." and a "חפש" submit button. The search applies only on submit. A "נקה" button (shown when a filter is active) clears it (HIS:77-89).
- **I-105** Each log row (HIS:107-124) contains:
  - An action badge. The label comes from `ACTION_TRANSLATIONS` (`components/HistoryViewer.js:121-150`), e.g. CREATE 'יצירה', UPDATE 'עדכון', DELETE 'מחיקה', EMAIL_SENT 'שליחת מייל'. Unknown actions show the raw action string. The colour comes from the local map (HIS:11-31); unmapped actions, including EMAIL_SENT, are neutral.
  - Bold text: `"<employeeName | 'עובד שנמחק' if employeeId but no name | 'מערכת' if no employeeId> ביצע/ה <actionLabel>"` (HIS:114-116).
  - A meta line: `d.toLocaleDateString('he-IL') (getHebrewDateString(d)) · HH:MM` (HIS:117-119).
  - `ChangesChips` rendering of `changesJson` (`components/modern/ChangesChips.js:47-121`):
    - Entries whose from and to are both empty or equal are dropped. If nothing is left it shows "לא בוצעו שינויים מהותיים בשדות.".
    - Field names are translated with `FIELD_TRANSLATIONS` (`components/HistoryViewer.js:4`), falling back to the raw key.
    - Long-text keys (`body`, `notes`, `orderNotes`, `officeNotes`) render as full-width blocks.
    - Other keys render as chips: `from` struck through in red, `←`, `to` in green.
    - Values: booleans become 'כן'/'לא', ISO dates become 'he-IL (Hebrew)', objects become JSON, empty values become '-'.
    - Unparseable JSON is shown raw in monospace.
- **I-106** States:
  - Loading: spinner and "טוען היסטוריית שינויים..." (HIS:92-96).
  - Error: red "שגיאה בטעינת היסטוריה: {message}". A non-OK response gives the message 'Failed to fetch history' (HIS:56, HIS:97-100).
  - Empty: `i-history` icon and "לא נמצאו תיעודי היסטוריה או שינויים" (HIS:101-105).

## 9. Unsaved changes, page states

- **I-107** Dirty detection: `hasUnsavedChanges = originalCustomer && JSON.stringify(customer) !== JSON.stringify(originalCustomer)` (P:239). This is a full deep compare that is key-order sensitive and covers every field, including `orders`. Its only effect is enabling or disabling "ביטול שינויים" (CARD:75). It also stays dirty after a save (see I-56).
- **I-108** There is **no** `beforeunload` handler, no route-change guard, and no "unsaved changes" prompt on "חזור", tab switching or navigation. `beforeunload` exists only in `app/orders/[id]/page.js` and `app/dashboard/dresses/[id]/page.js` (grep result). There is no visual dirty indicator other than the enabled cancel button.
- **I-109** Switching tabs keeps edits, because tabs stay mounted and the state lives in the page.
- **I-110** Page-level states:
  - Loading: spinner (I-09).
  - Fetch error or invalid id: redirect to `/customers` (I-04).
  - Network exception: blank page (I-07).
  - Save in progress: the save buttons are disabled and show a spinner; the cancel button is disabled. Inputs are **not** disabled.
  - Tab states: I-37, I-43, I-49, I-106.
- **I-111** New-customer mode: `originalCustomer` is null, so `hasUnsavedChanges` is falsy, but there is no cancel button in that mode anyway. The submit button reads "שמור פרטים" / "שומר..." (P:339-343). The form has `autoComplete="off"` (P:266).
- **I-112** Soft-deleted customers (`isDeleted=true`) still load and render normally. GET does not filter them (API-C:17-18), and the UI has no deleted indicator.

## 10. Customer data model and GET payload

- **I-113** `model Customer` (`prisma/schema.prisma:14-56`):

  | Field | Type | Line |
  |---|---|---|
  | `id` | String uuid | 15 |
  | `legacyId` | Int? unique | 16 |
  | `firstName` | String? | 17 |
  | `lastName` | String? | 18 |
  | `phone1` | String? | 19 |
  | `phone2` | String? | 20 |
  | `city` | String? | 21 |
  | `street` | String? | 22 |
  | `houseNum` | **Int?** | 23 |
  | `email` | String? | 24 |
  | `emailSuffix` | String? | 25 |
  | `notes` | String? | 26 |
  | `registrationDate` | **String?** | 27 |
  | `officeNotes` | String? | 28 |
  | `isDeleted` | Boolean false | 29 |
  | `isBlocked` | Boolean false | 30 |
  | `blockedReason` | String? | 31 |
  | `bankName` | String? | 34 |
  | `bankBranch` | String? | 35 |
  | `bankAccount` | String? | 36 |
  | `bankAccountName` | String? | 37 |
  | `zeout` | String? | 40 |
  | `marketingConsent` | Boolean false | 41 |
  | `hokBankName` | String? | 42 |
  | `hokBankBranch` | String? | 43 |
  | `hokBankAccount` | String? | 44 |
  | `hokConsent` | Boolean false | 45 |
  | `orders` | Order[] | 47 |
  | `payments` | Payment[] | 48 |
  | `refunds` | Refund[] | 49 |
  | `updatedAt` | DateTime | 50 |

  There is **no** `createdAt`, `idNumber`, `balance`/`debt` column, tags, family, date of birth, secondary email, preferred branch, or "VIP"/rating field.
- **I-114** GET `/api/customers/[id]` returns every scalar Customer column, with `email` replaced by `normalizeEmail(email, emailSuffix)`, plus `orders[]` ordered by `id desc` (API-C:17-45). Each order carries:
  - every Order scalar (`prisma/schema.prisma:290-342`): `id, legacyId, orderId, customerId, totalAmount, paymentDate, paymentMethod, status, notes, internalNotes, isPaid, isDeleted, orderNotes, hasSignedRegulations, eventDate, eventDateHebrew, returnDate, orderDate, employeeId, deletedAt, isAbroad, isWeekdayEvent, fromDate, toDate, customSpacing, extraDay, isPhoneOrder, branch, pickupBranch, deliveryAddress, deliveryCity, isDelivery, deliveryDirection, deliveryOneDayBefore, hokDetails, updatedAt`
  - `items[]`: all OrderItems including deleted ones, each with `dressItem` (API-C:23-27)
  - `payments[]` where `!isDeleted`: `id, legacyId, customerId, orderId, amount, paymentDate, paymentMethod, notes, isDeleted, isRefund, updatedAt` (`prisma/schema.prisma:355-376`)
  - `obligations[]` where `!isDeleted`: `id, legacyId, orderId, productId, amount, quantity, description, createdAt, isDeleted, isRefund, isManual, orderItemId, updatedAt` (`prisma/schema.prisma:378-400`)

  Not included: `customer.payments` (direct relation), `customer.refunds` (fetched separately), `employee`, `order.refunds`. Order has no `createdAt`.
- **I-115** `GET /api/refunds?customerId=` rows contain every Refund scalar: `id, customerId, orderId, amount, reason, bankName, bankBranch, bankAccount, bankAccountName, paymentDetails, email, isExecuted, executionDate, executedBy, paymentId, isAutoGenerated, isDeleted, createdAt, updatedAt` (`prisma/schema.prisma:658-690`), plus `customer{firstName,lastName,phone1,email}` and `order{orderId}` (API-R:34-48).
- **I-116** `GET /api/audit` rows: `{id, legacyId, entityType, entityId, action, changesJson (string), createdAt, employeeId, updatedAt, employeeName}` (`prisma/schema.prisma:58-71`, `app/lib/auditLog.js:45-48`), with the envelope `{logs, total}`.
- **I-117** `/api/me` employee payload used by the card: `{id, firstName, lastName, fullName, isActive, roleId, receiveEmailAlerts, email, department{name}, exportMaxRows}` plus `activeShift` (`app/api/me/route.js:29-48,67-71`). The card reads only `roleId`.

## 11. Cross-cutting observations (for reviewers comparing a prototype)

- **I-118** The ID display rule is broken in one place: the header falls back to the UUID when `legacyId` is null (CARD:45). Every order reference uses the numeric `orderId`.
- **I-119** Name rendering differs between components. CARD filters out the literal `"null"` string; DET does not (CARD:26-28 vs DET:97).
- **I-120** "שמירת שינויים" appears in three places (header, details-form bottom, details-card check icon) and "שמור פרטי בנק" in one. All four call the same whole-object PUT.
- **I-121** Date formatting differs across tabs:
  - Header: Hebrew date only.
  - Orders: `eventDateHebrew` or Gregorian.
  - Payments and refunds: Gregorian only.
  - History: Gregorian plus Hebrew.
  - Auto-notes: Hebrew.
- **I-122** Orders tab count, orders badge, header count and Payments `totalRequired` all include soft-deleted (`מחוק`) orders and drafts (`טיוטה`). Only the status badge distinguishes them.
- **I-123** No field on the card reads `order.isPaid`, `order.status` or `order.paymentDate`. All payment state is derived client-side, as described in section 7.
