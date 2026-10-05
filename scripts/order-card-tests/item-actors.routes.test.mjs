// מי לקח / מי החזיר - הוכחה שהעובדת נרשמת בכל מסלול לקיחה/החזרה בשרת (הערת הבעלים 2026-10-05). הראוטים האמיתיים רצים מעל התוסף האמיתי של app/lib/prisma.js
// ($extends → rows של AuditLog עם employeeId מהעוגייה) ומסד בזיכרון (actor-fake-client.mjs). מסלולים: rentals/toggle (כפתורי השורה, שורת הסריקה, מצב הרצף, החזרה ידנית),
// returns/scan (החזרה בסריקה), rentals/confirm (אישור גורף - updateMany + רישום ידני), rentals/scan PUT (החזרה כפויה מהשכרה קודמת), lib/schedule/marks.js (סימון החזרה בלו״ז).
// 3 אזורי זמן (run.mjs). בלי DB.
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
const rentScan = await L('app/api/rentals/scan/route.js');
const J = await L('lib/history/orderJournal.js');

const EMP = { 'emp-rachel': 'רחל כהן', 'emp-david': 'דוד לוי', 'emp-sara': 'שרה' };
const post = (body, method = 'POST') => ({ method, url: 'http://x/api', headers: new Map(), json: async () => body });
const item = (id, over = {}) => ({ id, orderId: 53375, barcode: null, isTaken: false, takenDate: null, isReturned: false, returnedOk: false, returnDate: null, isDeleted: false, dressItemId: null, ...over });
const audits = () => globalThis.__MOCK_DB.auditLog;
const rowsOf = (action, id) => audits().filter((r) => r.action === action && r.entityId === id);
const as = (empId) => { globalThis.__AUTH_TOKEN = empId; };
// הצגת שמות כמו attachEmployeeNames, ואז הנגזרת שמוצגת בשורה
const actors = (items) => J.itemRentalActors(audits().map((r) => ({ ...r, employeeName: r.employeeId ? EMP[r.employeeId] || null : null })), items);

beforeEach(() => {
  globalThis.__MOCK_CALLS = [];
  globalThis.__MOCK_WRITABLE = ['orderItem', 'auditLog', 'dressItem'];
  globalThis.__MOCK_DB = {
    order: [{ orderId: 53375, eventDate: null, isDeleted: false, items: [
      item('it1'), item('it2', { barcode: '4538010' }), item('it3', { isTaken: true, takenDate: new Date('2026-10-06T08:00:00Z'), barcode: '3136010' }),
      item('it4', { isTaken: true, takenDate: new Date('2026-10-06T08:00:00Z'), barcode: '2740010' }),
    ] }],
    auditLog: [], systemSetting: [], dressItem: [], employee: [],
  };
  as('emp-rachel');
});

test('לקיחה בכפתור/שורת ברקוד/שורת סריקה/מצב רצף (rentals/toggle rent): CONFIRM_RENTAL עם העובדת המבצעת', async () => {
  const r = await toggle.POST(post({ itemId: 'it1', action: 'rent' }));
  assert.equal(r.status, 200);
  const rows = rowsOf('CONFIRM_RENTAL', 'it1');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].employeeId, 'emp-rachel');
  assert.equal(rows[0].entityType, 'OrderItem');
  assert.equal(JSON.parse(rows[0].changesJson).isTaken.to, true);
  const it = globalThis.__MOCK_DB.order[0].items[0];
  assert.equal(actors([it]).it1.took.who, 'רחל כהן');
});

test('החזרה בכפתור / ידנית / שורת סריקה / רצף (rentals/toggle return): RETURN_RENTAL עם העובדת; ביטול החזרה מנקה את "מי החזיר"', async () => {
  as('emp-david');
  const r = await toggle.POST(post({ itemId: 'it3', action: 'return' }));
  assert.equal(r.status, 200);
  const rows = rowsOf('RETURN_RENTAL', 'it3');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].employeeId, 'emp-david');
  const it = globalThis.__MOCK_DB.order[0].items[2];
  assert.equal(it.isReturned, true);
  assert.equal(actors([it]).it3.returned.who, 'דוד לוי');
  as('emp-sara');
  await toggle.POST(post({ itemId: 'it3', action: 'undoReturn' }));
  assert.equal(rowsOf('CANCEL_RETURN', 'it3')[0].employeeId, 'emp-sara');
  assert.equal(actors([it]).it3.returned, null, 'אחרי ביטול ההחזרה אין "מי החזיר"');
});

test('החזרה חלקית: רק הפריט שהוחזר מקבל עובדת; אחר נשאר בלי', async () => {
  as('emp-david');
  await toggle.POST(post({ itemId: 'it3', action: 'return' }));
  const items = globalThis.__MOCK_DB.order[0].items;
  const a = actors(items);
  assert.equal(a.it3.returned.who, 'דוד לוי');
  assert.equal(a.it4.returned, null);
  assert.equal(a.it4.took, null, 'לקיחה ישנה בלי שורת יומן (ייבוא) - אין שם, לא ממציאים');
});

test('החזרה בסריקת ברקוד (returns/scan POST): RETURN_RENTAL עם העובדת', async () => {
  as('emp-sara');
  const r = await retScan.POST(post({ barcode: '2740010', orderId: 53375 }));
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  const rows = rowsOf('RETURN_RENTAL', 'it4');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].employeeId, 'emp-sara');
});

test('אישור לקיחה גורף (rentals/confirm): updateMany + רישום ידני CONFIRM_RENTAL לכל פריט עם העובדת (התוסף לא רואה updateMany)', async () => {
  as('emp-david');
  const r = await confirm.POST(post({ orderId: 53375 }));
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  const rows = rowsOf('CONFIRM_RENTAL', 'it2');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].employeeId, 'emp-david');
  assert.equal(globalThis.__MOCK_DB.order[0].items[1].isTaken, true);
  assert.equal(actors(globalThis.__MOCK_DB.order[0].items).it2.took.who, 'דוד לוי');
});

test('החזרה כפויה מהשכרה קודמת (rentals/scan PUT): RETURN_RENTAL (לא UPDATE גנרי) עם העובדת - תוקן', async () => {
  as('emp-rachel');
  const r = await rentScan.PUT(post({ unreturnedItemId: 'it4' }, 'PUT'));
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  const rows = rowsOf('RETURN_RENTAL', 'it4');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].employeeId, 'emp-rachel');
  assert.equal(audits().filter((x) => x.entityId === 'it4' && x.action === 'UPDATE').length, 0, 'אין עוד שורת UPDATE גנרית כפולה');
  assert.equal(actors(globalThis.__MOCK_DB.order[0].items).it4.returned.who, 'רחל כהן');
});

test('בלי עוגיית כניסה (require_login כבוי): השורה נרשמת בלי עובדת (employeeId null) - אין שם, אין קריסה', async () => {
  as(null);
  const r = await toggle.POST(post({ itemId: 'it1', action: 'rent' }));
  assert.equal(r.status, 200);
  const rows = rowsOf('CONFIRM_RENTAL', 'it1');
  assert.equal(rows[0].employeeId, null);
  assert.equal(actors(globalThis.__MOCK_DB.order[0].items).it1.took.who, null);
});

test('סימון החזרה בלו״ז (lib/schedule/marks.js): prisma.orderItem.update(auditAs(RETURN_RENTAL)) - עובר בתוסף, לכן נרשמת העובדת', () => {
  const src = fs.readFileSync(path.join(PROJ, 'lib/schedule/marks.js'), 'utf8');
  assert.match(src, /prisma\.orderItem\.update\(auditAs\('RETURN_RENTAL', \{ where: \{ id: it\.id \}, data \}, changes\)\)/);
  assert.ok(!/orderItem\.updateMany/.test(src));
  // לקיחה / החזרה אחרות בשרת: אין orderItem.updateMany שמשנה isTaken/isReturned בלי רישום ידני עם employeeId
  const toggleSrc = fs.readFileSync(path.join(PROJ, 'app/api/rentals/toggle/route.js'), 'utf8');
  assert.match(toggleSrc, /prisma\.orderItem\.update\(auditAs\(\s*AUDIT_ACTIONS\[action\]/);
  const delSrc = fs.readFileSync(path.join(PROJ, 'app/api/returns/scan/route.js'), 'utf8');
  assert.match(delSrc, /const cancelledBy = await getActingEmployeeId\(\)/, 'ביטול החזרה גורף נרשם ידנית עם העובדת');
});
