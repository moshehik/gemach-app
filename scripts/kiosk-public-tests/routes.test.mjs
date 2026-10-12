// Behavioural tests of the REAL public-kiosk routes (config / models / register) + the staff kiosk-verify route, against an in-memory
// prisma shim (scripts/kiosk-public-tests/shims). No DB, no network, no dev server.
//  - everything off by default; config exposes only the flags; models obey the allow-list and the inventory flag
//  - register: gating, validation parity, anti-enumeration (identical responses), no overwrite of existing customers, honeypot, rate limit
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const L = (rel) => import(pathToFileURL(`${process.env.PROJ}/${rel}`).href);
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { resetRateLimits, LIMITS } = await L('lib/publicKiosk/rateLimit.js');
const { resetPublicCatalogCache } = await L('lib/publicKiosk/catalog.js');
const { resetRecentRegistrations } = await L('lib/publicKiosk/registration.js');
const configRoute = await L('app/api/public-kiosk/config/route.js');
const modelsRoute = await L('app/api/public-kiosk/models/route.js');
const registerRoute = await L('app/api/public-kiosk/register/route.js');
const verifyRoute = await L('app/api/customers/[id]/kiosk-verify/route.js');

const setSettings = (o) => { globalThis.__SETTINGS = Object.entries(o).map(([key, value]) => ({ key, value: String(value) })); invalidateSettingsCache(); };
const ON = { kiosk_public_link_enabled: 'true', kiosk_public_show_registration: 'true' };

beforeEach(() => {
  globalThis.__CUSTOMERS = [];
  globalThis.__AUDIT = [];
  globalThis.__CONSENTS = [];
  globalThis.__AUTH = true;
  globalThis.__MODELS = [
    { id: 'm1', name: 'דגם 511', barcodePrefix: 511, priceCategory: 'A', imageUrl: '/api/attachment/11111111-2222-3333-4444-555555555555', thumbnailUrl: null, notes: 'פנימי', isDeleted: false, exitDateFromRepo: null,
      items: [{ sizeText: '38', dressBarcode: '5110001', location: 'מחסן' }, { sizeText: '40' }] },
    { id: 'm2', name: 'דגם 622', barcodePrefix: 622, priceCategory: 'B', imageUrl: null, isDeleted: false, exitDateFromRepo: null, items: [{ sizeText: '42' }] },
    { id: 'm3', name: 'מחוק', barcodePrefix: 700, priceCategory: 'B', isDeleted: true, exitDateFromRepo: null, items: [{ sizeText: '42' }] },
    { id: 'm4', name: 'לא בשימוש', barcodePrefix: 701, priceCategory: 'B', isDeleted: false, exitDateFromRepo: null, items: [{ sizeText: '42', notInUse: true }] },
  ];
  globalThis.__ITEMS = [
    { dressModelId: 'm1', sizeText: '38', quantity: 1, location: null }, { dressModelId: 'm1', sizeText: '40', quantity: 3, location: null },
    { dressModelId: 'm2', sizeText: '42', quantity: 1, location: null },
  ];
  setSettings({});
  resetRateLimits(); resetPublicCatalogCache(); resetRecentRegistrations();
});

const req = (path, { method = 'GET', body, ip = '5.5.5.5', headers = {} } = {}) => new Request(`http://t.local${path}`, {
  method,
  headers: { 'x-forwarded-for': ip, ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
  body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
});
const jr = async (res) => ({ status: res.status, body: await res.json(), headers: res.headers });

// ---------- config ----------
test('config: link off by default -> { enabled:false } and nothing else', async () => {
  const r = await jr(await configRoute.GET(req('/api/public-kiosk/config')));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { enabled: false });
  assert.match(r.headers.get('cache-control'), /no-store/);
});
test('config: exposes only the flags (+ derived registration hints), never other settings', async () => {
  setSettings({ ...ON, kiosk_public_show_inventory: 'true', hide_dress_images: 'true', nedarim_plus_token: 'SECRET-TOKEN', gmach_phone: '0501112222', main_email: 'x@y.z' });
  const r = await jr(await configRoute.GET(req('/api/public-kiosk/config')));
  assert.deepEqual(Object.keys(r.body).sort(), ['enabled', 'hideImages', 'registration', 'showInventory', 'showRegistration']);
  assert.equal(r.body.enabled, true); assert.equal(r.body.showInventory, true); assert.equal(r.body.showRegistration, true); assert.equal(r.body.hideImages, true);
  const text = JSON.stringify(r.body);
  assert.ok(!text.includes('SECRET-TOKEN') && !text.includes('0501112222') && !text.includes('x@y.z'));
  setSettings({ kiosk_public_link_enabled: 'true' });
  const r2 = await jr(await configRoute.GET(req('/api/public-kiosk/config')));
  assert.deepEqual(Object.keys(r2.body).sort(), ['enabled', 'hideImages', 'showInventory', 'showRegistration'], 'no registration hints while registration is off');
  assert.equal(r2.body.showRegistration, false);
});

// ---------- models ----------
test('models: 404 while the link is off', async () => {
  const r = await jr(await modelsRoute.GET(req('/api/public-kiosk/models')));
  assert.equal(r.status, 404);
  assert.deepEqual(Object.keys(r.body).sort(), ['code', 'error', 'ok']);
});
test('models: allow-listed fields, only active models, no inventory info while inventory flag is off (eventDate ignored)', async () => {
  setSettings({ kiosk_public_link_enabled: 'true' });
  const r = await jr(await modelsRoute.GET(req('/api/public-kiosk/models?eventDate=2026-12-01')));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.data.map((m) => m.name), ['דגם 511', 'דגם 622']);
  assert.equal(r.body.inventory, null);
  const m = r.body.data[0];
  assert.deepEqual(Object.keys(m).sort(), ['code', 'imageUrl', 'name', 'priceCategory', 'sizes', 'thumbnailUrl']);
  assert.deepEqual(m.sizes, [{ size: '38' }, { size: '40' }]);
  const text = JSON.stringify(r.body);
  assert.ok(!/m1|5110001|פנימי|מחסן|"id"/.test(text), 'no ids / barcodes / notes / locations');
  assert.deepEqual(r.body.categories, ['A', 'B']);
});
test('models: hide_dress_images drops image keys', async () => {
  setSettings({ kiosk_public_link_enabled: 'true', hide_dress_images: 'true' });
  const r = await jr(await modelsRoute.GET(req('/api/public-kiosk/models')));
  assert.ok(r.body.data.every((m) => !('imageUrl' in m) && !('thumbnailUrl' in m)));
});
test('models: inventory flag on + date -> availability per size (capped); bad date -> 400; search filter', async () => {
  setSettings({ kiosk_public_link_enabled: 'true', kiosk_public_show_inventory: 'true' });
  const future = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  const r = await jr(await modelsRoute.GET(req(`/api/public-kiosk/models?eventDate=${future}`)));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.inventory.eventDate, future);
  const m511 = r.body.data.find((m) => m.name === 'דגם 511');
  assert.deepEqual(m511.sizes.map((s) => [s.size, s.available, s.qty]), [['38', true, 1], ['40', true, 3]]);
  const noDate = await jr(await modelsRoute.GET(req('/api/public-kiosk/models', { ip: '6.6.6.6' })));
  assert.deepEqual(noDate.body.data[0].sizes[0], { size: '38' }, 'no date -> no availability even when the flag is on');
  const bad = await jr(await modelsRoute.GET(req("/api/public-kiosk/models?eventDate=2026-13-45'", { ip: '7.7.7.7' })));
  assert.equal(bad.status, 400);
  const q = await jr(await modelsRoute.GET(req('/api/public-kiosk/models?q=622', { ip: '8.8.8.8' })));
  assert.deepEqual(q.body.data.map((m) => m.name), ['דגם 622']);
});
test('models: rate limited per IP', async () => {
  setSettings({ kiosk_public_link_enabled: 'true' });
  let last;
  for (let i = 0; i < LIMITS.models.perIp + 1; i++) last = await modelsRoute.GET(req('/api/public-kiosk/models', { ip: '4.4.4.4' }));
  assert.equal(last.status, 429);
  assert.ok(last.headers.get('retry-after'));
});

// ---------- register ----------
const good = (over = {}) => ({ firstName: 'רחל', lastName: 'כהן', phone1: '050-123-4567', idNumber: '12345674', email: 'rachel@example.com', city: 'בית שמש', street: 'הרצל', houseNum: '12', acceptedTerms: true, marketingConsent: true, acceptedPrivacy: true, ...over });
const reg = async (body, opts = {}) => jr(await registerRoute.POST(req('/api/public-kiosk/register', { method: 'POST', body, ...opts })));
const existing = (over = {}) => ({ id: 'c-old', legacyId: 40, firstName: 'רחל', lastName: 'כהן', phone1: '0501234567', phone2: null, email: 'old@example.com', zeout: '012345674', city: 'ירושלים', street: null, houseNum: null, officeNotes: null, isDeleted: false, marketingConsent: false, hasSignedRegulations: false, ...over });

test('register: unavailable (404) when the link or the registration flag is off; store kiosk channel needs kiosk_customer_self_service', async () => {
  assert.equal((await reg(good())).status, 404);
  setSettings({ kiosk_public_link_enabled: 'true' });
  assert.equal((await reg(good())).status, 404);
  setSettings({ kiosk_customer_self_service: 'true' });
  assert.equal((await reg(good())).status, 404, 'public channel does not ride on the store flag');
  // סקירת אבטחה 12.10.2026: ההגדרה לבדה לא פותחת את הערוץ 'kiosk' לאינטרנט - נדרשת עוגיית עובד תקפה
  assert.equal((await reg(good({ channel: 'kiosk' }), { ip: '3.3.3.3' })).status, 404, 'channel kiosk WITHOUT an employee cookie is refused even when kiosk_customer_self_service is on');
  assert.equal(globalThis.__CUSTOMERS.length, 0);
  globalThis.__SESSION_EMPLOYEE = { id: 'e1', roleId: 4, isActive: true };
  try {
    assert.equal((await reg(good({ channel: 'kiosk' }), { ip: '3.3.3.4' })).status, 200, 'the locked store kiosk (employee cookie) may register');
    assert.equal(globalThis.__CUSTOMERS.length, 1);
    assert.match(globalThis.__CUSTOMERS[0].officeNotes, /עמדת חנות/);
    setSettings({ kiosk_public_link_enabled: 'true' });
    assert.equal((await reg(good({ idNumber: '', phone1: '0507654321', lastName: 'לוי' }), { ip: '3.3.3.5' })).status, 404, 'an employee cookie does not open the PUBLIC channel (needs kiosk_public_show_registration)');
  } finally { delete globalThis.__SESSION_EMPLOYEE; }
});
test('register: channel kiosk needs the store flag AND an employee; the public flags do not open it for anonymous callers', async () => {
  setSettings({ ...ON, kiosk_customer_self_service: 'false' });
  assert.equal((await reg(good({ channel: 'kiosk' }), { ip: '3.3.3.6' })).status, 404, 'public registration on + anonymous + channel kiosk = refused (cannot label itself as the store kiosk)');
  globalThis.__SESSION_EMPLOYEE = { id: 'e1', roleId: 4, isActive: true };
  try {
    assert.equal((await reg(good({ channel: 'kiosk' }), { ip: '3.3.3.7' })).status, 404, 'employee but kiosk_customer_self_service off = refused');
  } finally { delete globalThis.__SESSION_EMPLOYEE; }
  assert.equal(globalThis.__CUSTOMERS.length, 0);
});
test('register: success creates a pending customer (server-side fields only) and answers exactly { ok:true }', async () => {
  setSettings(ON);
  const r = await reg(good({ isAdmin: true, officeNotes: 'inject', id: 'forced', legacyId: 999 }));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true });
  assert.equal(globalThis.__CUSTOMERS.length, 1);
  const c = globalThis.__CUSTOMERS[0];
  assert.equal(c.firstName, 'רחל'); assert.equal(c.phone1, '0501234567'); assert.equal(c.zeout, '012345674'); assert.equal(c.houseNum, 12);
  assert.equal(c.marketingConsent, true);
  assert.equal(c.hasSignedRegulations, true, 'acceptedTerms -> signature (one path: planSignatureWrite via lib/customerConsent.js)');
  assert.ok(c.regulationsSignedAt instanceof Date, 'the signature timestamp is server-side');
  // יומן ההסכמות (CustomerConsent): שלוש שורות, ערוץ ציבורי, method customer_self, surface kiosk-register, בלי עובד
  assert.deepEqual(globalThis.__CONSENTS.map((r) => [r.kind, r.granted]).sort(), [['marketing', true], ['privacy', true], ['terms', true]]);
  assert.ok(globalThis.__CONSENTS.every((r) => r.customerId === c.id && r.channel === 'public' && r.method === 'customer_self' && r.surface === 'kiosk-register' && !r.recordedByEmployeeId));
  assert.match(c.officeNotes, /נרשמה - לאמת פרטים/);
  assert.ok(!c.officeNotes.includes('inject'));
  assert.notEqual(c.id, 'forced'); assert.notEqual(c.legacyId, 999);
  assert.equal(c.legacyId, 1, 'first customer in an empty DB gets legacyId 1 from the sequence');
});
test('register: marketing "no" is stored as false; terms "no" leaves the signature for the employee', async () => {
  setSettings(ON);
  await reg(good({ marketingConsent: false, acceptedTerms: false }));
  const c = globalThis.__CUSTOMERS[0];
  assert.equal(c.marketingConsent, false); assert.equal(c.hasSignedRegulations, false);
});
test('register: validation parity (settings-driven rules) and consent requirements; nothing is written on failure', async () => {
  setSettings({ ...ON, require_customer_id_number: 'true', require_full_address: 'true' });
  const noPrivacy = await reg(good({ acceptedPrivacy: false }));
  assert.equal(noPrivacy.status, 400); assert.equal(noPrivacy.body.code, 'validation'); assert.ok(noPrivacy.body.fields.acceptedPrivacy);
  const noMk = await reg(good({ marketingConsent: undefined }), { ip: '2.2.2.2' });
  assert.equal(noMk.status, 400); assert.ok(noMk.body.fields.marketingConsent);
  const noId = await reg(good({ idNumber: '' }), { ip: '2.2.2.3' });
  assert.equal(noId.status, 400); assert.ok(noId.body.errors.includes('תעודת זהות חובה'));
  const noCity = await reg(good({ city: '' }), { ip: '2.2.2.4' });
  assert.ok(noCity.body.errors.includes('עיר חובה'));
  const badId = await reg(good({ idNumber: '123456789' }), { ip: '2.2.2.5' });
  assert.ok(badId.body.errors.includes('מספר תעודת הזהות אינו תקין'));
  const noContact = await reg(good({ email: '' }), { ip: '2.2.2.6' });
  assert.ok(noContact.body.errors.some((e) => e.includes('לפחות אחד מבין')), 'default phone2/email group applies');
  assert.equal(globalThis.__CUSTOMERS.length, 0);
});
test('register: existing customer (same ת"ז, any padding) -> identical response, NO duplicate, NO overwrite, only a fixed marker', async () => {
  setSettings(ON);
  const first = await reg(good({ idNumber: '18', firstName: 'דינה', phone1: '0527778888' }), { ip: '1.1.1.1' }); // new person (valid ID)
  assert.equal(first.status, 200);
  globalThis.__CUSTOMERS.push(existing());
  const before = JSON.stringify(globalThis.__CUSTOMERS.find((c) => c.id === 'c-old'));
  const dup = await reg(good({ idNumber: '12345674', firstName: 'שם אחר', phone1: '0529999999', email: 'attacker@example.com' }), { ip: '1.1.1.2' });
  assert.equal(dup.status, first.status);
  assert.deepEqual(dup.body, first.body, 'byte-identical answer for new vs existing');
  assert.equal(globalThis.__CUSTOMERS.length, 2, 'no duplicate created');
  const after = globalThis.__CUSTOMERS.find((c) => c.id === 'c-old');
  assert.equal(after.firstName, 'רחל'); assert.equal(after.email, 'old@example.com'); assert.equal(after.phone1, '0501234567'); assert.equal(after.city, 'ירושלים');
  assert.match(after.officeNotes, /רישום חוזר/);
  assert.ok(!after.officeNotes.includes('attacker') && !after.officeNotes.includes('שם אחר'), 'no user-supplied text lands on the existing record');
  const notesAfterFirst = after.officeNotes;
  await reg(good({ idNumber: '12345674' }), { ip: '1.1.1.3' });
  assert.equal(globalThis.__CUSTOMERS.find((c) => c.id === 'c-old').officeNotes, notesAfterFirst, 'repeat spam does not stack lines');
  assert.notEqual(before, JSON.stringify(after));
});
test('register: same phone (+972 format) AND same name = existing; same phone with a different name = a new customer (shared family phone)', async () => {
  setSettings(ON);
  globalThis.__CUSTOMERS.push(existing({ zeout: null }));
  const same = await reg(good({ idNumber: '', phone1: '+972501234567' }), { ip: '1.2.3.1' });
  assert.equal(same.status, 200);
  assert.equal(globalThis.__CUSTOMERS.length, 1);
  assert.match(globalThis.__CUSTOMERS[0].officeNotes, /רישום חוזר/);
  const family = await reg(good({ idNumber: '', phone1: '0501234567', firstName: 'שרה' }), { ip: '1.2.3.2' });
  assert.equal(family.status, 200);
  assert.equal(globalThis.__CUSTOMERS.length, 2);
});
test('register: validation answers never reveal whether an ID/phone exists', async () => {
  setSettings(ON);
  globalThis.__CUSTOMERS.push(existing());
  const r = await reg(good({ idNumber: '12345674', acceptedPrivacy: false }), { ip: '1.9.9.1' });
  assert.equal(r.status, 400);
  assert.ok(!JSON.stringify(r.body).match(/קיים|כבר|old@example|ירושלים/), JSON.stringify(r.body));
});
test('register: honeypot -> fake success, nothing stored', async () => {
  setSettings(ON);
  const r = await reg(good({ website: 'http://spam.example' }));
  assert.deepEqual(r.body, { ok: true }); assert.equal(r.status, 200);
  assert.equal(globalThis.__CUSTOMERS.length, 0);
});
test('register: double submit within seconds creates one customer', async () => {
  setSettings(ON);
  const [a, b] = await Promise.all([reg(good(), { ip: '1.5.5.1' }), reg(good(), { ip: '1.5.5.2' })]);
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  assert.equal(globalThis.__CUSTOMERS.length, 1);
});
test('register: rate limit (429 + Retry-After) per IP, other IPs unaffected', async () => {
  setSettings(ON);
  let last;
  for (let i = 0; i < LIMITS.register.perIp; i++) last = await reg(good({ idNumber: '', phone1: `05012345${i}0`, lastName: `כהן${'אבגדהו'[i]}` }), { ip: '9.9.9.9' });
  assert.equal(last.status, 200);
  const blocked = await jr(await registerRoute.POST(req('/api/public-kiosk/register', { method: 'POST', body: good(), ip: '9.9.9.9' })));
  assert.equal(blocked.status, 429); assert.equal(blocked.body.code, 'rate_limited'); assert.ok(blocked.headers.get('retry-after'));
  assert.equal((await reg(good({ idNumber: '', phone1: '0541112222', firstName: 'דינה' }), { ip: '9.9.9.8' })).status, 200);
});
test('register: transport hardening (content-type, size, bad JSON)', async () => {
  setSettings(ON);
  const wrongType = await jr(await registerRoute.POST(new Request('http://t.local/api/public-kiosk/register', { method: 'POST', headers: { 'content-type': 'text/plain', 'x-forwarded-for': '1.1.9.1' }, body: JSON.stringify(good()) })));
  assert.equal(wrongType.status, 415);
  const big = await reg({ ...good(), pad: 'x'.repeat(20000) }, { ip: '1.1.9.2' });
  assert.equal(big.status, 413);
  const bad = await jr(await registerRoute.POST(new Request('http://t.local/api/public-kiosk/register', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.1.9.3' }, body: '{not json' })));
  assert.equal(bad.status, 400);
  assert.equal(globalThis.__CUSTOMERS.length, 0);
  assert.equal(typeof registerRoute.GET, 'undefined', 'register is POST-only');
});
test('register: does not depend on or trust an employee cookie', async () => {
  setSettings(ON);
  globalThis.__AUTH = false; // anonymous visitor: checkAuth() would fail, the public routes must not call it
  const r = await reg(good({ firstName: 'דנה' }), { headers: { cookie: 'auth_token=some-employee-uuid' } });
  assert.equal(r.status, 200);
  assert.equal(globalThis.__CUSTOMERS[0].firstName, 'דנה');
});

// ---------- staff: verify ----------
test('kiosk-verify: staff-only; replaces the pending marker, keeps other notes, idempotent', async () => {
  setSettings(ON);
  await reg(good());
  const id = globalThis.__CUSTOMERS[0].id;
  globalThis.__CUSTOMERS[0].officeNotes += '\nהערת משרד';
  const call = async () => jr(await verifyRoute.POST(new Request('http://t.local/x', { method: 'POST' }), { params: Promise.resolve({ id }) }));
  globalThis.__AUTH = false;
  assert.equal((await call()).status, 401);
  assert.match(globalThis.__CUSTOMERS[0].officeNotes, /לאמת פרטים/);
  globalThis.__AUTH = true;
  const ok = await call();
  assert.deepEqual(ok.body, { ok: true, changed: true });
  assert.ok(!/לאמת פרטים/.test(globalThis.__CUSTOMERS[0].officeNotes)); assert.match(globalThis.__CUSTOMERS[0].officeNotes, /אומתה/); assert.match(globalThis.__CUSTOMERS[0].officeNotes, /הערת משרד/);
  assert.deepEqual((await call()).body, { ok: true, changed: false });
  const missing = await jr(await verifyRoute.POST(new Request('http://t.local/x', { method: 'POST' }), { params: Promise.resolve({ id: 'nope' }) }));
  assert.equal(missing.status, 404);
});
