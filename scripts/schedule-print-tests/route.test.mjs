// GET/POST /api/schedule/print עם lib/auth.js ו-lib/permissions.js האמיתיים (next/headers + prisma מוחלפים במוק):
// 401 בלי התחברות; 403 בלי page:schedule; 403 לדף מחירים (PP-01) לעובדת בלי page:orders; 200 להנהלה ראשית;
// 404 למפתח לא קיים / שהוסר; 501 לדף שעדיין לא נבנה; 400 לתאריך שגוי; תוכן PP-15 / PP-01 מול נתוני הדמה;
// format=rows + מגבלת הייצוא בשרת (D6); POST עם approvalPin.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { installDb, ORDERS, NOW } from '../schedule-tests/fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const route = await L('app/api/schedule/print/route.js');
const { invalidatePermissionCache } = await L('lib/permissions.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { invalidateRequireLoginCache } = await L('lib/auth.js');

const get = (qs = '') => route.GET({ url: 'http://localhost/api/schedule/print' + qs });
const post = (body) => route.POST({ json: async () => body });

// הזמנה 1001 (נרשמה 1.10, אירוע 15.10) מקבלת סכום + תשלומים; 1021 (לא שולם) סכום בלי תשלומים
const withMoney = ORDERS.map((o) => {
  if (o.orderId === 1001) return { ...o, totalAmount: 1200, isPaid: false, isDelivery: true, deliveryDirection: 'הלוך-חזור', payments: [{ amount: 400, isDeleted: false }, { amount: 100, isDeleted: true }] };
  if (o.orderId === 1021) return { ...o, totalAmount: 500, payments: [] };
  return o;
});

function setup(extra = {}) {
  installDb({ extra: { order: withMoney, ...extra } });
  // מוק הזמן: getScheduleDay משתמש ב-new Date() דרך ה-route; הבדיקות שולחות date מפורש אז "היום" לא משנה
  invalidateSettingsCache();
  invalidateRequireLoginCache();
  invalidatePermissionCache();
  globalThis.__AUTH_TOKEN = null;
}
beforeEach(() => setup());

test('401 when nobody is logged in', async () => {
  const r = await get('?page=PP-15&date=2026-10-01');
  assert.equal(r.status, 401);
});

test('403 for a department with page:schedule=false', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker-blocked';
  assert.equal((await get('?page=PP-15&date=2026-10-01')).status, 403);
});

test('400 / 404 / 501 parameter errors (after the gates)', async () => {
  globalThis.__AUTH_TOKEN = 'emp-head';
  assert.equal((await get('?page=PP-15&date=2026-13-01')).status, 400);
  assert.equal((await get('?date=2026-10-01')).status, 400, 'missing page');
  assert.equal((await get('?page=XX-01&date=2026-10-01')).status, 404);
  assert.equal((await get('?page=PP-14&date=2026-10-01')).status, 404, 'removed page');
  // "registered but not built yet": once every page is built no page stays 'todo', so flip one for the check
  // (the registry objects are shared module state - restored right after, also when the assertion fails)
  const reg = (await L('lib/schedule/print/registry.js')).getPrintPage('PP-16');
  const was = reg.status;
  reg.status = 'todo';
  let r;
  try { r = await get('?page=PP-16&date=2026-10-01'); } finally { reg.status = was; }
  assert.equal(r.status, 501, 'registered but not built yet');
  assert.deepEqual(r.__json.pages, ['PP-16']);
  assert.equal((await get('?page=PP-15&date=2026-10-01&format=csv')).status, 400);
});

test('PP-15 (events list): 200 for a regular employee; rows from stage 7 with group per event date, no barcode', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const r = await get('?page=PP-15&date=2026-10-01');
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  assert.equal(r.headers['Cache-Control'], 'no-store');
  const { meta, pages } = r.__json;
  assert.equal(meta.date, '2026-10-01');
  assert.match(meta.dateHebrew, /^יום חמישי · /);
  assert.equal(meta.dateGreg, '01/10/2026');
  assert.equal(meta.printedBy, 'עובדת רגילה');
  assert.equal(meta.gmach.name, 'גמ״ח שמלות', 'default name when gmach_name is not set');
  assert.equal(pages.length, 1);
  const p = pages[0];
  assert.equal(p.key, 'PP-15');
  assert.equal(p.version, null);
  assert.equal(p.pageCode, null, 'info page: no ALL-… code');
  assert.equal(p.def.barcode, null);
  assert.equal(p.data.title, 'רשימת אירועים');
  assert.equal(p.data.empty, false);
  const ids = p.data.groups.flatMap((g) => g.rows.map((x) => x.orderId));
  assert.ok(ids.includes(1011) && ids.includes(1012), 'event rows of 1.10 (incl. abroad range)');
  const row = p.data.groups.flatMap((g) => g.rows).find((x) => x.orderId === 1011);
  assert.equal(row.name, 'שושנה יוסף');
  assert.equal(row.phone, '050-1111111');
  assert.equal(row.city, 'ירושלים');
  assert.equal(row.receive, 'איסוף', 'no branch name (PQ-03)');
  assert.equal(row.ret, 'החזרה ידנית');
  assert.equal(p.data.totals.events, ids.length);
});

test('PP-01 (general orders report): 403 for an employee without page:orders, 200 for head management with money math', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const denied = await get('?page=PP-01&date=2026-10-01');
  assert.equal(denied.status, 403);
  assert.equal(denied.__json.page, 'PP-01');

  globalThis.__AUTH_TOKEN = 'emp-head';
  const r = await get('?page=PP-01&date=2026-10-01');
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  const p = r.__json.pages[0];
  assert.equal(p.data.title, 'דוח הזמנות כללי');
  const ids = p.data.rows.map((x) => x.orderId);
  assert.deepEqual(ids.sort(), [1001, 1002].sort(), 'orders registered on 1.10 (Israel day), not the draft, not the deleted one');
  const r1 = p.data.rows.find((x) => x.orderId === 1001);
  assert.equal(r1.total, 1200);
  assert.equal(r1.paid, 400, 'deleted payments are not summed');
  assert.equal(r1.balance, 800);
  assert.equal(r1.type, 'משלוח');
  assert.equal(r1.eventGreg, '15/10/2026');
  assert.match(r1.eventHebrew, /^יום /);
  const r2 = p.data.rows.find((x) => x.orderId === 1002);
  assert.equal(r2.total, null, 'no amount on the order -> empty, not 0');
  assert.equal(r2.type, 'איסוף');
  assert.equal(p.data.totals.total, 1200);
  assert.equal(p.data.totals.paid, 400);
  assert.equal(p.data.totals.balance, 800);
  assert.equal(p.data.stats.length, 5);
  // the extras query ran once, only for the orders of the page
  const calls = globalThis.__MOCK_CALLS.filter((c) => c.model === 'order' && c.args && c.args.select && c.args.select.payments);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args.where.orderId.in.sort(), [1001, 1002].sort());
});

test('several pages in one request: getScheduleDay runs once, pages keep request order', async () => {
  globalThis.__AUTH_TOKEN = 'emp-head';
  const r = await get('?page=PP-15,PP-01&date=2026-10-01&version=PP-03:b');
  assert.equal(r.status, 200);
  assert.deepEqual(r.__json.pages.map((p) => p.key), ['PP-15', 'PP-01']);
  const orderScans = globalThis.__MOCK_CALLS.filter((c) => c.model === 'order' && c.method === 'findMany' && c.args.where && c.args.where.orderDate);
  assert.equal(orderScans.length, 1, 'stage-1 query exactly once for both pages');
});

test('format=rows: flat Hebrew-column rows per sheet; server-side export limit (D6) and POST approvalPin', async () => {
  globalThis.__AUTH_TOKEN = 'emp-head';
  const ok = await get('?page=PP-01,PP-15&date=2026-10-01&format=rows');
  assert.equal(ok.status, 200, JSON.stringify(ok.__json));
  assert.equal(ok.__json.sheets.length, 2);
  const s01 = ok.__json.sheets.find((s) => s.key === 'PP-01');
  assert.equal(s01.sheetName, 'דוח הזמנות כללי');
  assert.deepEqual(Object.keys(s01.rows[0]), ['הזמנה', 'לקוחה', 'טלפון', 'תאריך אירוע', 'תאריך עברי', 'שמלות', 'סוג', 'חיוב', 'שולם', 'יתרה', 'הערה']);
  assert.equal(ok.__json.total, ok.__json.sheets.reduce((n, s) => n + s.rows.length, 0));
  assert.equal(ok.__json.limit, 200, 'catalog default for feature:export_max_rows');

  // limit 1 for department 5 -> the worker is over the limit
  setup({ departmentPermission: [{ roleId: 5, key: 'page:schedule', value: 'true' }, { roleId: 5, key: 'feature:export_max_rows', value: '1' }] });
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const over = await get('?page=PP-15&date=2026-10-01&format=rows');
  assert.equal(over.status, 403);
  assert.equal(over.__json.code, 'EXPORT_LIMIT');
  assert.equal(over.__json.limit, 1);
  assert.ok(over.__json.total > 1);
  // wrong / missing pin via POST -> still 403
  const bad = await post({ page: 'PP-15', date: '2026-10-01', format: 'rows', approvalPin: 'nope' });
  assert.equal(bad.status, 403);
  assert.equal(bad.__json.code, 'EXPORT_LIMIT');
  // json format is never limited (it is the print page, not an export)
  assert.equal((await get('?page=PP-15&date=2026-10-01')).status, 200);

  // limit 0 stays 0 ("every export needs approval", like ExportButtons) - it used to fall back to 200
  setup({ departmentPermission: [{ roleId: 5, key: 'page:schedule', value: 'true' }, { roleId: 5, key: 'feature:export_max_rows', value: '0' }] });
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const zero = await get('?page=PP-15&date=2026-10-01&format=rows');
  assert.equal(zero.status, 403, JSON.stringify(zero.__json));
  assert.equal(zero.__json.code, 'EXPORT_LIMIT');
  assert.equal(zero.__json.limit, 0);
});

test('a forbidden page is skipped (meta.skipped), not a 403 for the whole request; format=access lists the printable pages', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const mixed = await get('?page=PP-01,PP-15&date=2026-10-01');
  assert.equal(mixed.status, 200, JSON.stringify(mixed.__json));
  assert.deepEqual(mixed.__json.pages.map((p) => p.key), ['PP-15']);
  assert.deepEqual(mixed.__json.meta.skipped.map((x) => x.key), ['PP-01']);
  const rows = await get('?page=PP-01,PP-15&date=2026-10-01&format=rows');
  assert.equal(rows.status, 200);
  assert.deepEqual(rows.__json.sheets.map((x) => x.key), ['PP-15']);
  assert.deepEqual(rows.__json.meta.skipped.map((x) => x.key), ['PP-01']);
  // every requested page forbidden -> still 403
  const all = await get('?page=PP-01,PP-02&date=2026-10-01');
  assert.equal(all.status, 403);
  assert.deepEqual(all.__json.pages, ['PP-01', 'PP-02']);

  const acc = await get('?format=access');
  assert.equal(acc.status, 200);
  assert.ok(acc.__json.forbidden.includes('PP-01') && acc.__json.forbidden.includes('PP-02'));
  assert.ok(acc.__json.allowed.includes('PP-15') && acc.__json.allowed.includes('PP-07'));
  assert.equal(acc.__json.allowed.length + acc.__json.forbidden.length, 15);

  globalThis.__AUTH_TOKEN = 'emp-head';
  const head = await get('?format=access');
  assert.deepEqual(head.__json.forbidden, []);
  assert.equal((await get('?page=PP-01,PP-15&date=2026-10-01')).__json.meta.skipped.length, 0);

  globalThis.__AUTH_TOKEN = 'emp-worker-blocked';
  assert.equal((await get('?format=access')).status, 403, 'access needs page:schedule too');
});

test('parseExportLimit: 0 is a real limit, default only for missing / invalid values', async () => {
  const { parseExportLimit, DEFAULT_EXPORT_LIMIT } = await L('lib/schedule/print/exportLimit.js');
  assert.equal(parseExportLimit(0), 0);
  assert.equal(parseExportLimit('0'), 0);
  assert.equal(parseExportLimit('350'), 350);
  for (const v of [null, undefined, '', '  ', 'abc', -5]) assert.equal(parseExportLimit(v), DEFAULT_EXPORT_LIMIT, String(v));
});
