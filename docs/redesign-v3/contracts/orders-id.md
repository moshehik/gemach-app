# חוזה: כרטיס הזמנה `/orders/[id]`

קבצים בטווח: `app/orders/[id]/page.js` (P), `components/orders/modern/ModernOrderCard.js` (MOC), `ModernGeneralDetails.js` (MGD), `ModernInfoTab.js` (MIT), `components/orders/ActiveEmployeesModal.js` (AEM), `components/orders/OrderPrintMenu.js` (OPM, נטען מתוך MOC), `app/lib/orderDrafts.js`, `lib/historyManager.js`, `lib/orderRedirectScreens.js`, `lib/orderStatus.js`, `lib/deliveryValidation.js`, `components/orders/modern/mocAuth.js` (verifyPin), `components/modern/ChangesChips.js`.
ItemsManager/PaymentsManager מכוסים ב-`orders-id-items-payments.md`; כאן רק ממשק העמוד אליהם (סעיף 12).
כל הפניות `P:nnn` = `app/orders/[id]/page.js` שורה nnn.

---
## א. מטרה וגישה
- כרטיס הזמנה יחיד: עריכת פרטי הזמנה (לקוח, תאריכים, משלוח, הערות), פריטים והשכרות, תשלומים/חיובים/זיכויים, היסטוריה. כל העריכות נשמרות ב-state מקומי עד "שמור שינויים" (PUT יחיד), חוץ מפעולות שמסתובבות לשרת מיד (פריט מאושר, זיכוי, חתימת תקנון, מייל).
- גישה: `page:orders` נאכף ב-`app/orders/layout.js` (`canOpenPage("page:orders")`; ברירת מחדל: הנהלה ראשית/מתכנת בלבד, אחרת לפי שורת הרשאה). אין בדיקת הרשאה נוספת בתוך העמוד עצמו.
- מפתחות הרשאה (feature) הנדרשים בתוך הכרטיס, דרך `window.customAuthPrompt(msg, level)` + `POST /api/auth/verify-pin` `{pin, employeeId, requiredLevel}`:
  - `'מאשר הזמנה ללא תשלום'` (= feature:debt_approval) – שמירה/יציאה עם חוב חדש (P:778, P:1111). requiredLevel שנשלח בפועל: `'עובד'`.
  - `feature:item_change_approval` – ביטול פריט קיים כש-`require_manager_code_for_item_changes` (P:818).
  - `feature:locked_order_edit` – שחרור נעילת הזמנה שהאירוע שלה עבר (P:1409).
  - `feature:manual_payment_credit_add` – כפתור מאוחד תשלום/זיכוי ידני (P:1477).
  - `feature:order_date_edit_approval` – עריכת תאריך ביצוע (MGD:105, MIT:78); ה-authResult נשלח שוב ב-PUT כ-`orderDateApproverId/orderDateApproverPin` (P:880).
  - `feature:special_spacing_approval` – הקטנת ציפוף ימים (MGD:91).
  - `feature:customer_email_approval` – מייל מהיר (MGD:119).
- `verifyPin` (mocAuth.js) = customAuthPrompt → POST verify-pin → מחזיר authResult או null; alert בכישלון (`data.error || 'סיסמה שגויה או הרשאה לא מספקת.'`, `'שגיאה באימות מול השרת.'`).
- `window.customAuthPrompt / customConfirm / customThreeWayConfirm / customPrompt` מסופקים ע"י `app/components/PopupProvider.js` (גלובלי, `window.*`). העמוד תלוי בהם; יש fallback ל-`window.confirm`/`prompt` רק ב-customConfirm ו-customPrompt (לא ב-customAuthPrompt ולא ב-customThreeWayConfirm – חובה שיישארו קיימים).

## ב. מבנה, סדר אזורים (מלמעלה למטה)
P מחזיר Fragment:
1. `showSaveSuccessOverlay` – מודל הצלחה מסך-מלא (5 שנ') (P:1571).
2. חלון `summaryConfirmData` – "סיכום ההזמנה לפני שמירה" (Portal) (P:1590).
3. חלון `paymentContinueAmount` – "השלמת תשלום" (Portal) (P:1677).
4. באנר `pendingDraft` – שחזור/מחיקת טיוטה (P:1731).
5. `<ModernOrderCard>` (MOC) שמכיל:
   a. `page-head`: כותרת `הזמנה #{orderId}` + תג חתימה על תקנון; `page-actions` (ראה ד).
   b. callout של `saveMessage` (אדום אם מכיל "שגיאה"/"בוטלה", אחרת ירוק) (MOC:208).
   c. כרטיס סיכום: avatar ראשי תיבות, שם לקוח, תג סטטוס, טלפון, מייל, תאריך אירוע, "עודכן: ...", שדה סריקה מהירה.
   d. `tabs` (4 לשוניות) ואז 4 `tab-panel` – **כולם mounted תמיד**, רק ה-active גלוי (CSS). חובה לשמר (סטייט פנימי של ItemsManager/PaymentsManager + refs פעילים גם בטאב לא פעיל).
   e. מודל שחרור נעילה (Portal) (MOC:290).
6. `ActiveEmployeesModal` (P:1868).
7. מודל "כתובת מייל חסרה" (Portal) (P:1877).

לשוניות (`TABS`, MOC:31; `activeTab` ברירת מחדל `'items'`, P:227):
| id | תווית | אייקון | תוכן |
|---|---|---|---|
| details | פרטים כלליים | i-user | ModernGeneralDetails |
| items | פריטים והשכרות (+ badge ספירת פריטים לא-מחוקים) | i-bag | ModernItemsManager |
| payments | תשלומים | i-card | ModernPaymentsManager |
| history | מידע | i-history | ModernInfoTab |
(ModernRentalsManager אינו מורכב בעמוד זה.)

מצבי עמוד: `loading` → `<div class="page-loading">` + spinner + "טוען נתוני הזמנה..." (P:1032); `!order` (fetch נכשל) → empty-state אייקון `#i-alert-circle` + "הזמנה לא נמצאה" (P:1041). שגיאת fetch נבלעת (console.error בלבד).

## ג. שדות וקלטים
### ג1. MOC – סריקה מהירה
- `scanValue` (text input, placeholder "סריקה מהירה — השכרה / החזרה"); submit של form → `handleScanSubmit`: trim, ריק=כלום, מנקה, קורא `onQuickScan(code)` (→ P `handleQuickScan`: `setActiveTab('items')` + `itemsManagerRef.current.scan(barcode)`). ללא ולידציה אחרת. הערת עזר מתחת (טקסט קבוע).
- נגזרות מוצגות: `customerName` (`'לא נבחר לקוח'` אם אין), `initials`, `orderStatus = calculateOrderStatus(order,{draftsAsDeleted})`, `eventDateLabel`: אם `isAbroad||isWeekdayEvent` → `fromDate — toDate||returnDate` (עברי) או `'אירוע חו"ל'`; אחרת `eventDateHebrew` או עברי של `eventDate` או `'ללא תאריך אירוע'`. `updatedLabel` = "עודכן: {עברי} · {HH:MM}" מ-`order.updatedAt`.
- מיפוי סטטוס→badge: הוחזר=success, הוחזר חלקי=warning, הושכר=info, הושכר חלקי=accent, בקרוב=warning, עבר/מחוק/טיוטה/ברירת מחדל=neutral.
- חוב: `debt = totalRequired - totalPaid`; `saveNeedsApproval = debt>0 && !(openedDebt!=null && round(debt*100)==round(openedDebt*100))` – מציג תג אדום עם סכום על כפתור השמירה (רק קוסמטי אך מקביל ללוגיקת handleSave).

### ג2. MGD – טאב "פרטים כלליים" (state מקומי + עדכון `order` דרך `onOrderChange(prev=>({...prev,...updates}))` שמדליק `hasUnsavedChanges=true`)
State פנימי: `showManualPaymentCreditChooser`, `isEditingEvent` (ברירת מחדל true אם אין eventDate וגם אין fromDate), `showCustomerModal`, `customerMode` ('existing'|'new'), `newCustomer{firstName,lastName,phone1,email,city,street,houseNum}`, `isEditingOrderDate`, `orderDateApproval`, `isEditingDelivery` (מתחיל true אם `isDelivery && !deliveryCity`), `systemDefaultSpacing` (3), `enableRentalExtension`, `hideCustomSpacing`, `deliverySettings{enabled,allowAddressOverride,oneDayBeforeOption,priceByCity}`, `fallbackCities`.

כרטיס לקוח (MGD:263): שם, שורת קשר (`phone1 · phone2 · email · כתובת` או 'אין פרטי קשר' / 'לא נבחר לקוח — לחץ על אייקון העריכה לבחירה'). כפתורים: תג חתימה, מייל מהיר, קישור `/customers/{id}` (target=_blank, רק אם `customer.id`), החלפת לקוח.

כרטיס אירוע – תצוגה (MGD:302) / עריכה (MGD:323):
| שדה | state (על order) | הערות |
|---|---|---|
| סוג אירוע pill "אירוע רגיל"/"אירוע חו"ל" | `isAbroad`,`isWeekdayEvent` | חו"ל: `changeDates({isAbroad:true,isWeekdayEvent:false,eventDate:null,eventDateHebrew:null})`; חזרה לרגיל: `{isAbroad:false,isWeekdayEvent:false,fromDate:null,toDate:null,returnDate:null}`. `isAbroad` נגזר = `order.isAbroad||order.isWeekdayEvent` |
| תאריך אירוע (HebrewDatePicker) | `eventDate` (+`eventDateHebrew` מחושב אוטומטית ב-`changeDates` אם לא נשלח) | רק לא-חו"ל |
| טווח תאריכים לקיחה/החזרה (HebrewDateRangePicker startDate=fromDate, endDate=toDate\|\|returnDate) | `fromDate,toDate,returnDate(=toDate),eventDate(=fromDate)` | משמר שעת יום קודמת (`applyTime`, שעה ISO) |
| יום השכרה נוסף (ללא/לפני/אחרי) | `extraDay` (null/'before'/'after') + הזזת from/to/returnDate ב-±1 יום (`setExtraDay`) | רק אם חו"ל **וגם** `enable_rental_extension==='true'` |
| הערות להזמנה (textarea 3 שורות) | `notes` | placeholder "הערות כלליות לגבי ההזמנה..." |
| הערות פנימיות | `internalNotes` | "לא מוצג ללקוח" |
- כפתור "סיים עריכה" (V) → `isEditingEvent=false`; במצב תצוגה: סוג אירוע, תאריכים (עברי בלבד לחו"ל; `he-IL` + עברי לרגיל), badge "יום נוסף לפני/אחרי", "הערות: {notes}".

כרטיס ציפוף (MGD:225, נראה אם `!hideCustomSpacing && (isEditingEvent || hasCustomSpacing)`): pill "רגיל (לפי המערכת — N ימים)" + pills 0..`maxAxisDay` (`max(default+2, selected, 4)`) . `applyCustomSpacing(spacing)`: אם הערך החדש < הקודם (או ברירת מחדל) → verifyPin `feature:special_spacing_approval`; ערך שווה לברירת המחדל נשמר כ-`null`; מעדכן `customSpacing`. הודעה "דורש הרשאת מנהל · צובע את ההזמנה בצהוב...".

כרטיס משלוח (MGD:432; מוצג רק אם `enable_deliveries==='true'`):
- מתג `role=switch` "משלוח" → `isDelivery` (הדלקה פותחת `isEditingDelivery`). נגיש גם ב-Enter/Space.
- עריכה: `deliveryDirection` select (הלוך / חזור / הלוך-חזור; ברירת מחדל 'הלוך-חזור'); `deliveryCity` select (ערי `delivery_price_by_city` JSON keys, אחרת `fallbackCities` מ-`/api/customers/locations`; כולל העיר הנוכחית); `deliveryAddress` input (מוצג אם `delivery_allow_address_override==='true'` או `deliveryAddressRequired`); מתג `deliveryOneDayBefore` (אם `delivery_one_day_before_option==='true'`).
- חובה (חזותית בלבד כאן, נאכף בשרת דרך `validateDeliveryFields`): `isDeliveryCityRequired(order, customer.city, priceCities)` – כוכב אדום + hint; `isDeliveryAddressRequired(order, customer.city)` (עיר משלוח ≠ עיר לקוח) – כוכב + hint. טקסטי hint: "עיר המגורים של הלקוח אינה ברשימת ערי המשלוח - יש לבחור עיר משלוח." / "עיר המשלוח שונה מעיר הלקוח - יש להזין כתובת למשלוח."
- תצוגה מקוצרת: `כיוון · עיר · כתובת · יוצא יום לפני האירוע` או 'טרם הוזנו פרטי משלוח'; עיפרון/V.

כרטיס "תשלום / זיכוי ידני" (MGD:539; רק אם prop `showManualPaymentCreditButton` = `consolidate_manual_payment_credit_ui==='true'`): כפתור → chooser (Portal) עם "רישום תשלום נוסף (למשל מזומן)" → `onOpenManualPaymentCredit('payment')` ו"בקשת זיכוי ללקוח" → `('credit')`.

כרטיס תאריך ביצוע (MGD:552): תצוגה `he-IL (עברי)`; עיפרון → `requestOrderDateEdit` (verifyPin) → HebrewDatePicker → `handleOrderDateChange(date)`: `onOrderChange({...order, orderDate})` + `onSaveRequest(newOrder,{orderDateApproval})` (= **שמירה מיידית מלאה** של ההזמנה, P handleSave).

מודל "החלפת לקוח" (MGD:571, Portal) – ראו סעיף ו.

### ג3. MIT – טאב "מידע"
- `searchInput` (text "חיפוש בהיסטוריה...") + `filterSearch` (מוחל ב-submit "חפש"; "נקה" מאפס). ללא ולידציה.
- כרטיס "בוצעה על ידי": `order.employee` (שם) או 'לא ידוע' + `createdDate` (`order.orderDate||order.createdAt`) בפורמט `he-IL (עברי) · HH:MM`. עריכת תאריך: כמו MGD (`feature:order_date_edit_approval`) → `HebrewDatePicker` → `onOrderDateSave(date, approval)` → P: `setOrder({...order,orderDate:date}); handleSave(newOrder,{orderDateApproval})` (שמירה מיידית).
- כפתור "עובדים פעילים בהזמנה" → `onShowEmployees`.

## ד. כפתורים ופעולות (MOC page-head, P handlers)
| תווית/כותרת | handler | מה קורה |
|---|---|---|
| תג "חתם/לא חתם על תקנון" (גם ב-MGD) | `onToggleSignature`→P `handleToggleSignature` (P:1432) | customConfirm ('האם הלקוח חתם על תקנון ההשכרה?' / 'האם לסמן שהלקוח לא חתם על התקנון?') → `PUT /api/orders/{id}` body `{hasSignedRegulations}` בלבד → `handlePrintMenuOrderUpdate({hasSignedRegulations})` (מיזוג טלאי ל-order, **לא** מדליק hasUnsavedChanges). שגיאות: alert 'שגיאה בשמירת אישור החתימה' / 'שגיאת תקשורת...' |
| ארנק (חוב/זכות/שולם) `title` דינמי | `onWalletClick`→`handleWalletClick` | `setActiveTab('payments')`; אם `totalRequired-totalPaid>0` אחרי 60ms → `paymentsManagerRef.openCreditModal()`. סגנון: חוב>0 `btn-danger-ghost` + סכום; <0 secondary ירוק + סכום; 0 icon-only |
| מנעול (רק אם `isPastEvent`) | `handleLockClick` | נעול → `showUnlockModal`; פתוח → customConfirm 'האם ברצונך לנעול מחדש את ההזמנה?' → `onLock()` (`setIsUnlocked(false)`) |
| הדפסה/מייל (`OrderPrintMenu`, אייקון מדפסת) | OPM | ראו ט |
| מחיקה (`title` "מחיקת הזמנה") | `handleDeleteOrder` (P:1368) | ראו ה |
| ביטול שינויים (מושבת אם `!hasUnsavedChanges||saving`) | `handleCancelChanges` (P:1319) | ראו ד2 |
| "שמור שינויים" (+תג חוב; spinner בשמירה; disabled כש-`saving`) | `onSave = () => handleSave(null,{promptPrint:true})` | ראו ד1 |
| "חזור" (`title` "שמירה וחזרה לרשימת ההזמנות") | `onExit = () => handleExit()` | ראו ד3 |

### ד1. `handleSave(overrideOrder, {promptPrint, orderDateApproval})` (P:668) – סדר מחייב
1. `setSaving(true)`, `saveMessage=''`. `currentOrder = overrideOrder?.orderId ? overrideOrder : order` (חובה: onClick עלול להעביר event); אין הזמנה → alert 'שגיאה: נתוני ההזמנה לא טוענו כראוי'.
2. ולידציית תיקונים: לכל פריט לא-מחוק עם `neckAlteration||sleeveAlteration||lengthAlteration.trim()` חייב `alterationDetails.trim()` אחרת alert 'חובה להזין פירוט תיקון עבור כל פריט שיש לו תיקון מסומן (צוואר, שרוול או אורך).'.
3. תאריכים חובה כשיש פריטים פעילים: חו"ל/אמצע-שבוע → `fromDate&&toDate`, אחרת `eventDate`; alerts: 'חובה להזין תאריכי התחלה וסיום (אירוע חו"ל/מיוחד) עבור הזמנה הכוללת פריטים.' / 'חובה לבחור תאריך אירוע עבור הזמנה הכוללת פריטים.'.
4. `POST /api/orders/validate-inventory` body `{items: activeItems, eventDate,isAbroad,isWeekdayEvent,fromDate,toDate,orderId,customSpacing}`; תשובה `{error}`|`{valid,errors:[{dressName,sizeText,requested,available,isCustomSpacingIssue}]}`; אי-תקין → alert רשימת "חסרים N במלאי" (+ הערת ציפוף 💡); חריגת רשת → 'שגיאה בבדיקת המלאי מול השרת.'
5. `confirmSaveSummaryIfNeeded(currentOrder)` (ראו ו) – אם false → ביטול השמירה (`setSaving(false)`). אם מוחזר `previewObligations` → `setObligations(previewObligations)`.
6. חוב: `currentDebt = (previewTotal ?? totalRequired) - totalPaid`; `debtUnchangedSinceOpen = openedDebt!==null && round(currentDebt*100)===round(openedDebt*100)`. אם `currentDebt>0 && !debtUnchangedSinceOpen && !enableEditSummaryConfirm` → customAuthPrompt("נותרת יתרת חוב לתשלום. שמירת השינויים דורשת הרשאת מנהל...", 'מאשר הזמנה ללא תשלום') → `POST /api/auth/verify-pin {pin,employeeId,requiredLevel:'עובד'}`; ביטול → `saveMessage='השמירה בוטלה: נדרש אישור עובד או מנהל בגלל יתרת חוב.'`; הצלחה → `debtApprovedBy=employeeId; setDebtApproved(employeeId)`.
7. ביטול פריט קיים (פריט שהיה `!isDeleted` בשמור ועכשיו `isDeleted`) כש-`requireManagerCodeForItems` → customAuthPrompt('ביטול פריט מהזמנה קיימת דורש גם אישור מנהל...', 'feature:item_change_approval') + verify-pin; נשלח כ-`managerEmployeeId/managerPin`. ביטול → `saveMessage='השמירה בוטלה: ביטול פריט דורש אישור מנהל.'`.
8. `submittedLocalIds` = `_localId` של פריטים עם `dressModelId && sizeText`.
9. `putOrder(payload)` – `PUT /api/orders/{id}`; payload **מפורש** (אסור לשנות שמות/להוסיף/להסיר): `orderId, customerId, orderDate, eventDate, eventDateHebrew, returnDate, isAbroad, isWeekdayEvent, fromDate, toDate, customSpacing(null אם undefined), notes, internalNotes, isDelivery, deliveryDirection, deliveryAddress, deliveryCity, deliveryOneDayBefore, status, hasSignedRegulations, updatedAt, managerEmployeeId, managerPin, orderDateApproverId, orderDateApproverPin, items, obligations, payments, debtApprovedBy, totalAmount` (totalAmount = סכום `finalPrice||price` של פריטים לא-מחוקים; אם 0 סכום חיובים; אחרת `order.totalAmount||0`). `putOrder` מוסיף `zeout` בגוף + header `x-zeout` (ראו ז), מטפל 401/403/400 (alert `errData.error||'שגיאת אימות תעודת זהות.'`) ו-409 (ראו ו).
10. הצלחה: `setOrder(updated)`, `hasUnsavedChanges=false`, `items=mergePendingItems(updated.items, items, submittedLocalIds)` (שומר שורות חדשות בלי id ו-`_localId` שלא נשלחו), `obligations/payments/refunds` מהתשובה, `savedSnapshotRef` מתעדכן.
11. זיכוי אוטומטי בלי בנק (`refunds.some(!isDeleted && !isExecuted && isAutoGenerated && (!bankName?.trim()||!bankBranch?.trim()))`) → `setActiveTab('payments')` + אחרי 60ms `paymentsManagerRef.openPendingAutoRefundBankModal()`.
12. חוב חדש: `freshDebtNow = round2(Σ obligations לא-מחוקות − Σ payments לא-מחוקות)`; `newDebtCreatedBySave = freshDebtNow>0 && freshDebtNow > openedDebt+0.01` → `setActiveTab('payments')`; אם `enableEditSummaryConfirm` → `setPaymentContinueAmount(freshDebtNow)` ומדלגים על הודעת ההצלחה. אחרת: `saveMessage` = 'השינויים נשמרו בהצלחה!' (3 שנ') או 'השינויים נשמרו בהצלחה! נוצר חיוב חדש של ₪X - עברת אוטומטית לטאב תשלומים להשלמת הגבייה.' (7 שנ'); `showSaveSuccessOverlay` 5 שנ'.
13. `promptPrint` (רק מכפתור השמירה הראשי): customConfirm('השינויים נשמרו בהצלחה! להדפיס את ההזמנה המעודכנת?') → `window.open('/print/order?orderId={id}&type=order','_blank')`.
14. חריגה: `saveMessage = err.message || 'שגיאה בשמירת הנתונים.'`; `finally setSaving(false)`. תשובת 409-discard (`res===null`): `saveMessage='הנתונים נטענו מחדש מהשרת. בדוק את הפרטים ושמור שוב.'`.
- קורא נוסף ל-handleSave: MGD/MIT (שינוי תאריך ביצוע) עם `overrideOrder`.

### ד2. `handleCancelChanges` (P:1319)
אין שינויים/snapshot → alert 'אין שינויים לביטול.'. אחרת `customConfirm(<JSX>)` עם טקסט הסבר + chips (`buildChangeRows`: אייקון+טקסט לפי `CHANGE_GROUPS`, ספירות פריטים/התחייבויות/תשלומים נוספו/הוסרו/שוחזרו/עודכנו) או "שינויים שלא נשמרו". אישור → שחזור `order/items/obligations/payments/refunds` מ-`savedSnapshotRef`, `hasUnsavedChanges=false`, **`POST /api/orders/{id}/cancel-changes` body `{changes: string[]}`** (fire-and-forget; משמש לרישום היסטוריה CANCEL_CHANGES), `saveMessage = 'בוטלו השינויים: ...'` (5 שנ') או 'השינויים בוטלו.'.
- הערה: שחזור לא נוגע ב-`openedDebt` ולא מנקה `pendingDraft`.

### ד3. `handleExit(destinationHref?)` (P:1053)
- `fallbackExitHref = resolveOrderRedirectHref(orderEditRedirectScreen,{orderId,customerId})`: `order`→`/orders/{id}` (ברירת מחדל של הפונקציה), `new_order`→`/orders/new`, `orders_list`→`/orders`, `customer`→`/customers/{customerId}` (או `/orders`), `rentals`→`/rentals`, `dashboard`→`/`. ברירת מחדל של הסטייט `'orders_list'`. `router.push` (לא router.back – מכוון).
- אין שינויים ואין `pendingDebtBlockRef` → יציאה מיידית בלי PUT.
- יש שינויים → `customThreeWayConfirm('ישנם שינויים שלא נשמרו בהזמנה! האם ברצונך לשמור אותם לפני היציאה?','שינויים לא נשמרו')` → תוצאות `'cancel'`/falsy (נשארים), `'discard'` (יוצאים בלי שמירה), אחרת שמירה.
- שמירה: `confirmSaveSummaryIfNeeded(order)`; בדיקת חוב (כמו ב-handleSave אך גם כשהחוב לא השתנה? לא – רק כשהחוב השתנה מאז הפתיחה ו-`!exitDebtApprovedBy`; **לא** מדולג כש-enableEditSummaryConfirm) עם 'נותרת יתרת חוב לתשלום. יציאה דורשת הרשאת מנהל...'; `putOrder` עם payload דומה (**בלי** orderDate/manager*/orderDateApprover*), כישלון → alert ונשארים.
- אחרי הצלחה: `freshRequired = totalAmount>0 ? totalAmount : Σ obligations`; חוב חדש ללא אישור → סנכרון state, `pendingDebtBlockRef=true`, טאב תשלומים, `paymentContinueAmount` (אם enableEditSummaryConfirm) או alert ('השינויים נשמרו, אך נוצר חיוב חדש של ₪X ...'), **לא יוצאים**. זיכוי אוטומטי בלי בנק (פעם אחת ליציאה – `bankDetailsPromptedOnExitRef`) → חלון בנק ונשארים. יתרת זכות>0 → alert 'שים לב: ללקוח מגיע זיכוי של ₪X...' (לא חוסם). אחרת `pendingDebtBlockRef=false` ו-`router.push`.
- מנוקד גם מיירוט קישורים (סעיף ט/מלכודות): לחיצה על `<a href>` פנימי כשיש שינויים → `handleExitRef.current(href)`.

## ה. מחיקת הזמנה (`handleDeleteOrder`, P:1368)
1. `status = calculateOrderStatus({...order,items},{draftsAsDeleted})`; אם `הוחזר|הוחזר חלקי|הושכר|הושכר חלקי` → alert 'לא ניתן למחוק הזמנה לאחר השכרה חלקית/מלאה או לאחר שנלקח והוחזר'.
2. customConfirm('האם אתה בטוח שברצונך למחוק הזמנה זו?').
3. ת"ז אם `zeoutVerificationNeeded` (`require_id_for_edit_cancel==='true'` **וגם** ללקוח יש `customer.zeout` לא ריק): `requestZeout()` (customPrompt 'עריכה/ביטול דורשים אימות תעודת זהות של הלקוח. נא להזין ת״ז:' בסוג 'text', fallback window.prompt); ריק → alert 'ביטול בוטל - לא הוזנה תעודת זהות.'.
4. `!allowEditPartially && items.some(!isDeleted && isTaken)` → alert 'לא ניתן לבטל הזמנה שהושכרה חלקית - חסום בהגדרות (allow_edit_partially_rented).'
5. `DELETE /api/orders/{orderId}` (+ header `x-zeout` + `Content-Type` + body `{zeout}` רק כשנדרש). ok → `router.push('/orders')` (קבוע, **לא** מושפע מ-`order_edit_redirect_screen`); אחרת alert `data.error||'שגיאה במחיקת הזמנה'`. חריגה: alert 'שגיאה במחיקת הזמנה'.

## ו. חלונות/פופאפים/הודעות
| # | רכיב | מפעיל | תוכן | כפתורים |
|---|---|---|---|---|
| 1 | Overlay הצלחה (`showSaveSuccessOverlay`, P:1571, pointer-events none, z 3000) | הצלחת handleSave (לא כשמוצג paymentContinue) | אייקון check + "ההזמנה נשמרה בהצלחה!" | אין (נעלם אחרי 5 שנ') |
| 2 | סיכום לפני שמירה (`summaryConfirmData`, Portal z 2000, לא נסגר בלחיצת רקע) | `confirmSaveSummaryIfNeeded` רק אם `enable_order_edit_summary_confirm==='true'` (נווה יעקב) ו-`orderId` | רשימת חיובים לא-מחוקים (תיאור נקי מ-`(פריט #uuid)` + badge "נוסף עכשיו" אם `obligationIdentityKey` לא בשמור + סכום `he-IL` ב-LTR), "אין חיובים בהזמנה זו." אם ריק; שורות "סה"כ לתשלום", "שולם עד כה", "יתרה לתשלום" (אדום) / "יתרת זכות/מאוזן" (ירוק); אם יתרה>0.01: "לאחר האישור תישמר ההזמנה ותועבר אוטומטית לטאב תשלומים להשלמת הגבייה." | "ביטול" (→resolve false), "אישור ושמירה" (→resolve true) דרך `summaryConfirmResolverRef` |
| 3 | "השלמת תשלום" (`paymentContinueAmount!==null`, Portal z 2100) | חוב חדש אחרי handleSave/handleExit/handleOrderUpdate כש-enableEditSummaryConfirm | אייקון coin, "השינויים נשמרו! נוצר חיוב חדש", סכום גדול אדום, "יש להשלים את הגבייה" | "תשלום בכרטיס אשראי" (רק אם `nedarim_plus_enabled!=='false'`) → סוגר, טאב payments, +60ms `openCreditModal()`; "תשלום נוסף (מזומן וכו')" (רק אם `allow_additional_payment_on_order==='true'`) → `openAdditionalPaymentModal()`; "אטפל בזה בטאב תשלומים" → סוגר |
| 4 | באנר טיוטה (`pendingDraft`) | ראו ח | ראו ח | "שחזר את השינויים", "מחק אותם" |
| 5 | סטטוס שמירה callout (MOC) | `saveMessage` | הודעה; אדום אם `includes('שגיאה')||includes('בוטלה')` | אין |
| 6 | שחרור נעילה (MOC:290, Portal z 2000; רקע סוגר אם לא `unlocking`) | לחיצה על מנעול כשנעול | "הזמנה נעולה" + הסבר (השכרה/עריכה/מחיקת פריטים חסומים; החזרה/תשלומים/זיכויים זמינים; שחרור מלא דורש אישור מנהל) | "ביטול", "שחרר באישור מנהל" (spinner "מאמת..."; `await onUnlock()` = handleUnlock → verify-pin `feature:locked_order_edit`; בכל מקרה החלון נסגר ב-finally) |
| 7 | "כתובת מייל חסרה" (P:1877, Portal z 2000, רקע סוגר) | `handleSendEmail` כשאין `customer.email` תקין (`includes('@')`) | הסבר + `input type=email dir=ltr autoFocus`, placeholder `example@gmail.com`, Enter=שלח | "ביטול", "שמור ושלח" → `handleEmailSubmit` |
| 8 | עובדים פעילים (AEM) | `showEmployeesModal` מ-MIT | ראו ט2 | "סגירה" (X), "סגור"; רקע סוגר |
| 9 | החלפת לקוח (MGD:571, z 2000, רקע סוגר) | אייקון עריכה בכרטיס לקוח | pills "לקוח קיים"/"לקוח חדש". קיים: `<CustomerSelector value={null} onChange={selectCustomer} placeholder="חפש לקוח לפי שם, טלפון, עיר...">` (`selectCustomer(null)` מנקה `customerId:''`,`customer:null`). חדש: שדות `firstName*`,`lastName*`,`phone1*`(ltr),`email*`(ltr, כפתור "השלם ל- @gmail.com" כשאין '@'),`city`,`street`,`houseNum` | "ביטול", (במצב חדש) "שמור ובחר" → `handleSaveNewCustomer` |
| 10 | בורר תשלום/זיכוי ידני (MGD:648) | כפתור מאוחד | ראו ג2 | 2 כפתורים + X |
| 11 | תפריט הדפסה/מייל + מודלי OPM | ראו ט | | |
| 12 | דיאלוגי `alert()`/`confirm()` נייטיב | מפוזר | ראו רשימה בסעיף י | |

`confirmSaveSummaryIfNeeded(currentOrder)` (P:604): כבוי → `{proceed:true}` מיד. פעיל → `POST /api/orders/{orderId}/preview-pricing` (גוף כמו ז5) ואז מחשב `previewObligations = [...manual(isManual!==false && !isDeleted), ...newObligations(isPreview:true)]`, `previewTotal`; כשל רשת נבלע (משתמש ב-state הקיים). מחזיר Promise שנפתר בכפתורי חלון 2 וכולל `savedObligationKeys` (Set של `obligationIdentityKey` מהחיובים ב-`savedSnapshotRef`). `obligationIdentityKey`: אם `orderItemId` → `item:{id}:{kind}` (kind לפי קידומת ב-`OBLIGATION_KIND_PREFIXES`, אחרת 'רגיל'), אחרת `desc:{description}`.

409 (P:585): `confirm()` נייטיב: "{message||'ההזמנה עודכנה בשרת מאז הטעינה האחרונה של הכרטיס.'}\n\nאישור = לשמור בכל זאת ולדרוס...\nביטול = לטעון מחדש..." → אישור: PUT חוזר עם `overwriteConflict:true`; ביטול: `reloadOrderFromServer()` ומחזיר null.

## ז. קריאות רשת (כל הקריאות בעמוד + רכיבי הבן שבטווח)
| # | Method + URL | מפתחות | מתי | שימוש בתגובה / cache |
|---|---|---|---|---|
| 1 | `GET /api/settings` דרך `fetchSharedJson(..,{ttl:TTL.STATIC})` (5 דק', apiCache משותף) | – | mount ב-P (P:275) וב-MGD (פעמיים: `inventory_buffer_days`/`enable_rental_extension`, ועוד `hide_custom_spacing`/`enable_deliveries`/`delivery_allow_address_override`/`delivery_one_day_before_option`/`delivery_price_by_city`); מקבל מערך `{key,value}` (MGD מקבל גם אובייקט) | ראו ז-הגדרות. שגיאה נבלעת |
| 2 | `GET /api/orders/{id}` (fetch רגיל, ללא cache) | – | mount + כל שינוי `id`; `reloadOrderFromServer` אחרי 409-discard | `setOrder`,`items/obligations/payments/refunds`; `savedSnapshotRef`; `openedDebt = Σobligations−Σpayments` (לא-מחוקים); `isPastEvent` נקבע **רק בטעינה ראשונה** (`initialLockChecked`): `eventDate` לפני היום (חצות מקומי); `loadOrderDraft(orderId)`→`pendingDraft`; `addHistory({type:'order',id:orderId,name:'הזמנה #N',subtext:'שם לקוח'})` |
| 3 | `GET /api/inventory/preload?isAbroad&isWeekdayEvent&excludeOrderId&eventDate?&fromDate?&toDate?` | ראו | אחרי טעינת order, כשיש תאריכים (`(isAbroad||isWeekdayEvent)? fromDate&&toDate : eventDate`); תלוי ב-`eventDate,fromDate,toDate,isAbroad,isWeekdayEvent,orderId` | `setInventoryCache(data)` → prop `inventoryCache` ל-ItemsManager. שגיאה: console.error |
| 4 | `POST /api/orders/{orderId}/preview-pricing` `{items, order:{eventDate,isAbroad,isWeekdayEvent,fromDate,toDate,isDelivery,deliveryCity,deliveryDirection}}` | | (א) אפקט P:416: כש-`activeTab==='payments' && hasUnsavedChanges && pricingInputsChanged(snapshot,items,order)`, debounce 400ms, `previewSeqRef` נגד מרוצים; `isLivePreviewing` true בזמן; (ב) `confirmSaveSummaryIfNeeded` | (א) `obligations = [...ידניות(isManual!==false), ...newObligations(isPreview:true)]`; prop `isLivePreviewing` ל-Payments |
| 5 | `POST /api/orders/validate-inventory` | ד1.4 | בתוך handleSave | |
| 6 | `POST /api/auth/verify-pin` `{pin,employeeId,requiredLevel}` | | חוב (P:787,1116), פריט (P:825), נעילה (P:1412), תשלום ידני (P:1483), וגם דרך verifyPin ב-MGD/MIT | `data.success` |
| 7 | `PUT /api/orders/{id}` | מלא (ד1.9) / מצומצם `{hasSignedRegulations}` | handleSave, handleExit, handleToggleSignature (+OPM.confirmSigned) | |
| 8 | `POST /api/orders/{id}/cancel-changes` `{changes}` | | ד2 | |
| 9 | `DELETE /api/orders/{orderId}` (+`x-zeout`,`{zeout}`) | | ה | |
| 10 | `POST /api/orders/{orderId}/email` `{email, type:'order'|'rental'}` | | `handleSendEmail` (מייל מהיר מ-MGD אחרי `feature:customer_email_approval`; מעבר דרך `onQuickEmail = handleSendEmail('order')`) | `data.success` → saveMessage 'מייצר קובץ PDF...' → 'שולח מייל (יוצר PDF בענן)...' → 'המייל נשלח בהצלחה!' / 'שגיאה: {error||'השליחה נכשלה'}' / 'שגיאה בשליחת המייל'; נעלם אחרי 3 שנ'. (הודעות שמכילות 'שגיאה' יוצגו אדומות) |
| 11 | `PUT /api/customers/{customer.id}` `{...order.customer, email}` | | `handleEmailSubmit` (P) ו-OPM: שמירת המייל בכרטיס לקוח; ok → מעדכן `order.customer.email` בסטייט | regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`; לא תקין → alert 'כתובת המייל שהוזנה אינה תקינה.' |
| 12 | `POST /api/customers` (גוף newCustomer) | | MGD `handleSaveNewCustomer` | ok → `selectCustomer(saved)` (מעדכן `customerId`,`customer`), מאפס טופס; ולידציה: `firstName,lastName,phone1,email` חובה → alert 'יש למלא שם פרטי, משפחה, טלפון ודוא"ל'; כשל → 'שגיאה בשמירת לקוח' |
| 13 | `GET /api/customers/locations` דרך `fetchSharedJson(..,{ttl:TTL.REFERENCE})` (2 דק') | | mount MGD | `data.cities` → `fallbackCities` |
| 14 | `GET /api/audit?entityType=Order&entityId={orderId}&search=?` | | mount MIT + כל שינוי `orderId`/`filterSearch` (ללא cache, ביטול race עם `cancelled`) | `data.logs` → רשימה; ספירה "N תיעודי פעולות"; שגיאה: 'שגיאה בטעינת היסטוריה: {msg}' |
| 15 | `GET /api/orders/{orderId}/employees` | | AEM כשנפתח (`isOpen`) | `{executingEmployee,activeEmployees,orderDate}` |
| 16 | `/print/order?orderId&type=order|rental` (window.open) | | הדפסה (OPM, אחרי-שמירה) | |
| 17 | (OPM) `POST /api/orders/{id}/email` `{email,type,returnHtmlOnly:true}` ואז `fetchPdfBase64({html,filename:'הזמנה N'})` (`@/app/lib/pdfClient`) ואז `POST .../email {email,type,pdfBase64,extraAttachments:[{fileName,fileContent,mimeType,sizeBytes,dest}],sendMode}` | | מייל הזמנה/השכרה מתפריט ההדפסה | alert הצלחה ('המייל נשלח בהצלחה!' / "... N קבצים הועלו לדרייב..."); כשל 'שגיאה: ...' / 'שגיאה ביצירת ה-PDF או בשליחת המייל' |
- routes שקיימים ב-`app/api/orders/[id]/` אך לא נקראים ישירות מהעמוד/מרכיביו בטווח: `debt-approval`, `items` (נקרא מ-ItemsManager), `items/[itemId]`.
- **אין** שימוש ב-`pageCache.js`/`prefetchRoutes.js` בעמוד זה; `apiCache` רק בשתי קריאות ה-settings/locations הנ"ל. `router.push` לא עושה prefetch מותאם.

### הגדרות (SystemSetting) הנקראות בעמוד/בנים – מפתח → מה שולט (ברירת מחדל בסוגריים)
- `draft_orders_show_as_deleted` (`true`) – הצגת טיוטה כ"מחוק" ב-`calculateOrderStatus` (תג סטטוס ומחיקה).
- `require_id_for_edit_cancel` (`false`) – דרישת ת"ז בעריכה (`putOrder`) ובמחיקה; **פעיל רק אם ללקוח יש `zeout`**.
- `allow_edit_partially_rented` (`true`) – כש-false חוסם PUT ומחיקה כשיש פריט `isTaken`.
- `require_manager_code_for_item_changes` (`false`) – קוד מנהל לביטול פריט קיים בשמירה.
- `enable_local_order_drafts` (`true`) – כתיבת טיוטת localStorage.
- `enable_order_edit_summary_confirm` (`false`; true בנווה יעקב) – חלון סיכום, חלונית השלמת תשלום, דילוג על חסימת החוב ב-handleSave, בדיקות חוב ב-handleOrderUpdate.
- `consolidate_manual_payment_credit_ui` (`false`; true בנווה יעקב) – כפתור מאוחד ב-MGD + הסתרת הכפתורים בטאב תשלומים.
- `nedarim_plus_enabled` (`true` אלא אם 'false'), `allow_additional_payment_on_order` (`false`) – כפתורי חלונית השלמת תשלום.
- `order_edit_redirect_screen` (`orders_list`) – יעד "חזור" (ערכים ב-`ORDER_REDIRECT_SCREENS`: order/new_order/orders_list/customer/rentals/dashboard).
- MGD: `inventory_buffer_days` (3), `enable_rental_extension` (false), `hide_custom_spacing` (false), `enable_deliveries` (false – כשכבוי כל כרטיס המשלוח נעלם), `delivery_allow_address_override`, `delivery_one_day_before_option`, `delivery_price_by_city` (JSON `{עיר: מחיר}`).
- כל אלה משפיעים על המבנה הנראה; עיצוב מחדש חייב לשמור את התנאים.

## ח. טיוטות (localStorage) – באנר שחזור/מחיקה
- מפתח: `gemachOrderDraft:{orderId}` (`KEY_PREFIX`). תוקף 30 יום (נמחק בשקט בקריאה). מבנה: `{savedAt, baseUpdatedAt, summary: string[], rows:[{icon,text}], state:{order,items,obligations,payments,refunds}}`.
- כתיבה (P:498): רק אם `enableLocalDrafts` ויש `order.orderId`; כש-`hasUnsavedChanges` – debounce 600ms → `saveOrderDraft`; **לא** כותב כש-`pendingDraft` קיים (לא דורס את הישנה). כש-`hasUnsavedChanges` חוזר ל-false אחרי שהיה true (`hadUnsavedRef`) → `clearOrderDraft`.
- קריאה: אחרי טעינת ההזמנה (`loadOrderDraft`) → `pendingDraft` (גם אם `enableLocalDrafts` כבוי – הבאנר עדיין יופיע לטיוטה קיימת).
- באנר (`callout callout-warning`, P:1731): כותרת "נמצאו שינויים שלא נשמרו מביקור קודם בכרטיס" + (`savedAt` → תאריך עברי + שעה); chips מ-`rows` (אייקונים `#i-...`); אזהרה אדומה אם `pendingDraft.baseUpdatedAt !== order.updatedAt` ("שים לב: ההזמנה עודכנה בשרת מאז שהשינויים האלה נערכו — שחזור ושמירה ידרשו אישור דריסה."). כפתורים:
  - "שחזר את השינויים" → `handleRestoreDraft`: מחליף order/items/obligations/payments/refunds מהטיוטה, `pendingDraft=null`, `hasUnsavedChanges=true`, `saveMessage='השינויים מהביקור הקודם שוחזרו. לחץ "שמור שינויים" לשמירה, או על כפתור הביטול כדי לוותר עליהם.'` (7 שנ'). לא נוגע ב-`savedSnapshotRef` (נשאר מצב השרת) ולכן "ביטול שינויים" מחזיר לשרת.
  - "מחק אותם" → `handleDiscardDraft`: customConfirm ('למחוק את השינויים שלא נשמרו מהביקור הקודם? פעולה זו אינה הפיכה.') → `clearOrderDraft`, `pendingDraft=null`.
- `listOrderDrafts()` (משמש את `/orders` לצביעת שורות) – קריאה בלבד מ-`orderDrafts.js`; אל תשנו את המפתח/מבנה.

## ט. URL / localStorage / sessionStorage / הדפסה / AI
- URL: פרמטר דינמי `[id]` (`use(params).id`) בלבד. אין query params. הטאב הפעיל **לא** נשמר ב-URL (state בלבד, ברירת מחדל `items`).
- localStorage: `gemachOrderDraft:{orderId}` (ח); `agy_history` (`addHistory`, מקסימום 7 פריטים, dedupe לפי type+id, מקפיץ אירוע `window` `agy_history_updated`) – נכתב בטעינת הזמנה: `{type:'order', id, name:'הזמנה #N', subtext: 'שם פרטי משפחה'|''}`. sessionStorage: אין.
- ניווט: יירוט קליקים גלובלי (capture) על `a[href]` כשיש שינויים: מתעלם מ-`#`, `http*`, `target=_blank`, אותו pathname; אחרת `preventDefault+stopPropagation` ו-`handleExit(href)`. בנוסף `beforeunload` (`preventDefault`, `returnValue=''`) כש-`hasUnsavedChanges`.
- ט1. `OrderPrintMenu` (OPM; מורכב ב-MOC עם `triggerClassName="btn btn-secondary btn-icon-only"`, `triggerTitle="הדפסה / מייל"`, `onOrderUpdate=handlePrintMenuOrderUpdate`):
  - לחיצה: אם `order.hasSignedRegulations` → פותח/סוגר תפריט (`opm-menu`: "הזמנה", "השכרה" → `/print/order?...&type=order|rental` בטאב חדש; "מייל הזמנה", "מייל השכרה"); אחרת מודל "חתימה על תקנון" ("האם הלקוח חתם על התקנון?") → "כן, חתם" (`PUT /api/orders/{id} {hasSignedRegulations:true}`, אחר-כך פותח תפריט) / "לא (ביטול)".
  - מייל: אם אין מייל → מודל "שליחת מייל הזמנה/השכרה" עם: input מייל, קבצים נוספים (`<input type=file multiple>`), רדיו `orderSendMode` (`email`/`drive`/`both` – "צרופה למייל"/"דרייב + שיתוף"/"גם וגם"), "שלח"/"ביטול". קריאות – ראו ז17. (`handleSendEmail._optionsShown` – flag על הפונקציה; מציג מודל האפשרויות בפעם הראשונה גם כשיש מייל.)
  - קליק מחוץ לתפריט סוגר אותו (`document click`). CSS `opm-menu` משובץ בקובץ (`<style dangerouslySetInnerHTML>`).
- ט2. `ActiveEmployeesModal`: כותרת "עובדים פעילים (זמן הזמנה)" עם lucide `Users`; loading "טוען נתונים..."; שגיאה callout 'שגיאה בטעינת העובדים' (`'שגיאה בטעינת נתונים'` על !ok); "תאריך ביצוע: {toLocaleString he-IL}"; "ביצע/ה את ההזמנה" (avatar ראשי תיבות + `fullName` או first+last, או 'לא מוגדר עובד מבצע להזמנה זו.'); "עובדים נוספים במשמרת" (רשימה עם `status-dot online`, או 'לא נמצאו עובדים נוספים במשמרת בזמן זה.'). משתמש באייקוני `lucide-react` (לא sprite) – z-index 1600. לא נטען אם `!isOpen` (fetch רק בפתיחה).
- AI: אין תכונות AI בעמוד זה. ייצוא: אין (רק הדפסה/מייל).

## י. מלל עברי גלוי (מלאי לכתיבה מחדש – לא להעתיק)
- כותרות/תוויות: הזמנה #N; חתם על תקנון/לא חתם על תקנון; יתרת חוב/יתרת זכות/שולם במלואו; הדפסה/מייל; מחיקת הזמנה; ביטול שינויים; שמור שינויים; חזור; לשוניות (פרטים כלליים / פריטים והשכרות / תשלומים / מידע); לא נבחר לקוח; ללא תאריך אירוע; עודכן; סריקה מהירה.
- MGD: אירוע רגיל/חו"ל; תאריך אירוע; טווח תאריכים; יום נוסף לפני/אחרי (תוספת 50%); הערות להזמנה/פנימיות; ציפוף ימים מיוחד (רגיל לפי המערכת N ימים; דורש הרשאת מנהל...); משלוח (כיוון, עיר, כתובת שונה, יוצא יום לפני); תשלום/זיכוי ידני; תאריך ביצוע ההזמנה; החלפת לקוח (לקוח קיים/חדש; שם פרטי, משפחה, טלפון, דוא"ל, עיר, רחוב, בית; השלם ל- @gmail.com; שמור ובחר).
- MIT: בוצעה על ידי; היסטוריית שינויים; חיפוש בהיסטוריה; חפש/נקה; N תיעודי פעולות; "{עובד|'מערכת'|'עובד שנמחק'} ביצע/ה {פעולה}"; טוען היסטוריית שינויים...; לא נמצאו תיעודי היסטוריה או שינויים. תוויות פעולה מ-`ACTION_TRANSLATIONS` ב-`components/HistoryViewer.js`; chips שינויים ע"י `components/modern/ChangesChips` (`changesJson`).
- הודעות מערכת: כל הטקסטים בסעיפים ד/ה/ו (alerts, callouts, חלונות).
- קבוצות שינוי לביטול (`CHANGE_GROUPS`): תאריך אירוע; טווח תאריכים; סוג אירוע (רגיל/חו"ל); ריווח ימים מותאם; הערות להזמנה/פנימיות; חתימה על תקנון; לקוח + "פריטים/התחייבויות תשלום/תשלומים: N נוספו/הוסרו/שוחזרו/עודכנו".

## יא. הערות סיכון (לוגיקה שזורה בסימון – קל לשבור בעיצוב מחדש)
1. **כל ארבעת ה-tab-panel נשארים mounted** (MOC:283) – ItemsManager ו-PaymentsManager חייבים להישאר mounted תמיד כדי שה-`ref` (`scan`, `openCreditModal`, `openPendingAutoRefundBankModal`, `openAdditionalPaymentModal`, `openRefundModal`) יעבדו גם כשהטאב לא פעיל, וכדי לשמר state. אסור להמיר לרינדור מותנה.
2. אחרי `setActiveTab('payments')` נקראות פעולות ה-ref ב-`setTimeout(...,60)` – תלוי בכך שהפאנל כבר קיים. אל תוסיפו אנימציית מעבר/lazy שדורשת יותר מ-60ms לחשיפת הרכיב (למרות שהוא mounted, ה-modals הפנימיים לא תלויים בנראות).
3. `onSave={() => handleSave(null,{promptPrint:true})}` – האפליקציה מגינה על event-as-order (`overrideOrder.orderId`); אל תעבירו את handleSave ישירות כ-onClick. `onExit={() => handleExit()}` – בלי ארגומנט (אחרת `href` יהיה event).
4. `onOrderChange` / `onItemsChange` תומכים גם בפונקציה (`prev=>...`); חובה לשמר (עדכונים אחרי await – PIN, סריקה).
5. `hasUnsavedChanges` מוגדר רק דרך `onOrderChange`/`onItemsChange`/`onObligationsChange`/`onPaymentsChange`/`onRefundsChange`; `onOrderUpdated=handleOrderUpdate` ו-`onOrderUpdate=handlePrintMenuOrderUpdate` **לא** מדליקים אותו. שינוי הזרימה יגרום לאזהרות שווא/אובדן טיוטה.
6. `setTimeout(() => setHasUnsavedChanges(false), 0)` אחרי הטעינה (P:348) – מונע סימון "שונה" מהטעינה; לא לשנות סדר.
7. `isPastEvent` נקבע פעם אחת (ref) – שמירת תאריך חדש לא פותחת/סוגרת נעילה; `isUnlocked` לא נשמר לשום מקום.
8. סדר hooks: `useEffect`ים לפני ה-early return (`loading`/`!order`); `handleExitRef` נחוץ בגלל זה. אל תעבירו פונקציות/בלוקים מעל ה-early return בלי `ref`.
9. הודעת `saveMessage` נצבעת אדום לפי **תת-מחרוזת** (`שגיאה`/`בוטלה`) – שינוי ניסוח הודעות מחייב לשמר את זה או להחליף בסוג מפורש.
10. חלונית "השלמת תשלום" מדלגת בכוונה על overlay ההצלחה; overlay ההצלחה `pointer-events:none` (לא חוסם); חלון הסיכום אינו נסגר בלחיצת רקע (התוצאה מחכה ב-Promise – סגירה בלי resolve תשאיר `handleSave` תקוע עם `saving=true`).
11. `confirmSaveSummaryIfNeeded` מחזיר Promise שתלוי ב-`summaryConfirmResolverRef` – כל חלון סיכום חדש חייב לקרוא `handleSummaryConfirmDecision(true|false)` בדיוק.
12. `useMemo` לא בשימוש; חישובי `totalRequired/totalPaid` מבוססים על `obligations` עם לוגיקה ל-`isPreview`/פריט מחוק-מקומי (`isDeleted && !deletedAt`) – לוגיקת תצוגה שמזינה גם את תג החוב ב-MOC; שמרו כמות שהיא.
13. חובת שמירת שדות payload ה-PUT ושמות ה-props (סעיף 12). `customSpacing` נשלח `null` ולא `undefined`.
14. MGD: `isEditingEvent` ברירת מחדל תלוי בערך ראשוני של `order` ב-mount (הרכיב mounted עם ה-order שכבר נטען); `changeDates` **משנה את אובייקט `updates`** (מוסיף `eventDateHebrew`). מעבר סוג אירוע מנקה שדות תאריך – לא לפצל ללחצנים ללא שמירת ה-payload.
15. תג `role=switch` ב-MGD מתפקד גם כ-`div` עם `onClick`+`onKeyDown` – בהחלפה לרכיב חדש שמרו נגישות מקלדת.
16. `HebrewDatePicker`/`HebrewDateRangePicker` – קומפוננטות משותפות (אין להחליף שאינן v3 בלי בדיקת RTL); טווח: שעת היום נשמרת (`applyTime`).
17. אייקונים מגיעים מ-sprite (`<use href="#i-...">`) בכל מקום מלבד AEM (lucide-react) – נדרש sprite גלובלי (`app/components/IconSprite.js`).
18. ת"ז: מבוקשת **בכל PUT** (כולל כל שמירה) כשמופעל – עלול להופיע כמה פעמים בין handleSave ל-handleExit; לא לשלב/להוציא.
19. אפקט `preview-pricing` מתלה על `activeTab==='payments'` – מעבר טאבים חייב להישאר דרך `activeTab` state כדי להפעיל אותו.
20. יעד היציאה `/orders` קבוע ב-`handleDeleteOrder`; רק `handleExit` משתמש ב-`order_edit_redirect_screen`.
21. נווה יעקב מול ראשי: ההבדלים מגיעים רק דרך הגדרות (`enable_order_edit_summary_confirm`, `consolidate_manual_payment_credit_ui`, `enable_deliveries` וכו') – אין `if (org)` בקוד העמוד. אין לקודד ארגון בעיצוב מחדש.

## יב. ממשק העמוד ↔ ModernItemsManager / ModernPaymentsManager (תקציר; פירוט בחוזה השני)
**ModernItemsManager** (`ref={itemsManagerRef}`) מקבל: `locked={isLocked}` (= `isPastEvent && !isUnlocked`), `orderId`, `order`, `items`, `onItemsChange(val|fn)` → `setItems(...)` + `hasUnsavedChanges=true`, `onOrderUpdated={handleOrderUpdate}`, `inventoryCache`, `totalRequired`, `totalPaid`. ref: `scan(barcode)`. `handleOrderUpdate(updatedOrder,{savedLocalId})` – סנכרון לשרת (לא עריכה): ממזג שורות `_localId` בלי id, `setOrder/items/obligations/payments/refunds`, `hasUnsavedChanges = stillPending`, מעדכן snapshot אם לא ממתין; ואם `enableEditSummaryConfirm` ויש חוב חדש → טאב payments + `paymentContinueAmount`.
**ModernPaymentsManager** (`ref={paymentsManagerRef}`) מקבל: `orderId`, `items`, `order`, `obligations`, `payments`, `refunds`, `onObligationsChange/onPaymentsChange/onRefundsChange(val)` (→ set + `hasUnsavedChanges=true`), `totalRequired`, `totalPaid`, `customer={order.customer}`, `onOrderUpdated={handleOrderUpdate}`, `onSignRegulations={() => handlePrintMenuOrderUpdate({hasSignedRegulations:true})}`, `isLivePreviewing`. ref: `openCreditModal()`, `openPendingAutoRefundBankModal()` (מחזיר true אם פתח), `openAdditionalPaymentModal()`, `openRefundModal()`. הרכיב קורא בעצמו הגדרות (`nedarim_plus_enabled`, `consolidate_manual_payment_credit_ui`...) – "חיסכון" קריאה כפולה ב-P נעשה בכוונה.
**ModernInfoTab** props: `order`, `createdDate`, `onShowEmployees`, `onOrderDateSave(date, approval)`. **ModernGeneralDetails** props: `order`, `onOrderChange`, `onSaveRequest=handleSave`, `onToggleSignature`, `onQuickEmail`, `showManualPaymentCreditButton`, `onOpenManualPaymentCredit`. **ModernOrderCard** props (המלאים): `order, items, draftsAsDeleted, activeTab, onTabChange, totalRequired, totalPaid, openedDebt, saving, saveMessage, hasUnsavedChanges, isLocked, isPastEvent, onUnlock, onLock, onSave, onCancelChanges, onDelete, onExit, onToggleSignature, onOrderUpdate, onQuickScan, onWalletClick, tabContents{details,items,payments,history}`.

## יג. נקודות ל-QA / פערים שנצפו בקוד (לא לשנות)
- `handleExit` אינו שולח `orderDate`/manager*/`orderDateApprover*` ב-PUT (בניגוד ל-handleSave).
- `AEM` היחיד משתמש ב-lucide-react ובלי `'use client'` מפורש בראש הקובץ.
- `handleCancelChanges` אינו מנקה `pendingDraft` ואינו מבטל `setDebtApproved`.
- `paymentContinueAmount` חלונית אינה נסגרת בלחיצת רקע/Esc.
