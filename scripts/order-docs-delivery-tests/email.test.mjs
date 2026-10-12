// Email templates: the delivery block shows only when a section is passed; no section => identical to the order without delivery.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const D = await import(pathToFileURL(process.env.PROJ + '/lib/orderDelivery.js').href);
const T = await import(pathToFileURL(process.env.PROJ + '/lib/emailTemplates.js').href);

const ON = [{ key: 'enable_deliveries', value: 'true' }];
const ITEMROW = [...ON, { key: 'delivery_as_item_row', value: 'true' }];
const order = {
  isDelivery: true, deliveryDirection: 'הלוך-חזור', deliveryCity: 'ירושלים', deliveryAddress: 'הרצל 5',
  eventDate: new Date('2026-11-18T00:00:00Z'), customer: {}, obligations: [{ amount: 120, description: 'משלוח הלוך-חזור - ירושלים' }],
};
const confirm = (delivery) => T.renderOrderConfirmationEmailHtml({
  customerName: 'דנה כהן', orderId: 1234, eventDate: 'י"ח חשוון', pickupLine: 'x', returnLine: 'y',
  items: [{ name: 'שמלה א', size: '38' }], totalCharge: 420, totalPaid: 100, balance: 320, delivery,
});
const strip = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&#39;|&quot;|&amp;/g, '').replace(/\s+/g, ' ');

test('confirmation email: no delivery => no mention, and passing null equals not passing', () => {
  const a = confirm(undefined), b = confirm(null);
  assert.equal(a, b);
  assert.ok(!/משלוח/.test(a));
});

test('confirmation email: delivery block (address, dates, cost) when a section is passed', () => {
  const html = confirm(D.buildDeliverySection(order, { settings: ON }));
  const t = strip(html);
  assert.match(t, /הרצל 5, ירושלים/);
  assert.match(t, /מועד המשלוח \(הלוך\)/);
  assert.match(t, /מועד האיסוף \(חזור\)/);
  assert.match(t, /עלות משלוח/);
  assert.match(t, /₪\s?120/);
  assert.ok(!/🚚/.test(html));
});

test('confirmation email: item-row setting => truck row with price inside the items list, no separate cost row', () => {
  const html = confirm(D.buildDeliverySection(order, { settings: ITEMROW }));
  assert.match(html, /🚚/);
  const t = strip(html);
  assert.match(t, /משלוח הלוך-חזור/);
  assert.ok(!/עלות משלוח/.test(t));
  assert.match(t, /₪\s?120/);
  // the totals block is untouched by the delivery section
  const totals = (h) => strip(h).match(/סיכום תשלום.*$/)[0];
  assert.equal(totals(confirm(D.buildDeliverySection(order, { settings: ON }))), totals(html));
  assert.equal(totals(confirm(null)), totals(html));
});

test('accompanying card email: delivery rows only when passed', () => {
  const base = { orderId: 1234, customerName: 'דנה כהן', eventDate: 'י"ח חשוון' };
  assert.equal(T.renderOrderCardEmailHtml(base), T.renderOrderCardEmailHtml({ ...base, delivery: null }));
  assert.ok(!/משלוח/.test(T.renderOrderCardEmailHtml(base)));
  const t = strip(T.renderOrderCardEmailHtml({ ...base, delivery: D.buildDeliverySection(order, { settings: ON }) }));
  assert.match(t, /כתובת המשלוח/);
  assert.match(t, /עלות משלוח/);
});

test('city without price + item row: row without a shekel amount, never claims free', () => {
  const o = { ...order, obligations: [] };
  const html = confirm(D.buildDeliverySection(o, { settings: ITEMROW }));
  assert.match(html, /🚚/);
  const row = strip(html).match(/🚚[^]*?(?=סיכום תשלום)/)[0];
  assert.ok(!/₪/.test(row));
});
