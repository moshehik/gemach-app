// lib/apiCachePersist.js (pure, fake storage) + the opt-in persistence inside lib/apiCache.js (fake window/sessionStorage/fetch).
//   node --no-warnings --import ./scripts/cpu-reduction-tests/register.mjs --test scripts/cpu-reduction-tests/api-cache-persist.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const P = await L('lib/apiCachePersist.js');

class FakeStorage {
  constructor() { this.m = new Map(); this.throwOn = null; }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { if (this.throwOn === 'get') throw new Error('blocked'); return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { if (this.throwOn === 'set') throw new Error('quota'); this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}
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

test('round trip + age rules: usable up to 15 min, dropped (and removed) after', () => {
  const { store, st, clock } = mk();
  assert.equal(store.write('/api/me', { success: true, employee: { id: 'emp-1' } }), true);
  assert.deepEqual(store.read('/api/me').data, { success: true, employee: { id: 'emp-1' } });
  clock.t += P.PERSIST_MAX_AGE_MS;
  assert.ok(store.read('/api/me'), 'exactly at the limit is still ok');
  clock.t += 1;
  assert.equal(store.read('/api/me'), null);
  assert.equal(st.length, 0, 'expired entry removed');
});

test('a different signed-in user never reads another user\'s entry (and it is removed)', () => {
  const { store, st, ctx } = mk('emp-A');
  store.write('/api/settings', [{ key: 'k', value: 'v' }]);
  store.write('/api/me', { employee: { id: 'emp-A' } });
  ctx.uid = 'emp-B';
  assert.equal(store.read('/api/me'), null);
  assert.equal(store.read('/api/settings'), null);
  assert.equal(st.length, 0);
});

test('not signed in (empty marker): nothing is read or written', () => {
  const { store, st, ctx } = mk('emp-A');
  store.write('/api/me', { a: 1 });
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
  st.setItem(P.persistKey('/api/me'), JSON.stringify({ v: 2, uid: 'emp-1', time: 1_000_000, data: {} }));
  assert.equal(store.read('/api/me'), null);
  st.setItem(P.persistKey('/api/me'), JSON.stringify({ v: 1, uid: 'emp-1', time: 'x', data: {} }));
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
  const c = [{ v: 'z'.repeat(190 * 1000) }];
  assert.equal(store.write('/api/settings', a), true);
  assert.equal(store.write('/api/settings/labels', b), true);
  assert.equal(store.write('/api/me', c), true);
  assert.ok(st.length <= 2, 'over the 400K total: older ones evicted');
  assert.ok(store.read('/api/me'), 'the newest write survives');
});

test('storage that throws (private mode / quota) never throws out: no persistence, no crash', () => {
  const { store, st } = mk();
  st.throwOn = 'set';
  assert.equal(store.write('/api/me', { a: 1 }), false);
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
  for (const u of P.PERSIST_URLS) store.write(u, { u });
  store.removePrefixes(['/api/me']);
  assert.equal(store.read('/api/me'), null);
  assert.equal(store.read('/api/me/design-prefs'), null);
  assert.ok(store.read('/api/settings') && store.read('/api/settings/labels'));
  store.removePrefixes('/api/settings');
  assert.equal(store.read('/api/settings'), null);
  assert.equal(store.read('/api/settings/labels'), null, 'labels is under /api/settings');
  store.write('/api/me', {});
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
// A fresh module instance per scenario (query-string cache bust) with a fake browser environment.
let seq = 0;
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
    const r = responses[u] ?? { status: 200, body: { url: u, n: calls.length } };
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
  };
  const mod = await import(pathToFileURL(process.env.PROJ + '/lib/apiCache.js').href + `?t=${++seq}`);
  return { mod, calls, storage, win };
}
const settle = () => new Promise((r) => setTimeout(r, 5));

test('opt-in persist: first load fetches + stores; a reload (fresh module, same tab storage) within 60s makes NO network call', async () => {
  const storage = new FakeStorage();
  let env = await loadCache({ storage });
  const a = await env.mod.fetchSharedJson('/api/settings', { ttl: env.mod.TTL.STATIC, persist: true });
  assert.equal(env.calls.length, 1);
  assert.ok(storage.getItem(P.persistKey('/api/settings')), 'stored');
  // "full page reload": brand-new module state, same sessionStorage
  env = await loadCache({ storage });
  const b = await env.mod.fetchSharedJson('/api/settings', { ttl: env.mod.TTL.STATIC, persist: true });
  assert.deepEqual(b, a);
  await settle();
  assert.equal(env.calls.length, 0, 'zero requests on a reload within 60s');
});

test('without persist:true nothing is stored and nothing is read (opt-in per call site)', async () => {
  const storage = new FakeStorage();
  const env = await loadCache({ storage });
  await env.mod.fetchSharedJson('/api/settings', { ttl: env.mod.TTL.STATIC });
  assert.equal(storage.length, 0);
});

test('a non-allow-listed URL with persist:true is just a normal in-memory fetch', async () => {
  const storage = new FakeStorage();
  const env = await loadCache({ storage });
  await env.mod.fetchSharedJson('/api/orders?x=1', { ttl: env.mod.TTL.LIST, persist: true });
  assert.equal(storage.length, 0);
});

test('stored entry older than 60s but younger than 15 min: shown instantly AND refreshed in the background', async () => {
  const storage = new FakeStorage();
  let env = await loadCache({ storage });
  await env.mod.fetchSharedJson('/api/me', { ttl: env.mod.TTL.STATIC, persist: true });
  const key = P.persistKey('/api/me');
  const e = JSON.parse(storage.getItem(key));
  e.time -= 5 * 60 * 1000; // 5 minutes old
  storage.setItem(key, JSON.stringify(e));
  env = await loadCache({ storage });
  const t0 = env.calls.length;
  const data = await env.mod.fetchSharedJson('/api/me', { ttl: env.mod.TTL.STATIC, persist: true });
  assert.equal(data.url, '/api/me', 'served from storage immediately');
  await settle();
  assert.equal(env.calls.length - t0, 1, 'one background revalidation');
  assert.ok(JSON.parse(storage.getItem(key)).time > e.time, 'storage refreshed');
});

test('a stored entry between 60s and the caller ttl (5 min) is NOT trusted blindly: it is revalidated (hydrated entries use min(ttl, 60s))', async () => {
  const storage = new FakeStorage();
  let env = await loadCache({ storage });
  await env.mod.fetchSharedJson('/api/settings/labels', { ttl: env.mod.TTL.STATIC, persist: true });
  const key = P.persistKey('/api/settings/labels');
  const e = JSON.parse(storage.getItem(key));
  e.time -= 90 * 1000;
  storage.setItem(key, JSON.stringify(e));
  env = await loadCache({ storage });
  await env.mod.fetchSharedJson('/api/settings/labels', { ttl: env.mod.TTL.STATIC, persist: true });
  await settle();
  assert.equal(env.calls.length, 1);
});

test('older than 15 min: ignored, normal blocking fetch', async () => {
  const storage = new FakeStorage();
  let env = await loadCache({ storage });
  await env.mod.fetchSharedJson('/api/me', { ttl: env.mod.TTL.STATIC, persist: true });
  const key = P.persistKey('/api/me');
  const e = JSON.parse(storage.getItem(key));
  e.time -= 16 * 60 * 1000;
  storage.setItem(key, JSON.stringify(e));
  env = await loadCache({ storage });
  await env.mod.fetchSharedJson('/api/me', { ttl: env.mod.TTL.STATIC, persist: true });
  assert.equal(env.calls.length, 1);
});

test('different employee in the same tab: stored data of the other user is never used', async () => {
  const storage = new FakeStorage();
  let env = await loadCache({ storage, uid: 'emp-A', responses: { '/api/me': { status: 200, body: { employee: { id: 'emp-A' } } } } });
  await env.mod.fetchSharedJson('/api/me', { ttl: env.mod.TTL.STATIC, persist: true });
  env = await loadCache({ storage, uid: 'emp-B', responses: { '/api/me': { status: 200, body: { employee: { id: 'emp-B' } } } } });
  const d = await env.mod.fetchSharedJson('/api/me', { ttl: env.mod.TTL.STATIC, persist: true });
  assert.equal(d.employee.id, 'emp-B');
  assert.equal(env.calls.length, 1);
});

test('not signed in at module load (no marker): any leftovers in the tab are flushed', async () => {
  const storage = new FakeStorage();
  let env = await loadCache({ storage, uid: 'emp-A' });
  await env.mod.fetchSharedJson('/api/me', { ttl: env.mod.TTL.STATIC, persist: true });
  assert.equal(storage.length, 1);
  await loadCache({ storage, uid: '' }); // login page after a logout
  assert.equal(storage.length, 0);
});

test('login/logout POST flushes the stored boot data; a settings save drops settings+labels but keeps /api/me', async () => {
  const storage = new FakeStorage();
  let env = await loadCache({ storage });
  for (const u of P.PERSIST_URLS) await env.mod.fetchSharedJson(u, { ttl: env.mod.TTL.STATIC, persist: true });
  assert.equal(storage.length, 4);
  await env.win.fetch('/api/settings', { method: 'POST', body: '[]' }); // goes through the apiCache mutation interceptor
  assert.equal(storage.getItem(P.persistKey('/api/settings')), null);
  assert.equal(storage.getItem(P.persistKey('/api/settings/labels')), null);
  assert.ok(storage.getItem(P.persistKey('/api/me')));
  await env.win.fetch('/api/login', { method: 'POST', body: '{}' });
  assert.equal(storage.length, 0, 'login flushes everything');
});

test('a change that touches /api/me (attendance clock-in/out, profile edit, design prefs PUT) drops the stored /api/me and design-prefs', async () => {
  const storage = new FakeStorage();
  let env = await loadCache({ storage });
  for (const u of P.PERSIST_URLS) await env.mod.fetchSharedJson(u, { ttl: env.mod.TTL.STATIC, persist: true });
  await env.win.fetch('/api/attendance', { method: 'POST', body: '{}' });
  assert.equal(storage.getItem(P.persistKey('/api/me')), null);
  assert.equal(storage.getItem(P.persistKey('/api/me/design-prefs')), null, '/api/me prefix covers design-prefs');
  assert.ok(storage.getItem(P.persistKey('/api/settings')));
});

test('a 401 (signed out) removes the stored copy', async () => {
  const storage = new FakeStorage();
  let env = await loadCache({ storage });
  await env.mod.fetchSharedJson('/api/me', { ttl: env.mod.TTL.STATIC, persist: true });
  assert.equal(storage.length, 1);
  env = await loadCache({ storage, responses: { '/api/me': { status: 401, body: { success: false } } } });
  const key = P.persistKey('/api/me');
  const e = JSON.parse(storage.getItem(key)); e.time -= 5 * 60 * 1000; storage.setItem(key, JSON.stringify(e));
  env = await loadCache({ storage, responses: { '/api/me': { status: 401, body: { success: false } } } });
  await env.mod.fetchSharedJson('/api/me', { ttl: env.mod.TTL.STATIC, persist: true }); // stale shown, bg revalidate -> 401
  await settle();
  assert.equal(storage.length, 0);
});

test('sessionStorage that throws: the cache keeps working in memory (no crash, normal fetch)', async () => {
  const storage = new FakeStorage();
  storage.throwOn = 'get';
  const env = await loadCache({ storage });
  const d = await env.mod.fetchSharedJson('/api/settings', { ttl: env.mod.TTL.STATIC, persist: true });
  assert.equal(d.url, '/api/settings');
  storage.throwOn = 'set';
  const d2 = await env.mod.fetchSharedJson('/api/me', { ttl: env.mod.TTL.STATIC, persist: true });
  assert.equal(d2.url, '/api/me');
});

test('readPersistedFresh / writePersisted (used by DesignPrefsSync, which needs response headers)', async () => {
  const storage = new FakeStorage();
  const env = await loadCache({ storage });
  assert.equal(env.mod.readPersistedFresh('/api/me/design-prefs'), undefined);
  assert.equal(env.mod.writePersisted('/api/me/design-prefs', { success: true, prefs: { mode: 'dark' } }), true);
  assert.deepEqual(env.mod.readPersistedFresh('/api/me/design-prefs'), { success: true, prefs: { mode: 'dark' } });
  assert.equal(env.mod.readPersistedFresh('/api/me/design-prefs', -1), undefined, 'older than the requested max age -> undefined');
  assert.equal(env.mod.writePersisted('/api/orders', {}), false);
});

test('window focus: persisted boot keys revalidate after 3 min, other keys after 60s (only keys with subscribers)', async () => {
  const storage = new FakeStorage();
  const env = await loadCache({ storage });
  const noop = () => {};
  env.mod.subscribe('/api/me', noop);
  env.mod.subscribe('/api/dresses/models', noop);
  await env.mod.fetchSharedJson('/api/me', { ttl: env.mod.TTL.STATIC, persist: true });
  await env.mod.fetchSharedJson('/api/dresses/models', { ttl: env.mod.TTL.REFERENCE });
  const base = env.calls.length;
  const realNow = Date.now;
  const t0 = realNow();
  try {
    Date.now = () => t0 + 90 * 1000;
    env.win.__listeners.focus();
    await settle();
    const urls90 = env.calls.slice(base).map((c) => c.url);
    assert.deepEqual(urls90, ['/api/dresses/models'], 'after 90s only the non-boot key refreshes');
    Date.now = () => t0 + 4 * 60 * 1000;
    env.win.__listeners.focus();
    await settle();
    assert.ok(env.calls.slice(base).some((c) => c.url === '/api/me'), 'after 4 min the boot key refreshes too');
  } finally { Date.now = realNow; }
});
