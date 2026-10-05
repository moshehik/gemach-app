# דיווחי נווה יעקב - סבב 5.10.2026: ביקורת, תיקונים, הגדרות והעיצוב החדש

נכתב ב-2026-10-05 אחרי מעבר על כל 71 הדיווחים הפתוחים של נווה יעקב (org 2). **נווה עדיין על העיצוב הישן** (`ui_variant_shell=legacy`, `ui_variant_home=legacy`, כרטיס הזמנה/לקוח/הזמנה חדשה - ישן), ולכן כל דיווח נבדק מול נתיב הקוד הישן.
פרוטוקול התגובות: [fix-protocol-error-reports.md](fix-protocol-error-reports.md). השאלות שנשלחות לצוות נווה: `neve-questions-for-email-2026-10-05.md` (מחוץ לריפו, בתיקיית הפרויקט).

## 1. מצב ההעלאה

- ענף האיחוד: **`fix/neve-yesterday-reports-2026-10-05`** = `origin/main` 69c2cf8a (אצווה 5B) + כל התיקונים למטה. **לא נדחף ולא נפרס** נכון לכתיבת המסמך - מחכה לאישור הבעלים.
- כל קוד שיושב ב-`app/orders/new/page.js` עבר ל-`app/orders/new/LegacyNewOrderPage.js` (העטיפה `NewOrderSwitch` נכנסה ל-main באצווה 5B). ה-hash של הקובץ ננעל ב-`scripts/test_page_variant_switch.mjs` (`PINNED_BLOBS`) - **כל עריכה נוספת בו מחייבת עדכון מודע של ה-hash**.
- כרטיס ההזמנה: `app/orders/[id]/page.js` עדיין הקוד הישן ב-main. ענף `feature/order-card-a5` (של הסשן המקביל, לא נדחף) הופך אותו לעטיפה ומעביר את הישן ל-`LegacyOrderPage.js`. **לפני שהוא נכנס, צריך להעביר ידנית את ההאנקים של התיקונים לקובץ הישן** (ר' סעיף 6) - אחרת הם נעלמים בשקט. ענף העזר `fix/neve-a5-ordercard-2026-10-05` כבר עושה זאת (לא מיועד להיכנס לפני כרטיס ההזמנה עצמו).
- ההגדרות (סעיף 3) כבר נכתבו ל-DB של שני הגמחים (נבדק ב-dry-run חוזר: 0 שינויים). הקוד החי לא קורא אותן עדיין, ולכן הכתיבה לא שינתה שום התנהגות.

## 2. תיקונים שנכנסו לענף (לפי דיווח)

| דיווח | מה השתנה | איפה | מתג הגדרה |
|---|---|---|---|
| 884f29ae, b1a91c78, 455ffa6e | השכרה/החזרה בברקוד נשמרות מיד ב-`/api/rentals/toggle` - לכן כבר לא מסומנות "שינוי שלא נשמר" (בלי ת"ז/אישור/סיכום/הדפסה ביציאה) | `app/orders/[id]/page.js` (`onItemsChange(val, opts)` + `persisted` שמעדכן גם את `savedSnapshotRef`), `ModernItemsManager.js` | - |
| b1a91c78, ef1be7fd | אישור מנהל על הזמנה עם חוב - פעם אחת לכל כניסה לכרטיס (ref שמתאפס בהחלפת הזמנה; האישור הראשון תמיד מאומת) | `ModernItemsManager.js` | `unpaid_action_approval_once_per_visit` (ברירת מחדל כבוי) |
| 6244b29b | כפתור "עריכת הזמנה" בכל שורה ב-`/rentals` | `app/rentals/page.js` | - |
| b58303e9 | שוליים תחתונים 15 מ"מ בהדפסת הזמנה ("עמוד X מתוך Y" נחתך בשול הלא-מודפס) | `app/print/order/page.js` | - |
| 27f278c7 | הדפסה נקייה ללקוחה (החזרת השמלות, הערות פעם אחת, בלי כתובת/"לכבוד"/"בוצעה ב", בלי טבלת תשלומים) | `app/print/order/page.js` | `print_order_clean_layout` (כבוי) |
| f52ab4f4, cabe10ef | בחירת גופן ב-/display-settings עובדת: `design-overrides.css` כפה Assistant/Frank Ruhl עם !important; עכשיו רק כש-`data-font` לא מוגדר. נוסף David לשש מחסניות סריפיות | `app/design-overrides.css`, `app/design-system.css` | - |
| 8e647af8 | הוסרו הטאבים "השכרות\|החזרות" בתוך /rentals (החזרות רק מהתפריט) | `app/rentals/page.js` | - |
| 5c5b2b1c, 9a94421f | חיתוך היסטוריית AI ל-10 הודעות גם בשרת | `app/api/ai/route.js` | - |
| 4df369cb | הוסר משפט הסריקה מכרטיס ההזמנה | `ModernOrderCard.js` | - |
| 139f6a15, 24380f79 | אייקונים עגולים בכרטיסי משלוח/תשלום ידני/תאריך ביצוע; כותרת "משלוח" באותו סגנון כמו אחיותיה | `ModernGeneralDetails.js` | - |
| f559c61b, af7170ce, 79c5130b | הכפתור הגנרי "הוסף חיוב" מוסתר כש-`consolidate_manual_payment_credit_ui=true`; אפשרות שלישית "הוספת חיוב ידני" בבורר, עם אותו קוד מאשר (`feature:manual_payment_credit_add`) | `ModernPaymentsManager.js`, `ModernGeneralDetails.js`, `app/orders/[id]/page.js` | משתמש בקיים |
| 51f2cc56 | הסתרת "הערה לתשלום" בהזמנה חדשה | `LegacyNewOrderPage.js` | `hide_order_payment_note` (כבוי) |
| 60d5cb50 | עמוד הסיכום בלי גלילה פנימית | `LegacyNewOrderPage.js` | - |
| a2e3f590 | "טוען מידות…" במקום "אין מידות זמינות" בזמן טעינה | `LegacyNewOrderPage.js` | - |
| 1cbaf995, fdce699f | הסתרת לשוניות "חו״ל / תפוסה ארוכה" (גם בכרטיס הזמנה קיימת, אלא אם ההזמנה כבר חו"ל) | `LegacyNewOrderPage.js`, `ModernGeneralDetails.js` | `allow_abroad_long_stay_orders` (ברירת מחדל דלוק) |
| ac8afab7, 1913c29a, caab5f84 | כפתור "הוסף/עריכת משלוח" בשלבים 3-5 (חלונית עם אותם שדות משלוח של שלב 2) + שורת חיוב משלוח בסכומים | `LegacyNewOrderPage.js` | `enable_deliveries` הקיים |
| 06467870, 3a4d36df | חיוב משלוח לפי עיר הלקוחה כשאין `deliveryCity` בהזמנה (שרת, אחד לכל הממשקים; תצוגה מקדימה זהה) | `lib/pricingCalc.js` (`resolveEffectiveDeliveryCity`), `lib/pricingEngine.js`, `preview-pricing`/`calculate` | - |
| 749aaf87 | חלונית האיחורים: סף ימים ושעה נפרדים (נווה: 0 ו-14:00) בלי לגעת בכלל האיחור הכללי | `lib/overduePopup.js`, `app/api/orders/overdue/route.js` | `overdue_popup_threshold_days`, `overdue_popup_after_hour` |
| 87ba8e3d (מניעה) | יבוא Access לא דורס יותר את המחירון בנווה | `scripts/import_from_access.js` | `--skip-pricelist` / `SKIP_PRICELIST=1`, ברירת מחדל לנווה |

## 3. הגדרות חדשות (נכתבו ל-DB ב-5.10.2026)

| מפתח | ראשי (org 1) | נווה (org 2) |
|---|---|---|
| `hide_order_payment_note` | false | true |
| `print_order_clean_layout` | false | true |
| `allow_abroad_long_stay_orders` | true | **false** (אין אצלם חו"ל/תפוסה ארוכה) |
| `unpaid_action_approval_once_per_visit` | false | true |
| `overdue_popup_threshold_days` | (לא קיים - ללא שינוי) | 0 |
| `overdue_popup_after_hour` | (לא קיים - ללא שינוי) | 14 |

סקריפטים (כולם dry-run כברירת מחדל, בדיקת host, `--org` חובה): `scripts/seed_neve_2026_10_05_all_settings.js`, `scripts/seed_overdue_popup_settings.js`. הרשאות אישיות: `scripts/grant-employee-permission.js` (אותו נתיב כתיבה כמו כרטיס העובד).
**חשוב:** נתוני נווה שנכתבו ישירות ל-DB עלולים להיעלם בהחלפת DB - ר' `neve-yaakov-db-cutover-silent-data-loss` בזיכרון הפרויקט. לאמת מול ה-DB הנוכחי.

## 4. החלטות הבעלים (5.10.2026) - לפי ההמלצות

1. מחירון: להזין מחדש דרך המסך + יבוא Access לא נוגע בו (בוצע בקוד). **מצב ב-DB של נווה כרגע:** 60/120/180, החזר 30/60/90 (עודכן 16.9 בשעה 18:54, אחרי התלונה).
2. אישור מנהל פעם אחת לכל ביקור - מוכן, מאחורי מתג.
3. מזומן בהזמנה קיימת: מסתירים רק "הוסף חיוב"; קוד מאשר נשאר; כרטיס אשראי נשאר.
4. משלוח בלי עיר: חיוב לפי עיר הלקוחה (שרת). **שלוש הזמנות אחרונות ללא חיוב:** 53314, 53376, 53385 - לבדוק עם הצוות אם נגבה (מצורף לשאלות).
5. החלפת מידה בין קבוצות מחיר - ללא שינוי (הבעלים יברר מדיניות). מידות מעורבות ("08" מול "8"): נבדק, ראו סעיף 7.
6. כפתור "הוסף משלוח" ו-7. הסתרת חו"ל - נבנו. 12. כלל איחור - אפשרות ב' (חלונית בלבד).
8-11, 13: מחכים לתשובת הצוות (סקיצות/הבהרות).
בנוסף: הגופן **לא** מוחלף בעיצוב החדש (החלטת הבעלים) - מסכי a5 נשארים על Rubik.

## 5. מה נשאר פתוח

- **ממתינים לתשובת הצוות** (ר' קובץ השאלות): עמדת לקוחות (צילום אבוד), "הדגמים האחרונים", הסתרת לקוחות מעובדות, השבתת עובדים (רשימת 82 פעילים מצורפת - לא מבצעים לפי שמות כתובים), ממוצע שנתי, איקון משלוח ברשימה, רשימת "מושכר שצריך לחזור" כטבלה, מאשרות.
- **לא נבנה:** איקון משלוח ברשימת ההזמנות (4e07692c - סקיצה בהמתנה), פיצול כרטיס משלוח/סניף (b433b691 - סקיצה בהמתנה), ממוצע שנתי (8dab5896), "יציאה אחרי שמירה" (ebf2e202; ענף ישן `feature/order-card-redesign-neve-2026-09-24` לא מתאים למיזוג).
- **תשלום מזומן בהזמנה קיימת:** אין אכיפה בשרת (`/api/payments` בודק רק התחברות). רק `fix/server-approval-hardening-2026-10-05` (ענף גדול של הסשן המקביל) כולל זאת.
- **הרשאת ייצוא (0466a20d):** אהובה פינקל כבר `roleId 0` (הנהלה ראשית) = מורשית אוטומטית לכל הרשאה בוליאנית, ולכן לא הוענקה הרשאה. כנראה נדרש רק להזין **את הסיסמה שלה** בחלון "הסיסמה של מנהל" (או שנכנסה עם משתמש אחר).

## 6. העיצוב החדש (a5) - מה נכלל, מה לא רלוונטי

פירוט מלא: `audit-newdesign.md`, `audit-a5-neworder.md`, `audit-a5-ordercard.md` (בתיקיית הסקראץ' של הסשן).

| נושא | אשף הזמנה חדשה (a5, על main) | כרטיס הזמנה (a5, `feature/order-card-a5`) |
|---|---|---|
| השכרה בברקוד לא "מלוכלכת" | n/a | כבר תקין (`syncItems` מעדכן גם snapshot); **צריך להעביר ל-LegacyOrderPage.js** |
| אישור מנהל פעם אחת | n/a | לא רלוונטי: ב-a5 הוסר לגמרי אישור חוב בסריקה (החלטת בעלים R31) |
| "הערה לתשלום" | הועבר (`StepPayment.js`, מתג) | n/a |
| לשוניות חו"ל | הועבר (`StepDates.js` + בקר) | הועבר (כפתור "חו״ל" ב-`OcDetailsTab.js`) |
| כפתור משלוח + שורת חיוב | הועבר (`NoDeliveryBits.js`; כפתור קופץ לשלב המשלוח וחוזר) | כבר קיים (`OcDeliveryTab`) |
| עיר הלקוחה למשלוח | הועבר (`customerCity` ב-calculate) | כבר תקין (preview-pricing בשרת) |
| גלילה בסיכום / "טוען מידות" | כבר תקין | n/a |
| "הוסף חיוב" גנרי / אייקונים / כותרת משלוח / משפט סריקה | n/a | לא רלוונטי (אין ב-a5) |
| הדפסה, חלונית איחורים, rentals, API של AI | משותף - אין עבודה נוספת | משותף |
| גופן | **לא מחליפים** (החלטת בעלים) | **לא מחליפים** |

## 7. מידות מעורבות ("08" מול "8")

נבדק בנתוני נווה (קריאה בלבד, 5.10.2026): במלאי 1,408 מידות עם אפס מוביל ו-42 עם רווח; בהזמנות עתידיות (1,377 פריטים) **אפס** חוסר-התאמה - כל פריט הזמנה תואם מחרוזת מידה לשורת מלאי של אותו דגם. נשארו **24 צירופי דגם+מידה** שבהם המלאי עצמו כתוב בשני אופנים (למשל דגמים 423, 425: "06"/"6"; דגמים 607, 608, 610: מידה עם רווח). `normalizeSizeKey` משמש רק את דף בדיקת המלאי, לא את חישוב הזמינות (`lib/inventory.js`) - שם קיים סיכון תיאורטי לפיצול. **הבעלים יברר; לא שונה.**

## 8. בדיקות

- עוברות: `test_page_variant_switch` (31), `test_new_order_money` (18), `test_settings_sim` (43), `test_ui_variant` (48), `scripts/new-order-tests/run.mjs` (כל האזורים), `test_delivery_city_fallback` (15), `overdue-popup.test.mjs` (8).
- נכשלת **ולא קשורה לעבודה הזו** (ללא נגיעה ב-`app/board`): `test_board_page` BD-O1/F13 - "LegacyBoardPage.js שונה מהבלוב ב-main". אצל הסשן המקביל.
- **לא נבדק בדפדפן**: כפתורי המשלוח, חלון המשלוח, הדפסה נקייה, בחירת גופן, מעבר "פעם אחת לביקור".

## 9. בדיקות ידניות לפני פרודקשן (נווה + ראשי)

1. הזמנה קיימת עם חוב: סריקה/השכרה/החזרה של כמה שמלות (נווה: קוד מאשר פעם אחת; ראשי: בכל פעם). אחרי סריקה - יציאה בלי חלונות.
2. הדפסת הזמנה: מספור העמודים בתוך הדף; נווה - ללא כתובת/"לכבוד"; ראשי - כמו קודם.
3. `/rentals`: כפתור "עריכת הזמנה"; בלי טאבים פנימיים; "החזרות" מהתפריט.
4. הזמנה חדשה (נווה): בלי "הערה לתשלום", בלי לשוניות חו"ל; כפתור "הוסף משלוח" בשלבים 3-5; שורת חיוב משלוח. (ראשי: הכול כמו קודם.)
5. הגדרות תצוגה: בחירת גופן משנה את האתר; משתמש בלי בחירה - ללא שינוי.
6. כרטיס הזמנה: אין "הוסף חיוב" גנרי בנווה; "הוספת חיוב ידני" דורש קוד מאשר.
7. הזמנה עם משלוח ועיר לקוחה ברשימה (בלי עיר בהזמנה): נוצר חיוב משלוח אחרי שמירה.
8. חלונית איחורים: לפני 14:00 אין משפחות של אתמול; אחרי 14:00 כן.

## 10. סדר עלייה מומלץ

1. בדיקה בתצוגה מקדימה (הקוד כותב לנתוני אמת - ר' fix-reports.md).
2. מיזוג ל-main של ענף האיחוד (קודם: `git fetch`, לוודא ש-main לא זז, למזג את main לענף).
3. הסשן המקביל: מיזוג main לענף כרטיס ההזמנה והעברת ההאנקים של `app/orders/[id]/page.js` ל-`LegacyOrderPage.js`.
4. אחרי העלייה: מעבר על שרשורי הדיווחים וסימון ARCHIVED רק לפי אישור הצוות.
5. אם יש שינוי נוסף ב-`LegacyNewOrderPage.js` - לעדכן את `PINNED_BLOBS`.

## נספח - טבלאות הביקורת (מצב ב-main 0.1.537, לפני התיקונים)

### א. אשף הזמנה חדשה
| id8 | verdict | one-line |
|---|---|---|
| 1cbaf995 | FIXED-LIVE (summary row) / NEEDS-OWNER-DECISION (pills) | סוג אירוע row removed Sep 9; the pills in step 2 remain, user re-complained = wants them gone |
| 9c255b8e | FIXED-LIVE | סוג אירוע row + "מידה" word gone; "כיוון רגיל לפי המערכת" = default spacing row hidden in 536c8c3e; agent misread it as delivery direction |
| 5e0b2f17 | FIXED-LIVE | items-card duplicate "עריכה" removed (1a823348); agent replies contradict each other |
| a2e3f590 | NEEDS-OWNER-DECISION | cannot reproduce; wizard auto-shows size pills; "recent models list" the agent mentions does not exist; maybe loading-state wording |
| 60d5cb50 | STILL-BROKEN | inner scroll box `maxHeight:42vh` at page.js:2440 in summary; S fix |
| 51f2cc56 | STILL-BROKEN | owner-confirmed removal of "הערה לתשלום" NOT implemented in any branch (page.js:2498); agent's "ready, awaiting deploy" is false |
| e33096a4 | FIXED-LIVE | "שלב X מתוך 5" line removed (5180ee71) |
| ee6dfea7 | FIXED-LIVE | stepper-compact (design-system.css:1048) |
| ca4d0214 | FIXED-LIVE | model picker uses hasActiveItems (page.js:2171); model "33" not mentioned by agent, unverified |
| fdce699f | NEEDS-OWNER-DECISION (dup of 1cbaf995 intent) | hide abroad/long-occupancy pill via org-2 setting; owner must confirm Neve doesn't use it |
| b433b691 | NEEDS-OWNER-DECISION | split nested משלוח/סניף/טלפוני card into 2 groups; S markup change, sketch unapproved |
| ac8afab7 | NEEDS-OWNER-DECISION | "הוסף משלוח" in steps 3-5 not built; also delivery amount is computed but never displayed (page.js:979) |
| 1913c29a | DUPLICATE-OF ac8afab7 | same ask |
| caab5f84 | DUPLICATE-OF ac8afab7 | same ask |
| 48009b9b | STILL-BROKEN (partial) | dead-end fixed, but edit-in-new-tab leaves stale customer card; no back-to-search button; ID-number dup unhandled |

### ב. כרטיס הזמנה, תשלומים, משלוח
| id8 | Verdict | One line |
|---|---|---|
| 5a90a1fc | NEEDS-OWNER-DECISION (partly exists) | Same-price-band size swap after 15 min already exists (Neve=2 days before event). Free swap across bands / any age = pricing policy change. Agent's 1st reply ("only within 15 min") is incomplete. |
| 06467870 | FIXED-LIVE (+ latent bug) | Cash after adding delivery works (payment-continue popup + approver-gated card). NEW FINDING: delivery with no city saved = no charge at all. |
| 13eaff88 | FIXED-LIVE | Print prompt after "שמור שינויים" is in main (f2163de0, 09-22). Agent said "temp version only" - wrong, it is on main. |
| 125a069b | FIXED-LIVE | Raw Prisma P2025 on stale obligation guarded in main (route.js:815). Agent said "not yet live" - wrong. |
| 4d705ac2 | NEEDS-OWNER-DECISION | Cash add is now approver-gated (not blocked). Full block conflicts with later complaint ef1be7fd. |
| f559c61b | NEEDS-OWNER-DECISION (user answered yes twice) | 2 of 4 buttons already moved behind approver code; "הוסף חיוב" (+delivery charge buttons) and card button still visible. Concrete plan below. HIGH-RISK (money UI). |
| af7170ce | DUPLICATE-OF f559c61b | |
| ebf2e202 | FIXED-IN-BRANCH (stale) | Save->redirect for Neve only in unmerged `feature/order-card-redesign-neve-2026-09-24`; not in main. |
| adcc4ba8 | FIXED-LIVE | order_new_redirect_screen=new_order + same-page full reload (ea579b00, 10-04). |
| 78c0d8b8 | DUPLICATE-OF adcc4ba8 | |
| 24380f79 | STILL-BROKEN (font) / NOT-REPRODUCIBLE (toggle) | "משלוח" is an `<h3>` (heading font) vs bold divs in sibling cards. Toggle is already at the far side by code. |
| 139f6a15 | STILL-BROKEN | Delivery / manual-payment / order-date cards have no avatar icon. Agent said "ready" - no code anywhere. |
| 79c5130b | DUPLICATE-OF f559c61b | "הוסף חיוב" still rendered unconditionally. |
| 4df369cb | STILL-BROKEN | Hint text still in ModernOrderCard.js:259-263; no branch removes it. Agent said "ready" - false. |
| ef1be7fd | STILL-BROKEN (edit side) / FIXED-LIVE (create side) | Create-order cash approval removed (ea579b00). Edit side: scan on unpaid order + hidden cash button; root cause hypothesis below. |
| 6244b29b | STILL-BROKEN (approved feature not built) | No "עריכת הזמנה" button in app/rentals/page.js; no branch has it. Agent said "ready" - false. |
| 884f29ae | STILL-BROKEN | Barcode rent/return flags the card "unsaved" although already persisted -> Save/Exit -> ID prompt. Fix S. |
| b1a91c78 | STILL-BROKEN (+owner decision on unpaid approval) | Same root cause as 884f29ae + per-scan manager approval on unpaid orders. Agent's explanation missed the main prompt. |
| 455ffa6e | DUPLICATE-OF 884f29ae | |
| 3a4d36df | FIXED-LIVE (+ latent bug, + unresolved sub-question) | Delivery charge now before the response read (api/orders/route.js:959). "Vanished order" question is still open. |

### ג. השכרות, החזרות, מלאי, הדפסה
| id8 | verdict | one line |
|---|---|---|
| 749aaf87 | FIXED-LIVE (login/hourly/logout popup) + NEEDS-OWNER-DECISION (new "late" rule) | popup shipped; owner's "next day 14:00" rule never answered (A vs B question open) |
| 8d990b1f | NOT-A-BUG/CONFIG (+ FIXED-IN-BRANCH for the "special list") | mechanism live but now governed by a permission row, not the setting the thread cites; manager notification is live |
| d5c705a4 | FIXED-LIVE (smart-sort part) + STILL-BROKEN/UNVERIFIED (Access-flag part) | far-future taken items now show in rentals; the "mark Access-rented items as taken" tool exists but may not cover these orders |
| 0715488c | FIXED-LIVE (algorithm) + residual risks, no closing reply | formula verified vs Access on 3 models; remaining gap = size-spelling, client/server drift, data drift |
| 9aca71c4 | DUPLICATE-OF 0715488c | |
| 395e7758 | FIXED-LIVE (duplicate of 7dad77c4) | widget exists on /rentals only; request was filed from /orders |
| 7ee39852 | DUPLICATE-OF 4e07692c | delivery icon request |
| 81d3c5e8 | FIXED-LIVE | order count per day in legacy board cell |
| 005a779e | NEEDS-OWNER-DECISION | screenshot lost; cannot tell what "open like this" means |
| 4c01513e | FIXED-LIVE | sidebar "החזרות" while on /rentals switches tab |
| ffa88595 | STILL-BROKEN (partial) | only rows view + unnamed models fixed; grid/table views and named models still repeat the number; last user msg unanswered |
| 8bfa2b00 | STILL-BROKEN | thread says fixed; on /rentals the topbar title never renders (isActive can't match `#hash` hrefs) |
| 9f524395 | STILL-BROKEN (new request, unanswered after clarification) | wants overdue list in the same table style as rentals; widget is a 10-row card |
| 8e647af8 | STILL-BROKEN | owner confirmed twice; the in-page "השכרות/החזרות" tabs are still in rentals/page.js |
| 3993b50d | FIXED-LIVE | zoom popover anchor flipped (kiosk.css:306) |
| 9b7fe2af | FIXED-LIVE | kiosk fetches `filterStatus=active` (PR #157) |
| b79f9d94 | FIXED-LIVE (+ perf/egress risk) | 2000 cap removed; the returned tab now loads ALL returned order ids per page view |
| 4e07692c | NEEDS-OWNER-DECISION (sketch pending) | not implemented; list API does not even select isDelivery/deliveryDirection |
| 4cf4e325 | STILL-BROKEN (partial) / FIXED-IN-BRANCH (partial) | badge exists; detailed street+house address missing (print reads non-existent `customer.address`) |
| 27f278c7 | STILL-BROKEN | none of the 9 edits done; agent's "wrong page" claim is false - all strings live in /print/order |
| b58303e9 | STILL-BROKEN | page-counter margin fix never shipped ("deploys paused"); one-line CSS fix |

### ד. הרשאות, הגדרות, דשבורד
| id8 | page | verdict | one line |
|---|---|---|---|
| 214f1f9b | / | NEEDS-OWNER-DECISION | "hide customers from employees": agent asked 3 clarifying questions 09-14, never answered; page-level hide is pure config (`page:customers` row at /admin/permissions), API/search/order card still expose customers |
| 87ba8e3d | /dashboard/pricelist | STILL-BROKEN (data) + FIXED-LIVE (swap policy) | prices reverted because the Access importer re-upserts `PriceList` from Access on every run (reimport of 2026-09-15). Needs: re-enter prices + stop the importer overwriting them |
| 15f0072a | /orders | NOT-A-BUG/CONFIG (resolved in practice) | per-employee permission `feature:error_reports`; both Rivka Levi and Avigail Israeli filed NEW reports later (09-22, 10-04), so access was granted |
| 9a94421f | / (AI chat) | FIXED-LIVE (partial) | AI history cap (10 msgs) is live in the floating widget since 09-16; server does not cap and `/admin/ai` page is uncapped |
| 5c5b2b1c | /admin/ai | STILL-BROKEN (partial) | the cap only exists in `AIFloatingWidget.js`; `/admin/ai` sends the full thread, `/api/ai` does not cap -> same stale-context problem. Reporter never gave the actual question |
| 0466a20d | /customers | NOT-A-BUG/CONFIG | deliberate export limit (200 rows, approver password). Config: raise `feature:export_max_rows` or grant `feature:export_over_limit_approval` |
| 58d71561 | /dashboard | FIXED-LIVE | Payment-based charts + weekly/monthly charts + head-management gate all in origin/main. Minor: timezone bucketing, dead `/api/dashboard` route |
| a4af3bbd | /employees | NOT EXECUTED (NEEDS-OWNER-DECISION) | mass deactivation never ran; last message is the agent's 3-point question (09-24 18:35) |
| f52ab4f4 | /display-settings | STILL-BROKEN | `app/design-overrides.css` forces body/button/input/headings font with `!important`; the `--font` presets can never apply. No fix exists in any branch |
| cabe10ef | /display-settings | DUPLICATE-OF f52ab4f4 | same cause |
| 8dab5896 | /dashboard | NEEDS-OWNER-DECISION | yearly average under each chart: not built, agent's question (which chart / which average) unanswered since 09-24 |
| 9f911460 | / | NOISE | "היי" - no content |
| 615224ff | / | NOISE | "שלום" - no content |
| 465c76a6 | /orders | NOISE | "ניסוי" - the owner testing video attachments |
| e625ae8a | (agent log) | informational | see section at the end; Neve fix deployment is "paused" since ~10-04, nothing opened since |
