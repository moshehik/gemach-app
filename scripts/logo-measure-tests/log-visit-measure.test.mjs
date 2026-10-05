// POST /api/log-visit - שדות המדידה האופציונליים + סבילות ל-DB בלי העמודות (הקוד נפרס לפני ה-DDL). prisma בזיכרון, בלי DB.
//   node --import ./scripts/logo-measure-tests/register.mjs --test scripts/logo-measure-tests/log-visit-measure.test.mjs
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const route = await L('app/api/log-visit/route.js');
const VM = await L('lib/visitLogMeasure.js');

const post = (body) => route.POST(new Request('http://localhost/api/log-visit', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }));
const warn = console.warn;

beforeEach(() => {
  globalThis.__VISITS = []; globalThis.__MOCK_CALLS.length = 0; globalThis.__AUTH = true;
  globalThis.__VISIT_COLUMNS_MISSING = false; globalThis.__VISIT_FAIL_ALWAYS = false;
  globalThis.__COOKIES = { auth_token: 'emp-1' }; globalThis.__EMPLOYEES = { 'emp-1': { firstName: 'דנה', lastName: 'כהן' } };
  VM.__resetVisitMeasureStateForTests();
  console.warn = () => {};
});
test.afterEach(() => { console.warn = warn; });

test('שדות מדידה תקינים נשמרים (serverCpuMs מעוגל ל-int, navigationType, serverBootId)', async () => {
  const res = await post({ entries: [
    { pageUrl: '/orders', navigationType: 'navigate+newtab' },
    { pageUrl: '/api/orders?limit=50', executionTime: 120, responseSize: 900, serverCpuMs: '12.6', serverBootId: 'a1b2c3d4e5f6' },
  ] });
  assert.equal((await res.json()).success, true);
  const [a, b] = globalThis.__VISITS;
  assert.equal(a.navigationType, 'navigate+newtab');
  assert.equal(a.serverCpuMs, undefined);
  assert.equal(b.serverCpuMs, 13);
  assert.equal(b.serverBootId, 'a1b2c3d4e5f6');
  assert.equal(b.employeeName, 'דנה כהן');
});

test('ערכים לא תקינים נזרקים בשקט (לא מפילים את האצווה)', async () => {
  await post({ entries: [{ pageUrl: '/x', serverCpuMs: 'abc', navigationType: '<script>', serverBootId: 'bad id!' }, { pageUrl: '/y', serverCpuMs: -5 }, { pageUrl: '/z', serverCpuMs: null, navigationType: 123 }] });
  assert.equal(globalThis.__VISITS.length, 3);
  for (const v of globalThis.__VISITS) { assert.equal(v.serverCpuMs, undefined); assert.equal(v.navigationType, undefined); assert.equal(v.serverBootId, undefined); }
});

test('קליינט ישן (בלי שדות מדידה): בדיוק כמו קודם, ללא שדות מדידה בשורה', async () => {
  await post({ pageUrl: '/orders', loadingError: null });
  assert.equal(globalThis.__VISITS.length, 1);
  assert.deepEqual(Object.keys(globalThis.__VISITS[0]).filter((k) => ['serverCpuMs', 'navigationType', 'serverBootId'].includes(k)), []);
});

test('DB בלי העמודות: ה-insert נכשל (P2022), נכתב שוב בלי השדות - השורה לא אובדת', async () => {
  globalThis.__VISIT_COLUMNS_MISSING = true;
  const res = await post({ entries: [{ pageUrl: '/api/orders', serverCpuMs: 9, navigationType: 'spa', executionTime: 5 }] });
  assert.equal((await res.json()).success, true);
  assert.equal(globalThis.__VISITS.length, 1);
  assert.equal(globalThis.__VISITS[0].pageUrl, '/api/orders');
  assert.equal(globalThis.__VISITS[0].executionTime, 5);
  assert.equal(globalThis.__VISITS[0].serverCpuMs, undefined);
  const creates = globalThis.__MOCK_CALLS.filter((c) => c.op === 'createMany');
  assert.equal(creates.length, 2, 'one failed attempt + one retry');
});

test('אחרי כשל אחד האינסטנס זוכר: בקשות הבאות כותבות ישר בלי השדות (ניסיון אחד בלבד)', async () => {
  globalThis.__VISIT_COLUMNS_MISSING = true;
  await post({ entries: [{ pageUrl: '/a', serverCpuMs: 1 }] });
  globalThis.__MOCK_CALLS.length = 0;
  await post({ entries: [{ pageUrl: '/b', serverCpuMs: 2 }] });
  assert.equal(globalThis.__MOCK_CALLS.filter((c) => c.op === 'createMany').length, 1);
  assert.equal(globalThis.__VISITS.length, 2);
});

test('אחרי ה-DDL (העמודות קיימות) ובפקיעת ההשהיה - חוזרים לכתוב את השדות', async () => {
  globalThis.__VISIT_COLUMNS_MISSING = true;
  await post({ entries: [{ pageUrl: '/a', serverCpuMs: 1 }] });
  globalThis.__VISIT_COLUMNS_MISSING = false;
  // מדמים שעברו 6 דקות
  const rows = [{ pageUrl: '/c', serverCpuMs: 7, employeeId: null, employeeName: 'אורח', isGuest: true }];
  await VM.createVisitLogs((await L('app/lib/prisma.js')).default, rows, () => Date.now() + 6 * 60 * 1000);
  assert.equal(globalThis.__VISITS.at(-1).serverCpuMs, 7);
});

test('שגיאה אחרת (DB נפל) לא נבלעת כ"עמודה חסרה": ה-route מחזיר success:false ולא משבש את הקליינט', async () => {
  globalThis.__VISIT_FAIL_ALWAYS = true;
  const res = await post({ entries: [{ pageUrl: '/a', serverCpuMs: 1 }] });
  const j = await res.json();
  assert.equal(j.success, false);
  assert.equal(res.status, 200);
});

test('isMissingMeasureColumnError: P2022, הודעת Postgres, ו-Unknown argument של לקוח ישן; לא שגיאות אחרות', () => {
  assert.equal(VM.isMissingMeasureColumnError({ code: 'P2022' }), true);
  assert.equal(VM.isMissingMeasureColumnError(new Error('column "serverCpuMs" of relation "PageVisitLog" does not exist')), true);
  assert.equal(VM.isMissingMeasureColumnError(new Error('Unknown argument `serverBootId`. Available options are marked with ?.')), true);
  assert.equal(VM.isMissingMeasureColumnError(new Error('Connection terminated')), false);
  assert.equal(VM.isMissingMeasureColumnError(null), false);
});

test('לא מחובר => 401', async () => {
  globalThis.__AUTH = false;
  assert.equal((await post({ pageUrl: '/x' })).status, 401);
});
