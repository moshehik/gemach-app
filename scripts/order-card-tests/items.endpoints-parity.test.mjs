// W3 — זוגיות endpoints / גופים / החלטות בין פעולות לשונית הפריטים החדשה (hooks/useItemActions.js) לבין הישן:
// ModernItemsManager.js (הפונקציות עצמן מחולצות מהקוד החי ורצות כאן, items.legacy.mjs) ו-rentalToggle.js (מיובא כמו שהוא).
// אותו שרת מדומה לשני הצדדים → אותם URL / method / גוף (מחרוזת JSON זהה) / הודעות / מצב פריט. ההבדלים המכוונים (R31 בלי שער
// "לא שולם", R32 בלי הודעת מכסה, returnedOk אחרי החזרה, אישור דרך oc.approve) נבדקים במפורש ומתועדים ב-W3-NOTES.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mimFunction, mimTopLevel, legacyRentalToggle, fakeServer, withBrowserGlobals, MIM_SRC } from './items.legacy.mjs';

const P = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const A = await P('app/components/order-card/hooks/useItemActions.js');
const L = await P('app/components/order-card/orderCardLogic.js');
const OIW = await P('lib/orderItemEditWindow.js');
const clone = (x) => JSON.parse(JSON.stringify(x));
const ORDER = { orderId: 53375, eventDate: '2026-10-20T21:00:00.000Z', orderDate: '2026-09-23T07:12:00.000Z' };

const dressItem = (id, name, pfx, size) => ({ id: `di-${id}`, dressModelId: `m-${name}`, barcodePrefix: pfx, sizeText: size, dress: { id: `m-${name}`, name, barcodePrefix: pfx } });
const it = (id, over = {}) => ({ id, dressItem: dressItem(id, '4512', 45, '38'), sizeText: '38', price: 150, finalPrice: 150, isDeleted: false, isTaken: false, isReturned: false, returnedOk: false, barcode: null, takenDate: null, returnDate: null, neckAlteration: 0, sleeveAlteration: 0, lengthAlteration: '', alterationDetails: '', alterationDone: false, ...over });

// תסריט שרת: תשובות לפי endpoint (תור לכל אחד); verify-pin תמיד מצליח (גם הישן מאמת את הקוד לפני השליחה החוזרת)
function scriptOf(queues = {}) {
  const q = Object.fromEntries(Object.entries(queues).map(([k, v]) => [k, [...v]]));
  return (url) => {
    if (url === '/api/auth/verify-pin') return { body: { success: true, employeeId: 'm1', employeeName: 'שרה' } };
    const key = Object.keys(q).find((k) => url === k || url.startsWith(k));
    if (!key) return { body: {} };
    const list = q[key];
    return list.length > 1 ? list.shift() : list[0];
  };
}
const nonPin = (calls) => calls.filter((c) => c.url !== '/api/auth/verify-pin').map((c) => `${c.method} ${c.url} ${c.rawBody ?? ''}`);
const pinLevels = (calls) => calls.filter((c) => c.url === '/api/auth/verify-pin').map((c) => c.body.requiredLevel);

// ---------- הצד החדש ----------
function mine({ items, settings = [], isLocked = false, queues, approve = 'ok', chooseIdx = 0, confirm = true, prompt = null, force = new Set() }) {
  const srv = fakeServer(scriptOf(queues));
  const state = { items: clone(items), deletedMarks: [], removed: [], altDone: [], forced: [] };
  const out = { toasts: [], approvals: [], confirms: [], prompts: [], chosen: [], applied: [] };
  const env = {
    fetch: srv.fetch,
    ui: {
      toast: (k, big) => out.toasts.push([k, big]),
      confirm: async (o) => { out.confirms.push(o); return confirm; },
      prompt: async (o) => { out.prompts.push(o); return prompt; },
    },
    approve: async (kind, reason) => { out.approvals.push([kind, reason]); return approve === 'ok' ? { employeeId: 'm1', employeeName: 'שרה', pin: 'pw' } : null; },
    get: () => ({ order: ORDER, items: state.items, settings: L.parseSettings(settings), isLocked, routeId: '53375', forceEditableIds: force, sessionEditableIds: new Set(), priceList: [] }),
    syncItems: (fn) => { state.items = fn(state.items); },
    addLocalItem: (p) => { state.items = [...state.items, p]; return p._localId; },
    removeLocalItem: (id) => { state.removed.push(id); state.items = state.items.filter((x) => x.id || x._localId !== id); },
    markItemDeleted: (id, b) => { state.deletedMarks.push([id, b]); state.items = state.items.map((x) => (x.id === id ? { ...x, isDeleted: b } : x)); },
    setAltDone: (id, b) => state.altDone.push([id, b]),
    applyServerOrder: (o, opts) => out.applied.push([o, opts]),
    markForceEditable: (id) => state.forced.push(id),
    chooseItem: async ({ candidates }) => { out.chosen.push(candidates.map((c) => c.id)); return candidates[chooseIdx] || null; },
    bumpHistory: () => {},
  };
  return { act: A.createItemActions(env), srv, state, out, errors: () => out.toasts.filter(([k]) => k === 'error').map(([, b]) => b) };
}

// ---------- הצד הישן ----------
function legacyEnv({ items, queues, auth = 'ok', confirm = true, prompt = null }) {
  const srv = fakeServer(scriptOf(queues));
  const st = { items: clone(items) };
  const alerts = [];
  const asked = [];
  const win = {
    customAuthPrompt: async (msg, level) => { asked.push(level); return auth === 'ok' ? { pin: 'pw', employeeId: 'm1' } : null; },
    customConfirm: async () => confirm,
    customPrompt: async () => prompt,
  };
  const scope = { window: win, fetch: srv.fetch, alert: (m) => alerts.push(m), onItemsChange: (fn) => { st.items = typeof fn === 'function' ? fn(st.items) : fn; }, console };
  return { srv, st, alerts, win, scope, asked };
}
async function legacyRun(env, fn) { return withBrowserGlobals({ fetch: env.srv.fetch, window: env.win, alert: env.scope.alert }, fn); }

const MISMATCH = { status: 409, body: { barcodeMismatch: true, expected: { prefix: '45', size: '38' }, scanned: { prefix: '45', size: '40' }, error: 'לא תואם' } };
const MISMATCH_REJ = { status: 409, body: { barcodeMismatch: true, overrideRejected: true, expected: { prefix: '45', size: '38' }, scanned: { prefix: '45', size: '40' }, error: 'קוד שגוי לעקיפה' } };
const EARLY = { status: 409, body: { earlyReturn: true, error: 'האירוע עדיין לא הגיע' } };
const OK = { body: { success: true } };

// =============================================================================================
// השכרה / החזרה (handleRent / handleReturn + rentalToggle.js)
// =============================================================================================
const RENT_CASES = [
  ['הצלחה מיידית', [OK], 'ok', '4538010'],
  ['אי-התאמה → אישור מנהל → הצלחה', [MISMATCH, OK], 'ok', '4540010'],
  ['אי-התאמה → עקיפה נדחתה → אישור שוב → הצלחה', [MISMATCH, MISMATCH_REJ, OK], 'ok', '4540010'],
  ['אי-התאמה 4 פעמים → ויתור', [MISMATCH, MISMATCH, MISMATCH, MISMATCH], 'ok', '4540010'],
  ['אי-התאמה → האישור בוטל', [MISMATCH], null, '4540010'],
  ['שגיאת שרת 500', [{ status: 500, body: { error: 'x' } }], 'ok', '4538010'],
  ['השכרה בלי ברקוד (פריט כללי)', [OK], 'ok', null],
];
for (const [name, toggles, auth, barcode] of RENT_CASES) {
  test(`השכרה: ${name} — אותן קריאות, אותה הודעה, אותו מצב פריט`, async () => {
    const items = [it('a1')];
    const queues = { '/api/rentals/toggle': toggles };
    const le = legacyEnv({ items, queues, auth });
    const { postRentalRent } = await legacyRentalToggle();
    const handleRent = mimFunction('handleRent', { ...le.scope, isFullyPaid: true, postRentalRent });
    await legacyRun(le, () => handleRent(items[0], barcode));
    const me = mine({ items, queues, approve: auth });
    await me.act.rentItem(me.state.items[0], barcode);
    assert.deepEqual(nonPin(me.srv.calls), nonPin(le.srv.calls));
    assert.deepEqual(me.out.approvals.map(([k]) => k), le.asked, 'אותה רמת אישור (feature:barcode_mismatch_override)');
    assert.deepEqual(me.errors(), le.alerts);
    const pick = (x) => ({ isTaken: x.isTaken, barcode: x.barcode ?? null, hasTaken: !!x.takenDate });
    assert.deepEqual(pick(me.state.items[0]), pick(le.st.items[0]));
  });
}

const RETURN_CASES = [
  ['הצלחה', [OK], 'ok'],
  ['החזרה מוקדמת → אישור → הצלחה', [EARLY, OK], 'ok'],
  ['החזרה מוקדמת → האישור בוטל', [EARLY], null],
  ['החזרה מוקדמת 4 פעמים', [EARLY, EARLY, EARLY, EARLY], 'ok'],
  ['שגיאת שרת עם הודעה', [{ status: 400, body: { error: 'הפריט לא מושכר' } }], 'ok'],
  ['שגיאת שרת בלי הודעה', [{ status: 500, body: {} }], 'ok'],
];
for (const [name, toggles, auth] of RETURN_CASES) {
  test(`החזרה: ${name} — אותן קריאות, אותה הודעה, אותו מצב פריט`, async () => {
    const items = [it('a1', { isTaken: true, takenDate: '2026-10-01T08:00:00.000Z', barcode: '4538010' })];
    const queues = { '/api/rentals/toggle': toggles };
    const le = legacyEnv({ items, queues, auth });
    const { postRentalReturn } = await legacyRentalToggle();
    const handleReturn = mimFunction('handleReturn', { ...le.scope, isFullyPaid: true, postRentalReturn });
    await legacyRun(le, () => handleReturn(items[0]));
    const me = mine({ items, queues, approve: auth });
    await me.act.returnItem(me.state.items[0]);
    assert.deepEqual(nonPin(me.srv.calls), nonPin(le.srv.calls));
    assert.deepEqual(me.out.approvals.map(([k]) => k), le.asked, 'אותה רמת אישור (feature:early_return_approval)');
    assert.deepEqual(me.errors(), le.alerts);
    const pick = (x) => ({ isReturned: x.isReturned, hasReturn: !!x.returnDate });
    assert.deepEqual(pick(me.state.items[0]), pick(le.st.items[0]));
  });
}

test('החזרה מוצלחת: returnedOk=true כמו בשרת (הישן השאיר את ערך ה-DB הקודם עד טעינה מחדש) — הבדל מכוון', async () => {
  const me = mine({ items: [it('a1', { isTaken: true, returnedOk: false })], queues: { '/api/rentals/toggle': [OK] } });
  await me.act.returnItem(me.state.items[0]);
  assert.equal(me.state.items[0].returnedOk, true);
});

test('R31: אין שער "הזמנה לא שולמה" — השכרה/החזרה לא מבקשות אישור כשלא שולם (בישן: feature:unpaid_action_items_tab)', async () => {
  const items = [it('a1')];
  const le = legacyEnv({ items, queues: { '/api/rentals/toggle': [OK] } });
  const { postRentalRent } = await legacyRentalToggle();
  const handleRent = mimFunction('handleRent', { ...le.scope, isFullyPaid: false, postRentalRent });
  await legacyRun(le, () => handleRent(items[0], '4538010'));
  assert.deepEqual(le.asked, ['feature:unpaid_action_items_tab'], 'הישן (לשם השוואה)');
  const me = mine({ items, queues: { '/api/rentals/toggle': [OK] } });
  await me.act.rentItem(me.state.items[0], '4538010');
  assert.deepEqual(me.out.approvals, []);
  assert.equal(nonPin(me.srv.calls).length, 1);
});

// =============================================================================================
// ביטול השכרה / החזרה, מצב החזרה
// =============================================================================================
for (const [name, fn, item, toggles] of [
  ['ביטול השכרה הצליח', 'handleCancelRent', it('a1', { isTaken: true, takenDate: '2026-10-01T08:00:00.000Z', barcode: '4538010' }), [OK]],
  ['ביטול השכרה נכשל → שחזור', 'handleCancelRent', it('a1', { isTaken: true, takenDate: '2026-10-01T08:00:00.000Z', barcode: '4538010' }), [{ status: 500 }]],
  ['ביטול החזרה הצליח', 'handleCancelReturn', it('a1', { isTaken: true, isReturned: true, returnDate: '2026-10-02T08:00:00.000Z', returnedOk: true }), [OK]],
  ['ביטול החזרה נכשל → שחזור', 'handleCancelReturn', it('a1', { isTaken: true, isReturned: true, returnDate: '2026-10-02T08:00:00.000Z', returnedOk: true }), [{ status: 500 }]],
]) {
  test(`${name} — אותה קריאה, אותה הודעה, אותו מצב`, async () => {
    const queues = { '/api/rentals/toggle': toggles };
    const le = legacyEnv({ items: [item], queues });
    await legacyRun(le, () => mimFunction(fn, le.scope)(item));
    const me = mine({ items: [item], queues });
    await (fn === 'handleCancelRent' ? me.act.cancelRent(me.state.items[0]) : me.act.cancelReturn(me.state.items[0]));
    assert.deepEqual(nonPin(me.srv.calls), nonPin(le.srv.calls));
    assert.deepEqual(me.errors(), le.alerts);
    const pick = (x) => ({ isTaken: x.isTaken, takenDate: x.takenDate ?? null, barcode: x.barcode ?? null, isReturned: x.isReturned, returnDate: x.returnDate ?? null });
    assert.deepEqual(pick(me.state.items[0]), pick(le.st.items[0]));
    assert.equal(me.out.confirms.length, 1, 'אישור לפני הפעולה (חלון האישור של הישן :1144-1197)');
  });
}

test('ביטול השכרה: "לא" בחלון האישור → אין קריאה', async () => {
  const me = mine({ items: [it('a1', { isTaken: true })], queues: {}, confirm: false });
  await me.act.cancelRent(me.state.items[0]);
  assert.equal(me.srv.calls.length, 0);
});

for (const [name, item, ok, note, resp] of [
  ['תקין', it('a1', { isTaken: true, isReturned: true, returnedOk: false }), true, null, OK],
  ['לא תקין עם הערה', it('a1', { isTaken: true, isReturned: true, returnedOk: true }), false, 'כתם בשרוול', OK],
  ['לא תקין בלי הערה', it('a1', { isTaken: true, isReturned: true, returnedOk: true }), false, '', OK],
  ['לא תקין — ביטול החלון', it('a1', { isTaken: true, isReturned: true, returnedOk: true }), false, null, OK],
  ['שגיאה → שחזור', it('a1', { isTaken: true, isReturned: true, returnedOk: true }), false, 'x', { status: 500 }],
  ['אותו מצב → כלום', it('a1', { isTaken: true, isReturned: true, returnedOk: true }), true, null, OK],
  ['פריט שלא הוחזר → כלום', it('a1', { isTaken: true }), false, 'x', OK],
]) {
  test(`R27 מצב החזרה: ${name} — אותה קריאה (toggle / report-issue) ואותו מצב`, async () => {
    const queues = { '/api/rentals/toggle': [resp], '/api/returns/report-issue': [resp] };
    const le = legacyEnv({ items: [item], queues, prompt: note });
    await legacyRun(le, () => mimFunction('handleSetReturnCondition', { ...le.scope, setSavingConditionId: () => {} })(item, ok));
    const me = mine({ items: [item], queues, prompt: note });
    await me.act.setReturnCondition(me.state.items[0], ok);
    assert.deepEqual(nonPin(me.srv.calls), nonPin(le.srv.calls));
    assert.deepEqual(me.errors(), le.alerts);
    assert.equal(me.state.items[0].returnedOk, le.st.items[0].returnedOk);
  });
}

// =============================================================================================
// סריקה (handleBarcodeScan) — ההחלטה (איזה פריט, השכרה/החזרה, איזה ברקוד), הקריאות שלפניה וההודעות
// =============================================================================================
const SCAN_ITEMS = [
  it('a1'),
  it('a2'),
  it('a3', { dressItem: dressItem('a3', '3136', 31, '36'), sizeText: '36', isTaken: true, barcode: '313601', takenDate: '2026-10-01T08:00:00.000Z' }),
  it('a4', { dressItem: dressItem('a4', '2740', 27, '40'), sizeText: '40', isTaken: true, isReturned: true, barcode: '27400101' }),
  it('a5', { dressItem: dressItem('a5', '1893', 18, '42'), sizeText: '42' }),
];
const V = (body, status = 200) => ({ status, body });
const SCAN_CASES = [
  ['ברקוד ששויך לפריט מושכר → החזרה', SCAN_ITEMS, '313601', [V({ valid: true, dressItem: { barcodePrefix: 31, sizeText: '36' } })]],
  ['ברקוד של פריט שכבר הוחזר → הודעה', SCAN_ITEMS, '27400101', [V({ valid: true })]],
  ['קידומת+מידה של פריט יחיד → השכרה עם הברקוד', SCAN_ITEMS, '1842010', [V({ valid: true, dressItem: { barcodePrefix: 18, sizeText: '42' } })]],
  ['שני פריטים זהים → חלון בחירה', SCAN_ITEMS, '4538010', [V({ valid: true, dressItem: { barcodePrefix: 45, sizeText: '38' } })]],
  ['לא נמצא בהזמנה → הודעה עם דגם ומידה', SCAN_ITEMS, '9940010', [V({ valid: true, dressItem: { barcodePrefix: 99, sizeText: '40', dressName: '9940' } })]],
  ['ברקוד לא תקף עם הודעת שרת', SCAN_ITEMS, '1', [V({ valid: false, error: 'ברקוד לא קיים במלאי' }, 404)]],
  ['ברקוד לא תקף בלי הודעה', SCAN_ITEMS, '12', [V({ valid: false })]],
  ['בלי מידע מהשרת → התאמה לפי קידומת ומידה בברקוד', [SCAN_ITEMS[4]], '184201', [V({ valid: true })]],
];
async function legacyScan(items, barcode, queues, { locked = false, confirm = true } = {}) {
  const le = legacyEnv({ items, queues, confirm });
  const decisions = [];
  let choice = null;
  const scope = {
    ...le.scope, locked, isFullyPaid: true, order: ORDER, activeItems: items.filter((i) => !i.isDeleted),
    setItemChoiceModal: (m) => { choice = m.candidates.map((c) => c.id); },
    handleRent: async (item, bc) => decisions.push(['rent', item.id, bc]),
    handleReturn: async (item) => decisions.push(['return', item.id, undefined]),
  };
  await legacyRun(le, () => mimFunction('handleBarcodeScan', scope)(barcode));
  return { le, decisions, choice };
}
async function mineScan(items, barcode, queues, { locked = false, confirm = true } = {}) {
  const me = mine({ items, isLocked: locked, confirm, queues: { ...queues, '/api/rentals/toggle': [OK] } });
  await me.act.scan(barcode);
  const decisions = me.srv.calls.filter((c) => c.url === '/api/rentals/toggle').map((c) => [c.body.action, c.body.itemId, c.body.barcode]);
  const pre = me.srv.calls.filter((c) => c.url !== '/api/rentals/toggle');
  return { me, decisions, pre };
}
for (const [name, items, barcode, verify] of SCAN_CASES) {
  test(`סריקה: ${name}`, async () => {
    const queues = { '/api/rentals/verify-item': verify };
    const L1 = await legacyScan(items, barcode, queues);
    const M = await mineScan(items, barcode, queues);
    assert.deepEqual(nonPin(M.pre), nonPin(L1.le.srv.calls), 'אותן קריאות לפני ההחלטה (verify-item ...)');
    assert.deepEqual(M.me.errors(), L1.le.alerts, 'אותה הודעה');
    if (L1.choice) {
      assert.deepEqual(M.me.out.chosen, [L1.choice], 'אותם מועמדים בחלון הבחירה');
      assert.deepEqual(M.decisions, [['rent', L1.choice[0], barcode]], 'הבחירה → השכרה עם הברקוד (chooseItemForBarcode)');
    } else {
      assert.deepEqual(M.decisions, L1.decisions);
    }
  });
}

for (const [name, confirm, putResp] of [['כן → PUT rentals/scan וממשיך', true, OK], ['לא → עוצר', false, OK], ['כן, ה-PUT נכשל → הודעה', true, { status: 400, body: { error: 'לא ניתן' } }]]) {
  test(`סריקה: שמלה רשומה בהשכרה אחרת — ${name}`, async () => {
    const queues = { '/api/rentals/verify-item': [V({ valid: true, unreturned: true, warning: 'השמלה עדיין מושכרת', unreturnedOrderId: 53311, unreturnedItemId: 'x9', dressItem: { barcodePrefix: 18, sizeText: '42' } })], '/api/rentals/scan': [putResp] };
    const L1 = await legacyScan(SCAN_ITEMS, '1842010', queues, { confirm });
    const M = await mineScan(SCAN_ITEMS, '1842010', queues, { confirm });
    assert.deepEqual(nonPin(M.pre), nonPin(L1.le.srv.calls));
    assert.deepEqual(M.me.errors(), L1.le.alerts);
    assert.deepEqual(M.decisions, L1.decisions);
  });
}

test('ביקורת W3 #5: סריקה של שמלה רשומה בהשכרה אחרת שלא תואמת לשום פריט בהזמנה → אין PUT על ההזמנה האחרת', async () => {
  const verify = V({ valid: true, unreturned: true, warning: 'השמלה עדיין מושכרת', unreturnedOrderId: 53311, unreturnedItemId: 'x9', dressItem: { barcodePrefix: 99, sizeText: '40', dressName: '9940' } });
  const M = await mineScan(SCAN_ITEMS, '9940010', { '/api/rentals/verify-item': [verify], '/api/rentals/scan': [OK] });
  assert.deepEqual(M.me.srv.calls.map((c) => `${c.method} ${c.url}`), ['POST /api/rentals/verify-item'], 'רק verify-item; בלי PUT ובלי toggle');
  assert.equal(M.me.errors().length, 1);
  assert.match(M.me.errors()[0], /לא נמצא בין הפריטים/);
});
test('ביקורת W3 #5: כשיש התאמה — ה-PUT נשלח מיד לפני השכרת הפריט כאן; בבחירה בין פריטים זהים — רק אחרי הבחירה', async () => {
  const verify = (pfx, size) => V({ valid: true, unreturned: true, warning: 'w', unreturnedOrderId: 53311, unreturnedItemId: 'x9', dressItem: { barcodePrefix: pfx, sizeText: size } });
  const M = await mineScan(SCAN_ITEMS, '1842010', { '/api/rentals/verify-item': [verify(18, '42')], '/api/rentals/scan': [OK] });
  assert.deepEqual(M.me.srv.calls.map((c) => `${c.method} ${c.url}`), ['POST /api/rentals/verify-item', 'PUT /api/rentals/scan', 'POST /api/rentals/toggle']);
  assert.deepEqual(M.me.srv.calls[1].body, { unreturnedItemId: 'x9' });
  // שני פריטים זהים: המשתמש מבטל את הבחירה → בלי PUT
  const me = mine({ items: SCAN_ITEMS, chooseIdx: 99, queues: { '/api/rentals/verify-item': [verify(45, '38')], '/api/rentals/scan': [OK], '/api/rentals/toggle': [OK] } });
  const r = await me.act.scan('4538010');
  assert.equal(r.cancelled, true);
  assert.deepEqual(me.srv.calls.map((c) => c.url), ['/api/rentals/verify-item']);
});

test('סריקה בהזמנה נעולה: השכרה נחסמת (אותה הודעה, בלי קריאות); החזרה של פריט מושכר מותרת', async () => {
  const L1 = await legacyScan(SCAN_ITEMS, '1842010', {}, { locked: true });
  const M = await mineScan(SCAN_ITEMS, '1842010', {}, { locked: true });
  assert.deepEqual(M.me.errors(), L1.le.alerts);
  assert.equal(M.me.srv.calls.length, 0);
  const q = { '/api/rentals/verify-item': [V({ valid: true })] };
  const L2 = await legacyScan(SCAN_ITEMS, '313601', q, { locked: true });
  const M2 = await mineScan(SCAN_ITEMS, '313601', q, { locked: true });
  assert.deepEqual(M2.decisions, L2.decisions);
  assert.deepEqual(M2.decisions, [['return', 'a3', undefined]]);
});

test('סריקה: verify-item נופל ברשת → ממשיך בלי מידע מהשרת (כמו הישן)', async () => {
  const items = [SCAN_ITEMS[4]];
  const run = async (side) => {
    const srv = fakeServer(() => ({ body: {} }));
    const thrower = async (url, o) => { if (url === '/api/rentals/verify-item') throw new Error('net'); return srv.fetch(url, o); };
    if (side === 'legacy') {
      const le = legacyEnv({ items, queues: {} });
      const decisions = [];
      const scope = { ...le.scope, fetch: thrower, locked: false, isFullyPaid: true, order: ORDER, activeItems: items, setItemChoiceModal: () => {}, handleRent: async (i, bc) => decisions.push(['rent', i.id, bc]), handleReturn: async (i) => decisions.push(['return', i.id, undefined]), console: { error: () => {} } };
      await mimFunction('handleBarcodeScan', scope)('184201');
      return decisions;
    }
    const origErr = console.error; console.error = () => {};
    try {
      const calls = [];
      const act = A.createItemActions({ fetch: async (u, o) => { calls.push([u, o && o.body ? JSON.parse(o.body) : null]); return thrower(u, o); }, ui: { toast: () => {}, confirm: async () => true }, approve: async () => null, get: () => ({ order: ORDER, items, settings: L.parseSettings([]), isLocked: false }), syncItems: () => {}, chooseItem: async () => null });
      await act.scan('184201');
      return calls.filter(([u]) => u === '/api/rentals/toggle').map(([, b]) => [b.action, b.itemId, b.barcode]);
    } finally { console.error = origErr; }
  };
  assert.deepEqual(await run('mine'), await run('legacy'));
});

test('סריקה: פריט שטרם נשמר (בלי id) לא מועמד — הבדל מכוון (בישן הסימון האופטימי נגע בכל השורות בלי id, בלי קריאה לשרת)', async () => {
  const items = [{ _localId: 'L1', isNew: true, dressModelId: 'm-1893', barcodePrefix: 18, sizeText: '42', isDeleted: false }];
  const M = await mineScan(items, '1842010', { '/api/rentals/verify-item': [V({ valid: true, dressItem: { barcodePrefix: 18, sizeText: '42' } })] });
  assert.deepEqual(M.decisions, []);
  assert.equal(M.me.errors().length, 1);
});

// =============================================================================================
// שדה הברקוד בשורת הפריט (R25)
// =============================================================================================
test('R25 שורת הברקוד: פריט ממתין → השכרה עם הברקוד שהוזן (= "השכרה" + "הזנת ברקוד ידנית" של הישן)', async () => {
  const items = [it('a1')];
  const le = legacyEnv({ items, queues: { '/api/rentals/toggle': [OK] } });
  const { postRentalRent } = await legacyRentalToggle();
  await legacyRun(le, () => mimFunction('handleRent', { ...le.scope, isFullyPaid: true, postRentalRent })(items[0], '4538010'));
  const me = mine({ items, queues: { '/api/rentals/toggle': [OK] } });
  await me.act.barcodeForItem(me.state.items[0], ' 4538010 ');
  assert.deepEqual(nonPin(me.srv.calls), nonPin(le.srv.calls));
});
test('R25 שורת הברקוד: פריט מושכר → החזרה רק עם הברקוד שלו; ברקוד אחר → הודעה בלי קריאה', async () => {
  const me = mine({ items: [it('a1', { isTaken: true, barcode: '4538010' })], queues: { '/api/rentals/toggle': [OK] } });
  await me.act.barcodeForItem(me.state.items[0], '4538099');
  assert.equal(me.srv.calls.length, 0);
  assert.equal(me.errors().length, 1);
  await me.act.barcodeForItem(me.state.items[0], '4538010');
  assert.deepEqual(nonPin(me.srv.calls), ['POST /api/rentals/toggle {"itemId":"a1","action":"return"}']);
});
test('R25 (ביקורת #1): Enter בשדה ברקוד ריק על פריט מושכר שיש לו ברקוד → הודעה, בלי החזרה', async () => {
  const me = mine({ items: [it('a1', { isTaken: true, barcode: '4538010' })], queues: { '/api/rentals/toggle': [OK] } });
  for (const empty of ['', '   ', null, undefined]) {
    const r = await me.act.barcodeForItem(me.state.items[0], empty);
    assert.equal(r.ok, false);
  }
  assert.equal(me.srv.calls.length, 0, 'אין קריאה לשרת');
  assert.equal(me.errors().length, 4);
  assert.equal(me.errors()[0], 'יש לסרוק את ברקוד הפריט');
  assert.equal(me.state.items[0].isReturned, false);
  // פריט מושכר שלא נרשם לו ברקוד (כללי) — עדיין מחזירים בלי ברקוד
  const me2 = mine({ items: [it('a2', { isTaken: true, barcode: null })], queues: { '/api/rentals/toggle': [OK] } });
  await me2.act.barcodeForItem(me2.state.items[0], '');
  assert.deepEqual(nonPin(me2.srv.calls), ['POST /api/rentals/toggle {"itemId":"a2","action":"return"}']);
});
test('R25: בהזמנה נעולה שדה הברקוד לא משכיר (הודעת הנעילה של הישן)', async () => {
  const me = mine({ items: [it('a1')], isLocked: true, queues: {} });
  await me.act.barcodeForItem(me.state.items[0], '4538010');
  assert.equal(me.srv.calls.length, 0);
  assert.match(me.errors()[0], /ההזמנה נעולה/);
});

// =============================================================================================
// אישור פריט: POST (חדש) / PUT (קיים) — handleConfirmItem
// =============================================================================================
const SERVER_ORDER = { orderId: 53375, items: [], obligations: [], payments: [] };
const newLocal = (over = {}) => ({ isNew: true, _localId: 'L1', description: '4512', sizeText: '38', neckAlteration: 0, sleeveAlteration: 0, lengthAlteration: '', alterationDetails: '', alterationDone: false, finalPrice: 0, isDeleted: false, createdAt: '2026-10-04T08:00:00.000Z', dressModelId: 'm-4512', barcodePrefix: 45, ...over });
const CONFIRM_CASES = [
  ['פריט חדש → POST', newLocal(), [], 'ok', new Set(), [{ body: SERVER_ORDER }]],
  ['פריט חדש + require_manager_code → אישור feature:item_change_approval → managerEmployeeId/managerPin', newLocal(), [['require_manager_code_for_item_changes', 'true']], 'ok', new Set(), [{ body: SERVER_ORDER }]],
  ['פריט חדש + require_manager_code → האישור בוטל → אין POST', newLocal(), [['require_manager_code_for_item_changes', 'true']], null, new Set(), [{ body: SERVER_ORDER }]],
  ['פריט קיים → PUT', { ...it('a1'), isEditing: true, sizeText: '40' }, [['require_manager_code_for_item_changes', 'true']], 'ok', new Set(), [{ body: SERVER_ORDER }]],
  ['פריט קיים שנפתח לעריכה מלאה → forceFullEdit', { ...it('a1'), isEditing: true, sizeText: '40' }, [], 'ok', new Set(['a1']), [{ body: SERVER_ORDER }]],
  ['בלי מידה → הודעה, בלי קריאה', newLocal({ sizeText: '' }), [], 'ok', new Set(), [{ body: SERVER_ORDER }]],
  ['תיקון בלי פירוט (תיקונים פעילים כשהמפתח חסר) → הודעה', newLocal({ sleeveAlteration: 1 }), [], 'ok', new Set(), [{ body: SERVER_ORDER }]],
  ['תיקון בלי פירוט כש-enable_alterations=false → נשלח', newLocal({ sleeveAlteration: 1 }), [['enable_alterations', 'false']], 'ok', new Set(), [{ body: SERVER_ORDER }]],
  ['תיקון עם פירוט → נשלח', newLocal({ neckAlteration: 1, lengthAlteration: '3', alterationDetails: 'קיצור' }), [], 'ok', new Set(), [{ body: SERVER_ORDER }]],
  ['שגיאת שרת → הודעת השרת', { ...it('a1'), isEditing: true }, [], 'ok', new Set(), [{ status: 400, body: { error: 'המידה לא זמינה' } }]],
];
for (const [name, item, settingsRows, auth, force, resp] of CONFIRM_CASES) {
  test(`אישור פריט: ${name}`, async () => {
    const queues = { '/api/orders/53375/items': resp };
    const raw = Object.fromEntries(settingsRows);
    const le = legacyEnv({ items: [item], queues, auth });
    const updated = [];
    const handleConfirmItem = mimFunction('handleConfirmItem', {
      ...le.scope, items: [item], enableAlterations: raw.enable_alterations !== 'false', settings: raw, setSavingItemIndex: () => {},
      orderId: 53375, forceEditableIds: force, onOrderUpdated: (d, o) => updated.push([d, o]),
    });
    await legacyRun(le, () => handleConfirmItem(0));
    const me = mine({ items: [item], settings: settingsRows.map(([key, value]) => ({ key, value })), approve: auth, queues, force });
    await me.act.confirmItem(me.state.items[0]);
    assert.deepEqual(nonPin(me.srv.calls), nonPin(le.srv.calls), 'אותו URL / method / גוף (מחרוזת JSON זהה)');
    assert.deepEqual(me.out.approvals.map(([k]) => k), le.asked);
    assert.deepEqual(me.errors(), le.alerts);
    assert.deepEqual(me.out.applied, updated, 'applyServerOrder(data, {savedLocalId}) = onOrderUpdated של הישן');
  });
}

test('הוספה מחלונית "הוספת שמלה": שורה מקומית דרך oc.edit ואז אותו POST כמו "אישור" של שורה חדשה בישן', async () => {
  const model = { id: 'm-4512', name: '4512', barcodePrefix: 45 };
  // הישן: handleAddItem → handleModelChange → בחירת מידה → handleConfirmItem
  const le = legacyEnv({ items: [], queues: { '/api/orders/53375/items': [{ body: SERVER_ORDER }] } });
  const legacyItems = { list: [] };
  const onItemsChange = (fn) => { legacyItems.list = typeof fn === 'function' ? fn(legacyItems.list) : fn; };
  mimFunction('handleAddItem', { locked: false, settings: {}, items: [], alert: () => {}, onItemsChange, listEndRef: { current: null }, setTimeout: () => {}, crypto: { randomUUID: () => 'L1' }, Date })();
  mimFunction('handleModelChange', { onItemsChange })(0, model);
  mimFunction('handleItemChange', { onItemsChange })(0, 'sizeText', '38');
  const legacyNew = legacyItems.list[0];
  const updated = [];
  await legacyRun(le, () => mimFunction('handleConfirmItem', { ...le.scope, items: legacyItems.list, enableAlterations: true, settings: {}, setSavingItemIndex: () => {}, orderId: 53375, forceEditableIds: new Set(), onOrderUpdated: (d, o) => updated.push([d, o]) })(0));
  const me = mine({ items: [], queues: { '/api/orders/53375/items': [{ body: SERVER_ORDER }] } });
  const r = await me.act.addItem({ model, sizeText: '38' });
  assert.equal(r.ok, true);
  const lb = le.srv.calls[0].body, mb = me.srv.calls[0].body;
  assert.deepEqual(Object.keys(mb), Object.keys(lb), 'אותם שדות באותו סדר');
  const strip = (b) => ({ ...b, _localId: '-', createdAt: '-' });
  assert.deepEqual(strip(mb), strip(lb));
  assert.equal(me.srv.calls[0].url, le.srv.calls[0].url);
  assert.equal(me.state.items.length, 1, 'השורה נוספה דרך addLocalItem');
  assert.deepEqual(me.out.applied[0][1], { savedLocalId: mb._localId });
  void legacyNew;
});

// ביקורת W3 #2: הוספה שנדחתה/נכשלה בכלל עסקי לא משאירה שורה "רפאים" (בגללה ה-PUT של ההזמנה היה מקבל 403 על hasNewAdd)
test('הוספה: אישור המנהל נדחה → אין POST והשורה המקומית מוסרת', async () => {
  const me = mine({ items: [], settings: [{ key: 'require_manager_code_for_item_changes', value: 'true' }], approve: null, queues: { '/api/orders/53375/items': [{ body: SERVER_ORDER }] } });
  const r = await me.act.addItem({ model: { id: 'm-4512', name: '4512', barcodePrefix: 45 }, sizeText: '38' });
  assert.equal(r.ok, false);
  assert.equal(r.cancelled, true);
  assert.equal(me.srv.calls.length, 0);
  assert.equal(me.state.items.length, 0, 'אין שורה רפאים');
  assert.equal(me.state.removed.length, 1);
});
test('הוספה: שרת דוחה בכלל עסקי (4xx) → השורה מוסרת; שגיאת רשת/5xx → השורה נשארת לניסיון חוזר', async () => {
  const model = { id: 'm-4512', name: '4512', barcodePrefix: 45 };
  const rej = mine({ items: [], queues: { '/api/orders/53375/items': [{ status: 400, body: { error: 'המידה לא זמינה' } }] } });
  const r = await rej.act.addItem({ model, sizeText: '38' });
  assert.equal(r.ok, false);
  assert.equal(rej.state.items.length, 0);
  assert.deepEqual(rej.errors(), ['המידה לא זמינה']);
  const srv500 = mine({ items: [], queues: { '/api/orders/53375/items': [{ status: 500, body: { error: 'תקלה' } }] } });
  await srv500.act.addItem({ model, sizeText: '38' });
  assert.equal(srv500.state.items.length, 1, 'ניסיון חוזר דרך "אישור" בשורה');
});

// ביקורת W3 #3: לחיצה כפולה על "אישור" = POST אחד
test('אישור שורה חדשה בלחיצה כפולה: POST אחד בלבד; אחרי שהסתיים אפשר שוב', async () => {
  const me = mine({ items: [newLocal()], queues: { '/api/orders/53375/items': [{ status: 500, body: { error: 'x' } }] } });
  const item = me.state.items[0];
  const [a, b] = await Promise.all([me.act.confirmItem(item), me.act.confirmItem(item)]);
  assert.equal(me.srv.calls.length, 1);
  assert.equal(b.busy, true);
  assert.equal(a.ok, false);
  await me.act.confirmItem(item);
  assert.equal(me.srv.calls.length, 2, 'המפתח משתחרר בסיום (ניסיון חוזר אחרי כשל)');
});
test('אישור שורה חדשה: לחיצה כפולה גם בזמן שחלון אישור המנהל פתוח → אישור אחד', async () => {
  const me = mine({ items: [newLocal()], settings: [{ key: 'require_manager_code_for_item_changes', value: 'true' }], queues: { '/api/orders/53375/items': [{ body: SERVER_ORDER }] } });
  await Promise.all([me.act.confirmItem(me.state.items[0]), me.act.confirmItem(me.state.items[0])]);
  assert.equal(me.out.approvals.length, 1);
  assert.equal(me.srv.calls.length, 1);
});

test('R32 הוספה כשהמכסה מלאה: בלי הודעה ובלי שורה (בישן: alert "הגבלת מערכת")', async () => {
  const me = mine({ items: [it('a1'), it('a2')], settings: [{ key: 'max_items_per_order', value: '2' }], queues: {} });
  const r = await me.act.addItem({ model: { id: 'm', name: 'x' }, sizeText: '38' });
  assert.equal(r.ok, false);
  assert.deepEqual(me.out.toasts, []);
  assert.equal(me.state.items.length, 2);
  assert.ok(/הגבלת מערכת: לא ניתן להוסיף/.test(MIM_SRC), 'הישן (לשם השוואה)');
});

// =============================================================================================
// מחיקה / שחזור (toggleDeleted), טיוטת עריכה, פריט חדש, עזרים
// =============================================================================================
for (const [name, item, settingsRows, items] of [
  ['מחיקת פריט', it('a1'), [], [it('a1')]],
  ['מחיקת פריט שנלקח → הודעה', it('a1', { isTaken: true }), [], [it('a1', { isTaken: true })]],
  ['שחזור פריט', it('a1', { isDeleted: true }), [], [it('a1', { isDeleted: true })]],
]) {
  test(`מחיקה/שחזור: ${name} — אותה תוצאה ואותה הודעה`, async () => {
    const changes = [];
    const alerts = [];
    const legacyToggle = mimFunction('toggleDeleted', { items, alert: (m) => alerts.push(m), settings: Object.fromEntries(settingsRows), window: { customConfirm: async () => true }, handleItemChange: (i, f, v) => changes.push([items[i].id, f, v]) });
    await legacyToggle(0);
    const me = mine({ items, settings: settingsRows.map(([key, value]) => ({ key, value })), queues: {} });
    await me.act.toggleDeleted(me.state.items[0]);
    assert.deepEqual(me.state.deletedMarks, changes.map(([id, , v]) => [id, v]));
    assert.deepEqual(me.errors(), alerts);
  });
}
test('R32 שחזור כשהמכסה מלאה: בלי הודעה ובלי שינוי (הישן: alert)', async () => {
  const items = [it('a1'), it('a2', { isDeleted: true })];
  const alerts = [];
  await mimFunction('toggleDeleted', { items, alert: (m) => alerts.push(m), settings: { max_items_per_order: '1' }, window: { customConfirm: async () => true }, handleItemChange: () => {} })(1);
  assert.equal(alerts.length, 1, 'הישן מציג הודעה');
  const me = mine({ items, settings: [{ key: 'max_items_per_order', value: '1' }], queues: {} });
  await me.act.toggleDeleted(me.state.items[1]);
  assert.deepEqual(me.state.deletedMarks, []);
  assert.deepEqual(me.out.toasts, []);
});
test('מחיקת שורה שטרם נשמרה = הסרתה (cancelNewItem)', async () => {
  const me = mine({ items: [newLocal()], queues: {} });
  await me.act.toggleDeleted(me.state.items[0]);
  assert.deepEqual(me.state.removed, ['L1']);
});

test('טיוטת עריכה (editDraftOf) = handleEditItem של הישן; itemName/itemCode זהים', () => {
  const items = [it('a1', { description: '4512 (קוד: 45) - שמלה', dressModelId: undefined }), it('a2', { dressItem: { ...dressItem('a2', 'ללא שם 7', 77, '40') }, sizeText: '' })];
  const itemCode = mimFunction('itemCode', {});
  const itemName = mimFunction('itemName', { itemCode });
  for (let k = 0; k < items.length; k++) {
    let out = null;
    mimFunction('handleEditItem', { items, alert: () => {}, itemName, onItemsChange: (fn) => { out = fn(items)[k]; } })(k);
    assert.deepEqual(A.editDraftOf(items[k]), out);
    assert.equal(A.itemName(items[k]), itemName(items[k]));
    assert.equal(A.itemCode(items[k]), itemCode(items[k]));
  }
});

test('פריט חדש (newItemOf) = handleAddItem + handleModelChange + מידה של הישן (אותם שדות באותו סדר)', () => {
  const list = { v: [] };
  const onItemsChange = (fn) => { list.v = typeof fn === 'function' ? fn(list.v) : fn; };
  mimFunction('handleAddItem', { locked: false, settings: {}, items: [], alert: () => {}, onItemsChange, listEndRef: { current: null }, setTimeout: () => {}, crypto: { randomUUID: () => 'L9' }, Date })();
  mimFunction('handleModelChange', { onItemsChange })(0, { id: 'm1', name: '4512', barcodePrefix: 45 });
  mimFunction('handleItemChange', { onItemsChange })(0, 'sizeText', '38');
  const legacy = list.v[0];
  const mineItem = A.newItemOf({ model: { id: 'm1', name: '4512', barcodePrefix: 45 }, sizeText: '38' }, 'L9', legacy.createdAt);
  assert.deepEqual(Object.keys(mineItem), Object.keys(legacy));
  assert.deepEqual(mineItem, legacy);
});

test('canFullyEditItem / evaluateSizeSwap = הישן', () => {
  const sessionEditableIds = new Set(['a1']);
  const forceEditableIds = new Set(['a3']);
  const legacyCan = mimFunction('canFullyEditItem', { sessionEditableIds, forceEditableIds });
  const cases = [it('a1'), it('a2'), it('a3'), it('a4', { isTaken: true }), it('a5', { isTaken: true, isReturned: true }), { ...newLocal(), id: undefined }, null];
  for (const c of cases) assert.equal(A.canFullyEditItem(c, { sessionEditableIds, forceEditableIds }), legacyCan(c));
  const priceList = [{ category: 'A', fromSize: 34, toSize: 40, price: 150 }, { category: 'A', fromSize: 42, toSize: 50, price: 180 }];
  const withCat = (o) => ({ ...o, dressItem: { ...o.dressItem, dress: { ...o.dressItem.dress, priceCategory: 'A' } } });
  for (const sizeEditDays of [null, 3, 400]) {
    const legacySwap = mimFunction('evaluateSizeSwap', { sizeEditDays, priceList, order: ORDER, evaluateSizeOnlyEdit: OIW.evaluateSizeOnlyEdit, gapRule: 'none' });
    for (const c of [withCat(it('a1')), withCat(it('a2', { isTaken: true })), withCat({ ...it('a3'), originalState: { sizeText: '36' } })]) {
      for (const size of [undefined, '40', '44']) {
        assert.deepEqual(A.evaluateSizeSwap(c, size, { sizeEditDays, priceList, gapRule: 'none', eventDate: ORDER.eventDate }), legacySwap(c, size), `${sizeEditDays}/${c.id}/${size}`);
      }
    }
  }
});

test('dedupeAuditLogs = הישן', () => {
  const { dedupeAuditLogs } = mimTopLevel();
  const t = (s) => `2026-10-04T08:00:${String(s).padStart(2, '0')}.000Z`;
  const logs = [
    { action: 'CREATE', changesJson: '{"a":1}', createdAt: t(0) }, { action: 'CREATE', changesJson: '{"a":1}', createdAt: t(1) },
    { action: 'UPDATE', changesJson: '{"sizeText":"40"}', createdAt: t(10) }, { action: 'UPDATE', changesJson: '{"sizeText":{"from":"38","to":"40"}}', createdAt: t(11) },
    { action: 'CONFIRM_RENTAL', changesJson: { x: 1 }, createdAt: t(30) }, { action: 'UPDATE', changesJson: 'not json', createdAt: t(50) },
  ];
  assert.deepEqual(A.dedupeAuditLogs(logs), dedupeAuditLogs(logs));
});

test('פתיחת עריכה מלאה: אישור feature:item_edit_reopen (כמו הישן) → הפריט נפתח; ביטול → לא', async () => {
  assert.ok(MIM_SRC.includes("'feature:item_edit_reopen'"));
  const me = mine({ items: [it('a1')], queues: {} });
  assert.equal(await me.act.reopenFullEdit(me.state.items[0]), true);
  assert.deepEqual(me.out.approvals.map(([k]) => k), ['feature:item_edit_reopen']);
  assert.deepEqual(me.state.forced, ['a1']);
  const me2 = mine({ items: [it('a1')], queues: {}, approve: null });
  assert.equal(await me2.act.reopenFullEdit(me2.state.items[0]), false);
  assert.deepEqual(me2.state.forced, []);
});
