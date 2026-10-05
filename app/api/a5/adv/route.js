import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { canOpenPage } from '@/lib/permissions';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { normalizeEmail } from '@/lib/emailUtils';
import { buildMultiWordRelationNameCondition, buildMultiWordNameCondition } from '@/lib/searchUtils';
import { getHebrewDateString, getIsraelDayRange, HEBREW_DAYS } from '@/lib/hebrewDate';
import { calculateOrderStatus } from '@/lib/orderStatus';
import { getLateReturnInfo, getExpectedReturnKey, LATE_RETURN_THRESHOLD_DAYS } from '@/lib/lateReturn';
import { NON_WORKING_DAYS_SETTING_KEY, parseNonWorkingDaysSetting, inverseBusinessDays, rolledSourceRange } from '@/lib/businessDays';
import { missingRule, customerMissing, customerMissingWhere } from '@/lib/customerMissing';
import { DRAFT_ORDER_STATUS } from '@/lib/orderReservation';

// חיפוש מתקדם (A5) — תחומים: לקוחות, הזמנות, השכרות, החזרות. קריאה בלבד.
// אותם כללים כמו העמודים החיים: /api/customers, /api/orders (advOrderId/customerName/...,
// activeOnly/returnedOnly/partially*Only, filterStatus soon/archive/deleted), /api/orders/overdue
// (getLateReturnInfo), דגל חובות = totalPaid < totalAmount, זיכוי = calculatePaymentStatus.
// ראו public/a5/adapters/adv-a.NOTES.md.
export const dynamic = 'force-dynamic';

const MAX_ROWS = 200;
// Upper bound on the candidate rows loaded when a status can only be decided in JS ("התראה",
// rs_/rt_ late/today/tomorrow). Without it, ticking such a status together with a broad one
// (e.g. rt_all) pulled every non-deleted order with its items and customer into memory - measured
// 61s on the TEST copy of the data - which on Vercel is a function timeout and on Neon burns the
// shared compute quota. Newest events first, so the cut only ever drops the oldest candidates;
// the response says `truncated` when it happened.
const JS_SCAN_MAX = 3000;
const ARR = (v) => (Array.isArray(v) ? v : []);
const S = (v) => (typeof v === 'string' ? v.trim() : '');

const gershay = (str) => (str.length > 1 ? str.slice(0, -1) + '״' + str.slice(-1) : str + '׳');
// "ט״ו תשרי" — תאריך עברי בלי שנה (כמו eventDateHebrew ללא שנה) לפי חוזה החיפוש המתקדם
function hebShort(date) {
  if (!date) return '';
  const full = getHebrewDateString(date); // "טו תשרי תשפ״ז" או "אדר א' תשפ״ו"
  if (!full) return '';
  const parts = full.split(' ');
  parts.pop(); // שנה
  const day = parts.shift();
  const idx = HEBREW_DAYS.indexOf(day);
  const dayG = idx > 0 ? (day.length === 1 ? day + '׳' : gershay(day)) : day;
  return [dayG, ...parts].join(' ').trim();
}

const ilKey = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
const addKey = (key, n) => { const [y, m, d] = key.split('-').map(Number); const x = new Date(Date.UTC(y, m - 1, d + n)); return x.toISOString().slice(0, 10); };
const dayRange = (key) => getIsraelDayRange(key);
const validIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

function fmtPhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length === 9) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return String(p || '').trim();
}
const fullName = (c) => (c ? `${c.firstName || ''} ${c.lastName || ''}`.trim() : '');
// שם משפחה לפני שם פרטי - לתצוגה טבלאית בלבד (C-1.8); לא מפצלים את fullName בצד הלקוח, מקור נפרד מהשדות הגולמיים
const fullNameRev = (c) => (c ? `${c.lastName || ''} ${c.firstName || ''}`.trim() : '');
const fullAddress = (c) => {
  if (!c) return '';
  const street = [c.street, c.houseNum].filter((x) => x !== null && x !== undefined && String(x).trim() !== '').join(' ');
  return [street, c.city].filter((x) => x && String(x).trim()).join(', ');
};

const ALT_COND = {
  OR: [
    { neckAlteration: { gt: 0 } },
    { sleeveAlteration: { gt: 0 } },
    { AND: [{ lengthAlteration: { not: null } }, { lengthAlteration: { notIn: ['', 'null', '0'] } }] },
  ],
};

// ---- חוסר פרטי לקוח: lib/customerMissing.js (משותף גם ל-/api/a5/adv-alerts) ----

// ---- תנאי לקוח משותפים (שם / טלפון / פרטי לקוח / עיר) ----
function personConds(adv, rel) {
  // rel: null = על ישות הלקוח עצמה; 'customer' = על הזמנה
  const wrap = (c) => (rel ? { [rel]: c } : c);
  const out = [];
  const name = S(adv.name);
  if (name) {
    const multi = rel
      ? buildMultiWordRelationNameCondition(name, rel, 'firstName', 'lastName')
      : buildMultiWordNameCondition(name, 'firstName', 'lastName');
    out.push({ OR: [wrap({ firstName: { contains: name } }), wrap({ lastName: { contains: name } }), ...(multi ? [multi] : [])] });
  }
  const first = S(adv.first); if (first) out.push(wrap({ firstName: { contains: first } }));
  const last = S(adv.last); if (last) out.push(wrap({ lastName: { contains: last } }));
  const phone = S(adv.phone);
  if (phone) {
    const p = phone.replace(/[\s-]/g, '');
    out.push(wrap({ OR: [{ phone1: { contains: p } }, { phone2: { contains: p } }] }));
  }
  const city = S(adv.city); if (city) out.push(wrap({ city: { contains: city } }));
  const email = S(adv.email); if (email) out.push(wrap({ email: { contains: email } }));
  const cinfo = S(adv.cinfo);
  if (cinfo) {
    const p = cinfo.replace(/[\s-]/g, '');
    out.push(wrap({
      OR: [
        { email: { contains: cinfo } }, { city: { contains: cinfo } }, { street: { contains: cinfo } },
        { phone1: { contains: p } }, { phone2: { contains: p } },
      ],
    }));
  }
  const addr = S(adv.addr);
  if (addr) out.push(wrap({ OR: [{ city: { contains: addr } }, { street: { contains: addr } }] }));
  return out;
}

async function loadCfg() {
  const all = await getAllCachedSettings().catch(() => []);
  const m = {};
  for (const s of all) m[s.key] = s.value;
  return m;
}

// מזהי הזמנות עם חוב / זיכוי: אותו חישוב כמו רשימת ההזמנות (totalAmount מול סכום תשלומים לא מחוקים)
async function debtCreditIds() {
  const rows = await prisma.$queryRaw`
    SELECT x."orderId", x."customerId", x.t, x.paid FROM (
      SELECT o."orderId", o."customerId", COALESCE(o."totalAmount",0) AS t,
             COALESCE(SUM(p."amount") FILTER (WHERE p."isDeleted" = false), 0) AS paid
      FROM "Order" o LEFT JOIN "Payment" p ON p."orderId" = o."orderId"
      WHERE o."isDeleted" = false
      GROUP BY o."orderId", o."customerId", o."totalAmount"
    ) x
    WHERE (x.t > 0 AND x.paid < x.t) OR (x.t > 0 AND x.paid > x.t) OR (x.paid > 0 AND x.t = 0)`;
  const debt = [], credit = [], debtCust = new Set(), creditCust = new Set();
  for (const r of rows) {
    const t = Number(r.t), paid = Number(r.paid);
    if (t > 0 && paid < t) { debt.push(r.orderId); if (r.customerId) debtCust.add(r.customerId); }
    else { credit.push(r.orderId); if (r.customerId) creditCust.add(r.customerId); }
  }
  return { debt, credit, debtCust: [...debtCust], creditCust: [...creditCust] };
}

async function paidMap(ids) {
  if (!ids.length) return new Map();
  const g = await prisma.payment.groupBy({ by: ['orderId'], where: { orderId: { in: ids }, isDeleted: false }, _sum: { amount: true } });
  return new Map(g.map((x) => [x.orderId, x._sum.amount || 0]));
}

const ORDER_SELECT = {
  orderId: true, status: true, isDeleted: true, eventDate: true, eventDateHebrew: true, fromDate: true, toDate: true,
  returnDate: true, totalAmount: true, customSpacing: true, isDelivery: true, customerId: true,
  customer: { select: { firstName: true, lastName: true, phone1: true, phone2: true, email: true, city: true, street: true, houseNum: true } },
  items: { select: { isDeleted: true, isTaken: true, isReturned: true } },
};

const soonSql = (cfg) => ({
  AND: [
    { isDeleted: false },
    { OR: [{ eventDate: null }, { eventDate: { gte: dayRange(ilKey(new Date())).start } }] },
    // אותו כלל של טאב "בקרוב" ב-/orders: כשההגדרה פעילה הזמנה שכל פריטיה נלקחו עברה ל-/rentals
    ...(cfg.hide_taken_orders_from_orders_list === 'true' ? [{ items: { some: { isDeleted: false, isTaken: false } } }] : []),
  ],
});

// ---- שורת הזמנה: מצב התראה (פרטים חסרים / לא חזר / ציפוף / לא שולם / שינויים שלא נשמרו) ----
function orderAlerts(o, ctx) {
  const list = [];
  if (customerMissing(o.customer, ctx.rule)) list.push('פרטים חסרים');
  const late = getLateReturnInfo(o, ctx.threshold, { nonWorkingDays: ctx.nonWorkingDays });
  const active = (o.items || []).filter((i) => !i.isDeleted);
  if (late.isLate && active.some((i) => i.isTaken && !i.isReturned)) list.push('לא חזר');
  if (ctx.packingOn && o.customSpacing !== null && o.customSpacing !== undefined) list.push('ציפוף');
  const total = o.totalAmount || 0, paid = ctx.paid.get(o.orderId) || 0;
  if (total > 0 && paid < total) list.push('לא שולם');
  if (ctx.unsaved.has(o.orderId)) list.push('שינויים שלא נשמרו');
  return list;
}

function ctxFor(cfg, paid, unsaved) {
  return {
    rule: missingRule(cfg),
    threshold: Number(cfg.late_return_threshold_days) || LATE_RETURN_THRESHOLD_DAYS,
    // הכלל האחיד "יום לא עובד" (lib/businessDays.js) למועד ההחזרה הצפוי של getLateReturnInfo
    nonWorkingDays: parseNonWorkingDaysSetting(cfg[NON_WORKING_DAYS_SETTING_KEY] ?? null),
    packingOn: cfg.packing_enabled === 'true' && cfg.hide_custom_spacing !== 'true',
    paid, unsaved,
  };
}

// ---- תנאי הזמנה משותפים: מספר, תאריכי אירוע, לקוח, עובד, פריט/דגם/מידה ----
function orderCommonConds(adv, focus) {
  const c = [];
  const oid = parseInt(S(adv.oid), 10);
  if (S(adv.oid)) c.push(isNaN(oid) ? { orderId: -1 } : { orderId: oid });
  if (validIso(adv.from) || validIso(adv.to)) {
    c.push({
      eventDate: {
        ...(validIso(adv.from) ? { gte: dayRange(adv.from).start } : {}),
        ...(validIso(adv.to) ? { lte: dayRange(adv.to).end } : {}),
      },
    });
  }
  c.push(...personConds(adv, 'customer').map((x) => x));
  const emp = S(adv.emp);
  if (emp) {
    const multiEmp = buildMultiWordRelationNameCondition(emp, 'employee', 'firstName', 'lastName');
    c.push({
      OR: [
        { employee: { OR: [{ firstName: { contains: emp } }, { lastName: { contains: emp } }, { fullName: { contains: emp } }] } },
        ...(multiEmp ? [multiEmp] : []),
      ],
    });
  }
  const item = S(adv.item), model = S(adv.model), size = S(adv.size);
  const itemAnd = [];
  if (item) {
    // בהשכרות/החזרות "ברקוד"; בהזמנות "ברקוד/פרטי פריט" (כמו itemDetails ב-/api/orders)
    itemAnd.push(focus === 'orders'
      ? { OR: [{ barcode: { contains: item } }, { description: { contains: item } }, { dressItem: { dress: { name: { contains: item } } } }] }
      : { barcode: { contains: item } });
  }
  if (model) {
    const asInt = parseInt(model, 10);
    itemAnd.push({
      OR: [
        { dressItem: { dress: { name: { contains: model } } } },
        ...(!isNaN(asInt) && String(asInt) === model ? [{ barcodePrefix: asInt }, { dressItem: { dress: { barcodePrefix: asInt } } }] : []),
      ],
    });
  }
  if (size) itemAnd.push({ OR: [{ sizeText: { contains: size } }, { dressItem: { sizeText: { contains: size } } }] });
  if (itemAnd.length) c.push({ items: { some: { AND: [{ isDeleted: false }, ...itemAnd] } } });
  return c;
}

function eventHeb(o) {
  const d = o.eventDate || o.fromDate;
  return d ? hebShort(d) : '';
}

const chip = (t, cls) => (cls ? [t, cls] : t);

// ===================== לקוחות =====================
async function focusCustomers(adv, cfg) {
  const conds = [{ isDeleted: false }, ...personConds(adv, null)];
  const flags = ARR(adv.flags);
  const rule = missingRule(cfg);
  const fl = [];
  let ids = null;
  if (flags.includes('debts') || flags.includes('credits')) ids = await debtCreditIds();
  if (flags.includes('debts')) fl.push({ id: { in: ids.debtCust } });
  if (flags.includes('credits')) fl.push({ id: { in: ids.creditCust } });
  if (flags.includes('badreturn')) fl.push({ orders: { some: { isDeleted: false, items: { some: { isDeleted: false, isReturned: true, returnedOk: false } } } } });
  if (flags.includes('nodetails')) fl.push(customerMissingWhere(rule));
  if (fl.length) conds.push({ OR: fl });

  const [rows, total] = await Promise.all([
    prisma.customer.findMany({
      where: { AND: conds },
      orderBy: [{ legacyId: { sort: 'desc', nulls: 'last' } }],
      take: MAX_ROWS + 1,
      select: { id: true, firstName: true, lastName: true, phone1: true, phone2: true, city: true, street: true, houseNum: true, email: true, emailSuffix: true },
    }),
    prisma.customer.count({ where: { AND: conds } }),
  ]);
  const truncated = rows.length > MAX_ROWS;
  const page = rows.slice(0, MAX_ROWS);
  const al = [];
  const out = page.map((c, i) => {
    if (customerMissing(c, rule)) al.push(i);
    return [fullName(c), fmtPhone(c.phone1 || c.phone2), fullAddress(c), normalizeEmail(c.email, c.emailSuffix) || ''];
  });
  return { cols: ['שם', 'טלפון', 'כתובת מלאה', 'מייל'], rows: out, links: page.map((c) => `/customers/${c.id}`), al, truncated, total, namesRev: page.map((c) => fullNameRev(c)) };
}

// ===================== הזמנות =====================
function orderStatusChip(o, todayKey, tomorrowKey) {
  const st = calculateOrderStatus(o);
  const key = o.eventDate ? ilKey(new Date(o.eventDate)) : null;
  switch (st) {
    case 'בקרוב':
      if (key === todayKey) return chip('היום', 'st-today');
      if (key === tomorrowKey) return chip('מחר', 'st-soon');
      return chip('בקרוב', 'st-soon');
    case 'עבר': return chip('עבר', 'st-bad');
    case 'הושכר': return chip('הושכר', 'st-good');
    case 'הושכר חלקי': return chip('הושכר חלקי', 'st-mid');
    case 'הוחזר': return chip('הוחזר', 'st-good');
    case 'הוחזר חלקי': return chip('הוחזר חלקי', 'st-mid');
    case 'מחוק': return chip('מחוק', 'st-bad');
    default: return chip(st, 'st-mid'); // טיוטה
  }
}

async function focusOrders(adv, cfg, unsavedIds) {
  const ost = ARR(adv.ost), flags = ARR(adv.flags);
  const todayRange = dayRange(ilKey(new Date()));
  const unsaved = new Set(unsavedIds);
  const conds = [...orderCommonConds(adv, 'orders')];
  let ids = null;
  const needIds = flags.some((f) => f === 'debts' || f === 'credits') || ost.includes('alert');
  if (needIds) ids = await debtCreditIds();

  // סטטוס הזמנה: בקרוב/ארכיון/מושכר/מוחזר/מחוק/התראה (או בין הבחירות); ללא בחירה = כל ההזמנות שלא נמחקו
  const rule = missingRule(cfg);
  const threshold = Number(cfg.late_return_threshold_days) || LATE_RETURN_THRESHOLD_DAYS;
  const alertPrefilter = ost.includes('alert') ? [
    { AND: [{ isDeleted: false }, customerMissingWhere(rule).OR ? { customer: customerMissingWhere(rule) } : {}] },
    { AND: [{ isDeleted: false }, { items: { some: { isDeleted: false, isTaken: true, isReturned: false } } }, { OR: [{ toDate: { lte: new Date(Date.now() - (threshold - 1) * 86400000) } }, { returnDate: { lte: new Date(Date.now() - (threshold - 1) * 86400000) } }, { AND: [{ toDate: null }, { returnDate: null }, { eventDate: { lte: new Date(Date.now() - (threshold - 1) * 86400000) } }] }] }] },
    { AND: [{ isDeleted: false }, { orderId: { in: [...ids.debt, ...unsaved] } }] },
    ...(cfg.packing_enabled === 'true' && cfg.hide_custom_spacing !== 'true' ? [{ AND: [{ isDeleted: false }, { customSpacing: { not: null } }] }] : []),
  ] : [];
  if (ost.length) {
    const g = [];
    if (ost.includes('soon')) g.push(soonSql(cfg));
    if (ost.includes('archive')) g.push({ AND: [{ isDeleted: false }, { eventDate: { lt: todayRange.start } }] });
    if (ost.includes('rented')) g.push({ AND: [{ isDeleted: false }, { items: { some: { isDeleted: false, isTaken: true, isReturned: false } } }] });
    if (ost.includes('returned')) g.push({ AND: [{ isDeleted: false }, { items: { some: { isDeleted: false, isReturned: true } } }] });
    if (ost.includes('deleted')) g.push(cfg.draft_orders_show_as_deleted === 'true' ? { OR: [{ isDeleted: true }, { status: DRAFT_ORDER_STATUS }] } : { isDeleted: true });
    if (ost.includes('alert')) g.push(...alertPrefilter);
    conds.push({ OR: g });
  } else {
    conds.push({ isDeleted: false });
  }

  // דרוש בדיקה (OR פנימי): חובות / זיכויים / לא נשמר / אין בסניף
  const chk = [];
  if (flags.includes('debts')) chk.push({ orderId: { in: ids.debt } });
  if (flags.includes('credits')) chk.push({ orderId: { in: ids.credit } });
  if (flags.includes('unsaved')) chk.push({ orderId: { in: [...unsaved] } });
  if (flags.includes('nobranch')) chk.push(cfg.branches_enabled === 'true' ? { OR: [{ branch: null }, { branch: '' }] } : { orderId: -1 });
  if (chk.length) conds.push({ OR: chk });
  // פרטי אירוע (OR פנימי): חו״ל / תפוסה ארוכה / ציפוף / משלוח / תיקונים
  const ev = [];
  if (flags.includes('abroad')) ev.push({ isAbroad: true });
  if (flags.includes('packing')) {
    const days = parseInt(S(adv.days), 10);
    ev.push(cfg.hide_custom_spacing === 'true' ? { orderId: -1 } : { customSpacing: isNaN(days) ? { not: null } : days });
  }
  if (flags.includes('delivery')) ev.push({ isDelivery: true });
  if (flags.includes('repairs')) ev.push({ items: { some: { isDeleted: false, ...ALT_COND } } });
  if (ev.length) conds.push({ OR: ev });
  if (flags.includes('itRepairs')) conds.push({ items: { some: { isDeleted: false, ...ALT_COND } } });

  const where = { AND: conds };
  const orderBy = [{ eventDate: { sort: 'desc', nulls: 'last' } }];
  const jsFilter = ost.includes('alert');
  let rows, total = null, scanTruncated = false;
  if (jsFilter) {
    rows = await prisma.order.findMany({ where, orderBy, take: JS_SCAN_MAX + 1, select: ORDER_SELECT });
    scanTruncated = rows.length > JS_SCAN_MAX;
    rows = rows.slice(0, JS_SCAN_MAX);
  } else [rows, total] = await Promise.all([prisma.order.findMany({ where, orderBy, take: MAX_ROWS + 1, select: ORDER_SELECT }), prisma.order.count({ where })]);

  const paid = await paidMap(rows.map((o) => o.orderId));
  const ctx = ctxFor(cfg, paid, unsaved);
  if (jsFilter) {
    // "התראה" מחושבת לכל שורה; שאר הבחירות ב-ost (או) נבדקות במקביל
    const today = todayRange.start;
    rows = rows.filter((o) => {
      if (orderAlerts(o, ctx).length) return true;
      if (ost.includes('soon') && !o.isDeleted && (!o.eventDate || new Date(o.eventDate) >= today)) return true;
      if (ost.includes('archive') && !o.isDeleted && o.eventDate && new Date(o.eventDate) < today) return true;
      const act = (o.items || []).filter((i) => !i.isDeleted);
      if (ost.includes('rented') && !o.isDeleted && act.some((i) => i.isTaken && !i.isReturned)) return true;
      if (ost.includes('returned') && !o.isDeleted && act.some((i) => i.isReturned)) return true;
      if (ost.includes('deleted') && o.isDeleted) return true;
      return false;
    });
  }
  if (total === null) total = rows.length;
  const truncated = rows.length > MAX_ROWS || scanTruncated;
  const page = rows.slice(0, MAX_ROWS);
  const todayKey = ilKey(new Date()), tomorrowKey = addKey(todayKey, 1);
  const al = [];
  const out = page.map((o, i) => {
    if (orderAlerts(o, ctx).length) al.push(i);
    return [fullName(o.customer), eventHeb(o), orderStatusChip(o, todayKey, tomorrowKey), fmtPhone(o.customer?.phone1 || o.customer?.phone2)];
  });
  return { cols: ['שם', 'תאריך אירוע', 'סטטוס', 'טלפון'], rows: out, links: page.map((o) => `/orders/${o.orderId}`), al, truncated, total, namesRev: page.map((o) => fullNameRev(o.customer)) };
}

// ===================== השכרות / החזרות =====================
// מועד ההחזרה הצפוי = אותו כלל כמו דגל "איחור" (getLateReturnInfo): יום העבודה הראשון אחרי האירוע.
const dueDate = (o, nonWorkingDays) => getExpectedReturnKey(o, nonWorkingDays);

async function focusRentRet(adv, cfg, unsavedIds, kind) {
  const ret = kind === 'returns';
  const ost = ARR(adv.ost), flags = ARR(adv.flags);
  const unsaved = new Set(unsavedIds);
  const todayKey = ilKey(new Date()), tomorrowKey = addKey(todayKey, 1);
  const threshold = Number(cfg.late_return_threshold_days) || LATE_RETURN_THRESHOLD_DAYS;
  const nonWorkingDays = parseNonWorkingDaysSetting(cfg[NON_WORKING_DAYS_SETTING_KEY] ?? null);
  const P = ret ? 'rt_' : 'rs_';
  const conds = [
    { isDeleted: false },
    { OR: [{ status: null }, { status: { not: DRAFT_ORDER_STATUS } }] },
    ret ? { items: { some: { isDeleted: false, OR: [{ isTaken: true }, { isReturned: true }] } } } : { items: { some: { isDeleted: false } } },
    ...orderCommonConds(adv, kind),
  ];
  // תאריך השכרה / החזרה (של פריט)
  if (validIso(adv.rdate)) {
    const r = dayRange(adv.rdate);
    conds.push({ items: { some: { isDeleted: false, [ret ? 'returnDate' : 'takenDate']: { gte: r.start, lte: r.end } } } });
  }

  // סטטוס (או בין הבחירות)
  const anyItemsOut = { items: { some: { isDeleted: false, isTaken: true, isReturned: false } } };
  const cutoff = new Date(Date.now() - (threshold - 1) * 86400000);
  const lateSql = { AND: [anyItemsOut, { OR: [{ toDate: { lte: cutoff } }, { returnDate: { lte: cutoff } }, { AND: [{ toDate: null }, { returnDate: null }, { eventDate: { lte: cutoff } }] }] }] };
  // אירועים שמועד ההחזרה הצפוי שלהם (יום העבודה הראשון אחריהם) הוא key - חלון נגזר מההופכי של הכלל והרשימה
  // הנוכחיים (לא מספר ימים קבוע), כדי שימים סגורים ביומן לא יפילו הזמנות בשקט; בנוסף לרצפה של 7 ימים אחורה.
  const dueEventStart = (key) => { const inv = inverseBusinessDays(key, 1, nonWorkingDays); const floor = addKey(key, -7); return inv && inv.startKey < floor ? inv.startKey : floor; };
  // תאריך מפורש (toDate/returnDate) שנופל על יום סגור מתגלגל ליום העובד הבא (getExpectedReturnKey, החלטת הבעלים
  // 2.10.2026), לכן חלון ה-SQL שלו = היום + רצף הימים הסגורים שלפניו (rolledSourceRange: ראשון אוסף את שישי ושבת;
  // אותו חלון כמו שלב 8 בלו״ז); ביום סגור אין סעיף כזה בכלל - שום החזרה לא נוחתת עליו. הסינון המדויק ב-JS.
  const dueWindow = (key) => {
    const explicitWin = rolledSourceRange(key, nonWorkingDays);
    return {
      OR: [
        { eventDate: { gte: dayRange(dueEventStart(key)).start, lte: dayRange(key).end } },
        ...(explicitWin ? [
          { toDate: { gte: dayRange(explicitWin.startKey).start, lte: dayRange(explicitWin.endKey).end } },
          { returnDate: { gte: dayRange(explicitWin.startKey).start, lte: dayRange(explicitWin.endKey).end } },
        ] : []),
      ],
    };
  };
  const stSql = [];
  const jsPreds = [];
  const active = (o) => (o.items || []).filter((i) => !i.isDeleted);
  if (ost.includes(P + 'today')) {
    if (ret) { stSql.push({ AND: [anyItemsOut, dueWindow(todayKey)] }); jsPreds.push((o) => active(o).some((i) => i.isTaken && !i.isReturned) && dueDate(o, nonWorkingDays) === todayKey); }
    else { stSql.push({ AND: [{ eventDate: { gte: dayRange(todayKey).start, lte: dayRange(todayKey).end } }, { items: { some: { isDeleted: false, isTaken: false } } }] }); }
  }
  if (ost.includes(P + 'tomorrow')) {
    if (ret) { stSql.push({ AND: [anyItemsOut, dueWindow(tomorrowKey)] }); jsPreds.push((o) => active(o).some((i) => i.isTaken && !i.isReturned) && dueDate(o, nonWorkingDays) === tomorrowKey); }
    else { stSql.push({ AND: [{ eventDate: { gte: dayRange(tomorrowKey).start, lte: dayRange(tomorrowKey).end } }, { items: { some: { isDeleted: false, isTaken: false } } }] }); }
  }
  if (ost.includes(P + 'partial')) {
    if (ret) stSql.push({ AND: [{ items: { some: { isDeleted: false, isReturned: true } } }, { items: { some: { isDeleted: false, isReturned: false } } }] });
    else stSql.push({ AND: [{ items: { some: { isDeleted: false, isTaken: true } } }, { items: { some: { isDeleted: false, isTaken: false } } }, { items: { none: { isDeleted: false, isReturned: true } } }] });
  }
  if (ost.includes(P + 'all')) {
    if (ret) stSql.push({ AND: [{ items: { some: { isDeleted: false } } }, { items: { none: { isDeleted: false, isReturned: false } } }] });
    else stSql.push({ AND: [{ items: { some: { isDeleted: false } } }, { items: { none: { isDeleted: false, isTaken: false } } }, { items: { none: { isDeleted: false, isReturned: true } } }] });
  }
  if (ost.includes(P + 'late')) { stSql.push(lateSql); jsPreds.push((o) => getLateReturnInfo(o, threshold, { nonWorkingDays }).isLate && active(o).some((i) => i.isTaken && !i.isReturned)); }
  if (stSql.length) conds.push({ OR: stSql });

  // דרוש בדיקה (OR): בסניף אחר / החזרה מאירוע אחר / חסר במלאי / חוב
  const chk = [];
  let ids = null;
  if (flags.includes('rc_debt')) { ids = await debtCreditIds(); chk.push({ orderId: { in: ids.debt } }); }
  if (flags.includes('rc_branch')) {
    const r = await prisma.$queryRaw`SELECT "orderId" FROM "Order" WHERE "isDeleted" = false AND "branch" IS NOT NULL AND "branch" <> '' AND "pickupBranch" IS NOT NULL AND "pickupBranch" <> '' AND "pickupBranch" <> "branch"`;
    chk.push({ orderId: { in: r.map((x) => x.orderId) } });
  }
  const unsupported = flags.filter((f) => f === 'rc_other' || f === 'rc_stock'); // אין מקור נתונים - ר' GAPS
  if (chk.length || unsupported.length) conds.push({ OR: chk.length ? chk : [{ orderId: -1 }] });

  const where = { AND: conds };
  const orderBy = [{ eventDate: { sort: 'desc', nulls: 'last' } }];
  const jsFilter = jsPreds.length > 0;
  let rows, total = null, scanTruncated = false;
  if (jsFilter) {
    rows = await prisma.order.findMany({ where, orderBy, take: JS_SCAN_MAX + 1, select: ORDER_SELECT });
    scanTruncated = rows.length > JS_SCAN_MAX;
    rows = rows.slice(0, JS_SCAN_MAX);
  } else [rows, total] = await Promise.all([prisma.order.findMany({ where, orderBy, take: MAX_ROWS + 1, select: ORDER_SELECT }), prisma.order.count({ where })]);
  if (jsFilter) {
    // הסינון המדויק (איחור / מועד החזרה עם דילוג שישי-שבת) ב-JS; מצבי הסטטוס שנבדקו ב-SQL מדויקים ולכן עוברים בלי JS
    const sqlOnly = (o) => {
      const a = active(o);
      if (ost.includes(P + 'partial')) { if (ret ? (a.some((i) => i.isReturned) && a.some((i) => !i.isReturned)) : (a.some((i) => i.isTaken) && a.some((i) => !i.isTaken) && !a.some((i) => i.isReturned))) return true; }
      if (ost.includes(P + 'all')) { if (ret ? (a.length && a.every((i) => i.isReturned)) : (a.length && a.every((i) => i.isTaken) && !a.some((i) => i.isReturned))) return true; }
      if (!ret && (ost.includes('rs_today') || ost.includes('rs_tomorrow'))) {
        const k = o.eventDate ? ilKey(new Date(o.eventDate)) : null;
        if (a.some((i) => !i.isTaken) && ((ost.includes('rs_today') && k === todayKey) || (ost.includes('rs_tomorrow') && k === tomorrowKey))) return true;
      }
      return false;
    };
    rows = rows.filter((o) => sqlOnly(o) || jsPreds.some((f) => f(o)));
  }
  if (total === null) total = rows.length;
  const truncated = rows.length > MAX_ROWS || scanTruncated;
  const page = rows.slice(0, MAX_ROWS);
  const paid = await paidMap(page.map((o) => o.orderId));
  const ctx = ctxFor(cfg, paid, unsaved);
  const al = [];
  const out = page.map((o, i) => {
    if (orderAlerts(o, ctx).length) al.push(i);
    const a = active(o), n = a.length, taken = a.filter((x) => x.isTaken).length, back = a.filter((x) => x.isReturned).length;
    const late = getLateReturnInfo(o, threshold, { nonWorkingDays }).isLate && a.some((x) => x.isTaken && !x.isReturned);
    const evKey = o.eventDate ? ilKey(new Date(o.eventDate)) : null;
    let st;
    if (ret) {
      const due = dueDate(o, nonWorkingDays);
      if (n > 0 && back === n) st = chip(`הוחזר הכל · ${n} מתוך ${n}`, 'st-good');
      else if (back > 0) st = chip(`הוחזר חלקי · ${back} הוחזרו מתוך ${n}`, 'st-mid');
      else if (late) st = chip(`איחור · 0 הוחזרו מתוך ${n}`, 'st-bad');
      else if (due === todayKey) st = chip(`היום · 0 מתוך ${n}`, 'st-today');
      else if (due === tomorrowKey) st = chip(`מחר · 0 מתוך ${n}`, 'st-soon');
      else if (due && due < todayKey) st = chip(`לא הוחזר · 0 הוחזרו מתוך ${n}`, 'st-bad');
      else st = chip(`מושכר · 0 הוחזרו מתוך ${n}`, 'st-mid');
    } else {
      if (n > 0 && back === n) st = chip(`הוחזר · ${n} מתוך ${n}`, 'st-good');
      else if (back > 0) st = chip(`הוחזר חלקי · ${back} הוחזרו מתוך ${n}`, 'st-mid');
      else if (late) st = chip(`איחור · ${taken} נלקחו מתוך ${n}`, 'st-bad');
      else if (n > 0 && taken === n) st = chip(`הושכר הכל · ${taken} מתוך ${n}`, 'st-good');
      else if (taken > 0) st = chip(`הושכר חלקי · ${taken} נלקחו מתוך ${n}`, 'st-mid');
      else if (evKey === todayKey) st = chip(`היום · 0 נלקחו מתוך ${n}`, 'st-today');
      else if (evKey === tomorrowKey) st = chip(`מחר · 0 נלקחו מתוך ${n}`, 'st-soon');
      else if (evKey && evKey < todayKey) st = chip(`לא נלקח · 0 נלקחו מתוך ${n}`, 'st-bad');
      else st = chip(`בקרוב · 0 נלקחו מתוך ${n}`, 'st-soon');
    }
    return [fullName(o.customer), eventHeb(o), st, fmtPhone(o.customer?.phone1 || o.customer?.phone2)];
  });
  return { cols: ['שם', 'תאריך אירוע', 'סטטוס', 'טלפון'], rows: out, links: page.map((o) => `/orders/${o.orderId}`), al, truncated, total, namesRev: page.map((o) => fullNameRev(o.customer)) };
}

// שער הרשאת עמוד לפי התחום - אותם מפתחות כמו adv-b/route.js ו-NAV_PAGE_KEYS ב-/api/a5/boot.
// בלי זה כל עובד מחובר היה יכול לקרוא ישירות ל-API ולקבל לקוחות/הזמנות/השכרות בלי הרשאת העמוד.
const FOCUS_PAGE = { customers: 'page:customers', orders: 'page:orders', rentals: 'page:rentals', returns: 'page:rentals' };

export async function GET(request) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const sp = new URL(request.url).searchParams;
    const focus = sp.get('focus') || '';
    let adv = {};
    try { adv = JSON.parse(sp.get('adv') || '{}') || {}; } catch { adv = {}; }
    // טיוטות "לא נשמר" נשמרות בדפדפן בלבד (localStorage); המתאם שולח את מספרי ההזמנות
    const unsavedIds = (sp.get('unsaved') || '').split(',').map((x) => parseInt(x, 10)).filter((n) => !isNaN(n)).slice(0, 500);
    if (!FOCUS_PAGE[focus]) return NextResponse.json({ error: 'תחום לא נתמך' }, { status: 400 });
    if (!(await canOpenPage(FOCUS_PAGE[focus]))) return NextResponse.json({ error: 'אין הרשאה לחיפוש בתחום זה' }, { status: 403 });
    const cfg = await loadCfg();
    let res;
    if (focus === 'customers') res = await focusCustomers(adv, cfg);
    else if (focus === 'orders') res = await focusOrders(adv, cfg, unsavedIds);
    else if (focus === 'rentals') res = await focusRentRet(adv, cfg, unsavedIds, 'rentals');
    else if (focus === 'returns') res = await focusRentRet(adv, cfg, unsavedIds, 'returns');
    else return NextResponse.json({ error: 'תחום לא נתמך' }, { status: 400 });
    return NextResponse.json(res);
  } catch (error) {
    console.error('a5 adv search error:', error);
    return NextResponse.json({ error: 'החיפוש נכשל' }, { status: 500 });
  }
}
