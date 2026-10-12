// lib/branchNeeds.js - חישוב צרכים לפי סניף (docs/branches-plan.md, שלב ג). לוגיקה טהורה (בלי prisma / next) - נבדקת ב-scripts/test_branch_needs.mjs.
//
// השאלה: לפי ההזמנות העתידיות (סניף איסוף, ואם אין - סניף ביצוע) ולפי הסניף הנוכחי של כל פריט פיזי - אילו פריטים צריך להעביר
// בין סניפים לפני האירוע?
//
// שיטה (חמדנית, לפי תאריך אירוע עולה):
//   1. פריט הזמנה ששויך אליו ברקוד: אם הפריט הפיזי נמצא (בחנות) בסניף אחר מסניף ההזמנה - "להעביר את הברקוד הזה".
//   2. פריט הזמנה בלי ברקוד (לפי דגם + מידה): לוקחים יחידה פנויה בסניף ההזמנה; אם אין - יחידה פנויה מהסניף שיש בו הכי הרבה
//      יחידות פנויות מאותו דגם ומידה ("להעביר יחידה מדגם X מידה Y מ-A ל-B", עם ברקוד מוצע). אם אין יחידה בשום סניף - חוסר (shortages),
//      וזה עניין של מנוע המלאי (lib/inventory.js), לא של ההעברות.
//   3. כל יחידה משמשת הזמנה אחת בטווח (הפשטה מכוונת: חפיפות זמנים והחזרות באמצע הטווח לא מחושבות - זו המלצה, לא חסימה).
// "בחנות" = לא מושכר עכשיו, לא בתיקון, לא "לא בשימוש"; יחידה במחסן / ברזרבה נספרת רק אם ההגדרה inventory_include_warehouse /
// allow_renting_reserve_items מאפשרת השכרה מהן (אותם כללים כמו dressLocationAlerts / rentals/scan).
// יחידה בלי סניף רשום נחשבת לסניף הראשי (effectiveUnitBranch).

import { effectiveUnitBranch } from './branches.js';

const lc = (s) => String(s || '').toLowerCase();
const hasWord = (loc, he, en) => lc(loc).includes(he) || lc(loc).includes(en);

/** האם היחידה נמצאת "בחנות" ופנויה לצורך חישוב העברות */
export function isUnitInStock(unit, { includeWarehouse = false, allowReserve = false } = {}) {
  if (!unit || unit.inRepair || unit.notInUse || unit.isDeleted) return false;
  const loc = unit.location || '';
  if (loc.includes('מושכר')) return false;
  if (hasWord(loc, 'מחסן', 'warehouse') && !includeWarehouse) return false;
  if (hasWord(loc, 'רזרבה', 'reserve') && !allowReserve) return false;
  return true;
}

const keyOf = (prefix, size) => `${prefix}|${size === null || size === undefined ? '' : size}`;

/**
 * @param {object} p
 * @param {Array<{orderId:number, eventKey:string, target:string|null, customerName?:string, items:Array<{id:string, prefix:number|null, size:number|null, barcode?:string|null}>}>} p.orders
 * @param {Array<{barcode:string, prefix:number|null, size:number|null, branch?:string|null, location?:string|null, inRepair?:boolean, notInUse?:boolean, modelName?:string}>} p.units
 * @param {{branches:object[]}} p.cfg  הגדרת הסניפים (lib/branches.js)
 * @param {{includeWarehouse?:boolean, allowReserve?:boolean}} [p.stock]
 * @param {string} [p.preferBarcode]  יחידה שמעדיפים לבחור להעברה (למשל זו שנסרקה עכשיו בהחזרה)
 * @returns {{ transfers: Array<object>, shortages: Array<object> }}
 */
export function computeBranchNeeds({ orders, units, cfg, stock = {}, preferBarcode = null }) {
  const effBranch = (u) => effectiveUnitBranch(u.branch, cfg);
  const byBarcode = new Map();
  const pools = new Map(); // key -> Map(branch -> units[])
  for (const u of units || []) {
    if (!u || !u.barcode) continue;
    byBarcode.set(String(u.barcode), u);
    if (!isUnitInStock(u, stock)) continue;
    const b = effBranch(u);
    if (!b || u.prefix === null || u.prefix === undefined) continue;
    const k = keyOf(u.prefix, u.size);
    if (!pools.has(k)) pools.set(k, new Map());
    const m = pools.get(k);
    if (!m.has(b)) m.set(b, []);
    m.get(b).push(u);
  }
  for (const m of pools.values()) {
    for (const arr of m.values()) {
      arr.sort((a, c) => (a.barcode === preferBarcode ? -1 : c.barcode === preferBarcode ? 1 : String(a.barcode).localeCompare(String(c.barcode), 'en', { numeric: true })));
    }
  }

  const sorted = [...(orders || [])].sort((a, b) => (a.eventKey < b.eventKey ? -1 : a.eventKey > b.eventKey ? 1 : a.orderId - b.orderId));
  const allocated = new Set();
  // שלב מקדים: ברקודים ששויכו להזמנות לא זמינים לפריטים לפי דגם+מידה
  for (const o of sorted) for (const it of o.items || []) if (it.barcode) allocated.add(String(it.barcode));

  const transfers = [];
  const shortages = [];
  const modelNameOf = (k) => { const m = pools.get(k); if (!m) return ''; for (const arr of m.values()) if (arr[0] && arr[0].modelName) return arr[0].modelName; return ''; };

  for (const o of sorted) {
    const target = o.target || null;
    if (!target) continue;
    for (const it of o.items || []) {
      const base = { orderId: o.orderId, eventKey: o.eventKey, itemId: it.id, customerName: o.customerName || '', to: target };
      if (it.barcode) {
        const u = byBarcode.get(String(it.barcode));
        if (!u || !isUnitInStock(u, stock)) continue;
        const from = effBranch(u);
        if (from && from !== target) {
          transfers.push({ ...base, kind: 'unit', barcode: String(u.barcode), from, prefix: u.prefix, size: u.size, modelName: u.modelName || '' });
        }
        continue;
      }
      if (it.prefix === null || it.prefix === undefined) continue;
      const k = keyOf(it.prefix, it.size);
      const m = pools.get(k);
      const free = (b) => (m && m.get(b) ? m.get(b).filter((u) => !allocated.has(String(u.barcode))) : []);
      const here = free(target);
      if (here.length) { allocated.add(String(here[0].barcode)); continue; }
      let bestBranch = null; let best = [];
      if (m) {
        for (const b of m.keys()) {
          if (b === target) continue;
          const f = free(b);
          if (f.length > best.length) { best = f; bestBranch = b; }
        }
      }
      if (bestBranch && best.length) {
        const u = best[0];
        allocated.add(String(u.barcode));
        transfers.push({ ...base, kind: 'model', barcode: String(u.barcode), from: bestBranch, prefix: it.prefix, size: it.size, modelName: u.modelName || modelNameOf(k) });
      } else {
        shortages.push({ ...base, prefix: it.prefix, size: it.size, modelName: modelNameOf(k) });
      }
    }
  }
  return { transfers, shortages };
}

/** קיבוץ ההעברות: "מ-A ל-B" -> רשימה (לפס ההתראה) */
export function groupTransfers(transfers) {
  const groups = new Map();
  for (const t of transfers || []) {
    const k = `${t.from}→${t.to}`;
    if (!groups.has(k)) groups.set(k, { from: t.from, to: t.to, items: [] });
    groups.get(k).items.push(t);
  }
  return [...groups.values()].sort((a, b) => b.items.length - a.items.length);
}

/**
 * התראת החזרה: אחרי שהפריט הוחזר בסניף atBranch - האם צריך להעביר אותו לסניף אחר (לפי הזמנות עתידיות)?
 * @param {object} p  { returnedBarcode, atBranch, orders, units, cfg, stock }  - units כוללות את הפריט שהוחזר עם branch=atBranch ומיקום חנות
 * @returns {{ kind:'branch', to:string, orderId:number, eventKey:string, direct:boolean }|null}
 */
export function computeReturnAdvice({ returnedBarcode, atBranch, orders, units, cfg, stock }) {
  const patched = (units || []).map((u) => (String(u.barcode) === String(returnedBarcode) ? { ...u, branch: atBranch, location: 'חנות', inRepair: false, notInUse: false } : u));
  const { transfers } = computeBranchNeeds({ orders, units: patched, cfg, stock, preferBarcode: String(returnedBarcode) });
  const mine = transfers.filter((t) => String(t.barcode) === String(returnedBarcode) && t.from === atBranch);
  if (!mine.length) return null;
  const t = mine.sort((a, b) => (a.eventKey < b.eventKey ? -1 : 1))[0];
  return { kind: 'branch', to: t.to, orderId: t.orderId, eventKey: t.eventKey, direct: t.kind === 'unit' };
}
