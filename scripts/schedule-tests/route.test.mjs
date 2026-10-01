// GET /api/schedule עם lib/auth.js ו-lib/permissions.js האמיתיים (רק next/headers ו-prisma מוחלפים):
// 401 בלי התחברות, 403 למחלקה בלי שורת הרשאה (page:schedule סגור כברירת מחדל - החלטת הבעלים B1) ולמחלקה
// עם שורת false, 200 למחלקה עם שורת true, 400 לתאריך שגוי/קיצוני. וגם resolvePageAccess ישירות.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { installDb } from './fixtures.mjs';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const route = await L('app/api/schedule/route.js');
const { resolvePageAccess, invalidatePermissionCache } = await L('lib/permissions.js');
const { invalidateSettingsCache } = await L('lib/settingsCache.js');
const { invalidateRequireLoginCache } = await L('lib/auth.js');
const { getCatalogItem } = await L('lib/permissionsMetadata.js');

const call = (qs = '') => route.GET({ url: 'http://localhost/api/schedule' + qs });

beforeEach(() => {
  installDb();
  invalidateSettingsCache();
  invalidateRequireLoginCache();
  invalidatePermissionCache();
  globalThis.__AUTH_TOKEN = null;
});

test('catalog: page:schedule exists, enforced, CLOSED by default like every other page (owner decision B1)', () => {
  const item = getCatalogItem('page:schedule');
  assert.ok(item);
  assert.equal(item.enforced, true);
  assert.equal(item.route, '/schedule');
  assert.equal(item.group, 'pages');
  for (const roleId of [1, 3, 4, 5, 6, 7]) assert.equal(item.defaultForRoleId(roleId), false, 'roleId ' + roleId);
  // same default as the sibling pages the schedule draws from
  assert.equal(getCatalogItem('page:deliveries').defaultForRoleId(5), false);
  assert.equal(getCatalogItem('page:alterations').defaultForRoleId(5), false);
});

test('401 when login is required and nobody is logged in', async () => {
  const r = await call('?date=2026-10-01');
  assert.equal(r.status, 401);
});

test('200 for a regular employee whose department has a page:schedule=true row', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const r = await call('?date=2026-10-01');
  assert.equal(r.status, 200, JSON.stringify(r.__json));
  assert.equal(r.__json.date, '2026-10-01');
  assert.equal(r.headers['Cache-Control'], 'no-store');
  assert.equal(r.__json.settings.includeInternalNotes, false);
  assert.ok(Array.isArray(r.__json.stages) && r.__json.stages.length === 8);
});

test('403 for a department WITHOUT any page:schedule row (closed by default, B1)', async () => {
  globalThis.__AUTH_TOKEN = 'emp-no-row';
  const r = await call('?date=2026-10-01');
  assert.equal(r.status, 403);
});

test('403 for a department with an explicit page:schedule=false row', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker-blocked';
  const r = await call('?date=2026-10-01');
  assert.equal(r.status, 403);
});

test('head management always passes and sees internal notes', async () => {
  globalThis.__AUTH_TOKEN = 'emp-head';
  const r = await call('?date=2026-10-01&branch=' + encodeURIComponent('גב״ש'));
  assert.equal(r.status, 200);
  assert.equal(r.__json.settings.includeInternalNotes, true);
  assert.equal(r.__json.settings.branchFilter, 'גב״ש');
});

test('400 for a malformed date', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const r = await call('?date=2026-10-1');
  assert.equal(r.status, 400);
});

test('400 (not 500) for a well-formed date outside +-3 years: 9999-12-31, 0100-01-01, 1990-01-01', async () => {
  globalThis.__AUTH_TOKEN = 'emp-worker';
  const errors = [];
  const origError = console.error;
  console.error = (...a) => errors.push(a.join(' '));
  try {
    for (const date of ['9999-12-31', '0100-01-01', '1990-01-01']) {
      const r = await call('?date=' + date);
      assert.equal(r.status, 400, date);
      assert.match(r.__json.error, /מחוץ לטווח/, date);
    }
  } finally {
    console.error = origError;
  }
  assert.deepEqual(errors, [], 'no 500-style console.error noise');
  // and a date inside the window still works
  const ok = await call('?date=2028-06-15');
  assert.equal(ok.status, 200);
});

test('inactive employee: passes the login check (existing checkAuth behaviour) but fails the page gate => 403', async () => {
  globalThis.__AUTH_TOKEN = 'emp-inactive';
  const r = await call('?date=2026-10-01');
  assert.equal(r.status, 403);
});

test('open mode (require_login off): anonymous caller may read the schedule', async () => {
  installDb({ settings: [{ key: 'require_login', value: 'false' }] });
  invalidateSettingsCache();
  invalidateRequireLoginCache();
  const r = await call('?date=2026-10-01');
  assert.equal(r.status, 200);
  assert.equal(r.__json.settings.includeInternalNotes, false);
});

test('resolvePageAccess: default false, department row true/false wins, employee override true wins over department', async () => {
  assert.equal((await resolvePageAccess(7, 'emp-no-row', ['page:schedule']))['page:schedule'], false, 'no row => closed');
  assert.equal((await resolvePageAccess(5, 'emp-worker', ['page:schedule']))['page:schedule'], true, 'row true => open');
  assert.equal((await resolvePageAccess(6, 'emp-worker-blocked', ['page:schedule']))['page:schedule'], false);
  assert.equal((await resolvePageAccess(0, 'emp-head', ['page:schedule']))['page:schedule'], true, 'head management always');
  installDb({ extra: { employeePermissionOverride: [{ employeeId: 'emp-x', key: 'page:schedule', value: 'true' }] } });
  invalidatePermissionCache();
  assert.equal((await resolvePageAccess(6, 'emp-x', ['page:schedule']))['page:schedule'], true);
});
