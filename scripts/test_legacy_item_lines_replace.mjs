// בדיקות טהורות למדיניות "הזמנה ישנה מהאקסס - שמירה לא מכפילה חיוב ושומרת את המחיר ששולם" (legacy_item_lines_replaced_on_recalc),
// נווה יעקב, דיווחים 09648183 (הזמנה 53300) ו-e76d4ec3 (הזמנה 52830) מ-6.10.2026. המספרים הם מנתוני ההזמנות האמיתיות.
// החלטת הבעלים (7.10.2026): שמלה שלא השתנתה נשארת במחיר הישן (100 נשאר 100, 150 נשאר 150, בלי קפיצה למחירון של היום),
// ורק אם הדגם או שורת המחיר השתנו - השורה הישנה מוחלפת בחיוב לפי המחירון.
// הרצה (מהשורש): node --import ./scripts/business-days-tests/register.mjs scripts/test_legacy_item_lines_replace.mjs
// (בלי DB ובלי שרת; יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import {
  computeOrderObligations, computeOrderObligationsWithLegacyPolicy, classifyLegacyItemLines,
  sumLegacyPolicyTotals, buildLegacyAwarePreviewObligations,
} from '../lib/pricingCalc.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

// מחירון נווה יעקב (אחרי העדכון של 14.9.2026) - שורות ההשכרה והתיקון; המחירים עודכנו במקום (אותם id/legacyId)
const priceList = [
  { id: '46aa27ff', legacyId: 1, category: 'כללי', description: 'שמלת ילדה', fromSize: 0, toSize: 20, price: 60, startDate: new Date('2023-10-10T21:00:00Z'), endDate: null, deposit: 30 },
  { id: 'c1e6e6f9', legacyId: 2, category: 'כללי', description: 'שמלת אישה', fromSize: 32, toSize: 54, price: 120, startDate: new Date('2022-11-25T22:00:00Z'), endDate: null, deposit: 60 },
  { id: 'a7d5eb16', legacyId: 10, category: 'כללי', description: 'שמלה יוקרתית', fromSize: 60, toSize: 99, price: 180, startDate: new Date('2023-04-27T21:00:00Z'), endDate: null, deposit: 90 },
  { id: '1ec5eeaa', legacyId: 19, category: 'תיקונים', description: 'תיקון צוואר', fromSize: null, toSize: null, price: 15, startDate: null, endDate: null },
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
  id, sizeText, quantity: 1, cartStatus: 'confirmed', isDeleted: false, legacyId: 136000,
  barcodePrefix: Number(name) || null,
  createdAt: new Date('2026-09-15T11:24:23Z'), neckAlteration: 0, sleeveAlteration: 0, lengthAlteration: null,
  dressItem: { dress: { name, barcodePrefix: Number(name) || null, priceCategory: 'כללי', isPremium: false } }, ...over,
});
const legacyLine = (id, orderItemId, productId, amount, over = {}) => ({
  id, orderId: 1, orderItemId, productId, amount, quantity: 1, isManual: true, isDeleted: false, description: null, ...over,
});
const DELIVERY = { description: 'משלוח הלוך - בית שמש', amount: 70, isManual: false, orderItemId: null, productId: null };

// ---- מה ששמירה (recalculateOrderObligations) תחשב ותשמור, ומה שהתצוגה המקדימה (preview-pricing) תציג - אותן פונקציות משותפות ----
function serverSave({ order, items, deletedItems = [], manual, on, withDelivery = false }) {
  const args = { order, items, deletedItems, priceList, settings };
  const r = on ? computeOrderObligationsWithLegacyPolicy(args, manual) : { ...computeOrderObligations(args), kept: [], replaced: [] };
  const sums = sumLegacyPolicyTotals({ manualObligations: manual, newObligations: r.newObligations, replaced: r.replaced });
  const toSave = r.newObligations.filter(o => !o.isDraft && !o.keptLegacyLineId);
  // שורות ההזמנה אחרי השמירה (בלי מבוטלות): ידניות שנשארו + מחושבות שנשמרו + משלוח (applyDeliveryCharge רץ אחרי)
  const replacedIds = new Set(r.replaced.map(o => o.id));
  const stored = [...manual.filter(o => !replacedIds.has(o.id)), ...toSave, ...(withDelivery ? [DELIVERY] : [])];
  return { ...r, ...sums, toSave, storedSum: stored.reduce((s, o) => s + o.amount, 0), storedLines: stored };
}
// מה שהכרטיס מציג בלשונית התשלומים אחרי שהתצוגה המקדימה חזרה: שורות ידניות בלי productId (נשארות ב-state) + מה שחזר מהשרת (+ משלוח)
function previewShown({ order, items, deletedItems = [], manual, on, withDelivery = false }) {
  const args = { order, items, deletedItems, priceList, settings };
  const r = on ? computeOrderObligationsWithLegacyPolicy(args, manual) : { ...computeOrderObligations(args), kept: [], replaced: [] };
  const fromServer = on
    ? buildLegacyAwarePreviewObligations({ newObligations: r.newObligations, manualObligations: manual, kept: r.kept, replaced: r.replaced })
    : r.newObligations;
  const clientManual = manual.filter(o => !o.productId); // GET מסמן isManual=false לכל שורה עם productId, והתצוגה המקדימה מחליפה אותן
  const lines = [...clientManual, ...fromServer.filter(o => !o.isDraft), ...(withDelivery ? [DELIVERY] : [])];
  return { lines, sum: lines.reduce((s, o) => s + o.amount, 0) };
}
const both = (p) => ({ server: serverSave(p), preview: previewShown(p) });

console.log('הזמנה 53300 (דיווח 09648183): שמירה אחרי חתימה על תקנון + משלוח לבית שמש, שולם 170');
const order53300 = { orderId: 53300, legacyId: null, orderDate: new Date('2026-09-09T18:19:12Z'), eventDate: new Date('2026-10-07T21:00:00Z') };
const items53300 = [mkItem('0dfc70c1', '626', '44')];
const manual53300 = [legacyLine('72bcfe34', '0dfc70c1', '2', 100)];
const paid53300 = 170;
t('כבוי (ברירת מחדל): 100 ישן + 120 מחושב + 70 משלוח = 290, חוב 120 (הבאג שדווח)', () => {
  const { server } = both({ order: order53300, items: items53300, manual: manual53300, on: false, withDelivery: true });
  assert.equal(server.storedSum, 290);
  assert.equal(server.storedSum - paid53300, 120);
  assert.equal(server.replaced.length + server.kept.length, 0);
});
t('דולק: סה"כ 170 (100 ישן נשאר + 70 משלוח), חוב 0 - לא 190 ולא 290', () => {
  const { server } = both({ order: order53300, items: items53300, manual: manual53300, on: true, withDelivery: true });
  assert.equal(server.storedSum, 170);
  assert.equal(server.storedSum - paid53300, 0);
  assert.deepEqual(server.kept.map(k => k.line.id), ['72bcfe34']);
  assert.equal(server.replaced.length, 0);
});
t('דולק: המסך (תצוגה מקדימה) מציג בדיוק את מה שנשמר - 170 (אצל הלקוחה היה 120+70=190 מול 290 שנשמרו)', () => {
  const p = { order: order53300, items: items53300, manual: manual53300, on: true, withDelivery: true };
  const { server, preview } = both(p);
  assert.equal(preview.sum, 170);
  assert.equal(preview.sum, server.storedSum);
  const rental = preview.lines.find(o => o.orderItemId === '0dfc70c1');
  assert.equal(rental.amount, 100, 'השורה בתצוגה היא 100 ולא 120');
});
t('דולק: שורת ההשכרה המחושבת לא נשמרת, השורה הישנה לא נוגעים בה (בלי ביטול ובלי עדכון)', () => {
  const { server } = both({ order: order53300, items: items53300, manual: manual53300, on: true });
  assert.equal(server.toSave.filter(o => o.orderItemId === '0dfc70c1').length, 0);
  assert.equal(server.replaced.length, 0);
});
t('דולק: הזמנה שכבר הוכפלה (שורה מחושבת 120 שמורה) - בשמירה הבאה המחושבת התייתרה ונמחקת, הסכום חוזר ל-170', () => {
  const doubledState = [...manual53300, { id: 'afd353b9', orderItemId: '0dfc70c1', description: '626 מידה 44 (פריט #0dfc70c1)', amount: 120, isManual: false }];
  const { server } = both({ order: order53300, items: items53300, manual: manual53300, on: true, withDelivery: true });
  const keyOf = (o) => `${o.orderItemId || ''}::${o.description || ''}`;
  const saveKeys = new Set(server.toSave.map(keyOf));
  const toDelete = doubledState.filter(o => o.isManual === false && !saveKeys.has(keyOf(o)));
  assert.deepEqual(toDelete.map(o => o.id), ['afd353b9']);
  assert.equal(server.storedSum, 170);
});
t('שמירה חוזרת (שוב ושוב): אותו סכום, אין שום כתיבה חדשה ואין שורה שנוספת', () => {
  const first = serverSave({ order: order53300, items: items53300, manual: manual53300, on: true });
  const second = serverSave({ order: order53300, items: items53300, manual: manual53300, on: true });
  assert.equal(first.totalRequired, 100);
  assert.equal(second.totalRequired, 100);
  assert.deepEqual(second.toSave, []);
});
t('finalPrice של הפריט (עדכון תצוגה בשמירה) = 100 - הסכום שנגבה', () => {
  const { server } = both({ order: order53300, items: items53300, manual: manual53300, on: true });
  const obs = server.newObligations.filter(o => o.orderItemId === '0dfc70c1' && o.amount >= 0);
  assert.equal(obs.reduce((s, o) => s + o.amount, 0), 100);
});

console.log('הזמנה 52830 (דיווח e76d4ec3): החלפת מידה 74 -> 76 באותה שורת מחיר, שולם 230');
const order52830 = { orderId: 52830, legacyId: null, orderDate: new Date('2026-08-12T14:28:44Z'), eventDate: new Date('2026-10-12T21:00:00Z') };
const manual52830 = [legacyLine('1961fc48', '811706b1', '10', 150)];
const item803 = (size, over = {}) => mkItem('811706b1', '803', size, over);
t('כבוי: 150 ישן + 180 מחושב = 330 (חוב 100 מול 230 ששולמו - מה שדווח)', () => {
  const { server } = both({ order: order52830, items: [item803('76')], manual: manual52830, on: false });
  assert.equal(server.storedSum, 330);
  assert.equal(server.storedSum - 230, 100);
});
t('דולק: מידה 74 -> 76 באותה שורת מחיר (60-99) לא מוסיפה כלום: הסכום 150 ולא 180', () => {
  for (const size of ['74', '76']) {
    const { server, preview } = both({ order: order52830, items: [item803(size)], manual: manual52830, on: true });
    assert.equal(server.storedSum, 150, 'size ' + size);
    assert.equal(preview.sum, 150);
    assert.equal(server.replaced.length, 0);
  }
});
t('דולק: ביחס ל-230 ששולמו יש יתרת זכות של 80 (שאלה פתוחה לבעלים - לא נוגעים)', () => {
  const { server } = both({ order: order52830, items: [item803('76')], manual: manual52830, on: true });
  assert.equal(server.storedSum - 230, -80);
});
t('דולק: מידה שעוברת לשורת מחיר אחרת (76 -> 44, שמלת אישה): השורה הישנה 150 מוחלפת (מבוטלת) והסכום 120 לפי המחירון', () => {
  const { server, preview } = both({ order: order52830, items: [item803('44')], manual: manual52830, on: true });
  assert.deepEqual(server.replaced.map(o => o.id), ['1961fc48']);
  assert.equal(server.storedSum, 120);
  assert.equal(preview.sum, 120);
});
t('אחרי ההחלפה (השורה הישנה מבוטלת) שמירה חוזרת יציבה: 120, בלי החלפה נוספת', () => {
  const cancelled = [{ ...manual52830[0], isDeleted: true }];
  const r = serverSave({ order: order52830, items: [item803('44')], manual: cancelled.filter(o => !o.isDeleted), on: true });
  assert.equal(r.replaced.length, 0);
  assert.equal(r.totalRequired, 120);
});
t('דולק: שמלה בת 44 (שורת אישה, 100 ישן) שעוברת ל-70 (שורה יוקרתית): מוחלפת, 180', () => {
  const { server } = both({ order: order53300, items: [mkItem('0dfc70c1', '626', '70')], manual: manual53300, on: true });
  assert.deepEqual(server.replaced.map(o => o.id), ['72bcfe34']);
  assert.equal(server.storedSum, 180);
});
t('דולק: מידה בין הטווחים (56, כלל "הזול") נשארת באותה שורה כמו 44 - לא נחשב שינוי', () => {
  const { server, preview } = both({ order: order53300, items: [mkItem('0dfc70c1', '626', '56')], manual: manual53300, on: true });
  assert.equal(server.storedSum, 100);
  assert.equal(preview.sum, 100);
});
t('דולק: מידה בין הטווחים (56) כשהשורה הישנה הייתה היוקרתית (60-99): המחושב הוא "הזול" - נחשב שינוי שורה ומוחלף', () => {
  const { server } = both({ order: order52830, items: [item803('56')], manual: manual52830, on: true });
  assert.deepEqual(server.replaced.map(o => o.id), ['1961fc48']);
  assert.equal(server.storedSum, 120);
});

console.log('מקרי קצה');
const base = () => computeOrderObligations({ order: order53300, items: items53300, deletedItems: [], priceList, settings }).newObligations;
const classify = (manual, over = {}) => classifyLegacyItemLines({
  manualObligations: manual, newObligations: over.newObligations || base(), items: over.items || items53300, priceList
});
t('החלפת דגם (קידומת הדגם הנוכחי שונה מזו שנשמרה מהאקסס) באותה שורת מחיר: מוחלפת לפי המחירון (120), לא נשארת 100', () => {
  const swapped = [mkItem('0dfc70c1', '700', '44', { barcodePrefix: 626 })]; // הפריט נשמר באקסס עם 626, הדגם הנוכחי 700
  const { server, preview } = both({ order: order53300, items: swapped, manual: manual53300, on: true });
  assert.deepEqual(server.replaced.map(o => o.id), ['72bcfe34']);
  assert.equal(server.storedSum, 120);
  assert.equal(preview.sum, 120);
});
t('אותו דגם (אותה קידומת) או קידומת חסרה בפריט: אין הוכחה לשינוי דגם - נשארת במחיר הישן', () => {
  assert.equal(classify(manual53300).kept.length, 1);
  const noPrefix = [mkItem('0dfc70c1', '626', '44', { barcodePrefix: null })];
  assert.equal(classify(manual53300, { items: noPrefix, newObligations: computeOrderObligations({ order: order53300, items: noPrefix, deletedItems: [], priceList, settings }).newObligations }).kept.length, 1);
});
t('פריט שנמחק: השורה הישנה שלו לא נוגעים (נשארת ונספרת כמו תמיד) והתצוגה המקדימה מציגה אותה כמו השרת', () => {
  const deleted = [mkItem('0dfc70c1', '626', '44', { isDeleted: true, deletedAt: new Date('2026-10-06T10:00:00Z') })];
  const p = { order: order53300, items: [], deletedItems: deleted, manual: manual53300 };
  const on = both({ ...p, on: true });
  assert.equal(on.server.kept.length + on.server.replaced.length, 0);
  assert.ok(on.server.storedLines.some(o => o.id === '72bcfe34'), 'השורה הישנה נשארת');
  assert.equal(on.preview.sum, on.server.storedSum);
  const off = both({ ...p, on: false });
  assert.equal(off.server.storedSum, on.server.storedSum, 'אותה התנהגות כמו לפני (פריט מחוק לא מושפע)');
});
t('פריט שנוסף (בלי שורה ישנה): המחושב לפי המחירון; הישן נשאר 100 -> 100 + 120 = 220, והמסך שווה לשמור', () => {
  const items = [mkItem('0dfc70c1', '626', '44'), mkItem('new1', '803', '66', { legacyId: null })];
  const { server, preview } = both({ order: order53300, items, manual: manual53300, on: true });
  assert.equal(server.storedSum, 100 + 180);
  assert.equal(preview.sum, server.storedSum);
});
t('פריט חדש מאותו דגם ואותה שורת מחיר (בלי שורה ישנה): מחיר המחירון, לא מחיר ישן של הפריט האחר', () => {
  const items = [mkItem('0dfc70c1', '626', '44'), mkItem('new2', '626', '44', { legacyId: null })];
  const { server } = both({ order: order53300, items, manual: manual53300, on: true });
  assert.equal(server.storedSum, 100 + 120);
});
t('הנחה ידנית (-30, בלי מוצר) וחיוב ידני נוסף (+40, בלי מוצר): נספרים כמו תמיד, ביחד עם 100 הישן', () => {
  const manual = [...manual53300, { id: 'd1', orderId: 1, orderItemId: null, productId: null, amount: -30, isManual: true, isDeleted: false, description: 'הנחה' },
    { id: 'e1', orderId: 1, orderItemId: null, productId: null, amount: 40, isManual: true, isDeleted: false, description: 'חיוב נוסף' }];
  const { server, preview } = both({ order: order53300, items: items53300, manual, on: true });
  assert.equal(server.storedSum, 100 - 30 + 40);
  assert.equal(preview.sum, server.storedSum);
});
t('הנחה ישנה מהאקסס עם מוצר (שורה שלילית): נשארת, השמלה נשארת 100, והמסך שווה לשמור (שורה ישנה שלילית חוזרת בתצוגה)', () => {
  const manual = [...manual53300, legacyLine('n1', '0dfc70c1', '2', -30)];
  const { server, preview } = both({ order: order53300, items: items53300, manual, on: true });
  assert.deepEqual(server.kept.map(k => k.line.id), ['72bcfe34']);
  assert.equal(server.storedSum, 70);
  assert.equal(preview.sum, 70);
});
t('שורה ידנית בלי פריט, או בלי מוצר, או מבוטלת, או לא-ידנית: לא מסווגת', () => {
  assert.equal(classify([{ id: 'm1', isManual: true, isDeleted: false, orderItemId: null, productId: null, amount: 40 }]).kept.length, 0);
  assert.equal(classify([legacyLine('m2', '0dfc70c1', null, 40)]).kept.length, 0);
  assert.equal(classify([legacyLine('d1', '0dfc70c1', '2', 100, { isDeleted: true })]).kept.length, 0);
  assert.equal(classify([legacyLine('a1', '0dfc70c1', '2', 100, { isManual: false })]).kept.length, 0);
});
t('שתי שורות ישנות חיוביות לאותו פריט - לא נוגעים (עמימות): כמו הישן, ושתיהן בתצוגה', () => {
  const manual = [legacyLine('t1', '0dfc70c1', '2', 100), legacyLine('t2', '0dfc70c1', '1', 50)];
  const { server, preview } = both({ order: order53300, items: items53300, manual, on: true });
  assert.equal(server.kept.length + server.replaced.length, 0);
  assert.equal(server.storedSum, 100 + 50 + 120);
  assert.equal(preview.sum, server.storedSum);
});
t('דגם בלי מחיר (מחושב 0): השורה הישנה נשארת ונספרת, כמו הישן, והתצוגה שווה', () => {
  const noPrice = [mkItem('0dfc70c1', '626', '44')];
  noPrice[0].dressItem.dress.priceCategory = 'קטגוריה שאין לה מחיר';
  const { server, preview } = both({ order: order53300, items: noPrice, manual: manual53300, on: true });
  assert.equal(server.kept.length + server.replaced.length, 0);
  assert.equal(server.storedSum, 100);
  assert.equal(preview.sum, 100);
});
t('שורת טיוטה (עגלה לא מאושרת) לא מסווגת', () => {
  const draftItems = [mkItem('0dfc70c1', '626', '44', { cartStatus: 'pending' })];
  const nl = computeOrderObligations({ order: { ...order53300, legacyId: null }, items: draftItems, deletedItems: [], priceList, settings }).newObligations;
  assert.equal(nl[0].isDraft, true);
  assert.equal(classify(manual53300, { items: draftItems, newObligations: nl }).kept.length, 0);
});
t('פריט עם תיקון צוואר: ההשכרה נשארת 100 והתיקון המחושב נספר פעם אחת = 115', () => {
  const withNeck = [mkItem('0dfc70c1', '626', '44', { neckAlteration: 1 })];
  const { server, preview } = both({ order: order53300, items: withNeck, manual: manual53300, on: true });
  assert.equal(server.storedSum, 115);
  assert.equal(preview.sum, 115);
});
t('"יום השכרה נוסף" (50%) מחושב על הסכום הישן שנגבה: 100 + 50 = 150 ולא 100 + 60', () => {
  const o = { ...order53300, extraDay: 'after' };
  const { server, preview } = both({ order: o, items: items53300, manual: manual53300, on: true });
  assert.equal(server.storedSum, 150);
  assert.equal(preview.sum, 150);
});
t('כבוי: computeOrderObligations (בלי הפרמטר החדש) לא מוסיפה שום סימון ולא משנה סכום', () => {
  const nl = computeOrderObligations({ order: order53300, items: items53300, deletedItems: [], priceList, settings }).newObligations;
  assert.ok(nl.every(o => !('keptLegacyLineId' in o)));
  assert.equal(nl[0].amount, 120);
  assert.deepEqual(Object.keys(nl[0]).sort(), ['amount', 'description', 'isDraft', 'isManual', 'orderId', 'orderItemId', 'productId', 'quantity']);
});
t('תצוגה מקדימה ללא מדיניות (כבוי) זהה לגמרי למה שהיה: החישוב הגולמי בלבד', () => {
  const off = previewShown({ order: order53300, items: items53300, manual: manual53300, on: false });
  assert.equal(off.sum, 120);
});
t('הזמנה בלי שום שורה ישנה (הזמנה רגילה מהאפליקציה): דולק וכבוי נותנים תוצאה זהה בדיוק', () => {
  const items = [mkItem('i1', '626', '44', { legacyId: null, barcodePrefix: null }), mkItem('i2', '803', '70', { legacyId: null, barcodePrefix: null })];
  const on = serverSave({ order: order53300, items, manual: [], on: true });
  const off = serverSave({ order: order53300, items, manual: [], on: false });
  assert.equal(on.totalRequired, off.totalRequired);
  assert.deepEqual(on.toSave, off.toSave);
});
t('סכום ידני בצד השרת (manualTotal) לא נפגע משורה שנשארה: ידנית 100 נספרת פעם אחת (לא פעמיים: ידנית + מחושבת מסומנת)', () => {
  const r = serverSave({ order: order53300, items: items53300, manual: manual53300, on: true });
  assert.equal(r.manualTotal, 100);
  assert.equal(r.newTotal, 0);
});

console.log('סקריפט התיקון החד-פעמי (scripts/repair_legacy_double_lines.js) - dry-run בלבד, בלי DB');
const repair = createRequire(import.meta.url)('./repair_legacy_double_lines.js');
const ids = (xs) => xs.map(x => x.line ? x.line.id : x.id).sort();
t('סיווג הסקריפט (עותק ב-Node רגיל) זהה לסיווג של lib/pricingCalc.js בכל תרחישי המבחן', () => {
  const scenarios = [
    { items: items53300, manual: manual53300 },
    { items: [item803('76')], manual: manual52830 },
    { items: [item803('44')], manual: manual52830 },
    { items: [item803('56')], manual: manual52830 },
    { items: [mkItem('0dfc70c1', '626', '56')], manual: manual53300 },
    { items: [mkItem('0dfc70c1', '626', '70')], manual: manual53300 },
    { items: [mkItem('0dfc70c1', '700', '44', { barcodePrefix: 626 })], manual: manual53300 },
    { items: items53300, manual: [legacyLine('t1', '0dfc70c1', '2', 100), legacyLine('t2', '0dfc70c1', '1', 50)] },
    { items: items53300, manual: [...manual53300, legacyLine('n1', '0dfc70c1', '2', -30)] },
  ];
  for (const s of scenarios) {
    const nl = computeOrderObligations({ order: order53300, items: s.items, deletedItems: [], priceList, settings }).newObligations;
    const a = classifyLegacyItemLines({ manualObligations: s.manual, newObligations: nl, items: s.items, priceList });
    const b = repair.classifyLegacyItemLines({ manualObligations: s.manual, newObligations: nl, items: s.items, priceList });
    assert.deepEqual(ids(b.kept), ids(a.kept));
    assert.deepEqual(ids(b.replaced), ids(a.replaced));
  }
});
t('הזמנה 53300 כפי שנשמרה (100 ישן + 120 מחושב + משלוח 70, שולם 170): התכנון = מחיקת ה-120, finalPrice 100, totalAmount 220 -> 100; חוב 120 -> 0', () => {
  const order = {
    orderId: 53300, totalAmount: 220, eventDate: new Date('2026-10-07T21:00:00Z'), status: 'x', customer: { firstName: 'א', lastName: 'ב' },
    items: items53300,
    obligations: [
      legacyLine('72bcfe34', '0dfc70c1', '2', 100),
      { id: 'afd353b9', orderItemId: '0dfc70c1', productId: 'c1e6e6f9', amount: 120, isManual: false, isDeleted: false, description: '626 מידה 44 (פריט #0dfc70c1)' },
      { id: 'dlv', orderItemId: null, productId: null, amount: 70, isManual: false, isDeleted: false, description: 'משלוח הלוך - בית שמש' },
    ],
    payments: [{ amount: 100, isDeleted: false }, { amount: 70, isDeleted: false }],
  };
  const a = repair.analyzeOrder(order, priceList);
  assert.equal(a.displayedRequired, 290);
  assert.equal(a.displayedDebt, 120);
  assert.equal(a.shouldBeRequired, 170);
  assert.equal(a.correctDebt, 0);
  assert.equal(a.becomesCredit, false);
  assert.equal(a.phantomDebtRemoved, true);
  assert.deepEqual(a.items.map(i => i.decision), ['keep_old']);
  const w = repair.planWrites(a);
  assert.deepEqual(w.map(x => x.type), ['delete_computed', 'item_final_price', 'order_total']);
  assert.equal(w[0].obligationId, 'afd353b9');
  assert.deepEqual(w[0].audit.changes, { deleted: true, description: '626 מידה 44 (פריט #0dfc70c1)', amount: 120 });
  assert.equal(w[1].to, 100);
  assert.deepEqual([w[2].from, w[2].to], [220, 100]);
});
t('הזמנה 52830 (שולם 230): אחרי הסרת הכפל יתרת זכות 80 - מסומן "יהפוך ליתרת זכות" ולא נוצר שום זיכוי בסקריפט', () => {
  const order = {
    orderId: 52830, totalAmount: 330, eventDate: new Date('2026-10-12T21:00:00Z'), status: 'x', customer: null, items: [item803('76')],
    obligations: [legacyLine('1961fc48', '811706b1', '10', 150),
      { id: 'c122840c', orderItemId: '811706b1', productId: 'a7d5eb16', amount: 180, isManual: false, isDeleted: false, description: '803 מידה 76 (פריט #811706b1)' }],
    payments: [{ amount: 230, isDeleted: false }],
  };
  const a = repair.analyzeOrder(order, priceList);
  assert.equal(a.displayedDebt, 100);
  assert.equal(a.correctDebt, -80);
  assert.equal(a.becomesCredit, true);
  assert.ok(!repair.planWrites(a).some(x => /refund/i.test(x.type)));
});
t('שמלה ששורת המחיר שלה השתנתה: התכנון מבטל (soft-delete) את השורה הישנה ומשאיר את המחושבת', () => {
  const order = {
    orderId: 1, totalAmount: 270, eventDate: null, status: 'x', customer: null, items: [item803('44')],
    obligations: [legacyLine('L1', '811706b1', '10', 150),
      { id: 'C1', orderItemId: '811706b1', productId: 'c1e6e6f9', amount: 120, isManual: false, isDeleted: false, description: '803 מידה 44 (פריט #811706b1)' }],
    payments: [],
  };
  const a = repair.analyzeOrder(order, priceList);
  assert.deepEqual(a.items.map(i => i.decision), ['use_pricelist']);
  const w = repair.planWrites(a);
  assert.deepEqual(w.map(x => [x.type, x.obligationId || x.to]), [['cancel_legacy', 'L1'], ['order_total', 120]]);
  assert.equal(w[0].audit.action, 'CANCEL_OBLIGATION');
  assert.deepEqual(w[0].audit.changes.isDeleted, { from: false, to: true });
});
t('שתי שורות ישנות חיוביות לאותה שמלה: לבדיקה ידנית, בלי שום כתיבה', () => {
  const order = {
    orderId: 2, totalAmount: 270, eventDate: null, status: 'x', customer: null, items: items53300,
    obligations: [legacyLine('t1', '0dfc70c1', '2', 100), legacyLine('t2', '0dfc70c1', '1', 50),
      { id: 'C', orderItemId: '0dfc70c1', productId: 'c1e6e6f9', amount: 120, isManual: false, isDeleted: false, description: '626 מידה 44 (פריט #0dfc70c1)' }],
    payments: [],
  };
  const a = repair.analyzeOrder(order, priceList);
  assert.equal(a.autoFixable, false);
  assert.deepEqual(repair.planWrites(a), []);
});
t('הגנות כתיבה: dry-run מותר רק לנווה (org 2); כתיבה דורשת --write + --i-understand + --expect-host + ההגדרה "true"', () => {
  const ok = { host: 'ep-neve.neon.tech', otherHost: 'ep-main.neon.tech', settingValue: 'true' };
  const p = (...a) => repair.parseArgs(['--org=2', ...a]);
  assert.deepEqual(repair.writeRefusals(p(), { ...ok, settingValue: undefined }), [], 'dry-run: בלי דרישות');
  assert.ok(repair.writeRefusals(repair.parseArgs(['--org=1']), ok).length > 0, 'הגמח הראשי אסור');
  assert.ok(repair.writeRefusals(p('--write'), ok).length >= 2, 'בלי --i-understand ובלי --expect-host');
  assert.ok(repair.writeRefusals(p('--write', '--i-understand'), ok).some(r => r.includes('expect-host')));
  assert.ok(repair.writeRefusals(p('--write', '--expect-host=ep-neve'), ok).some(r => r.includes('i-understand')));
  assert.ok(repair.writeRefusals(p('--write', '--i-understand', '--expect-host=ep-other'), ok).length > 0, 'host שגוי');
  assert.ok(repair.writeRefusals(p('--write', '--i-understand', '--expect-host=ep-neve'), { ...ok, settingValue: undefined }).some(r => r.includes('legacy_item_lines_replaced_on_recalc')));
  assert.ok(repair.writeRefusals(p('--write', '--i-understand', '--expect-host=ep-neve'), { ...ok, host: 'ep-main.neon.tech' }).length > 0, 'אותו host כמו הגמח השני');
  assert.deepEqual(repair.writeRefusals(p('--write', '--i-understand', '--expect-host=ep-neve'), ok), []);
  assert.equal(p().write, false);
});
t('הסקריפט לא כותב כברירת מחדל: כל קריאות הכתיבה בתוך applyPlan בלבד, ו-main מגיע אליו רק עם args.write', () => {
  const src = fs.readFileSync(new URL('./repair_legacy_double_lines.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const outsideApply = src.replace(/async function applyPlan[\s\S]*?\n}\n/, '');
  assert.ok(!/\.(create|update|delete|upsert|deleteMany|updateMany|createMany)\(/.test(outsideApply.replace(/\/\/.*$/gm, '')), 'אין כתיבה מחוץ ל-applyPlan');
  assert.ok(src.includes('if (!args.write || writes.length === 0) continue;'));
});

console.log('חיווט (סטטי)');
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const KEY = 'legacy_item_lines_replaced_on_recalc';
t('המנוע קורא את ההגדרה עם ברירת מחדל כבוי (רק "true" מפעיל), לא שומר שורה מסומנת, ומבטל ב-soft-delete עם יומן', () => {
  const eng = read('lib/pricingEngine.js');
  assert.ok(eng.includes(`getCachedSetting('${KEY}')`));
  assert.ok(eng.includes(`legacyPolicySetting?.value === 'true'`));
  assert.ok(eng.includes('computeOrderObligationsWithLegacyPolicy(computeArgs, manualObligations)'));
  assert.ok(eng.includes('({ newObligations } = computeOrderObligations(computeArgs));'), 'כבוי = החישוב הישן');
  assert.ok(eng.includes('newObligations.filter(o => !o.isDraft && !o.keptLegacyLineId)'));
  assert.ok(/auditAs\('CANCEL_OBLIGATION'[\s\S]{0,120}data: \{ isDeleted: true \}/.test(eng), 'soft-delete, לא מחיקה');
  assert.ok(eng.includes('sumLegacyPolicyTotals({ manualObligations, newObligations, replaced: replacedLegacyLines })'));
});
t('התצוגה המקדימה (ראוט) משתמשת באותה פונקציה משותפת רק כשההגדרה "true", ומחזירה את הרשימה הבנויה', () => {
  const route = read('app/api/orders/[id]/preview-pricing/route.js');
  assert.ok(route.includes(`'${KEY}'`));
  assert.ok(route.includes(`s.key === '${KEY}')?.value === 'true'`));
  assert.ok(route.includes('computeOrderObligationsWithLegacyPolicy(computeArgs, manualObligations)'));
  assert.ok(route.includes('buildLegacyAwarePreviewObligations('));
  assert.ok(route.includes('({ newObligations, totalValid } = computeOrderObligations(computeArgs));'), 'כבוי = החישוב הישן');
});
t('שני הכרטיסים (הישן והחדש) והחלון הסיכום מחליפים את שורות ה-productId בשורות שחוזרות מהשרת - אותו ראוט', () => {
  const legacy = read('app/orders/[id]/LegacyOrderPage.js');
  const flows = read('app/components/order-card/orderCardFlows.js');
  const ctrl = read('app/components/order-card/useOrderCardController.js');
  for (const src of [legacy, flows, ctrl]) {
    assert.ok(src.includes('/preview-pricing`'));
    assert.ok(src.includes('o.isManual !== false'), 'ידניות בלי productId נשמרות, השאר מוחלף');
    assert.ok(src.includes('data.newObligations'));
  }
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
