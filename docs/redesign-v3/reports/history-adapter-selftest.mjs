// בדיקת עשן למתאם ההיסטוריה: node docs/redesign-v3/reports/history-adapter-selftest.mjs
import { buildFeed, searchHay, missingLabels } from '../../../app/v3/history/adapter.js';

const T = (d) => `2026-09-${d}Z`;
const J = JSON.stringify;
const rows = [
  { id: 'a1', entityType: 'Order', entityId: 'uuid-1', action: 'CREATE', createdAt: '2026-09-20T07:00:00Z', employeeId: 'e1', employeeName: 'רחל כהן',
    changesJson: J({ orderId: 4512, branch: 'נווה יעקב', isDelivery: false, eventDate: '2026-10-03T00:00:00Z', totalAmount: 0, notes: '' }) },
  { id: 'a2', entityType: 'OrderItem', entityId: 'it-1', action: 'CREATE', createdAt: '2026-09-20T07:00:01Z', employeeId: 'e1', employeeName: 'רחל כהן',
    changesJson: J({ description: 'דגם 4512', sizeText: '38', finalPrice: 150, isDeleted: false, isTaken: false }) },
  { id: 'a3', entityType: 'Order', entityId: 'uuid-1', action: 'UPDATE', createdAt: '2026-09-20T09:00:00Z', employeeId: 'e1', employeeName: 'רחל כהן',
    changesJson: J({ isDelivery: true, branch: 'נווה יעקב', eventDate: '2026-10-03T00:00:00Z', hokDetails: 'x' }) },
  { id: 'a4', entityType: 'Order', entityId: 'uuid-1', action: 'UPDATE', createdAt: '2026-09-21T09:00:00Z', employeeId: null,
    changesJson: J({ isDelivery: true, branch: 'נווה יעקב' }) }, // רעש: זהה לחלוטין
  { id: 'a5', entityType: 'Payment', entityId: 'p-1', action: 'CREATE', createdAt: '2026-09-22T10:13:00Z', employeeId: 'e2', employeeName: 'שרה לוי',
    changesJson: J({ amount: 300, paymentMethod: 'אשראי', isRefund: false, isDeleted: false }) },
  { id: 'a6', entityType: 'Customer', entityId: 'c-1', action: 'UPDATE', createdAt: '2026-09-22T11:00:00Z', employeeId: 'e2', employeeName: 'שרה לוי',
    changesJson: J({ phone1: { from: '0501234567', to: '0527654321' } }) },
  { id: 'a7', entityType: 'Order', entityId: '4512', action: 'CANCEL_ORDER', createdAt: '2026-09-23T08:00:00Z', employeeId: 'e1', employeeName: 'רחל כהן',
    changesJson: J({ isDeleted: { from: false, to: true }, note: 'הלקוחה ויתרה' }) },
  { id: 'a8', entityType: 'OrderItem', entityId: 'it-1', action: 'CANCEL_ORDER', createdAt: '2026-09-23T08:00:00Z', employeeId: 'e1', employeeName: 'רחל כהן',
    changesJson: J({ isDeleted: { from: false, to: true } }) },
  { id: 'a9', entityType: 'Employee', entityId: 'e1', action: 'UPDATE', createdAt: '2026-09-23T09:00:00Z', employeeId: null,
    changesJson: J({ password: '***', someNewField: 1 }) },
];
const ctx = { itemsById: { 'it-1': { model: 'דגם 4512', size: '38' } }, singleOrder: true };
const feed = buildFeed(rows, ctx);
for (const d of feed.days) {
  console.log('== ' + d.day);
  for (const e of d.entries) console.log(`  [${e.cat}/${e.icon}] ${e.text}${e.sub ? ' | ' + e.sub : ''}${e.amt ? ' | ' + e.kind + ' ' + e.amt : ''} | ${e.who} ${e.ts.slice(11)}${e.noise ? ' | NOISE' : ''}`, JSON.stringify(e.det));
}
console.log('קטגוריות:', feed.catCounts, '| רשומות:', feed.entries.length, 'מתוך', rows.length, 'שורות');
console.log('חיפוש "0527":', feed.entries.filter((e) => searchHay(e).includes('0527')).map((e) => e.id));
console.log('חסרים במילון:', [...missingLabels]);

let fails = 0;
const check = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const R = (id, entityType, entityId, action, ts, obj, extra = {}) => ({ id, entityType, entityId, action, createdAt: ts, employeeId: 'e1', employeeName: 'רחל', changesJson: J(obj), ...extra });
const one = (rs, c = {}) => buildFeed(rs, c).entries;

check('בסיס: ילד ביטול מקופל (הזמנה יחידה), a4 נשאר כמשוער', feed.entries.length === 8 && !feed.entries.find((e) => e.id === 'a8') && feed.entries.find((e) => e.id === 'a4')?.estimated === true);

// B1: שדות "טכניים" ששונו באמת לא נעלמים
{
  const e = one([
    R('b1', 'DressModel', 'm1', 'CREATE', '2026-09-01T10:00:00Z', { name: 'X', barcodePrefix: '12', imageUrl: 'a.png' }),
    R('b2', 'DressModel', 'm1', 'UPDATE', '2026-09-02T10:00:00Z', { barcodePrefix: '13' }),
    R('b3', 'DressModel', 'm1', 'UPDATE', '2026-09-03T10:00:00Z', { imageUrl: 'b.png', thumbnailUrl: 't.png' }),
    R('b4', 'OrderItem', 'i9', 'UPDATE', '2026-09-04T10:00:00Z', { dressItemId: { from: 'd1', to: 'd2' } }),
    R('b5', 'Order', 'o9', 'UPDATE', '2026-09-05T10:00:00Z', { hokDetails: 'x' }),
    R('b6', 'Employee', 'e1', 'UPDATE', '2026-09-06T10:00:00Z', { themeColor: '{"a":1}' }),
  ]);
  check('B1: 5 עדכונים טכניים + CREATE -> 6 רשומות', e.length === 6);
  check('B1: שדות טכניים בקטע נפרד', e.filter((x) => x.action === 'UPDATE').every((x) => x.tech.length >= 1));
}
// B2: אירועים חוזרים לא מאבדים תוכן
{
  const mail = { subject: 'הזמנה', to: 'a@b.c', body: 'שלום', files: [{ fileName: 'x.pdf' }] };
  const e = one([
    R('m1', 'Order', '4512', 'EMAIL_SENT', '2026-09-01T10:00:00Z', mail),
    R('m2', 'Order', '4512', 'EMAIL_SENT', '2026-09-02T10:00:00Z', mail),
    R('p1', 'Order', '4512', 'ADD_PAYMENT', '2026-09-01T11:00:00Z', { amount: 100 }),
    R('p2', 'Order', '4512', 'ADD_PAYMENT', '2026-09-02T11:00:00Z', { amount: 100 }),
  ]);
  const m2 = e.find((x) => x.id === 'm2'), p2 = e.find((x) => x.id === 'p2');
  check('B2: מייל שני שומר נמען/נושא/קבצים', m2.sub === 'a@b.c' && m2.det.length >= 3);
  check('B2: תשלום שני באותו סכום נשאר ₪100', p2.amt === -100 && p2.text.includes('100'));
}
// B3: לפני מוסק שווה לאחרי -> לא נעלם אלא מסומן משוער
{
  const e = one([
    R('c1', 'Order', 'u1', 'CREATE', '2026-09-01T10:00:00Z', { branch: 'A' }),
    R('c2', 'Order', 'u1', 'UPDATE', '2026-09-03T10:00:00Z', { branch: 'A' }), // אחרי updateMany לא מתועד A->B
  ]);
  const c2 = e.find((x) => x.id === 'c2');
  check('B3: הרשומה קיימת ומסומנת משוער', !!c2 && c2.estimated === true && c2.text.includes('משוער'));
  const f = one([R('d1', 'Order', 'u2', 'UPDATE', '2026-09-03T10:00:00Z', { branch: { from: 'A', to: 'A' } })]);
  check('שוויון מתועד (from===to) נדחה', f.length === 0);
  const g = one([R('d2', 'Order', 'u3', 'CREATE', '2026-09-01T10:00:00Z', { branch: 'A' }), R('d3', 'Order', 'u3', 'UPDATE', '2026-09-02T10:00:00Z', { branch: 'B' })]);
  check('לפני מוסק שונה מוצג עם (משוער)', g.find((x) => x.id === 'd3').det.some(([l]) => l.includes('משוער')));
}
// קיפול ביטול הזמנה לפי orderId
{
  const t = '2026-09-10T08:00:00Z';
  const rs = [
    R('x1', 'Order', '1001', 'CANCEL_ORDER', t, { isDeleted: { from: false, to: true } }),
    R('x2', 'OrderItem', 'iA', 'CANCEL_ORDER', t, { orderId: 1001, isDeleted: { from: false, to: true } }),
    R('x3', 'OrderItem', 'iB', 'CANCEL_ORDER', t, { orderId: 2002, isDeleted: { from: false, to: true } }),
  ];
  const e = one(rs);
  check('קיפול: רק ילד של אותה הזמנה נבלע (גלובלי)', !e.find((x) => x.id === 'x2') && !!e.find((x) => x.id === 'x3'));
}
// Refund UPDATE
{
  const e = one([R('r1', 'Refund', 'rf', 'UPDATE', '2026-09-01T10:00:00Z', { bankAccount: '123', amount: 100 })]);
  check('Refund UPDATE אינו "נוצר" ואין צ׳יפ', e[0] && !e[0].text.includes('נוצר') && !e[0].amt);
}
// שעה 00:xx ולא 24:xx
{
  const e = one([R('h1', 'Customer', 'c', 'UPDATE', '2026-06-10T21:05:00Z', { city: { from: 'a', to: 'b' } })]);
  check('00:05 ולא 24:05', e[0].ts.endsWith('00:05'));
}
console.log(fails ? `FAIL (${fails})` : 'OK');
process.exit(fails ? 1 : 0);
