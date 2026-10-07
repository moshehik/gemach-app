// order_card_save_in_footer (דיווח 7681043a, נווה יעקב, 2026-10-06): "שמור שינויים" בפס התחתון של כרטיס הזמנה, כמו "סיום ויצירת ההזמנה".
// org2 (נווה יעקב) = true; org1 (הראשי) נוצר עם false אם חסר = ההתנהגות הקיימת (ערך קיים של org1 לעולם לא משתנה).
// dry-run כברירת מחדל - כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה. לא מורץ אוטומטית ע"י הבנייה.
//   node scripts/seed_order_card_save_in_footer_setting.js --org=2          (dry-run)
//   node scripts/seed_order_card_save_in_footer_setting.js --org=2 --write
//   node scripts/seed_order_card_save_in_footer_setting.js --org=1 [--write]
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const ORDER_CARD_SAVE_IN_FOOTER = {
  key: 'order_card_save_in_footer',
  name: 'כרטיס הזמנה - כפתור "שמור שינויים" בפס התחתון',
  category: 'הזמנות',
  notes: 'כשמופעל, בכרטיס הזמנה קיימת כפתור "שמור שינויים" עובר מראש הדף לפס בתחתית הכרטיס - באותו מקום ובאותו צד שבהם יושב "סיום ויצירת ההזמנה" באשף הזמנה חדשה, כדי שלא יצטרכו לחפש את השלב הבא. כבוי (ברירת מחדל): הכפתור למעלה, כמו קודם.',
  trueForOrg: 2, // org2 = true, השני נוצר false אם חסר
};

seedBoolSetting(ORDER_CARD_SAVE_IN_FOOTER).catch((e) => { console.error(e); process.exitCode = 1; });
