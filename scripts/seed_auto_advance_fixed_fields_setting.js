// auto_advance_fixed_fields (דיווח c89234ec, נווה יעקב - רבקה לוי): מעבר אוטומטי לשדה הבא כששדה באורך קבוע מלא (כרטיס אשראי 16 ספרות, תוקף, נייד)
// ואחרי בחירת עיר / רחוב מהרשימה. שינוי התנהגות בטפסים - ממתין לאישור סקיצה מהבעלים, ולכן נוצר כבוי בשני הגמחים (גם בנווה יעקב).
// להדלקה בנווה יעקב אחרי האישור: להפעיל בהגדרות (הזמנות > "הזמנה חדשה - מעבר אוטומטי לשדה הבא"), או להריץ את הסקריפט עם --on.
// dry-run כברירת מחדל; כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה. לא מורץ אוטומטית ע"י הבנייה.
//   node scripts/seed_auto_advance_fixed_fields_setting.js --org=2          (dry-run, יוצר כבוי)
//   node scripts/seed_auto_advance_fixed_fields_setting.js --org=2 --on --write   (אחרי אישור: מדליק בנווה יעקב)
// אותה בדיקת host כמו שאר סקריפטי ה-seed (scripts/lib/seed-bool-setting.js).
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const ON = process.argv.includes('--on');
process.argv = process.argv.filter((a) => a !== '--on');

const AUTO_ADVANCE_FIXED_FIELDS = {
  key: 'auto_advance_fixed_fields',
  name: 'הזמנה חדשה - מעבר אוטומטי לשדה הבא',
  category: 'הזמנות',
  notes: 'כשמופעל, בהזמנה חדשה (כרטיס לקוח חדש וחלון חיוב האשראי): אחרי שמספר כרטיס האשראי (16 ספרות), התוקף או מספר נייד (10 ספרות, מתחיל ב-05) הושלמו, או אחרי בחירת עיר / רחוב מהרשימה - הסמן עובר אוטומטית לשדה הבא. כבוי (ברירת מחדל): אין מעבר אוטומטי, כמו קודם.',
  // ברירת מחדל: כבוי בשני הגמחים. עם --on: נווה יעקב (org2) = true, הראשי נשאר כבוי
  targets: ON
    ? { 1: { value: 'false', overwrite: false }, 2: { value: 'true', overwrite: true } }
    : { 1: { value: 'false', overwrite: false }, 2: { value: 'false', overwrite: false } },
};

seedBoolSetting(AUTO_ADVANCE_FIXED_FIELDS).catch((e) => { console.error(e); process.exitCode = 1; });
