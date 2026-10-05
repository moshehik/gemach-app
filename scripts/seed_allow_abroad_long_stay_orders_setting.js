// allow_abroad_long_stay_orders (נווה יעקב, סבב 2026-10-05).
// org1 (הראשי) = 'true' (נוצר אם חסר; ערך קיים של org1 לעולם לא נדרס - רק מדווח אם הוא שונה).
// org2 (נווה יעקב) = 'false' (נקבע, ומתעדכן אם קיים ערך אחר). dry-run כברירת מחדל.
//   node scripts/seed_allow_abroad_long_stay_orders_setting.js --org=2          (dry-run)
//   node scripts/seed_allow_abroad_long_stay_orders_setting.js --org=2 --write
//   node scripts/seed_allow_abroad_long_stay_orders_setting.js --org=1          (dry-run)
//   node scripts/seed_allow_abroad_long_stay_orders_setting.js --org=1 --write
// ההגדרה (שם/קטגוריה/הערות) ב-scripts/lib/neve-2026-10-05-setting-defs.js.
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');
const { ALLOW_ABROAD_LONG_STAY_ORDERS } = require('./lib/neve-2026-10-05-setting-defs');

seedBoolSetting(ALLOW_ABROAD_LONG_STAY_ORDERS).catch((e) => { console.error(e); process.exitCode = 1; });
