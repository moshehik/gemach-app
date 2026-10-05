// hide_order_payment_note (דיווח 51f2cc56, נווה יעקב): מסתיר את "הערה לתשלום" במסך התשלום של הזמנה חדשה.
// org2 (נווה יעקב) = true; org1 (הראשי) נוצר עם false = התנהגות קיימת. dry-run כברירת מחדל.
//   node scripts/seed_hide_order_payment_note_setting.js --org=2 [--write]
'use strict';

const { seedBoolSetting } = require('./lib/seed-bool-setting');

seedBoolSetting({
  key: 'hide_order_payment_note',
  name: 'הסתר "הערה לתשלום" בהזמנה חדשה',
  category: 'הזמנות',
  notes: 'כשמופעל, שדה "הערה לתשלום" לא מוצג במסך התשלום של הזמנה חדשה. כבוי = מוצג כרגיל.',
  trueForOrg: 2,
}).catch((e) => { console.error(e); process.exitCode = 1; });
