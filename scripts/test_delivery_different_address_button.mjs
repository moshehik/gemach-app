// בדיקות סטטיות (בלי DB/שרת/דפדפן) לדיווח נווה יעקב 87c7a432: "כתובת שונה למשלוח" במקום בחירת עיר בהזמנה חדשה.
// הרצה (מהשורש): node scripts/test_delivery_different_address_button.mjs   - יוצא בקוד 1 אם משהו נכשל.
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
const KEY = 'delivery_different_address_button';

t('ישן: הכפתור פעיל רק כששני המתגים דולקים (=== \'true\') ועיר הלקוחה ברשימת ערי המשלוח; אחרת שדה העיר כמו קודם', () => {
  const src = read('app/orders/new/LegacyNewOrderPage.js');
  assert.ok(src.includes("settings.delivery_different_address_button === 'true'\n    && settings.delivery_charge_customer_city_fallback === 'true'\n    && !!customerCityForDelivery && deliveryPriceCities.includes(customerCityForDelivery);"));
  assert.ok(src.includes('{deliveryUseSavedAddress ? ('));
  assert.ok(src.includes('כתובת שונה למשלוח\n              </button>'));
  // שדה העיר המקורי (ה-select) נשאר בענף ה-else, ללא שינוי
  assert.ok(src.includes('<label htmlFor="delivery-city">עיר משלוח (לחישוב מחיר)'));
});
t('ישן: כשהכפתור נלחץ נפתחים עיר + כתובת (גם בלי delivery_allow_address_override), ויש "חזרה לכתובת הלקוחה" שמנקה עיר וכתובת', () => {
  const src = read('app/orders/new/LegacyNewOrderPage.js');
  assert.ok(src.includes("(settings.delivery_allow_address_override === 'true' || deliveryAddressRequired || deliveryDifferentOpen) && ("));
  assert.ok(src.includes("setOrder(prev => ({ ...prev, deliveryCity: '', deliveryAddress: '' }))"));
  assert.ok(src.includes('const deliveryDifferentOpen = deliveryAddressButtonOn && (deliveryOtherOpen || !!order.deliveryCity || !!order.deliveryAddress);'));
});
t('ישן: עיר לא ידועה (לא ברשימה) - הבדיקה הקיימת isDeliveryCityRequired לא נגעה (עדיין חובה לבחור עיר)', () => {
  const v = read('lib/deliveryValidation.js');
  assert.ok(v.includes('return !!(order?.isDelivery && !customerCityKnown);'));
  const src = read('app/orders/new/LegacyNewOrderPage.js');
  assert.ok(src.includes('const deliveryCityRequired = isDeliveryCityRequired(order, order.selectedCustomer?.city, deliveryPriceCities);'));
});
t('חדש (a5): אותו תנאי בדיוק, באותם מתגים; השדות המקוריים נשארים בענף ה-else', () => {
  const src = read('app/components/new-order/StepDelivery.js');
  assert.ok(src.includes("s.delivery_different_address_button === 'true' && s.delivery_charge_customer_city_fallback === 'true'"));
  assert.ok(src.includes('ctl.deliveryRateCities.includes(custCity)'));
  assert.ok(src.includes('id="noDelCity"'));
  assert.ok(src.indexOf("const [otherOpen, setOtherOpen] = useState(false);") < src.indexOf('if (!showMode && !showDelivery)'), 'ה-hook לפני ה-return המוקדם');
});
t('המפתח רשום: שם + הערה + קטגוריית משלוחים + בוליאנים + פריסה + seed (dry-run, host check); מחוץ לשני האשפים לא נקרא', () => {
  const M = read('lib/settingsMetadata.js');
  assert.equal((M.match(new RegExp(`\n  ${KEY}: '`, 'g')) || []).length, 2, 'שם + הערה');
  assert.equal(M.split(`'${KEY}'`).length, 3, 'קטגוריה + בוליאנים');
  assert.ok(M.includes(`'delivery_show_in_order', 'delivery_allow_address_override', '${KEY}',\n`));
  const SIM = read('lib/settingsSimLayout.js');
  assert.ok(SIM.includes(`'${KEY}'`) && SIM.includes(`  ${KEY}: { icon: 'pin' },`));
  const seed = read(`scripts/seed_${KEY}_setting.js`);
  assert.ok(seed.includes("require('./lib/seed-bool-setting')") && seed.includes('trueForOrg: 2'));
  const hits = [];
  const walk = (d) => { for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) { const rel = `${d}/${e.name}`; if (e.isDirectory()) { if (!/node_modules|\.next/.test(e.name)) walk(rel); } else if (/\.(js|jsx|mjs)$/.test(e.name) && !/^seed_|^test_|settings(Metadata|SimLayout)/.test(e.name)) { if (fs.readFileSync(path.join(ROOT, rel), 'utf8').includes(KEY)) hits.push(rel); } } };
  walk('app'); walk('components'); walk('lib');
  assert.deepEqual(hits.sort(), ['app/components/new-order/StepDelivery.js', 'app/orders/new/LegacyNewOrderPage.js']);
});
console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
