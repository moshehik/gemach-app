-- StationEvent - אירועי עמדת הלקוח הציבורית (/station) למדדי ההמרה של מסך "המרות בעמדה" (/station-analytics).
-- לא הורץ בפרודקשן. להריץ ידנית על כל DB של ארגון (אחרי אישור הרכז), ולא prisma db push (סחף סכמה ידוע).
-- אידמפוטנטי (IF NOT EXISTS). שום מפתח זר ל-Customer בכוונה (אירוע לא נמחק עם לקוחה ולא חוסם מחיקה).
--
-- type:      'visit' | 'availability' | 'form_start' (אנונימיים, מהדפדפן) | 'register' (נכתב בשרת בלבד בתוך POST /api/public-kiosk/register)
-- channel:   'public' (קישור כללי) | 'kiosk' (עמדת חנות)
-- dayKey:    היום הקלנדרי בישראל (YYYY-MM-DD) ברגע האירוע - מחושב בשרת; לשימוש בקיבוץ / טווחי תאריכים בלי המרת אזורי זמן
-- sidHash:   HMAC קטום של (יום + מזהה סשן אקראי מ-sessionStorage של הדפדפן). לא ניתן לשחזור ולא מקשר בין ימים. NULL באירוע register
-- customerId / outcome: רק באירוע register (מזהה הלקוחה הפנימי; outcome = created | existing-marked | existing-already-marked)
--
-- ייחודיות: (dayKey, type, channel, sidHash) - סשן נספר פעם אחת ליום לכל סוג אירוע. NULL שונים זה מזה ב-PostgreSQL,
-- ולכן שורות register (sidHash NULL) לא מושפעות.

CREATE TABLE IF NOT EXISTS "StationEvent" (
  "id"         TEXT         NOT NULL,
  "type"       TEXT         NOT NULL,
  "channel"    TEXT         NOT NULL,
  "dayKey"     TEXT         NOT NULL,
  "at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sidHash"    TEXT,
  "customerId" TEXT,
  "outcome"    TEXT,
  CONSTRAINT "StationEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StationEvent_dayKey_type_channel_sidHash_key" ON "StationEvent" ("dayKey", "type", "channel", "sidHash");
CREATE INDEX IF NOT EXISTS "StationEvent_dayKey_type_idx" ON "StationEvent" ("dayKey", "type");
CREATE INDEX IF NOT EXISTS "StationEvent_customerId_idx" ON "StationEvent" ("customerId");

-- ניקוי תקופתי (אופציונלי, ידני): DELETE FROM "StationEvent" WHERE "at" < now() - interval '400 days';
-- ביטול הפיצ'ר: DROP TABLE "StationEvent";  (הקוד מתמודד עם טבלה חסרה: האיסוף מדלג והמסך מציג הסבר)
