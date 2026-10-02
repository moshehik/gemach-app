// Fixtures for the PP-02 / PP-13 / PP-19 tests and the render harness (pp02-13-19.render.mjs).
// Built on top of scripts/schedule-tests/fixtures.mjs (today = Thursday 2026-10-01): extra orders with money (stage 1),
// local pickups (stage 6) and return-pickup deliveries (stage 9), all landing on 1.10.
import { ORDERS } from '../schedule-tests/fixtures.mjs';

const d = (iso) => new Date(iso);
const base = (id) => ORDERS.find((o) => o.orderId === id);
const cust = (first, last, extra = {}) => ({ firstName: first, lastName: last, phone1: '050-1111111', phone2: '', city: 'ירושלים', street: 'הרצל', houseNum: 5, ...extra });
const pay = (amount, isDeleted = false) => ({ amount, isDeleted });

// --- stage 1: registered on 1.10 (same orders as PP-01 + a few with money) ---
const stage1 = [
  // 1001 (from the shared fixtures): total 1200, paid 400 -> balance 800 (set by withMoney below)
  { ...base(1001), orderId: 7001, orderDate: d('2026-10-01T05:00:00Z'), eventDate: d('2026-10-14T21:00:00Z'), totalAmount: 900, payments: [pay(900)], customer: cust('פרעה', 'שולמה') },        // fully paid -> excluded
  { ...base(1001), orderId: 7002, orderDate: d('2026-10-01T05:10:00Z'), eventDate: d('2026-10-03T21:00:00Z'), totalAmount: 1000, payments: [], customer: cust('אסתר', 'קרובה') },                      // event 4.10 (3 days) -> bold, first
  { ...base(1001), orderId: 7003, orderDate: d('2026-10-01T05:20:00Z'), eventDate: d('2026-11-04T22:00:00Z'), totalAmount: 600, payments: [pay(250), pay(100, true)], customer: cust('נעמי', 'רחוקה') }, // deleted payment ignored -> 350
  { ...base(1001), orderId: 7004, orderDate: d('2026-10-01T05:30:00Z'), eventDate: null, totalAmount: 450, payments: [pay(50)], customer: cust('דבורה', 'בלי אירוע') },                                 // no event date -> last
];

// --- stage 6: local pickup on 1.10 (event Mon 5.10 -> pickup Thu 1.10, not a delivery-out) ---
const pickBase = { ...base(1007), orderDate: d('2026-09-20T08:00:00Z'), eventDate: d('2026-10-04T21:00:00Z'), isDelivery: false, deliveryDirection: null, pickupBranch: 'גב״ש' };
const stage6 = [
  { ...pickBase, orderId: 7011, totalAmount: 800, payments: [pay(800)], customer: cust('שרה', 'אלף'), items: [{ ...pickBase.items[0], isTaken: false }, { ...pickBase.items[0], id: 'it-b', isTaken: false }] },     // paid in full
  { ...pickBase, orderId: 7012, totalAmount: null, payments: [], customer: cust('רחל', 'בית'), items: [{ ...pickBase.items[0], id: 'it-c', isTaken: false }] },                                            // no amount -> blank
  { ...pickBase, orderId: 7013, totalAmount: 500, payments: [pay(200), pay(999, true)], customer: cust('לאה', 'גימל'), items: [{ ...pickBase.items[0], id: 'it-d', isTaken: true }] },                     // everything already taken -> "נאסף"
];

// --- stage 9: return pickups by the courier on 1.10 (event 30.9 + delivery_days_after=1) ---
const dbBase = { ...base(1010), eventDate: d('2026-09-29T21:00:00Z'), isDelivery: true, deliveryDirection: 'הלוך-חזור', deliveryAddress: null, deliveryCity: null };
const stage9 = [
  { ...dbBase, orderId: 7021, customer: cust('חיה', 'ירושלמית', { street: 'יפו', houseNum: 10, phone2: '052-2222222' }), items: [dbBase.items[0], { ...dbBase.items[0], id: 'it-e' }], notes: 'לקרוא לפני ההגעה' },
  { ...dbBase, orderId: 7022, customer: cust('טובה', 'בלי רחוב', { street: '', houseNum: null }) },
  { ...dbBase, orderId: 7023, customer: cust('ציפורה', 'בלי עיר', { city: '', street: 'הנביאים', houseNum: 3 }) },
  { ...dbBase, orderId: 7024, customer: cust('מירי', 'ירושלמית', { street: 'אגריפס', houseNum: 2 }) },
];

export const PP_G1_EXTRA_ORDERS = [...stage1, ...stage6, ...stage9];

// the shared fixtures' money (same as route.test.mjs / render.mjs): 1001 total 1200 paid 400 (+ a deleted 100), 1021 total 500
export function withMoney(orders) {
  return orders.map((o) => {
    if (o.orderId === 1001) return { ...o, totalAmount: 1200, isPaid: false, isDelivery: true, deliveryDirection: 'הלוך-חזור', payments: [pay(400), pay(100, true)] };
    if (o.orderId === 1021) return { ...o, totalAmount: 500, payments: [] };
    return o;
  });
}

export function allOrders() {
  return [...withMoney(ORDERS), ...PP_G1_EXTRA_ORDERS];
}

// real getScheduleDay (mock prisma) -> loadExtras -> buildPrintPayload for the given page keys
export async function payloadFor(keys, { date = '2026-10-01', orders = allOrders() } = {}) {
  const { pathToFileURL } = await import('node:url');
  const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
  const { installDb, NOW } = await import('../schedule-tests/fixtures.mjs');
  installDb({ extra: { order: orders } });
  const { getScheduleDay } = await L('lib/schedule/index.js');
  const { loadExtras, buildPrintPayload } = await L('lib/schedule/print/data.js');
  const { getPrintPage } = await L('lib/schedule/print/registry.js');
  const day = await getScheduleDay({ date, user: { id: 'emp-head', roleId: 0 }, now: NOW });
  const extras = await loadExtras(day, keys.map(getPrintPage));
  const payload = buildPrintPayload({ day, keys, extras, gmach: { name: 'גמ״ח שמלות', address: 'רחוב הדוגמה 12, ירושלים', phone: '02-555-0100' }, printedBy: 'מנהלת (דוגמה)', now: NOW });
  return { day, extras, payload };
}
