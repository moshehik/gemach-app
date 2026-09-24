# Functional inventory of `/orders/new` (read-only, from origin/main)

Code root: `scratchpad/main` (HEAD `1060e1b`, 2026-09-24). Paths below are relative to that root. `P:` = `app/orders/new/page.js`.
Nothing under `docs/redesign-v3/` was read.

---

## 1. Route, gates, permissions

- **I-01** Two nested server layouts gate the page. `app/orders/layout.js:8` → `<PageGate pageKey="page:orders">` and `app/orders/new/layout.js:5` → `<PageGate pageKey="page:orders_new">`. Opening the page needs **both**. `app/components/PageGate.js:8-12` calls `canOpenPage(key)` (`lib/permissions.js`) and renders `<NoAccessMessage/>` on a deny.
- **I-02** Catalog defaults: both `page:orders` and `page:orders_new` are `enforced: true`, `defaultForRoleId: () => false`. Only head management (roleId 0) and programmer (roleId 2) get in without an explicit permission row (`lib/permissionsMetadata.js:175-196`, `ALWAYS_ALLOWED_ROLE_IDS=[0,2]` at ~line 56). Small documentation slip: the `page:orders_new` catalog `note` says "app/orders/layout.js calls canOpenPage("page:orders_new")". In the code it is `app/orders/new/layout.js`.
- **I-03** The page itself is a client component (`P:1 'use client'`). It makes no role check of its own. Every other gate is a per-action password prompt (see section 10).
- **I-04** The APIs do **not** enforce `page:orders_new`. `POST /api/orders` (`app/api/orders/route.js:653`), `POST /api/orders/draft` (`draft/route.js:31`), `POST /api/orders/reserve` (`reserve/route.js:22`), `POST /api/nedarim` (`app/api/nedarim/route.js:10`), `GET/POST /api/customers`, `GET /api/customers/locations` and `GET /api/inventory/preload` only call `checkAuth()` (any logged-in user). Some routes the page calls have **no auth at all**:
  - `POST /api/orders/calculate` (`calculate/route.js:7`)
  - `GET /api/orders/pricing` (`pricing/route.js:4`)
  - `POST /api/orders/validate-inventory` (`validate-inventory/route.js:6`)
  - `GET /api/settings`, which is public on purpose (`app/api/settings/route.js:12-16`)
- **I-05** Approver keys used from this page. Each is prompted through `window.customAuthPrompt` + `POST /api/auth/verify-pin`:

  | Key / level | Where | Catalog |
  |---|---|---|
  | `feature:missing_contact_approval` | new customer `P:539`; existing customer `P:618-621` | `permissionsMetadata.js:451` |
  | `feature:past_date_order_approval` | `P:1120` | `:443` |
  | `feature:payment_exit_approval` | `P:1159,1169` (only when `PAYMENT_APPROVAL_LEVEL` ∈ {מנהל, עובד, מנהל סניף ומעלה}) | `:371` |
  | `feature:special_spacing_approval` | `P:1471,1477` | `:435` |
  | `'הנהלה ראשית'` (**hard-coded role level, not a catalog key**) | blocked-customer override `P:583-586` | verify-pin `route.js:66-68` → `HEAD_MANAGEMENT_ROLES` |

  The approver items resolve through `hasPermission` (verify-pin `:91-99`). Approver items are closed by default, so only roleId 0 and 2 can approve without a permission row. The picker in `app/components/PopupProvider.js:156-159` filters employees by `e.approvals[key]`.

---

## 2. Steps / sections, in order, with every field

The shell is `components/orders/new/NewOrderShell.js`: `<h1>הזמנה חדשה</h1>`, top-bar actions, a toast (`flash`), a 5-item clickable stepper (`role=button`, locked items show `lockedReason` as a tooltip), the body, and a footer.

- **I-06** Step metadata (`P:1415-1440`):
  1. **לקוח** — value = customer name.
  2. **תאריכים** — locked until a customer is chosen.
  3. **פריטים** — locked until the dates are filled; value = "N פריטים · ₪total".
  4. **סיכום** — locked until there is ≥1 item.
  5. **תשלום** — same lock; value = "שולם ₪X".

  `canNavigateToStep` (`P:55-71`) checks only customerId, dates and item count. Clicking the stepper calls `handleStepChange` (`P:1442-1449`): if the step is allowed it jumps with `setStep`, otherwise it shows `alert(lockedReason)`.
- **I-07** Top bar (`P:1550-1561`):
  - A "טיוטה #N" link to `/orders/{draftOrderId}` in a new tab, shown once a draft exists.
  - An X button → `handleExit` (`P:1502-1508`). If there are items or a customer it opens the exit-confirm modal, otherwise it goes to `/orders`.
- **I-08** Footer (`P:1562-1599`):
  - "חזור" on steps >1.
  - "ביטול" on step 1 → `handleExit`.
  - Step 1 "המשך" → `proceedToStep2`, disabled while there is no customer.
  - Step 2 "המשך לבחירת פריטים", disabled when the dates are missing OR `validateDeliveryFields` returns an error.
  - Step 3 "המשך לסיכום", disabled while there are 0 items.
  - Step 4 "המשך לתשלום", never disabled.
  - Step 5 "סיום ויצירת ההזמנה" → `saveOrder`, disabled while busy; shows a spinner and "שומר...".

### Step 1 – לקוח (`P:1602-1938`)
- **I-09** Three tabs, `searchMode` ∈ `phone` (default) | `name` | `new` (`P:1606-1631`).
- **I-10** Phone tab (`P:1633-1664`):
  - Field `cust-phone`: text, `inputMode=tel`, LTR, autofocus, marked required with `*`.
  - Enter or the button "בדיקה והמשך" → `handleCheckPhone`.
  - Validation: the trimmed length must be ≥9, otherwise `alert('נא להזין מספר טלפון תקין')` (`P:446-449`).
  - Hint: an unknown number opens a new customer card.
- **I-11** Name tab (`P:1744-1800`):
  - `CustomerSelector`: debounced 300ms, calls `GET /api/customers?search=…&limit=50` (`components/CustomerSelector.js:54,74`), and shows a blocked badge (`:159`).
  - Choosing a customer sets `customerId` + `selectedCustomer` **immediately** (`P:1750-1753`).
  - The selected-customer strip shows name, phone1, a "לקוח חסום" badge, an edit link (`/customers/{uuid}`, new tab), phone2/email, and a "חסר ללקוח" warning with an edit link.
  - The hok fields appear when `hok_enabled` (`P:1798`).
- **I-12** New-customer tab (`P:1802-1936`). Fields:
  - Always required: שם פרטי, שם משפחה, טלפון (`phone1`).
  - `phone2`: `*` shown dynamically via `isFieldRequiredByGroup`.
  - `email`: `type=email`. `*` when `require_customer_email` or mandatory_fields/group requires it. A "השלם ל- @gmail.com" button appears when the value has no `@` (`P:1843-1852`).
  - Group error messages are listed under the fields (`P:1856-1858`).
  - Collapsible "פרטים נוספים" (`NocCollapsible`). It auto-opens when any of these is required: full address, city/street/houseNum via picker, marketing consent, ID number (`P:1865-1868`). It contains:
    - עיר מגורים: datalist from `/api/customers/locations`.
    - רחוב: datalist.
    - מספר בית.
    - תעודת זהות: `*` if `require_customer_id_number`, otherwise the hint "(לעריכה/ביטול עתידי)" if `require_id_for_edit_cancel`.
    - Checkbox "מאשר/ת קבלת דיוורים": hidden when `hide_marketing_consent_field='true'`; `*` if `require_marketing_consent`.
    - Hok card (bank/branch/account, consent checkbox) when `hok_enabled='true'`.
  - Button "שמור לקוח והמשך" (`P:1932`).
  - Enter moves to the next field; on the last field it submits. Checkboxes are skipped (`P:429-443`).
  - A banner suggests "חיפוש לפי שם" when a phone was typed but not found (`P:1807-1814`).
  - Every input uses `autoComplete="new-password"` (except zeout, which uses `off`).

### Step 2 – תאריכים (`P:1941-2153`)
- **I-13** Pill toggle "אירוע רגיל" / "חו"ל / תפוסה ארוכה". Both go through `handleDateChangeWithValidation('isAbroad', …)` (`P:1945-1958`).
- **I-14** Regular event: `HebrewDatePicker` "תאריך אירוע *" (`P:1961-1965`). Its value is a `YYYY-MM-DD` string (`components/HebrewDatePicker.js:132,152`).
- **I-15** Abroad: `HebrewDateRangePicker` "טווח תאריכים *" → `{fromDate,toDate}` (`P:1967-1974`).
- **I-16** Collapsible "הערות וריווח ימים" (titled "הערות" when `hide_custom_spacing='true'`), with a badge (`P:1977-2027`):
  - Textarea `notes` (optional).
  - "ריווח ימים בין השכרות" pills: רגיל (null) / ללא (0) / יום (1) / יומיים (2) / 3 / 4. Hidden when `hide_custom_spacing='true'`. The hint text changes with the value.
- **I-17** Card "משלוח / סניף / טלפוני". It shows if `phone_order_marker_enabled='true'` OR `track_branch_on_order='true'` OR `branches_enabled='true'` OR `delivery_show_in_order !== 'false'`. Because of the last condition it shows **by default** (`P:2030`). Contents:
  - "הזמנה טלפונית" switch (`phone_order_marker_enabled`). Turning it on clears `branch` (`P:2034-2052`).
  - "סניף ביצוע" select from `branch_list` (`track_branch_on_order`). Choosing a branch clears `isPhoneOrder` and remembers the value in `localStorage.gemach_last_order_branch` (`P:2057-2075`). It is prefilled from that key on load (`P:409-415`).
  - "סניף איסוף" select from `branch_list` (`branches_enabled`) (`P:2076-2090`).
  - Delivery block, only when `enable_deliveries='true'` (`P:2096-2148`):
    - Checkbox "הזמנת משלוח".
    - When checked: כיוון משלוח select (הלוך / חזור / הלוך-חזור; default 'הלוך-חזור').
    - עיר משלוח select. Options come from the keys of `delivery_price_by_city`, falling back to customer cities (`P:148-157`). `*` plus an inline error when `isDeliveryCityRequired`.
    - "כתובת משלוח שונה" text, shown when `delivery_allow_address_override='true'` or when it is required. `*` plus an inline error when the delivery city ≠ the customer's city.
    - Checkbox "משלוח יוצא יום לפני האירוע (במקום יומיים)" when `delivery_one_day_before_option='true'`.
- **I-18** `isWeekdayEvent` exists in state (`P:84`) and is checked in many branches (`P:59,1007,1102,1118`), but **no UI ever sets it true**, so it is always false on this page.
- **I-19** `returnDate` and `eventDateHebrew` exist in state (`P:81-82`), are **never set** by the UI, and are sent as `''`. The server derives `eventDateHebrew` (`orders/route.js:768`).

### Step 3 – פריטים (`P:2156-2399`)
- **I-20** Left card, "הוספת פריט":
  - דגם *: `OrderModelSelector` with `hasActiveItems`. It queries `/api/inventory/models?q=…&hasActiveItems=true` (debounced 300ms, `components/orders/OrderModelSelector.js:82,91`). Enter on typed text picks an exact name or barcode match, otherwise `alert('לא נמצא דגם…')` (`:121-146`). Choosing a new model resets `selectedSizes` (`P:2174-2190`).
  - Size pills, multi-select (`P:2212-2250`), with a refresh button (`P:2200-2209`). Each pill shows the size, "· N פנויות" or "· אזל", and a "+gain" when custom spacing adds stock. An unavailable size is disabled and struck through.
  - Collapsible "תיקונים לפריט", when `enable_alterations !== 'false'` (`P:2252-2310`): toggles צוואר / שרוול, a text "אורך … ס״מ", and text "פירוט לתופרת". The latter is labelled "* (חובה)" and gets a red border when an alteration is chosen, but this is **not enforced** (see I-33).
  - Button "הוסף לסל" / "הוסף N פריטים לסל", disabled while no size is selected.
- **I-21** Right card, "בסל · N" (`P:2325-2378`). A "מחשב מחירים..." spinner shows while calculating. Each row shows dressName, size (+ alterations text when alterations are on), and price (the calculated price, falling back to `item.finalPrice`). Row actions:
  - Capacity check → `ItemCapacityModal`.
  - Edit → `editItem`.
  - Remove → `customConfirm` → `removeItem`.

  The total is shown at the bottom. When the cart is empty: "טרם הוספת פריטים להזמנה".
- **I-22** A second notes textarea (the same `order.notes`) sits under the columns (`P:2384-2397`).

### Step 4 – סיכום (`P:2402-2472`)
- **I-23** Card "פרטי ההזמנה" with an "עריכה" button → step 1. It shows customer + phone, the dates as a Hebrew string (range for abroad), the spacing (unless hidden), and the notes.
- **I-24** Card "פריטים (N)": per-item name · size, "תיקונים: …" (+₪repairsCost in warning colour), price, and "סה"כ לתשלום".
- **I-25** The summary does **not** show delivery, branch, phone-order, pickup branch or hok details, and does not break out the delivery charge (it is only included in the total).

### Step 5 – תשלום (`P:2475-2595`)
- **I-26** Form (`P:2481-2530`):
  - "סכום לתשלום כעת (₪)": number, auto-reset to the remainder whenever the total or the payments list changes (`P:995-999`).
  - "אופן תשלום": select of `paymentMethodOptions`.
  - Collapsible "הערה לתשלום".
  - Buttons: "אישור תשלום" (submit → `handleAddPaymentClick`), and "חיוב אשראי" (only when `nedarim_plus_enabled !== 'false'`), which opens the credit modal with the current amount.
- **I-27** Totals card: סה"כ חיובים, שולם, יתרה (red when >0). Card "תשלומים שנרשמו" lists method / notes / amount with a remove button. The remove button is disabled for charged Nedarim payments, detected by notes containing 'אישור נדרים' (`P:1494-1500`). When there is a balance, a hint explains that finishing without full payment requires choosing "יציאה באישור מנהל" in the dropdown (`P:2586-2590`).

---

## 3. Customer search / select / create, including blocked customers

- **I-28** Phone lookup (`P:445-468`): `GET /api/customers?search=<phone>&limit=20`.
  - The server `search` matches `firstName | lastName | phone1 | email | city` contains, plus multi-word name (`app/api/customers/route.js:36-48`). **phone2 is not searched** by this path.
  - Hits → cards are shown. When there is more than one hit, a warning "נמצאו N לקוחות…" appears (`P:1668-1673`).
  - 0 hits → switch to `new` with `phone1` prefilled.
  - Error → `alert('שגיאה בחיפוש הלקוח')`.
- **I-29** Phone-hit card: avatar initials, name, blocked badge, and contact line. A "חסר ללקוח" warning plus a "עריכת פרטי לקוח" link appears when mandatory fields are missing (`P:1696-1726`). Hok fields show only when exactly one customer was found (`P:1716`). Buttons: "כן, זה הלקוח" → `handleUseExistingCustomer`, and "אף אחד מאלה - לקוח חדש" (`P:1729-1740`).
- **I-30** `handleUseExistingCustomer` (`P:592-634`) runs in this order:
  1. Blocked check: `confirmBlockedCustomerOverride` → PIN at level 'הנהלה ראשית' (`P:581-588`).
  2. Missing mandatory fields (`getMissingMandatoryCustomerFields`) + missing group labels:
     - If `strict_mandatory_fields='true'` → hard `alert`, no way to continue.
     - Else if a contact group (phone2/email) is missing → PIN `feature:missing_contact_approval`.
     - Else → `customConfirm` to accept the exception.
  3. Set customerId → step 2.
- **I-31** Mandatory-field logic (`P:472-516`):
  - Always required: firstName, lastName, phone1.
  - Plus `mandatory_fields` aliases: email / city / street / houseNum.
  - Plus `require_customer_email`, `require_full_address` (city + street + houseNum), and `require_marketing_consent` (unless `hide_marketing_consent_field`).
  - Groups come from `mandatory_field_groups`. Default when the setting is missing: `[['phone2','email']]` (`lib/customerValidation.js:48-62`).
- **I-32** Name-tab path: "המשך" → `proceedToStep2` (`P:636-643`) checks only customer present + blocked override. It does **not** run the mandatory-field / strict / missing-contact checks that the phone path runs, so those checks are skipped on this path (see I-86).
- **I-33** New-customer save (`handleSaveNewCustomerAndProceed`, `P:518-574`), in order:
  1. Missing mandatory → `alert('יש למלא: …')`.
  2. `require_customer_id_number='true'` with an empty ID → `alert('יש למלא: תעודת זהות')`.
  3. Unsatisfied groups → PIN `feature:missing_contact_approval` (soft override).
  4. Duplicate check `GET /api/customers?phone=<phone1>&limit=20` (phone1 OR phone2 contains, `customers/route.js:52-59`). If any match, open the duplicate-customer modal and stop.
  5. `POST /api/customers` with the whole `newCustomer` object (including hok* and zeout). On success → customerId, then step 2. On error → `alert('שגיאה בשמירת לקוח: …')`.
- **I-34** Server-side rules in `POST /api/customers` (`customers/route.js:116-229`):
  - `require_customer_email`, `require_full_address`, marketing consent.
  - **`mandatory_field_groups` is a hard 400** (`:139`).
  - `require_customer_id_number`.
  - `strict_mandatory_fields` + `mandatory_fields`.
  - Format checks (Israeli phone `0\d{8,9}`, email, ID check digit, phone2≠phone1; `lib/customerValidation.js:5-109`).
  - ID must be unique among active customers.
  - The whole check block is fail-open on exceptions (`:190-192`).
  - `legacyId` = max+1.
  - `houseNum` goes through `parseInt` (`:213`).
- **I-35** Duplicate-customer modal (`P:2675-2737`): title "לקוח קיים במערכת" or "כמה לקוחות…". Per candidate: name, blocked badge, phone(s), city, missing-fields warning + edit link, and "השתמש בלקוח הזה" → `handleUseExistingCustomer`. Footer: "ביטול" and "צור לקוח חדש בכל זאת" → re-save with `skipDuplicateCheck=true`. Clicking the backdrop closes it.
- **I-36** Blocked customers are enforced **only on the client** (`P:581-588`, `P:593`, `P:641`). `POST /api/orders` and `/api/orders/draft` contain no `isBlocked` check (grep: no matches).

---

## 4. Item selection: availability, size, barcode, dates, spacing, max items

- **I-37** Inventory preload (`P:645-677`). When dates exist (`isAbroad ? from&&to : eventDate`), the page calls `GET /api/inventory/preload?isAbroad=&eventDate=&fromDate=&toDate=[&excludeOrderId=<draft>]`.
  - The server (`app/api/inventory/preload/route.js`) returns `{settings:{bufferDays,skipWeekends}, stock, bookings}` over a ±60-day window.
  - It excludes items that are `notInUse`, deleted, `inRepair`, or have location `מחסן` / `רזרבה` unless `inventory_include_warehouse` / `allow_renting_reserve_items` is on (`:64-86`).
  - Pending cart items whose `inventory_hold_minutes` (default 15) hold has expired are released (`:116-136`).
  - Manual refresh: `refreshInventory` with a `_t` cache-buster (`P:679-707`).
- **I-38** Per-model availability is computed client-side by `calculateDynamicAvailability(modelId, min, max, cache, order.items, customSpacing)` (`P:709-740`, `lib/clientInventory.js:101-170`):
  - Uses the Access-style occupancy formula with `bufferDays` (default 3) and skips Fri/Sat when `skipWeekends` (default true).
  - Subtracts the current cart's items.
  - Returns `{sizeText,totalInStock,sampleItemId,availableQuantity,withNormalBuffer,withCustomSpacing}`, sorted by size.
  - Recomputed on every change to dates, spacing, model, cache or items. It clears the selected sizes unless `preserveSize` is set (the edit flow).
- **I-39** Size pill availability uses `withCustomSpacing.availableQuantity` when custom spacing is set, otherwise the normal value. The "N פנויות" label always shows the **normal** count (`P:2219-2241`).
- **I-40** `addItemToOrder` (`P:842-923`), in order:
  1. At least one size must be selected.
  2. Default the repairs text from the chosen alteration flags when it is empty and alterations are on.
  3. Re-check each size against `availableSizes` and split into valid / unavailable. If none are valid → alert "כל המידות שנבחרו אזלו…".
  4. Client max-items check: `max_items_per_order` (parseInt, >0), rule `items+new > max` → alert.
  5. One `GET /api/orders/pricing?dressModelId&sizeText&eventDate` per size (`basePrice`; on error the price is 0).
  6. Push one cart row per size with `quantity:1`, `sampleItemId` (= the **first** DressItem id of that model/size in stock, `preload/route.js:96-98`), `basePrice`, `finalPrice`, `repairs`, and the alteration flags.
  7. Reset sizes and alterations but keep the model.
  8. Alert about any sizes that were skipped as unavailable.
- **I-41** There is no barcode entry on this page. Physical units are assigned later. Only a representative `sampleItemId` is sent; the server repairs mismatched ids with `reconcileDressItemIds` (`lib/inventory.js:693-737`, called at `orders/route.js:735` and `draft/route.js:86`).
- **I-42** `editItem` (`P:944-960`) copies the row into the form with `preserveSize`, **removes it from the cart**, and scrolls. `removeItem` (`P:925-942`) splices the row out and bumps the local available count.
- **I-43** Date changes run through `handleDateChangeWithValidation` (`P:750-819`):
  - Abroad `toDate < fromDate` → alert.
  - For abroad, `eventDate` is synced to `fromDate`.
  - When the cart has items → `POST /api/orders/validate-inventory` with items, dates, customSpacing and `orderId`=draft id. On failure, alert per item: "חסרים N במלאי", with "(בגלל ציפוף)" and a spacing tip where relevant, and the change is **rejected**. A network error also rejects the change.
- **I-44** Spacing (`P:1455-1490`): picking a value that is `< 3` **and** below the previous value (with null counted as 3; the threshold 3 is hard-coded, not `inventory_buffer_days`) opens the "רגע, בדקת מלאי?" modal. From there, "פתח חיפוש תפוסה מהיר" → `CapacitySearchModal`, and "כן, המשך" → PIN `feature:special_spacing_approval` → re-validate. Other values apply directly, with validation.
- **I-45** Server-side authoritative checks in `POST /api/orders` (`orders/route.js:678-730`):
  - Max items (`max_items_per_order`, **always hard-blocked**). `enforce_strict_max_items` is read but has no effect on the outcome (`:680-689`).
  - `validateOrderItemsAvailability` (`lib/inventory.js:739-879`), excluding the draft/reserved order's own items. It uses `inventory_buffer_days` or customSpacing (nulled when `hide_custom_spacing`) and `inventory_skip_weekends`. Failure → 409 with `validationErrors`.
- **I-46** `ItemCapacityModal` (`components/orders/ItemCapacityModal.js:20-70`): calls `GET /api/inventory/capacity` for barcodePrefix + size over ±1 month around `order.eventDate`. It errors when there is no eventDate.

---

## 5. Pricing / obligations shown

- **I-47** Preview total: every change to items, eventDate, isAbroad, isWeekdayEvent, isDelivery, deliveryCity or deliveryDirection triggers `POST /api/orders/calculate` (`P:963-991`). An error just stops the spinner and leaves the old numbers. The route (`app/api/orders/calculate/route.js`):
  - Looks up the price row per item by category / size / date, with `gap_size_price_rule`.
  - Applies `ENABLE_SET_DISCOUNTS` ("כלול ב" items free, paired with main dresses).
  - Applies the abroad markup from the price-list category `חול`/`חו"ל` as a percentage.
  - Adds repairs: `תיקונים / תיקון צוואר`, `תיקון שרוול`, and `תיקון אורך` by size range.
  - Adds delivery: `delivery_price_by_city[city]`, falling back to `delivery_price`, then to **50**, ×2 for הלוך-חזור (`:128-142`).
  - Returns `{totalAmount, calculatedItems[{calculatedPrice,repairsCost,isDiscountedSet}], deliveryAmount}`.
- **I-48** Where it is displayed: step-3 row prices and total, the step-4 per-item price with "(+₪repairs)" and the total, the step-5 סה"כ חיובים / שולם / יתרה, and the stepper value (`P:1428`). `deliveryAmount` is never displayed on its own.
- **I-49** On save, each item's `finalPrice` is the preview `calculatedPrice` (`P:1232-1238`) and the order's `totalAmount` is the client preview total. After the create, the server runs `recalculateOrderObligations` (`lib/pricingEngine.js:36`, the pure engine in `lib/pricingCalc.js`) and `applyDeliveryCharge` (`:229-271`); these are the real obligations. The engine also applies `premium_pricing_enabled` / `premium_categories` (`pricingCalc.js:99-110`). **The calculate route does not**, so the preview can differ from the real obligations for premium models (see I-89).
- **I-50** A pricing-engine failure after the order is committed returns a `warning`. The client shows it with `alert` and still redirects (`orders/route.js:946-952`, `P:1333`).

---

## 6. Payment, delivery, abroad, Hebrew dates

- **I-51** Payment method options (`P:35-48`): `ALLOWED_PAYMENT_METHODS` (CSV). If missing, the defaults are `['אשראי (דרך נדרים פלוס)','מזומן','יציאה באישור מנהל']`. When `nedarim_plus_enabled === 'false'`, every option containing 'אשראי' but not 'חיצונית' is removed (fallback `['יציאה באישור מנהל']`). The initial `payment.method` is synced to the first option once settings load (`P:395-398`).
- **I-52** "אישור תשלום" (`handleAddPaymentClick`, `P:1192-1210`):
  - Amount ≤0 → alert.
  - Credit method (contains 'אשראי', not 'חיצונית') → opens the credit modal.
  - Otherwise appends `{amount, method, notes}` to `paymentsList` **without any approval**. This includes the method "יציאה באישור מנהל" (see I-84).
- **I-53** "סיום ויצירת ההזמנה" (`saveOrder`, `P:1101-1190`), checked in this order:
  1. Customer present.
  2. Customer has phone1 or phone2.
  3. Dates present.
  4. At least one item.
  5. `validateDeliveryFields`.
  6. Past date (relevant date: fromDate for abroad/weekday, otherwise eventDate, compared to today at 00:00) → PIN `feature:past_date_order_approval`.
  7. Unless the method is manager-exit: paid + current amount < total → alert "לא ניתן לסיים הזמנה לפני תשלום מלא…".
  8. Credit method with amount >0 → open the credit modal (return).
  9. If manager-exit, or a non-credit amount >0, and `PAYMENT_APPROVAL_LEVEL` ∈ {מנהל, עובד, מנהל סניף ומעלה} (default 'כולם' = no prompt) → `customAuthPrompt` + verify-pin with `feature:payment_exit_approval`.
  10. Build the final payments: manager-exit adds a **0-amount** row with notes "יציאה באישור מנהל (סכום מבוקש: ₪X) | notes"; otherwise the current amount is added when >0.
  11. `executeSaveOrderForList`.
- **I-54** Nedarim credit modal (`P:2767-2843`):
  - Fields: card number (formatted in groups of 4, maxLength 19, also parses a magnetic-stripe string with `=` or `^`), expiry MM/YY (auto-slash), amount (number), installments (number, HTML min 1 / max 12 only), notes. No CVV field.
  - "העברה מהירה" opens the swipe modal. It has a hidden auto-focused input that parses the track data and re-opens the credit modal (`P:210-246`, `P:2845-2870`).
  - Submit "בצע חיוב ושמור הזמנה" → `handleProcessCreditCard` (`P:293-381`):
    1. Card number, expiry and amount are required.
    2. If there is no draft or reserved number, `POST /api/orders/reserve` claims an order number (an `isDeleted` placeholder row with status 'שמור לחיוב', `reserve/route.js`) and points the draft ref at it.
    3. `POST /api/nedarim` with clientName, phone1, full address, card, expiry, amount, installments, notes "…; באמצעות תכנת הגמח; מס הזמנה: N", zeout/idNumber, and email.
  - On success, a payment `{amount, method: payment.method, notes:'אישור נדרים: conf | notes'}` is appended. If paid ≥ total → `executeSaveOrderForList` right away. Otherwise alert "תשלום חלקי עבר בהצלחה…".
  - On failure, the error is shown in a callout.
- **I-55** `/api/nedarim` server (`app/api/nedarim/route.js`):
  - Refuses when `nedarim_plus_enabled='false'`.
  - Mosad id comes from the `NEDARIM_MOSAD_ID` env var, then the setting `nedarimMosadId` / `NEDARIM_MOSAD` / `nedarim_plus_terminal`, then `data.mosadId`.
  - Uses `nedarim_plus_token`, decrypted.
  - Uses the `nedarim_rinat_lev_url` override when the name, notes or email matches /רינת.?לב/.
  - Calls `chargeNedarimPlus`.
- **I-56** Delivery: fields as in I-17. Validation is shared (`lib/deliveryValidation.js`):
  - City is required when the customer's city is not a key of `delivery_price_by_city`.
  - Address is required when the delivery city ≠ the customer's city.

  It is checked on the client (step-2 button, saveOrder) and on the server (`orders/route.js:739-750`). The charge is created by `applyDeliveryCharge` after the create (`:959`).
- **I-57** Abroad / long occupancy: the date range, the price markup (I-47), and the server stores `eventDate = fromDate` (`orders/route.js:762`). There is no weekday-event UI (I-18).
- **I-58** Hebrew dates are shown through `getHebrewDateString` in the stepper, the summary and the eventDate label (`P:1394-1396`, `P:2418-2420`). Server: `eventDateHebrew = getHebrewDateString(effectiveEventDate)` (`orders/route.js:768`; the draft does the same, `draft/route.js:92`).
- **I-59** Hok (standing-order details, `hok_enabled`): collected on the order (existing customer) or on newCustomer. Sent as the JSON string `hokDetails` `{bankName,bankBranch,bankAccount,consent}` (`P:1244-1261`). For a new customer the fields are also stored on the Customer row.

---

## 7. Submit – exact calls and payload

- **I-60** `executeSaveOrderForList(payments, force)` (`P:1212-1351`):
  - Seals the autosave (`draftSealedRef=true`) and awaits the draft queue.
  - `POST /api/orders` with this payload (`P:1263-1298`):
    `customerId, eventDate, eventDateHebrew(''), returnDate(''), isAbroad, isWeekdayEvent(false), fromDate, toDate, notes, customSpacing, totalAmount, items[{dressModelId,dressName,sizeText,sampleItemId,quantity:1,basePrice,finalPrice,repairs,neckAlteration,sleeveAlteration,lengthAlteration}], isDelivery, deliveryDirection, deliveryAddress, deliveryCity, isPhoneOrder, branch, pickupBranch, deliveryOneDayBefore, [hokDetails], paymentsList[{amount,method,notes}], reservedOrderId, draftOrderId, forceDuplicate`.
- **I-61** Server order of operations (`orders/route.js:652-1094`):
  1. Reject `data.orderId` if that order exists (never sent by this page).
  2. Max items.
  3. Derive `status` / `cartStatus` from the payments: confirmed if paid >0, OR manager-approval, OR total 0. Status is 'שולם' / 'שולם חלקי' / 'חדש'.
  4. Validate inventory (409).
  5. Reconcile dress item ids.
  6. Delivery validation (400).
  7. Null customSpacing if `hide_custom_spacing`.
  8. Duplicate check: same customer + eventDate + fromDate + toDate, not deleted, status not in {טיוטה, שמור לחיוב} → 409 `{duplicateOrder, existingOrderId}` unless `forceDuplicate`.
  9. Fill the draft / reserved shell row (delete its items and update, in a transaction). If a reserved shell can no longer be filled → save under a new number and add a warning.
  10. Otherwise create with max(orderId)+1, retrying up to 5 times on P2002.
  11. `cleanupSiblingDraftOrders`.
  12. `recalculateOrderObligations` (on failure → warning).
  13. `applyDeliveryCharge`.
  14. Re-read the order.
  15. Manual `AuditLog` rows for the nested OrderItem/Payment creates.
  16. Auto email, if `auto_email_on_order_create='true'` and the customer has an email (fire-and-forget `sendSystemEmail`, `:1008-1061`).
  17. Mailing-list log row, if `mailing_list_auto_sync='true'`.
  18. Return the order JSON (+`warning`).
- **I-62** Client handling of the response:
  - 409 duplicate → abandon the save (autosave resumes) and show the duplicate-order modal.
  - 409 validationErrors → itemized alert.
  - Other non-OK → throw → `alert('שגיאה בשמירת הזמנה: …')` and abandon.
  - Success:
    - `alert(warning)` if there is one.
    - If `auto_print_on_order_create='true'`, `window.open('/print/order?orderId=N&type=order')`.
    - Then `router.push(resolveOrderRedirectHref(order_new_redirect_screen || 'order', {orderId, customerId}))`. Targets: order card (default), new order, orders list, customer card, rentals, home (`lib/orderRedirectScreens.js`).
- **I-63** Duplicate-order modal (`P:2739-2765`): "הזמנה זו כבר נשמרה" + a link to the existing order. "שמור בכל זאת כהזמנה נפרדת" → retry with `force=true` and the same payments. "אבדוק את הקיימת" → close. It cannot be closed with the backdrop.

---

## 8. States: loading, empty, errors, drafts

- **I-64** Loading indicators:
  - "מחפש..." on the phone check.
  - "(בודק זמינות...)" next to sizes.
  - "מחשב מחירים..." in the cart.
  - The refresh button is disabled while the preload or sizes are loading.
  - A full-screen blocking overlay while `saving || isProcessingCredit`: "מבצע חיוב מול נדרים פלוס" or "יוצר את ההזמנה" (`P:2873-2892`).
  - Escape closes the swipe, credit or capacity modal, except while busy (`P:1090-1099`).
- **I-65** Empty states: "בחר דגם כדי לראות מידות זמינות." / "אין מידות זמינות לתאריך זה." (`P:2214-2216`), the empty cart (`P:2339-2342`), and "טרם נרשמו תשלומים" (`P:2555-2558`).
- **I-66** Server-side autosave draft (`P:1001-1047`): debounced 1.5s and serialized through a promise queue. It starts only once there is a customer + dates + ≥1 item, and not after the draft is sealed. It calls `POST /api/orders/draft` with `{orderId(draft), customerId, eventDate, eventDateHebrew, returnDate, isAbroad, isWeekdayEvent, fromDate, toDate, notes, customSpacing, totalAmount, items}`.
  - The route (`draft/route.js`) validates inventory, reconciles ids, and creates or updates an Order with status 'טיוטה'. Items get `cartStatus:'pending'`, so they are released after `inventory_hold_minutes`.
  - It cleans up sibling drafts and runs the pricing engine.
  - **Delivery, branch, phone-order, pickupBranch, deliveryOneDayBefore and hok are not saved in the draft.** Failures are only logged to the console.
  - A toast "נשמרה טיוטה #N" (2.8s) plus the top-bar link (`P:1370-1382`).
- **I-67** There is **no restore** of an in-progress new order on this screen (nothing is read from localStorage or the draft on mount). An abandoned draft can only be continued by opening `/orders/{id}` (the orders list or the top-bar link).
- **I-68** Back-button guard (`P:1049-1086`): once anything has been entered (customer, items, new-customer text or phone text), one `history.pushState` is added. A popstate asks with a native `window.confirm('יש נתונים שהוזנו…')`.
- **I-69** Exit-confirm modal (`P:2645-2673`): the text depends on whether a draft exists ("ההזמנה שמורה כטיוטה #N…" vs "…תמחק את מה שהוזן"). Buttons: "המשך בהזמנה", and "צא — הטיוטה נשמרה" / "צא בלי לשמור" → `/orders`. There is no `beforeunload` handler for tab close or refresh.
- **I-70** Error surfaces are mostly `alert()`. The credit modal has its own error callout. The settings, locations and preload fetch errors are only logged to the console.

---

## 9. SystemSetting keys and their effect

Client settings come from `fetchSharedJson('/api/settings', {ttl: TTL.STATIC})` (`P:383-404`). "missing" below means the row is absent.

| # | Key | Where | Effect | When missing |
|---|---|---|---|---|
| I-71a | `ALLOWED_PAYMENT_METHODS` | P:36 | CSV of payment-method options | defaults: credit / cash / manager exit |
| I-71b | `nedarim_plus_enabled` | P:45, P:2514; nedarim route | `'false'` hides the credit options and the "חיוב אשראי" button; the server refuses charges | enabled |
| I-71c | `track_branch_on_order` | P:410, P:2057 | "סניף ביצוע" select + localStorage prefill | hidden |
| I-71d | `branch_list` | P:2070, P:2085 | CSV of branch options | empty list |
| I-71e | `branches_enabled` | P:2076 | "סניף איסוף" select | hidden |
| I-71f | `phone_order_marker_enabled` | P:2034 | phone-order switch | hidden |
| I-71g | `delivery_show_in_order` | P:2030 | shows the delivery/branch/phone card unless `'false'` | **card shown** |
| I-71h | `enable_deliveries` | P:2096 | the delivery block itself | hidden (org2 = true, org1 = false per CLAUDE.md) |
| I-71i | `delivery_price_by_city` | P:148-168; calculate; orders POST; pricingEngine | city options, "known city" list, prices | city options fall back to customer cities |
| I-71j | `delivery_price` | calculate:134; pricingEngine | flat delivery price fallback | then 50 |
| I-71k | `delivery_allow_address_override` | P:2126 | always shows the address field | shown only when required |
| I-71l | `delivery_one_day_before_option` | P:2137 | "one day before" checkbox | hidden |
| I-71m | `mandatory_fields` | P:490 | extra required customer fields (email/city/street/houseNum); server enforces only with strict | none |
| I-71n | `mandatory_field_groups` | P:535,596, …; customers POST | "at least one of" groups; soft PIN override on the client, **hard 400 on the server** | `[['phone2','email']]` |
| I-71o | `require_customer_email` | P:506, P:1840; customers POST | email required | off |
| I-71p | `require_full_address` | P:507, P:1867; customers POST | city + street + houseNum required | off |
| I-71q | `hide_marketing_consent_field` | P:512, P:1898 | hides the consent checkbox | shown |
| I-71r | `require_marketing_consent` | P:512, P:1902 | consent required | off |
| I-71s | `require_customer_id_number` | P:530, P:1892; customers POST | ID required for a new customer (org2-oriented) | off |
| I-71t | `require_id_for_edit_cancel` | P:1894 | hint label only | no hint |
| I-71u | `strict_mandatory_fields` | P:610; customers POST | hard block on an existing customer with missing fields; server enforces `mandatory_fields` | soft confirm |
| I-71v | `max_items_per_order` | P:875; orders POST:681 | item cap (client alert + server 400) | no cap |
| I-71w | `enforce_strict_max_items` | orders POST:682 | read, but has no effect on the outcome | — |
| I-71x | `enable_alterations` | P:854, 2252, 2350, 2451 | `'false'` hides alterations | shown |
| I-71y | `hide_custom_spacing` | P:1978, 1994, 2423; orders POST:755; inventory | hides spacing; the server nulls it | shown |
| I-71z | `PAYMENT_APPROVAL_LEVEL` | P:1154 | enables the payment-exit approval prompt (מנהל / עובד / מנהל סניף ומעלה) | `'כולם'` = no prompt |
| I-71aa | `hok_enabled` | P:1245, 1517, 1907 | hok fields | hidden |
| I-71ab | `auto_print_on_order_create` | P:1337 | opens the print tab after save | off |
| I-71ac | `order_new_redirect_screen` | P:1342 | redirect target after save | `'order'` |
| I-71ad | `inventory_buffer_days`, `inventory_skip_weekends`, `inventory_include_warehouse`, `allow_renting_reserve_items`, `inventory_hold_minutes` | preload route, `lib/inventory.js` | availability math | 3 / true / false / false / 15 |
| I-71ae | `ENABLE_SET_DISCOUNTS`, `gap_size_price_rule` | calculate route, pricing engine | pricing | off / '' |
| I-71af | Pricing-engine keys (`REFUND_*`, `NO_REFUND_DAYS_BEFORE_EVENT`, `CANCELLATION_CREDIT_MINUTES`, `premium_*`, `swap_*`, `instant_undo_minutes`, `same_model_swap_no_fee`, `refund_tiers_at_deletion_time`) | `lib/pricingEngine.js:7-23` | real obligations after save | engine defaults |
| I-71ag | `auto_email_on_order_create`, `gmach_name`, `gmach_address`, `gmach_phone`, `standard_pickup_hours`, `standard_return_hour` | orders POST:1009-1019 | confirmation email and its content | off / 'גמ"ח שמלות' / '' / '' / '20:00-21:30' / '13:00' |
| I-71ah | `mailing_list_auto_sync` | orders POST:1065 | EmailLog "subscribed" row | off |
| I-71ai | `nedarimMosadId` / `NEDARIM_MOSAD` / `nedarim_plus_terminal`, `nedarim_plus_token`, `nedarim_rinat_lev_url` | nedarim route | charge config | error "מספר מוסד לא מוגדר" |
| I-71aj | `require_login` | via `checkAuth()` / PageGate | anonymous access | — |

- **I-72** **Not used by this page**, despite appearing in related descriptions:
  - `enable_local_order_drafts`: `app/lib/orderDrafts.js` is imported only by `app/orders/[id]/page.js` and `app/orders/page.js`.
  - `enable_rental_extension`: referenced only by `ModernGeneralDetails.js`.
- **I-73** Org-dependent: everything above is a per-org DB row; the code is the same for both orgs. Per the comments, `require_customer_id_number` and `enable_deliveries` / delivery price table are Neve Yaakov (org2) oriented (`P:526-529`, `customers/route.js:140-144`).

---

## 10. Dialogs / alerts / confirms / PIN prompts

- **I-74** Custom modals in the page:
  - Spacing "רגע, בדקת מלאי?" (`P:2608-2636`).
  - `CapacitySearchModal` (`P:2638-2643`).
  - `ItemCapacityModal` (`P:2599-2606`).
  - Exit confirm (`P:2645`).
  - Duplicate customer (`P:2675`).
  - Duplicate order (`P:2739`).
  - Credit charge (`P:2767`).
  - Quick swipe (`P:2845`).
  - Busy overlay (`P:2873`).
- **I-75** `window.customConfirm`: accept a missing-fields exception (`P:624`) and remove a cart item (`P:2362`). Native `window.confirm`: the back-button guard (`P:1076`).
- **I-76** PIN prompts, each followed by verify-pin:
  - Blocked customer (`'הנהלה ראשית'`).
  - Missing contact, new and existing customer (`feature:missing_contact_approval`).
  - Special spacing (`feature:special_spacing_approval`).
  - Past date (`feature:past_date_order_approval`).
  - Payment exit (`feature:payment_exit_approval`, conditional).

  All of them except the spacing and payment-exit prompts go through `verifyPin` (`components/orders/modern/mocAuth.js`). On failure it shows `alert(data.error)` and returns null.
- **I-77** Plain `alert()` messages, by trigger:
  - Invalid phone; customer search error.
  - Missing mandatory fields; missing ID.
  - Customer save errors.
  - Strict missing fields.
  - "יש לבחור לקוח".
  - Abroad date order; inventory shortfalls on a date change; validation fetch error.
  - No size selected; all sizes sold out; max items; partially skipped sizes.
  - Save preconditions: phone, dates, items, delivery.
  - "לא ניתן לסיים הזמנה לפני תשלום מלא…".
  - "אישור תשלום בוטל."
  - Verify-pin errors.
  - Amount ≤0.
  - Partial credit success.
  - Server warning; save errors.
  - The stepper locked reason.
  - "לא נמצא דגם…" (OrderModelSelector).

---

## 11. Notable / possibly buggy (factual, with the evidence)

- **I-80** **Blocked-customer and mandatory-field checks can be bypassed through the stepper.**
  - On the "מהרשימה" tab, choosing a customer sets `customerId` at once (`P:1752`). `canNavigateToStep(2)` requires only `customerId` (`P:57`), and `handleStepChange` jumps straight there (`P:1443-1445`) without calling `proceedToStep2`.
  - So clicking "תאריכים" in the stepper skips `confirmBlockedCustomerOverride`.
  - The server has no `isBlocked` check (I-36).
- **I-81** **The new-customer "missing contact" PIN override cannot work.** The client asks for a PIN to bypass `mandatory_field_groups` (`P:535-541`), but `POST /api/customers` then hard-rejects the same condition with 400 "חובה למלא לפחות אחד מבין…" (`customers/route.js:139,187-189`).
- **I-82** **Charging the card directly skips `saveOrder`'s checks.** The "חיוב אשראי" button (`P:2520-2524`) → a full payment → `executeSaveOrderForList` straight away (`P:368-369`). This skips the past-date PIN, the customer-phone check, the date/items checks and `PAYMENT_APPROVAL_LEVEL`. Inventory, delivery and max items are still enforced on the server.
- **I-83** **A card payment is recorded with the dropdown's method, not as credit.** The Nedarim success row uses `method: payment.method` (`P:361`). If the dropdown shows e.g. "מזומן" when "חיוב אשראי" is clicked, the payment is saved as cash, with notes "אישור נדרים…".
- **I-84** **"אישור תשלום" with "יציאה באישור מנהל" records a real, unapproved payment.** `handleAddPaymentClick` appends any non-credit method with its amount and no approval (`P:1206-1208`). The server then counts it as paid (`orders/route.js:700,705`), so the status becomes 'שולם'.
- **I-85** **The payment-approval prompt ignores whether there is a shortfall.** When `PAYMENT_APPROVAL_LEVEL` ≠ 'כולם', the prompt fires for any non-credit amount >0 typed in the field at finish, even when it covers the full total (`P:1153`). Meanwhile, payments added earlier with "אישור תשלום" never prompt. With the default 'כולם', manager exit needs no approval at all.
- **I-86** The mandatory-field / strict / missing-contact checks run only on the phone-hit and duplicate-modal paths (`handleUseExistingCustomer`). The name-search path only shows a warning (`P:1777-1795`, `P:636-643`).
- **I-87** The phone lookup uses `search=`, which does not search `phone2` (`customers/route.js:38-47`). A customer known only by phone2 is reported as "not found" and pushed toward creating a new card. The duplicate check afterward (`?phone=`) does search phone2.
- **I-88** Dead or unused state:
  - `creditProcessedConfirmation` is never set (`P:182`), so the check at `P:1137` is always true.
  - `isWeekdayEvent`, `returnDate` and `eventDateHebrew` are never set (I-18, I-19).
  - `enforce_strict_max_items` has no effect (I-71w).
  - `newItem.quantity` is unused (always 1).
- **I-89** The preview total can differ from the real obligations. The calculate route ignores premium pricing (compare `pricingCalc.js:99-110`), and the stored `Order.totalAmount` is the client preview. Status derivation uses that client `totalAmount` (`orders/route.js:702-705`).
- **I-90** The autosave draft omits the delivery, branch, phone-order, pickup and hok fields (`P:1017-1031`). A draft continued from `/orders/{id}` loses them.
- **I-91** The duplicate-order check uses `status: { notIn: [...] }` (`orders/route.js:834`). In SQL, NULL is excluded from `NOT IN`, so existing orders whose `status` is NULL (per CLAUDE.md, most legacy and recent rows) are never detected as duplicates. This is inferred from SQL semantics and was not run.
- **I-92** Switching from abroad back to a regular event leaves `fromDate` / `toDate` in state. They are still sent and stored on a non-abroad order (`P:1270-1271`, `orders/route.js:773-774`), and the duplicate check and sibling-draft cleanup match on them. Possible stale data; not verified at runtime.
- **I-93** The spacing approval threshold is hard-coded at 3 (`P:1456-1459`) instead of reading `inventory_buffer_days`.
- **I-94** "פירוט לתופרת" is labelled "* (חובה)" with a red border (`P:2295,2306`) but is auto-filled rather than enforced (`P:854-856`).
- **I-95** `editItem` removes the item from the cart before it is re-added (`P:958`). Abandoning the edit silently drops the item.
- **I-96** The size pill label shows the normal availability even when the custom-spacing value is the one that decides (`P:2241`).
- **I-97** The delivery/branch/phone card renders by default, because `delivery_show_in_order` missing counts as shown (`P:2030`). It can therefore appear with an empty body when `enable_deliveries`, the branch settings and the phone marker are all off.
- **I-98** `auto_print_on_order_create` calls `window.open` after several awaits (`P:1337-1339`), outside the click gesture. Browsers may block it as a popup. Possible, not verified.
- **I-99** The auto confirmation email is fire-and-forget on a serverless route (`orders/route.js:1059`, not awaited). This is the same pattern CLAUDE.md records as unreliable for the error-report email (PR #144). Possible.
- **I-100** A partial Nedarim charge lives only in React state until the final save. The draft never stores payments (`draft/route.js`, no payments). Closing the screen after a partial charge leaves the charge only in Nedarim, plus the reserved or draft row.
- **I-101** `houseNum` is sent through `parseInt` on customer create (`customers/route.js:213`). A value like "א" becomes NaN, which likely makes Prisma fail with a 500 "Failed to create customer". Not verified.
- **I-102** Several routes the page calls have no auth (`calculate`, `pricing`, `validate-inventory`; I-04). No route re-checks `page:orders_new`, the past date, payment approval or blocked customers on the server. Those gates exist only on the client.
