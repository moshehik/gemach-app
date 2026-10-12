# הסכמות לקוחות - תקנון, דיוורים ומדיניות פרטיות (12.10.2026)

מסמך זה מתאר **מה נרשם, איפה, ומה נדרש כדי לעמוד בחוק** עבור שלוש הסכמות של לקוחה בגמ"ח:

1. **חתם/ה על התקנון** (כן / לא)
2. **מאשר/ת קבלת דיוורים** (כן / לא)
3. **אישרתי את מדיניות הפרטיות** (תיבת אישור)

> חשוב: הטקסטים המשפטיים בקוד (ברירת המחדל של מדיניות הפרטיות, נוסח הדיוור) הם **טיוטה** שנכתבה לפי הבנת החוק, ו**טרם נבדקה על ידי עו"ד**. לפני הפעלה בפועל בשני הגמ"חים יש להעביר אותם לעו"ד (ר' "סיכונים פתוחים" בסוף).

## איך זה נראה למשתמשים

| איפה | מה רואים |
|---|---|
| לקוח חדש בהזמנה חדשה (אשף + טופס ישן), לקוח חדש (`/customers/new`, ישן וחדש) | שלוש ההסכמות, **בלי ברירת מחדל**; חובה לענות על התקנון ועל הדיוורים (כן/לא) ולסמן אישור פרטיות |
| כרטיס לקוח (חדש וישן) | אותן שלוש, רשות (לא חוסמות עריכת פרט אחר בלקוחה ותיקה), עם שורת מצב "אושר · בעמדה / בידי עובד · תאריך עברי" |
| קישורים | "צפייה בתקנון" -> `/terms`; "קריאת המדיניות" -> `/privacy` (נפתחים בלשונית חדשה) |
| עמדת הלקוח | הרכיב `ConsentFields` + חוזה השרת (ר' "חוזה לעמדת הלקוח") |
| הגדרות | **הגדרות מערכת -> הזמנות (או "הזמנות" בישן) -> "תקנון, פרטיות והסכמות"**: מתג הפעלה, חובת פרטיות, נוסח המדיניות, והעלאת קובץ התקנון (PDF/תמונה) עם היסטוריית גרסאות |

כל זה מאחורי המתג `explicit_consent_enabled` (שורה חסרה / `false` = הטפסים בדיוק כמו קודם).

### ניווט ב-Enter
בכל טפסי הלקוח (`lib/enterNavigation.js`, hook: `app/components/shared/useEnterNavigation.js`): Enter עובר לשדה הבא **גם דרך מתג / תיבת סימון / בחירת כן-לא** - Enter עליהם רק מקדם ולעולם לא משנה בחירה (רווח משנה; חצים בתוך כן/לא). Shift+Enter אחורה. בשדה האחרון Enter שומר (או, בכרטיס לקוח, מעביר פוקוס ל"שמור" במסילה). textarea: Ctrl/Cmd+Enter. כפתורים/קישורים לא נוגעים.

## מה נרשם ואיפה

### 1. מצב נוכחי - עמודות `Customer` (קיימות, ללא שינוי סכמה)
- `marketingConsent` (Boolean) - מאשר/ת דיוורים עכשיו.
- `hasSignedRegulations` (Boolean) + `regulationsSignedAt` - חתימה על התקנון (מנגנון החתימה הקיים, `lib/customerSignature.js`; החותמת **מחושבת בשרת בלבד**).

### 2. ראיה - טבלה חדשה `CustomerConsent` (יומן, append-only)
שורה לכל הסכמה / סירוב / ביטול. אין עדכון ואין מחיקה; שינוי דעה = שורה חדשה.

| שדה | משמעות |
|---|---|
| `customerId` | הלקוחה |
| `kind` | `terms` / `marketing` / `privacy` |
| `granted` | `true` = אישרה / חתמה; `false` = סירבה / ביטלה (גם "לא" מפורש נרשם - זו ראיה שנשאלה) |
| `channel` | `staff` (עובד/ת במערכת) / `kiosk` (עמדה בחנות) / `public` (קישור ציבורי, עתידי) |
| `method` | `staff_recorded` (עובד רשם בשם הלקוחה) / `customer_self` (הלקוחה עצמה) |
| `surface` | המסך: `new-order` / `new-customer` / `customer-card` / `kiosk-register` ... (רשימה סגורה) |
| `recordedByEmployeeId` | העובד/ת (מעוגייה מאומתת); בעמדה - ריק |
| `documentVersion` | תקנון: sha256 של הקובץ שהיה בתוקף; פרטיות: sha256 (12 תווים) של הטקסט המוצג; דיוור: מזהה גרסת הנוסח |
| `documentRef` | תקנון: מזהה ה-Attachment של הקובץ (כדי לשחזר בדיוק מה אושר) |
| `wording` | דיוור: **הנוסח המלא שהוצג** ("מאשר/ת קבלת דיוורים - עדכונים והודעות שיווקיות ... אפשר להסיר את ההסכמה בכל עת.") |
| `meta` | JSON חופשי (למשל מזהה עמדה) |
| `createdAt` | **מועד השרת** (`CURRENT_TIMESTAMP` ב-DB) |

**הכל מחושב בשרת**: שום שדה מהטבלה (זמן, עובד, ערוץ, גרסה, נוסח) לא נלקח מגוף הבקשה (נבדק ב-`scripts/customer-consent-tests/routes.test.mjs`, "a forged body cannot set ...").

הטבלה אינה עוברת בתוסף ה-AuditLog (נכתבת ב-`createMany`) - היא עצמה היומן. שינוי העמודות ב-`Customer` נרשם כרגיל בהיסטוריה (`auditAs`, שורה אחת).

### 3. קובץ התקנון
`Attachment` (הטבלה הקיימת) + מפתחות ב-`SystemSetting`: `terms_file_id`, `terms_file_name`, `terms_file_type`, `terms_file_sha256`, `terms_file_uploaded_at`, `terms_file_history` (JSON). **הגרסאות הישנות נשארות** ב-DB (ראיה למה שאושר בעבר). מפתחות אלה נכתבים רק דרך `/api/admin/terms-file` (נחסמים ב-`POST /api/settings`) ואינם מופיעים ברשימת ההגדרות.

### 4. מדיניות הפרטיות
`SystemSetting privacy_policy_text` (ריק = ברירת המחדל ב-`lib/privacyPolicyDefault.js`). השם ופרטי הקשר נלקחים מ-`gmach_name` / `main_email` / `gmach_phone` / `gmach_address` של כל גמ"ח (נווה יעקב: טלפון וכתובת ריקים - לא מוצגים). "עודכן לאחרונה" = תאריך עדכון השורה (עברי).

## ההתנהגות בשרת (`lib/customerConsent.js`)
- `POST /api/customers`, `PUT /api/customers/[id]` קוראים ל-`prepareStaffConsent` (ולידציה + תוכנית + רישום).
- מצהירים על בחירה מפורשת עם `consentExplicit: true`. רק אז `false` נרשם כ"לא" ולא כ"טרם נענה". טפסים ישנים (ברירת מחדל `marketingConsent:false`) לא ממציאים ראיה: נרשם רק **מעבר אמיתי** (`true`<->`false`) או `true` ביצירה.
- ביצירה, עם המתג פעיל ו-`consentExplicit`: חובה תשובה (כן/לא) לתקנון ולדיוורים (אלא אם `hide_marketing_consent_field`), וחובה אישור פרטיות (אלא אם `require_privacy_acceptance = false`). בעריכה אין חובה.
- `termsVersion` / `privacyVersion` (אופציונלי): הגרסה שהדפדפן הציג; אם אינה הגרסה שבתוקף -> **409** `CONSENT_DOC_CHANGED` (לא נרשמת הסכמה לטקסט שלא הוצג).
- כשל בכתיבה ליומן (הטבלה עוד לא נוצרה / קליינט Prisma ישן) **לא מכשיל שמירת לקוח**: נרשם בקונסול, והתשובה נושאת `consentWarning` (הטפסים מציגים אותו).
- `GET /api/customers/[id]` מוסיף `consents` (שורה אחרונה לכל סוג; בלי מזהי עובד) כשהמתג פעיל.

## חוזה לעמדת הלקוח (kiosk)
**צפייה ציבורית (ללא התחברות):** `GET /api/public-consent-info` (גרסאות, קישורים, נוסחים, מה חובה), `GET /api/public-terms` (הקובץ inline; `?download=1` להורדה), עמודים `/terms` ו-`/privacy`.

**רישום:** `POST /api/public-kiosk/register` (סוכן kiosk-backend) יוצר את הלקוחה ואז קורא (מחובר באינטגרציה 12.10.2026: `lib/publicKiosk/recordConsents.js` הוא עכשיו re-export של הפונקציה הזו, והטופס `KioskRegistration` משתמש ב-`useEnterNavigation` המשותף) ל:
```js
import { recordConsentsForCustomer } from '@/lib/customerConsentServer';   // אותה חתימה בדיוק כמו ה-stub
const r = await recordConsentsForCustomer({ customerId, channel: 'kiosk' /* או 'public' */, consents: { acceptedTerms, marketingConsent, acceptedPrivacy, termsVersion, privacyVersion }, now });
// r = { ok, recorded, reason?, errors? }  - לא זורק. ok:false+reason:'invalid' (errors בעברית, למשל גרסת תקנון ישנה) / 'no-customer' / 'error'; ok:true+reason:'table-missing' = הלקוחה נרשמה אך היומן עוד לא קיים
```
ולפני היצירה (אם רוצים לדחות בקשה בלי ליצור לקוחה) `processRegistrationConsents({ body, settings: map, docs })` מ-`lib/customerConsent.js` מחזיר `{errors, plan}` (חובה תשובה לתקנון ולדיוורים וגם אישור פרטיות כשהמערכת פעילה). שדות בגוף הבקשה: `acceptedTerms` (true/false), `marketingConsent` (true/false), `acceptedPrivacy` (true), `channel` ('kiosk'|'public'), `termsVersion`, `privacyVersion` (מ-`/api/public-consent-info`). בעמדה הכל מפורש והערוץ נרשם `kiosk`/`public`, method `customer_self`, surface `kiosk-register`, בלי עובד.

**רכיב UI:** `app/components/shared/ConsentFields.js` (+ `useConsentInfo`), עזרי גוף: `lib/consentForm.js` (`withConsentBody`, `missingConsentLabels`), ניווט: `useEnterNavigation`.

## מה נדרש כדי לעמוד בחוק (טיוטה - לבדיקת עו"ד)
| דרישה | איך מטופל | מה עדיין פתוח |
|---|---|---|
| חוק הגנת הפרטיות, סעיף 11 - הודעה בעת איסוף מידע (מטרה, חובה/רשות, מקבלים) | `/privacy` + אישור מפורש בטופס | בדיקת עו"ד של הנוסח; אישור פרטיות רק בלקוחות חדשים - לקוחות קיימים לא אישרו |
| זכויות עיון / תיקון (סעיפים 13-14), מחיקה | מתוארות במדיניות; אין מנגנון אוטומטי | נוהל פנימי למימוש בקשות; מחיקת לקוחה לא מוחקת את יומן ההסכמות (מוצדק כראיה, יש לציין בנוהל) |
| חוק התקשורת סעיף 30א - דיוור שיווקי בהסכמה מראש, מפורשת | הסכמה בנפרד, בלי ברירת מחדל, נוסח שמור, ערוץ ותאריך נרשמים | **אין עדיין קישור הסרה אוטומטי בהודעות** (מיילים שיווקיים) - חובה על פי החוק; רשימת התפוצה (`mailing_list_auto_sync`) צריכה לכבד `marketingConsent=false` |
| הוכחת הסכמה | יומן `CustomerConsent` | הרצת ה-DDL בשני ה-DB (ר' למטה); לקוחות קיימים עם `marketingConsent=true` בלי יומן = "אושר במערכת הישנה, ללא תיעוד" |
| תיקון 13 (אוגוסט 2025) - חובות מאגר (רישום, ממונה, אבטחה) | לא טופל בקוד | הערכת עו"ד: האם נדרש רישום מאגר / מינוי ממונה הגנת פרטיות |
| ילדים / מידע רגיש | לא נאסף ידע רגיש; ת"ז רשות | לוודא עם עו"ד שאיסוף ת"ז / פרטי בנק מכוסה |

## פריסה והפעלה (לא בוצע - דורש אישור)
1. **DDL:** `prisma/migrations-pending/2026-10-12-customer-consent.sql` (טבלה חדשה + 2 אינדקסים + מפתח זר; `IF NOT EXISTS`, תוספתי בלבד) או `node scripts/apply_customer_consent_table.js --org=1|2` (dry-run כברירת מחדל; `--apply --expect-host=<קידומת>`). **בשני ה-DB (org1 + org2)**, לפני / יחד עם הפריסה. אימות: `prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema.prisma --script` ריק. ללא `prisma db push`.
2. **הגדרות:** `node scripts/seed_customer_consent_settings.js --org=1|2` (dry-run כברירת מחדל; בודק host) יוצר את השורות `explicit_consent_enabled=false`, `require_privacy_acceptance=true`, `privacy_policy_text=''` בשני הארגונים. אחר כך מדליקים לכל ארגון בנפרד.
3. העלאת קובץ התקנון בהגדרות -> בדיקה של `/terms` ו-`/privacy` בכל אתר.

## בדיקות
`node scripts/customer-consent-tests/run.mjs` (לוגיקה, routes, מקלדת מול DOM מדומה). בדיקות הדפדפן (Enter, RTL, PDF) בוצעו ידנית - ר' הדוח.
