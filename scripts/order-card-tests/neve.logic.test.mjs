// זוגיות לוגיקה טהורה של חלקי W2b (parts/ocNeveLogic.js + התוספות לבקר) מול הקוד של עבודת נווה יעקב (ענף feature/neve-batch-2026-09-25).
// האורקל: צילומי המקור ב-scripts/order-card-tests/neve-oracle/*.txt (הענף לא ממוזג; הקבצים שם בלבד). פונקציות עצמאיות (eventDateToIso, awayLine,
// computeDeliveryObligationPreview) נשלפות מהמקור ומורצות; לוגיקה שחיה בתוך closure של React (patchJoin / chooseCandidate / joinedTo) מועתקת
// מילולית לאורקל כאן, ובדיקה נפרדת מוודאה שכל ביטוי כזה אכן מופיע במקור (כך ששינוי במקור שובר את הבדיקה).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { baseState, item } from './fixtures.mjs';

const PROJ = process.env.PROJ;
const ORACLE = (f) => fs.readFileSync(path.join(PROJ, 'scripts/order-card-tests/neve-oracle', f), 'utf8').split('\r\n').join('\n');
const P = (rel) => import(pathToFileURL(path.join(PROJ, rel)).href);
const N = await P('app/components/order-card/parts/ocNeveLogic.js');
const L = await P('app/components/order-card/orderCardLogic.js');
const CALC = await P('lib/pricingCalc.js');
const { getHebrewDateString } = await P('lib/hebrewDate.js');

const PICKER = ORACLE('DeliveryJoinPicker.js.txt');
const BANNER = ORACLE('DressLocationBanner.js.txt');
const SEQ = ORACLE('BarcodeSequencePanel.js.txt');

// שולף פונקציה ברמה העליונה (מההדר עד שורת "}" בעמודה הראשונה) ומחזיר אותה כפונקציה שניתן להריץ
function extractFn(src, header, deps = {}) {
  const i = src.indexOf(header);
  assert.ok(i >= 0, `לא נמצא במקור: ${header}`);
  const end = src.indexOf('\n}\n', i);
  const body = src.slice(i, end + 2).replace(/^export\s+(default\s+)?/, '');
  const names = Object.keys(deps);
  return new Function(...names, `${body}\nreturn ${header.match(/function\s+(\w+)/)[1]};`)(...names.map(k => deps[k]));
}

test('אורקל: הביטויים שהועתקו מילולית לבדיקות קיימים במקור של נווה', () => {
  const must = [
    [PICKER, "const joinedTo = order.deliveryJoin !== undefined ? (order.deliveryJoin?.joinedToOrderId || null) : (info?.joinedToOrderId || null);"],
    [PICKER, "const effectiveMode = mode || (joinedTo ? 'join' : 'new');"],
    [PICKER, "const rootForGroup = joinedTo || (info?.group?.length ? info.rootOrderId : null);"],
    [PICKER, "const savedPrimary = info?.isPrimary ? 'self' : (group.find(g => g.isPrimary)?.orderId ?? null);"],
    [PICKER, "patchJoin({ joinedToOrderId: cand.orderId, primaryOrderId: null }, { deliveryAddress: cand.street || '', deliveryCity: cand.city || '' });"],
    [PICKER, "if (next === 'new' && joinedTo) patchJoin({ joinedToOrderId: null });"],
    [PICKER, "const qs = new URLSearchParams({ mode: 'candidates', eventDate: eventIso, direction, oneDayBefore: String(oneDayBefore) });"],
    [PICKER, "if (orderId) qs.set('exclude', String(orderId));"],
    [PICKER, "`#${c.orderId} · ${c.customerName} · ${c.address || '-'}${c.joinedCount ? ` · (${c.joinedCount} מצטרפים)` : ''}`"],
    [PICKER, "const direction = order.deliveryDirection || 'הלוך-חזור';"],
    [PICKER, "const oneDayBefore = !!order.deliveryOneDayBefore;"],
    [PICKER, "const eventIso = eventDateToIso(order.eventDate || order.fromDate);"],
    [BANNER, "const status = a.overdue ? 'עבר מועד ההחזרה - טרם הוחזרה!' : (a.backBeforeEvent ? 'צפויה לחזור לפני האירוע' : 'לא צפויה לחזור לפני האירוע');"],
    [BANNER, "{critical ? 'לא צפויות להגיע בזמן ללא טיפול' : 'צריכות לעבור / להיאסף'}"],
    [SEQ, "const code = value.replace(/\\s+/g, '');"],
    [SEQ, "const MUTE_KEY = 'barcodeSequenceMuted';"],
  ];
  for (const [src, expr] of must) assert.ok(src.includes(expr), `חסר במקור: ${expr}`);
});

test('eventIsoOf = eventDateToIso של נווה (8 קלטים, ירושלים/UTC/ניו-יורק)', () => {
  const neve = extractFn(PICKER, 'function eventDateToIso');
  const inputs = ['2026-10-07', '2026-10-07T21:00:00.000Z', '2026-10-07T20:59:59.999Z', '2026-10-06T22:30:00.000Z', '2026-03-26T22:00:00.000Z', '2026-03-27T21:59:00.000Z', '', null, undefined, 'garbage', new Date('2026-10-07T21:00:00Z')];
  for (const v of inputs) assert.equal(N.eventIsoOf(v), neve(v), `קלט ${String(v)}`);
});

test('joinCandidatesQuery = ה-qs של נווה (כיוון/יום לפני/exclude)', () => {
  for (const o of [{ eventDate: '2026-10-07T21:00:00.000Z' }, { eventDate: null, fromDate: '2026-10-05T21:00:00.000Z', deliveryDirection: 'הלוך' }, { eventDate: '2026-10-07', deliveryDirection: 'חזור', deliveryOneDayBefore: true }]) {
    for (const orderId of [null, 53375]) {
      const eventIso = N.eventIsoOf(o.eventDate || o.fromDate);
      const qs = new URLSearchParams({ mode: 'candidates', eventDate: eventIso, direction: o.deliveryDirection || 'הלוך-חזור', oneDayBefore: String(!!o.deliveryOneDayBefore) });
      if (orderId) qs.set('exclude', String(orderId));
      assert.equal(N.joinCandidatesQuery(o, orderId), qs.toString());
    }
  }
});

test('candidateLabel = טקסט האפשרות של נווה', () => {
  const neveLabel = (c) => `#${c.orderId} · ${c.customerName} · ${c.address || '-'}${c.joinedCount ? ` · (${c.joinedCount} מצטרפים)` : ''}`;
  for (const c of [{ orderId: 1, customerName: 'א', address: 'עמוס 3, ירושלים', joinedCount: 0 }, { orderId: 2, customerName: 'ב', address: '', joinedCount: 3 }, { orderId: 3, customerName: 'ג', address: 'x', joinedCount: 1 }]) assert.equal(N.candidateLabel(c), neveLabel(c));
});

test('dressAlertLine = awayLine של נווה (סניף / באירוע: איחור, חוזרת לפני, לא חוזרת)', () => {
  const neve = extractFn(BANNER, 'function awayLine', { getHebrewDateString });
  const cases = [
    { kind: 'branch', barcode: '123456', branch: 'בני ברק' },
    { kind: 'out', barcode: '1', orderId: 5, expectedReturn: '2026-10-10T21:00:00.000Z', overdue: true, backBeforeEvent: false },
    { kind: 'out', barcode: '2', orderId: 6, expectedReturn: '2026-10-10T21:00:00.000Z', overdue: false, backBeforeEvent: true },
    { kind: 'out', barcode: '3', orderId: 7, expectedReturn: null, overdue: false, backBeforeEvent: false },
  ];
  for (const a of cases) assert.equal(N.dressAlertLine(a, getHebrewDateString), neve(a));
  assert.equal(N.dressAlertsSeverity([{ severity: 'warning' }]), 'warning');
  assert.equal(N.dressAlertsSeverity([{ severity: 'warning' }, { severity: 'critical' }]), 'critical');
  assert.ok(N.dressAlertTitle([{ severity: 'critical' }]).endsWith('לא צפויות להגיע בזמן ללא טיפול'));
  assert.ok(N.dressAlertTitle([{ severity: 'warning' }]).endsWith('צריכות לעבור / להיאסף'));
  assert.deepEqual(N.dressAlertHead({ modelName: 'דגם 4512', size: '38', assigned: true }), { name: 'דגם 4512 · מידה 38', tail: ' - היחידה שנבחרה להזמנה אינה זמינה:' });
  assert.deepEqual(N.dressAlertHead({ modelName: 'דגם 4512', size: '', assigned: false, needed: 2, homeCount: 1, shortage: 1 }), { name: 'דגם 4512', tail: ' - נדרשות 2, בבית זמינות 1 (חסרות 1):' });
});

// ---- הלוגיקה של closure הבורר (נווה) ללא React: מועתקת מילולית מ-DeliveryJoinPicker.js ----
function neveModel({ order, info, group, mode }) {
  const joinedTo = order.deliveryJoin !== undefined ? (order.deliveryJoin?.joinedToOrderId || null) : (info?.joinedToOrderId || null);
  const effectiveMode = mode || (joinedTo ? 'join' : 'new');
  const rootForGroup = joinedTo || (info?.group?.length ? info.rootOrderId : null);
  const savedPrimary = info?.isPrimary ? 'self' : (group.find(g => g.isPrimary)?.orderId ?? null);
  const currentPrimary = order.deliveryJoin?.primaryOrderId !== undefined && order.deliveryJoin?.primaryOrderId !== null ? order.deliveryJoin.primaryOrderId : savedPrimary;
  const patchJoin = (patch, extra = {}) => ({ deliveryJoin: { joinedToOrderId: joinedTo, primaryOrderId: currentPrimary, ...patch }, ...extra });
  return { joinedTo, effectiveMode, rootForGroup, savedPrimary, currentPrimary, patchJoin };
}
// הכרטיס החדש שומר את אותו מידע בשני שדות שטוחים (deliveryJoinedTo / deliveryPrimaryOrderId) - המרה לצורת נווה לצורך ההשוואה
const toNeveOrder = (o) => ((o.deliveryJoinedTo !== undefined || o.deliveryPrimaryOrderId !== undefined)
  ? { ...o, deliveryJoin: { ...(o.deliveryJoinedTo !== undefined ? { joinedToOrderId: o.deliveryJoinedTo } : {}), ...(o.deliveryPrimaryOrderId !== undefined ? { primaryOrderId: o.deliveryPrimaryOrderId } : {}) } }
  : { ...o });

const INFOS = [
  { joinedToOrderId: null, isPrimary: false, group: [] },
  { joinedToOrderId: 5, rootOrderId: 5, isPrimary: false, group: [{ orderId: 5 }, { orderId: 9 }] },
  { joinedToOrderId: null, rootOrderId: 9, isPrimary: true, group: [{ orderId: 9 }, { orderId: 11 }] },
  null,
];
const GROUPS = [[], [{ orderId: 5, isPrimary: true }, { orderId: 9, isPrimary: false }], [{ orderId: 5, isPrimary: false }]];
const ORDERS = [
  {}, { deliveryJoinedTo: null }, { deliveryJoinedTo: 7 }, { deliveryJoinedTo: 7, deliveryPrimaryOrderId: 'self' }, { deliveryJoinedTo: 5, deliveryPrimaryOrderId: 9 }, { deliveryPrimaryOrderId: 5, deliveryJoinedTo: 5 },
];

test('effectiveJoin = joinedTo / mode / rootForGroup / savedPrimary / currentPrimary של נווה (כל צירופי info × group × order × mode)', () => {
  for (const info of INFOS) for (const group of GROUPS) for (const o of ORDERS) for (const mode of [null, 'new', 'join']) {
    const neve = neveModel({ order: toNeveOrder(o), info, group, mode });
    const mine = N.effectiveJoin({ order: o, info, group, modeState: mode });
    assert.equal(mine.joinedTo, neve.joinedTo);
    assert.equal(mine.mode, neve.effectiveMode);
    assert.equal(mine.rootForGroup, neve.rootForGroup);
    assert.equal(mine.savedPrimary, neve.savedPrimary);
    assert.equal(mine.currentPrimary, neve.currentPrimary);
  }
});

test('joinPatch: בחירת משלוח / ראשי / חזרה ל"משלוח חדש" = patchJoin של נווה (+ כתובת/עיר מהמשלוח שנבחר)', () => {
  const cand = { orderId: 5, street: 'עמוס 3', city: 'ירושלים' };
  for (const info of INFOS) for (const group of GROUPS) for (const o of ORDERS) {
    const neve = neveModel({ order: toNeveOrder(o), info, group, mode: null });
    const eff = N.effectiveJoin({ order: o, info, group, modeState: null });
    // בחירת משלוח
    let n = neve.patchJoin({ joinedToOrderId: cand.orderId, primaryOrderId: null }, { deliveryAddress: cand.street || '', deliveryCity: cand.city || '' });
    let m = N.joinPatch('candidate', cand, eff);
    assert.equal(m.deliveryJoinedTo, n.deliveryJoin.joinedToOrderId); assert.equal(m.deliveryPrimaryOrderId, n.deliveryJoin.primaryOrderId);
    assert.equal(m.deliveryAddress, n.deliveryAddress); assert.equal(m.deliveryCity, n.deliveryCity);
    // ביטול בחירה (chooseCandidate('') בנווה)
    n = neve.patchJoin({ joinedToOrderId: null });
    m = N.joinPatch('candidate', null, eff);
    // סטייה מכוונת מנווה (סקירה, סעיף 1): ביטול הצטרפות שמורה = false (לא null) כדי שיהיה שינוי גם מול snapshot בלי הערך - שקול ל-null בשרת
    assert.equal(m.deliveryJoinedTo || null, n.deliveryJoin.joinedToOrderId); assert.equal(m.deliveryPrimaryOrderId, n.deliveryJoin.primaryOrderId);
    assert.equal(m.deliveryJoinedTo, eff.savedJoin ? false : null);
    assert.ok(!('deliveryAddress' in m));
    // ראשי
    for (const pid of ['self', 5, 9]) {
      n = neve.patchJoin({ primaryOrderId: pid });
      m = N.joinPatch('primary', pid, eff);
      assert.equal(m.deliveryJoinedTo, n.deliveryJoin.joinedToOrderId); assert.equal(m.deliveryPrimaryOrderId, n.deliveryJoin.primaryOrderId);
    }
    // חזרה ל"משלוח חדש": רק כשהיה מצורף
    const back = N.joinPatch('mode-new', null, eff);
    if (neve.joinedTo) { n = neve.patchJoin({ joinedToOrderId: null }); assert.equal(back.deliveryJoinedTo || null, n.deliveryJoin.joinedToOrderId); assert.equal(back.deliveryPrimaryOrderId, n.deliveryJoin.primaryOrderId); } else assert.equal(back, null);
  }
});

test('computeDeliveryObligationPreview עם joinPrice = הפונקציה של נווה (רשת: עיר/מחיר אחיד/כיוון/חיוב קיים/joinPrice)', () => {
  const neve = extractFn(ORACLE('computeDeliveryObligationPreview.js.txt'), 'function computeDeliveryObligationPreview');
  const byCity = [undefined, '', '{"ירושלים":60}', '{"ירושלים":0}', 'garbage'];
  for (const isDelivery of [true, false]) for (const city of ['ירושלים', 'בני ברק', '', null]) for (const dir of ['הלוך', 'חזור', 'הלוך-חזור', null, undefined])
    for (const bc of byCity) for (const flat of [undefined, '', '45', '0']) for (const joinPrice of [null, undefined, 0, 20, '15'])
      for (const existing of [[], [{ description: 'משלוח הלוך - ירושלים', isDeleted: false }], [{ description: 'משלוח', isDeleted: true }]]) {
        const args = { isDelivery, deliveryCity: city, deliveryDirection: dir, deliveryPriceByCity: bc, deliveryPrice: flat, joinPrice, existingObligations: existing };
        assert.deepEqual(CALC.computeDeliveryObligationPreview(args), neve(args), JSON.stringify(args));
      }
  // בלי joinPrice = ההתנהגות הקודמת בדיוק (המפתח לא חייב להופיע)
  const { joinPrice: _jp, ...noJoin } = { isDelivery: true, deliveryCity: 'ירושלים', deliveryDirection: 'הלוך-חזור', deliveryPriceByCity: '{"ירושלים":60}', deliveryPrice: '50', existingObligations: [] };
  assert.equal(CALC.computeDeliveryObligationPreview(noJoin).amount, 120);
  assert.equal(CALC.computeDeliveryObligationPreview({ ...noJoin, joinPrice: 20 }).amount, 40, 'מחיר הצטרפות לצד × 2 בכיוון הלוך-חזור');
});

test('buildPutPayload: deliveryJoin נשלח רק אחרי שהבורר נגע בו - בשני המסלולים (בנווה המסלול של היציאה השמיט אותו); joinedToOrderId חסר = לא משתנה', () => {
  const st = baseState();
  const args = (o, mode) => [{ ...st.order, ...o }, { items: st.items, obligations: st.obligations, payments: st.payments, mode, debtApprovedBy: null }];
  for (const mode of ['save', 'exit']) {
    assert.ok(!('deliveryJoin' in L.buildPutPayload(...args({}, mode))), 'בלי נגיעה: גוף זהה לישן');
    assert.ok(!('deliveryJoin' in L.buildPutPayload(...args({ deliveryJoinedTo: undefined }, mode))));
    assert.deepEqual(L.buildPutPayload(...args({ deliveryJoinedTo: 5, deliveryPrimaryOrderId: null }, mode)).deliveryJoin, { joinedToOrderId: 5, primaryOrderId: null });
    assert.deepEqual(L.buildPutPayload(...args({ deliveryJoinedTo: null, deliveryPrimaryOrderId: 'self' }, mode)).deliveryJoin, { joinedToOrderId: null, primaryOrderId: 'self' });
    assert.deepEqual(L.buildPutPayload(...args({ deliveryPrimaryOrderId: 9 }, mode)).deliveryJoin, { primaryOrderId: 9 }, 'ראשי בלבד: בלי joinedToOrderId (השרת לא נוגע בהצטרפות)');
  }
});

test('buildPreviewBody + pricingInputsChanged: deliveryJoinedTo מגיע לתצוגה המקדימה ומפעיל אותה', () => {
  const st = baseState({ order: { isDelivery: true, deliveryCity: 'ירושלים' } });
  assert.equal(L.buildPreviewBody(st.items, st.order).order.deliveryJoinedTo, undefined);
  assert.equal(L.buildPreviewBody(st.items, { ...st.order, deliveryJoinedTo: 7 }).order.deliveryJoinedTo, 7);
  assert.equal(JSON.stringify(L.buildPreviewBody(st.items, st.order)).includes('deliveryJoinedTo'), false, 'undefined לא נשלח - השרת קורא מהטבלה');
  assert.equal(L.pricingInputsChanged({ items: st.items, order: st.order }, st.items, { ...st.order, deliveryJoinedTo: 7 }), true);
  assert.equal(L.pricingInputsChanged({ items: st.items, order: st.order }, st.items, { ...st.order, deliveryJoinedTo: null }), false);
});

test('changesOf: בחירת הצטרפות / ראשי = שינוי שלא נשמר (field:*) עם תווית; לא נגעו / null↔undefined = בלי שינוי', () => {
  const st = baseState({ order: { isDelivery: true, deliveryCity: 'ירושלים' } });
  const snap = { ...st };
  const keys = (o) => L.changesOf(snap, { ...st, order: { ...st.order, ...o } }).map(c => c.key);
  assert.deepEqual(keys({}), []);
  assert.deepEqual(keys({ deliveryJoinedTo: null }), []);
  assert.deepEqual(keys({ deliveryJoinedTo: 5 }), ['field:deliveryJoinedTo']);
  assert.deepEqual(keys({ deliveryPrimaryOrderId: 'self' }), ['field:deliveryPrimaryOrderId']);
  const c = L.changesOf(snap, { ...st, order: { ...st.order, deliveryJoinedTo: 5 } })[0];
  assert.equal(c.text, 'עודכן שדה: הצטרפות למשלוח');
  assert.equal(L.changesOf(snap, { ...st, order: { ...st.order, deliveryPrimaryOrderId: 9 } })[0].text, 'עודכן שדה: ה"ראשי" בכתובת המשלוח');
});

test('סקירה 1: ביטול הצטרפות קיימת נראה - שינוי, מלוכלך, שמירה ורענון מחיר (false / null מול ההצטרפות השמורה ב-snapshot)', () => {
  const st = baseState({ order: { isDelivery: true, deliveryCity: 'ירושלים' } });
  const info = { joinedToOrderId: 5, rootOrderId: 5, isPrimary: false, group: [{ orderId: 5 }, { orderId: 9 }] };
  // א. ההצטרפות השמורה נטענת ל-order ול-snapshot (patchOrder) - בלי שינוי בטעינה
  const sync = N.savedJoinSyncPatch({ order: st.order, info, infoVersion: 3, historyVersion: 3 });
  assert.deepEqual(sync, { deliveryJoinedTo: 5 });
  const snap = { ...st, order: { ...st.order, ...sync } };
  const cur = (o) => ({ ...st, order: { ...st.order, ...sync, ...o } });
  assert.deepEqual(L.changesOf(snap, cur({})), [], 'אחרי הסנכרון אין שינוי');
  for (const cancelled of [null, false]) {
    const c = L.changesOf(snap, cur({ deliveryJoinedTo: cancelled }));
    assert.deepEqual(c.map(x => x.key), ['field:deliveryJoinedTo'], `ביטול (${cancelled}) = שינוי`);
    assert.equal(L.pricingInputsChanged(snap, st.items, cur({ deliveryJoinedTo: cancelled }).order), true, 'ומרענן מחיר');
    assert.equal(L.buildPutPayload(cur({ deliveryJoinedTo: cancelled }).order, { items: st.items, obligations: st.obligations, payments: st.payments, mode: 'save' }).deliveryJoin.joinedToOrderId, null);
  }
  // ב. גם אם הסנכרון טרם קרה (snapshot בלי הערך) - ה-joinPatch של ביטול שמור = false, שונה מ-undefined
  const eff = N.effectiveJoin({ order: st.order, info, group: [], modeState: null });
  assert.equal(eff.savedJoin, 5);
  const cancelPatch = N.joinPatch('candidate', null, eff);
  assert.equal(cancelPatch.deliveryJoinedTo, false);
  const bare = { ...st };
  assert.deepEqual(L.changesOf(bare, { ...st, order: { ...st.order, ...cancelPatch } }).map(x => x.key), ['field:deliveryJoinedTo']);
  assert.equal(L.pricingInputsChanged(bare, st.items, { ...st.order, ...cancelPatch }), true);
  assert.equal(L.buildPreviewBody(st.items, { ...st.order, ...cancelPatch }).order.deliveryJoinedTo, false);
  // אחרי ביטול, בחירת "ראשי" לא מבטלת את הביטול (false נשמר)
  const eff2 = N.effectiveJoin({ order: { ...st.order, ...cancelPatch }, info, group: [], modeState: null });
  assert.equal(eff2.joinedTo, null);
  assert.equal(N.joinPatch('primary', 'self', eff2).deliveryJoinedTo, false);
  assert.equal(N.joinPatch('mode-new', null, eff).deliveryJoinedTo, false);
  // ג. בחירה וביטול של משלוח שמעולם לא נשמר = אין שינוי (null)
  const effNone = N.effectiveJoin({ order: st.order, info: { joinedToOrderId: null, isPrimary: false, group: [] }, group: [], modeState: null });
  assert.equal(N.joinPatch('candidate', null, effNone).deliveryJoinedTo, null);
  assert.deepEqual(L.changesOf({ ...st }, { ...st, order: { ...st.order, deliveryJoinedTo: null } }), []);
  // ד. מחזירים לאותו שורש = שוב אין שינוי
  assert.deepEqual(L.changesOf(snap, cur({ deliveryJoinedTo: 5 })), []);
});

test('סקירה 1: savedJoinSyncPatch לא מסנכרן כשהמשתמש נגע / אין הצטרפות / המידע מיושן (אחרי שמירה) - כדי לא להחזיר הצטרפות שבוטלה', () => {
  const st = baseState();
  const info = { joinedToOrderId: 5, rootOrderId: 5, isPrimary: false, group: [] };
  assert.equal(N.savedJoinSyncPatch({ order: { ...st.order, deliveryJoinedTo: null }, info, infoVersion: 1, historyVersion: 1 }), null);
  assert.equal(N.savedJoinSyncPatch({ order: { ...st.order, deliveryJoinedTo: false }, info, infoVersion: 1, historyVersion: 1 }), null);
  assert.equal(N.savedJoinSyncPatch({ order: { ...st.order, deliveryJoinedTo: 7 }, info, infoVersion: 1, historyVersion: 1 }), null);
  assert.equal(N.savedJoinSyncPatch({ order: st.order, info: { ...info, joinedToOrderId: null }, infoVersion: 1, historyVersion: 1 }), null);
  assert.equal(N.savedJoinSyncPatch({ order: st.order, info: null, infoVersion: null, historyVersion: 1 }), null);
  assert.equal(N.savedJoinSyncPatch({ order: st.order, info, infoVersion: 1, historyVersion: 2 }), null, 'מידע שנטען לפני השמירה');
  assert.equal(N.savedJoinSyncPatch({ order: null, info, infoVersion: 1, historyVersion: 1 }), null);
});

test('סקירה 9: rovingNext - חיצים/Home/End בקבוצת radio (RTL: שמאלה=הבא), עטיפה בקצוות, מקשים אחרים = null', () => {
  assert.equal(N.rovingNext('ArrowDown', 0, 3), 1);
  assert.equal(N.rovingNext('ArrowDown', 2, 3), 0, 'עטיפה');
  assert.equal(N.rovingNext('ArrowUp', 0, 3), 2, 'עטיפה');
  assert.equal(N.rovingNext('ArrowUp', 2, 3), 1);
  assert.equal(N.rovingNext('ArrowLeft', 0, 3, true), 1, 'RTL: שמאלה = הבא');
  assert.equal(N.rovingNext('ArrowRight', 1, 3, true), 0, 'RTL: ימינה = הקודם');
  assert.equal(N.rovingNext('ArrowRight', 0, 3, false), 1, 'LTR: ימינה = הבא');
  assert.equal(N.rovingNext('Home', 2, 3), 0);
  assert.equal(N.rovingNext('End', 0, 3), 2);
  for (const k of ['Enter', ' ', 'Tab', 'a', 'Escape']) assert.equal(N.rovingNext(k, 1, 3), null, k);
  assert.equal(N.rovingNext('ArrowDown', 0, 0), null, 'רשימה ריקה');
  assert.equal(N.rovingNext('ArrowDown', 0, 1), 0, 'פריט יחיד');
});

test('רצף ברקודים: sequenceEntry / scanResultToSequence = record של נווה (סטטוס, הודעת ברירת מחדל, undo)', () => {
  // record של נווה: status = ok|info כמות שהוא, אחרת error; הודעה ברירת מחדל 'נקלט' / 'הסריקה נכשלה'; undo רק אם פונקציה
  for (const [r, st, msg] of [[{ status: 'ok', message: 'x' }, 'ok', 'x'], [{ status: 'ok' }, 'ok', 'נקלט'], [{ status: 'info', message: 'i' }, 'info', 'i'], [{ status: 'weird' }, 'error', 'הסריקה נכשלה'], [null, 'error', 'הסריקה נכשלה'], [{ status: 'error', message: 'e' }, 'error', 'e']]) {
    const e = N.sequenceEntry('123', r, 1);
    assert.equal(e.status, st); assert.equal(e.message, msg); assert.equal(e.undo, null); assert.equal(e.undone, false);
  }
  assert.equal(typeof N.sequenceEntry('1', { status: 'ok', undo: () => {} }, 1).undo, 'function');
  assert.ok(SEQ.includes("result?.message || (status === 'ok' ? 'נקלט' : 'הסריקה נכשלה')"));
  // המרת תוצאת W3
  const calls = [];
  const env = { errorMessage: 'ברקוד לא תקף', itemLabel: (i) => i.description, cancelRent: (i) => { calls.push(['rent', i.id]); return { ok: true }; }, cancelReturn: (i) => { calls.push(['ret', i.id]); return { ok: true }; } };
  const it = item('a1', { description: 'שמלה' });
  const rent = N.scanResultToSequence({ ok: true, kind: 'rent', item: it }, env);
  assert.equal(rent.status, 'ok'); assert.equal(rent.message, 'נלקחה: שמלה'); rent.undo();
  const ret = N.scanResultToSequence({ ok: true, kind: 'return', item: it }, env);
  assert.equal(ret.message, 'הוחזרה: שמלה'); ret.undo();
  assert.deepEqual(calls, [['rent', 'a1'], ['ret', 'a1']]);
  assert.deepEqual(N.scanResultToSequence({ ok: false }, env), { status: 'error', message: 'ברקוד לא תקף' });
  assert.deepEqual(N.scanResultToSequence({ ok: false }, { ...env, errorMessage: null }), { status: 'error', message: 'הסריקה נכשלה' });
  assert.equal(N.scanResultToSequence({ ok: false, cancelled: true }, env).status, 'info');
  assert.equal(N.cleanBarcode(' 12 34\t5 '), '12345');
});

test('dressRefreshKey משתנה כשפריט נוסף / נלקח / נכתב משהו בשרת', () => {
  const a = [item('1'), item('2')];
  const k0 = N.dressRefreshKey(a, 0);
  assert.notEqual(N.dressRefreshKey([...a, item('3')], 0), k0);
  assert.notEqual(N.dressRefreshKey([a[0], { ...a[1], isTaken: true }], 0), k0);
  assert.notEqual(N.dressRefreshKey(a, 1), k0);
  assert.equal(N.dressRefreshKey([...a, item('9', { isDeleted: true })], 0), k0);
});
