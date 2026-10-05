// hide_order_payment_note (דיווח 51f2cc56, נווה יעקב): מסתיר את "הערה לתשלום" במסך התשלום של הזמנה חדשה.
// org2 (נווה יעקב) = true; org1 (הראשי) נוצר עם false = התנהגות קיימת. dry-run כברירת מחדל.
//   node scripts/seed_hide_order_payment_note_setting.js --org=2 [--write]
// ההגדרה (שם/קטגוריה/הערות) ב-scripts/lib/neve-2026-10-05-setting-defs.js.
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');
const { HIDE_ORDER_PAYMENT_NOTE } = require('./lib/neve-2026-10-05-setting-defs');

seedBoolSetting(HIDE_ORDER_PAYMENT_NOTE).catch((e) => { console.error(e); process.exitCode = 1; });
