// "הושכר = ההכנה בוצעה" (בעלים 2026-10-06): lib/schedule/autoPrepMark.js מחובר ל-rentals/toggle (לקיחה / החזרה), rentals/confirm (גורף) ו-returns/scan. הראוטים האמיתיים רצים מעל
// התוסף האמיתי של app/lib/prisma.js (שורת AuditLog + employeeId מהעוגייה) ומסד בזיכרון (actor-fake-client.mjs). בודק: נרשמת שורת prep עם source 'auto' ו-markedById של העובדת,
// אידמפוטנטי, לא נוגע בסימון/ביטול קיים של אדם, נכשל בשקט (פעולת ההשכרה לא נופלת), טבלה חסרה = דילוג, "בטל השכרה" לא מבטל את הסימון.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const PROJ = process.env.PROJ;
const SHIMS = path.join(PROJ, 'scripts', 'schedule-tests', 'shims');
const fileUrl = (p) => pathToFileURL(p).href;
const hooks = `
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const PROJ = ${JSON.stringify(PROJ)};
const NS = ${JSON.stringify(fileUrl(path.join(SHIMS, 'next-server.mjs')))};
const NH = ${JSON.stringify(fileUrl(path.join(SHIMS, 'next-headers.mjs')))};
const FAKE = ${JSON.stringify(fileUrl(path.join(PROJ, 'scripts', 'order-card-tests', 'actor-fake-client.mjs')))};
async function tryResolve(spec, ctx, next) {
  try { return await next(spec, ctx); } catch (e) { for (const suf of ['.js', '/index.js', '.mjs']) { try { return await next(spec + suf, ctx); } catch {} } throw e; }
}
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/server') return { url: NS, shortCircuit: true };
  if (specifier === 'next/headers') return { url: NH, shortCircuit: true };
  if (specifier === '@prisma/client') return { url: FAKE, shortCircuit: true };
  if (specifier.startsWith('@/')) specifier = pathToFileURL(path.join(PROJ, specifier.slice(2))).href;
  return tryResolve(specifier, context, nextResolve);
}
`;
register('data:text/javascript,' + encodeURIComponent(hooks));
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://fake:fake@127.0.0.1:1/fake';

const { test, beforeEach } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const fs = await import('node:fs');
const L = (rel) => import(fileUrl(path.join(PROJ, rel)));
const toggle = await L('app/api/rentals/toggle/route.js');
const retScan = await L('app/api/returns/scan/route.js');
const confirm = await L('app/api/rentals/confirm/route.js');
const auto = await L('lib/schedule/autoPrepMark.js');
const marksMod0 = await L('lib/schedule/marks.js');

const post = (body, method = 'POST') => ({ method, url: 'http://x/api', headers: new Map(), json: async () => body });
const FUTURE_EVENT = new Date(Date.now() + 10 * 864e5);
const item = (id, over = {}) => ({ id, orderId: 53375, barcode: null, isTaken: false, takenDate: null, isReturned: false, returnedOk: false, returnDate: null, isDeleted: false, dressItemId: null, order: { orderId: 53375, eventDate: FUTURE_EVENT }, ...over });
const marks = () => (globalThis.__MOCK_DB.scheduleStageMark || []);
const audits = () => globalThis.__MOCK_DB.auditLog;
const as = (id) => { globalThis.__AUTH_TOKEN = id; };

beforeEach(() => {
  auto.resetAutoPrepMemo();
  marksMod0.resetMarksTableState();
  globalThis.__MOCK_CALLS = [];
  globalThis.__MOCK_BEFORE_WRITE = undefined;
  globalThis.__MOCK_WRITABLE = ['orderItem', 'auditLog', 'dressItem', 'scheduleStageMark'];
  globalThis.__MOCK_DB = {
    order: [{ orderId: 53375, isDeleted: false, orderDate: new Date(), eventDate: FUTURE_EVENT, isAbroad: false, isDelivery: false, items: [
      item('it1'), item('it2', { barcode: '4538010' }), item('it3', { isTaken: true, takenDate: new Date('2026-10-06T08:00:00Z'), barcode: '3136010' }),
    ] }],
    auditLog: [], systemSetting: [], dressItem: [], employee: [], scheduleStageMark: [],
  };
  as('emp-rachel');
});

test('לקיחה (rentals/toggle rent): נרשמת הכנה אוטומטית - source auto, markedById = העובדת, שורת AuditLog SCHEDULE_STAGE_DONE עם העובדת; לקיחה שנייה לא יוצרת כפילות', async () => {
  const r = await toggle.POST(post({ itemId: 'it1', action: 'rent' }));
  assert.equal(r.status, 200);
  assert.equal(marks().length, 1);
  const m = marks()[0];
  assert.equal(m.stageKey, 'prep');
  assert.equal(m.source, 'auto');
  assert.equal(m.done, true);
  assert.equal(m.markedById, 'emp-rachel');
  assert.match(m.dayKey, /^\d{4}-\d{2}-\d{2}$/);
  const a = audits().filter((x) => x.action === 'SCHEDULE_STAGE_DONE');
  assert.equal(a.length, 1);
  assert.equal(a[0].employeeId, 'emp-rachel');
  assert.equal(a[0].entityType, 'ScheduleStageMark');
  as('emp-david');
  await toggle.POST(post({ itemId: 'it2', action: 'rent' }));
  assert.equal(marks().length, 1, 'אידמפוטנטי - אין סימון שני');
  assert.equal(marks()[0].markedById, 'emp-rachel', 'הסימון המקורי נשמר');
  assert.equal(audits().filter((x) => x.action === 'SCHEDULE_STAGE_DONE').length, 1);
});

test('אישור גורף (rentals/confirm) ושורת ההחזרה (returns/scan, toggle return): גם הם מסמנים הכנה', async () => {
  as('emp-david');
  const c = await confirm.POST(post({ orderId: 53375 }));
  assert.equal(c.status, 200, JSON.stringify(c.__json));
  assert.equal(marks().length, 1);
  assert.equal(marks()[0].markedById, 'emp-david');
  globalThis.__MOCK_DB.scheduleStageMark = [];
  auto.resetAutoPrepMemo();
  as('emp-sara');
  const r = await retScan.POST(post({ barcode: '3136010', orderId: 53375 }));
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  assert.equal(marks().length, 1);
  assert.equal(marks()[0].markedById, 'emp-sara');
  globalThis.__MOCK_DB.scheduleStageMark = [];
  auto.resetAutoPrepMemo();
  globalThis.__MOCK_DB.order[0].items[0].isTaken = true;
  const t = await toggle.POST(post({ itemId: 'it1', action: 'return' }));
  assert.equal(t.status, 200);
  assert.equal(marks().length, 1);
});

test('סימון קיים של אדם (גם "בוטל") לא נדרס; הזמנה מבוטלת / בלי לקיחה / בלי שלב הכנה - דילוג', async () => {
  globalThis.__MOCK_DB.scheduleStageMark = [{ id: 'm1', orderId: 53375, stageKey: 'prep', dayKey: '2026-10-01', done: false, markedById: null, undoneById: 'emp-sara', source: 'row' }];
  await toggle.POST(post({ itemId: 'it1', action: 'rent' }));
  assert.equal(marks().length, 1);
  assert.equal(marks()[0].done, false, 'הביטול של האדם נשמר');
  globalThis.__MOCK_DB.scheduleStageMark = [];
  auto.resetAutoPrepMemo();
  assert.deepEqual(await auto.autoMarkPrepForOrder(53375, { userId: null }), { status: 'marked', dayKey: marks()[0].dayKey });
  globalThis.__MOCK_DB.scheduleStageMark = [];
  auto.resetAutoPrepMemo();
  globalThis.__MOCK_DB.order[0].items.forEach((i) => { i.isTaken = false; i.takenDate = null; });
  assert.equal((await auto.autoMarkPrepForOrder(53375)).status, 'not-taken');
  globalThis.__MOCK_DB.order[0].items[0].isTaken = true;
  globalThis.__MOCK_DB.order[0].isDeleted = true;
  assert.equal((await auto.autoMarkPrepForOrder(53375)).status, 'skipped');
  globalThis.__MOCK_DB.order[0].isDeleted = false;
  globalThis.__MOCK_DB.order[0].eventDate = null;
  assert.equal((await auto.autoMarkPrepForOrder(53375)).status, 'no-prep-stage');
  assert.equal((await auto.autoMarkPrepForOrder('abc')).status, 'skipped');
  assert.equal(marks().length, 0);
});

test('כישלון בהכנה האוטומטית (כתיבה נכשלת / טבלה חסרה) לא מפיל את ההשכרה', async () => {
  globalThis.__MOCK_BEFORE_WRITE = (model) => { if (model === 'scheduleStageMark') throw new Error('boom'); };
  const origErr = console.error;
  console.error = () => {};
  try {
    const r = await toggle.POST(post({ itemId: 'it1', action: 'rent' }));
    assert.equal(r.status, 200, 'ההשכרה הצליחה');
    assert.equal(globalThis.__MOCK_DB.order[0].items[0].isTaken, true);
    assert.equal(marks().length, 0);
    globalThis.__MOCK_BEFORE_WRITE = undefined;
    delete globalThis.__MOCK_DB.scheduleStageMark; // הטבלה חסרה (P2021)
    const r2 = await toggle.POST(post({ itemId: 'it2', action: 'rent' }));
    assert.equal(r2.status, 200);
    assert.equal((await auto.autoMarkPrepForOrder(53375)).status, 'no-table');
  } finally { console.error = origErr; }
});

test('כללי הריפו: בלי $transaction ובלי כתיבת AuditLog ידנית ב-autoPrepMark; "בטל השכרה" לא נוגע בסימון; תיקונים (alterationDone) לא נכתב אוטומטית', () => {
  const src = fs.readFileSync(path.join(PROJ, 'lib/schedule/autoPrepMark.js'), 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/\$transaction/.test(src));
  assert.ok(!/auditLog\./.test(src));
  assert.ok(!/alterationDone/.test(src.replace(/alterationDone: true,/g, '')), 'אין כתיבת alterationDone');
  assert.ok(/writeMark\(/.test(src));
  const cancel = fs.readFileSync(path.join(PROJ, 'app/api/rentals/cancel/route.js'), 'utf8');
  assert.ok(!/scheduleStageMark|autoPrepMark/.test(cancel), 'ביטול השכרה לא מבטל את הסימון');
  // toggle / confirm: אחרי התשובה (after() דרך runAfterResponse, במקביל לתיקון המשוער); returns/scan: bounded כמקודם
  for (const f of ['app/api/rentals/toggle/route.js', 'app/api/rentals/confirm/route.js']) { const s = fs.readFileSync(path.join(PROJ, f), 'utf8'); assert.match(s, /autoMarkPrepForOrder\(/); assert.match(s, /runAfterResponse\(/); }
  assert.match(fs.readFileSync(path.join(PROJ, 'app/api/returns/scan/route.js'), 'utf8'), /autoMarkPrepBounded\(/);
});

test('שורת היומן של סימון אוטומטי נושאת auto:true + source:auto ב-changes (ההיסטוריה מתייגת לפי זה); סימון ידני בלעדיהם', async () => {
  await toggle.POST(post({ itemId: 'it1', action: 'rent' }));
  const a = audits().find((x) => x.action === 'SCHEDULE_STAGE_DONE');
  const c = JSON.parse(a.changesJson);
  assert.equal(c.auto, true);
  assert.equal(c.source, 'auto');
  assert.equal(c.scheduleStage, 'הכנה');
  const marksMod = await L('lib/schedule/marks.js');
  const before = audits().length;
  await marksMod.writeMark({ orderId: 53375, stageKey: 'repair', dayKey: '2026-10-05', wanted: true, source: 'row', userId: 'emp-rachel', now: new Date(), stageLabel: 'תיקונים' });
  const manual = JSON.parse(audits()[before].changesJson);
  assert.ok(!('auto' in manual) && !('source' in manual));
});

test('ביצועים: זיכרון קצר-טווח - הזמנה מסומנת / בלי שלב הכנה לא מבצעת findFirst/findUnique נוספים; טבלה חסרה = מטמון 5 דקות (אין ניסיון חוזר)', async () => {
  const reads = () => globalThis.__MOCK_CALLS.filter((c) => c.model === 'scheduleStageMark' || c.model === 'order').length;
  assert.equal((await auto.autoMarkPrepForOrder(53375, { userId: 'emp-a' })).status, 'marked');
  const afterFirst = reads();
  assert.ok(afterFirst >= 2);
  assert.equal((await auto.autoMarkPrepForOrder(53375, { userId: 'emp-a' })).status, 'exists');
  assert.equal(reads(), afterFirst, 'הקריאה השנייה: אפס שאילתות');
  auto.resetAutoPrepMemo();
  globalThis.__MOCK_DB.scheduleStageMark = [];
  auto.resetAutoPrepMemo();
  globalThis.__MOCK_DB.order[0].eventDate = null;
  assert.equal((await auto.autoMarkPrepForOrder(53375, { userId: 'emp-a' })).status, 'no-prep-stage');
  const n = reads();
  assert.equal((await auto.autoMarkPrepForOrder(53375, { userId: 'emp-a' })).status, 'no-prep-stage');
  assert.equal(reads(), n, 'no-prep-stage זכור - בלי שאילתות');
  // טבלה חסרה: ניסיון אחד, אחריו מטמון
  auto.resetAutoPrepMemo();
  delete globalThis.__MOCK_DB.scheduleStageMark;
  const origErr = console.error;
  console.error = () => {};
  try {
    assert.equal((await auto.autoMarkPrepForOrder(53375, { userId: 'emp-a' })).status, 'no-table');
    const m = globalThis.__MOCK_CALLS.length;
    assert.equal((await auto.autoMarkPrepForOrder(53375, { userId: 'emp-a' })).status, 'no-table');
    assert.equal(globalThis.__MOCK_CALLS.length, m, 'מטמון הטבלה החסרה: אפס שאילתות');
  } finally { console.error = origErr; }
});

test('autoMarkPrepBounded: לא מוסיף השהיה - עבודה איטית מחזירה timeout אחרי ה-bound; עבודה מהירה מחזירה את התוצאה; מזהה העובדת נקרא לפני ה-await הראשון', async () => {
  globalThis.__MOCK_BEFORE_WRITE = () => { const t = Date.now(); while (Date.now() - t < 5) { /* busy */ } };
  const fast = await auto.autoMarkPrepBounded(53375, { userId: 'emp-a' }, 1500);
  assert.equal(fast.status, 'marked');
  globalThis.__MOCK_BEFORE_WRITE = undefined;
  globalThis.__MOCK_DB.scheduleStageMark = [];
  auto.resetAutoPrepMemo();
  auto.resetAutoPrepMemo();
  const slowDb = globalThis.__MOCK_DB.order;
  // findFirst איטי: עוטפים את שדה הסימונים ב-getter שמחכה
  const t0 = Date.now();
  const slow = await Promise.race([
    auto.autoMarkPrepBounded('53375', { userId: 'emp-a', now: new Date() }, 30),
    new Promise((r) => setTimeout(() => r({ status: 'never' }), 1000)),
  ]);
  assert.ok(['marked', 'timeout'].includes(slow.status));
  assert.ok(Date.now() - t0 < 900, 'חזר בתוך ה-bound');
  assert.ok(slowDb);
  const src = fs.readFileSync(path.join(PROJ, 'lib/schedule/autoPrepMark.js'), 'utf8');
  const body = src.slice(src.indexOf('export async function autoMarkPrepForOrder'));
  assert.ok(body.indexOf('await getActingEmployeeId()') < body.indexOf('await prisma.'), 'עוגיית העובדת לפני כל שאילתה');
  assert.match(src, /Promise\.race\(\[work, limit\]\)/);
  assert.match(src, /AUTO_PREP_TIMEOUT_MS = 1500/);
});
