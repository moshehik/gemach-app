# חוזה: `/customer-interface` — עמדת לקוח (קיוסק)
קבצים: `app/customer-interface/page.js` (1683 שורות, `'use client'`), `app/customer-interface/kiosk.css` (442 שורות, prefix `ka-`, scope `.katelier`), רקע: `KIOSK.md`.

## 1. מטרה וגישה
- מסך שהעובד/ת מגיש/ה ללקוחה: שלב 1 בחירת תאריך אירוע (לוח עברי) + עוזר AI + (אופציונלי) רישום עצמי; שלב 2 קטלוג שמלות זמינות לתאריך, 3 תצוגות, סינון, הדפסה, נעילת מסך.
- **גישה ציבורית**: `app/layout.js:46` — `isPublicKiosk = x-pathname startsWith('/customer-interface')` → מסך ה-LoginScreen לא מוצג גם כש-`require_login` דלוק. אך קריאות ה-API עדיין כפופות ל-`require_login` (401 אם אין עובד מחובר — ראו הודעה ב-`page.js:637`).
- ב-nav: `navConfig.js:313` "עמדת לקוח" (`i-eye`), ללא gate. `PrefetchManager` מושבת בעמוד זה.
- **שכבת אבטחה 1 (בדפדפן) — חייבת להישאר בדיוק:** נעילה = `isLocked` + Fullscreen; יציאה מ-fullscreen פותחת מודל אימות; חסימת `contextmenu`; `body.hide-global-nav` (מסתיר sidebar/topbar/AI widget — `globals.css:167-172`). שכבה 2 (`scripts/kiosk/launch-kiosk.bat`) מחוץ לקוד הדף. ראו KIOSK.md.

## 2. State ו-refs (חוזה התנהגות)
| שם | ברירת מחדל | הערות |
|---|---|---|
| `stage` | 1 | 1=תאריך, 2=קטלוג; מעבר בכפתורי ה-stepper, בבחירת תאריך בלוח (→2 אוטומטית), בצ'יפ AI |
| `selectedDate` | היום 00:00 | שינוי מפעיל `fetchInventory` |
| `dresses`, `loading` | [], true | |
| `search`, `selectedCategories`, `selectedSizes` | '', [], [] | סינון צד-לקוח |
| `showZeroSizes` | false | הצגת מידות ללא מלאי |
| `viewMode` | `'rows'` | `grid`/`rows`/`table` |
| `zoomLevel` | מ-`localStorage['ka_zoom_level']` (0.5–1.5) אחרת 1 | מיושם כ-CSS `zoom` על אזור התוצאות |
| `sidebarOpen` | false (דיווח 267e5bbb — סגור כברירת מחדל) | |
| `isLocked`, `showUnlockModal`, `unlockIntent` (`'unlock'`/`'print'`), `unlockEmployee`, `unlockPassword`, `showUnlockPassword`, `unlockError`, `unlockLoading` | false/false/'unlock'/... | |
| `suppressRelockRef`, `printModelRef` | false / null | `suppressRelockRef` מונע פתיחה מחדש של מודל הנעילה בזמן הדפסה מאושרת (2.5 שנ'); `printModelRef` = דגם בודד להדפסה אחרי אישור |
| `settings` | `{hide_dress_images:'false'}` | כל SystemSetting כמפה key→value |
| `regForm`, `regSubmitting`, `regError`, `regSuccess` | ראו 5 | רישום עצמי |
| `showOrdersModal`, `ordersModalModel`, `ordersModalSize`, `ordersModalLoading`, `ordersModalOrders` | | מודל הזמנות לדגם |
| `aiChats` `{1:[...],2:[...]}`, `aiInput`, `aiLoading`, `isAiChatVisible` | הודעת פתיחה לכל שלב | צ'אט נפרד לכל שלב; נסגר בכל החלפת שלב |
| `zoomPopoverOpen` | false | נסגר ב-mousedown חיצוני |
| `employees`, `priceCategories` | [] | לרשימת אימות + סינון קטגוריות |

## 3. אזורים לפי סדר
1. **Topbar** (`ka-topbar`): 
   - שורה 1 (תמיד): מותג "עמדת לקוחות" (`#i-bag`) + stepper של 2 כפתורים ("שלב 1 · בחירת תאריך" עם `#i-check-circle` כשעברנו; "שלב 2 · קטלוג ותוצאות") — לחיצה על כל אחד קובעת `stage`.
   - שורה 2 (רק בשלב 2): כותרת "קטלוג שמלות זמינות"; שבב תאריך (עברי + `he-IL`); ספירת "N דגמים · M פנויות" (`data-agy-id=catalog_results_count`, `grandTotalItems` מחושב באותם כללים כמו הכרטיסים); אזור AI; "סינון ותצוגה" (+ נקודה כשיש סינון פעיל); כפתור זום + popover; **אשכול פעולות** (ראו 4).
2. **שלב 1** (`<section>`): כרטיס חיפוש AI "hero" (רק `aiEnabled && aiMessages.length<=1`); `ka-stack`: כרטיס צ'אט AI (אם `aiMessages.length>1`), כרטיס "מתי האירוע שלכם?" + `AtelierCalendar`, כרטיס רישום עצמי (`kioskSelfServiceOn`), כרטיס "הזמנה עצמאית" stub (`kioskSelfServiceOn`).
3. **שלב 2**: כרטיס צ'אט AI (כש-`isAiChatVisible`); `ka-layout` (עם/בלי `no-panel`): sidebar סינון (`sidebarOpen`) + אזור תוצאות.
4. מודל נעילה; מודל הזמנות-לדגם (`zIndex:10000`).
5. `<svg>` מוסתר עם 3 סמלים מקומיים: `ka-i-send`, `ka-i-table`, `ka-i-filter` (לא קיימים ב-`IconSprite`).

## 4. כפתורים ופעולות (שלב 2 — אשכול הפעולות `page.js:1100-1133`)
| title | data-agy-id | handler | אפקט |
|---|---|---|---|
| חזור למערכת (`#i-logout`) | `exit_to_system_btn` | נעול → פותח מודל unlock; אחרת `router.push('/')` | |
| חיפוש חדש (`#i-search`) | `new_search_btn` | `setStage(1)` | לא דורש קוד גם בנעילה (הקוד ב-KIOSK.md מציין אחרת — התנהגות בפועל: פתוח) |
| רענון מלאי (`#i-refresh`) | `refresh_inventory_btn` | `fetchInventory` | |
| הדפסה / "הדפסה (באישור עובד)" (`#i-printer`) | `print_catalog_btn` | נעול → מודל unlock עם `intent='print'`; אחרת `handleCatalogPrint()` | |
| שחרור מסך (`#i-lock`, מוצג כשנעול) | `unlock_screen_btn` | מודל unlock | |
| נעילת מסך ללקוח (מוצג כשלא נעול) | `lock_screen_btn` | סוגר מודל הזמנות, `isLocked=true`, `documentElement.requestFullscreen()` | title ארוך עם הסבר Esc |
| סינון ותצוגה | `toggle_sidebar_btn` | toggle `sidebarOpen` | |
| גודל תצוגה (זום) | `zoom_toggle_btn` | popover עם `input[type=range] 0.5–1.5 step 0.1` (`zoom_range_input`); כותב `localStorage['ka_zoom_level']` | |
| הדפסת הדגם הזה בלבד | (ללא) | בכרטיס/שורה; נעול → `printModelRef=model` + מודל unlock `print`; אחרת `handleCatalogPrint([model])` | `stopPropagation` |

## 5. שדות
### 5.1 לוח עברי `AtelierCalendar` (`page.js:100-284`)
- 3 selects: יום (`kiosk_cal_day_select`, `HEBREW_DAYS`), חודש (`kiosk_cal_month_select`, `getMonthsForYear` — תשרי…אלול, אדר א'/ב' בשנה מעוברת), שנה (`kiosk_cal_year_select`, 32 שנים מ-`שנה-1`, `gematriya`). שינוי → `changeSelection` (מתקן אדר ב' בשנה לא מעוברת, מגביל יום למקסימום החודש) → `onSelect(gregorianDate 00:00)` → **בכל בחירה עוברים לשלב 2**.
- לוח: כותרת טווח 3 חודשים רצופים + כפתורי "חודש קודם/הבא" (`chevron-end`/`chevron-start`); לכל חודש שורת ימי-שבוע `א…ש` וגריד ימים (שבוע מתחיל ראשון; ימים מטושטשים של חודשים סמוכים לא לחיצים, `tabIndex=-1`), כל תא: יום עברי + יום לועזי (`.g`); מצבים `selected`, `today`, `muted`. תחתית: תאריך עברי + "פרשת X" (`Sedra` של השבת הקרובה, `he-x-NoNikud`) + כפתור "ניקוי" (`kiosk_cal_clear_btn`) שמחזיר להיום (ולכן גם עובר לשלב 2!).
- אין קריאת רשת.
### 5.2 רישום עצמי (רק `settings.kiosk_customer_self_service==='true'`)
שדות → `regForm`: `firstName *`, `lastName *`, `phone1 *` (`type=tel dir=ltr`, placeholder "נייד או קווי"), `email` (`*` אם `require_customer_email`), `city`/`street`/`houseNum` (`*` אם `require_full_address`), checkbox `marketingConsent` "מאשר/ת קבלת דיוור ועדכונים" (מוסתר אם `hide_marketing_consent_field==='true'`; `*` אם `require_marketing_consent`). data-agy-id: `reg_*_input`, `reg_marketing_consent_input`, `reg_submit_btn`.
- ולידציה בלקוח `getMissingRegFields`: תמיד חובה firstName/lastName/phone1; ועוד לפי `mandatory_fields` (מפרידים בפסיק, שמות חלופיים ב-`CUSTOMER_FIELD_ALIASES`) + 3 ההגדרות לעיל. הודעה: `שדות חובה חסרים: {תוויות}` (`CUSTOMER_FIELD_LABELS`).
- submit: `POST /api/customers` body = `regForm` כולו. `res.ok` → `regSuccess=data` (מסך הצלחה: "נרשמתם בהצלחה!" + `מספר לקוח: {legacyId}` + כפתור "רישום לקוח נוסף" שמאפס). 401 → "הרישום דורש עובד מחובר במערכת. נא לפנות לצוות הגמ"ח." אחרת `data.error||'שגיאה ברישום, נא לפנות לצוות הגמ"ח'`; חריגה: "שגיאת תקשורת - נא לפנות לצוות הגמ"ח".
- כרטיס stub "הזמנה עצמאית": כפתור **disabled** "הזמנה עצמאית תיפתח בקרוב" (`self_order_stub_btn`) — **stub מכוון, אין לחבר** (KIOSK.md / הערה ב-`page.js:1274-1276`). `kiosk_allow_self_order` נקרא ל-`kioskAllowOrder` אך לא בשימוש.
### 5.3 סינון (sidebar, שלב 2)
חיפוש טקסט (`catalog_search_input`, placeholder "שם דגם, מספר, או מידה..."; תומך `מידה X` = התאמה מדויקת ללא פריטים לא-שמישים); קטגוריות (checkboxים מ-`priceCategories`, ספירה `categoryCounts`, `category_filter_<cat>`); "סינון מהיר לפי מידה" (`size_chip_<sz>`; `sizeChipData` — מידות עם ספירת דגמים); מתג "הצג גם מידות ללא מלאי פנוי" (`toggle_zero_sizes_div`); בורר תצוגה 3 כפתורים (`view_grid_btn`/`view_rows_btn`/`view_table_btn`; titles: כרטיסים גדולים / רשימה מפורטת / טבלה קומפקטית); "נקה את כל הסינונים" (`clear_all_filters_btn`).
### 5.4 מודל נעילה — שדות
select "בחר עובד:" (`unlock_employee_select`, "-- בחר --"), "קוד גישה:" password (`unlock_password_input`, כפתור עין `title` הצג/הסתר סיסמה), שגיאה `.ka-error`. כפתורים: "ביטול" (`cancel_unlock_btn` — סוגר ואיננו משחרר), submit (`submit_unlock_btn`): "שחרר" / "אשר והדפס" / "בודק...". כותרת: "שחרור מסך מנעילה" / "אישור עובד להדפסה". הודעות: "נא לבחור עובד", `data.message||'שם עובד או סיסמא שגויים'`, "שגיאת תקשורת".

## 6. עוזר AI (מותנה `aiEnabled`)
- `aiEnabled = hide_ai_features!=='true' && enable_ai_specific_employees!=='true'`. מחלקות `ai-feature-element`; `body.hide-ai-features` (layout) מסתיר גלובלית.
- שלב 1: pill "לדוגמה: שמלה שחורה מידה 12..." (`hero_ai_search_input`/`hero_ai_search_btn`, איקון star). שלב 2: input "שאל את ה-AI..." (`catalog_ai_input`) או כפתור "העוזר החכם פעיל - לחץ לסגירה" (`catalog_close_ai_btn`).
- כרטיס צ'אט (`renderAiChatCard`): כותרת "העוזר החכם", "שיחה חדשה" (`new_ai_chat_btn`, מאפס לפי שלב), "סגור" (`close_ai_chat_btn`, רק בשלב 2), bubbles, אנימציית הקלדה, input "מה תרצה לחפש?" (`ai_chat_input`) + שלח (`ai_chat_submit_btn`, איקון `ka-i-send`).
- `POST /api/ai` body `{prompt, history:[{role,content}], context:<מחרוזת הנחיה קבועה עם תאריך היום, איסור מסירת מידע ניהולי, והסבר תגית [FILTER:term]>}`; תשובה: `data.response` (+`tableData` נשמר ב-msg אך לא מוצג). כישלון: "שגיאה בחיבור למערכת ה-AI." / "שגיאת תקשורת.".
- תגיות בתשובה: `[FILTER:term]` → כפתור `ka-quick-chip` "סנן והצג: term" (קובע `search`, `stage=2`); `[DATE:YYYY-MM-DD]` → "הצג מלאי לתאריך …" (קובע `selectedDate` 12:00, `stage=2`). התגיות מוסרות מהטקסט המוצג. **הפרומפט (context) הוא חוזה — לא לשכתב.**
- אחסון: `localStorage['ai_customer_chat']` נכתב בכל שינוי הודעות (לא נקרא בדף).

## 7. קריאות רשת
| Method+URL | טריגר | פרמטרים | שימוש |
|---|---|---|---|
| `GET /api/settings` | mount | — | מערך `{key,value}` → `settings`. מפתחות בשימוש: `hide_dress_images`, `hide_ai_features`, `enable_ai_specific_employees`, `kiosk_customer_self_service`, `kiosk_allow_self_order`, `mandatory_fields`, `require_customer_email`, `require_full_address`, `hide_marketing_consent_field`, `require_marketing_consent` |
| `GET /api/dresses?eventDate=<ISO>&limit=10000&filterStatus=active` | mount + שינוי `selectedDate` + כפתור רענון | | מערך או `{data}`; מסונן לקוח: `!exitDateFromRepo && items.length>0`. שגיאה: `console.error`, `loading=false` |
| `GET /api/employees` | mount | | לרשימת מודל נעילה |
| `GET /api/pricelists/categories` | mount | | מערך מחרוזות קטגוריות |
| `POST /api/login` | submit נעילה | `{employeeId,password}` | `res.ok&&data.success` → `intent==='print'`: הדפסה, נשאר נעול, ואחרי 2.5 שנ' מנסה fullscreen שוב; אחרת `isLocked=false` + `exitFullscreen`. שימו לב: **זה login אמיתי — יוצר session cookie של העובד** |
| `GET /api/orders?itemDetails=<name>[&modelBarcodePrefix=..]&eventDateFrom=<-7d>&eventDateTo=<+7d>&filterStatus=all` | לחיצה על דגם/מידה (כשלא נעול) | | `data.data`; עם מידה: מסונן לקוח לפי `item.dressId===model.id||description.includes(name)` וגם `מידה: X`/X בתיאור |
| `POST /api/customers` | רישום עצמי | ראו 5.2 | |
| `POST /api/ai` | ראו 6 | | |
| תמונות: `getDressThumbUrl(model)` → `<img>` עם fallback ל-`model.imageUrl` ב-`onError` (`dataset.fellBack`), `loading=lazy` | | | `app/lib/dressImageUrl.js` |
מטמון: אין (fetch רגיל). אין polling.

## 8. תצוגות הקטלוג
- מיון: `getModelDisplayName` (שם, ואם ריק או מתחיל "ללא שם" → `barcodePrefix`), `localeCompare numeric`.
- חישוב מידות `getModelSizeInfo`: מדלג על פריטי `notInUse/isDeleted/isUnusable`; מידה = `sizeText||'כללי'`; `available`=פריטים עם `quantity>0`; `total`. ממוין numeric. `totalAvailable` = סכום available.
- **table**: 6 עמודות — (תמונה), שם דגם, מק"ט (`#barcodePrefix`), קטגוריה (badge), סה"כ פנוי (ירוק/אדום), פירוט לפי מידה (pills, `direction:ltr`). שורה לחיצה → מודל הזמנות; לחיצה על pill → מודל לפי מידה.
- **rows**: `ModelAvatar md`; בלוק שם/`#קידומת`/קטגוריה רק אם `modelHasRealName`; כפתור הדפסת דגם; שורת זמינות (`N יחידות פנויות` / "אין יחידות פנויות לתאריך זה" עם איקון); pills מידות.
- **grid**: כרטיס עם כפתור הדפסה, `ModelAvatar lg`, `h3` שם + badge קטגוריה (אם ≠ 'כללי'), קוד, שורת זמינות, pills.
- `ModelAvatar`: תמונה אם `showImage && imageUrl` (`hide_dress_images!=='true'`), אחרת ראשי תיבות (2 מילים → אות ראשונה מכל אחת; מילה מספרית → עד 3 ספרות; אחרת 2 תווים; `?`).
- מצבי מסך: טעינה (`ka-state-box` spinner "טוען נתונים..."); ריק ("לא נמצאו דגמים מתאימים" + "נסו לנקות..." + "נקה סינון ונסה שוב" `empty_state_clear_btn`); "אין מידות רשומות" / "אין מלאי פנוי" בתוך שורת pills.
- `title` של pill: `מידה {X}: {N} פנויות`.

## 9. מודל "הזמנות לדגם" (לא נפתח כשנעול)
כותרת `הזמנות - {שם דגם} (מידה X)`; רמז "טווח: שבוע לפני ואחרי תאריך האירוע"; טעינה "טוען נתונים..."; ריק "לא נמצאו הזמנות לדגם זה בטווח התאריכים הנבחר."; שורה: `הזמנה #{orderId} - {שם לקוח}`, `תאריך אירוע: he-IL`, badge סטטוס תשלום מחושב `calculatePaymentStatus(totalAmount,totalPaid)` + צבעים `getPaymentStatusColor` (`lib/orderStatus.js`), קישור `<a href="/orders/{orderId}" target=_blank>` (`title="פתח הזמנה"`). סגירה (`close_orders_modal_btn`).

## 10. הדפסת קטלוג (`handleCatalogPrint`, `page.js:784-888`) — חלון popup עם HTML מוטמע
- `window.open('','_blank')`; חסימת popups → `alert("נא לאפשר חלונות קופצים (Pop-ups) כדי להדפיס")`.
- כותרת "דוח זמינות דגמים - גמ"ח שמלות", "תאריך אירוע מבוקש: {עברי} | סינון: {שם הדגם / "חיפוש" / ללא סינון}"; טבלה 4 עמודות: שם הדגם, קידומת ברקוד, כמות זמינה, פירוט מידות וזמינות (pills `size (n)`); "סה"כ דגמים מוצגים: N"; "בס"ד"; auto `window.print(); window.close()` אחרי 300ms. A4, margin 15mm.
- **חלון popup לא משתמש בעיצוב האתר** — CSS קשיח בפנים (כלל הפרויקט: popup print לא יורש CSS vars). ה-HTML **לא מנוקה מ-escaping** (שם דגם נכנס גולמי) — לא לשנות בלי להבין.

## 11. אחסון / URL / Body classes
- localStorage: `ka_zoom_level` (קריאה ראשונית ב-initializer של useState — לכן `typeof window` guard), `ai_customer_chat` (כתיבה).
- `document.body.classList`: `katelier-bg` (תמיד בעמוד; מסיר padding מ-`.content`), `hide-global-nav` (רק כשנעול; מנוקה ב-cleanup).
- אין URL params. `data-agy-id`: ~45 מזהים (מפורטים לעיל) — **לשמר** (כלי AI/בדיקות).
- Listeners: `fullscreenchange`, `contextmenu` (document), `mousedown` (zoom popover).

## 12. הבדלי org / הגדרות
- כל ה-`kiosk_*` וההגדרות פר-DB (org). ברירות מחדל: כבוי (`kiosk_customer_self_service`). הבדל נווה-יעקב: `enable_ai_specific_employees` דלוק בחלקו (מסתיר AI בקיוסק).
- קטגוריות מחיר (`/api/pricelists/categories`) שונות פר-org.

## 13. מלל (לכתיבה מחדש)
מותג/stepper (2)/כותרות שלב; "מתי האירוע שלכם?"; כותרות לוח (יום/חודש/שנה/ניקוי); כרטיס רישום (כותרת, פסקה, 9 תוויות, מסך הצלחה, 4 הודעות שגיאה); stub הזמנה עצמאית; כל תוויות סינון; מצבי ריק/טעינה; מודל נעילה; מודל הזמנות; טקסטי AI (הודעות פתיחה x2, שגיאות x2, צ'יפים x2); tooltips של כפתורי הפעולה (9). **פרומפט ה-AI וה-HTML של ההדפסה — לא מלל לשכתוב.**

## 14. Risk notes
1. `kiosk.css` הוא מערכת עיצוב עצמאית (`ka-*`, פלטה חמה: terracotta/gold/sage/brick, `--paper`). R2 מחייב מעבר ל-tokens, אך זה **מסך מול לקוחות** — יש לבקש אישור משתמש (ראו QUESTIONS) על החלפת הזהות "אטלייה חמה". זיכרון הפרויקט: "Kiosk Warm-Atelier full skin — th-!important + hide-global-nav gotchas".
2. `globals.css` צובע כל `<th>` עם `!important` (`--sticky-header-bg`); ב-kiosk.css:37 יש override מקומי — לשמר בעת מעבר.
3. `zoom` CSS (לא `transform`) על אזורי התוצאות — משפיע על getBoundingClientRect ועל RTL; לשמר את המנגנון.
4. `AtelierCalendar` בחירה = מעבר שלב אוטומטי, כולל "ניקוי". שינוי UX (למשל כפתור "הצג מלאי") = שינוי התנהגות — לא ללא אישור. (הערת הקוד `page.js:98-99` מזכירה כפתור "הצג מלאי" שכבר לא קיים.)
5. RTL: חלון pills מידות ב-`direction:ltr`; טלפון/אימייל `dir=ltr`; אייקוני לוח `chevron-end`=חודש קודם.
6. נעילה: אין להסיר את `fullscreenchange`/`suppressRelockRef` ולא לשנות את סדר `setUnlockIntent`→`setShowUnlockModal`. מודל הנעילה חייב להיות `z-index` מעל הכל, ובעת נעילה `.topbar/.sidebar` חבויים ע"י `hide-global-nav`.
7. `POST /api/login` מהמודל מחליף cookie של העובד המחובר (side-effect קיים) — לא לגעת.
8. כרטיס הקיוסק בפועל **בתוך AppShell** כשלא נעול (sidebar+topbar גלובליים נראים); `PrefetchManager` מדולג.
9. R19: מודל נעילה = הזנת סיסמה ⇒ "בהיר בלבד" לפי הכלל (חלונית עם הזנת מידע); מודל הזמנות = תצוגה (כהה+בהיר). הקיוסק בעל ערכת צבעים חמה משלו — להחליט בשאלה.
10. אל תשנו `hide_dress_images` semantics (ברירת מחדל 'false' מוזרקת ב-initial state).
