// orderCardLogic.js — לוגיקה טהורה של כרטיס ההזמנה החדש (A5). בלי React, בלי fetch, בלי DOM — נבדקת ב-node
// (scripts/order-card-tests/*). הכרטיס הישן (app/orders/[id]/LegacyOrderPage.js) לא מייבא את הקובץ הזה (PLAN §D.3):
// זה פורט (העתקה מבוקרת), לא חילוץ. בדיקות הזוגיות מוודאות ששני העותקים לא סוטים בשקט.
//
// ===== מפת פורט (פונקציה כאן ← מקור בכרטיס הישן, app/orders/[id]/LegacyOrderPage.js) =====
// ORDER_FIELD_LABELS, summarizeOrderFieldChanges ← LegacyOrderPage.js:20-43 (מילולי)
// summarizeListDiffCounts ← :49-69 (מילולי)
// PRICING_ORDER_FIELDS, pricingInputsChanged ← :80-85 (+ extraDay, PLAN A26/G13)
// summarizeListDiff, formatListCounts ← :87-104 (מילולי)
// CHANGE_GROUPS, buildDraftSummary, buildDraftRows ← :111-145 (מילולי; האייקונים #i-* נשארים כי הטיוטה נקראת גם ע"י הישן)
// OBLIGATION_KIND_PREFIXES, obligationIdentityKey ← :157-164 (מילולי)
// parseSettings ← :241-303 (אותן ברירות מחדל כשהשורה חסרה) + מפתחות A.5 נוספים
// computeTotals ← :401-412 (totalRequired/totalPaid) + :347-349 (openedDebt)
// zeoutVerificationNeeded ← :308
// isPastEventDate ← :332 (setHours המקומי הוחלף ביום ישראלי — ר' W1-NOTES)
// hasRequiredDates ← :373 / :696
// buildPreviewBody ← :428-440 / :615-627 (+ extraDay)
// buildValidateInventoryBody ← :708-720
// formatStockErrors ← :729-738 (טקסט ההודעה, לחלון R48)
// validateRepairs ← :683-692
// buildPutPayload(mode:'save') ← :853-893 ; (mode:'exit') ← :1144-1174 ; + extraDay (G13) + cardVariant:'a5' (חוזה W0) בסוף
// computeItemsTotalAmount ← :888-892 / :1169-1173
// submittedLocalIdsOf ← :848-850 / :1140-1142
// mergePendingItems ← :985-988
// freshDebtAfterSave ← :937-941 ; freshBalanceAfterExit ← :1194-1199
// needsAutoRefundBank ← :921-923 / :1237-1239
// isDebtUnchangedSinceOpen ← :768-770 / :1109-1111
// cancelledItemNow ← :814-818
// isPartiallyRentedBlocked ← :557 / :1385
// DELETE_BLOCKED_STATUSES ← :1372
// חדש (לא בישן): changes/revertChange/captureChange/applyCaptured (A17, D.4), customerMissing/tabMarkers (A6/A7),
// itemLabel, fmtMoney, hebDateOf.

import { getHebrewDateString, getIsraelDateKey, getIsraelTodayKey } from '../../../lib/hebrewDate';
import { extraDayUpdates } from './parts/ocDetailsLogic'; // W2a: ביטול 'יום השכרה נוסף' מזיז את התאריכים בחזרה (סקירת W2a, סעיף 3)

// ---------------------------------------------------------------------------------------------
// טיוטות ו"ביטול שינויים" — מילולי מהישן (הטיוטה נקראת גם ע"י הכרטיס הישן ורשימת ההזמנות)
// ---------------------------------------------------------------------------------------------
export const ORDER_FIELD_LABELS = {
  eventDate: 'תאריך אירוע',
  eventDateHebrew: 'תאריך אירוע (עברי)',
  returnDate: 'תאריך החזרה',
  fromDate: 'מתאריך',
  toDate: 'עד תאריך',
  isAbroad: 'אירוע חו"ל',
  isWeekdayEvent: 'אירוע באמצע שבוע',
  customSpacing: 'ריווח מותאם',
  notes: 'הערות',
  internalNotes: 'הערות פנימיות',
  hasSignedRegulations: 'חתימה על תקנון',
  customerId: 'לקוח'
};

export const summarizeOrderFieldChanges = (snapOrder, currOrder) => {
  const changed = [];
  Object.entries(ORDER_FIELD_LABELS).forEach(([field, label]) => {
    const before = snapOrder ? (snapOrder[field] ?? null) : null;
    const after = currOrder ? (currOrder[field] ?? null) : null;
    if (JSON.stringify(before) !== JSON.stringify(after)) changed.push(`${label} השתנה`);
  });
  return changed;
};

export const summarizeListDiffCounts = (snapList = [], currList = []) => {
  const snapMap = new Map(snapList.filter(x => x.id).map(x => [x.id, x]));
  const snapDraftPool = snapList.filter(x => !x.id).map(x => JSON.stringify(x));
  let added = 0, removed = 0, restored = 0, modified = 0;
  currList.forEach(curr => {
    if (!curr.id) {
      const draftKey = JSON.stringify(curr);
      const idx = snapDraftPool.indexOf(draftKey);
      if (idx === -1) added++; else snapDraftPool.splice(idx, 1);
      return;
    }
    const snap = snapMap.get(curr.id);
    if (!snap) { added++; return; }
    snapMap.delete(curr.id);
    if (!snap.isDeleted && curr.isDeleted) { removed++; return; }
    if (snap.isDeleted && !curr.isDeleted) { restored++; return; }
    if (JSON.stringify(snap) !== JSON.stringify(curr)) modified++;
  });
  removed += snapMap.size;
  return { added, removed, restored, modified };
};

// + extraDay: יום השכרה נוסף משנה את המחיר (pricingCalc.js:222) ולכן מפעיל תצוגה מקדימה (A26).
export const PRICING_ORDER_FIELDS = ['eventDate', 'isAbroad', 'isWeekdayEvent', 'fromDate', 'toDate', 'isDelivery', 'deliveryCity', 'deliveryDirection', 'extraDay'];
export const pricingInputsChanged = (snap, currItems, currOrder) => {
  if (!snap) return false;
  if (JSON.stringify(snap.items || []) !== JSON.stringify(currItems || [])) return true;
  return PRICING_ORDER_FIELDS.some(f => (snap.order?.[f] ?? null) !== (currOrder?.[f] ?? null));
};

export const summarizeListDiff = (snapList, currList, label) => {
  const { added, removed, restored, modified } = summarizeListDiffCounts(snapList, currList);
  const parts = [];
  if (added) parts.push(`${added} ${label} נוספו`);
  if (removed) parts.push(`${removed} ${label} הוסרו`);
  if (restored) parts.push(`${restored} ${label} שוחזרו`);
  if (modified) parts.push(`${modified} ${label} עודכנו`);
  return parts;
};

export const formatListCounts = (label, counts) => {
  const parts = [];
  if (counts.added) parts.push(`${counts.added} נוספו`);
  if (counts.removed) parts.push(`${counts.removed} הוסרו`);
  if (counts.restored) parts.push(`${counts.restored} שוחזרו`);
  if (counts.modified) parts.push(`${counts.modified} עודכנו`);
  return parts.length ? `${label}: ${parts.join(', ')}` : null;
};

export const CHANGE_GROUPS = [
  { icon: '#i-calendar', label: 'תאריך אירוע', fields: ['eventDate', 'eventDateHebrew'] },
  { icon: '#i-calendar', label: 'טווח תאריכים (לקיחה/החזרה)', fields: ['fromDate', 'toDate', 'returnDate'] },
  { icon: '#i-pin', label: 'סוג אירוע (רגיל/חו"ל)', fields: ['isAbroad', 'isWeekdayEvent'] },
  { icon: '#i-alert-tri', label: 'ריווח ימים מותאם', fields: ['customSpacing'] },
  { icon: '#i-file', label: 'הערות להזמנה', fields: ['notes'] },
  { icon: '#i-file', label: 'הערות פנימיות', fields: ['internalNotes'] },
  { icon: '#i-check-circle', label: 'חתימה על תקנון', fields: ['hasSignedRegulations'] },
  { icon: '#i-user', label: 'לקוח', fields: ['customerId'] }
];

export const buildDraftSummary = (snap, curr) => [
  ...summarizeOrderFieldChanges(snap.order, curr.order),
  ...summarizeListDiff(snap.items, curr.items, 'פריטים'),
  ...summarizeListDiff(snap.obligations, curr.obligations, 'התחייבויות תשלום'),
  ...summarizeListDiff(snap.payments, curr.payments, 'תשלומים')
];

export const buildDraftRows = (snap, curr) => {
  const rows = [];
  CHANGE_GROUPS.forEach(({ icon, label, fields }) => {
    const changed = fields.some(f => JSON.stringify((snap.order && snap.order[f]) ?? null) !== JSON.stringify((curr.order && curr.order[f]) ?? null));
    if (changed) rows.push({ icon, text: label });
  });
  const itemsText = formatListCounts('פריטים', summarizeListDiffCounts(snap.items, curr.items));
  if (itemsText) rows.push({ icon: '#i-bag', text: itemsText });
  const obligationsText = formatListCounts('התחייבויות תשלום', summarizeListDiffCounts(snap.obligations, curr.obligations));
  if (obligationsText) rows.push({ icon: '#i-receipt', text: obligationsText });
  const paymentsText = formatListCounts('תשלומים', summarizeListDiffCounts(snap.payments, curr.payments));
  if (paymentsText) rows.push({ icon: '#i-card', text: paymentsText });
  return rows;
};

export const OBLIGATION_KIND_PREFIXES = ['תיקון צוואר', 'תיקון שרוול', 'תיקון אורך', 'חיוב מקורי', 'זיכוי בגין ביטול', 'זיכוי דמי ביטול', 'דמי ביטול ותיקונים'];
export const obligationIdentityKey = (o) => {
  if (o.orderItemId) {
    const kind = OBLIGATION_KIND_PREFIXES.find(p => (o.description || '').startsWith(p)) || 'רגיל';
    return `item:${o.orderItemId}:${kind}`;
  }
  return `desc:${o.description || ''}`;
};

// ---------------------------------------------------------------------------------------------
// הגדרות (A.5) — אותן ברירות מחדל כמו הישן כשהשורה חסרה ב-DB
// ---------------------------------------------------------------------------------------------
/**
 * @param {Array<{key:string,value:string}>} rows תשובת GET /api/settings
 * @returns {OcSettings}
 */
export function parseSettings(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const raw = {};
  list.forEach(s => { if (s && typeof s.key === 'string') raw[s.key] = s.value; });
  const has = (k) => Object.prototype.hasOwnProperty.call(raw, k);
  const bool = (k, def) => (has(k) ? raw[k] === 'true' : def);
  const notFalse = (k, def) => (has(k) ? raw[k] !== 'false' : def);
  const num = (k, def) => { if (!has(k)) return def; const n = Number(raw[k]); return Number.isFinite(n) ? n : def; };
  const json = (k, def) => { if (!has(k) || !raw[k]) return def; try { return JSON.parse(raw[k]); } catch { return def; } };
  return {
    raw,
    get: (k, def = null) => (has(k) ? raw[k] : def),
    bool,
    num,
    json,
    // ---- בדיוק כמו LegacyOrderPage.js:244-303 ----
    draftsAsDeleted: bool('draft_orders_show_as_deleted', true),
    requireIdForEdit: bool('require_id_for_edit_cancel', false),
    allowEditPartially: bool('allow_edit_partially_rented', true),
    requireManagerCodeForItems: bool('require_manager_code_for_item_changes', false),
    enableLocalDrafts: bool('enable_local_order_drafts', true),
    enableEditSummaryConfirm: bool('enable_order_edit_summary_confirm', false),
    consolidateManualPaymentCredit: bool('consolidate_manual_payment_credit_ui', false),
    nedarimPlusEnabled: notFalse('nedarim_plus_enabled', true),
    allowAdditionalPayment: bool('allow_additional_payment_on_order', false),
    orderEditRedirectScreen: (has('order_edit_redirect_screen') && raw.order_edit_redirect_screen) ? raw.order_edit_redirect_screen : 'orders_list',
    // ---- מפתחות נוספים שהכרטיס החדש קורא (A.5). ברירות המחדל = כמו ברכיבי הישן (MGD/MIM) / "חסר = כבוי" ----
    enableDeliveries: bool('enable_deliveries', false),
    deliverySeparateTab: bool('delivery_separate_tab', false),
    enableDeliveryJoin: bool('enable_delivery_join', false),
    enableBarcodeSequenceMode: bool('enable_barcode_sequence_mode', false),
    enableDressLocationAlert: bool('enable_dress_location_alert', false),
    orderQuickMailEnabled: bool('order_quick_mail_enabled', false),
    enableAlterations: bool('enable_alterations', false),
    enableRentalExtension: bool('enable_rental_extension', false),
    hideCustomSpacing: bool('hide_custom_spacing', false),
    requireCustomerIdNumber: bool('require_customer_id_number', false),
    maxItemsPerOrder: num('max_items_per_order', 0),
    inventoryBufferDays: num('inventory_buffer_days', 0),
    cancellationCreditMinutes: num('CANCELLATION_CREDIT_MINUTES', 0),
    deliveryPriceByCity: json('delivery_price_by_city', {}),
  };
}

// ---------------------------------------------------------------------------------------------
// סכומים
// ---------------------------------------------------------------------------------------------
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// totalRequired של הישן (:401-411): שורת preview היא תוצאת שרת מלאה; פריט שסומן למחיקה מקומית (בלי deletedAt) לא נספר.
export function requiredOf(obligations = [], items = []) {
  return obligations
    .filter(o => {
      if (o.isDeleted) return false;
      if (o.isPreview) return true;
      if (o.orderItemId) {
        const relatedItem = items.find(i => i.id === o.orderItemId);
        if (relatedItem?.isDeleted && !relatedItem?.deletedAt) return false;
      }
      return true;
    })
    .reduce((sum, obs) => sum + num(obs.amount), 0);
}
// סכומים כמחרוזת ("150") נספרים כמספר - בישן `sum + o.amount` היה משרשר מחרוזות (סקירה, סעיף 9)
const num = (v) => parseFloat(v) || 0;
export const paidOf = (payments = []) => payments.filter(p => !p.isDeleted).reduce((sum, p) => sum + num(p.amount), 0);
// openedDebt (:347-349): בטעינה - בלי ההחרגה של פריט שנמחק מקומית
export const openedDebtOf = (obligations = [], payments = []) =>
  obligations.filter(o => !o.isDeleted).reduce((sum, o) => sum + num(o.amount), 0) - payments.filter(p => !p.isDeleted).reduce((sum, p) => sum + num(p.amount), 0);

// אישור "השאר חוב" מכסה חוב עד הרמה שאושרה (סקירה, סעיף 2). בלי רמה = לא מכסה.
export const debtApprovalCovers = (level, debt) => level !== null && level !== undefined && Number.isFinite(Number(level)) && round2(debt) <= round2(level) + 0.01;

// הגנות היציאה (יירוט קישורים + beforeunload) פעילות כשיש שינויים שלא נשמרו או כשהיציאה חסומה בגלל חוב חדש (סקירה, סעיף 1)
export const exitGuardActive = (dirty, pendingDebtBlock) => !!(dirty || pendingDebtBlock);

// שורה חדשה (בלי id) מקבלת _localId במקום אחד - כך כל שורה מזוהה ברשימת השינויים, בביטול ובהחזרה (סקירה, סעיפים 5-6)
export function withLocalIds(list) {
  if (!Array.isArray(list)) return list;
  let changed = false;
  const out = list.map(x => {
    if (!x || typeof x !== 'object' || x.id || x._localId || x.isPreview) return x;
    changed = true;
    return { ...x, _localId: newLocalId() };
  });
  return changed ? out : list;
}

/**
 * @returns {{required:number,paid:number,balance:number,openedDebt:number|null,savedBalance:number,pendingNet:number,balanceAfterSave:number}}
 */
export function computeTotals({ items = [], obligations = [], payments = [], snapshot = null, openedDebt = null }) {
  const required = requiredOf(obligations, items);
  const paid = paidOf(payments);
  const balance = round2(required - paid);
  const savedBalance = snapshot ? round2(requiredOf(snapshot.obligations || [], snapshot.items || []) - paidOf(snapshot.payments || [])) : balance;
  return {
    required: round2(required),
    paid: round2(paid),
    balance,
    openedDebt,
    savedBalance,
    pendingNet: round2(balance - savedBalance),
    balanceAfterSave: balance,
  };
}

// ---------------------------------------------------------------------------------------------
// שערים ותנאים
// ---------------------------------------------------------------------------------------------
export const zeoutVerificationNeeded = (settings, order) => !!(settings && settings.requireIdForEdit) && !!String(order?.customer?.zeout || '').trim();

// הישן: new Date(eventDate).setHours(0,0,0,0) < new Date().setHours(0,0,0,0) - לפי אזור הזמן של הדפדפן. כאן לפי היום בישראל
// (getIsraelDateKey מטפל בשתי צורות האחסון של eventDate) כדי שהנעילה לא תזוז לפי אזור הזמן של העמדה.
export function isPastEventDate(eventDate, now = new Date()) {
  if (!eventDate) return false;
  const k = getIsraelDateKey(eventDate);
  return !!k && k < getIsraelTodayKey(now);
}

export const hasRequiredDates = (o) => ((o.isAbroad || o.isWeekdayEvent) ? (o.fromDate && o.toDate) : o.eventDate);

export const isPartiallyRentedBlocked = (settings, items) => !settings.allowEditPartially && items.some(i => !i.isDeleted && i.isTaken);

export const DELETE_BLOCKED_STATUSES = ['הוחזר', 'הוחזר חלקי', 'הושכר', 'הושכר חלקי'];

// :683-692 — מחזיר טקסט שגיאה או null
export function validateRepairs(items = []) {
  for (const item of items) {
    if (!item.isDeleted) {
      const hasRepair = item.neckAlteration || item.sleeveAlteration || (item.lengthAlteration && item.lengthAlteration.trim() !== '');
      if (hasRepair && (!item.alterationDetails || item.alterationDetails.trim() === '')) {
        return 'חובה להזין פירוט תיקון עבור כל פריט שיש לו תיקון מסומן (צוואר, שרוול או אורך).';
      }
    }
  }
  return null;
}

export const missingDatesMessage = (o) => (o.isAbroad || o.isWeekdayEvent
  ? 'חובה להזין תאריכי התחלה וסיום (אירוע חו"ל/מיוחד) עבור הזמנה הכוללת פריטים.'
  : 'חובה לבחור תאריך אירוע עבור הזמנה הכוללת פריטים.');

export const buildValidateInventoryBody = (currentOrder, activeItems) => ({
  items: activeItems,
  eventDate: currentOrder.eventDate,
  isAbroad: currentOrder.isAbroad,
  isWeekdayEvent: currentOrder.isWeekdayEvent,
  fromDate: currentOrder.fromDate,
  toDate: currentOrder.toDate,
  orderId: currentOrder.orderId,
  customSpacing: currentOrder.customSpacing
});

// שורות החוסר לחלון R48 (אותו טקסט כמו ה-alert של הישן :731-737)
export function formatStockErrors(errors = []) {
  const lines = errors.map(e => {
    const msg = `${e.dressName} (מידה ${e.sizeText}): חסרים ${e.requested - e.available} במלאי`;
    return { text: e.isCustomSpacingIssue ? `${msg} (בגלל ציפוף)` : msg, spacing: !!e.isCustomSpacingIssue, raw: e };
  });
  return { lines, spacingHint: errors.some(e => e.isCustomSpacingIssue) };
}

export const buildPreviewBody = (items, o) => ({
  items,
  order: {
    eventDate: o.eventDate,
    isAbroad: o.isAbroad,
    isWeekdayEvent: o.isWeekdayEvent,
    fromDate: o.fromDate,
    toDate: o.toDate,
    isDelivery: o.isDelivery,
    deliveryCity: o.deliveryCity,
    deliveryDirection: o.deliveryDirection,
    extraDay: o.extraDay !== undefined ? o.extraDay : null
  }
});

export const isDebtUnchangedSinceOpen = (currentDebt, openedDebt) => openedDebt !== null
  && Math.round(currentDebt * 100) === Math.round(openedDebt * 100);

export function cancelledItemNow(settings, snapshotItems = [], items = []) {
  return !!settings.requireManagerCodeForItems && snapshotItems.some(before => {
    if (!before.id || before.isDeleted) return false;
    const after = items.find(i => i.id === before.id);
    return after && after.isDeleted;
  });
}

// ---------------------------------------------------------------------------------------------
// גוף ה-PUT — סדר המפתחות זהה לישן; extraDay מצורף בסוף (G13). mode: 'save' (:853-893) | 'exit' (:1144-1174)
// ---------------------------------------------------------------------------------------------
export const CARD_VARIANT = 'a5';

export function computeItemsTotalAmount(items, obligations, currentOrder) {
  const itemsSum = items.filter(i => !i.isDeleted).reduce((sum, item) => sum + (parseFloat(item.finalPrice) || parseFloat(item.price) || 0), 0);
  const obligationsSum = obligations.filter(o => !o.isDeleted).reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
  return itemsSum > 0 ? itemsSum : (obligationsSum > 0 ? obligationsSum : (currentOrder.totalAmount || 0));
}

/**
 * @param {object} currentOrder
 * @param {{items:object[],obligations:object[],payments:object[],mode:'save'|'exit',debtApprovedBy?:string|null,managerAuth?:{employeeId:string,pin:string}|null,orderDateApproval?:{employeeId:string,pin:string}|null}} p
 */
export function buildPutPayload(currentOrder, { items, obligations, payments, mode = 'save', debtApprovedBy = null, managerAuth = null, orderDateApproval = null }) {
  const o = currentOrder;
  const body = mode === 'exit'
    ? {
      orderId: o.orderId,
      customerId: o.customerId,
      eventDate: o.eventDate,
      eventDateHebrew: o.eventDateHebrew,
      returnDate: o.returnDate,
      isAbroad: o.isAbroad,
      isWeekdayEvent: o.isWeekdayEvent,
      fromDate: o.fromDate,
      toDate: o.toDate,
      customSpacing: o.customSpacing !== undefined ? o.customSpacing : null,
      notes: o.notes,
      internalNotes: o.internalNotes,
      isDelivery: o.isDelivery,
      deliveryDirection: o.deliveryDirection,
      deliveryAddress: o.deliveryAddress,
      deliveryCity: o.deliveryCity,
      deliveryOneDayBefore: o.deliveryOneDayBefore,
      status: o.status,
      hasSignedRegulations: o.hasSignedRegulations,
      updatedAt: o.updatedAt,
      items: items,
      obligations: obligations,
      payments: payments,
      debtApprovedBy: debtApprovedBy,
      totalAmount: computeItemsTotalAmount(items, obligations, o)
    }
    : {
      orderId: o.orderId,
      customerId: o.customerId,
      orderDate: o.orderDate,
      eventDate: o.eventDate,
      eventDateHebrew: o.eventDateHebrew,
      returnDate: o.returnDate,
      isAbroad: o.isAbroad,
      isWeekdayEvent: o.isWeekdayEvent,
      fromDate: o.fromDate,
      toDate: o.toDate,
      customSpacing: o.customSpacing !== undefined ? o.customSpacing : null,
      notes: o.notes,
      internalNotes: o.internalNotes,
      isDelivery: o.isDelivery,
      deliveryDirection: o.deliveryDirection,
      deliveryAddress: o.deliveryAddress,
      deliveryCity: o.deliveryCity,
      deliveryOneDayBefore: o.deliveryOneDayBefore,
      status: o.status,
      hasSignedRegulations: o.hasSignedRegulations,
      updatedAt: o.updatedAt,
      managerEmployeeId: managerAuth?.employeeId,
      managerPin: managerAuth?.pin,
      orderDateApproverId: orderDateApproval?.employeeId,
      orderDateApproverPin: orderDateApproval?.pin,
      items: items,
      obligations: obligations,
      payments: payments,
      debtApprovedBy: debtApprovedBy,
      totalAmount: computeItemsTotalAmount(items, obligations, o)
    };
  // G13: יום השכרה נוסף נשמר (route.js:687 תומך; הישן מעולם לא שלח). null = "ללא".
  body.extraDay = o.extraDay !== undefined ? o.extraDay : null;
  // חוזה W0 (W0-NOTES §1.4): גוף מהכרטיס החדש מסומן - השרת אוכף feature:manual_charge_add על חיוב ידני חדש / מחיקת חיוב ידני
  // שמור רק כשהסימון קיים (הישן לא שולח אותו ולכן לא מושפע).
  body.cardVariant = CARD_VARIANT;
  return body;
}

export const submittedLocalIdsOf = (items) => items
  .filter(it => it._localId && it.dressModelId && it.sizeText)
  .map(it => it._localId);

export const mergePendingItems = (serverItems, prevItems, consumedLocalIds = []) => [
  ...serverItems,
  ...prevItems.filter(it => !it.id && it._localId && !consumedLocalIds.includes(it._localId))
];

// :937-941 (handleSave): מתוך תשובת השרת, לא מה-state
export function freshDebtAfterSave(updatedOrder, openedDebt) {
  const freshRequired = (updatedOrder.obligations || []).filter(o => !o.isDeleted).reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
  const freshPaid = (updatedOrder.payments || []).filter(p => !p.isDeleted).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const freshDebtNow = Math.round((freshRequired - freshPaid) * 100) / 100;
  const openedDebtRounded = openedDebt !== null && openedDebt !== undefined ? Math.round(openedDebt * 100) / 100 : 0;
  return { freshDebtNow, newDebtCreated: freshDebtNow > 0 && freshDebtNow > openedDebtRounded + 0.01 };
}

// :1194-1199 (handleExit): totalAmount קודם (כמו בישן), creditNow (:1259)
export function freshBalanceAfterExit(updatedOrder, openedDebt) {
  const freshPaid = (updatedOrder.payments || []).filter(p => !p.isDeleted).reduce((sum, p) => sum + p.amount, 0);
  const freshRequired = (updatedOrder.totalAmount && updatedOrder.totalAmount > 0)
    ? updatedOrder.totalAmount
    : (updatedOrder.obligations || []).filter(o => !o.isDeleted).reduce((sum, o) => sum + o.amount, 0);
  const freshDebtNow = Math.round((freshRequired - freshPaid) * 100) / 100;
  const openedDebtRounded = openedDebt !== null && openedDebt !== undefined ? Math.round(openedDebt * 100) / 100 : 0;
  const creditNow = Math.round((freshPaid - freshRequired) * 100) / 100;
  return { freshDebtNow, openedDebtRounded, creditNow, newDebtCreated: freshDebtNow > 0 && freshDebtNow > openedDebtRounded + 0.01 };
}

export const needsAutoRefundBank = (refunds = []) => refunds.some(r =>
  !r.isDeleted && !r.isExecuted && r.isAutoGenerated && (!r.bankName?.trim() || !r.bankBranch?.trim())
);

// ---------------------------------------------------------------------------------------------
// תצוגה: כסף, תאריך עברי, שם פריט, "חסר", סמני לשוניות
// ---------------------------------------------------------------------------------------------
// סכום לתצוגה בלי סימן (כמו money() בעיצוב); עוטפים ב-<bdi dir="ltr"> ברכיב.
export const fmtMoney = (n) => `₪${Math.abs(round2(n)).toLocaleString('he-IL')}`;
export const fmtSignedMoney = (n) => `${n < 0 ? '−' : '+'}₪${Math.abs(round2(n)).toLocaleString('he-IL')}`;

// תאריך עברי ליום הישראלי של הרגע (לא לפי אזור הזמן של המכונה). '' לערך ריק/שגוי.
export function hebDateOf(value) {
  if (!value) return '';
  const k = getIsraelDateKey(value);
  if (!k) return '';
  const [y, m, d] = k.split('-').map(Number);
  return getHebrewDateString(new Date(y, m - 1, d, 12));
}

export function itemLabel(it) {
  if (!it) return '';
  const model = it.dressItem?.dress?.name || it.dressModelName || it.modelName || it.description || '';
  const size = it.sizeText || it.size || '';
  return `${model ? `דגם ${model}` : 'פריט'}${size ? `, מידה ${size}` : ''}`;
}

const nonEmpty = (v) => v !== null && v !== undefined && String(v).trim() !== '';
// AMB-10: ת״ז "חסר" כשאחת משתי ההגדרות דורשת ת״ז
export function customerMissing(customer, settings) {
  if (!customer) return [];
  const out = [];
  if (!nonEmpty(customer.phone1) && !nonEmpty(customer.phone2)) out.push({ key: 'phone', label: 'טלפון' });
  if (!nonEmpty(customer.email)) out.push({ key: 'email', label: 'מייל' });
  if (!nonEmpty(customer.city) && !nonEmpty(customer.street)) out.push({ key: 'addr', label: 'כתובת' });
  if (settings && (settings.requireCustomerIdNumber || settings.requireIdForEdit) && !nonEmpty(customer.zeout)) out.push({ key: 'zeout', label: 'ת״ז' });
  return out;
}

/**
 * סמני הלשוניות (A6), כמו renderTabs בעיצוב: פרטים "חסר: …", משלוח "משלוח הוזמן", תשלומים "יש חוב"/"יש זיכוי".
 * @returns {{details?:{cls:string,icon:string,tip:string,key:string}, delivery?:object, payments?:object}}
 */
export function tabMarkers({ order, totals, settings }) {
  const m = {};
  const miss = customerMissing(order?.customer, settings);
  if (miss.length) m.details = { key: 'cust', cls: 'debt', icon: 'alert', tip: `חסר: ${miss.map(x => x.label).join(', ')}` };
  if (order?.isDelivery) m.delivery = { key: 'del', cls: 'ok', icon: 'check', tip: 'משלוח הוזמן' };
  const b = totals ? totals.balance : 0;
  if (b > 0.005) m.payments = { key: 'pay', cls: 'debt', icon: 'alert', tip: 'יש חוב' };
  else if (b < -0.005) m.payments = { key: 'pay', cls: 'cred', icon: 'undo', tip: 'יש זיכוי' };
  return m;
}

// ---------------------------------------------------------------------------------------------
// רשימת השינויים (A17, PLAN D.4) — diff בין ה-snapshot השמור לבין ה-state. לא נשמר בשרת.
// Change = {key, group, icon, text, note, amt}. אייקונים = שמות sprite של הפלטה (gmi-<שם>).
// ---------------------------------------------------------------------------------------------
/** @typedef {{key:string, group:'order'|'items'|'delivery'|'payments', icon:string, text:string, note:string, amt:number}} Change */

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
// שדות ההזמנה (סקירת W2a, סעיף 7): ''/null/undefined שקולים; תאריכים מושווים לפי היום בישראל (אותו יום בצורת שמירה אחרת -
// 'YYYY-MM-DD' מול ISO של חצות ישראל, או שעה אחרת באותו יום - אינו "שינוי")
const ORDER_DATE_FIELDS = new Set(['eventDate', 'fromDate', 'toDate', 'returnDate', 'orderDate']);
const blank = (v) => v === null || v === undefined || v === '';
export const sameOrderField = (f, a, b) => {
  if (blank(a) && blank(b)) return true;
  if (ORDER_DATE_FIELDS.has(f) && !blank(a) && !blank(b)) { const ka = getIsraelDateKey(a), kb = getIsraelDateKey(b); if (ka && kb) return ka === kb; }
  return same(a, b);
};
const EXTRA_DAY_LABEL = { before: 'לפני התקופה', after: 'אחרי התקופה' };
const etypeLabel = (o) => (o?.isAbroad ? 'חו״ל' : o?.isWeekdayEvent ? 'אמצע שבוע' : 'רגיל');
const custName = (o) => [o?.customer?.firstName, o?.customer?.lastName].filter(Boolean).join(' ') || 'לקוח';
const arrow = (a, b) => `${a || '—'} ← ${b || '—'}`;

// קבוצות שדות ההזמנה → מפתח שינוי. כל שדה שנשלח ב-PUT ולא מופיע כאן מקבל מפתח field:<f>.
export const ORDER_CHANGE_KEYS = [
  { key: 'date', fields: ['eventDate', 'eventDateHebrew', 'fromDate', 'toDate', 'returnDate'], group: 'order', icon: 'cal',
    text: () => 'תאריך האירוע',
    note: (s, c) => (c.isAbroad || c.isWeekdayEvent)
      ? arrow([hebDateOf(s.fromDate), hebDateOf(s.toDate)].filter(Boolean).join(' – '), [hebDateOf(c.fromDate), hebDateOf(c.toDate)].filter(Boolean).join(' – '))
      : arrow(hebDateOf(s.eventDate), hebDateOf(c.eventDate)) },
  { key: 'etype', fields: ['isAbroad', 'isWeekdayEvent'], group: 'order', icon: 'pin', text: () => 'סוג האירוע', note: (s, c) => arrow(etypeLabel(s), etypeLabel(c)) },
  { key: 'notes', fields: ['notes'], group: 'order', icon: 'note', text: () => 'הערות ההזמנה עודכנו', note: () => '' },
  { key: 'inotes', fields: ['internalNotes'], group: 'order', icon: 'note', text: () => 'הערות פנימיות עודכנו', note: () => '' },
  { key: 'sig', fields: ['hasSignedRegulations'], group: 'order', icon: 'sig', text: (s, c) => (c.hasSignedRegulations ? 'סומנה חתימה על התקנון' : 'בוטלה החתימה על התקנון'), note: () => '' },
  { key: 'spacing', fields: ['customSpacing'], group: 'order', icon: 'sliders', text: () => 'ציפוף ימים מיוחד', note: (s, c) => arrow(s.customSpacing ?? 'רגיל', c.customSpacing ?? 'רגיל') },
  { key: 'xday', fields: ['extraDay'], capture: ['extraDay', 'fromDate', 'toDate', 'returnDate'], group: 'order', icon: 'cal', text: () => 'יום השכרה נוסף', note: (s, c) => arrow(EXTRA_DAY_LABEL[s.extraDay] || 'ללא', EXTRA_DAY_LABEL[c.extraDay] || 'ללא') },
  { key: 'cust', fields: ['customerId'], group: 'order', icon: 'user', text: () => 'הוחלף לקוח', note: (s, c) => arrow(custName(s), custName(c)) },
  { key: 'del', fields: ['isDelivery'], group: 'delivery', icon: 'truck', text: (s, c) => (c.isDelivery ? 'הוזמן משלוח' : 'בוטל המשלוח'), note: () => '' },
  { key: 'delcfg', fields: ['deliveryDirection', 'deliveryCity'], group: 'delivery', icon: 'truck', text: () => 'פרטי המשלוח', note: (s, c) => arrow([s.deliveryDirection, s.deliveryCity].filter(Boolean).join(' · '), [c.deliveryDirection, c.deliveryCity].filter(Boolean).join(' · ')) },
  { key: 'deladdr', fields: ['deliveryAddress'], group: 'delivery', icon: 'pin', text: () => 'כתובת המשלוח', note: (s, c) => arrow(s.deliveryAddress, c.deliveryAddress) },
  { key: 'delone', fields: ['deliveryOneDayBefore'], group: 'delivery', icon: 'truck', text: (s, c) => (c.deliveryOneDayBefore ? 'משלוח יוצא יום לפני' : 'משלוח יוצא יומיים לפני'), note: () => '' },
];
// שדות PUT שלא שייכים לקבוצה (field:<f>). orderDate לא נערך בכרטיס החדש (R17) אך נבדק כדי שלא "ייעלם".
export const LOOSE_ORDER_FIELDS = ['orderDate', 'status', 'deliveryJoinedTo'];
const ALT_FIELDS = ['neckAlteration', 'sleeveAlteration', 'lengthAlteration', 'alterationDetails'];
const fieldsOfKey = (key, forCapture = false) => {
  const g = ORDER_CHANGE_KEYS.find(x => x.key === key);
  if (g) return (forCapture && g.capture) || g.fields;
  if (key.startsWith('field:')) return [key.slice(6)];
  return null;
};
const identOf = (x, i) => (x.id ? String(x.id) : (x._localId ? String(x._localId) : `n${i}`));
const oblAmountsForItem = (obligations, itemId) => (obligations || []).filter(o => !o.isDeleted && o.orderItemId === itemId).reduce((a, o) => a + (Number(o.amount) || 0), 0);

/**
 * @param {{order:object,items:object[],obligations:object[],payments:object[]}|null} snap
 * @param {{order:object,items:object[],obligations:object[],payments:object[]}} cur
 * @returns {Change[]}
 */
export function changesOf(snap, cur) {
  if (!snap || !cur || !cur.order) return [];
  const s = snap.order || {}, c = cur.order || {};
  const out = [];
  ORDER_CHANGE_KEYS.forEach(g => {
    if (g.fields.some(f => !sameOrderField(f, s[f], c[f]))) out.push({ key: g.key, group: g.group, icon: g.icon, text: g.text(s, c), note: g.note(s, c), amt: 0 });
  });
  LOOSE_ORDER_FIELDS.forEach(f => {
    if (!sameOrderField(f, s[f], c[f])) out.push({ key: `field:${f}`, group: 'order', icon: 'pencil', text: `עודכן שדה: ${ORDER_FIELD_LABELS[f] || f}`, note: '', amt: 0 });
  });
  // פריטים
  const sItems = snap.items || [], cItems = cur.items || [];
  const sById = new Map(sItems.filter(x => x.id).map(x => [String(x.id), x]));
  cItems.forEach((it, i) => {
    const id = it.id ? String(it.id) : null;
    const before = id ? sById.get(id) : null;
    if (!before) {
      if (it.isDeleted) return; // שורה חדשה שנמחקה לפני שמירה - אין מה לשמור
      out.push({ key: `item:add:${identOf(it, i)}`, group: 'items', icon: 'plus', text: `נוסף פריט: ${itemLabel(it)}`, note: '', amt: round2(parseFloat(it.finalPrice) || parseFloat(it.price) || 0) });
      return;
    }
    if (!before.isDeleted && it.isDeleted) {
      out.push({ key: `item:rm:${id}`, group: 'items', icon: 'trash', text: `הוסר פריט: ${itemLabel(it)}`, note: '', amt: -round2(oblAmountsForItem(snap.obligations, before.id)) });
      return;
    }
    if (before.isDeleted && !it.isDeleted) {
      out.push({ key: `item:rs:${id}`, group: 'items', icon: 'undo', text: `שוחזר פריט: ${itemLabel(it)}`, note: '', amt: round2(parseFloat(it.finalPrice) || parseFloat(it.price) || 0) });
      return;
    }
    let consumed = ['isDeleted', 'deletedAt'];
    if (ALT_FIELDS.some(f => !same(before[f], it[f]))) {
      out.push({ key: `item:alt:${id}`, group: 'items', icon: 'scissors', text: `עודכנו תיקונים: ${itemLabel(it)}`, note: '', amt: 0 });
      consumed = consumed.concat(ALT_FIELDS);
    }
    if (!same(before.alterationDone, it.alterationDone)) {
      out.push({ key: `item:altdone:${id}`, group: 'items', icon: 'check', text: `${it.alterationDone ? 'תיקון בוצע' : 'בוטל סימון תיקון'}: ${itemLabel(it)}`, note: '', amt: 0 });
      consumed.push('alterationDone');
    }
    const restBefore = { ...before }, restAfter = { ...it };
    consumed.forEach(f => { delete restBefore[f]; delete restAfter[f]; });
    if (!same(restBefore, restAfter)) out.push({ key: `item:mod:${id}`, group: 'items', icon: 'pencil', text: `עודכן פריט: ${itemLabel(it)}`, note: '', amt: 0 });
  });
  // פריט שמור שנעלם לגמרי מה-state (לא אמור לקרות - מחיקה היא isDeleted)
  sItems.forEach(b => { if (b.id && !cItems.some(x => String(x.id) === String(b.id))) out.push({ key: `item:rm:${b.id}`, group: 'items', icon: 'trash', text: `הוסר פריט: ${itemLabel(b)}`, note: '', amt: -round2(oblAmountsForItem(snap.obligations, b.id)) }); });
  // חיובים ידניים (שורות אוטומטיות/preview נגזרות מהמנוע - לא "שינוי" בפני עצמן)
  const listDiff = (sList, cList, kind) => {
    // שורות preview (מהמנוע) אינן שינוי בפני עצמן. חיוב אוטומטי (isManual===false) נחשב שינוי רק כשהוא קיים ב-snapshot ושונה ממנו
    // (למשל סומן כמבוטל). המפתח נבנה מהאינדקס ברשימה המלאה - אותו אינדקס שבו revertChange מחפש (סקירה, סעיף 6).
    const sMap = new Map((sList || []).filter(x => x.id && !x.isPreview).map(x => [String(x.id), x]));
    (cList || []).forEach((x, i) => {
      if (kind === 'obl' && x.isPreview) return;
      if (kind === 'obl' && x.isManual === false && !(x.id && sMap.has(String(x.id)))) return;
      const before = x.id ? sMap.get(String(x.id)) : null;
      const amount = round2(Number(x.amount) || 0);
      const desc = (x.description || x.paymentMethod || '').replace(/\s*\(פריט #[a-zA-Z0-9-]+\)/g, '');
      if (!before) {
        if (x.isDeleted) return;
        out.push(kind === 'obl'
          ? { key: `obl:${identOf(x, i)}`, group: 'payments', icon: 'plus', text: `נוסף חיוב ידני: ${desc || 'חיוב'}`, note: '', amt: amount }
          : { key: `pay:${identOf(x, i)}`, group: 'payments', icon: 'cash', text: `נוסף תשלום: ${desc || 'תשלום'}`, note: '', amt: -amount });
        return;
      }
      if (same(before, x)) return;
      const delNow = !before.isDeleted && x.isDeleted, resNow = before.isDeleted && !x.isDeleted;
      if (kind === 'obl') {
        out.push({ key: `obl:${x.id}`, group: 'payments', icon: delNow ? 'trash' : 'pencil', text: `${delNow ? 'בוטל חיוב' : resNow ? 'שוחזר חיוב' : 'עודכן חיוב'}: ${desc || 'חיוב'}`, note: '', amt: delNow ? -amount : resNow ? amount : round2(amount - (Number(before.amount) || 0)) });
      } else {
        out.push({ key: `pay:${x.id}`, group: 'payments', icon: delNow ? 'trash' : 'pencil', text: `${delNow ? 'בוטל תשלום' : resNow ? 'שוחזר תשלום' : 'עודכן תשלום'}: ${desc || 'תשלום'}`, note: '', amt: delNow ? amount : resNow ? -amount : round2((Number(before.amount) || 0) - amount) });
      }
    });
  };
  listDiff(snap.obligations, cur.obligations, 'obl');
  listDiff(snap.payments, cur.payments, 'pay');
  return out;
}

const listOfKey = (key) => (key.startsWith('item:') ? 'items' : key.startsWith('obl:') ? 'obligations' : key.startsWith('pay:') ? 'payments' : null);
const identFromKey = (key) => { const p = key.split(':'); return p[p.length - 1]; };
const findIdx = (list, ident) => list.findIndex((x, i) => identOf(x, i) === ident);

/**
 * לוכד את הערך הנוכחי של שינוי (לפני ביטולו) כדי ש"החזר ביטול" (redo) יחזיר אותו.
 * @returns {{key:string, kind:'order'|'list', fields?:object, list?:string, ident?:string, value?:object|null, index?:number}}
 */
export function captureChange(cur, key) {
  const fields = fieldsOfKey(key, true);
  if (fields) {
    const vals = {};
    fields.forEach(f => { vals[f] = cur.order ? cur.order[f] : undefined; });
    if (key === 'cust') vals.customer = cur.order ? cur.order.customer : undefined;
    return { key, kind: 'order', fields: vals };
  }
  const list = listOfKey(key);
  const ident = identFromKey(key);
  const arr = cur[list] || [];
  const idx = findIdx(arr, ident);
  return { key, kind: 'list', list, ident, value: idx >= 0 ? arr[idx] : null, index: idx };
}

/** מבטל שינוי אחד: מחזיר את החלק הרלוונטי לערכי ה-snapshot. מחזיר state חדש (לא משנה את הקלט). */
export function revertChange(cur, snap, key) {
  const next = { ...cur };
  // "יום השכרה נוסף" הזיז את הלקיחה/ההחזרה ביום - הביטול מזיז בחזרה (כמו בחירה ב"ללא"/בערך השמור), אחרת נשאר יום חינם או הזזה כפולה.
  // בלי תאריכים בהזמנה הנוכחית - חוזרים לערכי ה-snapshot (עקביים זה עם זה).
  if (key === 'xday' && cur.order) {
    const target = (snap.order && snap.order.extraDay) || null;
    const u = extraDayUpdates(cur.order, target);
    const o = u ? { ...cur.order, ...u } : { ...cur.order, ...Object.fromEntries(['extraDay', 'fromDate', 'toDate', 'returnDate'].map(f => [f, snap.order ? snap.order[f] : undefined])) };
    return { ...next, order: o };
  }
  const fields = fieldsOfKey(key);
  if (fields) {
    const o = { ...cur.order };
    fields.forEach(f => { o[f] = snap.order ? snap.order[f] : undefined; });
    if (key === 'cust') o.customer = snap.order ? snap.order.customer : o.customer;
    next.order = o;
    return next;
  }
  const list = listOfKey(key);
  if (!list) return next;
  const ident = identFromKey(key);
  const arr = [...(cur[list] || [])];
  const idx = findIdx(arr, ident);
  const sArr = snap[list] || [];
  const sItem = sArr.find((x) => x.id && String(x.id) === ident) || null;
  if (!sItem) { if (idx >= 0) arr.splice(idx, 1); next[list] = arr; return next; }
  if (idx < 0) { arr.push(sItem); next[list] = arr; return next; }
  if (key.startsWith('item:alt:')) {
    const it = { ...arr[idx] }; ALT_FIELDS.forEach(f => { it[f] = sItem[f]; }); arr[idx] = it;
  } else if (key.startsWith('item:altdone:')) {
    arr[idx] = { ...arr[idx], alterationDone: sItem.alterationDone };
  } else if (key.startsWith('item:rm:') || key.startsWith('item:rs:')) {
    arr[idx] = { ...arr[idx], isDeleted: sItem.isDeleted, deletedAt: sItem.deletedAt };
  } else {
    arr[idx] = sItem;
  }
  next[list] = arr;
  return next;
}

/** מחיל ערך שנלכד (redo). */
export function applyCaptured(cur, cap) {
  const next = { ...cur };
  if (cap.kind === 'order') {
    next.order = { ...cur.order, ...cap.fields };
    return next;
  }
  const arr = [...(cur[cap.list] || [])];
  const idx = findIdx(arr, cap.ident);
  if (cap.value === null) { if (idx >= 0) arr.splice(idx, 1); }
  else if (idx >= 0) arr[idx] = cap.value;
  else arr.splice(Math.min(Math.max(cap.index, 0), arr.length), 0, cap.value);
  next[cap.list] = arr;
  return next;
}

// מפתח לוקאלי לשורת פריט חדשה (כמו ב-MIM:565)
export const newLocalId = () => ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `l${Date.now()}${Math.random().toString(36).slice(2, 8)}`);

// ---------------------------------------------------------------------------------------------
// אישור מנהל (D12) — אותה הכרעה כמו PopupProvider.showAuthPrompt (app/components/PopupProvider.js:143-160), טהורה
// ---------------------------------------------------------------------------------------------
/**
 * kind: 'debt' (מאשר הזמנה ללא תשלום) | 'feature:<key>' (פריט מאשר בקטלוג ההרשאות) | רמה ישנה ('מנהל','הנהלה ראשית',...)
 * @returns {{pickerLevel:string, requiredLevel:string, featureKey:string}}
 */
export function approvalLevelOf(kind) {
  if (kind === 'debt' || kind === 'מאשר הזמנה ללא תשלום') return { pickerLevel: 'מאשר הזמנה ללא תשלום', requiredLevel: 'מאשר הזמנה ללא תשלום', featureKey: 'feature:debt_approval' };
  return { pickerLevel: kind, requiredLevel: kind, featureKey: kind };
}

export function filterApprovers(employees, pickerLevel) {
  let list = Array.isArray(employees) ? employees : [];
  if (pickerLevel === 'מנהל') list = list.filter(e => e.roleId === 1 || e.roleId === 2);
  else if (pickerLevel === 'מתכנת') list = list.filter(e => e.roleId === 2);
  else if (pickerLevel === 'הנהלה ראשית') list = list.filter(e => e.roleId === 0 || e.roleId === 2);
  else if (pickerLevel === 'מנהל סניף ומעלה') list = list.filter(e => e.roleId === 0 || e.roleId === 1 || e.roleId === 2);
  else if (pickerLevel === 'מאשר הזמנה ללא תשלום') list = list.filter(e => e.canApproveWithoutPayment);
  else if (typeof pickerLevel === 'string' && pickerLevel.startsWith('feature:')) list = list.filter(e => e.approvals && e.approvals[pickerLevel]);
  return list;
}

export const ROLE_LABELS = { 0: 'הנהלה ראשית', 1: 'מנהל', 2: 'מתכנת' };
export const employeeRoleLabel = (e) => (e && (e.department?.name || ROLE_LABELS[e.roleId])) || 'עובד';
export const APPROVAL_MAX_TRIES = 3;
export const APPROVAL_LOCK_MS = 30000;

// גוף verify-pin (חוזה W0 §1.2): {pin, employeeId, requiredLevel} כמו הישן + context {orderId, reason≤200} רק כשיש מספר הזמנה תקין
// (context לא תקין = 400 לפני בדיקת הקוד). בלי context = בדיוק ההתנהגות הישנה.
export function verifyPinBody({ pin, employeeId, requiredLevel, orderId, reason }) {
  const body = { pin, employeeId, requiredLevel };
  const oid = Number(orderId);
  if (Number.isInteger(oid) && oid > 0) body.context = { orderId: oid, reason: String(reason || '').slice(0, 200) };
  return body;
}
