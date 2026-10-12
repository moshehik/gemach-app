// GET /api/settings reader tiers (lib/adminOnlySettings.js): guest / staff / admin / open. In-memory prisma + lib/auth shims, no DB, no server.
//   node --no-warnings --import ./scripts/settings-exposure-tests/register.mjs --test scripts/settings-exposure-tests/settings-tiers.test.mjs
// globalThis.__TIER ('guest' | 'staff' | 'admin' | 'open') drives the shimmed getSettingsViewerTier(); without it __AUTH === false means guest, else admin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PROJ = process.env.PROJ;
const L = (rel) => import(pathToFileURL(PROJ + '/' + rel).href);
const SC = await L('lib/settingsCache.js');
const AO = await L('lib/adminOnlySettings.js');
const PS = await L('lib/publicSettings.js');
const { SECRET_SETTING_KEYS, SECRET_MASK } = await L('app/lib/secretSettingKeys.js');
const route = await L('app/api/settings/route.js');
const { ADMIN_ONLY_SETTING_KEYS, ADMIN_ONLY_SETTING_REASONS, ADMIN_ONLY_KEY_PATTERN, isAdminOnlySettingKey, toStaffSettings, settingsViewerTier } = AO;

const row = (i, key, value) => ({ id: `id-${String(i).padStart(3, '0')}`, legacyId: 3, key, value, name: `name of ${key}`, category: 'כללי', notes: `help for ${key}`, type: 'text', updatedAt: new Date('2026-10-01T00:00:00Z') });
// keys that staff screens DO read (verified one by one, see the header of lib/adminOnlySettings.js) - must stay visible to a staff reader
const STAFF_VISIBLE = ['management_messages', 'shift_handover_notes', 'main_email', 'courier_name', 'nedarim_plus_enabled', 'require_login', 'gmach_phone', 'gmach_address', 'delivery_price_by_city', 'REFUND_PERCENTAGE', 'non_working_days_extra', 'ui_labels_mapping', 'hide_dress_images', 'new_order_layout', 'some_future_flag'];

function seed() {
  let i = 1;
  globalThis.__SETTINGS = [
    ...ADMIN_ONLY_SETTING_KEYS.map((k) => row(i++, k, `VALUE-OF-${k}`)),
    ...STAFF_VISIBLE.map((k) => row(i++, k, `visible-${k}`)),
    row(i++, 'brand_new_api_key', 'CANARY-UNKNOWN-SECRET'), // unknown key whose name looks like a secret
  ];
  globalThis.__MOCK_CALLS = [];
  globalThis.__AUTH = true;
  globalThis.__TIER = undefined;
  SC.invalidateSettingsCache();
}
const get = async (url = 'http://test.local/api/settings') => { const res = await route.GET(new Request(url)); const text = await res.text(); return { status: res.status, text, json: JSON.parse(text) }; };

test('tier function: guest / open / staff / admin', () => {
  assert.equal(settingsViewerTier({ signedIn: false, hasIdentity: true, isHeadManagement: true }), 'guest');
  assert.equal(settingsViewerTier({ signedIn: true, hasIdentity: false, isHeadManagement: false }), 'open');
  assert.equal(settingsViewerTier({ signedIn: true, hasIdentity: true, isHeadManagement: false }), 'staff');
  assert.equal(settingsViewerTier({ signedIn: true, hasIdentity: true, isHeadManagement: true }), 'admin');
});

test('staff: everything except the admin-only keys; unknown keys and every key a staff screen reads stay visible; rows keep their full shape', async () => {
  seed();
  globalThis.__TIER = 'staff';
  const r = await get();
  assert.equal(r.status, 200);
  const keys = r.json.map((s) => s.key);
  for (const k of ADMIN_ONLY_SETTING_KEYS) assert.ok(!keys.includes(k), `${k} hidden from staff`);
  for (const k of STAFF_VISIBLE) assert.ok(keys.includes(k), `${k} still visible to staff`);
  assert.ok(!keys.includes('brand_new_api_key'), 'an unknown key that LOOKS like a secret is hidden by the name pattern');
  assert.ok(!r.text.includes('VALUE-OF-') && !r.text.includes('CANARY-UNKNOWN-SECRET'), 'no admin-only value in the body');
  const m = new Map(r.json.map((s) => [s.key, s]));
  assert.equal(m.get('main_email').notes, 'help for main_email', 'full row shape (not reduced like a guest)');
  assert.equal(keys.length, STAFF_VISIBLE.length, 'only the visible set');
});

test('staff: an unknown, harmless-looking key is NOT hidden (fail-open for unknown keys, as decided)', async () => {
  seed();
  globalThis.__TIER = 'staff';
  assert.ok((await get()).json.some((s) => s.key === 'some_future_flag'));
});

test('admin and open: every row as before (secrets masked), nothing hidden', async () => {
  for (const tier of ['admin', 'open']) {
    seed();
    globalThis.__TIER = tier;
    const r = await get();
    const m = new Map(r.json.map((s) => [s.key, s]));
    for (const k of [...ADMIN_ONLY_SETTING_KEYS, ...STAFF_VISIBLE]) assert.ok(m.has(k), `${tier}: ${k} present`);
    for (const k of SECRET_SETTING_KEYS) assert.equal(m.get(k).value, SECRET_MASK, `${tier}: ${k} masked`);
    assert.equal(m.get('nedarim_plus_terminal').value, 'VALUE-OF-nedarim_plus_terminal');
  }
});

test('guest is unchanged by the staff tier: only the public allow-list', async () => {
  seed();
  globalThis.__TIER = 'guest';
  const r = await get();
  assert.deepEqual(r.json, [{ key: 'hide_dress_images', value: 'visible-hide_dress_images' }]); // the only seeded key on the public list, reduced to { key, value }
  assert.equal(PS.PUBLIC_SETTING_KEYS.filter((k) => isAdminOnlySettingKey(k)).length, 0, 'no key is both public and admin-only');
});

test('the cache is shared but each tier gets its own view (alternating readers on one warm cache)', async () => {
  seed();
  for (const tier of ['admin', 'staff', 'guest', 'staff', 'admin']) {
    globalThis.__TIER = tier;
    const keys = (await get()).json.map((s) => s.key);
    assert.equal(keys.includes('nedarim_plus_terminal'), tier === 'admin', `${tier}`);
    assert.equal(keys.includes('main_email'), tier !== 'guest', `${tier}`);
  }
});

test('the list: a reason for every key, unique, secrets and secret-like names covered, nothing public', () => {
  assert.equal(new Set(ADMIN_ONLY_SETTING_KEYS).size, ADMIN_ONLY_SETTING_KEYS.length);
  for (const k of ADMIN_ONLY_SETTING_KEYS) assert.ok(String(ADMIN_ONLY_SETTING_REASONS[k]).length > 8, `${k}: reason`);
  for (const k of SECRET_SETTING_KEYS) assert.ok(isAdminOnlySettingKey(k), `${k} (a secret) is admin-only`);
  assert.equal(isAdminOnlySettingKey('some_new_token_value'), true);
  assert.equal(isAdminOnlySettingKey('hide_dress_images'), false);
  assert.equal(isAdminOnlySettingKey(undefined), false);
  assert.deepEqual(toStaffSettings(null), []);
  for (const k of PS.PUBLIC_SETTING_KEYS) assert.ok(!isAdminOnlySettingKey(k), `${k} public and admin-only?`);
});

test('the real getSettingsViewerTier fails closed outside a request, and the route uses it (static)', async () => {
  const A = await import(pathToFileURL(PROJ + '/lib/auth.js').href + '?real=1');
  const origErr = console.error; console.error = () => {};
  try { assert.equal(await A.getSettingsViewerTier(), 'guest'); assert.equal(await A.getSettingsViewerTier({ forceDb: true }), 'guest'); } finally { console.error = origErr; }
  const route_ = fs.readFileSync(path.join(PROJ, 'app/api/settings/route.js'), 'utf8');
  assert.match(route_, /getSettingsViewerTier\(\{\s*forceDb:\s*fresh\s*\}\)/, '?fresh=1 (settings-editing screens) asks the DB for the role');
  assert.match(route_, /toStaffSettings\(settings\)/);
  const auth = fs.readFileSync(path.join(PROJ, 'lib/auth.js'), 'utf8');
  const fn = auth.slice(auth.indexOf('export async function getSettingsViewerTier'), auth.indexOf('export async function checkPageAccess'));
  assert.match(fn, /checkAuth\(undefined,\s*\{\s*failClosed:\s*true\s*\}\)/);
  assert.match(fn, /catch[\s\S]*return 'guest'/);
});

// ---------------------------------------------------------------------------------------------------------------- static scanner
// No code outside the admin tree may read an admin-only key. "Read" = the key name appears in a file that is not on the server-only / metadata
// list below. A hidden key that a regular screen reads would silently become undefined for staff - this test is what stops that.
const ADMIN_TREE = ['app/admin/', 'app/components/settings-sim/', 'app/components/admin-hub/', 'app/components/admin-lists/', 'app/components/permissions/', 'app/api/'];
const NOT_UI = {
  'lib/adminOnlySettings.js': 'this list', 'lib/settingsMetadata.js': 'names / help texts for the admin screens', 'lib/settingsSimLayout.js': 'layout of the admin settings screens',
  'app/lib/settingsValidation.js': 'validation of the admin save', 'app/lib/secretSettingKeys.js': 'the secret-key list (mask / encrypt on the server)', 'lib/permissionsMetadata.js': 'permission catalogue text',
  'app/lib/nedarimSettings.js': 'server: resolves the Nedarim institution id from the DB (imported by app/api/admin/nedarim-* only)', 'lib/mailer.js': 'server: sends mail (Apps Script links, drive folder)',
  'lib/emailCatalog.js': 'server: mail catalogue / recipients', 'lib/deviceBackupAccess.js': 'server: reads the setting straight from the DB', 'app/lib/prisma.js': 'server: backup-mode switch',
  'lib/approvalGate.js': 'server: approval hardening flags read straight from the DB', 'lib/agentDigest.js': 'server: digest mail', 'lib/settingsGuide.js': 'server',
};
function listAll(dir, out = []) {
  const abs = path.join(PROJ, dir);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = dir + '/' + e.name;
    if (e.isDirectory()) { if (!['node_modules', '.next'].includes(e.name)) listAll(rel, out); }
    else if (/\.(js|jsx|mjs|html)$/.test(e.name)) out.push(rel);
  }
  return out;
}
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, ' ');
const scanFiles = [...listAll('app'), ...listAll('components'), ...listAll('lib'), ...listAll('public/a5')].filter((f) => !ADMIN_TREE.some((p) => f.startsWith(p)));
const metaSrc = fs.readFileSync(path.join(PROJ, 'lib/settingsMetadata.js'), 'utf8');
const namesBlock = (metaSrc.match(/export const SETTINGS_HEBREW_NAMES = \{([\s\S]*?)\n\};/) || [, ''])[1];
const KNOWN = [...new Set([...namesBlock.matchAll(/^\s*'?([A-Za-z][A-Za-z0-9_]*)'?\s*:/gm)].map((m) => m[1]))];

test('static: no screen outside the admin tree reads an admin-only key (or a known secret-like key)', () => {
  const hidden = [...new Set([...ADMIN_ONLY_SETTING_KEYS, ...KNOWN.filter((k) => ADMIN_ONLY_KEY_PATTERN.test(k))])];
  assert.ok(KNOWN.length > 150 && scanFiles.length > 300, 'the scanner sees the code base');
  const problems = [];
  for (const f of scanFiles) {
    if (NOT_UI[f]) continue;
    const code = strip(fs.readFileSync(path.join(PROJ, f), 'utf8'));
    for (const k of hidden) if (new RegExp(`(^|[^A-Za-z0-9_])${k}([^A-Za-z0-9_]|$)`).test(code)) problems.push(`${f} mentions "${k}" - hidden from regular employees by GET /api/settings`);
  }
  assert.deepEqual(problems, []);
});

test('static: the NOT_UI exceptions are real, carry no client directive, and still mention at least one hidden key (no stale entries)', () => {
  for (const [f, why] of Object.entries(NOT_UI)) {
    if (!fs.existsSync(path.join(PROJ, f))) continue;
    const src = fs.readFileSync(path.join(PROJ, f), 'utf8');
    assert.ok(!/^\s*['"]use client['"]/m.test(src.slice(0, 400)), `${f} (${why}) must not be a client component`);
  }
  const mentions = (f) => { const code = strip(fs.readFileSync(path.join(PROJ, f), 'utf8')); return ADMIN_ONLY_SETTING_KEYS.some((k) => new RegExp(`(^|[^A-Za-z0-9_])${k}([^A-Za-z0-9_]|$)`).test(code)); };
  for (const f of ['lib/mailer.js', 'lib/emailCatalog.js', 'lib/deviceBackupAccess.js', 'app/lib/prisma.js', 'lib/approvalGate.js', 'app/lib/nedarimSettings.js']) assert.ok(mentions(f), `${f} no longer mentions a hidden key - drop it from NOT_UI`);
});

test('static: the keys staff DO read are not hidden (the reason they were left out is real)', () => {
  const readsBy = { management_messages: 'app/messages/page.js', shift_handover_notes: 'app/messages/page.js', main_email: 'app/print/order/page.js', courier_name: 'app/components/order-card/OcStepper.js', nedarim_plus_enabled: 'app/orders/new/LegacyNewOrderPage.js', require_login: 'app/components/home/LegacyHome.js' };
  for (const [k, f] of Object.entries(readsBy)) {
    assert.equal(isAdminOnlySettingKey(k), false, `${k} must stay visible`);
    assert.match(strip(fs.readFileSync(path.join(PROJ, f), 'utf8')), new RegExp(`(^|[^A-Za-z0-9_])${k}([^A-Za-z0-9_]|$)`), `${f} reads ${k}`);
  }
});

// ---------------------------------------------------------------------------------------------------------------- guide / a5 settings / AI
// The three other channels that return real values to branch managers (roleId 1): /api/settings/guide, /api/a5/settings?key=, and the AI assistant's catalog.
const guideRoute = await L('app/api/settings/guide/route.js');
const a5Route = await L('app/api/a5/settings/route.js');
const { settingsRowsForTier } = AO;

test('settingsRowsForTier: admin / open see everything, staff / guest lose the admin-only keys', () => {
  const rows = [{ key: 'nedarim_plus_terminal', value: 'x' }, { key: 'main_email', value: 'y' }];
  assert.equal(settingsRowsForTier(rows, 'admin'), rows);
  assert.equal(settingsRowsForTier(rows, 'open'), rows);
  assert.deepEqual(settingsRowsForTier(rows, 'staff').map((r) => r.key), ['main_email']);
  assert.deepEqual(settingsRowsForTier(rows, 'guest').map((r) => r.key), ['main_email']);
});

test('/api/settings/guide: a branch manager (staff tier) gets the catalog without admin-only keys; the programmer gets all', async () => {
  seed();
  globalThis.__SESSION_EMPLOYEE = { id: 'e1', roleId: 1 };
  globalThis.__TIER = 'staff';
  const staff = await (await guideRoute.GET()).json();
  const staffKeys = staff.settings.map((s) => s.key);
  for (const k of ADMIN_ONLY_SETTING_KEYS) assert.ok(!staffKeys.includes(k), `${k} not in the manager's catalog`);
  assert.ok(staffKeys.includes('main_email') && staffKeys.includes('management_messages'), 'the rest of the catalog is intact (the quick panel keeps working)');
  assert.ok(!JSON.stringify(staff).includes('VALUE-OF-'), 'no admin-only value in the body');
  globalThis.__TIER = 'admin';
  const admin = await (await guideRoute.GET()).json();
  const adminKeys = admin.settings.map((s) => s.key);
  for (const k of ['nedarim_plus_terminal', 'email_drive_folder_id', 'device_backup_employee_ids', 'approval_tokens_required']) assert.ok(adminKeys.includes(k), `${k} in the programmer's catalog`);
  assert.ok(adminKeys.length > staffKeys.length, 'the programmer sees more');
  for (const k of SECRET_SETTING_KEYS) assert.equal(admin.settings.find((s) => s.key === k).currentValue, SECRET_MASK, `${k} masked`);
});

test('/api/settings/guide and /api/a5/settings: no session -> still 401 (unchanged gates)', async () => {
  seed();
  globalThis.__AUTH = false;
  assert.equal((await guideRoute.GET()).status, 401);
  assert.equal((await a5Route.GET(new Request('http://test.local/api/a5/settings?key=main_email'))).status, 401);
  globalThis.__AUTH = true;
});

test('/api/a5/settings?key=: staff (branch manager) gets ordinary keys, an admin-only key looks like a missing one (404); head management gets it', async () => {
  seed();
  const req = (key) => new Request('http://test.local/api/a5/settings?key=' + encodeURIComponent(key));
  globalThis.__SESSION_EMPLOYEE = { id: 'e1', roleId: 1 };
  globalThis.__TIER = 'staff';
  const ok = await a5Route.GET(req('main_email'));
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).setting.key, 'main_email');
  for (const k of ['nedarim_plus_terminal', 'email_drive_folder_id', 'device_backup_employee_ids', 'approval_tokens_required']) {
    const hidden = await a5Route.GET(req(k));
    assert.equal(hidden.status, 404, `${k} -> 404 for a branch manager`);
    assert.ok(!(await hidden.text()).includes('VALUE-OF-'));
  }
  globalThis.__SESSION_EMPLOYEE = { id: 'e2', roleId: 0 };
  globalThis.__TIER = 'admin';
  const adminRes = await a5Route.GET(req('nedarim_plus_terminal'));
  assert.equal(adminRes.status, 200);
  assert.equal((await adminRes.json()).setting.key, 'nedarim_plus_terminal');
  globalThis.__SESSION_EMPLOYEE = null;
});

test('static: every route that turns SystemSetting rows into a values catalog filters them by the reader tier (guide, a5, both AI routes)', () => {
  for (const f of ['app/api/settings/guide/route.js', 'app/api/a5/settings/route.js', 'app/api/ai/route.js', 'app/api/ai/statistics/route.js']) {
    const src = fs.readFileSync(path.join(PROJ, f), 'utf8');
    const uses = [...src.matchAll(/getAllCachedSettings\(\)/g)].length;
    assert.ok(uses > 0, `${f} reads the settings`);
    assert.equal([...src.matchAll(/settingsRowsForTier\(await getAllCachedSettings\(\),\s*await getSettingsViewerTier\(\)\)/g)].length, uses, `${f}: every getAllCachedSettings() feeding a catalog goes through settingsRowsForTier(.., getSettingsViewerTier())`);
  }
  // nothing else may hand raw rows to buildSettingsGuide
  const offenders = [];
  for (const f of [...listAll('app/api'), ...listAll('lib')]) {
    if (f === 'lib/settingsMetadata.js') continue;
    const code = strip(fs.readFileSync(path.join(PROJ, f), 'utf8'));
    for (const m of code.matchAll(/buildSettingsGuide\(([^)]*)\)/g)) if (!/settingsRowsForTier|rows\b/.test(m[1]) && !/settingsRowsForTier/.test(code)) offenders.push(`${f}: ${m[0]}`);
  }
  assert.deepEqual(offenders, []);
});

test('consumers of the two endpoints, mapped: the quick panel (/api/settings/guide) and the A5 options adapter (/api/a5/settings) only open one setting by key', () => {
  const panel = fs.readFileSync(path.join(PROJ, 'app/components/SettingQuickPanel.js'), 'utf8');
  assert.match(panel, /fetch\('\/api\/settings\/guide'\)/);
  assert.match(panel, /\.find\(\s*\(?\s*s\s*\)?\s*=>\s*s\.key\s*===\s*settingKey/, 'the panel looks up exactly the requested key');
  const adapter = fs.readFileSync(path.join(PROJ, 'public/a5/adapters/options.js'), 'utf8');
  assert.match(adapter, /\/api\/a5\/settings\?key=/);
  for (const f of listAll('app').concat(listAll('components'))) {
    if (f.startsWith('app/api/')) continue;
    const code = strip(fs.readFileSync(path.join(PROJ, f), 'utf8'));
    if (/\/api\/(settings\/guide|a5\/settings\?)/.test(code)) assert.ok(['app/components/SettingQuickPanel.js'].includes(f), `${f}: a new consumer of a values catalog - check which keys it needs`);
  }
});
