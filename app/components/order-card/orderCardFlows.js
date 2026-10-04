// orderCardFlows.js — זרימות השמירה/היציאה/המחיקה/החתימה/ביטול השינויים/השחרור של כרטיס ההזמנה החדש, כפונקציות async
// עם תלויות מוזרקות (fetch, ui, דיאלוגים, קריאת state ו-setters). כך הן רצות גם ב-node (scripts/order-card-tests/*) עם fetch
// מדומה, והבדיקות משוות את ה-endpoints וגופי הבקשות לכרטיס הישן. ה-hook (useOrderCardController.js) רק מחבר אותן ל-React.
//
// ===== מפת פורט (פונקציה כאן ← מקור ב-app/orders/[id]/LegacyOrderPage.js) =====
// requestZeout ← :309-319 (window.customPrompt → ui.prompt)
// putOrder ← :555-595 (alert → ui.alert; confirm() של 409 → OcConflictDialog עם 3 בחירות R12; 409 חוסר מלאי → R48, G12)
// confirmSaveSummaryIfNeeded ← :606-661 (חלון → slot SummaryDialog)
// save ← handleSave :670-981 (שערים באותו סדר; A18: אין חלון חוב לפני ה-PUT - ר' W1-NOTES "חוב")
// applySaved ← :906-915 ; applyServerOrder ← handleOrderUpdate :990-1023
// exit ← handleExit :1055-1277 (customThreeWayConfirm → slot ExitDialog; customAuthPrompt → approve)
// discardAll ← handleCancelChanges :1321-1367 (customConfirm → slot DiscardDialog)
// deleteOrder ← handleDeleteOrder :1370-1406
// unlock ← handleUnlock :1410-1428 (customAuthPrompt+verify-pin → approve)
// toggleSignature ← handleToggleSignature :1434-1454
// reload ← reloadOrderFromServer :526-550
// הקריאות ל-window.customConfirm/customAuthPrompt/customPrompt/alert/confirm הוחלפו כולן ב-ui.* / approve (נאכף בבדיקה סטטית).

import {
  buildPutPayload, buildPreviewBody, buildValidateInventoryBody, buildDraftSummary, cancelledItemNow, pendingAddNow, changesOf,
  formatStockErrors, freshBalanceAfterExit, freshDebtAfterSave, hasRequiredDates, isDebtUnchangedSinceOpen,
  isPartiallyRentedBlocked, mergePendingItems, missingDatesMessage, needsAutoRefundBank, obligationIdentityKey,
  requiredOf, paidOf, submittedLocalIdsOf, validateRepairs, zeoutVerificationNeeded, DELETE_BLOCKED_STATUSES,
  fmtMoney, debtApprovalCovers, openedDebtOf, unsavedCardChargeMessage
} from './orderCardLogic';
import { resolveOrderRedirectHref } from '../../../lib/orderRedirectScreens';
import { calculateOrderStatus } from '../../../lib/orderStatus';

const jsonOf = async (res) => { try { return await res.clone().json(); } catch { return null; } };

/**
 * @typedef {object} FlowEnv
 * @property {typeof fetch} fetch
 * @property {object} ui            useOcUi()
 * @property {object} dialogs       רכיבי ה-slots: ConflictDialog, StockDialog, SummaryDialog, ExitDialog, DiscardDialog
 * @property {string|number} routeId  המזהה מה-URL (הישן: id) — ל-PUT/cancel-changes/חתימה
 * @property {() => object} get     מצב עדכני: {order,items,obligations,payments,refunds,snapshot,openedDebt,settings,debtApproved}
 * @property {object} set           {order,items,obligations,payments,refunds,tab,saving} — כל אחד מקבל ערך או פונקציה
 * @property {(snap:object)=>void} setSnapshot
 * @property {(n:number|null)=>void} setOpenedDebt
 * @property {(id:string|false)=>void} setDebtApproved
 * @property {{pendingDebtBlock:boolean, bankPromptedOnExit:boolean}} flags  אובייקט משותף (ref)
 * @property {(kind:string, reason:string)=>Promise<{employeeId:string,employeeName:string,pin:string}|null>} approve
 * @property {(href:string)=>void} navigate
 * @property {(type:string, payload?:object)=>number} emit  מחזיר את מספר המאזינים
 * @property {()=>void} bumpHistory
 * @property {()=>void} clearRedo
 */
export function createOrderCardFlows(env) {
  const { ui } = env;
  const f = (...a) => env.fetch(...a);
  const toastError = (msg) => ui.toast('error', msg || 'שגיאה בשמירת הנתונים.', '');

  async function requestZeout() {
    const { settings, order } = env.get();
    if (!zeoutVerificationNeeded(settings, order)) return null;
    const v = await ui.prompt({
      title: 'אימות תעודת זהות', sub: 'עריכה/ביטול דורשים אימות תעודת זהות של הלקוח. נא להזין ת״ז:',
      label: 'תעודת זהות', icon: 'file', inputMode: 'numeric', dir: 'ltr', placeholder: '000000000', okText: 'אישור', cancelText: 'ביטול'
    });
    return v ? String(v).trim() : null;
  }

  async function reload() {
    try {
      const res = await f(`/api/orders/${env.routeId}`);
      if (!res.ok) return false;
      const data = await res.json();
      const loadedItems = data.items || [];
      const loadedObligations = data.obligations || [];
      const loadedPayments = data.payments || [];
      const loadedRefunds = data.refunds || [];
      env.set.order(data);
      env.set.items(loadedItems);
      env.set.obligations(loadedObligations);
      env.set.payments(loadedPayments);
      env.set.refunds(loadedRefunds);
      env.setSnapshot({ order: data, items: loadedItems, obligations: loadedObligations, payments: loadedPayments, refunds: loadedRefunds });
      env.setOpenedDebt(openedDebtOf(loadedObligations, loadedPayments));
      env.clearRedo();
      env.bumpHistory();
      return true;
    } catch (err) {
      console.error('Failed to reload order', err);
      return false;
    }
  }

  // מחזיר {res} | {cancelled:true} | {reloaded:true} | {stock:true}
  async function putOrder(payload) {
    const { settings, items } = env.get();
    if (isPartiallyRentedBlocked(settings, items)) {
      await ui.alert({ title: 'לא ניתן לשמור', sub: 'לא ניתן לערוך הזמנה שהושכרה חלקית - חסום בהגדרות (allow_edit_partially_rented).', kind: 'error' });
      return { cancelled: true };
    }
    let zeoutForRequest = null;
    if (zeoutVerificationNeeded(settings, env.get().order)) {
      zeoutForRequest = await requestZeout();
      if (!zeoutForRequest) {
        ui.toast('error', 'עריכה בוטלה - לא הוזנה תעודת זהות.', '');
        return { cancelled: true };
      }
      payload = { ...payload, zeout: zeoutForRequest };
    }
    const send = (body) => f(`/api/orders/${env.routeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(zeoutForRequest ? { 'x-zeout': zeoutForRequest } : {}) },
      body: JSON.stringify(body)
    });
    let res = await send(payload);
    // חוזה W0 §1.4: חיוב ידני חדש / מחיקת חיוב ידני שמור בכרטיס החדש דורש feature:manual_charge_add (R35/AMB-16). כשלעובד המחובר
    // אין את ההרשאה השרת מחזיר 403 MANUAL_CHARGE_APPROVAL_REQUIRED → אישור מנהל ושליחה חוזרת עם המאשר (השרת מאמת את הקוד שוב).
    if (res.status === 403) {
      const errData = await jsonOf(res);
      if (errData && errData.code === 'MANUAL_CHARGE_APPROVAL_REQUIRED') {
        const a = await env.approve('feature:manual_charge_add', 'הוספה או מחיקה של חיוב ידני דורשת אישור מנהל.');
        if (!a) { ui.toast('error', 'השמירה בוטלה: חיוב ידני דורש אישור מנהל.', ''); return { cancelled: true }; }
        payload = { ...payload, manualChargeApproverId: a.employeeId, manualChargeApproverPin: a.pin };
        res = await send(payload);
      }
    }
    if (res.status === 401 || res.status === 403 || res.status === 400) {
      const errData = await jsonOf(res);
      await ui.alert({ title: 'השמירה נכשלה', sub: errData?.error || 'שגיאת אימות תעודת זהות.', kind: 'error' });
      return { res, handled: true };
    }
    if (res.status !== 409) return { res };
    const body = await jsonOf(res);
    // G12: חוסר מלאי מחזיר גם הוא 409 (route.js:542-547) - מבחינים לפי code (W0: 'STOCK_SHORTAGE' / 'CONFLICT') או validationErrors
    if (body && body.code !== 'CONFLICT' && (body.code === 'STOCK_SHORTAGE' || Array.isArray(body.validationErrors))) {
      await ui.openDialog(env.dialogs.StockDialog, { message: body.error || 'אחד או יותר מהפריטים אינם זמינים במלאי בתאריכים החדשים.', ...formatStockErrors(body.validationErrors || []) });
      return { stock: true };
    }
    const baseMsg = (body && body.message) || 'ההזמנה עודכנה בשרת מאז הטעינה האחרונה של הכרטיס.';
    const choice = await ui.openDialog(env.dialogs.ConflictDialog, { message: baseMsg });
    if (choice === 'overwrite') return { res: await send({ ...payload, overwriteConflict: true }) };
    if (choice === 'reload') { await reload(); return { reloaded: true }; }
    return { cancelled: true };
  }

  // כמו confirmSaveSummaryIfNeeded: רק כש-enable_order_edit_summary_confirm. summaryConfirmed=true כשהקורא (הרייל, W5) כבר הציג D1.
  async function confirmSummaryIfNeeded(currentOrder, st, summaryConfirmed, intent) {
    if (!st.settings.enableEditSummaryConfirm || !currentOrder?.orderId) return { proceed: true };
    const totalRequired = requiredOf(st.obligations, st.items);
    const totalPaid = paidOf(st.payments);
    let previewObligations = st.obligations;
    let previewTotal = totalRequired;
    try {
      const res = await f(`/api/orders/${currentOrder.orderId}/preview-pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPreviewBody(st.items, currentOrder))
      });
      if (res.ok) {
        const data = await res.json();
        const manual = st.obligations.filter(o => o.isManual !== false && !o.isDeleted);
        const autoPreview = (data.newObligations || []).map(o => ({ ...o, isPreview: true }));
        previewObligations = [...manual, ...autoPreview];
        previewTotal = previewObligations.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
      }
    } catch (err) {
      console.error('Failed to compute pre-save summary preview', err);
    }
    if (!summaryConfirmed) {
      const ok = await ui.openDialog(env.dialogs.SummaryDialog, {
        intent,
        obligations: previewObligations,
        totalRequired: previewTotal,
        totalPaid,
        savedObligationKeys: new Set((st.snapshot?.obligations || []).filter(so => !so.isDeleted).map(so => obligationIdentityKey(so))),
        changes: changesOf(st.snapshot, st)
      });
      if (!ok) return { proceed: false };
    }
    return { proceed: true, previewObligations, previewTotal };
  }

  function applySaved(updatedOrder, submittedLocalIds, prevItems) {
    env.set.order(updatedOrder);
    const mergedItems = mergePendingItems(updatedOrder.items || [], prevItems, submittedLocalIds);
    env.set.items(mergedItems);
    env.set.obligations(updatedOrder.obligations || []);
    env.set.payments(updatedOrder.payments || []);
    env.set.refunds(updatedOrder.refunds || []);
    // ה-snapshot = מצב השרת (בלי שורות לוקאליות שעוד לא נשלחו - הן נשארות "שינוי" ברייל)
    env.setSnapshot({ order: updatedOrder, items: updatedOrder.items || [], obligations: updatedOrder.obligations || [], payments: updatedOrder.payments || [], refunds: updatedOrder.refunds || [] });
    env.clearRedo();
    env.bumpHistory();
  }

  /**
   * שמירה (A18). intent: 'save' | 'pay' | 'credit' (משנה רק את התשובה לרייל - כל השערים זהים).
   * @returns {Promise<{ok:boolean, order?:object, debtCreated?:number, creditNow?:number, noop?:boolean, cancelled?:boolean, reloaded?:boolean, stock?:boolean, error?:string}>}
   */
  // mode: 'save' (גוף handleSave) | 'exit' (גוף handleExit). force: PUT גם בלי שינויים (יציאה חסומה בחוב - הישן שולח שוב עם
  // debtApprovedBy). post:false = בלי עיבוד אחרי השמירה (היציאה עושה את שלה). כל השערים זהים בשני המצבים (סקירה, סעיף 7).
  async function saveCore({ intent = 'save', summaryConfirmed = false, debtApprovedBy: preApproved = null, mode = 'save', force = false, post = true } = {}) {
    const st = env.get(); // צילום מצב ברגע הלחיצה = ה-closure של handleSave בישן
    const currentOrder = st.order;
    if (!currentOrder) { await ui.alert({ title: 'שגיאה', sub: 'שגיאה: נתוני ההזמנה לא טוענו כראוי', kind: 'error' }); return { ok: false }; }
    // R49 "אין שינויים לשמירה": בלי PUT (H32 - שמירה בלי שינוי לא כותבת שורה)
    if (!force && !changesOf(st.snapshot, st).length) {
      ui.toast('info', 'אין שינויים לשמירה', '');
      return { ok: true, noop: true, order: currentOrder };
    }
    env.set.saving(true);
    try {
      const repairErr = validateRepairs(st.items);
      if (repairErr) { await ui.alert({ title: 'חסר פירוט תיקון', sub: repairErr, kind: 'error' }); return { ok: false, cancelled: true }; }
      const activeItems = (st.items || []).filter(i => !i.isDeleted);
      const hasDates = hasRequiredDates(currentOrder);
      if (activeItems.length > 0 && !hasDates) { await ui.alert({ title: 'חסר תאריך', sub: missingDatesMessage(currentOrder), kind: 'error' }); return { ok: false, cancelled: true }; }
      if (activeItems.length > 0 && hasDates) {
        try {
          const validateRes = await f('/api/orders/validate-inventory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildValidateInventoryBody(currentOrder, activeItems))
          });
          const validateData = await validateRes.json();
          if (validateData.error) { await ui.alert({ title: 'שגיאה', sub: `שגיאה: ${validateData.error}`, kind: 'error' }); return { ok: false }; }
          if (!validateData.valid) {
            await ui.openDialog(env.dialogs.StockDialog, { message: 'לא ניתן לשמור את ההזמנה עקב חוסר במלאי לתאריכים המבוקשים.', ...formatStockErrors(validateData.errors || []) });
            return { ok: false, stock: true };
          }
        } catch (err) {
          console.error('Validation fetch error', err);
          await ui.alert({ title: 'שגיאה', sub: 'שגיאה בבדיקת המלאי מול השרת.', kind: 'error' });
          return { ok: false };
        }
      }
      const summary = await confirmSummaryIfNeeded(currentOrder, st, summaryConfirmed, mode === 'exit' ? 'exit' : intent);
      if (!summary.proceed) return { ok: false, cancelled: true };
      if (summary.previewObligations) env.set.obligations(summary.previewObligations);

      // A18/R46: אין חלון "מאשר הזמנה ללא תשלום" לפני ה-PUT - "השאר חוב (באישור מנהל)" מוצע רק בחלון התשלום אחרי השמירה
      // (oc.approveDebt). כשהקורא כבר אישר (preApproved) הוא נשלח כמו בישן ונרשם DEBT_APPROVED בשרת.
      const debtApprovedBy = preApproved || null;

      let managerAuth = null;
      // ביטול פריט שנשמר, או שורה שטרם נשמרה (הוספה שנכשלה) — השרת דורש אישור מנהל בשני המקרים (hasNewCancel / hasNewAdd)
      if (cancelledItemNow(st.settings, st.snapshot?.items || [], st.items) || pendingAddNow(st.settings, st.items)) {
        const a = await env.approve('feature:item_change_approval', 'הוספה או ביטול של פריט בהזמנה קיימת דורשים גם אישור מנהל (בנוסף לאימות ת״ז).');
        if (!a) { ui.toast('error', 'השמירה בוטלה: הוספה או ביטול של פריט דורשים אישור מנהל.', ''); return { ok: false, cancelled: true }; }
        managerAuth = { employeeId: a.employeeId, pin: a.pin };
      }

      const submittedLocalIds = submittedLocalIdsOf(st.items);
      const payload = buildPutPayload(currentOrder, { items: st.items, obligations: st.obligations, payments: st.payments, mode, debtApprovedBy, managerAuth, orderDateApproval: null });
      const r = await putOrder(payload);
      managerAuth = null;
      if (r.reloaded) { ui.toast('info', 'הנתונים נטענו מחדש מהשרת', 'בדקו את הפרטים ושמרו שוב.'); return { ok: false, reloaded: true }; }
      if (r.cancelled || r.stock) return { ok: false, cancelled: !!r.cancelled, stock: !!r.stock };
      const res = r.res;
      if (!res.ok) {
        if (r.handled) return { ok: false };
        const errorData = await jsonOf(res);
        const msg = (errorData && (errorData.message || errorData.error)) || 'שגיאה בשמירת הנתונים.';
        toastError(msg);
        return { ok: false, error: msg };
      }
      const updatedOrder = await res.json();
      if (!post) return { ok: true, order: updatedOrder, submittedLocalIds };
      applySaved(updatedOrder, submittedLocalIds, env.get().items);
      if (needsAutoRefundBank(updatedOrder.refunds || [])) {
        env.set.tab('payments');
        env.emit('autoRefundNeedsBank', { source: 'save' });
      }
      const { freshDebtNow, newDebtCreated } = freshDebtAfterSave(updatedOrder, st.openedDebt);
      if (newDebtCreated) {
        // אישור חוב מכסה רק עד הסכום שאושר (סקירה, סעיף 2): חוב חדש מעל הרמה המאושרת מבטל את האישור ונועל את היציאה שוב
        if (debtApprovedBy) env.flags.approvedDebtLevel = freshDebtNow;
        const covered = !!debtApprovedBy || (typeof st.debtApproved === 'string' && debtApprovalCovers(env.flags.approvedDebtLevel, freshDebtNow));
        if (!covered) { if (st.debtApproved) env.setDebtApproved(false); env.flags.pendingDebtBlock = true; }
        env.set.tab('payments');
        const listeners = env.emit('debtCreated', { amount: freshDebtNow, source: 'save', intent });
        if (!listeners) ui.toast('charge', `נוצר חיוב חדש ${fmtMoney(freshDebtNow)}`, 'יש להשלים את הגבייה בלשונית תשלומים.');
      }
      return { ok: true, order: updatedOrder, debtCreated: newDebtCreated ? freshDebtNow : 0, creditNow: freshDebtNow < 0 ? -freshDebtNow : 0, balance: freshDebtNow };
    } catch (err) {
      console.error(err);
      toastError(err.message || 'שגיאה בשמירת הנתונים.');
      return { ok: false, error: err.message };
    } finally {
      env.set.saving(false);
    }
  }

  // שומר מפני פעולה שנייה בזמן שפעולה רצה (לחיצה כפולה / יציאה באמצע שמירה) - סקירה, סעיף 4
  let inFlight = null;
  const exclusive = (name, fn, busyValue) => async (...args) => {
    if (inFlight) return typeof busyValue === 'function' ? busyValue(inFlight) : busyValue;
    inFlight = name;
    try { return await fn(...args); } finally { inFlight = null; }
  };
  const save = exclusive('save', (opts = {}) => saveCore({ ...opts, mode: 'save', force: false, post: true }), (b) => ({ ok: false, busy: b }));

  // = handleOrderUpdate: כל הקוראים כבר סבבו לשרת (פריט/זיכוי/חישוב מחדש/השכרה...) - סנכרון, לא עריכה.
  function applyServerOrder(updatedOrder, { savedLocalId } = {}) {
    const st = env.get();
    const mergedItems = mergePendingItems(updatedOrder.items || [], st.items, savedLocalId ? [savedLocalId] : []);
    env.set.order(updatedOrder);
    env.set.items(mergedItems);
    env.set.obligations(updatedOrder.obligations || []);
    env.set.payments(updatedOrder.payments || []);
    env.set.refunds(updatedOrder.refunds || []);
    env.setSnapshot({ order: updatedOrder, items: updatedOrder.items || [], obligations: updatedOrder.obligations || [], payments: updatedOrder.payments || [], refunds: updatedOrder.refunds || [] });
    env.bumpHistory();
    // הישן: רק בנווה (enable_order_edit_summary_confirm) פותח "השלמת תשלום". כאן: אירוע debtCreated (הרייל/תשלומים מחליטים)
    if (st.settings.enableEditSummaryConfirm) {
      const { freshDebtNow, newDebtCreated } = freshDebtAfterSave(updatedOrder, st.openedDebt);
      if (newDebtCreated) {
        env.set.tab('payments');
        env.emit('debtCreated', { amount: freshDebtNow, source: 'server-action' });
      }
    }
  }

  async function exitCore(href) {
    const st = env.get();
    const order = st.order;
    if (!order) { env.navigate(href || '/orders'); return { left: true }; }
    const fallbackExitHref = resolveOrderRedirectHref(st.settings.orderEditRedirectScreen, { orderId: order.orderId, customerId: order.customerId });
    const go = () => { env.navigate(href || fallbackExitHref); return { left: true }; };
    const dirty = changesOf(st.snapshot, st).length > 0;
    const blocked = !!env.flags.pendingDebtBlock;
    if (!dirty && !blocked) return go();
    if (dirty && !blocked) {
      const choice = await ui.openDialog(env.dialogs.ExitDialog, { changes: changesOf(st.snapshot, st) });
      if (choice === 'discard') {
        const cardMsg = unsavedCardChargeMessage(st.payments);
        if (cardMsg) { await ui.alert({ kind: 'error', title: 'לא ניתן לצאת בלי לשמור', sub: cardMsg }); return { left: false, cancelled: true }; }
        return go();
      }
      if (choice !== 'save') return { left: false, cancelled: true };
    }
    // A18: אין אישור חוב לפני ה-PUT. אישור קודם (oc.approveDebt) נשלח כמו בישן - רק אם הוא מכסה את החוב הנוכחי (סקירה, סעיף 2)
    const approvedId = typeof st.debtApproved === 'string' ? st.debtApproved : null;
    const clientDebt = requiredOf(st.obligations, st.items) - paidOf(st.payments);
    const exitDebtApprovedBy = approvedId && debtApprovalCovers(env.flags.approvedDebtLevel, clientDebt) ? approvedId : null;
    // "שמור וצא" עובר דרך אותה שמירה עם כל השערים (תיקון, תאריכים, מלאי, סיכום, ת״ז, אישור ביטול פריט) - סקירה, סעיף 7;
    // גוף ה-PUT = גוף handleExit של הישן
    const r = await saveCore({ intent: 'save', mode: 'exit', debtApprovedBy: exitDebtApprovedBy, force: blocked, post: false });
    if (r.reloaded) { await ui.alert({ title: 'הנתונים נטענו מחדש', sub: 'הנתונים נטענו מחדש מהשרת. בדוק את ההזמנה ושמור שוב לפני היציאה.' }); return { left: false }; }
    if (!r.ok) return { left: false, cancelled: !!(r.cancelled || r.stock) };
    if (r.noop) return go();
    const updatedOrder = r.order;
    const { submittedLocalIds } = r;
    try {
      const { freshDebtNow, creditNow, newDebtCreated } = freshBalanceAfterExit(updatedOrder, st.openedDebt);
      const covered = !!exitDebtApprovedBy && debtApprovalCovers(env.flags.approvedDebtLevel, freshDebtNow);
      if (newDebtCreated && !covered) {
        if (approvedId) env.setDebtApproved(false);
        applySaved(updatedOrder, submittedLocalIds, env.get().items);
        env.flags.pendingDebtBlock = true;
        env.set.tab('payments');
        const listeners = env.emit('debtCreated', { amount: freshDebtNow, source: 'exit', href: href || fallbackExitHref });
        if (!listeners) {
          await ui.alert({ title: 'נוצר חיוב חדש', sub: `השינויים נשמרו, אך נוצר חיוב חדש של ${fmtMoney(freshDebtNow)} (למשל בעבור משלוח או פריט שנוסף). לא ניתן לצאת מהכרטיס לפני שמשלימים את הגבייה, או יוצאים באישור מנהל - נשארת בלשונית תשלומים.` });
        }
        return { left: false, blocked: 'debt' };
      }
      if (needsAutoRefundBank(updatedOrder.refunds || []) && !env.flags.bankPromptedOnExit) {
        env.flags.bankPromptedOnExit = true;
        applySaved(updatedOrder, submittedLocalIds, env.get().items);
        env.set.tab('payments');
        env.emit('autoRefundNeedsBank', { source: 'exit', href: href || fallbackExitHref });
        return { left: false, blocked: 'bank' };
      }
      if (creditNow > 0) {
        await ui.alert({ title: 'ללקוח מגיע זיכוי', sub: `שים לב: ללקוח מגיע זיכוי של ${fmtMoney(creditNow)} עבור הזמנה זו. בקשת זיכוי ממתינה נרשמה אוטומטית בלשונית תשלומים.` });
      }
    } catch (e) {
      console.error('Failed to check debt/credit balance on exit', e);
    }
    env.flags.pendingDebtBlock = false;
    return go();
  }
  /**
   * יציאה (= handleExit). href: יעד מפורש (קישור שיורט); בלי - יעד ההגדרה order_edit_redirect_screen (R44).
   * @returns {Promise<{left:boolean, blocked?:'debt'|'bank', cancelled?:boolean, busy?:string}>}
   */
  const exit = exclusive('exit', exitCore, (bz) => ({ left: false, busy: bz }));

  // "בטל שינויים" (D7). confirmed=true כשהקורא (W5) כבר הציג את חלון האישור.
  async function discardAll({ confirmed = false } = {}) {
    const st = env.get();
    const snap = st.snapshot;
    const rows = changesOf(snap, st);
    if (!rows.length || !snap) { ui.toast('info', 'אין שינויים לביטול', ''); return false; }
    const cardMsg = unsavedCardChargeMessage(st.payments);
    if (cardMsg) { await ui.alert({ kind: 'error', title: 'לא ניתן לבטל שינויים', sub: cardMsg }); return false; }
    const changes = buildDraftSummary(snap, { order: st.order, items: st.items, obligations: st.obligations, payments: st.payments });
    if (!confirmed) {
      const ok = await ui.openDialog(env.dialogs.DiscardDialog, { changes: rows });
      if (!ok) return false;
    }
    env.set.order(snap.order);
    env.set.items(snap.items);
    env.set.obligations(snap.obligations);
    env.set.payments(snap.payments);
    env.set.refunds(snap.refunds);
    env.clearRedo();
    f(`/api/orders/${env.routeId}/cancel-changes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes })
    }).then(() => env.bumpHistory()).catch(err => console.error('Failed to log cancelled changes', err));
    ui.toast('info', 'השינויים בוטלו', changes.length > 0 ? changes.join(', ') : '');
    return true;
  }

  async function deleteOrderCore() {
    const st = env.get();
    const order = st.order;
    const status = calculateOrderStatus({ ...order, items: st.items }, { draftsAsDeleted: st.settings.draftsAsDeleted });
    if (DELETE_BLOCKED_STATUSES.includes(status)) {
      await ui.alert({ title: 'לא ניתן למחוק', sub: 'לא ניתן למחוק הזמנה לאחר השכרה חלקית/מלאה או לאחר שנלקח והוחזר', kind: 'error' });
      return false;
    }
    if (!(await ui.confirm({ title: 'מחיקת הזמנה', sub: 'האם אתה בטוח שברצונך למחוק הזמנה זו?', okText: 'מחק הזמנה', icon: 'trash' }))) return false;
    let zeoutForDelete = null;
    if (zeoutVerificationNeeded(st.settings, order)) {
      zeoutForDelete = await requestZeout();
      if (!zeoutForDelete) { ui.toast('error', 'ביטול בוטל - לא הוזנה תעודת זהות.', ''); return false; }
    }
    if (!st.settings.allowEditPartially && st.items.some(i => !i.isDeleted && i.isTaken)) {
      await ui.alert({ title: 'לא ניתן לבטל', sub: 'לא ניתן לבטל הזמנה שהושכרה חלקית - חסום בהגדרות (allow_edit_partially_rented).', kind: 'error' });
      return false;
    }
    env.set.saving(true);
    try {
      const res = await f(`/api/orders/${order.orderId}`, {
        method: 'DELETE',
        headers: { ...(zeoutForDelete ? { 'x-zeout': zeoutForDelete, 'Content-Type': 'application/json' } : {}) },
        ...(zeoutForDelete ? { body: JSON.stringify({ zeout: zeoutForDelete }) } : {})
      });
      if (res.ok) { env.navigate('/orders'); return true; }
      const data = await jsonOf(res);
      toastError((data && data.error) || 'שגיאה במחיקת הזמנה');
      return false;
    } catch (err) {
      console.error(err);
      toastError('שגיאה במחיקת הזמנה');
      return false;
    } finally {
      env.set.saving(false);
    }
  }
  const deleteOrder = exclusive('delete', deleteOrderCore, false);

  // PUT קטן שכבר "שמור" (כמו אישור החתימה): נשלח עם updatedAt כדי שהשרת יבדוק התנגשות (route.js:426; החריג של חתימה-בלבד מתיר
  // updatedAt/overwriteConflict, :337). על 409 - שליחה חוזרת עם overwriteConflict, אבל updatedAt הישן נשאר ב-state כדי שהשמירה
  // הבאה עדיין תזהה את השינוי של המשתמש האחר (סקירה, סעיף 3). בלי 409 - updatedAt מהתשובה נשמר (הפעולה שלנו אינה התנגשות).
  async function patchServer(fields) {
    const st = env.get();
    const send = (extra) => f(`/api/orders/${env.routeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fields, updatedAt: st.order?.updatedAt, ...extra })
    });
    let res = await send({});
    let overwrote = false;
    if (res.status === 409) { overwrote = true; res = await send({ overwriteConflict: true }); }
    if (!res.ok) return { ok: false, res };
    const data = await jsonOf(res);
    const patch = { ...fields, ...(!overwrote && data && data.updatedAt ? { updatedAt: data.updatedAt } : {}) };
    env.set.order(prev => (prev ? { ...prev, ...patch } : prev));
    const snap = env.get().snapshot;
    if (snap) env.setSnapshot({ ...snap, order: { ...snap.order, ...patch } });
    env.bumpHistory();
    return { ok: true, overwrote, order: data };
  }

  async function toggleSignature({ confirmed = false } = {}) {
    const order = env.get().order;
    const nowYes = !order.hasSignedRegulations;
    if (!confirmed) {
      const msg = nowYes ? 'האם הלקוח חתם על תקנון ההשכרה?' : 'האם לסמן שהלקוח לא חתם על התקנון?';
      const ok = await ui.confirm({ title: 'חתימה על תקנון', sub: msg, okText: nowYes ? 'כן, חתם' : 'כן, לא חתם', icon: 'sig' });
      if (!ok) return false;
    }
    try {
      const r = await patchServer({ hasSignedRegulations: nowYes });
      if (!r.ok) { toastError('שגיאה בשמירת אישור החתימה'); return false; }
      return true;
    } catch (e) {
      console.error(e);
      toastError('שגיאת תקשורת בשמירת אישור החתימה');
      return false;
    }
  }

  return { requestZeout, reload, putOrder, confirmSummaryIfNeeded, save, applyServerOrder, exit, discardAll, deleteOrder, toggleSignature, patchServer, isBusy: () => inFlight };
}
