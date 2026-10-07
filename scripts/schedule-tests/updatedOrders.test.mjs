// "הזמנות שעודכנו" (הגדרת הבעלים 7.10.2026): פריט שנוסף/נערך או תשלום שנוסף, בלי הזמנות שנרשמו באותו יום.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const { buildUpdatedRows } = await L('lib/schedule/updatedRows.js');
const { updatedItems } = await L('app/components/schedule/scheduleMeta.js');

const DAY = '2026-10-07';
const at = (hhmm) => '2026-10-07T' + hhmm + ':00+03:00';
const order = (id, orderDate) => [id, { orderId: id, orderDate, branch: null, pickupBranch: null, eventDateHebrew: 'ד חשון', customer: { name: 'שרה כהן', phone1: '' } }];
const orders = new Map([order(1, '2026-09-20T09:00:00+03:00'), order(2, '2026-10-07T08:00:00+03:00'), order(3, '2026-09-25T09:00:00+03:00')]);

test('added item + payment on an older order are one row; counts and last time', () => {
  const rows = buildUpdatedRows({
    dayKey: DAY, orders,
    added: [{ id: 'a', orderId: 1, createdAt: at('10:00') }],
    payments: [{ orderId: 1, amount: 300, isRefund: false, paymentDate: at('12:30') }],
  });
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].itemsAdded, rows[0].paymentCount, rows[0].paymentTotal, rows[0].lastAt], [1, 1, 300, new Date(at('12:30')).toISOString()]);
});

test('an order registered the same day (shown in new orders) is excluded', () => {
  const rows = buildUpdatedRows({ dayKey: DAY, orders, added: [{ id: 'b', orderId: 2, createdAt: at('09:00') }] });
  assert.equal(rows.length, 0);
});

test('item edit counts; pickup/return scan updates do not; deleted item = removed', () => {
  const rows = buildUpdatedRows({
    dayKey: DAY, orders,
    touched: [
      { id: 'c', orderId: 1, createdAt: '2026-09-20T09:00:00+03:00', updatedAt: at('11:00'), isDeleted: false, takenDate: null, returnDate: null },
      { id: 'd', orderId: 3, createdAt: '2026-09-25T09:00:00+03:00', updatedAt: at('11:00'), isDeleted: false, takenDate: at('11:00'), returnDate: null },
      { id: 'e', orderId: 3, createdAt: '2026-09-25T09:00:00+03:00', updatedAt: at('11:05'), isDeleted: false, takenDate: null, returnDate: at('11:05') },
      { id: 'f', orderId: 1, createdAt: '2026-09-20T09:00:00+03:00', updatedAt: at('11:30'), isDeleted: true, takenDate: null, returnDate: null },
    ],
  });
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].orderId, rows[0].itemsEdited, rows[0].itemsRemoved], [1, 1, 1]);
});

test('an item both added and touched the same day is counted once, as added; refunds are counted apart', () => {
  const rows = buildUpdatedRows({
    dayKey: DAY, orders,
    added: [{ id: 'g', orderId: 1, createdAt: at('09:00') }],
    touched: [{ id: 'g', orderId: 1, createdAt: at('09:00'), updatedAt: at('09:10'), isDeleted: false, takenDate: null, returnDate: null }],
    payments: [{ orderId: 1, amount: 100, isRefund: true, paymentDate: at('13:00') }],
  });
  assert.deepEqual([rows[0].itemsAdded, rows[0].itemsEdited, rows[0].paymentCount, rows[0].refundCount], [1, 0, 0, 1]);
});

test('rows are newest first; short text parts', () => {
  const rows = buildUpdatedRows({
    dayKey: DAY, orders,
    added: [{ id: 'h', orderId: 1, createdAt: at('09:00') }],
    payments: [{ orderId: 3, amount: 50, isRefund: false, paymentDate: at('15:00') }],
  });
  assert.deepEqual(rows.map((r) => r.orderId), [3, 1]);
  const parts = updatedItems(rows[0]);
  assert.deepEqual(parts.map((p) => p.icon), ['cal', 'cash', 'clock']);
  assert.equal(parts[1].text, '₪50');
});
