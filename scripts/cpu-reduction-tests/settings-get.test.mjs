// GET /api/settings now reads from a 30s server cache (lib/settingsCache.js getCachedSettingsList). This test pins that the RESPONSE is
// byte-for-byte what the old handler produced (the old handler is copied verbatim below as `oldGet`), and that the cache is dropped by every
// write. In-memory prisma + auth shims, no DB, no server.
//   node --import ./scripts/cpu-reduction-tests/register.mjs --test scripts/cpu-reduction-tests/settings-get.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { NextResponse } from 'next/server';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const { default: prisma } = await L('app/lib/prisma.js');
const { checkAuth } = await L('lib/auth.js');
const SC = await L('lib/settingsCache.js');
const { SECRET_SETTING_KEYS, SECRET_MASK } = await L('app/lib/secretSettingKeys.js');
const { NON_WORKING_DAYS_SETTING_KEY, stripNonWorkingDaysNotes } = await L('lib/businessDays.js');
const route = await L('app/api/settings/route.js');
const labels = await L('app/api/settings/labels/route.js');

// ---- the OLD handler, frozen (origin/main before the cache) -------------------------------------------------------------
async function oldGet() {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { notIn: ['BRAND_LOGO', 'backup_requested_at'] } },
    orderBy: [{ category: 'asc' }, { id: 'asc' }],
  });
  let masked = settings.map((s) => (SECRET_SETTING_KEYS.includes(s.key) ? { ...s, value: s.value ? SECRET_MASK : '' } : s));
  const nwd = masked.find((s) => s.key === NON_WORKING_DAYS_SETTING_KEY);
  if (nwd && typeof nwd.value === 'string' && nwd.value.includes('"note"') && !(await checkAuth())) {
    masked = masked.map((s) => (s === nwd ? { ...s, value: stripNonWorkingDaysNotes(s.value) } : s));
  }
  return NextResponse.json(masked);
}

const NWD = JSON.stringify({ version: 2, days: [{ date: '2031-01-05', note: 'פרט פנימי' }], ranges: [], recurringHebrew: [] });
const row = (i, key, category, value, extra = {}) => ({ id: `id-${String(i).padStart(3, '0')}`, legacyId: null, key, value, name: key, category, notes: null, type: 'text', updatedAt: new Date('2026-10-01T00:00:00Z'), ...extra });
function seed() {
  globalThis.__SETTINGS = [
    row(5, 'zeta', 'ב', 'z'), row(1, 'alpha', 'א', 'a'), row(9, 'BRAND_LOGO', 'מיתוג', 'data:image/png;base64,AAAA'),
    row(3, 'nedarim_plus_token', 'תשלומים', 'real-secret-token'), row(4, 'yemot_api_token', 'תשלומים', ''),
    row(2, 'beta', 'א', 'b'), row(7, 'backup_requested_at', 'מערכת', '2026-10-05T00:00:00Z'),
    row(6, NON_WORKING_DAYS_SETTING_KEY, 'יומן', NWD), row(8, 'no_category', null, 'n'), row(10, 'ui_labels_mapping', 'ui_label', '{"a":"b"}'),
  ];
  globalThis.__MOCK_CALLS = [];
  globalThis.__AUTH = true;
  globalThis.__FIND_MANY_DELAY = 0;
  globalThis.__FIND_MANY_FAIL = false;
  SC.invalidateSettingsCache();
}
const findManyCalls = () => globalThis.__MOCK_CALLS.filter((c) => c.op === 'findMany').length;
const body = async (res) => ({ status: res.status, json: await res.json() });
const postItems = (items) => route.POST(new Request('http://test.local/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(items) }));

test('response is identical to the old handler: filtering, sorting (category asc nulls last, id asc), secret masking', async () => {
  seed();
  const before = await body(await oldGet());
  const after = await body(await route.GET());
  assert.equal(after.status, 200);
  assert.deepEqual(after.json, before.json);
  assert.equal(JSON.stringify(after.json), JSON.stringify(before.json), 'same key order inside every row too');
  const keys = after.json.map((s) => s.key);
  assert.ok(!keys.includes('BRAND_LOGO') && !keys.includes('backup_requested_at'), 'excluded keys');
  assert.equal(after.json.find((s) => s.key === 'nedarim_plus_token').value, SECRET_MASK, 'secret masked');
  assert.equal(after.json.find((s) => s.key === 'yemot_api_token').value, '', 'empty secret stays empty');
  // independent expectation: category asc ('ui_label' < 'א' < 'ב' < 'יומן' < 'תשלומים'), id asc inside a category, NULL category last
  assert.deepEqual(keys, ['ui_labels_mapping', 'alpha', 'beta', 'zeta', NON_WORKING_DAYS_SETTING_KEY, 'nedarim_plus_token', 'yemot_api_token', 'no_category']);
});

test('non_working_days_extra notes: stripped for an anonymous reader, kept for a signed-in one - same as the old handler, and the cache never leaks the full value', async () => {
  seed();
  for (const auth of [true, false, true, false]) { // alternating on the SAME warm cache
    globalThis.__AUTH = auth;
    const oldR = await body(await oldGet());
    const newR = await body(await route.GET());
    assert.deepEqual(newR.json, oldR.json, `auth=${auth}`);
    const v = newR.json.find((s) => s.key === NON_WORKING_DAYS_SETTING_KEY).value;
    assert.equal(/"note"/.test(v), auth, `auth=${auth}: notes ${auth ? 'present' : 'stripped'}`);
  }
  assert.equal(findManyCalls() >= 4 + 1, true);
  // after the anonymous reads, the cached rows still hold the original (un-stripped) value
  const cached = await SC.getCachedSettingsList();
  assert.equal(cached.find((s) => s.key === NON_WORKING_DAYS_SETTING_KEY).value, NWD);
  assert.equal(cached.find((s) => s.key === 'nedarim_plus_token').value, 'real-secret-token', 'masking is applied per response, the cache itself is never mutated');
});

test('one DB read serves many GETs; a POST drops the cache on the same instance and the next GET sees the new value', async () => {
  seed();
  globalThis.__MOCK_CALLS = [];
  for (let i = 0; i < 20; i++) await route.GET();
  assert.equal(findManyCalls(), 1, '20 GETs -> 1 findMany');
  const res = await postItems([{ key: 'alpha', value: 'changed', name: 'alpha' }]);
  assert.equal(res.status, 200);
  const after = await body(await route.GET());
  assert.equal(after.json.find((s) => s.key === 'alpha').value, 'changed', 'no stale read after a write');
  assert.equal(findManyCalls(), 2);
});

test('a brand-new key written through POST appears immediately (create path)', async () => {
  seed();
  await route.GET();
  await postItems([{ key: 'brand_new_key', value: '1', name: 'חדש' }]);
  const keys = (await body(await route.GET())).json.map((s) => s.key);
  assert.ok(keys.includes('brand_new_key'));
});

test('POST /api/settings/labels also drops the cache (ui_labels_mapping is part of the list)', async () => {
  seed();
  await route.GET();
  const res = await labels.POST(new Request('http://test.local/api/settings/labels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x: 'y' }) }));
  assert.equal(res.status, 200);
  const v = (await body(await route.GET())).json.find((s) => s.key === 'ui_labels_mapping').value;
  assert.equal(v, JSON.stringify({ x: 'y' }));
});

test('?fresh=1 bypasses the cache and refreshes it', async () => {
  seed();
  await route.GET();
  globalThis.__SETTINGS.find((s) => s.key === 'beta').value = 'written-by-another-instance';
  const stale = (await body(await route.GET())).json.find((s) => s.key === 'beta').value;
  assert.equal(stale, 'b', 'within 30s a write from ANOTHER instance is not visible on the plain GET (documented trade-off)');
  const fresh = (await body(await route.GET(new Request('http://test.local/api/settings?fresh=1')))).json.find((s) => s.key === 'beta').value;
  assert.equal(fresh, 'written-by-another-instance');
  const next = (await body(await route.GET())).json.find((s) => s.key === 'beta').value;
  assert.equal(next, 'written-by-another-instance', 'the fresh read refreshed the cache');
});

test('the cache expires after 30s', async () => {
  seed();
  const realNow = Date.now;
  let t = realNow();
  Date.now = () => t;
  try {
    await route.GET();
    t += 29_000; await route.GET();
    assert.equal(findManyCalls(), 1);
    t += 2_000; await route.GET();
    assert.equal(findManyCalls(), 2, 'expired -> reload');
  } finally { Date.now = realNow; }
});

test('concurrent GETs share one in-flight read; a write that lands DURING a slow read is not hidden by the older result', async () => {
  seed();
  globalThis.__FIND_MANY_DELAY = 30;
  await Promise.all([route.GET(), route.GET(), route.GET()]);
  assert.equal(findManyCalls(), 1, 'deduped');

  seed();
  globalThis.__FIND_MANY_DELAY = 40;
  const slow = route.GET(); // starts the read with the OLD data
  await new Promise((r) => setTimeout(r, 10));
  globalThis.__SETTINGS.find((s) => s.key === 'alpha').value = 'new-during-read';
  SC.invalidateSettingsCache(); // what a write does
  await slow;
  globalThis.__FIND_MANY_DELAY = 0;
  const v = (await body(await route.GET())).json.find((s) => s.key === 'alpha').value;
  assert.equal(v, 'new-during-read', 'the stale in-flight result was NOT stored');
});

test('DB errors are not cached: 500 with the same body as before, and the next call recovers', async () => {
  seed();
  globalThis.__FIND_MANY_FAIL = true;
  const origErr = console.error; console.error = () => {};
  let r;
  try { r = await body(await route.GET()); } finally { console.error = origErr; }
  assert.equal(r.status, 500);
  assert.deepEqual(r.json, { error: 'Failed to fetch settings' });
  globalThis.__FIND_MANY_FAIL = false;
  const ok = await body(await route.GET());
  assert.equal(ok.status, 200);
});

test('a database-mode switch (.active-db / web_backup_mode) invalidates the cache', async () => {
  seed();
  globalThis.activeDbMode = 'prod';
  await route.GET();
  await route.GET();
  assert.equal(findManyCalls(), 1);
  globalThis.activeDbMode = 'test';
  await route.GET();
  assert.equal(findManyCalls(), 2, 'other DB -> do not serve the old DB rows');
  delete globalThis.activeDbMode;
});

test('invalidateSettingsCache(key) (fix-loop, restrictions) also drops the list cache', async () => {
  seed();
  await route.GET();
  SC.invalidateSettingsCache('alpha');
  await route.GET();
  assert.equal(findManyCalls(), 2);
});

test('the query is the same as the old handler (exact where/orderBy)', async () => {
  seed();
  await oldGet();
  await route.GET();
  const [a, b] = globalThis.__MOCK_CALLS.filter((c) => c.op === 'findMany');
  assert.deepEqual(b.args, a.args);
});
