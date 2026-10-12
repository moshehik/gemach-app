# יומן אינטגרציה 2026-10-12 (שלב א')

ענף: `integrate/2026-10-12`, מעל `origin/main` = `9a56d6ab` (כולל #273-#276). שום push, שום כתיבה ל-DB, שום סקריפט seed/DDL לא הורצו.

כללי העבודה:
- פתרון קונפליקטים: משמרים את כל הפיצ'רים של שני הצדדים; כשההתנהגות חופפת, הקוד שכבר ב-`origin/main` מנצח והפיצ'ר של הענף מותאם עליו מחדש.
- קונפליקטי גרסה (`app/version.json`, `package.json`): תמיד צד `integrate` (HEAD) — הרכז מטפל בגרסה בסוף. ה-hook מקדם גרסה בכל קומיט, לכן המספר ב-HEAD לא מייצג דבר.
- כל מיזוג בקומיט נפרד; תיקוני בדיקות/חיווט בקומיטים נפרדים אחריו.

## סדר המיזוגים

| # | ענף | קומיט מיזוג | קונפליקטים |
|---|---|---|---|
| 1 | `fix/settings-api-public-allowlist-2026-10-12` | 1a7fb630 | גרסה בלבד |
| 2 | `fix/stock-check-whole-sizes-2026-10-12` | 8520c22b | גרסה בלבד |
| 3 | `docs/sizes-access-audit-2026-10-12` | 76ce98c8 | גרסה בלבד |
| 4 | `feature/neve-model-numbers-2026-10-12` | 9d3b284d | גרסה בלבד |
| 5 | `fix/prep-pages-sizes-and-model-dup-2026-10-12` | 75b135e8 | גרסה בלבד (`lib/sizeSort.js` נמזג אוטומטית נקי — ראו להלן) |
| 6 | `fix/customer-email-autofill-2026-10-12` | 305af9b8 | `ModernPaymentsManager.js` (+ גרסה) |
| 7 | `feature/new-order-customer-filter-2026-10-12` | a55bae8e | `scripts/test_page_variant_switch.mjs` (+ גרסה) |
| 8 | `feature/customer-consent-2026-10-12` | 10f6f780 | 7 קבצים (ראו להלן) |
| 9 | `feature/kiosk-a5-skin-2026-10-12` (כולל `kiosk-public-backend`) | 43f6cf6b | `app/api/customers/route.js`, `app/layout.js` (+ גרסה) |
| 10 | `feature/station-analytics-2026-10-12` | 86582faa | `prisma/schema.prisma` (+ גרסה) |

קומיטים נוספים (לא מיזוג): 99fba3a2 (בדיקת order-card), 0453c379 (re-pin), f312e317 (תיקוני בדיקות אחרי consent), 1a0c0195 (חיווט kiosk), c3885ad4 (patch 03), 81d4ab93 (תיקוני בדיקות סופיים), b8c0b910 (מדיניות AI SQL).

## פירוט והחלטות לפי ענף

### 1-3. settings allow-list, stock-check, docs
נקי. ענף 3 הוא סקריפטים ומסמכים בלבד (`size_cleanup_apply.js` / `size_cleanup_rollback.js` — לא הורצו; נבדקו רק `node --check` ובדיקת היחידה `scripts/size-cleanup.test.mjs`).

### 4. neve-model-numbers
- חפיפה עם `origin/main` ב-5 קבצים (`items/[itemId]/route.js`, `items/route.js`, `newOrderLogic.js`, `orderCardLogic.js`, `pricingEngine.js`) — נמזגו אוטומטית נקי; השינויים של הענף נקודתיים.
- נשבר בדיקת `order-card-tests/review2.test.mjs` (S2): ה-regex בודק את סוף מערך `SETTING_KEYS` ב-`preview-pricing/route.js`, והענף הוסיף אליו `useModelNames`. עודכן ה-regex (לא הקוד).
- patch 03 הוחל אחרי מיזוג ענף 9 (קומיט c3885ad4). patches 01, 02, 04 — שלב ב'.

### 5. prep-pages-sizes-and-model-dup
- `lib/sizeSort.js` נוסף בשני הענפים (2 ו-5) — הפונקציות המשותפות (`normalizeSizeKey` המורחבת של ענף 2 + מיון הרשימות של ענף 5) חיות יחד בקובץ אחד.
- מול #276: "מספרי פריטים בלו"ז" שם הוא טולטיפ של כמות פריטים לכל שלב (`StageRail.js`) — לא מספור פריטים; אין כפל או מיון סותר. המיון של ענף 5 (`sortItemViews` ב-`loaders.js`: דגם עולה ואז מידה עולה, יציב) נשאר.

### 6. customer-email-autofill
- קונפליקט ב-`ModernPaymentsManager.js`: חתימת הרכיב — נשמר `bankRequired` (מהמיין) והתווסף `const nf = useNoFill()` (מהענף).
- `LegacyOrderPage.js` (קפוא ב-hash) השתנה ב-3 שורות (מאפייני שדה מייל בלבד) → עודכן `LEGACY_SHA256_LF` ב-`order-card-tests/static.test.mjs`.

### 7. new-order-customer-filter
- קונפליקט בהערות/נעילות `PINNED_BLOBS` ב-`test_page_variant_switch.mjs`: נשמרו כל ההערות ושני הערכים; ה-hash של `LegacyNewOrderPage.js` חושב מחדש (`git hash-object`).
- הערה: ב-`origin/main` עצמו (#276) ה-pin של `LegacyNewOrderPage.js` היה מיושן (הבדיקה נכשלת במאגר אמיתי עם היסטוריית git; בעץ בלי git היא מדלגת על ההשוואה). תוקן כאן.

### 8. customer-consent (הקונפליקטים המשמעותיים)
**חתימת התקנון במסלול אחד.** ב-`POST /api/customers` החתימה על הלקוח עוברת כולה דרך `prepareStaffConsent` → `planSignatureWrite` (אותו מנגנון קיים, חותמת מהשרת). ייבוא `planSignatureWrite` הישיר הוסר מהנתיב (לא בשימוש); `readSignatureFlag` נשאר. ב-`PUT /api/customers/[id]` אותו דבר (מיזוג אוטומטי נקי). אין כתיבה כפולה.

**חתימה ברמת ההזמנה (#276) מול הסכמות מפורשות (consent).** שתי שכבות שונות: `Order.hasSignedRegulations` (חובה בכל הזמנה, #276) ו-`Customer.hasSignedRegulations` + יומן `CustomerConsent` (consent). ההחלטה (כלל: main מנצח כשההגדרה כבויה; consent מותאם עליו כשהוא דולק):
- `explicit_consent_enabled` כבוי (ברירת המחדל) → בדיוק ההתנהגות של #276: מתג "חתם/ה על התקנון *" בלקוח חדש, חסימת "שמור לקוח והמשך" ו"סיום" בלי חתימה, מתג בראש שלב התשלום ללקוח קיים.
- דלוק → במקום מתג החתימה מופיע `ConsentFields` (תקנון כן/לא, דיוורים כן/לא, פרטיות). התשובה "כן" על התקנון מסמנת גם `order.hasSignedRegulations=true` (שאלה אחת, לא שתיים); "לא" נשמר כראיה ביומן, חסימת "שמור לקוח" לפי חתימת ההזמנה לא חלה (הלקוח נשמר), אך ההזמנה עצמה עדיין נחסמת בלי חתימה (מתג שלב התשלום של #276 מופיע שוב). בטופס הישן (`LegacyNewOrderPage.js`) אותו דבר.
- `StepCustomer.js`: ניווט Enter — המעטפת `useEnterNavigation` של consent מחליפה את ה-`onEnter` לכל שדה; ה-`onSignEnter` של #276 (Enter על מתג החתימה מסמן וממשיך) נשמר ונשאר לפני ה-hook (ה-hook מכבד `defaultPrevented`). שדה המייל: `inputMode:'email'` (מהענף autofill) ולא `type:'email'`; ההגנה `nf(k)` (autofill) נשמרה בכל השדות.
- `LegacyNewOrderPage.js`: `handleNewCustomerFieldEnter` = `handleEnterKey` המשותף, ועוד סימון חתימה ב-Enter על תיבת החתימה (`SIGNATURE_CHECKBOX_ID`).
- `ModernCustomerDetailsTab.js`: נשמרו `useNoFill` וגם `useEnterNavigation`/`ConsentFields`/props `explicitConsent`, `consentInfo`.
- `lib/settingsSimLayout.js`: שורת "שדות חובה בלקוח" עם `new_order_customer_list_filter` + סעיף "תקנון, פרטיות והסכמות".
- `app/api/customers/route.js`: ייבוא הבורר (`newOrderPickerConditions`) וה-consent יחד.

תיקוני בדיקות שהענף השאיר שבורות (נכשלות בעץ של הענף עצמו אחרי המיזוג עם הענפים האחרים): `settings-get.test.mjs` (רשימת ההחרגות כוללת את מפתחות `terms_file_*`), `test_settings_sim.mjs` (בלוק התקנון `special:'terms'` מוצג תמיד → לשונית `ord`), shim של auth בבדיקות consent (חסר `getSettingsViewerTier` מענף 1).

### 9. kiosk-a5-skin (כולל kiosk-public-backend)
קונפליקטים:
- `app/api/customers/route.js`: הייבואים (ללא `requiredFieldErrors` שהוצא ל-`lib/customerCreateValidation.js`), ושני תנאי ה-GET (`pickerFor=new-order` וגם `kioskPending=1`).
- `app/layout.js`: `isPublicDoc` (/privacy,/terms) ו-`stationBare` (/station) חיים יחד: `printBare` כולל את מסמכי הפרטיות/תקנון; `isPublicKiosk` כולל `stationBare`; `showLogin` מוחרג לשניהם.

חיווט (קומיט 1a0c0195):
- א. `KioskRegistration.js`: `TERMS_URL=/api/public-terms`, `PRIVACY_URL=/privacy` (כבר היו כך); `kioskEnterNav.js` נמחק, ברירת המחדל של prop `useEnterNav` היא `useEnterNavigation` המשותף; הטופס מחבר `onKeyDown`, ובשדה האחרון Enter מעביר פוקוס ללחצן השליחה (`data-enter-submit`) כמו בחוזה המקורי. מאפייני `data-enter` הוסרו (לא בשימוש).
- ב. `lib/publicKiosk/recordConsents.js` = re-export של `recordConsentsForCustomer` מ-`lib/customerConsentServer` (אותה חתימה). `registration.js` רושם בלוג כשהתוצאה `ok:false`. בדיקות הקיוסק הורחבו (shim ליומן + בדיקת 3 שורות יומן: ערוץ public, `customer_self`, `kiosk-register`, בלי עובד).
- ג. `layout.js` — ראו לעיל.
- ד. בדיקת settings-exposure: הקריאות של `KioskA5.js` (`gmach_name`, `kiosk_customer_self_service`, `kiosk_splash_screen`), `KioskSwitch.js` (`ui_variant_kiosk`) ו-`LegacyKioskPage.js` (שהוחלף מ-`page.js`) סווגו ב-`SESSION_BOUND` עם הערה; **לא** נוספו ל-allow-list הציבורי. `KioskA5.js` נוסף לרשימת הצרכנים המותרים של נתיבים סגורים, ובדיקת "app/components/kiosk לא משתמש בנתיב סגור" חלה על שאר הרכיבים (הציבוריים).
- ה. שדות הרישום ב-`KioskRegistration` נושאים `useNoFill` (כל שדות הפרטים, לא רק המייל — עמדה משותפת); גם טופס הרישום של `LegacyKioskPage.js` (היה פטור ב-`EXEMPT` של `test_email_autofill_guard.mjs`, הפטור הוסר).
- patch 03 (קומיט c3885ad4): `kioskLogic.js`, `publicKiosk/catalog.js`.

### 10. station-analytics
- `schema.prisma`: המודלים `AuthThrottle` (#273) ו-`StationEvent` יחד (`prisma validate` עבר).
- אין commits חדשים בענף אחרי המיזוג (נבדק).
- תיקוני בדיקות: אריח `/station-analytics` נוסף ל-`test_admin_hub.mjs` (`ADDED_LATER`, gate=head); תוויות `/privacy` ו-`/terms` ב-`lib/menu/pageLabels.js` (דף חדש מ-consent בלי תווית — `test_menu_logic`).

### תיקונים נוספים בעקבות האינטגרציה
- `lib/ai/sqlTablePolicy.js`: `CustomerConsent` ו-`StationEvent` נוספו ל-`ALL_TABLES` ול-`NEVER_TABLES` (ראיה משפטית / sidHash — לא לשאילתות AI). `AuthThrottle` (#273) עדיין חסר שם — כשל קיים ב-`origin/main` (לא תוקן; תיקון בשורה אחת אם הרכז יבחר).
- בדיקות שהתיישנו בגלל העברת קוד: `customer-card-tests` (הוולידציה של `POST /api/customers` עברה ל-`lib/customerCreateValidation.js`), `test_search_lists_ui_static.mjs` (רמז "ת"ז" בבורר הלקוחות).

## כשלים קיימים (נכשלים גם ב-`origin/main` נקי, לא תוקנו)

| בדיקה | סיבה |
|---|---|
| `cpu-phase1b-tests/dresses-list`, `employees-list` | בדיקות סטטיות של צרכני `/api/dresses` ו-`/api/employees` (צרכנים חדשים ב-main) |
| `customer-card-tests/run.mjs` (parity: POST פתיחה, `/api/payments`; CC-O6) | עוגנים בקוד שהשתנה ב-main |
| `order-card-tests/run.mjs` (`setAutoRefundBankForced is not a function`, AMB-06) | #275 |
| `order-events.test.mjs` | בדיקת מייל נכשל-שולח |
| `pdf-tests/server-pdf.test.mjs` | ייבוא ללא סיומת (`ocDocsLogic`) בלי register |
| `schedule-tests/run.mjs` (401 מול 403, עובד לא-פעיל) | ידוע |
| `test_ai_sql_table_policy.mjs` (`AuthThrottle` חסר) | #273 |
| `test_attendance_summary.mjs`, `test_punch_clock_logic.mjs`, `test_customer_inline_edit.mjs`, `test_search_lists_ui_static.mjs` (הודעות שרת בלקוחות/דגמים/השכרות) | ידועים ב-main |
| `test_scrub_logged_secrets_db`, `test_customer_completeness_db`, `test_ai_employees_live`, `*db-parity*` | דורשים DB/שרת — לא הורצו |
| `stock-check-tests/unit/stockCheck.mjs`, `route.mjs` — רק ב-`TZ=America/New_York` ורק בריצה מלאה מקבילה (עובר לבד ובכל אזור זמן אחר) | flaky ב-`origin/main` עצמו (נבדק: אותו כשל בריצה מלאה ב-NY על עץ origin/main נקי) |
| `logo-measure-tests/cpu-timing.test.mjs` | בדיקת תזמון, נכשלת מדי פעם תחת עומס (גם ב-origin/main) |

## תוצאות ריצה מלאה (כל הסוויטות הלא-תלויות-DB: 135 משימות)

- אזור זמן המחשב (Asia/Jerusalem), UTC, America/New_York: אפס כשלים חדשים מול `origin/main` נקי באותו אזור זמן (נשארו רק הכשלים הקיימים שלמעלה). סוויטות עם `run.mjs` (order-card, new-order, schedule, schedule-print, business-days, customer-signature, customer-consent, station-analytics) מריצות בעצמן כמה אזורי זמן.
- eslint: אין שגיאות חדשות בכל הקבצים ששונו מול `9a56d6ab` (203 קבצים; 3 אזהרות `no-img-element` בקבצי קיוסק חדשים).
- `prisma validate` עבר על הסכמה הממוזגת.

## מה לא נבדק
- `next build`, דפדפן, RTL ויזואלי, ושום DB (כולל DDL של `CustomerConsent` / `StationEvent` / `AuthThrottle`).
- בדיקות SSR קלות בוצעו ידנית (לא נשמרו בריפו): `KioskRegistration` (תחנה/ציבורי) ו-`StepCustomer` (consent כבוי/דולק) מרונדרים בלי שגיאה; בכבוי יש מתג חתימה, בדולק `ConsentFields` בלי מתג חתימה.
- `LegacyNewOrderPage.js` / `LegacyCustomerPage.js` — רק eslint ובדיקות סטטיות.

## שאלות פתוחות לרכז
1. consent דולק + לקוחה חדשה ענתה "לא" על התקנון: נשמרת (עם ראיה), וההזמנה נחסמת עד שמסמנים חתימה בשלב התשלום; חתימה שם מסמנת רק את ההזמנה, לא את הלקוחה ביומן. לאשר שזה המבוקש.
2. חתימה של לקוחה קיימת בשלב התשלום (#276) לא מעדכנת `Customer.hasSignedRegulations` ולא כותבת ליומן ההסכמות — כך גם ב-main.
3. רישום בעמדה לא שולח `termsVersion`/`privacyVersion` (הנוסח שהוצג); היומן רושם את הגרסה שבתוקף בשרת. אם רוצים ראיה מדויקת — הקיוסק צריך לקרוא `GET /api/public-consent-info` ולהחזיר את הגרסאות.
4. שני מגבילי קצב ציבוריים נפרדים (`lib/publicKiosk/rateLimit.js` ו-`lib/publicRateLimit.js`) — לא מתנגשים, אך כפולים.
5. `KioskSwitch` קורא `ui_variant_kiosk` דרך `/api/settings`: מחשב עמדה בלי התחברות לא יוכל לקרוא אותו ויקבל תמיד את העיצוב החדש (a5); בעמדה מחוברת — כרגיל.
6. DDL/seed שממתינים (לא הורצו): `prisma/migrations-pending/2026-10-12-customer-consent.sql` (+ `scripts/apply_customer_consent_table.js`), `scripts/station_event_table.sql`, `scripts/seed_customer_consent_settings.js`, `scripts/seed_kiosk_public_settings.js`, `scripts/seed_new_order_customer_list_filter_setting.js`; וכן `AuthThrottle` מ-#273 (`prisma/migrations-pending/2026-10-11-auth-throttle.sql`).

---

# שלב ב' (מיזוגי הענפים 1-8 + טלאים 01/02/04)

כללי הריצה בשלב ב': אותם כללים. לכל מיזוג הורצה כל סוויטת הבדיקות שאינה תלויה ב-DB (133 משימות; אותו מארג כמו בשלב א') והושוותה לריצת הבסיס (זהה לטבלת "כשלים קיימים" שלמעלה). כל כשל חדש תוקן לפני המשך.

## 11. feature/shared-delivery-discount-2026-10-12
- קונפליקטים:
  - `lib/pricingEngine.js` `applyDeliveryCharge`: נשמר תיקון #274 (הוספת חיוב המשלוח ל-`Order.totalAmount` + `syncPendingCreditRefund`) והוחזר גם `sharedDiscountedLegs` של המשלוח המשותף. חיוב המשלוח מחושב ב-`computeDeliveryObligationPreview` (כולל ההנחה) ולכן #274 מוסיף לסכום השמור את הסכום **המוזל**. חישוב המחיר-מחדש של המשלוח המשותף (`computeStoredTotalAfterDeliveryChange`) כבר מזהה סכום שמור "כולל משלוח" ו"בלי משלוח", ולכן תואם את #274 בשני המצבים. נוספה בדיקה (`server.test.mjs`, "#274 + משלוח משותף") שמוכיחה: סכום שמור = פריטים + משלוח (מוזל לצד שמוזל) ואין זיכוי אוטומטי מדומה אחרי "הוספת שמלה".
  - `app/api/customers/[id]/route.js` (PUT): נשמרו גם יומן ההסכמות (consent: `consentWarning`) וגם התראות המשלוח המשותף (`sharedDelivery`) - תשובה אחת: `{ ...updatedCustomer, sharedDelivery?, consentWarning? }`. הייבואים: `getActingEmployeeId` (consent) + `reconcileAfterCustomerAddressChange`.
  - `components/orders/modern/ModernGeneralDetails.js`: שני הייבואים (`useNoFill`, `SharedDeliveryPanel`).
  - `app/version.json`, `package.json`: צד integrate.
- #275 (בקשת פרטי בנק בזיכוי) ב-`settingsMetadata.js`/כרטיס ההזמנה: נמזג אוטומטית, נבדק שהמפתחות `credit_bank_*` קיימים לצד `shared_delivery_*`.
- תיקון: משתנה `body` כפול ב-PUT של הלקוח (שם התשובה שונה ל-`respBody`).

## 12. feature/order-docs-delivery-2026-10-12
- **שגיאת תחביר בענף עצמו:** ב-`lib/settingsMetadata.js` (הסבר ההגדרה `delivery_as_item_row`) היה גרש `ר'` בתוך מחרוזת בגרשיים בודדים - הקובץ כולו לא נטען (נפל settings-exposure, settings-get, test_settings_sim ועוד 12 בדיקות). הוחלף בגרש עברי (`ר׳`). בלי התיקון הענף שובר את האתר כולו.
- קונפליקטים: `lib/emailTemplates.js` (שורת "חתם/ה על התקנון" של #276 + בלוק המשלוח; `renderOrderCardEmailHtml`/`renderOrderConfirmationEmailHtml` מקבלות עכשיו גם `hasSignedRegulations` וגם `delivery`/`pickupMapsUrl`), `app/api/orders/route.js` (מייל האישור: שורות מסוננות לפי `visibleVisitLines`, שורת התקנון נוספה לפני כתובת האיסוף, `hasSignedRegulations` + `delivery` + `pickupMapsUrl` ל-HTML), `orders/[id]/email` ו-`print/order/page.js` (ייבואים משני הצדדים), `settingsMetadata` (שני מפתחות בוליאניים), `settingsSimLayout` (`dlv_main` של הענף + `dlv_shared`).
- **patch 01** לא חל כמות שהוא (אחרי מיזוג model-numbers הקוד כבר משתמש ב-`stripCodeLabel`/`collapseSameCodeLabel`) - הוחל ידנית באותה משמעות על `orders/[id]/email` (שם דגם דרך `modelDisplayName`/`scrubPlaceholderInText`), `ocDocsLogic` (`itemName`, `modelPhotosOf`), `print/order/page.js`. החלק של `app/api/orders/route.js` נדחה עד מיזוג email-center (שם הלוגיקה עוברת ל-`lib/orderConfirmationMail.js`).
- תיקוני בדיקות: `test_delivery_leg_button.mjs`, `test_delivery_different_address_button.mjs` - מיקום המפתח בפריסה/ברשימה השתנה (נוספו אחריו `delivery_as_item_row` וחבריו); הציפייה נעשתה עמידה לכך.

## 13. feature/email-center-2026-10-12 (+ חיווט order-docs-delivery, #276, patch 01 החלק של orders/route.js, patch 02)
החלטה מבנית: **תבניות המיילים הן אחת** (`lib/emailTemplates.js`), והן מקבלות גם את טקסטי מרכז המיילים (`cfg`) וגם את בלוק המשלוח של order-docs-delivery (`buildDeliverySection`: `rows` / `itemRows` / `summaryRows` / `notice` / `visits`). ה-hook של המרכז (`delivery = {outbound, return, outHours, returnHours}`) הוחלף במבנה האמיתי של `buildDeliverySection` (המרכז עצמו כתב שהוא "מחכה" לו).
- `renderOrderCardEmailHtml` / `renderOrderConfirmationEmailHtml`: כל כיתוב קבוע עובר דרך `tx()` (רישום `lib/emailRegistry.js`) וברירת המחדל זהה למה שנבנה לפני כן => **בלי עריכה הפלט זהה בייט-בבייט** לגרסה שלפני מרכז המיילים (תמונת הייחוס `scripts/email-center-tests/emailTemplates.original.mjs` הוקפאה מחדש מהתבניות אחרי order-docs-delivery ו-#276; מקרי הבדיקה הורחבו: חתימה על התקנון, כל כיווני המשלוח, שורות פריט, בלי מחיר, בלי כיתוב, קישור מפות).
- שורות חדשות ברישום (ניתנות לעריכה): `lblSigned`/`signedText` (שורת התקנון), `lblPickupAddress`, `mapsLabel`, `lblDeliveryOf` ("מתוכם"), `contactTitle` ("פרטי קשר"). `deliveryNotice`: ברירת המחדל היא `{{deliveryNoticeAll}}` = הנוסח המחושב מההגדרות (`delivery_notice_text` / `delivery_outbound_hours` / `delivery_return_hours`, רק הכיוונים שבהזמנה); **עקיפה שנשמרה במרכז המיילים מחליפה את כל הבלוק** (משתנים: `deliveryNoticeAll`, `deliveryNoticeText`, `deliveryOutHours`, `deliveryReturnHours`). `lblDeliveryOut`/`lblDeliveryBack` עורכות את שורות הכיוון בפריטים ובפירוט "מתוכם".
- `lib/orderConfirmationMail.js`: כתובת איסוף `gmach_pickup_address` (אחרת `gmach_address`) + קישור Google Maps, `visibleVisitLines` (החלטה 27), שורות המשלוח בגוף ה-plain, שורת התקנון (#276), שמות דגם דרך `lib/modelDisplay` (patch 02; החלק של patch 01 על `orders/route.js` בוטל - הלוגיקה עברה לכאן).
- שני אתרי הקריאה: `POST /api/orders` ו-`cron/daily` מעבירים `delivery: await loadDeliverySection(order)`. ב-cron: לולאת ימי תזכורת האיסוף של המרכז + `skipPickupReminderForDelivery`/`skipReturnReminderForDelivery` + כתובת האיסוף (`cfg.fixed.gmachAddress || pickupAddressFrom(get)`) גם בתזכורות איסוף ואיחור.
- `lib/emailSamples.js`: תצוגה מקדימה עם משלוח בונה סקציה אמיתית (`buildDeliverySection`), עם `hasSignedRegulations: true`.
- שדה קבוע "כתובת" במרכז המיילים (אם הוגדר) גובר על כתובת האיסוף בטקסט (קישור המפות נגזר תמיד מ-`gmach_pickup_address`); בהזמנת משלוח בלי ביקור בגמ"ח הכתובת בגוף נעלמת גם אם הוגדר שדה קבוע (בכותפת היא נשארת).
- בדיקות חדשות/מתוקנות: `email-center-tests/confirmation-wiring.test.mjs` (חיווט מלא מול prisma/mailer מדומים, 8 מקרים), `templates-parity` (55), `test_settings_sim` (סדר לשוניות `brand, auto, ord, disp`), `test_admin_hub` (האריח `/admin/email-center` ב-`ADDED_LATER`), `settings-tiers` (`lib/emailRegistry.js` ברשימת NOT_UI - מזכיר `courier_email` כמטא-דאטה בלבד).
- שאר הקונפליקטים: `orders/[id]/email` (cfg + delivery + pickupMapsUrl בקריאה אחת), `emailSamples`, `version/package.json` (צד integrate).

## 14. feature/branches-2026-10-12
- קונפליקטים טריוויאליים (שני הצדדים נשמרו): ייבואים ב-`settingsMetadata.js` (`NEW_ORDER_CUSTOMER_FILTERS` + `STAGES`), שורות `special` ב-`SettingsSimPage.js` (תקנון + סניפים + לו"ז), ייבואים ב-`LegacyNewOrderPage.js` (consent/ניווט Enter + `lib/branches`), רשימת הלשוניות ב-`test_settings_sim` (`cfg, brand, auto, ord, inv, disp`).
- תיקוני בדיקות: `PINNED_BLOBS` של `LegacyNewOrderPage.js` חושב מחדש; `review-fixes.test.mjs` מכיר את `multi_branch_enabled` בתנאי כרטיס "מצב הזמנה" של הטופס הישן.
- `prisma validate` עבר (עם `DATABASE_URL` דמה). `DressItem.branch` / `locationBeforeRental` + אינדקס: **נדרש DDL לפני הפריסה** (`scripts/branches-ddl.sql`, `scripts/apply_branches_ddl.js`) - ר' runbook.
- הערת lint קיימת (לא שלנו): `AppShell.js` "This value cannot be modified" (`window.location.hash =`) נכשל גם ב-HEAD לפני המיזוג.

## 15. feature/schedule-barcode-2026-10-12
- קונפליקטים: `orders/[id]` GET (שורת `mOpts` של model-numbers + `preppedIds` של הברקוד - שניהם), `rentals/confirm` (ייבואי `getCachedSetting` של סימון הרזרבה של branches + `lazyAutoMarkHandover/lazyCheckHandoverGate/registeredByScheduleIds`), `ScheduleDay` (`ScheduleSettingsDialog` של branches + `BarcodeDialog`/`ConfirmDialog`), `lib/schedule/index.js` (`getTransfersByOrder` + `isFeatureOn/attachDeliveryBarcodeInfo`; `canEditStages` + `barcodeEntry`), `settingsMetadata` (בוליאנים ואפשרויות בחירה משני הצדדים).
- **`lib/schedule/loaders.js`**: מיפוי `barcodeInfo` לפי אינדקס פריט נעשה **לפני** `sortItemViews` של prep-pages (המיון משנה את סדר `row.items`; אחרת הברקוד היה מוצמד לפריט שגוי).
- **#276 והחלון החדש:** `RentalReturnModal` הישן עדיין בשימוש במעטפת הישנה (PopupProvider כש-`shell!=='a5'`, `/orders`, `/rentals`, הלוח) והחלון החדש `RentalReturnWindow` (a5) חולק איתו את אותו hook (`useRentalReturn`) - לכן תיקוני O9/O12 שבהוק ובשרת חלים על שניהם. מה שחי בתצוגה בלבד הותאם לחלון החדש: באנר "N פריטים נרשם להם ברקוד בהכנה וטרם נמסרו - אשר מסירה" (`preppedCount`), והסתרת שבב "ממתין לאישור השכרה" לפריט שנרשם בהכנה (הכיתוב "ברקוד נרשם בהכנה – טרם נמסר" מגיע מ-`getItemStatus` המשותף). 409 של `postRent` (rentalToggle) משותף.
- שדה הסריקה בלו"ז (`#scanIn` ב-`StageRail`, #276 + autofill): ללא קונפליקט (ענף schedule-barcode לא נגע בקובץ); שדה הברקוד ב-`BarcodeDialog` החדש קיבל `useNoFill` (בדיקת `test_email_autofill_guard` דורשת).
- הערת lint קיימת: `components/modern/ChangesChips.js` (4 שגיאות react-hooks) קיימת גם לפני המיזוג.

## 16. feature/quick-barcode-flow-2026-10-12
הענף נבנה לפני #276, ולכן את `RentalReturnModal` בלבד. **החלון בשימוש במעטפת החדשה הוא `RentalReturnWindow`** (a5), והחלון הישן נשאר במעטפת הישנה / `/orders` / `/rentals` / לוח. שניהם חולקים את `useRentalReturn`, שבו כל ההתנהגות של הענף (`processBarcode`: החזרה אם הפריט אצל הלקוחה, השכרה אם יש שורה שמחכה לו, אחרת `resolveBarcode` -> מעבר להזמנה אחרת / הודעה; `initialBarcode`, `onSwitchOrder`, `onItemReturned`, `scanNotice`, אירוע `gemach:item-returned`) - לכן נדרש רק חיווט הממשק של החלון החדש, בלי כפל לוגיקה:
- `RentalReturnA5` (עטיפת החלון החדש) קיבלה את אותו חוזה כמו המודל הישן: `initialBarcode`, הרכבה מחדש בהחלפת הזמנה (`key = orderId:seq`), `onItemReturned`; `RentalReturnInner` מעביר את הפרמטרים ל-hook ומציג את שורת ההודעות (`#rrmScanNotice`, שבב ירוק/אדום/אפור) מתחת לשדה הסריקה (CSS `.bd-sn`).
- `PopupProvider`: `openRentalModal(orderId, { barcode })` ו-`initialBarcode` עוברים לשני החלונות (a5 / ישן). `MenuSearchPanel` (חיפוש מהיר במעטפת החדשה) קורא ל-`popup.openRentalModal` - ולכן פותח את החלון החדש עם `initialBarcode`.
- התראת החזרה לסניף אחר / רזרבה (branches): `POST /api/returns/scan` מחזיר `branchAdvices` (`buildReturnAdvices`) וה-host שעוטף `fetch` מציג את החלון בשני החלונות (כולם עוברים דרך `postReturnScan`); ב-`RentalReturnWindow`, Escape כשההתראה פתוחה סוגר רק אותה.
- קונפליקטים: `returns/scan/route.js` (שורת הייבוא: `buildReturnAdvices` של branches + `diagnoseUnrentedBarcode` של הענף; `getHebrewDateString` כבר לא בשימוש בנתיב), `settingsMetadata` (שם / הסבר / קבוצת "ברקודים" / בוליאני - של schedule-barcode וגם `quick_search_barcode_opens_rental`).
- תיקוני בדיקות: `test_settings_sim` (המפתח `quick_search_barcode_opens_rental` מופה בסעיף "סריקה" + `KEY_UI`), `test_board_page` (חתימת הקריאה ל-`useRentalReturn` במודל הישן).
- בדיקה חדשה: `scripts/test_rental_return_window_wiring.mjs` (9 בדיקות סטטיות: החוזה של שני החלונות, PopupProvider, החיפוש המהיר, O9 בחלון החדש, התראת הסניף, ההגדרה).
- לא נבדק בדפדפן: הרכבה מחדש של החלון בהחלפת הזמנה (key remount) ושורת ההודעות.
