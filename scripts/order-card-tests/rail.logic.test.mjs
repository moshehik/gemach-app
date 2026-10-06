// בדיקות הרייל וחלונות השמירה (W5): לוגיקה טהורה (parts/ocRailLogic.js), זוגיות מול קוד המקור החי של הכרטיס הישן (מארכי הליטרלים
// מ-LegacyOrderPage.js - לא העתק ידני), ואורקסטרציית A18 (createRailActions) גם מול הזרימות האמיתיות של W1 (orderCardFlows.js) עם fetch מדומה.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { baseState } from './fixtures.mjs';
import { LEGACY_SRC } from './legacy.mjs';

const P = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const R = await P('app/components/order-card/parts/ocRailLogic.js');
const L = await P('app/components/order-card/orderCardLogic.js');
const { createOrderCardFlows } = await P('app/components/order-card/orderCardFlows.js');
const { summaryModel } = R;
const compile = (params, body) => new Function(...params, body); // eslint-disable-line no-new-func

// ---------------------------------------------------------------------------------------------
// A18: הלחצן הראשי
// ---------------------------------------------------------------------------------------------
test('railPrimary: תשלום / זיכוי / שמור / שלם ₪N / זכה ₪N / אין לחצן (כמו _renderRail בעיצוב)', () => {
  const p = (dirty, due, net, saved) => R.railPrimary({ dirty, due, net, saved });
  assert.deepEqual([p(true, 150, 150, 0).kind, p(true, 150, 150, 0).text, p(true, 150, 150, 0).icon], ['pay', 'תשלום', 'card']);
  assert.equal(p(true, 150, 150, 0).intent, 'pay');
  assert.deepEqual([p(true, -80, -80, 0).kind, p(true, -80, -80, 0).text], ['credit', 'זיכוי']);
  assert.deepEqual([p(true, 0, 0, 0).kind, p(true, 0, 0, 0).text], ['save', 'שמור']);
  // חוב קיים שפחת אבל נשאר חיובי → עדיין "תשלום" (due>0), גם כשהסכום הממתין שלילי
  assert.equal(p(true, 50, -50, 100).kind, 'pay');
  // זיכוי ממתין שהיתרה אחריו עדיין חיובית לא הופך ל"זיכוי"
  assert.equal(p(true, 0, -100, 100).kind, 'credit');
  // בלי שינויים: לפי היתרה השמורה
  const a = p(false, 230, 0, 230); assert.deepEqual([a.kind, a.text, a.amount, a.icon], ['pay-now', 'שלם', 230, 'card']);
  const b = p(false, -40, 0, -40); assert.deepEqual([b.kind, b.text, b.amount, b.icon], ['credit-now', 'זכה', -40, 'undo']);
  assert.equal(p(false, 0, 0, 0).kind, 'none');
  assert.equal(p(false, 0.004, 0, 0.004).kind, 'none', 'אגורות שבריות לא נחשבות');
});

test('railShowActions / payChip: בלוק הלחצנים רק כשיש שינויים או יתרה שמורה; הצ׳יפ לפי היתרה השמורה', () => {
  assert.equal(R.railShowActions({ dirty: false, saved: 0 }), false);
  assert.equal(R.railShowActions({ dirty: true, saved: 0 }), true);
  assert.equal(R.railShowActions({ dirty: false, saved: -1 }), true);
  assert.deepEqual(R.payChip(10), { cls: 'debt', amount: 10, label: 'חוב' });
  assert.deepEqual(R.payChip(-10), { cls: 'cred', amount: -10, label: 'זיכוי' });
  assert.deepEqual(R.payChip(0), { cls: 'ok', amount: 0, label: 'שולם' });
});

test('cartTotals / cartSum: חיוב-זיכוי ממתין, "לתשלום אחרי שמירה", "יתרת חוב/זכות" (אותה לוגיקה כמו בעיצוב)', () => {
  assert.deepEqual(R.cartTotals({ net: 0, saved: 0 }), []);
  assert.deepEqual(R.cartTotals({ net: 150, saved: 0 }), [{ cls: 'tr due', label: 'חיוב ממתין', value: 150, signed: true }]);
  assert.deepEqual(R.cartTotals({ net: -80, saved: 0 }), [{ cls: 'tr due', label: 'זיכוי ממתין', value: -80, signed: true }]);
  assert.deepEqual(R.cartTotals({ net: 50, saved: 100 }), [
    { cls: 'tr', label: 'חיוב ממתין', value: 50, signed: true }, { cls: 'tr due', label: 'לתשלום אחרי שמירה', value: 150, due: true }]);
  assert.deepEqual(R.cartTotals({ net: -100, saved: 100 }), [
    { cls: 'tr', label: 'זיכוי ממתין', value: -100, signed: true }, { cls: 'tr due', label: 'יתרה אחרי שמירה', value: 0, due: true }]);
  assert.equal(R.cartTotals({ net: -150, saved: 100 })[1].label, 'זיכוי אחרי שמירה');
  assert.deepEqual(R.cartTotals({ net: 0, saved: 230 }), [{ cls: 'tr due', label: 'יתרת חוב', value: 230, due: true }]);
  assert.deepEqual(R.cartTotals({ net: 0, saved: -40 }), [{ cls: 'tr due', label: 'יתרת זכות', value: -40, due: true }]);
  assert.deepEqual(R.cartSum({ net: 150, saved: 0 }), { signed: true, value: 150 });
  assert.deepEqual(R.cartSum({ net: 0, saved: 230 }), { signed: false, value: 230 });
  assert.equal(R.cartSum({ net: 0, saved: -5 }), null);
});

// ---------------------------------------------------------------------------------------------
// R4: צ׳יפ הארנק - זוגיות מול handleWalletClick החי של הישן
// ---------------------------------------------------------------------------------------------
test('R4 walletClickPlan ≡ handleWalletClick של הישן: מעבר לתשלומים, ואם יש חוב - חלון תשלום (אחרי הכרטיס: רק בלי שינויים פתוחים)', () => {
  const i = LEGACY_SRC.indexOf('const handleWalletClick = () => {');
  assert.ok(i > 0, 'handleWalletClick נמצא בישן');
  const body = LEGACY_SRC.slice(i, LEGACY_SRC.indexOf('\n  };', i));
  assert.ok(/setActiveTab\('payments'\)/.test(body), 'הישן עובר ללשונית תשלומים תמיד');
  const cond = /if \((totalRequired - totalPaid > 0)\)/.exec(body);
  assert.ok(cond, 'התנאי של הישן: חוב > 0');
  const legacyOpens = compile(['totalRequired', 'totalPaid'], `return ${cond[1]};`);
  for (const [req, paid] of [[530, 530], [530, 300], [300, 530], [0, 0], [100.5, 100], [99.99, 100]]) {
    const plan = R.walletClickPlan({ dirty: false, saved: req - paid });
    assert.equal(plan.goPayments, true);
    assert.equal(plan.openPay, legacyOpens(req, paid), `${req}/${paid}`);
  }
  // סטייה מכוונת (מתועדת ב-W5-NOTES): עם שינויים פתוחים לא פותחים חלון גבייה לפני שהשינויים נשמרו
  assert.equal(R.walletClickPlan({ dirty: true, saved: 230 }).openPay, false);
});

// ---------------------------------------------------------------------------------------------
// R5 הוסר (AMB-05) - אין שורת מגן חוב; D6 (R10/R9/R44/A16)
// ---------------------------------------------------------------------------------------------
test('AMB-05: אין railShield ביצוא (שורת "שמירה עם יתרת חוב ... תדרוש אישור מנהל" הוסרה סופית)', () => {
  assert.equal(R.railShield, undefined);
});

test('D6 successHead: כותרות לפי R10', () => {
  assert.equal(R.successHead({ kind: 'saved' }), 'ההזמנה נשמרה');
  assert.equal(R.successHead({}), 'ההזמנה נשמרה');
  assert.equal(R.successHead({ kind: 'paid', amount: 150, method: 'מזומן' }), 'נשמר ושולם ₪150 · מזומן');
  assert.equal(R.successHead({ kind: 'paid', amount: 150 }), 'נשמר ושולם ₪150');
  assert.equal(R.successHead({ kind: 'debt', amount: 230 }), 'נשמר · חוב ₪230');
  assert.equal(R.successHead({ kind: 'credit', amount: 80 }), 'נשמר · זיכוי ₪80');
  assert.equal(R.successHead({ kind: 'credit', amount: -80 }), 'נשמר · זיכוי ₪80', 'סכום תמיד בערך מוחלט');
  assert.equal(R.successHead({ kind: 'paid', amount: 1234.5 }), `נשמר ושולם ₪${(1234.5).toLocaleString('he-IL')}`);
});

test('D6 successKindOfSave: חוב קיים / זיכוי / רגיל', () => {
  assert.deepEqual(R.successKindOfSave({ balance: 230 }), { kind: 'debt', amount: 230 });
  assert.deepEqual(R.successKindOfSave({ balance: -40, creditNow: 40 }), { kind: 'credit', amount: 40 });
  assert.deepEqual(R.successKindOfSave({ balance: 0, creditNow: 0 }), { kind: 'saved', amount: 0 });
  assert.deepEqual(R.successKindOfSave(null), { kind: 'saved', amount: 0 });
});

test('D6 successTargets (R44/R10/A16): הראשי = יעד ההגדרה; בלי "לרשימה"; "כרטיס ההזמנה" = להישאר', () => {
  const t = (s, ctx) => R.successTargets(s, ctx);
  assert.deepEqual(t('new_order'), { primary: { key: 'nav', label: 'הזמנה חדשה', icon: 'plus', href: '/orders/new' }, showContinue: true });
  // רשימת הזמנות (ברירת מחדל של הגמ"ח הראשי) → אין לחצן רשימה (R10): "הזמנה חדשה" כמו בעיצוב
  assert.equal(t('orders_list').primary.href, '/orders/new');
  assert.equal(t(undefined).primary.href, '/orders/new');
  assert.deepEqual(t('customer', { customerId: 'c9' }).primary, { key: 'nav', label: 'כרטיס הלקוח', icon: 'user', href: '/customers/c9' });
  assert.equal(t('customer', {}).primary.href, '/orders/new', 'בלי מזהה לקוח - ברירת המחדל');
  assert.equal(t('rentals').primary.href, '/rentals');
  assert.equal(t('dashboard').primary.href, '/');
  const o = t('order');
  assert.deepEqual([o.primary.key, o.primary.label, o.primary.href, o.showContinue], ['continue', 'המשך לצפות בהזמנה', null, false]);
  for (const s of ['new_order', 'orders_list', 'customer', 'rentals', 'dashboard', 'order', 'x']) assert.ok(!/רשימ/.test(t(s, { customerId: 'c' }).primary.label), s);
  // היעד של הראשי תואם את המקור היחיד של הגדרת היציאה (lib/orderRedirectScreens.js) - אותם כתובות
});

test('D6 ≡ היעדים של הגדרת היציאה (lib/orderRedirectScreens.js): כל href מחושב ע"י resolveOrderRedirectHref', async () => {
  const { resolveOrderRedirectHref } = await P('lib/orderRedirectScreens.js');
  for (const s of ['new_order', 'customer', 'rentals', 'dashboard']) {
    assert.equal(R.successTargets(s, { customerId: 'c9' }).primary.href, resolveOrderRedirectHref(s, { orderId: 1, customerId: 'c9' }), s);
  }
});

test('R9 printUrl ≡ window.open של הישן אחרי שמירה', () => {
  const m = /window\.open\(`(\/print\/order\?[^`]*)`, '_blank'(?:, 'noopener')?\)/.exec(LEGACY_SRC);
  assert.ok(m, 'window.open של ההדפסה בישן');
  const legacy = compile(['updatedOrder'], `return \`${m[1]}\`;`);
  for (const id of [1, 53375, 99999999]) assert.equal(R.printUrl(id), legacy({ orderId: id }));
});

// ---------------------------------------------------------------------------------------------
// R11: באנר הטיוטה
// ---------------------------------------------------------------------------------------------
test('R11 draftIsStale ≡ התנאי של הישן (baseUpdatedAt שונה מ-order.updatedAt)', () => {
  const m = /\{(pendingDraft\.baseUpdatedAt && order\.updatedAt && pendingDraft\.baseUpdatedAt !== order\.updatedAt)\s*&&/.exec(LEGACY_SRC);
  assert.ok(m, 'תנאי האזהרה בישן');
  const legacy = compile(['pendingDraft', 'order'], `return !!(${m[1]});`);
  const cases = [[null, 'b'], ['a', 'a'], ['a', 'b'], ['a', null], [null, null], ['', 'x'], ['2026-10-01T10:00:00.000Z', '2026-10-01T10:00:00.000Z']];
  for (const [base, srv] of cases) assert.equal(R.draftIsStale({ baseUpdatedAt: base }, srv), legacy({ baseUpdatedAt: base }, { updatedAt: srv }), `${base}/${srv}`);
  assert.equal(R.draftIsStale(null, 'x'), false);
});

test('R11 draftIconName: אייקוני הטיוטה הישנים (#i-*) → שמות sprite של הפלטה; draftTimeLabel: תאריך עברי + שעה בשעון ישראל', () => {
  assert.equal(R.draftIconName('#i-calendar'), 'cal');
  assert.equal(R.draftIconName('#i-alert-tri'), 'alert');
  assert.equal(R.draftIconName('#i-check-circle'), 'check');
  assert.equal(R.draftIconName('#i-receipt'), 'file');
  assert.equal(R.draftIconName('#i-bag'), 'bag');
  assert.equal(R.draftIconName('#i-card'), 'card');
  assert.equal(R.draftIconName('#gmi-dress'), 'dress');
  assert.equal(R.draftIconName(''), 'pencil');
  assert.equal(R.draftIconName(undefined), 'pencil');
  const t = Date.UTC(2026, 8, 24, 6, 41); // 09:41 שעון ישראל (קיץ)
  const label = R.draftTimeLabel(t);
  assert.ok(label.endsWith(' · 09:41'), label);
  assert.equal(label.split(' · ')[0], L.hebDateOf(t));
  assert.ok(!/[0-9]{4}|\/20/.test(label.split(' · ')[0]), 'בלי תאריך לועזי');
  assert.equal(R.draftTimeLabel(0), '');
});

// ---------------------------------------------------------------------------------------------
// A23: טוסט כסף
// ---------------------------------------------------------------------------------------------
test('A23 moneyToastPlan: מציג רק כשהסכום הממתין השתנה לערך שאינו אפס; מסתיר כשחזר לאפס / נשמר', () => {
  let last = 0;
  const step = (dirty, net) => { const p = R.moneyToastPlan({ dirty, net, last }); last = p.net; return p.kind; };
  assert.equal(step(true, 0), null, 'עריכת הערות בלבד - אין טוסט');
  assert.equal(step(true, 150), 'charge');
  assert.equal(step(true, 150), null, 'אותו סכום - לא חוזר');
  assert.equal(step(true, 200), 'charge');
  assert.equal(step(true, -80), 'credit');
  assert.equal(step(true, 0), 'hide', 'חזר לאפס');
  assert.equal(step(true, 150), 'charge');
  assert.equal(step(false, 150), 'hide', 'נשמר/בוטל');
  assert.equal(step(true, 150), 'charge', 'אחרי שמירה עריכה חדשה מציגה שוב');
  assert.equal(R.moneyToastText('charge', 150), 'חיוב ממתין ₪150');
  assert.equal(R.moneyToastText('credit', -80), 'זיכוי ממתין ₪80');
});

// ---------------------------------------------------------------------------------------------
// הדגשת הטקסט ושורת התצוגה
// ---------------------------------------------------------------------------------------------
test('emphasize: הישות מודגשת, הפועל לא', () => {
  const j = (t) => R.emphasize(t).map((s) => (s.b ? `[${s.t}]` : s.t)).join('');
  assert.equal(j('תאריך האירוע'), '[תאריך האירוע]');
  assert.equal(j('הערות ההזמנה עודכנו'), '[הערות ההזמנה] עודכנו');
  assert.equal(j('נוסף פריט: דגם 4519, מידה 38'), 'נוסף פריט: [דגם 4519, מידה 38]');
  assert.equal(j('הוסר חיוב: דמי ביטול'), 'הוסר חיוב: [דמי ביטול]');
  assert.equal(j('סומנה חתימה על התקנון'), 'סומנה [חתימה על התקנון]');
  assert.equal(j('הוחלף לקוח'), 'הוחלף [לקוח]');
  assert.equal(j('ציפוף ימים מיוחד'), '[ציפוף ימים מיוחד]');
  assert.equal(j(''), '');
  // הטקסט המשוחזר = הטקסט המקורי (אין אובדן תווים)
  for (const t of ['תאריך האירוע', 'הערות ההזמנה עודכנו', 'נוסף פריט: דגם 4519, מידה 38', 'סומנה חתימה על התקנון']) assert.equal(R.emphasize(t).map((s) => s.t).join(''), t);
});

test('displayLine: פריט שנוסף/הוסר/שוחזר מפוצל לטקסט + פירוט מידה (כמו העיצוב); שאר השורות כמות שהן', () => {
  assert.deepEqual(R.displayLine({ key: 'item:add:l1', text: 'נוסף פריט: דגם 4519, מידה 38', note: '' }), { text: 'נוספה דגם 4519', note: 'מידה 38' });
  assert.deepEqual(R.displayLine({ key: 'item:rm:a2', text: 'הוסר פריט: דגם 3087, מידה 36', note: '' }), { text: 'הוסרה דגם 3087', note: 'מידה 36' });
  assert.deepEqual(R.displayLine({ key: 'item:rs:a2', text: 'שוחזר פריט: דגם 3087, מידה 36', note: '' }), { text: 'שוחזרה דגם 3087', note: 'מידה 36' });
  assert.deepEqual(R.displayLine({ key: 'item:mod:a1', text: 'עודכן פריט: דגם 4512, מידה 38', note: '' }), { text: 'עודכן פריט: דגם 4512, מידה 38', note: '' });
  assert.deepEqual(R.displayLine({ key: 'date', text: 'תאריך האירוע', note: 'א ← ב' }), { text: 'תאריך האירוע', note: 'א ← ב' });
  // הטקסט שהבקר מחזיר לפריט תואם את התבנית (אם W1 ישנה את הנוסח - הבדיקה הזו תיפול)
  const snap = baseState(); const cur = baseState({ items: [...snap.items, { _localId: 'L1', dressItem: { dress: { name: '4519' } }, sizeText: '38', price: 150, finalPrice: 150 }] });
  const row = L.changesOf(snap, cur).find((c) => c.key.startsWith('item:add:'));
  assert.deepEqual(R.displayLine(row), { text: 'נוספה דגם 4519', note: 'מידה 38' });
});

// ---------------------------------------------------------------------------------------------
// D1/R14, R48 - זוגיות מול הישן
// ---------------------------------------------------------------------------------------------
test('R48 formatStockErrors ≡ שורות הכשל וההערה של validate-inventory בישן', () => {
  const s = LEGACY_SRC.indexOf('const errorLines = validateData.errors.map(');
  assert.ok(s > 0);
  const a = LEGACY_SRC.indexOf('validateData.errors.map(', s), z = LEGACY_SRC.indexOf(".join('\\n')", a) + ".join('\\n')".length;
  const legacyLines = compile(['validateData'], `return ${LEGACY_SRC.slice(a, z)};`);
  const noteCond = /const customSpacingNote = (validateData\.errors\.some\([^)]*\))/.exec(LEGACY_SRC);
  assert.ok(noteCond);
  const legacyNote = compile(['validateData'], `return !!(${noteCond[1]});`);
  const sets = [
    [{ dressName: '4512', sizeText: '38', requested: 1, available: 0 }],
    [{ dressName: '4512', sizeText: '38', requested: 2, available: 0, isCustomSpacingIssue: true }, { dressName: '3087', sizeText: '36', requested: 3, available: 1 }],
    [],
  ];
  for (const errors of sets) {
    const v = { errors };
    const mine = L.formatStockErrors(errors);
    assert.deepEqual(mine.lines.map((l) => `- ${l.text}`), legacyLines(v) ? legacyLines(v).split('\n').filter(Boolean) : []);
    assert.equal(mine.spacingHint, legacyNote(v));
  }
});

test('D1/R14 summaryModel ≡ חישוב היתרה והתוויות בחלון הסיכום של הישן', () => {
  const m = /const balance = (Math\.round\(\(summaryConfirmData\.totalRequired - summaryConfirmData\.totalPaid\) \* 100\) \/ 100);/.exec(LEGACY_SRC);
  assert.ok(m);
  const legacyBalance = compile(['summaryConfirmData'], `return ${m[1]};`);
  const labels = [...LEGACY_SRC.matchAll(/\{balance > 0 \? '([^']+)' : '([^']+)'\}/g)][0];
  assert.ok(labels);
  const norm = (s) => s.replace(/\s+/g, '');
  for (const [req, paid] of [[680, 530], [530, 530], [400, 530], [100.456, 50.123], [0, 0]]) {
    const mm = summaryModel({ totalRequired: req, totalPaid: paid });
    assert.equal(mm.balance, legacyBalance({ totalRequired: req, totalPaid: paid }));
    assert.equal(norm(mm.balanceLabel), norm(mm.balance > 0 ? labels[1] : labels[2]));
  }
});

// ---------------------------------------------------------------------------------------------
// A18: אורקסטרציית השמירה - עם בקר מדומה
// ---------------------------------------------------------------------------------------------
function fakeOc({ dirty = true, balance = 150, pendingNet = 150, savedBalance = 0, save } = {}) {
  const listeners = new Map();
  const oc = {
    saving: false, dirty, totals: { balance, pendingNet, savedBalance },
    calls: [],
    on(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); return () => listeners.get(type).delete(fn); },
    emit(type, p) { const s = listeners.get(type); if (s) s.forEach((f) => f(p)); },
    goPayments() { oc.calls.push('goPayments'); },
    async save(o) { oc.calls.push(`save:${o.intent}`); return save(o, oc); },
  };
  return oc;
}
function actionsFor(oc, extra = {}) {
  const log = { pay: [], success: [], later: [] };
  let t = 0;
  const a = L && R.createRailActions({
    getOc: () => oc, requestPayment: (k) => log.pay.push(k), showSuccess: (i) => log.success.push(i), now: () => t,
    setTimeout: (fn, ms) => { log.later.push(ms); fn(); }, ...extra,
  });
  return { a, log, tick: (ms) => { t += ms; } };
}

test('A18 "תשלום": חוב חדש → W4 פותח חלון תשלום (debtCreated); הרייל לא פותח חלון ולא D6 באותו רגע; אחרי התשלום → D6 "נשמר ושולם"', async () => {
  const oc = fakeOc({ save: async () => ({ ok: true, debtCreated: 150, balance: 150, creditNow: 0 }) });
  const { a, log } = actionsFor(oc);
  const r = await a.primary();
  assert.equal(r.handled, 'debt-window');
  assert.deepEqual(oc.calls, ['save:pay']);
  assert.deepEqual(log.pay, []);
  assert.deepEqual(log.success, []);
  assert.equal(a.hasPending(), true);
  assert.equal(a.paymentDone({ amount: 150, method: 'מזומן' }), true);
  assert.deepEqual(log.success, [{ kind: 'paid', amount: 150, method: 'מזומן' }]);
  assert.equal(a.paymentDone({ amount: 5, method: 'מזומן' }), false, 'תשלום נוסף לא מציג D6 שוב');
});

test('A18 "תשלום" כשהחוב היה קודם (לא חוב חדש): requestPayment("pay"); אחרי התשלום D6', async () => {
  const oc = fakeOc({ balance: 100, pendingNet: -20, savedBalance: 120, save: async () => ({ ok: true, debtCreated: 0, balance: 100, creditNow: 0 }) });
  const { a, log } = actionsFor(oc);
  assert.equal((await a.primary()).handled, 'pay-window');
  assert.deepEqual(log.pay, ['pay']);
  assert.deepEqual(log.success, []);
  a.paymentDone({ amount: 100, method: 'אשראי' });
  assert.equal(log.success[0].kind, 'paid');
});

test('A18 "זיכוי": זיכוי אוטומטי בלי פרטי בנק → W4 פותח חלון בנק (autoRefundNeedsBank): בלי בקשת תשלום ובלי D6', async () => {
  const oc = fakeOc({ balance: -80, pendingNet: -80, save: async (o, c) => { c.emit('autoRefundNeedsBank', { source: 'save' }); return { ok: true, debtCreated: 0, balance: -80, creditNow: 80 }; } });
  const { a, log } = actionsFor(oc);
  assert.equal((await a.primary()).handled, 'bank-window');
  assert.deepEqual(log.pay, []);
  assert.deepEqual(log.success, []);
});

test('A18 "זיכוי" בלי זיכוי אוטומטי: requestPayment("credit"); "זיכוי" בלי יתרת זכות אחרי השמירה: D6', async () => {
  const oc = fakeOc({ balance: -80, pendingNet: -80, save: async () => ({ ok: true, debtCreated: 0, balance: -80, creditNow: 80 }) });
  const x = actionsFor(oc);
  assert.equal((await x.a.primary()).handled, 'credit-window');
  assert.deepEqual(x.log.pay, ['credit']);
  const oc2 = fakeOc({ balance: -80, pendingNet: -80, save: async () => ({ ok: true, debtCreated: 0, balance: 0, creditNow: 0 }) });
  const y = actionsFor(oc2);
  assert.equal((await y.a.primary()).handled, 'success');
  assert.deepEqual(y.log.success, [{ kind: 'saved', amount: 0 }]);
});

test('A18 "שמור" (סכום 0): D6 "ההזמנה נשמרה"; עם חוב קיים בלי שינוי: "נשמר · חוב"; זיכוי קיים: "נשמר · זיכוי"', async () => {
  const mk = (res) => fakeOc({ balance: 0, pendingNet: 0, save: async () => ({ ok: true, debtCreated: 0, ...res }) });
  let x = actionsFor(mk({ balance: 0, creditNow: 0 })); await x.a.primary(); assert.deepEqual(x.log.success, [{ kind: 'saved', amount: 0 }]);
  x = actionsFor(mk({ balance: 230, creditNow: 0 })); await x.a.primary('save'); assert.deepEqual(x.log.success, [{ kind: 'debt', amount: 230 }]); assert.deepEqual(x.log.pay, []);
  x = actionsFor(mk({ balance: -40, creditNow: 40 })); await x.a.primary('save'); assert.deepEqual(x.log.success, [{ kind: 'credit', amount: 40 }]);
});

test('A18: no-op / כשל / עסוק → בלי חלון ובלי D6; save לא נקרא כשהבקר באמצע פעולה', async () => {
  for (const res of [{ ok: true, noop: true }, { ok: false }, { ok: false, cancelled: true }, { ok: false, stock: true }, null]) {
    const oc = fakeOc({ save: async () => res });
    const { a, log } = actionsFor(oc);
    assert.equal((await a.primary()).handled, 'none');
    assert.deepEqual([log.pay, log.success], [[], []]);
  }
  const busy = fakeOc({ save: async () => { throw new Error('לא אמור להיקרא'); } });
  busy.saving = true;
  assert.equal((await actionsFor(busy).a.primary()).handled, 'busy');
  assert.deepEqual(busy.calls, []);
});

test('A18 "שלם ₪N" / "זכה ₪N" (בלי שינויים): goPayments + requestPayment; הלחצן הראשי נגזר מהמצב כשלא נמסר intent', async () => {
  const oc = fakeOc({ dirty: false, balance: 230, pendingNet: 0, savedBalance: 230, save: async () => { throw new Error('אין שמירה'); } });
  let x = actionsFor(oc);
  assert.equal((await x.a.primary()).handled, 'pay-now');
  assert.deepEqual(oc.calls, ['goPayments']);
  assert.deepEqual(x.log.pay, ['pay']);
  x.a.paymentDone({ amount: 230, method: 'מזומן' });
  assert.equal(x.log.success[0].kind, 'paid');
  const oc2 = fakeOc({ dirty: false, balance: -40, pendingNet: 0, savedBalance: -40, save: async () => { throw new Error('אין שמירה'); } });
  x = actionsFor(oc2);
  assert.equal((await x.a.primary()).handled, 'credit-now');
  assert.deepEqual(x.log.pay, ['credit']);
  assert.deepEqual(x.log.success, []);
  assert.equal((await actionsFor(fakeOc({ dirty: false, balance: 0, pendingNet: 0, savedBalance: 0 })).a.primary()).handled, 'none');
});

test('A18 "השאר חוב" (debtApproved): D6 "נשמר · חוב" רק בתוך חלון הייחוס; לא אחרי עריכה חדשה או פקיעה (10 דקות)', async () => {
  const oc = fakeOc({ save: async () => ({ ok: true, debtCreated: 150, balance: 150 }) });
  let x = actionsFor(oc);
  await x.a.primary();
  assert.equal(x.a.debtLeft({ amount: 150 }), true);
  assert.deepEqual(x.log.success, [{ kind: 'debt', amount: 150 }]);
  assert.equal(x.a.debtLeft({ amount: 150 }), false);
  // עריכה חדשה מבטלת
  x = actionsFor(oc); await x.a.primary(); x.a.clearPending();
  assert.equal(x.a.debtLeft({ amount: 1 }), false); assert.equal(x.a.paymentDone({ amount: 1 }), false);
  // פקיעה
  x = actionsFor(oc); await x.a.primary(); x.tick(10 * 60 * 1000 + 1);
  assert.equal(x.a.paymentDone({ amount: 1 }), false);
  // בלי שמירה בכלל - תשלום לא מציג D6
  assert.equal(actionsFor(oc).a.paymentDone({ amount: 1 }), false);
});

test('R4 wallet(): בלי שינויים וחוב שמור → מעבר + חלון אחרי 60ms; עם שינויים או בלי חוב → מעבר בלבד', () => {
  let x = actionsFor(fakeOc({ dirty: false, savedBalance: 230 }));
  x.a.wallet(); assert.deepEqual(x.log.pay, ['pay']); assert.deepEqual(x.log.later, [60]);
  x = actionsFor(fakeOc({ dirty: true, savedBalance: 230 })); x.a.wallet(); assert.deepEqual(x.log.pay, []);
  x = actionsFor(fakeOc({ dirty: false, savedBalance: 0 })); x.a.wallet(); assert.deepEqual(x.log.pay, []);
  const oc = fakeOc({ dirty: false, savedBalance: -50 }); x = actionsFor(oc); x.a.wallet(); assert.deepEqual([oc.calls, x.log.pay], [['goPayments'], []]);
});

// ---------------------------------------------------------------------------------------------
// אינטגרציה עם הזרימות האמיתיות של W1 (orderCardFlows.createOrderCardFlows) - fetch מדומה, בלי React
// ---------------------------------------------------------------------------------------------
function realFlows({ settings = [], respond, edit, withListener = null, answers = {} }) {
  const st = baseState();
  const snapshot = JSON.parse(JSON.stringify(st));
  const state = { ...JSON.parse(JSON.stringify(st)), snapshot, openedDebt: L.openedDebtOf(st.obligations, st.payments), settings: L.parseSettings(settings), debtApproved: false };
  if (edit) edit(state);
  const listeners = new Map();
  const toasts = [], opened = [], calls = [];
  const flags = { pendingDebtBlock: false, bankPromptedOnExit: false, approvedDebtLevel: null };
  const setter = (k) => (v) => { state[k] = typeof v === 'function' ? v(state[k]) : v; };
  const env = {
    fetch: async (url, opts = {}) => { calls.push({ url, method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : undefined }); const r = respond(url, opts) || {}; return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200, headers: { 'Content-Type': 'application/json' } }); },
    ui: { alert: async () => {}, confirm: async () => true, prompt: async () => null, toast: (...a) => toasts.push(a), openDialog: async (C, p) => { opened.push([C, p]); return Object.prototype.hasOwnProperty.call(answers, C) ? answers[C] : (C === 'Summary' ? true : null); } },
    dialogs: { ConflictDialog: 'Conflict', StockDialog: 'Stock', SummaryDialog: 'Summary', ExitDialog: 'Exit', DiscardDialog: 'Discard' },
    routeId: '53375', get: () => state,
    set: { order: setter('order'), items: setter('items'), obligations: setter('obligations'), payments: setter('payments'), refunds: setter('refunds'), tab: setter('tab'), saving: setter('saving') },
    setSnapshot: (s) => { state.snapshot = s; }, setOpenedDebt: (n) => { state.openedDebt = n; }, setDebtApproved: (v) => { state.debtApproved = v; },
    flags, approve: async () => null, navigate: () => {}, bumpHistory: () => {}, clearRedo: () => {},
    emit: (type, payload) => { const s = listeners.get(type); if (!s || !s.size) return 0; s.forEach((f) => f(payload)); return s.size; },
  };
  const flows = createOrderCardFlows(env);
  const oc = {
    get saving() { return !!state.saving; }, get dirty() { return L.changesOf(state.snapshot, state).length > 0; },
    get totals() { return L.computeTotals({ items: state.items, obligations: state.obligations, payments: state.payments, snapshot: state.snapshot, openedDebt: state.openedDebt }); },
    on(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); return () => listeners.get(type).delete(fn); },
    goPayments() {}, save: flows.save,
  };
  if (withListener) oc.on('debtCreated', withListener);
  return { oc, state, calls, toasts, opened };
}
const okPut = (extraObl = []) => (st) => (u) => (u.includes('validate-inventory') ? { body: { valid: true } } : { body: { ...st.order, items: st.items, obligations: [...st.obligations, ...extraObl], payments: st.payments, refunds: [], updatedAt: '2026-10-04T10:00:00.000Z' } });
const withNotes = (s) => { s.order = { ...s.order, notes: 'שונה' }; };

test('אינטגרציה: שמירה ששולחת חוב חדש (השרת הוסיף חיוב משלוח) → debtCreated לבקר, W4 מדומה פותח חלון, הרייל לא פותח D6', async () => {
  const st = baseState();
  let debtEvents = 0;
  const h = realFlows({ edit: withNotes, withListener: () => { debtEvents++; }, respond: okPut([{ id: 'ob9', amount: 80, description: 'משלוח הלוך-חזור', isManual: false, isDeleted: false }])(st) });
  const x = actionsFor(h.oc);
  const r = await x.a.primary('save');
  assert.equal(r.handled, 'debt-window');
  assert.equal(debtEvents, 1);
  assert.deepEqual(x.log.pay, []);
  assert.deepEqual(x.log.success, []);
  assert.equal(h.calls.filter((c) => c.method === 'PUT').length, 1, 'PUT אחד בלבד (שתי קריאות נפרדות: PUT ואז תשלום - לעולם לא endpoint אחד, G6)');
  x.a.paymentDone({ amount: 280, method: 'מזומן' });
  assert.deepEqual(x.log.success, [{ kind: 'paid', amount: 280, method: 'מזומן' }]);
});

test('אינטגרציה: שמירה בלי שינוי בחוב (הערות) → D6; חוב ישן שנשאר + "שמור" → "נשמר · חוב ₪200"; "תשלום" → חלון תשלום', async () => {
  const st = baseState(); // חיובים 300, שולם 100 → חוב קיים 200
  let h = realFlows({ edit: withNotes, respond: okPut()(st) });
  let x = actionsFor(h.oc);
  assert.equal((await x.a.primary('save')).handled, 'success');
  assert.deepEqual(x.log.success, [{ kind: 'debt', amount: 200 }]);
  assert.equal(h.opened.length, 0, 'בלי חלון סיכום כשההגדרה כבויה');
  h = realFlows({ edit: withNotes, respond: okPut()(st) });
  x = actionsFor(h.oc);
  assert.equal((await x.a.primary()).handled, 'pay-window', 'הלחצן הראשי ברייל הוא "תשלום" כשיש יתרת חוב');
  assert.deepEqual(x.log.pay, ['pay']);
});

test('אינטגרציה: D1 (נווה, enable_order_edit_summary_confirm) נפתח ע"י הבקר פעם אחת עם הפרופס של החלון; ביטול D1 = אין PUT ואין חלון גבייה / D6', async () => {
  const st = baseState();
  const settings = [{ key: 'enable_order_edit_summary_confirm', value: 'true' }];
  let h = realFlows({ settings, edit: withNotes, respond: okPut()(st) });
  let x = actionsFor(h.oc);
  await x.a.primary('save');
  const sum = h.opened.filter((o) => o[0] === 'Summary');
  assert.equal(sum.length, 1);
  assert.deepEqual(Object.keys(sum[0][1]).sort(), ['changes', 'intent', 'obligations', 'pendingNet', 'savedObligationKeys', 'totalPaid', 'totalRequired']);
  assert.equal(typeof sum[0][1].pendingNet, 'number', 'D1 מקבל את החיוב/הזיכוי הממתין (REQUESTS-W5 #2)');
  assert.equal(sum[0][1].intent, 'save');
  assert.ok(Array.isArray(sum[0][1].changes) && sum[0][1].changes.length === 1);
  // ביטול D1: אין PUT, אין חלון גבייה, אין D6
  h = realFlows({ settings, edit: withNotes, answers: { Summary: false }, respond: okPut()(st) });
  x = actionsFor(h.oc);
  assert.equal((await x.a.primary('save')).handled, 'none');
  assert.equal(h.calls.filter((c) => c.method === 'PUT').length, 0);
  assert.deepEqual([x.log.pay, x.log.success], [[], []]);
});

test('אינטגרציה: 409 התנגשות → חלון R12 (3 בחירות); "דרוס" = PUT שני עם overwriteConflict, ואז D6; "חזרה לעריכה" = בלי D6; 409 מלאי → חלון R48', async () => {
  const st = baseState();
  const conflict = { status: 409, body: { error: 'Data Collision', code: 'CONFLICT', message: 'עודכנה' } };
  let n = 0;
  const respond = (u, o) => (u.includes('validate-inventory') ? { body: { valid: true } } : (++n === 1 ? conflict : okPut()(st)(u, o)));
  let h = realFlows({ edit: withNotes, answers: { Conflict: 'overwrite' }, respond });
  let x = actionsFor(h.oc);
  assert.equal((await x.a.primary('save')).handled, 'success');
  const puts = h.calls.filter((c) => c.method === 'PUT');
  assert.equal(puts.length, 2);
  assert.equal(puts[1].body.overwriteConflict, true);
  assert.deepEqual(h.opened.map((o) => o[0]), ['Conflict']);
  n = 0;
  h = realFlows({ edit: withNotes, answers: { Conflict: null }, respond });
  x = actionsFor(h.oc);
  assert.equal((await x.a.primary('save')).handled, 'none');
  assert.deepEqual(x.log.success, []);
  const stock = { status: 409, body: { error: 'אין מלאי', code: 'STOCK_SHORTAGE', validationErrors: [{ dressName: '4512', sizeText: '38', requested: 1, available: 0, isCustomSpacingIssue: true }] } };
  h = realFlows({ edit: withNotes, respond: (u) => (u.includes('validate-inventory') ? { body: { valid: true } } : stock) });
  x = actionsFor(h.oc);
  assert.equal((await x.a.primary('save')).handled, 'none');
  const dlg = h.opened.find((o) => o[0] === 'Stock');
  assert.ok(dlg && dlg[1].spacingHint === true && dlg[1].lines[0].text.includes('4512'));
  assert.ok(!h.opened.some((o) => o[0] === 'Conflict'), 'מלאי ≠ התנגשות (G12)');
});

test('D1 summaryModel: pendingNet מהבקר גובר; בלעדיו - היתרה אחרי השמירה; סכום בשורות רק כשיש יותר משינוי אחד עם סכום', () => {
  assert.equal(summaryModel({ totalRequired: 680, totalPaid: 530 }).net, 150);
  assert.equal(summaryModel({ totalRequired: 680, totalPaid: 530, pendingNet: 50 }).net, 50);
  assert.equal(summaryModel({ totalRequired: 680, totalPaid: 530, pendingNet: 0 }).net, 0);
  assert.equal(summaryModel({ changes: [{ amt: 5 }] }).showAmt, false);
  assert.equal(summaryModel({ changes: [{ amt: 5 }, { amt: -2 }, { amt: 0 }] }).showAmt, true);
  assert.equal(summaryModel({ totalRequired: 400, totalPaid: 530 }).balanceLabel, 'יתרת זכות / מאוזן');
});

test('D7/D2/R48 טקסטים: discardSub, EXIT_ROWS_MAX, stockLineNote, STOCK_HINT', () => {
  assert.equal(R.discardSub(1), 'שינוי אחד יימחק');
  assert.equal(R.discardSub(3), '3 שינויים יימחקו');
  assert.ok(R.EXIT_ROWS_MAX >= 5);
  assert.equal(R.stockLineNote(false), 'אין יחידה פנויה בתאריך האירוע');
  assert.equal(R.stockLineNote(true), 'היחידה תפוסה בגלל ציפוף הימים');
  assert.ok(/ציפוף/.test(R.STOCK_HINT));
});

// דוח ההשוואה F11: "בטל שינויים" בחלון הסיכום (D1) - discardAll({confirmed:true}), בלי שמירה ובלי חלון אישור שני
test('D1 סיכום → "בטל שינויים": השינויים מבוטלים (מצב = snapshot), אין PUT, אין חלון DiscardDialog, נרשם cancel-changes; "חזרה לעריכה" משאיר את השינוי', async () => {
  const st = baseState();
  const SET = [{ key: 'enable_order_edit_summary_confirm', value: 'true' }];
  const orig = st.order.notes;
  const respond = okPut()(st);
  let h = realFlows({ settings: SET, edit: withNotes, answers: { Summary: 'discard' }, respond });
  assert.equal(h.state.order.notes, 'שונה');
  const x1 = actionsFor(h.oc);
  await x1.a.primary('save');
  assert.equal(h.state.order.notes, orig, 'חזר למצב שנשמר');
  assert.equal(h.oc.dirty, false);
  assert.equal(h.calls.filter((c) => c.method === 'PUT').length, 0, 'לא נשמר');
  assert.deepEqual(h.opened.map(([C]) => C), ['Summary'], 'בלי חלון אישור שני');
  assert.equal(h.calls.filter((c) => c.url.endsWith('/cancel-changes') && c.method === 'POST').length, 1, 'נרשם ביומן כמו "בטל שינויים" ברייל');
  h = realFlows({ settings: SET, edit: withNotes, answers: { Summary: false }, respond });
  await actionsFor(h.oc).a.primary('save');
  assert.equal(h.state.order.notes, 'שונה', 'חזרה לעריכה: השינוי נשאר');
  assert.equal(h.calls.filter((c) => c.method === 'PUT').length, 0);
});

test('D1: חלון הסיכום - שלושה כפתורים כמו בעיצוב (שמור/תשלום/זיכוי, בטל שינויים, חזרה לעריכה)', async () => {
  const src = (await import('node:fs')).readFileSync((await import('node:path')).join(process.env.PROJ, 'app/components/order-card/dialogs/OcSummaryDialog.js'), 'utf8');
  const i1 = src.indexOf('act="do-save"'); const i2 = src.lastIndexOf('act="discard-close"'); const i3 = src.indexOf('חזרה לעריכה</DlgBtn>');
  assert.ok(i1 > 0 && i2 > i1 && i3 > i2, 'סדר: ראשי, בטל שינויים, חזרה לעריכה');
  assert.match(src, /<DlgBtn icon="undo" act="discard-close" onClick=\{\(\) => close\('discard'\)\}>בטל שינויים<\/DlgBtn>/);
});
