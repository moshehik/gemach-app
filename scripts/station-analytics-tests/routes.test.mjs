// בדיקות התנהגות של נקודות הקצה: POST /api/public-kiosk/event (איסוף אנונימי) + כתיבת אירוע register מתוך POST /api/public-kiosk/register
// + מסכי הניהול (שער הרשאה). מול shim בזיכרון של prisma - בלי DB, בלי רשת, בלי שרת.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const L = (rel) => import(pathToFileURL(`${process.env.PROJ}/${rel}`).href);
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { resetRateLimits, LIMITS } = await L('lib/publicKiosk/rateLimit.js');
const { resetRecentRegistrations } = await L('lib/publicKiosk/registration.js');
const eventRoute = await L('app/api/public-kiosk/event/route.js');
const registerRoute = await L('app/api/public-kiosk/register/route.js');
const adminRoute = await L('app/api/admin/station-analytics/route.js');
const R = await L('lib/stationAnalytics/record.js');

const setSettings = (o) => { globalThis.__SETTINGS = Object.entries(o).map(([key, value]) => ({ key, value: String(value) })); invalidateSettingsCache(); };
const SID = 'abcdef0123456789abcdef0123456789';
const req = (body, { ip = '7.7.7.7', headers = {}, raw = false } = {}) => new Request('http://t.local/api/public-kiosk/event', {
  method: 'POST',
  headers: { 'x-forwarded-for': ip, 'content-type': 'application/json', ...headers },
  body: raw ? body : JSON.stringify(body),
});
const post = async (body, opts) => { const res = await eventRoute.POST(req(body, opts)); return { status: res.status, body: await res.json() }; };
const rows = () => globalThis.__RAW || [];

beforeEach(() => {
  globalThis.__RAW = []; globalThis.__RAW_SEEN = new Set(); globalThis.__RAW_FAIL = null;
  globalThis.__CUSTOMERS = []; globalThis.__AUDIT = []; globalThis.__AUTH = true; globalThis.__PERM = {};
  setSettings({});
  resetRateLimits(); resetRecentRegistrations();
});

test('link off (default): the event endpoint answers ok but stores NOTHING', async () => {
  const r = await post({ type: 'visit', sid: SID });
  assert.deepEqual([r.status, r.body], [200, { ok: true }]);
  assert.equal(rows().length, 0);
});

test('link on: visit / availability stored once per session per day (duplicate does not add a row)', async () => {
  setSettings({ kiosk_public_link_enabled: 'true' });
  await post({ type: 'visit', sid: SID });
  await post({ type: 'visit', sid: SID });
  await post({ type: 'visit', sid: SID });
  assert.equal(rows().length, 1);
  await post({ type: 'availability', sid: SID });
  assert.equal(rows().length, 2);
  await post({ type: 'visit', sid: 'zzzzzzzzzzzzzzzzzzzz' });
  assert.equal(rows().length, 3);
});

test('form_start is collected only when the public registration is on', async () => {
  setSettings({ kiosk_public_link_enabled: 'true' });
  await post({ type: 'form_start', sid: SID });
  assert.equal(rows().length, 0);
  setSettings({ kiosk_public_link_enabled: 'true', kiosk_public_show_registration: 'true' });
  await post({ type: 'form_start', sid: SID });
  assert.equal(rows().length, 1);
});

test('allow-list: unknown / server-only types and malformed session ids are rejected with 400 and store nothing', async () => {
  setSettings({ kiosk_public_link_enabled: 'true' });
  for (const body of [
    { type: 'register', sid: SID }, { type: 'x', sid: SID }, { type: 'visit' }, { type: 'visit', sid: 'short' },
    { type: 'visit', sid: 'has space has space has space' }, { type: 'visit', sid: SID + 'x'.repeat(80) }, { type: ['visit'], sid: SID }, null, [], 'visit',
  ]) {
    const r = await post(body);
    assert.equal(r.status, 400, JSON.stringify(body));
  }
  assert.equal((await post('{not json', { raw: true })).status, 400);
  assert.equal(rows().length, 0);
});

test('stored row carries no raw sid, no IP, no user agent; extra body fields are ignored', async () => {
  setSettings({ kiosk_public_link_enabled: 'true' });
  await post({ type: 'visit', sid: SID, name: 'שרה', phone: '0501234567', ip: '1.2.3.4' }, { ip: '9.9.9.9', headers: { 'user-agent': 'SecretAgent/1.0' } });
  const flat = JSON.stringify(rows()[0]);
  assert.ok(!flat.includes(SID));
  for (const bad of ['9.9.9.9', '1.2.3.4', 'SecretAgent', 'שרה', '0501234567']) assert.ok(!flat.includes(bad), bad);
  const p = rows()[0].params;
  assert.equal(p[1], 'visit');
  assert.equal(p[2], 'public');
  assert.match(p[3], /^\d{4}-\d{2}-\d{2}$/);
  assert.match(p[5], /^[0-9a-f]{32}$/);
});

test('the session hash differs between days and between sessions (cannot link a visitor across days)', () => {
  assert.notEqual(R.hashSid(SID, '2026-10-12'), R.hashSid(SID, '2026-10-13'));
  assert.notEqual(R.hashSid(SID, '2026-10-12'), R.hashSid(SID + 'a', '2026-10-12'));
  assert.equal(R.hashSid(SID, '2026-10-12'), R.hashSid(SID, '2026-10-12'));
});

test('rate limit: per IP, then 429 with Retry-After; another IP is unaffected', async () => {
  setSettings({ kiosk_public_link_enabled: 'true' });
  for (let i = 0; i < LIMITS.event.perIp; i++) assert.equal((await post({ type: 'visit', sid: SID }, { ip: '8.8.8.8' })).status, 200);
  const blocked = await eventRoute.POST(req({ type: 'visit', sid: SID }, { ip: '8.8.8.8' }));
  assert.equal(blocked.status, 429);
  assert.ok(blocked.headers.get('retry-after'));
  assert.equal((await post({ type: 'visit', sid: SID }, { ip: '8.8.4.4' })).status, 200);
});

test('cross-site requests (Sec-Fetch-Site other than same-origin) are ignored silently', async () => {
  setSettings({ kiosk_public_link_enabled: 'true' });
  await post({ type: 'visit', sid: SID }, { headers: { 'sec-fetch-site': 'cross-site' } });
  assert.equal(rows().length, 0);
  await post({ type: 'visit', sid: SID }, { headers: { 'sec-fetch-site': 'same-origin' } });
  assert.equal(rows().length, 1);
});

test('missing StationEvent table / DB failure: the endpoint still answers ok (the station is never affected)', async () => {
  setSettings({ kiosk_public_link_enabled: 'true' });
  globalThis.__RAW_FAIL = Object.assign(new Error('Raw query failed. Code: `42P01`. Message: `relation "StationEvent" does not exist`'), { code: 'P2010' });
  assert.deepEqual((await post({ type: 'visit', sid: SID })).body, { ok: true });
  globalThis.__RAW_FAIL = new Error('connection reset');
  assert.deepEqual((await post({ type: 'visit', sid: SID })).body, { ok: true });
});

test('oversized body is rejected (413) before parsing', async () => {
  setSettings({ kiosk_public_link_enabled: 'true' });
  const res = await eventRoute.POST(req({ type: 'visit', sid: SID, pad: 'x'.repeat(9000) }, { headers: { 'content-length': '9500' } }));
  assert.equal(res.status, 413);
});

// ---- register -> register event
const FORM = { firstName: 'שרה', lastName: 'כהן', phone1: '050-123-4567', idNumber: '12345674', email: 'sara@example.com', city: 'בית שמש', street: 'הרצל', houseNum: '12', acceptedTerms: true, marketingConsent: false, acceptedPrivacy: true, channel: 'public', website: '' };
const regReq = (body, ip = '6.6.6.6') => new Request('http://t.local/api/public-kiosk/register', { method: 'POST', headers: { 'x-forwarded-for': ip, 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('register (public, new customer): a "register" event with the new customer id and channel is written; nothing PII in it', async () => {
  setSettings({ kiosk_public_link_enabled: 'true', kiosk_public_show_registration: 'true' });
  const res = await registerRoute.POST(regReq(FORM));
  assert.equal(res.status, 200);
  const ev = rows().filter((r) => /'register'/.test(r.sql));
  assert.equal(ev.length, 1);
  const created = globalThis.__CUSTOMERS[0];
  assert.equal(ev[0].params[4], created.id); // $5 = customerId
  assert.equal(ev[0].params[1], 'public');
  assert.equal(ev[0].params[5], 'created');
  const flat = JSON.stringify(ev[0]);
  assert.ok(!flat.includes('0501234567') && !flat.includes('כהן'));
});

test('register by an existing customer (same phone + name): event carries the EXISTING customer id with outcome existing-marked; second submit later -> already-marked', async () => {
  setSettings({ kiosk_public_link_enabled: 'true', kiosk_public_show_registration: 'true' });
  globalThis.__CUSTOMERS = [{ id: 'old-1', legacyId: 5, firstName: 'שרה', lastName: 'כהן', phone1: '0501234567', zeout: '12345674', isDeleted: false, officeNotes: '' }];
  await registerRoute.POST(regReq(FORM));
  let ev = rows().filter((r) => /'register'/.test(r.sql));
  assert.equal(ev.length, 1);
  assert.equal(ev[0].params[4], 'old-1');
  assert.equal(ev[0].params[5], 'existing-marked');
  assert.equal(globalThis.__CUSTOMERS.length, 1);
  resetRecentRegistrations();
  await registerRoute.POST(regReq(FORM));
  ev = rows().filter((r) => /'register'/.test(r.sql));
  assert.equal(ev.length, 2);
  assert.equal(ev[1].params[5], 'existing-already-marked');
});

test('register: validation failure / honeypot / unavailable -> NO event; a duplicate-submit within seconds -> still one event', async () => {
  setSettings({ kiosk_public_link_enabled: 'true', kiosk_public_show_registration: 'true' });
  await registerRoute.POST(regReq({ ...FORM, firstName: '' }));
  await registerRoute.POST(regReq({ ...FORM, website: 'http://spam' }));
  assert.equal(rows().length, 0);
  await registerRoute.POST(regReq(FORM));
  await registerRoute.POST(regReq(FORM, '6.6.6.7'));
  assert.equal(rows().filter((r) => /'register'/.test(r.sql)).length, 1);
  setSettings({});
  resetRecentRegistrations();
  const off = await registerRoute.POST(regReq({ ...FORM, phone1: '0529999999', idNumber: '' }));
  assert.equal(off.status, 404);
  assert.equal(rows().filter((r) => /'register'/.test(r.sql)).length, 1);
});

test('register: a failing event write never changes the customer-facing answer (best-effort)', async () => {
  setSettings({ kiosk_public_link_enabled: 'true', kiosk_public_show_registration: 'true' });
  globalThis.__RAW_FAIL = new Error('connection reset');
  const res = await registerRoute.POST(regReq(FORM));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(globalThis.__CUSTOMERS.length, 1);
});

test('register via the store kiosk channel is stored with channel=kiosk', async () => {
  setSettings({ kiosk_customer_self_service: 'true' });
  globalThis.__SESSION_EMPLOYEE = { id: 'e1', roleId: 4, isActive: true }; // the store kiosk channel needs a valid employee cookie (security review 12.10.2026)
  try { await registerRoute.POST(regReq({ ...FORM, channel: 'kiosk' })); } finally { delete globalThis.__SESSION_EMPLOYEE; }
  const ev = rows().filter((r) => /'register'/.test(r.sql));
  assert.equal(ev.length, 1);
  assert.equal(ev[0].params[1], 'kiosk');
});

// ---- admin API gate (page:station_analytics from the permissions catalog; the registrations list also needs page:customers)
const regsRoute = await L('app/api/admin/station-analytics/registrations/route.js');
const adminReq = (path) => new Request(`http://t.local${path}`);

test('admin metrics API: without page:station_analytics -> 403 Hebrew message, regardless of other permissions', async () => {
  globalThis.__PERM = { 'page:station_analytics': false, 'page:customers': true };
  const res = await adminRoute.GET(adminReq('/api/admin/station-analytics'));
  assert.equal(res.status, 403);
  assert.match((await res.json()).error, /[֐-׿]/);
  const res2 = await regsRoute.GET(adminReq('/api/admin/station-analytics/registrations'));
  assert.equal(res2.status, 403);
});

test('admin metrics API: bad parameters (with the permission) -> 400 with a Hebrew message', async () => {
  globalThis.__PERM = { 'page:station_analytics': true };
  const res = await adminRoute.GET(adminReq('/api/admin/station-analytics?from=2026-10-13&to=2026-10-12'));
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /[֐-׿]/);
});

test('registrations list (names): page:station_analytics alone is not enough - page:customers is required too', async () => {
  globalThis.__PERM = { 'page:station_analytics': true, 'page:customers': false };
  const res = await regsRoute.GET(adminReq('/api/admin/station-analytics/registrations?day=2026-10-12'));
  assert.equal(res.status, 403);
  assert.match((await res.json()).error, /פרטי לקוחות/);
  globalThis.__PERM = { 'page:station_analytics': true, 'page:customers': true };
  const bad = await regsRoute.GET(adminReq('/api/admin/station-analytics/registrations?day=nope'));
  assert.equal(bad.status, 400); // עברה את שני השערים
});

test('catalog: page:station_analytics is a REAL (enforced) boolean page item, closed by default for every role (head roles pass via ALWAYS_ALLOWED), not "documentation only"', async () => {
  const M = await L('lib/permissionsMetadata.js');
  const item = M.PERMISSION_CATALOG.find((i) => i.key === 'page:station_analytics');
  assert.ok(item, 'חסר בקטלוג');
  assert.equal(item.type, 'boolean');
  assert.equal(item.enforced, true);
  assert.equal(item.group, 'pages');
  assert.ok(!item.notConfigurable, 'חייב להיות ניתן להגדרה בממשק ההרשאות');
  for (const roleId of [0, 1, 2, 3, 4, 5]) assert.equal(item.defaultForRoleId(roleId), false);
  assert.ok(M.ALWAYS_ALLOWED_ROLE_IDS.includes(0) && M.ALWAYS_ALLOWED_ROLE_IDS.includes(2));
  assert.ok(!M.PERMISSION_CATALOG.some((i) => i.key === 'page:admin_station_analytics'), 'המפתח התיעודי הישן הוסר');
});

test('wiring: the page layout is a PageGate on the catalog key, outside /admin; hub tile carries the same key; no hardcoded role array', async () => {
  const fs = await import('node:fs');
  const layout = fs.readFileSync(`${process.env.PROJ}/app/station-analytics/layout.js`, 'utf8');
  assert.ok(/PageGate pageKey="page:station_analytics"/.test(layout));
  assert.ok(!fs.existsSync(`${process.env.PROJ}/app/admin/station-analytics`));
  const hub = await L('lib/adminHubCatalog.js');
  const tile = hub.TOOLS.find((t) => t.id === 'station-analytics');
  assert.equal(tile.href, '/station-analytics');
  assert.equal(tile.pageKey, 'page:station_analytics');
  for (const f of ['app/api/admin/station-analytics/route.js', 'app/api/admin/station-analytics/registrations/route.js']) {
    const src = fs.readFileSync(`${process.env.PROJ}/${f}`, 'utf8');
    assert.ok(/canOpenPage\('page:station_analytics'\)/.test(src), f);
    assert.ok(!/roleId\s*(===|==|\[)|HEAD_MANAGEMENT|checkAuth\('/.test(src), f);
  }
});
