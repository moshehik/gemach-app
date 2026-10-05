# מעבר "ישן / חדש" בכל דף — 4.10.2026

בקשת הבעלים: בכל דף שיש לו גם גרסה חדשה וגם ישנה — אייקון ייעודי למעבר לתצוגה החדשה ולחזרה לישנה, בנוסף למתגים הקיימים
(הגדרות הארגון, דף "עיצוב ותצוגה", עקיפה אישית). ענף: `feature/page-variant-switch-2026-10-04`.

**החלטת הבעלים (4.10.2026, באמצע העבודה):** האתר נפתח בעיצוב **הישן לכולם, חוץ מהמתכנת** (roleId 2). כל אפשרויות המעבר נשארות.
באותו יום נכתבו בשני ה-DB של הייצור `ui_variant_shell='legacy'` ו-`ui_variant_home='legacy'` (במקום ה-'a5' שנכתב קודם באותו
יום). לחשבון המתכנת יש עקיפות אישיות: בגמ"ח הראשי shell/home='a5'; בנווה יעקב shell='legacy', home='a5'.

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
* **מוצג רק** להנהלה ראשית / מתכנת (`SELF_SWITCH_ROLE_IDS` ב-`lib/uiVariantSelfSwitch.js` — המקום היחיד להרחבה), רק במסך עם
  שתי גרסאות, רק בנתיבי המסך שברשומה, ולא בקיוסק / שעון / הדפסה (`shouldShowVariantToggle`). ה-layout מעביר
  `canSelfSwitch` מה-roleId שכבר יש לו — בלי בקשה נוספת.
* לחיצה: `POST /api/me/ui-variant/<screen> { value }` (עקיפה אישית + רענון העוגייה בשרת) ואז טעינה מלאה, או מעבר לנתיב של הגרסה
  השנייה (`switchTargets`: `/employees` ↔ `/employees/attendance`).
* מיקום — בדף חדש: בכותרת (פרופיל, מסך ניהול, סיכום נוכחות, שתי הכותרות של חלון הדיווח; בדף הבית — פינה עליונה של אזור
  החיפוש). בדף ישן: פינה קבועה שמאל-למטה (`VariantFrame`, בלי לגעת בקובץ הישן). במעטפת הישנה: בסרגל העליון (המסך `shell`);
  בתפריט החדש נשאר "האתר הישן". חלון הדיווח הישן: האייקון מעליו כשהוא פתוח (`LegacyErrorReportFrame`).

## API

* `POST /api/me/ui-variant/<screen>` — נתיב כללי (`app/api/me/ui-variant/[screen]`), 404 למסך שלא ניתן להחלפה. `shell` / `home`
  נשארים בנתיבים הסטטיים שלהם. אותה ליבה (`applyUiVariantRequest`): הנהלה ראשית / מתכנת — `a5` / `legacy` / `null`; תפריט — כל
  עובד רק `legacy` / `null`; כל השאר 403. תמיד על העובד המאומת עצמו.
* `GET /api/me/ui-variant` — `{ canSelfSwitch, screens }` לדף "עיצוב ותצוגה" (הרשימה מהרשומה, עם "ברירת מחדל" = `null`).
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
