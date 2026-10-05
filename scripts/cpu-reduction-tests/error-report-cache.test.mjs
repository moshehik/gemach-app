// Error-report panel list (GET /api/error-report, non-light): 60s shared client cache (lib/apiCache.js fetchFreshJson), dropped by the
// user's own writes (the mutation interceptor) - while the light poll URL is untouched.
//   node --no-warnings --import ./scripts/cpu-reduction-tests/register.mjs --test scripts/cpu-reduction-tests/error-report-cache.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

let seq = 0;
async function load(responses = {}) {
  const calls = [];
  const w = globalThis;
  w.window = w;
  w.document = { documentElement: { getAttribute: () => 'emp-1' } };
  const store = new Map();
  w.sessionStorage = { get length() { return store.size; }, key: (i) => [...store.keys()][i] ?? null, getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  w.addEventListener = () => {};
  w.location = { origin: 'http://test.local' };
  delete w.__apiCacheInvalidatorInstalled;
  w.fetch = async (url, init = {}) => {
    const u = String(url);
    calls.push({ url: u, method: (init.method || 'GET').toUpperCase() });
    const r = responses[u] ?? { status: 200, body: { success: true, reports: [{ id: calls.length }] } };
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
  };
  const mod = await import(pathToFileURL(process.env.PROJ + '/lib/apiCache.js').href + `?er=${++seq}`);
  return { mod, calls, w };
}
const URL_FULL = '/api/error-report';

test('opening the window again within 60s makes no request; after 60s it refetches (blocking, never a stale list)', async () => {
  const { mod, calls } = await load();
  const realNow = Date.now; const t0 = realNow(); let t = t0; Date.now = () => t;
  try {
    const a = await mod.fetchFreshJson(URL_FULL, { maxAge: 60_000 });
    t += 30_000;
    const b = await mod.fetchFreshJson(URL_FULL, { maxAge: 60_000 });
    assert.equal(calls.length, 1);
    assert.deepEqual(b, a);
    t += 31_000;
    const c = await mod.fetchFreshJson(URL_FULL, { maxAge: 60_000 });
    assert.equal(calls.length, 2, 'older than 60s -> network');
    assert.notDeepEqual(c, a, 'the new answer is returned, not the stale one');
  } finally { Date.now = realNow; }
});

test('concurrent opens share one request', async () => {
  const { mod, calls } = await load();
  await Promise.all([mod.fetchFreshJson(URL_FULL), mod.fetchFreshJson(URL_FULL), mod.fetchFreshJson(URL_FULL)]);
  assert.equal(calls.length, 1);
});

test("the user's own writes (POST send, PUT/PATCH archive+read, POST reply, POST sketch-decision) drop the cached list", async () => {
  for (const [method, path] of [['POST', '/api/error-report'], ['PUT', '/api/error-report'], ['PATCH', '/api/error-report'], ['DELETE', '/api/error-report'], ['POST', '/api/error-report/reply'], ['POST', '/api/error-report/sketch-decision']]) {
    const { mod, calls, w } = await load();
    await mod.fetchFreshJson(URL_FULL);
    await w.fetch(path, { method, body: '{}' });
    const before = calls.length;
    await mod.fetchFreshJson(URL_FULL);
    assert.equal(calls.length, before + 1, `${method} ${path} -> refetch`);
  }
});

test('a failed write (non-2xx) does not drop the list', async () => {
  const { mod, calls, w } = await load({ '/api/error-report/reply': { status: 500, body: {} } });
  await mod.fetchFreshJson(URL_FULL);
  await w.fetch('/api/error-report/reply', { method: 'POST', body: '{}' });
  const before = calls.length;
  await mod.fetchFreshJson(URL_FULL);
  assert.equal(calls.length, before);
});

test('an error-report write does NOT flush other caches (it stays in MUTATION_SKIP for orders/dresses/...)', async () => {
  const { mod, calls, w } = await load();
  await mod.fetchSharedJson('/api/orders?x=1', { ttl: mod.TTL.LIST });
  await mod.fetchSharedJson('/api/dresses/models', { ttl: mod.TTL.REFERENCE });
  await w.fetch('/api/error-report', { method: 'POST', body: '{}' });
  const before = calls.length;
  await mod.fetchSharedJson('/api/orders?x=1', { ttl: mod.TTL.LIST });
  await mod.fetchSharedJson('/api/dresses/models', { ttl: mod.TTL.REFERENCE });
  assert.equal(calls.length, before, 'orders/dresses still cached');
  assert.equal(mod.isMutationSkipped('/api/error-report'), true);
});

test('a 401 rejects with "HTTP 401" (the window stops asking) and is not cached', async () => {
  const { mod, calls } = await load({ [URL_FULL]: { status: 401, body: { success: false } } });
  await assert.rejects(() => mod.fetchFreshJson(URL_FULL), /HTTP 401/);
  await assert.rejects(() => mod.fetchFreshJson(URL_FULL), /HTTP 401/);
  assert.equal(calls.length, 2, 'errors are not cached');
});

test('the light poll URL is a different key and is never served by the list cache', async () => {
  const { mod, calls } = await load();
  await mod.fetchFreshJson(URL_FULL);
  assert.equal(mod.readCache('/api/error-report?light=1'), undefined);
  await mod.invalidate('/api/error-report'); // prefix drop (what the light poll does on an unread-count change)
  await mod.fetchFreshJson(URL_FULL);
  assert.equal(calls.length, 2);
});
