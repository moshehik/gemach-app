// שורות פאנל התפוסה כשורות תוצאת חיפוש רגילות (13.10.2026): מיפוי אייקונים/תוויות/סטטוסים, מיון ומיזוג בלי כפילויות עם תוצאות החיפוש הרגילות.
// טהור (בלי React, בלי DB) - משותף ל-SearchPanel.js, HomeResults.js ולחיפוש המהיר שבתפריט, ונבדק ב-scripts/test_search_panel_rows.mjs.
//
// עיקרון: שורות הפאנל הן "תוצאות" - אותו אייקון ותווית כמו שורה מאותו סוג ברשימת התוצאות של דף הבית (homeLogic.js unifiedRows):
//   בחוץ / הוחזרו = שורת פריט (אייקון dress, תווית "פריט"), ממתינות = שורת הזמנה (file / "הזמנה"), "איפה אני?" = pin / "מיקום".
// הסטטוס של שורה = אותו זוג [מחלקה, אייקון] כמו RENTAL_STATE_STYLE / ORDER_STATUS_STYLE (נאכף בבדיקה מול homeLogic).

export const GROUP_ROW = Object.freeze({
  out: Object.freeze({ icon: 'dress', kind: 'פריט' }),
  returned: Object.freeze({ icon: 'dress', kind: 'פריט' }),
  pending: Object.freeze({ icon: 'file', kind: 'הזמנה' }),
  where: Object.freeze({ icon: 'pin', kind: 'מיקום' }),
  choose: Object.freeze({ icon: 'dress', kind: 'דגם' }),
});

// כמו RENTAL_STATE_STYLE ב-homeLogic.js: 'מושכר עכשיו' -> bag, 'הוחזר' -> check ok, 'טרם נלקח' -> clock
const GROUP_STATUS = Object.freeze({
  out: Object.freeze({ cls: '', icon: 'bag', label: 'מושכר עכשיו' }),
  returned: Object.freeze({ cls: 'ok', icon: 'check', label: 'הוחזר' }),
  pending: Object.freeze({ cls: '', icon: 'clock', label: 'טרם נלקח' }),
});
const FLAG_STATUS = Object.freeze({
  late: Object.freeze({ cls: 'warn', icon: 'clock', label: 'באיחור' }),
  draft: Object.freeze({ cls: '', icon: 'pencil', label: 'טיוטה' }),
  alter: Object.freeze({ cls: '', icon: 'scissors', label: 'בהתאמה' }),
  requires: Object.freeze({ cls: 'warn', icon: 'flag', label: 'חייבת את הפריט' }),
});

/** סטטוסי שורת פאנל (מקום ראשון = מצב הקבוצה, אחריו דגלים) - אותו מבנה {cls, icon, label} כמו Stx בדף הבית. */
export function rowStatuses(r, group) {
  const out = [];
  if (GROUP_STATUS[group]) out.push(GROUP_STATUS[group]);
  for (const k of ['late', 'draft', 'alter', 'requires']) if (r && r[k]) out.push(FLAG_STATUS[k]);
  return out;
}

/** מיקום הברקוד לתצוגה: מושכר / בתיקון / לא בשימוש / רזרבה / מחסן / טקסט המיקום הרשום (חנות, קרטון N, סניף...) / לא מוגדר. */
export function whereLocation(r) {
  if (!r) return '';
  if (r.state === 'place') return r.placeKnown && r.place ? r.place : 'לא מוגדר';
  return r.stateLabel || 'לא מוגדר';
}

/** הזמנות שונות (לפי סדר ההופעה) של שורות מושכרות - לכפתור "מעבר להזמנות הרלוונטיות". */
export function whereOrders(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows || []) {
    if (r.state !== 'out' || r.orderId == null || seen.has(String(r.orderId))) continue;
    seen.add(String(r.orderId));
    out.push(r.orderId);
  }
  return out;
}

/** מפתחות כיסוי של שורות הפאנל (lead = [{ orderId?, barcode? }]) למניעת כפילות מול תוצאות החיפוש הרגילות. */
export function leadKeys(lead) {
  const orders = new Set();
  const items = new Set();
  for (const l of lead || []) {
    if (l == null || l.orderId == null) continue;
    orders.add(String(l.orderId));
    if (l.barcode) items.add(String(l.orderId) + '|' + String(l.barcode));
  }
  return { orders, items };
}

/** האם תוצאה רגילה כבר מוצגת בפאנל: הזמנה לפי מזהה ההזמנה; פריט לפי הזמנה+ברקוד. kind: 'order' | 'item' (לקוח אף פעם לא מכוסה). */
export function isCovered(keys, { kind, orderId, barcode }) {
  if (!keys || orderId == null) return false;
  if (kind === 'order') return keys.orders.has(String(orderId));
  if (kind === 'item') return !!barcode && keys.items.has(String(orderId) + '|' + String(barcode));
  return false;
}

/** שורות unifiedRows של דף הבית בלי מה שכבר מוצג כשורת פאנל. */
export function dropCovered(rows, keys) {
  if (!keys || (!keys.orders.size && !keys.items.size)) return rows;
  return rows.filter((r) => !isCovered(keys, { kind: r.kind === 'הזמנה' ? 'order' : r.kind === 'פריט' ? 'item' : '', orderId: r.orderId, barcode: r.barcode }));
}

/** מספר השורות שנספרות ב-"תוצאות (N)": כל פריט lead עם count (כותרות קבוצה / "עוד" / מצב ריק = 0). */
export function leadCount(lead) {
  return (lead || []).reduce((n, x) => n + (x && x.count ? x.count : 0), 0);
}
