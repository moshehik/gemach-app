// סבב סקירה 2 (לקוח + שרת) של הענף המשולב — בדיקות רגרסיה לתיקונים C1-C7 / S1-S6. 3 אזורי זמן (run.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { baseState, item, obligation } from './fixtures.mjs';

const P = process.env.PROJ;
const OC = P + '/app/components/order-card/';
const L = await import(pathToFileURL(OC + 'orderCardLogic.js').href);
const read = (f) => fs.readFileSync(OC + f, 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

// ---------- C1: ביטול שינוי מחיר מחזיר את החיובים האוטומטיים השמורים ----------
test('C1: undo של הסרת פריט אחרי שה-preview החליף את החיובים - הסכומים (נדרש/שולם/זיכוי) חוזרים בדיוק', () => {
  const snap = baseState();
  // preview של הסרת a1: השרת מחזיר רק את החיוב של a2; החיובים האוטומטיים השמורים הוחלפו בשורות isPreview
  const afterPreview = {
    order: snap.order,
    items: [{ ...snap.items[0], isDeleted: true }, snap.items[1]],
    obligations: [{ ...obligation('x', { id: undefined, orderItemId: 'a2', isManual: false }), isPreview: true }],
    payments: snap.payments,
  };
  const tot = (st) => L.computeTotals({ ...st, snapshot: snap, openedDebt: null });
  const before = tot(afterPreview);
  assert.equal(before.required, 150);
  const undone = L.revertChange(afterPreview, snap, 'item:rm:a1');
  assert.deepEqual(undone.obligations.map(o => o.id).sort(), ['ob1', 'ob2']);
  assert.ok(!undone.obligations.some(o => o.isPreview));
  const t = tot(undone);
  assert.equal(t.required, 300); assert.equal(t.paid, 100); assert.equal(t.pendingNet, 0); assert.equal(t.balance, 200);
  assert.deepEqual(L.changesOf(snap, undone), []);
});

test('C1: restoreSavedAutoObligations - בלי שורות preview לא נוגע; ידניות נשמרות; בלי כפילות id', () => {
  const snap = baseState();
  const same = [obligation('ob1'), { id: 'm1', amount: 20, isManual: true }];
  assert.equal(L.restoreSavedAutoObligations(same, snap.obligations), same, 'אותו מערך (אין preview)');
  const withPrev = [{ id: 'm1', amount: 20, isManual: true }, { amount: 99, isPreview: true, isManual: false }, obligation('ob1')];
  const r = L.restoreSavedAutoObligations(withPrev, snap.obligations);
  assert.deepEqual(r.map(o => o.id || 'p'), ['m1', 'ob1', 'ob2']);
});

test('C1: ביטול שינוי מחיר כשעוד שינוי מחיר אחר פעיל - לא מחזיר חיובים (ה-preview עדיין תקף)', () => {
  const snap = baseState();
  const st = { order: { ...snap.order, isDelivery: true }, items: [{ ...snap.items[0], isDeleted: true }, snap.items[1]], obligations: [{ amount: 150, isPreview: true }], payments: snap.payments };
  const u = L.revertChange(st, snap, 'item:rm:a1');
  assert.ok(u.obligations.some(o => o.isPreview), 'ה-preview נשאר עד שהבקר יחשב מחדש');
});

test('C1 (סטטי): הבקר משחזר חיובים שמורים כשה-preview כבוי', () => {
  const ctrl = strip(read('useOrderCardController.js'));
  assert.ok(/restoreSavedAutoObligations\(prev, snapshotRef\.current/.test(ctrl));
});
