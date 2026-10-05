// Server-side PDF (POST /api/pdf -> lib/pdf.js -> lib/pdfServerless.js): guards for the 2026-10-05 fix. Everything here is static / pure / fake-puppeteer -
// it can NOT prove Chromium starts on Vercel (that needs a preview deploy: docs/server-pdf-verification-2026-10-05.md); it keeps the pieces that make it
// possible from being removed or drifting (tracing include for every route that renders PDFs, externals, the fallback, the detail plumbing).
// Run:  node --import ./scripts/order-card-tests/register.mjs --test scripts/pdf-tests/server-pdf.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const L = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel, out); else if (/\.(js|mjs)$/.test(e.name)) out.push(rel);
  }
  return out;
};

// ---------- config: the Chromium binary must be in the function ----------
test('next.config: externals + bin tracing for EVERY route that renders a PDF', async () => {
  const cfg = (await L('next.config.mjs')).default;
  assert.ok(cfg.serverExternalPackages.includes('@sparticuz/chromium'), '@sparticuz/chromium must be external (it locates bin/ relative to its own file)');
  assert.ok(cfg.serverExternalPackages.includes('puppeteer-core'));
  // every API route that imports lib/pdf (renderPdf) needs the include, or its function ships without bin/*.br
  const routes = walk('app/api').filter((f) => f.endsWith('/route.js') && /from\s+['"][^'"]*lib\/pdf['"]/.test(read(f)));
  assert.ok(routes.includes('app/api/pdf/route.js'), 'sanity: /api/pdf uses lib/pdf');
  for (const f of routes) {
    const key = '/' + f.replace(/^app\//, '').replace(/\/route\.js$/, '');
    const inc = cfg.outputFileTracingIncludes && cfg.outputFileTracingIncludes[key];
    assert.ok(inc && inc.some((g) => /node_modules\/@sparticuz\/chromium\/bin\/\*\*/.test(g)), `outputFileTracingIncludes["${key}"] must include @sparticuz/chromium/bin/**`);
  }
});

test('package.json: webpack build, Node range that Vercel resolves to a runtime the Chromium pack supports', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts.build, /next build --webpack/);
  assert.match(pkg.dependencies['@sparticuz/chromium'], /^\^?149\./);
  assert.ok(pkg.dependencies['puppeteer-core']);
  assert.match(pkg.engines.node, />=24|24/);
});

test('installed @sparticuz/chromium ships the four archives the launcher extracts (skipped without node_modules)', { skip: !fs.existsSync(path.join(ROOT, 'node_modules/@sparticuz/chromium/bin')) }, () => {
  for (const f of ['chromium.br', 'fonts.tar.br', 'swiftshader.tar.br', 'al2023.tar.br']) {
    assert.ok(fs.existsSync(path.join(ROOT, 'node_modules/@sparticuz/chromium/bin', f)), f);
  }
});

// ---------- lib/pdfServerless.js: pure helpers ----------
test('compactMessage: one line, no puppeteer boilerplate, capped', async () => {
  const { compactMessage } = await L('lib/pdfServerless.js');
  const raw = 'Failed to launch the browser process:  Code: 127\n\nstderr:\n\n\nTROUBLESHOOTING: https://pptr.dev/troubleshooting\n';
  assert.equal(compactMessage(raw), 'Failed to launch the browser process: Code: 127 stderr:');
  assert.equal(compactMessage('x'.repeat(500), 50).length, 50);
  assert.equal(compactMessage(null), '');
});

test('buildChromiumEnv: shared-lib dir first in LD_LIBRARY_PATH (deduped), fontconfig + a writable HOME', async () => {
  const { buildChromiumEnv } = await L('lib/pdfServerless.js');
  const lib = path.join('/tmp', 'al2023', 'lib');
  const e = buildChromiumEnv({ LD_LIBRARY_PATH: `/var/lang/lib:/lib64:${lib}`, HOME: '/home/ro', X: '1' }, { tmp: '/tmp', homeWritable: false });
  assert.equal(e.LD_LIBRARY_PATH, `${lib}:/var/lang/lib:/lib64`);
  assert.equal(e.FONTCONFIG_PATH, path.join('/tmp', 'fonts'));
  assert.equal(e.HOME, '/tmp', 'a read-only HOME is replaced');
  assert.equal(e.X, '1');
  const e2 = buildChromiumEnv({ HOME: '/home/ok', FONTCONFIG_PATH: '/f' }, { tmp: '/tmp', homeWritable: true });
  assert.equal(e2.HOME, '/home/ok');
  assert.equal(e2.FONTCONFIG_PATH, '/f');
  assert.equal(e2.LD_LIBRARY_PATH, lib);
  assert.equal(buildChromiumEnv({}, { tmp: '/tmp' }).HOME, '/tmp', 'missing HOME');
});

test('FALLBACK_ARGS: the minimal Lambda-safe flag set', async () => {
  const { FALLBACK_ARGS } = await L('lib/pdfServerless.js');
  for (const f of ['--no-sandbox', '--single-process', '--no-zygote', '--disable-gpu', '--disable-dev-shm-usage']) assert.ok(FALLBACK_ARGS.includes(f), f);
});

const fakeChromium = (over = {}) => ({
  default: { args: ['--a'], executablePath: async () => path.join(ROOT, 'scratch', 'no-such-chromium-binary'), set setGraphicsMode(v) { over.graphics = v; } },
  inflate: async () => '/tmp/x',
});

test('launchServerlessChromium: first launch fails -> retries once with minimal flags and returns that browser', async () => {
  const { launchServerlessChromium, FALLBACK_ARGS } = await L('lib/pdfServerless.js');
  const seen = []; const flags = {};
  const puppeteer = {
    defaultArgs: async ({ args }) => ['--default', ...args],
    launch: async (o) => { seen.push(o); if (seen.length === 1) throw new Error('Failed to launch the browser process:  Code: 127'); return { fake: 'browser' }; },
  };
  const b = await launchServerlessChromium(puppeteer, { viewport: { width: 1 }, loadChromium: async () => fakeChromium(flags) });
  assert.deepEqual(b, { fake: 'browser' });
  assert.equal(seen.length, 2);
  assert.equal(flags.graphics, false, 'WebGL/swiftshader flags are off for PDFs');
  assert.equal(seen[0].headless, 'shell');
  assert.ok(seen[0].args.includes('--a') && seen[0].args.includes('--disable-dev-shm-usage'));
  assert.deepEqual(seen[1].args, FALLBACK_ARGS);
  assert.ok(seen[0].env.LD_LIBRARY_PATH.includes('al2023'), 'the child gets the shared-lib dir explicitly');
  assert.ok(seen[0].env.HOME);
  assert.equal(seen[0].dumpio, true);
});

test('launchServerlessChromium: both launches fail -> stage "launch" and a detail that says why', async () => {
  const { launchServerlessChromium } = await L('lib/pdfServerless.js');
  const puppeteer = { defaultArgs: async () => [], launch: async () => { throw new Error('Failed to launch the browser process:  Code: 127\n\nstderr:\n\nTROUBLESHOOTING: https://pptr.dev/troubleshooting'); } };
  await assert.rejects(() => launchServerlessChromium(puppeteer, { loadChromium: async () => fakeChromium() }), (e) => {
    assert.equal(e.pdfStage, 'launch');
    assert.match(e.message, /Failed to launch the browser process: Code: 127/);
    assert.match(e.message, /retry\(minimal flags\)/);
    assert.match(e.message, /node=v\d+/);
    assert.match(e.message, /libnss3=/);
    assert.ok(!/TROUBLESHOOTING/.test(e.message));
    assert.ok(e.pdfProbe && typeof e.pdfProbe === 'object');
    return true;
  });
});

test('launchServerlessChromium: import / extraction failures carry their own stage', async () => {
  const { launchServerlessChromium } = await L('lib/pdfServerless.js');
  await assert.rejects(() => launchServerlessChromium({}, { loadChromium: async () => { throw new Error('Cannot find package'); } }), (e) => e.pdfStage === 'import-chromium');
  const mod = fakeChromium(); mod.default.executablePath = async () => { throw new Error('The input directory "/var/task/x" does not exist.'); };
  await assert.rejects(() => launchServerlessChromium({}, { loadChromium: async () => mod }), (e) => e.pdfStage === 'extract-chromium' && /does not exist/.test(e.message));
});

// ---------- route + client: the real reason reaches the screen / the logs ----------
test('app/api/pdf/route.js: 500 keeps {error} first and adds detail + stage; logs one structured line', () => {
  const s = read('app/api/pdf/route.js');
  assert.match(s, /\{ error: 'יצירת ה-PDF נכשלה', detail: message\.slice\(0, MAX_DETAIL_LENGTH\), stage \}/);
  assert.match(s, /console\.error\('\[pdf\] generation failed'/);
  assert.doesNotMatch(s, /detail:[^\n]*err\.stack/, 'no stack in the response');
});

test('pdfClient: server detail is appended (short) to the thrown message; full detail kept on the error', async () => {
  const { shortDetail } = await L('app/lib/pdfClient.js');
  assert.equal(shortDetail('  \nFirst line here\nsecond'), 'First line here');
  assert.equal(shortDetail(undefined), '');
  assert.equal(shortDetail('y'.repeat(400)).length, 160);
  const prev = globalThis.fetch;
  const body = { error: 'יצירת ה-PDF נכשלה', detail: 'Failed to launch the browser process: Code: 127\nmore', stage: 'launch' };
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => body });
  try {
    const { fetchPdfBase64 } = await L('app/lib/pdfClient.js');
    await assert.rejects(() => fetchPdfBase64({ html: '<p>x</p>' }), (e) => {
      assert.equal(e.message, 'יצירת ה-PDF נכשלה (launch: Failed to launch the browser process: Code: 127)');
      assert.equal(e.detail, body.detail);
      assert.equal(e.status, 500);
      return true;
    });
    // a body without detail (older server / other 4xx) keeps the plain message
    globalThis.fetch = async () => ({ ok: false, status: 403, json: async () => ({ error: 'אין הרשאה' }) });
    await assert.rejects(() => fetchPdfBase64({ html: '<p>x</p>' }), (e) => e.message === 'אין הרשאה');
    globalThis.fetch = async () => ({ ok: false, status: 502, json: async () => { throw new Error('not json'); } });
    await assert.rejects(() => fetchPdfBase64({ html: '<p>x</p>' }), (e) => e.message === 'שגיאה ביצירת ה-PDF');
  } finally { globalThis.fetch = prev; }
});

// ---------- A5 order card: server PDF failing falls back to the print page ----------
test('openOrderPrintFallback: opens /print/order in a new tab; reports a blocked popup; rejects bad ids', async () => {
  const { openOrderPrintFallback } = await L('app/components/order-card/parts/ocDocsActions.js');
  const calls = [];
  const r = openOrderPrintFallback({ orderId: 53375, open: (u, t) => { calls.push([u, t]); return {}; } });
  assert.deepEqual(r, { ok: true, path: '/print/order?orderId=53375&type=order' });
  assert.deepEqual(calls, [['/print/order?orderId=53375&type=order', '_blank']]);
  assert.equal(openOrderPrintFallback({ orderId: 5, open: () => null }).ok, false, 'popup blocked');
  assert.equal(openOrderPrintFallback({ orderId: 5, open: () => { throw new Error('x'); } }).ok, false);
  assert.deepEqual(openOrderPrintFallback({ orderId: 'abc', open: () => ({}) }), { ok: false, path: null });
});

test('downloadOrderPdf still rejects when the server PDF fails (the card decides the fallback) and logs nothing', async () => {
  const { downloadOrderPdf } = await L('app/components/order-card/parts/ocDocsActions.js');
  const events = [];
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ success: true, html: '<html></html>' }) });
  const pdf = { downloadPdf: async () => { throw new Error('יצירת ה-PDF נכשלה (launch: boom)'); } };
  await assert.rejects(() => downloadOrderPdf({ oc: { order: { orderId: 7 }, logEvent: async (a) => events.push(a) }, orderId: 7, fetchImpl, pdf }), /boom/);
  assert.deepEqual(events, []);
});

test('OcExports: a failed PDF opens the print page + Hebrew toast; a blocked popup gets a click-to-open action; Excel errors unchanged', () => {
  const s = read('app/components/order-card/parts/OcExports.js');
  assert.match(s, /openOrderPrintFallback\(\{ orderId \}\)/);
  assert.match(s, /הורדת ה-PDF לא זמינה כרגע/);
  assert.match(s, /שמירה כ-PDF/);
  assert.match(s, /action|text: 'פתיחת דף הדפסה'/);
  assert.match(s, /ייצוא ה-Excel נכשל/);
});

test('lib/pdf.js uses the serverless launcher and tags the failing stage', () => {
  const s = read('lib/pdf.js');
  assert.match(s, /launchServerlessChromium/);
  assert.match(s, /pdfStage/);
  assert.doesNotMatch(s, /chromium\.executablePath\(\)/, 'the launch logic lives in lib/pdfServerless.js');
});
