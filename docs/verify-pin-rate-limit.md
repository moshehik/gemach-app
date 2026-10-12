# הגבלת ניסיונות סיסמה בצד השרת – `POST /api/auth/verify-pin` (2026-10-11)

**הממצא** (ביקורת הרשאות עצמאית של כרטיס מחירון, `docs/a5-pricelist/review-permissions.md`): 40 סיסמאות שגויות ברצף החזירו 40×401, בלי 429 ובלי נעילה. ההגנה היחידה הייתה נעילה של 3 ניסיונות ל-30 שניות בדפדפן (ממשק בלבד). בלי `employeeId` הסיסמה נבדקת מול כל העובדים הפעילים, ו-`employeeId` לא עבר בדיקת טיפוס (אובייקט כמו `{"contains":""}` הגיע ישר ל-`where.id` של Prisma).

> הערה: ב-`origin/main` הנתיב כבר דורש התחברות (`checkAuth()`), כלומר המתקיף הוא עובד מחובר. ההגבלה נחוצה בכל זאת – עובד רגיל יכול לנחש סיסמת מנהל כדי לאשר פעולות.

## מה השתנה

| קובץ | תפקיד |
|---|---|
| `lib/authThrottleLogic.js` | הכללים, טהור (בלי DB/שעון): `decideAttempt`, `refundAttempt`, `reserveAttempt`, `beginAttempt`, `successOutcome`, `failureOutcome`, `validateVerifyPinBody`, `clientIpFromHeaders`, `retryMessageHe` |
| `lib/authThrottle.js` | חנות Postgres (raw SQL) + עטיפה "נכשל פתוח": `guardPinAttempt`, `recordPinSuccess` |
| `app/api/auth/verify-pin/route.js` | בדיקת טיפוסים → הגבלה → bcrypt; 429 + `Retry-After`; **צורת תשובת ההצלחה לא השתנתה** (`success`, `employeeId`, `employeeName`, `approvalLogged?`, `approvalToken?`) |
| `prisma/schema.prisma` + `prisma/migrations-pending/2026-10-11-auth-throttle.sql` | טבלה חדשה `AuthThrottle` (תוספת בלבד) |
| `scripts/test_auth_throttle.mjs` | בדיקות ללוגיקה (`node scripts/test_auth_throttle.mjs`) |

## הכללים

שני מפתחות לכל ניסיון:

* `pe:<employeeId או *>:<IP>` – **5 כשלונות** → נעילה. בלי `employeeId` (סריקת כל העובדים) המפתח הוא `*`.
* `ip:<IP>` – **20 כשלונות** (מכל העובדים) → נעילה.

נעילות מדורגות: **30 שנ' → 2 דק' → 10 דק' → 30 דק'** (נשאר 30 דק'). שעה בלי כשלון = השורה נשכחת (חוזרים לרמה 0).

* הניסיון **נספר לפני** בדיקת הסיסמה (שמירת מקום), כך שמטח בקשות מקבילות לא יכול לעבור את המגבלה. הניסיון החמישי עצמו עדיין נבדק; אם נכשל – מקבל 429 מיד, ושאר הבקשות עד סוף הנעילה נדחות בלי להגיע ל-bcrypt או לטבלת העובדים.
* סיסמה נכונה (גם אם אחריה 403 על רמת הרשאה): מוחקת את מונה `pe`; מונה ה-`ip` **לא מתאפס** אלא מחזיר רק את הניסיון הזה (אחרת מי שמחזיק חשבון תקין היה מאפס את המונה בין ניחושים).
* ניסיון שנדחה בגלל נעילת `pe` לא נספר ל-`ip` (לא נבדקה סיסמה), כדי שלחיצות חוזרות בחלונית נעולה לא יחסמו את כל הסניף.
* כתיבות הן compare-and-swap על עמודת `version`; מחלוקת שלא נפתרת אחרי 4 ניסיונות נדחית (לא עוברת).
* IP: `x-vercel-forwarded-for` → `x-real-ip` → ה-hop הראשון של `x-forwarded-for`; בלוקאל הכול נופל לדלי אחד (`::1`/`unknown`).
* תשובה: `429 {"success":false,"error":"יותר מדי ניסיונות שגויים. נסו שוב בעוד 30 שניות.","retryAfterSec":30}` + כותרת `Retry-After`. הקוראים שנבדקו (OcApproval ועוד) מציגים את `data.error` מתשובה שאינה success, ולכן הודעת הנעילה מוצגת כמות שהיא; לא נבדק אחד-אחד כל 20 הקוראים (ר' `grep -rn verify-pin app components`).
* בדיקת טיפוסים: `pin` מחרוזת עד 256 תווים; `employeeId` מחרוזת עד 64 (או חסר/ריק); `requiredLevel` מחרוזת עד 100; אחרת 400.
* ניקוי: ב-~2% מהקריאות נמחקות שורות שלא עודכנו 24 שעות.

## למה טבלה ולא `SystemSetting` / זיכרון

זיכרון מודול הוא לכל מופע Vercel. שורות `SystemSetting` היו נכנסות לרשימות ההגדרות ולמטמוני `getAllCachedSettings` (ותוקף היה מנפח אותן). לכן טבלה נפרדת, נגישה ב-raw SQL בלבד (תוסף היומן לא רושם כל הגדלת מונה ל-`AuditLog`).

## פריסה (חובה לפני/עם הקוד)

1. להריץ `prisma/migrations-pending/2026-10-11-auth-throttle.sql` ידנית **על שני ה-DB של הייצור** (ראשי + נווה יעקב) – עם בדיקת host, כמו שאר ה-DDL (`CLAUDE.md`, "Schema changes"). לא `prisma db push`.
2. **נכשל פתוח**: כל עוד הטבלה חסרה (או כשה-DB נכשל), `verify-pin` ממשיך לעבוד בלי הגבלה ורושם שורת `[authThrottle] … NOT limiting` ליומן (פעם בדקה) – בלי 500. ז"א שהגנה פעילה רק אחרי הרצת ה-SQL; כדאי לחפש את השורה הזו ביומני Vercel אחרי הפריסה.
3. `app/api/dev/db-import` בונה את רשימת הטבלאות הנדרשות מ-`Prisma.dmmf` – ייבוא למסד חדש ידרוש גם את הטבלה הזו (הוסיפו את ה-SQL לאותו מסד).

## מה לא מכוסה

* נתיבים אחרים שמאמתים סיסמה בעצמם ללא הגבלה: `app/api/customers/[id]/events` (אישור מנהל), `app/api/history`, `employees/[id]/{password,reset-password,set-password}`, `rentals/scan`. הלוגיקה ב-`lib/authThrottleLogic.js` כללית – אפשר לחבר אותם באותה דרך (`guardPinAttempt` / `recordPinSuccess`, עם מפתחות מדיניות משלהם).
* אין מונה לכל עובד בנפרד מכל IP (התקפה מבוזרת מ-IP-ים רבים נגד עובד אחד). בכוונה: זה היה מאפשר לכל אחד לנעול מנהל מחוץ לעבודה.
* `/api/login` (כניסה) – לא נבדק/שונה כאן.

## בדיקות

* `node scripts/test_auth_throttle.mjs` – 16 בדיקות: הסלמה, דעיכה, החזר, מטח מקביל (≤5 עוברים), איפוס בהצלחה, חוסר איפוס של ה-IP, סריקה בלי `employeeId`, תקינות גוף הבקשה, סדר הפעולות בנתיב (בדיקת מקור).
* אומת חי מול TEST (שרת dev מה-worktree, `.active-db=test`): גוף לא תקין → 400; 4 שגויות → 401, החמישית ואילך → 429 עם `Retry-After` יורד; אחרי תפוגה: 2 שגויות + נכונה → 200 בצורה הישנה ושורת ה-`pe` נמחקה; ניסיון שנדחה לא הגדיל את מונה ה-IP.
