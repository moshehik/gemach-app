// lib/apiCachePersist.js (pure, fake storage) + the per-tab persistence inside lib/apiCache.js (fake window/sessionStorage/fetch).
//   node --no-warnings --import ./scripts/cpu-reduction-tests/register.mjs --test scripts/cpu-reduction-tests/api-cache-persist.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const P = await L('lib/apiCachePersist.js');
const MIN = 60 * 1000;

class FakeStorage {
  constructor() { this.m = new Map(); this.throwOn = null; }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { if (this.throwOn === 'get') throw new Error('blocked'); return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { if (this.throwOn === 'set') throw new Error('quota'); this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}
const meBody = (id) => ({ success: true, employee: { id, roleId: 4 }, activeShift: null });
const prefsBody = (id) => ({ success: true, employeeId: id, prefs: { mode: 'dark' } });
const mk = (uid = 'emp-1') => {
  const st = new FakeStorage();
  const clock = { t: 1_000_000 };
  const ctx = { uid };
  const store = P.createPersistStore({ storage: st, getUid: () => ctx.uid, now: () => clock.t });
  return { st, clock, ctx, store };
};

test('allow-list: only the four boot endpoints can be stored', () => {
  assert.deepEqual(P.PERSIST_URLS, ['/api/settings', '/api/settings/labels', '/api/me', '/api/me/design-prefs']);
  const { store, st } = mk();
  assert.equal(store.write('/api/orders?x=1', { a: 1 }), false);
  assert.equal(store.write('/api/employees', [{ id: 1 }]), false);
  assert.equal(st.length, 0);
  assert.equal(store.read('/api/orders'), null);
});

test('per-key fresh windows: labels/design-prefs 15 min, settings 5 min, me 90s', () => {
  assert.equal(P.persistFreshMs('/api/settings/labels'), 15 * MIN);
  assert.equal(P.persistFreshMs('/api/me/design-prefs'), 15 * MIN);
  assert.equal(P.persistFreshMs('/api/settings'), 5 * MIN);
  assert.equal(P.persistFreshMs('/api/me'), 90 * 1000);
  assert.ok(P.PERSIST_MAX_AGE_MS >= 15 * MIN, 'nothing is fresh for longer than it may be stored');
});

test('round trip + age rules: usable up to 15 min, dropped (and removed) after', () => {
  const { store, st, clock } = mk();
  assert.equal(store.write('/api/me', meBody('emp-1')), true);
  assert.deepEqual(store.read('/api/me').data, meBody('emp-1'));
  clock.t += P.PERSIST_MAX_AGE_MS;
  assert.ok(store.read('/api/me'), 'exactly at the limit is still ok');
  clock.t += 1;
  assert.equal(store.read('/api/me'), null);
  assert.equal(st.length, 0, 'expired entry removed');
});

test("a different signed-in user never reads another user's entry (and it is removed)", () => {
  const { store, st, ctx } = mk('emp-A');
  store.write('/api/settings', [{ key: 'k', value: 'v' }]);
  store.write('/api/me', meBody('emp-A'));
  ctx.uid = 'emp-B';
  assert.equal(store.read('/api/me'), null);
  assert.equal(store.read('/api/settings'), null);
  assert.equal(st.length, 0);
});

test('body identity: /api/me and /api/me/design-prefs must carry the marker employee id, on write and on read', () => {
  const { store, st, ctx } = mk('emp-A');
  assert.equal(P.bodyIdentity('/api/me', meBody('x')), 'x');
  assert.equal(P.bodyIdentity('/api/me/design-prefs', prefsBody('y')), 'y');
  assert.equal(P.bodyIdentity('/api/settings', []), null, 'settings/labels carry no identity');
  // write: someone else's body under this marker is refused
  assert.equal(store.write('/api/me', meBody('emp-B')), false);
  assert.equal(store.write('/api/me/design-prefs', prefsBody('emp-B')), false);
  assert.equal(store.write('/api/me', { success: true }), false, 'a body without an id is not stored');
  assert.equal(st.length, 0);
  // read: a (hand-made / raced) entry whose body disagrees with its own marker is dropped
  st.setItem(P.persistKey('/api/me'), JSON.stringify({ v: 1, uid: 'emp-A', time: 1_000_000, data: meBody('emp-B') }));
  assert.equal(store.read('/api/me'), null);
  assert.equal(st.length, 0);
  assert.equal(store.write('/api/me', meBody('emp-A')), true);
  ctx.uid = 'emp-A';
  assert.ok(store.read('/api/me'));
});

test('not signed in (empty marker): nothing is read or written', () => {
  const { store, st, ctx } = mk('emp-A');
  store.write('/api/me', meBody('emp-A'));
  ctx.uid = '';
  assert.equal(store.read('/api/me'), null);
  assert.equal(store.write('/api/settings', []), false);
  assert.equal(st.length, 1, 'read with no marker does not touch the stored entry (apiCache clears it at boot)');
});

test('corrupt / foreign-shape entries are ignored and removed', () => {
  const { store, st } = mk();
  st.setItem(P.persistKey('/api/me'), '{not json');
  assert.equal(store.read('/api/me'), null);
  assert.equal(st.length, 0);
  st.setItem(P.persistKey('/api/me'), JSON.stringify({ v: 2, uid: 'emp-1', time: 1_000_000, data: meBody('emp-1') }));
  assert.equal(store.read('/api/me'), null);
  st.setItem(P.persistKey('/api/me'), JSON.stringify({ v: 1, uid: 'emp-1', time: 'x', data: meBody('emp-1') }));
  assert.equal(store.read('/api/me'), null);
});

test('size caps: an oversized entry is not stored and the older copy is removed; the total cap evicts the others', () => {
  const { store, st } = mk();
  assert.equal(store.write('/api/settings', [{ v: 'a' }]), true);
  const big = [{ v: 'x'.repeat(P.PERSIST_MAX_ENTRY_CHARS) }];
  assert.equal(store.write('/api/settings', big), false);
  assert.equal(store.read('/api/settings'), null, 'old copy removed, never truncated');
  assert.equal(st.length, 0);
  const a = [{ v: 'x'.repeat(190 * 1000) }];
  const b = [{ v: 'y'.repeat(190 * 1000) }];
  assert.equal(store.write('/api/settings', a), true);
  assert.equal(store.write('/api/settings/labels', b), true);
  assert.equal(store.write('/api/me', { ...meBody('emp-1'), pad: 'z'.repeat(190 * 1000) }), true);
  assert.ok(st.length <= 2, 'over the 400K total: older ones evicted');
  assert.ok(store.read('/api/me'), 'the newest write survives');
});

test('storage that throws (private mode / quota) never throws out: no persistence, no crash', () => {
  const { store, st } = mk();
  st.throwOn = 'set';
  assert.equal(store.write('/api/me', meBody('emp-1')), false);
  st.throwOn = 'get';
  assert.equal(store.read('/api/me'), null);
  assert.doesNotThrow(() => store.clear());
  const none = P.createPersistStore({ storage: null, getUid: () => 'x' });
  assert.equal(none.write('/api/me', {}), false);
  assert.equal(none.read('/api/me'), null);
  assert.doesNotThrow(() => { none.clear(); none.remove('/api/me'); none.removePrefixes('/api'); });
});

test('removePrefixes mirrors apiCache.invalidate (prefix match: /api/me also drops /api/me/design-prefs), clear drops all', () => {
  const { store } = mk();
  const bodies = { '/api/settings': [], '/api/settings/labels': {}, '/api/me': meBody('emp-1'), '/api/me/design-prefs': prefsBody('emp-1') };
  for (const u of P.PERSIST_URLS) store.write(u, bodies[u]);
  store.removePrefixes(['/api/me']);
  assert.equal(store.read('/api/me'), null);
  assert.equal(store.read('/api/me/design-prefs'), null);
  assert.ok(store.read('/api/settings') && store.read('/api/settings/labels'));
  store.removePrefixes('/api/settings');
  assert.equal(store.read('/api/settings'), null);
  assert.equal(store.read('/api/settings/labels'), null, 'labels is under /api/settings');
  store.write('/api/me', meBody('emp-1'));
  store.clear();
  assert.equal(store.read('/api/me'), null);
});

test('readUserMarker reads <html data-gm-uid>, tolerates anything else', () => {
  const doc = (v) => ({ documentElement: { getAttribute: (n) => (n === 'data-gm-uid' ? v : null) } });
  assert.equal(P.readUserMarker(doc(' emp-9 ')), 'emp-9');
  assert.equal(P.readUserMarker(doc(null)), '');
  assert.equal(P.readUserMarker(null), '');
  assert.equal(P.readUserMarker({ documentElement: { getAttribute() { throw new Error('x'); } } }), '');
});

// ------------------------------- integration with lib/apiCache.js -------------------------------------
// A fresh module instance per scenario (query-string cache bust) with a fake browser environment. A fake "now" is shared with Date.now.
let seq = 0;
const clock = { offset: 0 };
const realNow = Date.now;
Date.now = () => realNow() + clock.offset;
const bodyFor = (u, uid, n) => (u === '/api/me' ? meBody(uid) : u === '/api/me/design-prefs' ? prefsBody(uid) : { url: u, n });
async function loadCache({ uid = 'emp-1', storage = new FakeStorage(), responses = {} } = {}) {
  const calls = [];
  const win = globalThis;
  win.window = win;
  win.sessionStorage = storage;
  win.document = { documentElement: { getAttribute: (n) => (n === 'data-gm-uid' ? uid : null) } };
  win.addEventListener = (ev, fn) => { (win.__listeners ||= {})[ev] = fn; };
  win.location = { origin: 'http://test.local' };
  delete win.__apiCacheInvalidatorInstalled;
  win.fetch = async (url, init = {}) => {
    const u = String(url);
    calls.push({ url: u, method: (init.method || 'GET').toUpperCase() });
    const r = responses[u] ?? { status: 200, body: bodyFor(u, uid, calls.length) };
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
  };
  const mod = await import(pathToFileURL(process.env.PROJ + '/lib/apiCache.js').href + `?t=${++seq}`);
  return { mod, calls, storage, win };
}
const settle = () => new Promise((r) => setTimeout(r, 5));
const ageEntry = (storage, url, ms) => {
  const key = P.persistKey(url);
  const e = JSON.parse(storage.getItem(key));
  e.time -= ms;
  storage.setItem(key, JSON.stringify(e));
};

test('first load fetches + stores; a reload (fresh module, same tab storage) within the key window makes NO network call', async () => {
  const storage = new FakeStorage();
  let env = await loadCache({ storage });
  const a = await env.mod.fetchSharedJson('/api/settings', { ttl: env.mod.TTL.STATIC });
  assert.equal(env.calls.length, 1);
  assert.ok(storage.getItem(P.persistKey('/api/settings')), 'stored');
  env = await loadCache({ storage }); // "full page reload"
  const b = await env.mod.fetchSharedJson('/api/settings', { ttl: env.mod.TTL.STATIC });
  assert.deepEqual(b, a);
  await settle();
  assert.equal(env.calls.length, 0, 'zero requests on a reload within the window');
});

test('PAGE-FIRST ORDER: a plain page-level caller (no flag, reaching fetchSharedJson before the layout widgets) hydrates and the later boot callers share it - 0 requests on reload', async () => {
  const storage = new FakeStorage();
  let env = await loadCache({ storage });
  for (const u of P.PERSIST_URLS) await env.mod.fetchSharedJson(u, { ttl: env.mod.TTL.STATIC });
  assert.equal(storage.length, 4, 'written although no caller passed persist:true');
  env = await loadCache({ storage });
  // page effect first (e.g. deliveries/rentals/messages/profile ask for settings + me), then the layout parents ask with the old flag
  await env.mod.fetchSharedJson('/api/settings', { ttl: env.mod.TTL.STATIC });
  await env.mod.fetchSharedJson('/api/me', { ttl: env.mod.TTL.STATIC });
  await env.mod.fetchSharedJson('/api/settings', { ttl: env.mod.TTL.STATIC, persist: true });
  await env.mod.fetchSharedJson('/api/settings/labels', { ttl: env.mod.TTL.STATIC, persist: true });
  await env.mod.fetchSharedJson('/api/me', { ttl: env.mod.TTL.STATIC, persist: true });
  await settle();
  assert.equal(env.calls.length, 0, 'reload with the page asking first = still no network');
});

test('a non-allow-listed URL is never persisted (the persist option changes nothing)', async () => {
  const storage = new FakeStorage();
  const env = await loadCache({ storage });
  await env.mod.fetchSharedJson('/api/orders?x=1', { ttl: env.mod.TTL.LIST, persist: true });
  await env.mod.fetchSharedJson('/api/employees', { ttl: env.mod.TTL.STATIC });
  assert.equal(storage.length, 0);
});

test('per-key windows on reload: settings fresh at 4 min / refreshed at 6; labels + design-prefs fresh at 14 min; me fresh at 60s / refreshed at 2 min', async () => {
  const storage = new FakeStorage();
  let env = await loadCache({ storage });
  for (const u of P.PERSIST_URLS) await env.mod.fetchSharedJson(u, { ttl: env.mod.TTL.STATIC });
  const snapshot = new Map(storage.m);
  const reloadAfter = async (ms, url) => {
    storage.m = new Map(snapshot);
    ageEntry(storage, url, ms);
    const e = await loadCache({ storage });
    await e.mod.fetchSharedJson(url, { ttl: e.mod.TTL.STATIC });
    await settle();
    return e.calls.length;
  };
  assert.equal(await reloadAfter(4 * MIN, '/api/settings'), 0);
  assert.equal(await reloadAfter(6 * MIN, '/api/settings'), 1, 'older than 5 min: shown + background refresh');
  assert.equal(await reloadAfter(14 * MIN, '/api/settings/labels'), 0);
  assert.equal(await reloadAfter(14 * MIN, '/api/me/design-prefs'), 0);
  assert.equal(await reloadAfter(60 * 1000, '/api/me'), 0);
  assert.equal(await reloadAfter(2 * MIN, '/api/me'), 1);
});

test('stored entry older than its window but younger than 15 min: shown instantly AND refreshed in the background', async () => {
  const storage = new FakeStorage();
  let env = await loadCache({ storage });
  await env.mod.fetchSharedJson('/api/me', { ttl: env.mod.TTL.STATIC });
  const key = P.persistKey('/api/me');
  const e = JSON.parse(storage.getItem(key));
  ageEntry(storage, '/api/me', 5 * MIN);
  env = await loadCache({ storage });
  const data = await env.mod.fetchSharedJson('/api/me', { ttl: env.mod.TTL.STATIC });
  assert.equal(data.employee.id, 'emp-1', 'served from storage immediately');
  await settle();
  assert.equal(env.calls.length, 1, 'one background revalidation');
  assert.ok(JSON.parse(storage.getItem(key)).time > e.time - 5 * MIN, 'storage refreshed');
});

test('older than 15 min: ignored, normal blocking fetch', async () => {
  const storage = new FakeStorage();
  let env = await loadCache({ storage });
  await env.mod.fetchSharedJson('/api/settings/labels', { ttl: env.mod.TTL.STATIC });
  ageEntry(storage, '/api/settings/labels', 16 * MIN);
  env = await loadCache({ storage });
  await env.mod.fetchSharedJson('/api/settings/labels', { ttl: env.mod.TTL.STATIC });
  assert.equal(env.calls.length, 1);
});

test('different employee in the same tab: stored data of the other user is never used', async () => {
  const storage = new FakeStorage();
  let env = await loadCache({ storage, uid: 'emp-A' });
  await env.mod.fetchSharedJson('/api/me', { ttl: env.mod.TTL.STATIC });
  env = await loadCache({ storage, uid: 'emp-B' });
  const d = await env.mod.fetchSharedJson('/api/me', { ttl: env.mod.TTL.STATIC });
  assert.equal(d.employee.id, 'emp-B');
  assert.equal(env.calls.length, 1);
});

test('multi-tab A/B/A: tab keeps A, B logs in elsewhere (cookie = B), tab reloads as B, then A again - nobody ever sees the other\'s /api/me or design prefs', async () => {
  const storage = new FakeStorage(); // one tab's sessionStorage
  // 1. tab renders as A
  let env = await loadCache({ storage, uid: 'emp-A' });
  await env.mod.fetchSharedJson('/api/me', {});
  await env.mod.fetchSharedJson('/api/me/design-prefs', {});
  // 2. B logged in in another tab; this tab still has A's page but the server now answers /api/me as B (shared cookie): the response
  //    body says B while this page's marker says A -> must NOT be stored under A's marker
  const responses = { '/api/me': { status: 200, body: meBody('emp-B') }, '/api/me/design-prefs': { status: 200, body: prefsBody('emp-B') } };
  storage.m.clear();
  env = await loadCache({ storage, uid: 'emp-A', responses });
  await env.mod.fetchSharedJson('/api/me', {}); // network (nothing stored); body is B's
  await env.mod.fetchSharedJson('/api/me/design-prefs', {});
  assert.equal(storage.length, 0, "B's bodies are not stored under A's marker");
  // 3. the tab reloads: the server renders marker B
  env = await loadCache({ storage, uid: 'emp-B', responses });
  const b = await env.mod.fetchSharedJson('/api/me', {});
  assert.equal(b.employee.id, 'emp-B');
  assert.ok(storage.getItem(P.persistKey('/api/me')));
  // 4. A logs in again (cookie = A) and the tab reloads as A: B's stored entry is not served
  env = await loadCache({ storage, uid: 'emp-A' });
  const a = await env.mod.fetchSharedJson('/api/me', {});
  assert.equal(a.employee.id, 'emp-A');
  assert.equal(env.calls.length, 1, 'refetched, not served from B');
});

test('not signed in at module load (no marker): any leftovers in the tab are flushed', async () => {
  const storage = new FakeStorage();
  let env = await loadCache({ storage, uid: 'emp-A' });
  await env.mod.fetchSharedJson('/api/me', {});
  assert.equal(storage.length, 1);
  await loadCache({ storage, uid: '' }); // login page after a logout
  assert.equal(storage.length, 0);
});

test('login/logout POST flushes the stored boot data; a settings save drops settings+labels but keeps /api/me', async () => {
  const storage = new FakeStorage();
  const env = await loadCache({ storage });
  for (const u of P.PERSIST_URLS) await env.mod.fetchSharedJson(u, {});
  assert.equal(storage.length, 4);
  await env.win.fetch('/api/settings', { method: 'POST', body: '[]' });
  assert.equal(storage.getItem(P.persistKey('/api/settings')), null);
  assert.equal(storage.getItem(P.persistKey('/api/settings/labels')), null);
  assert.ok(storage.getItem(P.persistKey('/api/me')));
  await env.win.fetch('/api/login', { method: 'POST', body: '{}' });
  assert.equal(storage.length, 0, 'login flushes everything');
});

test('a change that touches /api/me (attendance clock-in/out, profile edit, design prefs PUT) drops the stored /api/me and design-prefs', async () => {
  const storage = new FakeStorage();
  const env = await loadCache({ storage });
  for (const u of P.PERSIST_URLS) await env.mod.fetchSharedJson(u, {});
  await env.win.fetch('/api/attendance', { method: 'POST', body: '{}' });
  assert.equal(storage.getItem(P.persistKey('/api/me')), null);
  assert.equal(storage.getItem(P.persistKey('/api/me/design-prefs')), null, '/api/me prefix covers design-prefs');
  assert.ok(storage.getItem(P.persistKey('/api/settings')));
});

test('a 401 (signed out) removes the stored copy', async () => {
  const storage = new FakeStorage();
  let env = await loadCache({ storage });
  await env.mod.fetchSharedJson('/api/me', {});
  ageEntry(storage, '/api/me', 5 * MIN);
  env = await loadCache({ storage, responses: { '/api/me': { status: 401, body: { success: false } } } });
  await env.mod.fetchSharedJson('/api/me', {}); // stale shown, bg revalidate -> 401
  await settle();
  assert.equal(storage.length, 0);
});

test('sessionStorage that throws: the cache keeps working in memory (no crash, normal fetch)', async () => {
  const storage = new FakeStorage();
  storage.throwOn = 'get';
  const env = await loadCache({ storage });
  const d = await env.mod.fetchSharedJson('/api/settings', { ttl: env.mod.TTL.STATIC });
  assert.equal(d.url, '/api/settings');
  storage.throwOn = 'set';
  const d2 = await env.mod.fetchSharedJson('/api/me', { ttl: env.mod.TTL.STATIC });
  assert.equal(d2.employee.id, 'emp-1');
});

test('readPersistedFresh / writePersisted (used by DesignPrefsSync, which needs response headers): default window = the key window', async () => {
  const storage = new FakeStorage();
  const env = await loadCache({ storage });
  assert.equal(env.mod.readPersistedFresh('/api/me/design-prefs'), undefined);
  assert.equal(env.mod.writePersisted('/api/me/design-prefs', prefsBody('emp-1')), true);
  assert.deepEqual(env.mod.readPersistedFresh('/api/me/design-prefs'), prefsBody('emp-1'));
  assert.equal(env.mod.readPersistedFresh('/api/me/design-prefs', -1), undefined, 'older than the requested max age -> undefined');
  assert.equal(env.mod.writePersisted('/api/me/design-prefs', prefsBody('emp-B')), false, "another employee's body is refused");
  assert.equal(env.mod.writePersisted('/api/orders', {}), false);
  env.mod.writePersisted('/api/me/design-prefs', prefsBody('emp-1'));
  ageEntry(storage, '/api/me/design-prefs', 14 * MIN);
  assert.ok(env.mod.readPersistedFresh('/api/me/design-prefs'), 'still fresh at 14 min');
  ageEntry(storage, '/api/me/design-prefs', 2 * MIN);
  assert.equal(env.mod.readPersistedFresh('/api/me/design-prefs'), undefined, 'not fresh at 16 min');
});

test('window focus: boot keys revalidate after 3 min, other keys after 60s (only keys with subscribers)', async () => {
  const storage = new FakeStorage();
  const env = await loadCache({ storage });
  const noop = () => {};
  env.mod.subscribe('/api/me', noop);
  env.mod.subscribe('/api/dresses/models', noop);
  await env.mod.fetchSharedJson('/api/me', { ttl: env.mod.TTL.STATIC });
  await env.mod.fetchSharedJson('/api/dresses/models', { ttl: env.mod.TTL.REFERENCE });
  const base = env.calls.length;
  try {
    clock.offset = 90 * 1000;
    env.win.__listeners.focus();
    await settle();
    assert.deepEqual(env.calls.slice(base).map((c) => c.url), ['/api/dresses/models'], 'after 90s only the non-boot key refreshes');
    clock.offset = 4 * MIN;
    env.win.__listeners.focus();
    await settle();
    assert.ok(env.calls.slice(base).some((c) => c.url === '/api/me'), 'after 4 min the boot key refreshes too');
  } finally { clock.offset = 0; }
});
