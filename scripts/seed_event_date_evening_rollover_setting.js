// event_date_evening_rollover (מייל הגמח הראשי 5.10.2026, סעיפים 1 ו-3): בגמח הראשי כמעט כל ההזמנות שהגיעו מהייבוא שמורות כ"ערב היום
// הקודם" (eventDate = 18:00 UTC), והתאריך העברי השמור הוא של היום שאחריו - ולכן טווח "כה תשרי" הדפיס גם "כו תשרי" והחיפוש של "כו תשרי" לא מצא אותן.
// org1 (הראשי) = true (סינון/הדפסה לפי היום העברי שנכתב בהזמנה); org2 (נווה יעקב) נוצר עם false = ההתנהגות הקיימת.
// dry-run כברירת מחדל; כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה. לא מורץ אוטומטית ע"י הבנייה.
//   node scripts/seed_event_date_evening_rollover_setting.js --org=1          (dry-run)
//   node scripts/seed_event_date_evening_rollover_setting.js --org=1 --write
//   node scripts/seed_event_date_evening_rollover_setting.js --org=2 --write   (יוצר false)
// אותה בדיקת host כמו שאר סקריפטי ה-seed (scripts/lib/seed-bool-setting.js).
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const EVENT_DATE_EVENING_ROLLOVER = {
  key: 'event_date_evening_rollover',
  name: 'יום האירוע לפי התאריך העברי בסינון ובהדפסה',
  category: 'הזמנות',
  notes: 'כשמופעל, סינון הזמנות לפי תאריך אירוע (החיפוש המתקדם, אשף ההדפסה ודוח התיקונים) מתייחס ליום העברי שנכתב בהזמנה. הזמנות שהגיעו מהייבוא מאקסס שמורות כ"ערב היום הקודם", ולכן בלי המתג טווח "כה תשרי" הציג גם הזמנות של "כו תשרי" והחיפוש של "כו תשרי" לא מצא אותן. כבוי = היום הקלנדרי בישראל, כמו קודם.',
  trueForOrg: 1,
};

seedBoolSetting(EVENT_DATE_EVENING_ROLLOVER).catch((e) => { console.error(e); process.exitCode = 1; });
