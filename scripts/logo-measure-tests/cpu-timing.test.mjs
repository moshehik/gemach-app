// lib/cpuTiming.js + lib/bootInfo.js - בלי DB ובלי שרת.
//   node --import ./scripts/logo-measure-tests/register.mjs --test scripts/logo-measure-tests/cpu-timing.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const CT = await L('lib/cpuTiming.js');
const BI = await L('lib/bootInfo.js');

const burn = (ms) => { const end = process.cpuUsage(); const t0 = performance.now(); let x = 0; while (performance.now() - t0 < ms) x += Math.sqrt(x + 1); return x + end.user * 0; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const json = (o) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json' } });

test('handler שצורך CPU: x-cpu-ms גבוה, Server-Timing, x-boot-id', async () => {
  const h = CT.withCpuTiming(async () => { burn(60); return json({ ok: true }); });
  const res = await h(new Request('http://x/api/a'));
  const cpu = parseFloat(res.headers.get('x-cpu-ms'));
  assert.ok(cpu >= 40 && cpu < 400, `cpu=${cpu}`);
  assert.match(res.headers.get('server-timing'), /^cpu;dur=[\d.]+, wall;dur=[\d.]+$/);
  assert.equal(res.headers.get('x-boot-id'), BI.getBootId());
  assert.equal(res.headers.get('x-cpu-conc'), '1');
  assert.deepEqual(await res.json(), { ok: true }, 'body untouched');
});

test('handler שמחכה (I/O): wall גבוה, CPU נמוך', async () => {
  const h = CT.withCpuTiming(async () => { await sleep(80); return json({}); });
  const res = await h(new Request('http://x/api/b'));
  const wall = parseFloat(/wall;dur=([\d.]+)/.exec(res.headers.get('server-timing'))[1]);
  assert.ok(wall >= 70, `wall=${wall}`);
  assert.ok(parseFloat(res.headers.get('x-cpu-ms')) < 25, `cpu=${res.headers.get('x-cpu-ms')}`);
});

test('מקביליות: ה-CPU מתחלק בין הבקשות הפעילות (הסכום = ה-CPU האמיתי, לא כפול), ו-conc=2', async () => {
  const busy = CT.withCpuTiming(async () => { await sleep(5); burn(80); return json({}); });
  const idle = CT.withCpuTiming(async () => { await sleep(150); return json({}); });
  const u0 = process.cpuUsage();
  const [rb, ri] = await Promise.all([busy(new Request('http://x/1')), idle(new Request('http://x/2'))]);
  const cb = parseFloat(rb.headers.get('x-cpu-ms')); const ci = parseFloat(ri.headers.get('x-cpu-ms'));
  assert.equal(rb.headers.get('x-cpu-conc'), '2');
  assert.equal(ri.headers.get('x-cpu-conc'), '2');
  assert.ok(cb + ci >= 60, `sum ${cb + ci} should cover the ~80ms burned`);
  const u = process.cpuUsage(u0); const proc = (u.user + u.system) / 1000;
  assert.ok(cb + ci <= proc + 3, `sum ${cb + ci} must not exceed the process CPU ${proc} (no double counting; naive per-request deltas would give ~2x)`);
});

test('חריגה עוברת הלאה ולא משאירה בקשה "פעילה"', async () => {
  const h = CT.withCpuTiming(async () => { throw new Error('boom'); });
  await assert.rejects(() => h(new Request('http://x/c')), /boom/);
  assert.equal(globalThis.__gemachCpuAcct.active.size, 0);
});

test('Response עם כותרות immutable (כמו מ-fetch/Response.redirect) לא נשבר', async () => {
  const h = CT.withCpuTiming(async () => Response.redirect('http://x/y', 302));
  const res = await h(new Request('http://x/d'));
  assert.equal(res.status, 302);
  assert.ok(res.headers.get('x-cpu-ms') !== null);
  assert.equal(res.headers.get('location'), 'http://x/y');
});

test('החזרה שאינה Response (undefined) לא נופלת; CPU_TIMING=off מדלג', async () => {
  const h = CT.withCpuTiming(async () => undefined);
  assert.equal(await h(new Request('http://x/e')), undefined);
  process.env.CPU_TIMING = 'off';
  try {
    const off = CT.withCpuTiming(async () => json({ a: 1 }));
    const res = await off(new Request('http://x/f'));
    assert.equal(res.headers.get('x-cpu-ms'), null);
  } finally { delete process.env.CPU_TIMING; }
});

test('מעביר את כל הארגומנטים (request, ctx) ל-handler', async () => {
  let seen;
  const h = CT.withCpuTiming(async (req, ctx) => { seen = [req.url, ctx.params.id]; return json({}); });
  await h(new Request('http://x/g'), { params: { id: '7' } });
  assert.deepEqual(seen, ['http://x/g', '7']);
  assert.throws(() => CT.withCpuTiming(null), TypeError);
});

test('bootInfo: bootId יציב בתהליך, חדש אחרי reset, ומשותף דרך globalThis', () => {
  const a = BI.getBootId();
  assert.match(a, /^[0-9a-f]{12}$/);
  assert.equal(BI.getBootId(), a);
  const info = BI.getBootInfo();
  assert.equal(info.bootId, a);
  assert.ok(info.bootAt && info.uptimeSec >= 0 && info.requestsSinceBoot >= 1);
  BI.__resetBootInfoForTests();
  assert.notEqual(BI.getBootId(), a);
});
