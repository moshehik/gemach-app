// הגדרות מייל שהקוד קורא אבל שורה שלהן לא קיימת ב-DB (לכן לא מופיעות במסכי ההגדרות, רק בקוד, כבויות כברירת מחדל):
//   daily_manager_report_enabled (דוח יומי למנהל), manual_barcode_daily_report (דוח ברקודים ידניים), order_quick_mail_enabled (מייל מהיר מכרטיס הזמנה).
// הסקריפט יוצר אותן עם 'false' אם חסרות - בדיוק ההתנהגות הנוכחית (חסר = כבוי) - כדי שיופיעו כמתגים בהגדרות מערכת וב-/admin/email-center.
// ערך קיים לעולם לא משתנה. dry-run כברירת מחדל; כתיבה רק עם --write ורק באישור הבעלים. לא מורץ אוטומטית.
// שימו לב: במרכז המיילים עצמו מתג שנלחץ יוצר את השורה בעצמו (אין חובה להריץ את הסקריפט הזה).
//   node scripts/seed_email_center_settings.js --org=1          (dry-run)
//   node scripts/seed_email_center_settings.js --org=2 --write
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const OFF = { 1: { value: 'false', overwrite: false }, 2: { value: 'false', overwrite: false } };
const DEFS = [
  { key: 'daily_manager_report_enabled', name: 'דוח יומי למנהל', category: 'אוטומציה', notes: 'שולח כל בוקר למנהל מייל עם הזמנות שנפתחו אתמול והזמנות עם אירוע היום (daily_manager_report_email / main_email). כבוי = לא נשלח.', targets: OFF },
  { key: 'manual_barcode_daily_report', name: 'דוח יומי - ברקודים שהוקלדו ידנית', category: 'ברקודים', notes: 'כשמופעל, בסוף כל יום נשלח למנהל מייל עם הפריטים שהברקוד שלהם הוקלד ידנית. כבוי = לא נשלח.', targets: OFF },
  { key: 'order_quick_mail_enabled', name: 'מייל מהיר מכרטיס ההזמנה', category: 'הזמנות', notes: 'כשמופעל, בכרטיס ההזמנה מופיע לחצן "מייל מהיר" לשליחת מייל חופשי עם צרופות. כבוי = הלחצן מוסתר והשרת דוחה.', targets: OFF },
];

(async () => {
  for (const def of DEFS) await seedBoolSetting(def);
})().catch((e) => { console.error(e); process.exitCode = 1; });
