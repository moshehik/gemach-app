// בדיקות האינטגרציה של כרטיס ההזמנה (מיזוג W2a/W3/W4/W5/W6/W7 על W0+W1): הממצאים בין-הזרמים של הסקירה העצמאית של W5.
// ברמת node: לוגיקה טהורה + חוזה האירועים בין הרייל ל-W4 + בדיקות סטטיות לחיווט. הבדיקה ברמת React (הרייל ו-hook של W4 יחד, עם
// הרינדור האמיתי) היא בהרתמה: scripts/order-card-bg-audit/stages-rail.mjs שלבים R30 / R31. 3 אזורי זמן (run.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { baseOrder, baseState } from './fixtures.mjs';

const P = process.env.PROJ;
const OC = P + '/app/components/order-card/';
const L = await import(pathToFileURL(OC + 'orderCardLogic.js').href);
const D = await import(pathToFileURL(OC + 'parts/ocDetailsLogic.js').href);
const R = await import(pathToFileURL(OC + 'parts/ocRailLogic.js').href);
const read = (f) => fs.readFileSync(OC + f, 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const apply = (o, u) => (u ? { ...o, ...u } : o);

// ---------- (a) הרייל → W4 אחרי שמירה: afterSave ----------
test('a: אחרי שמירה שהצליחה הרייל מבקש תשלום/זיכוי עם afterSave (W4 לא שומר שוב)', async () => {
  const reqs = [];
  const mk = (saveResult) => R.createRailActions({
    getOc: () => ({ saving: false, dirty: true, totals: { balance: 100, pendingNet: 0, savedBalance: 100 }, save: async () => saveResult, goPayments() {}, on: () => () => {} }),
    requestPayment: (...a) => reqs.push(a),
    showSuccess: () => {},
  });
  const pay = await mk({ ok: true, balance: 100, debtCreated: 0, creditNow: 0 }).primary('pay');
  assert.equal(pay.handled, 'pay-window');
  assert.deepEqual(reqs.pop(), ['pay', { afterSave: true }]);
  const credit = await mk({ ok: true, balance: -50, debtCreated: 0, creditNow: 50 }).primary('credit');
  assert.equal(credit.handled, 'credit-window');
  assert.deepEqual(reqs.pop(), ['credit', { afterSave: true }]);
  // "שלם ₪N" / "זכה ₪N" בלי שינויים - אין שמירה, לכן בלי afterSave
  await mk({ ok: true }).payNow('pay');
  assert.deepEqual(reqs.pop(), ['pay']);
});

test('a: requestPaymentEvent שולח detail.afterSave רק כשביקשו; ברירת המחדל זהה לחוזה של W4', () => {
  const seen = [];
  const prev = globalThis.window;
  globalThis.window = new EventTarget();
  globalThis.window.addEventListener(R.OC_PAY_REQUEST_EVENT, (e) => seen.push(e.detail));
  try {
    R.requestPaymentEvent('pay');
    R.requestPaymentEvent('pay', { afterSave: true });
    R.requestPaymentEvent();
  } finally { globalThis.window = prev; }
  assert.deepEqual(seen, [{ kind: 'pay' }, { kind: 'pay', afterSave: true }, { kind: 'auto' }]);
});

test('a (סטטי): W4 - ocRef ב-layout effect, afterSave מדלג על שמירה שנייה ומחכה לרינדור עם ה-state השמור', () => {
  const src = strip(read('hooks/usePaymentActions.js'));
  assert.ok(/const ocRef = useRef\(oc\);\s*useLayoutEffect\(\(\) => \{ ocRef\.current = oc; \}\);/.test(src), 'ocRef מתעדכן ב-layout effect');
  assert.ok(/const payNow = useCallback\(async \(opts = \{\}\) => \{[\s\S]*?if \(o\.dirty && !opts\.afterSave\)/.test(src));
  assert.ok(/const creditNow = useCallback\(async \(opts = \{\}\) => \{[\s\S]*?if \(o\.dirty && !opts\.afterSave\)/.test(src));
  // afterSave לא נפתח מיד (ה-state הישן): נשמר ב-state ונפתח באפקט שאחרי הרינדור
  assert.ok(/if \(d\.afterSave\) \{ setAfterSaveAsk\(\{ kind \}\); return; \}/.test(src));
  assert.ok(/payNow\(\{ afterSave: true \}\)/.test(src) && /creditNow\(\{ afterSave: true \}\)/.test(src));
  const rail = strip(read('parts/ocRailLogic.js'));
  assert.ok(/env\.requestPayment\('pay', \{ afterSave: true \}\)/.test(rail) && /env\.requestPayment\('credit', \{ afterSave: true \}\)/.test(rail));
});

// ---------- (b) pendingDebtBlock ----------
test('b: חסימת היציאה בגלל חוב חדש מסתיימת כשהיתרה השמורה ≤ 0.01 (שולם / זיכוי), ולא לפני', () => {
  assert.equal(L.debtBlockShouldClear(true, 150), false);
  assert.equal(L.debtBlockShouldClear(true, 0.02), false);
  assert.equal(L.debtBlockShouldClear(true, 0.01), true);
  assert.equal(L.debtBlockShouldClear(true, 0), true);
  assert.equal(L.debtBlockShouldClear(true, -30), true);
  assert.equal(L.debtBlockShouldClear(false, 0), false);
  // אחרי שמירה שיצרה חוב ה-snapshot כבר מעודכן, לכן ברינדור שבו החסימה נדלקת היתרה השמורה חיובית
  const st = baseState();
  const snap = { order: st.order, items: st.items, obligations: [...st.obligations, { id: 'new', amount: 150, isDeleted: false, isManual: false }], payments: st.payments, refunds: [] };
  const t = L.computeTotals({ items: snap.items, obligations: snap.obligations, payments: snap.payments, snapshot: snap });
  assert.ok(t.savedBalance > 0.01 && !L.debtBlockShouldClear(true, t.savedBalance));
  // אחרי תשלום מלא (סנכרון מהשרת) - היתרה השמורה 0 והחסימה נופלת
  const paid = { ...snap, payments: [...snap.payments, { id: 'pp', amount: t.savedBalance, isDeleted: false }] };
  const t2 = L.computeTotals({ items: paid.items, obligations: paid.obligations, payments: paid.payments, snapshot: paid });
  assert.ok(L.debtBlockShouldClear(true, t2.savedBalance));
  assert.ok(!L.exitGuardActive(false, false));
});

test('b (סטטי): הבקר מנקה את החסימה באפקט (אחרי הגדרת setPendingDebtBlock)', () => {
  const src = strip(read('useOrderCardController.js'));
  const eff = src.indexOf('debtBlockShouldClear(pendingDebtBlock, totals.savedBalance)');
  assert.ok(eff > src.indexOf('const setPendingDebtBlock = useCallback'), 'האפקט אחרי ההגדרה (אחרת TDZ)');
  assert.ok(/setPendingDebtBlock\(false\)/.test(src.slice(eff, eff + 120)));
});

// ---------- (c) תצוגה מקדימה ----------
test('c: buildPreviewBody - שורה מקומית חצי-ריקה לא נשלחת, שורה מלאה/שמורה נשלחת, extraDay בגוף', () => {
  const full = { _localId: 'l1', dressItem: { id: 'd', dress: { id: 'm' } }, sizeText: '38' };
  const saved = { id: 'a1', dressItem: { id: 'd', dress: { id: 'm' } } };
  const half = { _localId: 'l2', dressModelId: 'm2', sizeText: '42' };
  const body = L.buildPreviewBody([saved, full, half], baseOrder({ extraDay: 'after' }));
  assert.deepEqual(body.items.map((i) => i.id || i._localId), ['a1', 'l1']);
  assert.equal(body.order.extraDay, 'after');
  assert.equal(L.isHalfFilledLocalItem(half), true);
  assert.equal(L.isHalfFilledLocalItem(saved), false);
  assert.equal(L.isHalfFilledLocalItem(null), false);
});

test('c: pendingNetOf = אותה נוסחה כמו totals.pendingNet (חיוב ממתין / זיכוי ממתין / 0)', () => {
  const st = baseState();
  const snap = { order: st.order, items: st.items, obligations: st.obligations, payments: st.payments, refunds: [] };
  const required = L.requiredOf(st.obligations, st.items), paid = L.paidOf(st.payments);
  assert.equal(L.pendingNetOf(snap, required, paid), 0);
  assert.equal(L.pendingNetOf(snap, required + 150, paid), 150);
  assert.equal(L.pendingNetOf(snap, required - 80, paid), -80);
  const t = L.computeTotals({ items: st.items, obligations: [...st.obligations, { amount: 150, isPreview: true, isManual: false }], payments: st.payments, snapshot: snap });
  assert.equal(t.pendingNet, L.pendingNetOf(snap, required + 150, paid));
});

test('c (סטטי): בקר - preview בכל לשונית, ניקוי שורות isPreview כשאין שינוי מחיר, ו-seq עולה בכל ריצה ובניקוי', () => {
  const src = strip(read('useOrderCardController.js'));
  const i = src.indexOf('const previewActive = useMemo');
  const blk = src.slice(i, src.indexOf('// חסימת היציאה בגלל חוב חדש', i) > -1 ? src.indexOf('// חסימת היציאה', i) : i + 3000);
  assert.ok(!/tab !== 'payments'|tab === 'payments'/.test(blk), 'אין תלות בלשונית');
  assert.ok(/const mySeq = \+\+previewSeqRef\.current;\s*if \(!previewActive\) \{[\s\S]*?filter\(o => !o\.isPreview\)[\s\S]*?return undefined;/.test(blk), 'bump לפני ה-return המוקדם + הסרת שורות preview');
  assert.ok(/return \(\) => \{ clearTimeout\(timer\); previewSeqRef\.current \+= 1; \};/.test(blk), 'bump בניקוי');
  assert.ok(/dirty && !!order\?\.orderId && pricingInputsChanged\(snapshot, items, order\)/.test(blk));
  const flows = strip(read('orderCardFlows.js'));
  assert.ok(/pendingNet: pendingNetOf\(st\.snapshot, previewTotal, totalPaid\)/.test(flows), 'D1 מקבל pendingNet');
});

test('c (סטטי): preview-pricing בשרת מכבד extraDay (R-1 של W2a)', () => {
  const route = fs.readFileSync(P + '/app/api/orders/[id]/preview-pricing/route.js', 'utf8');
  assert.ok(/extraDay: orderOverrides\.extraDay !== undefined \? orderOverrides\.extraDay : baseOrder\.extraDay/.test(route));
});

// ---------- (d) רייל: ביטול כפול, a11y ----------
test('d (סטטי): ביטול שורה - התעלמות מלחיצה בזמן "נעלמת"; החזר ביטול מנוטרל בזמן שמירה; aria/מיקוד', () => {
  const src = strip(read('parts/OcRail.js'));
  assert.ok(/const undo = \(key\) => \{\s*if \(leavingRef\.current\) return;\s*leavingRef\.current = true;/.test(src));
  assert.ok(/leavingRef\.current = false;\s*setLeaving\(null\);\s*ocRef\.current\.undoChange\(key\)/.test(src));
  assert.ok(/data-act="redo"[^>]*disabled=\{busy\}/.test(src));
  assert.ok(/aria-expanded=\{sheet \? open : true\}/.test(src), 'במסך רחב הרייל תמיד פתוח');
  assert.ok(/className="gl del" role="img"/.test(src) && /className="gl itm-c" role="img"/.test(src));
  assert.ok(/e\.key === 'Escape'/.test(src) && /pointerdown/.test(src), 'Esc ולחיצה מחוץ לגיליון סוגרים אותו');
  assert.ok(/data-oc-focus-fallback/.test(src));
  const ui = strip(read('OcUi.js'));
  assert.ok(/isConnected === false[\s\S]*data-oc-focus-fallback/.test(ui), 'המיקוד חוזר ללחצן-גיבוי כשהלחצן שפתח את החלון נעלם');
});

// ---------- (e) debtApproved ----------
test('e (סטטי): "השאר חוב" - האירוע נשלח אחרי שחלון התשלום נסגר (לא ביציאה), הרייל מאזין', () => {
  const hook = strip(read('hooks/usePaymentActions.js'));
  const i = hook.indexOf('if (r.leftDebt) {');
  assert.ok(i > hook.indexOf("ui.openDialog(D.Pay"), 'אחרי הסגירה');
  assert.ok(/ctx\.source !== 'exit' && ocRef\.current\.announceDebtLeft/.test(hook.slice(i, i + 700)));
  const ctrl = strip(read('useOrderCardController.js'));
  assert.ok(/announceDebtLeft = useCallback\(\(payload\) => emit\('debtApproved', payload\)/.test(ctrl));
  assert.ok(/announceDebtLeft,/.test(ctrl));
  assert.ok(/useOcEvent\(oc, 'debtApproved'/.test(strip(read('parts/OcRail.js'))));
  // D6 "חוב" - רק אם השמירה פתחה חלון גבייה (pending חי)
  const reqs = [];
  const a = R.createRailActions({ getOc: () => ({}), requestPayment: () => {}, showSuccess: (x) => reqs.push(x) });
  assert.equal(a.debtLeft({ amount: 50 }), false, 'בלי שמירה שקדמה - אין D6');
});

// ---------- (f) ביטול/החזרה של יום נוסף ותאריך (אחרי מיזוג התיקון של W2a לבסיס revertChange) ----------
const ABROAD = baseOrder({ isAbroad: true, eventDate: '2026-10-04T21:00:00.000Z', fromDate: '2026-10-04T21:00:00.000Z', toDate: '2026-10-12T21:00:00.000Z', returnDate: '2026-10-12T21:00:00.000Z' });
const cur = (order) => ({ order, items: [], obligations: [], payments: [] });
test('f: יום נוסף (לפני / אחרי) + שינוי תאריך - ביטול כל שורה בכל סדר מחזיר בדיוק את ה-snapshot, והחזרה מחזירה את המצב', () => {
  for (const which of ['before', 'after']) {
    const snap = cur(ABROAD);
    // בחירת טווח חדש מנקה את היום הנוסף (rangeUpdates) - לכן קודם הטווח ואז היום הנוסף; יום נוסף בלבד = שורות date + xday
    const newRange = apply(ABROAD, D.rangeUpdates(ABROAD, '2026-11-01', '2026-11-08'));
    const ranged = apply(newRange, D.extraDayUpdates(newRange, which));
    const rows = L.changesOf(snap, cur(ranged)).map((c) => c.key);
    assert.ok(rows.includes('xday') && rows.includes('date'), `שתי השורות מוצגות (${rows})`);
    for (const order of [['date', 'xday'], ['xday', 'date']]) {
      let st = cur(ranged);
      const caps = [];
      for (const k of order) { caps.push(L.captureChange(st, k)); st = L.revertChange(st, snap, k); }
      assert.deepEqual(L.changesOf(snap, st), [], `${which} ${order}: אין שארית אחרי ביטול שתי השורות`);
      assert.equal(st.order.extraDay, null);
      assert.equal(new Date(st.order.toDate).getTime(), new Date(ABROAD.toDate).getTime());
      assert.equal(new Date(st.order.fromDate).getTime(), new Date(ABROAD.fromDate).getTime());
      // החזר ביטול (בסדר הפוך): חוזרים לאותם שדות
      let redone = st;
      for (const cap of caps.slice().reverse()) redone = L.applyCaptured(redone, cap);
      assert.equal(redone.order.extraDay, ranged.extraDay, `${which} ${order}: redo`);
      assert.equal(new Date(redone.order.toDate).getTime(), new Date(ranged.toDate).getTime());
      assert.equal(new Date(redone.order.fromDate).getTime(), new Date(ranged.fromDate).getTime());
    }
  }
});

// ---------- (g) syncItems ----------
test('g (סטטי): W3 מעדכן פריטים שכבר נשמרו בשרת דרך oc.syncItems (בלי fallback ל-edit.setItems); אף זרם אחר לא מעדכן פריטים ישירות', () => {
  const items = strip(read('hooks/useItemActions.js'));
  assert.ok(/syncItems: \(fn\) => ocRef\.current\.syncItems\(fn\)/.test(items));
  assert.ok(!/typeof [a-z.]*syncItems === 'function'/.test(items), 'ה-fallback הישן הוסר');
  for (const f of ['hooks/usePaymentActions.js', 'parts/OcRail.js', 'parts/ocDocsActions.js', 'parts/OcMailSheet.js', 'parts/OcHistoryTable.js', 'parts/OcStagesCard.js']) {
    assert.ok(!/edit\.setItems|\bsetItems\(/.test(strip(read(f))), `${f}: אין עדכון פריטים ישיר`);
  }
});

// ---------- OcUi: Esc בחלון שמטפל בו בעצמו (גיליון המייל של W7) לא נבלע (תיקון מיזוג W4+W7) ----------
test('OcUi: dismissable:false משאיר את Esc לחלון עצמו; dismissable:() => false (חיוב רץ) בולע אותו', () => {
  const ui = strip(read('OcUi.js'));
  assert.ok(/if \(!canDismiss\(top\.opts\)\) \{ if \(typeof top\.opts\.dismissable === 'function'\) \{ e\.stopImmediatePropagation\(\); e\.preventDefault\(\); \} return; \}/.test(ui));
  assert.ok(/dismissable: false/.test(strip(read('parts/OcMailSheet.js'))), 'גיליון המייל מטפל ב-Esc בעצמו');
  assert.ok(/dismissable: \(\) => !actions\.isBusy\(\)/.test(strip(read('hooks/usePaymentActions.js'))));
});
