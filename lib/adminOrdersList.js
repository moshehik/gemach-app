// lib/adminOrdersList.js - הלוגיקה הטהורה של רשימת ההזמנות לניהול (/admin/orders-list, API: /api/admin/orders-list).
// בלי prisma ובלי imports עם alias: נקרא גם מ-node רגיל (scripts/test_a5_orders_customers_lists.mjs) ומהלקוח (מפתחות הסטטוס).
//
// מה כאן:
//  * parseOrdersListParams  - קלט (query או JSON) -> פרמטרים מנורמלים ובטוחים (עימוד עד 100, מיון מותר, מפתחות סינון מוכרים בלבד).
//  * ORDER_SNAPSHOT_SQL + buildFact / filterFacts / sortFacts / countFacts - מנוע התמונה: שאילתת צבירה אחת לכל ההזמנות, ומהתמונה בזיכרון נגזרים
//    סינון, ספירות, מיון, חוב / זיכוי ועימוד (זה מה שרץ בשרת). deriveStateKey = הסטטוס הנגזר, זהה ל-calculateOrderStatus (lib/orderStatus.js).
//  * stateWhere / statesWhere - אותם כללי סטטוס כתנאי Prisma: המפרט ההצהרתי שנבדק מול deriveStateKey (בלי DB ומול ה-DB, scripts/verify_orders_list_states_db.mjs);
//    לא בשימוש בנתיב הריצה (שם הסינון בזיכרון).
//  * resolvePeriod          - תקופת תאריך האירוע (מפתחות קבועים -> טווח ימים בשעון ישראל).
//
// למה נתיב נפרד (ולא /api/orders): הרשימה הזו מראה חוב / זיכוי / סטטוס נגזר ומיון לפיהם, וסופרת אפשרויות סינון. כל זה דורש צבירה
// (שולם = סכום תשלומים) שאין ב-/api/orders, והנתיב הזה שמור להנהלה ראשית / מתכנת - כך שהוא לא חושף שום נתון חדש לתפקידים נמוכים.

import { DEFAULT_LIMIT, EXPORT_PAGE_LIMIT, MAX_LIST_LIMIT } from './adminListGuards.js';
import { isPlaceholderModelName } from './modelDisplay.js';

export const ORDERS_PAGE_SIZE = DEFAULT_LIMIT;
export const DRAFT_STATUS = 'טיוטה'; // = DRAFT_ORDER_STATUS ב-lib/orderReservation.js (נבדק בבדיקה)

// הסטטוסים הנגזרים (calculateOrderStatus) - המפתח באנגלית, המילה בעברית היא מה ש-calculateOrderStatus מחזיר.
export const ORDER_STATE_KEYS = Object.freeze(['upcoming', 'past', 'partRented', 'rented', 'partReturned', 'returned', 'deleted', 'draft']);
export const STATE_WORD = Object.freeze({
  upcoming: 'בקרוב', past: 'עבר', partRented: 'הושכר חלקי', rented: 'הושכר', partReturned: 'הוחזר חלקי', returned: 'הוחזר', deleted: 'מחוק', draft: 'טיוטה',
});
export const stateKeyOfWord = (word) => Object.keys(STATE_WORD).find((k) => STATE_WORD[k] === word) || null;

export const PAY_KEYS = Object.freeze(['debt', 'credit', 'settled']);
export const DELIVERY_KEYS = Object.freeze(['yes', 'no']);
export const PERIOD_KEYS = Object.freeze(['today', 'next7', 'past30', 'pastYear', 'custom']);

// מיונים: native = ORDER BY ישיר ב-Prisma; computed = חישוב ב-SQL (סכום / שולם / יתרה / פריטים / סטטוס) לפי רשימת מזהים.
export const NATIVE_SORTS = Object.freeze(['eventDate', 'orderId', 'customerName', 'orderDate']);
export const COMPUTED_SORTS = Object.freeze(['total', 'paid', 'balance', 'itemsCount', 'status']);
export const ORDER_SORT_KEYS = Object.freeze([...NATIVE_SORTS, ...COMPUTED_SORTS]);

const clampInt = (v, def, min, max) => {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
};
const csv = (v) => (Array.isArray(v) ? v : String(v == null ? '' : v).split(',')).map((x) => String(x).trim()).filter(Boolean);
const pickKnown = (v, known) => [...new Set(csv(v).filter((x) => known.includes(x)))];
const dateKey = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : '');

const isExport = (v) => v === true || v === '1' || v === 1 || v === 'true';

/** קלט גולמי (אובייקט פשוט) -> פרמטרים מנורמלים. מפתחות לא מוכרים נזרקים; ערכים מחוץ לתחום נחתכים. */
export function parseOrdersListParams(input) {
  const p = input && typeof input === 'object' ? input : {};
  const sort = ORDER_SORT_KEYS.includes(p.sort) ? p.sort : 'eventDate';
  const idsRaw = csv(p.ids).map((x) => parseInt(x, 10)).filter((n) => Number.isSafeInteger(n) && n > 0 && n <= 2147483647);
  return {
    page: clampInt(p.page, 1, 1, 100000),
    // גודל עמוד: עד 100; בקשת ייצוא (export:true) - עד 500 (וללא פירוט הפריטים). לעולם לא "הכול"
    export: isExport(p.export),
    limit: clampInt(p.limit, ORDERS_PAGE_SIZE, 1, isExport(p.export) ? EXPORT_PAGE_LIMIT : MAX_LIST_LIMIT),
    search: typeof p.search === 'string' ? p.search.slice(0, 200) : '',
    sort,
    dir: p.dir === 'asc' ? 'asc' : 'desc',
    states: pickKnown(p.states, ORDER_STATE_KEYS),
    pays: pickKnown(p.pays, PAY_KEYS),
    delivery: pickKnown(p.delivery, DELIVERY_KEYS),
    period: pickKnown(p.period, PERIOD_KEYS),
    from: dateKey(p.from),
    to: dateKey(p.to),
    branches: csv(p.branches).slice(0, 20).map((b) => b.slice(0, 60)),
    ids: idsRaw.slice(0, 500),
    variant: clampInt(p.variant, 0, 0, 10), // מספר נסיון החיפוש החוזר שהרשימה השתמשה בו (לספירות)
    counts: p.counts === true || p.counts === '1' || p.counts === 1 || p.counts === 'true',
  };
}

/* ------------------------------ תקופת תאריך האירוע ------------------------------ */

const addDays = (key, n) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/**
 * מפתח תקופה -> טווח ימים { from, to } (YYYY-MM-DD, כולל); null = אין תקופה / טווח מותאם חסר.
 * todayKey = היום בישראל. 'custom' משתמש ב-from / to שנשלחו (לפחות אחד מהם).
 */
export function resolvePeriod(key, todayKey, from = '', to = '') {
  switch (key) {
    case 'today': return { from: todayKey, to: todayKey };
    case 'next7': return { from: todayKey, to: addDays(todayKey, 7) };
    case 'past30': return { from: addDays(todayKey, -30), to: todayKey };
    case 'pastYear': return { from: addDays(todayKey, -365), to: todayKey };
    case 'custom': return from || to ? { from: from || '', to: to || '' } : null;
    default: return null;
  }
}

/** כמה תקופות נבחרו -> OR ביניהן (טווחים). מחזיר מערך טווחים (ריק = בלי סינון תקופה). */
export function periodRanges(periodKeys, todayKey, from, to) {
  return (periodKeys || []).map((k) => resolvePeriod(k, todayKey, from, to)).filter(Boolean);
}

/* --------------------------------- סטטוס נגזר ---------------------------------- */

// פריט "תקף" = לא מחוק. כל תנאי על items חל על פריטים תקפים בלבד, כמו validItems ב-calculateOrderStatus.
const VALID = { isDeleted: false };
const hasItems = { items: { some: {} } };
const noValidItems = { items: { none: VALID } };
const someValid = { items: { some: VALID } };
const noValidReturned = { items: { none: { ...VALID, isReturned: true } } };
const someValidReturned = { items: { some: { ...VALID, isReturned: true } } };
const noValidNotReturned = { items: { none: { ...VALID, isReturned: false } } };
const someValidNotReturned = { items: { some: { ...VALID, isReturned: false } } };
const noValidTaken = { items: { none: { ...VALID, isTaken: true } } };
const someValidTaken = { items: { some: { ...VALID, isTaken: true } } };
const noValidNotTaken = { items: { none: { ...VALID, isTaken: false } } };
const someValidNotTaken = { items: { some: { ...VALID, isTaken: false } } };
const isDraft = { status: DRAFT_STATUS };
const notDraft = { OR: [{ status: null }, { status: { not: DRAFT_STATUS } }] };

/**
 * תנאי Prisma לסטטוס נגזר אחד. ctx = { today: Date (תחילת היום בישראל), draftsAsDeleted: boolean }.
 * הכללים (calculateOrderStatus): מחוק = ההזמנה מחוקה או שיש לה פריטים וכולם מחוקים; אחרת לפי הפריטים התקפים -
 * הוחזר / הוחזר חלקי / הושכר / הושכר חלקי; אם אף פריט לא נלקח ולא הוחזר - טיוטה (או מחוק כשההגדרה draft_orders_show_as_deleted),
 * ואחרת עבר (תאריך אירוע לפני היום) / בקרוב. הקבוצות זרות זו לזו (נבדק מול calculateOrderStatus בבדיקה).
 */
export function stateWhere(key, ctx) {
  const today = ctx.today;
  const draftsAsDeleted = !!ctx.draftsAsDeleted;
  const live = { isDeleted: false };
  const itemsOk = { OR: [{ items: { none: {} } }, someValid] }; // אין פריטים בכלל, או יש לפחות פריט תקף
  const fallthrough = { AND: [live, itemsOk, noValidReturned, noValidTaken] }; // אף פריט תקף לא הוחזר ולא נלקח
  switch (key) {
    case 'deleted':
      return {
        OR: [
          { isDeleted: true },
          { AND: [hasItems, noValidItems] },
          ...(draftsAsDeleted ? [{ AND: [fallthrough, isDraft] }] : []),
        ],
      };
    case 'draft':
      return draftsAsDeleted ? { orderId: -1 } : { AND: [fallthrough, isDraft] };
    case 'upcoming':
      return { AND: [fallthrough, notDraft, { OR: [{ eventDate: null }, { eventDate: { gte: today } }] }] };
    case 'past':
      return { AND: [fallthrough, notDraft, { eventDate: { lt: today } }] };
    case 'returned':
      return { AND: [live, someValid, noValidNotReturned] };
    case 'partReturned':
      return { AND: [live, someValidReturned, someValidNotReturned] };
    case 'rented':
      return { AND: [live, someValid, noValidReturned, noValidNotTaken] };
    case 'partRented':
      return { AND: [live, noValidReturned, someValidTaken, someValidNotTaken] };
    default:
      return { orderId: -1 };
  }
}

/**
 * ברירת המחדל (בלי בחירת סטטוס) = כל ההזמנות שאינן מחוקות, כתנאי אחד קצר (לא OR של שבעה סטטוסים - עלות פי כמה ב-count על כל הטבלה):
 * לא מחוקה, יש פריט תקף (או אין פריטים כלל), ולא טיוטה-בלי-פריט-שנלקח כשההגדרה draft_orders_show_as_deleted דלוקה. שקול ל-OR של כל הסטטוסים חוץ מ"מחוק" (נבדק).
 */
export function defaultStatesWhere(ctx) {
  const conds = [{ isDeleted: false }, { OR: [{ items: { none: {} } }, someValid] }];
  if (ctx.draftsAsDeleted) conds.push({ OR: [notDraft, { items: { some: { ...VALID, OR: [{ isTaken: true }, { isReturned: true }] } } }] });
  return { AND: conds };
}

/** בחירה של כמה סטטוסים = OR ביניהם. בלי בחירה = defaultStatesWhere (כל ההזמנות שאינן מחוקות). */
export function statesWhere(keys, ctx) {
  if (!keys || !keys.length) return defaultStatesWhere(ctx);
  return { OR: keys.map((k) => stateWhere(k, ctx)) };
}

/** הסטטוס הנגזר (מפתח) של שורה שכבר נשלפה: מקביל ל-calculateOrderStatus אבל על ספירות. */
export function deriveStateKey({ isDeleted, status, eventDate, nAll, nValid, nReturned, nTaken }, { todayKey, eventDateKey, draftsAsDeleted }) {
  if (isDeleted || (nAll > 0 && nValid === 0)) return 'deleted';
  if (nValid > 0) {
    if (nReturned === nValid) return 'returned';
    if (nReturned > 0) return 'partReturned';
    if (nTaken === nValid) return 'rented';
    if (nTaken > 0) return 'partRented';
  }
  if (status === DRAFT_STATUS) return draftsAsDeleted ? 'deleted' : 'draft';
  if (eventDate && eventDateKey && todayKey && eventDateKey < todayKey) return 'past';
  return 'upcoming';
}

/* ----------------------------------- תשלום ------------------------------------ */

/** מצב התשלום של הזמנה לפי סכום ושולם - אותם כללים כמו calculatePaymentStatus ב-lib/orderStatus.js, מקוצרים ל-3 מצבים. */
export function payClass(total, paid) {
  const t = Number(total) || 0;
  const p = Number(paid) || 0;
  if ((p > t && t > 0) || (p > 0 && t === 0)) return 'credit';
  if (t > 0 && p < t) return 'debt';
  if (t > 0 && p >= t) return 'settled';
  return 'none'; // סכום 0 ושולם 0 - אין מה לשלם (לא חוב ולא "שולם")
}

/** ערכי החוב / הזיכוי של שורה: מספרים חיוביים בלבד (0 = "אין" - לא מוצג ברשימה). */
export function debtAndCredit(total, paid) {
  const t = Number(total) || 0;
  const p = Number(paid) || 0;
  const cls = payClass(t, p);
  return { debt: cls === 'debt' ? round2(t - p) : 0, credit: cls === 'credit' ? round2(p - t) : 0 };
}
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/* ===================================================================================================================================
 * מנוע התמונה (snapshot): במקום עשרות שאילתות count / findMany כבדות על כל טבלת ההזמנות בכל בקשה, נטענת שאילתת צבירה אחת לכל ההזמנות
 * (ORDER_SNAPSHOT_SQL; מטמון 30 שנ' + איחוד בקשות, lib/adminOrdersListServer.js) ומהתמונה בזיכרון נגזרים: סינון, ספירות, מיון, חוב / זיכוי ועימוד.
 * מ-DB נשלפים רק שורות העמוד (לפי מזהה). הפונקציות כאן טהורות (נבדקות בלי DB); הסטטוס הנגזר זהה ל-calculateOrderStatus (deriveStateKey, הוכח מול ה-DB).
 * =================================================================================================================================== */

/** כל ההזמנות, שאילתה אחת: סכום אפקטיבי (כמו /api/orders), שולם, ספירות פריטים, יום האירוע בשעון ישראל, שם הלקוח (למיון). בלי פרמטרים. */
export const ORDER_SNAPSHOT_SQL = `
WITH pay AS (
  SELECT p."orderId", SUM(p.amount) AS paid FROM "Payment" p WHERE NOT p."isDeleted" AND p."orderId" IS NOT NULL GROUP BY p."orderId"
),
obl AS (
  SELECT b."orderId", SUM(b.amount) AS obl FROM "PaymentObligation" b WHERE NOT b."isDeleted" GROUP BY b."orderId"
),
itm AS (
  SELECT i."orderId",
    COUNT(*)::int AS nall,
    COUNT(*) FILTER (WHERE NOT i."isDeleted")::int AS nv,
    COUNT(*) FILTER (WHERE NOT i."isDeleted" AND i."isReturned")::int AS nr,
    COUNT(*) FILTER (WHERE NOT i."isDeleted" AND i."isTaken")::int AS nt
  FROM "OrderItem" i WHERE i."orderId" IS NOT NULL GROUP BY i."orderId"
)
SELECT o."orderId" AS id, o."isDeleted" AS del, o."status" AS st,
  to_char((o."eventDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jerusalem', 'YYYY-MM-DD') AS ek,
  EXTRACT(EPOCH FROM o."orderDate")::float8 AS od,
  o."isDelivery" AS dlv, o."branch" AS br,
  lower(btrim(COALESCE(c."firstName", '') || ' ' || COALESCE(c."lastName", ''))) AS cn,
  CASE WHEN COALESCE(o."totalAmount", 0) > 0 THEN o."totalAmount"
       WHEN COALESCE(obl.obl, 0) > 0 THEN obl.obl
       ELSE COALESCE(pay.paid, 0) END AS total,
  COALESCE(pay.paid, 0) AS paid,
  COALESCE(itm.nall, 0) AS nall, COALESCE(itm.nv, 0) AS nv, COALESCE(itm.nr, 0) AS nr, COALESCE(itm.nt, 0) AS nt
FROM "Order" o
LEFT JOIN pay ON pay."orderId" = o."orderId"
LEFT JOIN obl ON obl."orderId" = o."orderId"
LEFT JOIN itm ON itm."orderId" = o."orderId"
LEFT JOIN "Customer" c ON c."id" = o."customerId"`;

const num = (v) => Number(v) || 0;

/** שורת התמונה -> "עובדה" קלה לסינון / מיון: מצב נגזר, מצב תשלום, ערכי המיון. ctx = { todayKey, draftsAsDeleted }. */
export function buildFact(r, ctx) {
  const total = num(r.total);
  const paid = num(r.paid);
  const ek = r.ek || '';
  return {
    id: r.id,
    state: deriveStateKey({ isDeleted: !!r.del, status: r.st, eventDate: ek || null, nAll: num(r.nall), nValid: num(r.nv), nReturned: num(r.nr), nTaken: num(r.nt) },
      { todayKey: ctx.todayKey, eventDateKey: ek, draftsAsDeleted: !!ctx.draftsAsDeleted }),
    pc: payClass(total, paid),
    dlv: !!r.dlv,
    br: r.br || '',
    ek, // יום האירוע בישראל YYYY-MM-DD, או ''
    od: r.od === null || r.od === undefined ? null : Number(r.od),
    cn: r.cn || '',
    total, paid, nv: num(r.nv),
  };
}

const inRange = (ek, r) => !!ek && (!r.from || ek >= r.from) && (!r.to || ek <= r.to);

/**
 * סינון העובדות לפי הפרמטרים (OR בתוך קבוצה, AND בין קבוצות). omit = קבוצה שלא מסננים לפיה (לספירת אפשרויותיה).
 * searchIds = Set מזהים מהחיפוש (או null). בלי בחירת סטטוס = כל ההזמנות שאינן מחוקות.
 */
export function filterFacts(facts, params, todayKey, { omit = '', searchIds = null } = {}) {
  const states = omit === 'states' ? [] : params.states;
  const pays = omit === 'pays' ? [] : params.pays;
  const delivery = omit === 'delivery' ? [] : params.delivery;
  const ranges = omit === 'period' ? [] : periodRanges(params.period, todayKey, params.from, params.to);
  const periodOn = omit !== 'period' && params.period.length > 0;
  const branches = omit === 'branches' ? [] : params.branches;
  const ids = params.ids.length ? new Set(params.ids) : null;
  const deliveryFlag = delivery.length === 1 ? delivery[0] === 'yes' : null;
  return facts.filter((f) => {
    if (omit !== 'states' && (states.length ? !states.includes(f.state) : f.state === 'deleted')) return false;
    if (pays.length && !pays.includes(f.pc)) return false;
    if (deliveryFlag !== null && f.dlv !== deliveryFlag) return false;
    if (periodOn && !ranges.some((r) => inRange(f.ek, r))) return false;
    if (branches.length && !branches.includes(f.br)) return false;
    if (ids && !ids.has(f.id)) return false;
    if (searchIds && !searchIds.has(f.id)) return false;
    return true;
  });
}

const STATE_RANK = { upcoming: 0, past: 1, partRented: 2, rented: 3, partReturned: 4, returned: 5, deleted: 6, draft: 7 };

/** מיון העובדות (עותק): ערכים חסרים תמיד בסוף, שוויון = מספר הזמנה יורד. sort ממפתחות ORDER_SORT_KEYS. */
export function sortFacts(list, sort, dir) {
  const d = dir === 'asc' ? 1 : -1;
  const key = {
    eventDate: (f) => (f.ek ? f.ek : null),
    orderId: (f) => f.id,
    customerName: (f) => f.cn,
    orderDate: (f) => f.od,
    total: (f) => f.total,
    paid: (f) => f.paid,
    balance: (f) => f.total - f.paid,
    itemsCount: (f) => f.nv,
    status: (f) => STATE_RANK[f.state],
  }[sort] || ((f) => (f.ek ? f.ek : null));
  return list.slice().sort((a, b) => {
    const x = key(a);
    const y = key(b);
    const xn = x === null || x === undefined;
    const yn = y === null || y === undefined;
    if (xn || yn) { if (xn && yn) return b.id - a.id; return xn ? 1 : -1; }
    const c = typeof x === 'string' ? (x < y ? -1 : x > y ? 1 : 0) : x - y;
    return c ? c * d : b.id - a.id;
  });
}

/**
 * ספירות האפשרויות לכל הקבוצות (סמנטיקת ערכת הרשימות: כל שאר הקבוצות והחיפוש מוחלים, הקבוצה עצמה לא). branchNames = שמות הסניפים.
 * מחזיר { total, states, pays, delivery, period, branches } - זהה בצורתו לתשובת /counts.
 */
export function countFacts(facts, params, todayKey, { searchIds = null, branchNames = [], draftsAsDeleted = true } = {}) {
  const opt = { searchIds };
  const out = { total: filterFacts(facts, params, todayKey, opt).length, states: {}, pays: {}, delivery: {}, period: {}, branches: {} };
  const baseStates = filterFacts(facts, params, todayKey, { ...opt, omit: 'states' });
  for (const k of ORDER_STATE_KEYS) out.states[k] = k === 'draft' && draftsAsDeleted ? 0 : baseStates.filter((f) => f.state === k).length;
  const basePays = filterFacts(facts, params, todayKey, { ...opt, omit: 'pays' });
  for (const k of PAY_KEYS) out.pays[k] = basePays.filter((f) => f.pc === k).length;
  const baseDel = filterFacts(facts, params, todayKey, { ...opt, omit: 'delivery' });
  out.delivery.yes = baseDel.filter((f) => f.dlv).length;
  out.delivery.no = baseDel.length - out.delivery.yes;
  const basePer = filterFacts(facts, params, todayKey, { ...opt, omit: 'period' });
  for (const k of ['today', 'next7', 'past30', 'pastYear']) {
    const r = resolvePeriod(k, todayKey);
    out.period[k] = basePer.filter((f) => inRange(f.ek, r)).length;
  }
  if (params.from || params.to) out.period.custom = basePer.filter((f) => inRange(f.ek, { from: params.from, to: params.to })).length;
  const baseBr = filterFacts(facts, params, todayKey, { ...opt, omit: 'branches' });
  for (const b of branchNames) out.branches[b] = baseBr.filter((f) => f.br === b).length;
  return out;
}

/* --------------------------- שורות העמוד: שאילתה אחת ---------------------------- */

const ITEMS_JSON_FULL = `json_build_object('d', i."isDeleted", 't', i."isTaken", 'r', i."isReturned", 'sz', i."sizeText", 'dsz', di."sizeText", 'desc', i."description",
        'ip', i."barcodePrefix", 'dip', di."barcodePrefix", 'dpp', dm."barcodePrefix", 'dn', dm."name")`;
const ITEMS_JSON_LEAN = `json_build_object('d', i."isDeleted", 't', i."isTaken", 'r', i."isReturned")`;

/**
 * שורות העמוד בשאילתה אחת (במקום findMany עם 5 טבלאות מקושרות = ~7 שאילתות): פרטי ההזמנה, שם / טלפון הלקוח, סכום התשלומים וההתחייבויות (לא מחוקים)
 * ופריטים כ-JSON. $1 = מערך מזהי הזמנה (int[]). lean (ייצוא) = דגלי הפריטים בלבד, בלי דגם / מידה.
 */
export const orderRowsSql = (lean) => `
SELECT o."orderId", o."customerId", o."totalAmount", o."status", o."isDeleted", o."eventDate", o."eventDateHebrew", o."orderDate", o."isDelivery", o."branch",
  to_char((o."eventDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jerusalem', 'YYYY-MM-DD') AS ek,
  c."firstName", c."lastName", c."phone1", c."phone2",
  COALESCE((SELECT SUM(p.amount) FROM "Payment" p WHERE p."orderId" = o."orderId" AND NOT p."isDeleted"), 0) AS paid,
  COALESCE((SELECT SUM(b.amount) FROM "PaymentObligation" b WHERE b."orderId" = o."orderId" AND NOT b."isDeleted"), 0) AS obl,
  COALESCE((
    SELECT json_agg(${lean ? ITEMS_JSON_LEAN : ITEMS_JSON_FULL} ORDER BY i."id")
    FROM "OrderItem" i${lean ? '' : '\n    LEFT JOIN "DressItem" di ON di."id" = i."dressItemId"\n    LEFT JOIN "DressModel" dm ON dm."id" = di."dressModelId"'}
    WHERE i."orderId" = o."orderId"
  ), '[]'::json) AS items
FROM "Order" o
LEFT JOIN "Customer" c ON c."id" = o."customerId"
WHERE o."orderId" = ANY($1::int[])`;

const isPlaceholderName = (n) => isPlaceholderModelName(n);

/** פריט מה-JSON של השורה -> { name, size, taken, returned } (אותה לוגיקת שם דגם כמו /api/orders: שם placeholder = "דגם <קידומת>"). */
export function itemFromJson(i) {
  const prefix = i.dpp || i.dip || i.ip;
  const name = !isPlaceholderName(i.dn) ? i.dn : (prefix !== null && prefix !== undefined ? `דגם ${prefix}` : (i.desc && i.desc !== 'פריט כללי' ? i.desc : 'פריט כללי'));
  return { name, size: i.sz || i.dsz || '', taken: !!i.t, returned: !!i.r };
}

/** שורה גולמית משאילתת העמוד -> שורת הרשימה (סטטוס נגזר, חוב / זיכוי, פריטים). ctx = { todayKey, draftsAsDeleted }. */
export function shapeOrderRow(o, ctx, lean) {
  const items = Array.isArray(o.items) ? o.items : [];
  const valid = items.filter((i) => !i.d);
  const paid = num(o.paid);
  const obl = num(o.obl);
  const total = o.totalAmount && o.totalAmount > 0 ? o.totalAmount : (obl > 0 ? obl : paid);
  const state = deriveStateKey({ isDeleted: !!o.isDeleted, status: o.status, eventDate: o.ek || null, nAll: items.length, nValid: valid.length, nReturned: valid.filter((i) => i.r).length, nTaken: valid.filter((i) => i.t).length },
    { todayKey: ctx.todayKey, eventDateKey: o.ek || '', draftsAsDeleted: !!ctx.draftsAsDeleted });
  const { debt, credit } = debtAndCredit(total, paid);
  return {
    orderId: o.orderId,
    customerId: o.customerId || null,
    customerName: `${o.firstName || ''} ${o.lastName || ''}`.trim(),
    customerPhone: o.phone1 || o.phone2 || '',
    eventDate: o.eventDate ? new Date(o.eventDate).toISOString() : null,
    eventDateHebrew: o.eventDateHebrew || '',
    orderDate: o.orderDate ? new Date(o.orderDate).toISOString() : null,
    state,
    itemsCount: valid.length,
    items: lean ? [] : valid.slice(0, 12).map(itemFromJson),
    total: round2(total),
    paid: round2(paid),
    debt,
    credit,
    isDelivery: !!o.isDelivery,
    branch: o.branch || '',
  };
}
