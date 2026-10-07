// בדיקות סטטיות (בלי DB/שרת/דפדפן) לדיווח נווה יעקב 67c0d652: המשך אוטומטי כשהתשלום מלא בהזמנה חדשה.
// הרצה (מהשורש): node scripts/test_new_order_auto_finish.mjs   - יוצא בקוד 1 אם משהו נכשל.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const KEY = 'new_order_auto_finish_when_paid';

t('ישן: הדגל נקבע רק בתשלום לא-אשראי שמשלים בדיוק את הסכום (באגורות), ורק כשהמתג === \'true\'', () => {
  const src = read('app/orders/new/LegacyNewOrderPage.js');
  assert.ok(src.includes("settings.new_order_auto_finish_when_paid === 'true' && totalAmount > 0 && Math.round(paidAfter * 100) === Math.round(totalAmount * 100)"));
  // בענף ה-else של isCreditMethod (חיוב אשראי כבר ממשיך בעצמו ב-handleProcessCreditCard)
  const i = src.indexOf('const handleAddPaymentClick');
  const j = src.indexOf('const executeSaveOrderForList');
  const body = src.slice(i, j);
  assert.ok(body.indexOf('} else {') < body.indexOf('setAutoFinishPending(true)'), 'בתוך ה-else (לא-אשראי)');
});
t('ישן: המעבר עובר דרך saveOrder הרגיל (לא דרך executeSaveOrderForList ישירות) ורק אחרי שהסכום לתשלום התאפס', () => {
  const src = read('app/orders/new/LegacyNewOrderPage.js');
  assert.ok(src.includes("if ((parseFloat(payment.amount) || 0) > 0) return;\n    setAutoFinishPending(false);\n    saveOrder();"));
  const eff = src.slice(src.indexOf('if (!autoFinishPending || saving) return;'), src.indexOf('}, [autoFinishPending, payment.amount, saving]);'));
  assert.ok(eff.includes('saveOrder();') && !eff.includes('executeSaveOrderForList'));
});
t('חדש (a5): אותו תנאי (אגורות, בדיוק), אותו מעבר דרך saveOrder', () => {
  const src = read('app/components/new-order/useNewOrderController.js');
  assert.ok(src.includes("settings.new_order_auto_finish_when_paid === 'true' && totalAmount > 0 && NL.toAgorot(NL.sumPaid(paymentsList) + decision.amount) === NL.toAgorot(totalAmount)"));
  assert.ok(src.includes("if ((parseFloat(payment.amount) || 0) > 0) return;\n    setAutoFinishPending(false);\n    saveOrder();"));
  assert.ok(/export const toAgorot/.test(read('app/components/new-order/newOrderLogic.js')));
});
t('המפתח רשום (שם + הערה + רשימת הזמנות + בוליאנים + פריסה + seed) ולא נקרא בשום קובץ אחר', () => {
  const M = read('lib/settingsMetadata.js');
  assert.equal((M.match(new RegExp(`\n  ${KEY}: '`, 'g')) || []).length, 2);
  assert.equal(M.split(`'${KEY}'`).length, 3);
  const SIM = read('lib/settingsSimLayout.js');
  assert.ok(SIM.includes(`'${KEY}'`) && SIM.includes(`  ${KEY}: { icon:`));
  assert.ok(read(`scripts/seed_${KEY}_setting.js`).includes('trueForOrg: 2'));
  const hits = [];
  const walk = (d) => { for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) { const rel = `${d}/${e.name}`; if (e.isDirectory()) { if (!/node_modules|\.next/.test(e.name)) walk(rel); } else if (/\.(js|jsx|mjs)$/.test(e.name) && !/^seed_|^test_|settings(Metadata|SimLayout)/.test(e.name)) { if (fs.readFileSync(path.join(ROOT, rel), 'utf8').includes(KEY)) hits.push(rel); } } };
  walk('app'); walk('components'); walk('lib');
  assert.deepEqual(hits.sort(), ['app/components/new-order/useNewOrderController.js', 'app/orders/new/LegacyNewOrderPage.js']);
});
console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
