// בדיקת ה-interceptor של /api/* שב-app/layout.js כפי שהוא *מרונדר* לדפדפן: מחלצים את ה-template string, מעריכים אותו
// (כך שמטופלים escapes של template literal - הבאג של PR #188 היה "\/" שקרס ל-"/" ושבר את הביטוי בשקט), מריצים אותו
// ב-node:vm עם fetch מדומה, ובודקים מה נכנס לתור של /api/log-visit. כן בודקת שוויון מול lib/redactSensitive.js (השרת).
// לא נוגעת ב-DB וברשת. הרצה: node scripts/test_visitlog_interceptor_rendered.mjs   (קוד יציאה 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { redactRequestQuery, redactUrl, REDACTED } from '../lib/redactSensitive.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const layoutSrc = fs.readFileSync(path.join(here, '..', 'app', 'layout.js'), 'utf8').replace(/\r\n/g, '\n');

let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

// --- extract + render the template literal --------------------------------------------------------------------
const marker = layoutSrc.indexOf('window.__apiInterceptorInstalled = true');
assert.ok(marker > 0, 'interceptor marker not found in app/layout.js');
const open = layoutSrc.lastIndexOf('__html: `', marker);
const close = layoutSrc.indexOf('\n`\n', marker);
assert.ok(open > 0 && close > marker, 'could not delimit the interceptor template literal');
const rawTemplate = layoutSrc.slice(open + '__html: `'.length, close + 1);
assert.ok(!rawTemplate.includes('${'), 'the interceptor template must stay free of interpolation');
// מעריכים ממש כמו JS: template literal מעבד escapes. אם מישהו יכתוב "\/" כאן - התוצאה תשתנה והבדיקות למטה ייכשלו.
const rendered = vm.runInNewContext('`' + rawTemplate + '`');

// --- sandbox ---------------------------------------------------------------------------------------------------
function makeEnv(origin = 'https://gemach.test') {
  const queue = [];
  const events = [];
  const win = {
    location: { origin, pathname: '/orders' },
    addEventListener() {}, dispatchEvent(e) { events.push(e); return true; },
  };
  const calls = [];
  win.fetch = async (...args) => {
    calls.push(args);
    return { headers: { get: (h) => (h === 'content-length' ? '123' : null) }, json: async () => ({}), text: async () => '' };
  };
  const ctx = {
    window: win, document: { addEventListener() {}, visibilityState: 'visible' }, navigator: {},
    performance: { now: () => 0 }, URL, URLSearchParams, Blob, JSON, Array, Object, String, Math, parseInt, isNaN,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    setTimeout: () => 0, clearTimeout() {}, console,
  };
  vm.createContext(ctx);
  vm.runInContext(rendered, ctx);
  // מחליפים את התור בצופה (בלי טיימרים): כל קריאה ל-__queueVisitLog נרשמת
  win.__queueVisitLog = (entry) => queue.push(entry);
  return { win, queue, events, calls, fetch: win.fetch };
}
const call = async (env, url, body) => {
  await env.fetch(url, body === undefined ? undefined : { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
  return env.queue.at(-1);
};

await t('the rendered script is valid JS and installs the interceptor', () => {
  const env = makeEnv();
  assert.equal(env.win.__apiInterceptorInstalled, true);
  assert.notEqual(env.fetch, undefined);
});

await t('regex survives the template literal: no backslash-slash collapse, auth regex matches exactly like the server', () => {
  const m = rendered.match(/var AUTH_EP = (\/.*\/i);/);
  assert.ok(m, 'AUTH_EP definition not found in the rendered script');
  const re = vm.runInNewContext(m[1]);
  for (const p of ['/api/login', '/api/logout', '/api/auth/verify-pin', '/api/attendance', '/api/employees/9/reset-password', '/api/history', '/api/logs']) assert.ok(re.test(p), p);
  for (const p of ['/api/orders', '/api/customers', '/api/loginx', '/api/attendance-sheet']) assert.ok(!re.test(p), p);
});

await t('/api/anything IS still logged (the PR #188 bug silently logged nothing)', async () => {
  const env = makeEnv();
  const e1 = await call(env, '/api/orders', { orderId: 5, status: 'open' });
  assert.ok(e1, 'entry not queued for /api/orders');
  assert.equal(e1.pageUrl, '/api/orders');
  assert.deepEqual(JSON.parse(e1.requestQuery), { orderId: 5, status: 'open' });
  const e2 = await call(env, '/api/dresses/12/anything');
  assert.ok(e2 && e2.pageUrl === '/api/dresses/12/anything');
  const e3 = await call(env, '/api/customers?search=abc&page=2');
  assert.equal(e3.requestQuery, '?search=abc&page=2');
  assert.equal(env.queue.length, 3);
});

await t('pin / password / zeout / iban / card fields are masked', async () => {
  const env = makeEnv();
  const e = await call(env, '/api/orders/5/debt-approval', {
    approverPin: '4321', managerPin: '1111', password: 'hunter2', zeout: '123456789', idNumber: '987654321',
    iban: 'IL620108000000099999999', bankAccount: '1234', cardNumber: '4580458045804580', cvv: '123', amount: 50, nested: { token: 'abc', ok: 1 },
  });
  const q = JSON.parse(e.requestQuery);
  for (const k of ['approverPin', 'managerPin', 'password', 'zeout', 'idNumber', 'iban', 'bankAccount', 'cardNumber', 'cvv']) assert.equal(q[k], REDACTED, k);
  assert.equal(q.amount, 50);
  assert.deepEqual(q.nested, { token: REDACTED, ok: 1 });
  for (const secret of ['4321', 'hunter2', '123456789', '987654321', 'IL62', '4580458045804580']) assert.ok(!e.requestQuery.includes(secret), secret);
});

await t('base64 attachments / data URIs are dropped', async () => {
  const env = makeEnv();
  const b64 = 'QUJD'.repeat(2000);
  const e = await call(env, '/api/email/send', { to: 'a@b.c', attachments: [{ filename: 'a.pdf', content: b64 }], logo: 'data:image/png;base64,' + 'A'.repeat(100), fileContent: b64 });
  assert.ok(!e.requestQuery.includes('QUJD') && !e.requestQuery.includes('AAAAAAAA'));
  assert.ok(e.requestQuery.includes('a.pdf'));
});

await t('auth endpoints: nothing of the body (or secret query string) is logged', async () => {
  const env = makeEnv();
  for (const u of ['/api/login', '/api/auth/verify-pin', '/api/attendance', '/api/employees/7/reset-password', '/api/employees/7/set-password', '/api/auth/api-key-login']) {
    const e = await call(env, u, { password: 'hunter2', pin: '1234', username: 'moshe' });
    assert.ok(e, u);
    assert.ok(!e.requestQuery, u + ' requestQuery=' + e.requestQuery);
    assert.ok(!JSON.stringify(e).includes('hunter2') && !JSON.stringify(e).includes('1234'), u);
  }
  const g = await call(env, '/api/attendance?code=4455');
  assert.equal(g.pageUrl, '/api/attendance');
  assert.ok(!g.requestQuery);
  // גם האירוע ל-UI לא נושא את הגוף
  assert.ok(env.events.every((ev) => !JSON.stringify(ev.detail).includes('hunter2')));
});

await t('/api/logs (UI error alert text) is not stored in the visit log body', async () => {
  const env = makeEnv();
  const e = await call(env, '/api/logs', { action: 'UI_ERROR_ALERT', error: 'שגיאה בשמירת הזמנה של שרה כהן', url: 'https://x/orders?search=שרה' });
  assert.ok(!e.requestQuery);
});

await t('GET with sensitive query params: masked in pageUrl and requestQuery', async () => {
  const env = makeEnv();
  const e = await call(env, '/api/orders?page=2&pin=1234&zeout=111');
  assert.ok(!e.pageUrl.includes('1234') && !e.pageUrl.includes('=111'), e.pageUrl);
  assert.ok(!e.requestQuery.includes('1234') && !e.requestQuery.includes('=111'), e.requestQuery);
  assert.ok(e.pageUrl.includes('page=2'));
});

await t('truncated/invalid JSON mentioning a secret is dropped; plain invalid JSON is kept', async () => {
  const env = makeEnv();
  assert.ok(!(await call(env, '/api/x', '{"pin":"12')).requestQuery);
  assert.equal((await call(env, '/api/x', '{"a":"b')).requestQuery, '{"a":"b');
});

await t('light=1 / log-visit / queries-by-path calls are still not logged (existing behavior)', async () => {
  const env = makeEnv();
  await env.fetch('/api/notifications?light=1');
  await env.fetch('/api/log-visit', { method: 'POST', body: '{}' });
  await env.fetch('/api/queries-by-path?path=/x');
  assert.equal(env.queue.length, 0);
});

await t('differential: rendered client sanitizer == lib/redactSensitive on a corpus', async () => {
  const env = makeEnv();
  const bodies = [
    { orderId: 1, pin: '1', a: { zeout: 'z', b: [{ cardNumber: '4', x: 1 }, 'str'] } },
    { notes: 'xx '.repeat(700), amount: 3 },
    { image: 'QUJD'.repeat(300), name: 'n' },
    { image: 'data:image/png;base64,' + 'A'.repeat(40) },
    [{ managerPin: '1' }, { ok: true }, 5, null],
    { cardVariant: 'v2', cardNumber: '1', bankName: 'b', ibanX: 'q', accountNumber: '5', code: '7', barcode: '555' },
    '?orderId=5&pin=1234', 'orderId=5&password=abc&page=2', '?a=1&b=2', 'plain note', '1234', '"123456789"', 'my password',
    '{"orderId":1,"pin":"12', '{"a":"b', 'data:image/png;base64,AAAA', 'QUJD'.repeat(100) + '==',
    { deep: { a: { b: { c: { d: { e: { f: { pin: '9999' } } } } } } } },
  ];
  const urls = ['/api/orders', '/api/customers/5', '/api/dresses', '/api/x/y'];
  for (const b of bodies) {
    for (const u of urls) {
      const text = typeof b === 'string' ? b : JSON.stringify(b);
      const entry = await call(env, u, text);
      const expected = redactRequestQuery(text, u);
      assert.equal(entry.requestQuery ? entry.requestQuery.slice(0, 4000) : null, expected ? expected.slice(0, 4000) : null, `${u} ${text.slice(0, 60)}`);
    }
  }
  for (const u of ['/api/orders?page=2&pin=1', '/api/x?token=a&b=c', '/api/attendance?code=1', '/api/login?password=p', '/api/orders']) {
    const entry = await call(env, u);
    assert.equal(entry.pageUrl, redactUrl(u), u);
  }
});

console.log(`\n${passed} passed${process.exitCode ? ' (with failures)' : ''}`);
