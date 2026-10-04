'use client';

// useItemActions — הפעולות של לשונית הפריטים בכרטיס ההזמנה החדש (W3, PLAN §B.5): סריקה, השכרה/החזרה וביטולן, מצב החזרה, הוספה
// (POST מיידי), עריכה (PUT לפריט), מחיקה/שחזור (נשמר ב-PUT של ההזמנה), פתיחת עריכה מלאה, היתר עריכה. כל endpoint, גוף ושער
// נשמרים כמו בכרטיס הישן; ההבדלים המכוונים מפורטים ב-scratch/order-card-build/W3-NOTES.md.
//
// ===== מפת פורט (פונקציה כאן ← components/orders/modern/ModernItemsManager.js = MIM, rentalToggle.js) =====
// scan ← MIM.handleBarcodeScan :254-377 (בלי שער "הזמנה לא שולמה" — R31 הוסר ע"י הבעלים)
// chooseItemForBarcode ← :379-383 (חלון "לאיזה פריט לשייך" :1200-1255 → env.chooseItem)
// confirmItem ← handleConfirmItem :421-488 (R47 להוספה: feature:item_change_approval → managerEmployeeId/managerPin)
// newItemOf / addItem ← handleAddItem :553-581 + handleModelChange :393-419 (+ confirmItem מיד, כמו "אישור" בשורה החדשה)
// editDraftOf ← handleEditItem :490-510 ; canFullyEditItem ← :82-108 ; evaluateSizeSwap ← :228-242
// toggleDeleted ← :529-551 (R32: בלי הודעת מכסה — הלחצן לא מוצג) ; cancelNewItem ← :521-527 (removeLocalItem)
// rentItem ← handleRent :587-629 ; postRent ← rentalToggle.postRentalRent (409 barcodeMismatch → feature:barcode_mismatch_override)
// returnItem ← handleReturn :631-661 ; postReturn ← rentalToggle.postRentalReturn (409 earlyReturn → feature:early_return_approval)
// cancelRent ← handleCancelRent :663-677 ; cancelReturn ← :679-693 ; טקסטי האישור ← חלון האישור :1151-1161
// setReturnCondition ← :698-732 ; reopenFullEdit ← handleReopenFullEdit :112-130 ; setAltDone ← :786 (לחיצה על "בוצע/לא בוצע")
// itemName/itemCode ← :749-761 ; dedupeAuditLogs ← :25-47 ; statusText ← העיצוב (itemStatTxt) + renderStatusBadge :798-807
//
// למה לא מייבאים את rentalToggle.js עצמו: הוא מאשר דרך mocAuth.verifyPin → window.customAuthPrompt + alert() (חלון בהיר של
// הישן, בלי context ולכן בלי שורת MANAGER_APPROVAL בהיסטוריה). כאן אותו פרוטוקול בדיוק (אותם גופים, אותה לולאת 3 ניסיונות,
// אותן הודעות) עם האישור של הכרטיס (oc.approve → OcApproval → verify-pin עם context). הבדיקה items.endpoints-parity מריצה את
// rentalToggle.js האמיתי ואת הפורט מול אותו שרת מדומה ומשווה את רצף הבקשות.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { describeMismatch } from '@/lib/rentalBarcodeMatch';
import { isWithinItemEditWindow, parseSizeEditDays, evaluateSizeOnlyEdit } from '@/lib/orderItemEditWindow';
import { normalizeGapRule } from '@/lib/priceRows';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import { hebDateOf, newLocalId } from '../orderCardLogic';

// ---------------------------------------------------------------------------------------------
// עזרי תצוגה טהורים (גם לשורה, לטבלה ולחלונות)
// ---------------------------------------------------------------------------------------------
export const isChecked = (v) => v === 1 || v === true;
export const itemCode = (item) => item?.dressItem?.dress?.barcodePrefix || item?.dressItem?.barcodePrefix || item?.barcodePrefix || null;
// שם הדגם בלבד — בלי "(קוד: X)" שמוטמע בתיאור; "ללא שם" → קוד הדגם (MIM :749-759)
export function itemName(item) {
  const raw = item?.dressItem?.dress?.name || item?.description || item?.dressItem?.dressName || 'פריט כללי';
  const cleaned = raw.replace(/\s*\(קוד:[^)]*\)/g, '').trim() || 'פריט כללי';
  if (cleaned.startsWith('ללא שם')) {
    const code = itemCode(item);
    if (code) return String(code);
  }
  return cleaned;
}
export const itemBarcode = (i) => i?.barcode || i?.dressItem?.barcode || i?.dressItem?.dressBarcode || null;
export const itemPrice = (i) => parseFloat(i?.finalPrice) || parseFloat(i?.price) || 0;
export const itemModelId = (i) => i?.dressModelId || i?.dressItem?.dressModelId || null;
export const hasRepairOf = (i) => isChecked(i?.neckAlteration) || isChecked(i?.sleeveAlteration) || !!(i?.lengthAlteration && String(i.lengthAlteration).trim() !== '');
export const isPendingItem = (i) => !!i && (!i.id || i.isNew);

// "תיקון: צוואר, שרוול · בוצע" (העיצוב: itemAltTxt). האורך מוצג בשורה נפרדת ("אורך").
export function altText(i) {
  const a = [isChecked(i?.neckAlteration) && 'צוואר', isChecked(i?.sleeveAlteration) && 'שרוול'].filter(Boolean);
  if (!a.length && !(i?.lengthAlteration && String(i.lengthAlteration).trim() !== '')) return '';
  const parts = a.length ? a.join(', ') : 'אורך';
  return `תיקון: ${parts}${i.alterationDone ? ' · בוצע' : ''}`;
}

// סטטוס הפריט במילים (העיצוב itemStatTxt: נלקחה/נמסרה, הוחזרה/נאספה לפי כיוון המשלוח) + מצב החזרה של הישן (renderStatusBadge)
export function statusText(i, order, mode = 'active') {
  if (mode === 'del') return 'הוסר מההזמנה';
  if (isPendingItem(i)) return 'נוסף · טרם נשמר';
  const dir = order?.deliveryDirection || '';
  const outOn = !!order?.isDelivery && dir !== 'חזור';
  const backOn = !!order?.isDelivery && dir !== 'הלוך';
  if (i.isReturned) return `${backOn ? 'נאספה' : 'הוחזרה'}${i.returnedOk === false ? ' · לא תקין' : ''}`;
  if (i.isTaken) return outOn ? 'נמסרה' : 'נלקחה';
  return outOn ? 'טרם נמסרה' : 'טרם נלקחה';
}

// פריט ממוגרר מ-Access: createdAt קפוא (רגע המיגרציה) → תאריך ההזמנה (A11, ר' lib/pricingCalc getItemAddReference)
export function addedAtOf(item, order) {
  if (!item) return null;
  if (item.legacyId) return item.orderDate || order?.orderDate || null;
  return item.createdAt || item.orderDate || order?.orderDate || null;
}
export const isLegacyItem = (item) => !!(item && item.legacyId);

// שעה ישראלית HH:MM (שעה בלבד — אף פעם לא תאריך לועזי)
export function israelTimeOf(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const s = d.toLocaleString('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return /^\d{2}:\d{2}$/.test(s) ? s : '';
}

// MIM :25-47 — קיפול שורות יומן כפולות של פריט (CREATE כפול; UPDATE גנרי ליד שורת פירוט)
const AUDIT_DUP_WINDOW_MS = 5000;
const rawChanges = (l) => (typeof l.changesJson === 'string' ? l.changesJson : JSON.stringify(l.changesJson));
const isDiffShaped = (l) => {
  try {
    const parsed = JSON.parse(rawChanges(l));
    return Object.values(parsed).some(v => v && typeof v === 'object' && ('from' in v || 'to' in v));
  } catch {
    return false;
  }
};
export function dedupeAuditLogs(logs) {
  const arr = logs || [];
  const near = (a, b) => Math.abs(new Date(a.createdAt) - new Date(b.createdAt)) <= AUDIT_DUP_WINDOW_MS;
  return arr.filter((log, i) => {
    const prev = arr[i - 1];
    const next = arr[i + 1];
    if (prev && prev.action === log.action && rawChanges(prev) === rawChanges(log) && near(prev, log)) return false;
    if (log.action === 'UPDATE' && !isDiffShaped(log)) {
      if ((prev && near(prev, log) && isDiffShaped(prev)) || (next && near(next, log) && isDiffShaped(next))) return false;
    }
    return true;
  });
}
// A11: העובד של שורת ה-CREATE הראשונה (היומן מגיע מהחדש לישן)
export function creatorIdOf(logs) {
  const creates = (logs || []).filter(l => l && l.action === 'CREATE');
  if (!creates.length) return null;
  const first = creates.reduce((a, b) => (new Date(b.createdAt) < new Date(a.createdAt) ? b : a));
  return first.employeeId || null;
}

// R32: המכסה מלאה → "הוסף פריט" (ו"שחזור") לא מוצגים, בלי הודעה. max<=0 / חסר = בלי מגבלה (כמו parseInt של הישן)
export function quotaFull(settings, items) {
  const max = parseInt(settings?.maxItemsPerOrder, 10);
  if (Number.isNaN(max) || max <= 0) return false;
  return (items || []).filter(i => !i.isDeleted).length >= max;
}
// R23: תיקונים פעילים כש-enable_alterations אינו 'false' (MIM :145 — חסר = פעיל)
export const alterationsEnabled = (settings) => (settings && typeof settings.get === 'function' ? settings.get('enable_alterations', null) : null) !== 'false';

// MIM :490-510 — הפריט כפי שהוא נכנס לעריכה (אותם שדות כמו בישן; גוף ה-PUT לפריט = הטיוטה הזו)
export function editDraftOf(item) {
  return {
    ...item,
    isEditing: true,
    originalState: { ...item },
    dressModelId: item.dressModelId || item.dressItem?.dressModelId,
    sizeText: item.sizeText || item.dressItem?.sizeText || item.dressItem?.size || '',
    description: itemName(item),
  };
}

// MIM :553-578 (+ handleModelChange :408-418) — פריט חדש עם הדגם והמידה שנבחרו בחלונית ההוספה
export function newItemOf({ model, sizeText, neckAlteration = 0, sleeveAlteration = 0, lengthAlteration = '', alterationDetails = '' }, localId, nowIso) {
  const base = {
    isNew: true,
    _localId: localId,
    description: '',
    sizeText: '',
    neckAlteration: 0,
    sleeveAlteration: 0,
    lengthAlteration: '',
    alterationDetails: '',
    alterationDone: false,
    finalPrice: 0,
    isDeleted: false,
    createdAt: nowIso,
  };
  const withModel = { ...base, dressModelId: model.id, barcodePrefix: model.barcodePrefix, description: model.name, sizeText: '' };
  return { ...withModel, sizeText, neckAlteration, sleeveAlteration, lengthAlteration, alterationDetails };
}

// גוף ה-PUT/POST לפריט (MIM :471)
export function itemRequestBody(item, { forceFullEdit = false, managerAuth = null } = {}) {
  return { ...item, ...(forceFullEdit ? { forceFullEdit: true } : {}), ...(managerAuth || {}) };
}

// ---------------------------------------------------------------------------------------------
// עזרים טהורים של רכיבי הלשונית (כאן ולא בקובצי ה-JSX כדי שייבדקו ב-node: items.logic.test.mjs)
// ---------------------------------------------------------------------------------------------
// "ללא שם" → קוד הדגם (OrderModelSelector.displayModelName)
export function displayModelName(model) {
  const name = (model?.name || '').trim();
  if (name.startsWith('ללא שם') && model?.barcodePrefix) return String(model.barcodePrefix);
  return name;
}
// טקסט הזמינות של הישן (OrderSizeSelector :104-121) + האם מנוטרלת
export function sizeInfo(row, order) {
  const normalAvail = row.withNormalBuffer?.availableQuantity ?? row.availableQuantity;
  const customAvail = row.withCustomSpacing?.availableQuantity;
  const hasCustom = !!order && order.customSpacing !== undefined && order.customSpacing !== null;
  const selectedAvail = hasCustom ? customAvail : normalAvail;
  const disabled = selectedAvail !== undefined && selectedAvail !== null && selectedAvail <= 0;
  let info;
  if (normalAvail !== undefined) {
    if (row.withCustomSpacing) {
      const gain = row.withCustomSpacing.gain || 0;
      info = `רגיל: ${normalAvail} | ציפוף: ${customAvail}${gain > 0 ? ` (+${gain})` : ''} מתוך ${row.totalInStock}`;
    } else {
      info = `פנוי ${normalAvail} מתוך ${row.totalInStock}`;
    }
  } else {
    info = `במלאי: ${row.totalQuantity || row.totalInStock}`;
  }
  return { size: row.sizeText || row.size, info, disabled };
}
// ---------- A27: מחיר השכרה ודמי ביטול מהמנוע ----------
// פריט "היפותטי" (לא נשמר) נשלח ל-preview-pricing (אותו endpoint וגוף כמו התצוגה המקדימה של הישן, בלי כתיבה) עם שאר הפריטים:
// פעם פעיל → סכום חיובי ההשכרה שלו (בלי שורות "תיקון"); פעם כמבוטל עכשיו → מה שהיה נשאר לתשלום (= דמי הביטול לפי המדרגות).
export const PREVIEW_ITEM_ID = 'oc-add-preview';
export function hypotheticalItem(model, draft) {
  return {
    id: PREVIEW_ITEM_ID,
    legacyId: null,
    sizeText: draft.sizeText,
    neckAlteration: draft.neckAlteration || 0,
    sleeveAlteration: draft.sleeveAlteration || 0,
    lengthAlteration: draft.lengthAlteration || '',
    isDeleted: false,
    dressItem: { id: PREVIEW_ITEM_ID, dressModelId: model.id, sizeText: draft.sizeText, dress: { id: model.id, name: model.name, priceCategory: model.priceCategory || '', isPremium: !!model.isPremium, barcodePrefix: model.barcodePrefix } },
  };
}
export function priceFromPreview(newObligations) {
  return (newObligations || []).filter(o => o.orderItemId === PREVIEW_ITEM_ID && Number(o.amount) > 0 && !/^תיקון/.test(o.description || ''))
    .reduce((s, o) => s + Number(o.amount), 0);
}
export function feeFromPreview(newObligations) {
  const net = (newObligations || []).filter(o => o.orderItemId === PREVIEW_ITEM_ID).reduce((s, o) => s + (Number(o.amount) || 0), 0);
  return Math.max(0, Math.round(net * 100) / 100);
}
export function barcodePlaceholder(item, locked) {
  if (isPendingItem(item)) return 'יש לשמור קודם';
  if (item.isReturned) return 'הפריט הוחזר';
  if (item.isTaken) return 'סרקו ברקוד להחזרה';
  return locked ? 'ההזמנה נעולה' : 'סרקו ברקוד להשכרה';
}
// טווח השאילתה של הישן (חודש לפני ואחרי, YYYY-MM-DD ב-UTC כמו toISOString().split('T')[0])
export function capacityRange(eventDate) {
  const e = new Date(eventDate);
  const from = new Date(e); from.setMonth(from.getMonth() - 1);
  const to = new Date(e); to.setMonth(to.getMonth() + 1);
  return { fromDate: from.toISOString().split('T')[0], toDate: to.toISOString().split('T')[0] };
}
export function capacityPrecheck(item, order) {
  const hasIdentifier = item && (item.dressModelId || item.dressItem?.dressModelId || item.barcodePrefix || item.dressItem?.barcodePrefix || item.dressItem?.dress?.barcodePrefix);
  const size = item?.sizeText || item?.size;
  if (!order?.eventDate) return 'לא הוגדר תאריך אירוע להזמנה זו.';
  if (!hasIdentifier) return 'לא ניתן לבדוק תפוסה לפריט ללא דגם (פריט כללי).';
  if (!size) return 'לא ניתן לבדוק תפוסה לפריט ללא מידה מוגדרת.';
  return '';
}
// חיובי הפריט (MIM :1305-1342)
export function itemObligations(obligations, itemId) {
  const searchStr = `(פריט #${itemId})`;
  return (obligations || []).filter(o => !o.isDeleted && o.description && o.description.includes(searchStr)).map(o => {
    const isCredit = o.amount < 0;
    const label = cleanTxt(o.productName) || (isCredit ? 'זיכוי / ביטול' : (o.description.includes('תיקון') ? 'תיקון' : 'חיוב'));
    const desc = cleanTxt(o.description);
    return { id: o.id, label, desc: desc && desc !== label ? desc : '', amount: Number(o.amount) || 0, isCredit };
  });
}
export function addedText(item, order, creatorName) {
  const at = addedAtOf(item, order);
  const day = hebDateOf(at);
  const time = !isLegacyItem(item) && !isPendingItem(item) ? israelTimeOf(at) : '';
  return [day, time, creatorName].filter(Boolean).join(' · ') || '—';
}
// עמודות הטבלה ומיון (העיצוב: IT_COLS / itemsTable)
export const IT_COLS = [['model', 'דגם'], ['size', 'מידה'], ['stat', 'סטטוס'], ['alt', 'תיקון'], ['price', 'מחיר']];
export function sortItems(list, { col, dir }, order, mode) {
  const num = (v) => { const n = parseInt(v, 10); return Number.isNaN(n) ? 0 : n; };
  const val = (i) => (col === 'model' ? num(itemName(i)) || itemName(i) : col === 'size' ? num(i.sizeText) : col === 'stat' ? statusText(i, order, mode) : col === 'alt' ? altText(i) : itemPrice(i));
  return list.slice().sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * dir; });
}

// ---------------------------------------------------------------------------------------------
// הפעולות עצמן — מפעל טהור עם תלויות מוזרקות (נבדק ב-node, scripts/order-card-tests/items.*.test.mjs)
// ---------------------------------------------------------------------------------------------
/**
 * @param {object} env
 * @param {Function} env.fetch
 * @param {object} env.ui  useOcUi()
 * @param {(kind:string, reason:string)=>Promise<{employeeId:string,employeeName:string,pin:string}|null>} env.approve  oc.approve
 * @param {()=>{order:object,items:object[],settings:object,isLocked:boolean,routeId:string|number,forceEditableIds:Set,sessionEditableIds:Set,priceList:object[]}} env.get
 * @param {(fn:Function)=>void} env.syncItems   עדכון פריטים שכבר נשמרו בשרת (השכרה/החזרה/מצב) — לא "שינוי שלא נשמר"
 * @param {(partial:object)=>string} env.addLocalItem @param {(id:string)=>void} env.removeLocalItem
 * @param {(id:string,b:boolean)=>void} env.markItemDeleted @param {(id:string,b:boolean)=>void} env.setAltDone
 * @param {(order:object,opts?:{savedLocalId?:string})=>void} env.applyServerOrder
 * @param {(id:string)=>void} env.markForceEditable
 * @param {(o:{candidates:object[],barcode:string})=>Promise<object|null>} env.chooseItem
 * @param {()=>void} [env.bumpHistory]
 */
export function createItemActions(env) {
  const f = (...a) => env.fetch(...a);
  const ui = env.ui;
  const fail = (msg) => { ui.toast('error', msg); };
  const bump = () => { if (env.bumpHistory) env.bumpHistory(); };
  const patchItem = (id, patch) => env.syncItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)));
  const activeItemsOf = () => (env.get().items || []).filter(i => !i.isDeleted);

  // ---- rentalToggle.postRentalRent (פורט) ----
  async function postRent(itemId, barcode) {
    const post = (extra = {}) => f('/api/rentals/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, action: 'rent', barcode, ...extra })
    });
    let res = await post();
    for (let attempt = 0; attempt < 3; attempt++) {
      if (res.ok) return { ok: true };
      let data = null;
      try { data = await res.json(); } catch { /* גוף לא תקין - הודעת ברירת מחדל */ }
      if (res.status !== 409 || !data?.barcodeMismatch) return { ok: false, message: null };
      const mismatchMsg = describeMismatch(data.expected, data.scanned);
      const auth = await env.approve('feature:barcode_mismatch_override', `${data.overrideRejected ? `${data.error} ` : `${mismatchMsg}. `}להשכיר בכל זאת? נדרש אישור מנהל.`);
      if (!auth) return { ok: false, message: `${mismatchMsg} - ההשכרה בוטלה.` };
      res = await post({ overridePin: auth.pin, overrideEmployeeId: auth.employeeId });
    }
    return { ok: false, message: 'אישור המנהל נכשל - ההשכרה בוטלה.' };
  }

  // ---- rentalToggle.postRentalReturn (פורט) ----
  async function postReturn(itemId) {
    const post = (extra = {}) => f('/api/rentals/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, action: 'return', ...extra })
    });
    let res = await post();
    for (let attempt = 0; attempt < 3; attempt++) {
      if (res.ok) return { ok: true };
      let data = null;
      try { data = await res.json(); } catch { /* גוף לא תקין - הודעת ברירת מחדל */ }
      if (res.status !== 409 || !data?.earlyReturn) return { ok: false, message: data?.error || null };
      const auth = await env.approve('feature:early_return_approval', `${data.error} להחזיר בכל זאת? נדרש אישור מנהל.`);
      if (!auth) return { ok: false, message: 'ההחזרה בוטלה - האירוע עדיין לא הגיע.' };
      res = await post({ overridePin: auth.pin, overrideEmployeeId: auth.employeeId });
    }
    return { ok: false, message: 'אישור המנהל נכשל - ההחזרה בוטלה.' };
  }

  // ---- השכרה (MIM.handleRent) ----
  async function rentItem(item, barcodeToAssign = null) {
    if (!item || !item.id || item.isNew) return { ok: false };
    if (env.get().isLocked) { fail('ההזמנה נעולה (תאריך האירוע עבר) — ניתן לבצע החזרה בלבד. השכרה דורשת שחרור באישור מנהל.'); return { ok: false }; }
    const takenDate = new Date();
    patchItem(item.id, { isTaken: true, takenDate, ...(barcodeToAssign ? { barcode: barcodeToAssign } : {}) });
    let result;
    try {
      result = await postRent(item.id, barcodeToAssign);
    } catch {
      result = { ok: false, message: null };
    }
    if (!result.ok) {
      fail(result.message || 'שגיאה בשמירת סטטוס השכרה');
      patchItem(item.id, { isTaken: item.isTaken, takenDate: item.takenDate, barcode: item.barcode });
      return { ok: false };
    }
    bump();
    return { ok: true, kind: 'rent', item };
  }

  // ---- החזרה (MIM.handleReturn) ----
  async function returnItem(item) {
    if (!item || !item.id || item.isNew) return { ok: false };
    // השרת רושם returnedOk=true בהחזרה רגילה (rentals/toggle) — כך גם כאן, אחרת השורה הציגה "לא תקין" עד טעינה מחדש
    patchItem(item.id, { isReturned: true, returnDate: new Date(), returnedOk: true });
    let result;
    try {
      result = await postReturn(item.id);
    } catch {
      result = { ok: false, message: null };
    }
    if (!result.ok) {
      fail(result.message || 'שגיאה בשמירת סטטוס החזרה');
      patchItem(item.id, { isReturned: item.isReturned, returnDate: item.returnDate, returnedOk: item.returnedOk });
      return { ok: false };
    }
    bump();
    return { ok: true, kind: 'return', item };
  }

  // ---- ביטול השכרה / החזרה (MIM :663-693 + חלון האישור :1151-1161) ----
  const labelOf = (item) => (item ? `"${itemName(item)}"${itemCode(item) ? ` (קוד: ${itemCode(item)})` : ''}` : 'פריט זה');
  async function cancelRent(item, { confirmed = false } = {}) {
    if (!item || !item.id) return { ok: false };
    if (env.get().isLocked) return { ok: false };
    if (!confirmed) {
      const ok = await ui.confirm({ title: 'ביטול השכרה', sub: `האם אתה בטוח שברצונך לבטל את השכרת ${labelOf(item)}?`, okText: 'אישור', icon: 'undo' });
      if (!ok) return { ok: false, cancelled: true };
    }
    patchItem(item.id, { isTaken: false, takenDate: null, barcode: null });
    try {
      const res = await f('/api/rentals/toggle', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, action: 'undoRent' })
      });
      if (!res.ok) throw new Error('API failed');
    } catch {
      fail('שגיאה בביטול סטטוס השכרה');
      patchItem(item.id, { isTaken: item.isTaken, takenDate: item.takenDate, barcode: item.barcode });
      return { ok: false };
    }
    bump();
    return { ok: true };
  }
  async function cancelReturn(item, { confirmed = false } = {}) {
    if (!item || !item.id) return { ok: false };
    if (!confirmed) {
      const ok = await ui.confirm({ title: 'ביטול החזרה', sub: `האם אתה בטוח שברצונך לבטל את החזרת ${labelOf(item)}?`, okText: 'אישור', icon: 'undo' });
      if (!ok) return { ok: false, cancelled: true };
    }
    patchItem(item.id, { isReturned: false, returnDate: null, returnedOk: false });
    try {
      const res = await f('/api/rentals/toggle', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, action: 'undoReturn' })
      });
      if (!res.ok) throw new Error('API failed');
    } catch {
      fail('שגיאה בביטול סטטוס החזרה');
      patchItem(item.id, { isReturned: item.isReturned, returnDate: item.returnDate, returnedOk: item.returnedOk });
      return { ok: false };
    }
    bump();
    return { ok: true };
  }

  // ---- מצב החזרה תקין / לא תקין (MIM :698-732) — מותר גם בהזמנה נעולה (R27) ----
  async function setReturnCondition(item, ok, { note: givenNote } = {}) {
    if (!item?.id || item.isNew || !item.isReturned) return { ok: false };
    const current = item.returnedOk !== false;
    if (current === ok) return { ok: false };
    let note = null;
    if (!ok) {
      note = givenNote !== undefined ? givenNote : await ui.prompt({
        title: 'החזרה לא תקינה',
        sub: `${itemName(item)}${item.sizeText ? ` · מידה ${item.sizeText}` : ''}`,
        label: 'הערה על הפריט (תתווסף לכרטיס הלקוח)',
        icon: 'note',
        placeholder: 'מה לא תקין?',
        okText: 'שמור הערה',
      });
      if (note === null) return { ok: false, cancelled: true };
    }
    patchItem(item.id, { returnedOk: ok });
    try {
      const res = ok
        ? await f('/api/rentals/toggle', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: item.id, action: 'setReturnCondition', returnedOk: true })
        })
        : await f('/api/returns/report-issue', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderItemId: item.id, issueType: 'returned-bad', note })
        });
      if (!res.ok) throw new Error('API failed');
    } catch {
      fail('שגיאה בעדכון מצב הפריט');
      patchItem(item.id, { returnedOk: item.returnedOk });
      return { ok: false };
    }
    bump();
    return { ok: true };
  }

  // ---- סריקת ברקוד (MIM.handleBarcodeScan; R42 שורת הסריקה) ----
  async function scan(rawBarcode) {
    const barcode = (rawBarcode || '').trim();
    if (!barcode) return { ok: false };
    const st = env.get();
    // רק פריטים שמורים (לפריט שטרם נשמר אין מה להשכיר בשרת)
    const activeItems = activeItemsOf().filter(i => i.id && !i.isNew);

    if (st.isLocked) {
      const isReturnScan = activeItems.some(i => itemBarcode(i) === barcode && i.isTaken && !i.isReturned);
      if (!isReturnScan) {
        fail('ההזמנה נעולה (תאריך האירוע עבר) — ניתן לבצע החזרה בלבד. השכרה דורשת שחרור באישור מנהל.');
        return { ok: false };
      }
    }

    // 1. אימות הפריט מול המלאי בשרת
    let dressInfo = null;
    try {
      const vRes = await f('/api/rentals/verify-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode, orderId: st.order?.orderId })
      });
      const vData = await vRes.json();
      if (!vRes.ok || !vData.valid) {
        fail(vData.error || `ברקוד ${barcode} אינו תקף להשכרה.`);
        return { ok: false };
      }
      if (vData.unreturned) {
        const yes = await ui.confirm({
          title: 'השמלה רשומה בהשכרה אחרת',
          sub: `${vData.warning} האם ברצונך לסמן אותה כהוחזרה מההשכרה הקודמת (הזמנה #${vData.unreturnedOrderId}) ולהמשיך בהשכרה זו?`,
          okText: 'כן, סמן והמשך',
          icon: 'check',
        });
        if (!yes) return { ok: false, cancelled: true };
        const putRes = await f('/api/rentals/scan', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unreturnedItemId: vData.unreturnedItemId })
        });
        if (!putRes.ok) {
          const errData = await putRes.json().catch(() => ({}));
          fail(errData.error || 'שגיאה בעדכון החזרה מהשכרה קודמת');
          return { ok: false };
        }
      }
      dressInfo = vData.dressItem;
    } catch (err) {
      console.error('Error calling verify-item API:', err);
    }

    // 2. מציאת הפריט המתאים בהזמנה — קודם ברקוד שכבר שויך, אחרת לפי קידומת+מידה
    let matchedItem = activeItems.find(i => { const b = itemBarcode(i); return b && b === barcode; }) || null;
    let candidates = [];
    if (!matchedItem) {
      candidates = activeItems.filter(i => {
        if (i.isTaken) return false;
        const iPfx = i.dressItem?.dress?.barcodePrefix || i.dressItem?.barcodePrefix || i.barcodePrefix;
        const iSize = i.dressItem?.sizeText || i.sizeText;
        if (dressInfo) {
          const matchPfx = dressInfo.barcodePrefix ? (iPfx === dressInfo.barcodePrefix || String(barcode).startsWith(String(iPfx))) : true;
          const matchSize = dressInfo.sizeText ? (iSize === dressInfo.sizeText || (parseInt(iSize) === parseInt(dressInfo.sizeText))) : true;
          if (matchPfx && matchSize) return true;
        }
        if (iPfx && iSize) {
          if (barcode.startsWith(String(iPfx)) && barcode.includes(String(iSize))) return true;
        }
        return false;
      });
      if (candidates.length === 1) matchedItem = candidates[0];
    }

    // כמה פריטים זהים תואמים — בוחרים לאיזה לשייך
    if (!matchedItem && candidates.length > 1) {
      const chosen = await env.chooseItem({ candidates, barcode });
      if (!chosen) return { ok: false, cancelled: true };
      return rentItem(chosen, barcode);
    }

    if (!matchedItem) {
      const detailsStr = dressInfo ? ` (דגם ${dressInfo.dressName || dressInfo.barcodePrefix || ''}, מידה ${dressInfo.sizeText || ''})` : '';
      fail(`ברקוד ${barcode}${detailsStr} לא נמצא בין הפריטים שטרם הושכרו בהזמנה זו.`);
      return { ok: false };
    }

    if (!matchedItem.isTaken) return rentItem(matchedItem, barcode);
    if (!matchedItem.isReturned) return returnItem(matchedItem);
    fail(`פריט ${barcode} כבר הוחזר.`);
    return { ok: false };
  }

  // ---- שדה הברקוד בשורת הפריט (R25): השכרה עם הברקוד שהוזן / החזרה של הפריט הזה ----
  // השכרה = "השכרה" + "הזנת ברקוד ידנית" של הישן (handleRent(item, barcode), השרת בודק התאמה); החזרה = "החזרה" של הישן,
  // רק כשהברקוד הוא של הפריט הזה (או שלא נרשם לו ברקוד).
  async function barcodeForItem(item, raw) {
    const barcode = (raw || '').trim();
    if (!item || !item.id || item.isNew) return { ok: false };
    if (!item.isTaken) {
      const needsBarcode = !!(item.barcodePrefix || item.dressItem?.barcodePrefix);
      if (!barcode && needsBarcode) return { ok: false };
      return rentItem(item, barcode || null);
    }
    if (!item.isReturned) {
      const own = itemBarcode(item);
      if (own && barcode && own !== barcode) {
        fail(`ברקוד ${barcode} אינו הברקוד של ${itemName(item)} (${own}).`);
        return { ok: false };
      }
      return returnItem(item);
    }
    return { ok: false };
  }

  // ---- אישור פריט: POST לפריט חדש / PUT לפריט קיים (MIM.handleConfirmItem) ----
  async function confirmItem(item) {
    const st = env.get();
    const hasModelIdentity = !!(item.dressModelId || item.barcodePrefix || item.dressItem?.dressModelId || item.dressItem?.barcodePrefix);
    if (!item.sizeText || !hasModelIdentity) { fail('יש לבחור דגם ומידה לפני האישור'); return { ok: false }; }
    const hasRepair = item.neckAlteration || item.sleeveAlteration || (item.lengthAlteration && item.lengthAlteration.trim() !== '');
    if (alterationsEnabled(st.settings) && hasRepair && (!item.alterationDetails || item.alterationDetails.trim() === '')) {
      fail('חובה להזין פירוט תיקון כאשר נבחר תיקון');
      return { ok: false };
    }
    const isEditing = !!item.id && !item.isNew;
    let managerAuth = null;
    if (!isEditing && st.settings.requireManagerCodeForItems) {
      const auth = await env.approve('feature:item_change_approval', 'הוספת פריט חדש להזמנה קיימת דורשת גם אישור מנהל (בנוסף לאימות ת״ז בשמירה).');
      if (!auth || !auth.pin) return { ok: false, cancelled: true };
      managerAuth = { managerEmployeeId: auth.employeeId, managerPin: auth.pin };
    }
    const orderId = st.order?.orderId;
    const url = isEditing ? `/api/orders/${orderId}/items/${item.id}` : `/api/orders/${orderId}/items`;
    const method = isEditing ? 'PUT' : 'POST';
    const body = itemRequestBody(item, { forceFullEdit: !!(item.id && st.forceEditableIds && st.forceEditableIds.has(item.id)), managerAuth });
    try {
      const res = await f(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בשמירת הפריט');
      env.applyServerOrder(data, { savedLocalId: item._localId });
      return { ok: true, order: data };
    } catch (error) {
      fail(error.message);
      return { ok: false, error: error.message };
    }
  }

  // ---- הוספה מחלונית "הוספת שמלה": שורה מקומית + POST מיד ----
  async function addItem(draft) {
    const st = env.get();
    if (st.isLocked) return { ok: false };
    if (quotaFull(st.settings, st.items)) return { ok: false }; // R32: הלחצן כבר מוסתר; בלי הודעה
    if (!draft || !draft.model || !draft.model.id || !draft.sizeText) { fail('יש לבחור דגם ומידה לפני האישור'); return { ok: false }; }
    const localId = newLocalId();
    const newItem = newItemOf(draft, localId, new Date().toISOString());
    // בדיקות האישור לפני שהשורה נכנסת (כדי לא להשאיר שורה ריקה כשהפירוט חסר)
    const hasRepair = newItem.neckAlteration || newItem.sleeveAlteration || (newItem.lengthAlteration && newItem.lengthAlteration.trim() !== '');
    if (alterationsEnabled(st.settings) && hasRepair && (!newItem.alterationDetails || newItem.alterationDetails.trim() === '')) {
      fail('חובה להזין פירוט תיקון כאשר נבחר תיקון');
      return { ok: false };
    }
    // שורה חדשה רק דרך oc.edit (הבקר מקצה/מאשר את ה-_localId - W1-NOTES §8 סעיף 5)
    const assigned = env.addLocalItem(newItem) || localId;
    const saved = assigned === localId ? newItem : { ...newItem, _localId: assigned };
    const r = await confirmItem(saved);
    return { ...r, localId: assigned };
  }

  // ---- מחיקה / שחזור (נשמר בשמירת ההזמנה; R47 נבדק בשמירה ע"י הבקר) ----
  async function toggleDeleted(item, { confirmed = false } = {}) {
    if (!item) return { ok: false };
    const st = env.get();
    if (!item.id) { env.removeLocalItem(item._localId); return { ok: true }; } // שורה שטרם נשמרה (cancelNewItem)
    const isCurrentlyDeleted = !!item.isDeleted;
    if (!isCurrentlyDeleted && item.isTaken) {
      fail('לא ניתן למחוק פריט שכבר נלקח (מושכר). יש להחזירו קודם לכן או לבטל את הלקיחה.');
      return { ok: false };
    }
    if (st.isLocked) return { ok: false };
    if (isCurrentlyDeleted && quotaFull(st.settings, st.items)) return { ok: false }; // R32
    if (!confirmed) {
      const ok = await ui.confirm(isCurrentlyDeleted
        ? { title: 'שחזור פריט', sub: 'האם אתה בטוח שברצונך לשחזר פריט זה להזמנה?', okText: 'שחזר', icon: 'undo' }
        : { title: 'הסרת פריט', sub: 'האם אתה בטוח שברצונך למחוק פריט זה?', okText: 'הסר', icon: 'trash', danger: true });
      if (!ok) return { ok: false, cancelled: true };
    }
    env.markItemDeleted(item.id, !isCurrentlyDeleted);
    return { ok: true };
  }

  // ---- פתיחת עריכה מלאה באישור מנהל (MIM.handleReopenFullEdit) ----
  async function reopenFullEdit(item) {
    if (!item?.id) return false;
    const auth = await env.approve('feature:item_edit_reopen', 'חלון העריכה המלא (15 דק׳) לפריט זה נסגר. נדרש אישור מנהל לפתיחתו מחדש לעריכה מלאה.');
    if (!auth || !auth.pin) return false;
    env.markForceEditable(item.id);
    return true;
  }

  // "תיקון בוצע" (MIM :786 — לא בהזמנה נעולה) — נשמר בשמירת ההזמנה
  function toggleAltDone(item) {
    if (!item?.id || env.get().isLocked) return;
    env.setAltDone(item.id, !item.alterationDone);
  }

  return { scan, barcodeForItem, rentItem, returnItem, cancelRent, cancelReturn, setReturnCondition, confirmItem, addItem, toggleDeleted, reopenFullEdit, toggleAltDone, postRent, postReturn };
}

// ---------------------------------------------------------------------------------------------
// כללי עריכה (MIM :82-108, :228-242) — טהורים
// ---------------------------------------------------------------------------------------------
export function canFullyEditItem(item, { sessionEditableIds, forceEditableIds }) {
  if (!item) return false;
  if (item.isTaken && !item.isReturned) return false;
  if (item.isNew || !item.id) return true;
  return !!(sessionEditableIds && sessionEditableIds.has(item.id)) || !!(forceEditableIds && forceEditableIds.has(item.id));
}
export function evaluateSizeSwap(item, checkedSize, { sizeEditDays, priceList, gapRule, eventDate }) {
  if (sizeEditDays === null || sizeEditDays === undefined || !item || item.isNew || !item.id) return { ok: false, reason: null };
  if (item.isTaken) return { ok: false, reason: null };
  if (!priceList || !priceList.length) return { ok: false, reason: null };
  const savedSize = item.originalState ? item.originalState.sizeText : item.sizeText;
  return evaluateSizeOnlyEdit({ item, oldSizeText: savedSize, newSizeText: checkedSize || savedSize, eventDate, priceList, sizeEditDays, gapRule });
}

// ---------------------------------------------------------------------------------------------
// ה-hook: מחבר את המפעל לבקר (oc) ולערכת החלונות (ui)
// ---------------------------------------------------------------------------------------------
// מחירון — נטען רק כשההגדרה size_edit_until_days_before_event פעילה (MIM :151-156). אותו מטמון משותף כמו בישן.
const PRICELISTS_URL = '/api/pricelists';

/**
 * @param {object} oc  useOrderCardController
 * @param {object} ui  useOcUi
 * @param {{chooseItem?:Function}} [opts]
 */
export default function useItemActions(oc, ui, { chooseItem } = {}) {
  const ocRef = useRef(oc);
  const chooseRef = useRef(chooseItem);
  useLayoutEffect(() => { ocRef.current = oc; chooseRef.current = chooseItem; });

  // חלון 15 הדקות: כל פריט שנכנס לחלון בביקור הזה נשאר פתוח עד סוף הביקור (MIM :82-99)
  const [sessionEditableIds, setSessionEditableIds] = useState(() => new Set());
  const items = oc.items;
  useEffect(() => {
    setSessionEditableIds(prev => {
      let changed = false;
      const next = new Set(prev);
      (items || []).forEach(it => {
        if (it?.id && !next.has(it.id) && isWithinItemEditWindow(it)) { next.add(it.id); changed = true; }
      });
      return changed ? next : prev;
    });
  }, [items]);
  const [forceEditableIds, setForceEditableIds] = useState(() => new Set());
  const editSetsRef = useRef({ sessionEditableIds, forceEditableIds });
  useLayoutEffect(() => { editSetsRef.current = { sessionEditableIds, forceEditableIds }; });

  const sizeEditDays = parseSizeEditDays(oc.settings.get('size_edit_until_days_before_event', null));
  const gapRule = normalizeGapRule(oc.settings.get('gap_size_price_rule', null));
  const [priceList, setPriceList] = useState([]);
  useEffect(() => {
    if (sizeEditDays === null) return;
    fetchSharedJson(PRICELISTS_URL, { ttl: TTL.STATIC })
      .then(data => { if (Array.isArray(data)) setPriceList(data); })
      .catch(console.error);
  }, [sizeEditDays]);
  const priceRef = useRef(priceList);
  useLayoutEffect(() => { priceRef.current = priceList; });

  const actions = useMemo(() => createItemActions({
    fetch: (...a) => fetch(...a),
    ui,
    approve: (kind, reason) => ocRef.current.approve(kind, reason),
    get: () => {
      const c = ocRef.current;
      return { order: c.order, items: c.items, settings: c.settings, isLocked: c.flags.isLocked, routeId: c.orderRef, priceList: priceRef.current, ...editSetsRef.current };
    },
    // פעולה שכבר נשמרה בשרת: הבקר מעדכן גם את ה-snapshot (syncItems) כדי שלא תוצג כ"שינוי שלא נשמר". עד שהבקר יחשוף אותה
    // (REQUESTS-W3.md #1) — עדכון רגיל של הפריטים (כמו onItemsChange של הישן, שגם הוא סימן את ההזמנה כ"לא נשמרה").
    syncItems: (fn) => { const c = ocRef.current; if (typeof c.syncItems === 'function') c.syncItems(fn); else c.edit.setItems(fn); },
    addLocalItem: (p) => ocRef.current.edit.addLocalItem(p),
    removeLocalItem: (id) => ocRef.current.edit.removeLocalItem(id),
    markItemDeleted: (id, b) => ocRef.current.edit.markItemDeleted(id, b),
    setAltDone: (id, b) => ocRef.current.edit.setAltDone(id, b),
    applyServerOrder: (o, opts) => ocRef.current.applyServerOrder(o, opts),
    markForceEditable: (id) => setForceEditableIds(prev => new Set(prev).add(id)),
    chooseItem: (o) => (chooseRef.current ? chooseRef.current(o) : Promise.resolve(null)),
    bumpHistory: () => ocRef.current.bumpHistory(),
  }), [ui]);

  const rules = useMemo(() => ({
    canFullyEdit: (item) => canFullyEditItem(item, { sessionEditableIds, forceEditableIds }),
    sizeSwap: (item, size) => evaluateSizeSwap(item, size, { sizeEditDays, priceList, gapRule, eventDate: oc.order?.eventDate }),
    isForced: (item) => !!(item && item.id && forceEditableIds.has(item.id)),
  }), [sessionEditableIds, forceEditableIds, sizeEditDays, priceList, gapRule, oc.order?.eventDate]);

  const run = useCallback((name, ...args) => actions[name](...args), [actions]);
  return { ...actions, rules, run };
}
