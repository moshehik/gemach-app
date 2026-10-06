import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth, checkPageAccess, HEAD_MANAGEMENT_ROLES } from '@/lib/auth';
import { canOpenPage } from '@/lib/permissions';
import { getDeliveriesForDate } from '@/lib/deliveries';
import { calculateOrderStatus } from '@/lib/orderStatus';
import { getHebrewDateString, getIsraelDayRange, getIsraelTodayDate } from '@/lib/hebrewDate';
import { DRAFT_ORDER_STATUS } from '@/lib/orderReservation';
import { GET as capacityGET } from '@/app/api/inventory/capacity/route';
import { sizeTextFilter } from '@/lib/listSearch';
import { sizeMatches } from '@/lib/searchNormalize';

// חיפוש מתקדם A5 - תחומי משלוחים / תיקונים / כספים / תפוסה / דגמים / עובדים.
// קריאה בלבד. אותם כללים כמו העמודים החיים (ר' public/a5/adapters/adv-b.NOTES.md).
// מחזיר כבר בפורמט ADV_VIEW: {cols, rows, links, al, capstats?, truncated, gaps}.
export const dynamic = 'force-dynamic';
// חישוב תפוסה לדגם בלי מידה = עד 30 צמדים x 3 שאילתות (5 במקביל) - איטי; בלי תקרה מפורשת מתקבלת ברירת המחדל הקצרה של Vercel.
// 60 כמו /api/pdf ו-/api/ai (כבר נפרסים בתוכנית הנוכחית).
export const maxDuration = 60;

const LIMIT = 200;
const OTHER_DAYS_MAX = 31;
const DAY_CONCURRENCY = 4; // ימי משלוח שנשאלים במקביל (כל יום = שאילתה אחת ב-getDeliveriesForDate)
const CAPACITY_PAIRS_MAX = 30; // צמדי דגם/מידה לחישוב תפוסה (כל צמד = 3 שאילתות ב-/api/inventory/capacity); לדגם בודד יש עד ~26 מידות
const CAPACITY_CONCURRENCY = 5;
// חובות: קודם צמצום ב-SQL להזמנות שבהן שולם פחות מהסכום (אותו כלל כמו filterStatus=unpaid_all),
// ואז טעינת המועמדות בלבד. טעינת 20,000 הזמנות עם תשלומים ופריטים לזיכרון נמדדה 32-45 שניות.
const DEBT_CANDIDATES_MAX = 5000;

const json = (body, status = 200) => NextResponse.json(body, { status });
const isIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const s = (v) => (v == null ? '' : String(v).trim());
const has = (list, v) => list.includes(v);
const fullName = (c) => [c?.firstName, c?.lastName].filter(Boolean).join(' ').trim();
// שם משפחה לפני שם פרטי - לתצוגה טבלאית בלבד (C-1.8)
const fullNameRev = (c) => [c?.lastName, c?.firstName].filter(Boolean).join(' ').trim();

// השנה היא האסימון האחרון (מתחיל ב-ת/הת: תשפ"ז / תשפז / התשפ"ז); חודש כמו "אדר ב'" לא מתחיל ב-ת
function stripYear(raw) {
  const parts = raw.trim().split(/\s+/);
  if (parts.length >= 3 && /^ה?ת/.test(parts[parts.length - 1])) parts.pop();
  return parts.join(' ');
}
// תאריך עברי בלי שנה ("ט״ו תשרי") - כמו eventDateHebrew באתר, השנה נחתכת
function hebNoYear(order) {
  const raw = order.eventDateHebrew || (order.eventDate ? getHebrewDateString(order.eventDate) : '');
  if (!raw) return '';
  return stripYear(raw);
}
const hebOfDate = (d) => {
  if (!d) return '';
  return stripYear(getHebrewDateString(d));
};
const money = (n) => '₪' + Number(Math.abs(n).toFixed(2)).toLocaleString('he-IL');

// קרוב לרחוק קדימה (היום ראשון), ואז אחורה בעבר - כמו המיון החכם של ההשכרות באתר
function smartSort(rows, dateOf) {
  const todayIso = getIsraelTodayDate();
  const t = new Date(Date.UTC(todayIso.getFullYear(), todayIso.getMonth(), todayIso.getDate())).getTime();
  const up = [], past = [], none = [];
  for (const r of rows) {
    const d = dateOf(r);
    if (!d) { none.push(r); continue; }
    (new Date(d).getTime() >= t - 12 * 3600 * 1000 ? up : past).push(r);
  }
  up.sort((a, b) => new Date(dateOf(a)) - new Date(dateOf(b)));
  past.sort((a, b) => new Date(dateOf(b)) - new Date(dateOf(a)));
  return [...up, ...past, ...none];
}

const dayRange = (iso) => getIsraelDayRange(iso);
function eventDateCond(p) {
  const from = isIso(p.from) ? p.from : '', to = isIso(p.to) ? p.to : '';
  if (from && to) return { gte: dayRange(from).start, lte: dayRange(to).end };
  if (from) return { gte: dayRange(from).start, lte: dayRange(from).end }; // תאריך אירוע בודד = אותו יום
  if (to) return { lte: dayRange(to).end };
  return null;
}

// פילטרים משותפים של "פרטי לקוח והזמנה" (rcust / fcust): קוד הזמנה, תאריך אירוע, שם, פרטי לקוח
// טיוטות שרת (status 'טיוטה') לא נכללות, כמו orderFilterAnd ב-lib/advAlerts.js (בגמ"ח עם draft_orders_show_as_deleted הן מוצגות כ"מחוקות")
const COMMON_BASE_LEN = 2;
function commonOrderWhere(p) {
  const AND = [{ isDeleted: false }, { OR: [{ status: null }, { status: { not: DRAFT_ORDER_STATUS } }] }];
  const oid = s(p.oid);
  if (oid) { const n = parseInt(oid, 10); AND.push(isNaN(n) || !/^\d+$/.test(oid) ? { orderId: -1 } : { orderId: n }); }
  const ev = eventDateCond(p);
  if (ev) AND.push({ eventDate: ev });
  for (const tok of s(p.name).split(/\s+/).filter(Boolean)) {
    AND.push({ customer: { OR: [{ firstName: { contains: tok, mode: 'insensitive' } }, { lastName: { contains: tok, mode: 'insensitive' } }] } });
  }
  const ci = s(p.cinfo);
  if (ci) {
    AND.push({ customer: { OR: ['email', 'phone1', 'phone2', 'city', 'street'].map((k) => ({ [k]: { contains: ci, mode: 'insensitive' } })) } });
  }
  const emp = s(p.emp);
  if (emp) {
    AND.push({ employee: { OR: [{ fullName: { contains: emp, mode: 'insensitive' } }, { firstName: { contains: emp, mode: 'insensitive' } }, { lastName: { contains: emp, mode: 'insensitive' } }] } });
  }
  return AND;
}

// חוב = אותו כלל כמו filterStatus=unpaid_all ב-/api/orders
const orderDebt = (o) => {
  const total = o.totalAmount || 0;
  const paid = (o.payments || []).reduce((a, x) => a + (x.isDeleted ? 0 : x.amount), 0);
  return total > 0 && paid < total ? total - paid : 0;
};

// סימוני "דרוש בדיקה" (rc_*) שיש להם מקור אמיתי; rc_other / rc_stock - אין (GAP)
function rchkPass(flags, o, gaps) {
  if (has(flags, 'rc_other') || has(flags, 'rc_stock')) {
    gaps.add('rc_other/rc_stock: אין מקור נתונים אמיתי - הסימון מחזיר תוצאה ריקה');
    return false;
  }
  if (has(flags, 'rc_branch') && !(o.branch && o.pickupBranch && o.branch !== o.pickupBranch)) return false;
  if (has(flags, 'rc_debt') && !(orderDebt(o) > 0)) return false;
  return true;
}

const customerSelect = { firstName: true, lastName: true, phone1: true, phone2: true, city: true, street: true, houseNum: true, email: true };
const orderBase = {
  orderId: true, customerId: true, eventDate: true, eventDateHebrew: true, notes: true, totalAmount: true, branch: true, pickupBranch: true,
  isDelivery: true, deliveryDirection: true, deliveryCity: true, deliveryAddress: true, status: true, isDeleted: true,
  customer: { select: customerSelect },
  payments: { where: { isDeleted: false }, select: { amount: true, isDeleted: true } },
};

/* ---------------- משלוחים ---------------- */
async function deliveries(p, flags, ost, gaps) {
  const today = getIsraelTodayDate();
  const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // תאריכי חלון: אותה שאילתה בדיוק כמו GET /api/deliveries?date=. כל יום נשאל פעם אחת בלבד
  // (היום/מחר חוזרים גם בסוף הפונקציה) ובמקביל מוגבל - טווח "אחר" של 45 יום נמדד 80 שניות כשרץ יום-אחר-יום.
  const dayCache = new Map(); // 'YYYY-MM-DD' -> Promise<Set<orderId>>
  const dayIds = (d) => {
    const k = iso(d);
    if (!dayCache.has(k)) dayCache.set(k, getDeliveriesForDate(d).then((r) => new Set(r.data.map((row) => row.orderId))));
    return dayCache.get(k);
  };
  const daysOf = async (list) => {
    const out = new Map();
    for (let i = 0; i < list.length; i += DAY_CONCURRENCY) {
      const sets = await Promise.all(list.slice(i, i + DAY_CONCURRENCY).map(dayIds));
      for (const set of sets) for (const id of set) out.set(id, true);
    }
    return out;
  };
  const wanted = [];
  if (has(ost, 'ds_today')) wanted.push(today);
  if (has(ost, 'ds_tomorrow')) wanted.push(addD(today, 1));
  if (has(ost, 'ds_other')) {
    const a = isIso(p.sfrom) ? p.sfrom : isIso(p.sto) ? p.sto : '';
    const b = isIso(p.sto) ? p.sto : a;
    if (a) {
      let d = new Date(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
      const end = new Date(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
      let n = 0;
      while (d <= end && n < OTHER_DAYS_MAX) { wanted.push(new Date(d)); d = addD(d, 1); n++; }
      if (d <= end) gaps.add(`סטטוס "אחר": הטווח נחתך ל-${OTHER_DAYS_MAX} ימים`);
    }
  }
  if (has(ost, 'ds_sent') || has(ost, 'ds_picked')) gaps.add('ds_sent/ds_picked: אין באתר סטטוס "נשלח/נאסף" שמור - לא מוחזרות שורות בגללם');
  const statusSel = ost.length > 0;
  let candidate = null;
  if (statusSel) {
    candidate = new Map();
    if (wanted.length) { const m = await daysOf(wanted); for (const k of m.keys()) candidate.set(k, true); }
    if (candidate.size === 0) return { rows: [] };
  }
  const AND = commonOrderWhere(p);
  AND.push({ isDelivery: true });
  if (candidate) AND.push({ orderId: { in: [...candidate.keys()] } });
  const city = s(p.city);
  if (city) AND.push({ OR: [{ deliveryCity: { contains: city, mode: 'insensitive' } }, { AND: [{ OR: [{ deliveryCity: null }, { deliveryCity: '' }] }, { customer: { city: { contains: city, mode: 'insensitive' } } }] }] });
  if (has(flags, 'dl_note')) AND.push({ notes: { not: null } }, { NOT: { notes: '' } });
  const orders = await prisma.order.findMany({
    where: { AND }, take: 3000,
    select: { ...orderBase, items: { where: { isDeleted: false }, select: { isDeleted: true, isTaken: true, isReturned: true } } },
  });
  const [todaySet, tomSet] = await Promise.all([daysOf([today]), daysOf([addD(today, 1)])]);
  let rows = orders.filter((o) => {
    if (calculateOrderStatus({ ...o, items: o.items }) === 'מחוק' || !o.eventDate) return false;
    const dir = o.deliveryDirection || 'הלוך-חזור';
    if (has(flags, 'dl_out') && dir === 'חזור') return false;
    if (has(flags, 'dl_back') && dir === 'הלוך') return false;
    if (has(flags, 'dl_note') && !s(o.notes)) return false;
    return rchkPass(flags, o, gaps);
  });
  rows = smartSort(rows, (o) => o.eventDate);
  const truncated = rows.length > LIMIT;
  rows = rows.slice(0, LIMIT);
  const out = rows.map((o) => {
    const street = o.deliveryAddress || [o.customer?.street, o.customer?.houseNum].filter(Boolean).join(' ');
    const cty = o.deliveryCity || o.customer?.city || '';
    const address = street && cty ? `${street}, ${cty}` : (street || cty || '');
    const dir = o.deliveryDirection || 'הלוך-חזור';
    const status = todaySet.has(o.orderId) ? ['היום', 'st-today'] : tomSet.has(o.orderId) ? ['מחר', 'st-soon'] : '';
    return {
      link: `/orders/${o.orderId}`,
      cells: [address, fullName(o.customer), hebNoYear(o), status, o.customer?.phone1 || '', [dir === 'הלוך-חזור' ? 'שניהם' : dir, 'st-mid']],
      nameRev: fullNameRev(o.customer),
    };
  });
  return { rows: out, truncated, cols: ['כתובת מלאה', 'שם', 'תאריך אירוע', 'סטטוס', 'טלפון', 'כיוון'] };
}

/* ---------------- תיקונים ---------------- */
async function alterations(p, flags, ost, gaps) {
  const today = getIsraelTodayDate();
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const ranges = [];
  if (has(ost, 'as_today')) ranges.push(dayRange(iso(today)));
  if (has(ost, 'as_tomorrow')) ranges.push(dayRange(iso(tomorrow)));
  if (has(ost, 'as_other')) {
    const a = isIso(p.sfrom) ? p.sfrom : '', b = isIso(p.sto) ? p.sto : '';
    if (a || b) ranges.push({ start: a ? dayRange(a).start : new Date(0), end: b ? dayRange(b).end : new Date('2999-01-01') });
  }
  if (ost.length && !ranges.length) return { rows: [] };
  const orderAND = commonOrderWhere(p);
  if (ranges.length) orderAND.push({ OR: ranges.map((r) => ({ eventDate: { gte: r.start, lte: r.end } })) });
  const itemAND = [
    { isDeleted: false },
    // כמו העמוד החי: רק פריטים שעדיין לא נלקחו/הוחזרו
    { isTaken: false }, { isReturned: false },
    { order: { AND: orderAND } },
    // יש תיקון: אותו כלל כמו GET /api/alterations
    { OR: [{ neckAlteration: { gt: 0 } }, { AND: [{ lengthAlteration: { not: null } }, { lengthAlteration: { notIn: ['', 'null', '0'] } }] }, { sleeveAlteration: { gt: 0 } }] },
  ];
  if (has(flags, 'al_len')) itemAND.push({ lengthAlteration: { not: null } }, { lengthAlteration: { notIn: ['', 'null', '0'] } });
  if (has(flags, 'al_sleeve')) itemAND.push({ sleeveAlteration: { gt: 0 } });
  if (has(flags, 'al_fix')) itemAND.push({ OR: [{ neckAlteration: { gt: 0 } }, { AND: [{ alterationDetails: { not: null } }, { NOT: { alterationDetails: '' } }] }] });
  if (has(flags, 'al_done')) itemAND.push({ alterationDone: true });
  const items = await prisma.orderItem.findMany({
    where: { AND: itemAND }, take: 6000,
    select: {
      quantity: true, neckAlteration: true, lengthAlteration: true, sleeveAlteration: true, alterationDetails: true, alterationDone: true,
      order: { select: orderBase },
    },
  });
  const byOrder = new Map();
  for (const it of items) {
    if (!it.order || !rchkPass(flags, it.order, gaps)) continue;
    const g = byOrder.get(it.order.orderId) || { order: it.order, n: 0, types: new Set() };
    g.n += it.quantity || 1;
    if (it.lengthAlteration && !['', 'null', '0'].includes(String(it.lengthAlteration).trim())) g.types.add('אורך: ' + it.lengthAlteration);
    if (it.neckAlteration > 0) g.types.add('צוואר: הצרה ' + it.neckAlteration);
    if (it.sleeveAlteration > 0) g.types.add('שרוול: הארכה ' + it.sleeveAlteration);
    if (it.alterationDetails) g.types.add(it.alterationDetails);
    byOrder.set(it.order.orderId, g);
  }
  let groups = smartSort([...byOrder.values()], (g) => g.order.eventDate);
  const truncated = groups.length > LIMIT;
  groups = groups.slice(0, LIMIT);
  return {
    rows: groups.map((g) => ({ link: `/orders/${g.order.orderId}`, cells: [fullName(g.order.customer), hebNoYear(g.order), String(g.n), [...g.types].join(' · ')], nameRev: fullNameRev(g.order.customer) })),
    truncated, cols: ['שם', 'תאריך אירוע', 'כמות לתיקון', 'סוג תיקון'],
  };
}

/* ---------------- כספים ---------------- */
const ORD_ST = {
  'הוזמן': ['בקרוב'], 'הושכר': ['הושכר', 'הושכר חלקי', 'הוחזר חלקי'], 'הוחזר': ['הוחזר'], 'לא נלקח': ['עבר'],
};
async function finance(p, flags, gaps) {
  const wantDebt = has(flags, 'fn_debt'), wantCredit = has(flags, 'fn_credit');
  const onlyCredit = has(flags, 'fc_done') || has(flags, 'fc_nobank') || s(p.cemp) || isIso(p.cdate);
  let includeDebts = (!wantCredit || wantDebt) && !onlyCredit;
  let includeCredits = !wantDebt || wantCredit;
  const amt = parseFloat(String(p.amount || '').replace(/[^\d.]/g, ''));
  const amtOk = (a) => isNaN(amt) || Math.abs(a - amt) <= 30; // טווח ±30 ₪
  const adate = isIso(p.adate) ? dayRange(p.adate) : null;
  const ordSel = ORD_ST[s(p.ordst)] || null;
  const orderAND = commonOrderWhere(p);
  const rows = [];
  let debtCapTruncated = false;

  if (includeDebts) {
    // מועמדות בלבד: הזמנות לא-מחוקות עם סכום > 0 ששולם עליהן (תשלומים לא-מחוקים) פחות מהסכום, החדשות קודם.
    // אותו כלל כמו orderDebt() למטה, שעדיין נבדק על כל שורה - ה-SQL רק מצמצם את מה שנטען.
    const debtRows = await prisma.$queryRaw`
      SELECT o."orderId" FROM "Order" o
      LEFT JOIN "Payment" p ON p."orderId" = o."orderId" AND p."isDeleted" = false
      WHERE o."isDeleted" = false AND COALESCE(o."totalAmount", 0) > 0
        AND (o."status" IS NULL OR o."status" <> ${DRAFT_ORDER_STATUS})
      GROUP BY o."orderId", o."totalAmount", o."eventDate"
      HAVING COALESCE(SUM(p."amount"), 0) < o."totalAmount"
      ORDER BY o."eventDate" DESC NULLS LAST
      LIMIT ${DEBT_CANDIDATES_MAX + 1}`;
    // תקרת מועמדות: אם נחתכה, חוב ישן יותר (שמסנן שם / קוד / תאריך היה מוצא) נעדר מהרשימה. עם מסנן שמצמצם — מסננים ב-DB על ההזמנות
    // עצמן (עם התשלומים, החוב מחושב ב-JS כמו תמיד); בלי מסנן מצמצם — מסמנים truncated (אי אפשר לדעת מה חסר).
    const candCapHit = debtRows.length > DEBT_CANDIDATES_MAX;
    const narrowed = orderAND.length > COMMON_BASE_LEN || !!adate;
    const orderSel = { ...orderBase, items: { select: { isDeleted: true, isTaken: true, isReturned: true } } };
    let orders;
    if (candCapHit && narrowed) {
      const AND = [...orderAND, { totalAmount: { gt: 0 } }];
      if (adate) AND.push({ orderDate: { gte: adate.start, lte: adate.end } });
      orders = await prisma.order.findMany({ where: { AND }, orderBy: { eventDate: { sort: 'desc', nulls: 'last' } }, take: DEBT_CANDIDATES_MAX + 1, select: orderSel });
      if (orders.length > DEBT_CANDIDATES_MAX) { debtCapTruncated = true; orders = orders.slice(0, DEBT_CANDIDATES_MAX); }
    } else {
      if (candCapHit) debtCapTruncated = true;
      const AND = [...orderAND, { totalAmount: { gt: 0 } }, { orderId: { in: debtRows.slice(0, DEBT_CANDIDATES_MAX).map((r) => r.orderId) } }];
      if (adate) AND.push({ orderDate: { gte: adate.start, lte: adate.end } });
      orders = await prisma.order.findMany({ where: { AND }, take: DEBT_CANDIDATES_MAX, select: orderSel });
    }
    for (const o of orders) {
      const d = orderDebt(o);
      if (d <= 0 || !amtOk(d)) continue;
      if (ordSel && !ordSel.includes(calculateOrderStatus(o))) continue;
      rows.push({ o, sort: o.eventDate, kind: 'debt', cells: [fullName(o.customer), [`חוב ${money(d)}`, 'amtd'], hebNoYear(o), o.customer?.phone1 || ''], link: `/orders/${o.orderId}`, nameRev: fullNameRev(o.customer) });
    }
  }
  if (includeCredits) {
    const rAND = [{ isDeleted: false }];
    if (has(flags, 'fc_done')) rAND.push({ isExecuted: true });
    if (adate) rAND.push({ createdAt: { gte: adate.start, lte: adate.end } });
    if (isIso(p.cdate)) { const r = dayRange(p.cdate); rAND.push({ executionDate: { gte: r.start, lte: r.end } }); }
    const cemp = s(p.cemp);
    if (cemp) {
      const emps = await prisma.employee.findMany({ where: { OR: [{ fullName: { contains: cemp, mode: 'insensitive' } }, { firstName: { contains: cemp, mode: 'insensitive' } }, { lastName: { contains: cemp, mode: 'insensitive' } }] }, select: { id: true } });
      rAND.push({ executedBy: { in: emps.map((e) => e.id) } });
    }
    if (has(flags, 'fc_nobank')) rAND.push({ OR: [{ bankName: null }, { bankName: '' }, { bankBranch: null }, { bankBranch: '' }, { bankAccount: null }, { bankAccount: '' }] });
    // סינוני הזמנה/לקוח על ההזמנה של הזיכוי (זיכוי בלי הזמנה - רק פרטי לקוח)
    const oid = s(p.oid);
    const custAND = [];
    for (const tok of s(p.name).split(/\s+/).filter(Boolean)) custAND.push({ OR: [{ firstName: { contains: tok, mode: 'insensitive' } }, { lastName: { contains: tok, mode: 'insensitive' } }] });
    const ci = s(p.cinfo);
    if (ci) custAND.push({ OR: ['email', 'phone1', 'phone2', 'city', 'street'].map((k) => ({ [k]: { contains: ci, mode: 'insensitive' } })) });
    if (custAND.length) rAND.push({ customer: { AND: custAND } });
    if (oid) { const n = parseInt(oid, 10); rAND.push({ orderId: !/^\d+$/.test(oid) || isNaN(n) ? -1 : n }); }
    const needOrder = eventDateCond(p) || ordSel || s(p.emp);
    if (needOrder) rAND.push({ order: { AND: orderAND } });
    const refunds = await prisma.refund.findMany({
      where: { AND: rAND }, take: 5000,
      include: { customer: { select: customerSelect }, order: { select: { orderId: true, eventDate: true, eventDateHebrew: true, isDeleted: true, items: { select: { isDeleted: true, isTaken: true, isReturned: true } }, status: true } } },
    });
    for (const r of refunds) {
      if (!amtOk(r.amount)) continue;
      if (ordSel && !(r.order && ordSel.includes(calculateOrderStatus(r.order)))) continue;
      const ord = r.order;
      rows.push({
        kind: 'credit', sort: ord?.eventDate || r.createdAt,
        cells: [fullName(r.customer), [`זיכוי ${money(r.amount)}`, 'amtc'], ord ? hebNoYear(ord) : '', r.customer?.phone1 || ''],
        link: r.orderId ? `/orders/${r.orderId}` : `/customers/${r.customerId}`,
        nameRev: fullNameRev(r.customer),
      });
    }
  }
  let sorted = smartSort(rows, (r) => r.sort);
  const truncated = sorted.length > LIMIT || debtCapTruncated;
  sorted = sorted.slice(0, LIMIT);
  return { rows: sorted, truncated, cols: ['שם', 'סכום', 'תאריך אירוע', 'טלפון'] };
}

/* ---------------- תפוסה ---------------- */
const CAP_COLS = ['שם', 'תאריך אירוע', 'כמות', 'טלפון'];
async function capacity(p, req, gaps) {
  const model = s(p.model);
  if (!model) return { error: 'נדרש דגם לחיפוש תפוסה', status: 400 };
  const from = isIso(p.from) ? p.from : isIso(p.to) ? p.to : getIsraelTodayDate().toLocaleDateString('en-CA');
  const to = isIso(p.to) ? p.to : from;
  const num = /^\d+$/.test(model) ? parseInt(model, 10) : null;
  let models = await prisma.dressModel.findMany({
    where: { isDeleted: false, barcodePrefix: { not: null }, OR: [{ name: { contains: model, mode: 'insensitive' } }, ...(num != null ? [{ barcodePrefix: num }] : [])] },
    select: { id: true, name: true, barcodePrefix: true },
  });
  const exact = models.filter((m) => m.name === model || m.barcodePrefix === num);
  if (exact.length) models = exact;
  const prefixes = [...new Set(models.map((m) => m.barcodePrefix))];
  if (!prefixes.length) return { rows: [], capstats: { stock: 0, busy: 0, res: 0 }, cols: CAP_COLS };
  let sizes = s(p.size) ? [s(p.size)] : (await prisma.dressItem.findMany({ where: { barcodePrefix: { in: prefixes }, isDeleted: false, sizeText: { not: null } }, distinct: ['barcodePrefix', 'sizeText'], select: { barcodePrefix: true, sizeText: true } }));
  const pairs = s(p.size) ? prefixes.map((x) => [x, s(p.size)]) : sizes.map((x) => [x.barcodePrefix, x.sizeText]);
  // כל צמד = 3 שאילתות (מלאי/רזרבה/תפוסה על כל פריטי ההזמנה של הדגם); 60 צמדים בזה-אחר-זה נמדדו
  // למעלה משתי דקות - מעבר לכל timeout של Vercel. לכן תקרה נמוכה יותר וריצה במקביל מוגבל.
  if (pairs.length > CAPACITY_PAIRS_MAX) return { error: 'יותר מדי דגמים/מידות תואמים - צמצמו את שם הדגם או הוסיפו מידה', status: 400 };
  const stats = { stock: 0, busy: 0, res: 0 };
  const occ = new Map();
  const capacityOf = async ([prefix, size]) => {
    const url = new URL('http://local/api/inventory/capacity');
    url.searchParams.set('barcodePrefix', String(prefix)); url.searchParams.set('size', size);
    url.searchParams.set('fromDate', from); url.searchParams.set('toDate', to);
    const res = await capacityGET(new Request(url)); // אותו endpoint וחישוב כמו הטופס החי
    if (!res.ok) throw new Error('capacity ' + res.status);
    return res.json();
  };
  for (let i = 0; i < pairs.length; i += CAPACITY_CONCURRENCY) {
    let results;
    try { results = await Promise.all(pairs.slice(i, i + CAPACITY_CONCURRENCY).map(capacityOf)); }
    catch (e) { console.error('a5 capacity:', e?.message || e); return { error: 'שגיאה בחישוב תפוסה', status: 500 }; }
    for (const d of results) {
      stats.stock += d.inStock; stats.busy += d.occupiedCount; stats.res += d.reserve;
      for (const o of d.occupiedOrders || []) {
        const cur = occ.get(o.orderId) || { ...o, quantity: 0, barcodes: [] };
        cur.quantity += o.quantity; occ.set(o.orderId, cur);
        for (const b of o.barcodes || []) if (!cur.barcodes.includes(b)) cur.barcodes.push(b); // רק שמלות שכבר יצאו למשפחה (ר' /api/inventory/capacity)
      }
    }
  }
  const ids = [...occ.keys()];
  const phones = ids.length ? await prisma.order.findMany({ where: { orderId: { in: ids } }, select: { orderId: true, customer: { select: { phone1: true, firstName: true, lastName: true } } } }) : [];
  const phoneBy = new Map(phones.map((o) => [o.orderId, o.customer?.phone1 || '']));
  const nameRevBy = new Map(phones.map((o) => [o.orderId, fullNameRev(o.customer)]));
  let list = smartSort([...occ.values()], (o) => o.eventDate);
  const truncated = list.length > LIMIT;
  list = list.slice(0, LIMIT);
  return {
    rows: list.map((o) => ({ link: `/orders/${o.orderId}`, cells: [o.customerName === 'לא ידוע' ? '' : o.customerName, hebNoYear(o), String(o.quantity), phoneBy.get(o.orderId) || ''], barcode: (o.barcodes || []).join(', '), nameRev: o.customerName === 'לא ידוע' ? '' : (nameRevBy.get(o.orderId) || '') })),
    capstats: stats, truncated, cols: CAP_COLS,
  };
}

/* ---------------- דגמים ---------------- */
async function models(p, flags, gaps) {
  const AND = [];
  const delModel = has(flags, 'md_delmodel');
  AND.push({ isDeleted: delModel });
  if (has(flags, 'md_inactive')) AND.push({ OR: [{ exitDateFromRepo: { not: null } }, { items: { none: { notInUse: false, isDeleted: false } } }] }); // כמו filterStatus=inactive
  const model = s(p.model);
  if (model) {
    const n = /^\d+$/.test(model) ? parseInt(model, 10) : null;
    AND.push({ OR: [{ name: { contains: model, mode: 'insensitive' } }, ...(n != null ? [{ barcodePrefix: n }] : [])] });
  }
  const itemSome = {};
  const size = s(p.size), code = s(p.item);
  // מידה מדויקת: "2" = "02" ולא 12/20/32 (lib/listSearch.js sizeTextFilter; קודם contains)
  if (size) itemSome.sizeText = sizeTextFilter(size) || { contains: size };
  if (code) itemSome.dressBarcode = { contains: code };
  if (has(flags, 'md_repair')) itemSome.inRepair = true;
  if (has(flags, 'md_delitem')) itemSome.isDeleted = true;
  if (Object.keys(itemSome).length) AND.push({ items: { some: itemSome } });
  if (s(p.branch)) gaps.add('branch: לדגם/פריט אין שדה סניף באתר - הסינון לא הוחל');
  const list = await prisma.dressModel.findMany({
    where: { AND }, orderBy: { name: 'asc' }, take: LIMIT + 1,
    select: { id: true, name: true, barcodePrefix: true, items: { select: { quantity: true, isDeleted: true, sizeText: true, inRepair: true, dressBarcode: true } } },
  });
  const truncated = list.length > LIMIT;
  return {
    rows: list.slice(0, LIMIT).map((m) => {
      // כמות פריטים: פריטים פעילים (או המחוקים כשנבחר "פריט מחוק"), בכפוף לסינון מידה/ברקוד
      const its = m.items.filter((i) => (has(flags, 'md_delitem') ? i.isDeleted : !i.isDeleted)
        && (!size || sizeMatches(i.sizeText, size)) && (!code || (i.dressBarcode || '').includes(code)) && (!has(flags, 'md_repair') || i.inRepair));
      return { link: `/dashboard/dresses/${m.id}`, cells: [m.name || '', m.barcodePrefix != null ? String(m.barcodePrefix) : '', String(its.reduce((a, i) => a + (i.quantity || 1), 0))] };
    }),
    truncated, cols: ['שם', 'קוד', 'כמות פריטים'],
  };
}

/* ---------------- עובדים ---------------- */
async function employees(p, flags) {
  const AND = [];
  const a = has(flags, 'em_active'), b = has(flags, 'em_inactive');
  // כמו /employees: ברירת המחדל "פעילים"; שני הסימונים = הכל
  if (a && b) { /* הכל */ } else if (b) AND.push({ isActive: false }); else AND.push({ isActive: true });
  const like = (v) => ({ contains: v, mode: 'insensitive' });
  if (s(p.first)) AND.push({ firstName: like(s(p.first)) });
  if (s(p.last)) AND.push({ lastName: like(s(p.last)) });
  if (s(p.phone)) AND.push({ OR: [{ phone1: like(s(p.phone)) }, { phone2: like(s(p.phone)) }] });
  if (s(p.city)) AND.push({ city: like(s(p.city)) });
  if (s(p.email)) AND.push({ email: like(s(p.email)) });
  const list = await prisma.employee.findMany({
    where: { AND }, take: LIMIT + 1,
    orderBy: [{ lastName: { sort: 'asc', nulls: 'last' } }, { firstName: { sort: 'asc', nulls: 'last' } }],
    select: { id: true, firstName: true, lastName: true, fullName: true, phone1: true, city: true, street: true, houseNum: true, email: true },
  });
  const truncated = list.length > LIMIT;
  return {
    rows: list.slice(0, LIMIT).map((e) => {
      const st = [e.street, e.houseNum].filter(Boolean).join(' ');
      return { link: `/employees/${e.id}`, cells: [e.fullName || [e.firstName, e.lastName].filter(Boolean).join(' '), e.phone1 || '', st && e.city ? `${st}, ${e.city}` : (st || e.city || ''), e.email || ''], nameRev: fullNameRev(e) };
    }),
    truncated, cols: ['שם', 'טלפון', 'כתובת מלאה', 'מייל'],
  };
}

const GATE = { deliveries: 'page:deliveries', alterations: 'page:alterations', finance: 'page:refunds', capacity: 'page:orders', models: 'page:dresses_catalog' };

export async function GET(request) {
  if (!(await checkAuth())) return json({ error: 'Unauthorized' }, 401);
  try {
    const sp = new URL(request.url).searchParams;
    const p = Object.fromEntries(sp.entries());
    const focus = s(p.focus);
    const flags = s(p.flags).split(',').filter(Boolean);
    const ost = s(p.ost).split(',').filter(Boolean);
    const gaps = new Set();

    // אותם שערי הרשאה כמו הדפים החיים
    if (focus === 'employees') {
      if (!(await checkPageAccess(HEAD_MANAGEMENT_ROLES))) return json({ error: 'Forbidden' }, 403);
    } else if (GATE[focus]) {
      if (!(await canOpenPage(GATE[focus]))) return json({ error: 'Forbidden' }, 403);
      if (focus === 'models' && !(await checkPageAccess([0, 1, 2]))) return json({ error: 'Forbidden' }, 403); // דגמים: מנהלים בלבד (כמו advIsMgr באב-טיפוס)
    } else return json({ error: 'תחום לא מוכר' }, 400);

    let r;
    if (focus === 'deliveries') r = await deliveries(p, flags, ost, gaps);
    else if (focus === 'alterations') r = await alterations(p, flags, ost, gaps);
    else if (focus === 'finance') r = await finance(p, flags, gaps);
    else if (focus === 'capacity') r = await capacity(p, request, gaps);
    else if (focus === 'models') r = await models(p, flags, gaps);
    else r = await employees(p, flags);
    if (r.error) return json({ error: r.error }, r.status || 400);

    const rows = r.rows || [];
    return json({
      cols: r.cols || [],
      rows: rows.map((x) => x.cells),
      links: rows.map((x) => x.link),
      al: [],
      namesRev: rows.map((x) => x.nameRev || ''),
      ...(r.capstats ? { capstats: r.capstats } : {}),
      // תפוסה: ברקוד השמלה לכל שורה - רק כשהשמלה כבר יצאה למשפחה, אחרת מחרוזת ריקה (לא ממציאים ברקוד; דיווח 113e5c37). מערך נפרד, לא עמודה: מבנה העמודות והשורות לא משתנה
      ...(focus === 'capacity' ? { barcodes: rows.map((x) => x.barcode || '') } : {}),
      truncated: !!r.truncated,
      gaps: [...gaps],
    });
  } catch (error) {
    console.error('GET /api/a5/adv-b error:', error);
    return json({ error: 'שגיאה בחיפוש המתקדם' }, 500);
  }
}
