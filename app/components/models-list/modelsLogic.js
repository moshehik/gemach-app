// modelsLogic.js - הלוגיקה הטהורה של רשימת הדגמים החדשה (נבדקת ב-scripts/test_a5_models_list.mjs): המרת שורת /api/dresses?fields=summary&counts=1
// לשורת הרשימה, סטטוס (פעיל / לא פעיל / מחוק - אותם כללים כמו סינון ה-filterStatus של השרת), אפשרויות הסינון והמיון, וניסוח המידות.
// בלי React ובלי imports עם alias (נקרא גם מ-node רגיל).

export const CATALOG_PAGE = 500; // תקרת limit של fields=summary בשרת

/** השורה של רשימה. d = דגם מ-/api/dresses?fields=summary&counts=1 (ר' app/api/dresses/route.js, wantCounts). */
export function modelRow(d) {
  const items = Number(d.itemsCount) || 0;
  const inactive = Number(d.notInUseCount) || 0;
  const code = d.barcodePrefix == null || d.barcodePrefix === '' ? null : Number(d.barcodePrefix);
  const sizes = Array.isArray(d.sizeCounts) ? d.sizeCounts.slice() : [];
  // מידות לפי ערך מספרי כשאפשר ("02" לפני "10"), ואחר כך אלפביתי
  sizes.sort((a, b) => {
    const x = parseFloat(a[0]); const y = parseFloat(b[0]);
    if (Number.isFinite(x) && Number.isFinite(y) && x !== y) return x - y;
    return String(a[0]).localeCompare(String(b[0]), 'he', { numeric: true });
  });
  return {
    id: d.id,
    code,
    name: d.name || (code != null ? `דגם ${code}` : 'ללא שם'),
    cat: d.priceCategory || '',
    entry: d.entryDateToRepo || null,
    exit: d.exitDateFromRepo || null,
    deleted: !!d.isDeleted,
    items,
    inactive,
    // פריטים שאפשר להשכיר: לא מחוקים ולא "לא בשימוש" (activeItemsCount בשרת); בלי הנתון - items - inactive
    usable: d.activeItemsCount != null ? Number(d.activeItemsCount) || 0 : Math.max(0, items - inactive),
    reserve: Number(d.reserveCount) || 0,
    repair: Number(d.repairCount) || 0,
    delItems: Number(d.deletedItemsCount) || 0,
    rentals: Number(d.rentalsCount) || 0,
    sizes,
    upd: d.updatedAt || null,
  };
}

/** לא פעיל = לא מחוק, ויש תאריך יציאה מהמאגר או שאין אף פריט שאפשר להשכיר (בדיוק כמו filterStatus=inactive בשרת). */
export const isInactive = (m) => !m.deleted && (!!m.exit || m.usable <= 0);
export const isActive = (m) => !m.deleted && !isInactive(m);
export const statusKey = (m) => (m.deleted ? 'deleted' : isInactive(m) ? 'inactive' : 'active');
export const statusText = (m) => (m.deleted ? 'מחוק' : isInactive(m) ? 'לא פעיל' : 'פעיל');
export const rowIcon = (m) => (m.deleted ? 'trash' : isInactive(m) ? 'ban' : 'dress');
export const rowClass = (m) => (m.deleted ? 'off gone' : isInactive(m) ? 'off' : '');

/** הסיבה לסטטוס (שורת "סטטוס" בפירוט). */
export function statusReason(m) {
  if (m.deleted) return 'מחוק';
  if (isInactive(m)) return m.exit ? 'לא פעיל - יצא מהמאגר' : 'לא פעיל - אין פריטים בשימוש';
  return 'פעיל';
}

export const sizesPlain = (m) => m.sizes.map((s) => `${s[0]}×${s[1]}`).join(' ');

export const STATUS_OPTIONS = [
  { k: 'active', l: 'פעילים', i: 'dress', test: isActive },
  { k: 'inactive', l: 'לא פעילים', i: 'ban', test: isInactive },
  { k: 'deleted', l: 'מחוקים', i: 'trash', test: (m) => m.deleted },
];
export const INV_OPTIONS = [
  { k: 'repair', l: 'יש פריטים בתיקון', i: 'scissors', test: (m) => m.repair > 0 },
  { k: 'notuse', l: 'יש פריטים לא בשימוש', i: 'ban', test: (m) => m.inactive > 0 },
  { k: 'reserve', l: 'יש רזרבה', i: 'flag', test: (m) => m.reserve > 0 },
  { k: 'delitem', l: 'יש פריט מחוק', i: 'trash', test: (m) => m.delItems > 0 },
];
export const RENT_OPTIONS = [
  { k: 'r0', l: 'לא הושכר מעולם', i: 'refresh', test: (m) => m.rentals === 0 },
  { k: 'r10', l: 'לפחות 10 השכרות', i: 'refresh', test: (m) => m.rentals >= 10 },
  { k: 'r30', l: 'לפחות 30 השכרות', i: 'refresh', test: (m) => m.rentals >= 30 },
  { k: 'r60', l: 'לפחות 60 השכרות', i: 'refresh', test: (m) => m.rentals >= 60 },
];

/** אפשרויות "קטגוריה": קטגוריית המחיר שמופיעה בנתונים (טקסט חופשי בשרת), לפי שם; בלי קטגוריה = "ללא קטגוריה". */
export function catOptions(rows) {
  const names = [...new Set(rows.map((r) => r.cat))].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'he')));
  return names.map((name) => ({ k: `c:${name}`, l: name || 'ללא קטגוריה', i: 'tag', test: (m) => m.cat === name }));
}

export function buildFilters(rows) {
  return [
    { key: 'status', label: 'סטטוס', icon: 'check', def: ['active'], options: STATUS_OPTIONS },
    { key: 'inv', label: 'מלאי', icon: 'box', def: [], options: INV_OPTIONS },
    { key: 'cat', label: 'קטגוריה', icon: 'tag', def: [], options: catOptions(rows) },
    { key: 'rent', label: 'השכרות', icon: 'refresh', def: [], options: RENT_OPTIONS },
  ];
}

export const SORTS = [
  { k: 'name', l: 'שם דגם', i: 'dress', get: (m) => m.name },
  { k: 'code', l: 'קוד', i: 'hash', get: (m) => (m.code == null ? -1 : m.code) },
  { k: 'entry', l: 'תאריך כניסה', i: 'cal', get: (m) => m.entry || '' },
  { k: 'items', l: 'כמות פריטים', i: 'box', get: (m) => m.items },
  { k: 'rentals', l: 'כמות השכרות', i: 'refresh', get: (m) => m.rentals },
  { k: 'inactive', l: 'לא בשימוש', i: 'ban', get: (m) => m.inactive },
  { k: 'reserve', l: 'רזרבה', i: 'flag', get: (m) => m.reserve },
  { k: 'repair', l: 'בתיקון', i: 'scissors', get: (m) => m.repair },
  { k: 'status', l: 'סטטוס', i: 'userck', get: (m) => statusText(m) },
];

/** חיבור עמודי התשובה (limit=500) לרשימה אחת, בלי כפילויות. */
export function mergePages(pages) {
  const seen = new Set();
  const out = [];
  pages.forEach((p) => (p && Array.isArray(p.data) ? p.data : []).forEach((d) => { if (!seen.has(d.id)) { seen.add(d.id); out.push(d); } }));
  return out;
}
