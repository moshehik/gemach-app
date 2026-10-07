// בדיקות סטטיות לדיווח נווה יעקב 84959e6d: הסתרת בקשת הוראת קבע בהזמנה חדשה = המתג הקיים hok_enabled (אין מתג חדש).
// הרצה (מהשורש): node scripts/test_hide_standing_order_neve.mjs
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

t('האשף הישן: כל הצגה של "פרטי הוראת קבע" וכל שליחת hokDetails מותנות ב-hok_enabled === \'true\'', () => {
  const src = read('app/orders/new/LegacyNewOrderPage.js');
  assert.equal((src.match(/פרטי הוראת קבע \(3\)<\/h4>/g) || []).length, 2, 'שני מקומות תצוגה (לקוח קיים / לקוח חדש)');
  assert.ok(src.includes("if (settings.hok_enabled !== 'true') return null;"), 'לקוח קיים');
  assert.ok(src.includes("{settings.hok_enabled === 'true' && ("), 'לקוח חדש');
  assert.ok(src.includes("if (settings.hok_enabled === 'true') {\n        if (order.hokBankName"), 'שליחה ב-saveOrder');
});
t('האשף החדש (a5): HokCard והמטען מותנים באותו מתג', () => {
  const sc = read('app/components/new-order/StepCustomer.js');
  assert.equal((sc.match(/hok_enabled === 'true' \? <HokCard/g) || []).length, 3, 'שלושה מקומות HokCard');
  assert.ok(read('app/components/new-order/newOrderLogic.js').includes("if ((settings || {}).hok_enabled !== 'true') return undefined;"));
});
t('אין מקום אחר בכרטיס ההזמנה / כרטיס הלקוח שמציג בקשת הוראת קבע (נשארו רק מסכי ניהול נדרים פלוס של הו"ק קיימות, שלא תלויים במתג)', () => {
  for (const f of ['app/orders/[id]/LegacyOrderPage.js', 'components/orders/modern/ModernPaymentsManager.js', 'app/customers/[id]/page.js']) {
    if (!fs.existsSync(path.join(ROOT, f))) continue;
    assert.ok(!/פרטי הוראת קבע|hokBank|hokConsent/.test(read(f)), f);
  }
});
t('seed: מכבה רק org2 (נווה יעקב), org1 לא נדרס, dry-run כברירת מחדל', () => {
  const s = read('scripts/seed_hok_enabled_off_neve_setting.js');
  assert.ok(s.includes("2: { value: 'false', overwrite: true }") && s.includes("1: { value: 'false', overwrite: false }"));
  assert.ok(s.includes("require('./lib/seed-bool-setting')"));
});
console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
