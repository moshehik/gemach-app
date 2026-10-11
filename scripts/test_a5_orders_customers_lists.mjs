// בדיקת יחידה לרשימות ההזמנות והלקוחות לניהול (/admin/orders-list, /admin/customers-list): מיפוי סינון -> פרמטרי API, סטטוס נגזר (תנאי ה-Prisma מול
// deriveStateKey על כל צירופי הפריטים), הסתרת אפס (חוב / זיכוי / פריטים / משלוח), גיליון הדוח, וחוזה סטטי של השערים / הרישום / התפריט.
// אין DB / דפדפן / רשת. הרצה: node scripts/test_a5_orders_customers_lists.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  ORDER_STATE_KEYS, STATE_WORD, DRAFT_STATUS, ORDER_SORT_KEYS, COMPUTED_SORTS, NATIVE_SORTS, parseOrdersListParams, stateWhere, statesWhere, deriveStateKey, resolvePeriod,
  periodRanges, payClass, debtAndCredit, stateKeyOfWord, ORDER_SNAPSHOT_SQL, buildFact, filterFacts, sortFacts, countFacts, orderRowsSql, shapeOrderRow,
} from '../lib/adminOrdersList.js';
import {
  BudgetError, BadRequestError, MAX_LIST_LIMIT, EXPORT_PAGE_LIMIT, MAX_OFFSET, MAX_EXPORT_ROWS, STATEMENT_TIMEOUT_MS, createLimiter, createDeadline, createTtlCache, errorResponse,
  isStatementTimeout, statementTimeoutSql, validatePaging, paramsKey, MSG_NARROWER, MSG_BUSY,
} from '../lib/adminListGuards.js';
import {
  parseCustomersListParams, resolveFirstPeriod, CUSTOMER_SORT_KEYS, CUSTOMER_SNAPSHOT_SQL, MASK_FIELDS, maskBit, requiredMaskOf, buildCustomerFact, filterCustomerFacts, sortCustomerFacts, countCustomerFacts,
} from '../lib/adminCustomersList.js';
import {
  buildOrderFilters, buildOrdersQuery, countsKey, orderPairs, orderRow, buildOrdersSheet, sheetFlatRows, itemsText, money, SORTS as ORDER_SORTS, DEFAULT_SORT as ORD_SORT, STATE_OPTIONS,
} from '../app/components/orders-list/ordersLogic.js';
import {
  buildCustomerFilters, buildCustomersQuery, customerPairs, buildCustomersSheet, sheetFlatRows as custFlat, SORTS as CUST_SORTS, countsKey as custCountsKey,
} from '../app/components/customers-list/customersLogic.js';
import { isOptionHidden } from '../app/components/a5-list/listLogic.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

/* ---- מפרש מינימלי של תת-הקבוצה של where ב-Prisma שבה משתמשים תנאי הסטטוס (לבדיקת התנאים מול deriveStateKey בלי DB) ---- */
function matches(where, o) {
  if (where.AND) return where.AND.every((w) => matches(w, o));
  if (where.OR) return where.OR.some((w) => matches(w, o));
  return Object.entries(where).every(([k, v]) => {
    if (k === 'items') {
      const test = (i, f) => Object.entries(f).every(([fk, fv]) => (fk === 'OR' ? fv.some((x) => test(i, x)) : i[fk] === fv));
      if (v.some) return o.items.some((i) => test(i, v.some));
      if (v.none) return !o.items.some((i) => test(i, v.none));
      throw new Error('items filter');
    }
    if (k === 'orderId') return o.orderId === v;
    const cur = o[k];
    if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
      return Object.entries(v).every(([op, ov]) => {
        if (op === 'not') return cur !== null && cur !== undefined && cur !== ov;
        if (op === 'lt') return cur !== null && cur !== undefined && cur < ov;
        if (op === 'gte') return cur !== null && cur !== undefined && cur >= ov;
        throw new Error('op ' + op);
      });
    }
    return (cur === undefined ? null : cur) === v;
  });
}

console.log('פרמטרים');
t('parseOrdersListParams: חיתוך, ברירות מחדל, מפתחות לא מוכרים נזרקים', () => {
  const p = parseOrdersListParams({ page: '0', limit: '99999', sort: 'DROP TABLE', dir: 'x', states: 'rented,bogus,rented', pays: 'debt', delivery: 'yes,no', period: 'custom', from: '2026-10-01', to: 'nope', ids: '5,x,-3,7', counts: '1', branches: 'a,b' });
  assert.equal(p.page, 1); assert.equal(p.limit, 100, 'בלי export: עד 100'); assert.equal(p.sort, 'eventDate'); assert.equal(p.dir, 'desc');
  assert.deepEqual(p.states, ['rented']); assert.deepEqual(p.pays, ['debt']); assert.deepEqual(p.delivery, ['yes', 'no']);
  assert.equal(p.from, '2026-10-01'); assert.equal(p.to, ''); assert.deepEqual(p.ids, [5, 7]); assert.deepEqual(p.branches, ['a', 'b']);
  assert.deepEqual(parseOrdersListParams(null).states, []); assert.equal(parseOrdersListParams(undefined).limit, 50);
  assert.equal(parseOrdersListParams({ search: 'x'.repeat(500) }).search.length, 200);
});
t('המיונים: כל מפתח מותר ניתן למיון בזיכרון (sortFacts), מפתח לא מוכר נופל לתאריך אירוע', () => {
  assert.deepEqual([...ORDER_SORT_KEYS].sort(), [...NATIVE_SORTS, ...COMPUTED_SORTS].sort());
  const fs = [{ id: 1, ek: '2026-01-02', od: 5, cn: 'ב', total: 10, paid: 4, nv: 2, state: 'rented' }, { id: 2, ek: '', od: null, cn: 'א', total: 30, paid: 30, nv: 0, state: 'upcoming' }, { id: 3, ek: '2026-03-01', od: 9, cn: 'ג', total: 20, paid: 0, nv: 5, state: 'deleted' }];
  const ids = (sort, dir) => sortFacts(fs, sort, dir).map((f) => f.id);
  assert.deepEqual(ids('eventDate', 'desc'), [3, 1, 2], 'בלי תאריך אירוע תמיד בסוף'); assert.deepEqual(ids('eventDate', 'asc'), [1, 3, 2]);
  assert.deepEqual(ids('orderId', 'asc'), [1, 2, 3]); assert.deepEqual(ids('customerName', 'asc'), [2, 1, 3]);
  assert.deepEqual(ids('orderDate', 'desc'), [3, 1, 2], 'בלי תאריך הזמנה בסוף'); assert.deepEqual(ids('total', 'desc'), [2, 3, 1]);
  assert.deepEqual(ids('paid', 'asc'), [3, 1, 2]); assert.deepEqual(ids('balance', 'desc'), [3, 1, 2]); assert.deepEqual(ids('itemsCount', 'desc'), [3, 1, 2]);
  assert.deepEqual(ids('status', 'asc'), [2, 1, 3]); assert.deepEqual(ids('nope', 'asc'), ids('eventDate', 'asc'));
  assert.deepEqual(sortFacts([{ id: 1, total: 5, paid: 0 }, { id: 2, total: 5, paid: 0 }], 'total', 'asc').map((f) => f.id), [2, 1], 'שוויון = מספר הזמנה יורד');
});
t('parseCustomersListParams: ids רק UUID, מיון / קבוצות מוכרים בלבד', () => {
  const p = parseCustomersListParams({ ids: 'abc,6c27c31e-277e-4f82-856d-3452814a65f7', sort: 'zeout', debt: 'yes,no', missing: 'email,x', first: 'custom', from: '2026-01-01' });
  assert.deepEqual(p.ids, ['6c27c31e-277e-4f82-856d-3452814a65f7']); assert.equal(p.sort, 'name'); assert.deepEqual(p.debt, ['yes']); assert.deepEqual(p.missing, ['email']);
  assert.equal(p.dir, 'asc'); assert.ok(CUSTOMER_SORT_KEYS.includes('lastOrder'));
});

console.log('סטטוס נגזר');
t('stateWhere == deriveStateKey על כל צירופי הפריטים / הטיוטה / התאריך (קבוצות זרות ומכסות הכול)', () => {
  const today = new Date('2026-10-10T21:00:00Z'); const todayKey = '2026-10-11';
  const flags = [{ isDeleted: false, isTaken: false, isReturned: false }, { isDeleted: false, isTaken: true, isReturned: false }, { isDeleted: false, isTaken: true, isReturned: true }, { isDeleted: false, isTaken: false, isReturned: true }, { isDeleted: true, isTaken: false, isReturned: false }, { isDeleted: true, isTaken: true, isReturned: true }];
  const itemSets = [[]];
  flags.forEach((a) => { itemSets.push([a]); flags.forEach((b) => { itemSets.push([a, b]); }); });
  itemSets.push([flags[0], flags[1], flags[2]], [flags[1], flags[4], flags[0]]);
  let n = 0;
  for (const draftsAsDeleted of [true, false]) {
    for (const items of itemSets) for (const status of [null, 'פעיל', DRAFT_STATUS]) for (const isDeleted of [false, true]) for (const ev of [null, new Date('2026-10-01T10:00:00Z'), new Date('2026-12-01T10:00:00Z')]) {
      const o = { orderId: 1, isDeleted, status, eventDate: ev, items };
      const valid = items.filter((i) => !i.isDeleted);
      const key = deriveStateKey({ isDeleted, status, eventDate: ev, nAll: items.length, nValid: valid.length, nReturned: valid.filter((i) => i.isReturned).length, nTaken: valid.filter((i) => i.isTaken).length },
        { todayKey, eventDateKey: ev ? ev.toISOString().slice(0, 10) : '', draftsAsDeleted });
      const hits = ORDER_STATE_KEYS.filter((k) => matches(stateWhere(k, { today, draftsAsDeleted }), o));
      assert.deepEqual(hits, [key], JSON.stringify({ items, status, isDeleted, ev, draftsAsDeleted }));
      const inDefault = matches(statesWhere([], { today, draftsAsDeleted }), o);
      assert.equal(inDefault, key !== 'deleted', 'ברירת המחדל = בלי מחוקות');
      n++;
    }
  }
  assert.ok(n > 1000);
});
t('המילים בעברית זהות ל-calculateOrderStatus; DRAFT_STATUS זהה לקבוע במקור', () => {
  const src = read('../lib/orderStatus.js');
  for (const k of ORDER_STATE_KEYS) if (k !== 'draft') assert.ok(src.includes(`'${STATE_WORD[k]}'`), k);
  assert.match(read('../lib/orderReservation.js'), new RegExp(`DRAFT_ORDER_STATUS = '${DRAFT_STATUS}'`));
  assert.equal(stateKeyOfWord('הושכר חלקי'), 'partRented'); assert.equal(stateKeyOfWord('x'), null);
});

console.log('תשלום');
t('payClass / debtAndCredit: אותם כללים כמו calculatePaymentStatus; חוב וזיכוי חיוביים בלבד', () => {
  assert.equal(payClass(100, 40), 'debt'); assert.equal(payClass(100, 100), 'settled'); assert.equal(payClass(100, 130), 'credit'); assert.equal(payClass(0, 50), 'credit'); assert.equal(payClass(0, 0), 'none');
  assert.deepEqual(debtAndCredit(100, 40), { debt: 60, credit: 0 }); assert.deepEqual(debtAndCredit(100, 100), { debt: 0, credit: 0 });
  assert.deepEqual(debtAndCredit(100, 130.5), { debt: 0, credit: 30.5 }); assert.deepEqual(debtAndCredit(0, 0), { debt: 0, credit: 0 });
  assert.deepEqual(debtAndCredit(140, -60), { debt: 200, credit: 0 }, 'שולם שלילי (החזר) = חוב על כל הסכום');
});
t('הסכום האפקטיבי בשאילתות התמונה זהה לנוסחת /api/orders (totalAmount>0, אחרת התחייבויות>0, אחרת תשלומים), בלי פרמטרים וקריאה בלבד', () => {
  assert.match(ORDER_SNAPSHOT_SQL, /WHEN COALESCE\(o\."totalAmount", 0\) > 0 THEN o\."totalAmount"\s+WHEN COALESCE\(obl\.obl, 0\) > 0 THEN obl\.obl\s+ELSE COALESCE\(pay\.paid, 0\) END AS total/);
  assert.match(CUSTOMER_SNAPSHOT_SQL, /WHEN COALESCE\(o\."totalAmount", 0\) > 0 THEN o\."totalAmount" WHEN COALESCE\(obl\.obl, 0\) > 0 THEN obl\.obl ELSE COALESCE\(pay\.paid, 0\) END AS total/);
  for (const sql of [ORDER_SNAPSHOT_SQL, CUSTOMER_SNAPSHOT_SQL]) {
    assert.ok(/NOT p\."isDeleted"/.test(sql) && /NOT b\."isDeleted"/.test(sql)); assert.ok(!/\$\d/.test(sql), 'בלי פרמטרים'); assert.ok(!/\b(INSERT|UPDATE|DELETE|DROP|ALTER)\b/i.test(sql));
  }
  const route = read('../app/api/orders/route.js');
  assert.match(route, /\(order\.totalAmount && order\.totalAmount > 0\)\s*\? order\.totalAmount\s*: \(obligationsSum > 0 \? obligationsSum : paymentsSum\)/);
});

console.log('תקופות');
t('resolvePeriod / periodRanges בשעון ישראל (מפתחות יום)', () => {
  assert.deepEqual(resolvePeriod('today', '2026-10-11'), { from: '2026-10-11', to: '2026-10-11' });
  assert.deepEqual(resolvePeriod('next7', '2026-10-11'), { from: '2026-10-11', to: '2026-10-18' });
  assert.deepEqual(resolvePeriod('past30', '2026-10-11'), { from: '2026-09-11', to: '2026-10-11' });
  assert.deepEqual(resolvePeriod('pastYear', '2026-10-11'), { from: '2025-10-11', to: '2026-10-11' });
  assert.equal(resolvePeriod('custom', '2026-10-11'), null);
  assert.deepEqual(resolvePeriod('custom', 'x', '2026-01-01', ''), { from: '2026-01-01', to: '' });
  assert.equal(periodRanges(['today', 'custom'], '2026-10-11', '', '').length, 1);
  assert.deepEqual(resolveFirstPeriod('d90', '2026-10-11'), { from: '2026-07-13', to: '2026-10-11' });
  assert.equal(resolveFirstPeriod('zzz', '2026-10-11'), null);
});

console.log('מיפוי סינון -> API');
t('buildOrdersQuery: רק מה שנבחר נשלח; מיון / כיוון; טווח מותאם רק כשנבחר; ids של חיפוש חכם', () => {
  const q = buildOrdersQuery({ sel: { states: ['rented', 'partRented'], pays: ['debt'], delivery: [], period: ['custom'] }, sort: { k: 'balance', dir: -1 }, q: ' כהן ', page: 3, custom: { from: '2026-10-01', to: '2026-10-31' }, aiIds: [5, 6] });
  assert.deepEqual(q, { page: 3, limit: 50, sort: 'balance', dir: 'desc', search: 'כהן', states: 'rented,partRented', pays: 'debt', period: 'custom', from: '2026-10-01', to: '2026-10-31', ids: '5,6' });
  assert.deepEqual(buildOrdersQuery({}), { page: 1, limit: 50, sort: 'eventDate', dir: 'desc' });
  assert.equal(buildOrdersQuery({ sel: { period: ['today'] }, custom: { from: '2026-01-01' } }).from, undefined, 'טווח מותאם לא נשלח בלי הבחירה');
  assert.equal(ORD_SORT.k, 'eventDate'); assert.equal(ORD_SORT.dir, -1, 'ברירת מחדל: החדש ראשון');
  const parsed = parseOrdersListParams(q);
  assert.deepEqual(parsed.states, ['rented', 'partRented']); assert.equal(parsed.from, '2026-10-01'); assert.equal(parsed.sort, 'balance'); assert.deepEqual(parsed.ids, [5, 6]);
});
t('countsKey לא תלוי בעמוד / מיון (הספירות לא נטענות מחדש בדפדוף)', () => {
  const a = buildOrdersQuery({ sel: { states: ['past'] }, page: 1 }); const b = buildOrdersQuery({ sel: { states: ['past'] }, page: 7, sort: { k: 'total', dir: 1 } });
  assert.equal(countsKey(a), countsKey(b)); assert.notEqual(countsKey(a), countsKey(buildOrdersQuery({ sel: { states: ['rented'] } })));
  assert.equal(custCountsKey(buildCustomersQuery({ page: 2 })), custCountsKey(buildCustomersQuery({ page: 9, sort: { k: 'debt', dir: -1 } })));
});
t('buildCustomersQuery: כל הקבוצות, טווח "הזמנה ראשונה", סדר עולה כברירת מחדל', () => {
  const q = buildCustomersQuery({ sel: { debt: ['yes'], missing: ['email', 'phone'], regs: ['unsigned'], blocked: ['no'], orders: ['active'], first: ['custom'] }, custom: { from: '2026-01-01', to: '2026-02-01' }, sort: { k: 'debt', dir: -1 } });
  assert.deepEqual(q, { page: 1, limit: 50, sort: 'debt', dir: 'desc', debt: 'yes', missing: 'email,phone', regs: 'unsigned', blocked: 'no', orders: 'active', first: 'custom', from: '2026-01-01', to: '2026-02-01' });
  assert.equal(buildCustomersQuery({}).dir, 'asc');
});

console.log('אפשרויות הסינון והספירות');
t('buildOrderFilters: בלי ספירות עדיין = גלוי בלי מספר; עם ספירות - אפס מוסתר (אלא אם נבחר), הטווח המותאם תמיד גלוי', () => {
  const none = buildOrderFilters(null);
  assert.ok(none.every((g) => g.options.every((o) => o.count === '' && !isOptionHidden(o.count, false))));
  const counts = { states: { upcoming: 3, rented: 0 }, pays: { debt: 2 }, delivery: { yes: 0, no: 5 }, period: { today: 1 }, branches: {} };
  const f = buildOrderFilters(counts, { customLabel: 'טווח: א – ב' });
  const st = f.find((g) => g.key === 'states').options;
  assert.equal(st.find((o) => o.k === 'upcoming').count, 3); assert.equal(isOptionHidden(st.find((o) => o.k === 'rented').count, false), true); assert.equal(isOptionHidden(0, true), false);
  const per = f.find((g) => g.key === 'period').options; assert.equal(per.at(-1).l, 'טווח: א – ב'); assert.equal(isOptionHidden(per.at(-1).count, false), false);
  assert.deepEqual(f.map((g) => g.key), ['states', 'pays', 'delivery', 'period'], 'בלי סניפים כשהארגון לא משתמש בהם');
  assert.deepEqual(buildOrderFilters(counts, { branchNames: ['מרכז'] }).at(-1).options.map((o) => o.l), ['מרכז']);
  assert.equal(STATE_OPTIONS.length, ORDER_STATE_KEYS.length);
  const cf = buildCustomerFilters({ debt: { yes: 4 }, missing: {}, orders: {}, regs: {}, blocked: {}, first: {} });
  assert.deepEqual(cf.map((g) => g.key), ['debt', 'missing', 'orders', 'regs', 'blocked', 'first']);
  assert.equal(cf[0].options[0].count, 4); assert.equal(cf[1].options[0].count, 0);
});
t('כל מפתח מיון בטבלה / בחלון המיון קיים ב-API (הזמנות ולקוחות)', () => {
  for (const s of ORDER_SORTS) assert.ok(ORDER_SORT_KEYS.includes(s.k), s.k);
  for (const s of CUST_SORTS) assert.ok(CUSTOMER_SORT_KEYS.includes(s.k), s.k);
  const oc = read('../app/components/orders-list/OrdersListA5.js'); const cc = read('../app/components/customers-list/CustomersListA5.js');
  const colKeys = (src) => [...src.matchAll(/\{ k: '(\w+)', t: '/g)].map((m) => m[1]);
  for (const k of colKeys(oc)) assert.ok(ORDER_SORTS.some((s) => s.k === k), `עמודת הזמנות ${k} ניתנת למיון`);
  for (const k of colKeys(cc)) assert.ok(CUST_SORTS.some((s) => s.k === k), `עמודת לקוחות ${k} ניתנת למיון`);
  assert.ok(colKeys(oc).length === 8 && colKeys(cc).length === 8);
});

console.log('שורה: אפס לא מוצג');
const O = (x) => orderRow({ orderId: 100, customerId: 'c', customerName: 'רות כהן', eventDate: '2026-11-03T20:00:00Z', state: 'upcoming', itemsCount: 2, items: [{ name: 'דגם 240', size: '36' }, { name: 'דגם 666', size: '01' }], total: 200, paid: 200, debt: 0, credit: 0, isDelivery: false, branch: '', ...x });
t('orderPairs: מספר + סטטוס תמיד; תאריך / פריטים / משלוח / סניף / חוב / זיכוי רק כשיש', () => {
  const keys = (r) => orderPairs(r).map((p) => p.key);
  assert.deepEqual(keys(O({})), ['num', 'event', 'items', 'state']);
  assert.deepEqual(keys(O({ itemsCount: 0, eventDate: null })), ['num', 'state']);
  assert.deepEqual(keys(O({ isDelivery: true, branch: 'מרכז', debt: 50.5 })), ['num', 'event', 'items', 'state', 'delivery', 'branch', 'debt']);
  assert.deepEqual(keys(O({ credit: 30 })), ['num', 'event', 'items', 'state', 'credit']);
  assert.ok(!keys(O({ debt: 0, credit: 0 })).some((k) => k === 'debt' || k === 'credit'), 'סגור = בלי חוב ובלי זיכוי');
  assert.equal(orderPairs(O({ debt: 1234.5 })).find((p) => p.key === 'debt').text, '₪1,234.5');
  assert.equal(orderPairs(O({ state: 'rented' })).find((p) => p.key === 'state').text, 'הושכר');
  assert.equal(O({}).balance, 0); assert.equal(O({ total: 100, paid: 40 }).balance, 60);
  assert.equal(itemsText([{ name: 'א', size: '1' }, { name: 'ב', size: '' }], 5), 'א (1) · ב · ועוד 3'); assert.equal(money(0), '₪0');
});
t('customerPairs: מספר / טלפון / מייל / עיר / הזמנות / חוב / אחרונה / חסום רק כשיש; אפס לא מוצג', () => {
  const C = (x) => ({ id: 'u', number: 12, phone: '050', email: 'a@b.c', city: 'בני ברק', orders: 3, debt: 0, lastOrder: '2026-05-01T00:00:00Z', blocked: false, blockedReason: '', ...x });
  const keys = (r) => customerPairs(r).map((p) => p.key);
  assert.deepEqual(keys(C({})), ['num', 'phone', 'mail', 'city', 'orders', 'last']);
  assert.deepEqual(keys(C({ number: null, phone: '', email: '', city: '', orders: 0, lastOrder: null })), []);
  assert.deepEqual(keys(C({ debt: 80, blocked: true, blockedReason: 'חוב' })), ['num', 'phone', 'mail', 'city', 'orders', 'debt', 'last', 'blocked']);
  assert.match(customerPairs(C({ blocked: true, blockedReason: 'חוב' })).find((p) => p.key === 'blocked').tip, /חוב/);
});

console.log('גיליון הדוח');
const fns = { dayKey: (iso) => iso.slice(0, 10), monthLabel: (k) => (k < '2026-11-01' ? 'תשרי תשפז' : 'חשוון תשפז'), dayLabel: (k) => 'יום ' + k.slice(8) };
t('buildOrdersSheet: מקובץ לפי חודש עברי בסדר כרונולוגי, "ללא תאריך" בסוף, עמודת חוב רק כשיש חוב, סיכומים פעם אחת, בלי ערכים כפולים', () => {
  const rows = [
    O({ orderId: 3, eventDate: '2026-11-03T10:00:00Z', total: 100, paid: 100 }), O({ orderId: 1, eventDate: '2026-10-05T10:00:00Z', total: 200, paid: 150, debt: 50 }),
    O({ orderId: 4, eventDate: null, itemsCount: 0, total: 0, paid: 0 }), O({ orderId: 2, eventDate: '2026-10-20T10:00:00Z', total: 50, paid: 50 }),
  ];
  const s = buildOrdersSheet(rows, 'סטטוס: הושכר', fns);
  assert.equal(s.title, 'דוח הזמנות'); assert.equal(s.subtitle, 'סטטוס: הושכר'); assert.equal(s.groupBy, 'eventMonth');
  assert.deepEqual(s.groups.map((g) => [g.title, g.rows.map((r) => r.orderId)]), [['תשרי תשפז', [1, 2]], ['חשוון תשפז', [3]], ['ללא תאריך אירוע', [4]]]);
  assert.deepEqual(s.columns.map((c) => c.key), ['orderId', 'customer', 'day', 'items', 'total', 'balance']);
  assert.deepEqual(s.totals, { count: 4, total: 350, paid: 300, debt: 50, credit: 0 });
  assert.equal(s.groups[0].rows[0].balance, 50); assert.equal(s.groups[0].rows[1].balance, '');
  const noDebt = buildOrdersSheet(rows.filter((r) => !r.debt), '', fns);
  assert.deepEqual(noDebt.columns.map((c) => c.key), ['orderId', 'customer', 'day', 'items', 'total'], 'בלי עמודת חוב כשאין חוב');
  const flat = sheetFlatRows(s); assert.equal(flat.head.length, 7); assert.equal(flat.rows.length, 4); assert.equal(flat.rows[0][2], 'תשרי תשפז');
  assert.equal(sheetFlatRows(noDebt).head.length, 6);
});
t('buildCustomersSheet: עמודות "הזמנות" / "חוב" רק כשיש ערך ברשימה; סיכום פעם אחת', () => {
  const R = [{ number: 1, firstName: 'א', lastName: 'ב', phone: '1', email: 'x', city: 'י', orders: 2, debt: 0 }, { number: null, firstName: 'ג', lastName: '', phone: '', email: '', city: '', orders: 0, debt: 30 }];
  const s = buildCustomersSheet(R, 'חוב: עם חוב');
  assert.deepEqual(s.columns.map((c) => c.key), ['number', 'name', 'phone', 'email', 'city', 'orders', 'debt']); assert.equal(s.rows[1].name, 'ג'); assert.equal(s.rows[0].debt, ''); assert.deepEqual(s.totals, { count: 2, debt: 30 });
  const s2 = buildCustomersSheet([{ ...R[0], orders: 0 }], '');
  assert.deepEqual(s2.columns.map((c) => c.key), ['number', 'name', 'phone', 'email', 'city']);
  assert.equal(custFlat(s).rows.length, 2); assert.equal(s.title, 'רשימת לקוחות');
});
t('מסכת שדות ריקים: ביט לכל שדה חובה, requiredMaskOf, וסינון "חסר" ללקוחות', () => {
  assert.equal(MASK_FIELDS.length, 13); assert.equal(maskBit('firstName'), 1); assert.equal(maskBit('phone1'), 4); assert.equal(maskBit('nope'), 0);
  assert.equal(requiredMaskOf(['firstName', 'phone1', 'phone1']), 5); assert.equal(requiredMaskOf([]), 0);
  const mk = (id, over) => buildCustomerFact({ id, num: 1, cn: id, blk: false, reg: false, city: '', ph: '', em: '', mask: 0, orders: 0, debt: 0, last_order: null, active: 0, first_ek: '', ...over });
  const F = [mk('a', { mask: maskBit('email') }), mk('b', { mask: maskBit('phone1') | maskBit('zeout') }), mk('c', {}), mk('d', { mask: maskBit('city') })];
  const ctx = { todayKey: '2026-10-11', requiredMask: requiredMaskOf(['firstName', 'phone1', 'email']) };
  const P = (o) => parseCustomersListParams(o);
  const ids = (o) => filterCustomerFacts(F, P(o), ctx).map((f) => f.id);
  assert.deepEqual(ids({ missing: 'any' }), ['a', 'b'], 'any = אחד משדות החובה בהגדרה'); assert.deepEqual(ids({ missing: 'email' }), ['a']); assert.deepEqual(ids({ missing: 'phone' }), ['b']);
  assert.deepEqual(ids({ missing: 'id' }), ['b']); assert.deepEqual(ids({ missing: 'email,phone' }), ['a', 'b'], 'OR בתוך קבוצה');
  assert.match(CUSTOMER_SNAPSHOT_SQL, /LIKE '%@%'/, '"אין מייל" מתחשב בסיומת');
});
t('מנוע ההזמנות בזיכרון: ברירת מחדל בלי מחוקות, OR בקבוצה / AND בין קבוצות, תקופה, תשלום, משלוח, חיפוש, וספירות שמחריגות את הקבוצה עצמה', () => {
  const ctx = { todayKey: '2026-10-11', draftsAsDeleted: true };
  const R = (id, o) => buildFact({ id, del: false, st: 'פעיל', ek: '2026-10-20', od: 1, dlv: false, br: '', cn: 'x', total: 100, paid: 100, nall: 1, nv: 1, nr: 0, nt: 0, ...o }, ctx);
  const F = [
    R(1, {}), R(2, { nt: 1, paid: 40 }), R(3, { nt: 1, nr: 1, ek: '2025-01-01' }), R(4, { del: true }), R(5, { total: 50, paid: 90, dlv: true, ek: '2026-10-11' }),
    R(6, { st: 'טיוטה' }), R(7, { ek: '', total: 0, paid: 0, nall: 0, nv: 0 }), R(8, { ek: '2026-09-01', nall: 2, nv: 0 }),
  ];
  assert.deepEqual(F.map((f) => f.state), ['upcoming', 'rented', 'returned', 'deleted', 'upcoming', 'deleted', 'upcoming', 'deleted']);
  assert.deepEqual(F.map((f) => f.pc), ['settled', 'debt', 'settled', 'settled', 'credit', 'settled', 'none', 'settled']);
  const P = (o) => parseOrdersListParams(o);
  const ids = (o, opt) => filterFacts(F, P(o), ctx.todayKey, opt).map((f) => f.id);
  assert.deepEqual(ids({}), [1, 2, 3, 5, 7], 'ברירת מחדל = בלי מחוקות (גם טיוטה כמחוקה)');
  assert.deepEqual(ids({ states: 'deleted' }), [4, 6, 8]); assert.deepEqual(ids({ states: 'upcoming,returned' }), [1, 3, 5, 7], 'OR בקבוצה');
  assert.deepEqual(ids({ pays: 'debt' }), [2]); assert.deepEqual(ids({ pays: 'credit' }), [5]); assert.deepEqual(ids({ pays: 'settled' }), [1, 3]); assert.deepEqual(ids({ pays: 'debt,credit' }), [2, 5]);
  assert.deepEqual(ids({ delivery: 'yes' }), [5]); assert.deepEqual(ids({ delivery: 'yes,no' }), [1, 2, 3, 5, 7], 'שני הערכים = בלי סינון');
  assert.deepEqual(ids({ period: 'today' }), [5], 'תקופה לפי יום האירוע (כולל קצוות)'); assert.deepEqual(ids({ period: 'next7' }), [5]);
  assert.deepEqual(ids({ period: 'custom', from: '2025-01-01', to: '2025-12-31' }), [3]); assert.deepEqual(ids({ period: 'custom', from: '2026-10-12' }), [1, 2], 'טווח פתוח מצד אחד; בלי תאריך אירוע לא מתאים');
  assert.deepEqual(ids({ states: 'upcoming', pays: 'credit', delivery: 'yes' }), [5], 'AND בין קבוצות');
  assert.deepEqual(ids({ ids: '2,3,99' }), [2, 3]); assert.deepEqual(ids({}, { searchIds: new Set([1, 5, 4]) }), [1, 5]);
  const c = countFacts(F, P({ states: 'upcoming', pays: 'debt' }), ctx.todayKey, { draftsAsDeleted: true });
  assert.equal(c.total, 0, 'בקרוב + חוב = אין'); assert.equal(c.states.rented, 1, 'ספירת הקבוצה לא תלויה בבחירה בה (רק בחוב)'); assert.equal(c.states.upcoming, 0);
  assert.equal(c.pays.debt, 0, 'בקרוב: אין חוב'); assert.equal(c.pays.settled, 1); assert.equal(c.pays.credit, 1);
  assert.equal(c.states.draft, 0); assert.equal(c.delivery.yes, 0); assert.equal(c.delivery.no, 0, 'בקרוב + חוב: אין הזמנות, לכן גם בקבוצת המשלוח אפס');
  const c2 = countFacts(F, P({}), ctx.todayKey, { branchNames: ['מרכז'], draftsAsDeleted: false });
  assert.deepEqual([c2.total, c2.states.deleted, c2.states.rented, c2.delivery.yes, c2.delivery.no, c2.period.today, c2.branches['מרכז']], [5, 3, 1, 1, 4, 1, 0]);
  assert.equal(c2.period.custom, undefined); assert.equal(countFacts(F, P({ period: 'custom', from: '2025-01-01', to: '2025-12-31' }), ctx.todayKey).period.custom, 1);
});
t('מנוע הלקוחות בזיכרון: סינון חוב / פעילות / תקנון / חסימה / הזמנה ראשונה, מיון עם ריקים בסוף, ספירות', () => {
  const mk = (id, over) => buildCustomerFact({ id, num: null, cn: id, blk: false, reg: false, city: '', ph: '', em: '', mask: 0, orders: 0, debt: 0, last_order: null, active: 0, first_ek: '', ...over });
  const F = [mk('a', { num: 5, orders: 3, debt: 80.456, last_order: 100, active: 1, first_ek: '2026-09-20', reg: true }), mk('b', { num: 2, orders: 1, last_order: 300, first_ek: '2025-01-05', blk: true }), mk('c', { city: 'ב' }), mk('d', { orders: 7, debt: 5, last_order: 200, active: 2, first_ek: '2026-10-01', city: 'א' })];
  const ctx = { todayKey: '2026-10-11', requiredMask: 0 };
  const P = (o) => parseCustomersListParams(o);
  const ids = (o) => filterCustomerFacts(F, P(o), ctx).map((f) => f.id);
  assert.equal(F[0].debt, 80.46, 'חוב מעוגל לאגורות'); assert.deepEqual(ids({ debt: 'yes' }), ['a', 'd']); assert.deepEqual(ids({ orders: 'active' }), ['a', 'd']);
  assert.deepEqual(ids({ orders: 'none' }), ['c']); assert.deepEqual(ids({ orders: 'has' }), ['a', 'b', 'd']); assert.deepEqual(ids({ orders: 'none,active' }), ['a', 'c', 'd']);
  assert.deepEqual(ids({ regs: 'signed' }), ['a']); assert.deepEqual(ids({ blocked: 'yes' }), ['b']); assert.deepEqual(ids({ blocked: 'no', regs: 'unsigned' }), ['c', 'd']);
  assert.deepEqual(ids({ first: 'd30' }), ['a', 'd']); assert.deepEqual(ids({ first: 'custom', from: '2025-01-01', to: '2025-12-31' }), ['b']); assert.equal(ids({ first: 'd30' }).includes('c'), false, 'בלי הזמנה לא מתאים');
  const s = (sort, dir) => sortCustomerFacts(F, sort, dir).map((f) => f.id);
  assert.deepEqual(s('orders', 'desc'), ['d', 'a', 'b', 'c']); assert.deepEqual(s('debt', 'desc'), ['a', 'd', 'b', 'c']); assert.deepEqual(s('lastOrder', 'desc'), ['b', 'd', 'a', 'c'], 'בלי הזמנה בסוף');
  assert.deepEqual(s('lastOrder', 'asc'), ['a', 'd', 'b', 'c']); assert.deepEqual(s('number', 'asc'), ['b', 'a', 'c', 'd'], 'בלי מספר בסוף'); assert.deepEqual(s('city', 'asc'), ['d', 'c', 'a', 'b']);
  const c = countCustomerFacts(F, P({ orders: 'active' }), ctx);
  assert.equal(c.total, 2); assert.equal(c.orders.none, 1, 'ספירת "הזמנות" לא תלויה בבחירה בה'); assert.equal(c.debt.yes, 2); assert.equal(c.blocked.yes, 0); assert.equal(c.first.custom, undefined);
});

t('שורות העמוד בשאילתה אחת: SQL עם פרמטר מערך, ייצוא ללא join לדגמים, והמרת שורה גולמית (פריט / סטטוס / חוב / שם דגם placeholder)', () => {
  assert.match(orderRowsSql(false), /WHERE o\."orderId" = ANY\(\$1::int\[\]\)/); assert.match(orderRowsSql(false), /LEFT JOIN "DressModel" dm/);
  assert.ok(!/DressModel|DressItem/.test(orderRowsSql(true)), 'ייצוא: דגלי פריטים בלבד'); assert.ok(!/\b(INSERT|UPDATE|DELETE|DROP)\b/i.test(orderRowsSql(false)));
  assert.match(orderRowsSql(false), /AT TIME ZONE 'UTC'\) AT TIME ZONE 'Asia\/Jerusalem'/, 'יום ישראלי מ-timestamp ללא אזור: קודם UTC ואז ישראל');
  assert.match(ORDER_SNAPSHOT_SQL, /AT TIME ZONE 'UTC'\) AT TIME ZONE 'Asia\/Jerusalem'/);
  assert.match(CUSTOMER_SNAPSHOT_SQL, /AT TIME ZONE 'UTC'\) AT TIME ZONE 'Asia\/Jerusalem'/);
  assert.match(CUSTOMER_SNAPSHOT_SQL, /NOT \(f\.nr = 0 AND f\.nt = 0 AND \(COALESCE\(f\."status" = 'טיוטה', false\) OR COALESCE\(f\.ek < /, 'הזמנה פעילה: בלי "עבר" / טיוטה (גם כשיש פריטים שלא נלקחו)');
  const ctx = { todayKey: '2026-10-11', draftsAsDeleted: true };
  const raw = { orderId: 7, customerId: 'c', totalAmount: 200, status: 'פעיל', isDeleted: false, eventDate: new Date('2026-11-03T00:00:00Z'), eventDateHebrew: 'x', orderDate: null, isDelivery: true, branch: 'מרכז', ek: '2026-11-03', firstName: 'רות', lastName: 'כהן', phone1: '', phone2: '050', paid: 150, obl: 0,
    items: [{ d: false, t: true, r: false, sz: '', dsz: '36', dn: 'ללא שם - 5', dpp: 240 }, { d: true, t: false, r: false, dn: 'מחוק' }, { d: false, t: true, r: false, dn: 'אורורה', sz: '02' }] };
  const r = shapeOrderRow(raw, ctx, false);
  assert.equal(r.state, 'rented'); assert.equal(r.itemsCount, 2); assert.deepEqual(r.items, [{ name: 'דגם 240', size: '36', taken: true, returned: false }, { name: 'אורורה', size: '02', taken: true, returned: false }]);
  assert.deepEqual([r.total, r.paid, r.debt, r.credit, r.customerName, r.customerPhone, r.isDelivery, r.branch], [200, 150, 50, 0, 'רות כהן', '050', true, 'מרכז']);
  assert.equal(r.eventDate, '2026-11-03T00:00:00.000Z'); assert.equal(r.orderDate, null);
  assert.deepEqual(shapeOrderRow(raw, ctx, true).items, [], 'ייצוא: בלי פירוט פריטים'); assert.equal(shapeOrderRow({ ...raw, totalAmount: 0, obl: 90, paid: 0 }, ctx, true).total, 90, 'סכום מהתחייבויות כש-totalAmount ריק');
  assert.equal(shapeOrderRow({ ...raw, items: [], ek: '2026-10-01' }, ctx, true).state, 'past'); assert.equal(shapeOrderRow({ ...raw, items: [{ d: true }] }, ctx, true).state, 'deleted');
});

console.log('חוזה סטטי: שערים, רישום, תפריט');
t('שני נתיבי ה-API (ורשימה + ספירות) שמורים להנהלה ראשית / מתכנת ולא כותבים ל-DB', () => {
  for (const f of ['orders-list/route.js', 'orders-list/counts/route.js', 'customers-list/route.js', 'customers-list/counts/route.js']) {
    const src = read(`../app/api/admin/${f}`);
    assert.match(src, /checkAuth\('הנהלה ראשית'\)/, f); assert.ok(src.indexOf("checkAuth('הנהלה ראשית')") < src.indexOf('await query'), `${f}: השער לפני השאילתה`);
    assert.ok(!/\.(create|update|delete|upsert|deleteMany|updateMany)\(/.test(src), f);
  }
  for (const f of ['adminOrdersListServer.js', 'adminCustomersListServer.js']) {
    const src = read(`../lib/${f}`);
    assert.ok(!/prisma\.\w+\.(create|update|delete|upsert|deleteMany|updateMany|createMany)\(/.test(src), `${f}: קריאה בלבד`);
    assert.ok(!/\$executeRaw/.test(src), f);
  }
  assert.ok(!/zeout\b/.test(read('../lib/adminCustomersListServer.js').replace(/hasId: !!\(c\.zeout[^\n]*/, '').replace(/zeout: true,/, '')) , 'ת"ז לא נשלחת (רק יש / אין)');
  assert.ok(!/bank|hokBank|notes|officeNotes/i.test(read('../lib/adminCustomersListServer.js').split('const SELECT')[1].split('function shape')[0]), 'אין בנק / הערות ב-SELECT');
});
t('הדפים תחת /admin (השער של app/admin/layout.js), ללא גרסה ישנה, וקיימים בקטלוג מסך הניהול', () => {
  assert.match(read('../app/admin/layout.js'), /checkPageAccess\(HEAD_MANAGEMENT_ROLES\)/);
  for (const d of ['orders-list', 'customers-list']) assert.ok(existsSync(new URL(`../app/admin/${d}/page.js`, import.meta.url)), d);
  const cat = read('../lib/adminHubCatalog.js');
  for (const h of ['/admin/orders-list', '/admin/customers-list']) assert.ok(new RegExp(`href: '${h}'[^\\n]*gate: 'head'`).test(cat), h);
  const nav = read('../app/components/navConfig.js'); assert.ok(!/orders-list|customers-list/.test(nav), 'לא בתפריטים הרגילים');
  const home = read('../app/page.js'); assert.ok(!/orders-list|customers-list/.test(home), 'לא בדף הבית');
  const reg = read('../lib/uiVariantScreens.js');
  assert.match(reg, /id: 'orders_list_admin'/); assert.match(reg, /id: 'customers_list_admin'/);
  assert.ok(!/id: 'orders_list'|id: 'customers_list'/.test(reg.split('NO_LEGACY_PAGES')[0]), 'לא ברשומת "ישן / חדש"');
  const perm = read('../lib/permissionsMetadata.js');
  for (const k of ['page:admin_orders_list', 'page:admin_customers_list']) assert.match(perm, new RegExp(`key: '${k}'[\\s\\S]{0,600}notConfigurable[\\s\\S]{0,900}defaultForRoleId: \\(roleId\\) => HEAD_MANAGEMENT\\.includes\\(roleId\\)`));
  const labels = read('../lib/menu/pageLabels.js'); assert.ok(labels.includes("'/admin/orders-list'") && labels.includes("'/admin/customers-list'"));
});
t('הרכיבים: אין window.confirm / alert / prompt; חלונות דרך ערכת הרשימות; אין UUID מוצג', () => {
  for (const f of ['orders-list/OrdersListA5.js', 'customers-list/CustomersListA5.js', 'admin-lists/RangeDialog.js', 'admin-lists/useAdminServerList.js']) {
    const src = read(`../app/components/${f}`);
    assert.ok(!/window\.(confirm|alert|prompt)|\balert\(|customConfirm/.test(src), f);
  }
  const cus = read('../app/components/customers-list/CustomersListA5.js');
  assert.ok(!/>\s*\{r\.id\}\s*</.test(cus) && !/hl\(r\.id|hl\(String\(r\.id/.test(cus), 'המזהה לא מוצג (משמש לניווט בלבד)');
  assert.match(read('../app/components/admin-lists/RangeDialog.js'), /<Dlg /);
});


console.log('רשת הביטחון: עלות / תקציב');
t('גבולות קלט: limit עד 100 (export: 500), היסט מוגזם -> 400, אין "הכול"', () => {
  assert.equal(MAX_LIST_LIMIT, 100); assert.equal(EXPORT_PAGE_LIMIT, 500);
  assert.equal(parseOrdersListParams({ limit: '100000000' }).limit, 100); assert.equal(parseCustomersListParams({ limit: '100000000' }).limit, 100);
  assert.equal(parseOrdersListParams({ limit: '100000000', export: '1' }).limit, 500); assert.equal(parseCustomersListParams({ limit: 5000, export: true }).limit, 500);
  assert.equal(parseOrdersListParams({ limit: '0' }).limit, 1); assert.equal(parseOrdersListParams({ page: '999999999' }).page, 100000);
  assert.equal(validatePaging(parseOrdersListParams({ page: 3, limit: 50 })), '');
  assert.match(validatePaging(parseOrdersListParams({ page: 100000 })), /מחוץ לטווח/);
  assert.equal(validatePaging({ page: Math.floor(MAX_OFFSET / 50), limit: 50, export: false }), '');
  assert.notEqual(validatePaging({ page: Math.floor(MAX_OFFSET / 50) + 2, limit: 50, export: false }), '');
  assert.notEqual(validatePaging({ page: 1, limit: 101, export: false }), '', 'limit שעבר ניקוי (לא אמור לקרות) נדחה');
  assert.equal(validatePaging({ page: 1, limit: 500, export: true }), '');
  assert.ok(MAX_EXPORT_ROWS <= 5000);
});
t('statement_timeout: משפט SQL מספרי בלבד בטווח, וזיהוי חריגה (Postgres 57014 / Prisma) ל-503 "צמצמו את הסינון"', () => {
  assert.equal(statementTimeoutSql(), `SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
  assert.equal(statementTimeoutSql('1; DROP TABLE "Order"'), `SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`, 'קלט לא מספרי -> ברירת המחדל');
  assert.equal(statementTimeoutSql(10), 'SET LOCAL statement_timeout = 500'); assert.equal(statementTimeoutSql(10 ** 9), 'SET LOCAL statement_timeout = 60000');
  assert.ok(isStatementTimeout(new Error('canceling statement due to statement timeout'))); assert.ok(isStatementTimeout({ message: 'x', meta: { code: '57014' } }));
  assert.ok(!isStatementTimeout(new Error('unique constraint'))); assert.ok(!isStatementTimeout(null));
  assert.deepEqual(errorResponse(new Error('canceling statement due to statement timeout')), { status: 503, body: { error: MSG_NARROWER, code: 'timeout' } });
  assert.deepEqual(errorResponse(new BudgetError('busy', 'x')), { status: 503, body: { error: MSG_BUSY, code: 'busy' } });
  assert.deepEqual(errorResponse(new BudgetError('deadline', 'x')).body.code, 'deadline');
  assert.equal(errorResponse(new BadRequestError('x')).status, 400); assert.equal(errorResponse(new Error('boom')), null);
});
const asyncTests = [];
const ta = (name, fn) => asyncTests.push([name, fn]);
ta('limiter: מעבר למקביליות המותרת = 503 busy (בלי תור), ומשחרר גם בשגיאה', async () => {
  const lim = createLimiter(2); let release; const gate = new Promise((r) => { release = r; });
  const a = lim.run(() => gate); const b = lim.run(() => gate);
  assert.equal(lim.active, 2);
  await assert.rejects(() => lim.run(async () => 1), (e) => e instanceof BudgetError && e.kind === 'busy' && e.status === 503);
  release(); await Promise.all([a, b]); assert.equal(lim.active, 0);
  await assert.rejects(() => lim.run(async () => { throw new Error('x'); }), /x/); assert.equal(lim.active, 0);
  assert.equal(await lim.run(async () => 7), 7);
});
t('deadline: check() זורק אחרי שחלף התקציב', () => {
  let now = 0; const d = createDeadline(1000, () => now);
  d.check(); now = 1000; d.check(); now = 1001;
  assert.throws(() => d.check(), (e) => e instanceof BudgetError && e.kind === 'deadline'); assert.equal(d.remaining(), 0);
});
ta('מטמון TTL: פגיעה בתוך ה-TTL, פקיעה, איחוד בקשות במקביל, שגיאה לא נמטמנת, הגבלת גודל', async () => {
  let now = 0; const c = createTtlCache({ ttl: 100, max: 3, now: () => now }); let calls = 0;
  const load = (v) => async () => { calls++; await Promise.resolve(); return v; };
  const [x, y] = await Promise.all([c.get('k', load(1)), c.get('k', load(2))]);
  assert.deepEqual([x, y, calls], [1, 1, 1], 'שתי בקשות במקביל = טעינה אחת');
  assert.equal(await c.get('k', load(9)), 1); assert.equal(calls, 1, 'פגיעה');
  now = 101; assert.equal(await c.get('k', load(3)), 3); assert.equal(calls, 2, 'פקע');
  await assert.rejects(() => c.get('bad', async () => { throw new Error('e'); }), /e/); assert.equal(await c.get('bad', load(5)), 5, 'שגיאה לא נמטמנה');
  for (const k of ['a', 'b', 'c', 'd']) await c.get(k, load(k)); assert.ok(c.size <= 3);
});
t('paramsKey: מפתח הספירות לא תלוי בעמוד / מיון, ובקבוצה שמושמטת', () => {
  const a = parseOrdersListParams({ states: 'rented', pays: 'debt', page: 1, sort: 'total' });
  const b = parseOrdersListParams({ states: 'past', pays: 'debt', page: 9, sort: 'orderId', dir: 'asc' });
  assert.notEqual(paramsKey(a), paramsKey(b)); assert.equal(paramsKey(a, ['states']), paramsKey(b, ['states']), 'בלי קבוצת הסטטוס - אותו מפתח (הספירות של הקבוצה נשמרות במטמון)');
  assert.notEqual(paramsKey(a, ['pays']), paramsKey(b, ['pays']));
});
t('ברירת המחדל לסטטוס (המפרט ההצהרתי) היא תנאי קצר אחד (לא OR של שבעה)', () => {
  const w = statesWhere([], { today: new Date(), draftsAsDeleted: true });
  assert.ok(w.AND && !w.OR, 'AND קצר');
  assert.ok(JSON.stringify(w).length < JSON.stringify(statesWhere(['rented', 'upcoming', 'past'], { today: new Date(), draftsAsDeleted: true })).length);
});
t('חוזה סטטי: כל גישה ל-DB ברשימות עוברת דרך guarded() (תקציב זמן) ו-runLimited, הנתיבים מחזירים 400 / 503 נקיים, הספירות עם מטמון', () => {
  for (const f of ['adminOrdersListServer.js', 'adminCustomersListServer.js']) {
    const src = read(`../lib/${f}`);
    assert.ok(/guarded\(prisma\.(order|customer)\.(findMany|count)/.test(src), f);
    assert.ok(!/await prisma\.(order|customer)\.(findMany|count)\(/.test(src), `${f}: findMany/count בלי guarded`);
    assert.ok(!/await prisma\.\$queryRawUnsafe\(/.test(src), `${f}: SQL גולמי בלי guarded`);
    assert.match(src, /runLimited/); assert.match(src, /createTtlCache/);
  }
  for (const f of ['orders-list/route.js', 'orders-list/counts/route.js', 'customers-list/route.js', 'customers-list/counts/route.js']) {
    const src = read(`../app/api/admin/${f}`);
    assert.match(src, /validatePaging|errorResponse/, f); assert.match(src, /errorResponse\(error\)/, f);
  }
  const hook = read('../app/components/admin-lists/useAdminServerList.js');
  assert.match(hook, /countsOpen/, 'ספירות רק כשהחלון נפתח'); assert.match(hook, /COUNTS_DEBOUNCE_MS/);
  assert.match(read('../app/components/a5-list/A5List.js'), /onFilterOpen/);
});
for (const [name, fn] of asyncTests) {
  try { await fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
