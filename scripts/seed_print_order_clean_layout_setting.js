// print_order_clean_layout (דיווח 27f278c7, נווה יעקב): הדפסת הזמנה בודדת "נקייה" ללקוח (app/print/order/page.js).
// org2 (נווה יעקב) = true; org1 (הראשי) נוצר עם false = הפלט הקיים. dry-run כברירת מחדל.
//   node scripts/seed_print_order_clean_layout_setting.js --org=2 [--write]
// ההגדרה (שם/קטגוריה/הערות) ב-scripts/lib/neve-2026-10-05-setting-defs.js.
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');
const { PRINT_ORDER_CLEAN_LAYOUT } = require('./lib/neve-2026-10-05-setting-defs');

seedBoolSetting(PRINT_ORDER_CLEAN_LAYOUT).catch((e) => { console.error(e); process.exitCode = 1; });
