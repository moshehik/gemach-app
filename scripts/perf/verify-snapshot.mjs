// verify-snapshot.mjs - הוכחה מול ה-DB (TEST בלבד, קריאה בלבד) שתמונת ההזמנות / הלקוחות (lib/adminOrdersList.js ORDER_SNAPSHOT_SQL, lib/adminCustomersList.js
// CUSTOMER_SNAPSHOT_SQL) מחזירה את אותן תשובות כמו הכללים הקיימים: סטטוס נגזר == calculateOrderStatus (lib/orderStatus.js), יום האירוע בשעון ישראל == getIsraelDateKey,
// סכום / שולם == נוסחת /api/orders, וצבירות הלקוח (הזמנות, חוב) == חישוב ב-JS מאותן הזמנות.
// הרצה: node --import ./scripts/perf/register.mjs scripts/perf/verify-snapshot.mjs
import fs from 'node:fs';
import prisma from './stub-prisma.mjs';
import { loadOrderFacts } from '../../lib/adminOrdersListServer.js';
import { loadCustomerFacts } from '../../lib/adminCustomersListServer.js';
import { stateKeyOfWord } from '../../lib/adminOrdersList.js';
import { getIsraelDateKey, getIsraelTodayKey } from '../../lib/hebrewDate.js';

const base = new URL('../../', import.meta.url);
// calculateOrderStatus כפי שהוא (מועתק מהמקור: אותו קוד בלי ה-imports)
const src = fs.readFileSync(new URL('lib/orderStatus.js', base), 'utf8').replace(/^import .*$/gm, '').replace(/export function getStatusColor[\s\S]*$/m, '').replace(/export function/g, 'function');
const shim = `const DRAFT_ORDER_STATUS='טיוטה';
function getIsraelDaysUntil(dateInput, now=new Date()){ if(!dateInput) return null; const k=(d)=>{const x=d instanceof Date?d:new Date(d);return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(x)}; const u=(key)=>{const [y,m,d]=key.split('-').map(Number);return Date.UTC(y,m-1,d)}; return Math.round((u(k(dateInput))-u(k(now)))/86400000) }`;
const calc = new Function(`${shim}\n${src}\nreturn { calculateOrderStatus };`)().calculateOrderStatus;

let bad = 0;
const activeBy = new Map(); // customerId -> הזמנות פעילות לפי calculateOrderStatus
const fail = (msg) => { bad++; if (bad <= 15) console.log('MISMATCH', msg); };

const todayKey = getIsraelTodayKey();
for (const draftsAsDeleted of [true, false]) {
  const ctx = { todayKey, draftsAsDeleted };
  const facts = await loadOrderFacts(ctx);
  const byId = new Map(facts.map((f) => [f.id, f]));
  const orders = [];
  for (let skip = 0; ; skip += 3000) {
    const rows = await prisma.order.findMany({
      select: { orderId: true, customerId: true, isDeleted: true, status: true, eventDate: true, orderDate: true, totalAmount: true, items: { select: { isDeleted: true, isTaken: true, isReturned: true } }, payments: { select: { amount: true, isDeleted: true } }, obligations: { select: { amount: true, isDeleted: true } } },
      orderBy: { orderId: 'asc' }, skip, take: 3000,
    });
    if (!rows.length) break;
    orders.push(...rows);
  }
  let nState = 0; let nDay = 0; let nMoney = 0;
  for (const o of orders) {
    const f = byId.get(o.orderId);
    if (!f) { fail(`order ${o.orderId} missing from snapshot`); continue; }
    const want = stateKeyOfWord(calc(o, { draftsAsDeleted }));
    if (draftsAsDeleted && o.customerId && ['upcoming', 'partRented', 'rented', 'partReturned'].includes(want)) activeBy.set(o.customerId, (activeBy.get(o.customerId) || 0) + 1);
    if (f.state !== want) fail(`state ${o.orderId}: snapshot=${f.state} calculateOrderStatus=${want}`); else nState++;
    const wantDay = o.eventDate ? getIsraelDateKey(o.eventDate) : '';
    if (f.ek !== wantDay) fail(`event day ${o.orderId}: sql=${f.ek} js=${wantDay} (${o.eventDate && o.eventDate.toISOString()})`); else nDay++;
    const obl = o.obligations.reduce((s, b) => s + (b.isDeleted ? 0 : b.amount), 0);
    const paid = o.payments.reduce((s, p) => s + (p.isDeleted ? 0 : p.amount), 0);
    const total = o.totalAmount && o.totalAmount > 0 ? o.totalAmount : (obl > 0 ? obl : paid);
    if (Math.abs(f.total - total) > 0.005 || Math.abs(f.paid - paid) > 0.005) fail(`money ${o.orderId}: sql=${f.total}/${f.paid} js=${total}/${paid}`); else nMoney++;
  }
  console.log(`orders draftsAsDeleted=${draftsAsDeleted}: ${orders.length} orders, state ok ${nState}, event-day ok ${nDay}, money ok ${nMoney}, snapshot rows ${facts.length}`);
}

// לקוחות: הזמנות וחוב == חישוב ב-JS מאותן הזמנות לא-מחוקות
const cust = await loadCustomerFacts();
const agg = new Map();
const ordersAll = [];
for (let skip = 0; ; skip += 3000) {
  const rows = await prisma.order.findMany({
    where: { isDeleted: false, customerId: { not: null } },
    select: { customerId: true, totalAmount: true, payments: { select: { amount: true, isDeleted: true } }, obligations: { select: { amount: true, isDeleted: true } } },
    orderBy: { orderId: 'asc' }, skip, take: 3000,
  });
  if (!rows.length) break;
  ordersAll.push(...rows);
}
for (const o of ordersAll) {
  const obl = o.obligations.reduce((s, b) => s + (b.isDeleted ? 0 : b.amount), 0);
  const paid = o.payments.reduce((s, p) => s + (p.isDeleted ? 0 : p.amount), 0);
  const total = o.totalAmount && o.totalAmount > 0 ? o.totalAmount : (obl > 0 ? obl : paid);
  const a = agg.get(o.customerId) || { orders: 0, debt: 0 };
  a.orders++; if (total > 0 && paid < total) a.debt += total - paid;
  agg.set(o.customerId, a);
}
let nc = 0;
for (const f of cust) {
  const a = agg.get(f.id) || { orders: 0, debt: 0 };
  if ((activeBy.get(f.id) || 0) !== f.active) fail(`customer ${f.id} active: sql=${f.active} js=${activeBy.get(f.id) || 0}`);
  if (f.orders !== a.orders || Math.abs(f.debt - Math.round(a.debt * 100) / 100) > 0.011) fail(`customer ${f.id}: sql=${f.orders}/${f.debt} js=${a.orders}/${a.debt}`); else nc++;
}
console.log(`customers: ${cust.length} in snapshot, orders+debt ok ${nc}, active-orders checked against calculateOrderStatus`);
console.log(bad ? `FAILED: ${bad} mismatches` : 'ALL OK - 0 mismatches');
await prisma.$disconnect();
process.exitCode = bad ? 1 : 0;
