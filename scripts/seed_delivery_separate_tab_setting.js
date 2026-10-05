// delivery_separate_tab (הערת הבעלים 2026-10-05, נווה יעקב): בכרטיס ההזמנה החדש (A5) לשונית "משלוח" נפרדת מופיעה רק כש-enable_deliveries
// וגם delivery_separate_tab הם 'true' (app/components/order-card/OcTabs.js). השורה לא נוצרה אף פעם ב-DB (הענף של נווה לא מוזג), ולכן
// גם לא הייתה מתג במסך ההגדרות - והמשלוח נשאר בתוך "פרטים".
// org2 (נווה יעקב) = true; org1 (הראשי) נוצר עם false = ההתנהגות הקיימת. dry-run כברירת מחדל; כתיבה רק עם --write ורק באישור הבעלים.
//   node scripts/seed_delivery_separate_tab_setting.js --org=2          (dry-run)
//   node scripts/seed_delivery_separate_tab_setting.js --org=2 --write
// אותה בדיקת host כמו שאר סקריפטי ה-seed (scripts/lib/seed-bool-setting.js). לא מורץ אוטומטית ע"י הבנייה.
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const DELIVERY_SEPARATE_TAB = {
  key: 'delivery_separate_tab',
  name: 'לשונית משלוח נפרדת בכרטיס הזמנה',
  category: 'משלוחים',
  notes: 'כשמופעל (ורק יחד עם "הצג משלוחים"), בכרטיס ההזמנה החדש המשלוח מוצג בלשונית נפרדת "משלוח" ליד "פרטים" ו"פריטים". כבוי = כרטיס המשלוח בתוך לשונית "פרטים" (כמו קודם).',
  trueForOrg: 2,
};

seedBoolSetting(DELIVERY_SEPARATE_TAB).catch((e) => { console.error(e); process.exitCode = 1; });
