// מצב הזמנה בודדת של דפי הלו״ז (W7: A3 דף הכנה PP-07, A4 תעודת משלוח PP-12; ?orderId=N): התאמה לחוזה, שערים, 400/404, גרסה ב׳ בכפייה,
// הדף נבנה מההזמנה עצמה בלי קשר ליום, ואירוע ORDER_PRINTED של דף ההדפסה עומד בחוזה W0 (parseEventsRequest). נתוני הדמה של הלו״ז (1.10.2026).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { installDb } from '../schedule-tests/fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const route = await L('app/api/schedule/print/route.js');
const { invalidatePermissionCache } = await L('lib/permissions.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { invalidateRequireLoginCache } = await L('lib/auth.js');
const om = await L('lib/schedule/print/orderMode.js');
const { parseEventsRequest } = await L('lib/history/orderEvents.js');
const { payloadToRows } = await L('lib/schedule/print/data.js');

const get = (qs = '') => route.GET({ url: 'http://localhost/api/schedule/print' + qs });
beforeEach(() => {
  installDb({});
  invalidateSettingsCache(); invalidateRequireLoginCache(); invalidatePermissionCache();
  globalThis.__AUTH_TOKEN = 'emp-head';
});

// ---------- טהור ----------
test('parseOrderIdParam: ספרות בלבד, 1..2147483647; hasOrderIdParam מזהה גם ערך שגוי', () => {
  assert.equal(om.parseOrderIdParam('53375'), 53375);
  assert.equal(om.parseOrderIdParam(' 7 '), 7);
  for (const bad of ['', '0', '-3', '1.5', '12a', 'abc', '2147483648', '99999999999', null, undefined, '٣']) assert.equal(om.parseOrderIdParam(bad), null, String(bad));
  assert.equal(om.hasOrderIdParam('abc'), true);
  assert.equal(om.hasOrderIdParam(''), false);
  assert.equal(om.hasOrderIdParam(null), false);
});

test('orderModePageError / orderModeVersions: רק PP-07 ו-PP-12; דף הכנה = גרסה ב׳', () => {
  assert.equal(om.orderModePageError(['PP-07']), null);
  assert.equal(om.orderModePageError(['PP-07', 'PP-12']), null);
  assert.match(om.orderModePageError(['PP-01']), /PP-01/);
  assert.match(om.orderModePageError(['PP-07', 'PP-15']), /PP-15/);
  assert.ok(om.orderModePageError([]));
  assert.deepEqual(om.orderModeVersions(['PP-07', 'PP-12']), { 'PP-07': 'b' });
});

test('orderPrintPath: כתובת דף ההדפסה (+ downloadPdf) ו-null לדף/הזמנה לא תקינים', () => {
  assert.equal(om.orderPrintPath('PP-07', 53375), '/schedule/print/PP-07?orderId=53375&version=PP-07%3Ab');
  assert.equal(om.orderPrintPath('PP-12', 53375), '/schedule/print/PP-12?orderId=53375');
  assert.equal(om.orderPrintPath('PP-12', 53375, { downloadPdf: true }), '/schedule/print/PP-12?orderId=53375&downloadPdf=true');
  assert.equal(om.orderPrintPath('PP-01', 53375), null);
  assert.equal(om.orderPrintPath('PP-07', 'x'), null);
});

test('schedulePrintEventBody עומד בחוזה W0 (parseEventsRequest): ORDER_PRINTED, doc/sheet מתאימים, source print-page, clientEventId תקין ושונה לכל דף', () => {
  const a = om.schedulePrintEventBody({ orderId: 53375, pageKey: 'PP-07', loadId: 'pLoad123' });
  const b = om.schedulePrintEventBody({ orderId: 53375, pageKey: 'PP-12', loadId: 'pLoad123' });
  const pa = parseEventsRequest(a);
  const pb = parseEventsRequest(b);
  assert.equal(pa.ok, true, JSON.stringify(pa));
  assert.equal(pb.ok, true, JSON.stringify(pb));
  assert.deepEqual(pa.meta, { doc: 'prep', sheet: 'PP-07', source: 'print-page', batch: false });
  assert.deepEqual(pb.meta, { doc: 'delivery', sheet: 'PP-12', source: 'print-page', batch: false });
  assert.deepEqual(pa.orderIds, [53375]);
  assert.notEqual(a.clientEventId, b.clientEventId, 'אחרת השרת ידלג על הרישום השני כ"כפילות"');
  assert.equal(om.schedulePrintEventBody({ orderId: 53375, pageKey: 'PP-03', loadId: 'x' }), null);
  assert.equal(om.schedulePrintEventBody({ orderId: 'x', pageKey: 'PP-07', loadId: 'x' }), null);
  // בלי loadId / קצר מ-8 תווים - עדיין clientEventId חוקי
  assert.equal(parseEventsRequest(om.schedulePrintEventBody({ orderId: 5, pageKey: 'PP-07' })).ok, true);
});

// ---------- ה-API ----------
test('PP-12 להזמנה אחת: תעודה אחת בלבד, יום היציאה מחושב מההזמנה, meta.orderId, בלי תלות בפרמטר date', async () => {
  const r = await get('?page=PP-12&orderId=1009&date=2030-01-01');
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  const { meta, pages } = r.__json;
  assert.equal(meta.orderId, 1009);
  assert.equal(meta.date, '2026-10-01', 'יום היציאה (אירוע 2.10 פחות יום עסקים), לא ה-date שנשלח');
  assert.equal(pages.length, 1);
  const d = pages[0].data;
  assert.deepEqual(d.orders.map((o) => o.orderId), [1009]);
  assert.equal(d.orders[0].code, 'DOT-1009');
  assert.equal(d.orders[0].name, 'דבורה חן');
  assert.equal(d.orders[0].city, 'בית שמש');
  assert.equal(d.orders[0].dispatchGreg, '01/10/2026');
  assert.equal(d.orders[0].dressCount, 2);
  assert.equal(d.sum, 'תעודה אחת · 2 שמלות');
});

test('PP-12: הזמנה בלי משלוח הלוך / משלוח חזור בלבד = 400; הזמנה הלוך-חזור = 200 (גם בלי שהיא ביום המשלוח היום)', async () => {
  assert.equal((await get('?page=PP-12&orderId=1001')).status, 400, 'אין משלוח בכלל');
  assert.equal((await get('?page=PP-12&orderId=1010')).status, 200, 'הלוך-חזור');
  globalThis.__MOCK_DB.order = globalThis.__MOCK_DB.order.map((o) => (o.orderId === 1010 ? { ...o, deliveryDirection: 'חזור' } : o));
  const r = await get('?page=PP-12&orderId=1010');
  assert.equal(r.status, 400);
  assert.match(r.__json.error, /משלוח הלוך/);
});

test('PP-12 כשהמשלוחים כבויים בהגדרות = 400', async () => {
  installDb({ settings: [{ key: 'enable_deliveries', value: 'false' }, { key: 'require_login', value: 'true' }] });
  invalidateSettingsCache();
  const r = await get('?page=PP-12&orderId=1009');
  assert.equal(r.status, 400);
  assert.match(r.__json.error, /משלוחים כבויים/);
});

test('PP-07 להזמנה אחת: גרסה ב׳ בכפייה (גם עם version=a), גיליון לשורה אחת, ברקוד PRP-<הזמנה>, יום ההכנה מחושב מתאריך האירוע', async () => {
  const r = await get('?page=PP-07&orderId=1005&version=a');
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  const { meta, pages } = r.__json;
  assert.equal(meta.orderId, 1005);
  assert.equal(meta.date, '2026-10-01', 'אירוע ג׳ 6.10 פחות 3 ימי עסקים (שישי/שבת חג) = ה׳ 1.10');
  const p = pages[0];
  assert.equal(p.key, 'PP-07');
  assert.equal(p.version, 'b');
  assert.equal(p.data.rows.length, 1);
  assert.equal(p.data.rows[0].orderId, 1005);
  assert.equal(p.data.rows[0].code, 'PRP-1005');
  assert.equal(p.data.rows[0].isDelivery, false);
  assert.ok(p.data.rows[0].dresses.length >= 1);
  assert.equal(p.data.sub, 'הזמנה אחת בכל עמוד');
});

test('PP-07 להזמנה שאינה ביום ההכנה היום (1001: אירוע 15.10) וגם כשהיא מחוקה (1019): עדיין נבנה מההזמנה עצמה', async () => {
  const a = await get('?page=PP-07&orderId=1001');
  assert.equal(a.status, 200);
  assert.deepEqual(a.__json.pages[0].data.rows.map((x) => x.orderId), [1001]);
  assert.equal(a.__json.meta.date, '2026-10-12', 'ב׳ 12.10: האירוע בחצות ישראלית של ה׳ 15.10, פחות 3 ימי עסקים');
  const b = await get('?page=PP-07&orderId=1019');
  assert.equal(b.status, 200);
});

test('PP-07 + PP-12 יחד להזמנה אחת: שני דפים, כל אחד להזמנה הזאת בלבד', async () => {
  const r = await get('?page=PP-07,PP-12&orderId=1008');
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  assert.deepEqual(r.__json.pages.map((p) => p.key), ['PP-07', 'PP-12']);
  assert.deepEqual(r.__json.pages[0].data.rows.map((x) => x.orderId), [1008]);
  assert.deepEqual(r.__json.pages[1].data.orders.map((x) => x.orderId), [1008]);
});

test('סוגי שגיאה: הזמנה לא קיימת 404; orderId שגוי 400 (לא מתעלמים בשקט); דף אחר 400; format=rows 400', async () => {
  assert.equal((await get('?page=PP-07&orderId=999999')).status, 404);
  assert.equal((await get('?page=PP-07&orderId=abc')).status, 400);
  assert.equal((await get('?page=PP-07&orderId=0')).status, 400);
  const other = await get('?page=PP-01&orderId=1001');
  assert.equal(other.status, 400);
  assert.match(other.__json.error, /PP-01/);
  assert.equal((await get('?page=PP-07,PP-15&orderId=1001')).status, 400);
  assert.equal((await get('?page=PP-07&orderId=1001&format=rows')).status, 400);
});

test('שערים: 401 בלי התחברות, 403 בלי page:schedule, 403 ל-PP-12 בלי page:deliveries (עובדת רגילה); דף הכנה פתוח לעובדת עם הלו״ז', async () => {
  globalThis.__AUTH_TOKEN = null;
  assert.equal((await get('?page=PP-07&orderId=1005')).status, 401);
  globalThis.__AUTH_TOKEN = 'emp-worker-blocked';
  assert.equal((await get('?page=PP-07&orderId=1005')).status, 403);
  globalThis.__AUTH_TOKEN = 'emp-worker';
  assert.equal((await get('?page=PP-12&orderId=1009')).status, 403);
  assert.equal((await get('?page=PP-07&orderId=1005')).status, 200);
});

test('בלי orderId שום דבר לא משתנה: meta.orderId = null, הדפסת יום רגילה עם כל ההזמנות, גרסה לפי הפרמטר', async () => {
  const r = await get('?page=PP-07&date=2026-10-01&version=a');
  assert.equal(r.status, 200);
  assert.equal(r.__json.meta.orderId, null);
  assert.equal(r.__json.pages[0].version, 'a');
  assert.ok(r.__json.pages[0].data.rows.length >= 2, 'כמה הזמנות ביום ההכנה');
});

test('ייצוא שורות (format=rows) של דף הכנה ללא orderId נשאר כמו קודם', async () => {
  const r = await get('?page=PP-07&date=2026-10-01&format=rows');
  assert.equal(r.status, 200);
  assert.ok(r.__json.total >= 1);
  assert.equal(typeof payloadToRows, 'function');
});

// ---------- דף ההדפסה ----------
test('דף ההדפסה: רושם ORDER_PRINTED רק עם orderId, ולא ב-downloadPdf / preview / דפדפן ראש-חסר; לא מדפיס יום שלם כשה-orderId שגוי', () => {
  const src = fs.readFileSync(path.join(process.env.PROJ, 'app/schedule/print/[page]/page.js'), 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(/schedulePrintEventBody\(\{ orderId, pageKey: p\.key, loadId \}\)/.test(src));
  assert.ok(/if \(!ready \|\| !payload \|\| !orderId \|\| downloadPdf \|\| preview \|\| printLoggedRef\.current\) return;/.test(src));
  assert.ok(/navigator\.webdriver === true/.test(src));
  assert.ok(/fetch\('\/api\/orders\/events'/.test(src));
  assert.ok(/badOrderId/.test(src) && /מספר הזמנה לא תקין/.test(src));
  assert.ok(/qs\.set\('orderId', String\(orderId\)\)/.test(src));
  // לא נרשם לכל הזמנה בהדפסת יום: אין שום לולאה על שורות הדף שרושמת אירוע
  assert.equal((src.match(/orders\/events/g) || []).length, 1);
});

test('PDF: /api/pdf מתיר את נתיב דף ההדפסה להזמנה בודדת (path + query) עם page:schedule', async () => {
  const { printPathPageKeys } = await L('lib/printAccess.js');
  assert.deepEqual(printPathPageKeys(om.orderPrintPath('PP-12', 53375, { downloadPdf: true }).split('?')[0]), ['page:schedule']);
  assert.deepEqual(printPathPageKeys('/schedule/print/PP-07'), ['page:schedule']);
});
