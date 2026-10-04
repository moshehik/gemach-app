'use client';

// useOrderCardController — הבקר של כרטיס ההזמנה החדש (PLAN §D.4). מחזיק את כל ה-state של הכרטיס, טוען, מחשב סכומים ושינויים,
// ומחבר את זרימות השמירה/היציאה (orderCardFlows.js) ל-React. כל לשונית מקבלת {oc, ui} בלבד.
//
// ===== מפת פורט (← app/orders/[id]/LegacyOrderPage.js) =====
// state: order/items/obligations/payments/refunds/loading/saving/isPastEvent/isUnlocked/inventoryCache/pendingDraft/activeTab/
//        openedDebt/debtApproved ← :171-274 ; savedSnapshotRef ← :174 ; pendingDebtBlockRef/bankDetailsPromptedOnExitRef ← :185/:189
// טעינת הגדרות ← :275-303 (parseSettings) ; טעינת הזמנה ← :322-369 (+ addHistory, טיוטה קיימת)
// preload מלאי ← :371-394 ; totals ← :401-412 ; תצוגה מקדימה חיה בלשונית תשלומים ← :418-458 (+ extraDay)
// beforeunload ← :465-473 ; יירוט קישורים ← :478-493 ; שמירת טיוטה ← :500-523
// restore/discard טיוטה ← :1298-1319 ; isLocked ← :1408 ; relock ← :1803 ; handlePrintMenuOrderUpdate ← :1028-1030 (patchOrder)
// handleWalletClick ← :1465-1470 (goPayments) ; ההבדלים המכוונים מתועדים ב-scratch/order-card-build/W1-NOTES.md.
//
// ===== הממשק (oc) — ר' JSDoc של OrderCardController למטה ו-W1-NOTES.md =====

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import { addHistory } from '@/lib/historyManager';
import { calculateOrderStatus } from '@/lib/orderStatus';
import { DRAFT_ORDER_STATUS } from '@/lib/orderReservation';
import { saveOrderDraft, loadOrderDraft, clearOrderDraft } from '@/app/lib/orderDrafts';
import {
  parseSettings, computeTotals, changesOf, captureChange, revertChange, applyCaptured, isPastEventDate, openedDebtOf,
  zeoutVerificationNeeded, pricingInputsChanged, buildPreviewBody, buildDraftSummary, buildDraftRows, newLocalId, fmtMoney
} from './orderCardLogic';
import { createOrderCardFlows } from './orderCardFlows';
import { postOrderEvent, newClientEventId } from './ocEvents';
import OcApprovalDialog from './OcApproval';

/**
 * @typedef {object} OrderCardController
 * @property {'loading'|'ready'|'notfound'} status
 * @property {object|null} order @property {object[]} items @property {object[]} obligations @property {object[]} payments @property {object[]} refunds
 * @property {{order:object,items:object[],obligations:object[],payments:object[],refunds:object[]}|null} snapshot   מצב השרת האחרון (קריאה בלבד)
 * @property {object} settings   parseSettings(): שדות מפוענחים + raw/get/bool/num/json
 * @property {{isLocked:boolean,isPastEvent:boolean,isUnlocked:boolean,zeoutNeeded:boolean,isDeletedOrder:boolean,isDraft:boolean,statusText:string}} flags
 * @property {{required:number,paid:number,balance:number,openedDebt:number|null,savedBalance:number,pendingNet:number,balanceAfterSave:number}} totals
 * @property {{isPreviewing:boolean}} preview
 * @property {import('./orderCardLogic').Change[]} changes
 * @property {boolean} dirty
 * @property {(key:string)=>void} undoChange @property {()=>void} redo @property {number} redoCount
 * @property {(opts?:{confirmed?:boolean})=>Promise<boolean>} discardAll
 * @property {object} edit  {setField,setOrder,setItems,addLocalItem,removeLocalItem,markItemDeleted,setAltDone,setObligations,setPayments,setRefunds}
 * @property {(opts?:{intent?:'save'|'pay'|'credit',summaryConfirmed?:boolean,debtApprovedBy?:string})=>Promise<object>} save
 * @property {(href?:string)=>Promise<object>} exit
 * @property {()=>Promise<boolean>} reload
 * @property {(order:object, opts?:{savedLocalId?:string})=>void} applyServerOrder
 * @property {(patch:object)=>void} patchOrder   עדכון חלקי אחרי PUT קטן שכבר נשמר (מסונכרן גם ל-snapshot)
 * @property {()=>Promise<boolean>} deleteOrder @property {(o?:{confirmed?:boolean})=>Promise<boolean>} toggleSignature
 * @property {()=>Promise<boolean>} unlock @property {()=>void} relock
 * @property {{pending:object|null, restore:()=>void, discard:()=>Promise<void>}} drafts
 * @property {number} historyVersion @property {()=>void} bumpHistory
 * @property {(action:string, meta?:object)=>Promise<{ok:boolean,status:number}>} logEvent
 * @property {(kind:string, reason:string)=>Promise<{employeeId:string,employeeName:string,pin:string}|null>} approve
 * @property {(o?:{amount?:number})=>Promise<{employeeId:string,employeeName:string}|null>} approveDebt   "השאר חוב (באישור מנהל)" בחלון התשלום
 * @property {string} tab @property {(t:string)=>void} setTab @property {()=>void} goPayments
 * @property {boolean} saving @property {object|null} inventoryCache
 * @property {(type:string, fn:Function)=>()=>void} on   אירועים: 'debtCreated' {amount,source,href?}, 'autoRefundNeedsBank' {source,href?}
 * @property {boolean} pendingDebtBlock
 */
export default function useOrderCardController(orderRef, ui) {
  const router = useRouter();
  const [status, setStatus] = useState('loading');
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [payments, setPayments] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [settingsRows, setSettingsRows] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isPastEvent, setIsPastEvent] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [inventoryCache, setInventoryCache] = useState(null);
  const [pendingDraft, setPendingDraft] = useState(null);
  const [tab, setTab] = useState('details');
  const [openedDebt, setOpenedDebt] = useState(null);
  const [debtApproved, setDebtApproved] = useState(false);
  const [snapshot, setSnapshotState] = useState(null);
  const redoRef = useRef([]);
  const [redoCount, setRedoCount] = useState(0);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [isLivePreviewing, setIsLivePreviewing] = useState(false);
  const [pendingDebtBlock, setPendingDebtBlockState] = useState(false);

  const snapshotRef = useRef(null);
  const initialLockChecked = useRef(false);
  const flagsRef = useRef({ pendingDebtBlock: false, bankPromptedOnExit: false });
  const hadUnsavedRef = useRef(false);
  const previewSeqRef = useRef(0);
  const listenersRef = useRef(new Map());
  const exitRef = useRef(null);

  const settings = useMemo(() => parseSettings(settingsRows || []), [settingsRows]);

  const setSnapshot = useCallback((snap) => { snapshotRef.current = snap; setSnapshotState(snap); }, []);
  const bumpHistory = useCallback(() => setHistoryVersion(v => v + 1), []);
  const clearRedo = useCallback(() => { if (redoRef.current.length) { redoRef.current = []; setRedoCount(0); } }, []);

  // מצב עדכני לזרימות async (נקרא אחרי await) - מתעדכן בכל רינדור
  const stateRef = useRef({});
  stateRef.current = { order, items, obligations, payments, refunds, snapshot: snapshotRef.current, openedDebt, settings, debtApproved, isUnlocked, isPastEvent };

  const emit = useCallback((type, payload) => {
    const set = listenersRef.current.get(type);
    if (!set || !set.size) return 0;
    set.forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } });
    return set.size;
  }, []);
  const on = useCallback((type, fn) => {
    if (!listenersRef.current.has(type)) listenersRef.current.set(type, new Set());
    listenersRef.current.get(type).add(fn);
    return () => listenersRef.current.get(type)?.delete(fn);
  }, []);

  // ---------- טעינה ----------
  useEffect(() => {
    let cancelled = false;
    fetchSharedJson('/api/settings', { ttl: TTL.STATIC })
      .then(data => { if (!cancelled) setSettingsRows(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setSettingsRows([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!orderRef) return undefined;
    let cancelled = false;
    fetch(`/api/orders/${orderRef}`)
      .then(res => { if (!res.ok) throw new Error('Failed to fetch'); return res.json(); })
      .then(data => {
        if (cancelled) return;
        setOrder(data);
        if (!initialLockChecked.current) {
          if (isPastEventDate(data.eventDate)) setIsPastEvent(true);
          initialLockChecked.current = true;
        }
        const loadedItems = data.items || [];
        const loadedObligations = data.obligations || [];
        const loadedPayments = data.payments || [];
        const loadedRefunds = data.refunds || [];
        setItems(loadedItems);
        setObligations(loadedObligations);
        setPayments(loadedPayments);
        setRefunds(loadedRefunds);
        setSnapshot({ order: data, items: loadedItems, obligations: loadedObligations, payments: loadedPayments, refunds: loadedRefunds });
        setOpenedDebt(openedDebtOf(loadedObligations, loadedPayments));
        const existingDraft = loadOrderDraft(data.orderId);
        if (existingDraft) setPendingDraft(existingDraft);
        setStatus('ready');
        addHistory({ type: 'order', id: data.orderId, name: `הזמנה #${data.orderId}`, subtext: data.customer ? `${data.customer.firstName} ${data.customer.lastName}` : '' });
      })
      .catch(err => { console.error(err); if (!cancelled) setStatus('notfound'); });
    return () => { cancelled = true; };
  }, [orderRef, setSnapshot]);

  useEffect(() => {
    if (!order) return;
    const hasDates = (order.isAbroad || order.isWeekdayEvent) ? (order.fromDate && order.toDate) : order.eventDate;
    if (!hasDates) return;
    const queryParams = new URLSearchParams({ isAbroad: order.isAbroad || false, isWeekdayEvent: order.isWeekdayEvent || false, excludeOrderId: order.orderId });
    if (order.eventDate) queryParams.append('eventDate', order.eventDate);
    if (order.fromDate) queryParams.append('fromDate', order.fromDate);
    if (order.toDate) queryParams.append('toDate', order.toDate);
    fetch(`/api/inventory/preload?${queryParams.toString()}`)
      .then(res => { if (!res.ok) throw new Error('Failed to load cache'); return res.json(); })
      .then(data => setInventoryCache(data))
      .catch(err => console.error('Failed to preload inventory cache', err));
  }, [order?.eventDate, order?.fromDate, order?.toDate, order?.isAbroad, order?.isWeekdayEvent, order?.orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- נגזרות ----------
  const totals = useMemo(() => computeTotals({ items, obligations, payments, snapshot, openedDebt }), [items, obligations, payments, snapshot, openedDebt]);
  const changes = useMemo(() => changesOf(snapshot, { order, items, obligations, payments }), [snapshot, order, items, obligations, payments]);
  const dirty = changes.length > 0;
  const isLocked = isPastEvent && !isUnlocked;
  const statusText = useMemo(() => (order ? calculateOrderStatus({ ...order, items }, { draftsAsDeleted: settings.draftsAsDeleted }) : ''), [order, items, settings.draftsAsDeleted]);
  const flags = useMemo(() => ({
    isLocked, isPastEvent, isUnlocked,
    zeoutNeeded: zeoutVerificationNeeded(settings, order),
    isDeletedOrder: !!order && (order.isDeleted || statusText === 'מחוק'),
    isDraft: !!order && order.status === DRAFT_ORDER_STATUS,
    statusText,
  }), [isLocked, isPastEvent, isUnlocked, settings, order, statusText]);

  // ---------- תצוגה מקדימה חיה (לשונית תשלומים, שינויים שמשפיעים על מחיר) ----------
  useEffect(() => {
    if (tab !== 'payments' || !dirty || !order?.orderId) return undefined;
    if (!pricingInputsChanged(snapshotRef.current, items, order)) return undefined;
    const mySeq = ++previewSeqRef.current;
    const timer = setTimeout(async () => {
      setIsLivePreviewing(true);
      try {
        const res = await fetch(`/api/orders/${order.orderId}/preview-pricing`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildPreviewBody(items, order))
        });
        if (mySeq !== previewSeqRef.current || !res.ok) return;
        const data = await res.json();
        if (mySeq !== previewSeqRef.current) return;
        setObligations(prev => {
          const manual = prev.filter(o => o.isManual !== false);
          const autoPreview = (data.newObligations || []).map(o => ({ ...o, isPreview: true }));
          return [...manual, ...autoPreview];
        });
      } catch (err) {
        console.error('Pricing preview failed', err);
      } finally {
        if (mySeq === previewSeqRef.current) setIsLivePreviewing(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [tab, items, order?.eventDate, order?.isAbroad, order?.isWeekdayEvent, order?.fromDate, order?.toDate, order?.isDelivery, order?.deliveryCity, order?.deliveryDirection, order?.extraDay, order?.orderId, dirty]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- הגנות יציאה ----------
  useEffect(() => {
    if (!dirty) return undefined;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return undefined;
    const onDocClick = (e) => {
      const anchor = e.target.closest && e.target.closest('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || anchor.target === '_blank') return;
      if (href === window.location.pathname) return;
      if (!exitRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      exitRef.current(href);
    };
    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, [dirty]);

  // ---------- טיוטה מקומית (R11, orderDrafts.js ללא שינוי) ----------
  useEffect(() => {
    if (!order?.orderId || !settings.enableLocalDrafts) return undefined;
    if (dirty) {
      hadUnsavedRef.current = true;
      if (pendingDraft) return undefined;
      const snap = snapshotRef.current;
      const timer = setTimeout(() => {
        const curr = { order, items, obligations, payments };
        saveOrderDraft(order.orderId, {
          savedAt: Date.now(),
          baseUpdatedAt: (snap && snap.order && snap.order.updatedAt) || null,
          summary: snap ? buildDraftSummary(snap, curr) : [],
          rows: snap ? buildDraftRows(snap, curr) : [],
          state: { order, items, obligations, payments, refunds }
        });
      }, 600);
      return () => clearTimeout(timer);
    }
    if (hadUnsavedRef.current) {
      hadUnsavedRef.current = false;
      clearOrderDraft(order.orderId);
    }
    return undefined;
  }, [dirty, order, items, obligations, payments, refunds, pendingDraft, settings.enableLocalDrafts]);

  // ---------- אישור מנהל ----------
  const approve = useCallback((kind, reason) => ui.openDialog(OcApprovalDialog, { kind, reason, orderId: stateRef.current.order?.orderId }, { layer: 2, labelledBy: 'oc-appr-t', className: 'oc-appr' })
    .then(r => { if (r) bumpHistory(); return r || null; }), [ui, bumpHistory]);

  // ---------- זרימות ----------
  const flowsRef = useRef(null);
  const navigate = useCallback((href) => router.push(href), [router]);
  const setPendingDebtBlock = useCallback((v) => { flagsRef.current.pendingDebtBlock = v; setPendingDebtBlockState(v); }, []);
  // flags משותף לזרימות; setter נפרד כדי שהרייל ירונדר מחדש
  const flagsProxy = useMemo(() => ({
    get pendingDebtBlock() { return flagsRef.current.pendingDebtBlock; },
    set pendingDebtBlock(v) { setPendingDebtBlock(!!v); },
    get bankPromptedOnExit() { return flagsRef.current.bankPromptedOnExit; },
    set bankPromptedOnExit(v) { flagsRef.current.bankPromptedOnExit = !!v; },
  }), [setPendingDebtBlock]);

  const slotsRef = useRef(null);
  const flows = useMemo(() => {
    const f = createOrderCardFlows({
      fetch: (...a) => fetch(...a),
      ui,
      get dialogs() { return slotsRef.current || {}; },
      routeId: orderRef,
      get: () => stateRef.current,
      set: { order: setOrder, items: setItems, obligations: setObligations, payments: setPayments, refunds: setRefunds, tab: setTab, saving: setSaving },
      setSnapshot,
      setOpenedDebt,
      setDebtApproved,
      flags: flagsProxy,
      approve,
      navigate,
      emit,
      bumpHistory,
      clearRedo,
    });
    flowsRef.current = f;
    return f;
  }, [ui, orderRef, setSnapshot, flagsProxy, approve, navigate, emit, bumpHistory, clearRedo]);
  exitRef.current = flows.exit;

  // ---------- עריכה ----------
  const markEdited = clearRedo;
  const edit = useMemo(() => ({
    setField: (f, v) => { markEdited(); setOrder(prev => (prev ? { ...prev, [f]: v } : prev)); },
    setOrder: (val) => { markEdited(); setOrder(prev => (typeof val === 'function' ? val(prev) : val)); },
    setItems: (val) => { markEdited(); setItems(prev => (typeof val === 'function' ? val(prev) : val)); },
    addLocalItem: (partial = {}) => { markEdited(); const _localId = partial._localId || newLocalId(); setItems(prev => [...prev, { ...partial, _localId }]); return _localId; },
    removeLocalItem: (localId) => { markEdited(); setItems(prev => prev.filter(it => it.id || it._localId !== localId)); },
    markItemDeleted: (id, b = true) => { markEdited(); setItems(prev => prev.map(it => ((it.id && it.id === id) || (!it.id && it._localId === id) ? { ...it, isDeleted: !!b } : it))); },
    setAltDone: (id, b) => { markEdited(); setItems(prev => prev.map(it => (it.id === id ? { ...it, alterationDone: !!b } : it))); },
    setObligations: (val) => { markEdited(); setObligations(prev => (typeof val === 'function' ? val(prev) : val)); },
    setPayments: (val) => { markEdited(); setPayments(prev => (typeof val === 'function' ? val(prev) : val)); },
    setRefunds: (val) => { setRefunds(prev => (typeof val === 'function' ? val(prev) : val)); },
  }), [markEdited]);

  // ---------- undo / redo לשורה (A17) ----------
  const applyState = (next) => {
    setOrder(next.order); setItems(next.items); setObligations(next.obligations); setPayments(next.payments);
  };
  const undoChange = useCallback((key) => {
    const st = stateRef.current;
    const cur = { order: st.order, items: st.items, obligations: st.obligations, payments: st.payments };
    const cap = captureChange(cur, key);
    applyState(revertChange(cur, snapshotRef.current, key));
    redoRef.current = [...redoRef.current, cap];
    setRedoCount(redoRef.current.length);
  }, []);
  const redo = useCallback(() => {
    const s = redoRef.current;
    if (!s.length) return;
    const cap = s[s.length - 1];
    const st = stateRef.current;
    applyState(applyCaptured({ order: st.order, items: st.items, obligations: st.obligations, payments: st.payments }, cap));
    redoRef.current = s.slice(0, -1);
    setRedoCount(redoRef.current.length);
  }, []);

  // ---------- טיוטות ----------
  const restoreDraft = useCallback(() => {
    const d = pendingDraft;
    if (!d || !d.state) return;
    setOrder(d.state.order);
    setItems(d.state.items || []);
    setObligations(d.state.obligations || []);
    setPayments(d.state.payments || []);
    setRefunds(d.state.refunds || []);
    setPendingDraft(null);
    clearRedo();
    ui.toast('info', 'השינויים מהביקור הקודם שוחזרו', 'לחצו "שמור" לשמירה, או "בטל שינויים" כדי לוותר עליהם.');
  }, [pendingDraft, ui, clearRedo]);
  const discardDraft = useCallback(async () => {
    const ok = await ui.confirm({ title: 'מחיקת שינויים מביקור קודם', sub: 'למחוק את השינויים שלא נשמרו מהביקור הקודם? פעולה זו אינה הפיכה.', okText: 'מחק אותם', icon: 'trash', danger: true });
    if (!ok) return;
    clearOrderDraft(stateRef.current.order?.orderId);
    setPendingDraft(null);
  }, [ui]);

  // ---------- פעולות קטנות ----------
  const unlock = useCallback(async () => {
    const r = await approve('feature:locked_order_edit', 'הזמנה זו נעולה כי תאריך האירוע עבר. נדרש אישור מנהל לעריכה.');
    if (!r) return false;
    setIsUnlocked(true);
    ui.toast('info', 'ההזמנה שוחררה לעריכה', '');
    return true;
  }, [approve, ui]);
  const relock = useCallback(() => setIsUnlocked(false), []);

  const approveDebt = useCallback(async ({ amount } = {}) => {
    const r = await approve('debt', amount ? `הזמנה ללא תשלום ${fmtMoney(amount)}` : 'מאשר הזמנה ללא תשלום');
    if (!r) return null;
    setDebtApproved(String(r.employeeId));
    return { employeeId: r.employeeId, employeeName: r.employeeName };
  }, [approve]);

  const patchOrder = useCallback((patch) => {
    setOrder(prev => (prev ? { ...prev, ...patch } : prev));
    const snap = snapshotRef.current;
    if (snap) setSnapshot({ ...snap, order: { ...snap.order, ...patch } });
  }, [setSnapshot]);

  const logEvent = useCallback(async (action, meta) => {
    const oid = stateRef.current.order?.orderId;
    const r = await postOrderEvent({ orderIds: [oid], action, meta, clientEventId: newClientEventId() });
    if (r.ok) bumpHistory();
    return r;
  }, [bumpHistory]);

  const goPayments = useCallback(() => setTab('payments'), []);

  /** @type {OrderCardController} */
  const oc = {
    status, order, items, obligations, payments, refunds, snapshot,
    settings, settingsReady: settingsRows !== null, flags, totals, preview: { isPreviewing: isLivePreviewing },
    changes, dirty, undoChange, redo, redoCount,
    discardAll: flows.discardAll,
    edit,
    save: flows.save, exit: flows.exit, reload: flows.reload, applyServerOrder: flows.applyServerOrder, patchOrder,
    deleteOrder: flows.deleteOrder, toggleSignature: flows.toggleSignature, unlock, relock,
    drafts: { pending: pendingDraft, restore: restoreDraft, discard: discardDraft },
    historyVersion, bumpHistory, logEvent, approve, approveDebt,
    tab, setTab, goPayments, saving, inventoryCache, on, pendingDebtBlock,
    requestZeout: flows.requestZeout,
    orderRef,
    /** @internal OrderCardA5 מעביר את ה-slots (חלונות הזרימה) */
    _setSlots: (s) => { slotsRef.current = s; },
  };
  return oc;
}

// עזר ל-React: מנוי לאירוע של הבקר (debtCreated / autoRefundNeedsBank) לאורך חיי הרכיב.
export function useOcEvent(oc, type, fn) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const subscribe = oc && oc.on;
  useEffect(() => {
    if (!subscribe) return undefined;
    return subscribe(type, (p) => fnRef.current && fnRef.current(p));
  }, [subscribe, type]);
}
