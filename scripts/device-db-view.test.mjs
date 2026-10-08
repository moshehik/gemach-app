// "מצב גיבוי במחשב הזה בלבד" (lib/deviceDbView.js + app/lib/prisma.js + app/api/admin/db-view/route.js).
// + מי רשאי להפעיל (lib/deviceBackupAccess.js) ופקודת החיפוש בדף הבית (lib/backupCommand.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { isBackupSwitchCommand } from '../lib/backupCommand.js';

const require = createRequire(import.meta.url);
const { createDeviceDbViewToken, isDeviceBackupToken, DEVICE_DB_VIEW_MAX_AGE_SECONDS } = require('../lib/deviceDbView.js');
const SECRET = 'unit-test-secret';
const DAY = DEVICE_DB_VIEW_MAX_AGE_SECONDS * 1000;

test('a freshly signed cookie is accepted, and expires after its max age', () => {
  const now = 1_800_000_000_000;
  const token = createDeviceDbViewToken(now, SECRET);
  assert.match(token, /^v1\.\d+\.[\w-]+$/);
  assert.equal(isDeviceBackupToken(token, now + 1000, SECRET), true);
  assert.equal(isDeviceBackupToken(token, now + DAY - 1, SECRET), true);
  assert.equal(isDeviceBackupToken(token, now + DAY + 1, SECRET), false);
});

test('forged, tampered, empty or wrongly-signed cookies are rejected', () => {
  const now = 1_800_000_000_000;
  const token = createDeviceDbViewToken(now, SECRET);
  const [v, exp, sig] = token.split('.');
  assert.equal(isDeviceBackupToken(`${v}.${Number(exp) + 999999}.${sig}`, now, SECRET), false, 'extended expiry must break the signature');
  assert.equal(isDeviceBackupToken(`${v}.${exp}.${sig.slice(0, -2)}AA`, now, SECRET), false);
  assert.equal(isDeviceBackupToken(token, now, 'another-secret'), false);
  for (const bad of ['', 'backup', 'true', 'v1..', 'v2.1.x', undefined, null, 42, 'v1.99999999999999.AAAA']) {
    assert.equal(isDeviceBackupToken(bad, now, SECRET), false, String(bad));
  }
});

test('without any secret nothing is signed or accepted (production without AUTH_SECRET)', () => {
  assert.equal(createDeviceDbViewToken(Date.now(), null), null);
  assert.equal(isDeviceBackupToken('v1.99999999999999.AAAA', Date.now(), null), false);
});

test('the proxy picks the backup client per request from the signed cookie, never from a global', () => {
  const src = fs.readFileSync(new URL('../app/lib/prisma.js', import.meta.url), 'utf8');
  const mode = fs.readFileSync(new URL('../lib/dbMode.js', import.meta.url), 'utf8');
  assert.match(mode, /workUnitAsyncStorage\.getStore\(\)/);
  assert.match(mode, /isDeviceBackupToken\(token\)/);
  assert.match(src, /const isTest = \(devTest \|\| webTest \|\| readDeviceBackupFlag\(\)\) && globalForPrisma\.prismaTest;/);
  // the per-computer choice must not touch the process-wide state the global switch uses
  assert.doesNotMatch(mode, /webDbModeState\.mode\s*=[^=]/);
  assert.doesNotMatch(mode, /activeDbMode\s*=[^=]/);
});

test('enabling needs the programmer or a programmer-approved employee; disabling is open and clears the cookie', () => {
  const src = fs.readFileSync(new URL('../app/api/admin/db-view/route.js', import.meta.url), 'utf8');
  const realIdx = src.indexOf("if (mode === 'real')");
  const authIdx = src.indexOf('canEnableDeviceBackup(await getSessionEmployee())');
  assert.ok(realIdx > 0 && authIdx > realIdx, 'the real/clear branch returns before the permission check');
  assert.match(src, /httpOnly: true/);
  assert.match(src, /TEST_DATABASE_URL/);
});

test('only the programmer edits the allowed-employees list (access route + generic settings route)', () => {
  const access = fs.readFileSync(new URL('../app/api/admin/db-view/access/route.js', import.meta.url), 'utf8');
  assert.equal((access.match(/checkAuth\('מתכנת'\)/g) || []).length, 2, 'GET and PUT both programmer-only');
  const settings = fs.readFileSync(new URL('../app/api/settings/route.js', import.meta.url), 'utf8');
  assert.match(settings, /item\.key === DEVICE_BACKUP_EMPLOYEES_KEY\) && !\(await checkAuth\('מתכנת'\)\)/);
});

test('the allowed list is parsed defensively', async () => {
  const src = fs.readFileSync(new URL('../lib/deviceBackupAccess.js', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('export function parseAllowedIds'), src.indexOf('// קריאה ישירה'));
  const parseAllowedIds = new Function(`${fn.replace('export function', 'function')}; return parseAllowedIds;`)();
  assert.deepEqual(parseAllowedIds('["a","b"]'), ['a', 'b']);
  assert.deepEqual(parseAllowedIds('["a",1,null,""]'), ['a']);
  for (const bad of [undefined, null, '', 'not json', '{"a":1}', '"x"']) assert.deepEqual(parseAllowedIds(bad), [], String(bad));
});

test('the home-search command matches only whole phrases about switching to the backup DB', () => {
  for (const yes of ['עבור למסד הגיבוי', 'עבור למסד גיבוי', 'מסד הגיבוי', 'מסד גיבוי', 'מצב גיבוי', 'עבור למצב גיבוי', 'מעבר למסד הגיבוי',
    'נתוני גיבוי', 'מסד נתונים גיבוי', '  עבור   למסד  הגיבוי  ', 'עבור למסד הגיבוי!', 'מסד בדיקות', 'מצב בדיקות']) {
    assert.equal(isBackupSwitchCommand(yes), true, yes);
  }
  for (const no of ['', '   ', 'גיבוי', 'כהן', 'משפחת כהן', 'עבור', 'מסד', 'גיבוי הזמנות', 'מסד הגיבוי של כהן', 'הזמנה 12345', 'מצב גיבוי כהן', undefined, null]) {
    assert.equal(isBackupSwitchCommand(no), false, String(no));
  }
});

test('both home screens run the command check before searching, and only on non-AI searches', () => {
  const a5 = fs.readFileSync(new URL('../app/components/home/HomeA5.js', import.meta.url), 'utf8');
  assert.match(a5, /if \(!ai && await tryBackupCommand\(query\)\) return;/);
  const legacy = fs.readFileSync(new URL('../app/components/home/LegacyHome.js', import.meta.url), 'utf8');
  assert.match(legacy, /if \(await tryBackupCommand\(queryText\)\) return;/);
  const hook = fs.readFileSync(new URL('../app/components/home/useBackupSwitchCommand.js', import.meta.url), 'utf8');
  assert.match(hook, /!st\.canEnable \|\| !st\.available \|\| st\.device === 'backup'\) return false;/, 'not allowed -> plain search, no hint');
});

test('every in-process cache that holds DB rows is keyed by the active database', () => {
  const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  for (const p of ['lib/permissions.js', 'lib/globalSearch.js', 'lib/schedule/autoPrepMark.js', 'app/api/board/stages/route.js', 'app/api/schedule/updated/route.js']) {
    assert.match(read(p), /currentDbModeTag\(\)/, p);
  }
  const settings = read('lib/settingsCache.js');
  assert.match(settings, /isDeviceBackupRequest\(\)/);
  assert.match(read('lib/auth.js'), /isDeviceBackupRequest\(\)/);
});
