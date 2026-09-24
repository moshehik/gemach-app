# חוזה פונקציונלי — ארכיטיפ "אשף" (A3) על מסך ההזמנה החדשה `/orders/new`

> חולץ מהקוד בענף `main` (פרודקשן, commit `1060e1b`), **לא** מהגרסה המעוצבת-מחדש שבענף הזה. מקור: `app/orders/new/page.js` (להלן `P`) וכל מה שהוא משתמש בו — `components/orders/new/NewOrderShell.js`, `components/CustomerSelector.js`, `components/orders/OrderModelSelector.js`, `components/orders/ItemCapacityModal.js`, `components/CapacitySearchModal.js`, `components/HebrewDatePicker.js`, `components/HebrewDateRangePicker.js`, `lib/clientInventory.js`, `lib/deliveryValidation.js`, `lib/customerValidation.js`, `lib/orderRedirectScreens.js`, `components/orders/modern/mocAuth.js`, וכל ה-API שנקרא (טבלה §J). קובץ:שורה מתייחס ל-`main`.
> המלאי נכתב במלואו **לפני** בניית אב-הטיפוס. ציטוט של מלל ישן (בגרשיים) משמש רק לזיהוי ההתנהגות — באב-הטיפוס כל המלל נכתב מחדש. מספור: `WZ-n`. בדיקה נקודתית מול הקוד (הרשימה הזו נבנתה בעזרת סוכן חילוץ, ואז אומתו ידנית WZ-17, WZ-29, WZ-92, WZ-114, WZ-127 — תואמים).
> תאריך: 2026-09-24. אב-הטיפוס: `archetype-wizard.html`. מיפוי לסעיפי אב-הטיפוס: `README.md` §A3.

## A. Entry, routing, permissions

- **WZ-1** Two server gates, both via `PageGate` -> `canOpenPage(key)`: `app/orders/layout.js:7` gates `page:orders` (covers all of `/orders/**`), `app/orders/new/layout.js:4-5` gates `page:orders_new`. Opening the wizard needs BOTH. Denied -> `<NoAccessMessage />` (`app/components/PageGate.js:9-12`).
- **WZ-2** Catalog defaults for both keys are closed (`defaultForRoleId: () => false`), so only roleId 0/2 open it without an explicit permission row (`lib/permissionsMetadata.js:175-196`).
- **WZ-3** Page is a pure client component (`'use client'`, `P:1`); no `useSearchParams`/query params are read anywhere - no `customerId`/prefill/deep-link support exists (verified by grep: no `searchParams` in P).
- **WZ-4** No local-draft restore banner in this page: `app/lib/orderDrafts.js` and `enable_local_order_drafts` are NOT imported/read by P (grep). They are used only by `app/orders/[id]/page.js:15,286` and `app/orders/page.js:18`. The wizard's only "draft" is the server-side autosave (WZ-120).
- **WZ-5** Page title "הזמנה חדשה" + top-bar actions rendered by `NewOrderShell` (`components/orders/new/NewOrderShell.js:21-26`).
- **WZ-6** Top bar: when a server draft exists, a link "טיוטה #N" opens `/orders/{draftOrderId}` in a new tab (`P:1552-1556`); an X icon button calls `handleExit` (disabled while busy) (`P:1557-1559`).
- **WZ-7** `handleExit`: if any active item or a customer is selected -> opens exit-confirm modal; else `router.push('/orders')` (`P:1502-1508`).
- **WZ-8** Exit-confirm modal text differs: draft exists -> says order saved as draft #N with X items; else warns data will be lost. Buttons: "continue" (close) / "exit" -> `router.push('/orders')` (label changes by draft presence) (`P:2645-2673`). Backdrop click closes.
- **WZ-9** Redirect after successful save: `router.push(resolveOrderRedirectHref(settings.order_new_redirect_screen || 'order', { orderId, customerId }))` (`P:1342-1345`). Values: `order` (default) -> `/orders/{orderId}`; `new_order` -> `/orders/new`; `orders_list` -> `/orders`; `customer` -> `/customers/{customerId}` (fallback `/orders`); `rentals` -> `/rentals`; `dashboard` -> `/` (`lib/orderRedirectScreens.js:6-28`). `orderId`/`customerId` come from the POST /api/orders response body (full order row).
- **WZ-10** Auto-print after save: if `auto_print_on_order_create === 'true'` and response has `orderId` -> `window.open('/print/order?orderId={id}&type=order', '_blank')` before redirect (`P:1337-1339`).
- **WZ-11** A server-side warning (`data.warning`, reservation-number mismatch and/or pricing failure) is shown via `alert` but the redirect still happens (`P:1333`; server `app/api/orders/route.js:937-952,1084-1086`).
- **WZ-12** No success toast/`enqueueNotice` after save (grep: not used); success = redirect only. The only toast is the draft-saved flash (WZ-123).

## B. Steps / stepper / footer

- **WZ-13** Five steps, fixed order and ids: 1 `לקוח`, 2 `תאריכים`, 3 `פריטים`, 4 `סיכום`, 5 `תשלום` (`P:1415-1440`). No conditional steps.
- **WZ-14** `datesFilled` = (`isAbroad || isWeekdayEvent`) ? `fromDate && toDate` : `eventDate` (`P:59,1385`).
- **WZ-15** `canNavigateToStep`: 1 always; 2 needs `customerId`; 3 needs customer + datesFilled; 4 and 5 need customer + datesFilled + `order.items.length > 0` (`P:55-71`). Steps 4 and 5 have identical rules.
- **WZ-16** Locked reasons (shown as `title` tooltip on the node and via `alert` on click): step 2 "יש לבחור לקוח תחילה"; step 3 "יש למלא תאריכים תחילה"; steps 4 and 5 "יש להוסיף לפחות פריט אחד להזמנה" (`P:1422,1427,1432,1437,1442-1449`). Note step 3's reason does not mention a missing customer.
- **WZ-17** Per-node summary value (shown as "· value"): 1 = customer full name when selected; 2 = Hebrew date (or "from — to" Hebrew range for abroad) when datesFilled; 3 = "{n} פריטים · ₪{total}" when items; 4 = '' when items exist, "בדיקה אחרונה" when NO items (looks inverted, see K); 5 = "שולם ₪{totalPaid}" when totalPaid > 0 (`P:1415-1440`, `eventDateLabel` `P:1394-1396`).
- **WZ-18** Stepper node UI: done (id < current) shows a check icon instead of number; current has `aria-current="step"`; locked nodes get opacity .6, `not-allowed` cursor, `tabIndex -1`; click and Enter/Space call `onStepChange` (`NewOrderShell.js:36-60`).
- **WZ-19** Step body re-mounts on step change (`<section key={step}>` with fade-in) (`NewOrderShell.js:63`).
- **WZ-20** Footer, "חזור" (back one step) shown when step > 1, disabled while busy (`P:1564-1568`).
- **WZ-21** Footer step 1: "ביטול" (= `handleExit`) and "המשך" (-> `proceedToStep2`, disabled when no `customerId`) (`P:1569-1577`).
- **WZ-22** Footer step 2: "המשך לבחירת פריטים" -> step 3; disabled when `!datesFilled` OR `validateDeliveryFields(...)` returns an error (`P:1578-1582`).
- **WZ-23** Footer step 3: "המשך לסיכום" -> step 4; disabled when no active items (`P:1583-1587`).
- **WZ-24** Footer step 4: "המשך לתשלום" -> step 5; never disabled (`P:1588-1592`).
- **WZ-25** Footer step 5: "סיום ויצירת ההזמנה" -> `saveOrder`; disabled while busy; shows spinner "שומר..." while saving (`P:1593-1597`).
- **WZ-26** Stepper jump (`handleStepChange`) only checks `canNavigateToStep`; it does NOT run the blocked-customer override, nor the delivery-field validation that disables the step-2 footer button (`P:1442-1449`) - see K.

## C. Step 1 - customer

- **WZ-27** Three tabs (`searchMode`): `phone` "לפי טלפון" (default), `name` "מהרשימה", `new` "לקוח חדש" (`P:72,1606-1631`). Clicking the phone tab also clears previous phone results.
- **WZ-28** Phone tab input: `inputMode=tel`, LTR, autofocus, Enter triggers check; button "בדיקה והמשך" with spinner "מחפש..." (`P:1633-1663`).
- **WZ-29** `handleCheckPhone`: requires trimmed input length >= 9 characters (length, not digit count), else alert "נא להזין מספר טלפון תקין" (`P:445-449`).
- **WZ-30** Phone lookup: `GET /api/customers?search={phone}&limit=20` (`P:453`). Server `search` ORs firstName/lastName/phone1/email/city contains + multi-word name (`app/api/customers/route.js:36-48`) - phone2 is NOT searched by this call.
- **WZ-31** No match -> prefills `newCustomer.phone1` with the typed number and switches to the `new` tab (`P:457-460`). Error -> alert "שגיאה בחיפוש הלקוח".
- **WZ-32** Matches -> list of cards. If >1 match: warning "נמצאו N לקוחות עם מספר טלפון זה" (`P:1668-1673`). Each card: initials avatar, full name, "לקוח חסום" badge if `isBlocked`, line with phone1 · phone2 · email · city, street houseNum (`P:1674-1695`).
- **WZ-33** Per matched card, missing-mandatory warning "חסר ללקוח: ..." (from WZ-44 + field-group short labels) plus a link "עריכת פרטי לקוח" to `/customers/{uuid}` in a new tab (`P:1696-1715`).
- **WZ-34** Hok (standing-order) fields card shown on the phone result only when exactly one match and `hok_enabled === 'true'` (`P:1716`, `renderHokFieldsForExistingCustomer` `P:1516-1541`): bank, branch, account (LTR), consent checkbox; stored on `order.hok*`.
- **WZ-35** Per card button "כן, זה הלקוח" -> `handleUseExistingCustomer`; a second "עריכת פרטי לקוח" link button appears when mandatory fields or field groups are missing (`P:1717-1726`).
- **WZ-36** Bottom button "אף אחד מאלה - לקוח חדש": prefills phone1 from the search input, clears results, switches to `new` (`P:1729-1740`).
- **WZ-37** Name tab: `CustomerSelector` (label "חיפוש לפי שם, טלפון או עיר"). Selecting sets `customerId` + `selectedCustomer`; clearing resets both (`P:1744-1756`).
- **WZ-38** CustomerSelector search: debounce 300 ms (`components/CustomerSelector.js:54`), `GET /api/customers?search={q}&limit=50` with AbortController; runs whenever the dropdown is open, even with an empty query (shows first 50, default sort `legacyId desc`) (`CustomerSelector.js:68-97`; sort default `app/api/customers/route.js:14-15`). No minimum characters.
- **WZ-39** CustomerSelector result row: `firstName lastName`, "לקוח חסום" badge, `phone1 | city`, and a third line `phone2 · email` when present (`CustomerSelector.js:143-171`). Empty -> "לא נמצאו לקוחות." (only when query non-empty and not loading) (`:175-179`). Loading text "טוען..." inside input (`:258-260`). Clear (X) button resets and re-opens (`:114-124,214-257`). Dropdown rendered in a portal, closes on outside mousedown.
- **WZ-40** When input still shows the selected customer's display string and dropdown opens, the query is treated as empty (full list) (`CustomerSelector.js:63-65`).
- **WZ-41** Name tab selected-customer panel: name, phone1, blocked badge, "עריכה" link to `/customers/{uuid}` (new tab), phone2 · email line, missing-mandatory warning + edit link; hok fields (if `hok_enabled`) (`P:1757-1798`).
- **WZ-42** Name-tab path does NOT run the missing-mandatory / missing-contact / strict checks of `handleUseExistingCustomer`; only the footer "המשך" (`proceedToStep2`) runs the blocked-customer override (`P:636-643`). See K.
- **WZ-43** New-customer form fields (`newCustomer` state `P:128-130`): firstName*, lastName*, phone1* (type tel, LTR, placeholder "נייד או קווי"), phone2, email (with a "השלם ל- @gmail.com" button shown while the value has no "@", appends `@gmail.com`) (`P:1815-1855`). Collapsible "פרטים נוספים": city (datalist of all customer cities), street (datalist of all streets), houseNum, zeout (ID, LTR), marketingConsent checkbox (hidden if `hide_marketing_consent_field === 'true'`), hok card (if `hok_enabled`) (`P:1865-1930`). Submit button "שמור לקוח והמשך" (`P:1932-1934`).
- **WZ-44** Mandatory computation `getMissingMandatoryCustomerFields` (`P:498-516`): always firstName, lastName, phone1; plus any of email/city/street/houseNum listed in `mandatory_fields` (comma list, matched against aliases `P:472-480`, case-insensitive); plus email if `require_customer_email`; city+street+houseNum if `require_full_address`; marketingConsent if `require_marketing_consent` and consent field not hidden.
- **WZ-45** Asterisks: phone2/email show `*` dynamically via `isFieldRequiredByGroup` (only while the other group members are empty) (`P:1836,1840`; `lib/customerValidation.js:92-96`); email also `*` if `require_customer_email` or picker-mandatory; city/street/houseNum `*` if `require_full_address` or picker-mandatory; ID `*` if `require_customer_id_number`, else hint "(לעריכה/ביטול עתידי)" when `require_id_for_edit_cancel === 'true'` (`P:1871-1895`).
- **WZ-46** Field-group errors (`mandatory_field_groups`, JSON array of arrays; missing/invalid -> default `[['phone2','email']]`; `'[]'` = none) render live under the contact row as "חובה למלא לפחות אחד מבין: ..." (`P:1856-1858`; `lib/customerValidation.js:46-63,73-77`).
- **WZ-47** "פרטים נוספים" auto-opens when any of: `require_full_address`, picker-mandatory city/street/houseNum, required marketing consent (and not hidden), `require_customer_id_number` (`P:1865-1868`; `NocCollapsible` `P:2901-2917`).
- **WZ-48** Enter in a new-customer field moves focus to the next visible, enabled non-checkbox field; on the last one it submits (`P:429-443`).
- **WZ-49** Hint in new tab when a phone was typed in the phone tab: "לא נמצא לקוח עם הטלפון שהוזן..." with a button to switch to name search (`P:1807-1814`).
- **WZ-50** `handleSaveNewCustomerAndProceed` order of checks (`P:518-574`): (1) missing mandatory -> alert "יש למלא: ..." and stop; (2) `require_customer_id_number` and empty zeout -> alert "יש למלא: תעודת זהות"; (3) unsatisfied field groups -> `verifyPin(..., 'feature:missing_contact_approval')`, cancel stops; (4) duplicate check `GET /api/customers?phone={phone1}&limit=20` (server matches phone1 OR phone2 contains) - any hit opens the duplicate modal and stops (fetch errors ignored); (5) `POST /api/customers` with the whole `newCustomer` object; success -> sets customer and jumps to step 2; failure -> alert "שגיאה בשמירת לקוח: {error}".
- **WZ-51** Duplicate-customer modal: title singular/plural, per candidate name + blocked badge, phones (LTR), city ("לא צוינה" fallback), missing-fields warning + edit link, button "השתמש בלקוח הזה" (-> `handleUseExistingCustomer`); footer "ביטול" and "צור לקוח חדש בכל זאת" (re-submits with `skipDuplicateCheck=true`) (`P:2675-2737`).
- **WZ-52** No client-side phone/email/ID FORMAT validation in the wizard; the server rejects on POST with joined Hebrew errors: invalid Israeli phone (`/^0\d{8,9}$/` on digits), invalid email, bad ID checksum, phone2 == phone1, ID already used by another active customer (`app/api/customers/route.js:170-185`; `lib/customerValidation.js:5-107`).
- **WZ-53** Server POST /api/customers also enforces `require_customer_email`, `require_full_address`, `require_marketing_consent` (unless hidden), `mandatory_field_groups`, `require_customer_id_number`, and (only if `strict_mandatory_fields`) `mandatory_fields` - fail-open if the settings read throws (`app/api/customers/route.js:120-192`). It assigns `legacyId = max+1`, `houseNum` parsed with `parseInt`, email normalized (`:194-223`). Note: server field-group enforcement is unconditional, so the client's manager-PIN override (WZ-50 step 3) does not actually let a new customer be created without the group (see K).
- **WZ-54** Blocked customer (`isBlocked`): `confirmBlockedCustomerOverride` asks `verifyPin(message incl. blockedReason, 'הנהלה ראשית')` - verify-pin allows only `HEAD_MANAGEMENT_ROLES` for that level (`P:581-588`; `app/api/auth/verify-pin/route.js:67-69`). Called from `handleUseExistingCustomer` and `proceedToStep2`. Hardcoded role level, not a catalog key.
- **WZ-55** `handleUseExistingCustomer` (`P:592-634`): blocked override -> compute missing fields + field groups; if anything missing: `strict_mandatory_fields === 'true'` -> hard alert, stop; else if a field GROUP is missing -> `verifyPin(..., 'feature:missing_contact_approval')`; else (only plain fields missing) -> `window.customConfirm` (any employee). Then set customer, go to step 2, clear duplicates.
- **WZ-56** Customer display name helper treats `'null'`/`'undefined'` strings as empty, fallback "לקוח ללא שם"; none selected -> "לא נבחר" (`P:20-25`).

## D. Step 2 - dates / event / delivery / branch

- **WZ-57** Pill toggle "אירוע רגיל" / "חו\"ל / תפוסה ארוכה" sets `isAbroad` through `handleDateChangeWithValidation` (`P:1945-1958`).
- **WZ-58** Regular: required `HebrewDatePicker` for `eventDate` (`P:1961-1965`). Abroad: required `HebrewDateRangePicker` for `fromDate`/`toDate` (`P:1966-1975`).
- **WZ-59** No UI control sets `isWeekdayEvent` (stays `false`, `P:84`), although every date rule, the payload and the server support it (grep: never set true in P).
- **WZ-60** `eventDateHebrew` and `returnDate` are never set by the UI (stay `''`); server derives `eventDateHebrew` from the effective date (`app/api/orders/route.js:768`).
- **WZ-61** HebrewDatePicker: trigger shows the Hebrew date string (+ " - פרשת X" for Saturdays); popup = month grid of Hebrew day letters with day/month/year selects, prev/next month, "today", close, apply; Saturday cells show parasha name; today highlighted; clicking a day applies immediately and emits `YYYY-MM-DD` (`components/HebrewDatePicker.js:26-160,480-520`). No disabled/past/Shabbat-blocked days (grep: no min/disabled logic). No Gregorian dates are shown in the picker itself.
- **WZ-62** HebrewDateRangePicker: two consecutive Hebrew month panels, first click always starts a new range, earlier click than start swaps, "נקה בחירה", "ביטול", "אישור בחירה" (disabled until both ends) emits `onChange(start,end)`; Escape closes; presets exist (`applyPreset`) (`components/HebrewDateRangePicker.js:47-160,410-445`).
- **WZ-63** `hide_gregorian_calendar` is NOT read by this page; it is applied globally as a body class `hide-gregorian-calendar` in `app/layout.js:128-131,282-283` (effect on this page unverified).
- **WZ-64** `handleDateChangeWithValidation` (`P:750-819`): abroad `toDate < fromDate` -> alert and reject; when abroad and fromDate/isAbroad changes, `eventDate` is set = fromDate; if the cart has active items -> `POST /api/orders/validate-inventory` with the proposed dates/spacing and `orderId: draftOrderId`; `error` -> alert "שגיאה בבדיקת מלאי"; `!valid` -> itemized alert "- {dressName} (מידה X): חסרים N במלאי" (+ "(בגלל ציפוף)" and a spacing hint) and the change is rejected; network error -> alert, rejected. Only then is state updated.
- **WZ-65** Switching back from abroad to regular keeps the old `fromDate`/`toDate` in state and in the payload (`P:763-766,1270-1271`) - see K.
- **WZ-66** No client-side rule on past dates here; a past date is allowed in step 2 and gated at save time (WZ-129).
- **WZ-67** No buffer-day/weekend/Shabbat rule is enforced in the date UI; those only affect availability math (`inventory_buffer_days`, `inventory_skip_weekends`, returned by preload, WZ-83).
- **WZ-68** Collapsible "הערות וריווח ימים" (title "הערות" when `hide_custom_spacing === 'true'`); badge shows spacing label or "יש הערה" (`P:1977-1980`). Contains `notes` textarea (`P:1981-1992`).
- **WZ-69** Custom spacing pills (hidden when `hide_custom_spacing === 'true'`): רגיל(null), ללא(0), יום(1), יומיים(2), 3 ימים(3), 4 ימים(4); hint text: default / "ציפוף מיוחד..." (warning color when <3) / "ריווח מורחב..." (`P:1994-2026`). Labels via `spacingLabel` (`P:1398-1400`).
- **WZ-70** `handleSpacingChange`: if new value (null treated as 3) < 3 AND < previous value -> opens "רגע, בדקת מלאי?" modal; else applies via `handleDateChangeWithValidation('customSpacing', val)` (`P:1455-1465`).
- **WZ-71** Spacing modal: button "פתח חיפוש תפוסה מהיר" opens `CapacitySearchModal`; "ביטול"; "כן, המשך" -> `customAuthPrompt(..., 'feature:special_spacing_approval')` + `POST /api/auth/verify-pin`; success -> applies via inventory-validated change (`P:1467-1490,2608-2643`).
- **WZ-72** Server ignores/zeros `customSpacing` when `hide_custom_spacing === 'true'` (`app/api/orders/route.js:752-757`); the draft route does not apply this rule (`app/api/orders/draft/route.js:99`).
- **WZ-73** "משלוח / סניף / טלפוני" card shown when `phone_order_marker_enabled === 'true'` OR `track_branch_on_order === 'true'` OR `branches_enabled === 'true'` OR `delivery_show_in_order !== 'false'` (`P:2030`). Since the last condition defaults true, the card is shown by default even if it ends up empty.
- **WZ-74** Phone-order switch (`phone_order_marker_enabled`): toggles `isPhoneOrder`; turning it on clears `branch`; keyboard Enter/Space supported (`P:2034-2052`).
- **WZ-75** Execution branch select (`track_branch_on_order`): options from `branch_list` (comma list); choosing a branch clears `isPhoneOrder` and remembers it in `localStorage['gemach_last_order_branch']` (`P:2057-2075`). On load, the remembered branch pre-fills when branch empty and not a phone order (`P:409-415`).
- **WZ-76** Pickup branch select (`branches_enabled`): options from `branch_list` -> `pickupBranch` (`P:2076-2090`).
- **WZ-77** Delivery block only when `enable_deliveries === 'true'`: checkbox "הזמנת משלוח" -> `isDelivery` (`P:2096-2103`).
- **WZ-78** When `isDelivery`: direction select הלוך / חזור / הלוך-חזור (default `הלוך-חזור`, `P:92`) (`P:2106-2113`).
- **WZ-79** Delivery city select: options = keys of `delivery_price_by_city` JSON; if empty/invalid -> all customer cities from `/api/customers/locations`; current value is always kept as an option (`P:148-157,2114-2125`).
- **WZ-80** Delivery address input shown when `delivery_allow_address_override === 'true'` OR address is required (`P:2126-2136`).
- **WZ-81** Delivery rules (`lib/deliveryValidation.js`): city required when isDelivery and customer city is empty or not a key of `delivery_price_by_city` (`:18-22`); address required when isDelivery and deliveryCity and customer city are both set and differ (`:9-13`). Inline red hints and `*` (`P:2115-2134`); enforced by the step-2 footer button (WZ-22), at save (`P:1113-1114`), and server-side in POST /api/orders (`app/api/orders/route.js:739-750`).
- **WZ-82** "Delivery one day before" checkbox when `delivery_one_day_before_option === 'true'` -> `deliveryOneDayBefore` (`P:2137-2144`).

## E. Step 3 - items

- **WZ-83** Inventory preload: whenever (abroad ? from&&to : eventDate) is set, `GET /api/inventory/preload?isAbroad=&eventDate=&fromDate=&toDate=[&excludeOrderId=draftId]` -> `{ settings:{bufferDays,skipWeekends}, stock:{modelId:{size:{total,itemId}}}, bookings:[{m,s,q,eD,fD,tD}] }` (`P:645-677`; `app/api/inventory/preload/route.js:18-190`). Condition uses only `isAbroad` (not `isWeekdayEvent`).
- **WZ-84** Preload server rules: stock excludes `notInUse`, `isDeleted`, `inRepair`, and locations containing מחסן/warehouse unless `inventory_include_warehouse`, רזרבה/reserve unless `allow_renting_reserve_items`; bookings window ±60 days; expired pending carts (older than `inventory_hold_minutes`, default 15, non-legacy, not taken, no barcode) are ignored (`preload/route.js:36-136`).
- **WZ-85** Refresh button (icon) re-fetches preload with a `_t` cache-buster; disabled while preloading or computing sizes (`P:679-707,2200-2209`).
- **WZ-86** Model selector `OrderModelSelector` (label "דגם *"): 300 ms debounced `GET /api/inventory/models?q={q}&hasActiveItems=true` via shared cache (TTL 2 min) (`components/orders/OrderModelSelector.js:76-93`; `P:2170-2192`). Server: `isDeleted:false`, `exitDateFromRepo:null`, name contains q OR `barcodePrefix == parseInt(q)`, and at least one item not deleted and not `notInUse`; ordered by name (`app/api/inventory/models/route.js:12-32`). Empty query lists all.
- **WZ-87** Model row shows tag icon, name (or barcodePrefix when name starts with "ללא שם"), and "קוד: {barcodePrefix}" (`OrderModelSelector.js:106-110,185-196`).
- **WZ-88** Enter in the model field resolves typed text to an exact (case-insensitive) name or barcodePrefix match, re-querying if needed; no match -> alert "לא נמצא דגם עם השם/קוד ..." (`OrderModelSelector.js:121-146`). Clear button resets model (`:148-160`).
- **WZ-89** Choosing a model sets `dressModelId`, `dressName`, clears selected sizes; clearing resets all three (`P:2174-2190`).
- **WZ-90** Size availability is computed locally by `calculateDynamicAvailability(modelId, min, max, cache, order.items, customSpacing)` whenever dates/spacing/model/cache/cart change; resets selected sizes unless `preserveSize` (edit flow) (`P:709-740`).
- **WZ-91** Availability math (`lib/clientInventory.js:101-170`): valid dates = range days (Fri/Sat skipped when skipWeekends); booked per size = Access occupancy formula over ±bufferDays (`:26-38,58-99`); available = max(0, total − booked − inCart) where inCart counts this cart's items of same model+size; returns per size `{sizeText,totalInStock,sampleItemId,availableQuantity,withNormalBuffer:{availableQuantity,bufferDays},withCustomSpacing:{availableQuantity,bufferDays,gain}|null}`, sorted by `sortSizeRows`.
- **WZ-92** Size pills (multi-select toggle): label "{size} · {normalAvail} פנויות" or "· אזל"; disabled + struck-through when effective availability (custom if spacing set, else normal) is 0; "+gain" in green when custom spacing gains units; tooltip "זמין: N" or "רגיל: N | ציפוף: M (+g)" (`P:2212-2250`). The count shown is always the NORMAL count, even when spacing is set.
- **WZ-93** Empty states: no model -> "בחר דגם כדי לראות מידות זמינות."; model with no sizes -> "אין מידות זמינות לתאריך זה." (`P:2213-2216`); "(בודק זמינות...)" while computing (`P:2198`).
- **WZ-94** Alterations collapsible "תיקונים לפריט" only when `enable_alterations !== 'false'`: toggles neck / sleeve, length (free text, cm) and "פירוט לתופרת" text (`repairs`), marked "* (חובה)" and red-bordered when any alteration chosen and text empty (`P:2252-2310`). Badge shows summary; auto-opens when alterations chosen.
- **WZ-95** The "required" repairs text is NOT enforced: on add, empty repairs with alterations chosen are auto-filled by `describeAlterations` (e.g. "צוואר, אורך (3)") (`P:853-856,1409-1413`).
- **WZ-96** Add button "הוסף לסל" / "הוסף N פריטים לסל", disabled when no size selected (`P:2312-2321`).
- **WZ-97** `addItemToOrder` (`P:842-923`): requires ≥1 size; re-checks each selected size against current `availableSizes` (≤0 -> unavailable); all unavailable -> alert and stop; `max_items_per_order` (int >0) -> alert if cart + new > max; fetches price per size `GET /api/orders/pricing?dressModelId=&sizeText=&eventDate=` (error -> basePrice 0); adds one cart row per size `{dressModelId,dressName,sizeText,sampleItemId,quantity:1,basePrice,finalPrice,repairs,neckAlteration,sleeveAlteration,lengthAlteration}`; keeps the model selected, clears sizes/alterations; alerts sizes skipped as sold out.
- **WZ-98** Quantity is always 1 per row; the same model+size may be added repeatedly as separate rows as long as availability allows (no dedupe).
- **WZ-99** `/api/orders/pricing` returns `{basePrice, ruleId, category}` from `PriceList` by model `priceCategory` (fallback category 'כללי') and numeric size, honoring `gap_size_price_rule`; no match -> basePrice 0, category "לא נמצא מחירון" (`app/lib/pricing.js:13-71`). Displayed prices come from `/api/orders/calculate` instead (WZ-104).
- **WZ-100** Cart card "בסל · N": per row name (fallback "דגם לא ידוע"), size, alterations description (if alterations enabled), price (calculated else item.finalPrice); actions: capacity check (calendar), edit, remove (with `customConfirm`) (`P:2325-2368`). Total "סה\"כ" = totalAmount. Spinner "מחשב מחירים..." while calculating. Empty -> "טרם הוספת פריטים להזמנה".
- **WZ-101** Edit item: loads the row into the add form (`preserveSize` keeps its size selected) and REMOVES it from the cart immediately; scrolls to mid-page (`P:944-960`).
- **WZ-102** Remove item: splices row; also optimistically +1 on the displayed size if same model (redundant with recompute) (`P:925-942`).
- **WZ-103** Capacity modal (`ItemCapacityModal`): uses `order.eventDate` ±1 month; resolves barcodePrefix (fetching `/api/inventory/models` if needed); `GET /api/inventory/capacity?barcodePrefix=&size=&fromDate=&toDate=`; shows KPI "במלאי" (`inStock`), "בתפוסה מתוכננת" (`occupiedCount`), "רזרבה זמינה" (`reserve`), list/calendar of `occupiedOrders`; errors for no event date / no model / no size (`components/orders/ItemCapacityModal.js:16-80,116-180`).
- **WZ-104** Notes textarea repeated at the bottom of step 3 bound to the same `order.notes` (`P:2384-2397`).
- **WZ-105** No reserve-item manager override and no overbooking path in the wizard: unavailable sizes cannot be selected; reserve stock only counts if `allow_renting_reserve_items` (server). Server re-validates at draft and final save (409).
- **WZ-106** `max_items_per_order` also enforced by POST /api/orders (400 "לא ניתן להזמין יותר מ-N שמלות...") regardless of `enforce_strict_max_items` (read but has no effect) (`app/api/orders/route.js:680-689`). The draft route does not enforce it.

## F. Step 4 - summary + pricing

- **WZ-107** Price calc effect: whenever items/eventDate/isAbroad/isWeekdayEvent/isDelivery/deliveryCity/deliveryDirection change and cart non-empty -> `POST /api/orders/calculate {items,eventDate,isAbroad,isWeekdayEvent,isDelivery,deliveryCity,deliveryDirection}`; stores `totalAmount` and `calculatedItems` (`P:963-991`). Empty cart -> total 0. Errors silently ignored (keeps previous value).
- **WZ-108** Calculate response (`app/api/orders/calculate/route.js`): per item `{...item, calculatedPrice, repairsCost, isDiscountedSet}` (model not found -> `{...item, finalPrice:0}` with no `calculatedPrice`); `totalAmount` = Σ items + delivery; `deliveryAmount` = city price (or `delivery_price`, else 50) × (2 if הלוך-חזור else 1). Item price = price-row price × abroad markup (PriceList category 'חול'/'חו"ל' price as %) + repair prices (PriceList 'תיקונים' "תיקון צוואר"/"תיקון שרוול", 'תיקון אורך' by size range). `ENABLE_SET_DISCOUNTS`: items whose category contains "כלול ב" are zeroed while main-dress count lasts. `isWeekdayEvent` is sent but ignored (`:10`).
- **WZ-109** Summary card "פרטי ההזמנה": customer name + phone1, dates (Hebrew; abroad "מ-X עד Y"), spacing row (only if spacing set and not hidden), notes row; "עריכה" button -> step 1 (`P:2406-2435`).
- **WZ-110** Items card "פריטים (N)": per row "name · size", alterations line with "(+₪repairsCost)" (if alterations enabled), price; scrollable (max 42vh); "סה\"כ לתשלום" = totalAmount (`P:2437-2470`).
- **WZ-111** Summary does NOT show delivery/branch/phone-order/hok, nor the delivery amount line (included in the total only) - see K.
- **WZ-112** No manual price override or discount entry anywhere in the wizard; obligations are created server-side after save by `recalculateOrderObligations` + `applyDeliveryCharge` (`app/api/orders/route.js:946-959`). Pricing failure after save -> warning, order kept.
- **WZ-113** `repairsTotal` is computed but never used (`P:1392`).

## G. Step 5 - payment

- **WZ-114** Payment method options (`computePaymentMethodOptions`, `P:35-48`): `ALLOWED_PAYMENT_METHODS` comma list if set, else default `['אשראי (דרך נדרים פלוס)','מזומן','יציאה באישור מנהל']`; if `nedarim_plus_enabled === 'false'`, any option containing "אשראי" but not "חיצונית" is removed (empty result -> `['יציאה באישור מנהל']`). On settings load `payment.method` is set to the first option (`P:395-398`); before load it is `'אשראי'` (`P:138`).
- **WZ-115** Payment form: amount (number; auto-set to remaining balance whenever total or payments change, `P:995-999`), method select, collapsible "הערה לתשלום" (`P:2481-2508`).
- **WZ-116** "אישור תשלום" (form submit, `handleAddPaymentClick` `P:1192-1210`): amount must be > 0; credit method (contains "אשראי" and not "חיצונית") -> opens credit modal; any other method -> appended to `paymentsList` immediately with no approval and notes cleared. Manager-exit ("יציאה באישור מנהל") can also be added this way as a normal positive payment row (see K).
- **WZ-117** "חיוב אשראי" button (only when `nedarim_plus_enabled !== 'false'`) always opens the credit modal pre-filled with current amount and notes, regardless of selected method (`P:2514-2528`).
- **WZ-118** Credit modal (`P:2767-2843`): "העברה מהירה" (magnetic swipe) button; error callout; fields card number (auto-grouped by 4, maxLength 19, parses swipe track strings containing `=` or `^` into number + MM/YY), expiry MM/YY (auto slash), amount, installments (1-12 input, not validated), notes to Nedarim. No CVV field and no ID field (ID sent from customer record). Buttons "ביטול", "בצע חיוב ושמור הזמנה". Backdrop/Escape closes unless processing.
- **WZ-119** Quick-swipe modal: hidden auto-focused input keeps focus; on a parsable track it fills card+expiry and re-opens the credit modal after 150 ms (`P:210-246,2845-2870`).
- **WZ-120** `handleProcessCreditCard` (`P:293-381`): requires card, expiry, amount; order number for the Nedarim comment = draftOrderId, else reservedOrderId, else `POST /api/orders/reserve {customerId}` -> `{orderId}` (placeholder row status "שמור לחיוב", `isDeleted:true`), which also becomes the draft id; then `POST /api/nedarim {clientName, phone, address (street houseNum city), cardNumber (no spaces), tokef (no slash), amount, installments, notes "…; מס הזמנה: N", zeout (idNumber||zeout), email}`. Success -> closes modal, appends payment `{amount, method: payment.method, notes: "אישור נדרים: {conf} | {notes}"}`; if total paid ≥ total -> immediately `executeSaveOrderForList`; else alert "תשלום חלקי עבר בהצלחה...". Failure -> `creditError` = server error or "שגיאה בחיוב הכרטיס"; network -> "שגיאת תקשורת בחיוב הכרטיס".
- **WZ-121** Server `/api/nedarim`: 400 if `nedarim_plus_enabled === 'false'`; mosad id from env `NEDARIM_MOSAD_ID`, else setting `nedarimMosadId`/`NEDARIM_MOSAD`/`nedarim_plus_terminal`, else body; missing -> 400; optional encrypted `nedarim_plus_token`; `nedarim_rinat_lev_url` override when the name/notes/email match "רינת לב"; returns `{success, confirmation|error, rawResponse}` (`app/api/nedarim/route.js:9-93`; `app/lib/nedarim.js:111-165`).
- **WZ-122** Payments list "תשלומים שנרשמו": method, notes, amount, remove button; payments whose notes contain "אישור נדרים" cannot be removed (disabled + tooltip) (`P:1492-1500,2549-2584`). Empty -> "טרם נרשמו תשלומים".
- **WZ-123** Totals card: "סה\"כ חיובים" (totalAmount), "שולם" (Σ paymentsList), "יתרה" (red when >0) (`P:2534-2547`). Remaining > 0 -> hint explaining that finishing without full payment requires choosing "יציאה באישור מנהל" in the method list (`P:2586-2590`).
- **WZ-124** `saveOrder` (final button) order of checks (`P:1101-1190`): customer selected; customer has phone1 or phone2 (else alert); dates; ≥1 item; delivery validation; past-date approval (WZ-129); then payment logic.
- **WZ-125** Full-payment rule: unless method is "יציאה באישור מנהל", `paid + current amount < total` -> alert "לא ניתן לסיים הזמנה לפני תשלום מלא..." and stop (`P:1130-1135`).
- **WZ-126** If current amount > 0 and credit method (and `creditProcessedConfirmation` null - it is never set, so always) -> opens credit modal and stops (`P:1137-1148`); the charge then saves (WZ-120).
- **WZ-127** Approval gate: for manager-exit, or a non-credit payment with amount > 0: if `PAYMENT_APPROVAL_LEVEL` (default 'כולם') is 'מנהל' / 'עובד' / 'מנהל סניף ומעלה' -> `customAuthPrompt(..., 'feature:payment_exit_approval')` + verify-pin; cancel -> alert "אישור תשלום בוטל."; any other level (incl. default 'כולם') -> no approval (`P:1150-1181`).
- **WZ-128** Final payment list: manager-exit appends `{method, amount:0, notes:"יציאה באישור מנהל (סכום מבוקש: ₪X) | notes"}`; other method with amount > 0 appends `{...payment, amount}` (`P:1183-1189`).
- **WZ-129** Past-date gate: if (abroad/weekday ? fromDate : eventDate) is before today -> `verifyPin(..., 'feature:past_date_order_approval')`, cancel stops (`P:1116-1122`). Runs before any charge in `saveOrder`.
- **WZ-130** `executeSaveOrderForList(list, force)` (`P:1212-1351`): seals the autosave and awaits its queue; items' `finalPrice` replaced by `calculatedItems[idx].calculatedPrice` (by index); optional `hokDetails` JSON (only when `hok_enabled`, from order.hok* else newCustomer.hok*); `POST /api/orders`.
- **WZ-131** POST /api/orders payload fields: `customerId, eventDate, eventDateHebrew, returnDate, isAbroad, isWeekdayEvent, fromDate, toDate, notes, customSpacing, totalAmount, items[], isDelivery, deliveryDirection, deliveryAddress, deliveryCity, isPhoneOrder, branch, pickupBranch, deliveryOneDayBefore, [hokDetails], paymentsList[{amount,method,notes}], reservedOrderId, draftOrderId, forceDuplicate` (`P:1263-1298`). Item fields: `dressModelId, dressName, sizeText, sampleItemId, quantity, basePrice, finalPrice, repairs, neckAlteration, sleeveAlteration, lengthAlteration`.
- **WZ-132** Response handling: 409 + `duplicateOrder` -> duplicate-order modal (WZ-134); 409 + `validationErrors` -> itemized stock alert; other non-OK -> alert "שגיאה בשמירת הזמנה: {error} ({details})"; network/exception -> same alert; all failures re-open the autosave (`abandonSave`) (`P:1306-1350`).
- **WZ-133** Server POST /api/orders flow (`app/api/orders/route.js:652-1094`): auth; reject client `orderId` of existing order (409); max items (400); status/cartStatus: confirmed if paid > 0, any manager-exit payment, or total 0, else pending; status 'שולם' / 'שולם חלקי' / 'חדש'; inventory validation excluding draft/reserved id (409 `validationErrors`); `reconcileDressItemIds`; delivery validation (400); spacing zeroed if hidden; `eventDate` = fromDate for abroad/weekday; duplicate check same customer + identical eventDate/fromDate/toDate, not deleted, status not draft/reserved (409 `{duplicateOrder, existingOrderId}`) unless `forceDuplicate`; fills the draft/reserved shell row (replacing its items) or allocates max+1 with retry; cleans sibling drafts; pricing engine + delivery charge; audit rows for nested items/payments; optional auto email (`auto_email_on_order_create`, customer email with "@", fire-and-forget) and mailing-list log (`mailing_list_auto_sync`); returns the full order (`items, obligations, payments, customer`) + optional `warning`.
- **WZ-134** Duplicate-order modal: "הזמנה זו כבר נשמרה", link to `/orders/{existingOrderId}` (new tab), "שמור בכל זאת כהזמנה נפרדת" (re-runs save with same payments and `force=true`), "אבדוק את הקיימת" (close) (`P:1353-1361,2739-2765`). No backdrop close.
- **WZ-135** Reservation mismatch: if a card was charged under a reserved number that is no longer fillable, the server saves under a new number and returns a warning to fix the Nedarim note manually (`app/api/orders/route.js:890-894,937-939`).
- **WZ-136** Charge success then save failure: the payment stays in `paymentsList` (non-removable), screen stays open for retry (`P:1222-1225,1346-1350`).

## H. States / guards / keyboard

- **WZ-137** Busy overlay (saving or charging): full-screen alertdialog with spinner; charging text "מבצע חיוב מול נדרים פלוס" / saving text "יוצר את ההזמנה" (`P:1510,2872-2892`).
- **WZ-138** Server draft autosave: 1500 ms debounce after any change to customer/dates/notes/spacing/items/total, only when customer + dates + ≥1 active item and not sealed; serialized queue; `POST /api/orders/draft {orderId, customerId, eventDate, eventDateHebrew, returnDate, isAbroad, isWeekdayEvent, fromDate, toDate, notes, customSpacing, totalAmount, items}` -> stores `orderId` (`P:1005-1047`). Failures only logged; a non-OK response (e.g. 409 stock) is silently ignored.
- **WZ-139** Draft server (`app/api/orders/draft/route.js`): reuses the row only if it is still a shell (draft without payments, or reserved placeholder), else creates a new number; validates stock (409); items saved with `cartStatus:'pending'` (released after `inventory_hold_minutes`); status 'טיוטה'; replaces items wholesale; cleans sibling drafts for the same customer/date on create; runs pricing engine. Draft payload omits delivery/branch/phone-order/hok fields.
- **WZ-140** Draft-saved flash toast "נשמרה טיוטה #N" for 2.8 s, once per draft id (`P:1366-1382`; `NewOrderShell.js:29-34`).
- **WZ-141** Browser-back guard: once anything is entered (customer, items, new-customer input, phone search text) a history entry is pushed; Back then asks `window.confirm` and either re-pushes or goes back (`P:1049-1086`). No `beforeunload` handler (grep) - tab close/refresh is not guarded (the server draft is the safety net).
- **WZ-142** Escape closes the top modal (quick swipe, credit, capacity) unless charging/saving (`P:1088-1099`). Spacing/exit/duplicate modals are not covered by this handler.
- **WZ-143** Loading indicators: phone search spinner; CustomerSelector "טוען..."; model selector spinner; "(בודק זמינות...)"; "מחשב מחירים..." (step 3 only); save spinner. No page-level loading state for settings - settings-gated fields appear once `/api/settings` resolves (shared cache TTL 5 min, `P:383-404`; `lib/apiCache.js:53-55`). Settings fetch failure -> settings stay `{}` (all defaults).
- **WZ-144** Errors are surfaced via `alert` / `window.customConfirm` / `window.customAuthPrompt` (global `PopupProvider`, `app/components/PopupProvider.js:200-202`), except the credit modal's inline callout.
- **WZ-145** `/api/customers/locations` (cities/streets, distinct, sorted he) loaded once on mount (shared cache TTL 2 min) (`P:417-421`; route `app/api/customers/locations/route.js`).

## I. SystemSetting keys

Client (read in P unless noted). "Default" = value/behaviour when the row is missing.

| Key | Default when missing | Effect | Org note |
|---|---|---|---|
| `mandatory_fields` | '' | extra required customer fields (WZ-44) | unverified |
| `mandatory_field_groups` | `[['phone2','email']]` | one-of groups, PIN override (client), hard on server (WZ-46/50/53) | unverified |
| `require_customer_email` | off | email required (WZ-44/53) | unverified |
| `require_full_address` | off | city/street/houseNum required | unverified |
| `require_marketing_consent` | off | consent required (unless hidden) | unverified |
| `hide_marketing_consent_field` | off (shown) | hides consent checkbox | unverified |
| `require_customer_id_number` | off | ID required for new customer | main false / NY true (given) |
| `require_id_for_edit_cancel` | off | shows hint next to ID label only | unverified |
| `strict_mandatory_fields` | off | existing customer with missing fields is hard-blocked (client); server enforces `mandatory_fields` on create | unverified |
| `hok_enabled` | off | hok fields + `hokDetails` in payload | unverified |
| `hide_custom_spacing` | off (shown) | hides spacing UI; server nulls spacing | main default / NY true (given) |
| `phone_order_marker_enabled` | off | phone-order switch | unverified |
| `track_branch_on_order` | off | execution-branch select + localStorage memory | unverified |
| `branches_enabled` | off | pickup-branch select | unverified |
| `branch_list` | '' | options for both branch selects | unverified |
| `delivery_show_in_order` | shown (`!== 'false'`) | shows the delivery/branch/phone card container | unverified |
| `enable_deliveries` | off | delivery fields | main false / NY true (given) |
| `delivery_price_by_city` | `{}` | city options, city-required rule, price (client + server) | NY only (given) |
| `delivery_allow_address_override` | off | always show address field | NY only (given "delivery_*") |
| `delivery_one_day_before_option` | off | one-day-before checkbox | NY only (given "delivery_*") |
| `delivery_price` (server, calculate + engine) | '0' -> 50 | flat delivery price fallback | NY only (given "delivery_*") |
| `enable_alterations` | on (`!== 'false'`) | alterations UI & text in cart/summary | main default / NY false (given) |
| `max_items_per_order` | no limit | client alert + server 400 | main default / NY 6 (given) |
| `ALLOWED_PAYMENT_METHODS` | 3 defaults | method list | unverified |
| `nedarim_plus_enabled` | on (`!== 'false'`) | credit options/button; server 400 | unverified |
| `PAYMENT_APPROVAL_LEVEL` | 'כולם' (no approval) | turns on `feature:payment_exit_approval` prompt | unverified |
| `auto_print_on_order_create` | off | opens print tab after save | main false / NY ? (given) |
| `order_new_redirect_screen` | 'order' | redirect target | unverified |

Server-only keys touched by this flow:
- `inventory_buffer_days` (3), `inventory_skip_weekends` (true), `inventory_include_warehouse` (false), `allow_renting_reserve_items` (false), `inventory_hold_minutes` (15) - preload + server validation (`app/api/inventory/preload/route.js:36-61`). Hand-changed only per CLAUDE.md.
- `enforce_strict_max_items` - read, no effect (`app/api/orders/route.js:682-688`).
- `ENABLE_SET_DISCOUNTS` (false), `gap_size_price_rule` ('') - calculate/pricing.
- `nedarimMosadId` / `NEDARIM_MOSAD` / `nedarim_plus_terminal`, `nedarim_plus_token`, `nedarim_rinat_lev_url` - `/api/nedarim`.
- `auto_email_on_order_create`, `gmach_name`, `gmach_address`, `gmach_phone`, `standard_pickup_hours` ('20:00-21:30'), `standard_return_hour` ('13:00'), `mailing_list_auto_sync` - after POST /api/orders.
- `hide_gregorian_calendar` - global body class in `app/layout.js`, not read by this page.
- NOT read by this flow despite being listed in the brief: `enable_local_order_drafts` (only the existing-order card).

## J. API calls

| # | Method + URL | Payload / params | Response fields used |
|---|---|---|---|
| 1 | GET `/api/settings` (public, shared cache) | - | array of `{key,value}` -> map |
| 2 | GET `/api/customers/locations` | - | `cities[]`, `streets[]` |
| 3 | GET `/api/customers?search=&limit=20` (phone tab) | search | `data[]` (id, legacyId, names, phone1/2, city, street, houseNum, email, isBlocked, blockedReason, zeout, marketingConsent) |
| 4 | GET `/api/customers?search=&limit=50` (CustomerSelector) | search | `data[]` |
| 5 | GET `/api/customers?phone=&limit=20` (duplicate check) | phone | `data[]` |
| 6 | POST `/api/customers` | whole `newCustomer` (firstName,lastName,phone1,phone2,email,city,street,houseNum,marketingConsent,zeout,[hok*]) | created customer row / `error` |
| 7 | POST `/api/auth/verify-pin` | `pin, employeeId, requiredLevel` | `success`, `error` |
| 8 | GET `/api/inventory/preload` | isAbroad, eventDate, fromDate, toDate, excludeOrderId, [_t] | `settings`, `stock`, `bookings` |
| 9 | POST `/api/orders/validate-inventory` (no auth check) | items, eventDate, isAbroad, isWeekdayEvent, fromDate, toDate, customSpacing, orderId | `error`, `valid`, `errors[]` |
| 10 | GET `/api/inventory/models?q=&hasActiveItems=true` | q | `models[]` (id, name, barcodePrefix, ...) |
| 11 | GET `/api/orders/pricing` (no auth check) | dressModelId, sizeText, eventDate | `basePrice` |
| 12 | POST `/api/orders/calculate` (no auth check) | items, eventDate, isAbroad, isWeekdayEvent, isDelivery, deliveryCity, deliveryDirection | `totalAmount`, `calculatedItems[].calculatedPrice/repairsCost` (`deliveryAmount` unused) |
| 13 | POST `/api/orders/draft` | see WZ-138 | `orderId` |
| 14 | POST `/api/orders/reserve` | customerId | `orderId` |
| 15 | POST `/api/nedarim` | see WZ-120 | `success`, `confirmation`, `error` |
| 16 | POST `/api/orders` | see WZ-131 | `orderId`, `customerId`, `warning`, `duplicateOrder`, `existingOrderId`, `validationErrors[]`, `error`, `details` |
| 17 | GET `/api/inventory/capacity` (ItemCapacityModal, CapacitySearchModal) | barcodePrefix, size, fromDate, toDate | `inStock`, `occupiedCount`, `reserve`, `occupiedOrders[]` |
| 18 | GET `/api/inventory/models` (capacity modal, no q) / `/api/inventory/sizes?barcodePrefix=` (CapacitySearchModal) | - | models / sizes |

## K. Known bugs / oddities (not fixed)

- **WZ-146** Stepper bypasses the blocked-customer override: in the name tab a blocked customer sets `customerId`, step 2 becomes enabled and a click on the stepper node goes there without `confirmBlockedCustomerOverride` (`P:57,1442-1449` vs `P:636-643`). POST /api/orders does not check `isBlocked` either.
- **WZ-147** Name-tab selection skips `handleUseExistingCustomer` entirely, so `strict_mandatory_fields`, missing-contact PIN and missing-field confirm are never applied on that path (`P:1750-1753`).
- **WZ-148** Stepper bypasses delivery validation of step 2 (footer disables, stepper does not), though `saveOrder` and the server re-check it (`P:1579` vs `P:62-69`).
- **WZ-149** Credit charge that covers the balance calls `executeSaveOrderForList` directly, skipping `saveOrder`'s checks: customer-phone check, past-date PIN (`feature:past_date_order_approval`) and client delivery check - reachable via the "חיוב אשראי" button or "אישור תשלום" with a credit method (`P:368-370`).
- **WZ-150** Payment recorded after a credit charge uses `method: payment.method` (the dropdown), so a charge started from "חיוב אשראי" while the dropdown says "מזומן" is saved as method "מזומן" (`P:359-363`).
- **WZ-151** Approval gate bypass: adding cash via "אישור תשלום" needs no approval; after that the remaining is 0 so `saveOrder` never hits the `PAYMENT_APPROVAL_LEVEL` gate (`P:1206-1208` vs `P:1153`). The gate's message talks about "exit without full payment" even when it fires for a full cash payment.
- **WZ-152** "יציאה באישור מנהל" added through "אישור תשלום" becomes a normal positive payment row with that method (not amount 0), and no approval (`P:1206-1207`).
- **WZ-153** With `PAYMENT_APPROVAL_LEVEL` missing/'כולם', "יציאה באישור מנהל" saves an unpaid order with no approval at all (`P:1154-1155`).
- **WZ-154** `creditProcessedConfirmation` is never set (`setCreditProcessedConfirmation` unused) - dead state (`P:182,1137`).
- **WZ-155** Server field-group enforcement on POST /api/customers makes the client's PIN override for missing contact (new-customer path) ineffective - the POST returns 400 anyway (`P:535-541` vs `app/api/customers/route.js:139`).
- **WZ-156** Phone lookup (`search=`) does not search `phone2`, while the duplicate check (`phone=`) does (`app/api/customers/route.js:38-47,52-58`).
- **WZ-157** Min phone length check is on characters (≥9), not digits (`P:446`).
- **WZ-158** `isWeekdayEvent` has no UI; preload only considers `isAbroad` (`P:646,680`) - consistent today only because weekday is never set.
- **WZ-159** Switching abroad -> regular leaves stale `fromDate`/`toDate` (and eventDate = old fromDate) that are sent and stored; they also take part in the server duplicate-order match (`P:763-773`, `app/api/orders/route.js:773-774,835-837`). Impact beyond storage unverified.
- **WZ-160** Stepper value for step 4 is '' when items exist and "בדיקה אחרונה" when empty - looks inverted (`P:1433`).
- **WZ-161** Summary shows no delivery/branch/phone-order info and no delivery line, yet the total includes `deliveryAmount` - item prices do not add up to the shown total when delivery is on (`P:2437-2470`; calculate `:128-144`).
- **WZ-162** Alterations "פירוט לתופרת" is labelled required but auto-filled instead of enforced (`P:2295` vs `P:854-856`).
- **WZ-163** Edit item removes it from the cart immediately; abandoning the edit loses the item (`P:944-960`).
- **WZ-164** `calculatedItems` are matched to cart rows by index; for a model not found the row lacks `calculatedPrice`, so saved `finalPrice` becomes `undefined` -> server stores 0 (`P:1232-1237`; calculate `:60-63`; `app/api/orders/route.js:795`).
- **WZ-165** `/api/orders/calculate`, `/api/orders/pricing` and `/api/orders/validate-inventory` have no `checkAuth` (routes read in full).
- **WZ-166** Blocked-customer override uses the hardcoded level 'הנהלה ראשית' rather than a catalog `feature:*` item (`P:583-586`) - contrary to the CLAUDE.md permissions standing rule.
- **WZ-167** Server duplicate-order check uses `status: { notIn: [...] }`; legacy orders with NULL status are excluded by SQL NOT IN semantics, so a duplicate against such an order is not detected (`app/api/orders/route.js:834`) - known NULL-status trap per CLAUDE.md; real-data impact unverified.
- **WZ-168** `enforce_strict_max_items` is read but has no effect (`app/api/orders/route.js:682-688`).
- **WZ-169** Draft autosave ignores `hide_custom_spacing`, `max_items_per_order` and delivery fields; a draft can hold spacing the final save will null (`app/api/orders/draft/route.js:88-102`).
- **WZ-170** Size pill shows the normal-buffer count as "N פנויות" even when custom spacing changes the effective count (`P:2241` vs `P:2221`).
- **WZ-171** `repairsTotal` computed and unused (`P:1392`); `removeItem` manually bumps availability that the effect recomputes anyway (`P:930-937`).
- **WZ-172** `window.confirm` (native) is used for the back-button guard while the rest uses `customConfirm` (`P:1076`).
- **WZ-173** Installments field has min/max attributes only; value is not validated before sending (`P:2826`, `P:346`).

## UI-only vs needs data

Provably pure presentation (all data already in client state or current responses):
- Stepper layout/labels/summary values, locked styling, footer placement (WZ-13..25): uses only `order`, `totalAmount`, `paymentsList`.
- Showing delivery/branch/phone-order/hok in the summary (WZ-111): all values are in `order` state.
- Showing a delivery line in the summary/cart: `deliveryAmount` IS already returned by `/api/orders/calculate` (`:144`) but not stored by the client (`P:984-987`) - needs only a client state change, no API change.
- Showing the custom-spacing count on size pills (WZ-170): `withCustomSpacing.availableQuantity` already computed.
- Showing totalInStock per size: already returned by `calculateDynamicAvailability`.
- Customer result rows / selected-customer panel (phone2, email, city, address, blocked badge, blockedReason, zeout, marketingConsent): all in `/api/customers` select.
- Model rows (name, barcodePrefix): returned by `/api/inventory/models` (full model rows).
- Fixing the inverted step-4 hint, empty/locked copy, loading indicators.

Needs data / API not currently returned or not currently called:
- Customer's existing/active orders, debts or history in step 1: `/api/customers` select has none of that.
- Per-customer order-count/last-order info on search results: not in the select.
- Price per size BEFORE adding to cart: only fetched at add time via `/api/orders/pricing` (one call per size); showing it on the pills needs extra calls or a batch endpoint (does not exist).
- Obligation-level breakdown (the rows the pricing engine creates after save, discounts, cancellation terms): not returned by `/api/orders/calculate`; only exists after POST /api/orders.
- Model images/thumbnails in the model dropdown: `/api/inventory/models` returns full `DressModel` rows (`thumbnailUrl` column exists per CLAUDE.md) - whether usable for display is unverified.
- Who is logged in / which approver roles exist before prompting: comes from `PopupProvider`/`GET /api/employees`, not this page (unverified in detail).
- A weekday-event ("isWeekdayEvent") option: server supports it, but its date rules in `/api/orders/calculate` are not implemented (flag ignored there).

## מטריצת org-variance (חוקה §ט.3) — לאשף
| חלק באשף | הבדל ידוע ראשי ↔ נווה יעקב (חוקה §ט.3, **לא אומת מול DB בריצה הזו**) | מפתחות | כשחסר / ריק | מצב קצה באב-הטיפוס |
|---|---|---|---|---|
| שדות לקוח חדש | ת״ז חובה רק בנווה יעקב | `require_customer_id_number`, `mandatory_field_groups`, `mandatory_fields`, `require_customer_email`, `require_full_address`, `require_marketing_consent`, `hide_marketing_consent_field`, `strict_mandatory_fields` | ברירת מחדל: שם+משפחה+טלפון, קבוצה [טלפון נוסף או מייל] | פרופיל "קיצוני": הכול חובה + מלל ארוך |
| משלוח | רק נווה יעקב | `enable_deliveries`, `delivery_price_by_city`, `delivery_allow_address_override`, `delivery_one_day_before_option`, `delivery_price`, `delivery_show_in_order` | כרטיס מוסתר; עיר ממיקומי לקוחות כשאין מפת מחירים | 1 / 3 / 12 ערים |
| סניף / הזמנה טלפונית | לפי DB | `track_branch_on_order`, `branches_enabled`, `branch_list`, `phone_order_marker_enabled` | אין כרטיס (אם גם משלוח כבוי) | רשימת סניפים ריקה / ארוכה |
| ציפוף ימים | מוסתר בנווה יעקב | `hide_custom_spacing` | מוצג | — |
| תיקונים לפריט | כבוי בנווה יעקב | `enable_alterations` | דלוק | — |
| מגבלת פריטים | 6 בנווה יעקב | `max_items_per_order` | בלי מגבלה | 6 |
| אופני תשלום | לפי DB | `ALLOWED_PAYMENT_METHODS`, `nedarim_plus_enabled` | 3 ברירות מחדל | רשימה של 1 / 6 |
| אישור יציאה בלי תשלום מלא | לפי DB | `PAYMENT_APPROVAL_LEVEL` | בלי אישור | — |
| אחרי שמירה | לפי DB | `order_new_redirect_screen`, `auto_print_on_order_create` | כרטיס ההזמנה, בלי הדפסה | — |
| הו״ק | לפי DB | `hok_enabled` | מוסתר | — |

## החלטות תצוגה באב-הטיפוס (לא שינוי לוגיקה — R8)
- **נעילת שלב** מוצגת כ-ⓘ עם הסיבה (לא `alert`). הסיבה של שלב 3 נכתבת לפי מה שבאמת חסר (לקוח או תאריך) — זו אותה בדיקה של `canNavigateToStep`, רק מלל מדויק יותר.
- **קפיצה בסטפר** עוברת את אותן בדיקות של כפתור "המשך" (חסימת לקוח, משלוח) — סוגר את WZ-146/WZ-148 בתצוגה בלבד. **שאלה פתוחה** ב-`LIST-WIZARD-QUESTIONS.md` (Q-W3).
- **ערך הצומת של "סיכום"** (WZ-160) — מוצג "מוכן לבדיקה" כשיש פריטים, ריק כשאין (תיקון של ההיפוך הנראה).
- **שורת משלוח בסיכום** (WZ-111/WZ-161) — `deliveryAmount` כבר מוחזר מ-`/api/orders/calculate`; מוצג, כך שסכום השורות = הסה״כ.
- **עריכת פריט** (WZ-163) — הפריט עדיין יוצא מהסל (כמו היום), אבל מוצג פס "עריכת פריט" עם "ביטול העריכה" שמחזיר אותו (מצב מקומי בלבד).
- **הערות** (WZ-104) — שדה אחד בשלב 2 (אותו `order.notes`), ובשלב 3 רק תצוגה עם "עריכה".
- כל `alert`/`confirm` הופך לחלונית לפי כללי השכבות; שגיאות שדה בתוך השדה.
