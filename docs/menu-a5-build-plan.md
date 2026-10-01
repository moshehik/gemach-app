# תוכנית בנייה: התפריט החדש (A5) באתר האמיתי

**סטטוס:** תכנית (שלב 1 הושלם: לוגיקה טהורה + תכנית; שלב 2 — ממשק — טרם נבנה). נכתב 1.10.2026 בענף `feature/menu-a5-2026-10-01` (עץ `wt-menu-a5`), על גבי `feature/a5-integration-2026-09-29`.
**עדכון 1.10.2026 (ענף `feature/shell-endpoints-2026-10-01`, `scratch\schedule-build\REPORT-V1-endpoints.md`):** ה-API החסר בסעיף 4 נבנה — `POST /api/notifications/read|archive` עם `{ all: true }`, `POST /api/me/ui-variant/shell` (legacy בלבד), `app/layout.js` מייבא את `NAV_PAGE_KEYS` מכאן (כולל `page:messages`, `page:schedule`) ומעביר `a5Shell` (management_messages / gmach_name / gmach_subtitle / BRAND_LOGO כ-`!!value` / pageAccess). **החלטת הבעלים 1.10 מחליפה את R09/R10 (סעיף 3.6 ושאלות 4-5 בסעיף 7):** "משלוחים" (`ad-deliveries`, `/deliveries`, רק כש-`enable_deliveries==='true'` ∧ `page:deliveries`) ו"זיכויים וחובות" (`ad-refunds`, `/refunds`, לפי `page:refunds`) הם תת-פריטים של **"ניהול"**. "לוז" (`sched`, `/schedule`) הוא תת-פריט של "בית" אחרי "חיפוש כללי", מוצג רק כש-`page:schedule` נטען ו-`true` (גם להנהלה); לשונית לוז + היום/מחר הוסרה (P01 נדחה). 66 בדיקות ב-`test_menu_logic.mjs`, 19 ב-`test_shell_endpoints.mjs`.

**מקורות האמת:** `scratch\schedule-build\DECISIONS-תפריט.md` (החלטות הבעלים), העיצוב המאושר `תצוגות-עיצוב\תפריט-חדש.html` (המערכים `REGISTER` R01–R12, `PENDING` P01–P05, `NOTES` J01–J08 בסוף הקובץ הם החוזה), ו-`scratch\menu-search\SPEC-ברקוד-ואחורה-קדימה.md` (רק סעיף 1.6 — אחורה/קדימה ו"נצפו לאחרונה"; **זרם הברקוד ברצף לא נבנה**, 10 שאלות פתוחות בסעיף 8 שם).

## 1. מה נבנה בשלב 1 (קיים בענף)

| קובץ | מה זה |
|---|---|
| `lib/menu/buildMenuTree.js` | `buildMenuTree({ user, roleId, permissions, settings, flags, org, available, version, status })` → עץ התפריט הסופי כ-JSON נקי. עוטף את `buildNavGroups` מ-`app/components/navConfig.js` (מקור האמת לנראות של כל מה שיש לו שורה בתפריט הישן) ואת אותם דגלים ש-`app/layout.js` כבר מחשב (`deriveLegacyFlags` משחזר אותם אחד-לאחד). גם `findActive(tree, pathname, hash)`, `flattenMenuTree`, `isJsonSafe`, `REMOVED_ITEMS`, `NOT_BUILT_ITEM_IDS`, `NAV_PAGE_KEYS`. |
| `lib/menu/navHistory.js` | מחסנית צפייה אחורה/קדימה לפי כללי דפדפן (`visit / back / forward / go / clear / relabel`, `recentsView`, `buttonLabels`, `serializeNavHistory / deserializeNavHistory` ל-sessionStorage, `shouldRecordPath`, `clearNavHistoryStorage` להתנתקות). אי-שינוי קלט, תקרה 10; קריאה מאחסון חסינה לקלט ענק/פגום. הקשחה נגד open redirect ב-`normalizeNavPath`: `\` ו-`//` מנורמלים, נתיב עם תו בקרה (Tab/LF/CR, מפרידי שורה של יוניקוד, BOM) או סכימה (`javascript:` וכו') נדחה כולו (`''`), וכל פלט חייב להתפענח ב-`new URL` לאותו origin (רשת ביטחון). `%09` מקודד נשאר נתיב רגיל בכוונה. |
| `lib/menu/recents.js` | "נצפו לאחרונה": זיהוי ישות מנתיב (`parseEntityPath`), המרה משלושת המקורות (מחסנית הניווט, `agy_history` הישן, שורות `PageVisitLog`) ו-`mergeRecents` עם ביטול כפילויות. בלי DDL. קידוד פגום (`orderId=%`) לא זורק — הרשומה נזרקת. |
| `scripts/test_menu_logic.mjs` | 66 בדיקות יחידה בסגנון `scripts/test_ui_variant.mjs` (`node scripts/test_menu_logic.mjs`). |

**לא נגעו:** `app/components/AppShell.js`, `navConfig.js`, `UserMenu.js`, `TopbarSearch.js`, `NotificationBell.js`, `BrandLogo.js`, `app/layout.js`, `prisma/schema.prisma`, שום API.

## 2. הדגל (וריאנט) — איך התפריט החדש מוסתר

- `lib/uiVariant.js` כבר מגדיר מסך **`shell`** ("המעטפת/התפריט"), ערכים `legacy | a5`, ברירת מחדל `legacy`, הכרעה: עקיפה אישית (`Employee.themeColor.uiVariants.shell`) > הגדרת הארגון `SystemSetting ui_variant_shell` > `legacy`. קיוסק / שעון נוכחות / הדפסה תמיד `legacy` (`isForcedLegacyPath`). **לא נוסף מסך `menu`** — המעטפת היא התפריט, ושני דגלים לאותו דבר היו מתנגשים.
- הדלקה: `node scripts/set-ui-variant.js --screen shell --value a5 --scope user --employee <legacyId> --confirm-host <host> --i-know-this-is-prod` (עובד אחד לבדיקה), או `--scope org` לכל הגמ"ח. בכל DB בנפרד (שני הגמ"חים = שני DB). הסקריפט סגור-בכישלון: **כל** DB נחשב ייצור ודורש `--i-know-this-is-prod`, אלא אם הוא ה-host של `TEST_DATABASE_URL` בסביבה או host מקומי שהוצהר ב-`--not-prod` (עודכן 1.10 אחרי הסקירה — קודם זוהה ייצור רק כש-`PROD_DATABASE_URL*` היה מוגדר).
- **נקודה פתוחה (אבטחת הדגל האישי, מהסקירה 1.10):** המשפט "עובד לא יכול להדליק לעצמו A5" נכון **רק דרך ה-API** (`PUT /api/me/design-prefs` מוחק `uiVariants`). בפועל `app/layout.js` (שורות 247–254, 288–290) קורא את העקיפה האישית **מהעוגייה `designPrefs_<id>` בלבד** — עוגייה שהדפדפן של העובד כותב (`DesignPrefsSync`) ושהעובד יכול לערוך בעצמו — ולא מה-DB; במסלול המהיר (`auth_session` חתום) ה-layout לא מריץ שאילתת עובד בכלל, כך שאימות מה-DB אינו "תוספת של שדה ל-select" אלא סבב Neon נוסף לכל רינדור. היום אין בזה סיכון (הדגל הוא תצוגה בלבד, ההרשאות נאכפות ב-`PageGate`/`checkAuth`, וכל מה שהעובד "מרוויח" הוא לראות מעטפת לא גמורה בדפדפן שלו). **לפני הדלקה אמיתית (R1) יש להחליט במפורש** על אחת מהאפשרויות: (א) לקבל את הסיכון בידיעה, ולהשאיר את הכלל "הדגל לעולם לא גבול הרשאות" (כפי שמתועד ב-`lib/uiVariant.js`); (ב) לחתום (HMAC עם `AUTH_SECRET`, כמו `auth_session` ב-`lib/authTokens.js`) את חלק ה-`uiVariants` בעוגייה — החתימה חייבת להגיע מהשרת (למשל `GET /api/me/design-prefs` מחזיר טוקן חתום ו-`DesignPrefsSync` שומר אותו בעוגייה נפרדת), כי היום הלקוח כותב את העוגייה; (ג) לקרוא `Employee.themeColor` מה-DB ב-layout — פשוט אך מוסיף שאילתה לכל דף ומבטל את "אפס שאילתות חדשות" של 1.A. לא שונה קוד; ההחלטה של הבעלים.
- `app/layout.js` כבר מכריע `uiVariants.shell` (שורות 288–292) ומעביר ל-`UiVariantProvider`; הקורא בלקוח: `useUiVariant('shell')` (`app/components/UiVariantContext.js:30`).
- **החיבור בשלב 2 (השינוי היחיד ב-layout):** רכיב לקוח קטן `app/components/menu/ShellSwitch.js` שמקבל את כל ה-props של `AppShell` + `menuTree`, קורא `useUiVariant('shell')`, ומרנדר `<AppShell …>` (ללא שינוי) או `<MenuA5Shell …>`. ב-`layout.js` מחליפים את `<AppShell` ב-`<ShellSwitch` ומוסיפים `menuTree={buildMenuTree({...})}` (שורות 655–666). זה הכול. `AppShell.js` לא משתנה.
- **משתמשים בוריאנט `legacy` ממשיכים לראות את מה שהוסר** (סיכה, חצים ליד הלוגו, ריענון, מתג ערכת נושא, משלוחים, זיכויים, הקבוצה התחתונה בניהול) כי הקוד הישן לא נגע — ההפרדה היא רק הדגל. אין "חצי מצב": עובד הוא או בישן או בחדש, לפי ההכרעה בטעינה מלאה.

## 3. טבלת המיפוי — כל פריט בעיצוב המאושר

מקרא לעמודת "נראות": `legacy:<href>` = מוצג בדיוק כשהתפריט הישן (`buildNavGroups`) מציג את אותו href; `head` = `flags.showAdminTab` (מחובר: roleId 0/2; אורח: רק כש-`require_login` כבוי) — אותו כלל כמו `/admin`, `/employees`, `/dashboard` היום; `logged` = עובד מחובר; `prog` = roleId 2.

### 3.1 לשוניות ותתי-תפריטים

| פריט בעיצוב | קיים היום (path:שורה) | יעד | נראות (מפתח מדויק) | חסר / לבנות | סיכונים |
|---|---|---|---|---|---|
| **בית** (לשונית) | `navConfig.js:22` "בית וחיפוש" | `/` | `legacy:/` (תמיד) | — | — |
| בית › חיפוש כללי | `navConfig.js:22` | `/` | `legacy:/` | — | — |
| בית › אחרונים › הזמנות | `navConfig.js:33` | `/orders` | `legacy:/orders` = `page:orders` (`layout.js:233`) | — | בעיצוב זה "אחרונים"; באתר פותח את הרשימה המלאה (tip בעיצוב אומר זאת) |
| בית › אחרונים › לקוחות | `navConfig.js:54` | `/customers` | `legacy:/customers` = `page:customers` | — | — |
| בית › אחרונים › השכרות | `navConfig.js:34` | `/rentals#rented` | `legacy:/rentals#rented` = `page:rentals` | — | ניווט hash באותו path: הישן מטפל ב-`AppShell.js:124-133` (`handleNavClick`) — **לשכפל את הכלל** ב-MenuA5Shell |
| בית › אחרונים › החזרות | `navConfig.js:35` | `/rentals#returned` | `legacy:/rentals#returned` = `page:rentals` | — | כנ"ל |
| בית › אחרונים › תיקונים | `navConfig.js:38` | `/alterations` | `legacy:/alterations` = `enable_alterations!=='false'` ∧ `page:alterations` (`layout.js:229`) | — | — |
| בית › שינויים אחרונים (P04) | אין | — | **מוסתר** (`notBuilt`) עד שיהיה דף | לא בשלב זה | — |
| בית › חיפוש מתקדם (P05) | רק `/a5` הניסויי | — | **מוסתר** | לא בשלב זה | — |
| **לוז** + היום/מחר (P01) | אין | — | **מוסתר** (לשונית שלמה) | לא בשלב זה | — |
| **לוח חודשי** (לשונית) | `navConfig.js:56` | `/board` | `legacy:/board` = `showBoardTab` (`page:board`, `layout.js:219`) | — | — |
| **ניהול** (לשונית) | `navConfig.js:65` "לוח ניהול" | `/admin` (רק כש-`head`; אחרת `href:null` + `opensMenuOnly`) | מוצגת כשיש **לפחות תת-פריט אחד מותר** (D10, J02) | — | מנהלת סניף עם הרשאת דגמים רואה "ניהול" עם "דגמים" בלבד; לחיצה על הלשונית פותחת תפריט ולא מנווטת |
| ניהול › דגמים | `navConfig.js:45` (היום תחת "מלאי") | `/dashboard/dresses` | `legacy:/dashboard/dresses` = `showDressesTab` (`page:dresses_catalog`, `layout.js:212`) | — | — |
| ניהול › עובדים | `navConfig.js:55` "עובדים ונוכחות" | `/employees` | `legacy:/employees` = `showEmployeesTab` (= `head`) | — | — |
| ניהול › כספים | כרטיס ב-`/admin` + `app/dashboard/page.js:18` (`checkPageAccess(HEAD_MANAGEMENT_ROLES)`) | `/dashboard` | `head` | — | — |
| ניהול › הגדרות | `app/admin/settings` (layout `/admin`: `app/admin/layout.js:9`) | `/admin/settings` | `head` | — | — |
| ניהול › סטטיסטיקה | `app/admin/statistics` | `/admin/statistics` | `head` | — | — |
| ניהול › מידע / היסטוריה | `app/admin/data-history` | `/admin/data-history` | `head` | — | — |
| **הזמנה** (לשונית) | `navConfig.js:32` | `/orders/new` (כש-`showOrdersNew`; אחרת `href:null`) | מוצגת כשיש תת-פריט מותר | — | — |
| הזמנה › הזמנה חדשה | `navConfig.js:32` | `/orders/new` | `legacy:/orders/new` = `page:orders` ∧ `page:orders_new` (`layout.js:232`) | — | — |
| הזמנה › עמדת לקוח | `navConfig.js:57` | `/customer-interface` | `legacy:/customer-interface` (תמיד, כמו היום) | — | — |
| הזמנה › בדיקת מלאי (P03) | אין (רק מצב ב-`/a5`) | — | **מוסתר** | לא בשלב זה | — |

### 3.2 סרגל הצד (אייקונים)

| פריט | קיים היום | יעד / פעולה | נראות | חסר | סיכונים |
|---|---|---|---|---|---|
| חיפוש (לחיצה: פאנל; ריחוף/מיקוד: "נצפו לאחרונה") | `TopbarSearch.js` (תיבה קבועה בסרגל, `AppShell.js:230`) | פאנל: שדה → `GET /api/global-search?q=` (`TopbarSearch.js:68`), "הצג את כל התוצאות" → `/?q=` (`TopbarSearch.js:81-84`), "נצפו לאחרונה" + נקה, חצי אחורה/קדימה | תמיד (`rail.search.show`) | ריחוף 150ms, מיקוד מקלדת, לחיצה ארוכה במגע (SPEC 1.1); חצים בפאנל (R02) | הטופס "החזרה מהירה בברקוד" (`TopbarSearch.js:114-140`, `POST /api/returns/scan` שומר מיד) **לא עובר** לפאנל החדש — ברקוד ברצף לא נבנה (סעיף 8 ב-SPEC פתוח). עד אז: בוריאנט החדש אין החזרה בברקוד מהסרגל; יש בדף השכרות ובחלון ההזמנה. **שאלה לבעלים** |
| דיווח על שגיאה | `ErrorReportButton` (`AppShell.js:240`) | אותו רכיב | `!hide_error_reporting` (`layout.js:141`); ההרשאה `feature:error_reports` נאכפת ב-API | — | — |
| "האתר הישן" (זמני, J04/R12) | אין | פעולה `switch-to-legacy-shell` (**הצעה**) | `logged` | **יעד לא הוכרע** | ראו שאלה 1 בסעיף 7 |
| פעמון | `NotificationBell` (`AppShell.js:241`) | סעיף 3.3 | `logged` ∧ `!hide_internal_messaging` (`AppShell.js:241`) | — | — |
| מצב עבודה "במשמרת 3:42" | `UserMenu.js:143` (נקודה ירוקה/אדומה, `activeShift` מ-`GET /api/me`, `api/me/route.js:55-65`) | אותו מקור | `logged` | חישוב משך מ-`activeShift.entryTime` בלקוח (טיימר דקה) | `/api/me` נקרא דרך `fetchSharedJson` עם TTL — המשך מתעדכן רק בטעינה; מספיק לתצוגה |
| משתמש (אווטאר + שם + חץ) | `UserMenu.js:139-150` | סעיף 3.4 | תמיד (אורח = גרסת אורח) | — | — |
| המבורגר + מגירה (נייד) | `AppShell.js:180` + `.sidebar.open` | מגירה: חיפוש, חצים, לשוניות כאקורדיון, התראות, קבוצת כלים (דיווח + האתר הישן), משתמש | ≤767px | הכול חדש | פערי פלטה `sn-accrow` (סעיף 5) |

### 3.3 פאנל הפעמון

| פריט | קיים היום | יעד / API | נראות | חסר | סיכונים |
|---|---|---|---|---|---|
| מונה "לא נקראו" | `NotificationBell.js:32-44` `GET /api/notifications?light=1` כל 120 שנ', מושהה כשהטאב מוסתר, ובכל ניווט | אותו דבר (לא לשנות תדירות — מכסת Neon) | | — | **לא** להוסיף polling נוסף |
| רשימת ההתראות | `NotificationBell.js:19-29` `GET /api/notifications` בפתיחה | אותו API; שורה = שולח/מערכת, זמן, תוכן, "סמן כנקרא" (`POST /api/notifications/read {notificationId}`) | | — | ה-GET מחזיר עד 150 + outgoing 100 — כבד; לא לקרוא אותו בטעינה, רק בפתיחה (כמו היום) |
| "סמן הכל כנקרא" (Q6) | רק פר-הודעה (`api/notifications/read/route.js`) | **חסר endpoint.** תכנון: `POST /api/notifications/read` עם `{ all: true }` — אישי: `updateMany({ where:{ receiverId: me, isRead:false }, data:{ isRead:true } })`; כללי (receiverId null): לכל שורה שלא כוללת אותי ב-`readBy` — הוספה (לולאה על עד 150 השורות של ה-GET, או `findMany`+`update`); `updateMany` עוקף את הרחבת ה-AuditLog — זו אחת מהמקרים שבהם שורת AuditLog ידנית **מותרת**, אבל הודעות כבר לא נרשמות ממילא (`Notification` לא מוחרג — לבדוק: אם כן נרשם, להשתמש ב-`auditAs`) | `rail.bell.tools.markAllRead` | endpoint | ללא דיווח ב-AuditLog על "קריאה" — מקובל |
| "ניקוי" (Q6) | רק פר-הודעה (`api/notifications/archive/route.js`) | **חסר endpoint.** תכנון: `POST /api/notifications/archive` עם `{ all: true, archive: true }` — אישי: `isArchived=true`; כללי: הוספה ל-`archivedBy`. **משמעות:** "ניקוי" = העברה לארכיון (פר-משתמש), ההודעות נשארות במרכז ההודעות בלשונית ארכיון. לא מחיקה. | `rail.bell.tools.clearAll` | endpoint | לאשר עם הבעלים שניקוי = ארכיון ולא מחיקה (ברירת מחדל שנבחרה: ארכיון) |
| "פתח מרכז הודעות" | `NotificationBell.js:140-143` → `/messages` | `/messages` | `logged` ∧ `!hide_internal_messaging` ∧ **כשל-סגור**: עובדת/מנהלת סניף רק כש-`permissions['page:messages'] === true` נטען; הנהלה ראשית/מתכנת גם בלי מידע (resolvePageAccess מחזיר להם true תמיד); שורת הרשאה `false` מסתירה לכולם | **חובה** להוסיף `page:messages` ל-`NAV_PAGE_KEYS` ב-`layout.js:202` (עדיף: לייבא `NAV_PAGE_KEYS` מ-`lib/menu/buildMenuTree.js`) — אחרת השורה לא תופיע לאף עובדת שאינה הנהלה | היום הקישור מוצג גם למי שה-layout של `/messages` (`canOpenPage('page:messages')`) חוסם — העץ החדש מתקן זאת. `page:messages` סגור כברירת מחדל (`permissionsMetadata.js`), לכן בלי שורת הרשאה עובדת לא תראה את השורה — תואם את העמוד עצמו |
| "הודעה למנהל" (P02) | רק טופס בדף ההודעות: לשונית "הודעות להנהלה" (`app/messages/page.js:598, 705-712`) → `POST /api/notifications { receiverId:'all', title:'הודעה להנהלה', content, category:'management' }` (`page.js:183-191`); השרת מסרב כש-`management_messages!=='true'` (`api/notifications/route.js:134-143`) | פעולה `message-to-manager`: חלון קטן (חלון 2/… מהפלטה) עם שדה טקסט ו"שליחה למנהל" שקורא לאותו POST בדיוק | `logged` ∧ `!hide_internal_messaging` ∧ `management_messages==='true'` | חלון בלקוח (בלי API חדש) | הבעלים כתב "פותחת את חלון ההודעה הקיים" — אין חלון קיים, יש לשונית בדף. ברירת המחדל שנבחרה: חלון קטן על אותו API. חלופה: ניווט ל-`/messages` (ללא פרמטר ללשונית — צריך להוסיף `?tab=management`). ראו שאלה 3 |

### 3.4 פאנל המשתמש

| פריט | קיים היום | יעד | נראות | הערות |
|---|---|---|---|---|
| כותרת: שם, מצב משמרת, מחלקה | `UserMenu.js:154-168` | `GET /api/me` | | `user.name / initials / roleLabel / department` בעץ |
| הפרופיל שלי | `UserMenu.js:170-178` | `/profile` | `logged` | |
| שעון נוכחות | `UserMenu.js:179-187` | `/punch-clock` | `logged` | העמוד כופה מעטפת `legacy` (`isForcedLegacyPath`) — מעבר אליו מציג את הסרגל הישן; זה מכוון |
| שעות העבודה שלי | `UserMenu.js:188-196` | `/my-hours` | `logged` | |
| ~~הודעות~~ (R08) | `UserMenu.js:197-207` | — | **הוסר** (מכוסה בפעמון) | נשאר בישן |
| עיצוב ותצוגה | `UserMenu.js:208-216` | `/display-settings` | `logged` | בעיצוב המאושר (`תפריט-חדש.html`, `u-display` עם `logged:1`) אורח רואה **רק** "היכנס למערכת" — כמו היום. (גרסה קודמת של התוכנית טענה "גם אורח" — תוקן 1.10) |
| היסטוריית הודעות מערכת (R05) | `MessageHistoryButton` כאייקון בסרגל (`AppShell.js:239`, `isProgrammer`), נתונים מ-`PopupProvider.alertsHistory` (`PopupProvider.js:26,211`) | פעולה `system-messages-history` שפותחת את אותו חלון | `prog` | להוציא את החלון מ-`MessageHistoryButton.js` לרכיב שניתן לפתוח מבחוץ (או לרנדר אותו עם כפתור מוסתר) |
| ~~ריענון וניקוי פילטרים~~ (R03) | `AppShell.js:114-116, 235-237` | — | **הוסר** | |
| ~~מתג ערכת נושא~~ (R04) | `ThemeToggle` (`AppShell.js:238`) | — | **הוסר** | `theme_<id>` cookie ו-`data-theme` נשארים כפי שהם; מי שכבר במצב כהה נשאר בו עד ששינה ב-`/display-settings` |
| התנתקות | `UserMenu.js:66-95` (בדיקת איחורים → `POST /api/logout` → `location.href='/'`) | פעולה `logout` — **אותה פונקציה** (להוציא `handleLogout` ל-hook משותף) | `logged` | ה-hook המשותף חייב לקרוא ל-`clearNavHistoryStorage()` (`lib/menu/navHistory.js`) לפני `location.href='/'`, אחרת עובדת שנכנסת באותו טאב רואה תוויות (שמות לקוחות) מההיסטוריה של הקודמת. `agy_history` ב-localStorage כבר היום לא מתנקה — לשקול למחוק גם אותו באותו מקום |
| אורח: "היכנס למערכת" | `UserMenu.js:101-134` (`LoginScreen isModal`) | פעולה `login` | `!logged` | |

### 3.5 מותג (לוגו)

| פריט | קיים היום | יעד | הערות |
|---|---|---|---|
| לוגו מההגדרות (Q4) | `BrandLogo.js:7` `/api/logo` ← `SystemSetting BRAND_LOGO` (`api/logo/route.js:7-11`, 404 כשאין) ; `logo_timestamp` ב-localStorage ואירוע `logoUpdated` לרענון | אותו דבר (`brand.logoUrl`) | כשאין לוגו (404) מציגים טקסט: `brand.name` = `gmach_name` או `גמ"ח שמלות` (היום `BrandLogo.js:39` מציג תמיד 'גמ"ח שמלות'); `brand.subtitle` = `gmach_subtitle` |
| גרסה בטולטיפ (Q4) | `BrandLogo.js:13-15,49` `title="גירסא X \| date"` מ-`app/version.json` | `brand.tooltip` — ה-layout מעביר `version` (import של `app/version.json` בשרת) | להגדיר אחרי mount כמו היום (hydration) |

### 3.6 מה שהוסר — ואיך לא שוברים את הישן

| מזהה | מה | איפה הוא חי בישן | מה קורה בחדש |
|---|---|---|---|
| R01 | הצמדת קיצורים לסרגל | `AppShell.js:16-19, 41, 54-100, 158-171, 202-228` (`gemachPinnedNav` ב-localStorage) | לא מוצג. המפתח ב-localStorage נשאר (לא מוחקים) — אם העובד יחזור ל-legacy, הקיצורים חוזרים |
| R02 | חצים ליד הלוגו | `AppShell.js:183-194` (`router.back/forward`) | עברו לפאנל החיפוש על `lib/menu/navHistory.js` |
| R03 | ריענון וניקוי פילטרים | `AppShell.js:114-116, 235-237` | לא מוצג |
| R04 | מתג ערכת נושא | `ThemeToggle.js`, `AppShell.js:238` | לא מוצג |
| R09 | משלוחים | `navConfig.js:36` (`enable_deliveries` ∧ `page:deliveries`) | לא בעץ. **אין שום כניסה אחרת ל-`/deliveries`:** `grep` על `app/` ו-`lib/` (1.10) מראה שהקישור היחיד הוא `navConfig.js:36` (הכרטיסים ב-`app/admin/page.js` הם הגדרות/אתר/הרשאות/מחירון; ב-`app/page.js` לוח בקרה/מחירון/נוכחות/הודעות/שעון). אחרי המעבר ל-A5 העמוד נגיש רק בהקלדת כתובת. **נווה יעקב משתמשת במשלוחים יומית** — חוסם להדלקה שם, ראו שאלה 4 |
| R10 | זיכויים וחובות | `navConfig.js:37` | לא בעץ. **אין כניסה אחרת ל-`/refunds`** (אותו grep; `/dashboard` לא מקשר אליו). ראו שאלה 5 |
| R11 | הרשאות / מחירון / ניהול אתר / דוח נוכחות | כרטיסים ב-`/admin` (לא בסיידבר הישן) | לא בעץ; נגישים מ-`/admin` כמו היום |

`REMOVED_HREFS` ב-`buildMenuTree.js` + הבדיקה "הפריטים שהוסרו לעולם לא בעץ" מבטיחים שלא יחזרו בטעות.

## 4. API — קיים מול חסר

| צורך | קיים | חסר (שלב 2) |
|---|---|---|
| מי מחובר + משמרת | `GET /api/me` | — |
| הגדרות + הרשאות לעץ | מחושב בשרת ב-`app/layout.js` (settings 74–79, `resolvePageAccess` 205) | להוסיף `management_messages`, `gmach_name`, `gmach_subtitle`, `BRAND_LOGO` לרשימת המפתחות ב-`layout.js:75` (`BRAND_LOGO` רק כ-`!!value`, לא לשלוח את ה-base64 ללקוח!) ו-**`page:messages` ל-`NAV_PAGE_KEYS` (חובה — חוזה הקלט מתועד מעל `NAV_PAGE_KEYS`/`MENU_PAGE_KEYS` ב-`buildMenuTree.js`; בלי המפתח "פתח מרכז הודעות" מוסתר לכל מי שאינה הנהלה)** |
| חיפוש | `GET /api/global-search?q=` | — |
| התראות | `GET /api/notifications[?light=1]`, `POST read`, `POST archive` | `{ all:true }` בשני ה-POST (סעיף 3.3) |
| הודעה למנהל | `POST /api/notifications` + `category:'management'` | — |
| נצפו לאחרונה | `localStorage agy_history` (`lib/historyManager.js`) + `PageVisitLog` נכתב כבר (`PageTracker.js`, `api/log-visit`) | אופציונלי: `GET /api/me/recent-pages?limit=10` לפי `SERVER_RECENTS_CONTRACT` ב-`recents.js` (קריאה בלבד; שאילתת `PageVisitLog` של העובד + העשרת שמות). **לא חובה לשלב 2** — המיזוג של מחסנית הניווט + `agy_history` מספיק בלי קריאת שרת |
| היסטוריית ניווט | — (sessionStorage בלבד) | — |
| מעבר ל"אתר הישן" | `scripts/set-ui-variant.js` (CLI בלבד) | **`PUT /api/me/design-prefs` לא שומר `uiVariants`** — `app/api/me/design-prefs/route.js:71-75` מוחק את השדה במפורש (החלטת אבטחה: "עובד לא יכול להדליק לעצמו מסך חדש" — **דרך ה-API בלבד**; דרך עריכת העוגייה `designPrefs_<id>` בדפדפן שלו הוא כן יכול, כי ה-layout סומך על העוגייה — ר' הנקודה הפתוחה בסעיף 2). גרסה קודמת של התוכנית טענה אחרת — תוקן 1.10. אם הבעלים יבחר "מעבר לוריאנט legacy" צריך **endpoint ייעודי** (הצעה, לא נבנה): `POST /api/me/ui-variant/shell` שמקבל רק `{ value: 'legacy' }` (או `null` לביטול העקיפה) — לעולם לא `a5` — וכותב `themeColor.uiVariants.shell` דרך `mergeDesignPrefs` עם `uiVariants` מותר רק במסלול הזה; מחובר בלבד; מחזיר `{ ok }`, הלקוח עושה טעינה מלאה. עד שיוחלט: האייקון "האתר הישן" מוצג עם `action: 'switch-to-legacy-shell'` ואין לו מימוש — ראו שאלה 1 |

## 5. שלב 2 — הנחיות לסוכן הממשק (Sonnet)

**כללים:** רק רכיבי הפלטה הממוספרים (`design-system/COMPONENTS.md`), `import '@/design-system/components.css'` בהיקף `.gm-ds` (לא גלובלי), אייקונים מ-`/design-system/sprite.svg#i-*` (כל האייקונים שהעץ פולט קיימים ב-sprite, כולל `i-sn-history / i-sn-inv / i-sn-chart / i-sn-bug`), RTL, בלי המצאת רכיב. אין `next dev` ב-worktree משותף — לבדוק מול שרת של הסשן.

רכיבי הפלטה שהעיצוב משתמש בהם (מהרשימה `PAL` בקובץ העיצוב): סרגל/מותג/לשוניות — ניווט 2/42/60, 10, 17/22/26/51/64/65; פאנל ושורות — ניווט 66/67, 24/37/73, 78/80; רשימה גוללת — היסטוריה 9/39/40/42 (`hf-l`); אייקוני סרגל/פעמון/מונה — ניווט 84/85, 89, 30/58, 32, 34, 90/122; חיפוש — ניווט 12/28/53, שדה 23/26, לחצן 41/44, לחצן 12 ("נקה"); מגירת נייד — ניווט 7, 14/15/49/94/95/103, 97/101/115, 16; חלונות — חלון `#dlg` של העיצוב.
**פערי פלטה (D11, J07):** `.sn-cv` (חץ הלשונית), `.sn-k` (טקסט צדדי), `.is-miss` (שורה עמומה), `.sn-accrow` (שורת קבוצה במגירה). `.is-miss` לא נדרש (פריטים שלא קיימים מוסתרים, לא מעומעמים); `.sn-k` נדרש רק לתווית "זמני" — אפשר תג המונה ניווט 30/58; `.sn-cv` ו-`.sn-accrow` **נדרשים** — לשאול את הבעלים אם להוסיף לפלטה (שאלה 7).

**קבצים ליצירה (הצעה):**

| קובץ | תפקיד |
|---|---|
| `app/components/menu/ShellSwitch.js` | `useUiVariant('shell')` → `AppShell` או `MenuA5Shell` (סעיף 2) |
| `app/components/menu/MenuA5Shell.js` | הסרגל העליון: מותג, לשוניות (`tree.tabs`), סרגל צד (`tree.rail`), מגירה בנייד, `findActive` לסימון הנוכחי, `handleNavClick` ל-hash (העתק מ-`AppShell.js:124-133`); מרנדר `OverdueRemindersWatcher`/`ShiftMessageWatcher` כמו `AppShell.js:140-141` |
| `app/components/menu/MenuTabPanel.js` | פאנל לשונית: ריחוף לעכבר, חץ ללחיצה/מקלדת, ArrowDown/Up/Home/End, Escape, סגירה בלחיצה בחוץ (אותה התנהגות כמו `script2.js` בעיצוב, שורות 373–423) |
| `app/components/menu/MenuSearchPanel.js` | שדה חיפוש → `/api/global-search` (דיבאונס 350, מינימום 2 תווים, 15 תוצאות, "הצג את כל התוצאות") — להעביר מ-`TopbarSearch.js:54-91`; שורת חצים (`buttonLabels`), "נצפו לאחרונה" (`mergeRecents({ nav: recentsView(state), legacy: getHistory() })`) + נקה (`clear` + `localStorage.removeItem('agy_history')`); peek בריחוף 150ms / מיקוד / לחיצה ארוכה 500ms |
| `app/components/menu/useNavHistory.js` | hook: טוען מ-`sessionStorage[NAV_HISTORY_STORAGE_KEY]`, `visit` על כל שינוי `usePathname()+hash` אלא אם הניווט הגיע מ-`back/forward/go` (ref `fromHistory`), שומר אחרי כל שינוי; תווית = `findActive` → תווית הפריט, אחרת `document.title`; `relabel` כשדפים משדרים `agy_history_updated` (מ-`addHistory`). ניווט מההיסטוריה: `router.push(entry.path)` — הנתיב כבר מנורמל (`normalizeNavPath` חוסם `//`/`/\`, תווי בקרה, סכימות, וכל מה שלא מתפענח לאותו origin), לא להעביר כתובת גולמית מהאחסון. ב-hook ההתנתקות: `clearNavHistoryStorage()` |
| `app/components/menu/MenuBell.js` | פעמון: להעביר את הלוגיקה מ-`NotificationBell.js` (polling 120 שנ', visibilitychange, רענון בניווט) כפי שהיא; כותרת עם "סמן הכל כנקרא"/"ניקוי"; שורות `tree.rail.bell.rows` |
| `app/components/menu/MenuUserPanel.js` | כותרת + `tree.user.items`; פעולות `logout` (העתק `handleLogout`), `login` (`LoginScreen isModal`), `system-messages-history` |
| `app/components/menu/ManagerMessageDialog.js` | "הודעה למנהל" (סעיף 3.3) |
| `app/components/menu/menu.css` | רק הרכבות (`.sn-hist`, `.sn-msg`) על רכיבי הפלטה, בהיקף `.gm-ds.gm-menu` |
| `app/api/notifications/read/route.js`, `archive/route.js` | תמיכה ב-`{ all: true }` |

**בדיקות קבלה לשלב 2** (עם `/api/dev/agent-login`, לא סיסמה): (1) `ui_variant_shell` חסר → האתר זהה לקודם, פיקסל-לפיקסל בסרגל. (2) עקיפה אישית `shell=a5` לעובד בדיקה → התפריט החדש רק לו. (3) ארבעת התפקידים + אורח (פתוח/סגור) → הלשוניות כמו ב-`test_menu_logic.mjs`. (4) `/customer-interface`, `/punch-clock`, `/print/*` → תמיד הישן. (5) אחורה/קדימה: 3 ביקורים, אחורה ×2, קדימה, ביקור חדש מנקה קדימה, גבולות, נקה, רענון הטאב שומר (sessionStorage), טאב חדש ריק. (6) פעמון: מונה, סמן הכל, ניקוי → ארכיון ב-`/messages`. (7) הודעה למנהל כש-`management_messages` כבוי → השורה לא קיימת. (8) נייד 375px: מגירה, אקורדיון, Escape. (9) RTL: `getBoundingClientRect` של הלוגו מימין, הכלים משמאל. (10) `npx eslint` על הקבצים; `node scripts/test_menu_logic.mjs`.

## 6. החלטות ברירת מחדל שהתקבלו כאן (ניתנות לשינוי)

1. דגל הווריאנט הוא `shell` הקיים, לא `menu` חדש.
2. העץ מחושב בשרת (`layout.js`) ומועבר ל-props, בלי קריאת API נוספת; שינוי הרשאות נכנס לתוקף בטעינה מלאה (כמו הסיידבר היום).
3. לשונית שתפריטה ריק לא מוצגת; לשונית שדף הבסיס שלה אסור (ניהול למנהלת סניף, הזמנה לעובדת בלי `page:orders_new`) מקבלת `href:null` ורק פותחת תפריט.
4. "ניקוי" בפעמון = ארכיון פר-משתמש (לא מחיקה).
5. "הודעה למנהל" = חלון קטן על ה-API הקיים (`category:'management'`), מוצג רק כשההגדרה פעילה.
6. "פתח מרכז הודעות" — כשל-סגור על `page:messages`: בלי מידע הרשאה מוצג רק להנהלה ראשית/מתכנת (עודכן 1.10 אחרי הסקירה).
7. "נצפו לאחרונה" = מיזוג מחסנית הניווט (sessionStorage) + `agy_history` (localStorage); בלי קריאת שרת בשלב 2; סריקות ברקוד לא נרשמות.
8. "עיצוב ותצוגה" רק למחובר — אורח רואה רק "היכנס למערכת", כמו בעיצוב המאושר (`u-display` עם `logged:1`). (עודכן 1.10; הניסוח הקודם "גם לאורח" היה שגוי.)
9. ברקוד בשורת החיפוש והחזרה מהירה **לא** בוריאנט החדש בשלב 2 (ממתין לסעיף 8 ב-SPEC).
10. הגדרות נבדקות בקפדנות `=== 'true'` / `=== 'false'` כמו `app/layout.js` ו-`api/notifications` — ערך כמו `' True'` לא מדליק שורה שהשרת יסרב לה.

## 7. שאלות פתוחות לבעלים

1. **"האתר הישן" — לאן מקשר?** אין כתובת של "אתר ישן": אותו אתר, שתי מעטפות. הצעה: לחיצה שומרת עקיפה אישית `shell=legacy` וטוענת מחדש — העובד חוזר לתפריט הישן, וחזרה דרך `/display-settings` (או סקריפט). **דורש endpoint חדש** (ראו סעיף 4, שורת "מעבר לאתר הישן"): `PUT /api/me/design-prefs` מוחק `uiVariants` בכוונה (`route.js:75`), ואין היום דרך לעובד לשנות את זה בעצמו. ההצעה: endpoint שמאפשר *רק* `legacy`/ביטול, כדי לא לפתוח לעובדים הדלקה עצמית של A5. לאשר את ההצעה (ובכך לרכך את ההחלטה "רק הבעלים משנה וריאנט" לכיוון אחד בלבד), או להשאיר את האייקון בלי פעולה / להסירו.
2. **ברקוד מהסרגל בינתיים:** בוריאנט החדש אין "החזרה מהירה בברקוד" עד שזרם הברקוד ברצף ייבנה (10 שאלות ב-SPEC סעיף 8). מקובל להשיק כך (החזרה נשארת בדף השכרות ובחלון ההזמנה), או להעביר את הטופס הישן כפי שהוא לפאנל החדש כגשר?
3. **"הודעה למנהל":** חלון קטן (ברירת המחדל כאן) או מעבר לדף ההודעות ללשונית "להנהלה"?
4. **משלוחים (R09) — חוסם להדלקה בנווה יעקב.** הוסר מהתפריט לפי ההחלטה, אבל **אין שום קישור אחר ל-`/deliveries` באתר** (הקישור היחיד הוא `navConfig.js:36`; אומת ב-grep 1.10) — אחרי המעבר ל-A5 העובדות בנווה יעקב, שמשתמשות במשלוחים יומית, יגיעו לדף רק בהקלדת כתובת. **אין להדליק `shell=a5` בנווה יעקב לפני החלטה.** חלופות:
   - (א) להשאיר שורת "משלוחים" בתפריט החדש (למשל תחת "הזמנה" או "בית › אחרונים"), מוצגת רק כש-`enable_deliveries=true` ∧ `page:deliveries` — כלומר בגמ"ח הראשי (ההגדרה כבויה) היא לא תופיע בכלל, וההחלטה R09 נשמרת שם. שינוי קטן ב-`ITEM_DEFS`.
   - (ב) כניסה מדף אחר: אריח "משלוחים להיום" בדף הבית / בלוח החודשי / בכרטיס ההזמנה (קישור לדף עם תאריך). שינוי בדפים, לא בתפריט; פחות נגיש ("יומי" = צריך להיות בלחיצה אחת).
   - (ג) להשאיר את נווה יעקב על הוריאנט `legacy` (ברירת המחדל) עד שתוכרע חלופה — בלי שינוי קוד; הגמ"ח הראשי עובר ל-A5 לבד.
5. **זיכויים וחובות (R10) "שייך לכספים":** גם ל-`/refunds` **אין היום שום קישור חוץ מ-`navConfig.js:37`** (`/dashboard` לא מקשר אליו). אחרי המעבר העמוד נגיש רק בהקלדת כתובת. חלופות: (א) אריח/קישור "זיכויים וחובות" בדף "כספים" (`/dashboard`) — שינוי בדף, מתאים להחלטה "שייך לכספים"; (ב) תת-פריט "זיכויים" תחת "ניהול › כספים" בתפריט (מוצג לפי `page:refunds`, כמו היום); (ג) להשאיר בלי כניסה זמנית — לא מומלץ: אומת (grep על `href=`/`router.push` ב-`app/`) שגם כרטיס ההזמנה וכרטיס הלקוח לא מקשרים לדף `/refunds` (כרטיס הלקוח רק קורא ל-`/api/refunds?customerId=`).
6. **"ניקוי" בפעמון = ארכיון** (ההודעות נשארות בלשונית ארכיון במרכז ההודעות) — לאשר.
7. **פערי פלטה (D11):** להוסיף לפלטה "חץ לשונית" (`sn-cv`) ו"שורת קבוצה במגירה" (`sn-accrow`) כרכיבים ממוספרים לפני הבנייה?
8. ~~"עיצוב ותצוגה" לאורח~~ — **נסגר 1.10:** בדיקה חוזרת של העיצוב המאושר מראה `logged:1` על הפריט, כלומר אורח רואה רק "היכנס למערכת" (כמו היום). הקוד והבדיקה יושרו לעיצוב; אין שאלה.
9. **הודעות "ניהול" למנהלת סניף:** בעיצוב "ניהול" מוצג למנהלת סניף עם "דגמים" בלבד; הלשונית לא מנווטת ל-`/admin` (אסור לה). לאשר את ההתנהגות "לחיצה פותחת את התפריט".
10. **הדגל האישי ניתן לעריכה בעוגייה (סעיף 2, נקודה פתוחה):** לפני R1 לבחור — לקבל את הסיכון בידיעה (הדגל תצוגה בלבד), לחתום את `uiVariants` בעוגייה, או לקרוא מה-DB ב-layout (עלות: שאילתה לכל דף).

## 8. סיכונים

- **שתי מעטפות במקביל** = כפילות קוד זמנית (פעמון, חיפוש, התנתקות). להעביר לוגיקה ל-hooks משותפים ולא להעתיק; אחרת תיקון באג ייכנס רק לאחת.
- `GET /api/notifications` כבד; לא לקרוא אותו בטעינה. Polling נשאר 120 שנ' ו-`light=1` (מכסת Neon 5GB).
- `BRAND_LOGO` הוא base64 — לעולם לא לכלול את הערך ב-props של העץ (רק `hasLogoSetting`).
- העץ נבנה ב-root layout שלא מרונדר מחדש בניווט רך; `findActive` בלקוח מטפל בסימון הנוכחי. שינוי הרשאה/הגדרה דורש טעינה מלאה (כמו היום).
- `sessionStorage` נפרד לכל טאב: פתיחת קישור בטאב חדש מתחילה היסטוריה ריקה (מכוון; זה גם מה שהדפדפן עושה).
- פאנל שנפתח בריחוף על מסך מגע: אין ריחוף — החץ/לחיצה ארוכה חייבים לעבוד; לבדוק במכשיר.
- שני גמ"חים: אין קוד לפי org. כל ההבדלים דרך `SystemSetting` (`management_messages`, `enable_alterations`, `enable_deliveries`, `hide_*`, `gmach_name`, `BRAND_LOGO`, `ui_variant_shell`). הדלקת הווריאנט — בכל DB בנפרד, עם בדיקת host.

## 9. מה לא נבדק בשלב 1

לא הורץ `next dev`/`next build` (אסור ב-worktree משותף; המודולים טהורים ואינם מיובאים עדיין משום רכיב). לא נבדק מול DB. לא נבדק שהעיצוב נראה כך בפועל — זה שלב 2.
