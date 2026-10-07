// בדיקות טהורות להחלפת שורות ההשכרה הישנות מהאקסס (legacy_item_lines_replaced_on_recalc) - נווה יעקב,
// דיווחים 09648183 (הזמנה 53300) ו-e76d4ec3 (הזמנה 52830) מ-6.10.2026. המספרים הם מנתוני ההזמנות האמיתיות.
// הרצה (מהשורש): node --import ./scripts/business-days-tests/register.mjs scripts/test_legacy_item_lines_replace.mjs
// (בלי DB ובלי שרת; יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { computeOrderObligations, findReplaceableLegacyItemLines } from '../lib/pricingCalc.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

// מחירון נווה יעקב (אחרי העדכון של 14.9.2026) - רק שורות ההשכרה
const priceList = [
  { id: '46aa27ff', legacyId: 1, category: 'כללי', description: 'שמלת ילדה', fromSize: 0, toSize: 20, price: 60, startDate: new Date('2023-10-10T21:00:00Z'), endDate: null, deposit: 30 },
  { id: 'c1e6e6f9', legacyId: 2, category: 'כללי', description: 'שמלת אישה', fromSize: 32, toSize: 54, price: 120, startDate: new Date('2022-11-25T22:00:00Z'), endDate: null, deposit: 60 },
  { id: 'a7d5eb16', legacyId: 10, category: 'כללי', description: 'שמלה יוקרתית', fromSize: 60, toSize: 99, price: 180, startDate: new Date('2023-04-27T21:00:00Z'), endDate: null, deposit: 90 },
];
// הגדרות נווה יעקב הרלוונטיות (gap_size_price_rule=cheaper ועוד)
const settings = [
  { key: 'gap_size_price_rule', value: 'cheaper' },
  { key: 'same_model_swap_no_fee', value: 'true' },
  { key: 'swap_same_category_only', value: 'true' },
  { key: 'swap_pairing_window_minutes', value: '120' },
  { key: 'refund_tiers_at_deletion_time', value: 'true' },
  { key: 'instant_undo_minutes', value: '15' },
  { key: 'CANCELLATION_CREDIT_MINUTES', value: '0' },
  { key: 'REFUND_DAYS_FROM_ORDER', value: '0' },
  { key: 'NO_REFUND_DAYS_BEFORE_EVENT', value: '2' },
  { key: 'REFUND_PERCENTAGE', value: '50' },
];
const mkItem = (id, name, sizeText, over = {}) => ({
  id, sizeText, quantity: 1, cartStatus: 'confirmed', isDeleted: false, legacyId: null,
  createdAt: new Date('2026-09-15T11:24:23Z'), neckAlteration: 0, sleeveAlteration: 0, lengthAlteration: null,
  dressItem: { dress: { name, priceCategory: 'כללי', isPremium: false } }, ...over,
});
const legacyLine = (id, orderItemId, productId, amount, over = {}) => ({
  id, orderItemId, productId, amount, isManual: true, isDeleted: false, description: null, ...over,
});
// סכום הזמנה כפי שה-engine מחשב: שורות ידניות (בלי המוחלפות) + שורות מחושבות לא-טיוטה
function totalAfterRecalc({ order, items, manual, replace }) {
  const { newObligations } = computeOrderObligations({ order, items, deletedItems: [], priceList, settings });
  const replaced = replace
    ? findReplaceableLegacyItemLines({ manualObligations: manual, newObligations, activeItemIds: new Set(items.map(i => i.id)) })
    : [];
  const ids = new Set(replaced.map(o => o.id));
  const manualTotal = manual.filter(o => !o.isDeleted && !ids.has(o.id)).reduce((s, o) => s + o.amount, 0);
  const newTotal = newObligations.filter(o => !o.isDraft).reduce((s, o) => s + o.amount, 0);
  return { total: manualTotal + newTotal, replaced, newObligations };
}

console.log('הזמנה 53300 (דיווח 09648183): שמירה בלי שינוי בשמלה');
const order53300 = { orderId: 53300, legacyId: null, orderDate: new Date('2026-09-09T18:19:12Z'), eventDate: new Date('2026-10-07T21:00:00Z') };
const items53300 = [mkItem('0dfc70c1', '626', '44')];
const manual53300 = [legacyLine('72bcfe34', '0dfc70c1', '2', 100)];
t('כבוי (ברירת מחדל): 100 ישן + 120 מחושב = 220 (הבאג, כפי שנשמר בפועל בהזמנה)', () => {
  assert.equal(totalAfterRecalc({ order: order53300, items: items53300, manual: manual53300, replace: false }).total, 220);
});
t('דולק: השורה הישנה 100 מוחלפת, הסכום = 120 (שורת המחירון של מידה 44)', () => {
  const r = totalAfterRecalc({ order: order53300, items: items53300, manual: manual53300, replace: true });
  assert.deepEqual(r.replaced.map(o => o.id), ['72bcfe34']);
  assert.equal(r.total, 120);
});
t('שמירה חוזרת (השורה הישנה כבר מבוטלת): הסכום נשאר 120 ואין עוד החלפה', () => {
  const afterFirst = [{ ...manual53300[0], isDeleted: true }];
  const r = totalAfterRecalc({ order: order53300, items: items53300, manual: afterFirst, replace: true });
  assert.equal(r.replaced.length, 0);
  assert.equal(r.total, 120);
});

console.log('הזמנה 52830 (דיווח e76d4ec3): החלפת מידה 74 -> 76 באותה שורת מחיר');
const order52830 = { orderId: 52830, legacyId: null, orderDate: new Date('2026-08-12T14:28:44Z'), eventDate: new Date('2026-10-12T21:00:00Z') };
const items52830 = [mkItem('811706b1', '803', '76')];
const manual52830 = [legacyLine('1961fc48', '811706b1', '10', 150)];
t('כבוי: 150 ישן + 180 מחושב = 330 (חוב 100 מול 230 ששולמו - מה שדווח)', () => {
  const total = totalAfterRecalc({ order: order52830, items: items52830, manual: manual52830, replace: false }).total;
  assert.equal(total, 330);
  assert.equal(total - 230, 100);
});
t('דולק: הסכום = 180 (בלי החיוב הכפול; ביחס ל-230 ששולמו יש יתרת זכות של 50)', () => {
  const total = totalAfterRecalc({ order: order52830, items: items52830, manual: manual52830, replace: true }).total;
  assert.equal(total, 180);
  assert.equal(total - 230, -50);
});

console.log('מקרי קצה - לא נוגעים');
const base = () => computeOrderObligations({ order: order53300, items: items53300, deletedItems: [], priceList, settings }).newObligations;
const find = (manual, over = {}) => findReplaceableLegacyItemLines({ manualObligations: manual, newObligations: over.newObligations || base(), activeItemIds: over.active || new Set(['0dfc70c1']) });
t('שורה שלילית (הנחה/זיכוי מהאקסס) נשארת', () => {
  assert.equal(find([legacyLine('n1', '0dfc70c1', '2', -30)]).length, 0);
});
t('הנחה ישנה לצד שורת ההשכרה: מוחלפת רק החיובית (100 -> 120, ההנחה -30 נשארת = 90)', () => {
  const manual = [legacyLine('p1', '0dfc70c1', '2', 100), legacyLine('n1', '0dfc70c1', '2', -30)];
  const r = totalAfterRecalc({ order: order53300, items: items53300, manual, replace: true });
  assert.deepEqual(r.replaced.map(o => o.id), ['p1']);
  assert.equal(r.total, 90);
});
t('שורה ידנית בלי פריט (חיוב ידני רגיל) או בלי מוצר - נשארת', () => {
  assert.equal(find([{ id: 'm1', isManual: true, isDeleted: false, orderItemId: null, productId: null, amount: 40 }]).length, 0);
  assert.equal(find([legacyLine('m2', '0dfc70c1', null, 40)]).length, 0);
});
t('שורה מבוטלת או לא-ידנית - נשארת', () => {
  assert.equal(find([legacyLine('d1', '0dfc70c1', '2', 100, { isDeleted: true })]).length, 0);
  assert.equal(find([legacyLine('a1', '0dfc70c1', '2', 100, { isManual: false })]).length, 0);
});
t('פריט שאינו פעיל (נמחק) - השורה הישנה נשארת', () => {
  assert.equal(find([legacyLine('x1', 'GONE', '2', 100)]).length, 0);
});
t('שתי שורות ישנות חיוביות לאותו פריט - לא נוגעים (עמימות)', () => {
  assert.equal(find([legacyLine('t1', '0dfc70c1', '2', 100), legacyLine('t2', '0dfc70c1', '1', 50)]).length, 0);
});
t('פריט בלי שורה מחושבת חיובית (דגם בלי מחיר = 0) - השורה הישנה נשארת', () => {
  const noPrice = [mkItem('0dfc70c1', '626', '44')];
  noPrice[0].dressItem.dress.priceCategory = 'קטגוריה שאין לה מחיר';
  const { newObligations } = computeOrderObligations({ order: order53300, items: noPrice, deletedItems: [], priceList, settings });
  assert.equal(newObligations[0].amount, 0);
  assert.equal(find([legacyLine('z1', '0dfc70c1', '2', 100)], { newObligations }).length, 0);
});
t('שורת טיוטה (עגלה לא מאושרת) לא מחליפה שורה ישנה', () => {
  const draft = [{ orderItemId: '0dfc70c1', amount: 120, description: '626 מידה 44 (פריט #0dfc70c1)', isDraft: true }];
  assert.equal(find([legacyLine('q1', '0dfc70c1', '2', 100)], { newObligations: draft }).length, 0);
});
t('שורת תיקון בלבד (בלי שורת השכרה) לא מחליפה שורה ישנה', () => {
  const repairOnly = [{ orderItemId: '0dfc70c1', amount: 15, description: 'תיקון צוואר - 626 (פריט #0dfc70c1)', isDraft: false }];
  assert.equal(find([legacyLine('r1', '0dfc70c1', '2', 100)], { newObligations: repairOnly }).length, 0);
});
t('פריט עם תיקון: השכרה ישנה מוחלפת, שורת התיקון המחושבת נספרת פעם אחת', () => {
  const withNeck = [mkItem('0dfc70c1', '626', '44', { neckAlteration: 1 })];
  const priceListWithRepair = [...priceList, { id: '1ec5eeaa', legacyId: 19, category: 'תיקונים', description: 'תיקון צוואר', fromSize: null, toSize: null, price: 15, startDate: null, endDate: null }];
  const { newObligations } = computeOrderObligations({ order: order53300, items: withNeck, deletedItems: [], priceList: priceListWithRepair, settings });
  const replaced = findReplaceableLegacyItemLines({ manualObligations: [legacyLine('w1', '0dfc70c1', '2', 100)], newObligations, activeItemIds: new Set(['0dfc70c1']) });
  assert.equal(replaced.length, 1);
  assert.equal(newObligations.filter(o => o.amount > 0).reduce((s, o) => s + o.amount, 0), 135);
});

console.log('חיווט (סטטי)');
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const KEY = 'legacy_item_lines_replaced_on_recalc';
t('המנוע קורא את ההגדרה עם ברירת מחדל כבוי (רק ערך "true" מפעיל) ומבטל ב-soft-delete עם יומן', () => {
  const eng = read('lib/pricingEngine.js');
  assert.ok(eng.includes(`getCachedSetting('${KEY}')`));
  assert.ok(eng.includes(`replaceLegacySetting?.value === 'true'`));
  assert.ok(/auditAs\('CANCEL_OBLIGATION'[\s\S]{0,120}data: \{ isDeleted: true \}/.test(eng), 'soft-delete, לא מחיקה');
  assert.ok(eng.includes('manualObligations.filter(o => !replacedLegacyIds.has(o.id))'));
});
t('ההגדרה רשומה: שם, הערה, קטגוריה, בוליאנית, מקטע במסך ההגדרות', () => {
  const m = read('lib/settingsMetadata.js');
  assert.ok(m.includes(`  ${KEY}: '`) && m.split(`${KEY}: '`).length === 3, 'שם + הערה');
  assert.ok(/'תשלומים': \[[\s\S]*?\],\n\};/.test(m) && m.slice(m.indexOf("'תשלומים': ["), m.indexOf("'תשלומים': [") + 1500).includes(`'${KEY}'`));
  const boolBlock = m.slice(m.indexOf('SETTINGS_BOOLEAN_KEYS = ['), m.indexOf('SETTINGS_NUMBER_KEYS'));
  assert.ok(boolBlock.includes(`'${KEY}'`));
  const sim = read('lib/settingsSimLayout.js');
  assert.ok(sim.includes(`'premium_categories', '${KEY}'`) && sim.includes(`${KEY}: { icon: 'tag' }`));
});

console.log(`\n${passed} passed`);
