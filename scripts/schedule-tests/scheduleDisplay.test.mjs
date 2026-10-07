// תצוגת דף הלו״ז (החלטות הבעלים 7.10.2026): "איחור (N ימים)", "הזמנות חדשות", ושורת פרטים בקיצור (אייקון + ערך).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const { alertText, stageLabel, subItems } = await L('app/components/schedule/scheduleMeta.js');

test('late alert reads "איחור (N ימים)" without "לא סומן כבוצע"', () => {
  assert.equal(alertText({ code: 'late_not_done', label: 'באיחור - לא סומן כבוצע', daysLate: 1 }), 'איחור (יום אחד)');
  assert.equal(alertText({ code: 'late_not_done', label: 'באיחור - לא סומן כבוצע', daysLate: 3 }), 'איחור (3 ימים)');
  assert.equal(alertText({ code: 'late_not_done', label: 'באיחור - לא סומן כבוצע' }), 'איחור');
  assert.equal(alertText({ code: 'missing_address', label: 'חסרה כתובת משלוח' }), 'חסרה כתובת משלוח');
});

test('stage 1 is titled "הזמנות חדשות"; other stages keep the server label', () => {
  assert.equal(stageLabel({ key: 'order', label: 'הזמנה' }), 'הזמנות חדשות');
  assert.equal(stageLabel({ key: 'prep', label: 'הכנה' }), 'הכנה');
});

test('order row: calendar + date, cash + amount, check-only when paid, dress + items, user + registrar', () => {
  const it = subItems('order', { eventDateHebrew: 'ד חשון', totalAmount: 60, payStatus: 'paid', dressCount: 1, registeredBy: 'רבקה לוי' });
  assert.deepEqual(it.map((x) => x.icon), ['cal', 'cash', 'check', 'dress', 'user']);
  assert.equal(it[2].text, '');
  assert.equal(it[3].text, 'פריט אחד');
  assert.ok(!JSON.stringify(it).includes('סה״כ ') || it[1].tip === 'סה״כ להזמנה');
});

test('order row: unpaid / partial keep their text (no check icon)', () => {
  const partial = subItems('order', { eventDateHebrew: 'ד חשון', totalAmount: 720, payStatus: 'partial', balance: 100, dressCount: 2 });
  assert.ok(!partial.some((x) => x.icon === 'check'));
  assert.ok(partial.some((x) => x.text.startsWith('שולם חלקי')));
});

test('other stages: icon + short value', () => {
  assert.deepEqual(subItems('prep', { branch: 'בני ברק', dressCount: 2 }).map((x) => [x.icon, x.text]), [['pin', 'בני ברק'], ['dress', '2 פריטים']]);
  assert.equal(subItems('dout', { dressCount: 1 })[0].text, 'כתובת חסרה');
  assert.equal(subItems('manret', { customer: { phone1: '050' }, dressCount: 1 })[0].icon, 'phone');
});
