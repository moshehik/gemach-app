// בדיקות הענף הודאי של החיפוש החכם לברקוד (lib/ai/barcodeLookup.js) + החיווט שלו ב-app/api/ai/route.js - בלי DB, בלי רשת, בלי מודל שפה אמיתי:
//   א. זיהוי "רק ברקוד" (7 ספרות / "ברקוד N"), ושמספר של 5-6 ספרות או משפט נשארים למודל.
//   ב. התשובה: זיהוי השמלה, הדגם / המידה / הסידורי, מצב ההשכרה (עכשיו / משוריינת / סימון ישן), הזמנות אחרונות, זמינות כל המידות (קריאה אחת, ממוין),
//      ובלי לומר "מספר הזמנה" על ברקוד, בלי פרטי לקוח, בלי מיקום השמלה, בלי טרנזקציה / SQL גולמי / N+1.
//   ג. ה-route (עם prisma / מודל שפה / הרשאות מדומים): ברקוד נענה בלי לקרוא למודל; שאלה רגילה כן מגיעה למודל עם כללי S16-S20; בלי התחברות / בלי feature:ai
//      אין שום קריאה למסד; כשל במסד בענף = נפילה חזרה למודל (לא שגיאה).
// הרצה: node scripts/test_ai_barcode.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---- hook של טעינת מודולים: כינוי '@/' + מוקים ל-prisma / auth / permissions / settingsCache / gemini / inventory ... (globalThis.__T) ----
const hooks = `
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const ROOT = ${JSON.stringify(root)};
const MOCKS = [
  [/[\\\\/]app[\\\\/]lib[\\\\/]prisma\\.js$/, 'prisma'],
  [/[\\\\/]lib[\\\\/]auth\\.js$/, 'auth'],
  [/[\\\\/]lib[\\\\/]permissions\\.js$/, 'permissions'],
  [/[\\\\/]lib[\\\\/]settingsCache\\.js$/, 'settings'],
  [/[\\\\/]lib[\\\\/]ai[\\\\/]gemini\\.js$/, 'gemini'],
  [/[\\\\/]lib[\\\\/]ai[\\\\/]geminiFiles\\.js$/, 'geminiFiles'],
  [/[\\\\/]lib[\\\\/]driveBridgeServer\\.js$/, 'drive'],
  [/[\\\\/]lib[\\\\/]inventory\\.js$/, 'inventory'],
  [/[\\\\/]lib[\\\\/]authTokens\\.js$/, 'authTokens'],
];
function withExt(p) {
  for (const c of [p, p + '.js', p + '.mjs', path.join(p, 'index.js')]) {
    try { if (fs.statSync(c).isFile()) return c; } catch {}
  }
  return null;
}
export async function resolve(spec, ctx, next) {
  if (spec === 'next/server') return { url: 'mock:next-server', shortCircuit: true };
  if (spec === 'next/headers') return { url: 'mock:next-headers', shortCircuit: true };
  if ((spec === 'fs' || spec === 'node:fs') && ctx.parentURL && ctx.parentURL.endsWith('/app/api/ai/route.js')) return { url: 'mock:fs', shortCircuit: true };
  let file = null;
  if (spec.startsWith('@/')) file = withExt(path.join(ROOT, spec.slice(2)));
  else if ((spec.startsWith('./') || spec.startsWith('../')) && ctx.parentURL && ctx.parentURL.startsWith('file:')) {
    file = withExt(path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec));
  }
  if (file) {
    for (const [re, name] of MOCKS) if (re.test(file)) return { url: 'mock:' + name, shortCircuit: true };
    return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  return next(spec, ctx);
}
export async function load(url, ctx, next) {
  const mod = (source) => ({ format: 'module', shortCircuit: true, source });
  if (url === 'mock:prisma') return mod('export default globalThis.__T.prisma; export const auditAs = (a, b) => b; export const getActingEmployeeId = async () => null;');
  if (url === 'mock:auth') return mod('const T=globalThis.__T; export const HEAD_MANAGEMENT_ROLES=[0,2]; export const DEVELOPER_ONLY_ROLES=[0]; export const checkAuth=async()=>T.authed; export const checkPageAccess=async()=>true; export const getSessionEmployee=async()=>null; export const readVerifiedSession=()=>null;');
  if (url === 'mock:permissions') return mod('const T=globalThis.__T; export const checkAiAccess=async()=>T.aiAccess; export const hasPermission=async()=>T.manager; export const canOpenPage=async()=>true;');
  if (url === 'mock:settings') return mod('export const getAllCachedSettings=async()=>[]; export const getCachedSetting=async()=>null; export const invalidateSettingsCache=()=>{};');
  if (url === 'mock:gemini') return mod('export const generateContent=async(p)=>{ const T=globalThis.__T; T.modelCalls.push(p); return T.modelAnswer; };');
  if (url === 'mock:geminiFiles') return mod('export const uploadAndWaitForFile=async()=>{throw new Error("no media in tests")};');
  if (url === 'mock:drive') return mod('export const downloadRecording=async()=>{throw new Error("no media in tests")};');
  if (url === 'mock:inventory') return mod('export const getBulkAvailableInventory=async(d,ids)=>{ const T=globalThis.__T; T.bulkCalls.push([d,ids]); return T.bulk; };');
  if (url === 'mock:authTokens') return mod('export const verifiedCookieStore=(c)=>c;');
  if (url === 'mock:next-server') return mod('export class NextResponse { static json(body, init){ return new Response(JSON.stringify(body), { status:(init&&init.status)||200, headers:{"content-type":"application/json"} }); } }');
  if (url === 'mock:next-headers') return mod('export const cookies=async()=>({get(){return undefined}});');
  if (url === 'mock:fs') return mod('export default { appendFileSync(){}, readFileSync(){ return ""; }, existsSync(){ return false; } };');
  return next(url, ctx);
}
`;
register('data:text/javascript;base64,' + Buffer.from(hooks).toString('base64'), pathToFileURL(root + path.sep));

let passed = 0;
let failed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); } catch (e) { failed++; console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

// ---- מצב מדומה לכל הבדיקות ----
const calls = [];
const T = (globalThis.__T = {
  authed: true, aiAccess: true, manager: false, modelCalls: [], bulkCalls: [], modelAnswer: 'תשובת מודל', bulk: {}, dbFail: false,
  items: [], orderRows: [], models: [],
});
const rec = (name, result) => async (args) => { calls.push([name, args]); if (T.dbFail) throw new Error('db down'); return typeof result === 'function' ? result(args) : result; };
T.prisma = {
  dressItem: { findMany: (a) => rec('dressItem.findMany', T.items)(a) },
  orderItem: { findMany: (a) => rec('orderItem.findMany', T.orderRows)(a) },
  dressModel: { findMany: (a) => rec('dressModel.findMany', T.models)(a), findFirst: rec('dressModel.findFirst', null) },
  employee: { findUnique: async () => null },
  $transaction: async () => { throw new Error('transaction used'); },
  $queryRaw: async () => { throw new Error('raw sql used'); },
  $queryRawUnsafe: async () => { throw new Error('raw sql used'); },
};
const reset = () => { calls.length = 0; T.modelCalls.length = 0; T.bulkCalls.length = 0; T.dbFail = false; T.authed = true; T.aiAccess = true; T.modelAnswer = 'תשובת מודל'; };

const { detectBarcodePrompt, answerBarcode, rentalState, BARCODE_SIZES_MAX, STALE_OUT_DAYS } = await import('../lib/ai/barcodeLookup.js');

const NOW = new Date('2026-10-05T10:00:00Z'); // 5.10.2026 (יום ישראלי 2026-10-05)
const FMT = (key) => `<<${key}>>`;
const ITEM = { id: 'di1', sizeText: '34', serialNumber: 1, dressBarcode: '6323401', barcodePrefix: 632, dressModelId: 'm632', inRepair: false, notInUse: false, isDeleted: false, dress: { id: 'm632', name: 'אפור טול', barcodePrefix: 632, isDeleted: false } };
const ordRow = (orderId, event, { taken = false, returned = false, size = '34' } = {}) => ({ id: 'oi' + orderId, orderId, isTaken: taken, isReturned: returned, sizeText: size, barcodePrefix: 632, order: { orderId, eventDate: new Date(event), eventDateHebrew: 'x' } });
const AVAIL = { m632: { '36': { available: 2, total: 2, booked: 0 }, '32': { available: 1, total: 2, booked: 1 }, '34': { available: 0, total: 1, booked: 1 }, '10': { available: 1, total: 1, booked: 0 }, '2': { available: 1, total: 1, booked: 0 } } };
const run = (parsed, extra = {}) => answerBarcode(parsed, { prisma: T.prisma, getBulkAvailableInventory: async (d, ids) => { T.bulkCalls.push([d, ids]); return T.bulk; }, formatDate: FMT, now: NOW, ...extra });
const P = (s) => detectBarcodePrompt(s);

console.log('א. זיהוי "רק ברקוד"');
await t('7 ספרות = ברקוד: קידומת = הכול חוץ מ-4 האחרונות, מידה, סידורי (6323401 = דגם 632, מידה 34, סידורי 01)', () => {
  const p = P('6323401');
  assert.deepEqual({ ...p }, { digits: '6323401', prefix: '632', size: '34', serial: '01', sizeKey: '34', legacy: false });
  assert.equal(P('  6323401 ').digits, '6323401');
  assert.equal(P('6323401?').digits, '6323401', 'סימן שאלה בסוף');
  assert.equal(P('‏6323401‎').digits, '6323401', 'תווי כיווניות בלתי נראים');
  assert.equal(P('2573401').prefix, '257');
  assert.equal(P('0123401'), null, '7 ספרות שמתחילות ב-0 = טלפון חלקי (קידומות דגם הן מספרים שלמים, בלי 0 מוביל)');
});
await t('"ברקוד N" מפורש (גם 5-6 ספרות, גם עם ":") = ברקוד; ברקוד ישן 41807 = דגם 4, מידה 18', () => {
  assert.equal(P('ברקוד 6323401').digits, '6323401');
  assert.equal(P('ברקוד: 6323401').digits, '6323401');
  assert.equal(P('ברקוד 41807').prefix, '4'); assert.equal(P('ברקוד 41807').size, '18'); assert.equal(P('ברקוד 41807').legacy, true);
  assert.equal(P('ברקוד 123456').prefix, '12');
});
await t('לא מיירטים: מספר הזמנה (1-6 ספרות בלי מילה), 8 ספרות, טלפון, משפט, "הזמנה N", ריק, לא-מחרוזת', () => {
  for (const no of ['25734', '257', '123456', '41807', '12345678', '0501234567', '050-1234567', 'הזמנה 6323401', 'מספר הזמנה 6323401', 'מה הסטטוס של ברקוד 6323401', 'מידה 34 דגם 632', '6323401 6323402', '', '   ', null, undefined, 5, {}]) {
    assert.equal(P(no), null, String(no));
  }
});

console.log('ב. התשובה');
await t('שמלה מושכרת עכשיו: זיהוי, מצב, הזמנות אחרונות, זמינות כל המידות ממוינת (קריאה אחת), בלי "מספר הזמנה" על הברקוד', async () => {
  reset(); T.items = [ITEM]; T.bulk = AVAIL;
  T.orderRows = [ordRow(25734, '2026-10-06T21:00:00Z', { taken: true }), ordRow(25100, '2026-08-10T21:00:00Z', { taken: true, returned: true }), ordRow(25734, '2026-10-06T21:00:00Z', { taken: true })];
  const r = await run(P('6323401'));
  const txt = r.response;
  assert.ok(txt.startsWith('ברקוד 6323401: דגם 632 "אפור טול", מידה 34, מספר סידורי 01.'), txt);
  assert.ok(txt.includes('מושכרת כרגע בהזמנה 25734 (אירוע ב-<<2026-10-07>>), טרם הוחזרה.'), txt);
  assert.ok(txt.includes('הזמנות אחרונות עם הברקוד: הזמנה 25734 (מושכרת כרגע), הזמנה 25100 (הוחזרה).'), 'כפילות לאותה הזמנה מאוחדת: ' + txt);
  assert.ok(txt.includes('זמינות בכל המידות של דגם 632 "אפור טול" להיום (<<2026-10-05>>):'), txt);
  const sizeLines = txt.split('\n').filter((l) => l.startsWith('- מידה '));
  assert.deepEqual(sizeLines.map((l) => l.split(':')[0]), ['- מידה 2', '- מידה 10', '- מידה 32', '- מידה 34', '- מידה 36'], 'מיון מספרי (2 לפני 10)');
  assert.equal(sizeLines[3], '- מידה 34: פנויות 0 מתוך 1 (המידה של הברקוד)');
  assert.equal(sizeLines[2], '- מידה 32: פנויות 1 מתוך 2');
  assert.ok(!/מספר הזמנה 6323401|מספר ההזמנה|order number/i.test(txt), 'לא אומרים "מספר הזמנה" על ברקוד');
  assert.equal(r.sqlQuery, null); assert.equal(r.deterministic, 'barcode');
  assert.deepEqual(r.data, [
    { 'מספר הזמנה': 25734, 'תאריך אירוע': '<<2026-10-07>>', 'מצב': 'מושכרת כרגע', _actionUrl: '/orders/25734', _actionLabel: 'פרטי הזמנה' },
    { 'מספר הזמנה': 25100, 'תאריך אירוע': '<<2026-08-11>>', 'מצב': 'הוחזרה', _actionUrl: '/orders/25100', _actionLabel: 'פרטי הזמנה' },
  ]);
});
await t('מספר השאילתות קבוע (אין N+1): dressItem 1, orderItem 1, dressModel 0 (הדגם מהשמלה), מנוע המלאי פעם אחת עם כל הדגמים ו-12:00 UTC של היום הישראלי', async () => {
  reset(); T.items = [ITEM]; T.bulk = AVAIL; T.orderRows = [ordRow(1, '2026-10-06T21:00:00Z'), ordRow(2, '2026-10-07T21:00:00Z'), ordRow(3, '2026-10-08T21:00:00Z')];
  await run(P('6323401'));
  assert.deepEqual(calls.map((c) => c[0]).sort(), ['dressItem.findMany', 'orderItem.findMany']);
  assert.equal(T.bulkCalls.length, 1); assert.deepEqual(T.bulkCalls[0][1], ['m632']);
  assert.equal(T.bulkCalls[0][0].toISOString(), '2026-10-05T12:00:00.000Z');
});
await t('שאילתות: עמודות מפורשות בלבד - בלי פרטי לקוח / כספים / מיקום; סטטוס null-safe (OR null + notIn) ולא NOT IN לבד; הזמנות לא מחוקות; מוגבלות ב-take', async () => {
  reset(); T.items = [ITEM]; T.bulk = AVAIL; T.orderRows = [];
  await run(P('6323401'));
  const di = calls.find((c) => c[0] === 'dressItem.findMany')[1];
  const oi = calls.find((c) => c[0] === 'orderItem.findMany')[1];
  assert.deepEqual(di.where, { dressBarcode: '6323401' }); assert.ok(di.take <= 5);
  for (const bad of ['location', 'locationNum', 'cartonNumber', 'notInUseReason', 'price', 'customer']) assert.ok(!(bad in di.select), 'DressItem.select.' + bad);
  assert.equal(oi.where.barcode, '6323401'); assert.equal(oi.where.isDeleted, false); assert.equal(oi.where.order.isDeleted, false);
  assert.deepEqual(oi.where.order.OR, [{ status: null }, { status: { notIn: ['טיוטה', 'שמור לחיוב'] } }], 'כלל S1: NOT IN לבד מוציא את כל ההזמנות עם status ריק');
  assert.ok(oi.take <= 10); assert.deepEqual(oi.orderBy, { order: { eventDate: 'desc' } });
  for (const bad of ['price', 'basePrice', 'finalPrice', 'customer', 'customerId', 'notes', 'repairs']) assert.ok(!(bad in oi.select) && !(bad in oi.select.order.select), 'OrderItem/Order select.' + bad);
});
await t('בלי פרטי לקוח בטקסט ובטבלה גם אם המסד היה מחזיר אותם (המוק מחזיר שם לקוח וטלפון)', async () => {
  reset(); T.items = [{ ...ITEM, location: 'מחסן 3' }]; T.bulk = AVAIL;
  const row = ordRow(25734, '2026-10-06T21:00:00Z', { taken: true });
  row.order.customer = { firstName: 'רחל', lastName: 'כהן', phone1: '0501234567' }; row.price = 900;
  T.orderRows = [row];
  const r = await run(P('6323401'));
  const all = r.response + JSON.stringify(r.data);
  for (const leak of ['רחל', 'כהן', '0501234567', '900', 'מחסן']) assert.ok(!all.includes(leak), 'דליפה: ' + leak);
});
await t('מצבי השכרה: משוריינת (אירוע עתידי, לא נלקחה), סימון ישן (נלקחה ולא הוחזרה, האירוע לפני יותר מ-7 ימים), הוחזרה בלבד, אין הזמנות', async () => {
  reset(); T.items = [ITEM]; T.bulk = AVAIL;
  T.orderRows = [ordRow(30001, '2026-10-20T21:00:00Z')];
  let r = await run(P('6323401'));
  assert.ok(r.response.includes('אין השכרה פעילה כרגע. משוריינת להזמנה 30001 לאירוע ב-<<2026-10-21>>.'), r.response);
  T.orderRows = [ordRow(30002, '2026-09-01T21:00:00Z', { taken: true })];
  r = await run(P('6323401'));
  assert.ok(r.response.includes('אין השכרה פעילה כרגע.') && r.response.includes('שימי לב: בהזמנה 30002 היא עדיין מסומנת כמושכרת ולא הוחזרה') && r.response.includes('כנראה סימון ישן'), r.response);
  assert.ok(!r.response.includes('מושכרת כרגע בהזמנה'), 'סימון ישן לא נחשב השכרה פעילה');
  T.orderRows = [ordRow(30003, '2026-09-01T21:00:00Z', { taken: true, returned: true })];
  r = await run(P('6323401'));
  assert.ok(r.response.includes('אין השכרה פעילה כרגע.') && r.response.includes('הזמנה 30003 (הוחזרה)'), r.response);
  T.orderRows = [];
  r = await run(P('6323401'));
  assert.ok(r.response.includes('אין השכרה פעילה כרגע.') && !r.response.includes('הזמנות אחרונות'), r.response);
  assert.equal(r.data, null);
  // גבול 7 ימים: אירוע לפני 7 ימים בדיוק עדיין "מושכרת כרגע"; לפני 8 - סימון ישן
  assert.equal(rentalState({ isTaken: true, isReturned: false, eventKey: '2026-09-28' }, '2026-10-05'), 'out');
  assert.equal(rentalState({ isTaken: true, isReturned: false, eventKey: '2026-09-27' }, '2026-10-05'), 'staleOut');
  assert.equal(STALE_OUT_DAYS, 7);
  assert.equal(rentalState({ isTaken: false, isReturned: false, eventKey: '2026-10-05' }, '2026-10-05'), 'booked');
  assert.equal(rentalState({ isTaken: false, isReturned: false, eventKey: '2026-10-04' }, '2026-10-05'), 'past');
});
await t('מצב השמלה: בתיקון / לא בשימוש / מחוקה מופיעים; שמלה מחוקה ללא דגם פעיל = דגם לפי הקידומת', async () => {
  reset(); T.bulk = AVAIL; T.orderRows = [];
  T.items = [{ ...ITEM, inRepair: true, notInUse: true }];
  let r = await run(P('6323401'));
  assert.ok(r.response.includes('מצב השמלה: בתיקון, מסומנת "לא בשימוש".'), r.response);
  T.items = [{ ...ITEM, isDeleted: true, dress: { ...ITEM.dress, isDeleted: true } }]; T.models = [{ id: 'm632', name: 'אפור טול', barcodePrefix: 632 }];
  calls.length = 0;
  r = await run(P('6323401'));
  assert.ok(r.response.includes('מחוקה מהמלאי'), r.response);
  assert.ok(calls.some((c) => c[0] === 'dressModel.findMany' && c[1].where.barcodePrefix === 632 && c[1].where.isDeleted === false), 'הדגם נמצא לפי הקידומת');
});
await t('הברקוד לא במלאי אבל מופיע בהזמנות: אומרים זאת, הדגם לפי הקידומת, עדיין זמינות', async () => {
  reset(); T.items = []; T.models = [{ id: 'm632', name: 'אפור טול', barcodePrefix: 632 }]; T.bulk = AVAIL;
  T.orderRows = [ordRow(25734, '2026-10-06T21:00:00Z', { taken: true })];
  const r = await run(P('6323401'));
  assert.ok(r.response.startsWith('הברקוד 6323401 לא נמצא כשמלה במלאי, אבל הוא מופיע בהזמנות.'), r.response);
  assert.ok(r.response.includes('דגם 632 "אפור טול", מידה 34, מספר סידורי 01') && r.response.includes('מושכרת כרגע בהזמנה 25734') && r.response.includes('זמינות בכל המידות'), r.response);
  assert.equal(calls.filter((c) => c[0] === 'dressModel.findMany').length, 1);
});
await t('ברקוד שלא קיים בכלל: הודעה ברורה (לא "מספר הזמנה"), פירוק הברקוד, אם הדגם קיים; בלי קריאה למנוע המלאי כשאין דגם', async () => {
  reset(); T.items = []; T.orderRows = []; T.models = [];
  let r = await run(P('6323401'));
  assert.ok(r.response.includes('לא נמצאה שמלה עם הברקוד 6323401, והוא לא מופיע באף הזמנה.') && r.response.includes('דגם 632, מידה 34, מספר סידורי 01') && r.response.includes('דגם 632 לא נמצא במערכת.'), r.response);
  assert.ok(!/מספר הזמנה|מספר ההזמנה/.test(r.response), r.response);
  assert.equal(T.bulkCalls.length, 0); assert.equal(r.data, null);
  T.models = [{ id: 'm632', name: 'אפור טול', barcodePrefix: 632 }]; T.bulk = AVAIL;
  r = await run(P('6323401'));
  assert.ok(r.response.includes('דגם 632 "אפור טול" קיים במערכת.') && r.response.includes('זמינות בכל המידות'), r.response);
});
await t('מידה לא מרופדת במלאי ("2") מול מידת הברקוד "02": סימון "המידה של הברקוד" לפי מפתח מידה (02 = 2); אין נתוני זמינות = משפט; תקרת שורות', async () => {
  reset(); T.items = [{ ...ITEM, sizeText: '02' }]; T.orderRows = []; T.bulk = AVAIL;
  let r = await run(P('6320201'));
  assert.ok(r.response.includes('- מידה 2: פנויות 1 מתוך 1 (המידה של הברקוד)'), r.response);
  T.bulk = {};
  r = await run(P('6323401'));
  assert.ok(r.response.includes('אין נתוני זמינות למידות של דגם 632'), r.response);
  const many = {}; for (let i = 1; i <= BARCODE_SIZES_MAX + 6; i++) many[String(i + 20)] = { available: 1, total: 1, booked: 0 };
  T.bulk = { m632: many };
  r = await run(P('6323401'));
  assert.equal(r.response.split('\n').filter((l) => l.startsWith('- מידה ')).length, BARCODE_SIZES_MAX);
  assert.ok(r.response.includes('ועוד 6 מידות.'), r.response);
});
await t('הטבלה: עד 5 הזמנות אחרונות, בלי כפילויות, כל שורה עם קישור פנימי /orders/<מספר> (לא UUID)', async () => {
  reset(); T.items = [ITEM]; T.bulk = AVAIL;
  T.orderRows = [1, 2, 3, 4, 5, 6, 7].map((n) => ordRow(40000 + n, `2026-0${Math.min(n, 9)}-10T21:00:00Z`, { returned: true }));
  const r = await run(P('6323401'));
  assert.equal(r.data.length, 5);
  assert.ok(r.data.every((x) => /^\/orders\/\d+$/.test(x._actionUrl) && x._actionLabel === 'פרטי הזמנה'));
});
await t('כשל במסד זורק (ה-route נופל חזרה למודל); בלי טרנזקציות / SQL גולמי: המוק זורק אם נקראו', async () => {
  reset(); T.dbFail = true;
  await assert.rejects(() => run(P('6323401')), /db down/);
  reset(); T.items = [ITEM]; T.bulk = AVAIL; T.orderRows = [];
  await run(P('6323401')); // $transaction / $queryRaw* זורקים - אם נקראו, הבדיקה נכשלת
});

console.log('ג. ה-route (app/api/ai/route.js)');
const route = await import('../app/api/ai/route.js');
const post = async (body) => {
  const res = await route.POST({ json: async () => body, clone() { return { json: async () => body }; } });
  return { status: res.status, body: await res.json() };
};
await t('ברקוד 6323401: התשובה מהענף הודאי - המודל לא נקרא בכלל; שדות response / data / sqlQuery כמו תמיד', async () => {
  reset(); T.items = [ITEM]; T.bulk = AVAIL; T.orderRows = [ordRow(25734, '2026-10-06T21:00:00Z', { taken: true })];
  const r = await post({ prompt: '6323401', history: [], context: 'User is in the general system home dashboard.' });
  assert.equal(r.status, 200);
  assert.equal(T.modelCalls.length, 0, 'המודל לא נקרא');
  assert.ok(r.body.response.startsWith('ברקוד 6323401: דגם 632 "אפור טול", מידה 34'), r.body.response);
  assert.ok(!/מספר ההזמנה 6323401|לא נמצאו רשומות/.test(r.body.response));
  assert.equal(r.body.sqlQuery, null); assert.equal(r.body.data[0]._actionUrl, '/orders/25734');
  assert.ok(/י.{0,3}ו בתשרי|תשפ/.test(r.body.response), 'תאריך האירוע בעברית (humanizeResultDates): ' + r.body.response);
  assert.ok(r.body.response.includes('(07/10/2026)'), 'ובלועזי');
});
await t('"ברקוד 6323401" ו-"6323401?" גם הם ללא מודל; ההיסטוריה / ההקשר לא משנים', async () => {
  for (const q of ['ברקוד 6323401', '6323401?', ' 6323401 ']) {
    reset(); T.items = [ITEM]; T.bulk = AVAIL; T.orderRows = [];
    const r = await post({ prompt: q, history: [{ role: 'user', content: 'כמה הזמנות יש?' }], context: '' });
    assert.equal(T.modelCalls.length, 0, q); assert.ok(r.body.response.includes('ברקוד 6323401'), q);
  }
});
await t('שאלה רגילה (ולא ברקוד: 25734, 5-6 ספרות, משפט עם ברקוד) מגיעה למודל, עם כללי S16-S20 וחודשים בפרומפט', async () => {
  for (const q of ['כמה הזמנות יש היום', '25734', '123456', 'מה הסטטוס של ברקוד 6323401', 'כמה הזמנות בכסליו']) {
    reset();
    const r = await post({ prompt: q, history: [], context: '' });
    assert.equal(r.status, 200, q);
    assert.equal(T.modelCalls.length, 1, q);
    const prompt = T.modelCalls[0];
    assert.ok(prompt.includes('\nS16. DRESS BARCODE FORMAT') && prompt.includes('\nS17. BARCODE vs ORDER NUMBER') && prompt.includes('\nS18. PHONE FORMATS') && prompt.includes('\nS19. HEBREW MONTH NAMES') && prompt.includes('\nS20. SIZE SPELLING'), q);
    assert.ok(prompt.includes('אדר א') && prompt.includes('כסליו') && prompt.includes('מרחשון') && prompt.includes('ADAR_I'), 'חודשים עבריים בכל האיותים: ' + q);
    assert.ok(prompt.includes('Current User Question: ' + q), q);
    assert.ok(calls.every((c) => c[0] !== 'dressItem.findMany'), 'שאלה רגילה לא מפעילה את חיפוש הברקוד: ' + q);
  }
});
await t('הרשאות: בלי התחברות = 401, בלי feature:ai = 403 - ובשני המקרים אין קריאה למסד ולא למודל (גם עם ברקוד)', async () => {
  reset(); T.authed = false; T.items = [ITEM];
  let r = await post({ prompt: '6323401' });
  assert.equal(r.status, 401); assert.equal(calls.length, 0); assert.equal(T.modelCalls.length, 0);
  reset(); T.aiAccess = false;
  r = await post({ prompt: '6323401' });
  assert.equal(r.status, 403); assert.equal(calls.length, 0); assert.equal(T.modelCalls.length, 0); assert.equal(T.bulkCalls.length, 0);
});
await t('כשל במסד בענף הברקוד = נפילה חזרה למודל (תשובה רגילה, לא שגיאה 500)', async () => {
  reset(); T.dbFail = true; T.modelAnswer = 'מצטער, לא הצלחתי';
  const origErr = console.error; console.error = () => {}; // הענף מתעד את הכשל
  let r;
  try { r = await post({ prompt: '6323401' }); } finally { console.error = origErr; }
  assert.equal(r.status, 200); assert.equal(T.modelCalls.length, 1, 'המודל נקרא כגיבוי');
  assert.ok(T.modelCalls[0].includes('Current User Question: 6323401'));
  assert.ok(typeof r.body.response === 'string');
});
await t('בלי prompt = 400 (התנהגות קיימת נשמרת); צילום מסך עם מספר ברקוד לא מיורט (ענף המדיה קודם)', async () => {
  reset();
  let r = await post({});
  assert.equal(r.status, 400);
  reset(); T.modelAnswer = 'רואים מסך';
  r = await post({ prompt: '6323401', image: { mimeType: 'image/png', data: 'AA==' } });
  assert.equal(r.status, 200); assert.equal(T.modelCalls.length, 1, 'הצילום עבר למודל');
  assert.equal(calls.length, 0);
});

console.log(String.fromCharCode(10) + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
if (failed) process.exit(1);
