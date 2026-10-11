// lib/searchPanelCore.js - הלוגיקה הטהורה של פאנל התפוסה / הפריט בחיפוש (בלי prisma / רשת): נתונים גולמיים -> מה שמוצג.
// השרת (lib/searchPanel.js) שולף את השורות; כאן כל ההחלטות, כדי שאפשר לבדוק אותן ב-node על מקרי קצה סינתטיים (scripts/test_search_panel_core.mjs).
// הגדרות מלאות ב-docs/search-capacity-embed.md.
//
// "תפוסה" (מלאי / בתפוסה / רזרבה): אותם כללים בדיוק כמו /api/inventory/capacity ו-lib/capacity.js - הפונקציות isStockLocation / isReserveLocation /
// capacityWindow / orderOverlapsWindow מיובאות משם ולא משוכפלות.
//
// יום האירוע של הזמנה: ב-DB תאריכי האירוע שמורים בשלוש צורות (יבוא Access: 18:00/20:00 UTC של היום הקודם; הזמנות חדשות: חצות ישראל או חצות UTC).
// החלון של ±12 שעות ב-lib/capacity.js ממפה את כולם ליום הנכון, ולכן "יום האירוע" כאן = התאריך (UTC) של הרגע + 12 שעות - לא israelDayKey (היה נותן יום אחד אחורה
// לשורות הישנות). "היום" = israelDayKey(now).

import { capacityWindow, isReserveLocation, isServiceable, isStockLocation, orderOverlapsWindow, qty } from './capacityRules.js';
import { israelDayKey, sizeKey } from './searchNormalize.js';
import { compareSizeText } from './sizeSort.js';

export const DRAFT_STATUS = 'טיוטה'; // מראה של lib/orderReservation.js DRAFT_ORDER_STATUS (כאן טהור, בלי import של שרת)
export const LIST_CAPS = Object.freeze({ out: 40, pending: 40, returned: 12 });

const DAY_MS = 86400000;
const HALF_DAY_MS = 12 * 3600 * 1000;

/** יום האירוע (YYYY-MM-DD) של רגע שמור: תאריך UTC של הרגע + 12 שעות. */
export function eventDayKey(instant) {
  if (!instant) return null;
  const t = new Date(instant).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t + HALF_DAY_MS).toISOString().slice(0, 10);
}
export const dayNum = (key) => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / DAY_MS); };

/** מפתחות מידה (06 = 6 = " 06") מרשימת מידות מוקלדות; ריקה = null (כל המידות). */
export function sizeKeySet(sizes) {
  const list = (sizes || []).map((s) => sizeKey(s)).filter(Boolean);
  return list.length ? new Set(list) : null;
}

/**
 * מפתחות המידה של שורת פריט-הזמנה, באותה התאמה שבה /api/inventory/capacity בוחר שורה: OrderItem.size / OrderItem.sizeText כשהקידומת שלו היא הדגם,
 * או sizeText של השמלה המקושרת כשהקידומת שלה היא הדגם.
 */
export function rowSizeKeys(row, prefix) {
  const out = [];
  if (row.oiPrefix === prefix) {
    if (row.size != null && String(row.size).trim() !== '') out.push(sizeKey(row.size));
    if (row.sizeText != null && String(row.sizeText).trim() !== '') out.push(sizeKey(row.sizeText));
  }
  if (row.diPrefix === prefix && row.diSize != null && String(row.diSize).trim() !== '') out.push(sizeKey(row.diSize));
  return [...new Set(out)];
}
/** האם השורה שייכת לדגם (והמידה/ות אם נבחרו). */
export function rowMatches(row, prefix, keySet) {
  const keys = rowSizeKeys(row, prefix);
  if (!keys.length) return !keySet && (row.oiPrefix === prefix || row.diPrefix === prefix); // דגם בלי מידה רשומה: רק כשלא סוננה מידה
  return !keySet || keys.some((k) => keySet.has(k));
}

const trim = (v) => (v == null ? '' : String(v).trim());
const personName = (r) => {
  const last = trim(r.lastName), first = trim(r.firstName);
  return last && first ? `${last} ${first}` : last || first;
};
const phoneOf = (r) => trim(r.phone1) || trim(r.phone2);

/** שורת רשימה אחידה (השרת מוסיף hebDate). state: out | returned | pending. */
function listRow(r, state, todayKey) {
  const endKey = eventDayKey(r.orderReturn || r.eventDate);
  return {
    key: `${state}-${r.id}`,
    rowId: r.id,
    state,
    orderId: r.orderId,
    barcode: r.isTaken ? trim(r.barcode) : '', // כמו בחיפוש המתקדם: ברקוד רק כשהפריט באמת יצא
    size: trim(r.sizeText) || trim(r.diSize) || trim(r.size),
    qty: qty(r),
    name: personName(r),
    lastName: trim(r.lastName),
    phone: phoneOf(r),
    eventKey: eventDayKey(r.eventDate),
    endKey,
    hebText: trim(r.eventDateHebrew),
    takenAt: r.takenDate || null,
    returnedAt: r.isReturned ? (r.oiReturn || null) : null,
    late: state === 'out' && !!endKey && !!todayKey && endKey < todayKey,
    draft: r.status === DRAFT_STATUS,
  };
}

const sortDesc = (a, b) => b - a;
const ts = (d) => (d ? new Date(d).getTime() : 0);

// match = (שורה) => האם היא שייכת לדגם/מידה הנבחרים (rowMatches); לפריט בודד - כל שורות הברקוד שלו.
/** שורות "בחוץ": נלקחו ולא הוחזרו. החדש ראשון (לפי תאריך הלקיחה, ואם אין - תאריך האירוע). */
export function outRows(rows, match, todayKey) {
  return rows
    .filter((r) => r.isTaken && !r.isReturned && match(r))
    .map((r) => ({ r, k: ts(r.takenDate) || ts(r.eventDate) }))
    .sort((a, b) => sortDesc(a.k, b.k) || sortDesc(a.r.orderId, b.r.orderId))
    .map(({ r }) => listRow(r, 'out', todayKey));
}
/** שורות "הוחזרו": מהחדש לישן לפי תאריך ההחזרה (ואם אין - הלקיחה / האירוע). */
export function returnedRows(rows, match, todayKey) {
  return rows
    .filter((r) => r.isReturned && match(r))
    .map((r) => ({ r, k: ts(r.oiReturn) || ts(r.takenDate) || ts(r.eventDate) }))
    .sort((a, b) => sortDesc(a.k, b.k) || sortDesc(a.r.orderId, b.r.orderId))
    .map(({ r }) => listRow(r, 'returned', todayKey));
}
/** שורות "ממתינות": הזמנות עתידיות (הסוף שלהן מהיום והלאה) שטרם נלקחו. הקרובה ראשונה. */
export function pendingRows(rows, match, todayKey) {
  return rows
    .filter((r) => !r.isTaken && !r.isReturned && match(r))
    .filter((r) => { const e = eventDayKey(r.orderReturn || r.eventDate); return !!e && e >= todayKey; })
    .map((r) => ({ r, k: ts(r.eventDate) }))
    .sort((a, b) => a.k - b.k || a.r.orderId - b.r.orderId)
    .map(({ r }) => listRow(r, 'pending', todayKey));
}

/** מלאי / רזרבה של הפריטים (פריטי הדגם שלא נמחקו) לפי מידה/ות. */
export function stockAndReserve(items, keySet) {
  let stock = 0, reserve = 0;
  for (const it of items) {
    if (!isServiceable(it)) continue;
    if (keySet && !keySet.has(sizeKey(it.sizeText))) continue;
    if (isStockLocation(it.location)) stock += qty(it);
    else if (isReserveLocation(it.location)) reserve += qty(it);
  }
  return { stock, reserve };
}

/** "בתפוסה" ביום: אותו כלל חלון כמו /api/inventory/capacity (כולל הזמנות שהוחזרו) - סכום כמויות. */
export function busyOn(rows, prefix, keySet, dateKey) {
  const win = capacityWindow(dateKey, dateKey);
  let busy = 0;
  for (const r of rows) {
    if (!rowMatches(r, prefix, keySet)) continue;
    if (orderOverlapsWindow({ eventDate: r.eventDate, returnDate: r.orderReturn }, win)) busy += qty(r);
  }
  return busy;
}

/** פירוט לפי מידה (לדגם בלי מידה נבחרת): מלאי / רזרבה / בתפוסה / פנוי לכל מידה. */
export function perSize(items, rows, prefix, dateKey) {
  const keys = new Map(); // key -> display
  for (const it of items) { const k = sizeKey(it.sizeText); if (!keys.has(k)) keys.set(k, trim(it.sizeText) || k); }
  for (const r of rows) for (const k of rowSizeKeys(r, prefix)) if (!keys.has(k)) keys.set(k, trim(r.sizeText) || trim(r.diSize) || k);
  const out = [];
  for (const [k, display] of keys) {
    const ks = new Set([k]);
    const sr = stockAndReserve(items, ks);
    const busy = busyOn(rows, prefix, ks, dateKey);
    out.push({ key: k, size: display, stock: sr.stock, reserve: sr.reserve, busy, free: Math.max(0, sr.stock - busy) });
  }
  return out.filter((s) => s.stock || s.reserve || s.busy).sort((a, b) => compareSizeText(a.key, b.key));
}

/**
 * "חייבות אותו" - הזמנות עתידיות שטרם נלקחו לדגם+מידה, שבלי הפריט הזה לא היה מספיק מלאי לכולן.
 *   היצע   n0 = פריטי המלאי (isServiceable + isStockLocation: בלי תיקון / לא בשימוש / מחסן / רזרבה) של אותה מידה, בלי הפריט עצמו.
 *   ביקוש  כל פריטי ההזמנה של הדגם+מידה שלא הוחזרו, כל אחד על טווח ימי האירוע [eventDay, returnDay||eventDay]; פריט שנלקח ועבר מועד ההחזרה
 *          עדיין תופס מקום (נחשב עד היום). פריט שלא נלקח והסתיים בעבר אינו ביקוש.
 *   הזמנה u חייבת את הפריט אם בשיא העומס שבטווח שלה (כולל u עצמה) מספר הפריטים הנדרשים גדול מ-n0.
 * @param {{rows: object[], items: object[], prefix: number, sizeKey: string, excludeBarcode: string|null, todayKey: string}} p
 * @returns {{count: number, ids: Set<string>, n0: number}}  ids = מזהי שורות (OrderItem.id) של ההזמנות החייבות
 */
export function requiredFor({ rows, items, prefix, sizeKey: k, excludeBarcode, todayKey }) {
  let n0 = 0;
  for (const it of items) {
    if (!isServiceable(it) || !isStockLocation(it.location)) continue;
    if (sizeKey(it.sizeText) !== k) continue;
    if (excludeBarcode && trim(it.dressBarcode) === excludeBarcode) continue;
    n0 += qty(it);
  }
  const keySet = new Set([k]);
  const todayN = dayNum(todayKey);
  const ivs = [];
  for (const r of rows) {
    if (r.isReturned || !rowMatches(r, prefix, keySet)) continue;
    const sK = eventDayKey(r.eventDate);
    let eK = eventDayKey(r.orderReturn || r.eventDate);
    if (!sK || !eK) continue;
    if (eK < todayKey) { if (!r.isTaken) continue; eK = todayKey; } // לא נלקח ועבר = לא ביקוש; נלקח ולא הוחזר = עדיין תופס
    ivs.push({ id: r.id, s: Math.max(dayNum(sK), todayN), e: dayNum(eK), q: qty(r), pending: !r.isTaken });
  }
  const ids = new Set();
  const pend = ivs.filter((iv) => iv.pending);
  if (!pend.length) return { count: 0, ids, n0 };
  const lo = Math.min(...ivs.map((iv) => iv.s));
  const hi = Math.min(Math.max(...ivs.map((iv) => iv.e)), lo + 800); // תקרה: שנתיים+ קדימה אינן ריאליות
  const cover = new Array(hi - lo + 2).fill(0);
  for (const iv of ivs) {
    const a = iv.s - lo, b = Math.min(iv.e, hi) - lo;
    if (b < 0) continue;
    cover[a] += iv.q; cover[b + 1] -= iv.q;
  }
  for (let i = 1; i < cover.length; i++) cover[i] += cover[i - 1];
  let count = 0;
  for (const iv of pend) {
    let peak = 0;
    for (let d = iv.s; d <= Math.min(iv.e, hi); d++) peak = Math.max(peak, cover[d - lo]);
    if (peak > n0) { ids.add(iv.id); count += iv.q; }
  }
  return { count, ids, n0 };
}

/** נתוני פאנל "דגם". */
export function buildModelPanel({ model, items, rows, returned, sizes, dateKey, todayKey }) {
  const prefix = model.prefix;
  const keySet = sizeKeySet(sizes);
  const { stock, reserve } = stockAndReserve(items, keySet);
  const busy = busyOn(rows, prefix, keySet, dateKey);
  const match = (r) => rowMatches(r, prefix, keySet);
  const out = outRows(rows, match, todayKey);
  const pending = pendingRows(rows, match, todayKey);
  const ret = returnedRows(returned || [], match, todayKey);
  return {
    mode: 'model',
    model: { id: model.id, name: model.name || '', prefix },
    sizes: sizes || [],
    dateKey, todayKey,
    tiles: { stock, busy, reserve, free: Math.max(0, stock - busy) },
    perSize: keySet ? [] : perSize(items, rows, prefix, dateKey),
    sections: {
      out: { total: out.length, rows: out.slice(0, LIST_CAPS.out) },
      returned: { total: ret.length, rows: ret.slice(0, LIST_CAPS.returned) },
      pending: { total: pending.length, rows: pending.slice(0, LIST_CAPS.pending) },
    },
  };
}

/** תיאור סטטוס הפריט (הקוביה הימנית בפאנל "פריט"). */
export function itemStatus({ item, rentals }) {
  const open = rentals.filter((r) => r.isTaken && !r.isReturned).sort((a, b) => (ts(b.takenDate) || ts(b.eventDate)) - (ts(a.takenDate) || ts(a.eventDate)));
  if (open.length) {
    const r = open[0];
    return { kind: 'out', name: trim(r.lastName) || personName(r), phone: phoneOf(r), orderId: r.orderId, openCount: open.length };
  }
  const back = rentals.filter((r) => r.isReturned).sort((a, b) => (ts(b.oiReturn) || ts(b.takenDate)) - (ts(a.oiReturn) || ts(a.takenDate)));
  if (back.length) return { kind: 'returned', at: back[0].oiReturn || null };
  if (item && item.inRepair) return { kind: 'repair' };
  if (item && item.notInUse) return { kind: 'notInUse' };
  return { kind: 'free' };
}

/** דגלי הפריט עצמו (שבבים ליד הכותרת). */
export function itemFlags(item) {
  if (!item) return [];
  const f = [];
  if (item.isDeleted) f.push('נמחק');
  if (item.inRepair) f.push('בתיקון');
  if (item.notInUse) f.push('לא בשימוש');
  if (isReserveLocation(item.location)) f.push('רזרבה');
  else if (item.location && !isStockLocation(item.location)) f.push('מחסן');
  return f;
}

/**
 * נתוני פאנל "פריט".
 * @param {object} p
 * @param {{id, name, prefix}} p.model
 * @param {object|null} p.item   שורת DressItem (null = ברקוד שלא קיים כפריט)
 * @param {string} p.barcode
 * @param {string} p.sizeText    מידת הפריט (מהפריט, ואם אין - מהספרות)
 * @param {object[]} p.rentals   שורות OrderItem של הברקוד (מוגבל), ללא מחוקות
 * @param {number} p.rentCount   כמה פעמים נלקח (ספירה מלאה, לא רק המוגבל)
 * @param {object[]} p.items     פריטי הדגם   @param {object[]} p.rows  שורות הזמנה של הדגם (ביקוש)
 */
export function buildItemPanel({ model, item, barcode, sizeText, rentals, rentCount, items, rows, dateKey, todayKey }) {
  const prefix = model.prefix;
  const k = sizeKey(sizeText);
  const keySet = new Set([k]);
  const status = itemStatus({ item, rentals });
  const req = requiredFor({ rows, items, prefix, sizeKey: k, excludeBarcode: barcode, todayKey });
  const all = () => true; // היסטוריית הברקוד עצמו: כל שורותיו, בלי סינון קידומת/מידה
  const out = outRows(rentals, all, todayKey);
  const ret = returnedRows(rentals, all, todayKey);
  const pending = pendingRows(rows, (r) => rowMatches(r, prefix, keySet), todayKey).map((r) => ({ ...r, requires: req.ids.has(r.rowId) }));
  return {
    mode: 'item',
    model: { id: model.id, name: model.name || '', prefix },
    item: item ? { barcode, size: trim(item.sizeText), serial: item.serialNumber == null ? null : item.serialNumber, location: trim(item.location) } : { barcode, size: trim(sizeText), serial: null, location: '' },
    itemMissing: !item,
    flags: itemFlags(item),
    dateKey, todayKey,
    tiles: { status, rentCount, required: req.count },
    requiredSupply: req.n0,
    sections: {
      out: { total: out.length, rows: out.slice(0, LIST_CAPS.out) },
      returned: { total: ret.length, rows: ret.slice(0, LIST_CAPS.returned) },
      pending: { total: pending.length, rows: pending.slice(0, LIST_CAPS.pending) },
    },
  };
}

/** הסרת פרטי לקוחות (שם / טלפון) - למי שאין לה הרשאה לראות אותם; נשארים מספר הזמנה, תאריכים וכמויות. */
export function redactPerson(panel) {
  const strip = (row) => ({ ...row, name: '', lastName: '', phone: '' });
  const out = JSON.parse(JSON.stringify(panel));
  for (const s of Object.values(out.sections || {})) s.rows = s.rows.map(strip);
  if (out.tiles && out.tiles.status && out.tiles.status.kind === 'out') out.tiles.status = { ...out.tiles.status, name: '', phone: '' };
  return out;
}
