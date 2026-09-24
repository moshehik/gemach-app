# חוזה: כרטיס לקוח / לקוח חדש — `/customers/[id]` (כולל `/customers/new`)

קבצים: `app/customers/[id]/page.js` (P), `app/customers/layout.js` (הרשאה), `components/customers/modern/`: `ModernCustomerCard.js` (C), `ModernCustomerDetailsTab.js` (D), `ModernCustomerOrdersTab.js` (O), `ModernCustomerPaymentsTab.js` (PY), `ModernCustomerRefundsTab.js` (R), `ModernCustomerHistoryTab.js` (H), `ModernSendEmailModal.js` (E); `components/orders/modern/mocAuth.js` (`verifyPin`); `lib/customerValidation.js`, `lib/emailUtils.js`, `lib/historyManager.js`, `lib/apiCache.js`, `lib/orderStatus.js`, `components/HistoryViewer.js` (`ACTION_TRANSLATIONS`), `components/modern/ChangesChips.js`.

## (א) מטרה והרשאות
- `id==='new'`: טופס יצירת לקוח פשוט. אחרת: כרטיס לקוח עם 5 לשוניות, עריכה, חסימה/ביטול חסימה, שליחת מייל (באישור מנהל).
- גישה: `PageGate pageKey="page:customers"` (מ-`app/customers/layout.js`, ללא layout נפרד ל-`[id]`).
- API: `GET/PUT /api/customers/[id]` דורשים `checkAuth()`; `PATCH` (ביטול חסימה) — הנהלה ראשית בלבד (403 `'פעולה זו מוגבלת להנהלה ראשית בלבד'`); כפתור "ביטול חסימה" מוצג רק אם `isHeadManagement` (`roleId` 0 או 2 מ-`/api/me`).
- שליחת מייל: `verifyPin(..., 'feature:customer_email_approval')`.

## (ב) אזורים
### מצב `new` (P:252-347)
`.page-head` "לקוח חדש" + כפתור חזרה (איקון `#i-arrow-end`, title "חזרה", `router.back()`) -> `form.card.card-pad` (`.form-grid`) -> hint -> הערות -> כפתור "שמור פרטים".
### מצב לקוח קיים (P:349-407)
1. `ModernCustomerCard`: `.page-head` (אווטאר ראשי-תיבות, שם, `לקוח #{legacyId||id} · {N} הזמנות · עודכן לאחרונה: {תאריך עברי} · {HH:mm}`, שורת קשר: טלפון/מייל/כתובת) + `.page-actions` (שמירת שינויים, ביטול שינויים, שליחת מייל, חזור).
2. `.tabs` (5 לשוניות; כולן `mounted`, ה-panel הלא-פעיל מוסתר ב-CSS `.tab-panel.active` — **לשמר mount, בגלל state פנימי**): `details` "פרטים אישיים" (`#i-id`) · `orders` "הזמנות" + badge ספירה (`#i-bag`) · `payments` "תשלומים" (`#i-card`) · `refunds` "זיכויים ופרטי בנק" (`#i-refresh`) · `history` "היסטוריה" (`#i-history`). ברירת מחדל `details`. state `activeTab` (לא ב-URL).
3. `ModernSendEmailModal` (פורטל).

## (ג) שדות / קלטים
### טופס לקוח חדש (P:266-343) — `autoComplete=off`, `onSubmit=handleSave`
| שדה (name) | תווית | טיפוס | חובה |
|---|---|---|---|
| `firstName` | שם פרטי * | text | `required` תמיד |
| `lastName` | שם משפחה * | text | `required` תמיד |
| `phone1` | טלפון * (אייקון phone) | text | `required` תמיד |
| `phone2` | טלפון נוסף (+`*` דינמי אם `require_customer_email!=='true' && isFieldRequiredByGroup('phone2',...)`) | text | לפי קבוצות |
| `email` | דוא"ל (+`*` אם `require_customer_email==='true' \|\| isFieldRequiredByGroup('email',...)`) | email, `onBlur=handleEmailBlur` | `required` רק אם `require_customer_email==='true'` |
| — | hint: "כל הזמנה מחייבת 2 אמצעי תקשורת — יש למלא לפחות אחד מבין טלפון נוסף / אימייל." | | |
| `city` | עיר (+`*`) | text | `required` אם `require_full_address==='true'` |
| `street` | רחוב (+`*`) | text | כנ"ל |
| `houseNum` | מספר בית (+`*`) | number | כנ"ל |
| `zeout` | תעודת זהות (לעריכה/ביטול) (+`*`) placeholder `ת״ז`, `direction:ltr` | text | `required` אם `require_customer_id_number==='true'` |
| `marketingConsent` | מאשר/ת קבלת דיוורים (`#newMarketingConsent`, checkbox) | | מוצג רק אם `hide_marketing_consent_field!=='true'` |
| `notes` | הערות (textarea, rows=4) | | לא |
- state התחלתי: `{firstName,lastName,phone1,phone2,email,city,street,houseNum,notes: ''}`. כפתור "שמור פרטים" (`btn-lg`, `disabled=saving`, טקסט `שומר...`).

### לשונית פרטים אישיים (D) — מצב תצוגה / מצב עריכה (`isEditing`, מקומי ל-D)
- תצוגה: כותרת שם (`customerName` או "לקוח ללא שם"), שורת `phone1 · phone2 · email · כתובת` (או "אין פרטי קשר או כתובת"), כרטיס "הערות הלקוח" (אם `notes`) — עם `renderCustomerNotes`: שורה בפורמט `[d.m.yyyy] אוטומטי: שמלה {barcode} (הזמנה {id}) {rest}` מוצגת כצ'יפ: `[תאריך עברי] אוטומטי: דגם {3 ספרות ראשונות} מידה {ספרות 4-5} {rest}` + קישור `<a href="/orders/{orderId}" title="צפה בהזמנה {id}">`; שאר השורות טקסט רגיל.
- עריכה (form, `autoComplete=off`): `firstName *` (required), `lastName *` (required), `phone1 *` (required, ltr), `phone2` (ltr), `email` (type=email, ltr, `onBlur=onEmailBlur`; כפתורי "העתק כתובת מייל" -> `onCopyEmail` = `navigator.clipboard.writeText(customer.email)`, "שלח מייל" -> `onOpenEmailModal`, מוצגים רק אם יש email; כפתור "השלם ל- @gmail.com" כשאין email או אין `@` -> `onChange({name:'email', value: email+'@gmail.com'})`), `city` (`list=modern-cust-city-list`, `autoComplete=new-password`), `street` (`modern-cust-street-list`), `houseNum` (number), `zeout` (ltr, placeholder `ת״ז`), `marketingConsent` (`#marketingConsent`, אם `hide_marketing_consent_field!=='true'`), `notes` textarea rows 4; כפתור "שמירת שינויים" (רוחב מלא, `disabled=saving`).
- אין כוכביות חובה דינמיות בעריכה של לקוח קיים (require_* חלים רק ביצירה — דיווח 48ff7055).
- כפתור כותרת (איקון `#i-edit` / `#i-check`): title "עריכת פרטים אישיים" / "סגור עריכה". במצב עריכה הוא **שומר** (`attemptSave` -> `onSubmit`) וסוגר עריכה רק אם השמירה החזירה true.
- שינוי `cancelSignal` (מ-"ביטול שינויים") סוגר עריכה (אות ראשון מדולג).

### לשונית זיכויים ופרטי בנק (R): טופס `onSubmit=handleSave`
`bankName` שם בנק (placeholder "למשל: לאומי") · `bankBranch` סניף (placeholder "מספר סניף") · `bankAccount` מספר חשבון · `bankAccountName` שם בעל החשבון. כפתור "שמור פרטי בנק" (`שומר...`). אחר כך "היסטוריית זיכויים".

### היסטוריה (H): קלט חיפוש placeholder "חיפוש בהיסטוריה..." (`searchInput`); submit "חפש" -> `filterSearch`; "נקה" (רק אם `filterSearch`).

### מודל מייל (E)
`subject` "נושא ההודעה" (required) · `body` "תוכן" (textarea rows 6, required) · `files` "קבצים מצורפים (ניתן לבחור כמה)" (`type=file multiple`) + hint `{N} קבצים נבחרו: {names} - טבלת הוראות תצורף אוטומטית למייל.` · `sendMode` רדיו `modernSendMode`: `email` "צרופה למייל" / `drive` "דרייב + שיתוף" / `both` "גם וגם" · `driveFolderId` (ltr, placeholder "מזהה תיקיית דרייב (רשות)", רק ב-drive/both) + hint "הקבצים ישותפו עם הנמען בהרשאת הורדה מלאה." כל הקלטים `disabled` בזמן `loading`.

## (ד) כפתורים / פעולות
| כפתור | handler | קורא |
|---|---|---|
| "שמירת שינויים" (C, title "שמירת שינויים", `disabled=saving`) | `onSave(e)` = `handleSave` | PUT (ראו ה) |
| "ביטול שינויים" (C; `disabled=!hasUnsavedChanges\|\|saving`; title "ביטול שינויים שלא נשמרו" / "אין שינויים לביטול") | `handleCancelChanges`: `setCustomer(originalCustomer)`; `cancelTick++` | — |
| "שליחת מייל" (C, title "שליחת מייל ללקוח") / "שלח מייל" בתוך D | `handleSendEmailClick`: אם אין `customer.email` -> alert "ללקוח זה לא מעודכנת כתובת מייל. אנא עדכן ב'פרטים אישיים' ושמור תחילה."; `verifyPin('שליחת מייל דורשת אישור מנהל. אנא הזן סיסמה:','feature:customer_email_approval')`; הצלחה -> `emailAuthResult=auth`, `emailModalOpen=true` | `window.customAuthPrompt` + `POST /api/auth/verify-pin` |
| "חזור" (C, title "חזור לרשימת הלקוחות") | `router.back()` (לא `push('/customers')`) | — |
| "ביטול חסימה" (D; רק `customer.isBlocked && isHeadManagement`) | `handleUnblockCustomer`: `window.customConfirm('לבטל את חסימת הלקוח מהזמנות חדשות?','ביטול חסימה')` -> PATCH | ראו ה |
| לשוניות | `onTabChange` | — |
| שורת הזמנה (O) / קישור `order.orderId` (O, `stopPropagation`) | `router.push('/orders/${order.orderId}')` / `Link` | — |
| קישור מספר הזמנה בזיכויים (R) | `Link /orders/{refund.orderId}` | — |
| ביטול/שלח במודל מייל, X (מוגן `!loading`), לחיצה על backdrop (רק `e.target===currentTarget && !loading`) | `onClose` / `handleSubmit` | POST |
| קישור הערה אוטומטית `/orders/{id}` (D) | `<a href>` | — |

## (ה) קריאות רשת
| שיטה + URL | מפתחות | מתי | שימוש |
|---|---|---|---|
| `GET /api/me` דרך `fetchSharedJson(..., {ttl:TTL.STATIC})` | — | mount | `data.success && employee` -> `isHeadManagement = roleId===0 \|\| roleId===2` |
| `GET /api/settings` דרך `fetchSharedJson(TTL.STATIC)` | — | mount | מערך `{key,value}` -> `settings[key]=value` |
| `GET /api/customers/${id}` | — | effect על `[id, router]` (לא ב-`new`) | `error` -> `router.push('/customers')`; אחרת `setCustomer`+`setOriginalCustomer`+`addHistory({type:'customer', id, name:'לקוח: {שם ללא "null"}', subtext: phone1})`. ב-`Promise.all` עם: |
| `GET /api/refunds?customerId=${id}` | — | כנ"ל | מערך -> `refunds`; משולב ב-`allPayments` כשורות `entryType:'refund'`, `paymentDate=createdAt`, `paymentMethod:'זיכוי'` |
| `POST /api/customers` (id==='new') | גוף = `{...customer, email: normalizeEmail(email, emailSuffix)}` | `handleSave` | `data.id` -> `router.push('/customers/${data.id}')` |
| `PUT /api/customers/${id}` | אותו גוף | `handleSave` (כל 3 הטפסים: פרטים, בנק, כפתור הכותרת) | `setOriginalCustomer(data)` + `alert('הפרטים נשמרו בהצלחה!')`; מחזיר `true`. שים לב: **לא** קורא ל-`setCustomer(data)` |
| `PATCH /api/customers/${id}` | `{isBlocked:false, blockedReason:null}` | ביטול חסימה | `!ok` -> `alert(data.error\|\|'שגיאה בביטול החסימה')`; הצלחה -> עדכון מקומי של `customer` ו-`originalCustomer`; חריגה `alert('שגיאת רשת בביטול החסימה')` |
| `GET /api/customers/locations` דרך `fetchSharedJson(TTL.REFERENCE)` (D) | — | mount של D (גם אם לא במצב עריכה) | `cities`, `streets` ל-datalists |
| `GET /api/audit?entityType=Customer&entityId={id}&search={filterSearch}` (H) | `search` רק אם לא ריק | mount ובכל שינוי `filterSearch` | `data.logs`; `!ok` -> error state; מנגנון `cancelled` |
| `POST /api/auth/verify-pin` (`verifyPin`) | `{pin, employeeId, requiredLevel}` | אחרי `customAuthPrompt` | `!success` -> `alert(data.error\|\|'סיסמה שגויה או הרשאה לא מספקת.')`; חריגה 'שגיאה באימות מול השרת.' |
| `POST /api/send-email` (E) | `{to: customer.email, subject, emailBody, username: authResult.employeeId, password: authResult.pin, customerId, fileName, fileContent, attachments:[{fileName,fileContent(base64),mimeType,sizeBytes,dest}], sendMode, driveFolderId}` | submit | `success` -> הודעה + `driveLinks`, סגירה אוטומטית אחרי 2400ms ואיפוס; אחרת `error=data.message\|\|'שגיאה בשליחת המייל'`; חריגה 'שגיאת תקשורת' |
- אין `pageCache`; `apiCache` דרך `fetchSharedJson` בלבד (me/settings/locations). ה-interceptor של `apiCache` מבטל מטמון אחרי מוטציות. **אין** פינוי מפורש של `cacheNamespace('customers')` לאחר שמירה — הרשימה מתרעננת ברקע ב-mount.

### ולידציה ב-`handleSave` (לפי סדר, P:145-232)
1. `id==='new'`: `unsatisfiedFieldGroupErrors(customer, parseFieldGroups(settings.mandatory_field_groups))` -> alert ושורות מחוברות ב-`\n` (ברירת מחדל `[['phone2','email']]`; `[]` תקף = ללא דרישה); הודעה: `חובה למלא לפחות אחד מבין: {תוויות}`.
2. רק `new`: `settings.require_customer_email==='true'` -> "דוא"ל"; `require_full_address==='true'` -> "עיר","רחוב","מספר בית"; `require_customer_id_number==='true'` -> "תעודת זהות". alert `שדות חובה חסרים: {…, }`.
3. `validateCustomerFieldFormats(customer)` (גם בעריכה): `מספר הטלפון הראשי אינו תקין` / `מספר הטלפון הנוסף אינו תקין` (regex `^0\d{8,9}$` על ספרות) / `כתובת הדוא"ל אינה תקינה` / `מספר תעודת הזהות אינו תקין` (ספרת ביקורת ישראלית, עד 9 ספרות) / `טלפון נוסף זהה לטלפון הראשי - יש להזין מספר שונה`.
4. `setSaving(true)`; תגובת שרת: `409 && data.message` -> alert(message) וחזרה; `!ok` אחר -> `throw data.error||data.message||'שגיאה בשמירת נתונים'` -> alert; `finally saving=false`. ערך מוחזר: `true` בהצלחה, `undefined` בכל כשל (D תלוי בזה).
- `normalizeEmail(email, emailSuffix)` נקרא ב-`handleEmailBlur` (מחליף `customer.email` אם השתנה) וגם בגוף השמירה. `emailSuffix` לא מוצג ב-UI.

## (ו) חלוניות / הודעות
- מודל מייל (E): `.modal-backdrop` zIndex 1000, `maxWidth 500px`, כותרת `שליחת מייל - {firstName} {lastName}`; callout שגיאה (`#i-alert-circle`), callout הצלחה (`#i-check-circle`) עם רשימת קישורי דרייב (`target=_blank`); טקסטים: `חובה למלא נושא ותוכן`, `המייל נשלח בהצלחה!`, `המייל נשלח! {N} קבצים בדרייב עם הרשאת הורדה מלאה.`, כפתור `שלח` / `שולח...`.
- `window.customAuthPrompt` (PopupProvider; כותרת "אימות הרשאה"), `window.customConfirm` (ביטול חסימה).
- alerts: כל ההודעות לעיל. אין toast.
- callout חסימה (D): `callout-danger`, "לקוח חסום מהזמנות חדשות" + ` — {blockedReason}`.

## (ז) מצבים מיוחדים
- טעינה: `.page-loading` + `spinner lg` "טוען נתונים...". `!customer` -> `null`. שגיאת `error` בתגובה -> הפניה ל-`/customers` (ללא הודעה). `catch` -> `loading=false` בלבד (מסך ריק).
- `hasUnsavedChanges = JSON.stringify(customer) !== JSON.stringify(originalCustomer)` — שולט על ביטול שינויים. **אין** אזהרת עזיבה.
- חסום (`isBlocked`): callout בלשונית פרטים; ביטול חסימה להנהלה ראשית בלבד.
- SystemSetting: `require_customer_email`, `require_full_address`, `require_customer_id_number` (נווה יעקב בלבד; ביצירה בלבד), `mandatory_field_groups` (JSON; ביצירה בלבד), `hide_marketing_consent_field` (`!=='true'` להצגה; בשני המצבים).
- O — מיון: לפי `getEventSortDate` יורד (`isWeekdayEvent||isAbroad` -> `fromDate||eventDate||orderDate||createdAt`; אחרת `eventDate||orderDate||createdAt`). עמודות: קוד הזמנה · תאריך אירוע/השכרה (`isWeekdayEvent`: "לקיחה: / החזרה:"; אחרת `eventDateHebrew` או תאריך `he-IL`) · סטטוס פריטים (`calculateOrderStatus` + badge) · סכום לחיוב (סכום `obligations` שלא `isDeleted`, אחרת `totalAmount`) · שולם (סכום `payments` שלא `isDeleted`; ירוק אם `>=` וסכום>0, אדום אם `<`) · סטטוס תשלום (`calculatePaymentStatus`). ריק: "אין הזמנות ללקוח זה." תחתית: `סה"כ הזמנות מוצגות: {N}`.
- PY: KPI: סך הכל חיובים · סה"כ שולם · סה"כ זיכויים (רק אם >0) · יתרת חוב / יתרת זכות / מאוזן (`debt = totalRequired - (payments - refunds)`, badge "חובה"/"זכות"). טבלה: תאריך · סוג (תשלום/זיכוי) · הזמנה מקושרת (`הזמנה {id}` / `-`) · אופן תשלום (זיכוי: `reason||'זיכוי'`) · סכום (זיכוי עם `-`) · הערות (זיכוי: `בוצע`/`ממתין לביצוע`). ריק: "אין היסטוריית תשלומים ללקוח זה." נתוני `allPayments` ממוינים לפי תאריך יורד ומחושבים ב-P (`payments` של כל הזמנה + `refunds`).
- R טבלת זיכויים: תאריך בקשה · מס' הזמנה · סכום (אדום) · סיבה · סטטוס (badge `בוצע ({תאריך ביצוע})` / `ממתין לביצוע`). ריק "אין זיכויים ללקוח זה."
- H: כותרת "היסטוריית שינויים", ספירה `{N} תיעודי פעולות`; שורות: badge פעולה (`ACTION_TRANSLATIONS`; צבע לפי `ACTION_BADGE_CLASS`) + `{employeeName||'עובד שנמחק'|'מערכת'} ביצע/ה {פעולה}` + תאריך `he-IL` (עברי) + שעה + `ChangesChips`. מצבים: טעינה "טוען היסטוריית שינויים...", שגיאה `שגיאה בטעינת היסטוריה: {msg}`, ריק "לא נמצאו תיעודי היסטוריה או שינויים".
- C: `initials` מהאות הראשונה של שם פרטי+משפחה (או `?`); שם מסנן "null"; `address = "{street} {houseNum}, {city}"`; `updatedLabel` מ-`updatedAt` (`getHebrewDateString` + שעה).

## (ח) URL / אחסון
- פרמטר נתיב `id` (`use(params)`); `id==='new'` = מצב יצירה. אין query params. `activeTab` לא נשמר ב-URL/אחסון.
- localStorage: `agy_history` (`addHistory`, עד 7 פריטים, אירוע `agy_history_updated`) — נכתב בכל טעינת לקוח קיים. אין sessionStorage.

## (ט) הדפסה / ייצוא / AI
- אין הדפסה/ייצוא/AI בעמוד. שליחת מייל עם צרופות/דרייב (`/api/send-email`).

## (י) מלל (מלאי)
לקוח חדש · חזרה · שם פרטי / שם משפחה / טלפון / טלפון נוסף / דוא"ל / עיר / רחוב / מספר בית · תעודת זהות (לעריכה/ביטול) · מאשר/ת קבלת דיוורים · הערות · שמור פרטים · שומר... · פרטים אישיים · הזמנות · תשלומים · זיכויים ופרטי בנק · היסטוריה · שמירת שינויים · ביטול שינויים · שליחת מייל · חזור · עריכת פרטים אישיים · סגור עריכה · העתק כתובת מייל · שלח מייל · השלם ל- @gmail.com · הערות הלקוח · לקוח חסום מהזמנות חדשות · ביטול חסימה · פרטי חשבון בנק לזיכויים · שם בנק · סניף · מספר חשבון · שם בעל החשבון · שמור פרטי בנק · היסטוריית זיכויים · היסטוריית תשלומים · הזמנות הלקוח · עודכן לאחרונה · לקוח ללא שם · אין פרטי קשר או כתובת · הפרטים נשמרו בהצלחה!

## (יא) הערות סיכון
1. **מצב `new` ומצב קיים חולקים `handleSave`/`settings`/`id`** — שינוי חוזה ערך-החזרה (`true`/`undefined`) שובר את סגירת העריכה ב-D.
2. כל 5 ה-tab-panels חייבים להישאר mounted (בעיקר H ו-D: state, `useEffect` של fetch; H מושך `/api/audit` גם כשלא פעיל).
3. `PUT` שולח את **כל** אובייקט `customer` כולל `orders` המקוננות (הגוף הגדול הוא התנהגות קיימת; לא לצמצם).
4. אחרי PUT לא מתבצע `setCustomer(data)`, רק `setOriginalCustomer` — לכן `hasUnsavedChanges` יכול להישאר false/true לפי JSON ההבדל; לא "לתקן" בלי בדיקה.
5. "חזור" = `router.back()`; "חזרה" ב-`new` = `router.back()`.
6. `require_*` נאכפים רק ביצירה; עריכה נבדקת רק בפורמט (דיווח 48ff7055) — התנגשות אפשרית עם דרישה חדשה לעיצוב "כוכביות".
7. `verifyPin` שולח `employeeId` + `pin`; מודל המייל שולח `username/password` = employeeId/pin לשרת — לשמר.
8. `datalist` + `autoComplete="new-password"` מכוונים נגד autofill דפדפן (פריט 1 בדיווחי feedback — נושא רגיש); לא להחליף ל-select בלי בדיקה.
9. `hide_marketing_consent_field` נבדק בשני הטפסים; ערך ב-`settings` כמחרוזת.
10. `renderCustomerNotes` תלוי ב-regex מדויק של הערות אוטומטיות שנכתבות ע"י השרת; לא לשנות פורמט.
11. `Link` ב-O/R עם `stopPropagation` (O) — כדי לא לנווט פעמיים.
