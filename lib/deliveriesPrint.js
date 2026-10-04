// lib/deliveriesPrint.js - לאיזה דף הדפסה פותחים כפתורי ההדפסה של מסך /deliveries (טהור: בלי imports, בלי DB, בלי DOM).
//
// החלטת הבעלים (דפי הדפסה, scratch/schedule-build/DECISIONS-דפי-הדפסה.md):
//   PQ-06  תעודת משלוח (PP-12) מחליפה את "נתונים לשקית" (/print/delivery-bag).
//   PP-10 / PP-18  "דף משלוח הלוך/חזור (למשלוחן)" = העיצוב החדש של /print/delivery-courier (הלוך / חזור).
// הדפים החדשים הם דפי הלו״ז: /schedule/print/<PP-xx[,PP-yy]>?date=YYYY-MM-DD - תאריך אחד, והוא תמיד יום ההוצאה/האיסוף של
// השליח (byDispatchDate), בלי טווח ובלי "בחירה לפי תאריך אירוע". הדפים הישנים נשארים חיים וממשיכים לטפל במה שהחדשים לא
// מכסים: טווח של יותר מיום, הדפסת משלוחן במצב deliveries_select_by_event_date, ומי שאין לו הרשאת הלו״ז (page:schedule).
// מייל השליח (courier-email) לא נוגע בקובץ הזה - אין החלטה שמחליפה אותו.

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** דפי הלו״ז החדשים לכל כפתור. bag = "נתונים לשקית"; out / return / both = הדפסה למשלוחן לפי כיוון */
export const DELIVERY_NEW_PAGES = Object.freeze({
  bag: Object.freeze(['PP-12']),
  out: Object.freeze(['PP-10']),
  return: Object.freeze(['PP-18']),
  both: Object.freeze(['PP-10', 'PP-18']),
});

/** כתובת הדף הישן (נשמר חי) - אותם פרמטרים בדיוק כמו לפני ההחלפה */
export function legacyDeliveryPrintUrl(kind, { direction = 'both', from = '', to = '', bagDate = '' } = {}) {
  if (kind === 'bag') return `/print/delivery-bag?date=${bagDate || from}`;
  return `/print/delivery-courier?direction=${direction}&from=${from}&to=${to || from}`;
}

/** כתובת הדף החדש: /schedule/print/PP-10,PP-18?date=... */
export function newDeliveryPrintUrl(keys, date) {
  return `/schedule/print/${keys.join(',')}?date=${date}`;
}

/**
 * ימי ההוצאה (הלוך) / האיסוף (חזור) הנפרדים בשורות של GET /api/deliveries במצב deliveries_select_by_event_date
 * (כל שורה נושאת dispatchDates = { out?, return? }). ממוין, בלי כפילויות; שורות בלי הכיוון המבוקש מדולגות.
 */
export function distinctDispatchDates(rows, direction) {
  const set = new Set();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || !Array.isArray(r.directions) || !r.directions.includes(direction)) continue;
    const d = r.dispatchDates && r.dispatchDates[direction];
    if (typeof d === 'string' && ISO_RE.test(d)) set.add(d);
  }
  return [...set].sort();
}

/**
 * האם בכלל כדאי לנסות את הדפים החדשים (בדיקה סינכרונית, לפני כל קריאת רשת):
 *   - טווח של יותר מיום (רק הדפסת משלוחן יודעת טווח) -> הדף הישן
 *   - הדפסת משלוחן כשהתאריך הוא תאריך אירוע (byEventDate) -> הדף הישן (הדף החדש לא מסנן לפי אירוע)
 *   - תאריך לא תקין -> הדף הישן (שמציג "טווח תאריכים לא תקין")
 * @returns {{ wantsNew:boolean, reason:string|null }}
 */
export function deliveryPrintWantsNew({ kind, from = '', to = '', bagDate = '', byEventDate = false } = {}) {
  if (kind === 'bag') {
    if (!ISO_RE.test(bagDate || from)) return { wantsNew: false, reason: 'bad-date' };
    return { wantsNew: true, reason: null };
  }
  if (!ISO_RE.test(from)) return { wantsNew: false, reason: 'bad-date' };
  if (to && to !== from) return { wantsNew: false, reason: 'range' };
  if (byEventDate) return { wantsNew: false, reason: 'event-date-courier' };
  return { wantsNew: true, reason: null };
}

/**
 * ההחלטה הסופית (אחרי שנטענו ההרשאות ובמצב תאריך-אירוע גם שורות המשלוח):
 * @param {object} p
 * @param {'bag'|'courier'} p.kind
 * @param {'out'|'return'|'both'} [p.direction]
 * @param {string} [p.from] @param {string} [p.to] @param {string} [p.bagDate]
 * @param {boolean} [p.byEventDate]
 * @param {string[]|null} [p.allowedKeys]  דפי הלו״ז המותרים למשתמש/ת (GET /api/schedule/print?format=access -> allowed); null = לא ידוע -> הדף הישן
 * @param {string[]|null} [p.eventModeDispatchDates]  רק ל-bag במצב תאריך-אירוע: ימי ההוצאה הנפרדים של אותו תאריך אירוע
 * @returns {{ mode:'new'|'legacy', url:string, keys:string[], reason:string|null }}
 */
export function planDeliveryPrint(p) {
  const { kind, direction = 'both', byEventDate = false, allowedKeys = null, eventModeDispatchDates = null } = p;
  const from = p.from || '';
  const to = p.to || from;
  const bagDate = p.bagDate || from;
  const legacy = (reason) => ({ mode: 'legacy', url: legacyDeliveryPrintUrl(kind, { direction, from, to, bagDate }), keys: [], reason });

  const pre = deliveryPrintWantsNew({ kind, from, to, bagDate, byEventDate });
  if (!pre.wantsNew) return legacy(pre.reason);

  const keys = kind === 'bag' ? DELIVERY_NEW_PAGES.bag : (DELIVERY_NEW_PAGES[direction] || DELIVERY_NEW_PAGES.both);
  if (!Array.isArray(allowedKeys) || !keys.every((k) => allowedKeys.includes(k))) return legacy('no-access');

  let date = bagDate;
  if (kind === 'bag' && byEventDate) {
    // התאריך שנבחר הוא תאריך אירוע; דף הלו״ז מקבל את יום ההוצאה. רק כשיש יום אחד חד-משמעי - אחרת הדף הישן
    const days = Array.isArray(eventModeDispatchDates) ? eventModeDispatchDates : [];
    if (days.length !== 1) return legacy('no-dispatch-date');
    date = days[0];
  } else if (kind !== 'bag') {
    date = from;
  }
  return { mode: 'new', url: newDeliveryPrintUrl(keys, date), keys: [...keys], reason: null };
}

/** הערה קצרה למודל (עברית) כשהכפתור ייפתח בדף הישן / כשיש הבדל שחשוב לדעת; null = אין מה לומר */
export function deliveryPrintHint({ kind, from = '', to = '', bagDate = '', byEventDate = false } = {}) {
  const pre = deliveryPrintWantsNew({ kind, from, to, bagDate, byEventDate });
  if (kind === 'bag') {
    return byEventDate && pre.wantsNew ? 'מודפסות תעודות כל המשלוחים היוצאים ביום ההוצאה של האירועים בתאריך שנבחר.' : null;
  }
  if (pre.reason === 'range') return 'טווח של יותר מיום אחד נפתח בתצוגת המשלוחן הרגילה.';
  if (pre.reason === 'event-date-courier') return 'בבחירה לפי תאריך אירוע נפתחת תצוגת המשלוחן הרגילה.';
  return null;
}
