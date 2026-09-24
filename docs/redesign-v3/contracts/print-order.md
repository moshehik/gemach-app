# חוזה: `/print/order` — כרטיס הזמנה / דף הכנה / דוח השכרה (הדפסה)
קובץ: `app/print/order/page.js` (966 שורות, `'use client'`, Suspense-less `useSearchParams`). **משטח הדפסה — לא מסך אינטראקטיבי.** כללי הפרויקט (זיכרון print-surfaces): שכבת הדפסה עם צבעים קשיחים, `@media print` ב-`<style>` מקומי, חלונות popup לא משתמשים ב-CSS vars של הערכה.

## 1. מטרה וגישה
- מחולל כרטיס הזמנה להדפסה (אחת או כמה הזמנות). נפתח ב-`window.open(..., '_blank')` מהמקומות הבאים (כולם חוזה כניסה):
  | מקור | URL |
  |---|---|
  | `app/orders/new/page.js:1338` (אחרי יצירת הזמנה) | `?orderId=N&type=order` |
  | `app/orders/[id]/page.js:970` (אחרי עדכון) | `?orderId=N&type=order` |
  | `components/orders/OrderPrintMenu.js:95` | `?orderId=N&type=<order\|rental>` |
  | `components/orders/RentalReturnModal.js:363` | `?orderId=N` (type ברירת מחדל `order`) |
  | `app/components/PrintWizardModal.js:114` / `app/board/page.js:284` (פירוט הזמנות להכנה) | `?orderId=1,2,3&type=order&batch=1` |
  | `app/api/pdf/route.js` (Puppeteer `page.goto`, `ALLOWED_URL_PATHS` כולל `/print/order`) | כנ"ל, מחכה ל-`data-print-ready` |
- גישה: אין gate בדף; ה-API (`/api/orders/{id}`) דורש session. `app/layout.js` עוטף אותו ב-AppShell — הדף מסתיר sidebar/topbar דרך CSS (ראו 7).

## 2. URL params
| param | ברירת מחדל | משמעות |
|---|---|---|
| `orderId` | — (ריק ⇒ שגיאה "לא סופק מספר הזמנה") | מספר או רשימה מופרדת בפסיקים (הדפסה מרוכזת) |
| `type` | `order` | `order` = כרטיס הזמנה; `rental` = דוח השכרה (מוסיף כותרת "דוח השכרה", תיבות box1/box2, תקנון, כותרת תחתונה+חתימה) |
| `batch` | — | `batch=1` מכריח מצב batch גם להזמנה אחת (f4b54afc). `isBatch = orderIdList.length>1 || batch==='1'` |

## 3. State והגדרות
| state | מקור | משפיע על |
|---|---|---|
| `orders[]`, `loading`, `error` | fetch | |
| `enableAlterations` (true) | `enable_alterations==='false'`→false | עמודת "תיקונים" (`colCount` 3/2) |
| `printSettings` | מפתחות: `print_rental_box1`, `print_rental_box2`, `print_rental_footer`, `gmach_name` (ברירת מחדל `גמ״ח שמלות`), `gmach_address`, `gmach_phone`, `main_email`, `standard_return_hour` (fallback `13:00`), `standard_pickup_hours` (fallback `20:00-21:30`), `rental_belt_notice` | כותרת/החזרה/קבלה/rental |
| `showDeliveryInPrint` (true) | `delivery_show_in_order==='false'`→false | תג "משלוח הלוך/חזור" |
| `sortDeliveriesFirst` (true) | `print_sort_deliveries_first==='false'`→false | פיצול לחטיבות בהדפסה מרוכזת |
| `markMissingInPrint` (true) | `print_mark_missing_dresses==='false'`→false (וגם מדלג על fetch ה-missing) | שורת "שמלה חסרה" |
| `missingMap` | `GET /api/print/missing-dresses?orderId=N` לכל הזמנה | `{[orderItemId]:{familyName,returnOrderId}}` |
| `logoBust` | `Date.now()` בטעינה | `?v=` ללוגו |

## 4. קריאות רשת
| Method+URL | מתי | הערות |
|---|---|---|
| `GET /api/orders/{id}` לכל id, במקביל | mount / שינוי `orderIdParam` | אחד נכשל (`!ok`) ⇒ `Error('Failed to fetch order data')` מוצג כטקסט שגיאה |
| `GET /api/settings` (`no-store`) | במקביל | ראו 3. אם `!ok` — `printSettings` נשאר `null` (fallbackים מקומיים) |
| `GET /api/print/missing-dresses?orderId=N` | אחרי ההזמנות, רק אם `markMissing` | כשל בודד נבלע (`null`) |
| `POST /api/log-visit` `{pageUrl:'[הדפסת כרטיס השכרה] הזמנה #N, #M'}` | כשנטען בהצלחה | לוג בלבד (`.catch(console.error)`) |
| `GET /api/logo?v=<bust>` | `<img>` | 404 ⇒ `onError` מסתיר את התמונה |
| Google Fonts `@import` (David Libre, Frank Ruhl Libre) | CSS | תלות חיצונית — ב-PDF headless דורש רשת |
**הדפסה אוטומטית:** 1000ms אחרי טעינה מוצלחת (`orders.length>0`) קורא `window.print()`. שגיאה/ריק — לא מדפיס.
`data-print-ready="true"` על `[data-agy-id=print-order-container]` כש-`!loading` (חוזה מול `/api/pdf` — Puppeteer `waitForSelector`). **לשמר בדיוק.**

## 5. מבנה הדף (לכל הזמנה — `renderOrderSection`)
טבלה חיצונית אחת `table.print-table` (כדי ש-thead יחזור בכל עמוד מודפס, ו-tfoot 30px רווח תחתון):
**thead:**
1. "בס"ד" (`.bsd`).
2. תיבה `.return-details-box` "קבלת השמלות" — אם יש `eventDate`: יום עברי `getHebrewWeekdayLabel` + תאריך עברי + שעות (`standard_pickup_hours`); תאריך = `subtractSkippingWeekendsAndChag(eventDate, 2)` (שני ימי-עסקים לפני האירוע, דילוג שישי/שבת/חג).
3. תיבה "פרטי החזרה" — `toDate||returnDate` אם קיים, אחרת `addDaysSkippingWeekends(eventDate,1)` (`lib/clientInventory`); שעה `standard_return_hour`; + שורת `rental_belt_notice` אם מוגדרת.
4. תיבה קבועה: "יש להצטייד בפרטי אשראי לפקדון בעת קבלת השמלות."
5. `.print-header`: לוגו 64px, `h1` שם הגמ"ח, שורת פרטים (כתובת | טלפון | דוא"ל — רק מה שקיים).
6. `.order-details-card` (flex, 2 עמודות, ימין=לקוח):
   - לקוח: "לכבוד: שם", טלפון (`phone1||phone`, `dir=ltr`), כתובת (`city[, address]`), "הערות להזמנה" אם יש `notes`.
   - הזמנה: `{דוח השכרה|הזמנה} #{orderId}`; תג משלוח (רקע `#fff3cd`) אם `showDeliveryInPrint && isDelivery` — "משלוח {deliveryDirection}"; "(הזמנה טלפונית)" אם `isPhoneOrder`; "סניף: בוצעה ב{branch} · איסוף ב{pickupBranch}"; אם `isDelivery` ויש כתובת: "כתובת משלוח: ..."; אם לא (`isWeekdayEvent`/`isAbroad`) "תאריך אירוע: {eventDateHebrew || getHebrewDateString(eventDate) || 'לא צוין'}" אחרת "סוג אירוע: אירוע חו"ל"; "הערות: ..." אם יש `notes` (שוב).
7. `.order-notes-box` (צהוב, "הערות להזמנה:") אם `notes`.
8. רק `type=rental && printSettings`: `.rental-notes-box` עבור `box1` ועבור `box2` (רקע נוסף).
9. שורת כותרות: "דגם / תיאור", "מידה", ("תיקונים" אם `enableAlterations`).
**tbody #1 (פריטים):** `activeItems = items.filter(!isDeleted)`; ריק ⇒ "אין פריטים פעילים בהזמנה זו". שורה: `stripCodeLabel(description || dressItem.dress.name || dressItem.dressName) || '-'` (מסיר "קוד:" מתוך סוגריים), `sizeText || dressItem.sizeText || '-'`, עמודת תיקונים `renderRepairChips`: צ'יפים "צוואר" (`neckAlteration===1|true`), "שרוול" (`sleeveAlteration`), "N ס״מ" (`lengthAlteration` לא ריק) + "בוצע" (`alterationDone`) + `alterationDetails`; ללא תיקונים ⇒ "ללא תיקונים". אחרי שורה של פריט שלא נלקח (`!isTaken`) והמפה מסמנת חסר ⇒ שורה `.missing-dress-row`: "שמלה חסרה: שמלה זו אמורה לחזור מחר ממשפחת {familyName}".
**tbody #2 (`tr.print-flow-row` — זנב, נשבר בין עמודים):**
- סיכום כספי: `totalObligations` = סכום `obligations` (לא-מחוקות), `totalPayments` = סכום `payments` (לא-מחוקות), `balance = max(0, obligations - payments)`. **batch:** רק "שולם: ₪X" קטן; **רגיל:** טבלה "סה"כ לחיוב / סה"כ שולם / יתרה לתשלום".
- (לא-batch) "תשלומים שהתקבלו": טבלה (תאריך עברי — `paymentDate` או **היום** אם חסר, אופן תשלום, סכום, הערות מ-`formatPaymentNotes`).
- `type=rental`: תקנון קבוע ("אין לבצע כביסה עצמאית ..." — טקסט משפטי, **לא לשכתב ללא אישור**), כותרת תחתונה `print_rental_footer` + "על החתום: ____" + "יש להחזיר טופס זה חתום בעת החזרת השמלות".
- (לא-batch) חזרה על `order-notes-box`.
- `.print-footer`: "הופק על ידי מערכת גמ"ח שמלות בתאריך: {עברי}".

### 5.1 `formatPaymentNotes` (PII! — חוזה)
מקבל `p.notes`: JSON (מתחיל ב-`{`) ⇒ `אישור: {Confirmation||TransactionId||אישור}` או "סליקת אשראי", + ` | תשלומים: {Tashloumim||תשלומים}` + ` | {הערות משתמש}`; טקסט חופשי ⇒ regex `אישור:\s*([a-zA-Z0-9]+)` (+`"Tashloumim":"N"`), או קיצור ל-50 תווים + `...`; JSON שבור ⇒ fallback regex. **מטרתו: לא לחשוף `LastNum` (4 ספרות כרטיס) ו-PII אחר.** אסור לשנות ללא בדיקת PII.

## 6. הדפסה מרוכזת (כמה הזמנות)
- `orders.length===1` ⇒ `renderOrderSection` בלי עטיפה. `>1`: `orderGroups`: אם `sortDeliveriesFirst` ויש גם משלוח וגם רגילות ⇒ שתי חטיבות (`.prep-group-divider` "הזמנות משלוח" / "הזמנות איסוף עצמי"), משלוחים ממוינים לפי כיוון: `הלוך`(0) < `הלוך-חזור`(1) < `חזור`(2); אחרת חטיבה אחת. כל הזמנה ב-`page-break-before` (חוץ מהראשונה בחטיבה הראשונה). `.batch-print` דוחס ריווחים (`padding 15px 20px` וכו') כדי שכל הזמנה תיכנס לעמוד.
- `@page` תחתית "עמוד X מתוך Y" (`@bottom-center`, Chrome/Edge 131+).

## 7. CSS הדפסה (חוזה לשימור)
- `@page{size:A4 portrait; margin:10mm}`; `print-color-adjust:exact`; `.print-table thead{table-header-group}`; `tr{break-inside:avoid}`; **`tr.print-flow-row{break-inside:auto!important}`** (אחרת עמוד ראשון חצי ריק/חיתוך); `.order-details-card,.return-details-box,.rental-notes-box,.summary-section,.terms,.print-footer,.missing-dress-row{break-inside:avoid}`; `.payments-section` בכוונה **לא** avoid.
- `.print-table th{position:static!important;...background #f4f4f4!important}` — דריסה של כלל global `table thead tr th` ב-`globals.css` (sticky-header, `!important`).
- הסתרת מעטפת: `nav.navbar,.global-sidebar-container,.topbar,.ai-floating-widget,[class*="sidebar"],[id*="sidebar"]{display:none!important}` (סוגר את דיווח c5032b47). `body{background:#fafafa!important}`.
- פונטים: `David Libre`, `Frank Ruhl Libre` (Google Fonts) — ערכת הדפסה אחת, **לא** מערכת ה-tokens.

## 8. מצבי מסך
טעינה: "טוען נתונים להדפסה..."; שגיאה: טקסט אדום (`err.message`, למשל `Failed to fetch order data` — אנגלית!); ריק: `orders.length===0` בלי error ⇒ קונטיינר ריק.

## 9. מלל
כל המלל בדף הוא **תוכן מודפס ללקוח** (קבלת שמלות/החזרה/פקדון/תקנון/כותרות). R10 (כתיבה מחדש) אינו חל על טקסטים משפטיים/תפעוליים ללא אישור. ניתן לשכתב תוויות UI בלבד: "טוען נתונים להדפסה...". אין tooltips/כפתורים בדף.

## 10. Risk notes לעיצוב מחדש
1. **מקור נוסף מיישר קו:** `app/api/orders/[id]/email/route.js` בונה HTML שקול ("Visual design mirrors app/print/order/page.js exactly") — שינוי עיצוב כאן לא ישתקף במייל/PDF שנבנה בשרת; לתאם.
2. `data-print-ready` + `data-agy-id="print-order-container"` — קלט של Puppeteer.
3. `orders.length>1` וגם `batch=1` עם הזמנה אחת מפעילים `isBatch` — חובה לשמר את שני התנאים (f4b54afc).
4. `Object.assign(merged,res.missing)` — מפתחות `orderItemId` ייחודיים גלובלית; לא לשנות מבנה.
5. `getHebrewDateString(new Date())` בשימוש ל"היום" — אזור זמן ישראל ב-`lib/hebrewDate.js`; לא להחליף ב-`toLocaleDateString`.
6. כלל "R17": מספרי טלפון `dir=ltr` כבר קיימים; ₪ ומספרים כדאי `<bdi>`.
7. אין להחליף CSS vars (הדף מוצג גם בחלון PDF/Puppeteer ללא ערכת הפלטה).
8. הדפסה אוטומטית ב-1000ms — לא להסיר; מודל "אשף הדפסה" סומך על כך.
9. שדות `neckAlteration/sleeveAlteration`: כאן מטופלים כ-**בוליאני/1**, ב-`/print/alterations` כ-**מספר>0 ("הצרה N")**. אסור לאחד סמנטיקה.
