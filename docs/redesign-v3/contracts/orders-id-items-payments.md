# חוזה: כרטיס הזמנה — טאב פריטים וטאב תשלומים

> בסיס להתאמה של 100% (R24). מקורות: `components/orders/modern/ModernItemsManager.js` (1452 שורות, להלן **IM**), `components/orders/modern/ModernPaymentsManager.js` (1501 שורות, להלן **PM**), `components/orders/modern/rentalToggle.js` (**RT**), `components/orders/modern/mocAuth.js` (**AUTH**), `components/orders/OrderModelSelector.js` (**MS**), `components/orders/OrderSizeSelector.js` (**SS**), `components/orders/ItemCapacityModal.js` (**CAP**), `lib/orderItemEditWindow.js` (**EW**), `lib/apiCache.js`. ההורה: `app/orders/[id]/page.js` (**PAGE**, מכוסה בחוזה נפרד — כאן רק ה-mount וה-callbacks).
> מלל ה-UI הקיים מצוטט בעברית לצורך התאמה בלבד (R10 — בעיצוב מחדש כותבים מחדש; ההתנהגות/מפתחות/קריאות אסור שישתנו).
> כל ה-`onClick`/handlers, ה-state, ה-fetch נשארים; מותר לשנות JSX/className/מלל/איקונים בלבד (ARCHITECTURE §4).

---
## 0. Mount בעמוד ההורה (PAGE:1814-1852)

שני הקומפוננטים מורכבים תמיד (כל הטאבים מרונדרים, רק ה-panel מוסתר ב-CSS — ר' הערה PAGE:~1490 על ModernOrderCard). לכן ה-ref-methods עובדים גם כשהטאב לא פעיל.

**ModernItemsManager** (`ref={itemsManagerRef}`, PAGE:229):
| prop | ערך | שימוש ב-IM |
|---|---|---|
| `locked` | `isLocked` (= `isPastEvent && !isUnlocked`, PAGE:1406) | מצב נעול (סעיף I-g) |
| `orderId` | `order.orderId` | URL של PUT/POST פריט |
| `order` | `order` | תאריכי אירוע/חו"ל/`customSpacing`/`obligations` לחלון פרטים, SS, CAP |
| `items` | state `items` | רשימה (כולל שורות מקומיות `isNew`/`isEditing`/`isDeleted`) |
| `onItemsChange(val)` | `setItems(prev => typeof val==='function' ? val(prev) : val); setHasUnsavedChanges(true)` | **מקבל פונקציה `prev=>…` בלבד בכל הקריאות** — חובה לשמור על תמיכה בפונקציונלי |
| `onOrderUpdated(updatedOrder,{savedLocalId})` | `handleOrderUpdate` (PAGE:988) | אחרי POST/PUT פריט; מחליף order/items/obligations/payments/refunds מהשרת, `hasUnsavedChanges=stillPending`, ובנווה יעקב (`enableEditSummaryConfirm`) עובר לטאב תשלומים אם החוב גדל |
| `inventoryCache` | תוצאת `GET /api/inventory/preload?…` (PAGE:~375-390) או `null` | SS/`calculateDynamicAvailability` |
| `totalRequired`,`totalPaid` | חישוב מקומי (PAGE:399-410) | `isFullyPaid = totalPaid >= totalRequired` |

**ModernPaymentsManager** (`ref={paymentsManagerRef}`, PAGE:230):
| prop | ערך |
|---|---|
| `orderId`,`items`,`order`,`customer={order.customer}` | כנ"ל |
| `obligations`,`payments`,`refunds` | state ב-PAGE (מערכי שורות, כולל `isNew`/`isDeleted`/`isPreview`) |
| `onObligationsChange(val)`,`onPaymentsChange(val)`,`onRefundsChange(val)` | `setX(val); setHasUnsavedChanges(true)` — **מקבלים מערך (לא פונקציה)** |
| `totalRequired`,`totalPaid` | סכומים (הסינון: `isDeleted`→החוצה; `isPreview`→פנימה; חיוב של פריט `isDeleted` בלי `deletedAt`→החוצה) |
| `onOrderUpdated` | `handleOrderUpdate` |
| `onSignRegulations` | `() => handlePrintMenuOrderUpdate({hasSignedRegulations:true})` |
| `isLivePreviewing` | true בזמן `POST /api/orders/{id}/preview-pricing` ברקע (PAGE:419-451; רק בטאב payments, עם שינויים לא שמורים ושינוי קלטי תמחור; debounce 400ms; מחליף את חיובי `isManual!==false` בשורות `isPreview:true`) |

**Ref API (imperative):**
- IM: `scan(barcode)` — נקרא מ-`handleQuickScan` (PAGE:1454; עובר קודם ל-`setActiveTab('items')`).
- PM: `openCreditModal()` (מאייקון החוב `handleWalletClick` PAGE:1463 — רק אם חוב>0 — ומ-PAGE:1700), `openPendingAutoRefundBankModal()` → boolean (PAGE:924,1248 אחרי שמירה שיצרה זיכוי אוטומטי בלי בנק), `openAdditionalPaymentModal()` ו-`openRefundModal()` (מ-`handleOpenManualPaymentCredit` PAGE:1487 ו-PAGE:1713; רק כש-`consolidate_manual_payment_credit_ui==='true'`, האישור `feature:manual_payment_credit_add` נעשה לפני).

**אירועי החלונות הגלובליים שבהם IM/PM תלויים** (מוגדרים ב-`app/components/PopupProvider.js:200-202`): `window.customConfirm(msg)`→Promise<boolean>, `window.customPrompt(msg,default,type)`→Promise<string|null>, `window.customAuthPrompt(msg,requiredLevel)`→Promise<{pin,employeeId}|null>. אלה **קומפוננטות שיתופיות מחוץ לחוזה זה** אך כל הזרימות כאן תלויות בהן (בעיצוב מחדש: אותו API בדיוק).

---
# חלק א׳ — טאב "פריטים והשכרות" (ModernItemsManager)

## I-a. מטרה והרשאות
תפקיד: ניהול פריטי ההזמנה — הוספה/עריכה (דגם, מידה, תיקונים), מחיקה/שחזור, השכרה (לקיחה) והחזרה + מצב הפריט בהחזרה, סריקת ברקוד מהסיידבר, פרטי פריט + חיובים + היסטוריה, בדיקת תפוסה.
מפתחות הרשאה (מאימות `POST /api/auth/verify-pin` עם `requiredLevel`, חלון `customAuthPrompt`):
| מפתח | מתי | מקור |
|---|---|---|
| `feature:item_edit_reopen` | פתיחה מחדש של עריכה מלאה אחרי סגירת חלון 15 דק' | IM:113-119 |
| `feature:unpaid_action_items_tab` | השכרה/החזרה/סריקה כש-`!isFullyPaid` (ללא skipAuth) | IM:271,277,589,595,633,639 |
| `feature:item_change_approval` | הוספת פריט **חדש** להזמנה קיימת כש-`settings.require_manager_code_for_item_changes==='true'` | IM:445-451 (השרת מאמת שוב: `verifyManagerPin`, items/route.js:48) |
| `feature:barcode_mismatch_override` | עקיפת אי-התאמת ברקוד לדגם/מידה (409 `barcodeMismatch`) | RT:33 |
| `feature:early_return_approval` | החזרה לפני תאריך האירוע (409 `earlyReturn`) | RT:58 |
נוסף (לא ב-IM אך משפיע): `require_id_for_edit_cancel` (PAGE, שמירת הזמנה), `feature:locked_order_edit` (PAGE `handleUnlock`).

## I-b. אזורים לפי סדר
1. **באנר נעילה** (`locked` בלבד): `callout callout-warning` + `#i-lock` (IM:832-837).
2. **סרגל עליון `.toolbar`** (IM:840-865): כפתור "הוסף פריט" (לא נעול) · `pill-tabs` [פרטי תיקונים (רק `enableAlterations`) · פריטים מחוקים] (כש-`!enableAlterations` רק "פריטים מחוקים" כ-`pill-tab` עצמאי) · `spacer` · סיכום "`N` פריטים פעילים · סה"כ ₪X".
3. **טבלת הפריטים** `table.data` בתוך `table-wrap` עם `maxHeight:60vh; overflowY:auto` (IM:867-1128). עמודות: תיאור דגם ומידה | תיקונים (אם `showAlterCol`) | סטטוס (110px) | (פעולות, ללא כותרת) | פרטים (110px). `<div ref={listEndRef}/>` בסוף (גלילה לפריט חדש).
4. **מצב ריק** (`visibleItems.length===0`, IM:1129-1141): `empty-state` `#i-bag`, "אין פריטים להזמנה זו" + כפתור "הוסף פריט ראשון" (`handleAddItem`; **מוצג גם כש-locked** אך `handleAddItem` חוזר מיד ב-`locked`).
5. חלונות: אישור השכרה/החזרה, בחירת פריט לברקוד, ברקוד ידני, פרטי פריט (portal), `ItemCapacityModal`.

## I-c. שדות / קלטים

### c1. שורת פריט במצב עריכה/חדש (`isEditingMode = item.isNew || item.isEditing`)
| שדה | תווית | state/מפתח בפריט | רכיב | חובה | ולידציה/הערות |
|---|---|---|---|---|---|
| דגם | "דגם" | `item.dressModelId`,`item.description`,`item.barcodePrefix` (דרך `handleModelChange`, IM:393) | `OrderModelSelector` (MS) `value={{name:item.description,id:item.dressModelId}} hasActiveItems` | כן (בשמירה) | מוצג רק אם `canEditModelSize = item.isNew || (item.isEditing && !!item.dressModelId && fullyEditableNow)`. בחירה מאפסת `sizeText`. ניקוי → מאפס dressModelId/barcodePrefix/description/sizeText |
| מידה | "מידה" | `item.sizeText` (`handleItemChange(idx,'sizeText',val)`) | `OrderSizeSelector` (SS) עם `modelId`,`order`,`inventoryCache`,`currentCartItems=items` ללא הפריט הנערך | כן | אפשרויות מסומנות disabled כשזמינות ≤0 |
| מידה בלבד (אחרי סגירת חלון) | "דגם"(קריאה בלבד) / "מידה" | `item.sizeText` | `renderSameBandSizeSelect` (IM:162) — `<select>` מסונן למידות אותה קטגוריית מחיר, או SS עם דחייה בעת בחירה כשאין cache | כן | מוצג כש-`canEditSizeOnly = !canEditModelSize && item.isEditing && !!dressModelId && swapEligibility.ok`. הודעת רמז/דחייה מתחת (`sizeSwapNotice[item.id]`, אדום) : "אפשר להחליף רק למידה באותה קטגוריית מחיר." |
| תיקון צוואר | "צוואר" | `neckAlteration` 0/1 (`isChecked`: `1` או `true`) | `pill-tab` toggle, `disabled={!fullyEditableNow}` | לא | רק כש-`showAlterCol` |
| תיקון שרוול | "שרוול" | `sleeveAlteration` 0/1 | `pill-tab` toggle | לא | כנ"ל |
| אורך | placeholder "אורך (ס״מ)" | `lengthAlteration` (מחרוזת) | `input text inputMode=decimal maxWidth 100px`, disabled כש-`!fullyEditableNow` | לא | ללא ולידציה בקליינט |
| פירוט תיקון | placeholder "פירוט התיקון הנדרש..." | `alterationDetails` (הערך מוצג `alterationDetails || repairs`) | `input text autoComplete=off` — **זמין תמיד**, גם אחרי סגירת החלון | **חובה אם** `enableAlterations && (neck||sleeve||length.trim()!=='')` | ולידציה ב-`handleConfirmItem`: alert "חובה להזין פירוט תיקון כאשר נבחר תיקון" |

### c2. OrderModelSelector (MS) — חוזה פנימי
- state: `query,models,isOpen,isLoading,mounted,dropdownPos`. תיבת חיפוש `input.input` עם `name` אקראי לכל mount (`no-autofill-…`; מניעת autofill — לשמור), `autoComplete=off`, placeholder "בחר דגם...", גובה 42px.
- `GET /api/inventory/models?q=<enc>[&hasActiveItems=true]` דרך `fetchSharedJson(…,{ttl:TTL.REFERENCE})`, debounce 300ms; אם הפתוח והקלט שווה לשם הנבחר → q ריק. התוצאה `data.models`.
- Enter: `resolveTypedValue` — התאמה מדויקת (name או `barcodePrefix`, case-insensitive) ברשימה המקומית, אחרת שוב `GET /api/inventory/models?q=typed`; אם אין → `alert('לא נמצא דגם עם השם/קוד "…". יש לבחור דגם מהרשימה הנפתחת.')`.
- כפתור "נקה בחירה" (`aria-label`/`title`, `onChange(null)`), רשימה נפתחת ב-portal ל-`document.body` (`position:fixed`, `zIndex:999999`, `maxHeight:250px`, מיקום לפי `getBoundingClientRect` — פיזי left/top בכוונה), שורה: איקון `#i-tag` + שם (לשם "ללא שם…" מוצג `barcodePrefix`) + "קוד: X". נסגר בלחיצה מחוץ.
- **סיכון**: `data-agy-id` attributes (`order_model_selector_input|dropdown_item|clear`) — ייתכן שסקריפטי בדיקה תלויים בהם; לשמור.

### c3. OrderSizeSelector (SS)
- עם `inventoryCache`: `calculateDynamicAvailability(modelId, isAbroad?fromDate:eventDate, isAbroad?toDate:null, cache, currentCartItems, order.customSpacing)` — מקומי, ללא רשת. בלי cache: `GET /api/orders/availability?dressModelId&isAbroad[&eventDate|fromDate&toDate][&customSpacing]` (אם יש תאריכים) או `GET /api/inventory/sizes?modelId=`; מיון `sortSizeRows`.
- `<select>` disabled בלי `modelId`/בזמן טעינה; תווית "טוען..."; option: `"<size> (פנוי X מתוך Y)"` / עם ציפוף `"רגיל: X | ציפוף: Y (+gain) מתוך Z"` / `"במלאי: N"`; disabled כשזמין ≤0 (לפי `withCustomSpacing` אם `order.customSpacing` מוגדר). placeholder `-`. `data-agy-id`: `order_size_selector_select|option`.

### c4. שדות במודלים (ר' I-f): ברקוד ידני (`manualBarcode`), פתיחת הערת החזרה `customPrompt`.

## I-d. כפתורים ופעולות (handler ← קריאה)
| כפתור/פעולה | תנאי הצגה | handler | פעולה |
|---|---|---|---|
| "הוסף פריט" / "הוסף פריט ראשון" | `!locked` (toolbar); ריק: תמיד | `handleAddItem` IM:553 | `locked`→return; `max_items_per_order` (int>0) ≤ פעילים → alert "הגבלת מערכת: לא ניתן להוסיף יותר מ-N פריטים להזמנה."; מוסיף שורה `{isNew:true,_localId:uuid,description:'',sizeText:'',neckAlteration:0,sleeveAlteration:0,lengthAlteration:'',alterationDetails:'',alterationDone:false,finalPrice:0,isDeleted:false,createdAt}` ; גלילה (`setTimeout 100`) ל-`listEndRef` |
| pill "פרטי תיקונים" | `enableAlterations` | `setShowAlterations(v=>!v)` | מציג/מסתיר עמודת תיקונים (ברירת מחדל: מוצג; `showAlterCol = enableAlterations && showAlterations`) |
| pill "פריטים מחוקים" | תמיד | `setShowDeleted(v=>!v)` | מציג שורות `isDeleted` (מסומנות `row-flag`, טקסט מחוק) |
| "אישור" (שורה בעריכה) | `isEditingMode && !locked` | `handleConfirmItem(idx)` IM:421 | ולידציות: `!sizeText || !hasModelIdentity` → alert "יש לבחור דגם ומידה לפני האישור"; תיקון בלי פירוט → alert (ר' c1). אם חדש (`!isEditing`) ו-`require_manager_code_for_item_changes==='true'` → `customAuthPrompt`+`verify-pin` (`feature:item_change_approval`) → `managerAuth={managerEmployeeId,managerPin}`. ואז `POST /api/orders/{orderId}/items` (חדש) או `PUT /api/orders/{orderId}/items/{item.id}` (קיים) body=`{...item, [forceFullEdit:true אם forceEditableIds.has(id)], ...managerAuth}`; הצלחה → `onOrderUpdated(data,{savedLocalId:item._localId})`; כשל → `alert(error.message)`; `savingItemIndex` מציג "שומר..." + spinner ומנטרל אישור/ביטול |
| "ביטול" (שורה בעריכה) | כנ"ל | `cancelNewItem(idx)` (splice) / `cancelEditItem(idx)` (משחזר `originalState`) | מקומי בלבד |
| "עריכה" | `!locked && !isDeleted && !isEditing && !item.isTaken` | `handleEditItem(idx)` | אם `isTaken && !isReturned` → alert "לא ניתן לערוך פריט שכבר נלקח (מושכר)."; אחרת `isEditing:true, originalState:{...item}`, ממלא `dressModelId`,`sizeText`,`description=itemName(item)` (בלי "(קוד: X)"). tooltip תלוי מצב חלון (I-g) |
| "השכרה" | `!isTaken && !isNew` (לא נעול/לא מחוק/לא בעריכה) | פותח `confirmModal{actionType:'rent'}` | ר' I-f1 |
| "החזרה" | `isRented` (`isTaken && !isReturned`); **גם כש-locked** | `confirmModal{'return'}` | |
| "ביטול" (בטל השכרה) `#i-x-circle` | `isRented && !locked` | `confirmModal{'cancelRent'}` | |
| "ביטול החזרה" `#i-refresh` | `isReturned` (גם locked כשלא מחוק) | `confirmModal{'cancelReturn'}` | |
| מתג "מצב הפריט בהחזרה" (תקין `#i-check-circle` / לא תקין `#i-alert-tri`) | `isReturned` (גם locked) | `handleSetReturnCondition(item, ok)` IM:698 | no-op אם אין id/isNew/!isReturned/מצב זהה. `ok=false`: `customPrompt('לסמן את הפריט כ"הוחזר - לא תקין"? ניתן להוסיף הערה על הבעיה (אופציונלי) - תתווסף גם הערה אוטומטית בכרטיס הלקוח:','','text')` (fallback `window.prompt`); `null`→ביטול. עדכון אופטימי `returnedOk`; `ok=true`→`POST /api/rentals/toggle {itemId,action:'setReturnCondition',returnedOk:true}`; `ok=false`→`POST /api/returns/report-issue {orderItemId,issueType:'returned-bad',note}`; כשל→ alert "שגיאה בעדכון מצב הפריט" + שחזור. `savingConditionId` מנטרל |
| תג סטטוס ביצוע תיקון (`badge-success` "בוצע" / `badge-warning` "לא בוצע") | `hasAny` תיקון, מצב תצוגה | `handleItemChange(idx,'alterationDone',!v)` (state מקומי; נשמר בשמירת ההזמנה/פריט) | `disabled` דה-פקטו כש-`locked` (`cursor:default`, לא מגיב) ; tooltip `"פירוט: … · לחץ לשינוי סטטוס ביצוע התיקון"`/`"הזמנה נעולה"` |
| "פתיחת עריכה מלאה (אישור מנהל)" `#i-unlock` | `isEditingMode && !item.isNew && !fullyEditableNow` (בתא דגם/מידה) | `handleReopenFullEdit(item)` IM:112 | `customAuthPrompt('חלון העריכה המלא (15 דק׳) לפריט זה נסגר. נדרש אישור מנהל לפתיחתו מחדש לעריכה מלאה. אנא בחר מנהל והזן סיסמה:','feature:item_edit_reopen')` → `POST /api/auth/verify-pin` → `forceEditableIds.add(item.id)` (בתוקף לכל הביקור); שגיאה: `alert(data.error || 'סיסמה שגויה או הרשאה לא מספקת.')` / 'שגיאה באימות קוד מנהל.' |
| `#i-info` "פרטים נוספים והיסטוריה" | `!isNew` | `showItemDetails(item)` IM:734 | פותח מודל פרטים; `GET /api/audit/order-item/{item.id}` → יומן |
| `#i-calendar` "בדוק תפוסה לתאריך אירוע" | `!isNew` | `setCapacityModalItem(item)` | פותח CAP |
| `#i-trash`/`#i-refresh` "מחק פריט"/"שחזר פריט" | `!locked && !isNew && (isDeleted || !isTaken)` | `toggleDeleted(idx)` IM:529 | מחיקה של `isTaken`→alert "לא ניתן למחוק פריט שכבר נלקח (מושכר). יש להחזירו קודם לכן או לבטל את הלקיחה."; שחזור מעל `max_items_per_order`→alert "הגבלת מערכת: לא ניתן לשחזר פריט. המקסימום המותר הוא N פריטים בהזמנה."; `customConfirm('האם אתה בטוח שברצונך למחוק פריט זה?' / 'האם אתה בטוח שברצונך לשחזר פריט זה להזמנה?')` → `handleItemChange(idx,'isDeleted',!current)` — **מקומי בלבד**, נשמר בשמירת ההזמנה (PAGE) |
| קישור שם פריט | `itemModelId(item)` קיים | `<a href="/dashboard/dresses/{modelId}" target=_blank rel="noopener noreferrer" title="פתח כרטיס דגם">` | ניווט לכרטיס דגם; בלי modelId → `<strong>` (פריטי Access ישנים) |
| `scan(barcode)` (ref) | מהסיידבר | `handleBarcodeScan` IM:254 | ר' זרימת סריקה למטה |

### זרימת סריקה `handleBarcodeScan(rawBarcode)`
1. trim; ריק→return.
2. `locked`: מותר רק אם קיים פריט פעיל עם אותו ברקוד (`barcode||dressItem.barcode||dressItem.dressBarcode`) ו-`isTaken&&!isReturned`; אחרת alert "ההזמנה נעולה (תאריך האירוע עבר) — ניתן לבצע החזרה בלבד. השכרה דורשת שחרור באישור מנהל."
3. `!isFullyPaid`: `customAuthPrompt("לא ניתן לבצע פעולה ללא תשלום מלא. נדרש אישור מנהל:",'feature:unpaid_action_items_tab')` + `verify-pin` (שגיאות: `data.error || 'סיסמה שגויה או חסרת הרשאה.'`, 'שגיאה באימות קוד.').
4. `POST /api/rentals/verify-item {barcode, orderId}` → `{valid,error,unreturned,warning,unreturnedOrderId,unreturnedItemId,dressItem}`; `!ok||!valid`→alert `error || "ברקוד X אינו תקף להשכרה."`. אם `unreturned`: `(window.customConfirm||window.confirm)("<warning>\nהאם ברצונך לסמן אותה כהוחזרה מההשכרה הקודמת (הזמנה #N) ולהמשיך בהשכרה זו?")` → `PUT /api/rentals/scan {unreturnedItemId}`; כשל → alert `errData.error || 'שגיאה בעדכון החזרה מהשכרה קודמת'`. חריגת רשת ב-verify נבלעת (console.error) וממשיכים.
5. התאמת פריט: ראשית לפי ברקוד מדויק; אחרת מועמדים (`!isTaken`) לפי `barcodePrefix`+`sizeText` מול `dressInfo` ו/או `barcode.startsWith(prefix)&&includes(size)`. מועמד יחיד→נבחר; מרובים→`itemChoiceModal`; אף אחד→alert "ברקוד X (דגם …, מידה …) לא נמצא בין הפריטים שטרם הושכרו בהזמנה זו."
6. `!isTaken`→`handleRent(item,barcode,true)`; `isTaken&&!isReturned`→`handleReturn(item,true)`; אחרת alert "פריט X כבר הוחזר."

### handleRent / handleReturn / handleCancelRent / handleCancelReturn
- `handleRent(item, barcodeToAssign=null, skipAuth=false)` IM:587: `!isFullyPaid && !skipAuth` → אישור מנהל (`"לא ניתן לבצע השכרה ללא תשלום מלא. נדרש אישור מנהל:"`, `feature:unpaid_action_items_tab`, alert 'סיסמה שגויה או שאין מספיק הרשאות'). עדכון אופטימי `{isTaken:true,takenDate:new Date(),[barcode]}` → אם `item.id&&!isNew`: `postRentalRent(item.id,barcode)` (RT) = `POST /api/rentals/toggle {itemId,action:'rent',barcode[,overridePin,overrideEmployeeId]}`; 409+`barcodeMismatch` → `verifyPin(<mismatch msg>+"\nלהשכיר בכל זאת? נדרש אישור מנהל.",'feature:barcode_mismatch_override')`, עד 3 ניסיונות; כשל→`alert(userMessage || 'שגיאה בשמירת סטטוס השכרה')` + שחזור `{isTaken,takenDate,barcode}` לפריט.
- `handleReturn(item, skipAuth)`: אותו אישור ("...החזרה ללא תשלום מלא..."); אופטימי `{isReturned:true,returnDate}`; `postRentalReturn` = `POST /api/rentals/toggle {itemId,action:'return'[,overridePin,overrideEmployeeId]}`; 409+`earlyReturn` → `verifyPin(error+"\nלהחזיר בכל זאת? נדרש אישור מנהל.",'feature:early_return_approval')`; כשל→alert `message || 'שגיאה בשמירת סטטוס החזרה'` + שחזור. הודעות: 'ההחזרה בוטלה - האירוע עדיין לא הגיע.', 'אישור המנהל נכשל - ההחזרה בוטלה.'
- `handleCancelRent`: אופטימי `{isTaken:false,takenDate:null,barcode:null}` → `POST /api/rentals/toggle {itemId,action:'undoRent'}`; כשל alert 'שגיאה בביטול סטטוס השכרה'.
- `handleCancelReturn`: `{isReturned:false,returnDate:null}` → `{itemId,action:'undoReturn'}`; alert 'שגיאה בביטול סטטוס החזרה'.
- **חשוב**: פעולות השכרה/החזרה נשמרות בשרת **מיד** (לא מחכות ל"שמור"); הן פונקציונליות `prev=>…` וחייבות להישאר כאלה.

## I-e. קריאות רשת (IM ותת-רכיביו)
| # | Method + URL | מתי | גוף/query | שימוש בתשובה | מטמון |
|---|---|---|---|---|---|
| 1 | GET `/api/settings` | mount (IM:134) | — | מערך `{key,value}` → אובייקט `settings`; אחרת האובייקט עצמו | `fetchSharedJson` TTL.STATIC (5 דק') |
| 2 | GET `/api/pricelists` | רק כש-`sizeEditDays!==null` (IM:153) | — | `priceList` (למחשבון `evaluateSizeOnlyEdit`) | `fetchSharedJson` TTL.STATIC |
| 3 | POST `/api/orders/{orderId}/items` | אישור פריט חדש | `{...item, managerEmployeeId?, managerPin?}` (כולל `_localId` — השרת מתעלם) | הזמנה מלאה → `onOrderUpdated` | interceptor של apiCache מבטל מטמון על mutation |
| 4 | PUT `/api/orders/{orderId}/items/{itemId}` | אישור עריכה | `{...item, forceFullEdit?}` | כנ"ל | — |
| 5 | POST `/api/auth/verify-pin` | כל אישור מנהל | `{pin,employeeId,requiredLevel}` → `{success,error}` | — | — |
| 6 | POST `/api/rentals/verify-item` | סריקה | `{barcode,orderId}` | ר' זרימת סריקה | — |
| 7 | PUT `/api/rentals/scan` | סריקה של פריט שלא הוחזר מהזמנה אחרת | `{unreturnedItemId}` | — | — |
| 8 | POST `/api/rentals/toggle` | rent/return/undoRent/undoReturn/setReturnCondition | ר' לעיל | `res.ok` | — |
| 9 | POST `/api/returns/report-issue` | סימון "לא תקין" | `{orderItemId,issueType:'returned-bad',note}` | `res.ok` (יוצר גם הערה בכרטיס לקוח) | — |
| 10 | GET `/api/audit/order-item/{id}` | פתיחת מודל פרטים | — | `auditLogs` (שגיאה→`[]`) | ללא (fetch רגיל) |
| 11 | GET `/api/inventory/models?q=[&hasActiveItems=true]` | MS | — | `data.models` | TTL.REFERENCE, debounce 300ms |
| 12 | GET `/api/orders/availability…` / `/api/inventory/sizes?modelId=` | SS בלי cache | ר' c3 | — | ללא |
| 13 | GET `/api/inventory/models` (בלי q) | CAP כש-prefix חסר | — | חיפוש לפי id | ללא |
| 14 | GET `/api/inventory/capacity?barcodePrefix&size&fromDate&toDate` | פתיחת CAP | טווח: חודש לפני/אחרי `eventDate` (`YYYY-MM-DD` דרך `toISOString`) | `{inStock,occupiedCount,reserve,occupiedOrders[]}` | ללא |
תשובות שגיאה של השרת שמוצגות כמות שהן: `יש לבחור דגם ומידה`, `יש להזין מידה`, `דרוש אישור מנהל (קוד/סיסמה) בתוקף להוספת פריט להזמנה קיימת.` (403), הפרות כללים `error.isRuleViolation`, `שגיאת מערכת בשמירת/בעדכון הפריט: …`.
מקור נתונים נוסף (לא ב-IM): `inventoryCache` נטען ב-PAGE מ-`GET /api/inventory/preload?…&excludeOrderId`.

## I-f. חלונות / פופאפים
1. **`confirmModal`** — אישור השכרה/החזרה/ביטול (IM:1144). `div.modal-backdrop` (fixed, z 1100) + `modal confirm-modal`; לחיצה על הרקע סוגרת. איקון בעיגול (`#i-check` return / `#i-box` rent / `#i-x-circle` אחרים). כותרת: "אישור השכרה" / "אישור החזרה" / "ביטול השכרה" / "ביטול החזרה". גוף: `האם אתה בטוח שברצונך לסמן את "<שם>" (קוד: X) כמושכר?` / `…כמוחזר?` / `לבטל את השכרת …?` / `לבטל את החזרת …?`. באנר `callout-danger` "שים לב: ההזמנה לא שולמה במלואה! נדרש אישור מנהל." (rent/return כש-`!isFullyPaid`). באנר טיפ (rent עם barcodePrefix): "טיפ: אפשר לדלג על החלון הזה — סריקת הברקוד בשדה "סריקה מהירה" למעלה משכירה כמה שמלות ברצף, אחת אחרי השנייה." כפתורים: "ביטול" (סוגר), "אישור": rent עם `barcodePrefix` → פותח מודל ברקוד ידני (`selectedItemForScan`), rent בלי → `handleRent(item)`; return→`handleReturn`; cancelRent/cancelReturn בהתאם.
2. **`itemChoiceModal`** — "לאיזה פריט לשייך את הברקוד?" (IM:1201): הסבר, ברקוד ב-`direction:ltr`, רשימת `button.list-card` (איקון `#i-box`, שם, "מידה X", תג "עם תיקון"/"ללא תיקון", `#i-chevron-start`) → `chooseItemForBarcode(item)` → `handleRent(item,barcode,true)`. כפתורים: X, "ביטול".
3. **מודל ברקוד ידני** "הזנת ברקוד ידנית" (IM:1258): `<form onSubmit>`; input `manualBarcode` (autoFocus, `direction:ltr`, placeholder "סרוק או הקלד ברקוד...", איקון `#i-tag`); כפתור submit "בצע סריקה" → `handleRent(selectedItemForScan, barcode)` (עם אימות תשלום; **ללא** skipAuth). אין ולידציית ריק בקליינט (הברקוד ריק נשלח כ-`''`→ בשרת `barcode` ריק).
4. **מודל פרטי פריט** — `createPortal` ל-body, רק כש-`mounted` (IM:1290): כותרת "פרטי פריט: <שם>". (א) טבלת "תשלומים וחיובים לפריט זה (חיוב, זיכוי, ביטול, תיקונים)" — מ-`order.obligations` (לא נדרש רשת) המסוננות `!isDeleted && description.includes("(פריט #<id>)")`; תווית = productName מנוקה או "זיכוי / ביטול" / "תיקון" / "חיוב"; תג "זיכוי" לסכום שלילי; סכום `-₪X` (ירוק) / `₪X` (אדום) `direction:ltr`; שורת "סה"כ לפריט"; מצבי ריק: "לא נמצאו חיובים מפורטים" / "אין חיובים מפורטים לפריט זה". (ב) שלושה תאריכים (עברי+לועזי+שעה): "תאריך הוספה" (`orderDate||order.orderDate||createdAt`), "תאריך השכרה (לקיחה)" (ברירת מחדל "טרם הושכר"), "תאריך החזרה" (ברירת מחדל "טרם הוחזר"). (ג) "היסטוריית שינויים": רשימה מקופלת (כל שורה `select-row`+`#i-chevron-down` מסתובב) עם `ACTION_TRANSLATIONS[action]`+תאריך עברי/לועזי/שעה; פתיחה מציגה `FIELD_TRANSLATIONS[key]`: מ← אל / ערך, מסננים: ערכים ריקים, `HIDDEN_HISTORY_FIELDS` (`id,orderId,dressItemId,deletedAt,barcode,barcodePrefix,cartStatus,cartStatusDate`), boolean false ב-CREATE; boolean→"כן"/"לא"; "אין שינויים רלוונטיים להצגה"; טעינה "טוען היסטוריה..."; ריק "אין היסטוריית שינויים להצגה". `dedupeAuditLogs`: קיפול כפילויות (חלון 5000ms, UPDATE גנרי בצמוד לשורת diff). `setExpandedHistory({})` באיפוס בפתיחה. סגירה: X, "סגור", לחיצה על הרקע. **תלות**: `FIELD_TRANSLATIONS`,`ACTION_TRANSLATIONS` מ-`components/HistoryViewer` (אם ה-hf-* מחליף — לשמור מפתחות).
5. **`ItemCapacityModal` (CAP)** — portal, `modal animate-fade-in` max 760px: כותרת "זמינות: <שם> (<מידה|ללא מידה>)"; שורת "תאריך אירוע: … · <עברי>"; "(מוצג טווח של חודש לפני ואחרי)"; 3 KPI: "במלאי" (`inStock`), "בתפוסה מתוכננת" (`occupiedCount`), "רזרבה זמינה" (`reserve`); כש-`occupiedCount>0`: מתג "תצוגת רשימה"/"תצוגת לוח" (`viewMode`, ברירת מחדל list); לוח = `CapacityCalendar` (`components/CapacityCalendar`, props `fromDate,toDate,occupiedOrders`); רשימה = טבלה [תאריך אירוע (+תג "הזמנה נוכחית" ושורה מודגשת), שם לקוח, כמות בתפוסה, הזמנה → `<a href="/orders/{orderId}" target=_blank>` "צפה בהזמנה"]; מיון עולה לפי `eventDate`; ריק "אין הזמנות תפוסות בטווח התאריכים"/"הפריט פנוי לחלוטין בתאריכים אלו."; שגיאות (callout-danger): 'לא הוגדר תאריך אירוע להזמנה זו.', 'לא ניתן לבדוק תפוסה לפריט ללא דגם (פריט כללי).', 'לא ניתן לבדוק תפוסה לפריט ללא מידה מוגדרת.', 'לא נמצא קוד פריט', `data.error||'שגיאה בטעינת נתונים'`; טעינה "טוען נתוני תפוסה...". סגירה: X (`aria-label="סגירה"`), "סגירה", לחיצה על הרקע (ה-modal עוצר bubbling).
6. **חלונות גלובליים** (PopupProvider): `customAuthPrompt`, `customConfirm`, `customPrompt` + `alert()` דפדפן (לא מותאם!) לכל שגיאה/הודעה — **כל ה-alert הם native**. בעיצוב מחדש ניתן להחליף ל-toast/dialog רק אם אותה סמנטיקה (חוסם) נשמרת ב-alert שמתחיל flow.

## I-g. מצבים מיוחדים
- **טעינה**: אין spinner לטבלה (הפריטים מגיעים מ-PAGE); שמירת שורה = "שומר..."; היסטוריה = "טוען היסטוריה..."; MS=spinner בשדה; SS="טוען...".
- **ריק**: I-b(4).
- **נעול** (`locked`): באנר; אין "הוסף פריט"; אין עריכה/השכרה/ביטול השכרה/מחיקה/שחזור; מותר "החזרה" (פריט מושכר), מתג מצב + "ביטול החזרה" (פריט מוחזר, לא מחוק); אחרת "נעול"; תג ביצוע תיקון לא מגיב; סריקה — רק החזרה. השחרור נעשה בכפתור המנעול ב-PAGE (`handleUnlock`, `feature:locked_order_edit`).
- **פריט מושכר** (`isTaken && !isReturned`): אין "עריכה", אין מחיקה (`!isDeleted && !isTaken`), `canFullyEditItem`=false.
- **חלון עריכה מלאה 15 דק'** (`ITEM_EDIT_WINDOW_MINUTES`=15, EW): `isWithinItemEditWindow(item)` לפי `updatedAt||createdAt`. `sessionEditableIds` (Set; נאסף בהתחלה ובכל שינוי `items`, נשאר למשך הביקור) ∪ `forceEditableIds` (אישור מנהל). `canFullyEditItem`: false אם מושכר; true אם `isNew||!id`. כשהחלון סגור: דגם/מידה נעולים, תיקוני צוואר/שרוול/אורך disabled, רק פירוט התיקון נערך + הודעה "חלון העריכה המלא (15 דק׳) נסגר — …" + כפתור פתיחה מחדש. השרת אוכף (`isWithinItemEditWindow`, `forceFullEdit`).
- **החלפת מידה אחרי סגירת חלון** — מוגדר ב-`size_edit_until_days_before_event` (`parseSizeEditDays`: מספר שלם ≥0, אחרת כבוי). `evaluateSizeSwap` → `evaluateSizeOnlyEdit` (EW): דורש קטגוריית מחיר, `eventDate` תקין ועתידי, ≥N ימי לוח (שעון ישראל), אותה שורת מחיר (`isSamePriceBand`, `gap_size_price_rule` דרך `normalizeGapRule`); לא `isNew`, לא `isTaken`, `priceList` נטען. סיבות דחייה מוצגות בעברית בתוך ההודעה.
- **פריטי Access ישנים** בלי `dressModelId`: קישור שם לא פעיל; דגם/מידה לקריאה בלבד בעריכה; עריכת תיקונים מותרת; `hasModelIdentity` מתיר `barcodePrefix` בלבד.
- **שם פריט** `itemName`: `dressItem.dress.name || description || dressItem.dressName || 'פריט כללי'`, ללא `(קוד: …)`; "ללא שם…" → מציג קוד. קוד: `itemCode`. שורה: `"<שם> - <מידה>"` ומתחת "קוד: X · ברקוד: Y".
- **הגדרות (SystemSetting) שקוראים ב-IM**: `enable_alterations` (`!=='false'` → מופעל; בגמח שכיבה: אין עמודת תיקונים ואין pill "פרטי תיקונים"; ב-Neve Yaakov/גמח ראשי — לפי הגדרת ה-DB), `size_edit_until_days_before_event`, `gap_size_price_rule`, `max_items_per_order`, `require_manager_code_for_item_changes`. הכללים בצד שרת (לא ב-UI): `enforce_rental_barcode_match`, `require_approval_for_early_return`.
- **הבדלי ארגון**: אין קוד `org` ב-IM; כל ההבדלים דרך הגדרות בלבד (קליינט זהה בשני הגמחים).
- **`isFullyPaid`** משפיע על: אישור מנהל להשכרה/החזרה/סריקה + באנר אדום במודל האישור.

## I-h. URL / localStorage / sessionStorage
- אין קריאה/כתיבה ל-localStorage/sessionStorage ב-IM/MS/SS/CAP. (`localStorage` של טיוטות הזמנה — ב-PAGE, `app/lib/orderDrafts.js`; הערה IM:441 — האישור המנהלי **לא** נשמר ב-state כדי שלא יידלף לטיוטה.)
- ניווט החוצה: `/dashboard/dresses/{modelId}` (טאב חדש), `/orders/{orderId}` (מ-CAP, טאב חדש). אין קריאה ל-`useSearchParams`.
- מטמון משותף בזיכרון בלבד (`lib/apiCache.js` — `fetchSharedJson`, `TTL`).

## I-i. הדפסה / ייצוא / AI / זיכוי / קרדיט
- אין הדפסה/ייצוא/AI ב-IM.
- **השכרה/החזרה + ברקוד**: כל הלוגיקה ב-I-d; `lib/rentalBarcodeMatch.js` (`parseBarcode`: prefix=הכל חוץ מ-4 אחרונות, size=2 לפני אחרונות, serial=2 אחרונות; `describeMismatch`).
- **דיווח בעיה בהחזרה** (`/api/returns/report-issue`): יוצר גם הערה בכרטיס הלקוח.
- קרדיט/זיכוי ב-IM רק כתצוגה: טבלת החיובים בחלון הפרטים (זיכוי = סכום שלילי).

## I-j. מלל בולט (מלבד המצוטט למעלה)
כותרות טבלה: "תיאור דגם ומידה", "תיקונים", "סטטוס", "פרטים". תגי סטטוס: "חדש", "ממתין", "בהשכרה", "הוחזר - תקין", "הוחזר - לא תקין". צ'יפים: "צוואר", "שרוול", `"<N> ס"מ"`, "ללא תיקונים". כפתורים: "עריכה", "השכרה", "החזרה", "ביטול", "ביטול החזרה", "אישור", "שומר...", "נעול". Tooltips: "הוסף פריט חדש", "הצגת עמודת התיקונים", "הצגת פריטים שנמחקו", "פתח כרטיס דגם", "ערוך פרטי פריט", "בטל השכרה", "בטל החזרה", "מצב הפריט בהחזרה", "תקין", "לא תקין", "מחק פריט", "שחזר פריט", "פרטים נוספים והיסטוריה", "בדוק תפוסה לתאריך אירוע". סיכום: `"N פריטים פעילים · סה"כ ₪X"` (`toLocaleString('he-IL')`).

## I-k. Risk notes (לוגיקה שזורה בסימון)
1. `originalIndex` — כל handler עובד לפי אינדקס ב-`items` המקורי (לא ב-`visibleItems`); סינון מחוקים משנה את הרשימה המוצגת. **אסור** להחליף ל-index של תצוגה. מפתח שורה: `item.id || item._localId || originalIndex`.
2. `onItemsChange` תמיד פונקציונלי (`prev=>…`) — PAGE מסתמך על זה (הערה PAGE:1821) כי הפעולות עוברות `await`.
3. סטטוס השכרה/החזרה = עדכון אופטימי + קריאה מיידית + שחזור בכשלון; לא לקשור ל"שמור".
4. `_localId` נשלח בגוף POST ומשמש ב-`savedLocalId` להסרת השורה המקומית ב-`mergePendingItems` (PAGE); אם יוסר, נוצרות כפילויות.
5. `originalState` נשמר בפריט עצמו (`handleEditItem`) ונשלח לשרת בגוף PUT (`...item`) — השרת מתעלם; ביטול עריכה משחזר ממנו. `renderSameBandSizeSelect`/`evaluateSizeSwap` קוראים `item.originalState.sizeText` כ"מידה שמורה".
6. `evaluateSizeSwap(item)` נקרא **שלוש פעמים** בשורה בעריכה (תנאי, טקסט, tooltip) — לא לחשב פעם אחת בלי לשמור על ההתנהגות (טהור, אין תופעות לוואי).
7. כפתורי הפעולה בשורה הם ענפי ternary מקוננים (`locked ? … : isEditingMode ? … : isDeletedRow ? null : …`) — סדר התנאים קובע מי מוצג; לשמר בדיוק.
8. `e.stopPropagation()` על כל כפתורי השורה (ייתכן `onClick` על ה-`tr` בעיצוב עתידי).
9. מודלים ללא portal (confirm, itemChoice, manualScan) מרונדרים inline עם `position:fixed` — בתוך `ModernOrderCard`; מודל הפרטים ו-CAP ב-portal. `z-index:1100` בכולם; ה-dropdown של MS ב-`999999`.
10. `window.customAuthPrompt` עלול להיות undefined ב-SSR/בדיקות — אין guard (פרט ל-`customPrompt`/`customConfirm` fallback ב-2 מקומות).
11. `dedupeAuditLogs` ו-`HIDDEN_HISTORY_FIELDS` הם לוגיקת תצוגת היסטוריה — R23 (פיד hf-*) עשוי לגעת; לשמור אותה סמנטיקה.
12. המרות RTL: סכומים `direction:ltr; textAlign:left` בכוונה; ברקוד `direction:ltr`.

---
# חלק ב׳ — טאב "תשלומים" (ModernPaymentsManager)

## P-a. מטרה והרשאות
תפקיד: סיכום כספי (סה"כ/שולם/יתרה/קרדיט ביטול), חיובים (כולל ידניים ומשלוח מהיר), תשלומים (אשראי נדרים פלוס, מעקף מתכנת, תשלום נוסף), בקשות זיכוי וזיכויים ממתינים (אישור ביצוע + פרטי בנק), חישוב מחדש, חתימת תקנון לפני תשלום.
מפתחות הרשאה: `'מתכנת'` (רמת סיסמה, מעקף אשראי — PM:515-518, `verifyPin` מ-AUTH → `POST /api/auth/verify-pin {requiredLevel:'מתכנת'}`). אישורים שמתבצעים **בהורה** לפני קריאה ל-PM: `feature:manual_payment_credit_add` (כפתור מאוחד ב"פרטים כלליים"). אין `feature:` נוסף בתוך PM עצמו; הרשאות שרת: `/api/nedarim`, `/api/payments`, `/api/refunds*`, `/api/admin/recalculations` (שרת בודק `checkAuth` ובחלקם הרשאות).

## P-b. אזורים לפי סדר
1. **אריחי סיכום** `kpi-grid` (PM:799-844): (1) "סה"כ לתשלום" `₪totalRequired` + כפתור רענון חישוב + "מחשב מחדש ברקע…" (`isLivePreviewing`), (2) "שולם עד כה", (3) "יתרת חוב" (`balance>=0`) / "יתרת זכות" (`balance<0`, מוצג ערך מוחלט), (4) אריח **"זיכוי ביטול זמין לניצול"** (`CreditWindowTile`) — רק אם `nearestCreditWindow` והטיימר לא פג.
2. **חיובים** (846-940): כותרת אדומה "חיובים" + toolbar כפתורים (משלוח הלוך/חזור אם `enable_deliveries==='true'`, "הוסף חיוב"), הערת הסבר, טבלה [תיאור | תאריך | סכום | פעולות(80px)] או ריק "אין חיובים מתועדים".
3. **תשלומים** (943-1024): כותרת ירוקה "תשלומים" + toolbar [תשלום בכרטיס אשראי (נדרים פלוס) · (אם `consolidate_manual_payment_credit_ui!=='true'`): "תשלום נוסף" (אם `allow_additional_payment_on_order==='true'`) · "בקשת זיכוי ללקוח" + הערת הסבר], טבלה [אופן | תאריך | סכום | פעולות] או ריק "לא בוצעו תשלומים".
4. **זיכויים ממתינים** (1027-1071): כותרת כחולה "זיכויים ממתינים"; טבלה [פרטים / סיבה | תאריך בקשה | סכום | (בנק) | (אשר)] או ריק "אין זיכויים ממתינים" + "בקשות זיכוי שנוצרו יופיעו כאן וימתינו לאישור ביצוע."
5. חלונות (portal): תקנון, העברה מהירה, סליקת אשראי, הוספת חיוב, פרטי תשלום, פרטי חיוב, בקשת זיכוי, פרטי בנק לזיכוי אוטומטי, תשלום נוסף.

**מיון**: חיובים — `createdAt` יורד; תשלומים — `paymentDate` יורד. `activeObligations/activePayments` = `!isDeleted`. `pendingRefunds` = `!isDeleted && !isExecuted`. `balance = totalRequired - totalPaid`.

## P-c. שדות
### c1. הוספת חיוב ידני (`newObligation`) — PM:86,1210
| תווית | מפתח | סוג | חובה | הערות |
|---|---|---|---|---|
| "תיאור החיוב" | `newObligation.description` | text, placeholder "לדוגמא: שמלה נוספת" | כן (כפתור שמירה disabled כשריק) | |
| "סכום (₪)" | `newObligation.amount` | number, placeholder "0" | כן | `parseFloat` בשמירה; מותר שלילי (אין בדיקה) |

### c2. תשלום אשראי (`creditCardData`) — PM:115,1121
| תווית | מפתח | פורמט | חובה |
|---|---|---|---|
| "שם לקוח" | `${customer.firstName} ${customer.lastName}` | readOnly | — |
| "סכום לחיוב (₪)" | `amount` (ברירת מחדל `max(0,totalRequired-totalPaid)`) | number | כן; לא יותר מהיתרה |
| "מספר כרטיס אשראי" | `cardNumber` | ספרות בלבד מקובצות ב-4 (`0000 0000 0000 0000`), `maxLength 19`, LTR; תומך סוויפ: קלט עם `=` (`card=YYMM…`) או `^` (track1 `card^name^YYMM`) ממלא גם תוקף | כן |
| "תוקף (MM/YY)" | `tokef` | `MM/YY` אוטומטי (`handleTokefChange`), `maxLength 5`, placeholder "12/28" | כן |
| "תשלומים" | `installments` (1) | number min 1 max 36 | לא; `parseInt||1` |
| "הערות" | `notes` | text, placeholder "הערות לחיוב" | לא |
- Enter מעביר לשדה הבא (`focusNextOnEnter`: amount→card→tokef→installments→notes); Enter בשדה הערות שולח (`handleProcessCreditCard`) אם `!isProcessing`. refs: `creditAmountRef,creditCardNumberRef,creditTokefRef,creditInstallmentsRef,creditNotesRef`.
- שדה שקוף ב"העברת כרטיס מהירה" (`swipeInput`): input אחיד `opacity:0; position:absolute; top:-1000px`, `autoFocus`, `onBlur` מחזיר מיקוד כל עוד המודל פתוח (100ms), Enter חסום; `handleSwipeInputChange` מפרש `card=…` או `card^…^YYMM…` ובהצלחה (יש card+tokef) סוגר את החלון ופותח (אחרי 150ms) את מודל האשראי מלא.
- ולידציות: `!cardNumber||!tokef||!amount` → `creditError` 'אנא מלא את כל השדות החובה (מספר כרטיס, תוקף, וסכום).'; `amount>balance` → `לא ניתן לשלם יותר מהיתרה הנדרשת (₪X).`

### c3. בקשת זיכוי (`refundData`) — PM:105,1357
| תווית | מפתח | חובה | הערות |
|---|---|---|---|
| "סכום לזיכוי (₪) *" | `amount` | כן (>0) | alert 'יש להזין סכום חיובי לזיכוי' |
| "סיבה לזיכוי / הערות" | `reason` | לא | |
| "בנק *" | `bankName` | כן | alert 'יש להזין בנק וסניף לזיכוי' (משותף לבנק+סניף) |
| "סניף *" | `bankBranch` | כן | |
| "מספר חשבון" | `bankAccount` | לא | |
| "שם בעל החשבון" | `bankAccountName` | לא | |
| "אמצעי תשלום לזיכוי (נלקח אוטומטית מתשלום אחרון)" | `paymentDetails` | readOnly | מחושב ב-`handleOpenRefundModal`: התשלום האחרון (לפי `paymentDate`) → `paymentMethod` + ` (ספרות: ####)` מ-`notes` JSON (`LastNum`/`CardNumber`/`Card`) או regex |
| "מייל לקוח (לשליחת אישור זיכוי)" | `email` | לא | `type=email` LTR; ממולא מ-`customer.email` (+`emailSuffix` אם אין `@`) |
- ממולא מראש מ-`customer.bankName/bankBranch/bankAccount/bankAccountName`. Enter בכל שדה (ובחלון כולו) שולח.

### c4. פרטי בנק לזיכוי קיים (`autoRefundBankData`) — PM:113,1410
שדות: "בנק *", "סניף *" (חובה, alert 'יש להזין בנק וסניף לזיכוי'), "מספר חשבון", "שם בעל החשבון". ממולא מ-`refund.*` ואז `customer.*`. `autoFocus` על בנק; Enter שולח. הודעה: "ללקוח נוצרה יתרת זכות עבור הזמנה זו. יש להזין (או לאשר) את פרטי הבנק להעברת הזיכוי."

### c5. תשלום נוסף (`additionalPaymentData`) — PM:103,1443
| תווית | מפתח | הערות |
|---|---|---|
| "אופן תשלום" | `paymentMethod` `<select>` | אפשרויות מ-`ALLOWED_PAYMENT_METHODS` (CSV, ברירת מחדל `מזומן,העברה בנקאית,צ'ק`) **בלי** כל אפשרות שמכילה "אשראי"; אם ריק → `['מזומן']`; ברירת מחדל = הראשונה |
| "סכום (₪)" | `amount` | חובה, >0 (`additionalPaymentError` 'יש להזין סכום חיובי לתשלום'; כפתור disabled כשריק) |
| "הערות" | `notes` | placeholder "הערות לתשלום" |

## P-d. כפתורים ופעולות
| כפתור | תנאי | handler | פעולה |
|---|---|---|---|
| רענון `#i-refresh` באריח "סה"כ לתשלום" | תמיד; disabled בזמן `isRecalculating` (אייקון מסתובב) | `handleRecalculate` PM:330 | `customConfirm('לחשב מחדש את כל חיובי ההזמנה הזו לפי הכללים העדכניים? פעולה זו עשויה לשנות סכומים קיימים.')` → `POST /api/admin/recalculations {orderIds:[orderId]}`; דורש `data.success` וללא `data.errors`; אז `GET /api/orders/{orderId}` → `onOrderUpdated`; alert 'החישוב עודכן בהצלחה.' / שגיאה `data.error||'שגיאה בחישוב מחדש'` |
| "הוסף חיוב משלוח הלוך/חזור" | `enable_deliveries==='true'`; disabled אם כבר חיוב פעיל עם "משלוח" + הכיוון | `addDeliveryObligation(desc)` | מוסיף מקומית `{isNew:true,description,amount:deliveryPrice,isManual:true,createdAt}` דרך `onObligationsChange`. `deliveryPrice`: `delivery_price_by_city` (JSON) לפי `order.deliveryCity` → אחרת `delivery_price` → אחרת 50. tooltip: "כבר קיים חיוב משלוח הלוך/חזור פעיל בהזמנה זו" / "הוספת חיוב משלוח הלוך בסך ₪X" |
| "הוסף חיוב" | תמיד | `setShowAddChargeModal(true)` | ר' P-f3 |
| `#i-info` בשורת חיוב | תמיד | `setSelectedObligationDetails(obs)` | חלון פרטי חיוב |
| `#i-trash` בשורת חיוב | `obs.isManual !== false` | `removeObligation(obligations.indexOf(obs))` | `customConfirm('האם אתה בטוח שברצונך למחוק חיוב זה?')` → אם יש `id`: `isDeleted=true` (**הערה: משנה את האובייקט המקורי במקום**), אחרת splice → `onObligationsChange` — מקומי, נשמר ב"שמור" |
| "תשלום בכרטיס אשראי (נדרים פלוס)" | `settings.nedarim_plus_enabled !== 'false'` | `handleOpenCreditModal` PM:402 | חוזר אם `nedarim_plus_enabled==='false'`; אם `!order.hasSignedRegulations` → חלון תקנון; אחרת `openCreditModalNow` (מאפס `creditCardData` עם amount=יתרה, מנקה שגיאה) |
| "תשלום נוסף" | `consolidate…!=='true' && allow_additional_payment_on_order==='true'` | `handleOpenAdditionalPaymentModal` | |
| "בקשת זיכוי ללקוח" | `consolidate_manual_payment_credit_ui!=='true'` | `handleOpenRefundModal` | |
| `#i-info` בשורת תשלום | תמיד | `setSelectedPaymentDetails(p)` | |
| `#i-trash` בשורת תשלום | **תמיד (לכל תשלום, כולל אשראי)** | `removePayment(payments.indexOf(p))` | `customConfirm('האם אתה בטוח שברצונך למחוק תשלום זה?')` → סימון `isDeleted`/splice → `onPaymentsChange` (מקומי) |
| "הזנת פרטי בנק" / "עריכת פרטי בנק" | בשורת זיכוי ממתין; התווית לפי חסר בנק/סניף | `openAutoRefundBankModal(r)` | |
| "אשר ביצוע" | disabled `isProcessing` | `approveRefund(r.id)` PM:303 | `customConfirm('האם לאשר ביצוע זיכוי זה? הפעולה תיצור תשלום הפכי להזמנה.')` → `PUT /api/refunds/{id} {isExecuted:true}` → alert 'הזיכוי אושר ובוצע בהצלחה.' → `GET /api/orders/{orderId}`→`onOrderUpdated`, אחרת (בלי `onOrderUpdated`) `onRefundsChange(refunds minus r)`; שגיאה alert |
| "העברה מהירה" (בכותרת מודל אשראי) `#i-activity` | | inline | סוגר אשראי, פותח מודל סוויפ, מאפס `swipeInput`,`creditError` |
| "בצע חיוב" | disabled `isProcessing`; "מעבד..." | `handleProcessCreditCard` PM:586 | ר' P-e (2) |
| כפתור מעקף `#i-arrow-end` (בפוטר, `marginInlineEnd:auto`, צהוב) | disabled `isProcessing` | `handleBypassCreditPayment` PM:503 | סכום נדרש (`creditError` 'אנא הזן סכום לפני מעקף.'), ≤ יתרה (`לא ניתן לשלם יותר מהיתרה הנדרשת (₪X).`); `verifyPin('מעקף חיוב אשראי בפועל ורישום ידני כאילו שולם, ללא פנייה לנדרים פלוס - מוגבל למתכנת בלבד. אנא בחר משתמש והזן סיסמה:','מתכנת')`; יוצר **מקומית בלבד** תשלום `{isNew:true,paymentMethod:'אשראי (מעקף מתכנת)',notes:JSON{'אישור':'מעקף מתכנת - לא בוצע חיוב אשראי בפועל','מזהה עובד מאשר':auth.employeeId,['הערות משתמש']},amount,paymentDate}` → `onPaymentsChange`, סוגר. **לא נשמר בשרת עד "שמור"** (בניגוד לחיוב אמיתי) |
| "שמור חיוב" | disabled אם ריק | `addObligation` | אם חסר תיאור/סכום → no-op; `{isNew,description,amount:parseFloat,isManual:true,createdAt}` → `onObligationsChange([...obligations,added])`, איפוס, סגירה |
| "צור בקשת זיכוי" | disabled `isProcessing` | `submitRefund` PM:230 | ולידציות c3 → `POST /api/refunds {customerId:customer.id, orderId, ...refundData}` → alert 'בקשת הזיכוי נוצרה בהצלחה. ניתן לנהל אותה במסמך הזיכויים הראשי או כאן בטאב תשלומים.' → סוגר → `GET /api/orders/{orderId}`→`onOrderUpdated`; שגיאה alert `err.message||'שגיאה ביצירת הזיכוי'` |
| "שמירת פרטי בנק" / "סגור, אמלא מאוחר יותר" | | `submitAutoRefundBank` PM:453 | `PUT /api/refunds/{autoRefundTarget}` body=`{bankName,bankBranch,bankAccount,bankAccountName}` → `onRefundsChange(refunds.map(merge))`; סוגר |
| "שמור תשלום" | disabled אם `!amount` או `isProcessing` | `submitAdditionalPayment` PM:273 | `POST /api/payments {orderId,amount,paymentMethod||'מזומן',notes||''}` → `onPaymentsChange([...payments,data])` (נשמר **מיד** בשרת); שגיאה → `additionalPaymentError` |
| "כן, חתם" / "לא (ביטול)" | חלון תקנון | `confirmSignedThenOpenCredit` PM:416 | `PUT /api/orders/{orderId} {hasSignedRegulations:true}` → `onSignRegulations()`, סוגר, `openCreditModalNow()`; כשל alert 'שגיאה בשמירת אישור החתימה' / 'שגיאת תקשורת בשמירת אישור החתימה' |
| "ביטול חלון מהיר" | סוויפ | `setShowQuickSwipeModal(false)` | |

## P-e. קריאות רשת
| # | Method + URL | מתי | גוף/query | תשובה | מטמון |
|---|---|---|---|---|---|
| 1 | GET `/api/settings` | mount (PM:141) | — | מערך→אובייקט; `settingsLoaded=true` רק בהצלחה (מערך או אובייקט בלי `error`) | `fetchSharedJson` TTL.STATIC |
| 2 | POST `/api/nedarim` | "בצע חיוב" | `{clientName:"<first> <last>",phone:customer.phone1,address:"street houseNum city",cardNumber:ספרות בלבד,tokef:MMYY בלי /,amount,installments,notes,zeout:customer.idNumber||customer.zeout,email:customer.email}` ; `notes`=`הזמנה {orderId} (<productNames של חיובים אוטומטיים מנוקים>) - <הערות> - באמצעות תכנת הגמח; מס הזמנה: {orderId}` | `{success,confirmation,rawResponse,error}`; הצלחה → בונה `parsedRaw` (JSON מ-`rawResponse` או `{'אישור':confirmation||'בוצע'}` + `'הערות משתמש'`); כשל → `creditError = data.error||'שגיאה בחיוב הכרטיס'`; חריגה 'שגיאת תקשורת בחיוב הכרטיס'. שרת: `nedarim_plus_enabled=false`→400 'סליקת אשראי בנדרים פלוס מושבתת בהגדרות המערכת.'; MosadId חסר→400 | — |
| 3 | POST `/api/payments` | מיד אחרי חיוב אשראי מוצלח **וגם** ב"שמור תשלום" | אשראי: `{orderId,amount,paymentMethod:'אשראי',notes:JSON}`; נוסף: ר' P-d | Payment שנשמר → `onPaymentsChange([...payments,saved])`; אם השמירה נכשלה אחרי חיוב: מוסיף `added` (isNew) מקומית + alert חריג "שים לב: הכרטיס חויב בהצלחה בסך ₪X, אך שמירת התשלום בשרת נכשלה. יש ללחוץ מיד על "שמור" …". שרת מסמן הזמנת עגלה כמוזמנת | — |
| 4 | POST `/api/refunds` | צור בקשת זיכוי | ר' P-d | — | — |
| 5 | PUT `/api/refunds/{id}` | אשר ביצוע / פרטי בנק | `{isExecuted:true}` / שדות בנק (שרת שומר רק ערכים לא-ריקים) | — | — |
| 6 | GET `/api/orders/{orderId}` | אחרי יצירת זיכוי/אישור/חישוב | — | הזמנה מלאה → `onOrderUpdated` | ללא |
| 7 | POST `/api/admin/recalculations` | רענון | `{orderIds:[orderId]}` | `{success,errors[]}` | — |
| 8 | PUT `/api/orders/{orderId}` | "כן, חתם" | `{hasSignedRegulations:true}` | `res.ok` | — |
| 9 | POST `/api/auth/verify-pin` | מעקף מתכנת (דרך `verifyPin` AUTH) | `{pin,employeeId,requiredLevel:'מתכנת'}` | `success` | — |
בהורה (לצורך הקשר, לא ב-PM): `POST /api/orders/{id}/preview-pricing` — מזין את `isLivePreviewing` וחיובי `isPreview`.
**חשוב**: חיוב אשראי ו"תשלום נוסף" נשמרים מיד בשרת (כסף אמיתי); מעקף מתכנת, חיובים ידניים, מחיקות תשלום/חיוב — מקומיים עד "שמור" (`hasUnsavedChanges` ב-PAGE מסומן ע"י `onXChange`).

## P-f. חלונות
1. **חתימה על תקנון** (confirm-modal, portal): איקון `#i-edit`, כותרת "חתימה על תקנון", גוף "לפני קבלת תשלום יש לוודא שהלקוח חתם על התקנון. האם הלקוח חתם על התקנון?", כפתורים "כן, חתם" (spinner בזמן שמירה) / "לא (ביטול)". הרקע סוגר אלא אם `confirmingSigned`.
2. **העברת כרטיס מהירה** (confirm-modal, portal): איקון `#i-tag` צהוב, "העברת כרטיס מהירה", "אנא העבר כעת את כרטיס האשראי בקורא המגנטי...", input שקוף, "ביטול חלון מהיר". **אין סגירה בלחיצה על הרקע.**
3. **סליקת אשראי** (portal): כותרת "תשלום בכרטיס אשראי (נדרים פלוס)" + כפתור "העברה מהירה" + X; שדות c2; `callout-danger` ל-`creditError`; פוטר: מעקף / "ביטול" / "בצע חיוב" ("מעבד..."). **אין סגירה בלחיצה על הרקע** (מכוון — שמירה על נתוני כרטיס).
4. **הוספת חיוב ידני** "הוספת חיוב ידני" (portal; רקע סוגר): שדות c1; "ביטול" / "שמור חיוב".
5. **פרטי תשלום מלאים** (portal, max 620): "אופן תשלום", "סכום" (שלילי כחול info + `-₪`), "תאריך" (`getHebrewDateString`, שעה `he-IL`), "הערות ופירוט (נדרים פלוס / אחר)": אם `notes` מחרוזת JSON (מתחילה ב-`{`) → רשימת `key: value` (LTR); אחרת טקסט עם `' | '`→שורה חדשה; ריק "אין הערות". "סגור".
6. **פרטי חיוב** (portal): "סוג חיוב" (`productName` מנוקה ל-`isManual===false`, אחרת `description` מנוקה; ברירות מחדל "חיוב אוטומטי"/"חיוב ידני"), "סכום" (שלילי ירוק), "תאריך", "תיאור מפורט": "פירוט:", "קטגוריה (מחירון):" (`priceCategory`), "תיאור (מחירון):" (`priceDescription`). ניקוי `(פריט #id)` בכל מקום.
7. **יצירת בקשת זיכוי** (portal, max 620): c3; "ביטול"/"צור בקשת זיכוי".
8. **פרטי בנק לזיכוי** (portal, max 480): c4; לא נסגר ברקע/X בזמן שמירה.
9. **תשלום נוסף** (portal): c5 + `callout-danger` שגיאה; "ביטול"/"שמור תשלום".
10. `window.customConfirm` × 5 (מחיקת חיוב, מחיקת תשלום, אישור זיכוי, חישוב מחדש) + `alert` native (הודעות הצלחה/שגיאה).

## P-g. מצבים מיוחדים
- **הגדרות שנקראות** (`settings`): `nedarim_plus_enabled` (`'false'` = מסתיר כפתור אשראי וחוסם גם `openCreditModal()` מה-ref), `enable_deliveries`==='true', `delivery_price`, `delivery_price_by_city` (JSON עיר→מחיר), `allow_additional_payment_on_order`==='true' (**כבוי כברירת מחדל; מופעל בנווה יעקב**), `consolidate_manual_payment_credit_ui`==='true' (**נווה יעקב בלבד**: מסתיר "תשלום נוסף"+"בקשת זיכוי ללקוח" והתיעוד עובר ל"פרטים כלליים" עם אישור `feature:manual_payment_credit_add`), `ALLOWED_PAYMENT_METHODS` (CSV), `CANCELLATION_CREDIT_MINUTES` (חסר=15; קיים אך ≤0/לא מספר=כבוי; לא מוצג עד `settingsLoaded`).
- **קרדיט ביטול** (`getCancellationCreditInfo`, PM:773): רק לשורת חיוב שמתחילה ב-"דמי ביטול" עם `orderItemId`; `consumed` = סכום ערכים מוחלטים של חיובים פעילים באותו `orderItemId` המתחילים ב-"זיכוי דמי ביטול"; `remaining=obs.amount-consumed>0`; לפריט המקור חייב `deletedAt`; `deadline=deletedAt+CANCELLATION_CREDIT_MINUTES`. התגית `CancellationCreditBadge` בשורה: "ניתן לזכות ₪X על פריט חדש עוד MM:SS" (`badge-warning`, ≤60ש'→`badge-danger`, tooltip "ניתן לנצל סכום זה כזיכוי אוטומטי אם יתווסף פריט חלופי לאותה הזמנה, עד לתום הזמן שנקבע בהגדרות"); האריח מקבץ: `min(deadline)` וסכום `remaining` כולל. `useCountdown` — `setInterval` 1s, מחזיר `null` כשפג (התגית/אריח נעלמים).
- **אייקון שורת חיוב** (`getObligationIcon`): "דמי ביטול"→`i-x-circle`; "זיכוי דמי ביטול"→`i-coin`; "זיכוי בגין ביטול"→`i-refresh`; "חיוב מקורי"→`i-file`; "תיקון"→`i-scissors`; `isManual!==false`→`i-edit`; אחרת `i-bag`. (סדר הבדיקות קובע — "דמי ביטול" מתקדם לפני "זיכוי דמי ביטול" כי השני מתחיל ב"זיכוי".)
- **צבעים/סימן**: חיוב שלילי = זיכוי (ירוק, `-₪X`); תשלום שלילי (`amount<0`) = החזר (כחול info, `-₪X`); זיכוי ממתין כחול. כל הסכומים `direction:ltr; textAlign:left`.
- **שורות `isPreview`**: חיובי תצוגה מקדימה מהשרת מוצגים כמו חיובים רגילים (ללא סימון ייעודי ב-PM).
- **טעינה**: `isProcessing` (משותף לאשראי/זיכוי/אישור/תשלום נוסף), `isRecalculating`, `isSavingAutoRefundBank`, `confirmingSigned`, `isLivePreviewing`.
- **ריק**: 3 מצבי ריק (P-b).
- **זיכוי אוטומטי בלי פרטי בנק**: `openPendingAutoRefundBankModal` (`isAutoGenerated && !isExecuted && !isDeleted` ובנק/סניף חסרים).
- **אין מצב read-only** ב-PM: אינו מקבל `locked`; כל הכפתורים פעילים גם בהזמנה נעולה (בשונה מ-IM). **סיכון פונקציונלי לשמור** — בעיצוב מחדש אין להוסיף נעילה.
- **הבדלי ארגון**: דרך הגדרות בלבד (`allow_additional_payment_on_order`, `consolidate_manual_payment_credit_ui`, `enable_deliveries`, `nedarim_plus_enabled`, `ALLOWED_PAYMENT_METHODS`, `delivery_price*`). PM לא בודק `org`.

## P-h. URL / localStorage / sessionStorage
- אין localStorage/sessionStorage/URL params ב-PM. (טיוטות ההזמנה מכוסות ב-PAGE.) מטמון: `fetchSharedJson('/api/settings')` בלבד. אין ניווט.

## P-i. הדפסה / ייצוא / AI / זיכוי / קרדיט / נדרים
- **נדרים פלוס** (`/api/nedarim`): סליקה בפועל בשרת; ה-UI: סוויפ מגנטי (`=`/`^` parsing), מעקף מתכנת.
- **זיכוי**: בקשת זיכוי ידנית (`/api/refunds` POST), זיכוי אוטומטי (`isAutoGenerated`, נוצר בשרת ע"י `syncPendingCreditRefund`) — השלמת בנק + "אשר ביצוע" (יוצר תשלום שלילי בהזמנה). מדיניות מלאה: `/admin/refund-policy` (3 רמות + ביטול מיידי). זיכוי דמי ביטול על פריט חלופי: `CANCELLATION_CREDIT_MINUTES` + `lib/pricingEngine.js`.
- **חישוב מחדש** (`/api/admin/recalculations`).
- **תקנון**: `order.hasSignedRegulations`; `OrderPrintMenu` (הדפסה/מייל) בודק גם הוא — ב-PAGE.
- אין הדפסה/ייצוא/AI בתוך PM.

## P-j. מלל בולט
כותרות: "סה"כ לתשלום", "שולם עד כה", "יתרת חוב", "יתרת זכות", "זיכוי ביטול זמין לניצול", "חיובים", "תשלומים", "זיכויים ממתינים". כפתורים: "הוסף חיוב", "הוסף חיוב משלוח הלוך/חזור", "תשלום בכרטיס אשראי (נדרים פלוס)", "תשלום נוסף", "בקשת זיכוי ללקוח", "הזנת/עריכת פרטי בנק", "אשר ביצוע", "בצע חיוב", "מעבד...", "שמור חיוב", "צור בקשת זיכוי", "שמירת פרטי בנק", "שמור תשלום", "העברה מהירה". הסברים: '"הוסף חיוב" מיועד למקרים חריגים בלבד - חיובי מחירון רגילים (כולל ביטולים והחלפות) מתעדכנים אוטומטית ואין צורך להוסיף אותם ידנית.'; '"בקשת זיכוי ללקוח" מיועד למקרים חריגים בלבד - זיכויים בגין ביטול/החלפה נוצרים אוטומטית ואין צורך לפתוח בקשה ידנית עבורם.' (הערות אלה נוספו בעקבות דיווח הזמנה #53377 — R10 מאפשר ניסוח מחדש/מעבר ל-tooltip R11 אך התוכן הסמנטי חייב להישמר). תיאורי ברירת מחדל: "חיוב ידני"/"חיוב מחירון"/"ללא סיבה". תאריך שורה: `fmtDate` = תאריך עברי + " · " + שעה (`he-IL`), `-` לתאריך לא תקין; בלי ערך → "עכשיו".

## P-k. Risk notes
1. `onObligationsChange/onPaymentsChange/onRefundsChange` מקבלים **מערך** ולא פונקציה (שונה מ-IM) — קריאות עם `[...payments, x]` על closure עלולות לדרוס (כבר קיים; לא "לתקן").
2. `removeObligation(obligations.indexOf(obs))`: האינדקס מהמערך המקורי (ה-map רץ על `sortedObligations` ממוין, לא על `obligations`); `updated[idx].isDeleted=true` משנה את האובייקט המקורי (side-effect) לפני `onObligationsChange`. אותו דבר `removePayment`. **אסור לשנות ל-index של הטבלה הממוינת.**
3. `key={idx}` בשורות ממוינות — ללא id; להשאיר.
4. חלונות ב-portal מותנים ב-`mounted`; מודל אשראי וסוויפ **ללא** סגירה על הרקע (מכוון). מודל סוויפ מחזיר focus אוטומטית (`onBlur`) — לא לשים בו input אחר בלי טיפול.
5. שתי דרכי כניסה למודל האשראי (כפתור + `ref.openCreditModal` מאייקון בטופ-בר) — שתיהן עוברות `handleOpenCreditModal` (בדיקת הגדרה + תקנון). אל תעקוף.
6. `openCreditModalNow` ו-`handleOpenQuickSwipeModal` מאפסים `creditCardData`; מעבר סוויפ→אשראי דרך `setTimeout(…,150)` — סדר זמנים קריטי לסוויפ.
7. חיוב אשראי מוצלח חייב להישמר מיד (`POST /api/payments`) — חובה לשמור את ענף "חויב אך השמירה נכשלה" והאזהרה (בטיחות כספית).
8. לוגיקת `getCancellationCreditInfo` תלויה ב-prefix עברי של `description` ("דמי ביטול", "זיכוי דמי ביטול", "זיכוי בגין ביטול", "חיוב מקורי", "תיקון") — הליבה ב-`lib/pricingEngine.js`; שינוי מלל תיאורי בשרת שובר UI. גם `hasActiveObligationWithDescription` מסתמך על המילה "משלוח" + כיוון.
9. ניקוי `(פריט #id)` (regex `\s*\(פריט #[a-zA-Z0-9-]+\)`) מופיע בכמה מקומות (PM וגם IM חלון הפרטים); IM מסתמך על אותו פורמט כדי לקשר חיוב לפריט (`description.includes("(פריט #<id>)")`) — זה חוזה ישיר בין הטאבים.
10. אריח "יתרת חוב" מוצג כש-`balance>=0` (גם 0), "יתרת זכות" רק שלילי.
11. `ModernPaymentsManager` מחשב `deliveryPrice`/`additionalPaymentMethodOptions` כל רינדור (IIFE) — טהור.
12. `useCountdown` עם interval לכל מופע (תגית לכל שורת דמי ביטול + אריח) — אין ניקוי של ערך `deadline` שגוי; נעלם כשפג.
13. טאב זה הוא גם נקודת הנחיתה של PAGE כשחוב נוצר (`setPaymentContinueAmount`, `enableEditSummaryConfirm`) — אין תלות ישירה ב-PM, אך הניווט לטאב `payments` הוא חלק מהזרימה.
