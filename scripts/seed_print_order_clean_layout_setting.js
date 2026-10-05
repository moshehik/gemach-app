// print_order_clean_layout (דיווח 27f278c7, נווה יעקב): הדפסת הזמנה בודדת "נקייה" ללקוח (app/print/order/page.js).
// org2 (נווה יעקב) = true; org1 (הראשי) נוצר עם false = הפלט הקיים. dry-run כברירת מחדל.
//   node scripts/seed_print_order_clean_layout_setting.js --org=2 [--write]
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

seedBoolSetting({
  key: 'print_order_clean_layout',
  name: 'הדפסת הזמנה - פריסה נקייה ללקוח',
  category: 'הדפסה',
  notes: 'כשמופעל, הדפסת הזמנה בודדת נקייה יותר (בלי "לכבוד:"/"טלפון:"/כתובת לקוח, הערות פעם אחת, בלי טבלת תשלומים). כבוי = הפלט כמו קודם.',
  trueForOrg: 2,
}).catch((e) => { console.error(e); process.exitCode = 1; });
