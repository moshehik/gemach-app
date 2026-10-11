// buildDeliverySection: display-only. Cases: delivery / none / self pickup / incomplete address / city without price; setting on/off; main gemach.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const D = await import(pathToFileURL(process.env.PROJ + '/lib/orderDelivery.js').href);

const ON = [{ key: 'enable_deliveries', value: 'true' }, { key: 'delivery_days_before', value: '1' }, { key: 'delivery_days_after', value: '1' }];
const ITEMROW = [...ON, { key: 'delivery_as_item_row', value: 'true' }];
const oblig = (amount, description = 'משלוח הלוך-חזור - ירושלים', extra = {}) => ({ amount, description, isDeleted: false, isRefund: false, ...extra });
const base = {
  isDelivery: true, deliveryDirection: 'הלוך-חזור', deliveryCity: 'ירושלים', deliveryAddress: 'הרצל 5',
  eventDate: new Date('2026-11-18T00:00:00Z'), customer: { city: 'בית שמש', street: 'הגפן', houseNum: 3 },
  obligations: [oblig(120), { amount: 300, description: 'שמלה X', isDeleted: false, orderItemId: 'i1' }],
};

test('non-delivery / self pickup order => null, whatever the settings', () => {
  assert.equal(D.buildDeliverySection({ ...base, isDelivery: false }, { settings: ITEMROW }), null);
  assert.equal(D.buildDeliverySection(null, { settings: ITEMROW }), null);
});

test('main gemach (enable_deliveries off/missing) => null even for a legacy isDelivery order', () => {
  assert.equal(D.buildDeliverySection(base, { settings: [] }), null);
  assert.equal(D.buildDeliverySection(base, { settings: [{ key: 'enable_deliveries', value: 'false' }, { key: 'delivery_as_item_row', value: 'true' }] }), null);
});

test('setting OFF: info rows incl. cost, no item row', () => {
  const s = D.buildDeliverySection(base, { settings: ON });
  assert.equal(s.itemRow, null);
  assert.equal(s.amount, 120);
  assert.deepEqual(s.rows.map((r) => r.key), ['type', 'address', 'out', 'back', 'cost']);
  assert.equal(s.addressLine, 'הרצל 5, ירושלים');
  assert.match(s.rows.find((r) => r.key === 'cost').value, /120/);
  assert.ok(s.textLines.some((l) => l.includes('עלות משלוח')));
});

test('setting ON: item row carries the price, cost row is dropped (no duplicate)', () => {
  const s = D.buildDeliverySection(base, { settings: ITEMROW });
  assert.equal(s.itemRow.label, 'משלוח הלוך-חזור');
  assert.equal(s.itemRow.amount, 120);
  assert.match(s.itemRow.detail, /הרצל 5, ירושלים/);
  assert.ok(!s.rows.some((r) => r.key === 'cost'));
  assert.match(D.deliveryItemRowText(s), /₪120/);
});

test('dispatch dates: event Wed 18.11.2026, 1 business day before/after', () => {
  const s = D.buildDeliverySection(base, { settings: ON });
  assert.equal(s.out.key, '2026-11-17');
  assert.equal(s.back.key, '2026-11-19');
});

test('direction filters the dates', () => {
  const o = D.buildDeliverySection({ ...base, deliveryDirection: 'הלוך' }, { settings: ON });
  assert.ok(o.out && !o.back);
  const b = D.buildDeliverySection({ ...base, deliveryDirection: 'חזור' }, { settings: ON });
  assert.ok(!b.out && b.back);
  const n = D.buildDeliverySection({ ...base, deliveryDirection: null }, { settings: ON });
  assert.equal(n.direction, 'הלוך-חזור');
});

test('days_after = 0 rolls a closed event day forward (Friday -> Sunday); one-day-before', () => {
  const settings = [...ON.filter((x) => x.key !== 'delivery_days_after'), { key: 'delivery_days_after', value: '0' }];
  const s = D.buildDeliverySection({ ...base, eventDate: new Date('2026-11-20T00:00:00Z'), deliveryOneDayBefore: true }, { settings });
  assert.equal(s.back.key, '2026-11-22');
  assert.equal(s.out.key, '2026-11-19');
});

test('incomplete address: falls back to the customer address; none at all => warning, no address row', () => {
  const a = D.buildDeliverySection({ ...base, deliveryAddress: '', deliveryCity: '' }, { settings: ON });
  assert.equal(a.addressLine, 'הגפן 3, בית שמש');
  const b = D.buildDeliverySection({ ...base, deliveryAddress: '', deliveryCity: '', customer: {} }, { settings: ON });
  assert.equal(b.addressLine, '');
  assert.ok(b.warnings.includes('no-address'));
  assert.ok(!b.rows.some((r) => r.key === 'address'));
});

test('city without price (no delivery obligation): no cost, item row shows null amount, never "free"', () => {
  const o = { ...base, obligations: [{ amount: 300, description: 'שמלה X', orderItemId: 'i1' }] };
  const off = D.buildDeliverySection(o, { settings: ON });
  assert.equal(off.amount, null);
  assert.ok(!off.rows.some((r) => r.key === 'cost'));
  const on = D.buildDeliverySection(o, { settings: ITEMROW });
  assert.equal(on.itemRow.amount, null);
  assert.ok(!/₪/.test(D.deliveryItemRowText(on)));
});

test('deleted / refund / item-linked obligations are ignored; two delivery legs are summed', () => {
  const obl = [oblig(60), oblig(60, 'משלוח חזור'), oblig(50, 'משלוח', { isDeleted: true }), oblig(-60, 'משלוח', { isRefund: true }), oblig(40, 'משלוח שמלה', { orderItemId: 'i2' })];
  assert.equal(D.deliveryChargeOf(obl), 120);
  assert.equal(D.deliveryChargeOf([]), null);
});

test('display only: the section never changes the order or its obligations', () => {
  const o = JSON.parse(JSON.stringify(base)); o.eventDate = new Date(base.eventDate);
  const before = JSON.stringify(o);
  D.buildDeliverySection(o, { settings: ITEMROW });
  assert.equal(JSON.stringify(o), before);
});

test('settings accepted as map or array; defaults = off', () => {
  assert.equal(D.deliverySettingsFrom({ enable_deliveries: 'true', delivery_as_item_row: 'true' }).asItemRow, true);
  assert.equal(D.deliverySettingsFrom([{ key: 'enable_deliveries', value: 'true' }]).asItemRow, false);
  assert.equal(D.deliverySettingsFrom(undefined).enabled, false);
});
