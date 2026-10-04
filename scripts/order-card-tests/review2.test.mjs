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

// ---------- harness לזרימות (כמו neve.exit.test.mjs) ----------
const P2 = (rel) => import(pathToFileURL(P + '/' + rel).href);
const { createOrderCardFlows } = await P2('app/components/order-card/orderCardFlows.js');
const snapOf = (x) => JSON.parse(JSON.stringify(x));
const DIALOGS = { ConflictDialog: 'Conflict', StockDialog: 'Stock', SummaryDialog: 'Summary', ExitDialog: 'Exit', DiscardDialog: 'Discard' };
function harness(st, { settings = [], respond = () => ({}), answers = {}, edit = null, uiOver = {} } = {}) {
  const state = { ...snapOf(st), snapshot: snapOf(st), openedDebt: L.openedDebtOf(st.obligations, st.payments), settings: L.parseSettings(settings), debtApproved: false };
  if (edit) edit(state);
  const calls = [], opened = [], toasts = [], events = [];
  const flags = { pendingDebtBlock: false, bankPromptedOnExit: false, approvedDebtLevel: null };
  const setter = (k) => (v) => { state[k] = typeof v === 'function' ? v(state[k]) : v; };
  const ui = {
    confirm: async () => true, prompt: async () => null, alert: async (o) => { opened.push(['alert', o]); }, toast: (...a) => toasts.push(a),
    openDialog: async (C, p) => { opened.push([C, p]); return answers[C] ?? null; }, ...uiOver,
  };
  const env = {
    fetch: async (url, opts = {}) => {
      calls.push({ url, method: opts.method || 'GET', body: opts.body !== undefined ? JSON.parse(opts.body) : undefined });
      const r = respond(url, opts, calls.length) || {};
      return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200, headers: { 'Content-Type': 'application/json' } });
    },
    ui, dialogs: DIALOGS, routeId: '53375', get: () => state,
    set: { order: setter('order'), items: setter('items'), obligations: setter('obligations'), payments: setter('payments'), refunds: setter('refunds'), tab: setter('tab'), saving: setter('saving') },
    setSnapshot: (s) => { state.snapshot = s; }, setOpenedDebt: (n) => { state.openedDebt = n; }, setDebtApproved: (v) => { state.debtApproved = v; },
    flags, approve: async () => null, navigate: () => {}, emit: (type, payload) => { events.push([type, payload]); return 0; }, bumpHistory: () => {}, clearRedo: () => {},
  };
  return { flows: createOrderCardFlows(env), state, calls, opened, toasts, events, flags };
}

// ---------- C7: מחיקה מקומית של חיוב ידני שורדת שמירה שבוטלה אחרי חלון הסיכום ----------
test('C7: חיוב ידני שנמחק מקומית נשאר (isDeleted) ב-state אחרי שמירה שבוטלה בהתנגשות, והסכום בסיכום לא כולל אותו', async () => {
  const manual = { id: 'm1', orderId: 53375, amount: 70, description: 'חיוב ידני', isManual: true, isDeleted: false };
  const st = baseState({ obligations: [obligation('ob1'), obligation('ob2', { orderItemId: 'a2' }), manual] });
  const respond = (u, o) => {
    if (u.includes('validate-inventory')) return { body: { valid: true } };
    if (u.includes('preview-pricing')) return { body: { newObligations: [obligation('x1', { id: undefined }), obligation('x2', { id: undefined, orderItemId: 'a2' })] } };
    if (o.method === 'PUT') return { status: 409, body: { code: 'CONFLICT', message: 'x' } };
    return {};
  };
  const h = harness(st, { settings: [{ key: 'enable_order_edit_summary_confirm', value: 'true' }], respond, answers: { Summary: true, Conflict: 'cancel' }, edit: (s) => { s.obligations = s.obligations.map(o => (o.id === 'm1' ? { ...o, isDeleted: true } : o)); } });
  const r = await h.flows.save();
  assert.equal(r.ok, false);
  const kept = h.state.obligations.find(o => o.id === 'm1');
  assert.ok(kept && kept.isDeleted === true, 'המחיקה לא אבדה');
  const sumArgs = h.opened.find(([c]) => c === 'Summary')[1];
  assert.equal(sumArgs.totalRequired, 300, 'הסכום בלי החיוב שנמחק');
  assert.ok(L.changesOf(h.state.snapshot, h.state).some(c => c.key === 'obl:m1'), 'עדיין "בוטל חיוב" ברייל');
});

test('C7: חתימה - לחיצה כפולה פותחת חלון אישור אחד בלבד', async () => {
  let confirms = 0; let release;
  const gate = new Promise((r) => { release = r; });
  const h = harness(baseState(), { respond: () => ({ body: {} }), uiOver: { confirm: async () => { confirms++; await gate; return false; } } });
  const a = h.flows.toggleSignature(); const b = h.flows.toggleSignature();
  release();
  assert.equal(await b, false);
  await a;
  assert.equal(confirms, 1);
  assert.equal(h.calls.length, 0);
});
