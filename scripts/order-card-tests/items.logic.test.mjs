// W3 — עזרים טהורים של לשונית הפריטים (hooks/useItemActions.js): סטטוס, תיקון, מכסה (R32), "פרטי הוספה" (A11, כולל פריט
// מיובא), שעה ישראלית (רץ ב-3 אזורי זמן), מחיר/דמי ביטול מהמנוע (A27), תפוסה (R29 = הישן), מיון הטבלה (A10).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const P = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const A = await P('app/components/order-card/hooks/useItemActions.js');
const L = await P('app/components/order-card/orderCardLogic.js');
const CAP_SRC = fs.readFileSync(path.join(process.env.PROJ, 'components/orders/ItemCapacityModal.js'), 'utf8');
const SIZE_SRC = fs.readFileSync(path.join(process.env.PROJ, 'components/orders/OrderSizeSelector.js'), 'utf8');

const it = (over = {}) => ({ id: 'a1', sizeText: '38', dressItem: { dress: { name: '4512', barcodePrefix: 45 } }, isTaken: false, isReturned: false, returnedOk: false, ...over });
const DEL_BOTH = { isDelivery: true, deliveryDirection: 'הלוך-חזור' };

test('statusText: נלקחה/נמסרה, הוחזרה/נאספה לפי כיוון המשלוח; "לא תקין"; שורה שטרם נשמרה; מחוק', () => {
  assert.equal(A.statusText(it(), {}), 'טרם נלקחה');
  assert.equal(A.statusText(it(), DEL_BOTH), 'טרם נמסרה');
  assert.equal(A.statusText(it({ isTaken: true }), { isDelivery: true, deliveryDirection: 'חזור' }), 'נלקחה');
  assert.equal(A.statusText(it({ isTaken: true }), DEL_BOTH), 'נמסרה');
  assert.equal(A.statusText(it({ isTaken: true, isReturned: true, returnedOk: true }), { isDelivery: true, deliveryDirection: 'הלוך' }), 'הוחזרה');
  assert.equal(A.statusText(it({ isTaken: true, isReturned: true, returnedOk: false }), DEL_BOTH), 'נאספה · לא תקין');
  assert.equal(A.statusText({ _localId: 'L1', isNew: true }, {}), 'נוסף · טרם נשמר');
  assert.equal(A.statusText(it(), {}, 'del'), 'הוסר מההזמנה');
});

test('altText: צוואר/שרוול/אורך + "בוצע"; בלי תיקון = ריק', () => {
  assert.equal(A.altText(it()), '');
  assert.equal(A.altText(it({ neckAlteration: 1, sleeveAlteration: true })), 'תיקון: צוואר, שרוול');
  assert.equal(A.altText(it({ lengthAlteration: '3', alterationDone: true })), 'תיקון: אורך · בוצע');
  assert.equal(A.hasRepairOf(it({ lengthAlteration: '  ' })), false);
});

test('R32 quotaFull: max_items_per_order מלא (פריטים לא מחוקים); חסר/0/לא מספר = בלי מגבלה (כמו parseInt של הישן)', () => {
  const S = (v) => L.parseSettings(v === undefined ? [] : [{ key: 'max_items_per_order', value: v }]);
  const items = [it(), it({ id: 'a2' }), it({ id: 'a3', isDeleted: true })];
  assert.equal(A.quotaFull(S('2'), items), true);
  assert.equal(A.quotaFull(S('3'), items), false);
  assert.equal(A.quotaFull(S(undefined), items), false);
  assert.equal(A.quotaFull(S('0'), items), false);
  assert.equal(A.quotaFull(S('abc'), items), false);
});

test('R23 alterationsEnabled: מפתח חסר = פעיל, "false" = כבוי (MIM :145)', () => {
  assert.equal(A.alterationsEnabled(L.parseSettings([])), true);
  assert.equal(A.alterationsEnabled(L.parseSettings([{ key: 'enable_alterations', value: 'false' }])), false);
  assert.equal(A.alterationsEnabled(L.parseSettings([{ key: 'enable_alterations', value: 'true' }])), true);
  assert.ok(/enable_alterations !== 'false'/.test(fs.readFileSync(path.join(process.env.PROJ, 'components/orders/modern/ModernItemsManager.js'), 'utf8')));
});

test('A11 "פרטי הוספה": פריט חדש = createdAt + שעה + מי; פריט מיובא (legacyId) = תאריך ההזמנה בלי שעה', () => {
  const order = { orderDate: '2026-09-23T07:12:00.000Z' };
  const fresh = it({ createdAt: '2026-10-04T07:13:00.000Z' });
  assert.equal(A.addedAtOf(fresh, order), '2026-10-04T07:13:00.000Z');
  assert.equal(A.addedText(fresh, order, 'רחל כהן'), `${L.hebDateOf('2026-10-04T07:13:00.000Z')} · 10:13 · רחל כהן`);
  const legacy = it({ legacyId: 123, createdAt: '2026-08-01T00:00:00.000Z', orderDate: null });
  assert.equal(A.addedAtOf(legacy, order), order.orderDate, 'createdAt קפוא של המיגרציה לא משמש');
  assert.equal(A.addedText(legacy, order, ''), L.hebDateOf(order.orderDate));
  assert.equal(A.addedText({ _localId: 'x', isNew: true, createdAt: '2026-10-04T07:13:00.000Z' }, order, ''), L.hebDateOf('2026-10-04T07:13:00.000Z'));
});

test('israelTimeOf: שעה ישראלית בלי תלות באזור הזמן של המכונה; אף פעם לא תאריך לועזי', () => {
  assert.equal(A.israelTimeOf('2026-10-04T07:13:00.000Z'), '10:13'); // שעון קיץ
  assert.equal(A.israelTimeOf('2026-12-04T22:05:00.000Z'), '00:05'); // שעון חורף, אחרי חצות בישראל
  assert.equal(A.israelTimeOf(''), '');
  assert.equal(A.israelTimeOf('לא תאריך'), '');
});

test('creatorIdOf: העובד של שורת ה-CREATE המוקדמת ביותר', () => {
  const logs = [{ action: 'UPDATE', employeeId: 'u', createdAt: '2026-10-03' }, { action: 'CREATE', employeeId: 'late', createdAt: '2026-10-02' }, { action: 'CREATE', employeeId: 'first', createdAt: '2026-10-01' }];
  assert.equal(A.creatorIdOf(logs), 'first');
  assert.equal(A.creatorIdOf([]), null);
});

test('A27: פריט היפותטי ל-preview-pricing נושא את מה שהמנוע קורא (dressItem.dress.priceCategory/isPremium/id, מידה, תיקונים)', () => {
  const h = A.hypotheticalItem({ id: 'm1', name: '4519', priceCategory: 'שמלה', isPremium: true, barcodePrefix: 4519 }, { sizeText: '38', sleeveAlteration: 1 });
  assert.equal(h.id, A.PREVIEW_ITEM_ID);
  assert.equal(h.legacyId, null, 'לא "פריט מיובא" — חיוב מקורי נרשם');
  assert.deepEqual(h.dressItem.dress, { id: 'm1', name: '4519', priceCategory: 'שמלה', isPremium: true, barcodePrefix: 4519 });
  assert.equal(h.sizeText, '38');
  assert.equal(h.sleeveAlteration, 1);
  assert.ok(!('createdAt' in h), 'בלי createdAt: "ביטול מיידי" לא חל — מוצג דמי הביטול לפי המדרגות');
  const pid = A.PREVIEW_ITEM_ID;
  assert.equal(A.priceFromPreview([{ orderItemId: pid, amount: 120, description: 'דגם 4519 מידה 38 (פריט #x)' }, { orderItemId: pid, amount: 30, description: 'תיקון שרוול - 4519' }, { orderItemId: 'other', amount: 99 }]), 120);
  assert.equal(A.feeFromPreview([{ orderItemId: pid, amount: 150 }, { orderItemId: pid, amount: -150 }, { orderItemId: pid, amount: 40 }, { orderItemId: 'x', amount: 7 }]), 40);
  assert.equal(A.feeFromPreview([{ orderItemId: pid, amount: 150 }, { orderItemId: pid, amount: -150 }]), 0);
  assert.equal(A.feeFromPreview([]), 0);
});

test('sizeInfo = טקסט הזמינות של OrderSizeSelector + מידה לא זמינה מנוטרלת', () => {
  assert.ok(SIZE_SRC.includes('פנוי ${normalAvail} מתוך ${s.totalInStock}'));
  assert.deepEqual(A.sizeInfo({ sizeText: '38', withNormalBuffer: { availableQuantity: 2 }, totalInStock: 3 }, {}), { size: '38', info: 'פנוי 2 מתוך 3', disabled: false });
  assert.equal(A.sizeInfo({ sizeText: '40', withNormalBuffer: { availableQuantity: 0 }, totalInStock: 3 }, {}).disabled, true);
  assert.deepEqual(A.sizeInfo({ sizeText: '42', withNormalBuffer: { availableQuantity: 1 }, withCustomSpacing: { availableQuantity: 2, gain: 1 }, totalInStock: 4 }, { customSpacing: 1 }), { size: '42', info: 'רגיל: 1 | ציפוף: 2 (+1) מתוך 4', disabled: false });
  assert.deepEqual(A.sizeInfo({ sizeText: '44', totalQuantity: 5 }, {}), { size: '44', info: 'במלאי: 5', disabled: false });
  assert.equal(A.displayModelName({ name: 'ללא שם 3', barcodePrefix: 77 }), '77');
});

test('R29 תפוסה: אותם תנאים והודעות כמו ItemCapacityModal; טווח של חודש לפני ואחרי', () => {
  for (const msg of ['לא הוגדר תאריך אירוע להזמנה זו.', 'לא ניתן לבדוק תפוסה לפריט ללא דגם (פריט כללי).', 'לא ניתן לבדוק תפוסה לפריט ללא מידה מוגדרת.']) assert.ok(CAP_SRC.includes(msg), msg);
  assert.equal(A.capacityPrecheck(it(), {}), 'לא הוגדר תאריך אירוע להזמנה זו.');
  assert.equal(A.capacityPrecheck({ sizeText: '38' }, { eventDate: '2026-10-07' }), 'לא ניתן לבדוק תפוסה לפריט ללא דגם (פריט כללי).');
  assert.equal(A.capacityPrecheck(it({ sizeText: '' }), { eventDate: '2026-10-07' }), 'לא ניתן לבדוק תפוסה לפריט ללא מידה מוגדרת.');
  assert.equal(A.capacityPrecheck(it(), { eventDate: '2026-10-07' }), '');
  // אותו חישוב כמו בישן (setMonth ±1, toISOString().split('T')[0])
  const legacyRange = (ev) => { const e = new Date(ev); const f = new Date(e); f.setMonth(f.getMonth() - 1); const t = new Date(e); t.setMonth(t.getMonth() + 1); return { fromDate: f.toISOString().split('T')[0], toDate: t.toISOString().split('T')[0] }; };
  for (const ev of ['2026-10-07T21:00:00.000Z', '2026-03-31T21:00:00.000Z', '2026-01-31T10:00:00.000Z']) assert.deepEqual(A.capacityRange(ev), legacyRange(ev));
});

test('חיובי פריט (חלון הפרטים) = הסינון של הישן לפי "(פריט #id)", כולל זיכויים', () => {
  const obs = [
    { id: 1, amount: 150, description: 'השכרת שמלה 4512 מידה 38 (פריט #a1)', productName: 'השכרת שמלה 4512 מידה 38 (פריט #a1)' },
    { id: 2, amount: -150, description: 'זיכוי בגין ביטול: 4512 (פריט #a1)' },
    { id: 3, amount: 30, description: 'תיקון שרוול - 4512 (פריט #a1)', isDeleted: true },
    { id: 4, amount: 99, description: 'אחר (פריט #a2)' },
  ];
  const r = A.itemObligations(obs, 'a1');
  assert.deepEqual(r.map((o) => [o.label, o.amount, o.isCredit]), [['השכרת שמלה 4512 מידה 38', 150, false], ['זיכוי / ביטול', -150, true]]);
});

test('A10 מיון הטבלה: לפי דגם (מספרי), מידה, מחיר, עולה/יורד', () => {
  const list = [it({ id: 'x', dressItem: { dress: { name: '10' } }, sizeText: '40', finalPrice: 100 }), it({ id: 'y', dressItem: { dress: { name: '9' } }, sizeText: '36', finalPrice: 300 })];
  assert.deepEqual(A.sortItems(list, { col: 'model', dir: 1 }, {}, 'active').map((i) => i.id), ['y', 'x']);
  assert.deepEqual(A.sortItems(list, { col: 'size', dir: -1 }, {}, 'active').map((i) => i.id), ['x', 'y']);
  assert.deepEqual(A.sortItems(list, { col: 'price', dir: -1 }, {}, 'active').map((i) => i.id), ['y', 'x']);
  assert.deepEqual(A.IT_COLS.map(([, t]) => t), ['דגם', 'מידה', 'סטטוס', 'תיקון', 'מחיר']);
});

test('R25 שדה הברקוד: טקסט לפי מצב (שמירה קודם / השכרה / החזרה / הוחזר / נעול)', () => {
  assert.equal(A.barcodePlaceholder({ _localId: 'L', isNew: true }, false), 'יש לשמור קודם');
  assert.equal(A.barcodePlaceholder(it(), false), 'סרקו ברקוד להשכרה');
  assert.equal(A.barcodePlaceholder(it(), true), 'ההזמנה נעולה');
  assert.equal(A.barcodePlaceholder(it({ isTaken: true }), true), 'סרקו ברקוד להחזרה');
  assert.equal(A.barcodePlaceholder(it({ isTaken: true, isReturned: true }), false), 'הפריט הוחזר');
});

test('ביקורת W3 #4 createScanQueue: סריקה שנייה בזמן שהראשונה רצה לא נזרקת — רצה אחריה לפי הסדר', async () => {
  const seen = [], busy = [];
  let release;
  const gate = new Promise((r) => { release = r; });
  const q = A.createScanQueue(async (code) => { seen.push(`start:${code}`); if (code === 'A') await gate; seen.push(`end:${code}`); }, (b) => busy.push(b));
  const p1 = q.push('A');
  assert.equal(q.isBusy(), true);
  const p2 = q.push(' B ');
  const p3 = q.push('   '); // ריק — מתעלמים
  assert.equal(await p3, false);
  assert.deepEqual(seen, ['start:A'], 'B ממתינה');
  assert.equal(q.pending(), 1);
  release();
  await Promise.all([p1, p2]);
  assert.deepEqual(seen, ['start:A', 'end:A', 'start:B', 'end:B']);
  assert.deepEqual(busy, [true, false], 'busy פעם אחת לכל הרצף');
  assert.equal(q.isBusy(), false);
});
test('createScanQueue: סריקה שזורקת לא עוצרת את התור', async () => {
  const seen = [];
  const origErr = console.error; console.error = () => {};
  try {
    const q = A.createScanQueue(async (c) => { seen.push(c); if (c === 'X') throw new Error('boom'); });
    await Promise.all([q.push('X'), q.push('Y')]);
  } finally { console.error = origErr; }
  assert.deepEqual(seen, ['X', 'Y']);
});

test('ביקורת W3 #8 syncSnapshotItems: אותו fn על פריטי ה-snapshot (השאר לא נוגע); בלי snapshot — כלום', () => {
  const snap = { order: { orderId: 1 }, items: [it(), it({ id: 'a2' })], obligations: [] };
  const patch = (prev) => prev.map((i) => (i.id === 'a1' ? { ...i, isTaken: true, barcode: '4538010' } : i));
  const next = L.syncSnapshotItems(snap, patch);
  assert.equal(next.items[0].isTaken, true);
  assert.equal(next.items[1].isTaken, false);
  assert.equal(next.order, snap.order);
  assert.equal(snap.items[0].isTaken, false, 'לא משנה את המקור');
  assert.equal(L.syncSnapshotItems(null, patch), null);
  // התוצאה: אחרי sync של state+snapshot אין "שינוי שלא נשמר" ברייל
  const state = { order: snap.order, items: patch(snap.items), obligations: [], payments: [] };
  assert.deepEqual(L.changesOf(next, state).filter((c) => /פריט/.test(c.label || c.text || '')), []);
  assert.ok(L.changesOf(snap, state).length > 0, 'בלי הסנכרון — הרייל היה מציג שינוי');
});
