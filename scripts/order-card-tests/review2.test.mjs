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

// ---------- C2: הוספה/עריכת פריט עם שינויים שלא נשמרו - "לשמור קודם?" ----------
const IA = await P2('app/components/order-card/hooks/useItemActions.js');
function itemEnv({ ensure, items = [item('a1')] }) {
  const calls = [], local = [], applied = [], ensured = [];
  const order = { orderId: 53375, eventDate: '2026-10-20T21:00:00.000Z' };
  const env = {
    fetch: async (u, o = {}) => { calls.push([o.method || 'GET', u]); return new Response(JSON.stringify({ ...order, items }), { status: 200, headers: { 'Content-Type': 'application/json' } }); },
    ui: { toast: () => {}, confirm: async () => true }, approve: async () => null,
    get: () => ({ order, items, settings: L.parseSettings([]), isLocked: false, routeId: '53375', forceEditableIds: new Set(), sessionEditableIds: new Set(), priceList: [] }),
    syncItems: () => {}, addLocalItem: (p) => { local.push(p); return p._localId; }, removeLocalItem: () => {}, markItemDeleted: () => {}, setAltDone: () => {},
    applyServerOrder: (o) => applied.push(o), markForceEditable: () => {}, chooseItem: async () => null, bumpHistory: () => {},
    ensureSaved: async (o) => { ensured.push(o); return ensure(o); },
  };
  return { act: IA.createItemActions(env), calls, local, applied, ensured };
}
const DRAFT = { model: { id: 'm-4519', name: '4519' }, sizeText: '38', price: 150 };

test('C2: addItem עם שינויים שלא נשמרו - ביטול בחלון = אין POST ואין שורה מקומית', async () => {
  const e = itemEnv({ ensure: () => ({ ok: false, cancelled: true }) });
  const r = await e.act.addItem(DRAFT);
  assert.equal(r.ok, false);
  assert.equal(e.calls.length, 0); assert.equal(e.local.length, 0); assert.equal(e.applied.length, 0);
  assert.match(e.ensured[0].sub, /לשמור לפני הוספת השמלה/);
  assert.equal(e.ensured[0].okText, 'שמור והוסף');
});
test('C2: addItem אחרי "שמור והוסף" - POST אחד, והשמירה נבדקת לפני שהשורה נוספת', async () => {
  const e = itemEnv({ ensure: () => ({ ok: true, saved: true }) });
  const r = await e.act.addItem(DRAFT);
  assert.equal(r.ok, true);
  assert.deepEqual(e.calls.map(c => c.join(' ')), ['POST /api/orders/53375/items']);
  assert.equal(e.ensured.length, 2, 'לפני הוספת השורה וגם לפני ה-POST (השורה עצמה מתעלמים ממנה)');
  assert.equal(typeof e.ensured[1].ignore, 'function');
  assert.equal(e.ensured[1].ignore({ key: `item:add:${e.local[0]._localId}` }), true);
  assert.equal(e.ensured[1].ignore({ key: 'notes' }), false);
});
test('C2: עריכת פריט שמור עם שינויים שלא נשמרו - ביטול = אין PUT', async () => {
  const e = itemEnv({ ensure: () => ({ ok: false, cancelled: true }) });
  const r = await e.act.confirmItem({ id: 'a1', sizeText: '40', dressItem: { dressModelId: 'm1' }, price: 150 });
  assert.equal(r.ok, false); assert.equal(e.calls.length, 0);
  assert.match(e.ensured[0].sub, /לפני עדכון הפריט/);
});
test('C2 (סטטי): oc.ensureSaved בבקר ושימושו בהוספה/עריכה/חישוב מחדש/זיכוי', () => {
  const ctrl = strip(read('useOrderCardController.js'));
  assert.ok(/const ensureSaved = useCallback/.test(ctrl) && /ensureSaved,\s*\n?\s*orderRef/.test(ctrl));
  assert.ok(/flows\.save\(\{ intent: 'save' \}\)/.test(ctrl) && /cancelText: 'ביטול'/.test(ctrl));
  assert.ok(/ensureSaved: \(o\) => ocRef\.current\.ensureSaved\(o\)/.test(strip(read('hooks/useItemActions.js'))));
  const pay = strip(read('hooks/usePaymentActions.js'));
  assert.equal((pay.match(/ocRef\.current\.ensureSaved\(/g) || []).length, 3, 'חישוב מחדש + בקשת זיכוי + אישור זיכוי');
});

// ---------- C3: תור הסריקות יציב בין רינדורים ----------
test('C3 (סטטי): תור הסריקות נוצר פעם אחת (ref) ו-useItemActions מחזיר אובייקט יציב', () => {
  const bar = strip(read('parts/OcScanBar.js'));
  assert.ok(/queueRef\.current = createScanQueue\(/.test(bar) && !/useMemo\(\(\) => createScanQueue/.test(bar));
  assert.ok(/actionsRef\.current\.scan\(code\)/.test(bar));
  assert.ok(/return useMemo\(\(\) => \(\{ \.\.\.actions, rules, run \}\), \[actions, rules, run\]\)/.test(strip(read('hooks/useItemActions.js'))));
});
test('C3: createScanQueue - סריקה שנייה בזמן שהראשונה רצה ממתינה לה (לפי הסדר)', async () => {
  const IA2 = await P2('app/components/order-card/hooks/useItemActions.js');
  const log = []; let release;
  const gate = new Promise((r) => { release = r; });
  const q = IA2.createScanQueue(async (c) => { log.push('start:' + c); if (c === 'a') await gate; log.push('end:' + c); });
  q.push('a'); q.push('b');
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(log, ['start:a']);
  release();
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(log, ['start:a', 'end:a', 'start:b', 'end:b']);
});

// ---------- C4: מיקוד ----------
test('C4: isFocusableTarget - null / body / מנותק / מנוטרל / מוסתר = חסר', async () => {
  // OcUi.js הוא JSX (לא נטען ב-node) - מחלצים את הפונקציה מהמקור
  const m = read('OcUi.js').match(/export const isFocusableTarget = [\s\S]*?;\r?\n/);
  assert.ok(m, 'isFocusableTarget קיים');
  const body = {}; const doc = globalThis.document;
  globalThis.document = { body };
  try {
    const UI = { isFocusableTarget: new Function('document', `${m[0].replace('export const isFocusableTarget =', 'return')}`)(globalThis.document) };
    const mk = (o) => ({ focus() {}, isConnected: true, disabled: false, hidden: false, getClientRects: () => [1], ...o });
    assert.equal(UI.isFocusableTarget(null), false);
    assert.equal(UI.isFocusableTarget(body), false);
    assert.equal(UI.isFocusableTarget(mk({ isConnected: false })), false);
    assert.equal(UI.isFocusableTarget(mk({ disabled: true })), false);
    assert.equal(UI.isFocusableTarget(mk({ getClientRects: () => [] })), false);
    assert.equal(UI.isFocusableTarget(mk()), true);
  } finally { globalThis.document = doc; }
});

// ---------- C5: לשוניות גוללות בתוך המכל במסך צר (בלי לגעת בקובצי design-system) ----------
test('C5 (סטטי): כלל ה-CSS בהיקף .gm-ds.gm-oc מתחת ל-640px; design-system/components.css לא נערך', () => {
  const css = fs.readFileSync(OC + 'css/oc-base.css', 'utf8');
  assert.ok(/@media \(max-width:639px\)\{\s*\.gm-ds\.gm-oc \.tabs\{overflow-x:auto!important;overflow-y:hidden!important/.test(css));
  assert.ok(/\.gm-ds\.gm-oc \.tabs > \.tab\{flex:none\}/.test(css));
  const ds = fs.readFileSync(P + '/design-system/components.css', 'utf8');
  assert.ok(ds.includes('.gm-ds .tabs{overflow:visible!important;padding-top:10px}'), 'קובץ הפלטה נשאר כמו שהיה');
});

// ---------- C6: נעילה מחדש ----------
test('C6 (סטטי): OcTopbar - לחצן נעילה מחדש אחרי שחרור (isPastEvent && isUnlocked), עם אישור, וקורא ל-oc.relock', () => {
  const src = strip(read('OcTopbar.js'));
  assert.ok(/oc\.flags\.isPastEvent && oc\.flags\.isUnlocked/.test(src));
  assert.ok(/data-act="relockbtn"/.test(src) && /לחצו לנעילה מחדש/.test(src));
  assert.ok(/ui\.confirm\(\{[^}]*נעילה מחדש[^}]*\}\);\s*if \(ok\) oc\.relock\(\)/.test(src));
});

// ---------- S2: extraDay רק כש-enable_rental_extension דלוק ----------
test('S2: resolveExtraDay - כבוי: הוספה/החלפה נדחות, ערך זהה מותר, הסרה מותרת; דלוק: הכל מותר', async () => {
  const G = await P2('lib/extraDayGate.js');
  const off = (requested, current = null) => G.resolveExtraDay({ enabledSetting: 'false', requested, current });
  assert.deepEqual(off('after'), { ok: false, value: null, changed: false });
  assert.deepEqual(off('before', 'after'), { ok: false, value: 'after', changed: false });
  assert.deepEqual(off('after', 'after'), { ok: true, value: 'after', changed: false }, 'הערך השמור נשלח כמו שהוא');
  assert.deepEqual(off(null, 'after'), { ok: true, value: null, changed: true }, 'הסרה מותרת');
  assert.deepEqual(off(undefined, 'after'), { ok: true, value: 'after', changed: false });
  assert.deepEqual(off('garbage'), { ok: true, value: null, changed: false }, 'ערך לא חוקי = null = ללא שינוי');
  for (const s of [undefined, null, '', 'False']) assert.equal(G.resolveExtraDay({ enabledSetting: s, requested: 'after', current: null }).ok, false);
  assert.deepEqual(G.resolveExtraDay({ enabledSetting: 'true', requested: 'after', current: null }), { ok: true, value: 'after', changed: true });
});
test('S2 (סטטי): PUT דוחה 400 EXTRA_DAY_DISABLED ו-preview-pricing מתעלם; מקור ההגדרה = enable_rental_extension', () => {
  const put = fs.readFileSync(P + '/app/api/orders/[id]/route.js', 'utf8');
  assert.ok(/resolveExtraDay\(\{ enabledSetting: \(await getCachedSetting\('enable_rental_extension'\)\)\?\.value, requested: data\.extraDay, current: existingOrder\.extraDay \}\)/.test(put));
  assert.ok(/code: 'EXTRA_DAY_DISABLED' \}, \{ status: 400 \}/.test(put));
  const prev = fs.readFileSync(P + '/app/api/orders/[id]/preview-pricing/route.js', 'utf8');
  assert.ok(/'enable_rental_extension'\s*\];/.test(prev) && /resolveExtraDay\(/.test(prev));
});

// ---------- S3: שערי עמוד בקריאות GET שמחזירות שמות/כתובות ----------
test('S3 (סטטי): deliveries/join ו-dress-location-alerts דורשים page:orders (או page:deliveries / page:board) מעבר להתחברות, 403 אחרת', () => {
  const join = fs.readFileSync(P + '/app/api/deliveries/join/route.js', 'utf8');
  assert.ok(/canOpenAnyPage\(\['page:orders', 'page:deliveries'\]\)/.test(join) && /error: 'Forbidden' \}, \{ status: 403 \}/.test(join));
  assert.ok(join.indexOf('canOpenAnyPage([') < join.indexOf('isDeliveryJoinAvailable()'), 'השער לפני כל שאילתה');
  const dl = fs.readFileSync(P + '/app/api/orders/dress-location-alerts/route.js', 'utf8');
  assert.ok(/canOpenAnyPage\(\['page:orders', 'page:board'\]\)/.test(dl) && /error: 'Forbidden' \}, \{ status: 403 \}/.test(dl));
  assert.ok(dl.indexOf('canOpenAnyPage([') < dl.indexOf('isDressLocationAlertEnabled()'), 'השער לפני כל שאילתה');
});
