// print_order_fit_one_page (דיווחים 6f173798 + 7d921d3b, נווה יעקב): הזמנה מודפסת תמיד בעמוד אחד (app/print/order/page.js,
// lib/printFitOnePage.js). org2 (נווה יעקב) = true; org1 (הראשי) נוצר עם false = ההדפסה הקיימת.
// dry-run כברירת מחדל; כתיבה רק עם --write ורק באישור הבעלים בזמן ההרצה. לא מורץ אוטומטית ע"י הבנייה.
//   node scripts/seed_print_order_fit_one_page_setting.js --org=2          (dry-run)
//   node scripts/seed_print_order_fit_one_page_setting.js --org=2 --write
// אותה בדיקת host כמו שאר סקריפטי ה-seed (scripts/lib/seed-bool-setting.js).
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

const PRINT_ORDER_FIT_ONE_PAGE = {
  key: 'print_order_fit_one_page',
  name: 'הדפסת הזמנה - תמיד עמוד אחד',
  category: 'הדפסה',
  notes: 'כשמופעל, הזמנה מודפסת תמיד נכנסת בעמוד אחד (שורות ההנחיות בראש הדף בלי מסגרות, ריווחים מצומצמים, ואם צריך - כתב קטן יותר לפי כמות התוכן). כבוי = ההדפסה כמו קודם.',
  trueForOrg: 2,
};

seedBoolSetting(PRINT_ORDER_FIT_ONE_PAGE).catch((e) => { console.error(e); process.exitCode = 1; });
