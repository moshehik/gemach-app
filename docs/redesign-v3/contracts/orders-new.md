# חוזה עמוד: הזמנה חדשה — `/orders/new`

> מקור: `app/orders/new/page.js` (2917 שורות, client component, `export default NewOrderPage`) + `app/orders/new/layout.js`.
> רכיבים מקומיים שהעמוד מרנדר: `NocCollapsible` (בתוך page.js:2901), `components/orders/new/NewOrderShell.js`, `components/CustomerSelector.js`, `components/orders/OrderModelSelector.js`, `components/orders/ItemCapacityModal.js`, `components/CapacitySearchModal.js`, `components/HebrewDatePicker.js`, `components/HebrewDateRangePicker.js`.
> ספריות: `lib/clientInventory.js`, `lib/deliveryValidation.js`, `lib/customerValidation.js`, `lib/orderRedirectScreens.js`, `lib/apiCache.js`, `lib/hebrewDate.js`, `components/orders/modern/mocAuth.js`.
> שרת (לצורך חוזה הגוף): `app/api/orders/route.js` POST (652), `app/api/orders/draft/route.js`, `.../reserve/route.js`, `.../calculate/route.js`, `.../pricing/route.js`, `.../validate-inventory/route.js`.
> כלל: שינוי קוסמטי בלבד (R8/R24). כל מה שכאן חייב להישמר 1:1.

---

## (א) מטרה והרשאות

- **מטרה:** אשף 5 שלבים ליצירת הזמנה: לקוח ← תאריכים ← פריטים ← סיכום ← תשלום. בשמירה יוצר `Order` + `OrderItem`s + `Payment`s בקריאת POST אחת, אחרי בדיקת מלאי, חיוב אשראי אופציונלי (נדרים פלוס), ואישורי מנהל לפי צורך.
- **גישה:** `app/orders/new/layout.js:4` → `<PageGate pageKey="page:orders_new">`. בנוסף `app/orders/layout.js` → `page:orders`. **נדרשים שניהם** (אין גישה בלי אחד מהם → `NoAccessMessage`).
- **מפתחות הרשאה נוספים שנבדקים בזמן ריצה (דרך `verifyPin` / `window.customAuthPrompt` → `POST /api/auth/verify-pin` עם `requiredLevel`):**
  | requiredLevel | מתי | מקום |
  |---|---|---|
  | `feature:missing_contact_approval` | לקוח חדש/קיים חסר אמצעי תקשורת לפי `mandatory_field_groups` (וללא `strict_mandatory_fields`) | page.js:539, 618 |
  | `הנהלה ראשית` | לקוח `isBlocked` — עקיפת חסימה | page.js:583 (`confirmBlockedCustomerOverride`) |
  | `feature:past_date_order_approval` | שמירה לתאריך שעבר | page.js:1120 |
  | `feature:payment_exit_approval` | יציאה באישור מנהל / תשלום לא-אשראי כש-`PAYMENT_APPROVAL_LEVEL` ∈ {מנהל, עובד, מנהל סניף ומעלה} | page.js:1159-1169 |
  | `feature:special_spacing_approval` | ציפוף מיוחד (<3 ימים ופחות מהנבחר עד כה) | page.js:1471-1477 |
- **API auth:** `POST /api/orders`, `/draft`, `/reserve`, `/customers`, `/inventory/preload` דורשים `checkAuth()` (401 אחרת).

---

## (ב) מבנה: אזורים / שלבים לפי סדר

מעטפת `NewOrderShell` (NewOrderShell.js) מציגה בסדר:
1. **`page-head`**: `<h1>הזמנה חדשה</h1>` + `page-actions` = `topBar` (page.js:1550).
2. **`flash` toast** (כשלא null): `.toast success|error` עם איקון `#i-check-circle`/`#i-alert-circle`.
3. **`<nav class="stepper stepper-compact" aria-label="שלבי ההזמנה">`** — 5 צעדים (`stepsMeta`, page.js:1415) עם קווי חיבור.
4. **`<section key={step} class="animate-fade-in">`** — גוף השלב.
5. **Footer** (border-top): כפתורי ניווט (`footer`, page.js:1562).

### Stepper (`stepsMeta`)
| id | label | enabled (`canNavigateToStep`, page.js:55) | lockedReason | value (מוצג אחרי `·`) |
|---|---|---|---|---|
| 1 | לקוח | תמיד | — | `selectedCustomerName` אם `order.customerId` |
| 2 | תאריכים | `!!order.customerId` | "יש לבחור לקוח תחילה" | `eventDateLabel` אם `datesFilled` |
| 3 | פריטים | customerId && datesFilled | "יש למלא תאריכים תחילה" | `${n} פריטים · ₪${totalAmount.toLocaleString('he-IL')}` אם n>0 |
| 4 | סיכום | customerId && datesFilled && items.length>0 | "יש להוסיף לפחות פריט אחד להזמנה" | "בדיקה אחרונה" כשאין פריטים פעילים (!) אחרת ריק |
| 5 | תשלום | כמו 4 | כמו 4 | `שולם ₪X` אם `totalPaid>0` |

`datesFilled` = `(isAbroad || isWeekdayEvent) ? (fromDate && toDate) : eventDate`. הערה: `canNavigateToStep(4/5)` בודק `order.items.length` (כולל מחוקים) בעוד ה-value משתמש ב-`activeItems` — `isDeleted` לא נקבע בשום מקום בעמוד הזה, כך שזהים בפועל.
לחיצה על צעד: `handleStepChange` (page.js:1442) — אם `canNavigateToStep` → `setStep(target)`; אחרת `alert(lockedReason)`. `NewOrderShell`: `done = s.id < step` (איקון `#i-check` במקום מספר), `isCurrent` (`aria-current="step"`), לא-מותר: `aria-disabled`, `title=lockedReason`, `opacity .6`, `cursor:not-allowed`. Enter/Space מפעילים.

### TopBar (page.js:1550)
- אם `draftOrderId`: קישור `<a class="btn btn-ghost" href="/orders/{draftOrderId}" target="_blank">` "טיוטה #N" (`#i-link`), `title="פתח את הטיוטה בכרטיסייה נפרדת"`.
- כפתור `btn-icon-only` `#i-x` "יציאה מהמסך" → `handleExit`, `disabled={busy}`.

### Footer (page.js:1562)
| שלב | כפתורים |
|---|---|
| >1 | "חזור" (`btn-secondary`, `#i-chevron-end`) → `setStep(step-1)`, disabled=busy |
| 1 | "ביטול" (`btn-ghost`) → `handleExit`, disabled=busy |
| spacer `flex:1` | |
| 1 | "המשך" (primary) → `proceedToStep2`, `disabled={!order.customerId}` |
| 2 | "המשך לבחירת פריטים" → `setStep(3)`, `disabled={!datesFilled || !!validateDeliveryFields(order, selectedCustomer?.city, deliveryPriceCities)}` |
| 3 | "המשך לסיכום" → `setStep(4)`, `disabled={activeItems.length===0}` |
| 4 | "המשך לתשלום" → `setStep(5)` (ללא disabled) |
| 5 | "סיום ויצירת ההזמנה" (`#i-check`) / בשמירה: spinner "שומר..." → `saveOrder`, `disabled={busy}`, `aria-busy={saving}` |

### שלב 1 — "מי הלקוח?" (`maxWidth:520px`, page.js:1602)
3 טאבים (`.tabs > button.tab[.active]`, מצב `searchMode`): "לפי טלפון" (`#i-phone`, ברירת מחדל `'phone'`; onClick גם מאפס `foundCustomersFromPhone`), "מהרשימה" (`#i-search`, `'name'`), "לקוח חדש" (`#i-user`, `'new'`).
- **`phone` ללא תוצאות:** כרטיס עם שדה טלפון + כפתור "בדיקה והמשך" + הערת hint.
- **`phone` עם תוצאות (`foundCustomersFromPhone.length>0`):** רשימת כרטיסי לקוח, כפתורי "כן, זה הלקוח" ו"עריכת פרטי לקוח" (מותנה), כפתור "אף אחד מאלה - לקוח חדש".
- **`name`:** `CustomerSelector` + כרטיס "נבחר" עם פרטים + אזהרת חסר + `renderHokFieldsForExistingCustomer()`.
- **`new`:** טופס לקוח חדש (שדות בסעיף ג) + `NocCollapsible "פרטים נוספים"` + כפתור "שמור לקוח והמשך".

### שלב 2 — "מתי האירוע?" (`maxWidth:520px`, page.js:1941)
1. `pill-tabs`: "אירוע רגיל" / `חו"ל / תפוסה ארוכה`.
2. כרטיס: תאריך אירוע (`HebrewDatePicker`) **או** טווח (`HebrewDateRangePicker`) לפי `isAbroad`.
3. `NocCollapsible` ("הערות וריווח ימים" / "הערות" כש-`hide_custom_spacing==='true'`): הערות כלליות + ריווח ימים (pill-tabs).
4. כרטיס "משלוח / סניף / טלפוני" (מותנה בהגדרות, ראו ג/ז).

### שלב 3 — "אילו פריטים?" (page.js:2156)
`.two-col`: (א) כרטיס "הוספת פריט" (דגם, מידות, תיקונים, כפתור הוספה) (ב) כרטיס "בסל" (רשימה + סה"כ). מתחת: כרטיס "הערות כלליות להזמנה" (`order.notes` — אותו שדה כמו שלב 2, id שונה `order-notes-step3`).

### שלב 4 — "סיכום" (`maxWidth:640px`, page.js:2402)
קריאה בלבד: כרטיס "פרטי ההזמנה" (לקוח, תאריכים, ריווח, הערות; כפתור "עריכה" → `setStep(1)`) + כרטיס "פריטים (N)" (גלילה `maxHeight:42vh`) + "סה"כ לתשלום".

### שלב 5 — "תשלום וסיום" (page.js:2475)
`.two-col`: (א) טופס תשלום (סכום, אופן תשלום, הערה מתקפלת, כפתורים "אישור תשלום" + "חיוב אשראי") (ב) כרטיס סיכום כספי (סה"כ חיובים / שולם / יתרה) + כרטיס "תשלומים שנרשמו" + הודעת יתרה.

### מודלים/שכבות (page.js:2599+) — ר' סעיף (ו).

---

## (ג) שדות וקלטים

### C0. State ראשי (page.js:53-210)
| state | ערך התחלתי |
|---|---|
| `step` | 1 |
| `searchMode` | `'phone'` (`'phone'|'name'|'new'`) |
| `phoneSearchInput` | `''` |
| `isCheckingPhone` | false |
| `foundCustomersFromPhone` | `[]` |
| `order` | `{customerId:'', selectedCustomer:null, eventDate:'', eventDateHebrew:'', returnDate:'', isAbroad:false, isWeekdayEvent:false, fromDate:'', toDate:'', notes:'', items:[], customSpacing:null, isDelivery:false, deliveryDirection:'הלוך-חזור', deliveryAddress:'', deliveryCity:'', deliveryOneDayBefore:false, isPhoneOrder:false, branch:'', pickupBranch:'', hokBankName:'', hokBankBranch:'', hokBankAccount:'', hokConsent:false}` |
| `newItem` | `{dressModelId:'', selectedSizes:[], quantity:1, repairs:'', dressName:''}` (+ אחר כך `neckAlteration`, `sleeveAlteration`, `lengthAlteration`, `preserveSize`) |
| `availableSizes` | `[]` |
| `customerLocations` | `{cities:[],streets:[]}` |
| `loadingSizes`, `loadingPreload`, `calculating`, `saving` | false |
| `capacityModalItem` | null |
| `pendingSpacingChange` | null (**null = אין; 0 הוא ערך תקין** — בדיקה `!== null`) |
| `showSpacingCapacitySearch` | false |
| `inventoryCache` | null |
| `calculatedData` | `{totalAmount:0, items:[]}` |
| `newCustomer` | `{firstName,lastName,phone1,phone2,email,city,street,houseNum:'', marketingConsent:false, zeout:''}` (+ דינמי `hokBankName/hokBankBranch/hokBankAccount/hokConsent`) |
| `duplicateCustomers` | `[]` |
| `paymentsList` | `[]` |
| `payment` | `{amount:'', method:'אשראי', notes:''}` (method נדרס ל-`opts[0]` כשההגדרות נטענות) |
| `settings` | `{}` |
| `showCreditModal`, `showQuickSwipeModal` | false |
| `swipeInput` | `''` |
| `creditCardData` | `{cardNumber:'', tokef:'', installments:1, notes:'', amount:''}` |
| `isProcessingCredit` | false; `creditError` `''`; `creditProcessedConfirmation` null (**אף פעם לא נקבע — תמיד null**) |
| `reservedOrderId` | null |
| `draftOrderId` | null; refs: `draftOrderIdRef`, `draftQueueRef` (Promise chain), `draftSealedRef` |
| `duplicateOrderWarning` | null; `pendingSavePaymentsRef` |
| `flash` | null; `showExitConfirm` false |

**הערה חשובה:** `order.isWeekdayEvent` אינו נקבע לאף ערך על ידי UI כלשהו בעמוד זה (אין מתג) — נשאר `false`, אך מופיע בכל בדיקות התאריכים ובגוף הבקשות. יש לשמור אותו ב-payload גם אם אין UI.

### C1. שלב 1 — טלפון (page.js:1633)
| תווית | state | פרטים |
|---|---|---|
| "מספר טלפון *" (`#cust-phone`) | `phoneSearchInput` | `type=text inputMode=tel dir=ltr autoComplete=off autoFocus placeholder="05..."`; Enter → `handleCheckPhone`. ולידציה: `trim().length >= 9` אחרת `alert('נא להזין מספר טלפון תקין')`. חובה (כוכבית) |

### C2. שלב 1 — בחירה מרשימה
`CustomerSelector` (label "חיפוש לפי שם, טלפון או עיר", placeholder "חפש לקוח לפי שם, טלפון, עיר..."): `onChange(c)` — אם `null` → `customerId:'', selectedCustomer:null`; אחרת קובע `customerId=c.id, selectedCustomer=c`. **אינו מקדם שלב** — נדרש "המשך" (`proceedToStep2`).

### C3. שלב 1 — לקוח חדש (`newCustomer`; כל השדות `autoComplete="new-password"` למניעת autofill, page.js:1818+)
| תווית | id | state key | סוג/פורמט | חובה? |
|---|---|---|---|---|
| שם פרטי * | cust-firstName | `firstName` | text | תמיד |
| שם משפחה * | cust-lastName | `lastName` | text | תמיד |
| טלפון * | cust-phone1 | `phone1` | tel dir=ltr placeholder "נייד או קווי" | תמיד |
| טלפון נוסף | cust-phone2 | `phone2` | tel dir=ltr; כוכבית דינמית `isFieldRequiredByGroup('phone2', newCustomer, groups)` | לפי `mandatory_field_groups` (ברירת מחדל `[['phone2','email']]` = אחד מהשניים) |
| אימייל | cust-email | `email` | email dir=ltr placeholder "לשליחת ההזמנה במייל"; כפתור "השלם ל- @gmail.com" מופיע כשיש טקסט ללא `@` (מוסיף `@gmail.com`) | כוכבית אם `require_customer_email==='true'` או `isFieldMandatoryFromPicker('email')` או group |
| הודעות קבוצה | — | — | `<p class="field hint">` לכל `unsatisfiedFieldGroupErrors` ("חובה למלא לפחות אחד מבין: טלפון נוסף / אימייל") | — |
| עיר מגורים | cust-city | `city` | text עם `<datalist id=cust-city-list>` מ-`customerLocations.cities` | `require_full_address` או picker |
| רחוב | cust-street | `street` | text + `datalist cust-street-list` (`customerLocations.streets`) | כנ"ל |
| מספר בית | cust-house | `houseNum` | text | כנ"ל |
| תעודת זהות | cust-zeout | `zeout` | text dir=ltr placeholder "ת״ז", `required` attr אם `require_customer_id_number`; כוכבית אדומה אם כן, אחרת hint "(לעריכה/ביטול עתידי)" כש-`require_id_for_edit_cancel==='true'` | `require_customer_id_number==='true'` (נווה יעקב) |
| מאשר/ת קבלת דיוורים ועדכונים | — | `marketingConsent` (checkbox) | מוסתר אם `hide_marketing_consent_field==='true'`; כוכבית אם `require_marketing_consent==='true'` | לפי הגדרה |
| (HOK) בנק / סניף / חשבון (dir=ltr) / "מאשר/ת גביה אוטומטית בהו"ק במקרה של איחור/נזק" | — | `hokBankName`,`hokBankBranch`,`hokBankAccount`,`hokConsent` | רק אם `hok_enabled==='true'`; כותרת "פרטי הוראת קבע (3)" | לא |
Enter בכל שדה (חוץ מ-checkbox): `handleNewCustomerFieldEnter` (page.js:429) — עובר לשדה הבא הנראה/פעיל (`offsetParent!==null`, לא checkbox), ובשדה האחרון קורא `handleSaveNewCustomerAndProceed()`.
`NocCollapsible "פרטים נוספים"` נפתח אוטומטית (`openWhen`) אם: `require_full_address` / picker(city|street|houseNum) / (`hide_marketing_consent_field!=='true' && require_marketing_consent`) / `require_customer_id_number`.
בנוסף, כשיש `phoneSearchInput.trim()`: באנר "לא נמצא לקוח עם הטלפון שהוזן... כדאי לנסות [חיפוש לפי שם] לפני יצירת כרטיס חדש." (כפתור → `setSearchMode('name')`).

**ולידציית שדות חובה (לקוח) — `getMissingMandatoryCustomerFields(c)` (page.js:498):**
- `CUSTOMER_FIELD_ALIASES` (page.js:472): מפתחות בדיקה `firstName,lastName,phone1,email,city,street,houseNum`.
- תמיד חובה: `firstName,lastName,phone1`. שאר: אם `isFieldMandatoryFromPicker(key)` = הכינוי מופיע ב-`settings.mandatory_fields` (מופרד בפסיקים, lowercase; כינויים: firstname/שם פרטי/שם_פרטי, lastname/שם משפחה/שם_משפחה, phone1/טלפון ראשי (נייד)/טלפון_1, email/אימייל, city/עיר, street/רחוב, housenum/מספר בית/מספר_בית).
- תוספות: `require_customer_email==='true'` → email; `require_full_address==='true'` → city, street, houseNum; `hide_marketing_consent_field!=='true' && require_marketing_consent==='true'` → `marketingConsent` (צריך להיות truthy).
- `CUSTOMER_FIELD_LABELS`: שם פרטי, שם משפחה, טלפון, אימייל, עיר, רחוב, מספר בית, אישור דיוור.
- ID נוסף (רק ביצירת לקוח חדש): `require_customer_id_number==='true'` וריק → `alert('יש למלא: תעודת זהות')`.

### C4. שלב 1 — כרטיס לקוח שנמצא
מציג: אווטאר (ראשי תיבות), שם (`getCustomerFullName`), תג "לקוח חסום" אם `isBlocked`, phone1 [· phone2 · email · city, street houseNum]. אם חסר: "חסר ללקוח: ..." + קישור "עריכת פרטי לקוח (נפתח בכרטיסייה נפרדת)" → `/customers/{id}` (`target=_blank`). אם `foundCustomersFromPhone.length===1`: `renderHokFieldsForExistingCustomer()` (רק `hok_enabled`) — שדות `order.hokBankName/hokBankBranch/hokBankAccount/hokConsent`.
אם נמצאו >1: אזהרה "נמצאו N לקוחות עם מספר טלפון זה - יש לבחור את הלקוח הנכון." (`var(--warning)`).

### C5. שלב 2 — תאריכים
| תווית | state | פרטים |
|---|---|---|
| pill "אירוע רגיל" / `חו"ל / תפוסה ארוכה` | `order.isAbroad` | `handleDateChangeWithValidation('isAbroad', bool)` — כולל ולידציית מלאי בשרת אם יש פריטים |
| "תאריך אירוע *" | `order.eventDate` (ISO `YYYY-MM-DD`) | `HebrewDatePicker value onChange(date)` → `handleDateChangeWithValidation('eventDate', date)`. תצוגה עברית + פרשה (`- פרשת X`) |
| "טווח תאריכים (מתאריך עד תאריך) *" | `fromDate`,`toDate` | `HebrewDateRangePicker startDate endDate onChange(start,end)` → `handleDateChangeWithValidation({fromDate,toDate})`. לוח כפול, presets: שבוע(7)/שבועיים(14)/חודש(30)/3 חודשים(90), "נקה בחירה"/"ביטול"/"אישור בחירה", ולידציה: click ראשון בכל פתיחה מתחיל טווח חדש, בחירה מוקדמת מההתחלה מהפכת |
| "הערות כלליות להזמנה" (`#order-notes`, textarea rows=2, name=notes) | `order.notes` | `handleOrderChange`; placeholder "בקשות מיוחדות, סיכומים עם הלקוח..." |
| "ריווח ימים בין השכרות" | `order.customSpacing` | pills: null "רגיל", 0 "ללא", 1 "יום", 2 "יומיים", 3 "3 ימים", 4 "4 ימים"; `aria-pressed`; מוסתר כש-`hide_custom_spacing==='true'`. hint משתנה: `null`→"ברירת המחדל של המערכת." / `<3`→"ציפוף מיוחד — משפיע על בדיקת המלאי להזמנה זו בלבד, מסמן את ההזמנה ודורש אישור מנהל." (צבע warning) / `>=3`→"ריווח מורחב — פחות זמינות לשאר ההזמנות." |
| badge של הקולפסיבל | — | `hide_custom_spacing==='true'` ? (notes?'יש הערה':null) : (customSpacing!=null ? `spacingLabel` : notes?'יש הערה':null) |

`spacingLabel`: null/undefined → "רגיל (לפי המערכת)"; 0 → "ללא רווח כלל"; 1 → "יום רווח אחד"; אחר → "N ימי רווח".
**כלל ציפוף (`handleSpacingChange`, page.js:1455):** `prev = customSpacing ?? 3`, `new = val ?? 3`; אם `new<3 && new<prev` → `setPendingSpacingChange(val)` (מודל "רגע, בדקת מלאי?") ; אחרת → `handleDateChangeWithValidation('customSpacing', val)`.

### C6. שלב 2 — כרטיס "משלוח / סניף / טלפוני"
מוצג אם: `phone_order_marker_enabled==='true' || track_branch_on_order==='true' || branches_enabled==='true' || delivery_show_in_order!=='false'` (**שים לב: ברירת מחדל מוצג — `!== 'false'`**). כותרת "משלוח / סניף / טלפוני".
| תווית | state | תנאי | פרטים |
|---|---|---|---|
| הזמנה טלפונית | `isPhoneOrder` | `phone_order_marker_enabled==='true'` | `span.switch[role=switch][tabIndex=0]` + Enter/Space; הפעלה מנקה `branch` |
| סניף ביצוע | `branch` | `track_branch_on_order==='true'` | `<select class=input>` אפשרות ריקה "בחר סניף..." + `branch_list` (מופרד בפסיקים, trim). בחירה: `branch=val`, `isPhoneOrder=false` אם val; שומר `localStorage['gemach_last_order_branch']=val` |
| סניף איסוף | `pickupBranch` | `branches_enabled==='true'` | select מאותה `branch_list` |
| הזמנת משלוח (checkbox) | `isDelivery` | `enable_deliveries==='true'` | — |
| כיוון משלוח | `deliveryDirection` | `isDelivery` | select: הלוך / חזור / הלוך-חזור (ברירת מחדל הלוך-חזור) |
| עיר משלוח (לחישוב מחיר) `*`דינמי | `deliveryCity` | `isDelivery` | select "בחר עיר…" מאפשרויות `deliveryCityOptions` (מפתחות `delivery_price_by_city` JSON, נפילה ל-`customerLocations.cities`), משולבות עם ערך נוכחי (`Set`). כוכבית/הודעה אם `deliveryCityRequired`: "עיר המגורים של הלקוח אינה ברשימת ערי המשלוח - יש לבחור עיר משלוח." |
| כתובת משלוח שונה `*`דינמי | `deliveryAddress` | `isDelivery && (delivery_allow_address_override==='true' \|\| deliveryAddressRequired)` | text placeholder "כתובת למשלוח (שונה ממגורים)"; הודעה אם נדרש: "עיר המשלוח שונה מעיר הלקוח - יש להזין כתובת למשלוח." |
| משלוח יוצא יום לפני האירוע (במקום יומיים) | `deliveryOneDayBefore` | `isDelivery && delivery_one_day_before_option==='true'` | checkbox |
- `isDeliveryAddressRequired(order, customerCity)` = isDelivery && deliveryCity && customerCity && שונים (trim).
- `isDeliveryCityRequired(order, customerCity, deliveryPriceCities)` = isDelivery && עיר הלקוח לא ב-`deliveryPriceCities` (`Object.keys(JSON.parse(delivery_price_by_city))`; JSON פגום → `[]`).
- `validateDeliveryFields` → הודעות: "עיר המגורים של הלקוח אינה ברשימת ערי המשלוח המוגדרות - יש להזין עיר משלוח באופן מפורש." / "עיר המשלוח שונה מעיר המגורים של הלקוח - יש להזין כתובת משלוח מלאה." (נאכף בכפתור "המשך לבחירת פריטים" [disabled], ב-`saveOrder` [alert], ובשרת [400]).
- Effect ברירת מחדל סניף (page.js:409): כש-`track_branch_on_order==='true'` ו-localStorage `gemach_last_order_branch` קיים ו-`!order.branch && !order.isPhoneOrder` → ממלא `order.branch`.

### C7. שלב 3 — הוספת פריט
| תווית | state | פרטים |
|---|---|---|
| דגם * (`#item-model`) | `newItem.dressModelId`, `newItem.dressName` | `OrderModelSelector inputId="item-model" hasActiveItems value={{name:newItem.dressName}} placeholder="חפש דגם פריט..."`. onChange: `model` ריק/ללא id → מאפס `dressModelId,dressName,selectedSizes`; אחרת קובע `dressModelId=model.id, dressName=model.name, selectedSizes=[]`. (הערה: `model.name` הגולמי נשמר גם אם התצוגה מחליפה "ללא שם" בקוד ברקוד) |
| מידה (אפשר לסמן כמה יחד) * + "(בודק זמינות...)" | `newItem.selectedSizes[]` | כפתורי pill לכל `availableSizes` (`toggleSizeSelection`); תווית `{sizeText} · {normalAvail} פנויות` או `· אזל`; `disabled` אם `selectedAvail<=0`; אם `withCustomSpacing.gain>0` נוסף `+gain` ירוק; `title`: עם ציפוף `רגיל: X | ציפוף: Y (+gain)`, אחרת `זמין: X`. `selectedAvail = withCustomSpacing ? customAvail : normalAvail` |
| מצבי ריק | — | אין מידות: `newItem.dressModelId ? 'אין מידות זמינות לתאריך זה.' : 'בחר דגם כדי לראות מידות זמינות.'` |
| כפתור רענון (`#i-refresh`, title/aria "רענן זמינות מלאי") | — | → `refreshInventory`, `disabled={loadingPreload||loadingSizes}` |
| קולפסיבל "תיקונים לפריט" | — | מוצג אם `enable_alterations !== 'false'` (**ברירת מחדל מוצג**); badge = `alterationsSummary`; `openWhen=alterationsChosen` |
| צוואר / שרוול (pills, `#i-scissors`) | `newItem.neckAlteration`, `newItem.sleeveAlteration` (bool) | toggle דרך `handleNewItemChange({target:{name,value:!cur}})` |
| אורך (ס״מ) | `newItem.lengthAlteration` | text inputMode=decimal, width 70px, `aria-label="קיצור אורך בסנטימטרים"`, placeholder "ס״מ" |
| פירוט לתופרת (`#item-repairs`) | `newItem.repairs` | text placeholder "מה בדיוק לתקן..."; אם `alterationsChosen` — תווית `* (חובה)` וגבול אדום כשריק. **בפועל אינו נאכף** (ר' `addItemToOrder`: ממלא אוטומטית `describeAlterations`) |
| הוסף לסל / `הוסף N פריטים לסל` (`#i-plus`) | — | `addItemToOrder`; `disabled={selectedSizes.length===0}` |

`alterationsChosen = neck||sleeve||length`; `alterationsSummary` = "צוואר, שרוול, אורך X". `describeAlterations(item)` = "צוואר, שרוול, אורך (X)" או "ללא תיקונים".

### C8. שלב 3 — סל
כל שורה: `dressName || 'דגם לא ידוע'`; שורת משנה `{sizeText}` + (אם `enable_alterations!=='false'`) ` · {describeAlterations}`; מחיר `₪{calculatedData.items[idx]?.calculatedPrice ?? item.finalPrice ?? 0}`; 3 כפתורי אייקון: "בדוק תפוסה" (`#i-calendar`, title "בדוק תפוסה לתאריך האירוע" → `setCapacityModalItem(item)`), "ערוך פריט" (`#i-edit` → `editItem(idx)`), "הסר פריט" (`#i-trash`, אדום, `await window.customConfirm('האם אתה בטוח שברצונך להסיר את הפריט מהסל?')` → `removeItem(idx)`). כותרת: `בסל · N`; בחישוב: spinner "מחשב מחירים...". ריק: איקון `#i-bag` "טרם הוספת פריטים להזמנה". סה"כ: `₪{totalAmount.toLocaleString('he-IL')}`. `role=region aria-label="פריטים בסל"`.
- שדה הערות כלליות (שלב 3) — `#order-notes-step3` — אותו `order.notes`.

### C9. שלב 5 — תשלום
| תווית | id | state | פרטים |
|---|---|---|---|
| סכום לתשלום כעת (₪) | pay-amount | `payment.amount` | `type=number`; **נדרס אוטומטית** ל-`remainder = max(0, totalAmount - totalPaid)` בכל שינוי `totalAmount`/`paymentsList` (effect page.js:995) |
| אופן תשלום | pay-method | `payment.method` | `<select>` מתוך `paymentMethodOptions = computePaymentMethodOptions(settings)` |
| הערה לתשלום (קולפסיבל, badge "יש הערה") | — | `payment.notes` | text placeholder "מספר אישור, פרטי הבנק, שם המשלם..." |
- `computePaymentMethodOptions` (page.js:35): `ALLOWED_PAYMENT_METHODS` (מופרד פסיקים) או ברירת מחדל `['אשראי (דרך נדרים פלוס)','מזומן','יציאה באישור מנהל']`; אם `nedarim_plus_enabled !== 'false'` מחזיר raw; אחרת מסנן כל אופציה שכוללת "אשראי" ולא "חיצונית"; אם ריק → `['יציאה באישור מנהל']`. בטעינת settings: `payment.method = opts[0]`.
- כפתורים: ר' (ד).

### C10. חלון אשראי (page.js:2767) — `creditCardData`
| תווית | id | state | פורמט |
|---|---|---|---|
| מספר כרטיס אשראי (או העברה בקורא) | cc-number | `cardNumber` | `handleCardNumberChange`: מקבל swipe (`=` / `^`), אחרת ספרות בלבד מקובצות ב-4 עם רווח; maxLength 19, dir=ltr, `autoComplete=cc-number` |
| תוקף (MM/YY) | cc-exp | `tokef` | `handleTokefChange`: ספרות בלבד, `MM/YY` עם `/` אחרי 2 ספרות, maxLength 5 |
| סכום לחיוב (₪) | cc-amount | `amount` | type=number |
| תשלומים | cc-installments | `installments` | number min=1 max=12; נשלח `parseInt(...)||1` |
| הערות לנדרים | cc-notes | `notes` | text |
חובה: cardNumber, tokef, amount (`setCreditError('אנא מלא את כל השדות החובה (מספר כרטיס, תוקף, וסכום).')`).
`handleSwipeInputChange` (page.js:210): מפרסר `card=exp...` (`=`: parts[1] ≥4 → YY,MM) או `%B...^NAME^YYMM` (`^`: parts[2]); בהצלחה מציב cardNumber+tokef, סוגר את חלון ה-swipe, ואחרי 150ms פותח את חלון האשראי.

---

## (ד) כפתורים ופעולות

| תווית | handler | פעולה / קריאות |
|---|---|---|
| טיוטה #N (קישור) | — | פותח `/orders/{draftOrderId}` בטאב חדש |
| ✕ יציאה מהמסך / ביטול (שלב 1) | `handleExit` (page.js:1502) | אם `activeItems.length>0 \|\| order.customerId` → `setShowExitConfirm(true)`; אחרת `router.push('/orders')` |
| בדיקה והמשך | `handleCheckPhone` (445) | ר' זרימה 1א |
| כן, זה הלקוח | `handleUseExistingCustomer(c)` (592) | ר' זרימה 1ב |
| עריכת פרטי לקוח | קישור `<a>` `/customers/{id}` `_blank` | מוצג אם חסר שדה חובה / קבוצה לא מסופקת |
| אף אחד מאלה - לקוח חדש | inline (1734) | `newCustomer.phone1=phoneSearchInput.trim()`, מרוקן `foundCustomersFromPhone`, `searchMode='new'` |
| חיפוש לפי שם (באנר) | inline | `setSearchMode('name')` |
| השלם ל- @gmail.com | inline | `email += '@gmail.com'` |
| שמור לקוח והמשך | `handleSaveNewCustomerAndProceed()` (518) | ר' זרימה 1ג |
| השתמש בלקוח הזה (מודל כפילות) | `handleUseExistingCustomer` | — |
| צור לקוח חדש בכל זאת | `handleSaveNewCustomerAndProceed(true)` | מדלג על בדיקת כפילות |
| המשך (שלב 1) | `proceedToStep2` (636) | `alert('יש לבחור לקוח')` אם אין; `confirmBlockedCustomerOverride`; `setStep(2)` |
| אירוע רגיל / חו"ל | `handleDateChangeWithValidation('isAbroad', ..)` | ר' זרימה 2 |
| pills ריווח | `handleSpacingChange(val)` | ר' C5 |
| מתג טלפונית / select סניף / סניף איסוף / checkbox משלוח וכו' | inline `setOrder` | ר' C6 |
| רענן זמינות מלאי | `refreshInventory` (679) | `GET /api/inventory/preload?...&_t=<ms>` |
| pill מידה | `toggleSizeSelection(sizeText)` | toggle ב-`newItem.selectedSizes` |
| pills צוואר/שרוול | `handleNewItemChange` | toggle |
| הוסף לסל | `addItemToOrder` (842) | ר' זרימה 3 |
| בדוק תפוסה | `setCapacityModalItem(item)` | פותח `ItemCapacityModal` |
| ערוך פריט | `editItem(idx)` (944) | טוען את הפריט חזרה ל-`newItem` עם `preserveSize:true`, `removeItem(idx)`, `window.scrollTo({top: body.scrollHeight/2, behavior:'smooth'})` |
| הסר פריט | `customConfirm` → `removeItem(idx)` (925) | מחזיר +1 ל-`availableSizes` של אותה מידה אם אותו דגם כמו `newItem.dressModelId`; `splice` |
| עריכה (שלב 4) | `setStep(1)` | — |
| אישור תשלום (`type=submit` בטופס) | `handleAddPaymentClick` (1192) | `pAmount<=0` → `alert('יש להזין סכום גדול מ-0')`; אם אשראי (כולל 'אשראי' ולא 'חיצונית') → פותח מודל אשראי (`creditCardData.notes=payment.notes, amount=payment.amount`); אחרת דוחף `{amount,method,notes}` ל-`paymentsList` ומאפס `payment.notes` |
| חיוב אשראי | inline (2520) | מאפס `creditCardData` (notes/amount מ-payment) ופותח `showCreditModal` (מוצג רק אם `nedarim_plus_enabled !== 'false'`) |
| הסר תשלום (🗑) | `removePayment(idx)` | לא מוסר אם `isChargedPayment` (notes כוללת "אישור נדרים"), הכפתור disabled + title "חיוב אשראי שכבר בוצע — לא ניתן להסרה"; אחרת title "הסר תשלום" |
| סיום ויצירת ההזמנה | `saveOrder` (1101) | ר' זרימה 5 |
| בצע חיוב ושמור הזמנה (submit `#credit-charge-form`) | `handleProcessCreditCard` (293) | ר' זרימה 5ב |
| העברה מהירה (במודל אשראי) | inline | סוגר אשראי, פותח swipe, מאפס `swipeInput`, `creditError` |
| ביטול/✕ (מודלים) | `setShow...(false)` | — |
| רגע, בדקת מלאי? → "פתח חיפוש תפוסה מהיר" | `setShowSpacingCapacitySearch(true)` | פותח `CapacitySearchModal` |
| "כן, המשך" (ציפוף) | `confirmSpacingChange` (1467) | ר' זרימה 2ב |
| "המשך בהזמנה" / "צא — הטיוטה נשמרה" / "צא בלי לשמור" | `setShowExitConfirm(false)` / `router.push('/orders')` | — |
| "שמור בכל זאת כהזמנה נפרדת" | `handleConfirmDuplicateSave` (1353) | `executeSaveOrderForList(pendingSavePaymentsRef.current, true)` |
| "אבדוק את הקיימת" | `handleCancelDuplicateSave` | סוגר את האזהרה |

---

## (ה) קריאות רשת

| # | Method + URL | Query/Body | מתי | שימוש בתשובה | Cache |
|---|---|---|---|---|---|
| N1 | GET `/api/settings` | — | mount (page.js:383) | מערך `{key,value}` → `settings` map; מסנכרן `payment.method=opts[0]`. אם לא מערך: `setSettings(data\|\|{})` | `fetchSharedJson(..., {ttl: TTL.STATIC})` (5 דק', apiCache) |
| N2 | GET `/api/customers/locations` | — | mount | `{cities,streets}` → `customerLocations` (datalists + fallback ערי משלוח) | `fetchSharedJson` `TTL.REFERENCE` (2 דק') |
| N3 | GET `/api/customers?search=<enc(phone.trim())>&limit=20` | — | `handleCheckPhone` | `data.data[]`: יש → `foundCustomersFromPhone`; אין → `newCustomer.phone1=phone`, `searchMode='new'`. שגיאה → `alert('שגיאה בחיפוש הלקוח')` | ללא |
| N4 | GET `/api/customers?phone=<enc(newCustomer.phone1)>&limit=20` | — | `handleSaveNewCustomerAndProceed` (כשלא skip) | `data.data.length>0` → `setDuplicateCustomers` ועוצר; שגיאת רשת: מתעלם וממשיך | ללא |
| N5 | POST `/api/customers` | body = `newCustomer` כולו (`firstName,lastName,phone1,phone2,email,city,street,houseNum,marketingConsent,zeout` + `hokBankName,hokBankBranch,hokBankAccount,hokConsent` אם הוזנו) | אחרי ולידציות ובדיקת כפילות | OK: `order.customerId=data.id, selectedCustomer=data`, `setStep(2)`, מרוקן `duplicateCustomers`. שגיאה: `alert('שגיאה בשמירת לקוח: '+ (data.error\|\|'שגיאה בשמירת לקוח'))`. השרת אוכף שוב שדות חובה, פורמט (טלפון/מייל/ת"ז), ייחודיות ת"ז | ללא |
| N6 | GET `/api/customers?search=<debounced q>&limit=50` | AbortController | `CustomerSelector` בכל שינוי query (300ms `useDebounce`) כשפתוח/יש טקסט | `data.data` לרשימה נפתחת (portal). "לא נמצאו לקוחות." | ללא |
| N7 | GET `/api/inventory/models?q=<enc>&hasActiveItems=true` | — | `OrderModelSelector`: debounce 300ms בכל שינוי query; וגם ב-Enter (`resolveTypedValue`) | `data.models` → רשימה; Enter בלי בחירה: מחפש התאמה מדויקת (שם/`barcodePrefix`); אין → `alert('לא נמצא דגם עם השם/קוד "X". יש לבחור דגם מהרשימה הנפתחת.')` | `fetchSharedJson` `TTL.REFERENCE` |
| N8 | GET `/api/inventory/preload?isAbroad=<bool>[&eventDate=][&fromDate=][&toDate=][&excludeOrderId=<draft>]` (+ `&_t=<ms>` ברענון ידני) | — | effect על `eventDate,fromDate,toDate,isAbroad` כשיש תאריכים (page.js:645); וידני ב-`refreshInventory`. בלי תאריכים: `inventoryCache=null` | `data` → `inventoryCache` `{stock,bookings,settings:{bufferDays,skipWeekends}}` ל-`calculateDynamicAvailability`. `!res.ok` → console.error בלבד. `loadingPreload` | ללא (fetch ישיר). `excludeOrderId` נקרא מ-`draftOrderIdRef` (לא state) |
| N9 | POST `/api/orders/validate-inventory` | `{items: activeItems, eventDate, isAbroad, isWeekdayEvent, fromDate, toDate, customSpacing, orderId: draftOrderIdRef.current}` (ערכי `proposedOrder`) | `handleDateChangeWithValidation` כשיש פריטים פעילים | `error` → `alert('שגיאה בבדיקת מלאי: ...')` ולא מעדכן; `!valid` → alert פירוט (ר' ו) ולא מעדכן; תקין → `setOrder(proposedOrder)`; חריגת רשת → `alert('שגיאה בבדיקת המלאי מול השרת.')` | ללא |
| N10 | GET `/api/orders/pricing?dressModelId=&sizeText=&eventDate=<order.eventDate\|''>` | — | `addItemToOrder`, `Promise.all` לכל מידה תקפה | `basePrice` → `item.basePrice` וגם `item.finalPrice`; כשל → `{basePrice:0}` | ללא |
| N11 | POST `/api/orders/calculate` | `{items: order.items, eventDate, isAbroad, isWeekdayEvent, isDelivery, deliveryCity, deliveryDirection}` | effect על `order.items, eventDate, isAbroad, isWeekdayEvent, isDelivery, deliveryCity, deliveryDirection` (page.js:963); items ריק → `{0,[]}` בלי קריאה | `totalAmount` (כולל דמי משלוח), `calculatedItems[]` (`calculatedPrice`,`repairsCost`,`isDiscountedSet`) → `calculatedData`; `calculating` spinner | ללא. **אין race protection** (תשובה מאוחרת דורסת) |
| N12 | POST `/api/orders/draft` | `{orderId: draftOrderIdRef, customerId, eventDate, eventDateHebrew, returnDate, isAbroad, isWeekdayEvent, fromDate, toDate, notes, customSpacing, totalAmount, items: activeItems}` | Autosave — ר' זרימה 4 | `{orderId}` → `draftOrderIdRef`+`draftOrderId`; שגיאה: `console.error` בלבד | ללא |
| N13 | POST `/api/orders/reserve` | `{customerId: order.customerId\|\|null}` | `handleProcessCreditCard` לפני חיוב, רק אם אין `draftOrderIdRef`/`reservedOrderId` | `{orderId}` → `reservedOrderId`, `draftOrderIdRef`, `draftOrderId`. כשל: `console.error`, ממשיך לחייב עם "חדשה" | ללא |
| N14 | POST `/api/nedarim` | `{clientName: getCustomerFullName(cust), phone: cust.phone1\|\|'', address: "street houseNum city", cardNumber (ללא רווחים), tokef (ללא '/'), amount: parseFloat, installments: parseInt\|\|1, notes: [creditCardData.notes, "באמצעות תכנת הגמח; מס הזמנה: <N\|חדשה>"].join(' - '), zeout: cust.idNumber\|\|cust.zeout\|\|'', email}` | `handleProcessCreditCard` | `data.success` → ר' זרימה 5ב; אחרת `creditError = data.error \|\| 'שגיאה בחיוב הכרטיס'`; חריגה: 'שגיאת תקשורת בחיוב הכרטיס' | ללא |
| N15 | POST `/api/auth/verify-pin` | `{pin, employeeId, requiredLevel}` | `verifyPin` (mocAuth.js) ו-2 מקומות ישירים (payment_exit, special_spacing) | `success` → המשך; אחרת `alert(data.error \|\| 'סיסמה שגויה או הרשאה לא מספקת.')` / ב-payment: 'סיסמה שגויה או חסרת הרשאה.'; חריגה: 'שגיאה באימות מול השרת.' / 'שגיאה באימות קוד מנהל.' | ללא |
| N16 | POST `/api/orders` | ר' סעיף "גוף ה-POST" למטה | `executeSaveOrderForList` | ר' זרימה 5 | ללא |
| N17 | GET `/api/inventory/capacity?barcodePrefix=&size=&fromDate=&toDate=` | — | `ItemCapacityModal` (בפתיחה) ו-`CapacitySearchModal` (חיפוש) | ר' (ו) | ללא |
| N18 | GET `/api/inventory/models` (בלי q) | — | `ItemCapacityModal` כשאין `barcodePrefix` לפריט | מוצא prefix לפי `dressModelId` | ללא |
| N19 | GET `/api/inventory/models?hasActiveItems=true` ; GET `/api/inventory/sizes?barcodePrefix=` | — | `CapacitySearchModal` (mount / בחירת דגם) | רשימות | ללא |
| N20 | `window.open('/print/order?orderId=<id>&type=order','_blank')` | — | אחרי שמירה אם `auto_print_on_order_create==='true'` | הדפסה אוטומטית | — |
| N21 | `router.push(resolveOrderRedirectHref(order_new_redirect_screen\|\|'order', {orderId, customerId}))` | — | אחרי שמירה מוצלחת | ר' ז5 | — |

### גוף ה-POST `/api/orders` (page.js:1263) — כל המפתחות
```
customerId, eventDate, eventDateHebrew, returnDate,
isAbroad, isWeekdayEvent, fromDate, toDate,
notes, customSpacing, totalAmount,
items: itemsToSave,            // order.items (כל שדות הפריט) עם finalPrice := calculatedData.items[idx]?.calculatedPrice ?? item.finalPrice
isDelivery: !!, deliveryDirection: ||null, deliveryAddress: ||null, deliveryCity: ||null,
isPhoneOrder: !!, branch: ||null, pickupBranch: ||null,
deliveryOneDayBefore: !!,
[hokDetails: JSON-string]      // רק אם defined (ר' להלן)
paymentsList: finalPaymentsList,
reservedOrderId,               // state (null או מספר)
draftOrderId: draftOrderIdRef.current,
forceDuplicate: force          // bool
```
- **מבנה פריט ב-`items[]`:** `{dressModelId, dressName, sizeText, sampleItemId, quantity:1, basePrice, finalPrice, repairs, neckAlteration, sleeveAlteration, lengthAlteration}` (נוצר ב-`addItemToOrder`, page.js:890). `eventDate` הנשלח = `order.eventDate` (לחו"ל מסונכרן ל-`fromDate` ב-`handleDateChangeWithValidation`, ר' זרימה 2א).
- **`paymentsList[]`:** אלמנט = `{amount:number, method, notes}`; יציאה באישור מנהל: `{...payment, amount:0, notes:"יציאה באישור מנהל (סכום מבוקש: ₪<payment.amount>) | <payment.notes>"}` (method נשאר "יציאה באישור מנהל"); חיוב נדרים: `notes = "אישור נדרים: <conf> | <creditCardData.notes>"` (או רק notes אם אין conf), `method = payment.method` הנוכחי.
- **`hokDetails`** (רק אם `settings.hok_enabled==='true'`): אם `order.hokBankName||hokBankBranch||hokBankAccount||hokConsent` → `JSON.stringify({bankName,bankBranch,bankAccount,consent})` מ-`order.hok*`; אחרת אם `newCustomer.hok*` כלשהו → אותו מבנה מ-`newCustomer`; אחרת המפתח **לא נשלח**.
- **תגובת שרת (route.js:652):** 409 `{duplicateOrder:true, existingOrderId}`; 409 `{error, validationErrors[]}`; 400 (מגבלת פריטים `max_items_per_order` תמיד, משלוח, מלאי `error`); 500 `{error:'Failed to create order', details}`; 200 = ההזמנה המעודכנת + `warning?`. שרת: `status` נגזר (`deriveConfirmedOrderStatus`), `cartStatus` `confirmed` אם שולם>0/אישור מנהל/סכום 0 אחרת `pending`; `hide_custom_spacing` מאפס ציפוף; ממלא את ה-draft/reserved אם זמין (`isFillableDraftOrder`/`isReservedOrderPlaceholder`); מנקה טיוטות אחיות; `recalculateOrderObligations`; `applyDeliveryCharge`; מייל אוטומטי `auto_email_on_order_create`; `mailing_list_auto_sync`.

---

## (ו) מודלים / פופאפים / טוסטים / אישורים

| # | רכיב | מקור | תוכן/כפתורים | סגירה |
|---|---|---|---|---|
| M1 | `window.customConfirm(msg)` (PopupProvider) | 624, 2362 | "ללקוח זה חסרים פרטי חובה: ...\nהאם לאשר חריגה ולהמשיך בכל זאת בלי להשלים את הפרטים?" ; "האם אתה בטוח שברצונך להסיר את הפריט מהסל?" | — |
| M2 | `window.customAuthPrompt(msg, level)` + `verifyPin` | ר' (א) | בחירת עובד + PIN | — |
| M3 | `alert(...)` (native) — רשימה מלאה בסעיף (י) | — | — | — |
| M4 | `window.confirm` popstate guard | 1076 | 'יש נתונים שהוזנו בהזמנה ועדיין לא נשמרו. לצאת בכל זאת ולאבד אותם?' | אישור → `history.back()`; ביטול → `pushState` מחדש |
| M5 | **מודל "רגע, בדקת מלאי?"** (`pendingSpacingChange!==null && !showSpacingCapacitySearch`, 2608) | `.modal-backdrop z1500`, `.modal maxWidth 420` | גוף: "ציפוף מיוחד משפיע על בדיקת המלאי להזמנה זו בלבד, ומסמן את ההזמנה לאישור מנהל." כפתורים: "פתח חיפוש תפוסה מהיר" (`#i-chevron-start`), "ביטול", "כן, המשך" (→ `confirmSpacingChange`) | ✕ / רקע / ביטול → `setPendingSpacingChange(null)` |
| M6 | `CapacitySearchModal` (`showSpacingCapacitySearch`) | components/CapacitySearchModal.js | חיפוש תפוסה: דגם (combobox פנימי מסונן מקומית, מציג `שם (prefix)`), מידה, `HebrewDateRangePicker`, כפתורי "נקה"/"חפש"; היסטוריית חיפושים (כפתור, סינון, שחזור) ב-`localStorage['capacity_search_history']` (50 אחרונים); תוצאות KPI: במלאי/בתפוסה/רזרבה; טבלה (תאריך אירוע, שם לקוח, כמות בתפוסה, פעולות) או `CapacityCalendar`; שגיאות: 'יש להזין דגם ומידה' / 'שגיאה בחיפוש'; ברירות מחדל טווח: היום..+6 חודשים; Escape חסום (capture) | `onClose` → `setShowSpacingCapacitySearch(false)` (המודל M5 חוזר להיות גלוי כי `pendingSpacingChange` עדיין קבוע) |
| M7 | `ItemCapacityModal` (`capacityModalItem`) | components/orders/ItemCapacityModal.js | כותרת "זמינות: {שם דגם\|'פריט'} ({מידה})"; "תאריך אירוע: dd.mm.yyyy · תאריך עברי"; "(מוצג טווח של חודש לפני ואחרי)"; טוען `/api/inventory/capacity` בטווח ±חודש; KPI: במלאי / בתפוסה מתוכננת / רזרבה זמינה; toggle "תצוגת רשימה"/"תצוגת לוח" (רק אם `occupiedCount>0`); טבלה (תאריך אירוע+תאריך עברי, שם לקוח, כמות בתפוסה, "צפה בהזמנה"→`/orders/{orderId}` טאב חדש); ריק: "אין הזמנות תפוסות בטווח התאריכים / הפריט פנוי לחלוטין בתאריכים אלו."; שגיאות: 'לא הוגדר תאריך אירוע להזמנה זו.' / 'לא ניתן לבדוק תפוסה לפריט ללא דגם (פריט כללי).' / 'לא ניתן לבדוק תפוסה לפריט ללא מידה מוגדרת.' / 'לא נמצא קוד פריט' / 'שגיאה בטעינת נתונים'. **הערה:** משתמש ב-`order.eventDate` בלבד (לא `fromDate`) → בהזמנת חו"ל עם `eventDate` מסונכרן עובד; מסומן `הזמנה נוכחית` לפי `occOrder.orderId === order.orderId` (בהזמנה חדשה `order.orderId` לא מוגדר) | ✕ / סגירה / רקע; Escape דרך handler של העמוד (`capacityModalItem`) |
| M8 | **"יציאה מההזמנה"** (`showExitConfirm`, 2645) | `.modal maxWidth 420` | גוף: `draftOrderId` ? `ההזמנה שמורה כטיוטה #N עם K פריטים, ואפשר להמשיך אותה מרשימת ההזמנות.` : 'ההזמנה עדיין לא נשמרה. יציאה עכשיו תמחק את מה שהוזן במסך.'; כפתורים: "המשך בהזמנה" / (`draftOrderId` ? "צא — הטיוטה נשמרה" : "צא בלי לשמור") → `router.push('/orders')` | ✕ / רקע / "המשך בהזמנה" |
| M9 | **"לקוח קיים במערכת" / "כמה לקוחות עם מספר טלפון זה"** (`duplicateCustomers.length>0`, 2675) | `.modal.confirm-modal`, איקון `#i-alert-tri` | כרטיס לכל לקוח: שם (+תג חסום), טלפון (phone1 \| phone2, ltr), עיר ('לא צוינה'), אזהרת חסר + קישור "עריכת פרטי לקוח", כפתור "השתמש בלקוח הזה" (→ `handleUseExistingCustomer`). תחתית: "ביטול" (`setDuplicateCustomers([])`), "צור לקוח חדש בכל זאת" (`btn-danger-ghost`) | רקע / ביטול |
| M10 | **"הזמנה זו כבר נשמרה"** (`duplicateOrderWarning`, 2739) | `.confirm-modal`; **אין סגירה ברקע** | "כבר קיימת הזמנה שמורה עבור אותו לקוח ואותו תאריך — הזמנה מס' N. כדאי לבדוק אותה לפני שממשיכים, כדי לא ליצור הזמנה כפולה." קישור "פתח את הזמנה #N" (טאב חדש); כפתורים "שמור בכל זאת כהזמנה נפרדת" (danger-ghost), "אבדוק את הקיימת" (primary) | רק כפתורים |
| M11 | **חיוב באשראי (נדרים פלוס)** (`showCreditModal`, 2767) | `.modal maxWidth 520`, stopPropagation | כפתור "העברה מהירה" (title "העברת כרטיס מהירה בקורא מגנטי"), `callout-danger` עם `creditError`, טופס (C10), תחתית: "ביטול" / "בצע חיוב ושמור הזמנה" (`type=submit form=credit-charge-form`) ; בזמן `isProcessingCredit`: "מבצע חיוב..." + כל הסגירות disabled | ✕/רקע/ביטול/Escape (חסום כש-`isProcessingCredit\|\|saving`) |
| M12 | **"העברת כרטיס מהירה"** (`showQuickSwipeModal`, 2845) | `.confirm-modal`, spinner גדול | "אנא העבר כעת את כרטיס האשראי בקורא המגנטי. פרטי הכרטיס ייקלטו אוטומטית." קלט נסתר (`opacity 0, top -1000px`, `aria-label="קלט קורא כרטיסים"`, autoFocus, Enter מבוטל, `onBlur` מחזיר focus ב-100ms) ; "ביטול" | רקע/ביטול/Escape |
| M13 | **חוסם "פעולה מתבצעת"** (`busy = saving \|\| isProcessingCredit`, 2873, z1600) | `role=alertdialog aria-busy` | כותרת `isProcessingCredit ? 'מבצע חיוב מול נדרים פלוס' : 'יוצר את ההזמנה'`; גוף: 'אין לסגור את החלון עד לקבלת אישור מחברת האשראי.' / 'מאמת זמינות מלאי, רושם פריטים ומחשב חיובים. נא לא לסגור את החלון.' | לא ניתן לסגירה |
| T1 | **flash toast** (`NewOrderShell`) | 1366 | `{type:'ok', text:'נשמרה טיוטה #N'}` — נקבע ע"י effect כש-`draftOrderId` משתנה ל-id חדש (`lastFlashedDraftRef`); נעלם אחרי 2800ms. (`type:'err'` נתמך במעטפת אך לא מופעל בעמוד) | timer |
- **Escape (page.js:1090):** מתעלם כש-`isProcessingCredit||saving`; סוגר לפי עדיפות: quick-swipe → credit → capacity item. **לא** סוגר: exit-confirm, spacing modal, duplicate modals.

**פורמט הודעת מלאי (validate-inventory ושמירה):** שורות `- {dressName} (מידה {sizeText}): חסרים {requested-available} במלאי` (+ ` (בגלל ציפוף)` אם `isCustomSpacingIssue`); אם קיים כזה, מוסיף `\n\n💡 הערה: כמה מהבעיות קשורות לציפוף מיוחד. אם אתה בוטל בציפוף, נסה לבחור ציפוף קטן יותר.`. כותרות: בשינוי תאריך "לא ניתן לשנות את התאריך עקב חוסר במלאי לפריטים הקיימים בהזמנה:", בשמירה "לא ניתן לשמור את ההזמנה עקב חוסר במלאי לתאריכים המבוקשים:".

---

## זרימות מפורטות ולידציה לפי שלב

### זרימה 1 — לקוח
**1א. חיפוש טלפון (`handleCheckPhone`):** `trim().length<9` → alert. `GET /api/customers?search=..&limit=20`. תוצאות → כרטיסים (לא מקדם שלב). ללא תוצאות → `newCustomer.phone1 = phone.trim()`, `foundCustomersFromPhone=[]`, `searchMode='new'`.
**1ב. `handleUseExistingCustomer(c)`:**
1. `confirmBlockedCustomerOverride(c)` — אם `c.isBlocked`: `verifyPin("לקוח זה חסום מהזמנות חדשות (<blockedReason>).\nלעקוף את החסימה ולהמשיך בכל זאת? נדרש אישור הנהלה ראשית.", 'הנהלה ראשית')`; כישלון → עצירה.
2. `missingFields = getMissingMandatoryCustomerFields(c)`; `missingGroupLabels = unsatisfiedFieldGroupShortLabels(c, parseFieldGroups(mandatory_field_groups))`.
3. אם יש חסר: (`strict_mandatory_fields==='true'`) → `alert('לא ניתן להמשיך - ללקוח חסרים פרטי חובה: ... אפשר ללחוץ על "עריכת פרטי לקוח"...')` ועצירה; אחרת אם חסר אמצעי תקשורת (group) → `verifyPin(..., 'feature:missing_contact_approval')`; אחרת (רק שדות רגילים) → `customConfirm('ללקוח זה חסרים פרטי חובה: ...\nהאם לאשר חריגה ולהמשיך בכל זאת בלי להשלים את הפרטים?')`.
4. `order.customerId=c.id, selectedCustomer=c`, `setStep(2)`, `duplicateCustomers=[]`.
**1ג. `handleSaveNewCustomerAndProceed(skipDup=false)`:** (1) `getMissingMandatoryCustomerFields(newCustomer)` → `alert('יש למלא: <labels>')`; (2) `require_customer_id_number` + `zeout` ריק → alert; (3) `unsatisfiedFieldGroupErrors` → `verifyPin("<errors joined '. '> - חסר ללקוח זה. נדרש אישור מנהל כדי לעקוף ולהמשיך בכל זאת.", 'feature:missing_contact_approval')` (חסימה רכה); (4) אם `skipDup!==true`: `GET /api/customers?phone=...&limit=20` → כפילות → מודל M9; (5) `POST /api/customers`. **הערה:** אין ולידציית פורמט טלפון/מייל/ת"ז בקליינט — נאכף רק בשרת.
**1ד. `proceedToStep2`:** בחירה מ-`CustomerSelector` אינה עוברת שלבי (1ב) — **אין בדיקת שדות חובה** של לקוח בנתיב "מהרשימה" (רק חסימת לקוח + אזהרה ויזואלית).

### זרימה 2 — תאריכים
**2א. `handleDateChangeWithValidation(fieldOrUpdates, valueIfField)` (750):** `updates` = אובייקט או `{[field]:value}`.
- אם `order.isAbroad` (המצב **הנוכחי**, לא המוצע) וגם fromDate/toDate (ממוזגים) וקיים `toDate < fromDate` → `alert('שגיאה: תאריך החזרה (עד תאריך) אינו יכול להיות לפני תאריך ההתחלה (מתאריך)!')` ועצירה.
- `proposedOrder = {...order, ...updates}`; אם `proposedOrder.isAbroad && ('fromDate' in updates || 'isAbroad' in updates)` וקיים fromDate → `proposedOrder.eventDate = fromDate`.
- אם יש `activeItems` → `POST /api/orders/validate-inventory` (ר' N9); רק אם עבר → `setOrder(proposedOrder)`. אחרת (אין פריטים) → `setOrder` מיד.
- **חל גם על שינוי `isAbroad`, `eventDate`, `customSpacing`.** שים לב: `eventDateHebrew` ו-`returnDate` לעולם לא נקבעים ב-UI (נשארים `''` ונשלחים; השרת מחשב `eventDateHebrew`).
**2ב. `confirmSpacingChange`:** `pendingSpacingChange=null`; `window.customAuthPrompt('שינוי ציפוף ימים מיוחד להזמנה דורש הרשאת מנהל. אנא בחר מנהל והזן סיסמה:', 'feature:special_spacing_approval')`; ביטול → יציאה שקטה; `POST /api/auth/verify-pin`; כישלון `alert(data.error||'סיסמה שגויה או הרשאה לא מספקת.')`; הצלחה → `handleDateChangeWithValidation('customSpacing', val)`.
**מעבר לשלב 3:** כפתור מושבת אם `!datesFilled` או `validateDeliveryFields(...)` מחזיר הודעה.

### זרימה 3 — פריטים / זמינות / קונפליקטים
- **חישוב זמינות (effect page.js:709):** כשיש תאריכים (`isAbroad ? fromDate&&toDate : eventDate` — **שים לב: `isWeekdayEvent` לא נכלל כאן**) + `newItem.dressModelId` + `inventoryCache` → `calculateDynamicAvailability(dressModelId, isAbroad?fromDate:eventDate, isAbroad?toDate:null, inventoryCache, order.items, order.customSpacing)` → `availableSizes`. אחר כך `newItem.selectedSizes=[]` (**אלא אם `preserveSize`** — אז מוריד את הדגל ושומר בחירה; זה המנגנון של `editItem`). כל שינוי ב-`order.items`/`customSpacing`/תאריכים מריץ מחדש → **מאפס את בחירת המידות** (אלא preserveSize).
- **`calculateDynamicAvailability`** (lib/clientInventory.js:117): משכפל בדיוק את `occupancyFormula` של השרת (`lib/inventory.js`). `bufferDays` = `cache.settings.bufferDays` (ברירת מחדל 3), `skipWeekends` (ברירת מחדל true, שישי/שבת דלוגים). תוצאה לכל מידה: `{sizeText,totalInStock,sampleItemId,availableQuantity,withNormalBuffer:{availableQuantity,bufferDays},withCustomSpacing:null|{availableQuantity,bufferDays,gain}}`. מפחית את הכמות ב-`order.items` שאינם `isDeleted/isReturned` לאותו דגם+מידה. ממוין ב-`sortSizeRows`.
- **`addItemToOrder` (842) — סדר בדיקות:**
  1. `selectedSizes.length===0` → `alert('יש לבחור דגם ומידה אחת לפחות לפני ההוספה')`.
  2. אם `enable_alterations!=='false'` וסומן תיקון וללא `repairs` → `repairs = describeAlterations(item)` (לא חוסם).
  3. לכל מידה: אם אין ב-`availableSizes` או `availableQuantity<=0` → `unavailable[]`, אחרת `validSizes[] {sizeText,sampleItemId}` (הבדיקה משתמשת ב-`availableQuantity` הכללי, כלומר עם ציפוף אם הוגדר).
  4. אם `validSizes` ריק → `alert('כל המידות שנבחרו אזלו מהמלאי לתאריך זה.')`.
  5. `max_items_per_order` (int>0) ו-`order.items.length + validSizes.length > max` → `alert('הגבלת מערכת: לא ניתן להוסיף יותר מ-N פריטים להזמנה (בחרת X מידות, יש כבר Y בסל).')`.
  6. `GET /api/orders/pricing` לכל מידה.
  7. נוספת שורה לכל מידה (`quantity:1`) — ראה מבנה לעיל; ה-`newItem` נשאר (דגם/שם) ומתאפסים `selectedSizes, repairs, neck/sleeve/lengthAlteration`.
  8. אם `unavailable` לא ריק → `alert('שימו לב: המידות הבאות אזלו מהמלאי ולא נוספו: ...')`.
- **חישוב מחיר:** כל שינוי פריטים/תאריך/משלוח → `POST /api/orders/calculate`. `totalAmount = calculatedData.totalAmount` (פריטים + תיקונים + דמי משלוח לפי `delivery_price_by_city[deliveryCity]` או `delivery_price` או 50, ×2 להלוך-חזור). מקדם חו"ל מקטגוריית מחירון "חול"/'חו"ל'. `ENABLE_SET_DISCOUNTS` וקטגוריות "כלול ב". `gap_size_price_rule`. מחיר שורה בתצוגה: `calculatedData.items[idx].calculatedPrice ?? item.finalPrice ?? 0`. **התאמה לפי אינדקס** (`calculatedItems[idx]`) — חובה לשמור על סדר.
- **בדיקת זמינות בשרת בזמן שמירה:** `validateOrderItemsAvailability` ב-`POST /api/orders` (חייבת להישאר; הקליינט לא בודק שוב לפני POST).
- **`removeItem`:** מחזיר +1 לזמינות המקומית רק אם הדגם שווה ל-`newItem.dressModelId` (אופטימי; ה-effect ממילא מחשב מחדש).
- **`editItem`:** `newItem.quantity` נטען מהפריט אך `addItemToOrder` תמיד יוצר `quantity:1`.

### זרימה 4 — טיוטות (Drafts) — **שרת, לא localStorage**
- **אין שימוש ב-localStorage/sessionStorage לטיוטות בעמוד זה.** הטיוטה = שורת `Order` עם סטטוס `'טיוטה'` (`DRAFT_ORDER_STATUS`), נשמרת בשרת.
- **Autosave effect (page.js:1005):** תנאים: `!draftSealedRef.current && order.customerId && datesFilled && activeItems.length>0`. Debounce **1500ms**. תלויות: `customerId,eventDate,eventDateHebrew,returnDate,isAbroad,isWeekdayEvent,fromDate,toDate,notes,customSpacing,items,totalAmount`. **לא** תלוי בשדות משלוח/סניף/HOK/תשלומים (לא נשמרים בטיוטה). כל שמירה משורשרת ב-`draftQueueRef` (סדרתי, למניעת שתי יצירות במקביל). כשל: `console.error` בלבד.
- תגובה `{orderId}` → `draftOrderIdRef.current`+`draftOrderId` → toast "נשמרה טיוטה #N" (פעם אחת לכל id) + קישור בטופ-בר + שימוש ב-`excludeOrderId` ב-preload ו-`orderId` ב-validate-inventory (כדי שפריטי הטיוטה לא ייספרו כפול).
- שרת (`/api/orders/draft`): מאמת מלאי (409 בכשל — **הקליינט מתעלם בשקט**), מחליף את כל הפריטים (`cartStatus:'pending'` → שחרור לפי `inventory_hold_minutes`), מריץ `recalculateOrderObligations`, מנקה טיוטות אחיות ללקוח/תאריך.
- **חיוב אשראי → `reserve`:** אם אין מספר הזמנה בעת חיוב, `POST /api/orders/reserve` יוצר placeholder (`isDeleted:true`) ושומר אותו גם כ-`draftOrderIdRef`.
- **Seal בשמירה:** `executeSaveOrderForList` קובע `draftSealedRef=true` וממתין ל-`draftQueueRef`; `abandonSave()` (במקרה כשל/409) מחזיר `false` וגם `setSaving(false)`.
- **יציאה:** מודל M8 מציג אם נשמרה טיוטה. **Back-guard:** effect (1057) — ברגע ש-`customerId || activeItems || newCustomer בעל ערך || phoneSearchInput` → `history.pushState({gemachOrderGuard:true})` פעם אחת (`backGuardArmedRef`); `popstate` → `window.confirm` (M4).
- ⚠️ **בניגוד לזיכרון "Order unsaved-drafts feature"** (localStorage בכרטיס הזמנה קיימת) — זה מנגנון נפרד לגמרי ואין לבלבל.

### זרימה 5 — תשלום ושמירה
**5א. `saveOrder` (1101) — סדר מדויק:**
1. `!customerId` → 'יש לבחור לקוח'.
2. `selectedCustomer.phone1` **וגם** `phone2` ריקים → 'לא ניתן לסגור הזמנה ללקוח ללא מספר טלפון. יש להשלים מספר טלפון בכרטיס הלקוח.'
3. `!hasDates` → `(isAbroad||isWeekdayEvent) ? 'יש לבחור תאריכים עבור אירוע חו"ל/מיוחד' : 'יש לבחור תאריך אירוע'`.
4. `items.length===0` → 'יש לבחור לפחות פריט אחד'.
5. `validateDeliveryFields` → alert.
6. תאריך עבר (`relevantDate = (isAbroad||isWeekdayEvent)?fromDate:eventDate`, `setHours(0,0,0,0)` מקומי < היום) → `verifyPin(..., 'feature:past_date_order_approval')` ("התאריך שנבחר להזמנה זו הוא תאריך שעבר. שמירת הזמנה לתאריך שעבר דורשת אישור מנהל. אנא בחר מנהל והזן סיסמה:"); כישלון → עצירה (**לפני** חיוב).
7. `pAmount=parseFloat(payment.amount)||0`; `totalWithCurrent = totalPaidSoFar + pAmount`; `isManagerExitPayment = method==='יציאה באישור מנהל'`; `isCreditCardPayment = method.includes('אשראי') && !includes('חיצונית')`.
8. אם לא יציאה-באישור-מנהל וגם `totalWithCurrent < totalAmount` → alert 'לא ניתן לסיים הזמנה לפני תשלום מלא. אנא הוסף את התשלום החסר, או בחר "יציאה באישור מנהל". כדי לפצל בין כמה אמצעי תשלום, השתמש בכפתור "אישור תשלום" כמה פעמים.'
9. אם `pAmount>0 && isCreditCardPayment && !creditProcessedConfirmation` (תמיד true בפועל) → פותח מודל אשראי עם `amount=payment.amount` ועוצר.
10. אם `isManagerExitPayment || (pAmount>0 && !isCreditCardPayment)`: `level = PAYMENT_APPROVAL_LEVEL||'כולם'`; אם level ∈ {מנהל, עובד, מנהל סניף ומעלה} → `customAuthPrompt('יציאה מהזמנה בלי תשלום מלא דורשת אישור של מי שהורשה לכך. אנא בחר משתמש והזן סיסמה:', 'feature:payment_exit_approval')`; ביטול → `alert('אישור תשלום בוטל.')`; אימות `verify-pin` (כשלים כמפורט). ('כולם' = אין אישור).
11. `finalPayments = [...paymentsList]`; יציאה-באישור-מנהל → דוחף `{...payment, amount:0, notes:"יציאה באישור מנהל (סכום מבוקש: ₪X) | notes"}`; אחרת `pAmount>0` → דוחף `{...payment, amount:pAmount}`.
12. `executeSaveOrderForList(finalPayments)`.
**5ב. `handleProcessCreditCard` (293):** חובה שדות → `isProcessingCredit=true`, `creditError=''`; `cust = order.selectedCustomer || newCustomer`; reserve אם צריך (N13); `POST /api/nedarim` (N14). הצלחה: `conf = data.confirmation||'בוצע'`; סוגר מודל; דוחף ל-`paymentsList` `{amount, method: payment.method, notes: "אישור נדרים: conf | notes"}`; `newTotalPaid = Σ`; אם `>= totalAmount` → `executeSaveOrderForList(updatedList)` (שמירה אוטומטית!); אחרת `alert('תשלום חלקי עבר בהצלחה. יש להשלים את יתרת התשלום (או לצאת באישור מנהל) כדי לסיים את ההזמנה.')`. `finally` → `isProcessingCredit=false`.
**5ג. `executeSaveOrderForList(list, force=false)` (1212):** `pendingSavePaymentsRef=list`, `saving=true`, seal draft + `await draftQueueRef`; בונה payload (N16); תגובות:
- `409 && duplicateOrder` → `abandonSave()`, מודל M10.
- `409 && validationErrors` → `abandonSave()`, alert מלאי ("לא ניתן לשמור את ההזמנה עקב חוסר במלאי...").
- `!res.ok` → throw `Error(data.error||'Failed to save order' + (details? ' (details)':''))` → catch: `alert('שגיאה בשמירת הזמנה: <msg>')` + `abandonSave()`.
- הצלחה: `if (data.warning) alert(data.warning)`; אם `auto_print_on_order_create==='true' && data.orderId` → `window.open('/print/order?orderId=..&type=order','_blank')`; `router.push(resolveOrderRedirectHref(order_new_redirect_screen||'order', {orderId,customerId}))`. **`saving` נשאר true אחרי הצלחה** (המסך נעלם בניווט).
- `resolveOrderRedirectHref`: `new_order`→`/orders/new`; `orders_list`→`/orders`; `customer`→`/customers/{customerId}` (או `/orders`); `rentals`→`/rentals`; `dashboard`→`/`; `order`/ברירת מחדל→`/orders/{orderId}` (או `/orders`).
**5ד. `isChargedPayment(p)`** = `(p.notes||'').includes('אישור נדרים')`.

---

## (ז) מצבים מיוחדים

- **טעינה:** `isCheckingPhone` ("מחפש..."), `loadingSizes` ("(בודק זמינות...)"), `loadingPreload` (מנטרל כפתור רענון), `calculating` ("מחשב מחירים..."), `saving` ("שומר..."), `isProcessingCredit`, `busy` = מסך חוסם M13. `CustomerSelector`: "טוען...". `OrderModelSelector`: spinner במקום איקון חיפוש.
- **ריק:** סל ריק (`#i-bag`), תשלומים ריקים (`#i-wallet` "טרם נרשמו תשלומים"), "אין מידות זמינות לתאריך זה." / "בחר דגם כדי לראות מידות זמינות.", "לא נמצאו לקוחות.".
- **שגיאה:** ראו (ו)/(י). אין מצב offline מפורש; שגיאות fetch → console.error/alert.
- **קריאה בלבד / הרשאה:** אין תצוגה מוסתרת-לפי-הרשאה בתוך העמוד; הכל דרך PageGate + אישורי PIN.
- **שינוי אוטומטי של state ע"י effects:** `payment.amount` = יתרה; `payment.method`=opts[0] בטעינה; `order.branch` מ-localStorage; בחירת מידות מתאפסת.
- **SystemSetting keys (קליינט):**
  | key | השפעה |
  |---|---|
  | `ALLOWED_PAYMENT_METHODS` | אפשרויות אופן תשלום (ברירת מחדל: אשראי (דרך נדרים פלוס), מזומן, יציאה באישור מנהל) |
  | `nedarim_plus_enabled` (`!=='false'`) | כפתור "חיוב אשראי" + סינון אופציות אשראי |
  | `PAYMENT_APPROVAL_LEVEL` | ברירת מחדל 'כולם'; מנהל/עובד/מנהל סניף ומעלה → אישור |
  | `mandatory_fields`, `mandatory_field_groups`, `strict_mandatory_fields`, `require_customer_email`, `require_full_address`, `require_marketing_consent`, `hide_marketing_consent_field`, `require_customer_id_number` (נווה יעקב), `require_id_for_edit_cancel` | חובות לקוח |
  | `hok_enabled` | שדות הוראת קבע + `hokDetails` |
  | `max_items_per_order` | תקרת פריטים (שרת: + `enforce_strict_max_items`) |
  | `enable_alterations` (`!=='false'`) | תיקונים |
  | `hide_custom_spacing` | מסתיר ריווח (שרת מאפס) |
  | `phone_order_marker_enabled`, `track_branch_on_order`, `branches_enabled`, `branch_list`, `delivery_show_in_order` (`!=='false'`), `enable_deliveries`, `delivery_allow_address_override`, `delivery_one_day_before_option`, `delivery_price_by_city` | משלוח/סניף/טלפוני |
  | `auto_print_on_order_create`, `order_new_redirect_screen` | אחרי שמירה |
  | שרת בלבד: `inventory_buffer_days`, `inventory_skip_weekends`, `inventory_include_warehouse`, `allow_renting_reserve_items`, `inventory_hold_minutes` (15), `ENABLE_SET_DISCOUNTS`, `gap_size_price_rule`, `delivery_price`, `auto_email_on_order_create`, `mailing_list_auto_sync`, `gmach_*` |
- **הבדלים לפי ארגון (הזמנה: נווה יעקב מול ראשי):** אין `if (org)` בקוד העמוד — ההבדלים נובעים רק מהגדרות. מסומן בקוד כ-org-specific: `require_customer_id_number` (נווה יעקב בלבד), דיווחי org2 ב-delivery (`delivery_price_by_city`, כתובת/עיר חובה), `enable_deliveries`, `delivery_one_day_before_option`, ומשוב "9000aab4 (נווה יעקב)" על הצגת ברקוד במקום "ללא שם" ב-`OrderModelSelector`. ברירות מחדל **בקוד** משפיעות בשני הארגונים כשהשורה חסרה.

---

## (ח) URL / localStorage / sessionStorage

- **URL params:** אין קריאת `searchParams` בעמוד. מבנה יציאה: `/orders`, `/orders/{id}`, `/customers/{id}`, `/print/order?orderId=&type=order`, `/orders/new` (redirect).
- **localStorage:**
  - `gemach_last_order_branch` — נכתב ב-onChange של select "סניף ביצוע" (רק אם val), נקרא ב-effect (רק כש-`track_branch_on_order==='true'`) (page.js:412, 2066).
  - `capacity_search_history` — `CapacitySearchModal` (קורא ב-mount, כותב אחרי כל חיפוש מוצלח, 50 אחרונים; ללא try/catch).
- **sessionStorage:** אין.
- **`fetchSharedJson` cache (in-memory, `lib/apiCache.js`):** `/api/settings` (TTL.STATIC 5 דק'), `/api/customers/locations` ו-`/api/inventory/models?q=` (TTL.REFERENCE 2 דק'); רענון ב-focus אחרי 60s (`FOCUS_STALE_MS`).
- **History API:** `pushState({gemachOrderGuard:true})` + מאזין `popstate`.
- **Globals נדרשים:** `window.customConfirm`, `window.customAuthPrompt` (`app/components/PopupProvider.js:200-202`) — חייבים להיות זמינים בעמוד.
- **מסמך:** מאזין `keydown` (Escape) גלובלי.

---

## (ט) הדפסה / ייצוא / AI

- **הדפסה:** אוטומטית בלבד — `window.open('/print/order?orderId=<id>&type=order','_blank')` כש-`auto_print_on_order_create==='true'`. אין כפתור הדפסה בעמוד.
- **מייל:** אין ב-UI; השרת שולח מייל אישור אם `auto_email_on_order_create==='true'` והלקוח עם מייל תקף.
- **ייצוא / AI:** אין.
- **חיוב חיצוני:** נדרים פלוס דרך `/api/nedarim` (הערה נכנסת ל-Nedarim: "באמצעות תכנת הגמח; מס הזמנה: N").

---

## (י) מלאי מחרוזות עבריות קצר (מפתחות טקסט שחייבים להישמר משמעותית; לפי R10 מותר לשכתב ניסוח, אך לא את הלוגיקה שתלויה בטקסט)

**⚠️ מחרוזות שהלוגיקה תלויה בהן (אסור לשנות ערך):**
- `'יציאה באישור מנהל'` — השוואה מדויקת (`payment.method === ...`) + ערך ברירת מחדל.
- כל אופציה שכוללת `'אשראי'` ולא `'חיצונית'` = אשראי.
- `'אישור נדרים'` בתוך `payment.notes` = תשלום שחויב (נעול להסרה).
- `deliveryDirection` ערכים: `'הלוך' | 'חזור' | 'הלוך-חזור'` (משפיעים על חישוב מחיר: הלוך-חזור ×2).
- סטטוס `'טיוטה'` (שרת).
- `requiredLevel` strings: `'הנהלה ראשית'`, `feature:*`.
- כינויי `mandatory_fields` (עברית/אנגלית) — ב-`CUSTOMER_FIELD_ALIASES`.
- `describeAlterations` פורמט נשמר בשדה `repairs` (נכנס לתיק).

**כותרות/תוויות:** הזמנה חדשה · מי הלקוח? · מתי האירוע? · אילו פריטים? · סיכום · תשלום וסיום · לקוח/תאריכים/פריטים/סיכום/תשלום · לפי טלפון/מהרשימה/לקוח חדש · בדיקה והמשך · כן, זה הלקוח · אף אחד מאלה - לקוח חדש · שמור לקוח והמשך · פרטים נוספים · אירוע רגיל · חו"ל / תפוסה ארוכה · תאריך אירוע · הערות וריווח ימים · ריווח ימים בין השכרות · משלוח / סניף / טלפוני · הוספת פריט · בסל · תיקונים לפריט · פירוט לתופרת · הוסף לסל · פרטי ההזמנה · סה"כ · סה"כ לתשלום · סה"כ חיובים · שולם · יתרה · תשלומים שנרשמו · אישור תשלום · חיוב אשראי · סיום ויצירת ההזמנה · שומר... · חזור · ביטול · המשך · המשך לבחירת פריטים · המשך לסיכום · המשך לתשלום.
**הודעות שגיאה/alerts (מלא):** 'נא להזין מספר טלפון תקין' · 'שגיאה בחיפוש הלקוח' · 'יש למלא: …' · 'יש למלא: תעודת זהות' · 'שגיאה בשמירת לקוח: …' · 'יש לבחור לקוח' · 'לא ניתן להמשיך - ללקוח חסרים פרטי חובה: …' · 'שגיאה: תאריך החזרה (עד תאריך) אינו יכול להיות לפני תאריך ההתחלה (מתאריך)!' · 'שגיאה בבדיקת מלאי: …' · 'שגיאה בבדיקת המלאי מול השרת.' · 'יש לבחור דגם ומידה אחת לפחות לפני ההוספה' · 'כל המידות שנבחרו אזלו מהמלאי לתאריך זה.' · 'הגבלת מערכת: …' · 'שימו לב: המידות הבאות אזלו מהמלאי ולא נוספו: …' · 'לא ניתן לסגור הזמנה ללקוח ללא מספר טלפון…' · 'יש לבחור תאריכים עבור אירוע חו"ל/מיוחד' · 'יש לבחור תאריך אירוע' · 'יש לבחור לפחות פריט אחד' · 'לא ניתן לסיים הזמנה לפני תשלום מלא…' · 'אישור תשלום בוטל.' · 'סיסמה שגויה או חסרת הרשאה.' · 'שגיאה באימות קוד מנהל.' · 'יש להזין סכום גדול מ-0' · 'אנא מלא את כל השדות החובה (מספר כרטיס, תוקף, וסכום).' · 'שגיאה בחיוב הכרטיס' · 'שגיאת תקשורת בחיוב הכרטיס' · 'תשלום חלקי עבר בהצלחה…' · 'שגיאה בשמירת הזמנה: …'.
**Tooltips/aria:** יציאה מהמסך · רענן זמינות מלאי · בדוק תפוסה / "בדוק תפוסה לתאריך האירוע" · ערוך פריט · הסר פריט · הסר תשלום · "חיוב אשראי שכבר בוצע — לא ניתן להסרה" · קיצור אורך בסנטימטרים · פריטים בסל · רשימת פריטים בהזמנה · שלבי ההזמנה · נקה בחירה · סגירה · פעולה מתבצעת · קלט קורא כרטיסים · "העברת כרטיס מהירה בקורא מגנטי" · "פתח את הטיוטה בכרטיסייה נפרדת".
**Placeholders:** 05... · נייד או קווי · לשליחת ההזמנה במייל · ת״ז · חפש לקוח לפי שם, טלפון, עיר... · חפש דגם פריט... · בקשות מיוחדות, סיכומים עם הלקוח... · מה בדיוק לתקן... · ס״מ · כתובת למשלוח (שונה ממגורים) · מספר אישור, פרטי הבנק, שם המשלם... · 0000 0000 0000 0000 · 12/25.
**מחרוזות שבנויות מנתונים:** `נשמרה טיוטה #N` · `${n} פריטים · ₪X` · `שולם ₪X` · `מ-{heb} עד {heb}` (שלב 4) / `{heb} — {heb}` (stepper) · `נמצאו N לקוחות עם מספר טלפון זה - יש לבחור את הלקוח הנכון.` · `חסר ללקוח: …` · `אחד מבין: X / Y` (קבוצות).
**קבועים:** `getCustomerFullName(c)` (export מהעמוד! — ייתכן שמיובא ממקומות אחרים; ראו סיכון): `null` → 'לא נבחר'; שם ריק/'null'/'undefined' מסוננים; ריק → 'לקוח ללא שם'.

---

## (יא) הערות סיכון (לוגיקה שזורה במבנה)

1. **`export const getCustomerFullName`** מיוצא מ-`page.js` — בדקו `grep -r "orders/new/page"` לפני העברה/שינוי שם קובץ; יש להשאיר את הייצוא בנתיב.
2. **`<form onSubmit>` בשלב 5** — כפתור "אישור תשלום" הוא `type=submit`; Enter בשדה סכום מפעיל `handleAddPaymentClick`. שבירת מבנה ה-form תשבור Enter. כפתור "חיוב אשראי" הוא `type=button` **בתוך** ה-form.
3. **מודל אשראי:** כפתור submit נמצא ב-footer **מחוץ** ל-`<form id="credit-charge-form">` ומקושר ב-`form="credit-charge-form"`. אל להפריד `id`.
4. **מעטפת `NewOrderShell` `key={step}`** על ה-`<section>`: החלפת שלב מפרקת ומרכיבה מחדש את תוכן השלב (מאבד state מקומי של קומפוננטות ילדים כמו `NocCollapsible`, `HebrewDatePicker`, `CustomerSelector` — `order`/`newCustomer` נשמרים כי הם state של העמוד). לשמור על הסמנטיקה של איפוס.
5. **`NocCollapsible`** — `<details open onToggle>`; `openWhen` פותח (אך אינו סוגר). ה-badge מוצג רק כשסגור. `editItem` מסתמך על כך ש"תיקונים לפריט" נפתח (`openWhen=alterationsChosen`).
6. **`pendingSpacingChange` null-vs-0:** `null` = אין מודל, `0` = ציפוף "ללא" ממתין. כל שינוי ל-truthiness יפרוץ.
7. **`isWeekdayEvent`** בלי UI (ר' C0) ובלי הכללה בבדיקות `hasDates` של preload/availability — התנהגות קיימת, לא לתקן בעיצוב מחדש.
8. **אין הגנה מפני "חיוב כפול"** מלבד `busy` overlay ו-`disabled`. שמירה אחרי חיוב מלא נקראת ישירות מ-`handleProcessCreditCard` (לא דרך `saveOrder`, ולכן **לא** עוברת בדיקות תאריך-עבר/PAYMENT_APPROVAL — אלה כבר עברו לפני פתיחת המודל בנתיב `saveOrder`, אך **לא** בנתיב כפתור "חיוב אשראי" בשלב 5 שפותח מודל ישירות; ואז אין בדיקת תאריך עבר לפני החיוב). יש לשמור ההתנהגות זהה.
9. **`creditProcessedConfirmation`** אינו נקבע לעולם (מת) — התנאי בשורה 1137 תמיד נכון; אל להסיר בלי הבנה.
10. **`payment.amount` נדרס ע"י effect** בכל שינוי `totalAmount`/`paymentsList` — קלט ידני של המשתמש נמחק בשינוי כזה. שדה סכום הוא controlled string/number מעורב (`remainder` number מול `e.target.value` string).
11. **התאמה לפי אינדקס** בין `order.items[idx]` ל-`calculatedData.items[idx]` (סל, סיכום, ושמירה `itemsToSave`) — סידור מחדש/סינון של הפריטים בתצוגה שובר מחירים. `key={idx}` במפות.
12. **`handleDateChangeWithValidation` async ו-`setOrder(proposedOrder)` עם `order` מה-closure** — race אפשרי; אל לקרוא לו מתוך ריצות מקבילות. גם ה-DatePicker `onChange` תלוי בכך שה-callback אסינכרוני.
13. **Effects עם תלות ב-`order.items` שלמה** (availability, calculate, draft) — יצירת אובייקט `items` חדש בכל render תיצור לולאות/ריבוי קריאות; אל להעביר `order.items` דרך wrapper שיוצר מערך חדש.
14. **`draftOrderIdRef` לעומת `draftOrderId`:** ה-ref משמש ב-fetch/effects (ללא רענון cache), ה-state לתצוגה בלבד. אל להחליף ב-state.
15. **`window.customConfirm`/`customAuthPrompt`** הם globals מ-PopupProvider; מודלי v3 חדשים (R19) חייבים לשמר את חוזה ההחזר (`await confirm → boolean`, `customAuthPrompt → {pin, employeeId}|null`), ואת ה-`level` ההולך אליו.
16. **מודלי fixed עם `z-index`:** M13 (1600) > אחרים (1500) > `ItemCapacityModal` (1100) > CustomerSelector/OrderModelSelector dropdowns (999999 portal). `CustomerSelector`/`OrderModelSelector` מרונדרים ב-portal עם `position:fixed` ו-`getBoundingClientRect` (עוקבים אחרי scroll capture) — RTL: `OrderModelSelector` משתמש ב-`left` פיזי במכוון (ר' הערה בקוד).
17. **`CustomerSelector`** לא מקבל `error` בעמוד; ה-`onChange(null)` (כפתור נקה) מאפס `customerId` (חוסם את "המשך").
18. **autoComplete מכוון:** `"new-password"` בכל שדות לקוח חדש + `name` אקראי ב-`OrderModelSelector` — למניעת autofill של הדפדפן (דיווחים). אל להסיר.
19. **`autoFocus` בשדה טלפון** (שלב 1) ו-`autoFocus`+`onBlur` refocus בקלט ה-swipe הנסתר — חיוניים לקורא כרטיסים.
20. **Escape handler** תלוי ב-state של המודלים; מודלים חדשים שלא נוספו לשרשרת לא ייסגרו ב-Escape (התנהגות קיימת — M5/M8/M9/M10 אינם נסגרים ב-Escape).
21. **מספרים:** `toLocaleString('he-IL')` על סכומים; מחירי שורה מוצגים גולמיים (`₪{price}`) ללא פורמט. שדה סכום `type=number` ללא `step`.
22. **הערות (`order.notes`) מופיעות בשני מקומות (שלב 2 ו-3) עם `id` שונים** אך אותו state; לא לפצל.
23. **הכפילות `savedCustomer` ו-`selectedCustomer`:** בנתיב "לקוח חדש" `selectedCustomer = data` מהשרת (תגובת POST) — משמש לבדיקת `phone1/phone2/city` ב-`saveOrder` ובאימות משלוח.
