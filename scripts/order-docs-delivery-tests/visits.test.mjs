// Decision 27: who has to visit the gmach in a delivery order; pickup/late reminders skip delivery orders (only the handled direction); maps link; templates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const D = await import(pathToFileURL(process.env.PROJ + '/lib/orderDelivery.js').href);
const C = await import(pathToFileURL(process.env.PROJ + '/lib/gmachContact.js').href);
const T = await import(pathToFileURL(process.env.PROJ + '/lib/emailTemplates.js').href);

const ON = [{ key: 'enable_deliveries', value: 'true' }];
const mk = (direction, extra = {}) => ({ isDelivery: true, deliveryDirection: direction, deliveryCity: 'ירושלים', deliveryAddress: 'הרצל 5', eventDate: new Date('2026-11-18T00:00:00Z'), customer: {}, obligations: [{ amount: 120, description: 'משלוח הלוך-חזור - ירושלים' }], ...extra });
const strip = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&#39;|&quot;|&amp;/g, '').replace(/\s+/g, ' ');
const LINES = { pickupLine: 'ביום ב 20:00', returnLine: 'ביום ה עד 13:00', address: 'צוקרמן 1, נווה יעקב', mapsUrl: 'https://maps.example/x' };

test('customerVisitsFor: both = never, out-only = return only, back-only = pickup only', () => {
  assert.deepEqual(D.customerVisitsFor('הלוך-חזור'), { pickup: false, ret: false, address: false });
  assert.deepEqual(D.customerVisitsFor(null), { pickup: false, ret: false, address: false });
  assert.deepEqual(D.customerVisitsFor('הלוך'), { pickup: false, ret: true, address: true });
  assert.deepEqual(D.customerVisitsFor('חזור'), { pickup: true, ret: false, address: true });
});

test('visibleVisitLines: filters per direction; no section (self pickup / main gemach) = unchanged', () => {
  assert.deepEqual(D.visibleVisitLines(LINES, null), LINES);
  const both = D.visibleVisitLines(LINES, D.buildDeliverySection(mk('הלוך-חזור'), { settings: ON }));
  assert.deepEqual(both, { pickupLine: '', returnLine: '', address: '', mapsUrl: '' });
  const out = D.visibleVisitLines(LINES, D.buildDeliverySection(mk('הלוך'), { settings: ON }));
  assert.deepEqual(out, { pickupLine: '', returnLine: LINES.returnLine, address: LINES.address, mapsUrl: LINES.mapsUrl });
  const back = D.visibleVisitLines(LINES, D.buildDeliverySection(mk('חזור'), { settings: ON }));
  assert.deepEqual(back, { pickupLine: LINES.pickupLine, returnLine: '', address: LINES.address, mapsUrl: LINES.mapsUrl });
});

test('reminders: pickup reminder skipped for out/both delivery, sent for back-only and self pickup; return reminder the mirror; main gemach unchanged', () => {
  const self = { isDelivery: false, deliveryDirection: null };
  assert.equal(D.skipPickupReminderForDelivery(mk('הלוך-חזור'), true), true);
  assert.equal(D.skipPickupReminderForDelivery(mk('הלוך'), true), true);
  assert.equal(D.skipPickupReminderForDelivery(mk('חזור'), true), false);
  assert.equal(D.skipPickupReminderForDelivery(self, true), false);
  assert.equal(D.skipReturnReminderForDelivery(mk('הלוך-חזור'), true), true);
  assert.equal(D.skipReturnReminderForDelivery(mk('חזור'), true), true);
  assert.equal(D.skipReturnReminderForDelivery(mk('הלוך'), true), false);
  assert.equal(D.skipReturnReminderForDelivery(self, true), false);
  for (const o of [mk('הלוך-חזור'), mk('הלוך'), mk('חזור'), self]) {
    assert.equal(D.skipPickupReminderForDelivery(o, false), false); // enable_deliveries off
    assert.equal(D.skipReturnReminderForDelivery(o, false), false);
  }
});

test('maps url: derived from gmach_pickup_address only (opt-in), custom url wins, no link without either', () => {
  const get = (m) => (k) => m[k];
  assert.equal(C.pickupMapsUrlFrom(get({ gmach_pickup_address: 'צוקרמן 1, נווה יעקב' })), 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('צוקרמן 1, נווה יעקב'));
  assert.equal(C.pickupMapsUrlFrom(get({ gmach_pickup_address: 'x', gmach_pickup_maps_url: 'https://maps.app.goo.gl/abc' })), 'https://maps.app.goo.gl/abc');
  assert.equal(C.pickupMapsUrlFrom(get({ gmach_pickup_address: 'x', gmach_pickup_maps_url: 'javascript:alert(1)' })), 'https://www.google.com/maps/search/?api=1&query=x');
  assert.equal(C.pickupMapsUrlFrom(get({ gmach_address: 'רחוב 1' })), ''); // main gemach: no dedicated address => unchanged, no link
  assert.equal(C.pickupMapsUrlFromList([{ key: 'gmach_pickup_address', value: 'a b' }]), 'https://www.google.com/maps/search/?api=1&query=a%20b');
});

const confirm = (delivery, extra = {}) => T.renderOrderConfirmationEmailHtml({
  customerName: 'דנה', orderId: 1, eventDate: 'ח כסלו', pickupLine: 'PICKUPLINE', returnLine: 'RETURNLINE', items: [{ name: 'שמלה', size: '38' }],
  totalCharge: 420, totalPaid: 0, balance: 420, gmachAddress: 'צוקרמן 1, נווה יעקב', gmachPhone: '0500000000', pickupMapsUrl: 'https://www.google.com/maps/search/?api=1&query=x', delivery, ...extra,
});

test('confirmation email: self pickup keeps pickup/return/address and shows the maps link', () => {
  const html = confirm(null);
  assert.match(html, /PICKUPLINE/);
  assert.match(html, /RETURNLINE/);
  assert.match(strip(html), /כתובת האיסוף: צוקרמן 1, נווה יעקב/);
  assert.match(html, /href="https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=x"/);
  assert.match(strip(html), /פתיחה במפות Google/);
});

test('confirmation email: delivery both => no pickup/return/address/link; out-only => return + address + link; back-only => pickup + address + link', () => {
  const both = confirm(D.buildDeliverySection(mk('הלוך-חזור'), { settings: ON }));
  assert.ok(!/PICKUPLINE|RETURNLINE/.test(both));
  assert.ok(!/כתובת האיסוף|פתיחה במפות|צוקרמן/.test(strip(both)));
  assert.match(strip(both), /0500000000/); // phone stays
  const out = confirm(D.buildDeliverySection(mk('הלוך'), { settings: ON }));
  assert.ok(!/PICKUPLINE/.test(out));
  assert.match(out, /RETURNLINE/);
  assert.match(strip(out), /כתובת האיסוף: צוקרמן 1, נווה יעקב/);
  assert.match(out, /maps\/search/);
  const back = confirm(D.buildDeliverySection(mk('חזור'), { settings: ON }));
  assert.match(back, /PICKUPLINE/);
  assert.ok(!/RETURNLINE/.test(back));
  assert.match(back, /maps\/search/);
});

test('card email: maps row only with a link and when the customer visits; unchanged without a link', () => {
  const base = { orderId: 1, customerName: 'דנה', eventDate: 'ח כסלו', gmachAddress: 'צוקרמן 1, נווה יעקב' };
  assert.equal(T.renderOrderCardEmailHtml(base), T.renderOrderCardEmailHtml({ ...base, pickupMapsUrl: '' }));
  const withLink = T.renderOrderCardEmailHtml({ ...base, pickupMapsUrl: 'https://www.google.com/maps/search/?api=1&query=x' });
  assert.match(strip(withLink), /כתובת האיסוף.*צוקרמן 1, נווה יעקב.*פתיחה במפות Google/);
  const both = T.renderOrderCardEmailHtml({ ...base, pickupMapsUrl: 'https://www.google.com/maps/search/?api=1&query=x', delivery: D.buildDeliverySection(mk('הלוך-חזור'), { settings: ON }) });
  assert.ok(!/פתיחה במפות/.test(strip(both)));
});
