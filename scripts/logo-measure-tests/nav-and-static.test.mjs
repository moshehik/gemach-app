// lib/navMeta.js (סוג ניווט) + בדיקות סטטיות לחיווט של מדידת ה-CPU והלוגו. בלי DB/דפדפן.
//   node --import ./scripts/logo-measure-tests/register.mjs --test scripts/logo-measure-tests/nav-and-static.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ROOT = process.env.PROJ;
const read = (p) => readFileSync(`${ROOT}/${p}`, 'utf8').replace(/\r\n/g, '\n');
const NM = await import(pathToFileURL(`${ROOT}/lib/navMeta.js`).href);

const env = ({ navType, legacy, opener = null, histLen = 3, referrer = 'http://x/a' } = {}) => ({
  performance: {
    getEntriesByType: () => (navType ? [{ type: navType }] : []),
    navigation: legacy === undefined ? undefined : { type: legacy },
  },
  opener, history: { length: histLen }, document: { referrer },
});

test('navMeta: סוג הטעינה של המסמך הראשון', () => {
  assert.equal(NM.createNavTypeTracker(env({ navType: 'reload' }))(), 'reload');
  assert.equal(NM.createNavTypeTracker(env({ navType: 'back_forward' }))(), 'back_forward');
  assert.equal(NM.createNavTypeTracker(env({ navType: 'navigate' }))(), 'navigate');
  assert.equal(NM.createNavTypeTracker(env({ legacy: 1 }))(), 'reload');
  assert.equal(NM.createNavTypeTracker(env({}))(), 'unknown');
});

test('navMeta: לשונית חדשה (opener, או היסטוריה באורך 1 בלי referrer) מקבלת +newtab; רענון לא', () => {
  assert.equal(NM.createNavTypeTracker(env({ navType: 'navigate', opener: {} }))(), 'navigate+newtab');
  assert.equal(NM.createNavTypeTracker(env({ navType: 'navigate', histLen: 1, referrer: '' }))(), 'navigate+newtab');
  assert.equal(NM.createNavTypeTracker(env({ navType: 'navigate', histLen: 1, referrer: 'http://x/' }))(), 'navigate');
  assert.equal(NM.createNavTypeTracker(env({ navType: 'reload', opener: {} }))(), 'reload');
});

test('navMeta: קריאה ראשונה = המסמך, כל הבאות = spa', () => {
  const next = NM.createNavTypeTracker(env({ navType: 'navigate' }));
  assert.equal(next(), 'navigate'); assert.equal(next(), 'spa'); assert.equal(next(), 'spa');
});

test('navMeta: בשרת (בלי window) nextNavigationType מחזיר undefined ולא זורק', () => {
  assert.equal(NM.nextNavigationType(), undefined);
});

test('חיווט: PageTracker שולח navigationType; ה-interceptor שולח x-cpu-ms/x-boot-id בשינוי יחיד בשורת ה-queue הקיימת', () => {
  const pt = read('app/components/PageTracker.js');
  assert.match(pt, /from '@\/lib\/navMeta'/);
  assert.match(pt, /__queueVisitLog\(\{ pageUrl: url, loadingError: errorMsg, navigationType \}\)/);
  const lay = read('app/layout.js');
  assert.equal((lay.match(/serverCpuMs: response\.headers\.get\('x-cpu-ms'\)/g) || []).length, 1);
  assert.equal((lay.match(/serverBootId: response\.headers\.get\('x-boot-id'\)/g) || []).length, 1);
});

test('חיווט: log-visit משתמש ב-measureFields + createVisitLogs; /api/history עם select מפורש בלי עמודות המדידה', () => {
  const lv = read('app/api/log-visit/route.js');
  assert.match(lv, /\.\.\.measureFields\(e\)/);
  assert.match(lv, /await createVisitLogs\(prisma,/);
  assert.ok(!/prisma\.pageVisitLog\.createMany/.test(lv), 'no direct createMany left in the route');
  const hist = read('app/api/history/route.js');
  const at = hist.indexOf('pageVisitLog.findMany');
  const block = hist.slice(at, at + 900);
  assert.match(block, /select: \{/);
  assert.ok(!/serverCpuMs|navigationType|serverBootId/.test(block.replace(/\/\/.*$/gm, '')), 'history select must not list the new columns');
});

test('חיווט: נתיבים כבדים עטופים ב-withCpuTiming בשורת export אחת לכל מתודה', () => {
  const wrapped = {
    'app/api/orders/route.js': ['GET', 'POST'], 'app/api/customers/route.js': ['GET', 'POST'], 'app/api/inventory/preload/route.js': ['GET'],
    'app/api/settings/route.js': ['GET'], 'app/api/me/route.js': ['GET'], 'app/api/notifications/route.js': ['GET'],
    'app/api/a5/boot/route.js': ['GET'], 'app/api/health/boot/route.js': ['GET'],
  };
  for (const [f, ms] of Object.entries(wrapped)) {
    const s = read(f);
    assert.match(s, /import \{ withCpuTiming \} from '@\/lib\/cpuTiming'/, f);
    for (const m of ms) {
      assert.match(s, new RegExp(`const ${m}_timed = withCpuTiming\\(${m}\\);\\nexport \\{ ${m}_timed as ${m} \\};`), `${f} ${m}`);
      assert.ok(!new RegExp(`export (async )?function ${m}\\b`).test(s), `${f}: ${m} must not be exported twice`);
    }
  }
});

test('/api/health/boot מחובר בלבד; /api/health הציבורי לא שונה', () => {
  const b = read('app/api/health/boot/route.js');
  assert.match(b, /checkAuth\(\)/);
  assert.match(b, /status: 401/);
  assert.ok(!/bootInfo/.test(read('app/api/health/route.js')));
});

test('סכימה + SQL: שלוש העמודות האופציונליות, idempotent, בלי DEFAULT, ובלי DROP/UPDATE/DELETE פעילים; קובץ הבדיקה SELECT בלבד', () => {
  const schema = read('prisma/schema.prisma');
  const start = schema.indexOf('model PageVisitLog');
  const model = schema.slice(start, schema.indexOf('\n}', start));
  assert.match(model, /serverCpuMs\s+Float\?/);
  assert.match(model, /navigationType\s+String\?/);
  assert.match(model, /serverBootId\s+String\?/);
  const live = (t) => t.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  const sql = live(read('prisma/migrations-pending/2026-10-06-pagevisitlog-measure.sql'));
  assert.equal((sql.match(/ADD COLUMN IF NOT EXISTS/g) || []).length, 3);
  assert.ok(!/DEFAULT/i.test(sql) && !/\b(DROP|UPDATE|DELETE|TRUNCATE|CREATE)\b/i.test(sql));
  assert.match(sql, /SET lock_timeout = '5s';/);
  assert.match(sql, /"serverCpuMs"\s+DOUBLE PRECISION/); assert.match(sql, /"navigationType"\s+TEXT/); assert.match(sql, /"serverBootId"\s+TEXT/);
  const chk = live(read('prisma/migrations-pending/2026-10-06-pagevisitlog-measure-check.sql'));
  assert.ok(!/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b/i.test(chk), 'check file is read-only');
});

test('לוגו: שלושת מסכי ההעלאה מציגים לפני/אחרי ומכווצים קבצים ענקיים בקליינט; הסקריפט החד-פעמי עם dry-run כברירת מחדל', () => {
  for (const f of ['app/dashboard/LogoSettings.js', 'app/admin/settings/SettingsClient.js', 'app/components/settings-sim/SettingsSimPage.js']) {
    const s = read(f);
    assert.match(s, /describeLogoResult\(data\)/, f);
    assert.match(s, /prepareLogoFile\(file\)/, f);
    assert.match(s, /readLogoUploadResponse\(res\)/, f);
    assert.ok(!/await res\.json\(\)/.test(s.slice(s.indexOf('/api/upload-logo'), s.indexOf('/api/upload-logo') + 400)), `${f}: upload response must go through readLogoUploadResponse (413 is not JSON)`);
    assert.ok(!/logoCompress/.test(s), `${f} must not import the server-side (sharp) module`);
  }
  const prep = read('lib/logoClientPrep.js');
  assert.match(prep, /PREP_MAX_PX = 1024/);
  assert.match(prep, /'image\/jpeg'/);
  assert.ok(!/toBlob\(canvas, 'image\/png'/.test(prep), 'no PNG re-encode (can exceed the 4.5MB request limit)');
  assert.match(read('app/admin/settings/SettingsClient.js'), /setSaveMessage\(null\), 9000\)/);
  const sc = read('scripts/compress_brand_logo.js');
  assert.match(sc, /const write = rest\.includes\('--write'\)/);
  assert.match(sc, /--write requires both --expect-host/);
  assert.match(sc, /gmach_name/);
  assert.ok(sc.indexOf('backup verification failed') < sc.indexOf('data: { value: r.dataUrl }'), 'backup is verified before the UPDATE');
  assert.ok(existsSync(`${ROOT}/lib/logoFormat.js`));
});
