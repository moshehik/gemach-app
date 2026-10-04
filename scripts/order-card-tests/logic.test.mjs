// לוגיקה טהורה של הכרטיס החדש (orderCardLogic.js): רשימת השינויים לכל מפתח, ביטול/החזרה, סכומים וחוב, הגדרות (ברירות
// המחדל של הישן), סמני לשוניות, "חסר", אישורים, נעילת אירוע שעבר לפי היום בישראל. רץ ב-3 אזורי זמן (run.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { baseState, item, obligation, payment } from './fixtures.mjs';

const L = await import(pathToFileURL(process.env.PROJ + '/app/components/order-card/orderCardLogic.js').href);
const snapOf = (st) => JSON.parse(JSON.stringify(st));
const keys = (cs) => cs.map(c => c.key).sort();

test('בלי שינויים: רשימה ריקה; snapshot חסר → ריקה', () => {
  const st = baseState();
  assert.deepEqual(L.changesOf(snapOf(st), st), []);
  assert.deepEqual(L.changesOf(null, st), []);
});

test('מפתחות שדות ההזמנה (date/etype/notes/inotes/sig/spacing/xday/cust/del/delcfg/deladdr/delone/field:)', () => {
  const st = baseState();
  const snap = snapOf(st);
  const cur = { ...st, order: { ...st.order, eventDate: '2026-10-09T21:00:00.000Z', isAbroad: true, notes: 'x', internalNotes: 'y', hasSignedRegulations: true, customSpacing: 2, extraDay: 'after', customerId: 'c2', customer: { firstName: 'רחל', lastName: 'לוי' }, isDelivery: true, deliveryCity: 'בית שמש', deliveryAddress: 'רחוב', deliveryOneDayBefore: true, status: 'שולם' } };
  assert.deepEqual(keys(L.changesOf(snap, cur)), ['cust', 'date', 'del', 'delcfg', 'deladdr', 'delone', 'etype', 'field:status', 'inotes', 'notes', 'sig', 'spacing', 'xday'].sort());
  const date = L.changesOf(snap, cur).find(c => c.key === 'date');
  assert.match(date.note, /←/);
  assert.ok(!/\d{1,2}[./]\d{1,2}[./]\d{2,4}/.test(date.note), 'אין תאריך לועזי בהערת השינוי');
});

test('פריטים: הוספה (לוקאלי), הסרה, שחזור, תיקונים, תיקון בוצע, שינוי אחר', () => {
  const st = baseState({ items: [item('a1'), item('a2', { isDeleted: true })] });
  const snap = snapOf(st);
  const cur = { ...st, items: [item('a1', { isDeleted: true }), item('a2', { isDeleted: false }), { _localId: 'L1', dressModelId: 'm', sizeText: '42', price: 120 }] };
  const cs = L.changesOf(snap, cur);
  assert.deepEqual(keys(cs), ['item:add:L1', 'item:rm:a1', 'item:rs:a2']);
  assert.equal(cs.find(c => c.key === 'item:add:L1').amt, 120);
  assert.equal(cs.find(c => c.key === 'item:rm:a1').amt, -150, 'הסרה = מינוס החיובים המקושרים לפריט');
  const cur2 = { ...st, items: [item('a1', { neckAlteration: 2, alterationDetails: 'קיצור' }), item('a2', { isDeleted: true, alterationDone: true })] };
  assert.deepEqual(keys(L.changesOf(snap, cur2)), ['item:alt:a1', 'item:altdone:a2']);
  const cur3 = { ...st, items: [item('a1', { sizeText: '36' }), item('a2', { isDeleted: true })] };
  assert.deepEqual(keys(L.changesOf(snap, cur3)), ['item:mod:a1']);
  const cur4 = { ...st, items: [...st.items, { _localId: 'L2', isDeleted: true }] };
  assert.deepEqual(L.changesOf(snap, cur4), [], 'שורה חדשה שנמחקה לפני שמירה אינה שינוי');
});

test('חיובים ידניים ותשלומים: obl:/pay:; שורות preview/אוטומטיות אינן שינוי', () => {
  const st = baseState();
  const snap = snapOf(st);
  const cur = { ...st, obligations: [...st.obligations.map(o => ({ ...o, isPreview: true })), { _localId: 'M1', amount: 30, description: 'חיוב ידני', isManual: true }], payments: [payment('p1', { isDeleted: true })] };
  const cs = L.changesOf(snap, cur);
  assert.deepEqual(keys(cs), ['obl:M1', 'pay:p1']);
  assert.equal(cs.find(c => c.key === 'obl:M1').amt, 30);
  assert.equal(cs.find(c => c.key === 'pay:p1').amt, 100, 'ביטול תשלום מגדיל את היתרה');
});

test('ביטול שינוי לשורה + החזר ביטול (redo) לכל סוג מפתח', () => {
  const st = baseState({ items: [item('a1'), item('a2', { isDeleted: true })] });
  const snap = snapOf(st);
  let cur = { order: { ...st.order, notes: 'חדש', eventDate: '2026-11-01T22:00:00.000Z', customerId: 'c2', customer: { firstName: 'א' } }, items: [item('a1', { isDeleted: true, neckAlteration: 1, alterationDetails: 'x' }), item('a2'), { _localId: 'L1', dressModelId: 'm', sizeText: '40', price: 100 }], obligations: [...st.obligations, { _localId: 'M1', amount: 30, isManual: true, description: 'ידני' }], payments: [payment('p1', { isDeleted: true })] };
  const all = keys(L.changesOf(snap, cur));
  for (const k of all) {
    const cap = L.captureChange(cur, k);
    const reverted = L.revertChange(cur, snap, k);
    assert.ok(!keys(L.changesOf(snap, reverted)).includes(k), `${k} אמור להיעלם אחרי ביטול`);
    const redone = L.applyCaptured(reverted, cap);
    assert.ok(keys(L.changesOf(snap, redone)).includes(k), `${k} אמור לחזור אחרי redo`);
    assert.deepEqual(keys(L.changesOf(snap, redone)), all, `redo של ${k} מחזיר את כל הרשימה`);
  }
  // ביטול הכל בזה אחר זה = אין שינויים (פריט שהוסר "מסתיר" את שינויי התיקון שלו - הם מופיעים אחרי ביטול ההסרה)
  for (let n = 0; n < 5 && L.changesOf(snap, cur).length; n++) for (const c of L.changesOf(snap, cur)) cur = L.revertChange(cur, snap, c.key);
  assert.deepEqual(L.changesOf(snap, cur), []);
});

test('סכומים: totalRequired של הישן (preview נספר, פריט שנמחק מקומית לא), pendingNet, balanceAfterSave', () => {
  const st = baseState();
  const snap = snapOf(st);
  const t0 = L.computeTotals({ ...st, snapshot: snap, openedDebt: 200 });
  assert.deepEqual([t0.required, t0.paid, t0.balance, t0.pendingNet], [300, 100, 200, 0]);
  const items = [item('a1'), item('a2', { isDeleted: true })];
  const t1 = L.computeTotals({ items, obligations: st.obligations, payments: st.payments, snapshot: snap, openedDebt: 200 });
  assert.equal(t1.required, 150, 'חיוב של פריט שנמחק מקומית (בלי deletedAt) לא נספר');
  assert.equal(t1.pendingNet, -150);
  const t2 = L.computeTotals({ items, obligations: [...st.obligations, { amount: 40, isPreview: true, orderItemId: 'a2' }], payments: st.payments, snapshot: snap });
  assert.equal(t2.required, 190, 'שורת preview נספרת תמיד');
});

test('חוב: freshDebtAfterSave / freshBalanceAfterExit / isDebtUnchangedSinceOpen כמו הישן', () => {
  const upd = { obligations: [{ amount: '300' }], payments: [{ amount: 100 }], totalAmount: 0 };
  assert.deepEqual(L.freshDebtAfterSave(upd, 150), { freshDebtNow: 200, newDebtCreated: true });
  assert.deepEqual(L.freshDebtAfterSave(upd, 200), { freshDebtNow: 200, newDebtCreated: false });
  assert.equal(L.freshBalanceAfterExit({ ...upd, totalAmount: 250, obligations: [{ amount: 300 }] }, 0).freshDebtNow, 150, 'ביציאה totalAmount קודם (כמו בישן)');
  assert.equal(L.freshBalanceAfterExit({ obligations: [{ amount: 50 }], payments: [{ amount: 80 }] }, 0).creditNow, 30);
  assert.equal(L.isDebtUnchangedSinceOpen(200.004, 200), true);
  assert.equal(L.isDebtUnchangedSinceOpen(200, null), false);
});

test('needsAutoRefundBank, mergePendingItems, submittedLocalIdsOf', () => {
  assert.equal(L.needsAutoRefundBank([{ isAutoGenerated: true, bankName: '', bankBranch: '1' }]), true);
  assert.equal(L.needsAutoRefundBank([{ isAutoGenerated: true, bankName: 'x', bankBranch: '1' }]), false);
  assert.equal(L.needsAutoRefundBank([{ isAutoGenerated: true, isExecuted: true }]), false);
  const prev = [{ _localId: 'L1', dressModelId: 'm', sizeText: '1' }, { _localId: 'L2' }];
  assert.deepEqual(L.submittedLocalIdsOf(prev), ['L1']);
  assert.deepEqual(L.mergePendingItems([{ id: 's' }], prev, ['L1']).map(x => x.id || x._localId), ['s', 'L2']);
});

test('parseSettings: ברירות המחדל של הישן כשהשורה חסרה, ופענוח ערכים', () => {
  const s = L.parseSettings([]);
  assert.equal(s.draftsAsDeleted, true);
  assert.equal(s.allowEditPartially, true);
  assert.equal(s.enableLocalDrafts, true, 'הישן: ברירת מחדל true');
  assert.equal(s.nedarimPlusEnabled, true);
  assert.equal(s.orderEditRedirectScreen, 'orders_list');
  assert.equal(s.enableDeliveries, false);
  assert.equal(s.deliverySeparateTab, false);
  const n = L.parseSettings([{ key: 'enable_local_order_drafts', value: 'false' }, { key: 'nedarim_plus_enabled', value: 'x' }, { key: 'order_edit_redirect_screen', value: 'new_order' }, { key: 'max_items_per_order', value: '6' }, { key: 'delivery_price_by_city', value: '{"ירושלים":40}' }, { key: 'enable_order_edit_summary_confirm', value: 'true' }]);
  assert.equal(n.enableLocalDrafts, false);
  assert.equal(n.nedarimPlusEnabled, true, "nedarim: רק 'false' מכבה");
  assert.equal(n.orderEditRedirectScreen, 'new_order');
  assert.equal(n.maxItemsPerOrder, 6);
  assert.deepEqual(n.deliveryPriceByCity, { 'ירושלים': 40 });
  assert.equal(n.enableEditSummaryConfirm, true);
  assert.equal(n.get('missing', 'd'), 'd');
});

test('A6 סמני לשוניות + A7 "חסר" (AMB-10: ת״ז לפי שתי ההגדרות)', () => {
  const s0 = L.parseSettings([]);
  const st = baseState();
  assert.deepEqual(L.tabMarkers({ order: st.order, totals: { balance: 0 }, settings: s0 }), {});
  const m = L.tabMarkers({ order: { ...st.order, isDelivery: true, customer: { ...st.order.customer, email: '' } }, totals: { balance: 50 }, settings: s0 });
  assert.equal(m.details.tip, 'חסר: מייל');
  assert.equal(m.delivery.tip, 'משלוח הוזמן');
  assert.equal(m.payments.tip, 'יש חוב');
  assert.equal(L.tabMarkers({ order: st.order, totals: { balance: -20 }, settings: s0 }).payments.tip, 'יש זיכוי');
  assert.deepEqual(L.customerMissing(st.order.customer, s0), []);
  assert.deepEqual(L.customerMissing(st.order.customer, L.parseSettings([{ key: 'require_customer_id_number', value: 'true' }])).map(x => x.key), ['zeout']);
  assert.deepEqual(L.customerMissing(st.order.customer, L.parseSettings([{ key: 'require_id_for_edit_cancel', value: 'true' }])).map(x => x.key), ['zeout']);
});

test('שערים: zeout רק כשיש ת״ז ללקוח; מושכר חלקי; תיקון בלי פירוט; תאריכים חסרים; ביטול פריט', () => {
  const sId = L.parseSettings([{ key: 'require_id_for_edit_cancel', value: 'true' }]);
  assert.equal(L.zeoutVerificationNeeded(sId, { customer: { zeout: '' } }), false);
  assert.equal(L.zeoutVerificationNeeded(sId, { customer: { zeout: '123' } }), true);
  assert.equal(L.zeoutVerificationNeeded(L.parseSettings([]), { customer: { zeout: '123' } }), false);
  const sNo = L.parseSettings([{ key: 'allow_edit_partially_rented', value: 'false' }]);
  assert.equal(L.isPartiallyRentedBlocked(sNo, [item('a', { isTaken: true })]), true);
  assert.equal(L.isPartiallyRentedBlocked(L.parseSettings([]), [item('a', { isTaken: true })]), false);
  assert.match(L.validateRepairs([item('a', { sleeveAlteration: 1, alterationDetails: ' ' })]), /פירוט תיקון/);
  assert.equal(L.validateRepairs([item('a', { sleeveAlteration: 1, isDeleted: true })]), null);
  assert.ok(!L.hasRequiredDates({ isAbroad: true, fromDate: 'x' }));
  const sMgr = L.parseSettings([{ key: 'require_manager_code_for_item_changes', value: 'true' }]);
  assert.equal(L.cancelledItemNow(sMgr, [item('a1')], [item('a1', { isDeleted: true })]), true);
  assert.equal(L.cancelledItemNow(sMgr, [item('a1', { isDeleted: true })], [item('a1', { isDeleted: true })]), false);
  assert.equal(L.cancelledItemNow(L.parseSettings([]), [item('a1')], [item('a1', { isDeleted: true })]), false);
  // ביקורת W3 #2: שורה מקומית שטרם נשמרה (הוספה שנכשלה) דורשת גם היא אישור מנהל ב-PUT (hasNewAdd בשרת)
  const failedAdd = { _localId: 'L1', isNew: true, dressModelId: 'm2', sizeText: '42' };
  assert.equal(L.pendingAddNow(sMgr, [item('a1'), failedAdd]), true);
  assert.equal(L.pendingAddNow(sMgr, [item('a1')]), false);
  assert.equal(L.pendingAddNow(sMgr, [item('a1'), { ...failedAdd, sizeText: '' }]), false);
  assert.equal(L.pendingAddNow(sMgr, [item('a1'), { ...failedAdd, isNew: false }]), false);
  assert.equal(L.pendingAddNow(L.parseSettings([]), [failedAdd]), false);
});

test('נעילה: אירוע שעבר לפי היום בישראל, לא לפי אזור הזמן של התהליך (רץ ב-3 אזורי זמן)', () => {
  // 7.10 00:30 שעון ישראל = 6.10 21:30Z. אירוע שנשמר כ"חצות ישראל" של 7.10 (6.10 21:00Z) - עדיין היום, לא עבר.
  const now = new Date('2026-10-06T21:30:00.000Z');
  assert.equal(L.isPastEventDate('2026-10-06T21:00:00.000Z', now), false);
  assert.equal(L.isPastEventDate('2026-10-07T00:00:00.000Z', now), false, 'צורת אחסון UTC-חצות של אותו יום');
  assert.equal(L.isPastEventDate('2026-10-05T21:00:00.000Z', now), true, 'אתמול בישראל');
  assert.equal(L.isPastEventDate(null, now), false);
});

test('hebDateOf: תאריך עברי ליום הישראלי בכל אזור זמן', () => {
  const a = L.hebDateOf('2026-10-07T21:00:00.000Z');
  const b = L.hebDateOf('2026-10-08T00:00:00.000Z');
  assert.equal(a, b, 'שתי צורות האחסון של אותו יום');
  assert.ok(/תשפ/.test(a), a);
  assert.equal(L.hebDateOf(''), '');
});

test('אישור מנהל: רמה ↔ בורר, כמו PopupProvider', () => {
  const emps = [
    { id: 1, roleId: 0, canApproveWithoutPayment: true, approvals: { 'feature:item_change_approval': true } },
    { id: 2, roleId: 1, canApproveWithoutPayment: false, approvals: {} },
    { id: 3, roleId: 3, canApproveWithoutPayment: true, approvals: { 'feature:item_change_approval': false } },
  ];
  assert.deepEqual(L.filterApprovers(emps, 'מאשר הזמנה ללא תשלום').map(e => e.id), [1, 3]);
  assert.deepEqual(L.filterApprovers(emps, 'feature:item_change_approval').map(e => e.id), [1]);
  assert.deepEqual(L.filterApprovers(emps, 'מנהל').map(e => e.id), [2]);
  assert.deepEqual(L.approvalLevelOf('debt'), { pickerLevel: 'מאשר הזמנה ללא תשלום', requiredLevel: 'מאשר הזמנה ללא תשלום', featureKey: 'feature:debt_approval' });
  assert.equal(L.approvalLevelOf('feature:locked_order_edit').requiredLevel, 'feature:locked_order_edit');
});

test('טיוטה: buildDraftSummary/buildDraftRows זהים לישן (טקסט שנשמר ב-localStorage ונקרא גם ברשימת ההזמנות)', () => {
  const st = baseState();
  const cur = { ...st, order: { ...st.order, notes: 'שונה' }, items: [...st.items, { _localId: 'L', price: 1 }] };
  assert.deepEqual(L.buildDraftSummary(snapOf(st), cur), ['הערות השתנה', '1 פריטים נוספו']);
  assert.deepEqual(L.buildDraftRows(snapOf(st), cur), [{ icon: '#i-file', text: 'הערות להזמנה' }, { icon: '#i-bag', text: 'פריטים: 1 נוספו' }]);
});

test('formatStockErrors: אותו טקסט כמו ה-alert של הישן + רמז ציפוף', () => {
  const r = L.formatStockErrors([{ dressName: '4512', sizeText: '38', requested: 2, available: 1, isCustomSpacingIssue: true }]);
  assert.equal(r.lines[0].text, '4512 (מידה 38): חסרים 1 במלאי (בגלל ציפוף)');
  assert.equal(r.spacingHint, true);
});

test('obligationIdentityKey כמו הישן', () => {
  assert.equal(L.obligationIdentityKey(obligation('x', { orderItemId: 'i1', description: 'תיקון צוואר 2' })), 'item:i1:תיקון צוואר');
  assert.equal(L.obligationIdentityKey({ description: 'משלוח' }), 'desc:משלוח');
});

// ===================== תיקוני הסקירה =====================
test('סקירה 8: נעילה לפי היום בישראל - מקרה שמבדיל מהלוגיקה המקומית (now 22:30Z, אירוע 00:00Z של אותו יום UTC)', () => {
  // 2026-10-06T22:30Z = 7.10 01:30 בישראל; אירוע 2026-10-06T00:00Z = 6.10 בישראל → עבר. בלוגיקה מקומית ב-UTC שני הרגעים ב-6.10 → "לא עבר".
  assert.equal(L.isPastEventDate('2026-10-06T00:00:00.000Z', new Date('2026-10-06T22:30:00.000Z')), true);
  const localLogic = (ev, now) => new Date(ev).setHours(0, 0, 0, 0) < new Date(now).setHours(0, 0, 0, 0);
  if (process.env.TZ === 'UTC') assert.equal(localLogic('2026-10-06T00:00:00.000Z', '2026-10-06T22:30:00.000Z'), false, 'המקרה באמת מבדיל');
});

test('סקירה 9: סכומים כמחרוזת נספרים כמספרים (requiredOf / paidOf / openedDebtOf / computeTotals)', () => {
  const ob = [{ amount: '150' }, { amount: '50.5' }, { amount: '20', isDeleted: true }];
  const pay = [{ amount: '100' }, { amount: '1', isDeleted: true }];
  assert.equal(L.requiredOf(ob, []), 200.5);
  assert.equal(L.paidOf(pay), 100);
  assert.equal(L.openedDebtOf(ob, pay), 100.5);
  assert.equal(L.computeTotals({ items: [], obligations: ob, payments: pay }).balance, 100.5);
});

test('סקירה 5: עריכה של חיוב אוטומטי שמור ושורת פריט בלי id/_localId הן שינוי (אין "אין שינויים" ששומט עריכה)', () => {
  const st = baseState();
  const snap = snapOf(st);
  const cur = { ...st, obligations: [{ ...st.obligations[0], isDeleted: true }, st.obligations[1]] };
  assert.deepEqual(keys(L.changesOf(snap, cur)), ['obl:ob1']);
  const cur2 = { ...st, items: [...st.items, { dressModelId: 'm', sizeText: '40', price: 90 }] };
  assert.deepEqual(keys(L.changesOf(snap, cur2)), ['item:add:n2']);
  // שורות preview עדיין אינן שינוי
  const cur3 = { ...st, obligations: [...st.obligations.map(o => ({ ...o, isPreview: true, id: undefined }))] };
  assert.deepEqual(L.changesOf(snap, cur3), []);
  // _localId נוסף במקום אחד (edit API) לשורה חדשה בלי מזהה
  const withIds = L.withLocalIds([{ id: 'x' }, { amount: 3 }, { _localId: 'k' }, { isPreview: true }]);
  assert.ok(withIds[1]._localId && !withIds[0]._localId && withIds[2]._localId === 'k' && !withIds[3]._localId);
});

test('סקירה 6: ביטול והחזרה של חיוב ידני חדש בלי id/_localId אחרי חיובים אוטומטיים (מפתח לפי האינדקס ברשימה המלאה)', () => {
  const st = baseState();
  const snap = snapOf(st);
  const cur = { ...st, obligations: [...st.obligations, { amount: 30, isManual: true, description: 'ידני' }] };
  const cs = L.changesOf(snap, cur);
  assert.deepEqual(keys(cs), ['obl:n2']);
  const reverted = L.revertChange(cur, snap, 'obl:n2');
  assert.deepEqual(L.changesOf(snap, reverted), [], 'הביטול באמת מסיר את החיוב');
  assert.equal(reverted.obligations.length, 2);
  const cap = L.captureChange(cur, 'obl:n2');
  assert.deepEqual(keys(L.changesOf(snap, L.applyCaptured(reverted, cap))), ['obl:n2']);
});

test('סקירה 2: debtApprovalCovers - רמה חסרה לא מכסה, עד הרמה מכסה', () => {
  assert.equal(L.debtApprovalCovers(null, 10), false);
  assert.equal(L.debtApprovalCovers(100, 100), true);
  assert.equal(L.debtApprovalCovers(100, 100.5), false);
});
