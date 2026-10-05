# הפעלת חתימת התקנון ברמת הלקוח - סדר פעולות, בדיקות זהות ו-rollback (2026-10-05)

אישור הבעלים 2026-10-05: להפעיל בכרטיס הלקוח החדש את "חתמה על התקנון" ברמת הלקוחה, כולל סנכרון חתימות מההזמנות.
העמודות `Customer.hasSignedRegulations` (BOOLEAN NOT NULL DEFAULT false) ו-`Customer.regulationsSignedAt` (TIMESTAMP(3) NULL)
**כבר קיימות בשני ה-DB** (`prisma/migrations-pending/2026-10-04-customer-signed-regulations.sql`, הורץ ידנית). אין DDL בהפעלה הזו.
אין עמודות "נחתם ע״י" / "הזמנה מקושרת" ב-DB - ולכן חתימה ברמת הלקוחה לא שומרת מי/איזו הזמנה (רק מתי); ביומן ההיסטוריה של הלקוחה
נרשם מי סימן/ביטל (העובד המחובר) ומתי.

הענף: `feature/customer-signature-flip-2026-10-05`. שלוש קומיטים, שני דיפלויים:

| קומיט | תוכן | דיפלוי |
|---|---|---|
| C1 | `schema.prisma`: ההצהרה על שתי העמודות ב-`model Customer` (בדיוק כמו ה-DDL). הדגל נשאר כבוי | דיפלוי 1 |
| C1b | כלי ה-backfill (SQL + dry-run + `scripts/customer-signature-backfill.js`) + בדיקת ה-SQL + המסמך הזה. אינרטי: לא נטען בזמן ריצה | דיפלוי 1 (אותו push) |
| C2 | ההדלקה: `SIGNATURE_COLUMNS_READY=true`, PUT/POST של לקוח, `CARD_FIELDS`, הלחצן בכרטיס, סנכרון מהזמנות, בדיקות | דיפלוי 2 |

דיפלוי 1 = לדחוף ל-main עד C1b (כולל). דיפלוי 2 = C2. ב-C1b יש שינוי תחת `prisma/` ולכן ה-Ignored Build Step לא מדלג (ר' memory
vercel-ignore-build-step); אם משנים את הסדר - הקומיט האחרון שנדחף חייב להיות קומיט קוד או `[force-deploy]`.

## מה כל דיפלוי עושה

**דיפלוי 1 (בטוח כשהדגל כבוי).** `prisma generate` רץ בכל build (`package.json`: `"build": "prisma generate && next build --webpack"`) ולכן
הקליינט נבנה מהסכמה החדשה. שום קוד לא קורא או כותב את העמודות; `GET /api/customers/[id]` מחזיר אותן (כל העמודות) והכרטיס מתעלם
(הדגל כבוי: הכרטיס מציג חתימה נגזרת מההזמנות כמו היום). כל קריאת Prisma ל-Customer נשארת תקינה כי שתי העמודות קיימות ב-DB
(ל-`NOT NULL DEFAULT false` יש ברירת מחדל, אז גם יצירות מקליינט ישן עובדות). בדקתי שאין SQL גולמי עם רשימת עמודות של Customer שנשבר
(כל ה-`$queryRaw` על Customer בוחרים עמודות בשמן או `SELECT *`).
**תנאי קריטי:** כל DB שהאפליקציה מתחברת אליו עם הקליינט החדש חייב לכלול את שתי העמודות, אחרת כל שאילתת Customer נכשלת
(`column does not exist`) - ר' "DB-ים נוספים" למטה.

**דיפלוי 2 (ההדלקה).**
- `PUT /api/customers/[id]`: מקבל `hasSignedRegulations` (בוליאני בלבד, אחרת 400) **רק מהכרטיס החדש** (`cardVariant:'a5'`). הכרטיס הישן שולח
  את כל אובייקט הלקוח (כולל הדגל כפי שנטען) ולכן לעולם לא נכתב ממנו. `regulationsSignedAt` **מחושב בשרת בלבד** (`new Date()` ברגע הסימון);
  לא נקרא מהגוף. false->true: דגל + חותמת. true->false: רק הדגל; החותמת נשארת כ"נחתמה לאחרונה" וזה הסימן ש"הביטול מכוון" (ר' למטה).
  בלי שינוי בדגל - לא נוגעים בכלום. שורת יומן אחת ("חתימה על התקנון: לא ← כן"), בלי שורה נפרדת למועד.
  שרת/קליינט בלי העמודות: 503 `SIGNATURE_UNAVAILABLE` (לא "הצלחה" שלא נשמרה). 409 על `updatedAt` ישן חל גם עליו.
- `POST /api/customers`: אותו כלל ליצירה (a5 בלבד, חותמת מהשרת). אין היום שדה חתימה בטופס "לקוחה חדשה" - רק תמיכה בשרת.
- `CARD_FIELDS`: `hasSignedRegulations` (תווית "חתימה על התקנון", ערכים "חתום/לא חתום") - נכנס למסילת השינויים, לסיכום, לביטול ולשמירה.
- הלחצן `#termsBtn` ב"תקנון ועדכונים": עורך את הטיוטה (נשמר ב"שמור" כמו כל שדה). נעול (`aria-disabled`, הסבר ב-tooltip) רק בכרטיס לצפייה בלבד
  (לקוחה מחוקה) או כשהחתימה נגזרת מהזמנה בלבד (עוד לא נשמרה ברמת הלקוחה). הרשאה: כמו עריכת כל שדה אחר בכרטיס (`checkAuth` + שער הדף `page:customers`) -
  לא הוספתי הרשאה חדשה כי "הרשאה לפי הכללים הקיימים" בכרטיס הלקוח היא אחת לכל השדות.
- מצב החתימה בכרטיס (`signatureState`): שמור true -> חתומה; שמור false **עם חותמת** -> בוטלה בכוונה (לא חוזרים להזמנות, אחרת אי אפשר לבטל חתימה
  של לקוחה שיש לה הזמנה חתומה); שמור false **בלי חותמת** -> עוד לא נשמרה חתימה (לא עבר backfill) -> נפילה להזמנות ("חתמה בהזמנה #N", לקריאה בלבד).
- סנכרון מהזמנות (`app/api/orders/[id]/route.js`, אחרי ה-`$transaction`, לפני שליפת ההזמנה הסופית): כשהזמנה עוברת **false->true** ב-`hasSignedRegulations`
  והלקוחה עוד לא חתומה - `customer.update` עם `auditAs` (שורת יומן אחת על הלקוחה, `regulationsSignedAt` = עכשיו בשרת). לא דורס חתימה קיימת. לקוחה מחוקה / בלי
  עמודות - מדלגים. כשל בסנכרון נבלע (נרשם בלוג) ולא מכשיל שמירת הזמנה. אין קריאות בתוך `$transaction`. שמירת הזמנה חתומה שנייה (אין מעבר) לא מסנכרנת -
  כך שביטול חתימה ידני בכרטיס הלקוחה לא מתבטל בכל שמירת הזמנה.
  תוצאה לוואי מכוונת: `customer.update` מקדם `Customer.updatedAt`, ולכן כרטיס לקוחה פתוח במקביל יקבל 409 ("עודכן במקום אחר") בשמירה הבאה - שינוי אמיתי.

## סדר הפעולות (לליד) - לכל גמח בנפרד, אחרי אישור

כל הפקודות מתוך שורש ה-worktree. הסקריפט `scripts/customer-signature-backfill.js` הוא **dry-run כברירת מחדל**, בודק host ועמודות ומדפיס; כתיבה רק עם `--write`.

0. **לפני הכול (קריאה בלבד, אין צורך בדיפלוי):** `node scripts/customer-signature-backfill.js --org=1` ואז `--org=2`.
   - מדפיס `org1 DB host: ...` - לוודא שזה ה-host של הגמח הראשי (פרויקט Vercel `gemach-app-uyh4`) ושב-org2 זה host של נווה יעקב (`gmach-neve-yaakov`) -
     ושהם שונים (הסקריפט נעצר מעצמו אם זהים או ריקים). ה-env של org 2 הוא `DATABASE_URL_ORG2`; אחרי cutover/החלפת DB לוודא שהוא מצביע על ה-DB **הנוכחי**
     (memory neve-yaakov-db-cutover-silent-data-loss).
   - מדפיס את שתי העמודות מ-`information_schema` - חייבות להיות שתיים, אחרת נעצר (`ABORT`).
   - מדפיס מספרים + דגימה מוצפנת (ר' שלב 2). זה כבר ה-dry-run.
1. **דיפלוי 1:** לדחוף ל-main את C1+C1b. לאמת: (א) לוג ה-build בשני פרויקטי Vercel כולל `prisma generate` והצליח; (ב) בשני האתרים: פתיחת כרטיס לקוחה (חדש וישן),
   שמירת עריכה מהכרטיס הישן, רשימת לקוחות, חיפוש גלובלי, יצירת הזמנה והזמנה ישנה פתוחה; (ג) ב-Runtime Logs אין `P2022`/`column ... does not exist`;
   (ד) הכרטיס החדש עדיין מציג "טרם נחתם"/"חתמה בהזמנה #N" כמו קודם (הדגל כבוי).
2. **dry-run + תיעוד המספרים:** `node scripts/customer-signature-backfill.js --org=1` / `--org=2` (או הדבקת `prisma/migrations-pending/2026-10-05-customer-signature-backfill-dryrun.sql`
   בקונסולת Neon של אותו גמח). לשמור את `would_change` ואת השאר. הגיוני: `would_change` קרוב למספר הלקוחות הפעילים עם הזמנה חתומה פחות מי שכבר חתום/בוטל.
   `signed_orders_without_customer` = הזמנות חתומות בלי לקוחה - לא ייכנסו (אין למי). הדגימה מציגה `anon_customer` (8 תווים של md5 של מזהה הלקוחה), מספר ההזמנה
   והתאריך שיירשם - לבדוק 2-3 ידנית מול ההזמנה.
   מומלץ (ל-rollback של ה-backfill): לשמור לפני הכתיבה רשימת מזהים:
   ```sql
   SELECT c."id" FROM "Customer" c
   WHERE c."isDeleted" = false AND c."hasSignedRegulations" = false AND c."regulationsSignedAt" IS NULL
     AND EXISTS (SELECT 1 FROM "Order" o WHERE o."customerId" = c."id" AND o."isDeleted" = false AND o."hasSignedRegulations" = true);
   ```
3. **Backfill:** `node scripts/customer-signature-backfill.js --org=1 --write` ואז `--org=2 --write`. הסקריפט מריץ את ה-UPDATE בטרנזקציה אחת ו**מתבטל (rollback)**
   אם מספר השורות שעודכנו שונה מ-`would_change` של אותה ריצה; בסוף מדפיס `would_change` שחייב להיות 0. הרצה חוזרת בטוחה (0 שורות). ה-UPDATE הוא SQL גולמי:
   לא נוגע ב-`Customer.updatedAt` (אין 409 שווא בכרטיסים פתוחים) ולא נכתב ביומן (מכוון - מילוי נתונים היסטורי; לא להוסיף שורות AuditLog ידניות).
   חוקי ה-backfill: רק לקוחות פעילים; רק מי שאין לו חתימה שמורה **וגם** אין חותמת (לא נוגע בחתימה שמורה ולא בחתימה שבוטלה בכוונה); מקור = ההזמנה החתומה
   הפעילה **המוקדמת ביותר** (`COALESCE(orderDate, updatedAt)`, שוויון -> `orderId` נמוך).
4. **דיפלוי 2:** לדחוף C2 (הקומיט האחרון הוא קוד - נבנה). לאמת בשני האתרים: (א) לקוחה שנחתמה ב-backfill מציגה "חתמה · <תאריך עברי>" (ללא `#null`); (ב) לחיצה על הלחצן
   -> שורה אחת במסילה ("חתימה על התקנון סומן/בוטל"), "שמור" -> שורת יומן אחת, הכרטיס מציג את המצב החדש; (ג) לחצן נעול בלקוחה מחוקה ובחתימה שנגזרת מהזמנה בלבד;
   (ד) סימון "חתם על תקנון" בהזמנה חדשה של לקוחה לא חתומה מסמן גם את הכרטיס שלה; (ה) הדפסת כרטיס לקוחה ("חתימה על תקנון: נחתם"); (ו) ביקורת 1280 / 375.
5. **ריצה חוזרת של ה-backfill אחרי דיפלוי 2** (`--org=N` ואז `--write` אם `would_change > 0`): חתימות בהזמנות שנרשמו בין שלב 3 לסיום דיפלוי 2 לא סונכרנו (הסנכרון חי רק מדיפלוי 2).
   עד אז הכרטיס מציג אותן בנפילה להזמנות, ולכן אין נזק תצוגתי בחלון הזה.

## בדיקות זהות לכל גמח (חובה לפני כל `--write`)
- ה-host שמודפס (`org1 DB host` / `org2 DB host`) תואם את הפרויקט הנכון ושונה מהשני. הסקריפט נעצר אם הם זהים; הבדיקה המקבילה לכתיבה ב-seed scripts (host-check) היא אותה פונקציה (`connectOrg`).
- `information_schema` מדפיס בדיוק `hasSignedRegulations boolean NO false` ו-`regulationsSignedAt timestamp without time zone YES`.
- מספר הלקוחות הפעילים (`active_customers`) סביר לגמח (הגמח הראשי גדול משמעותית מנווה יעקב) - אם המספרים הפוכים, עוצרים.
- אחרי כל כתיבה: להריץ שוב את אותו `--org=N` (dry-run) - `would_change` = 0.

## DB-ים נוספים (לא prod) - לבדוק לפני דיפלוי 1
האפליקציה יכולה להתחבר ל-TEST branch (`.active-db`, `TEST_DATABASE_URL`), ל-DB מקומי (`.env`), ול-scratch/גיבויים. עם הקליינט החדש כל DB שאליו מתחברת אפליקציה חייב לכלול את שתי העמודות.
אם ה-TEST branch נוצר לפני 2026-10-04 והעמודות לא הורצו בו - להריץ שם את `2026-10-04-customer-signed-regulations.sql` (או לרענן את ה-branch). גיבויי Neon נפרדים לא מושפעים (הם לא מוגשים לאפליקציה),
אבל שחזור מגיבוי ישן לתוך DB חי = העמודות חוזרות לברירת מחדל (אין חתימה שמורה) והכרטיס חוזר ליפול להזמנות עד ה-backfill הבא. שרת פיתוח מקומי: אחרי `prisma generate` חובה להפעיל מחדש
(הקליינט נשמר על globalThis; memory prisma-client-cache-needs-restart). `schema.local.prisma`/`schema-sqlite.prisma` (מראות offline) לא נגעו.

## Rollback
- **דיפלוי 2 בלבד:** `SIGNATURE_COLUMNS_READY=false` (או revert של C2). הנתונים נשארים; הכרטיס חוזר לתצוגה נגזרת מההזמנות. ה-PUT/POST/סנכרון חוזרים להתעלם מהעמודות (revert של C2).
  חתימות שכבר נשמרו נשארות ב-DB; ההזמנות לא הושפעו מעולם.
- **דיפלוי 1:** revert של C1 מחזיר את הקליינט הישן; העמודות ב-DB לא מפריעות לו (Prisma מתעלם מעמודות לא מוכרות, ולדגל יש DEFAULT). לא לנסות `DROP COLUMN`.
- **ביטול ה-backfill (רק אם חייבים):** מי שמולא ע"י ה-backfill הם בדיוק מזהי הרשימה שנשמרה בשלב 2 (לפני הכתיבה):
  ```sql
  UPDATE "Customer" SET "hasSignedRegulations" = false, "regulationsSignedAt" = NULL
  WHERE "id" = ANY (ARRAY[ ...המזהים השמורים... ]::text[]);
  ```
  (גם הפעם גולמי; בלי AuditLog ידני). לא לבטל לפי תנאי כללי - יתכן שבינתיים סומנו ידנית לקוחות אחרות.

## הערות ופערים ידועים
- בדיקות: `node scripts/customer-signature-tests/run.mjs` (3 אזורי זמן; routes אמיתיים מול shim בזיכרון), `node scripts/customer-card-tests/run.mjs`, `node scripts/test_page_variant_switch.mjs`,
  `node scripts/test_ui_variant.mjs`, `node scripts/test_ui_variant_self_switch.mjs`, `node --test scripts/customer-history.test.mjs`. לא נבדק בדפדפן אמיתי ולא מול DB.
- כשל קיים שלא קשור: `parity.test.mjs` "POST /api/payments" נכשל ב-`extra is not defined` (הכרטיס הישן הוסיף `...extra` ל-`submitAdditionalPayment`); בדיקת CC-O6 על ה-DDL (`CR`) נכשלת ב-checkout של Windows עם `autocrlf=true`.
- `lib/ai/whitelistRegistry.js` לא עודכן - ה-AI לא רואה את העמודות (ברירת המחדל מהתוכנית).
- חתימה בלי הזמנה: אין שדה בטופס "לקוחה חדשה" (רק תמיכה בשרת).
