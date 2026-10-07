// בדיקות סטטיות (בלי DB/שרת/דפדפן) לדיווחי נווה יעקב f0c19c53 + c9d3be3f: לוח התאריך בהזמנה חדשה - 3 חודשים / בלי הדגשת התאריך הקודם.
// הרצה (מהשורש): node scripts/test_date_picker_new_order.mjs   - יוצא בקוד 1 אם משהו נכשל.
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
const KEYS = ['new_order_calendar_three_months', 'new_order_date_hide_selected_highlight'];

t('HebrewDatePicker: שני ה-props מוגדרים עם ברירת מחדל false (שאר המסכים לא משתנים)', () => {
  const src = read('components/HebrewDatePicker.js');
  assert.match(src, /threeMonths = false,\n\s+hideSelectedHighlight = false\n\}\) \{/);
});
t('HebrewDatePicker: ההדגשה הישנה (d === hDay) נשארת רק כשלא מסתירים אותה; במצב 3 חודשים ההשוואה לפי יום מלא (abs), לא לפי יום-בחודש', () => {
  const src = read('components/HebrewDatePicker.js');
  assert.ok(src.includes('const isSelected = !hideSelectedHighlight && d === hDay;'));
  assert.ok(src.includes('const isSelected = !hideSelectedHighlight && selectedAbs !== null && abs === selectedAbs;'));
});
t('HebrewDatePicker: במצב "בלחיצה בלבד" אין בורר יום ואין כפתור "אישור" (אי אפשר להחיל יום בלתי נראה)', () => {
  const src = read('components/HebrewDatePicker.js');
  assert.ok(src.includes('const clickOnly = threeMonths || hideSelectedHighlight;'));
  assert.ok(src.includes('{!clickOnly && (\n            <div className="field" style={{ margin: 0 }}>\n              <label>יום</label>'));
  assert.ok(src.includes('{!clickOnly && (\n              <button\n                data-agy-id="hebrew_date_picker_apply_btn"'));
});
t('הזמנה חדשה (ישן): הלוח מקבל את שני המתגים מ-settings, רק === \'true\' (חסר = כבוי = ההתנהגות הקודמת)', () => {
  const src = read('app/orders/new/LegacyNewOrderPage.js');
  assert.ok(src.includes("threeMonths={settings.new_order_calendar_three_months === 'true'}"));
  assert.ok(src.includes("hideSelectedHighlight={settings.new_order_date_hide_selected_highlight === 'true'}"));
  assert.equal((src.match(/<HebrewDatePicker/g) || []).length, 1, 'רק שדה תאריך האירוע');
});
t('שני המפתחות רשומים: שם + הערה + רשימת הזמנות + בוליאנים + פריסת ההגדרות + סקריפט seed (dry-run, host check)', () => {
  const M = read('lib/settingsMetadata.js');
  const SIM = read('lib/settingsSimLayout.js');
  for (const key of KEYS) {
    assert.equal((M.match(new RegExp(`\n  ${key}: '`, 'g')) || []).length, 2, `${key}: שם + הערה`);
    assert.equal(M.split(`'${key}'`).length, 3, `${key}: רשימת קטגוריה + רשימת בוליאנים`);
    assert.ok(SIM.includes(`'${key}'`) && SIM.includes(`  ${key}: { icon:`), `${key}: פריסה`);
    const seed = read(`scripts/seed_${key}_setting.js`);
    assert.ok(seed.includes("require('./lib/seed-bool-setting')") && seed.includes('trueForOrg: 2'), `${key}: seed`);
  }
});
t('המתגים לא נקראים בשום מקום אחר (לא משפיעים על a5 / דפים אחרים)', () => {
  const hits = [];
  const walk = (d) => { for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) { const rel = `${d}/${e.name}`; if (e.isDirectory()) { if (!/node_modules|\.next/.test(e.name)) walk(rel); } else if (/\.(js|jsx|mjs)$/.test(e.name) && !/^seed_|^test_|settings(Metadata|SimLayout)/.test(e.name)) { const s = fs.readFileSync(path.join(ROOT, rel), 'utf8'); if (KEYS.some(k => s.includes(k))) hits.push(rel); } } };
  walk('app'); walk('components'); walk('lib');
  assert.deepEqual(hits, ['app/orders/new/LegacyNewOrderPage.js']);
});
console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
