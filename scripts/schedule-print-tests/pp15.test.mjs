// PP-15 "רשימת אירועים": the receive / return columns follow the schedule's delivery-direction rule
// (lib/schedule/deliveryDirection.js): a delivery order with a NULL direction is 'הלוך-חזור'.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);

function dayWith(rows) {
  return { date: '2026-10-01', stages: [{ key: 'event', enabled: true, items: rows }] };
}
const row = (orderId) => ({ orderId, eventKey: '2026-10-01', customer: { firstName: 'א', lastName: 'ב', phone1: '050-0000000' }, dressCount: 1 });

test('null / each direction -> receive + return text', async () => {
  const PP15 = await L('lib/schedule/print/pages/PP-15.js');
  const extras = { orderInfo: {
    1: { delivery: { isDelivery: true, direction: null } },
    2: { delivery: { isDelivery: true, direction: 'הלוך' } },
    3: { delivery: { isDelivery: true, direction: 'חזור' } },
    4: { delivery: { isDelivery: true, direction: 'הלוך-חזור' } },
    5: { delivery: { isDelivery: false, direction: null } },
  } };
  const data = PP15.build({ day: dayWith([1, 2, 3, 4, 5].map(row)), extras });
  const rows = PP15.toRows(data);
  const by = Object.fromEntries(rows.map((r) => [String(r['הזמנה']), r]));
  const pick = (id) => { const r = by[id]; const vals = Object.values(r); return [vals.find((v) => v === 'משלוח הלוך' || v === 'איסוף'), vals.find((v) => v === 'משלוח חזור' || v === 'החזרה ידנית')]; };
  assert.deepEqual(pick(1), ['משלוח הלוך', 'משלוח חזור'], 'null direction = הלוך-חזור');
  assert.deepEqual(pick(2), ['משלוח הלוך', 'החזרה ידנית']);
  assert.deepEqual(pick(3), ['איסוף', 'משלוח חזור']);
  assert.deepEqual(pick(4), ['משלוח הלוך', 'משלוח חזור']);
  assert.deepEqual(pick(5), ['איסוף', 'החזרה ידנית']);
});

test('loaders.js re-exports the same predicates', async () => {
  const pure = await L('lib/schedule/deliveryDirection.js');
  const src = (await import('node:fs')).readFileSync(process.env.PROJ + '/lib/schedule/loaders.js', 'utf8');
  assert.match(src, /import \{ isDeliveryOut, isDeliveryReturn \} from '\.\/deliveryDirection'/);
  assert.match(src, /export \{ isDeliveryOut, isDeliveryReturn \};/);
  assert.equal(pure.isDeliveryOut({ isDelivery: true, deliveryDirection: null }), true);
  assert.equal(pure.isDeliveryReturn({ isDelivery: true, deliveryDirection: null }), true);
  assert.equal(pure.isDeliveryOut(null), false);
});
