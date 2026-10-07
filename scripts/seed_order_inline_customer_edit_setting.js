// order_inline_customer_edit (דיווח f96f3952, נווה יעקב): בהזמנה חדשה, "עריכת פרטי לקוח" של לקוח קיים עם פרטים חסרים נפתח באותו מסך (רק השדות שחסרים),
// ואחרי השמירה הלקוח נבחר אוטומטית - במקום קישור שנפתח בכרטיסייה נפרדת. org2 (נווה יעקב) = true (רק אחרי אישור הבעלים);
// org1 (הראשי) נוצר עם false = ההתנהגות הקיימת. dry-run כברירת מחדל; כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה.
//   node scripts/seed_order_inline_customer_edit_setting.js --org=2          (dry-run)
//   node scripts/seed_order_inline_customer_edit_setting.js --org=2 --write
// אותה בדיקת host כמו שאר סקריפטי ה-seed (scripts/lib/seed-bool-setting.js).
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const ORDER_INLINE_CUSTOMER_EDIT = {
  key: 'order_inline_customer_edit',
  name: 'השלמת פרטי לקוח חסרים בתוך מסך ההזמנה החדשה (בלי חלון חדש)',
  category: 'הזמנות',
  notes: 'כשמופעל, בהזמנה חדשה כשבוחרים לקוח קיים שחסרים לו פרטי חובה, הלחצן "עריכת פרטי לקוח" פותח חלון באותו מסך (במקום כרטיסייה חדשה) ומבקש למלא רק את הפרטים שבאמת חסרים לאותו לקוח. אחרי השמירה הלקוח מתעדכן וייבחר אוטומטית להמשך ההזמנה. כבוי = הקישור הקיים שנפתח בכרטיסייה נפרדת, כמו קודם.',
  trueForOrg: 2,
};

seedBoolSetting(ORDER_INLINE_CUSTOMER_EDIT).catch((e) => { console.error(e); process.exitCode = 1; });
