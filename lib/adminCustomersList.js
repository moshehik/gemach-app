// lib/adminCustomersList.js - הלוגיקה הטהורה של רשימת הלקוחות לניהול (/admin/customers-list, API: /api/admin/customers-list).
// בלי prisma ובלי imports עם alias: נקרא גם מ-node רגיל (scripts/test_a5_orders_customers_lists.mjs).
//
// למה נתיב נפרד (ולא /api/customers): הרשימה מציגה לכל לקוח מספר הזמנות, חוב פתוח ותאריך הזמנה אחרונה, ומסננת / ממיינת לפיהם - צבירות שאין
// ב-/api/customers. הנתיב שמור להנהלה ראשית / מתכנת; הוא לא מחזיר ת"ז, פרטי בנק או הערות (רק "יש / אין" לת"ז).

import { DEFAULT_LIMIT, EXPORT_PAGE_LIMIT, MAX_LIST_LIMIT } from './adminListGuards.js';

export const CUSTOMERS_PAGE_SIZE = DEFAULT_LIMIT;

export const DEBT_KEYS = Object.freeze(['yes']);
export const MISSING_KEYS = Object.freeze(['any', 'email', 'phone', 'id']);
export const REGS_KEYS = Object.freeze(['signed', 'unsigned']);
export const BLOCKED_KEYS = Object.freeze(['yes', 'no']);
export const ORDERS_KEYS = Object.freeze(['active', 'has', 'none']);
export const FIRST_KEYS = Object.freeze(['d30', 'd90', 'y1', 'custom']);

export const NATIVE_SORTS = Object.freeze(['name', 'number', 'city', 'phone', 'email']);
export const COMPUTED_SORTS = Object.freeze(['orders', 'debt', 'lastOrder']);
export const CUSTOMER_SORT_KEYS = Object.freeze([...NATIVE_SORTS, ...COMPUTED_SORTS]);

const clampInt = (v, def, min, max) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def;
};
const csv = (v) => (Array.isArray(v) ? v : String(v == null ? '' : v).split(',')).map((x) => String(x).trim()).filter(Boolean);
const pickKnown = (v, known) => [...new Set(csv(v).filter((x) => known.includes(x)))];
const dateKey = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : '');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isExport = (v) => v === true || v === '1' || v === 1 || v === 'true';

export function parseCustomersListParams(input) {
  const p = input && typeof input === 'object' ? input : {};
  return {
    page: clampInt(p.page, 1, 1, 100000),
    // גודל עמוד: עד 100; בקשת ייצוא (export:true) - עד 500. לעולם לא "הכול"
    export: isExport(p.export),
    limit: clampInt(p.limit, CUSTOMERS_PAGE_SIZE, 1, isExport(p.export) ? EXPORT_PAGE_LIMIT : MAX_LIST_LIMIT),
    search: typeof p.search === 'string' ? p.search.slice(0, 200) : '',
    sort: CUSTOMER_SORT_KEYS.includes(p.sort) ? p.sort : 'name',
    dir: p.dir === 'desc' ? 'desc' : 'asc',
    debt: pickKnown(p.debt, DEBT_KEYS),
    missing: pickKnown(p.missing, MISSING_KEYS),
    regs: pickKnown(p.regs, REGS_KEYS),
    blocked: pickKnown(p.blocked, BLOCKED_KEYS),
    orders: pickKnown(p.orders, ORDERS_KEYS),
    first: pickKnown(p.first, FIRST_KEYS),
    from: dateKey(p.from),
    to: dateKey(p.to),
    ids: csv(p.ids).filter((x) => UUID_RE.test(x)).slice(0, 500),
    variant: clampInt(p.variant, 0, 0, 10),
  };
}

const addDays = (key, n) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/** תקופת "ההזמנה הראשונה" (= מתי הלקוח נוצר בפועל: ל-Customer אין תאריך יצירה) -> טווח ימים. null = בלי. */
export function resolveFirstPeriod(key, todayKey, from = '', to = '') {
  switch (key) {
    case 'd30': return { from: addDays(todayKey, -30), to: todayKey };
    case 'd90': return { from: addDays(todayKey, -90), to: todayKey };
    case 'y1': return { from: addDays(todayKey, -365), to: todayKey };
    case 'custom': return from || to ? { from: from || '', to: to || '' } : null;
    default: return null;
  }
}

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/* ===================================================================================================================================
 * מנוע התמונה (snapshot) ללקוחות - אותו רעיון כמו ברשימת ההזמנות (lib/adminOrdersList.js): שאילתת צבירה אחת לכל הלקוחות (CUSTOMER_SNAPSHOT_SQL, מטמון 30 שנ'
 * + איחוד בקשות), ומהתמונה בזיכרון נגזרים סינון, ספירות, מיון ועימוד. מ-DB נשלפות רק שורות העמוד. הפונקציות טהוריות (נבדקות בלי DB).
 * =================================================================================================================================== */

// שדות החובה של הכרטיס (REQUIRABLE_CUSTOMER_FIELDS ב-lib/customerRequiredFields.js) כביטים: ביט i דלוק = השדה ריק. אותו סדר בשאילתה ובקוד.
export const MASK_FIELDS = Object.freeze(['firstName', 'lastName', 'phone1', 'phone2', 'email', 'city', 'street', 'houseNum', 'zeout', 'bankName', 'bankBranch', 'bankAccount', 'bankAccountName']);
export const maskBit = (field) => { const i = MASK_FIELDS.indexOf(field); return i < 0 ? 0 : 2 ** i; };
/** מסכת שדות החובה לפי רשימת מפתחות (requiredFieldsFromSettings). */
export const requiredMaskOf = (keys) => (keys || []).reduce((m, k) => m + (m & maskBit(k) ? 0 : maskBit(k)), 0);

const EMPTY = (col) => `COALESCE(btrim(c."${col}"), '') = ''`;
const MASK_SQL = MASK_FIELDS.map((f, i) => {
  const cond = f === 'houseNum' ? 'c."houseNum" IS NULL'
    : f === 'email' ? `(${EMPTY('email')} AND NOT (COALESCE(c."emailSuffix", '') LIKE '%@%'))` // "אין מייל": גם בלי כתובת בסיומת (normalizeEmail משלים מהסיומת)
      : EMPTY(f);
  return `(CASE WHEN ${cond} THEN ${2 ** i} ELSE 0 END)`;
}).join(' + ');

/**
 * כל הלקוחות (לא מחוקים), שאילתה אחת: צבירות מההזמנות הלא-מחוקות (מספר, חוב פתוח = סכום יתרות חיוביות עם הסכום האפקטיבי כמו /api/orders, הזמנה אחרונה,
 * הזמנות פעילות = סטטוס נגזר בקרוב / הושכר חלקי / הושכר / הוחזר חלקי, יום ההזמנה הראשונה בישראל) + מאפייני הלקוח לסינון / מיון + מסכת שדות ריקים.
 */
export const CUSTOMER_SNAPSHOT_SQL = `
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
),
f AS (
  SELECT o."customerId", o."orderDate", o."eventDate", o."status",
    to_char((o."eventDate" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jerusalem', 'YYYY-MM-DD') AS ek,
    CASE WHEN COALESCE(o."totalAmount", 0) > 0 THEN o."totalAmount" WHEN COALESCE(obl.obl, 0) > 0 THEN obl.obl ELSE COALESCE(pay.paid, 0) END AS total,
    COALESCE(pay.paid, 0) AS paid,
    COALESCE(itm.nall, 0) AS nall, COALESCE(itm.nv, 0) AS nv, COALESCE(itm.nr, 0) AS nr, COALESCE(itm.nt, 0) AS nt
  FROM "Order" o
  LEFT JOIN pay ON pay."orderId" = o."orderId"
  LEFT JOIN obl ON obl."orderId" = o."orderId"
  LEFT JOIN itm ON itm."orderId" = o."orderId"
  WHERE NOT o."isDeleted" AND o."customerId" IS NOT NULL
),
agg AS (
  SELECT f."customerId" AS id,
    COUNT(*)::int AS orders,
    COALESCE(SUM(f.total - f.paid) FILTER (WHERE f.total > 0 AND f.paid < f.total), 0) AS debt,
    EXTRACT(EPOCH FROM MAX(COALESCE(f."orderDate", f."eventDate")))::float8 AS last_order,
    COUNT(*) FILTER (
      WHERE NOT (f.nall > 0 AND f.nv = 0)
        AND NOT (f.nv > 0 AND f.nr = f.nv)
        AND NOT (f.nr = 0 AND f.nt = 0 AND (COALESCE(f."status" = 'טיוטה', false) OR COALESCE(f.ek < to_char(now() AT TIME ZONE 'Asia/Jerusalem', 'YYYY-MM-DD'), false)))
    )::int AS active,
    to_char((MIN(f."orderDate") AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jerusalem', 'YYYY-MM-DD') AS first_ek
  FROM f GROUP BY f."customerId"
)
SELECT c."id", c."legacyId" AS num,
  lower(btrim(COALESCE(c."firstName", '') || ' ' || COALESCE(c."lastName", ''))) AS cn,
  c."isBlocked" AS blk, c."hasSignedRegulations" AS reg,
  lower(COALESCE(c."city", '')) AS city, COALESCE(c."phone1", '') AS ph, lower(COALESCE(c."email", '')) AS em,
  (${MASK_SQL}) AS mask,
  COALESCE(a.orders, 0) AS orders, COALESCE(a.debt, 0) AS debt, a.last_order, COALESCE(a.active, 0) AS active, a.first_ek
FROM "Customer" c
LEFT JOIN agg a ON a.id = c."id"
WHERE NOT c."isDeleted"`;

/** שורת התמונה -> עובדה (מספרים רגילים, שמות באותיות קטנות למיון). */
export function buildCustomerFact(r) {
  return {
    id: r.id,
    num: r.num === null || r.num === undefined ? null : Number(r.num),
    cn: r.cn || '', blk: !!r.blk, reg: !!r.reg, city: r.city || '', ph: r.ph || '', em: r.em || '',
    mask: Number(r.mask) || 0,
    orders: Number(r.orders) || 0, debt: round2(r.debt), last: r.last_order === null || r.last_order === undefined ? null : Number(r.last_order),
    active: Number(r.active) || 0, first: r.first_ek || '',
  };
}

const inDays = (ek, r) => !!ek && (!r.from || ek >= r.from) && (!r.to || ek <= r.to);

const GROUP_TEST = {
  debt: (f) => ({ yes: f.debt > 0 }),
  missing: (f, ctx) => ({ any: (f.mask & ctx.requiredMask) !== 0, email: (f.mask & maskBit('email')) !== 0, phone: (f.mask & maskBit('phone1')) !== 0, id: (f.mask & maskBit('zeout')) !== 0 }),
  regs: (f) => ({ signed: f.reg, unsigned: !f.reg }),
  blocked: (f) => ({ yes: f.blk, no: !f.blk }),
  orders: (f) => ({ active: f.active > 0, has: f.orders > 0, none: f.orders === 0 }),
};

/** סינון עובדות הלקוחות (OR בתוך קבוצה, AND בין קבוצות). ctx = { todayKey, requiredMask }. omit = קבוצה להשמיט. searchIds = Set או null. */
export function filterCustomerFacts(facts, params, ctx, { omit = '', searchIds = null } = {}) {
  const groups = ['debt', 'missing', 'regs', 'blocked', 'orders'].filter((g) => omit !== g && params[g].length);
  const ranges = omit === 'first' ? [] : params.first.map((k) => resolveFirstPeriod(k, ctx.todayKey, params.from, params.to)).filter(Boolean);
  const firstOn = omit !== 'first' && params.first.length > 0;
  const ids = params.ids.length ? new Set(params.ids) : null;
  return facts.filter((f) => {
    for (const g of groups) { const t = GROUP_TEST[g](f, ctx); if (!params[g].some((k) => t[k])) return false; }
    if (firstOn && !ranges.some((r) => inDays(f.first, r))) return false;
    if (ids && !ids.has(f.id)) return false;
    if (searchIds && !searchIds.has(f.id)) return false;
    return true;
  });
}

/** מיון (עותק): ערכים חסרים בסוף תמיד; שוויון = מזהה. */
export function sortCustomerFacts(list, sort, dir) {
  const d = dir === 'desc' ? -1 : 1;
  const key = {
    name: (f) => f.cn, number: (f) => f.num, city: (f) => f.city || null, phone: (f) => f.ph || null, email: (f) => f.em || null,
    orders: (f) => f.orders, debt: (f) => f.debt, lastOrder: (f) => f.last,
  }[sort] || ((f) => f.cn);
  const text = sort === 'name' || sort === 'city' || sort === 'phone' || sort === 'email';
  return list.slice().sort((a, b) => {
    const x = key(a);
    const y = key(b);
    const xn = x === null || x === undefined;
    const yn = y === null || y === undefined;
    if (xn || yn) { if (xn && yn) return a.id < b.id ? -1 : 1; return xn ? 1 : -1; }
    const c = text ? (x < y ? -1 : x > y ? 1 : 0) : x - y;
    return c ? c * d : (a.id < b.id ? -1 : 1);
  });
}

/** ספירות האפשרויות (סמנטיקת ערכת הרשימות: שאר הקבוצות + החיפוש מוחלים, הקבוצה עצמה לא). צורת התשובה זהה ל-/counts. */
export function countCustomerFacts(facts, params, ctx, { searchIds = null } = {}) {
  const opt = { searchIds };
  const out = { debt: {}, missing: {}, regs: {}, blocked: {}, orders: {}, first: {}, total: filterCustomerFacts(facts, params, ctx, opt).length };
  const groups = { debt: DEBT_KEYS, missing: MISSING_KEYS, regs: REGS_KEYS, blocked: BLOCKED_KEYS, orders: ORDERS_KEYS };
  for (const [g, keys] of Object.entries(groups)) {
    const base = filterCustomerFacts(facts, params, ctx, { ...opt, omit: g });
    for (const k of keys) out[g][k] = base.filter((f) => GROUP_TEST[g](f, ctx)[k]).length;
  }
  const baseFirst = filterCustomerFacts(facts, params, ctx, { ...opt, omit: 'first' });
  for (const k of FIRST_KEYS) {
    if (k === 'custom' && !params.from && !params.to) continue;
    const r = resolveFirstPeriod(k, ctx.todayKey, params.from, params.to);
    if (r) out.first[k] = baseFirst.filter((f) => inDays(f.first, r)).length;
  }
  return out;
}
