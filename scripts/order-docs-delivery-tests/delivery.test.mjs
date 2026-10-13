// buildDeliverySection: display-only. Cases: delivery / none / self pickup / incomplete address / city without price; setting on/off; main gemach;
// item rows per direction; payment-summary breakdown; notice (editable text + hours).
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

test('setting OFF: info rows incl. cost, no item rows', () => {
  const s = D.buildDeliverySection(base, { settings: ON });
  assert.deepEqual(s.itemRows, []);
  assert.equal(s.amount, 120);
  assert.deepEqual(s.rows.map((r) => r.key), ['type', 'address', 'out', 'back', 'cost']);
  assert.equal(s.addressLine, 'הרצל 5, ירושלים');
  assert.match(s.rows.find((r) => r.key === 'cost').value, /120/);
  assert.ok(s.textLines.some((l) => l.includes('עלות משלוח')));
});

test('setting ON: one item row per direction with that leg price, cost row dropped (no duplicate)', () => {
  const s = D.buildDeliverySection(base, { settings: ITEMROW });
  assert.deepEqual(s.itemRows.map((r) => r.label), ['משלוח הלוך', 'משלוח חזור']);
  assert.deepEqual(s.itemRows.map((r) => r.amount), [60, 60]);
  assert.match(s.itemRows[0].detail, /הרצל 5, ירושלים/);
  assert.ok(!s.rows.some((r) => r.key === 'cost'));
  assert.match(D.deliveryItemRowsText(s), /משלוח הלוך.*₪60.*משלוח חזור.*₪60/);
});

test('single direction: one row only', () => {
  const o = D.buildDeliverySection({ ...base, deliveryDirection: 'הלוך', obligations: [oblig(60, 'משלוח הלוך - ירושלים')] }, { settings: ITEMROW });
  assert.deepEqual(o.itemRows.map((r) => [r.key, r.amount]), [['out', 60]]);
  const b = D.buildDeliverySection({ ...base, deliveryDirection: 'חזור', obligations: [oblig(60, 'משלוח חזור - ירושלים')] }, { settings: ITEMROW });
  assert.deepEqual(b.itemRows.map((r) => [r.key, r.amount]), [['back', 60]]);
});

test('summaryRows: always (setting off too), per direction, sum equals the charged total (odd cents, per-leg obligations)', () => {
  const off = D.buildDeliverySection(base, { settings: ON });
  assert.deepEqual(off.summaryRows.map((r) => [r.label, r.amount]), [['משלוח הלוך', 60], ['משלוח חזור', 60]]);
  const odd = D.buildDeliverySection({ ...base, obligations: [oblig(0.01)] }, { settings: ON });
  assert.equal(Math.round(odd.summaryRows.reduce((s, r) => s + r.amount, 0) * 100), 1);
  const legs = D.buildDeliverySection({ ...base, obligations: [oblig(40, 'משלוח הלוך'), oblig(70, 'משלוח חזור')] }, { settings: ON });
  assert.deepEqual(legs.summaryRows.map((r) => r.amount), [40, 70]);
  const oneLeg = D.buildDeliverySection({ ...base, obligations: [oblig(40, 'משלוח הלוך')] }, { settings: ITEMROW });
  assert.deepEqual(oneLeg.itemRows.map((r) => r.amount), [40, null]);
});

test('notice: default Neve text + hours, only the relevant direction lines, editable via settings, hidden when emptied', () => {
  const both = D.buildDeliverySection(base, { settings: ON }).notice;
  assert.equal(both.text, D.DELIVERY_NOTICE_DEFAULTS.text);
  assert.deepEqual(both.lines.map((l) => l.text), ['משלוח הלוך: בשעות אחה"צ–ערב.', 'משלוח חזור: 10:00–13:00.']);
  const out = D.buildDeliverySection({ ...base, deliveryDirection: 'הלוך' }, { settings: ON }).notice;
  assert.deepEqual(out.lines.map((l) => l.key), ['out']);
  const back = D.buildDeliverySection({ ...base, deliveryDirection: 'חזור' }, { settings: ON }).notice;
  assert.deepEqual(back.lines.map((l) => l.key), ['back']);
  const custom = D.buildDeliverySection(base, { settings: [...ON, { key: 'delivery_notice_text', value: 'טקסט אחר' }, { key: 'delivery_outbound_hours', value: '17:00-21:00' }, { key: 'delivery_return_hours', value: '' }] }).notice;
  assert.equal(custom.text, 'טקסט אחר');
  assert.deepEqual(custom.lines.map((l) => l.text), ['משלוח הלוך: 17:00-21:00.']);
  const none = D.buildDeliverySection(base, { settings: [...ON, { key: 'delivery_notice_text', value: '' }, { key: 'delivery_outbound_hours', value: '' }, { key: 'delivery_return_hours', value: '' }] });
  assert.equal(none.notice, null);
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

test('city without price (no delivery obligation): no cost, rows without amount, never "free"', () => {
  const o = { ...base, obligations: [{ amount: 300, description: 'שמלה X', orderItemId: 'i1' }] };
  const off = D.buildDeliverySection(o, { settings: ON });
  assert.equal(off.amount, null);
  assert.ok(!off.rows.some((r) => r.key === 'cost'));
  const on = D.buildDeliverySection(o, { settings: ITEMROW });
  assert.ok(on.itemRows.every((r) => r.amount === null));
  assert.ok(!/₪/.test(D.deliveryItemRowsText(on)));
  assert.deepEqual(on.summaryRows, []);
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
