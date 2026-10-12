// lib/dressRelocate.js - לוגיקה טהורה של "הקלדה מהירה" להעברת פריטים (ברקודים): שיוך לסניף, העברה למחסן / ממחסן / לרזרבה /
// למחסן לפי מספר קרטון (docs/branches-plan.md, שלב ב). בלי prisma / next - נבדקת ב-scripts/test_dress_relocate.mjs.
//
// מרחיבה את הקיים ולא מכפילה: אותם שדות של DressItem (location = 'חנות' | 'רזרבה' | 'מחסן' | 'מושכר', cartonNumber) ואותן מילים
// שעליהן מסתמכים rentals/scan, lib/inventory.js ו-lib/dressLocationAlerts.js; ובנוסף DressItem.branch (שם הסניף הנוכחי).

export const LOC_STORE = 'חנות';
export const LOC_WAREHOUSE = 'מחסן';
export const LOC_RESERVE = 'רזרבה';
export const LOC_RENTED = 'מושכר';

export const RELOCATE_MODES = Object.freeze(['branch', 'to_warehouse', 'from_warehouse', 'to_reserve', 'to_carton', 'restore']);
export const MODE_LABEL = Object.freeze({
  branch: 'שיוך לסניף',
  to_warehouse: 'העברה למחסן',
  from_warehouse: 'העברה מהמחסן',
  to_reserve: 'העברה לרזרבה',
  to_carton: 'למחסן לפי מספר קרטון',
  restore: 'ביטול',
});

/** ברקוד = ספרות בלבד (מנקה סימוני כיווניות / רווחים שמגיעים מהקלדה בעברית) */
export function normalizeBarcode(raw) {
  return String(raw ?? '').replace(/[^0-9A-Za-z]/g, '');
}

const has = (loc, word) => String(loc || '').includes(word);
export const isWarehouse = (loc) => has(loc, LOC_WAREHOUSE) || has(String(loc || '').toLowerCase(), 'warehouse');
export const isReserve = (loc) => has(loc, LOC_RESERVE) || has(String(loc || '').toLowerCase(), 'reserve');
export const isRented = (loc) => has(loc, LOC_RENTED);

/** מצב הפריט כפי שנשמר: { location, cartonNumber, branch } (ערכים ריקים = null) */
export const snapshotOf = (item) => ({
  location: item && item.location ? String(item.location) : null,
  cartonNumber: item && item.cartonNumber != null && item.cartonNumber !== '' ? String(item.cartonNumber) : null,
  branch: item && item.branch ? String(item.branch) : null,
});

/** הבדל בין שני מצבים: { שדה: {from, to} } רק לשדות ששונו */
export function diffSnapshots(before, after) {
  const out = {};
  for (const k of ['location', 'cartonNumber', 'branch']) {
    if ((before[k] || null) !== (after[k] || null)) out[k] = { from: before[k] || null, to: after[k] || null };
  }
  return out;
}

/**
 * מה לעשות לפריט אחד.
 * @param {string} mode  אחד מ-RELOCATE_MODES
 * @param {{ branch?: string, carton?: string, restore?: {location?: string|null, cartonNumber?: string|null, branch?: string|null} }} params
 * @param {{ location?: string|null, cartonNumber?: any, branch?: string|null, isDeleted?: boolean }} item
 * @returns {{ ok: boolean, error?: string, code?: string, noop?: boolean, patch?: object, warnings?: string[] }}
 */
export function planRelocation(mode, params, item) {
  const p = params || {};
  if (!RELOCATE_MODES.includes(mode)) return { ok: false, code: 'bad_mode', error: 'פעולה לא מוכרת' };
  if (!item) return { ok: false, code: 'not_found', error: 'לא נמצא פריט עם הברקוד הזה' };
  if (item.isDeleted) return { ok: false, code: 'deleted', error: 'הפריט מחוק' };
  const cur = snapshotOf(item);
  const warnings = [];
  let next = { ...cur };

  if (mode === 'restore') {
    const r = p.restore || {};
    next = { location: r.location ?? null, cartonNumber: r.cartonNumber ?? null, branch: r.branch ?? null };
  } else {
    // פריט שמושכר כרגע לא עובר למחסן / רזרבה / קרטון (הוא אצל לקוחה); שיוך סניף מותר
    if (isRented(cur.location) && mode !== 'branch') {
      return { ok: false, code: 'rented', error: 'הפריט מושכר כרגע (עוד לא הוחזר)' };
    }
    if (mode === 'branch') {
      const b = String(p.branch || '').trim();
      if (!b) return { ok: false, code: 'no_branch', error: 'לא נבחר סניף' };
      next.branch = b;
      if (isWarehouse(cur.location)) warnings.push('הפריט נמצא במחסן');
      else if (isReserve(cur.location)) warnings.push('הפריט נמצא ברזרבה');
      else if (isRented(cur.location)) warnings.push('הפריט מושכר כרגע');
    } else if (mode === 'to_warehouse') {
      next.location = LOC_WAREHOUSE;
    } else if (mode === 'to_carton') {
      const c = String(p.carton ?? '').trim();
      if (!c) return { ok: false, code: 'no_carton', error: 'לא הוקלד מספר קרטון' };
      if (c.length > 20) return { ok: false, code: 'bad_carton', error: 'מספר קרטון ארוך מדי' };
      next.location = LOC_WAREHOUSE;
      next.cartonNumber = c;
    } else if (mode === 'to_reserve') {
      next.location = LOC_RESERVE;
    } else if (mode === 'from_warehouse') {
      const b = String(p.branch || '').trim();
      if (!b) return { ok: false, code: 'no_branch', error: 'לא נבחר סניף יעד' };
      if (!isWarehouse(cur.location)) warnings.push(isReserve(cur.location) ? 'הפריט היה ברזרבה ולא במחסן' : 'הפריט לא היה במחסן');
      next.location = LOC_STORE;
      next.cartonNumber = null;
      next.branch = b;
    }
  }

  const patch = diffSnapshots(cur, next);
  return { ok: true, noop: Object.keys(patch).length === 0, patch, before: cur, after: next, warnings };
}

/** נתוני Prisma (data) מתוך patch */
export const patchToData = (patch) => Object.fromEntries(Object.entries(patch || {}).map(([k, v]) => [k, v.to]));

/** שורת תוצאה קצרה לתצוגה: "מחסן · קרטון 14" / "חנות · בית שמש" */
export function describeSnapshot(s) {
  if (!s) return '';
  const parts = [s.location || 'חנות'];
  if (s.cartonNumber) parts.push(`קרטון ${s.cartonNumber}`);
  if (s.branch) parts.push(s.branch);
  return parts.join(' · ');
}
