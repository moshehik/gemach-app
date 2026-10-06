// auto_alteration_done_on_take (בעלים 2026-10-06, "ברגע שפריט נלקח - התיקון נרשם כבוצע (משוער)"): ברירת מחדל כבוי בשני הגמחים.
// הגמח הראשי (org 1) לא משתנה; הפעלה בגמח מסוים - רק בהחלטת הבעלים, ידנית בהגדרות המערכת (הזמנות -> "בלקיחת פריט - לרשום את התיקון כבוצע (משוער)").
// הסקריפט רק יוצר את השורה עם 'false' אם חסרה (שורה קיימת לא משתנה). dry-run כברירת מחדל; כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה.
//   node scripts/seed_auto_alteration_done_on_take_setting.js --org=2          (dry-run)
//   node scripts/seed_auto_alteration_done_on_take_setting.js --org=2 --write
// אותה בדיקת host כמו שאר סקריפטי ה-seed (scripts/lib/seed-bool-setting.js). לא מורץ אוטומטית ע"י הבנייה.
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const AUTO_ALTERATION_DONE_ON_TAKE = {
  key: 'auto_alteration_done_on_take',
  name: 'בלקיחת פריט - לרשום את התיקון כ"בוצע (משוער)"',
  category: 'הזמנות',
  notes: 'כשמופעל, בלקיחת פריט תיקון שלא סומן נרשם אוטומטית כ"בוצע (משוער)". כבוי / חסר = לא נרשם כלום בלקיחה.',
  targets: { 1: { value: 'false', overwrite: false }, 2: { value: 'false', overwrite: false } },
};

seedBoolSetting(AUTO_ALTERATION_DONE_ON_TAKE).catch((e) => { console.error(e); process.exitCode = 1; });
