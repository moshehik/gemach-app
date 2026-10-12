# Runbook פריסה - אינטגרציה 2026-10-12 (ליל הפריסה)

ענף: `integrate/2026-10-12` (worktree `C:\wt\wt-integrate-2026-10-12`). **מסמך זה לא הורץ. שום פקודה בו לא הורצה מול אף DB.** כל פקודה היא העתק של הנוסח שבכותרת הסקריפט (נקראו אחד אחד).
שני הגמ"חים: **ראשי** (org1, אתר `gemach-app-uyh4-beryl.vercel.app`, DB `ep-weathered-tree-avpypjjr`) ו**נווה יעקב** (org2, אתר `gmach-neve-yaakov.vercel.app`, DB `ep-young-math-b1veujp3`).

## החלטות הבעלים בלילה (קובעות על כל מה שבהמשך)

- **הקישור הציבורי `/station` נשאר כבוי** בשני הגמ"חים (`kiosk_public_link_enabled=false`; ב7). לא מדליקים.
- **ברקוד בלו"ז בנווה לא מדליקים:** ב4 רץ **בלי** `--profile=neve` (יוצר שורות `off` בלבד) או לא רץ בכלל. את הפרופיל (`prep` / `pickup`) מחליטים בנפרד, אחרי הלילה.
- **משלוח משותף בנווה:** seed של המחיר (20 ש"ח, כבוי) ← dry-run של דוח ההשפעה ← בדיקה והצגה לבעלים ← הדלקה (ב3 ← ב3א ← ב3ב).
- **ניקויים בנווה (סעיף ג):** רק אחרי בדיקת העשן הסופית, ובלי `--include-obligations`.
- **בגמ"ח הראשי לא מריצים seeds** (ר' פתיח סעיף ב).

## 0. הכנה לפני תחילת הלילה

1. **חיבורי DB לסקריפטים.** `scripts/lib/db-env.js` (שורה 23) קורא קודם את `.env.local` ואחריו את `.env` משורש הפרויקט, וערך שכבר קיים בסביבה גובר. מחרוזות החיבור (`PROD_DATABASE_URL` לראשי, `PROD_DATABASE_URL_ORG2` לנווה) נמצאות ב-**`.env`** של הריפו הראשי; `.env.local` שם מכיל רק `NEON_API_KEY`. ב-worktree של האינטגרציה אין אף אחד מהם, ולכן: **או** להעתיק אליו את `.env` (וגם `.env.local`) מהריפו הראשי (קבצים מקומיים שאינם ב-git), **או** להגדיר `PROD_DATABASE_URL` ו-`PROD_DATABASE_URL_ORG2` בחלון ה-PowerShell. בחירת הארגון בכל הסקריפטים: `--org=1|2`.
   **חריג:** רק `size_cleanup_apply.js` / `size_cleanup_rollback.js` (סעיף ג1) משתמשים ב-`--env "<קובץ env>" --var PROD_DATABASE_URL` (לנווה: `…\gemach-app\scratch\new_gemach_db.env`), ו-`set-ui-variant.js` קורא `DATABASE_URL` מהסביבה (בלי `--org`). כל השאר (`seed_*`, `clean_placeholder_model_names*`, `apply_*_ddl`, `apply_pending_ddl`) ב-`--org=1|2`. **לעולם לא להדפיס/להדביק מחרוזות חיבור.**
2. **לפני כל כתיבה: dry-run ואימות ה-host.** סקריפטי ה-DDL, `seed_neve_new_ui_default`, `seed_shared_delivery_neve`, `seed_customer_consent_settings`, `seed_barcode_entry_settings`, `seed_quick_barcode_setting` והניקויים מדפיסים את ה-host שאליו הם מחוברים - לוודא `ep-weathered-tree…` לראשי ו-`ep-young-math…` לנווה, ורק אז לחזור עם דגל הכתיבה. סקריפטים שאינם מדפיסים host (`seed_order_docs_delivery_settings`, `seed_new_order_customer_list_filter_setting`, `seed_kiosk_public_settings`, `seed_email_center_settings`) מוגנים רק ב-`--org=2` ובכך שהמשתנה `PROD_DATABASE_URL_ORG2` מצביע על נווה - לוודא זאת לפני ההרצה. **שומרים את פלט כל dry-run לקובץ** (ר' 0.3ד).
3. **גיבוי ונקודת חזרה (לפני ה-DDL וה-seeds):**
   - **א. גיבוי מיידי בשני האתרים:** `/admin/backups` ← "גיבוי מיידי", בכל אחד מהאתרים (`gemach-app-uyh4-beryl.vercel.app`, `gmach-neve-yaakov.vercel.app`), והמתנה ל"הצליח" ביומן הגיבויים.
   - **ב. Neon branch בשם `pre-integrate-2026-10-12` לכל פרויקט** (לפי CLAUDE.md: הראשי `gemach-main-prod`, נווה `gemach-dresses-2`; לאמת מזהה פרויקט ו-endpoint ב-`docs/vercel-resource-audit-2026-09-20.md` וב-CLAUDE.md לפני היצירה - כי פרויקטי Neon עברו החלפות). branch הוא נקודת עזר לבדיקה בלבד; **אין לשחזר ממנו DB** (ר' ו.10).
   - **ג. רישום מזהה ה-deployment הנוכחי** (Production) של כל פרויקט Vercel (`gemach-app-uyh4`, `gmach-neve-yaakov`) - זו נקודת החזרה ל-Instant Rollback.
   - **ד. שמירת פלט כל dry-run לקובץ** (למשל `C:\wt\backups\integrate-2026-10-12\<שם>.txt`) - ובמיוחד לפני `--clear-user-legacy-overrides` (ב1), שמשנה `Employee.themeColor` בלי גיבוי אחר.
   - הניקויים של נווה (סעיף ג') מייצרים גיבוי משלהם.
4. מצב הענף: `prisma validate` עבר; `prisma migrate diff` בין הסכמה של `origin/main` (9a56d6ab) לסכמה הסופית מניב **בדיוק** את הפער שמכוסה בסעיף א' (ראו שם). בדיקות: 144 משימות, 15 כשלים - כולם הכשלים הקיימים ב-`origin/main` (ר' `docs/integration-2026-10-12.md`).
5. **משתני סביבה ב-Vercel:** אין חובה להוסיף. אופציונליים (מרכז מיילים, תזמון מדויק של דיוורים בלבד): `EMAIL_SCHEDULER_URL`, `EMAIL_SCHEDULER_SECRET` (Apps Script, `docs/gas-campaign-scheduler.gs`), `EMAIL_SITE_ORIGIN`. **`EMAIL_DRY_RUN` אסור להגדיר בפרודקשן** (מצב יבש - אף מייל לא יוצא).
6. **Vercel "Ignored Build Step":** דחיפה ל-`main` שהקומיט האחרון שלה הוא בדיקות/מסמכים בלבד עלולה לא להפעיל פריסה. הקומיט האחרון שנדחף חייב להיות קומיט קוד (בדרך כלל עדכון גרסה) או להכיל `[force-deploy]` (ר' `memory/vercel-ignore-build-step-force-deploy`). מגבלת 100 פריסות ליום - פריסה אחת בלבד.

---

## א. DDL ממתין (כולו תוספתי, אידמפוטנטי)

**כלל:** לא `prisma db push` (סחף סכמה ידוע). כל DDL על **שני** ה-DB, **לפני ה-push**. כולם `IF NOT EXISTS`.

| # | מה | קבצים | חייב לפני הפריסה? | מה קורה בלעדיו |
|---|---|---|---|---|
| 1 | `DressItem.branch` + `DressItem.locationBeforeRental` (TEXT, nullable) + אינדקס `DressItem_branch_idx` | `scripts/branches-ddl.sql` + `scripts/apply_branches_ddl.js` | **כן** | `schema.prisma` מצהיר על העמודות, ולכן **כל** שאילתת `dressItem` בלי `select` מבקשת אותן ונופלת עם P2022 - גם כש-`multi_branch_enabled` כבוי. שובר קטלוג, השכרות, בדיקת מלאי ועוד. |
| 2 | `CustomerConsent` (יומן הסכמות, + 2 אינדקסים + מפתח זר ל-`Customer`) | `prisma/migrations-pending/2026-10-12-customer-consent.sql` + `scripts/apply_customer_consent_table.js` | לא (מומלץ מאוד) | הקוד לא נשבר: כתיבה ליומן נכשלת ומתועדת בקונסול. אבל שמירת לקוחה עם חתימה/הסכמה (כרטיס לקוחה, עמדה) תחזיר `consentWarning` ("ההסכמות לא נרשמו ביומן") ואין ראיה משפטית. |
| 3 | `StationEvent` (מדדי העמדה `/station-analytics`, + 3 אינדקסים) | `scripts/station_event_table.sql` + `scripts/apply_pending_ddl.js --file=station-event` (חדש, ר' הערה) | לא | האיסוף מדלג והמסך `/station-analytics` מציג הסבר. העמדה הציבורית כבויה, ולכן אין אירועים בכל מקרה. |
| 4 | `AuthThrottle` (הגבלת ניסיונות `verify-pin`, #273 - **כבר בסכמה של `origin/main`**) | `prisma/migrations-pending/2026-10-11-auth-throttle.sql` + `scripts/apply_pending_ddl.js --file=auth-throttle` | לא | "נכשל פתוח": אין הגבלת ניסיונות, אין 500. **ייתכן שכבר הורץ** - ה-dry-run מדפיס "ALREADY EXISTS" ואז מדלגים. |
| - | `2026-10-12-schedule-barcode-optional.sql` | `prisma/migrations-pending/` | **לא להריץ** | כולו בהערות והצעות אופציונליות (אינדקס ייחודי חלקי, עמודות דוחות). הקוד עובד בלעדיו. אסור להוסיף את השדות לסכמה לפני הרצתם. |

**הערה על `scripts/apply_pending_ddl.js` (חדש בשלב ב'):** לטבלאות 3-4 לא היה סקריפט apply. נוסף סקריפט בסגנון `apply_customer_consent_table.js`: רשימה סגורה של שני קבצי SQL, dry-run כברירת מחדל, `--apply --expect-host=<תחילית>`. לא הורץ.

**אימות עקביות סכמה-DDL (בוצע, בלי חיבור ל-DB):** `npx prisma migrate diff --from-schema-datamodel <schema של origin/main 9a56d6ab> --to-schema-datamodel prisma/schema.prisma --script` מניב בדיוק: `ALTER TABLE "DressItem" ADD COLUMN "branch" TEXT, ADD COLUMN "locationBeforeRental" TEXT`; `CREATE TABLE "CustomerConsent"` + 2 אינדקסים + FK `CustomerConsent_customerId_fkey ... ON DELETE RESTRICT ON UPDATE CASCADE`; `CREATE TABLE "StationEvent"` + אינדקס ייחודי `(dayKey,type,channel,sidHash)` + 2 אינדקסים; `CREATE INDEX "DressItem_branch_idx"`. זהה לקבצי ה-SQL (עמודות, סוגים, שמות אינדקסים). `AuthThrottle` כבר בסכמה של `origin/main`. אחרי ההרצה אפשר לאמת מול ה-DB: `npx prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema.prisma --script` צריך להיות ריק (להריץ עם מחרוזת חיבור בסביבה בלבד).

### פקודות (מהשורש של worktree האינטגרציה, אחרי הגדרת החיבורים)

לכל אחד: קודם dry-run (קורא בלבד), רושמים את ה-host, ואז כתיבה. תחילית הכתיבה: ראשי `ep-weathered-tree`, נווה `ep-young-math`.

```powershell
# 1. DressItem.branch / locationBeforeRental  (חובה)
node scripts/apply_branches_ddl.js --target=prod --org=1                                   # dry-run
node scripts/apply_branches_ddl.js --target=prod --org=1 --write --expect-host=ep-weathered-tree
node scripts/apply_branches_ddl.js --target=prod --org=2                                   # dry-run
node scripts/apply_branches_ddl.js --target=prod --org=2 --write --expect-host=ep-young-math

# 2. CustomerConsent   (--apply, לא --write)
node scripts/apply_customer_consent_table.js --org=1
node scripts/apply_customer_consent_table.js --org=1 --apply --expect-host=ep-weathered-tree
node scripts/apply_customer_consent_table.js --org=2
node scripts/apply_customer_consent_table.js --org=2 --apply --expect-host=ep-young-math

# 3. StationEvent        4. AuthThrottle    (ה-dry-run מראה אם כבר קיימת)
node scripts/apply_pending_ddl.js --file=station-event --org=1
node scripts/apply_pending_ddl.js --file=station-event --org=1 --apply --expect-host=ep-weathered-tree
node scripts/apply_pending_ddl.js --file=station-event --org=2
node scripts/apply_pending_ddl.js --file=station-event --org=2 --apply --expect-host=ep-young-math
node scripts/apply_pending_ddl.js --file=auth-throttle --org=1
node scripts/apply_pending_ddl.js --file=auth-throttle --org=1 --apply --expect-host=ep-weathered-tree
node scripts/apply_pending_ddl.js --file=auth-throttle --org=2
node scripts/apply_pending_ddl.js --file=auth-throttle --org=2 --apply --expect-host=ep-young-math
```

הערות: `apply_branches_ddl.js` מדפיס `יעד: prod org1 host=…` ודורש `--expect-host` שהוא תחילית של ה-host; הרצה חוזרת בטוחה. org2 (Neon) מפיל לפעמים חיבורים - בסקריפטים 2-4 יש retry אוטומטי.
**Rollback (רק אם חייבים; לא מומלץ אחרי שהקוד עלה):** `DROP TABLE "StationEvent"` / `"CustomerConsent"` / `"AuthThrottle"` (הקוד מתמודד עם היעדרן); `ALTER TABLE "DressItem" DROP COLUMN "branch", DROP COLUMN "locationBeforeRental"` - **רק אחרי** החזרת הקוד לגרסה הקודמת (אחרת P2022).

---

## ב. Seeds (נווה בלבד, ממוקדי ארגון) - **אחרי** שהפריסה הושלמה ונבדקה

כולם: dry-run קודם (פלט הדרי-ראן נשמר לקובץ), לבדוק את ה-host/הארגון לפי סעיף 0.2, ואז הדגל. **ערך קיים לא נדרס, חוץ מ:** ב1 (`ui_variant_*` נכתבים `a5`), ב2 עם `--force-delivery-item-row`, ב3ב (`--enable` מדליק), וב4 עם פרופיל (דורס את שלושת המפתחות). לפני `--clear-user-legacy-overrides` (ב1) חובה לשמור את פלט ה-dry-run לקובץ (שינוי `Employee.themeColor` ללא גיבוי אחר). **בגמ"ח הראשי לא מריצים seeds:** כל ברירות המחדל בקוד זהות לערכים שה-seeds יוצרים, וההרצה רק מוסיפה שורות. אם בכל זאת מריצים seed בראשי - לעצור אם בפלט אין host שמתחיל ב-`ep-weathered-tree` (סקריפט שאינו מדפיס host לא מריצים בראשי). סדר ההפעלה:

| # | מטרה | פקודה (dry-run ← כתיבה) | מה נכתב / הערות |
|---|---|---|---|
| ב1 | **ממשק חדש כברירת מחדל בנווה** | `node scripts/seed_neve_new_ui_default.js --org=2` ← `node scripts/seed_neve_new_ui_default.js --org=2 --write --confirm-host ep-young-math-b1veujp3 --clear-user-legacy-overrides` | שורות `ui_variant_<מסך>` = `a5` לכל מסך שיש לו גרסה חדשה; `--clear-user-legacy-overrides` מסיר בחירות אישיות 'legacy' של עובדות פעילות (הן יקבלו את ברירת המחדל; לחצן "חזרה לממשק החדש" נשאר). מסרב על org1; בודק ש-`gmach_name` מכיל "נווה"; `--confirm-host` = ה-host המלא או `ep-…` כפי שהודפס. **לפני `--clear-user-legacy-overrides`: שמירת פלט ה-dry-run לקובץ.** **Rollback:** `ui_variant_*` = `legacy` ב-`set-ui-variant.js --screen <מסך> --value legacy --scope org --confirm-host <ep-…> --apply` (קורא `DATABASE_URL` מהסביבה; dry-run כברירת מחדל), ובחירות אישיות: `--scope user --employee <id> --clear`. |
| ב2 | **כתובת איסוף + משלוח כשורת פריט + נוסח "שימו לב"** | `node scripts/seed_order_docs_delivery_settings.js --org=2` ← `... --org=2 --write` (ואם `delivery_as_item_row` כבר קיים כ-`false`: להוסיף `--force-delivery-item-row`) | `gmach_pickup_address` = `צוקרמן 1, נווה יעקב`, `delivery_as_item_row` = `true`, `gmach_pickup_maps_url` = ריק, `delivery_notice_text` / `delivery_outbound_hours` / `delivery_return_hours` = ברירות המחדל שאישר הבעלים. ערך קיים לא נדרס (חוץ מהדגל הנ"ל). |
| ב3 | **משלוח משותף: מחיר** | `node scripts/seed_shared_delivery_neve.js --org=2` ← `node scripts/seed_shared_delivery_neve.js --org=2 --write` | `shared_delivery_price_mode=global`, `shared_delivery_price=20`, `shared_delivery_enabled=false` (נוצר **כבוי**). |
| ב3א | **דוח לפני ההדלקה** | `$env:SD_DATABASE_URL = '<DB נווה>'; node scripts/shared_delivery_reprice.mjs --simulate-enabled --expect-host=ep-young-math` | dry-run בלבד: אילו הזמנות עתידיות היו משתנות, בכמה, ואילו זיכויים/חובות היו נוצרים. **להציג לבעלים.** (`--simulate-enabled` דורש שב3 כבר רץ.) |
| ב3ב | **הדלקה (רק אחרי אישור הדוח)** | `node scripts/seed_shared_delivery_neve.js --org=2 --enable` ← `node scripts/seed_shared_delivery_neve.js --org=2 --enable --write` | מדליק `shared_delivery_enabled=true`; מסרב אם `enable_deliveries` אינו `true` או שהמחיר חסר. מרגע ההדלקה שמירות הזמנות בקבוצה ישנו חיובים (עם זיכוי/חוב מסומנים). אחרי ההדלקה, אם הבעלים רוצה לחשב מחדש הזמנות קיימות: `shared_delivery_reprice.mjs ... --write --expect-host=ep-young-math` (רק אחרי הדוח). |
| ב4 | **ברקוד בלו"ז - נווה נשאר כבוי** | `node scripts/seed_barcode_entry_settings.js --org=2` ← `node scripts/seed_barcode_entry_settings.js --org=2 --write --expect-host=ep-young-math` (**בלי `--profile=neve`**; או לדלג על ב4 לגמרי) | יוצר שורות `off` בלבד. **החלטת הבעלים בלילה: לא מדליקים.** הפרופיל `--profile=neve` (`barcode_entry_when_delivery=prep`, `barcode_entry_when_local_pickup=pickup`, `barcode_return_scan_required=false`) מדליק את הפיצ'ר ונשמר להחלטה נפרדת. |
| ב5 | **מסנן בורר הלקוחות (נווה)** | `node scripts/seed_new_order_customer_list_filter_setting.js --org=2` ← `... --org=2 --write` | נווה = `complete`. ערך קיים לא נדרס. בראשי לא מריצים (ברירת המחדל בקוד `all`). |
| ב6 | **הסכמות (כבויות) - נווה** | `node scripts/seed_customer_consent_settings.js --org=2` ← `... --org=2 --apply --expect-host=ep-young-math` | `explicit_consent_enabled=false`, `require_privacy_acceptance=true`, `privacy_policy_text=''`. **לא מדליקים** את ההסכמות המפורשות בלילה הזה (דורש DDL של CustomerConsent + החלטת בעלים; ר' `docs/customer-consents.md`). בראשי לא מריצים. |
| ב7 | **עמדה ציבורית: הקישור נשאר כבוי (נווה)** | `node scripts/seed_kiosk_public_settings.js --org=2` ← `... --org=2 --write` | **שונה בשלב ב':** הסקריפט המקורי יצר בנווה `kiosk_public_link_enabled=true`; לפי החלטת הרכז הוא עודכן כך ששלושת המפתחות (`kiosk_public_link_enabled`, `_show_inventory`, `_show_registration`) נוצרים `false`. **לא להדליק** את `kiosk_public_link_enabled` (הכתובת `/station` תציג "העמדה אינה זמינה"). בראשי לא מריצים. |
| ב8 | מרכז מיילים - מתגי דוחות (אופציונלי, נווה) | `node scripts/seed_email_center_settings.js --org=2` ← `... --org=2 --write` | יוצר `daily_manager_report_enabled`, `manual_barcode_daily_report`, `order_quick_mail_enabled` = `false` (= ההתנהגות הנוכחית) כדי שיופיעו בהגדרות. לא חובה. בראשי לא מריצים. |
| ב9 | חיפוש מהיר - השכרה בברקוד (אופציונלי, נווה) | `node scripts/seed_quick_barcode_setting.js --org=2` ← `... --org=2 --write --expect-host=ep-young-math` | יוצר `quick_search_barcode_opens_rental=false`. הזרימה עצמה (החזרה/מעבר הזמנה) פעילה גם בלי ההגדרה; ההגדרה מוסיפה רק פתיחת **השכרה** לפריט פנוי. בראשי לא מריצים. |
| ב10 | סניפים / לו"ז | אין seed | `multi_branch_enabled` ושאר הגדרות הסניפים (`branches_config`, `branch_transfer_*`, `branch_return_alert_enabled`, `reserve_return_alert_enabled`) נכתבות רק ממסך `/admin/branches` ומחלון "הגדרות תהליכים" בלו"ז; בלילה הזה נשארות כבויות. ההגדרות הקיימות `branch_list`/`branches_enabled` של נווה לא משתנות. |

פרטי הסדר: ב1 ו-ב2 לא תלויים זה בזה; ב3 → ב3א → (אישור) → ב3ב; ב6 אחרי א2 (DDL של `CustomerConsent`) אם בכלל תופעל ההסכמה.
(`seed_credit_bank_prompt_settings.js` של #275 אינו חלק מהאינטגרציה - אם טרם הורץ, ר' `docs/credit-bank-prompt-settings-2026-10-12.md`.)

---

## ג. ניקוי נתונים בנווה (אופציונלי בלילה זה - לפי בקשת הרכז; כולם dry-run קודם)

### ג1. מידות לא תקינות - `scripts/size_cleanup_apply.js` (נווה בלבד; ראשי נדחה)
פעולות (הוחלט 12.10, ר' `docs/sizes-access-audit.md`): ` 32` → `32`; `36א`/`40ב`/`42א` → ספרות בלבד; עשרוניות (`06.1`…) **לא משתנות** אלא מסומנות `notInUse` (עם סיבה). רק פריטי DressItem של דגמים שיצאו מהמאגר. לא נוגע ב-OrderItem, לא מוחק. תקרה של 120 שינויים (נמצאו 68) - חריגה מפילה את הריצה.
```powershell
$ENVF = 'C:\Users\moshe\Desktop\גמח שמלות חדש\gemach-app\scratch\new_gemach_db.env'
node scripts/size_cleanup_apply.js --env $ENVF --var PROD_DATABASE_URL --expect-host=ep-young-math                                  # dry-run: טבלת "מה ישתנה"
node scripts/size_cleanup_apply.js --env $ENVF --var PROD_DATABASE_URL --expect-host=ep-young-math `
     --write --i-know-this-is-prod --backup-dir=C:\wt\backups\size-cleanup-2026-10-12
```
תיקיית הגיבוי (`C:\wt\backups\…`, לא ב-Drive) נוצרת לפני; כתיבה בטרנזקציה אחת עם compare-and-swap; הרצה שנייה = 0 שינויים. **Rollback:**
```powershell
node scripts/size_cleanup_rollback.js <קובץ הגיבוי>.json --env $ENVF --var PROD_DATABASE_URL --expect-host=ep-young-math                  # dry-run (WOULD_RESTORE / CONFLICT)
node scripts/size_cleanup_rollback.js <קובץ הגיבוי>.json --env $ENVF --var PROD_DATABASE_URL --expect-host=ep-young-math --write --i-know-this-is-prod [--skip-conflicts]
```

### ג2. שמות דגמים "ללא שם - N" - `scripts/clean_placeholder_model_names.js`
(א) `DressModel.name` "ללא שם…" → מספר הדגם (או `NULL`); התנגשות שם → מדלגים ומדווחים. (ב) `DressItem.dressName` ישן. (ג) `PaymentObligation.description` - **רק עם `--include-obligations` (לא להוסיף אלא אם הרכז ביקש)**. אידמפוטנטי; CAS.
**שונה בשלב ב':** `--apply` דורש כעת `--backup-file=<קובץ json חדש>` (הרשימה המלאה id / לפני / אחרי; נכתב ונסגר לפני ה-UPDATE הראשון; לא דורס קובץ קיים), ונוסף סקריפט שחזור.
```powershell
node scripts/clean_placeholder_model_names.js --org=2 --confirm-host ep-young-math-b1veujp3 --i-know-this-is-prod                       # dry-run
node scripts/clean_placeholder_model_names.js --org=2 --confirm-host ep-young-math-b1veujp3 --i-know-this-is-prod `
     --apply --backup-file=C:\wt\backups\model-names-neve-2026-10-12.json
# rollback:
node scripts/clean_placeholder_model_names_rollback.js C:\wt\backups\model-names-neve-2026-10-12.json --org=2 --confirm-host ep-young-math-b1veujp3 --i-know-this-is-prod          # dry-run
node scripts/clean_placeholder_model_names_rollback.js C:\wt\backups\model-names-neve-2026-10-12.json --org=2 --confirm-host ep-young-math-b1veujp3 --i-know-this-is-prod --apply
```
(המילה "ללא שם" כבר לא מוצגת בשום מסך גם בלי הניקוי - התצוגה מתוקנת בקוד; הניקוי נוגע בנתונים/ייצוא/דוחות SQL בלבד.) גם הוא כותב SQL ישיר - בלי שורות AuditLog (גיבוי ה-JSON הוא רישום השינוי).

---

## ד. הגדרות חדשות (מפתח, מה עושה, ברירת מחדל בקוד, ערך מתוכנן)

| מפתח | מה עושה | ברירת מחדל בקוד (שורה חסרה) | נווה | ראשי |
|---|---|---|---|---|
| `gmach_pickup_address` | כתובת האיסוף ללקוחות (מייל אישור, תזכורות, כרטיס/PDF/הדפסה); קישור Google Maps נגזר ממנה | ריק = `gmach_address` כמו היום, בלי קישור | `צוקרמן 1, נווה יעקב` (ב2) | לא מוגדר |
| `gmach_pickup_maps_url` | קישור ניווט מותאם (https) במקום הנגזר | ריק = נגזר | ריק | ריק |
| `delivery_as_item_row` | משלוח כשורת פריט לכל כיוון (כרטיס/הדפסה/PDF/מייל/Excel), תצוגה בלבד | כבוי | `true` (ב2) | כבוי (אין משלוחים) |
| `delivery_notice_text`, `delivery_outbound_hours`, `delivery_return_hours` | כיתוב "שימו לב" ושעות הכיוונים במייל אישור ההזמנה (שורה ריקה = מוסתר) | ברירות המחדל של נווה מובנות בקוד | נוסח הבעלים (ב2) | לא רלוונטי |
| `shared_delivery_enabled` | משלוח משותף: מחיר מוזל לכתובת זהה באותו יום (ורק עם `enable_deliveries`) | כבוי | `false` ← `true` אחרי הדוח (ב3ב) | כבוי |
| `shared_delivery_price_mode` / `shared_delivery_price` / `shared_delivery_price_by_city` | סוג ומחיר המחיר המוזל לצד | - | `global` / `20` / ריק | לא מוגדר |
| `barcode_entry_when_delivery`, `barcode_entry_when_local_pickup` | מתי מזינים ברקוד בלו"ז: `off` / `prep` / `pickup` | `off` | `off` (ב4 בלי פרופיל; הפרופיל נשמר להחלטה נפרדת) | `off` |
| `barcode_return_scan_required` | חסימת "החזרה בוצעה" בלו"ז עד שכל השמלות נסרקו בהחזרה | כבוי | `false` | `false` |
| `quick_search_barcode_opens_rental` | ברקוד של שמלה פנויה בחיפוש המהיר פותח השכרה | כבוי | `false` (החלטת הבעלים בנפרד) | `false` |
| `new_order_customer_list_filter` | בורר "לקוח קיים" בהזמנה חדשה: `all` / `complete` | `all` | `complete` (ב5) | `all` |
| `explicit_consent_enabled`, `require_privacy_acceptance`, `privacy_policy_text` | הסכמות מפורשות (תקנון/דיוור/פרטיות) ביומן `CustomerConsent` | כבוי | `false` / `true` / '' (ב6) | `false` / `true` / '' |
| `terms_file_id/name/type/sha256/uploaded_at/history` | קובץ התקנון שבתוקף (נכתב רק ע"י העלאה במסך ההגדרות) | אין קובץ | לפי הבעלים | לפי הבעלים |
| `kiosk_public_link_enabled`, `kiosk_public_show_inventory`, `kiosk_public_show_registration` | עמדת לקוח ציבורית `/station` | כבוי | **`false`** (ב7; החלטת הרכז) | `false` |
| `multi_branch_enabled`, `branches_config`, `branch_transfer_banner_enabled`, `branch_transfer_banner_scope`, `branch_transfer_horizon_days`, `branch_return_alert_enabled`, `reserve_return_alert_enabled` | ריבוי סניפים: ניהול סניפים, העברות בלו"ז/פס בראש הדף, התראת החזרה לסניף אחר/רזרבה | כבוי | כבוי עד החלטת הבעלים | כבוי |
| `schedule_stage_<שלב>_{enabled,days,shift}` | "הגדרות תהליכים" בלו"ז (נכתבות רק מהחלון) | כמו היום | ללא שינוי | ללא שינוי |
| `ui_variant_<מסך>` | ברירת מחדל ארגונית לממשק חדש/ישן | לפי תפקיד | `a5` לכל המסכים (ב1) | ללא שינוי |
| `email_tpl:<מזהה>`, `email_fixed_fields`, `email_campaign_log` | מרכז המיילים (עריכת שורות, שדות קבועים, יומן דיוורים) - JSON שנכתב ממסך המרכז | אין שורה = המייל כמו לפני | לפי הצורך | לפי הצורך |
| `daily_manager_report_enabled`, `manual_barcode_daily_report`, `order_quick_mail_enabled` | מתגי מייל קיימים בקוד שלא הייתה להם שורה (ב8) | כבוי | `false` | `false` |

**הערה:** בגמ"ח הראשי לא מריצים seeds - עמודת "ראשי" היא ברירת המחדל בקוד כשהשורה חסרה, לא ערך שנכתב.

הרשאות חדשות/רלוונטיות: `/admin/email-center`, `/admin/branches` - הנהלה ראשית; `/station-analytics` - `page:station_analytics`; העברת פריטים בין סניפים - `page:dresses_catalog`.

---

## ה. נתיבים / דפים / API חדשים (למכתב ה-PDF)

**דפים חדשים:** `/admin/email-center` (מרכז המיילים), `/admin/branches` (ניהול סניפים), `/station-analytics` ("המרות בעמדה"), `/station` (עמדת לקוח ציבורית - כבויה: "העמדה אינה זמינה"), `/privacy` ו-`/terms` (דפים ציבוריים; התקנון מוגש מהקובץ שבתוקף).
**שינויים במסכים קיימים:** לו"ז יומי - שורת סריקת ברקוד ושלבי הכנה/איסוף עם ברקוד, חלון "הגדרות תהליכים" (גלגל שיניים / `/schedule?settings=1`), שבבי "להעביר" בין סניפים, `?scan=<קוד>`; חיפוש מהיר וחיפוש ראשי - פאנל תפוסה/פריט/"איפה אני?" ו-placeholder "הקלד ברקוד או חפש..."; חלון "השכרה והחזרה" החדש - מעבר בין הזמנות בסריקה, שורת הודעות, "אשר מסירה" לפריטים שנרשמו בהכנה; לקוחה חדשה/כרטיס לקוחה - הסכמות (כשמופעלות) וניווט Enter; כרטיס הזמנה/הדפסה/מייל/PDF - שורת משלוח, כתובת איסוף + Google Maps, חתימה על התקנון; בורר לקוחות; לחצן "חזרה לממשק החדש" בכותרת הישנה (נווה); בדיקת מלאי ודפי הכנה (מידות ממוינות).
**API חדשים:** `/api/admin/email-center/{overview,preview,template/[id],fixed,outbox,campaign,campaign/[id],campaign/preview,campaign/recipients,campaign/test,campaign/upload}`, `/api/cron/email-campaigns`, `/api/email/unsubscribe`, `/api/admin/station-analytics`, `/api/admin/station-analytics/registrations`, `/api/admin/terms-file`, `/api/public-terms`, `/api/public-consent-info`, `/api/public-kiosk/{config,event,models,register}`, `/api/customers/[id]/kiosk-verify`, `/api/barcode-flow/resolve`, `/api/branches`, `/api/branches/needs`, `/api/dresses/items/relocate`, `/api/orders/[id]/shared-delivery`, `/api/schedule/barcodes`, `/api/schedule/settings`, `/api/search-panel`. (שונה: `POST /api/me/ui-variant` - מעבר כל המסכים בבת אחת.)
**Cron:** `/api/cron/daily` מטפל גם באישור הזמנה "אחרי X ימים", ימי תזכורת איסוף מרובים, כללי תזכורות משלוח ודיוורים שהגיע זמנם; ללא שינוי ב-`vercel.json`.

---

## ו. סדר פעולות מלא לליל הפריסה

1. **הכנה** (סעיף 0, כולל "החלטות הבעלים בלילה"): חיבורים, גיבוי מיידי + Neon branch + רישום deployment נוכחי + שמירת dry-run (0.3), לוודא שאף session אחר לא דוחף ל-`main`.
2. **DDL** (סעיף א) על **שני** ה-DB - קודם dry-run, אחר כך כתיבה: (1) `DressItem` **חובה**, ואז (2) `CustomerConsent`, (3) `StationEvent`, (4) `AuthThrottle`. לוודא "applied. table present: true" / אין שגיאה.
3. **אימות DDL:** להריץ שוב את ארבעת ה-dry-run (סעיף א) בשני ה-DB ולראות `ALREADY EXISTS` ל-`CustomerConsent` / `StationEvent` / `AuthThrottle`, ו-"עמודות שכבר קיימות: branch, locationBeforeRental" ל-`apply_branches_ddl.js`. (`prisma migrate diff --from-url` מול כל DB, עם משתנה סביבה ובלי להדפיס, הוא אימות נוסף **אופציונלי**.)
4. **Push:** קודם `git ls-remote origin main` - חייב להחזיר `9a56d6ab…`; אחרת **לעצור** ולמזג מחדש מול ה-`main` החדש (מישהו דחף). אחר כך: הרכז מאחד לגרסה, קומיט קוד אחרון (או `[force-deploy]`), `git push origin main` (SSH). לא לדחוף `integrate/…` ישירות כענף נפרד לפרודקשן.
5. **המתנה לפריסה** בשני הפרויקטים (`gemach-app-uyh4`, `gmach-neve-yaakov`):
   `gh api repos/moshehik/gemach-app/commits/<sha>/status` עד `state: success` בשני ההקשרים; ואז
   `curl https://gemach-app-uyh4-beryl.vercel.app/api/health` ו-`curl https://gmach-neve-yaakov.vercel.app/api/health` (`{"ok":true,"db":"up"}`), ו-`/api/version` בשניהם (הגרסה = הגרסה שנדחפה).
6. **בדיקות עשן ראשונות (לפני ה-seeds), בשני האתרים:** כניסה; **פתיחת הזמנה קיימת** ו**כרטיס דגם**; קטלוג שמלות נטען (מוכיח ש-DDL של `DressItem` תקין); חיפוש מהיר; לו"ז יומי נטען; `GET /api/settings` **בלי עוגייה** מחזיר רשימה קצרה בלבד, ו**עם עוגיית כניסה** מחזיר את הרשימה המלאה; `/privacy` ו-`/terms` נפתחים בלי התחברות; `/station` מציג "העמדה אינה זמינה" ו-`GET /api/public-kiosk/config` מחזיר `{"enabled":false}`; `/customer-interface` נטען; `/landing` נטען; `/api/version` = הגרסה שנדחפה.
7. **Seeds** (סעיף ב) **בנווה בלבד** לפי הסדר ב1…ב9 (ב4 בלי פרופיל; בראשי לא מריצים seeds). ב3ב רק אחרי אישור הבעלים לדוח.
8. **ניקויים בנווה** (סעיף ג) - רק אם הרכז ביקש; dry-run, אישור, כתיבה עם גיבוי.
9. **בדיקות עשן סופיות:**
   - נווה: כניסה (ממשק חדש כברירת מחדל; לחצן "חזרה לממשק החדש" בכותרת הישנה); הזמנה חדשה (חתימה על תקנון, בורר לקוחות `complete`); הזמנת משלוח - מייל אישור (כתובת איסוף `צוקרמן 1, נווה יעקב` + קישור מפות, שורות משלוח, "שימו לב", בלי קבלה/החזרה בהלוך-חזור); חיפוש מהיר: ברקוד מושכר → "השכרה והחזרה" נפתח, סריקה הבאה עוברת בין הזמנות; לו"ז: שורת הסריקה פעילה (קוד שלב מסמן "בוצע"), ובלי חלונית ברקוד כי ברקוד בלו"ז כבוי; `/station` מציג "העמדה אינה זמינה"; `/privacy`, `/terms` נפתחים בלי התחברות.
   - ראשי: הכול כמו קודם (הממשק הישן/הרגיל, בלי משלוח משותף, בלי ברקוד בלו"ז); מייל אישור הזמנה זהה לקודם; חיפוש ראשי - פאנל התפוסה. בכל האתרים: `/api/version` = הגרסה שנדחפה, `/privacy` ו-`/terms` ללא התחברות, `/station` = "העמדה אינה זמינה".
   - `/admin/email-center`: תצוגה מקדימה של "אישור הזמנה" עם ובלי משלוח (בלי שליחה אמיתית אלא באישור הבעלים); `/admin/branches` נפתח.
10. **תוכנית חזרה:**
   - **קוד:** Vercel **Instant Rollback** לפריסה הקודמת (הרשומה ב-0.3ג) בכל אחד משני הפרויקטים. שים לב: אחרי Instant Rollback דחיפות חדשות ל-`main` **לא יעלו** עד שמקדמים ידנית (Promote) פריסה. חלופה: קומיט חדש שעץ הקבצים שלו זהה ל-`9a56d6ab` - `git read-tree -u --reset 9a56d6ab` ואז commit עם `[force-deploy]` ודחיפה. (לא `git revert` של קומיט המיזוג.)
   - **DDL:** לא מחזירים (תוספתי ובטוח עם הקוד הישן; העמודות והטבלאות החדשות פשוט לא בשימוש).
   - **Seeds:** מחיקת השורות החדשות או שחזור לערך הקודם שהודפס ב-dry-run השמור.
   - **ממשק:** `set-ui-variant.js --screen <מסך> --value legacy --scope org --confirm-host <ep-…> --apply` (או `--scope user --employee <id> --clear`); `DATABASE_URL` מהסביבה, dry-run כברירת מחדל.
   - **ניקויים בנווה:** סקריפטי ה-rollback (`size_cleanup_rollback.js`, `clean_placeholder_model_names_rollback.js`) עם קובץ הגיבוי, dry-run קודם.
   - **מה שאי אפשר להחזיר:** מיילים שנשלחו, חיובים/זיכויים אוטומטיים שנרשמו אחרי הדלקת משלוח משותף, שורות `CustomerConsent`.
   - **אין לשחזר DB מ-branch של Neon** (ולא מגיבוי) אלא באסון נתונים - שחזור מוחק כל כתיבה שנעשתה מאז.

---

## ז. החלטות שנקבעו בשלב ב' ושאלות פתוחות

1. **קישור ציבורי בנווה:** נשאר כבוי (החלטת הרכז). הסקריפט `seed_kiosk_public_settings.js` שונה בהתאם (המקורי יצר `true` בנווה).
2. **`delivery_notice` במרכז המיילים:** ברירת המחדל = הנוסח המחושב מההגדרות; עקיפה במרכז מחליפה את כל הבלוק. שדה "כתובת" קבוע במרכז גובר על כתובת האיסוף בטקסט, אך קישור המפות נגזר תמיד מ-`gmach_pickup_address`.
3. ~~`AuthThrottle` חסר ב-`lib/ai/sqlTablePolicy.js`~~ - תוקן בשלב ג' (נוסף ל-`ALL_TABLES` ול-`NEVER_TABLES`; `test_ai_sql_table_policy` ירוק).
4. ~~ברקוד בלו"ז בנווה~~ - הוחלט: לא מדליקים בלילה הזה (ב4 בלי `--profile=neve`); ר' "החלטות הבעלים בלילה".
5. ב-`origin/main` הממשק של ההסכמות המפורשות כבוי; בנווה לא מתוכנן להדליק בלילה זה.
