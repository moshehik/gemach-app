// Pure-logic tests for the public kiosk backend: markers, input normalization, config defaults, rate limiter, catalog allow-list,
// zeout search condition. No DB, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const ROOT = process.env.PROJ;
const L = (rel) => import(pathToFileURL(`${ROOT}/${rel}`).href);
const K = await L('lib/kioskRegistration.js');
const I = await L('lib/publicKiosk/registrationInput.js');
const C = await L('lib/publicKiosk/config.js');
const R = await L('lib/publicKiosk/rateLimit.js');
const CAT = await L('lib/publicKiosk/catalog.js');
const LS = await L('lib/listSearch.js');
const V = await L('lib/customerCreateValidation.js');

// ---------- kiosk registration markers ----------
test('markers: pending / repeat / verified lifecycle, idempotent repeat, existing notes kept', () => {
  const now = new Date('2026-10-12T10:00:00Z');
  const p = K.buildPendingOfficeNotes({ now, channelLabel: 'קישור כללי' });
  assert.equal(K.kioskRegistrationState(p), 'pending');
  assert.ok(K.isKioskRegistrationUnverified(p));
  assert.equal(K.buildRepeatOfficeNotes({ existing: p, now }), null, 'already pending -> nothing to write');
  const r = K.buildRepeatOfficeNotes({ existing: 'הערה ישנה', now });
  assert.equal(K.kioskRegistrationState(r), 'repeat');
  assert.ok(r.includes('הערה ישנה'), 'existing office notes are kept');
  assert.equal(K.buildRepeatOfficeNotes({ existing: r, now }), null, 'second repeat does not stack lines');
  const v = K.buildVerifiedOfficeNotes(r, { now });
  assert.equal(K.kioskRegistrationState(v), 'verified');
  assert.ok(v.includes('הערה ישנה'));
  assert.equal(K.buildVerifiedOfficeNotes(v), null, 'nothing to verify twice');
  assert.equal(K.buildVerifiedOfficeNotes('הערה רגילה'), null);
  assert.equal(K.kioskRegistrationState(null), null);
});
test('markers: where-clause for the staff pending list', () => {
  const w = K.kioskUnverifiedWhere();
  assert.equal(w.OR.length, 2);
  assert.ok(w.OR.every((x) => x.officeNotes && x.officeNotes.contains));
});

// ---------- input normalization ----------
const good = (over = {}) => ({ firstName: 'רחל', lastName: 'כהן', phone1: '050-123-4567', idNumber: '12345678', email: 'Rachel@Example.com', city: 'בית שמש', street: 'הרצל', houseNum: '12', acceptedTerms: true, marketingConsent: false, acceptedPrivacy: true, ...over });
test('normalize: phones / ids / email / house number', () => {
  const n = I.normalizeRegistrationInput(good());
  assert.deepEqual(n.fieldErrors, {});
  assert.equal(n.value.phone1, '0501234567');
  assert.equal(n.value.zeout, '012345678');
  assert.equal(n.value.email, 'rachel@example.com');
  assert.equal(n.value.houseNum, 12);
  assert.equal(I.normalizePhone('+972501234567'), '0501234567');
  assert.equal(I.normalizePhone('501234567'), '0501234567');
  assert.equal(I.normalizePhone('00972-50-1234567'), '0501234567');
  assert.deepEqual(I.idNumberVariants('012345678').sort(), ['012345678', '12345678'].sort());
  assert.deepEqual(I.idNumberVariants('1234567890123'), []);
});
test('normalize: allow-list (unknown keys ignored), honeypot, channel', () => {
  const n = I.normalizeRegistrationInput(good({ isAdmin: true, id: 'x', legacyId: 5, officeNotes: 'inject', website: '' }));
  assert.ok(!('isAdmin' in n.value) && !('officeNotes' in n.value) && !('legacyId' in n.value) && !('id' in n.value));
  assert.equal(n.honeypot, false);
  assert.equal(I.normalizeRegistrationInput(good({ website: 'http://spam' })).honeypot, true);
  assert.equal(I.normalizeRegistrationInput(good({ channel: 'kiosk' })).channel, 'kiosk');
  assert.equal(I.normalizeRegistrationInput(good({ channel: 'admin' })).channel, 'public');
});
test('normalize: consent must be explicit booleans; privacy must be true', () => {
  assert.ok(I.normalizeRegistrationInput(good({ acceptedPrivacy: false })).fieldErrors.acceptedPrivacy);
  assert.ok(I.normalizeRegistrationInput(good({ acceptedPrivacy: 'true' })).fieldErrors.acceptedPrivacy, 'string "true" is not an answer');
  assert.ok(I.normalizeRegistrationInput(good({ acceptedPrivacy: undefined })).fieldErrors.acceptedPrivacy);
  assert.ok(I.normalizeRegistrationInput(good({ marketingConsent: undefined })).fieldErrors.marketingConsent);
  assert.ok(I.normalizeRegistrationInput(good({ marketingConsent: 1 })).fieldErrors.marketingConsent);
  assert.equal(I.normalizeRegistrationInput(good({ marketingConsent: false })).fieldErrors.marketingConsent, undefined, 'explicit "no" is a valid answer');
  assert.ok(I.normalizeRegistrationInput(good({ acceptedTerms: undefined })).fieldErrors.acceptedTerms);
});
test('normalize: injection-looking / oversized / wrong-typed values', () => {
  const n = I.normalizeRegistrationInput(good({ firstName: '<script>alert(1)</script>', city: '"><img src=x onerror=alert(1)>', street: 'x'.repeat(500), email: 'a@b.c<d>' }));
  assert.ok(n.fieldErrors.firstName);
  assert.ok(n.fieldErrors.city);
  assert.ok(n.fieldErrors.email);
  assert.ok(n.value.street.length <= 60);
  const weird = I.normalizeRegistrationInput(good({ firstName: { $gt: '' }, lastName: ['a'], phone1: { a: 1 } }));
  assert.ok(weird.fieldErrors.firstName && weird.fieldErrors.lastName && weird.fieldErrors.phone1, 'objects/arrays are not strings');
  assert.ok(I.normalizeRegistrationInput(null).fieldErrors.firstName);
  assert.ok(I.normalizeRegistrationInput([]).fieldErrors.firstName);
});

// ---------- shared create-customer rules ----------
test('collectNewCustomerErrors: same rules as the staff form (settings-driven)', () => {
  const m = (o) => new Map(Object.entries(o));
  const b = { firstName: 'א', lastName: 'ב', phone1: '0501234567', zeout: '', email: '', city: '', street: '', houseNum: '', marketingConsent: false };
  assert.ok(V.collectNewCustomerErrors(b, m({})).errors.some((e) => e.includes('לפחות אחד מבין')), 'default group phone2/email');
  assert.deepEqual(V.collectNewCustomerErrors({ ...b, email: 'a@b.co' }, m({})).errors, []);
  assert.ok(V.collectNewCustomerErrors({ ...b, email: 'a@b.co' }, m({ require_customer_id_number: 'true' })).errors.includes('תעודת זהות חובה'));
  assert.ok(V.collectNewCustomerErrors({ ...b, email: 'a@b.co' }, m({ require_full_address: 'true' })).errors.includes('עיר חובה'));
  assert.ok(V.collectNewCustomerErrors({ ...b, email: 'a@b.co' }, m({ require_marketing_consent: 'true' })).errors.includes('חובה לאשר קבלת דיוורים'));
  assert.ok(V.collectNewCustomerErrors({ ...b, email: 'a@b.co', zeout: '123456789' }, m({})).errors.includes('מספר תעודת הזהות אינו תקין'));
});

// ---------- config ----------
test('config: everything off by default; dependent flags need the link', () => {
  const none = C.derivePublicKioskConfig(() => undefined);
  assert.deepEqual([none.linkEnabled, none.showInventory, none.showRegistration, none.hideImages, none.storeSelfService], [false, false, false, false, false]);
  const g = (o) => (k) => o[k];
  const noLink = C.derivePublicKioskConfig(g({ kiosk_public_show_inventory: 'true', kiosk_public_show_registration: 'true' }));
  assert.equal(noLink.showInventory, false); assert.equal(noLink.showRegistration, false);
  const on = C.derivePublicKioskConfig(g({ kiosk_public_link_enabled: 'true', kiosk_public_show_inventory: 'true', hide_dress_images: 'true' }));
  assert.deepEqual([on.linkEnabled, on.showInventory, on.showRegistration, on.hideImages], [true, true, false, true]);
  assert.equal(C.derivePublicKioskConfig(g({ kiosk_public_link_enabled: 'TRUE' })).linkEnabled, false, 'only the exact string true');
  assert.deepEqual(C.PUBLIC_KIOSK_SETTING_KEYS.slice(0, 4), ['kiosk_public_link_enabled', 'kiosk_public_show_inventory', 'kiosk_public_show_registration', 'hide_dress_images']);
});
test('config: registration rule hints', () => {
  const g = (o) => (k) => o[k];
  const d = C.deriveRegistrationRules(g({}));
  assert.ok(d.required.firstName && d.required.phone1);
  assert.deepEqual(d.oneOf, [['phone2', 'email']], 'default group phone2/email is satisfiable by either');
  const s = C.deriveRegistrationRules(g({ require_customer_email: 'true', require_customer_id_number: 'true', require_full_address: 'true', mandatory_field_groups: '[]' }));
  assert.ok(s.required.email && s.required.idNumber && s.required.address);
  assert.deepEqual(s.oneOf, []);
});

// ---------- rate limit ----------
test('rate limit: per-IP window, global cap, client ip', () => {
  R.resetRateLimits();
  const now = 1_000_000;
  for (let i = 0; i < R.LIMITS.register.perIp; i++) assert.equal(R.checkRate('register', '1.1.1.1', now).ok, true);
  const blocked = R.checkRate('register', '1.1.1.1', now + 1000);
  assert.equal(blocked.ok, false); assert.ok(blocked.retryAfterSec >= 1);
  assert.equal(R.checkRate('register', '2.2.2.2', now).ok, true, 'another IP unaffected');
  assert.equal(R.checkRate('register', '1.1.1.1', now + R.WINDOW_MS + 1).ok, true, 'window resets');
  R.resetRateLimits();
  let admitted = 0;
  for (let i = 0; i < R.LIMITS.register.global + 20; i++) if (R.checkRate('register', `ip-${i}`, now).ok) admitted++;
  assert.equal(admitted, R.LIMITS.register.global, 'global cap bounds a many-IP flood');
  assert.equal(R.clientIp(new Headers({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' })), '9.9.9.9');
  assert.equal(R.clientIp(new Headers()), 'unknown');
});

// ---------- catalog allow-list ----------
const dbModel = { id: 'uuid-1', name: 'דגם 511', barcodePrefix: 511, priceCategory: 'A', imageUrl: '/api/attachment/11111111-2222-3333-4444-555555555555', thumbnailUrl: null, notes: 'פנימי', inInspection: true, entryDateToRepo: new Date(),
  costPrice: 999, items: [{ sizeText: '40', dressBarcode: '5110001', location: 'מחסן', serialNumber: 1, inRepair: true }, { sizeText: '38' }, { sizeText: '40' }] };
test('catalog: exact allow-list of keys (no ids / barcodes / notes / costs / locations)', () => {
  const off = CAT.shapePublicModel(dbModel, { hideImages: false, availability: null });
  assert.deepEqual(Object.keys(off).sort(), ['code', 'imageUrl', 'name', 'priceCategory', 'sizes', 'thumbnailUrl']);
  assert.deepEqual(off.sizes, [{ size: '38' }, { size: '40' }], 'sizes only; no availability when inventory is off');
  assert.ok(!JSON.stringify(off).match(/uuid-1|5110001|פנימי|999|מחסן/));
  const hidden = CAT.shapePublicModel(dbModel, { hideImages: true });
  assert.ok(!('imageUrl' in hidden) && !('thumbnailUrl' in hidden), 'hide_dress_images removes the image keys entirely');
  const on = CAT.shapePublicModel(dbModel, { availability: { '38': { available: 2 }, '40': { available: 0 } } });
  assert.deepEqual(on.sizes, [{ size: '38', available: true, qty: 2 }, { size: '40', available: false, qty: 0 }]);
  assert.equal(on.inStock, true);
  const capped = CAT.shapePublicModel(dbModel, { availability: { '38': { available: 80 } } });
  assert.equal(capped.sizes[0].qty, CAT.QTY_CAP, 'exact stock counts are never exposed');
});
test('catalog: image url allow-list, date parsing, filter', () => {
  assert.equal(CAT.safeImageUrl('javascript:alert(1)'), null);
  assert.equal(CAT.safeImageUrl('data:image/png;base64,AAAA'), null);
  assert.equal(CAT.safeImageUrl('/api/dresses'), null);
  assert.equal(CAT.safeImageUrl('/api/attachment/abcdef12-3456'), '/api/attachment/abcdef12-3456');
  assert.equal(CAT.safeImageUrl('https://x.example/a.jpg'), 'https://x.example/a.jpg');
  const now = new Date('2026-10-12T00:00:00Z');
  assert.equal(CAT.parseEventDateKey('2026-12-01', now), '2026-12-01');
  assert.equal(CAT.parseEventDateKey('2026-02-31', now), null);
  assert.equal(CAT.parseEventDateKey('2020-01-01', now), null);
  assert.equal(CAT.parseEventDateKey('2099-01-01', now), null);
  assert.equal(CAT.parseEventDateKey("2026-12-01'; DROP", now), null);
  const models = [CAT.shapePublicModel(dbModel), CAT.shapePublicModel({ ...dbModel, name: 'אחר', barcodePrefix: 622, priceCategory: 'B', items: [{ sizeText: '42' }] })];
  assert.equal(CAT.filterPublicModels(models, { q: '511' }).length, 1);
  assert.equal(CAT.filterPublicModels(models, { category: 'B' }).length, 1);
  assert.equal(CAT.filterPublicModels(models, { size: '42' }).length, 1);
  assert.equal(CAT.filterPublicModels(models, { q: '%' }).length, 0);
});

// ---------- staff-side customer search by id number ----------
test('customerSearchCondition: finds by ת"ז in any zero-padding, exact only', () => {
  const P = (q) => LS.planListSearch(q);
  const c = LS.customerSearchCondition(P('012345678'), {});
  const idAlt = c.OR.find((x) => x.zeout);
  assert.ok(idAlt);
  assert.deepEqual([...idAlt.zeout.in].sort(), ['012345678', '12345678'].sort());
  const c2 = LS.customerSearchCondition(P('12345678'), {});
  assert.deepEqual([...c2.OR.find((x) => x.zeout).zeout.in].sort(), ['012345678', '12345678'].sort());
  assert.equal(LS.customerSearchCondition(P('רחל'), {}).OR.some((x) => x.zeout), false);
  assert.equal(LS.customerSearchCondition(P('0501234567'), {}).OR.some((x) => x.zeout), false, '10-digit phone is not an ID');
  assert.equal(LS.customerSearchCondition(P('123'), {}).OR.some((x) => x.zeout), false, 'short digit strings are not IDs');
});
