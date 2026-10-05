// customer_bank_fields_enabled (החלטת הבעלים 5.10.2026): שדות הבנק של הלקוח (שם בנק / סניף / מספר חשבון / שם בעל החשבון) מופיעים בכרטיס
// הלקוח החדש ובטופס "לקוח חדש" רק לפי הגדרה. ברירת מחדל = כבוי בשני הגמחים.
// ההגדרה עובדת גם בלי שורה ב-DB (חסר = כבוי), אבל מסך ההגדרות מציג רק שורות שקיימות - כדי שאפשר יהיה להדליק אותה משם צריך שורה.
// הסקריפט יוצר שורה עם 'false' אם חסרה, ולעולם לא דורס ערך קיים (overwrite=false).
// dry-run כברירת מחדל; כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה. לא מורץ אוטומטית ע"י הבנייה.
//   node scripts/seed_customer_bank_fields_enabled_setting.js --org=1          (dry-run)
//   node scripts/seed_customer_bank_fields_enabled_setting.js --org=2 --write
// אותה בדיקת host כמו שאר סקריפטי ה-seed (scripts/lib/seed-bool-setting.js).
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const CUSTOMER_BANK_FIELDS_ENABLED = {
  key: 'customer_bank_fields_enabled',
  name: 'הצג שדות בנק בכרטיס לקוח ובלקוח חדש',
  category: 'הזמנות',
  notes: 'כשמופעל, כרטיס הלקוח החדש וטופס "לקוח חדש" מציגים ושומרים פרטי חשבון בנק לזיכויים (ואפשר לסמן אותם כשדות חובה). כבוי = מוסתרים, לא נשמרים מהכרטיס ולא נחשבים כחובה.',
  targets: { 1: { value: 'false', overwrite: false }, 2: { value: 'false', overwrite: false } },
};

seedBoolSetting(CUSTOMER_BANK_FIELDS_ENABLED).catch((e) => { console.error(e); process.exitCode = 1; });
