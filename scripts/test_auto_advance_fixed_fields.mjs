// בדיקות ל-lib/autoAdvance.js (טהור, node רגיל) + בדיקות חיווט סטטיות לדיווח c89234ec. הרצה (מהשורש): node scripts/test_auto_advance_fixed_fields.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  digitsOf, isCardNumberComplete, isExpiryComplete, isMobilePhoneComplete, justCompleted, isDatalistPick,
} from '../lib/autoAdvance.js';

// בדפדפן InputEvent קיים; ב-node לא - מדמים אותו (אירוע הקלדה אמיתי = מופע של InputEvent עם inputType)
globalThis.InputEvent = class InputEvent { constructor(type, init = {}) { this.type = type; this.inputType = init.inputType; } };
const ev = (inputType) => new InputEvent('input', { inputType });

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const KEY = 'auto_advance_fixed_fields';

t('כרטיס אשראי: רק 16 ספרות (גם עם רווחים); 15 / 17 לא; ה"קפיצה" רק ברגע ההשלמה, לא בעריכה בתוך ערך שלם', () => {
  assert.equal(isCardNumberComplete('4580 1234 5678 9012'), true);
  assert.equal(isCardNumberComplete('4580 1234 5678 901'), false);
  assert.equal(isCardNumberComplete('4580123456789012 3'), false);
  assert.equal(justCompleted(isCardNumberComplete, '4580 1234 5678 901', '4580123456789012'), true);
  assert.equal(justCompleted(isCardNumberComplete, '4580 1234 5678 9012', '4580123456789013'), false, 'החלפת ספרה בכרטיס שלם');
  assert.equal(justCompleted(isCardNumberComplete, '', '4580123456789012'), true, 'הדבקה');
});
t('תוקף: MM/YY תקין בלבד (חודש 01-12)', () => {
  assert.equal(isExpiryComplete('12/27'), true);
  assert.equal(isExpiryComplete('01/30'), true);
  assert.equal(isExpiryComplete('13/27'), false);
  assert.equal(isExpiryComplete('00/27'), false);
  assert.equal(isExpiryComplete('12/2'), false);
  assert.equal(isExpiryComplete('12'), false);
});
t('נייד: 10 ספרות שמתחילות ב-05 (גם עם מקפים); קווי / 9 ספרות / 10 ספרות לא-05 לא קופצים', () => {
  assert.equal(isMobilePhoneComplete('050-1234567'), true);
  assert.equal(isMobilePhoneComplete('0521234567'), true);
  assert.equal(isMobilePhoneComplete('02-5551234'), false);
  assert.equal(isMobilePhoneComplete('052123456'), false);
  assert.equal(isMobilePhoneComplete('0321234567'), false);
  assert.equal(digitsOf(null), '');
});
t('בחירה מ-datalist: insertReplacementText / אירוע שאינו InputEvent = בחירה; הקלדה / מחיקה / הדבקה לא; הערך חייב להיות אחת האפשרויות בדיוק', () => {
  const cities = ['ירושלים', 'בית שמש'];
  assert.equal(isDatalistPick(ev('insertReplacementText'), 'ירושלים', cities), true, 'Chrome');
  assert.equal(isDatalistPick(ev('insertText'), 'ירושלים', cities), false, 'הקלדה של האות האחרונה');
  assert.equal(isDatalistPick(ev('deleteContentBackward'), 'ירושלים', cities), false);
  assert.equal(isDatalistPick(ev('insertFromPaste'), 'ירושלים', cities), false);
  assert.equal(isDatalistPick(ev('insertReplacementText'), 'ירושלי', cities), false, 'לא אחת האפשרויות');
  assert.equal(isDatalistPick(ev('insertReplacementText'), '', cities), false);
  assert.equal(isDatalistPick(null, 'ירושלים', cities), false);
  assert.equal(isDatalistPick({}, 'ירושלים', cities), true, 'Firefox ישן: אירוע input רגיל (לא InputEvent)');
});
t('חיווט (ישן + a5): כל קריאה מותנית במתג === true; ברירת מחדל = אין מעבר', () => {
  const L = read('app/orders/new/LegacyNewOrderPage.js');
  const calls = L.match(/focusField\('[^']+'\)/g) || [];
  assert.deepEqual(calls.sort(), ["focusField('cc-amount')", "focusField('cc-exp')", "focusField('cust-email')", "focusField('cust-house')", "focusField('cust-phone2')", "focusField('cust-street')"]);
  for (const line of L.split('\n').filter(l => /focusField\(/.test(l) && !/^import/.test(l))) assert.ok(line.includes("settings.auto_advance_fixed_fields === 'true'"), line.trim().slice(0, 90));
  const SC = read('app/components/new-order/StepCustomer.js');
  assert.ok(SC.includes("const aa = s.auto_advance_fixed_fields === 'true';"));
  assert.ok(SC.includes("onPick={aa ? () => focusField('noNcStreet') : undefined}") && SC.includes("onPick={aa ? () => focusField('noNcHouse') : undefined}"));
  const ND = read('app/components/new-order/NoDialogs.js');
  assert.ok(ND.includes("if (autoAdvance && justCompleted(isCardNumberComplete, data.cardNumber, v.cardNumber)) focusField('noCcExp');"));
  assert.ok(ND.includes("if (autoAdvance && justCompleted(isExpiryComplete, data.tokef, t)) focusField('noCcAmt');"));
  assert.ok(read('app/components/new-order/NewOrderA5.js').includes("autoAdvance={ctl.settings.auto_advance_fixed_fields === 'true'}"));
});
t('המפתח רשום (שם + הערה + רשימת הזמנות + בוליאנים + פריסה) וה-seed יוצר כבוי בשני הגמחים (ברירת מחדל)', () => {
  const M = read('lib/settingsMetadata.js');
  assert.equal((M.match(new RegExp(`\\n  ${KEY}: '`, 'g')) || []).length, 2);
  assert.equal(M.split(`'${KEY}'`).length, 3);
  assert.ok(read('lib/settingsSimLayout.js').includes(`  ${KEY}: { icon:`));
  const s = read(`scripts/seed_${KEY}_setting.js`);
  assert.ok(s.includes("2: { value: 'false', overwrite: false }") && s.includes("2: { value: 'true', overwrite: true }"));
});
console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
