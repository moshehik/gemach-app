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
  assert.ok(!/אין צורך לבוא/.test(a));
  assert.ok(!/מתוכם/.test(a));
});

test('confirmation email: delivery block (address, dates) when a section is passed; cost shown per leg in the payment summary', () => {
  const html = confirm(D.buildDeliverySection(order, { settings: ON }));
  const t = strip(html);
  assert.match(t, /הרצל 5, ירושלים/);
  assert.match(t, /מועד המשלוח \(הלוך\)/);
  assert.match(t, /מועד האיסוף \(חזור\)/);
  assert.ok(!html.includes('🚚'));
  const summary = t.slice(t.indexOf('סיכום תשלום'));
  assert.match(summary, /מתוכם משלוח הלוך\s*₪\s?60/);
  assert.match(summary, /מתוכם משלוח חזור\s*₪\s?60/);
});

test('confirmation email: item-row setting => one truck row per direction with its price, still the same summary', () => {
  const html = confirm(D.buildDeliverySection(order, { settings: ITEMROW }));
  assert.equal(html.split('🚚').length - 1, 2);
  const t = strip(html);
  assert.match(t, /משלוח הלוך/);
  assert.match(t, /משלוח חזור/);
  assert.ok(!/עלות משלוח/.test(t));
  const totals = (h) => strip(h).match(/סיכום תשלום.*$/)[0];
  assert.equal(totals(confirm(D.buildDeliverySection(order, { settings: ON }))), totals(html));
});

test('confirmation email: payment summary lists the delivery legs, total includes delivery, notice with the default Neve text', () => {
  for (const settings of [ON, ITEMROW]) {
    const t = strip(confirm(D.buildDeliverySection(order, { settings })));
    assert.match(t.slice(t.indexOf('סיכום תשלום')), /₪\s?420/);
    assert.match(t, /אין צורך לבוא לגמ/);
    assert.match(t, /משלוח הלוך: בשעות אחה/);
    assert.match(t, /משלוח חזור: 10:00–13:00/);
  }
});

test('confirmation email: notice shows only the relevant leg line', () => {
  const o = { ...order, deliveryDirection: 'הלוך', obligations: [{ amount: 60, description: 'משלוח הלוך - ירושלים' }] };
  const t = strip(confirm(D.buildDeliverySection(o, { settings: ON })));
  assert.match(t, /משלוח הלוך: בשעות/);
  assert.ok(!/משלוח חזור: 10/.test(t));
});

test('accompanying card email: delivery rows only when passed', () => {
  const base = { orderId: 1234, customerName: 'דנה כהן', eventDate: 'י"ח חשוון' };
  assert.equal(T.renderOrderCardEmailHtml(base), T.renderOrderCardEmailHtml({ ...base, delivery: null }));
  assert.ok(!/משלוח/.test(T.renderOrderCardEmailHtml(base)));
  const t = strip(T.renderOrderCardEmailHtml({ ...base, delivery: D.buildDeliverySection(order, { settings: ON }) }));
  assert.match(t, /כתובת המשלוח/);
  assert.match(t, /עלות משלוח/);
});

test('city without price + item rows: rows without a shekel amount, never claims free', () => {
  const o = { ...order, obligations: [] };
  const html = confirm(D.buildDeliverySection(o, { settings: ITEMROW }));
  assert.match(html, /🚚/);
  const t = strip(html);
  assert.ok(!/מתוכם/.test(t));
  const items = t.slice(t.indexOf('פריטים'), t.indexOf('סיכום תשלום'));
  assert.ok(!/₪/.test(items));
});
