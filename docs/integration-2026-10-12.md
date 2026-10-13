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

## 17. feature/main-search-capacity-2026-10-12 (+ patch 04)
- `MenuSearchPanel.js`: שני הצדדים נשמרו - מצב `pick` של quick-barcode (בחירת הזמנה לפריט פנוי) ופאנל התפוסה/פריט (`SearchPanel` + `panelTerm` בדיבאונס). Enter נשאר אצל הזרימה (החזרה/השכרה מהירה), הפאנל הוא תצוגה מקדימה מתחת לשדה. ה-placeholder "הקלד ברקוד או חפש..." מ-quick-barcode נשמר (גם ב-`HomeA5`).
- `lib/homeSearchInventory.js`: **שינוי (model-numbers: `modelDisplayName`) מול מחיקה (הענף מסיר את שורות "מלאי" הישנות מהחיפוש הראשי, הפאנל מחליף אותן)** => נמחק. אין לו צרכנים אחרים (`lib/globalSearch.js` בענף כבר לא מייבא אותו; `test_global_search_server` עודכן בענף). כלל השם "אמיתי אחרת מספר" חל על הפאנל דרך patch 04.
- **patch 04** חל נקי (`SearchPanel.js`, `lib/searchPanel.js`, `lib/searchPanelCore.js`): לא "ללא שם" בכותרות, ברשימת הדגמים התואמים ובפאנל; שם רק כשהוא תיאורי אמיתי (`modelHasRealName`).
- הרצה: אפס כשלים חדשים.

## 18. feature/neve-new-ui-default-2026-10-12
- נמזג בלי קונפליקט קוד (גרסה/package בלבד); `scripts/test_page_variant_switch.mjs` נמזג אוטומטית.
- תיקוני בדיקות: `test_home_css_guard` - הכלל `.topbar:has(.gm-pvt-return-topbar)` (עטיפת כותרת הישנה במובייל, בשביל לחצן "חזרה לממשק החדש") הוסף כחריג מתועד להיקף `.gm-pvt`; `business-days-tests/return-dates` - אתר הקריאה של מייל אישור ההזמנה עבר מ-`app/api/orders/route.js` ל-`lib/orderConfirmationMail.js` (מרכז המיילים).
- ה-seed (`seed_neve_new_ui_default.js`, נווה בלבד) לא הורץ; פקודות מדויקות ב-`docs/deploy-runbook-2026-10-12.md`.

## תוספות בשלב ב' לסקריפטים (לא הורצו)
- `scripts/apply_pending_ddl.js` (חדש): החלת `StationEvent` / `AuthThrottle` (רשימה סגורה, dry-run כברירת מחדל, `--apply --expect-host`).
- `scripts/seed_kiosk_public_settings.js`: נווה נוצר עכשיו `false` (החלטת הרכז: הקישור הציבורי נשאר כבוי); קודם `true`.
- `scripts/clean_placeholder_model_names.js`: `--apply` דורש `--backup-file=<json חדש>`; חדש `clean_placeholder_model_names_rollback.js`; בדיקה `test_model_name_cleanup_backup.mjs`.

## תוצאות שלב ב' (ריצה מלאה אחרונה: 142 משימות, כולל `business-days-tests`)
- **15 כשלים - כולם הכשלים הקיימים שבטבלה שלמעלה** (בדיוק אותה רשימה והחתימות הפנימיות שלהם כמו ב-`origin/main`): `cpu-phase1b` (2), `customer-card-tests/run`, `order-card-tests/run`, `order-events`, `pdf-tests/server-pdf`, `schedule-tests/run`, `test_ai_employees_live`, `test_ai_sql_table_policy` (`AuthThrottle` חסר), `test_attendance_summary`, `test_customer_completeness_db`, `test_customer_inline_edit`, `test_punch_clock_logic`, `test_scrub_logged_secrets_db`, `test_search_lists_ui_static`. אפס כשלים חדשים. (`logo-measure-tests/cpu-timing` נכשל פעם אחת תחת עומס בריצה אחת - ידוע כ-flaky.)
- eslint: אפס שגיאות חדשות בכל 178 הקבצים ששונו מאז סוף שלב א' (נשארו 3 שגיאות קיימות: `AppShell.js` "This value cannot be modified", `ChangesChips.js` x2 - קיימות גם לפני המיזוגים).
- `prisma validate` עבר; `prisma migrate diff` (סכמת `origin/main` → סכמה סופית) = בדיוק ה-DDL של `DressItem` + `CustomerConsent` + `StationEvent` (ר' runbook).
- **לא נבדק:** `next build`, דפדפן ו-RTL ויזואלי (כולל הרכבה מחדש של חלון "השכרה והחזרה" בהחלפת הזמנה, באנר "אשר מסירה", שורת ההודעות), ושום DB/ DDL/ seed.

## שאלות פתוחות לרכז (שלב ב')
1. `lib/ai/sqlTablePolicy.js`: להוסיף `AuthThrottle` ל-`ALL_TABLES`/`NEVER_TABLES` (כשל קיים מ-#273; שורה אחת).
2. `seed_barcode_entry_settings.js --profile=neve` מדליק את הברקוד בלו"ז בנווה (ב4 ב-runbook) - האם בלילה הזה או רק `off`?
3. הניקויים בנווה (ג1/ג2) - להריץ בלילה? ללא `--include-obligations` אלא אם יתבקש.
4. בתצוגת כרטיס ה-PDF/מייל: שדה "כתובת" קבוע במרכז המיילים גובר על `gmach_pickup_address` בטקסט (הקישור נשאר נגזר מהכתובת הייעודית) - אם לא רצוי, להסיר את השדה הקבוע בנווה.


---

# שלב ג' (מיזוג מדריך האתר של ה-AI, רישום כל החדש, סוויטות, build)

## 19. feature/ai-site-guide-2026-10-12
- הענף נבנה על בסיס ישן (2519d009, לפני #273-#276 ולפני כל ענפי שלבים א'-ב'), ולכן נוגע ב-204 קבצים. קונפליקטים: `app/version.json` / `package.json` (צד integrate; נוסף חזרה רק הסקריפט `test:ai-guide`), `CHANGELOG.md` (שני הצדדים), `app/api/ai/route.js` ו-`statistics/route.js`, `scripts/test_ai_barcode.mjs`, `app/customer-interface/page.js`, ו-12 קבצי רכיבים.
- **קבצי רכיבים (backups, DcParts, MnSteps, EcMail, EmployeeCardA5, MenuSearchPanel, StepCustomer/Delivery/Payment, OcItemsTab):** הענף כתב מחדש שורות שלמות בשדות שבהם `main` החליף `name="x-nofill" autoComplete="off" {...NO_FILL}` ב-`{...nf('x')}` (הגנת ההשלמה האוטומטית, `useNoFill`). נשמר הקוד של `main` והתווספו מעליו רק מאפייני `data-guide-id`. חלק מהקבצים שמרו CRLF ב-`main` והענף המיר ל-LF, ולכן מוזגו מחדש עם נרמול סיומות שורה (אין קבצים עם סיומות מעורבות).
- `app/api/ai/route.js` + `statistics/route.js`: זרימת `answerSiteQuestion` של הענף, אבל קטלוג ההגדרות שמועבר אליה מסונן לפי הרמה של הקורא (`settingsRowsForTier(... getSettingsViewerTier())`, תיקון האבטחה של ענף 1) - מנהל סניף לא מקבל מפתחות "ניהול בלבד". `app/customer-interface/page.js`: נשאר `KioskSwitch` (הדף הישן הוחלף ב-`LegacyKioskPage`); סימוני העמדה הועברו ל-`KioskA5.js`.

## רישום כל מה שחדש במדריך ה-AI (`lib/aiGuide/`)
הבדיקה `npm run test:ai-guide` נכשלה כמתוכנן על כל פריט שלא נרשם; עכשיו ירוקה (1048 יעדים, 77 דפים, 154 משימות).
- **דפים:** `/admin/email-center`, `/admin/branches`, `/station-analytics`, `/privacy`, `/terms`, `/station` (מוצג רק כשההגדרה `kiosk_public_link_enabled` דלוקה - העוזר לא יפנה אליו לפני כן).
- **יעדי הצבעה חדשים (עם `data-guide-id` בקוד):** מרכז המיילים (`emc.*`: לשוניות, רשימה, עורך, נתונים קבועים, דיוורים, בדיקה ויומן), ניהול סניפים (`brn.*`), המרות בעמדה (`sa.*`), כלי ניהול `hub.branches` / `hub.email-center` / `hub.station-analytics`, פריט התפריט `menu.ad-station`, שורת הסריקה בלוז (`sched.scan`), גלגל "הגדרות תהליכים" והחלון שלו (`sched.settings*`), חלונית הברקוד בלוז (`sched.bc-*`), פאנל התפוסה ו"איפה אני?" (`srch.panel*`), "העברה מהירה" בכרטיס הדגם ובחלונית (`dc.quick-transfer`, `qt.*`), העלאת קובץ התקנון והקישורים בהגדרות (`set.terms-*`, `set.branches-link`, `set.schedule-link`, `set.emailcenter-link`), לחצן "חזרה לממשק החדש" (`disp.return-new`), ועמדת הלקוח החדשה בת שלושה שלבים (`kiosk.*` - הרישום הישן תיאר את העמדה הישנה בשני שלבים והוחלף).
- **משימות "איך עושים" חדשות:** עריכת מייל, נתונים קבועים, שליחת דיוור, הפעלת ריבוי סניפים, צפייה בהמרות בעמדה, סריקה בלוז, ברקוד בהכנה/איסוף/משלוח, הגדרות תהליכים בלוז, פאנל תפוסה בחיפוש, חזרה לממשק החדש, איפה הלקוחה רואה תקנון ופרטיות, העלאת תקנון, הסכמות מפורשות, משלוח משותף, כתובת איסוף ומשלוח כשורת פריט, מסנן בורר הלקוחות, פתיחת הקישור הציבורי לעמדה, העברה מהירה של ברקודים. עודכנו גם משימות ההגדרות הקיימות והחיפוש המהיר (ברקוד והשכרה מהירה).
- **תיקון רישום שהתיישן בגלל האינטגרציה:** מיילים אוטומטיים חזרו ללשונית "אוטומציה" בהגדרות (בענף הרישום הם תוארו תחת "הודעות") - עודכנו תיאורי הלשוניות והמשימה `task.settings-emails`.
- בדיקה: `scripts/test_ai_site_guide.mjs` - נוספו שלושת הנתיבים החדשים לרשימת `OPS_ROUTES` (סינון `--area` בלבד).
- `lib/ai/sqlTablePolicy.js`: `AuthThrottle` (#273) נוסף ל-`ALL_TABLES` ול-`NEVER_TABLES` (כתובות IP ונעילות - אבטחה); `test_ai_sql_table_policy` ירוק (כשל קיים שנסגר).

## בדיקות שנשברו בגלל הסימונים (תוקנו)
הענף הוסיף `data-guide-id` למאות אלמנטים בלי להריץ את הבדיקות שנועלות טקסט מקור. נשברו 8 קבצים (כ-20 בדיקות): `order-card-tests` (items.static, owner-feedback-2026-10-05, stepper, tooltips), `test_board_page`, `test_non_working_days_page`, `test_home_css_guard`, `customer-card-tests` (7). הפתרון: הבדיקות מסירות מאפייני `data-guide-id` לפני ההשוואה לטקסט המקור (הסימונים אינם חלק מההתנהגות שנעולה), ובשני מקומות הוזז המאפיין בקוד (`OcItemsTab.js` - `guide=` אחרי `id`; `CcTopbar.js`). שום בדיקה לא הושבתה או נמחקה.

## תוצאות שלב ג'
- **סוויטות (144 משימות)** ב-`Asia/Jerusalem`, `UTC` ו-`America/New_York`: אפס כשלים חדשים. נשארו רק הכשלים הקיימים שבטבלה למעלה (חתימות פנימיות זהות לריצת שלב ב'), וכן: `test_ai_site_guide` נכשל בסקריפט ההרצה הגורף בלבד (כותרת הקובץ מכילה `--no-warnings` לפני `--import`) - ירוק בפקודה הנכונה `npm run test:ai-guide` בשלושת אזורי הזמן; `test_create_log_indexes` ו-`test_scrub_logged_secrets_db` מדלגים/נכשלים רק כשיש כתובת TEST מדומה (בדיקות מול מסד).
- **eslint** על 663 הקבצים ששונו מול `origin/main`: 11 שגיאות, כולן קיימות גם ב-`origin/main` (AppShell, AttendanceWizard, LegacyOrderPage x2, ChangesChips x2, OrderModelSelector x3, settingsCache x2) - אפס חדשות.
- **`prisma validate` + `prisma generate`:** עברו (עותק מקומי של `@prisma`, כתובת מסד מדומה).
- **`npm run build`** (`prisma generate && next build --webpack`): ירוק, 93 שניות, `.next` 1.1GB (נמחק). אזהרה קיימת: `@prisma/local-client` (הלקוח הלא-מקוון האופציונלי) ב-`app/lib/prisma.js`. נתיבי `/admin/email-center`, `/admin/branches`, `/station`, `/station-analytics`, `/privacy`, `/terms` נבנו.
- **PINNED_BLOBS** ב-`scripts/test_page_variant_switch.mjs`: חושבו מחדש (`git hash-object`), ללא שינוי - הקבצים הנעולים (`LegacyProfilePage.js`, `LegacyNewOrderPage.js`) לא שונו במיזוג; הבדיקה ירוקה (36).
- **Ignored Build Step:** הקומיט האחרון נושא `[force-deploy]` ולכן נבנה בכל מקרה; ראו הקומיט האחרון בענף.

---

# תיקוני סקירת האבטחה העצמאית (על `dba61a98`) - שלב ג'

| ממצא | תיקון | commit |
|---|---|---|
| 2 - רישום בעמדה נפתח לאינטרנט כש-`kiosk_customer_self_service` דלוק | ערוץ `kiosk` דורש עוגיית עובד תקפה (`getSessionEmployee`) **וגם** ההגדרה; ערוץ ציבורי רק עם `showRegistration` (כולל `linkEnabled`) | `57f463df` |
| 14 - לוג עם `e.message` בראוטים ציבוריים | נרשם רק `e.code` / `e.name`; בדיקה סטטית | `57f463df`, `064f61d5`, `a7ec5a15` |
| 4 - `email_campaign:*` (וגם `email_tpl:*`, `email_fixed_fields`) ב-`GET /api/settings` | מסמכי דיוור יוצאים מהמטמון ומהרשימה (סינון בקוד אחרי השליפה); שאר מפתחות המרכז מוסתרים מעובד רגיל (`isAdminOnlySettingKey`) ונשארים לשרת | `4f636c9d`, `67f13905` |
| 5 - תשובת מדריך האתר ללא אימות תגיות; `[OPEN_LINK]` בלקוח | `finalizeTagsAndText` גם במדריך; `extractSafeOpenLinks` (route פנימי בלבד) | `80f046b4` |
| 6 - יעדי `set.key-*` הדינמיים בלי הרשאה | `access: { gate: 'head' }`; בדיקה שעובדת רגילה ומנהלת סניף לא מקבלות צעד | `20f23892` |
| 9 - `ui_variant_kiosk`, `kiosk_splash_screen` | נוספו ל-`PUBLIC_SETTING_KEYS`; `SESSION_BOUND` עודכן | `0ae51ba1` |
| 27 - `rentals/scan` `forceOk` משנה התנהגות בראשי | ההקשחה רק כשברקוד בלו"ז דלוק להזמנה; כבוי = `origin/main`; בדיקות לשני המצבים | `e4c9fa71` |
| 21 - `EMAIL_DRY_RUN` בפרודקשן | מתעלמים כש-`VERCEL_ENV=production` (`isDryRun`) | `423462fd` |
| 3 - כתיבת התקדמות דיוור דורסת ביטול | `persistProgress` - compare-and-swap, איחוד התקדמות אל מסמך מבוטל, גם ב-`done` | `ebcd3ad3` |
| 7 - מכסה יומית | רזרבה 25 (`sendBudget`, `QUOTA_RESERVE`) | `ebcd3ad3` |
| 8 - דיוור כפול | דיוור זהה של אותו יוצר תוך 10 דקות נדחה | `ebcd3ad3` |
| 10 - הסרה מדיוור בלי ראיה | שורת `marketing granted:false` ביומן (`email-unsubscribe`), בנפילה חינני | `eece7bb6` |

לא תוקנו (מתועדים ב-`docs/post-release-followups-2026-10-12.md`): 11, 12, 13, 15, 16, 17, 18, 19, 20, 22, 23, 24, 25, 26.

**דרכי בדיקה:** סוויטות מלאות (145 משימות) בשלושת אזורי הזמן: אפס כשלים חדשים (נשארו הכשלים הקיימים); `eslint` על 664 קבצים: אותן 11 שגיאות קיימות; `prisma validate` עבר; `npm run build` ירוק (71 שניות; `.next` נמחק); `PINNED_BLOBS` ללא שינוי (קבצי ה-Legacy לא נגעו).
