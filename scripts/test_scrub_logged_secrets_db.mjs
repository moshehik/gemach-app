// בדיקת אינטגרציה של scripts/scrub_logged_secrets.js מול ה-DB של TEST (לא נוגע בשום DB אחר: מסרב אם DATABASE_URL אינו ה-host של TEST_DATABASE_URL).
// זורע שורות זמניות (מייל איפוס מזויף עם הסיסמה המזויפת ZzQ9-SECAUDIT-TEMP-7788, תאומי AuditLog בשלוש הצורות, ושורות שאסור לשנות),
// מריץ dry-run (ספירות, בלי שינוי) -> apply -> הרצה חוזרת (0 שינויים), מוודא ששורות לא קשורות לא השתנו, ומנקה את הזרעים.
// שים לב: ה-apply עובר על כל ה-DB ולכן מנקה גם שורות היסטוריות אמיתיות של TEST (זו מטרת הסקריפט).
// הרצה: node scripts/test_scrub_logged_secrets_db.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SECRET_BODY_PLACEHOLDER } from '../lib/emailCatalog.js';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
require('./lib/db-env.js').loadEnvFiles();
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) { console.error('TEST_DATABASE_URL is not set - refusing'); process.exit(2); }
const host = (u) => new URL(u).hostname.toLowerCase();
process.env.DATABASE_URL = testUrl; // תמיד TEST, לא משנה מה .env אומר
const S = require('./scrub_logged_secrets.js');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasourceUrl: testUrl });

const FAKE = 'ZzQ9-SECAUDIT-TEMP-7788';
const TAG = `SCRUBTEST-${Date.now()}`;
const RESET_SUBJECT = 'איפוס סיסמה - מערכת הגמ"ח';
let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const lines = [];
const capture = (s) => lines.push(s);

const seeded = { email: {}, audit: {} };
async function seed() {
  const mk = async (key, data) => { seeded.email[key] = (await prisma.emailLog.create({ data: { to: `${TAG}@example.test`, status: 'success', ...data } })).id; };
  await mk('reset', { subject: RESET_SUBJECT, body: `שלום,\nסיסמה זמנית: ${FAKE}\nיש להתחבר...` });
  await mk('sample', { subject: '[דוגמה] ' + RESET_SUBJECT, body: `סיסמה זמנית : ${FAKE}` });
  await mk('plain', { subject: 'הודעה רגילה', body: 'שלום רגיל, אין כאן סוד' });
  await mk('word', { subject: 'הודעה על סיסמה', body: 'הסיסמה שלך נשארת כמו שהייתה' });
  await mk('alreadyPlaceholder', { subject: RESET_SUBJECT, body: SECRET_BODY_PLACEHOLDER });
  await mk('nullBody', { subject: RESET_SUBJECT, body: null });
  await mk('bulk', { subject: 'שלום [bulk-1]', body: 'קישור: https://x.test/confirm?token=abc', confirmToken: `${TAG}-tok` });

  const au = async (key, entityType, obj, raw) => {
    seeded.audit[key] = (await prisma.auditLog.create({ data: { entityType, entityId: `${TAG}-${key}`, action: 'CREATE', changesJson: raw !== undefined ? raw : JSON.stringify(obj) } })).id;
  };
  await au('emailCreate', 'EmailLog', { id: 'e1', to: 'a@b.c', subject: RESET_SUBJECT, body: `סיסמה זמנית: ${FAKE}`, confirmToken: `${TAG}-tok2`, status: 'success' });
  await au('emailAppMasked', 'EmailLog', { id: 'e2', subject: 's', body: '***', confirmToken: '***' });
  await au('emailPlain', 'EmailLog', { id: 'e3', subject: 's', status: 'success' });
  await au('empCreate', 'Employee', { id: 'u1', firstName: 'בדיקה', password: '$2b$10$FAKEFAKEFAKEFAKE', pinHash: '4321', mustResetPassword: false });
  await au('empDiff', 'Employee', { password: { from: 'plain-old-pw', to: '$2b$10$NEWFAKE' }, firstName: { from: 'א', to: 'ב' } });
  await au('empNonSecretDiff', 'Employee', { firstName: { from: 'password', to: 'pinHash' } });
  await au('empAppMasked', 'Employee', { id: 'u2', password: '***', pinHash: { from: '***', to: '***' } });
  await au('empDeleted', 'Employee', { deleted: true });
  await au('empNotJson', 'Employee', null, 'not json "password": x');
  await au('keyCreate', 'ApiKey', { id: 'k1', name: 'מפתח', keyHash: 'deadbeefcafe', keyPrefix: 'gmk_ab12' });
  await au('keyDiff', 'ApiKey', { keyHash: { from: 'aaaa', to: 'bbbb' }, name: { from: 'x', to: 'y' } });
  await au('customer', 'Customer', { id: 'c1', password: 'looks-secret-but-not-our-entity', firstName: 'x' });
}

async function cleanup() {
  await prisma.emailLog.deleteMany({ where: { to: `${TAG}@example.test` } });
  await prisma.auditLog.deleteMany({ where: { entityId: { startsWith: TAG } } });
}
const emailRow = (k) => prisma.emailLog.findUnique({ where: { id: seeded.email[k] } });
const auditRow = (k) => prisma.auditLog.findUnique({ where: { id: seeded.audit[k] } });
const aj = async (k) => JSON.parse((await auditRow(k)).changesJson);
const num = (s, re) => { const m = lines.join('\n').match(re); return m ? Number(m[1]) : NaN; };

try {
  assert.equal(host(process.env.DATABASE_URL), host(testUrl));
  const nameRow = await prisma.systemSetting.findUnique({ where: { key: 'gmach_name' }, select: { value: true } });
  console.log(`TEST DB host=${host(testUrl)} gmach_name=${nameRow ? nameRow.value : '(none)'}`);
  await cleanup(); // שאריות מריצה קודמת שנקטעה
  await seed();

  // תמונת מצב של שורות שאסור לשנות
  const mustNotChange = {
    email: ['plain', 'word', 'alreadyPlaceholder', 'nullBody', 'bulk'],
    audit: ['emailAppMasked', 'emailPlain', 'empNonSecretDiff', 'empAppMasked', 'empDeleted', 'empNotJson', 'customer'],
  };
  const before = { email: {}, audit: {} };
  for (const k of mustNotChange.email) before.email[k] = JSON.stringify(await emailRow(k));
  for (const k of mustNotChange.audit) before.audit[k] = JSON.stringify(await auditRow(k));
  const beforeSecrets = { empCreate: await aj('empCreate') };

  const opts = (o) => ({ batchSize: 500, ...o });
  console.log('report-only');
  let rep;
  await t('report-only מזהה את הזרעים ולא כותב', async () => {
    lines.length = 0;
    rep = (await S.run(prisma, opts({ 'report-only': true }), capture)).before;
    assert.ok(rep.emailLogBodies >= 2, `emailLogBodies=${rep.emailLogBodies}`);
    assert.ok(rep.audit.EmailLog >= 1 && rep.audit.Employee >= 2 && rep.audit.ApiKey >= 2, JSON.stringify(rep.audit));
    assert.equal((await emailRow('reset')).body.includes(FAKE), true);
  });

  console.log('dry-run');
  let dry;
  await t('dry-run: ספירות זהות ל-report-only, שום שורה לא משתנה', async () => {
    lines.length = 0;
    dry = await S.run(prisma, opts({}), capture);
    assert.equal(dry.result.emailBodies.updated, rep.emailLogBodies);
    assert.equal(dry.result.EmailLog.updated, rep.audit.EmailLog);
    assert.equal(dry.result.Employee.updated, rep.audit.Employee);
    assert.equal(dry.result.ApiKey.updated, rep.audit.ApiKey);
    assert.ok(lines.join('\n').includes('DRY RUN'));
    assert.equal((await emailRow('reset')).body.includes(FAKE), true, 'dry-run כתב!');
    assert.deepEqual(await aj('empCreate'), beforeSecrets.empCreate);
  });

  console.log('apply (אצוות קטנות של 3 כדי לבדוק מעבר בין אצוות)');
  let applied;
  await t('apply: שורות הזרע הסודיות נוקו', async () => {
    lines.length = 0;
    applied = await S.run(prisma, opts({ apply: true, batchSize: 3 }), capture);
    assert.equal(applied.result.emailBodies.updated, rep.emailLogBodies);
    assert.equal(applied.result.EmailLog.updated, rep.audit.EmailLog);
    assert.equal(applied.result.Employee.updated, rep.audit.Employee);
    assert.equal(applied.result.ApiKey.updated, rep.audit.ApiKey);
    assert.equal(applied.result.Employee.skipped + applied.result.ApiKey.skipped + applied.result.EmailLog.skipped, 0);
    assert.equal((await emailRow('reset')).body, SECRET_BODY_PLACEHOLDER);
    assert.equal((await emailRow('sample')).body, SECRET_BODY_PLACEHOLDER);
    const r = await emailRow('reset');
    assert.equal(r.subject, RESET_SUBJECT); assert.equal(r.to, `${TAG}@example.test`); assert.equal(r.status, 'success');
  });
  await t('apply: מבנה ה-JSON נשמר, רק הערכים הסודיים הוחלפו ב-[הוסתר] (שלוש הצורות)', async () => {
    assert.deepEqual(await aj('emailCreate'), { id: 'e1', to: 'a@b.c', subject: RESET_SUBJECT, body: '[הוסתר]', confirmToken: '[הוסתר]', status: 'success' });
    assert.deepEqual(await aj('empCreate'), { id: 'u1', firstName: 'בדיקה', password: '[הוסתר]', pinHash: '[הוסתר]', mustResetPassword: false });
    assert.deepEqual(await aj('empDiff'), { password: { from: '[הוסתר]', to: '[הוסתר]' }, firstName: { from: 'א', to: 'ב' } });
    assert.deepEqual(await aj('keyCreate'), { id: 'k1', name: 'מפתח', keyHash: '[הוסתר]', keyPrefix: 'gmk_ab12' });
    assert.deepEqual(await aj('keyDiff'), { keyHash: { from: '[הוסתר]', to: '[הוסתר]' }, name: { from: 'x', to: 'y' } });
    for (const k of ['emailCreate', 'empCreate', 'empDiff', 'keyCreate', 'keyDiff']) {
      const row = await auditRow(k);
      assert.ok(!row.changesJson.includes(FAKE) && !row.changesJson.includes('FAKEFAKE') && !row.changesJson.includes('deadbeef') && !row.changesJson.includes('plain-old-pw'), k);
      assert.equal(row.action, 'CREATE'); assert.equal(row.entityId, `${TAG}-${k}`);
    }
  });
  await t('apply: שורות שאסור לשנות לא השתנו בשום עמודה', async () => {
    for (const k of mustNotChange.email) assert.equal(JSON.stringify(await emailRow(k)), before.email[k], `email ${k}`);
    for (const k of mustNotChange.audit) assert.equal(JSON.stringify(await auditRow(k)), before.audit[k], `audit ${k}`);
  });
  await t('אחרי apply: הדוח "after" = אפס שורות עם סוד פתוח', async () => {
    assert.equal(applied.after.emailLogBodies, 0);
    assert.deepEqual(applied.after.audit, { Employee: 0, ApiKey: 0, EmailLog: 0 });
    assert.ok(lines.join('\n').includes('OK: no unmasked secrets remain.'));
  });

  console.log('הרצה חוזרת (אידמפוטנטיות)');
  await t('apply שני: 0 שינויים בכל הסעיפים', async () => {
    lines.length = 0;
    const again = await S.run(prisma, opts({ apply: true }), capture);
    assert.equal(again.result.emailBodies.updated, 0);
    assert.equal(again.result.EmailLog.updated + again.result.Employee.updated + again.result.ApiKey.updated, 0);
    for (const k of mustNotChange.email) assert.equal(JSON.stringify(await emailRow(k)), before.email[k]);
    for (const k of mustNotChange.audit) assert.equal(JSON.stringify(await auditRow(k)), before.audit[k]);
  });

  console.log('CLI אמיתי מול TEST (שער הזהות מקבל את TEST בלי --i-know-this-is-prod)');
  await t('--report-only ו-dry-run מתוך תהליך נפרד: מדפיסים gmach_name, יוצאים 0, לא מדפיסים סוד', async () => {
    const ep = host(testUrl).split('.')[0].replace(/-pooler$/, '');
    for (const extra of [['--report-only'], []]) {
      const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'scrub_logged_secrets.js'), '--confirm-host', ep, ...extra], { env: { ...process.env, DATABASE_URL: testUrl }, encoding: 'utf8', timeout: 120000 });
      const out = (r.stdout || '') + (r.stderr || '');
      assert.equal(r.status, 0, out.slice(0, 400));
      assert.match(out, /gmach_name: /);
      assert.match(out, /DB identity: TEST/);
      assert.ok(!out.includes(FAKE));
    }
  });
} finally {
  await cleanup();
  const left = await prisma.emailLog.count({ where: { to: `${TAG}@example.test` } }) + await prisma.auditLog.count({ where: { entityId: { startsWith: TAG } } });
  console.log(`cleanup: ${left === 0 ? 'seeded rows removed' : `LEFT OVER: ${left}`}`);
  await prisma.$disconnect();
}
console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
