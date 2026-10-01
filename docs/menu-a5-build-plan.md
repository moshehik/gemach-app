# תוכנית בנייה: התפריט החדש (A5) באתר האמיתי

**סטטוס:** תכנית (שלב 1 הושלם: לוגיקה טהורה + תכנית; שלב 2 — ממשק — טרם נבנה). נכתב 1.10.2026 בענף `feature/menu-a5-2026-10-01` (עץ `wt-menu-a5`), על גבי `feature/a5-integration-2026-09-29`.
**מקורות האמת:** `scratch\schedule-build\DECISIONS-תפריט.md` (החלטות הבעלים), העיצוב המאושר `תצוגות-עיצוב\תפריט-חדש.html` (המערכים `REGISTER` R01–R12, `PENDING` P01–P05, `NOTES` J01–J08 בסוף הקובץ הם החוזה), ו-`scratch\menu-search\SPEC-ברקוד-ואחורה-קדימה.md` (רק סעיף 1.6 — אחורה/קדימה ו"נצפו לאחרונה"; **זרם הברקוד ברצף לא נבנה**, 10 שאלות פתוחות בסעיף 8 שם).

## 1. מה נבנה בשלב 1 (קיים בענף)

| קובץ | מה זה |
|---|---|
| `lib/menu/buildMenuTree.js` | `buildMenuTree({ user, roleId, permissions, settings, flags, org, available, version, status })` → עץ התפריט הסופי כ-JSON נקי. עוטף את `buildNavGroups` מ-`app/components/navConfig.js` (מקור האמת לנראות של כל מה שיש לו שורה בתפריט הישן) ואת אותם דגלים ש-`app/layout.js` כבר מחשב (`deriveLegacyFlags` משחזר אותם אחד-לאחד). גם `findActive(tree, pathname, hash)`, `flattenMenuTree`, `isJsonSafe`, `REMOVED_ITEMS`, `NOT_BUILT_ITEM_IDS`, `NAV_PAGE_KEYS`. |
| `lib/menu/navHistory.js` | מחסנית צפייה אחורה/קדימה לפי כללי דפדפן (`visit / back / forward / go / clear / relabel`, `recentsView`, `buttonLabels`, `serializeNavHistory / deserializeNavHistory` ל-sessionStorage, `shouldRecordPath`). אי-שינוי קלט, תקרה 10. |
| `lib/menu/recents.js` | "נצפו לאחרונה": זיהוי ישות מנתיב (`parseEntityPath`), המרה משלושת המקורות (מחסנית הניווט, `agy_history` הישן, שורות `PageVisitLog`) ו-`mergeRecents` עם ביטול כפילויות. בלי DDL. |
| `scripts/test_menu_logic.mjs` | 57 בדיקות יחידה בסגנון `scripts/test_ui_variant.mjs` (`node scripts/test_menu_logic.mjs`). |

**לא נגעו:** `app/components/AppShell.js`, `navConfig.js`, `UserMenu.js`, `TopbarSearch.js`, `NotificationBell.js`, `BrandLogo.js`, `app/layout.js`, `prisma/schema.prisma`, שום API.

## 2. הדגל (וריאנט) — איך התפריט החדש מוסתר

- `lib/uiVariant.js` כבר מגדיר מסך **`shell`** ("המעטפת/התפריט"), ערכים `legacy | a5`, ברירת מחדל `legacy`, הכרעה: עקיפה אישית (`Employee.themeColor.uiVariants.shell`) > הגדרת הארגון `SystemSetting ui_variant_shell` > `legacy`. קיוסק / שעון נוכחות / הדפסה תמיד `legacy` (`isForcedLegacyPath`). **לא נוסף מסך `menu`** — המעטפת היא התפריט, ושני דגלים לאותו דבר היו מתנגשים.
- הדלקה: `node scripts/set-ui-variant.js --screen shell --value a5 --scope user --employee <legacyId> --confirm-host <host>` (עובד אחד לבדיקה), או `--scope org` לכל הגמ"ח. בכל DB בנפרד (שני הגמ"חים = שני DB).
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
| "פתח מרכז הודעות" | `NotificationBell.js:140-143` → `/messages` | `/messages` | `logged` ∧ `!hide_internal_messaging` ∧ (`permissions['page:messages']` אם נטען, אחרת מוצג כמו היום) | להוסיף `page:messages` ל-`NAV_PAGE_KEYS` ב-`layout.js:202` (כבר ב-`lib/menu/buildMenuTree.js NAV_PAGE_KEYS`) | היום הקישור מוצג גם למי שה-layout של `/messages` (`canOpenPage('page:messages')`) חוסם — העץ החדש מתקן זאת |
| "הודעה למנהל" (P02) | רק טופס בדף ההודעות: לשונית "הודעות להנהלה" (`app/messages/page.js:598, 705-712`) → `POST /api/notifications { receiverId:'all', title:'הודעה להנהלה', content, category:'management' }` (`page.js:183-191`); השרת מסרב כש-`management_messages!=='true'` (`api/notifications/route.js:134-143`) | פעולה `message-to-manager`: חלון קטן (חלון 2/… מהפלטה) עם שדה טקסט ו"שליחה למנהל" שקורא לאותו POST בדיוק | `logged` ∧ `!hide_internal_messaging` ∧ `management_messages==='true'` | חלון בלקוח (בלי API חדש) | הבעלים כתב "פותחת את חלון ההודעה הקיים" — אין חלון קיים, יש לשונית בדף. ברירת המחדל שנבחרה: חלון קטן על אותו API. חלופה: ניווט ל-`/messages` (ללא פרמטר ללשונית — צריך להוסיף `?tab=management`). ראו שאלה 3 |

### 3.4 פאנל המשתמש

| פריט | קיים היום | יעד | נראות | הערות |
|---|---|---|---|---|
| כותרת: שם, מצב משמרת, מחלקה | `UserMenu.js:154-168` | `GET /api/me` | | `user.name / initials / roleLabel / department` בעץ |
| הפרופיל שלי | `UserMenu.js:170-178` | `/profile` | `logged` | |
| שעון נוכחות | `UserMenu.js:179-187` | `/punch-clock` | `logged` | העמוד כופה מעטפת `legacy` (`isForcedLegacyPath`) — מעבר אליו מציג את הסרגל הישן; זה מכוון |
| שעות העבודה שלי | `UserMenu.js:188-196` | `/my-hours` | `logged` | |
| ~~הודעות~~ (R08) | `UserMenu.js:197-207` | — | **הוסר** (מכוסה בפעמון) | נשאר בישן |
| עיצוב ותצוגה | `UserMenu.js:208-216` | `/display-settings` | תמיד (גם אורח, לפי העיצוב `userItems`) | היום לאורח אין את זה; העיצוב מציג — אושר כחלק מהעיצוב |
| היסטוריית הודעות מערכת (R05) | `MessageHistoryButton` כאייקון בסרגל (`AppShell.js:239`, `isProgrammer`), נתונים מ-`PopupProvider.alertsHistory` (`PopupProvider.js:26,211`) | פעולה `system-messages-history` שפותחת את אותו חלון | `prog` | להוציא את החלון מ-`MessageHistoryButton.js` לרכיב שניתן לפתוח מבחוץ (או לרנדר אותו עם כפתור מוסתר) |
| ~~ריענון וניקוי פילטרים~~ (R03) | `AppShell.js:114-116, 235-237` | — | **הוסר** | |
| ~~מתג ערכת נושא~~ (R04) | `ThemeToggle` (`AppShell.js:238`) | — | **הוסר** | `theme_<id>` cookie ו-`data-theme` נשארים כפי שהם; מי שכבר במצב כהה נשאר בו עד ששינה ב-`/display-settings` |
| התנתקות | `UserMenu.js:66-95` (בדיקת איחורים → `POST /api/logout` → `location.href='/'`) | פעולה `logout` — **אותה פונקציה** (להוציא `handleLogout` ל-hook משותף) | `logged` | |
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
| R09 | משלוחים | `navConfig.js:36` (`enable_deliveries` ∧ `page:deliveries`) | לא בעץ. הדף `/deliveries` נשאר נגיש מכרטיסי `/admin`/בית ומקישורים; **לנווה יעקב (שם המשלוחים פעילים) זה פריט שנעלם מהתפריט** — ראו שאלה 4 |
| R10 | זיכויים וחובות | `navConfig.js:37` | לא בעץ. `/refunds` נגיש דרך "כספים"? **לא** — `/dashboard` לא מקשר ל-`/refunds` היום. ראו שאלה 5 |
| R11 | הרשאות / מחירון / ניהול אתר / דוח נוכחות | כרטיסים ב-`/admin` (לא בסיידבר הישן) | לא בעץ; נגישים מ-`/admin` כמו היום |

`REMOVED_HREFS` ב-`buildMenuTree.js` + הבדיקה "הפריטים שהוסרו לעולם לא בעץ" מבטיחים שלא יחזרו בטעות.

## 4. API — קיים מול חסר

| צורך | קיים | חסר (שלב 2) |
|---|---|---|
| מי מחובר + משמרת | `GET /api/me` | — |
| הגדרות + הרשאות לעץ | מחושב בשרת ב-`app/layout.js` (settings 74–79, `resolvePageAccess` 205) | להוסיף `management_messages`, `gmach_name`, `gmach_subtitle`, `BRAND_LOGO` לרשימת המפתחות ב-`layout.js:75` (`BRAND_LOGO` רק כ-`!!value`, לא לשלוח את ה-base64 ללקוח!) ו-`page:messages` ל-`NAV_PAGE_KEYS` |
| חיפוש | `GET /api/global-search?q=` | — |
| התראות | `GET /api/notifications[?light=1]`, `POST read`, `POST archive` | `{ all:true }` בשני ה-POST (סעיף 3.3) |
| הודעה למנהל | `POST /api/notifications` + `category:'management'` | — |
| נצפו לאחרונה | `localStorage agy_history` (`lib/historyManager.js`) + `PageVisitLog` נכתב כבר (`PageTracker.js`, `api/log-visit`) | אופציונלי: `GET /api/me/recent-pages?limit=10` לפי `SERVER_RECENTS_CONTRACT` ב-`recents.js` (קריאה בלבד; שאילתת `PageVisitLog` של העובד + העשרת שמות). **לא חובה לשלב 2** — המיזוג של מחסנית הניווט + `agy_history` מספיק בלי קריאת שרת |
| היסטוריית ניווט | — (sessionStorage בלבד) | — |
| מעבר ל"אתר הישן" | `scripts/set-ui-variant.js` (CLI בלבד) | אם הבעלים יבחר "מעבר לוריאנט legacy": `PUT /api/me/design-prefs` כבר שומר `uiVariants` (`sanitizeDesignPrefs`) — צריך רק קריאה מהלקוח `{ uiVariants: { shell: 'legacy' } }` + טעינה מלאה |

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
| `app/components/menu/useNavHistory.js` | hook: טוען מ-`sessionStorage[NAV_HISTORY_STORAGE_KEY]`, `visit` על כל שינוי `usePathname()+hash` אלא אם הניווט הגיע מ-`back/forward/go` (ref `fromHistory`), שומר אחרי כל שינוי; תווית = `findActive` → תווית הפריט, אחרת `document.title`; `relabel` כשדפים משדרים `agy_history_updated` (מ-`addHistory`) |
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
6. "פתח מרכז הודעות" מכבד `page:messages` כשההרשאות נטענו.
7. "נצפו לאחרונה" = מיזוג מחסנית הניווט (sessionStorage) + `agy_history` (localStorage); בלי קריאת שרת בשלב 2; סריקות ברקוד לא נרשמות.
8. "עיצוב ותצוגה" מוצג גם לאורח (לפי `userItems` בעיצוב).
9. ברקוד בשורת החיפוש והחזרה מהירה **לא** בוריאנט החדש בשלב 2 (ממתין לסעיף 8 ב-SPEC).

## 7. שאלות פתוחות לבעלים

1. **"האתר הישן" — לאן מקשר?** אין כתובת של "אתר ישן": אותו אתר, שתי מעטפות. הצעה: לחיצה שומרת עקיפה אישית `shell=legacy` (`PUT /api/me/design-prefs`) וטוענת מחדש — העובד חוזר לתפריט הישן, וחזרה דרך `/display-settings` (או סקריפט). לאשר, או לתת יעד אחר.
2. **ברקוד מהסרגל בינתיים:** בוריאנט החדש אין "החזרה מהירה בברקוד" עד שזרם הברקוד ברצף ייבנה (10 שאלות ב-SPEC סעיף 8). מקובל להשיק כך (החזרה נשארת בדף השכרות ובחלון ההזמנה), או להעביר את הטופס הישן כפי שהוא לפאנל החדש כגשר?
3. **"הודעה למנהל":** חלון קטן (ברירת המחדל כאן) או מעבר לדף ההודעות ללשונית "להנהלה"?
4. **משלוחים (R09) בנווה יעקב:** הוסר מהתפריט לפי ההחלטה; הדף `/deliveries` יישאר נגיש רק מכרטיסים/קישורים. לאשר שזה בסדר גם לנווה יעקב, שם המשלוחים בשימוש יומי.
5. **זיכויים וחובות (R10) "שייך לכספים":** דף "כספים" (`/dashboard`) לא מקשר היום ל-`/refunds`. להוסיף שם קישור/אריח "זיכויים וחובות"? (שינוי בדף `/dashboard`, לא בתפריט.)
6. **"ניקוי" בפעמון = ארכיון** (ההודעות נשארות בלשונית ארכיון במרכז ההודעות) — לאשר.
7. **פערי פלטה (D11):** להוסיף לפלטה "חץ לשונית" (`sn-cv`) ו"שורת קבוצה במגירה" (`sn-accrow`) כרכיבים ממוספרים לפני הבנייה?
8. **"עיצוב ותצוגה" לאורח** — בעיצוב מוצג גם למי שלא מחובר (היום לא). לאשר.
9. **הודעות "ניהול" למנהלת סניף:** בעיצוב "ניהול" מוצג למנהלת סניף עם "דגמים" בלבד; הלשונית לא מנווטת ל-`/admin` (אסור לה). לאשר את ההתנהגות "לחיצה פותחת את התפריט".

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
