// GET /api/settings without a session (lib/publicSettings.js allow-list). In-memory prisma + lib/auth shims, no DB, no server.
//   node --no-warnings --import ./scripts/settings-exposure-tests/register.mjs --test scripts/settings-exposure-tests/settings-exposure.test.mjs
// (a) anonymous: only allow-listed keys, only { key, value }   (b) signed-in: exactly what it always was (everything, secrets masked)
// (c) secrets / personal / business values never reach an anonymous reader, however the cache is warmed   (d) the real checkAuth fails closed
// (e) static scanner: every setting key read by a public (login-wall-lifted) screen is allow-listed, or consciously listed as session-bound.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PROJ = process.env.PROJ;
const L = (rel) => import(pathToFileURL(PROJ + '/' + rel).href);
const SC = await L('lib/settingsCache.js');
const PS = await L('lib/publicSettings.js');
const { SECRET_SETTING_KEYS, SECRET_MASK } = await L('app/lib/secretSettingKeys.js');
const route = await L('app/api/settings/route.js');
const { PUBLIC_SETTING_KEYS, SENSITIVE_SETTING_KEY_PATTERN, isPublicSettingKey, toPublicSettings } = PS;

const row = (i, key, value, extra = {}) => ({ id: `id-${String(i).padStart(3, '0')}`, legacyId: 7, key, value, name: `name of ${key}`, category: 'כללי', notes: `help for ${key}`, type: 'text', updatedAt: new Date('2026-10-01T00:00:00Z'), ...extra });

// Canary values: if one of these strings is ever in an anonymous body, the test fails and names it.
const CANARIES = {
  main_email: 'owner-canary@example.invalid',
  daily_manager_report_email: 'manager-canary@example.invalid',
  courier_email: 'courier-canary@example.invalid',
  courier_name: 'CANARY-COURIER-NAME',
  gmach_phone: '0500000-CANARY',
  gmach_address: 'CANARY-ADDRESS-1',
  nedarim_plus_terminal: 'CANARY-MOSAD-123',
  NEDARIM_MOSAD: 'CANARY-MOSAD-123',
  nedarim_rinat_lev_url: 'https://canary.invalid/nedarim',
  yemot_api_url: 'https://canary.invalid/yemot',
  email_drive_folder_id: 'CANARY-DRIVE-FOLDER',
  backup_drive_folder_id: 'CANARY-BACKUP-FOLDER',
  backup_owner_email: 'backup-canary@example.invalid',
  device_backup_employee_ids: '["CANARY-EMPLOYEE-UUID"]',
  email_link_a: 'https://canary.invalid/script-a',
  management_messages: 'CANARY-MANAGEMENT-MESSAGE',
  shift_handover_notes: 'CANARY-HANDOVER',
  late_return_email_text: 'CANARY-LATE-TEXT',
  delivery_price_by_city: '{"CANARY":99}',
  REFUND_PERCENTAGE: '71',
  approval_tokens_required: 'CANARY-APPROVAL',
  restrict_refunds_to_head_management: 'CANARY-RESTRICT',
  require_login: 'CANARY-REQUIRE-LOGIN',
  non_working_days_extra: '{"version":2,"days":[{"date":"2031-01-05","note":"CANARY-NWD-NOTE"}]}',
  ui_labels_mapping: '{"a":"CANARY-LABEL"}',
  nedarim_plus_token: 'CANARY-SECRET-TOKEN',
  yemot_api_token: 'CANARY-YEMOT-TOKEN',
  neon_api_key: 'CANARY-NEON-KEY',
  customer_required_fields: 'CANARY-REQ',
  mandatory_fields: 'CANARY-MANDATORY',
  kiosk_customer_self_service: 'CANARY-SELF-SERVICE',
  kiosk_allow_self_order: 'CANARY-SELF-ORDER',
};

function seed() {
  let i = 1;
  globalThis.__SETTINGS = [
    ...PUBLIC_SETTING_KEYS.map((k) => row(i++, k, k === 'hide_dress_images' ? 'false' : 'true')),
    ...Object.entries(CANARIES).map(([k, v]) => row(i++, k, v)),
    row(i++, 'BRAND_LOGO', 'data:image/png;base64,AAAA'),
  ];
  globalThis.__MOCK_CALLS = [];
  globalThis.__AUTH = true;
  globalThis.__FIND_MANY_FAIL = false;
  SC.invalidateSettingsCache();
}
const get = async (url = 'http://test.local/api/settings') => {
  const res = await route.GET(new Request(url));
  const text = await res.text();
  return { status: res.status, text, json: text ? JSON.parse(text) : null, headers: res.headers };
};

// ---------------------------------------------------------------------------------------------------------------- (a)
test('(a) anonymous: only allow-listed keys, each row is exactly { key, value }', async () => {
  seed();
  globalThis.__AUTH = false;
  const r = await get();
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.map((s) => s.key).sort(), [...PUBLIC_SETTING_KEYS].sort(), 'exactly the allow-list (every key present in the DB, nothing else)');
  for (const s of r.json) assert.deepEqual(Object.keys(s).sort(), ['key', 'value'], `${s.key}: no id / name / notes / category / legacyId`);
  assert.equal(r.json.find((s) => s.key === 'hide_dress_images').value, 'false', 'values are passed through unchanged');
});

test('(a) anonymous: a key that is not in the DB is simply absent; a brand-new unknown key never appears (fail closed)', async () => {
  seed();
  globalThis.__SETTINGS.push(row(900, 'some_future_setting', 'x'), row(901, 'another_flag_enabled', 'true'));
  SC.invalidateSettingsCache();
  globalThis.__AUTH = false;
  const keys = (await get()).json.map((s) => s.key);
  assert.ok(!keys.includes('some_future_setting') && !keys.includes('another_flag_enabled'));
  globalThis.__SETTINGS = globalThis.__SETTINGS.filter((s) => s.key !== 'kiosk_model_search');
  SC.invalidateSettingsCache();
  const keys2 = (await get()).json.map((s) => s.key);
  assert.ok(!keys2.includes('kiosk_model_search') && keys2.length === PUBLIC_SETTING_KEYS.length - 1);
});

test('(a) anonymous with ?fresh=1 gets the same short list (and no-store)', async () => {
  seed();
  globalThis.__AUTH = false;
  const r = await get('http://test.local/api/settings?fresh=1');
  assert.deepEqual(r.json.map((s) => s.key).sort(), [...PUBLIC_SETTING_KEYS].sort());
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

test('(a) the response varies by cookie (never a shared cache between a guest and an employee) and the two bodies have different ETags', async () => {
  seed();
  globalThis.__AUTH = true;
  const authed = await get();
  globalThis.__AUTH = false;
  const anon = await get();
  assert.equal(anon.headers.get('vary'), 'Cookie');
  assert.match(anon.headers.get('cache-control'), /^private,/);
  assert.notEqual(anon.headers.get('etag'), authed.headers.get('etag'));
});

// ---------------------------------------------------------------------------------------------------------------- (b)
test('(b) signed-in (cookie, or open mode): the full list as before - every row complete, secrets masked', async () => {
  seed();
  globalThis.__AUTH = true;
  const r = await get();
  assert.equal(r.status, 200);
  const keys = r.json.map((s) => s.key);
  for (const k of [...PUBLIC_SETTING_KEYS, ...Object.keys(CANARIES)]) assert.ok(keys.includes(k), `${k} present for a signed-in reader`);
  assert.ok(!keys.includes('BRAND_LOGO'), 'BRAND_LOGO stays excluded (unchanged)');
  const m = new Map(r.json.map((s) => [s.key, s]));
  for (const k of SECRET_SETTING_KEYS) assert.equal(m.get(k).value, SECRET_MASK, `${k} masked`);
  assert.equal(m.get('main_email').value, CANARIES.main_email, 'ordinary settings are real values');
  assert.equal(m.get('main_email').notes, 'help for main_email', 'full row shape (notes/name/category) as before');
  assert.match(m.get('non_working_days_extra').value, /CANARY-NWD-NOTE/, 'non-working-days notes: kept for a signed-in reader, as before');
  for (const s of SECRET_SETTING_KEYS) assert.ok(!r.text.includes('CANARY-' + (s === 'neon_api_key' ? 'NEON-KEY' : s === 'yemot_api_token' ? 'YEMOT-TOKEN' : 'SECRET-TOKEN')), 'secret plaintext never in the body');
});

// ---------------------------------------------------------------------------------------------------------------- (c)
test('(c) no canary value (secret, contact, merchant id, drive id, policy, messages, notes, labels, ...) ever appears in an anonymous body - also after a signed-in read warmed the shared cache', async () => {
  seed();
  for (const warm of [false, true, false, true, false]) {
    globalThis.__AUTH = warm;
    const r = await get();
    if (warm) continue;
    for (const [k, v] of Object.entries(CANARIES)) {
      assert.ok(!r.text.includes(v), `value of ${k} leaked to an anonymous reader`);
      assert.ok(!r.text.includes(k), `key ${k} leaked to an anonymous reader`);
    }
    assert.ok(!r.text.includes(SECRET_MASK), 'not even the mask of a secret');
  }
});

test('(c) allow-list invariants: no secret key, no key that looks sensitive, no duplicates, only plain flags', () => {
  assert.equal(new Set(PUBLIC_SETTING_KEYS).size, PUBLIC_SETTING_KEYS.length, 'no duplicates');
  assert.ok(PUBLIC_SETTING_KEYS.length <= 20, 'the list is meant to stay short - think twice before growing it');
  for (const k of PUBLIC_SETTING_KEYS) {
    assert.match(k, /^[a-z][a-z0-9_]*$/, `${k}: plain lower-case key`);
    assert.ok(!SECRET_SETTING_KEYS.includes(k), `${k} is a secret key`);
    assert.ok(!SENSITIVE_SETTING_KEY_PATTERN.test(k), `${k} looks sensitive (token / mail / phone / folder / url / price / refund / permission / ...) - it does not belong on the public list`);
    assert.equal(isPublicSettingKey(k), true);
  }
  for (const k of [...SECRET_SETTING_KEYS, ...Object.keys(CANARIES), 'require_login', 'BRAND_LOGO', 'login_page_new']) {
    assert.equal(isPublicSettingKey(k), false, `${k} must not be public`);
  }
});

test('(c) the runtime safety net drops a sensitive-looking key even if someone adds it to the list by mistake', () => {
  // isPublicSettingKey = allow-list AND not sensitive-looking. Simulate with the pattern directly on typical mistakes.
  for (const bad of ['main_email', 'gmach_phone', 'courier_email', 'nedarim_plus_terminal', 'email_drive_folder_id', 'yemot_api_url', 'nedarim_plus_token', 'backup_owner_email', 'REFUND_PERCENTAGE', 'delivery_price', 'management_messages', 'shift_handover_notes', 'approval_tokens_required', 'restrict_board_to_managers', 'cancel_order_permission', 'require_login']) {
    assert.ok(SENSITIVE_SETTING_KEY_PATTERN.test(bad), `${bad} should be caught by SENSITIVE_SETTING_KEY_PATTERN`);
  }
  assert.deepEqual(toPublicSettings(null), []);
  assert.deepEqual(toPublicSettings([null, { key: 'main_email', value: 'x' }, { key: 'hide_dress_images', value: 'true', id: 'a', notes: 'n' }]), [{ key: 'hide_dress_images', value: 'true' }]);
});

test('(c) DB failure: 500 with no data, never a fall-back to the full list', async () => {
  seed();
  globalThis.__AUTH = false;
  globalThis.__FIND_MANY_FAIL = true;
  SC.invalidateSettingsCache();
  const origErr = console.error; console.error = () => {};
  try {
    const r = await get();
    assert.equal(r.status, 500);
    assert.deepEqual(r.json, { error: 'Failed to fetch settings' });
  } finally { console.error = origErr; globalThis.__FIND_MANY_FAIL = false; }
});

// ---------------------------------------------------------------------------------------------------------------- (d)
test('(d) the real checkAuth: { failClosed: true } answers false on an internal error, the historical default stays fail-open, a role gate stays closed', async () => {
  // "?real=1" makes the test hooks (which shim lib/auth.js for route tests) load the REAL file. Outside a request scope next/headers
  // cookies() throws - exactly the "internal error" path.
  const A = await import(pathToFileURL(PROJ + '/lib/auth.js').href + '?real=1');
  const origErr = console.error; console.error = () => {};
  try {
    assert.equal(await A.checkAuth(undefined, { failClosed: true }), false, 'failClosed -> false');
    assert.equal(await A.checkAuth(), true, 'default: historical fail-open (unchanged for the 100+ other call sites)');
    assert.equal(await A.checkAuth('מנהל'), false, 'role gate: fail closed (unchanged)');
    assert.equal(await A.checkAuth('מנהל', { failClosed: true }), false);
  } finally { console.error = origErr; }
});

test('(d) the settings route asks for the fail-closed variant and filters before anything else (static)', () => {
  const src = fs.readFileSync(path.join(PROJ, 'app/api/settings/route.js'), 'utf8');
  assert.match(src, /checkAuth\(undefined,\s*\{\s*failClosed:\s*true\s*\}\)/);
  assert.match(src, /toPublicSettings\(settings\)/);
  const get = src.slice(src.indexOf('async function GET('), src.indexOf('export async function POST('));
  assert.ok(get.indexOf('checkAuth(') < get.indexOf('cachedJson('), 'the auth decision is made before the response is built');
  assert.ok(!/checkAuth\(\)/.test(get.replace(/\/\/.*$/gm, '')), 'GET has no plain (fail-open) checkAuth() left');
});

// ---------------------------------------------------------------------------------------------------------------- (e)
// Screens that render while app/layout.js lifts the login wall (kiosk, punch clock) or before there is a session (login), the pages planned for
// the public link (/station, /privacy, /terms, /landing), and the global widgets mounted on those pages. A new file under these folders is scanned
// automatically; a shared component that is mounted there must be added to PUBLIC_SURFACE_FILES.
const PUBLIC_SURFACE_DIRS = ['app/customer-interface', 'app/punch-clock', 'app/station', 'app/privacy', 'app/terms', 'app/components/kiosk', 'app/components/public-doc', 'public/landing', 'public/kiosk', 'app/login', 'app/landing'];
const PUBLIC_SURFACE_FILES = [
  'app/components/login/LoginNew.js', 'app/components/login/LoginGate.js', 'app/components/LoginScreen.js', 'app/components/login/PunchClockNew.js',
  'app/components/AIFloatingWidget.js', 'app/components/LegacyErrorReportButton.js', 'app/components/errorReport/ErrorReportWindow.js',
];
// Keys these files read from /api/settings on purpose although they are NOT public, with the reason. A key found in a public file that is neither
// allow-listed nor listed here fails the test, so a new read forces a conscious decision.
const SESSION_BOUND = {
  // login screens: read AFTER /api/login succeeded (the cookie is already set) - checked textually below
  'app/components/LoginScreen.js': ['notify_on_new_message_at_login'],
  'app/components/login/LoginNew.js': ['notify_on_new_message_at_login'],
  // the legacy kiosk page: every data call it makes (/api/dresses, /api/orders, /api/customers, /api/employees full) needs an employee cookie
  // when require_login is on, so these business rules are only ever useful - and only ever served - with a session
  'app/customer-interface/page.js': ['kiosk_customer_self_service', 'kiosk_allow_self_order', 'mandatory_fields', 'require_customer_email', 'require_full_address', 'require_marketing_consent', 'hide_marketing_consent_field'],
};

function listFiles(dir) {
  const abs = path.join(PROJ, dir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = dir + '/' + e.name;
    if (e.isDirectory()) out.push(...listFiles(rel));
    else if (/\.(js|jsx|mjs|ts|tsx|html)$/.test(e.name)) out.push(rel);
  }
  return out;
}
const scanned = [...new Set([...PUBLIC_SURFACE_DIRS.flatMap(listFiles), ...PUBLIC_SURFACE_FILES])].filter((f) => fs.existsSync(path.join(PROJ, f)));
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, ' ');
const FETCHES_SETTINGS = /['"`]\/api\/settings(\?[^'"`]*)?['"`]/;
// pure helpers that a public screen hands the /api/settings array to (the key name lives in the helper, not in the screen)
const PUBLIC_HELPERS = { 'lib/punchClockFlow.js': /punchClockFlow/ };

// every setting key we know about: the settings metadata, the UI-variant keys, plus whatever the files themselves read
const metaSrc = fs.readFileSync(path.join(PROJ, 'lib/settingsMetadata.js'), 'utf8');
const namesBlock = (metaSrc.match(/export const SETTINGS_HEBREW_NAMES = \{([\s\S]*?)\n\};/) || [, ''])[1];
const KNOWN_KEYS = new Set([...namesBlock.matchAll(/^\s*'?([A-Za-z][A-Za-z0-9_]*)'?\s*:/gm)].map((m) => m[1]));
for (const k of ['ui_variant_kiosk', 'notify_on_new_message_at_login', 'laundress_return_check_on_exit', 'ai_screen_recording_enabled', 'error_report_handled_at_bottom', 'error_report_human_button_enabled']) KNOWN_KEYS.add(k);

function keysReadBy(file) {
  let code = stripComments(fs.readFileSync(path.join(PROJ, file), 'utf8'));
  if (!FETCHES_SETTINGS.test(code)) return null; // does not read this endpoint
  for (const [helper, importedAs] of Object.entries(PUBLIC_HELPERS)) if (importedAs.test(code)) code += '\n' + stripComments(fs.readFileSync(path.join(PROJ, helper), 'utf8'));
  const found = new Set();
  for (const k of KNOWN_KEYS) if (new RegExp(`(^|[^A-Za-z0-9_])${k}([^A-Za-z0-9_]|$)`).test(code)) found.add(k);
  for (const m of code.matchAll(/\.key\s*===?\s*['"]([A-Za-z0-9_]+)['"]/g)) if (m[1].includes('_') || KNOWN_KEYS.has(m[1])) found.add(m[1]); // (skips keyboard `e.key === 'Enter'`)
  for (const m of code.matchAll(/\b(?:settings|obj|settingsObj)\.([a-z][A-Za-z0-9_]{3,})\b/g)) if (/_/.test(m[1])) found.add(m[1]);
  return found;
}

test('(e) the scanner sees the public screens (sanity: it is not vacuous)', () => {
  for (const f of ['app/customer-interface/page.js', 'app/punch-clock/PunchClockLegacy.js', 'app/components/login/LoginNew.js', 'app/components/LoginScreen.js', 'app/components/login/PunchClockNew.js', 'app/components/AIFloatingWidget.js']) {
    assert.ok(scanned.includes(f), `${f} is scanned`);
  }
  assert.ok(keysReadBy('app/customer-interface/page.js').has('kiosk_sticky_date_bar'));
  assert.ok(keysReadBy('app/components/login/PunchClockNew.js').has('laundress_return_check_on_exit'));
  assert.ok(keysReadBy('app/components/LoginScreen.js').has('notify_on_new_message_at_login'));
  assert.ok(KNOWN_KEYS.size > 150, 'settings metadata parsed');
});

test('(e) every setting key a public screen reads from /api/settings is allow-listed or consciously session-bound', () => {
  const problems = [];
  for (const f of scanned) {
    const keys = keysReadBy(f);
    if (!keys) continue;
    const bound = SESSION_BOUND[f] || [];
    for (const k of keys) if (!PUBLIC_SETTING_KEYS.includes(k) && !bound.includes(k)) problems.push(`${f} reads "${k}" - not on PUBLIC_SETTING_KEYS (lib/publicSettings.js) and not in SESSION_BOUND`);
    if (keys.size === 0) problems.push(`${f} fetches /api/settings but the scanner found no key - declare what it reads`);
  }
  assert.deepEqual(problems, []);
});

test('(e) no dead entries: every allow-listed key is read by some public screen, every SESSION_BOUND exception is real and not public', () => {
  const read = new Map(); // key -> files
  for (const f of scanned) for (const k of keysReadBy(f) || []) read.set(k, [...(read.get(k) || []), f]);
  for (const k of PUBLIC_SETTING_KEYS) assert.ok(read.has(k), `${k} is on the public list but no public screen reads it - remove it`);
  for (const [f, ks] of Object.entries(SESSION_BOUND)) {
    const keys = keysReadBy(f);
    assert.ok(keys, `${f} no longer fetches /api/settings - drop it from SESSION_BOUND`);
    for (const k of ks) {
      assert.ok(keys.has(k), `${f} no longer reads "${k}" - drop it from SESSION_BOUND`);
      assert.ok(!PUBLIC_SETTING_KEYS.includes(k), `${k} is both public and session-bound`);
    }
  }
});

test('(e) the login screens call /api/settings only after /api/login (so the cookie exists); the landing page and the server-rendered public pages never call it', () => {
  for (const f of ['app/components/LoginScreen.js', 'app/components/login/LoginNew.js']) {
    const code = stripComments(fs.readFileSync(path.join(PROJ, f), 'utf8'));
    const iSettings = code.search(FETCHES_SETTINGS);
    assert.ok(code.indexOf("'/api/login'") > 0 && iSettings > 0);
    // LoginScreen: inside finishLogin (called after a successful /api/login); LoginNew: inside the 'notify' step of the post-login sequence
    assert.match(code.slice(Math.max(0, iSettings - 500), iSettings), /finishLogin|next === 'notify'/, `${f}: the /api/settings read sits in the post-login step`);
  }
  for (const f of scanned.filter((x) => /^(public\/landing|app\/(station|privacy|terms)|app\/components\/public-doc)/.test(x))) {
    assert.equal(keysReadBy(f), null, `${f} must not read /api/settings (use a server-side allow-list loader instead)`);
  }
  const landing = path.join(PROJ, 'public/landing/index.html');
  if (fs.existsSync(landing)) assert.ok(!/\/api\//.test(fs.readFileSync(landing, 'utf8')), '/landing is a static page with no API calls');
});

test('(e) the public-surface list matches the layout: only the kiosk, the punch clock (and the planned public pages) lift the login wall', () => {
  const src = fs.readFileSync(path.join(PROJ, 'app/layout.js'), 'utf8');
  const m = src.match(/const showLogin = ([^;]+);/);
  assert.ok(m, 'showLogin expression found');
  const exemptions = [...m[1].matchAll(/!(\w+)/g)].map((x) => x[1]).filter((n) => n !== 'isAuthenticated').sort();
  // the main layout lifts the wall for the kiosk and the punch clock; the in-flight branches add /station and /privacy|/terms (isPublicDoc)
  for (const n of exemptions) assert.ok(['isPublicKiosk', 'isPunchClock', 'isPublicDoc'].includes(n), `new login-wall exemption "${n}" in app/layout.js: add its folder to PUBLIC_SURFACE_DIRS here and review what it reads from /api/settings`);
});

// ---------------------------------------------------------------------------------------------------------------- (f)
// Routes that used to answer anyone (2026-10-12, owner decision) and now need a session; the developer-only ones need the programmer role.
const CLOSED_ROUTES = [
  { file: 'app/api/export-migration-report/route.js', role: 'מתכנת' },
  { file: 'app/api/db-check/route.js', role: 'מתכנת' },
  { file: 'app/api/admin/database/status/route.js', role: 'מתכנת' },
  { file: 'app/api/pricelists/categories/route.js', role: null },
  { file: 'app/api/queries-by-path/route.js', role: null },
];

test('(f) closed routes: without a session -> 401 and no data, with one -> not 401', async () => {
  for (const { file } of CLOSED_ROUTES) {
    const mod = await L(file);
    globalThis.__AUTH = false;
    const denied = await mod.GET(new Request('http://test.local/x?path=/dashboard'));
    assert.equal(denied.status, 401, `${file} answers 401 without a session`);
    assert.deepEqual(await denied.json(), { error: 'Unauthorized' }, `${file}: no data in the refusal`);
    globalThis.__AUTH = true;
    if (file.includes('export-migration-report')) continue; // heavy report that reads the repo files; the gate itself is pinned above and statically below
    const origErr = console.error; console.error = () => {};
    try {
      const ok = await mod.GET(new Request('http://test.local/x?path=/dashboard'));
      assert.notEqual(ok.status, 401, `${file} is reachable with a session`);
    } finally { console.error = origErr; }
  }
  globalThis.__AUTH = true;
});

test('(f) static: every closed route calls checkAuth before doing anything else in GET (developer-only ones with the programmer role)', () => {
  for (const { file, role } of CLOSED_ROUTES) {
    const src = fs.readFileSync(path.join(PROJ, file), 'utf8').replace(/^\uFEFF/, '');
    const i = src.search(/export async function GET\s*\(/);
    assert.ok(i >= 0, `${file}: GET found`);
    const body = src.slice(i);
    const gate = role ? body.indexOf(`checkAuth('${role}')`) : body.indexOf('checkAuth()');
    assert.ok(gate > 0, `${file}: GET is gated by checkAuth(${role ? `'${role}'` : ''})`);
    assert.ok(gate < body.search(/\btry\s*\{|prisma\.|readFile|fs\./), `${file}: the gate comes before any work`);
    assert.match(src, /import \{ checkAuth \} from /, `${file}: imports checkAuth`);
  }
});

test('(f) no public page / print view / popup fetches a closed route without a session (consumer scan)', () => {
  const closedPaths = ['/api/export-migration-report', '/api/db-check', '/api/admin/database/status', '/api/pricelists/categories', '/api/queries-by-path'];
  const allowed = new Set([
    // staff screens (session) and dev-only tooling
    'app/components/dress-card/useDressCard.js', 'app/components/dress-new/LegacyNewDressPage.js', 'app/components/dress-new/useModelNewController.js',
    'app/dashboard/dresses/[id]/LegacyDressCardPage.js', 'app/dashboard/pricelist/page.js', 'app/admin/database/page.js', 'components/ClipboardDebugger.js',
    // the legacy kiosk: every data call it makes already needs an employee cookie
    'app/customer-interface/page.js',
    // cache bookkeeping lists, not fetches
    'lib/apiCache.js',
  ]);
  const consumers = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(path.join(PROJ, dir), { withFileTypes: true })) {
      const rel = dir + '/' + e.name;
      if (e.isDirectory()) { if (!['node_modules', '.next', 'api'].includes(e.name) || dir !== 'app') walk(rel); continue; }
      if (!/\.(js|jsx|mjs)$/.test(e.name)) continue;
      const code = stripComments(fs.readFileSync(path.join(PROJ, rel), 'utf8'));
      if (closedPaths.some((p) => code.includes(p))) consumers.push(rel);
    }
  })('app');
  for (const d of ['components', 'lib']) (function walk(dir) {
    for (const e of fs.readdirSync(path.join(PROJ, dir), { withFileTypes: true })) {
      const rel = dir + '/' + e.name;
      if (e.isDirectory()) { walk(rel); continue; }
      if (!/\.(js|jsx|mjs)$/.test(e.name)) continue;
      if (closedPaths.some((p) => stripComments(fs.readFileSync(path.join(PROJ, rel), 'utf8')).includes(p))) consumers.push(rel);
    }
  })(d);
  assert.ok(consumers.includes('app/dashboard/pricelist/page.js') && consumers.includes('app/customer-interface/page.js'), 'the consumer scan is not vacuous');
  const unexpected = consumers.filter((f) => !allowed.has(f) && !f.startsWith('app/api/'));
  assert.deepEqual(unexpected, [], 'a new consumer of a closed route: check it runs with a session, then add it to the allowed list');
  for (const f of ['app/print', 'app/station', 'app/privacy', 'app/terms', 'app/components/kiosk', 'app/components/a5-print']) assert.ok(!consumers.some((c) => c.startsWith(f + '/')), `${f} does not use a closed route`);
});
