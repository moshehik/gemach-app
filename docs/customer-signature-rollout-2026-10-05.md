# הפעלת חתימת התקנון ברמת הלקוח - סדר פעולות, בדיקות זהות ו-rollback (2026-10-05, מעודכן אחרי סקירה 2026-10-06)

אישור הבעלים 2026-10-05: להפעיל בכרטיס הלקוח החדש את "חתמה על התקנון" ברמת הלקוחה, כולל סנכרון חתימות מההזמנות.
העמודות `Customer.hasSignedRegulations` (BOOLEAN NOT NULL DEFAULT false) ו-`Customer.regulationsSignedAt` (TIMESTAMP(3) NULL)
**כבר קיימות בשני ה-DB** (`prisma/migrations-pending/2026-10-04-customer-signed-regulations.sql`, הורץ ידנית). אין DDL בהפעלה הזו.
אין עמודות "נחתם ע״י" / "הזמנה מקושרת" ב-DB - חתימה ברמת הלקוחה שומרת מתי, לא מי/איזו הזמנה; ביומן ההיסטוריה של הלקוחה נרשם מי סימן/ביטל ומתי.

הענף: `feature/customer-signature-flip-2026-10-05`. קומיטים:

| קומיט | תוכן |
|---|---|
| 1 | `schema.prisma`: ההצהרה על שתי העמודות ב-`model Customer` (בדיוק כמו ה-DDL). הדגל נשאר כבוי |
| 2 | כלי ה-backfill (SQL + dry-run + `scripts/customer-signature-backfill.js`) + בדיקת ה-SQL + המסמך הזה. אינרטי: לא נטען בזמן ריצה |
| 3 | ההדלקה: `SIGNATURE_COLUMNS_READY=true`, PUT/POST של לקוח, `CARD_FIELDS`, הלחצן בכרטיס, סנכרון מהזמנות, בדיקות |
| 4 | תיקוני הסקירה: דגל חתימה רק בעריכה מפורשת (`signatureEdit`), סנכרון מיד אחרי ה-commit, הזמנות פעילות בלבד, בדיקות רגרסיה |
| 5 | הסקריפט לא נופל ל-`DATABASE_URL`; המסמך הזה |

הקומיטים נשארים נפרדים כדי שאפשר יהיה לבצע revert של ההדלקה (3+4) בלי להשאיר את הסכמה.

## מה הקוד עושה

**הסכמה (קומיט 1).** `prisma generate` רץ בכל build (`"build": "prisma generate && next build --webpack"`), והקליינט נבנה מהסכמה החדשה.
כל קריאת Prisma ל-Customer נשארת תקינה כי שתי העמודות קיימות ב-DB (ל-`NOT NULL` יש DEFAULT, אז גם יצירות מקליינט ישן עובדות). אין SQL גולמי שבונה
רשימת עמודות של Customer (נבדק). **תנאי קריטי:** כל DB שהאפליקציה מתחברת אליו עם הקליינט החדש חייב לכלול את שתי העמודות, אחרת כל שאילתת
Customer נכשלת (`column does not exist`, P2022) - ר' "DB-ים נוספים".

**ההדלקה (קומיטים 3-4).**
- `PUT /api/customers/[id]` ו-`POST /api/customers`: `hasSignedRegulations` נקרא **רק** כשהגוף הוא מהכרטיס החדש (`cardVariant:'a5'`) **וגם** נושא סימון עריכה
  מפורש `signatureEdit === true` (ובוליאני אמיתי, אחרת 400). בלי הסימון - כל ערך חתימה בגוף מתעלמים ממנו. הסיבה: כרטיס פתוח/ישן (גם לשונית שרצה ב-JS ישן) שולח את כל אובייקט
  הלקוח כולל הדגל כפי שנטען, ומקרה "false ישן" היה מבטל בשקט חתימה שנרשמה בינתיים (ה-409 על `updatedAt` לא תופס: ה-backfill הוא SQL גולמי בלי עדכון `updatedAt`).
  הכרטיס החדש (`buildSavePayload(cur, saved)`) מסיר תמיד את שני שדות החתימה מהגוף ושולח `hasSignedRegulations` + `signatureEdit:true` רק כשהמשתמשת שינתה את הלחצן בטיוטה.
- `regulationsSignedAt` **מחושב בשרת בלבד** (`new Date()`); לא נקרא מהגוף. false->true: דגל + חותמת. true->false: רק הדגל; החותמת נשארת כ"נחתמה לאחרונה" וזה הסימן
  ש"הביטול מכוון". בלי שינוי בדגל - לא נוגעים בכלום. שורת יומן אחת ("חתימה על התקנון: לא ← כן"). שרת/קליינט בלי העמודות: 503 `SIGNATURE_UNAVAILABLE`.
  409 על `updatedAt` ישן חל גם עליו. ב-POST אין היום שדה חתימה בטופס "לקוחה חדשה" - רק תמיכה בשרת.
- `CARD_FIELDS`: `hasSignedRegulations` ("חתום/לא חתום") במסילת השינויים, בסיכום, בביטול ובשמירה.
- הלחצן `#termsBtn`: עורך את הטיוטה (נשמר ב"שמור"). נעול (`aria-disabled`, הסבר ב-tooltip) בכרטיס לצפייה בלבד (לקוחה מחוקה) או כשהחתימה נגזרת מהזמנה בלבד.
  הרשאה: כמו עריכת כל שדה בכרטיס (`checkAuth` + שער הדף `page:customers`) - כל עובד מחובר יכול לסמן/לבטל. החלטה מכוונת (נשארת).
- מצב החתימה בכרטיס (`signatureState`): שמור true -> חתומה; שמור false **עם חותמת** -> בוטלה בכוונה (לא חוזרים להזמנות); שמור false **בלי חותמת** -> לא נשמרה חתימה
  (עוד לא backfill) -> נפילה להזמנות ("חתמה בהזמנה #N", לקריאה בלבד).
- סנכרון מהזמנות (`app/api/orders/[id]/route.js`): **מיד אחרי ה-commit של ה-`$transaction`**, לפני `recalculateOrderObligations` / `applyDeliveryCharge` / שליפת ההזמנה הסופית
  (כך שתקלה מאוחרת לא "צורכת" את המעבר בלי שהסנכרון קרה). רק כשהזמנה **פעילה** (לא מחוקה) עוברת **false->true** והלקוחה עוד לא חתומה: `customer.update` עם `auditAs`
  (שורת יומן אחת, `regulationsSignedAt` = עכשיו בשרת). לא דורס חתימה קיימת; לקוחה מחוקה / בלי עמודות - מדלגים; כשל נבלע (לוג) ולא מכשיל שמירת הזמנה; אין קריאות בתוך
  `$transaction`. שמירה חוזרת של הזמנה חתומה (אין מעבר) לא מסנכרנת - ביטול ידני בכרטיס הלקוחה לא מתבטל. לוואי מכוון: `Customer.updatedAt` מתקדם, וכרטיס לקוחה פתוח במקביל
  יקבל 409 בשמירה הבאה.

## הסדר המומלץ (לליד) - לכל גמח בנפרד

הדיפלוי כולו **פעם אחת** (קומיטים 1-5 יחד; ה-DDL כבר רץ בשני ה-DB). ה-backfill הוא SQL גולמי שתלוי רק בעמודות, לא בקוד, ולכן רץ **לפני** הדיפלוי.

### חיבור ל-DB (חשוב)
`scripts/customer-signature-backfill.js` מתחבר **רק** דרך `PROD_DATABASE_URL` (גמח ראשי) ו-`PROD_DATABASE_URL_ORG2` (נווה יעקב), **ושניהם חובה** (כדי להשוות host). הוא **לא נופל בשקט
ל-`DATABASE_URL`** (שיכול להצביע על TEST/מקומי) - משתנה חסר = `ABORT`. ל-worktree הזה אין `.env`, לכן להעביר קובץ env מפורש, למשל:
`--db-env=C:\Users\moshe\Desktop\<הריפו הראשי>\.env.local` (קובץ שמכיל את שני המשתנים; קובץ ה-`--db-env` גובר על הסביבה). בכל ריצה מודפסים שם המשתנה, מקורו וה-host.
org 2 חייב להצביע על ה-DB **החי הנוכחי** (אחרי cutover/החלפת DB לוודא ב-`scratch/new_gemach_db.env` ובלוח של Neon; memory neve-yaakov-db-cutover-silent-data-loss).

### 1. Preflight - dry-run לכל גמח (קריאה בלבד)
`node scripts/customer-signature-backfill.js --org=1 --db-env=<קובץ>` ואז `--org=2`.
- ה-host המודפס של org1 חייב להיות זהה ל-host של ה-DB שמוגדר בפרויקט Vercel של הגמח הראשי (`gemach-app-uyh4`), ושל org2 ל-host שבפרויקט נווה יעקב (`gmach-neve-yaakov`) - **להשוות
  ידנית מול Vercel -> Settings -> Environment Variables (או `vercel env pull`)**. שני ה-host שונים (הסקריפט עוצר אם זהים).
- הפלט כולל את שתי העמודות מ-`information_schema` (חייבות להיות בדיוק שתיים, אחרת `ABORT`), מספרים ודגימה מוצפנת.
- לשמור את `would_change` ואת השאר. הגיוני: `would_change` קרוב למספר הלקוחות הפעילים עם הזמנה פעילה חתומה פחות מי שכבר חתום/בוטל. `signed_orders_without_customer` לא ייכנסו.
  הדגימה: `anon_customer` (8 תווים של md5 של מזהה הלקוחה), מספר ההזמנה והתאריך שיירשם - לבדוק 2-3 ידנית מול ההזמנה. גם אפשר להדביק את
  `prisma/migrations-pending/2026-10-05-customer-signature-backfill-dryrun.sql` בקונסולת Neon של אותו גמח.
- לשמור לפני הכתיבה רשימת מזהים (ל-rollback של ה-backfill):
  ```sql
  SELECT c."id" FROM "Customer" c
  WHERE c."isDeleted" = false AND c."hasSignedRegulations" = false AND c."regulationsSignedAt" IS NULL
    AND EXISTS (SELECT 1 FROM "Order" o WHERE o."customerId" = c."id" AND o."isDeleted" = false AND o."hasSignedRegulations" = true);
  ```

### 2. Backfill - `--write` לכל גמח, לפני הדיפלוי
`node scripts/customer-signature-backfill.js --org=1 --db-env=<קובץ> --write` ואז `--org=2 ... --write`. ה-UPDATE רץ בטרנזקציה אחת ו**מתבטל (rollback)** אם מספר השורות שונה
מ-`would_change` של אותה ריצה; בסוף מודפס `would_change` שחייב להיות 0. אחרי כל כתיבה: להריץ שוב dry-run => `would_change = 0`. הרצה חוזרת בטוחה. ה-UPDATE הוא SQL גולמי:
לא נוגע ב-`Customer.updatedAt` ולא נכתב ביומן (מכוון; לא להוסיף שורות AuditLog ידניות). חוקים: לקוחות פעילים בלבד; רק מי שאין לו חתימה שמורה **וגם** אין חותמת (לא נוגע בחתימה שמורה
ולא בחתימה שבוטלה); מקור = ההזמנה החתומה הפעילה **המוקדמת ביותר** (`COALESCE(orderDate, updatedAt)`, שוויון -> `orderId` נמוך). הקוד הישן שעדיין רץ מתעלם מהעמודות - אין השפעה.

### 3. דיפלוי A (פעם אחת)
לדחוף ל-main את כל הקומיטים. הקומיט האחרון חייב להיות קומיט קוד (שינוי תחת `app/ components/ lib/ prisma/`) או להכיל `[force-deploy]` (ר' memory vercel-ignore-build-step; קומיט 5
נוגע רק ב-`docs/` ו-`scripts/` ולכן היה מדלג - הודעתו נושאת `[force-deploy]`; אם מוסיפים קומיטים אחריו, הקומיט האחרון חייב להיות קומיט קוד או לשאת את התג). לאמת בשני פרויקטי Vercel:
- לוג ה-build כולל `prisma generate` והצליח; **ב-Runtime Logs של שני הפרויקטים אין `P2022` / `column ... does not exist`**.
- בדיקות ידניות בשני האתרים: (א) כרטיס לקוחה חדש - לקוחה שנחתמה ב-backfill מציגה "חתמה · <תאריך עברי>" (בלי `#null`); סימון/ביטול בלחצן -> שורה אחת במסילה ("חתימה על התקנון סומן/בוטל"),
  "שמור" -> שורת יומן אחת; (ב) שמירת עריכה מהכרטיס **הישן** (לא משנה חתימה); (ג) סימון "חתם על תקנון" בהזמנה חדשה של לקוחה לא חתומה מסמן גם את הכרטיס שלה; (ד) הדפסת כרטיס
  לקוחה ("חתימה על תקנון: נחתם"); (ה) לחצן נעול בלקוחה מחוקה ובחתימה שנגזרת מהזמנה בלבד; (ו) ביקורת 1280 / 375.

### 4. ריצה חוזרת של ה-backfill אחרי הדיפלוי
dry-run ואז `--write` אם `would_change > 0`: חתימות בהזמנות שנרשמו בין שלב 2 לסיום הדיפלוי לא סונכרנו (הסנכרון חי רק מהדיפלוי). עד אז הכרטיס מציג אותן בנפילה להזמנות, ולכן אין נזק תצוגתי.

## DB-ים נוספים - לבדוק שהעמודות קיימות **לפני** הדיפלוי
עם הקליינט החדש כל DB שאפליקציה מתחברת אליו חייב לכלול את שתי העמודות:
- ה-TEST branch של Neon (`.active-db`, `TEST_DATABASE_URL`) - אם נוצר לפני 2026-10-04 והעמודות לא הורצו בו: להריץ שם את `2026-10-04-customer-signed-regulations.sql` (או לרענן את ה-branch).
- ה-DB המקומי ב-`.env` של מפתחים (ושרת פיתוח: אחרי `prisma generate` חובה הפעלה מחדש; הקליינט נשמר על globalThis; memory prisma-client-cache-needs-restart).
- DB-ים של Vercel Preview (משתני Preview של שני הפרויקטים) - אילו DB הם מצביעים; אם TEST/branch - אותה בדיקה.
- נווה יעקב: `DATABASE_URL_ORG2` / `PROD_DATABASE_URL_ORG2` חייב להיות ה-DB החי הנוכחי (ר' למעלה).
- גיבויי Neon נפרדים לא מושפעים (לא מוגשים לאפליקציה); שחזור מגיבוי ישן לתוך DB חי = העמודות חוזרות לברירת מחדל, והכרטיס נופל להזמנות עד ה-backfill הבא.
`schema.local.prisma`/`schema-sqlite.prisma` (מראות offline) לא נגעו.

## Rollback
- **ההדלקה בלבד:** `SIGNATURE_COLUMNS_READY=false` או revert של קומיטים 3-4. הנתונים נשארים; הכרטיס חוזר לתצוגה נגזרת מההזמנות; ה-PUT/POST/סנכרון חוזרים להתעלם מהעמודות. ההזמנות לא הושפעו מעולם.
- **הסכמה:** revert של קומיט 1 מחזיר את הקליינט הישן; העמודות ב-DB לא מפריעות לו (Prisma מתעלם מעמודות לא מוכרות, ולדגל יש DEFAULT). לא לנסות `DROP COLUMN`.
- **ביטול ה-backfill (רק אם חייבים):** מי שמולא ע"י ה-backfill הם בדיוק מזהי הרשימה ששמרתם בשלב 1:
  ```sql
  UPDATE "Customer" SET "hasSignedRegulations" = false, "regulationsSignedAt" = NULL
  WHERE "id" = ANY (ARRAY[ ...המזהים השמורים... ]::text[]);
  ```
  (גולמי, בלי AuditLog ידני). לא לבטל לפי תנאי כללי - יתכן שבינתיים סומנו ידנית לקוחות אחרות.

## בדיקות והערות
- `node scripts/customer-signature-tests/run.mjs` (3 אזורי זמן; ה-routes האמיתיים מול shim בזיכרון, כולל רגרסיית "false ישן + `updatedAt` תואם"), `node scripts/customer-card-tests/run.mjs`,
  `node scripts/test_page_variant_switch.mjs`, `node scripts/test_ui_variant.mjs`, `node scripts/test_ui_variant_self_switch.mjs`, `node --test scripts/customer-history.test.mjs`. לא נבדק בדפדפן אמיתי ולא מול DB.
- כשל קיים שלא קשור: `parity.test.mjs` "POST /api/payments" (`extra is not defined`); בדיקת CC-O6 על ה-DDL (`CR`) נכשלת ב-checkout של Windows עם `autocrlf=true` (עוברת ב-LF).
- `lib/ai/whitelistRegistry.js` לא עודכן - ה-AI לא רואה את העמודות.
