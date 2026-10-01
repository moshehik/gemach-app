import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth, checkPageAccess, getSessionEmployee, HEAD_MANAGEMENT_ROLES } from '@/lib/auth';
import { canOpenPage, canOpenAnyPage } from '@/lib/permissions';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { getSettingDisplayName } from '@/lib/settingsMetadata';

// הצעות לשדות הטקסט של החיפוש המתקדם ב-/a5. קריאה בלבד.
// GET /api/a5/options?key=<first|last|name|phone|city|oid|item|model|emp|size|q>&focus=<...>&typed=<טקסט>
// מחזיר { options: string[] } - עד 50, מסוננות בשרת, ממוינות א-ב (מספרים: עולה).
export const dynamic = 'force-dynamic';

const LIMIT = 50;
const POOL = 400; // מאגר מועמדים לפני מיון והחיתוך ל-50

const heSort = (a, b) => String(a).localeCompare(String(b), 'he');
const clean = (arr) => [...new Set(arr.map((v) => (v == null ? '' : String(v).trim())).filter(Boolean))];
const finish = (arr) => {
  const list = clean(arr);
  return list.length && list.every((v) => /^\d+$/.test(v))
    ? list.sort((a, b) => a - b).slice(0, LIMIT)
    : list.sort(heSort).slice(0, LIMIT);
};

// עמודת טקסט של לקוח: קודם התחלה-של, אחר כך מכיל; בלי טקסט - הנפוצים ביותר
async function customerColumn(col, typed) {
  const base = { isDeleted: false, [col]: { not: null } };
  if (!typed) {
    const rows = await prisma.customer.groupBy({ by: [col], where: base, _count: { _all: true }, orderBy: { _count: { [col]: 'desc' } }, take: LIMIT });
    return finish(rows.map((r) => r[col]));
  }
  const pick = async (mode) => (await prisma.customer.findMany({
    where: { ...base, [col]: { [mode]: typed } }, select: { [col]: true }, distinct: [col], take: POOL,
  })).map((r) => r[col]);
  const starts = clean(await pick('startsWith'));
  if (starts.length >= LIMIT) return finish(starts);
  return finish([...starts, ...(await pick('contains'))]);
}

const fullOf = (c) => [c.firstName, c.lastName].map((x) => (x || '').trim()).filter(Boolean).join(' ');

async function fullNames(typed) {
  if (!typed) {
    const rows = await prisma.customer.findMany({ where: { isDeleted: false }, orderBy: { updatedAt: 'desc' }, take: LIMIT, select: { firstName: true, lastName: true } });
    return finish(rows.map(fullOf));
  }
  const parts = typed.split(/\s+/).filter(Boolean);
  const rows = await prisma.customer.findMany({
    where: { isDeleted: false, AND: parts.map((p) => ({ OR: [{ firstName: { contains: p } }, { lastName: { contains: p } }] })) },
    select: { firstName: true, lastName: true }, take: POOL,
  });
  const all = clean(rows.map(fullOf)).filter((n) => n.includes(typed));
  const starts = all.filter((n) => n.startsWith(typed));
  return finish(starts.length >= LIMIT ? starts : all);
}

async function phones(typed) {
  const digits = typed.replace(/[^\d]/g, '');
  if (!typed) {
    const rows = await prisma.customer.findMany({ where: { isDeleted: false, phone1: { not: null } }, orderBy: { updatedAt: 'desc' }, take: LIMIT, select: { phone1: true } });
    return clean(rows.map((r) => r.phone1)).sort(heSort).slice(0, LIMIT);
  }
  if (!digits) return [];
  const rows = await prisma.customer.findMany({
    where: { isDeleted: false, OR: [{ phone1: { contains: digits } }, { phone2: { contains: digits } }] },
    select: { phone1: true, phone2: true }, take: POOL,
  });
  const all = clean(rows.flatMap((r) => [r.phone1, r.phone2])).filter((p) => p.includes(digits));
  const starts = all.filter((p) => p.startsWith(digits));
  return finish(starts.length >= LIMIT ? starts : all);
}

// מספרי הזמנה: התחלה-של (טווחים מספריים, בלי SQL גולמי)
async function orderIds(typed) {
  const base = { isDeleted: false };
  if (!typed) {
    const rows = await prisma.order.findMany({ where: base, orderBy: { orderId: 'desc' }, take: LIMIT, select: { orderId: true } });
    return finish(rows.map((r) => r.orderId));
  }
  if (!/^\d{1,7}$/.test(typed)) return [];
  const n = parseInt(typed, 10);
  const ors = [];
  for (let k = 0; typed.length + k <= 7; k++) {
    const m = 10 ** k;
    ors.push({ orderId: { gte: n * m, lt: (n + 1) * m } });
  }
  const rows = await prisma.order.findMany({ where: { ...base, OR: ors }, orderBy: { orderId: 'asc' }, take: LIMIT, select: { orderId: true } });
  return finish(rows.map((r) => r.orderId));
}

async function models(typed) {
  const where = { isDeleted: false, name: typed ? { contains: typed } : { not: null } };
  const rows = await prisma.dressModel.findMany({ where, orderBy: typed ? { name: 'asc' } : { updatedAt: 'desc' }, take: typed ? POOL : LIMIT, select: { name: true } });
  const all = clean(rows.map((r) => r.name));
  if (!typed) return finish(all);
  const starts = all.filter((n) => n.startsWith(typed));
  return finish(starts.length >= LIMIT ? starts : all);
}

async function barcodes(typed) {
  if (!typed) return [];
  const rows = await prisma.dressItem.findMany({ where: { isDeleted: false, dressBarcode: { startsWith: typed } }, select: { dressBarcode: true }, take: LIMIT });
  return clean(rows.map((r) => r.dressBarcode));
}

async function items(typed) {
  // "פריט" = ברקוד או שם דגם, כמו באב-טיפוס
  const [m, b] = await Promise.all([models(typed), barcodes(typed)]);
  return finish([...b, ...m]);
}

async function employees(typed) {
  const rows = await prisma.employee.findMany({ where: { isActive: true }, select: { id: true, firstName: true, lastName: true, fullName: true } });
  let list = rows.map((e) => ({ id: e.id, n: fullOf(e) || (e.fullName || '').trim() })).filter((e) => e.n);
  if (typed) {
    list = list.filter((e) => e.n.includes(typed));
    const starts = list.filter((e) => e.n.startsWith(typed));
    if (starts.length >= LIMIT) list = starts;
    return finish(list.map((e) => e.n));
  }
  // בלי טקסט: מי שביצע הכי הרבה הזמנות
  const top = await prisma.order.groupBy({ by: ['employeeId'], where: { isDeleted: false, employeeId: { not: null } }, _count: { _all: true }, orderBy: { _count: { employeeId: 'desc' } }, take: LIMIT });
  const rank = new Map(top.map((t, i) => [t.employeeId, i]));
  list.sort((a, b) => (rank.has(a.id) ? rank.get(a.id) : 1e9) - (rank.has(b.id) ? rank.get(b.id) : 1e9));
  return finish(list.slice(0, LIMIT).map((e) => e.n));
}

async function sizes(typed) {
  const where = { isDeleted: false, sizeText: typed ? { startsWith: typed } : { not: null } };
  const rows = await prisma.dressItem.groupBy({ by: ['sizeText'], where, _count: { _all: true }, orderBy: { _count: { sizeText: 'desc' } }, take: LIMIT });
  return finish(rows.map((r) => r.sizeText));
}

async function settingNames(typed) {
  const me = await getSessionEmployee();
  if (!me || ![0, 1, 2].includes(me.roleId)) return [];
  const rows = await getAllCachedSettings();
  return finish(rows.filter((r) => r.key).map((r) => getSettingDisplayName(r.key, r.name)).filter((n) => !typed || n.includes(typed)));
}

const SOURCES = {
  first: (t) => customerColumn('firstName', t),
  last: (t) => customerColumn('lastName', t),
  name: fullNames,
  phone: phones,
  city: (t) => customerColumn('city', t),
  oid: orderIds,
  item: items,
  model: models,
  emp: employees,
  size: sizes,
};

// שדה q הכללי (חיפוש מהיר בתוך מסך): לפי המיקוד
const FOCUS_Q = {
  alterations: [fullNames, orderIds, models],
  deliveries: [fullNames, phones, orderIds],
  models: [models],
  employees: [employees],
  settings: [settingNames],
};

// שערי הרשאה - אותם מפתחות כמו /api/a5/adv ו-/api/a5/adv-b. ההצעות מחזירות שמות/טלפונים/עיר של
// לקוחות ומספרי הזמנה אמיתיים (גם בלי טקסט: 50 האחרונים), לכן אסור לתת אותן לעובד בלי הרשאת העמוד.
// 1) לפי התחום (focus) שהחיפוש המתקדם פתוח עליו; 2) לפי סוג המידע המבוקש (key), כדי שתחום אחד
// (למשל דגמים) לא ישמש לשליפת נתוני לקוחות. תחום ריק/settings: רק שער הסוג.
const FOCUS_PAGE = {
  customers: 'page:customers', orders: 'page:orders', rentals: 'page:rentals', returns: 'page:rentals',
  deliveries: 'page:deliveries', alterations: 'page:alterations', finance: 'page:refunds',
  capacity: 'page:orders', models: 'page:dresses_catalog',
};
const CUSTOMER_KEYS = ['first', 'last', 'name', 'phone', 'city'];
const CUSTOMER_PAGES = ['page:customers', 'page:orders', 'page:rentals', 'page:deliveries', 'page:alterations', 'page:refunds'];
const ORDER_PAGES = ['page:orders', 'page:rentals', 'page:deliveries', 'page:alterations', 'page:refunds'];
const forbidden = () => NextResponse.json({ error: 'אין הרשאה להצעות בתחום זה' }, { status: 403 });

async function allowed(key, focus) {
  if (focus === 'employees') {
    if (!(await checkPageAccess(HEAD_MANAGEMENT_ROLES))) return false;
  } else if (FOCUS_PAGE[focus]) {
    if (!(await canOpenPage(FOCUS_PAGE[focus]))) return false;
  } else if (focus && focus !== 'settings') {
    return false; // תחום לא מוכר - נכשלים סגור
  }
  if (CUSTOMER_KEYS.includes(key)) return canOpenAnyPage(CUSTOMER_PAGES);
  if (key === 'oid') return canOpenAnyPage(ORDER_PAGES);
  return true;
}

export async function GET(request) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const sp = new URL(request.url).searchParams;
    const key = sp.get('key') || '';
    const focus = sp.get('focus') || '';
    const typed = (sp.get('typed') || '').trim().slice(0, 60);
    if (!(await allowed(key, focus))) return forbidden();
    let out = [];
    if (key === 'q') {
      const fns = FOCUS_Q[focus] || [];
      const lists = await Promise.all(fns.map((f) => f(typed)));
      // כל מקור תורם חלק שווה מ-50 ואז ממיינים יחד
      const share = fns.length ? Math.ceil(LIMIT / fns.length) : LIMIT;
      out = finish(lists.flatMap((l) => l.slice(0, share)));
    } else if (SOURCES[key]) {
      out = await SOURCES[key](typed);
    }
    return NextResponse.json({ options: out });
  } catch (error) {
    console.error('a5 options error:', error);
    return NextResponse.json({ error: 'Failed to load options' }, { status: 500 });
  }
}
