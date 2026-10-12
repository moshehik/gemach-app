-- טבלת מונים להגבלת ניסיונות סיסמה בצד השרת - AuthThrottle (POST /api/auth/verify-pin).
--
-- מה: שורה אחת לכל מפתח הגבלה ("ip:<כתובת>" או "pe:<מזהה עובד או *>:<כתובת>") עם מונה כשלונות, רמת נעילה,
--      זמן סיום נעילה (אפוקה במילישניות) וגרסה להחלפה אופטימית. המודל המתאים נמצא ב-prisma/schema.prisma
--      (model AuthThrottle); הקוד: lib/authThrottleLogic.js (לוגיקה טהורה), lib/authThrottle.js (גישה ל-DB, raw SQL).
-- למה: ממצא הביקורת docs/a5-pricelist/review-permissions.md - 40 סיסמאות שגויות ברצף החזירו 40x 401 בלי נעילה.
--      מונה בזיכרון המודול לא עובד ב-Vercel (כל מופע שרת בנפרד), ולכן טבלה.
-- איך: תוספת בלבד, CREATE ... IF NOT EXISTS, בלי לגעת בטבלה קיימת; בטוח להריץ פעמיים. להריץ ידנית על שני ה-DB של
--      הייצור (ראשי + נווה יעקב) ועל TEST, עם בדיקת host, לפני פריסת הקוד. עד שהטבלה קיימת הקוד "נכשל פתוח":
--      verify-pin ממשיך לעבוד בלי הגבלה ורושם שגיאה ליומן (בלי 500).
--      אין להריץ `prisma db push` במקום הקובץ הזה (docs/branches-and-worktrees.md).
--
-- ביטול (לא להריץ - לתיעוד בלבד):
--   -- DROP TABLE IF EXISTS "AuthThrottle";

CREATE TABLE IF NOT EXISTS "AuthThrottle" (
    "key"           TEXT NOT NULL,
    "count"         INTEGER NOT NULL DEFAULT 0,
    "level"         INTEGER NOT NULL DEFAULT 0,
    "lockedUntilMs" BIGINT,
    "updatedAtMs"   BIGINT NOT NULL,
    "version"       INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AuthThrottle_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "AuthThrottle_updatedAtMs_idx" ON "AuthThrottle"("updatedAtMs");
