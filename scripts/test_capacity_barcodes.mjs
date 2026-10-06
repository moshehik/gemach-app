// בדיקת /api/inventory/capacity: ברקוד השמלה מוחזר לכל הזמנה תופסת רק כשהפריט כבר נלקח (isTaken) ויש לו ברקוד — דיווח 113e5c37
// (נווה יעקב, 5.10.2026: "אם השמלה עדיין לא יצאה למשפחה - אי אפשר לכתוב איזה ברקוד היא"). בלי DB ובלי Next.
// הרצה: node scripts/test_capacity_barcodes.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hooks = `
export async function resolve(spec, ctx, next) {
  if (spec === 'next/server') return { url: 'mock:next-server', shortCircuit: true };
  if (/[\\\\/]app[\\\\/]lib[\\\\/]prisma$/.test(spec) || spec === '@/app/lib/prisma') return { url: 'mock:prisma', shortCircuit: true };
  if (spec === '@/lib/auth') return { url: 'mock:auth', shortCircuit: true };
  if (spec.startsWith('@/lib/') && spec !== '@/lib/auth') return { url: '${pathToFileURL(root).href}/lib/' + spec.slice(6) + '.js', shortCircuit: true };
  return next(spec, ctx);
}
export async function load(url, ctx, next) {
  const mod = (source) => ({ format: 'module', shortCircuit: true, source });
  if (url === 'mock:prisma') return mod('export default globalThis.__P;');
  if (url === 'mock:auth') return mod('export const checkAuth = async () => true;');
  if (url === 'mock:next-server') return mod('export class NextResponse { static json(body, init){ return new Response(JSON.stringify(body), { status:(init&&init.status)||200 }); } }');
  return next(url, ctx);
}
`;
register('data:text/javascript;base64,' + Buffer.from(hooks).toString('base64'), pathToFileURL(root + path.sep));

const day = (d) => new Date(Date.UTC(2026, 9, d));
const order = (orderId, name) => ({ id: 'u' + orderId, orderId, eventDate: day(20), returnDate: null, eventDateHebrew: 'ט״ו חשון', customer: { firstName: name, lastName: 'כהן' } });
let orderItems = [];
globalThis.__P = {
  dressItem: { findMany: async () => [] },
  orderItem: { findMany: async (args) => { globalThis.__lastSelect = args.select; return orderItems; } },
};
const { GET } = await import('../app/api/inventory/capacity/route.js');
const call = async () => (await GET(new Request('http://x/api/inventory/capacity?barcodePrefix=557&size=06&fromDate=2026-10-19&toDate=2026-10-21'))).json();

let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.stack || e.message); process.exitCode = 1; }
}

await t('השאילתה בוחרת רק שני שדות נוספים (barcode, isTaken) — בלי שאילתה חדשה', async () => {
  orderItems = [];
  await call();
  assert.equal(globalThis.__lastSelect.barcode, true);
  assert.equal(globalThis.__lastSelect.isTaken, true);
});
await t('פריט שנלקח עם ברקוד -> barcodes; פריט שלא נלקח (גם אם יש לו ברקוד) -> ריק', async () => {
  orderItems = [
    { quantity: 1, barcode: '5570601', isTaken: true, order: order(1, 'רחל') },
    { quantity: 1, barcode: '5570699', isTaken: false, order: order(2, 'לאה') }, // ברקוד שרוט/ישן בלי לקיחה — לא מציגים
    { quantity: 1, barcode: null, isTaken: false, order: order(3, 'שרה') },
    { quantity: 1, barcode: '  ', isTaken: true, order: order(4, 'מירי') },
  ];
  const d = await call();
  const by = Object.fromEntries(d.occupiedOrders.map((o) => [o.orderId, o]));
  assert.deepEqual(by[1].barcodes, ['5570601']);
  assert.deepEqual(by[2].barcodes, []);
  assert.deepEqual(by[3].barcodes, []);
  assert.deepEqual(by[4].barcodes, []);
  assert.equal(d.occupiedCount, 4, 'הספירה לא השתנתה');
});
await t('כמה פריטים באותה הזמנה: כמות מצטברת וברקודים ייחודיים; פריט שלא נלקח לא מוסיף', async () => {
  orderItems = [
    { quantity: 1, barcode: '5570601', isTaken: true, order: order(1, 'רחל') },
    { quantity: 1, barcode: '5570602', isTaken: true, order: order(1, 'רחל') },
    { quantity: 1, barcode: '5570601', isTaken: true, order: order(1, 'רחל') },
    { quantity: 1, barcode: null, isTaken: false, order: order(1, 'רחל') },
  ];
  const d = await call();
  assert.equal(d.occupiedOrders.length, 1);
  assert.equal(d.occupiedOrders[0].quantity, 4);
  assert.deepEqual(d.occupiedOrders[0].barcodes, ['5570601', '5570602']);
});
await t('שאר שדות התשובה (שמות קיימים) נשארו כמו שהיו', async () => {
  orderItems = [{ quantity: 2, barcode: null, isTaken: false, order: order(7, 'חנה') }];
  const d = await call();
  assert.deepEqual(Object.keys(d).sort(), ['inStock', 'occupiedCount', 'occupiedOrders', 'reserve']);
  assert.deepEqual(Object.keys(d.occupiedOrders[0]).sort(), ['barcodes', 'customerName', 'eventDate', 'eventDateHebrew', 'id', 'internalOrderId', 'orderId', 'quantity', 'returnDate']);
  assert.equal(d.occupiedOrders[0].customerName, 'חנה כהן');
});

console.log(`\n${passed} passed${process.exitCode ? ', WITH FAILURES' : ''}`);
