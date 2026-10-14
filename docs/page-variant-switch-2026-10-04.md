# מעבר "ישן / חדש" בכל דף — 4.10.2026

בקשת הבעלים: בכל דף שיש לו גם גרסה חדשה וגם ישנה — אייקון ייעודי למעבר לתצוגה החדשה ולחזרה לישנה, בנוסף למתגים הקיימים
(הגדרות הארגון, דף "עיצוב ותצוגה", עקיפה אישית). ענף: `feature/page-variant-switch-2026-10-04`.

**החלטת הבעלים (4.10.2026, באמצע העבודה):** האתר נפתח בעיצוב **הישן לכולם, חוץ מהמתכנת** (roleId 2). כל אפשרויות המעבר נשארות.
באותו יום נכתבו בשני ה-DB של הייצור `ui_variant_shell='legacy'` ו-`ui_variant_home='legacy'` (במקום ה-'a5' שנכתב קודם באותו
יום). לחשבון המתכנת יש עקיפות אישיות: בגמ"ח הראשי shell/home='a5'; בנווה יעקב shell='legacy', home='a5'.

## מי רשאי לבחור את החדש - כולם (החלטת הבעלים, 11.10.2026)

> "כולם דלוק לכולם אם בוחרים באתר החדש, כל עוד הם לא בוחרים בעצמם הוא נשאר בישן חוץ ממני שהוא ברירת מחדל בחדש"

* **כל עיצוב חדש זמין לכל עובד פעיל** (כל roleId, כולל מנהל סניף, מזכירה, תופרת ועובד בלי תפקיד): כל אחד מחליף לעצמו, מסך-מסך, באייקון
  `PageVariantToggle` או בדף "עיצוב ותצוגה". כל עוד לא בחר - נשאר בישן; רק המתכנת (roleId 2) מקבל את החדש כברירת מחדל
  (`NEW_DESIGN_DEFAULT_ROLE_IDS` - לא השתנה). סדר ההכרעה (עקיפה אישית > הגדרת ארגון > ברירת מחדל לפי תפקיד) לא השתנה, ולא נכתבה שום הגדרת ארגון.
* **הכלל במקום אחד:** `canEmployeeSelfSwitch(employee)` ב-`lib/uiVariantSelfSwitch.js` - עובד מאומת ופעיל (`isActive === true` מה-DB). אותה פונקציה
  משמשת את ה-POST/GET (`applyUiVariantRequest`, `describeSelfSwitch`), את `app/layout.js` (הצגת האייקון) ואת הבדיקות. נמחקו `isManagementRole`,
  `SELF_SWITCH_ROLE_IDS` וההודעות `a5Forbidden` / `homeForbidden`, וגם החריג של `shell` (עכשיו כל עובד רשאי להחליף גם אותו ל-`a5`).
* **איך מצמצמים שוב:** בקובץ אחד, `lib/uiVariantSelfSwitch.js`: `SELF_SWITCH_ONLY_ROLE_IDS = null` (כולם) -> `Object.freeze([0, 2])` (רק הנהלה ראשית ומתכנת)
  או כל רשימת roleId אחרת. השרת, ה-layout, הדף וה-API נגזרים ממנו; את הבדיקות מעדכנים (`scripts/test_ui_variant_self_switch.mjs`, `test_page_variant_switch.mjs`).
* **מה לא השתנה (אבטחה):** העובד המטרה הוא תמיד המאומת (העוגייה החתומה; גוף הבקשה לא יכול להכיל מזהה עובד), הפעילות והתפקיד נקראים מה-DB בצד שרת,
  לא מאומת 401, מושבת 403, מסך לא מוכר / בלי שתי גרסאות 404/400, תקרת גודל ל-`themeColor`, וריענון עוגיית `designPrefs_<id>` החתומה.
  `PUT /api/me/design-prefs` ממשיך למחוק `uiVariants`. **החלפה לעיצוב החדש לא נותנת שום הרשאה:** הדפים החדשים עוברים באותם layouts (`/admin`, `/employees`,
  `/dashboard/dresses`) ומשתמשים באותם API מוגנים - ר' `docs/a5-staff-models/security-audit.md` סעיף 8.

## סדר ההכרעה (lib/uiVariant.js)

1. **עקיפה אישית** — `Employee.themeColor.uiVariants.<screen>` (המראה המהירה: עוגיית `designPrefs_<id>`).
2. **הגדרת הארגון** — `SystemSetting ui_variant_<screen>` = `legacy` / `a5` (כל גמ"ח ב-DB שלו).
3. **ברירת מחדל לפי תפקיד** — `roleDefaultVariant` ב-`lib/uiVariantScreens.js`: מתכנת (`NEW_DESIGN_DEFAULT_ROLE_IDS = [2]`,
   זהה ל-`DEVELOPER_ONLY_ROLES`) מקבל את החדש בכל מסך שהגרסה החדשה שלו קיימת; כל השאר (וגם אורח) — הישן.

קיוסק / שעון נוכחות / הדפסה: המעטפת תמיד ישנה (`isForcedLegacyPath`), ושם לעולם אין אייקון.
זה דגל תצוגה בלבד, לא גבול הרשאות — ההרשאות בשערים של הדפים וה-API, בלי שינוי.

## הרשומה (lib/uiVariantScreens.js)

| מסך | שם | נתיבים | ישן | חדש | הקוד הישן |
|---|---|---|---|---|---|
| `shell` | תפריט עליון | כל האתר | AppShell | MenuA5Shell | (קיים) |
| `home` | דף הבית | `/` | LegacyHome | HomeA5 | (קיים) |
| `order_card` | כרטיס הזמנה | `/orders/:id` | כן | **כן** (5.10.2026, ענף feature/order-card-a5; OrderCardSwitch) | הכרטיס החדש: app/components/order-card, הישן: LegacyOrderPage.js (= page.js של main) |
| `customer_card` | כרטיס לקוח | `/customers/:id` | כן | **עוד לא** | ענף feature/customer-card-a5-2026-10-04 |
| `new_order` | הזמנה חדשה | `/orders/new` | `app/orders/new/LegacyNewOrderPage.js` (נעול ב-PINNED_BLOBS) | **כן** (6.10.2026; NewOrderSwitch, `app/components/new-order`) | מתכנת - חדש כברירת מחדל, כל השאר ישן; כל עובד מחליף לעצמו באייקון (בכותרת האשף החדש, ובפינה בישן דרך VariantFrame). פירוט: docs/new-order-programmer-default-2026-10-06.md |
| `profile` | הפרופיל שלי | `/profile` | `app/profile/LegacyProfilePage.js` | ProfilePage | `7917382f^:app/profile/page.js` |
| `admin_hub` | מסך ניהול ראשי | `/admin` | `app/admin/LegacyAdminPage.js` (+ EmailListCard, menu/AdminHubA5Cards, components/FullEmailListModal בנתיבים המקוריים) | AdminHubPage | `079fc226^1` |
| `attendance` | נוכחות | `/employees`, `/employees/attendance`, `/employees/report`, `/my-hours` | `app/employees/LegacyEmployeesPage.js`, `app/employees/report/LegacyReportPage.js`, `app/my-hours/LegacyMyHoursPage.js` | AttendancePage | `f3b1f771^1` |
| `error_report` | חלון דיווח על שגיאות | (חלון גלובלי) | `app/components/LegacyErrorReportButton.js` | ErrorReportWindow | `c944cb95:app/components/ErrorReportButton.js` |

הקבצים הישנים משוחזרים **כפי שהם** (`git show <commit>:<path>`); `scripts/test_page_variant_switch.mjs` בודק שה-blob זהה.
בלי גרסה ישנה (לא ברשומה, אין אייקון): לו"ז / לוח חודשי, בדיקת מלאי, `/employees/<id>/attendance`.
דף הכניסה: מתג נפרד `login_page_new='false'` — לפני ההתחברות, ולכן אין עקיפה אישית ואין אייקון.

## האייקון (app/components/variant/PageVariantToggle.js)

* לחצן אייקון עגול של הפלטה (רקע זהב `--gm-gbtn`, מסגרת שחורה 1.5px, אייקון 57 "החלפה" מה-sprite), טקסט
  "מעבר לתצוגה החדשה" / "חזרה לתצוגה הישנה". CSS עצמאי `pageVariantToggle.css` (היקף `.gm-pvt`, טוקנים גלובליים), כי הוא
  מוצג גם בדפים הישנים בלי הפלטה.
* **מוצג** לכל עובד מחובר (מ-11.10.2026; `canEmployeeSelfSwitch` ב-`lib/uiVariantSelfSwitch.js` — המקום היחיד לצמצום), רק במסך עם
  שתי גרסאות, רק בנתיבי המסך שברשומה, ולא בקיוסק / שעון / הדפסה (`shouldShowVariantToggle`). ה-layout מעביר
  `canSelfSwitch` ממה שכבר יש לו (עוגייה חתומה / שורת העובד) — בלי בקשה נוספת; ה-GET/POST בודקים שוב מה-DB.
* לחיצה: `POST /api/me/ui-variant/<screen> { value }` (עקיפה אישית + רענון העוגייה בשרת) ואז טעינה מלאה, או מעבר לנתיב של הגרסה
  השנייה (`switchTargets`: `/employees` ↔ `/employees/attendance`).
* מיקום — בדף חדש: בכותרת (פרופיל, מסך ניהול, סיכום נוכחות, שתי הכותרות של חלון הדיווח; בדף הבית — פינה עליונה של אזור
  החיפוש). בדף ישן: פינה קבועה שמאל-למטה (`VariantFrame`, בלי לגעת בקובץ הישן). במעטפת הישנה: בסרגל העליון (המסך `shell`);
  בתפריט החדש נשאר "האתר הישן". חלון הדיווח הישן: האייקון מעליו כשהוא פתוח (`LegacyErrorReportFrame`).

## API

* `POST /api/me/ui-variant/<screen>` — נתיב כללי (`app/api/me/ui-variant/[screen]`), 404 למסך שלא ניתן להחלפה. `shell` / `home`
  נשארים בנתיבים הסטטיים שלהם. אותה ליבה (`applyUiVariantRequest`): כל עובד פעיל — `a5` / `legacy` / `null` בכל מסך (כולל התפריט);
  לא מחובר 401, מושבת 403. תמיד על העובד המאומת עצמו.
* `GET /api/me/ui-variant` — `{ canSelfSwitch, screens }` (לכל עובד פעיל; מושבת 403, אורח 401) לדף "עיצוב ותצוגה" (הרשימה מהרשומה, עם "ברירת מחדל" = `null`).
* **נתיבי תאימות לממשק הישן** (לא המטפלים הישנים — אלה נשארו מחוקים): `GET /api/employees/attendance` על השער המוקשח של
  "סיכום נוכחות" (`getAttendanceViewer` + `decideReadAccess scope:'month'`), רק השדות שהממשק הישן קורא; `GET /api/customers/emails`
  להנהלה ראשית / מתכנת בלבד, נכשל סגור. כל אחד בקומיט נפרד — אפשר להסיר.

## איך מוסיפים מסך (למשל כרטיס הזמנה)

1. רשומה ב-`lib/uiVariantScreens.js` (או `newExists: true` ברשומה הקיימת של `order_card` / `customer_card`).
2. Switch: בדף שרת — `getRequestUiVariant('<id>')` (app/lib/uiVariantServer.js); ברכיב לקוח — `useUiVariant('<id>')`.
   עוטפים ב-`<VariantFrame screen="<id>" variant=...>` (בישן הוא מוסיף את האייקון בפינה).
3. עותק הקוד הישן `Legacy*.js` מ-git כפי שהוא, ושורה ברשימת `RESTORED` ב-`scripts/test_page_variant_switch.mjs`.
4. `<PageVariantToggle screen="<id>" placement="header" systemTip />` בכותרת הדף החדש.
5. `SCREENS` ב-`scripts/set-ui-variant.js` (הבדיקה משווה לרשומה).
כל השאר (מפתח ההגדרה, עקיפה אישית, API, דף "עיצוב ותצוגה", ברירת המחדל לפי תפקיד) נגזר מהרשומה.

## הפצה לארגון (scripts/set-ui-variant.js)

```
# בלי --apply = הדפסה בלבד (dry-run הוא ברירת המחדל מ-4.10.2026)
node scripts/set-ui-variant.js --screen profile --value a5 --scope org --confirm-host <ep-xxxx> --i-know-this-is-prod
node scripts/set-ui-variant.js --screen profile --value a5 --scope org --confirm-host <ep-xxxx> --i-know-this-is-prod --apply
# עובד בודד
node scripts/set-ui-variant.js --screen attendance --value legacy --scope user --employee <id|legacyId> --confirm-host <...> --i-know-this-is-prod --apply
```
שני הגמ"חים = שני DB; מחליפים `DATABASE_URL` לפני ההרצה. בלי שורה בארגון — ברירת המחדל לפי תפקיד.
להחזיר מסך לכולם לחדש: `--value a5 --scope org`; לישן: `--value legacy`.

## סיכונים ידועים

* **הדפים הישנים מול ה-API של היום**: פרופיל ישן — השדה "שם מלא" כבר לא נשמר (השרת גוזר אותו משם פרטי + משפחה, 8321f436);
  מסך ניהול ישן — "ניהול אתר" (`/admin/site`) מפנה את מי שאינו מתכנת חזרה ל-`/admin` (החלטה מ-4.10.2026), ולכן להנהלה ראשית בגרסה
  הישנה הכרטיס הזה לא מוביל לשום מקום; נוכחות ישנה ורשימת המיילים — דרך נתיבי התאימות; השעות שלי, חלון הדיווח הישן — ה-API לא
  השתנה (רק שדה aiTitle נוסף).
* ברירת המחדל החדשה פירושה שאחרי הפריסה כל מי שאינו מתכנת יראה את הפרופיל, מסך הניהול, הנוכחות וחלון הדיווח **הישנים**
  (מכוון). מי שעבר לחדש באייקון — נשאר בחדש (עקיפה אישית).
* `/employees/attendance` בגרסה הישנה מפנה ל-`/employees` (בעבר זו הייתה לשונית); הלשונית נפתחת על "רשימת עובדים".

## עובדים ודגמים (9.10.2026, ענף feature/a5-staff-models-2026-10-09)

ארבעה מסכים נרשמו ברשומה: `employees_list` (`/employees`, לשונית "רשימת עובדים"), `models_list` (`/dashboard/dresses`), `model_card` (`/dashboard/dresses/:id`, בלי `/new`) ו-`model_new`
(`/dashboard/dresses/new`). `newExists:true` רק לשתי הרשימות (נבנו על ערכת הרשימות `app/components/a5-list`); `model_card` / `model_new` נשארים `false` עד שהכרטיס / האשף מחוברים.

| מסך | ישן | חדש |
|---|---|---|
| `employees_list` | `app/employees/LegacyEmployeesListPage.js` (= `app/employees/page.js` של main 51eae39f בייט-בבייט) | `EmployeesSwitch` -> `EmployeesListA5` |
| `models_list` | `app/dashboard/dresses/LegacyDressesListPage.js` (= `page.js` של main 51eae39f בייט-בבייט) | `ModelsListSwitch` -> `ModelsListA5` |

* **/employees הוא נתיב של שני מסכים**: `attendance` (הלשונית הישנה "נוכחות" שבתוך הדף הישן) ו-`employees_list`. כש-`attendance='legacy'` מוצג הדף הישן כולו (כולל הנוכחות הישנה) והדגל `employees_list` לא נבדק;
  כש-`attendance='a5'` הדגל `employees_list` מכריע (חדש = הרשימה החדשה, שהלשונית "נוכחות" שלה מובילה ל-`/employees/attendance`; ישן = הדף הישן בלי לשונית נוכחות פנימית, עם אייקון המעבר בפינה).
  כדי שכל הארגון יראה את הרשימה החדשה צריך `ui_variant_attendance='a5'` וגם `ui_variant_employees_list='a5'`.
* ברירת מחדל לפי תפקיד: מתכנת חדש, כל השאר ישן. לא שונתה אף הגדרה / DB.
* האייקון: `<PageVariantToggle screen="employees_list|models_list" placement="header" systemTip />` בכותרת הרשימה החדשה, ובפינה בדף הישן (`VariantFrame`).
* בדיקות: `scripts/test_page_variant_switch.mjs` (הקבצים הישנים ב-`RESTORED`, בלוק "employees_list / models_list"), `scripts/test_a5_list_logic.mjs`, `scripts/test_a5_employees_list.mjs`, `scripts/test_a5_models_list.mjs`.
* פירוט ההחלטות, מקורות הנתונים וטבלאות הנאמנות: `docs/a5-staff-models/`.

## יומן מיילים / מחלקות / היסטוריית הנהלה / היסטוריית נתונים (11.10.2026, ענף feature/a5-admin-logs-history-departments-2026-10-11)

ארבעה מסכים נרשמו יחד ברשומה (`newExists:false` עד שהמסך החדש מחובר; כל אחד הופך ל-`true` ע"י הסוכן שבנה אותו): `email_logs` (`/admin/site-settings/email-logs`, מתכנת בלבד),
`departments` (`/admin/departments`), `management_history` (`/management/history`), `data_history` (`/admin/data-history`). כולם `selfSwitch:true` (כל עובד פעיל מחליף לעצמו),
ברירת מחדל לפי תפקיד: מתכנת חדש, כל השאר ישן. שער הגישה לא משתנה (layout + API); המסכים החדשים מתבססים על ערכת הרשימות `app/components/a5-list` (כמו רשימות ההזמנות / הלקוחות).
בדיקות: `scripts/test_page_variant_switch.mjs`, `test_ui_variant.mjs`, `test_ui_variant_self_switch.mjs` (רשימות `LOGS_*`), `scripts/set-ui-variant.js` (`--screen`), `lib/pageVariantToggle.js` (כיתובי האייקון).

## נווה יעקב: הממשק החדש כברירת מחדל + "חזרה לממשק החדש" (12.10.2026, ענף feature/neve-new-ui-default-2026-10-12)

בקשת הבעלים: "כל האתר יעלה ויפתח כברירת מחדל לכל העובדות בגמ"ח נווה, ותשאיר את האופציה לחזור לקודם, ושיופיע בכותרת בישן בצורה ברורה לחצן חזרה לחדש".

* **ברירת המחדל = הגדרות ארגון, לא קוד.** `scripts/seed_neve_new_ui_default.js --org=2` כותב `ui_variant_<screen>='a5'` לכל מסך עם שתי גרסאות (נגזר מהרשומה), רק ב-DB של נווה
  (מסרב ל-org1, host זהה ל-org1, gmach_name בלי "נווה"; כתיבה רק עם `--write --confirm-host <ep-xxxx>`; dry-run כברירת מחדל). הגמ"ח הראשי לא משתנה. סדר ההכרעה נשאר:
  עקיפה אישית > הגדרת ארגון > ברירת מחדל לפי תפקיד, ולכן עובדת בלי העדפה שמורה מקבלת חדש, ובחירה אישית קיימת נשמרת. `--clear-user-legacy-overrides` (אופציונלי) מסיר עקיפות 'legacy' אישיות.
* **לחצן "חזרה לממשק החדש"** (`app/components/variant/ReturnToNewDesignButton.js`): לחצן זהב עם טקסט בסרגל העליון של המעטפת הישנה (AppShell; במובייל שורה ברוחב מלא מתחת לכותרת),
  ובפינה של דף ישן בתוך המעטפת החדשה (VariantFrame). לכל עובד/ת פעיל/ה; לא קיים בממשק החדש. לחיצה: `POST /api/me/ui-variant {value:'a5'}` = עקיפה אישית 'a5' בכל המסכים בכתיבה אחת
  (`applyUiVariantAllRequest`, אותם כללי הרשאה כמו מעבר של מסך בודד) + טעינה מחדש. אייקון המעבר הישן של המעטפת בלבד הוחלף בלחצן הזה.
* **"האתר הישן"** בתפריט החדש מחליף עכשיו את *כל* המסכים לישן (אותו API עם `value:'legacy'`), ולא רק את המעטפת.
* בדיקות: `scripts/test_page_variant_switch.mjs`, `test_ui_variant_self_switch.mjs`, `test_neve_new_ui_seed.mjs`.

## מרכז הודעות (14.10.2026, ענף feature/messages-a5)

מסך `messages` (`/messages`) נרשם ברשומה, `newExists:true`, `selfSwitch:true`. הישן: `app/messages/LegacyMessagesPage.js` (= `page.js` של main d0bc85d9 בייט-בבייט, נבדק ב-`RESTORED`);
`app/messages/page.js` הוא עטיפה דקה ל-`MessagesSwitch` (`app/components/messages/`). ברירת מחדל לפי תפקיד: מתכנת חדש, כל השאר ישן (עד עקיפה אישית / `ui_variant_messages='a5'`).
החדש (`MessagesA5.js`, `messagesLogic.js`, `messages.css`) בנוי כמו תיבת המייל (`/admin/mailbox`) ודף הלו"ז: `A5ListPage` עם עמודה כחולה בצד ימין (נכנסות / יוצאות / בין משמרות / להנהלה / ארכיון + "הודעה חדשה" + "הגדרות"),
`A5List` (שורות / טבלה, חיפוש, מיון, פירוט מהיר) וחלונות צפים (`.dlg.mailwin`) לקריאה, כתיבה (שלושה סוגים: לעובד / בין משמרות / להנהלה) והגדרות התראות. אותם API והרשאות כמו בדף הישן,
תאריכים עבריים בלבד. תוספת קטנה: כפתור "השב" בהודעה אישית. בדיקות: `test_page_variant_switch.mjs`, `test_ui_variant.mjs`, `test_ui_variant_self_switch.mjs`.
