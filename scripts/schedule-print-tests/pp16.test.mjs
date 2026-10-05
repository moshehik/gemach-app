// PP-16 "דף קבלת החזרות": build() (טהור), ה-extra manretDetail (שאילתות, איחורים, מצב הפריטים), ה-API (הרשאות, שורות Excel),
// והלשון מול סימון הלו״ז. נתוני הדמה: scripts/schedule-tests/fixtures.mjs - "היום" חמישי 15.10.2026; ביום הזה שלב 8 = 1013, 1014 (הוחזר לא תקין),
// 1015; באיחור: 2004 (מועד 22.9 אחרי גלגול, 23 ימים) ו-1017 (8.10, 7 ימים). לא באיחור: 1018 (לא נלקחה), 1010 (משלוח חזור), 2002/2003/2006 (עתידיות).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { installDb, ORDERS, NOW } from '../schedule-tests/fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const require = createRequire(process.env.PROJ + '/package.json');
const XLSX = require('xlsx');
const { getScheduleDay } = await L('lib/schedule/index.js');
const { loadExtras, buildPrintPayload } = await L('lib/schedule/print/data.js');
const { getPrintPage } = await L('lib/schedule/print/registry.js');
const PP16 = await L('lib/schedule/print/pages/PP-16.js');
const { loadManretDetail, LATE_WINDOW_DAYS, LATE_MAX, LATE_SCAN_MAX } = await L('lib/schedule/print/extras/manretDetail.js');
const { parseScheduleCode } = await L('lib/schedule/print/barcode.js');
const { buildScheduleWorkbook } = await L('lib/schedule/print/xlsx.js');
const route = await L('app/api/schedule/print/route.js');
const { invalidatePermissionCache } = await L('lib/permissions.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { invalidateRequireLoginCache } = await L('lib/auth.js');

const def = getPrintPage('PP-16');
const itemsOf = (orders) => orders.flatMap((o) => (o.items || []).map((it) => ({ ...it, orderId: o.orderId })));
function setup({ orders = ORDERS, extra = {} } = {}) {
  installDb({ extra: { order: orders, orderItem: itemsOf(orders), ...extra } });
  invalidateSettingsCache(); invalidateRequireLoginCache(); invalidatePermissionCache();
  globalThis.__AUTH_TOKEN = null;
}
beforeEach(() => setup());

async function payloadFor(date = '2026-10-15', opts = {}) {
  const day = await getScheduleDay({ date, user: { id: 'emp-head', roleId: 0 }, now: NOW, ...(opts.day || {}) });
  const extras = await loadExtras(day, [def]);
  return { day, extras, payload: buildPrintPayload({ day, keys: ['PP-16'], extras, gmach: { name: 'ג', address: '', phone: '' }, printedBy: 'ט', now: NOW }) };
}

test('registry: PP-16 is ready, MRT per family + ALL-MRT on the header, no extra page permission, asks for manretDetail', () => {
  assert.equal(def.status, 'ready');
  assert.deepEqual(def.barcode, { prefix: 'MRT', page: true, rows: 'order' });
  assert.deepEqual(def.extraPageKeys, []);
  assert.deepEqual(def.extras, ['manretDetail']);
  assert.deepEqual(def.stages, ['manret']);
});

test('data: families of the day (sorted by family name) + the late ones (most late first), per-item rows, MRT code per family', async () => {
  const { payload } = await payloadFor();
  const p = payload.pages[0];
  assert.equal(p.pageCode, 'ALL-MRT-261015');
  const d = p.data;
  assert.equal(d.title, 'דף קבלת החזרות');
  assert.equal(d.sub, 'מי מחזירה בסניף היום · פירוט לכל פריט');
  assert.deepEqual(d.sections.map((s) => s.key), ['today', 'late']);
  assert.equal(d.sections[0].label, 'מחזירות היום');
  assert.deepEqual(d.sections[0].blocks.map((b) => b.orderId), [1013, 1014, 1015], 'לב, מור, נוי (he order of the family name)');
  assert.deepEqual(d.sections[0].blocks.map((b) => b.name), ['משפחת לב', 'משפחת מור', 'משפחת נוי']);
  assert.deepEqual(d.sections[1].blocks.map((b) => [b.orderId, b.lateDays]), [[2004, 23], [1017, 7]], 'late: most late first; 2004 due 20.9 (erev Yom Kippur) rolls to Tue 22.9 -> 23 days on 15.10');
  assert.equal(d.sections[1].label, 'באיחור');
  assert.equal(d.totals.returns, 5);
  assert.equal(d.totals.items, 5);
  assert.equal(d.sum, '5 החזרות · 5 פריטים');
  const b13 = d.rows.find((b) => b.orderId === 1013);
  assert.equal(b13.code, 'MRT-1013');
  assert.deepEqual(parseScheduleCode(b13.code), { kind: 'order', stage: 'manret', prefix: 'MRT', orderId: 1013 });
  assert.equal(b13.phone, '050-1111111');
  assert.equal(b13.street, 'יפו 10');
  assert.equal(b13.city, 'ירושלים');
  assert.equal(b13.addressMissing, false);
  assert.equal(b13.itemCount, 1);
  assert.deepEqual(b13.items[0], { n: 1, of: 1, model: 'ורד - 123', size: '38', state: '' }, 'model name from the prefix lookup + the prefix, like the design');
  assert.equal(d.returnHour, '13:00', 'standard_return_hour default');
  assert.equal(d.empty, false);
  // threshold 7 (late_return_threshold_days): 7 days = severe, like /api/orders/overdue
  assert.equal(d.rows.find((b) => b.orderId === 1017).lateSevere, true);
  assert.equal(d.rows.find((b) => b.orderId === 2004).lateSevere, true);
  assert.equal(b13.lateSevere, false);
});

test('item state uses the schedule marks wording: "הוחזר" / "הוחזר לא תקין" (returnedOk=false), blank when not returned', async () => {
  const { payload } = await payloadFor();
  const d = payload.pages[0].data;
  assert.equal(PP16.STATE_RETURNED, 'הוחזר');
  assert.equal(PP16.STATE_RETURNED_BAD, 'הוחזר לא תקין');
  assert.equal(d.rows.find((b) => b.orderId === 1014).items[0].state, 'הוחזר לא תקין', '1014: isReturned + returnedOk=false');
  assert.equal(d.rows.find((b) => b.orderId === 1013).items[0].state, '');
  // returned OK, and "returned" by returnDate alone (legacy import: flag not normalised) - same rule as the schedule (itemReturned)
  const orders = ORDERS.map((o) => (o.orderId === 1013 ? { ...o, items: [{ ...o.items[0], isReturned: true, returnedOk: true }, { ...o.items[0], id: 'it-x', isReturned: false, returnDate: new Date('2026-10-15T05:00:00Z'), returnedOk: true }, { ...o.items[0], id: 'it-y' }] } : o));
  setup({ orders });
  const again = (await payloadFor()).payload.pages[0].data.rows.find((b) => b.orderId === 1013);
  assert.deepEqual(again.items.map((i) => i.state).sort(), ['', 'הוחזר', 'הוחזר'].sort());
  assert.equal(again.items.every((i) => i.of === 3), true);
});

test('extras: ONE OrderItem query (orderId in the stage rows, isDeleted=false), late = ONE light candidate query + ONE detail query, ONE dressModel query; no writes, no transactions', async () => {
  const { day } = await payloadFor();
  globalThis.__MOCK_CALLS.length = 0;
  const x = await loadManretDetail(day);
  const calls = globalThis.__MOCK_CALLS;
  const itemQ = calls.filter((c) => c.model === 'orderItem');
  assert.equal(itemQ.length, 1);
  assert.deepEqual(itemQ[0].args.where.orderId.in.sort(), [1013, 1014, 1015]);
  assert.equal(itemQ[0].args.where.isDeleted, false);
  assert.ok(itemQ[0].args.take > 0, 'capped');
  const late = calls.filter((c) => c.model === 'order');
  assert.equal(late.length, 2, 'candidates + details of the top LATE_MAX');
  const w = JSON.stringify(late[0].args.where);
  assert.ok(w.includes('"isDeleted":false') && w.includes('"status":null') && w.includes('"not":"טיוטה"'), 'NULL-safe draft filter');
  assert.ok(!/notIn|"<>"/.test(w), 'never a bare notIn/<> on Order.status');
  assert.ok(w.includes('"takenDate":{"not":null}') && w.includes('"isTaken":true'), 'taken = isTaken OR takenDate');
  assert.ok(w.includes('"returnDate":null') && w.includes('"isReturned":false'), 'not returned = neither isReturned nor returnDate');
  assert.ok(w.includes('"deliveryDirection":"הלוך"'), 'delivery returns excluded in SQL');
  assert.equal(late[0].args.take, LATE_SCAN_MAX + 1);
  assert.equal(late[0].args.select.customer, undefined, 'candidate query is light (no customer)');
  assert.deepEqual(late[1].args.where.orderId.in.sort(), [1017, 2004]);
  assert.equal(calls.filter((c) => c.model === 'dressModel').length, 1, 'prefix -> model name: one query');
  assert.equal(Object.keys(x.items).length, 3);
  assert.equal(x.lateWindowDays, LATE_WINDOW_DAYS);
});

test('late: not for a printed day in the past; not for delivery returns (stage 9), never-taken orders, future due dates; branch filter applies', async () => {
  // a day before "today": no late query at all (return state is of now, "late then" is unknowable)
  const past = await payloadFor('2026-10-14');
  assert.deepEqual(past.payload.pages[0].data.sections.map((s) => s.key), ['today']);
  assert.equal(globalThis.__MOCK_CALLS.filter((c) => c.model === 'order' && c.args.take === LATE_SCAN_MAX + 1).length, 0);
  // 1018 never taken, 1010 delivery round trip, 2002/2003/2006 due in the future: none of them is late on 15.10
  const { payload } = await payloadFor();
  const lateIds = payload.pages[0].data.sections[1].blocks.map((b) => b.orderId);
  for (const id of [1018, 1010, 2002, 2003, 2006, 1022]) assert.ok(!lateIds.includes(id), String(id));
  // a future printed day: 2004/1017 are still late (relative to that day), 2002 (due 1.11) is late on 3.11
  const future = await payloadFor('2026-11-03');
  const fl = future.payload.pages[0].data.sections.find((s) => s.key === 'late').blocks;
  assert.ok(fl.find((b) => b.orderId === 2004).lateDays > 23);
  assert.ok(fl.some((b) => b.orderId === 2002), 'due Sun 1.11 -> late on 3.11');
  // branch filter: only orders of that branch (Order.branch), like the stage rows
  const branchOrders = ORDERS.map((o) => (o.orderId === 1017 ? { ...o, branch: 'נווה יעקב' } : o));
  setup({ orders: branchOrders });
  const day = await getScheduleDay({ date: '2026-10-15', branch: 'נווה יעקב', user: { id: 'emp-head', roleId: 0 }, now: NOW });
  globalThis.__MOCK_CALLS.length = 0;
  const x = await loadManretDetail(day);
  assert.deepEqual(x.late.map((l) => l.orderId), [1017]);
  // the branch filter is part of the SQL where (applied BEFORE take), not only a JS filter after it
  const cand = globalThis.__MOCK_CALLS.find((c) => c.model === 'order' && c.args.take === LATE_SCAN_MAX + 1);
  assert.ok(JSON.stringify(cand.args.where).includes('"branch":"נווה יעקב"'));
});

test('late: an item taken only by takenDate (isTaken false) counts; due date + days late come from lib/lateReturn.js', async () => {
  const orders = ORDERS.map((o) => (o.orderId === 1017 ? { ...o, items: [{ ...o.items[0], isTaken: false, takenDate: new Date('2026-10-04T08:00:00Z') }] } : o));
  setup({ orders });
  const { day } = await payloadFor();
  const x = await loadManretDetail(day);
  const l = x.late.find((r) => r.orderId === 1017);
  assert.ok(l, 'takenDate alone = taken');
  const { getLateReturnInfo } = await L('lib/lateReturn.js');
  const info = getLateReturnInfo(ORDERS.find((o) => o.orderId === 1017), 1, { now: new Date('2026-10-15T09:00:00Z') });
  assert.equal(l.dueKey, info.dueKey);
  assert.equal(l.daysLate, info.daysLate);
});

test('late: more than LATE_MAX late orders -> the most late are kept, lateTruncated is set and printed as a notice', async () => {
  const extraLate = [];
  for (let i = 0; i < LATE_MAX + 20; i++) {
    // events on Israel days 9.10 back to 10.9 (21:00Z = Israel midnight of the NEXT day); all taken, none returned -> all late
    const ev = new Date(Date.UTC(2026, 8, 38 - (i % 30), 21, 0, 0));
    extraLate.push({ ...ORDERS.find((o) => o.orderId === 1017), orderId: 50000 + i, eventDate: ev, items: [{ ...ORDERS.find((o) => o.orderId === 1017).items[0], id: 'x' + i }] });
  }
  setup({ orders: [...ORDERS, ...extraLate] });
  const { payload, extras } = await payloadFor();
  const x = extras.manretDetail;
  assert.equal(x.late.length, LATE_MAX);
  assert.equal(x.lateTruncated, true);
  const days = x.late.map((l) => l.daysLate);
  assert.deepEqual(days, [...days].sort((a, b) => b - a), 'most late first');
  // every dropped order is at most as late as the least-late one kept
  const kept = new Set(x.late.map((l) => l.orderId));
  const minKept = Math.min(...days);
  const { getLateReturnInfo } = await L('lib/lateReturn.js');
  for (const o of [...ORDERS, ...extraLate]) {
    if (kept.has(o.orderId) || !(o.orderId >= 50000)) continue;
    const info = getLateReturnInfo(o, 1, { now: new Date('2026-10-15T09:00:00Z') });
    assert.ok(info.daysLate <= minKept, `dropped ${o.orderId} (${info.daysLate}) is not later than kept min ${minKept}`);
  }
  const { printNotices } = await L('lib/schedule/print/notices.js');
  assert.ok(printNotices(payload).some((n) => n.includes(String(LATE_MAX))), 'notice printed');
});

test('late: items already returned stay listed with their state; an order with every item returned is not late', async () => {
  const orders = ORDERS.map((o) => {
    if (o.orderId === 1017) return { ...o, items: [{ ...o.items[0], id: 'a', isReturned: true, returnedOk: false }, { ...o.items[0], id: 'b' }] };
    if (o.orderId === 2004) return { ...o, items: [{ ...o.items[0], id: 'c', isReturned: true, returnedOk: true }] };
    return o;
  });
  setup({ orders });
  const { payload } = await payloadFor();
  const lateIds = payload.pages[0].data.sections[1].blocks.map((b) => b.orderId);
  assert.deepEqual(lateIds, [1017], '2004 fully returned -> gone; 1017 still has an unreturned item');
  const b = payload.pages[0].data.rows.find((x) => x.orderId === 1017);
  assert.deepEqual(b.items.map((i) => i.state).sort(), ['', 'הוחזר לא תקין'].sort());
});

test('build(): missing extras fall back to one placeholder row per dress; missing address is flagged; singular texts; non-today title; empty page', () => {
  const stage = (items) => ({ key: 'manret', enabled: true, items, offsetBusinessDays: 1 });
  const row = (over) => ({ orderId: 9, customer: { firstName: 'רות', lastName: 'כהן', name: 'רות כהן', phone1: '052-1', phone2: '' }, address: { street: '', city: 'חיפה', full: 'חיפה' }, dressCount: 2, eventKey: '2026-10-14', ...over });
  const day = { date: '2026-10-15', isToday: false, today: '2026-10-01', settings: { lateReturnThresholdDays: 3 }, stages: [stage([row()])] };
  const d = PP16.build({ day, page: def, extras: {} });
  assert.match(d.sub, /^מי מחזירה בסניף יום חמישי .* · פירוט לכל פריט$/, 'date-aware wording when the printed day is not today');
  assert.match(d.sections[0].label, /^מחזירות ביום /);
  const b = d.rows[0];
  assert.equal(b.addressMissing, true);
  assert.equal(b.city, 'חיפה');
  assert.equal(b.itemCount, 2);
  assert.deepEqual(b.items.map((i) => [i.n, i.of, i.model, i.size]), [[1, 2, '', ''], [2, 2, '', '']]);
  assert.match(d.sections[0].note, /^אירוע יום /, 'one event day');
  assert.equal(d.sum, 'החזרה אחת · 2 פריטים');
  // two event days -> a range
  const two = PP16.build({ day: { ...day, stages: [stage([row(), row({ orderId: 10, eventKey: '2026-10-16' })])] }, page: def, extras: {} });
  assert.match(two.sections[0].note, /^אירועים .* עד .* · 2 החזרות$/);
  // lateness uses the threshold of the day settings
  const late = PP16.build({ day: { ...day, stages: [stage([])] }, page: def, extras: { manretDetail: { late: [{ orderId: 5, customer: { lastName: 'לוי' }, street: 'א 1', city: 'ב', daysLate: 3, items: [] }, { orderId: 6, customer: { lastName: 'כץ' }, street: 'א 2', city: 'ב', daysLate: 2, items: [] }] } } });
  assert.deepEqual(late.rows.map((r) => [r.orderId, r.lateSevere]), [[5, true], [6, false]], 'threshold 3 from settings');
  assert.equal(late.sections[0].note, 'אין החזרות מתוכננות');
  assert.equal(PP16.lateText(1), 'באיחור יום אחד');
  assert.equal(PP16.lateText(9), 'באיחור 9 ימים');
  // nothing at all -> empty
  assert.equal(PP16.build({ day: { ...day, stages: [stage([])] }, page: def, extras: {} }).empty, true);
  assert.equal(PP16.build({ day: { ...day, stages: [] }, page: def, extras: {} }).empty, true);
  // a disabled stage prints nothing
  assert.equal(PP16.build({ day: { ...day, stages: [{ ...stage([row()]), enabled: false }] }, page: def, extras: {} }).empty, true);
});

test('toRows: one row per item, numbers stay numbers, Excel sheet accepts it', async () => {
  const { payload } = await payloadFor();
  const rows = PP16.toRows(payload.pages[0].data);
  assert.equal(rows.length, 5);
  assert.deepEqual(Object.keys(rows[0]), ['קבוצה', 'הזמנה', 'משפחה', 'טלפון', 'כתובת', 'ברקוד', 'פריט', 'מתוך', 'דגם', 'מידה', 'מצב בלו״ז', 'ימי איחור']);
  const r14 = rows.find((r) => r['הזמנה'] === 1014);
  assert.equal(r14['מצב בלו״ז'], 'הוחזר לא תקין');
  assert.equal(r14['קבוצה'], 'מחזירות היום');
  assert.equal(r14['ברקוד'], 'MRT-1014');
  assert.equal(typeof r14['מידה'], 'number');
  assert.equal(rows.find((r) => r['הזמנה'] === 2004)['ימי איחור'], 23);
  const wb = buildScheduleWorkbook(XLSX, [{ sheetName: PP16.SHEET_NAME, rows }]);
  assert.equal(wb.SheetNames[0], 'קבלת החזרות');
  assert.equal(wb.Sheets['קבלת החזרות'].B2.t, 'n');
  assert.equal(wb.Sheets['קבלת החזרות'].D2.t, 's', 'phone stays text');
  assert.deepEqual(PP16.toRows({ sections: [] }), []);
});

test('API: any employee with page:schedule may print it (no money, no extra page key); blocked department gets 403; rows export counts items', async () => {
  const get = (qs) => route.GET({ url: 'http://localhost/api/schedule/print' + qs });
  globalThis.__AUTH_TOKEN = 'emp-worker-blocked';
  assert.equal((await get('?page=PP-16&date=2026-10-15')).status, 403);
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const r = await get('?page=PP-16&date=2026-10-15');
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  const p = r.__json.pages[0];
  assert.equal(p.key, 'PP-16');
  assert.equal(p.pageCode, 'ALL-MRT-261015');
  assert.equal(p.def.barcode.rows, 'order');
  // (the route uses the real clock, not the mock NOW, so the late list depends on when the test runs - only the day's own returns are asserted)
  assert.equal(p.data.totals.today, 3);
  // JSON-safe (functions never ride the payload)
  assert.doesNotThrow(() => JSON.stringify(p.data));
  assert.ok(!('lateText' in p.data));
  // Excel = management only (JDG-04, same rule as the XL button); the worker gets 403, head management the rows
  assert.equal((await get('?page=PP-16&date=2026-10-15&format=rows')).status, 403);
  globalThis.__AUTH_TOKEN = 'emp-head';
  const rows = await get('?page=PP-16&date=2026-10-15&format=rows');
  assert.equal(rows.status, 200);
  assert.equal(rows.__json.sheets[0].sheetName, 'קבלת החזרות');
  assert.equal(rows.__json.total, p.data.totals.items);
  // the day without returns on a closed day: an empty-but-valid page
  const empty = await get('?page=PP-16&date=2026-10-03');
  assert.equal(empty.status, 200);
  assert.equal(empty.__json.pages[0].data.empty, empty.__json.pages[0].data.rows.length === 0);
});

test('standard_return_hour setting feeds the instruction line; a bad value falls back to 13:00', async () => {
  setup({ extra: { systemSetting: [{ key: 'standard_return_hour', value: '12:30' }, { key: 'require_login', value: 'true' }] } });
  assert.equal((await payloadFor()).payload.pages[0].data.returnHour, '12:30');
  setup({ extra: { systemSetting: [{ key: 'standard_return_hour', value: 'מאוחר' }, { key: 'require_login', value: 'true' }] } });
  assert.equal((await payloadFor()).payload.pages[0].data.returnHour, '13:00');
});
