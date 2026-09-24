# מלאי חלוניות צפות — R19 (ניתוח קריאה-בלבד, 2026-09-24)

מקור: סריקת `app/**`, `components/**` (לא כולל `app/api`). שיטה: `modal-backdrop` / `position:fixed` / `createPortal` / `role=dialog` + כל קריאות `confirm/alert/prompt/custom*`. לכל חלונית נבדק תוכנה (יש שדות הזנה? ← **בהיר בלבד**; אישור/קוד/צפייה בלבד ← **כהה+בהיר**).

## וריאנטים משותפים ב-v3 (`app/v3/ui/Dialog*`)
| קוד | וריאנט | מצבים | הערה |
|---|---|---|---|
| **C** | `Dialog.Confirm` (כפתור אישור/ביטול, וגם 3-כפתורים) | כהה+בהיר | מחליף `customConfirm`/`customThreeWayConfirm`/`window.confirm` |
| **K** | `Dialog.Code` (בחירת מאשר + קוד PIN) | כהה+בהיר | מחליף `customAuthPrompt` (הקלט הוא קוד בלבד — לפי R19 "אישור/קוד") |
| **F** | `Dialog.Form` (שדות הזנה) | **בהיר בלבד** | כולל `customPrompt` (הערה חופשית), מייל מהיר, אשראי, חיפוש מתקדם וכו' |
| **S** | `Dialog.Sheet` (חלון קריאה/תוכן גדול, טבלאות, פרטים) | כהה+בהיר אם אין קלט; בהיר אם יש | צפייה בלבד |
| **P** | `Popover` (תפריט/רשימה צפה מעוגנת, לא חוסמת) | לפי התוכן | dropdown, tooltip, combobox |
| **T** | `Toast`/`NoticeBar` (ראו NOTIFICATIONS-DESIGN) | כהה+בהיר | מחליף `alert()` (302 קריאות) |
| **B** | `BusyOverlay` (חוסם + ספינר, בלי קלט) | כהה+בהיר | |

## 0. תשתית מרכזית — `app/components/PopupProvider.js`
כל האתר עובר דרכה. `window.alert` מוחלף שם ב-`showAlert` (טוסט), ורק `confirm`/`prompt` **לא** מוחלפים (ראו §D).
| # | file:line | רכיב | מטרה | קלט? | וריאנט | עמודים |
|---|---|---|---|---|---|---|
| 0.1 | PopupProvider.js:215 | `toast-stack` (למעלה-מרכז, 4 שנ', היסטוריה 100) | הודעות מערכת/שגיאה | לא | T | כל האתר |
| 0.2 | :245 | `showConfirm` | אישור פעולה | לא | C | כל האתר (≈57 קריאות) |
| 0.3 | :265 | `showThreeWayConfirm` | שמור/בטל/זנח | לא | C(3) | orders/[id] (1 קריאה) |
| 0.4 | :288 | `showPrompt` | הערה/סיבה בטקסט חופשי | **כן** | F | RentalReturnModal, ModernItemsManager, ModernDressItemsTab, orders/page, orders/[id] (8 קריאות) |
| 0.5 | :323 | `showAuthPrompt` | בחירת מנהל/מאשר + קוד | קוד (combobox+password) | K | 24 קריאות: orders/new, orders/[id], ModernItems/Rentals/Payments, settings, data-explorer, employees/[id], pricelist, history, SettingQuickPanel |
| 0.6 | :~415 | מארח `RentalReturnModal` גלובלי (`openRentalModal`) | חלון השכרה/החזרה מכל מקום | כן | F/S | דשבורד, הזמנות |

## A. חלוניות אישור/הודעה בלבד (כהה+בהיר)
| # | file:line | טריגר/רכיב | מטרה | וריאנט | עמודים |
|---|---|---|---|---|---|
| A1 | app/orders/new/page.js:2610 | "רגע, בדקת מלאי?" | אישור לפני שלב | C | orders/new |
| A2 | orders/new/page.js:2647 | "יציאה מההזמנה" | איבוד נתונים לא שמורים | C | orders/new |
| A3 | orders/new/page.js:2677 | לקוח קיים/חסום נמצא | "השתמש בלקוח הזה" | C | orders/new |
| A4 | orders/new/page.js:2740 | "הזמנה זו כבר נשמרה" (כפילות) | שמור בכל זאת / בדוק | C | orders/new |
| A5 | orders/new/page.js:2875 | `busy` alertdialog | חוסם בזמן שמירה/חיוב | B | orders/new |
| A6 | app/orders/[id]/page.js:1573 | `showSaveSuccessOverlay` (5 שנ') | "ההזמנה נשמרה" | **להחליף ב-NoticeBar (R20)** | orders/[id] |
| A7 | orders/[id]/page.js:1592 | `summaryConfirmData` | סיכום לפני שמירה | S+C | orders/[id] (נווה יעקב) |
| A8 | orders/[id]/page.js:1679 | `paymentContinueAmount` | "נוצר חיוב חדש — להשלים גבייה" (3 כפתורי פעולה) | C(actions) | orders/[id] |
| A9 | components/orders/modern/ModernOrderCard.js:292 | `showUnlockModal` | "הזמנה נעולה — שחרור דורש מנהל" | C ← K | orders/[id] |
| A10 | ModernGeneralDetails.js:650 | `showManualPaymentCreditChooser` | בחירה תשלום/זיכוי ידני | C(2 בחירות) | orders/[id] |
| A11 | ModernItemsManager.js:1145,1202 / ModernRentalsManager.js:440,481 | "לאיזה פריט לשייך את הברקוד?" (+ אזהרת לא שולם) | בחירת פריט | C(בחירה) | orders/[id], rentals |
| A12 | ModernItemsManager.js:1291 | פרטי פריט | צפייה | S | orders/[id] |
| A13 | ModernPaymentsManager.js:1075 | `showRegulationsModal` "חתימה על תקנון?" | כן/לא | C | orders/[id] |
| A14 | OrderPrintMenu.js:224 | חתימה על תקנון | כן/לא | C | orders/[id] |
| A15 | ModernPaymentsManager.js:1243,1305 | פרטי תשלום / פרטי חיוב | צפייה | S | orders/[id] |
| A16 | RentalReturnModal.js:1002,1062 | פרטי פריט / "נמצאו פריטים זהים" (בחירה) | צפייה/בחירה | S / C(בחירה) | rentals, דשבורד |
| A17 | app/refunds/page.js:844 | "אישור יתרת חוב לתשלום" | אישור (בדיקה: חלון משמש גם לייצוא — ראו F) | C | refunds |
| A18 | components/orders/ActiveEmployeesModal.js:55 | עובדים פעילים בזמן ההזמנה | צפייה | S | orders/[id] |
| A19 | components/orders/ItemCapacityModal.js:85 | זמינות פריט | צפייה | S | orders/new, orders/[id] |
| A20 | components/CapacitySearchModal.js:195 | חיפוש תפוסה | תצוגת תפוסה (קלט תאריך? — בדיקה נדרשת; הוגדר S/F) | S/F | הזמנות |
| A21 | app/components/OverdueOrdersModal.js:16 | "הזמנות שלא הוחזרו" (כל שעה) | טבלה + קישורים | S | כל האתר (נווה יעקב) |
| A22 | app/components/MessageHistoryButton.js:26 | היסטוריית הודעות מערכת | רשימה | S | כל האתר (מתכנת) |
| A23 | app/components/StatisticsModal.js:233 | סטטיסטיקות AI | תצוגה (יש בו מחיקת שיחה) | S | AI |
| A24 | app/components/AIFloatingWidget.js:800 | טבלת נתוני AI | צפייה | S | כל האתר |
| A25 | app/page.js:697 | מדיניות פרטיות | טקסט | S | דף הבית |
| A26 | app/alterations/page.js:583 | מקרא צבעים | צפייה | S | alterations |
| A27 | app/board/page.js:906 | תוצאות חיפוש גלובלי | רשימה | S | board |
| A28 | app/board/page.js:972 | הזמנות ליום (יש שדה חיפוש 1) | רשימה+סינון | S/F | board |
| A29 | components/dresses/modern/ModernDressItemModal.js:47 | פרטי פריט שמלה | צפייה | S | dashboard/dresses/[id] |
| A30 | app/admin/ai/page.js:286, ai-history:171 | טבלת נתונים / תיעוד שיחה | צפייה | S | admin/ai, admin/ai-history |
| A31 | app/admin/data-explorer/page.js:737 | היסטוריית שאילתות | צפייה | S | admin |
| A32 | app/admin/inventory-alerts/page.js:49 | הזמנות מעורבות | צפייה | S | admin |
| A33 | app/management/history/page.js:436 | פרמטרים ושאילתת API (שדה 1) | צפייה/העתקה | S | management/history |
| A34 | app/admin/email-test/page.js:183 | תצוגה מקדימה של מייל (`role=dialog`) | צפייה | S | admin/email-test |
| A35 | app/customer-interface/page.js:1627 | "הזמנות לדגם" (ka-modal, קיוסק) | צפייה | S | קיוסק |
| A36 | app/components/permissions/PermissionRowWizard.js:323 | אשף שורת הרשאה | טופס/בחירות | F | admin/permissions |
| A37 | app/components/LoginScreen.js:435 | כניסת עובדים (חלון תחת ה-portal) | בחירת עובד + PIN | K (בהיר; דף כניסה בעיצוב מיוחד, R? / #6) | login |

## B. חלוניות עם הזנת מידע (**בהיר בלבד**, R19)
| # | file:line | טריגר | מטרה | וריאנט | עמודים |
|---|---|---|---|---|---|
| B1 | components/SendEmailModal.js:159 | "מייל מהיר"/שליחת מייל | נמען/נושא/גוף | F | orders, customers |
| B2 | components/customers/modern/ModernSendEmailModal.js:95 | שליחת מייל ללקוח | טופס מייל | F | customers/[id] |
| B3 | orders/[id]/page.js:1879 | `showEmailPrompt` "כתובת מייל חסרה" | הזנת מייל | F | orders/[id] |
| B4 | OrderPrintMenu.js:244 | שליחה + קבצים נוספים | בחירת קבצים | F | orders/[id] |
| B5 | app/components/PrintWizardModal.js:190 | אשף הדפסה | הגדרות הדפסה | F | הדפסות |
| B6 | app/components/SettingQuickPanel.js:127 | הגדרה מהירה | עריכת ערך (+קוד K) | F | כל האתר |
| B7 | orders/new/page.js:2769 | חיוב באשראי (נדרים) | פרטי כרטיס | F | orders/new |
| B8 | orders/new/page.js:2847 ; ModernPaymentsManager.js:1096 | העברת כרטיס מהירה | קלט מוסתר לקורא כרטיסים | F | orders/new, orders/[id] |
| B9 | ModernPaymentsManager.js:1122 | תשלום בכרטיס אשראי | פרטי כרטיס | F | orders/[id] |
| B10 | ModernPaymentsManager.js:1211 | הוספת חיוב ידני | סכום/סיבה | F | orders/[id] |
| B11 | ModernPaymentsManager.js:1358 | יצירת בקשת זיכוי | סכום/סיבה | F | orders/[id] |
| B12 | ModernPaymentsManager.js:1411 | פרטי בנק לזיכוי | בנק/סניף/חשבון | F | orders/[id] |
| B13 | ModernPaymentsManager.js:1444 | תשלום נוסף | אמצעי/סכום | F | orders/[id] |
| B14 | ModernGeneralDetails.js:573 | החלפת לקוח | חיפוש/בחירה | F | orders/[id] |
| B15 | ModernItemsManager.js:1259 | הזנת ברקוד ידנית | ברקוד | F | orders/[id] |
| B16 | app/refunds/page.js:883 | ייצוא זיכויים להנה"ח | תאריכים/סטטוס | F | refunds |
| B17 | components/dresses/modern/ModernDressModals.js:28 | סימון דגם לא פעיל | סיבה+תאריך | F | dashboard/dresses |
| B18 | components/orders/RentalReturnModal.js:681 | השכרה והחזרה (כרטיס מלא, סריקה) | סריקה/הערות | F (גדול) | rentals, דשבורד |
| B19 | components/ExportButtons.js:263 | ייצוא נתונים | בחירת עמודות/טווח | F | הרבה עמודי רשימה |
| B20 | components/FullEmailListModal.js:85 | רשימת מיילים | חיפוש/העתקה | F/S | customers |
| B21 | components/HebrewDatePicker.js:226,374 ; HebrewDateRangePicker.js:301 | בחירת תאריך/חודש-שנה/טווח (פתוחים כמודל!) | בחירת תאריך | F (או P) | כל הטפסים |
| B22 | חיפוש מתקדם: board:804, customers/page.js:440, orders/page.js:601, rentals/page.js:498 | חיפוש מתקדם | סינונים | F | 4 עמודי רשימה |
| B23 | app/deliveries/page.js:422 | הדפסת משלוחים | טווח/בחירה | F | deliveries |
| B24 | app/components/ErrorReportButton.js:740 | דיווח תקלה | טקסט/צילום | F | כל האתר |
| B25 | app/components/LoginScreen.js:492,522 | שכחתי סיסמה / סיסמה חדשה | הזנת מייל/סיסמה | F | login |
| B26 | app/customer-interface/page.js:1581 | קיוסק — בחר עובד + קוד גישה | בחירה+קוד | K | קיוסק |
| B27 | app/admin/email-test/page.js (סך הכל שדות בעמוד) | — | — | — | (כלול ב-A34) |

## C. ווידג'טים/חלוניות צפות שאינן מודל
| # | file:line | רכיב | הערה | וריאנט | עמודים |
|---|---|---|---|---|---|
| C1 | app/components/AIFloatingWidget.js:471 | כפתור ה-AI הצף (`insetInlineStart`) | FAB | ווידג'ט | כל האתר |
| C2 | AIFloatingWidget.js:504 | חלונית שיחת AI (380×550, z900) | קלט צ'אט ← **בהיר בלבד** | F-panel | כל האתר |
| C3 | ErrorReportButton.js:1261 | סרגל הקלטת שלבים (למטה-מרכז) | צף | ווידג'ט | כל האתר |
| C4 | ErrorReportButton.js:1279 | טוסט מקומי (למעלה) | להחליף ב-T | T | כל האתר |
| C5 | components/ClipboardDebugger.js:240,288,550 | כלי דיבאג לוח + חלון שאילתה + טוסט | כלי מפתחים | ווידג'ט/T | כל האתר (מתכנת) |
| C6 | app/components/useElementPicker.js:90 | overlay בוחר אלמנט | כלי דיווח | ווידג'ט | כל האתר |
| C7 | app/page.js:551 | "Floating Chat Input" (קלט חיפוש AI קבוע למטה) | קלט | ווידג'ט | דף הבית |
| C8 | app/components/OfflineIndicator.js, BackupModeBanner, DevEnvBanner, PreviewModeBanner (globals.css ~2415-2452) | באנרים קבועים | סטטוס, לא חוסם | Banner | כל האתר |
| C9 | globals.css:936 `.modal-overlay`, :1001 `.popup-toast-container`, :1065 `.popup-overlay`, :1327 `.global-popover` | CSS ישן של חלונית/טוסט/פופאובר | לבדוק שימוש; ייתכן מיותר | — | — |
| C10 | ShiftMessageWatcher.js:37 (דרך `showConfirm`) | "הודעה למשמרת הבאה" | **הודעה פנימית** ← R21 (ראו NOTIFICATIONS-DESIGN §3) | Message (BL) | כל האתר |
| C11 | OverdueRemindersWatcher.js → A21 | תזכורת שעתית | — | S | נווה יעקב |
| C12 | LoginScreen.js:110 | `alert` "יש X הודעות חדשות" בכניסה (native — מחוץ ל-PopupProvider!) | ← T/Message | T | login |

## D. Popovers / dropdown / tooltips (מעוגנים; לא חוסמים)
| # | file:line | רכיב | וריאנט |
|---|---|---|---|
| D1 | app/components/NotificationBell.js (`user-menu-dropdown`) | פעמון התראות | P |
| D2 | app/components/UserMenu.js | תפריט משתמש | P |
| D3 | app/components/TopbarSearch.js | תוצאות חיפוש עליון | P |
| D4 | components/CustomerSelector.js:127,262 | בחירת לקוח (fixed+portal) | P/combobox |
| D5 | components/orders/OrderModelSelector.js:175,288 | בחירת דגם (fixed+portal) | P/combobox |
| D6 | app/components/permissions/ItemInfo.js:64-70 | ⓘ הסבר (role=dialog) | R11 tooltip |
| D7 | app/board/page.js:703 ; orders/page.js:964 | תצוגה מקדימה בריחוף על הזמנה | P (tooltip-card) |
| D8 | app/board/page.js:1055 | תפריט פעולות להזמנה (backdrop שקוף) | P |
| D9 | `.combobox-results` (design-system.css:1217) — PopupProvider auth, LoginScreen, וטפסים | רשימת הצעות | P |
| D10 | AIFloatingWidget.js:739 | תפריט קטן בחלונית ה-AI | P |
| D11 | admin/settings/SettingsClient.js, admin/data-explorer, punch-clock, customer-interface, CapacitySearchModal, HebrewDatePicker (סגירה בלחיצה-מחוץ) | dropdowns פנימיים | P |
| D12 | admin/data-explorer/page.js:483 | טוסט DOM ידני ("השדות הועתקו") | T |

## E. דיאלוגים native של הדפדפן — **חובה להחליף**
### `window.confirm` (16) — לא מוחלף גלובלית
| file:line | הודעה | ← |
|---|---|---|
| app/orders/new/page.js:1076 | יציאה בלי שמירה (popstate guard) | C |
| app/orders/[id]/page.js:587 | התנגשות גרסה — "דרוס / טען מחדש" (הודעה ב-`confirm` ללא fallback) | C(2 בחירות) |
| orders/[id]/page.js:968 | הדפסה אחרי שמירה (fallback) | C (fallback למחוק) |
| orders/[id]/page.js:1313, 1435 | מחיקת שינויים לא שמורים / אישור כללי (fallbacks) | C |
| components/orders/modern/ModernOrderCard.js:113 | fallback | C |
| components/orders/modern/ModernItemsManager.js:306 ; ModernRentalsManager.js:84 | `customConfirm || window.confirm` | C |
| components/orders/RentalReturnModal.js:469, 511 | fallbacks של prompt | C/F |
| components/dresses/modern/ModernDressItemsTab.js:197 | fallback | C |
| app/punch-clock/page.js:60 | fallback | C |
| app/admin/bulk-email/page.js:31 | `customConfirm && !window.confirm` | C |
| app/admin/email-test/page.js:55 | שליחת N מיילי דוגמה | C |
| app/admin/nedarim-hok-edit/page.js:100, 129 | גביה בפועל מכרטיס שמור | C |
| app/admin/nedarim-hok-test/page.js:53 | בקשה אמיתית לנדרים | C |
| app/admin/settings/WebBackupModeToggle.js:37 | אזהרת מצב גיבוי | C |
| app/admin/trusted-devices/page.js:62 | ביטול אמון במחשב | C |
**בפועל native (ללא fallback): ~9 מהם** — orders/new:1076, orders/[id]:587, WebBackupModeToggle, trusted-devices, nedarim-hok-edit ×2, nedarim-hok-test, email-test, ModernDressItemsTab:197 (חלקית). השאר הם fallbacks שיפעלו רק אם `window.customConfirm` חסר.
### `window.prompt` (3) — orders/page.js:427 ; orders/[id]/page.js:314 (קוד זיאוט למחיקה — fallback) ; ModernItemsManager.js:709 (הערה)  ← F/K
### `alert()` (≈281 קריאות ב-41 קבצים)
מוחלף ב-runtime ל-toast (`PopupProvider.js:199`) — **אבל** לא מוחלף (native אמיתי) במקומות שמחוץ ל-`PopupProvider`: `LoginScreen` (מסך כניסה נטען לפני ה-Provider; `layout.js:626`) ו-fallback ב-`LoginScreen.js:113`. העדפה ב-v3: להחליף כל `alert(...)` בקריאה מפורשת ל-`toast.*` (סוג: error/warn/info) ולא להסתמך על override; הריכוז הגדול: orders/[id] (38 קריאות alert/confirm), orders/new (34), ModernItemsManager (26), RentalReturnModal (22), employees/[id] (21), ModernPaymentsManager (13), ModernRentalsManager (11).

## סיכום כמותי
| קטגוריה | כמות |
|---|---|
| תשתית PopupProvider (0.1–0.6) | 6 |
| A — אישור/צפייה (כהה+בהיר) | 37 שורות (~50 אתרי JSX) |
| B — הזנת מידע (בהיר בלבד) | 26 שורות (~45 אתרי JSX) |
| C — ווידג'טים | 12 |
| D — popovers | 12 קבוצות |
| **סה"כ אתרי חלונית JSX (`modal-backdrop`/fixed)** | **≈ 100** ב-48 קבצים |
| native `window.confirm` | 16 (≈9 ללא fallback) |
| native `window.prompt` | 3 |
| `alert()` | ≈281 ב-41 קבצים (override קיים, 2 native במסך כניסה) |
| קריאות `customConfirm` / `customPrompt` / `customAuthPrompt` / `customThreeWayConfirm` | ≈57 / 8 / 24 / 1 |

## מסקנות לתכנון
1. **Provider אחד**: `<DialogProvider>` v3 מחליף את PopupProvider, ושומר על חתימות `window.customConfirm/customPrompt/customAuthPrompt/customThreeWayConfirm/alert` (תאימות לאחור: 100 קריאות שלא נוגעים בהן). הוספת `window.confirm` (override) סוגרת את כל ה-native בבת אחת — שינוי קוסמטי בלבד.
2. שתי חלוניות ישנות של CSS (`modal-overlay`, `popup-overlay`, `global-popover`) — לבדוק שימוש ולמחוק בשלב 7.
3. חלוניות הזנה (B) חייבות בהיר גם כשהעמוד כהה: `data-v3-theme="light"` על ה-Dialog בלבד (tokens מקומיים), לא על ה-body.
4. `HebrewDatePicker` ו-`HebrewDateRangePicker` נפתחים כמודל מלא (z 100000) — להמיר ל-Popover/Sheet בהיר.
5. בעיות z-index קיימות (1000…999999): tokens בלבד ב-v3 (`--v3-z-dialog`, `--v3-z-toast`, `--v3-z-popover`).
