// pickup address shown to customers: gmach_pickup_address when set, else gmach_address; never any other source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const C = await import(pathToFileURL(process.env.PROJ + '/lib/gmachContact.js').href);

const NEVE_ADDR = 'צוקרמן 1 נווה יעקב - גבעת שאול 23. שימו לב: קבלת והחזרת השמלות בסניף נווה יעקב בלבד!';

test('dedicated pickup address wins over the letterhead address', () => {
  const list = [{ key: 'gmach_address', value: NEVE_ADDR }, { key: 'gmach_pickup_address', value: ' נווה יעקב ' }];
  assert.equal(C.pickupAddressFromList(list), 'נווה יעקב');
});

test('no dedicated value (missing or blank) => gmach_address as before; nothing at all => empty string', () => {
  assert.equal(C.pickupAddressFromList([{ key: 'gmach_address', value: NEVE_ADDR }]), NEVE_ADDR);
  assert.equal(C.pickupAddressFromList([{ key: 'gmach_address', value: 'x' }, { key: 'gmach_pickup_address', value: '  ' }]), 'x');
  assert.equal(C.pickupAddressFromList([]), '');
  assert.equal(C.pickupAddressFromList(undefined), '');
  assert.equal(C.pickupAddressFrom(() => undefined), '');
});
