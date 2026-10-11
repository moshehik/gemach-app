// בדיקת יחידה ל-scripts/scrub_logged_secrets.js (בלי DB): רשימות השדות זהות לאלה שבאפליקציה, המסכה שומרת מבנה ואידמפוטנטית, כל סוגי הצורות של changesJson,
// ושערי הזהות / ייצור (הסקריפט מסרב לפני שהוא נוגע ב-DB). הבדיקה מול DB אמיתי של TEST: scripts/test_scrub_logged_secrets_db.mjs.
// הרצה: node scripts/test_scrub_logged_secrets.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SECRET_BODY_PLACEHOLDER, TEMP_PASSWORD_BODY_RE, secretEmailSubjects } from '../lib/emailCatalog.js';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = require('./scrub_logged_secrets.js');
const SCRIPT = path.join(ROOT, 'scripts', 'scrub_logged_secrets.js');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');
/** מחלץ את ליטרל האובייקט `const NAME = {...};` מקובץ מקור (בלי הערות) ומעריך אותו. */
function extractObject(src, name) {
  const noComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\/\/.*$/gm, '');
  const m = noComments.match(new RegExp(`const ${name} = (\\{[\\s\\S]*?\\n\\});`));
  assert.ok(m, `${name} not found`);
  return new Function(`return (${m[1]});`)();
}
const FAKE = 'ZzQ9-SECAUDIT-TEMP-7788';

console.log('רשימות השדות');
t('הסקריפט, app/lib/prisma.js ו-app/lib/auditLog.js מגדירים בדיוק את אותן רשימות', () => {
  const a = extractObject(read('app/lib/prisma.js'), 'AUDIT_SECRET_FIELDS');
  const b = extractObject(read('app/lib/auditLog.js'), 'SECRET_FIELDS_BY_ENTITY');
  assert.deepEqual(a, b, 'prisma.js != auditLog.js');
  assert.deepEqual(S.SECRET_FIELDS_BY_ENTITY, a, 'scrub script != app lists');
  assert.deepEqual(Object.keys(a).sort(), ['ApiKey', 'EmailLog', 'Employee']);
});
t('ממלא המקום והנושאים מגיעים מהקטלוג (אותו ערך כמו ב-mailer)', () => {
  assert.equal(SECRET_BODY_PLACEHOLDER, '[גוף ההודעה לא נשמר — מכיל סיסמה זמנית]');
  assert.deepEqual(secretEmailSubjects(), ['איפוס סיסמה - מערכת הגמ"ח']);
  assert.equal(S.PG_TEMP_PASSWORD_RE, TEMP_PASSWORD_BODY_RE.source.replace('\\s', '[[:space:]]'), 'regex של Postgres חייב להתאים ל-regex של ה-JS');
});

console.log('maskChangesJson');
t('עותק שורה מלא (יצירת עובד): password / pinHash מוסתרים, שאר השדות והסדר נשארים', () => {
  const json = JSON.stringify({ id: 'e1', firstName: 'דנה', password: '$2b$10$abcdef', pinHash: '1234', mustResetPassword: false, email: 'a@b.c' });
  const m = S.maskChangesJson('Employee', json);
  assert.equal(m.changed, true);
  assert.deepEqual(JSON.parse(m.json), { id: 'e1', firstName: 'דנה', password: '[הוסתר]', pinHash: '[הוסתר]', mustResetPassword: false, email: 'a@b.c' });
  assert.deepEqual(Object.keys(JSON.parse(m.json)), ['id', 'firstName', 'password', 'pinHash', 'mustResetPassword', 'email']);
  assert.ok(!m.json.includes('abcdef') && !m.json.includes('1234'));
});
t('הפרש עדכון {field:{from,to}}: from ו-to מוסתרים, המבנה נשאר', () => {
  const json = JSON.stringify({ password: { from: 'OldPlain', to: '$2b$10$newhash' }, firstName: { from: 'א', to: 'ב' } });
  const m = S.maskChangesJson('Employee', json);
  assert.deepEqual(JSON.parse(m.json), { password: { from: '[הוסתר]', to: '[הוסתר]' }, firstName: { from: 'א', to: 'ב' } });
});
t('צורת עדכון גולמית ({set: ...}) ושדה null / ריק לא נוגעים בהם', () => {
  const m = S.maskChangesJson('Employee', JSON.stringify({ password: { set: 'x$hash' }, pinHash: null }));
  assert.deepEqual(JSON.parse(m.json), { password: { set: '[הוסתר]' }, pinHash: null });
  assert.equal(S.maskChangesJson('Employee', JSON.stringify({ password: '', pinHash: { from: null, to: '' } })).changed, false);
});
t('ערך שכבר מוסתר ("***" של האפליקציה או "[הוסתר]") = בלי שינוי (אידמפוטנטי)', () => {
  for (const v of ['***', '[הוסתר]']) {
    assert.equal(S.maskChangesJson('Employee', JSON.stringify({ password: v, pinHash: { from: v, to: v } })).changed, false);
  }
  const once = S.maskChangesJson('Employee', JSON.stringify({ password: 'abc' }));
  assert.equal(S.maskChangesJson('Employee', once.json).changed, false);
});
t('ApiKey.keyHash', () => {
  const m = S.maskChangesJson('ApiKey', JSON.stringify({ name: 'k', keyHash: 'deadbeef', keyPrefix: 'gmk_ab' }));
  assert.deepEqual(JSON.parse(m.json), { name: 'k', keyHash: '[הוסתר]', keyPrefix: 'gmk_ab' });
});
t('EmailLog: body ו-confirmToken מוסתרים; ממלא המקום עצמו נחשב נקי', () => {
  const json = JSON.stringify({ to: 'a@b.c', subject: 's', body: `סיסמה זמנית: ${FAKE}`, confirmToken: 'tok123', status: 'success' });
  const m = S.maskChangesJson('EmailLog', json, SECRET_BODY_PLACEHOLDER);
  assert.deepEqual(JSON.parse(m.json), { to: 'a@b.c', subject: 's', body: '[הוסתר]', confirmToken: '[הוסתר]', status: 'success' });
  assert.ok(!m.json.includes(FAKE));
  assert.equal(S.maskChangesJson('EmailLog', JSON.stringify({ body: SECRET_BODY_PLACEHOLDER }), SECRET_BODY_PLACEHOLDER).changed, false);
});
t('ישויות אחרות / JSON לא תקין / צורות לא צפויות לא משתנות', () => {
  assert.equal(S.maskChangesJson('Customer', JSON.stringify({ password: 'x' })).changed, false);
  assert.equal(S.maskChangesJson('Employee', '{not json').unparseable, true);
  assert.equal(S.maskChangesJson('Employee', '{not json').changed, false);
  assert.equal(S.maskChangesJson('Employee', JSON.stringify({ deleted: true })).changed, false);
  assert.equal(S.maskChangesJson('Employee', JSON.stringify([1, 2])).changed, false);
  assert.equal(S.maskChangesJson('Employee', '').changed, false);
  assert.equal(S.maskChangesJson('Employee', JSON.stringify({ firstName: { from: 'password', to: 'x' } })).changed, false);
});
t('סיסמה מספרית (4 ספרות בטקסט גלוי כמספר JSON) מוסתרת', () => {
  const m = S.maskChangesJson('Employee', JSON.stringify({ pinHash: 4321 }));
  assert.equal(JSON.parse(m.json).pinHash, '[הוסתר]');
});

console.log('שורת פקודה ושערי הזהות');
t('parseArgs: ברירת מחדל dry-run, --confirm-host חובה, דגלים סותרים נדחים', () => {
  assert.throws(() => S.parseArgs([]), /--confirm-host/);
  assert.throws(() => S.parseArgs(['--confirm-host', 'ep-aaaa-bbbb-1', '--apply', '--report-only']), /mutually exclusive/);
  assert.throws(() => S.parseArgs(['--confirm-host', 'ep-aaaa-bbbb-1', '--apply', '--dry-run']), /mutually exclusive/);
  assert.throws(() => S.parseArgs(['--confirm-host', 'ep-aaaa-bbbb-1', '--not-prod', '--i-know-this-is-prod']), /mutually exclusive/);
  assert.throws(() => S.parseArgs(['--confirm-host', 'ep-aaaa-bbbb-1', '--bogus']), /Unknown flag/);
  assert.throws(() => S.parseArgs(['--confirm-host', 'ep-aaaa-bbbb-1', '--batch-size', '501']), /batch-size/);
  const o = S.parseArgs(['--confirm-host', 'ep-aaaa-bbbb-1']);
  assert.equal(!!o.apply, false);
  assert.equal(o.batchSize, 500);
});
function cli(args, env) {
  const clean = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP };
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { env: { ...clean, ...env }, encoding: 'utf8', timeout: 20000 });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
const FAKE_URL = 'postgresql://u:secretpw@ep-fake-host-123456.eu-central-1.aws.neon.tech/neondb';
t('בלי --confirm-host: נכשל לפני כל חיבור', () => {
  const r = cli([], { DATABASE_URL: FAKE_URL });
  assert.notEqual(r.code, 0);
  assert.match(r.out, /--confirm-host/);
});
t('--confirm-host שגוי: REFUSING (קוד 2), ולא מדפיס את הסיסמה של ה-URL', () => {
  const r = cli(['--confirm-host', 'ep-other-host-999999'], { DATABASE_URL: FAKE_URL });
  assert.equal(r.code, 2);
  assert.match(r.out, /REFUSING TO RUN/);
  assert.ok(!r.out.includes('secretpw'));
});
t('--confirm-host נכון אבל בלי --i-know-this-is-prod: נחשב ייצור ונדחה (גם dry-run / report-only)', () => {
  for (const extra of [[], ['--report-only'], ['--apply']]) {
    const r = cli(['--confirm-host', 'ep-fake-host-123456', ...extra], { DATABASE_URL: FAKE_URL });
    assert.equal(r.code, 2, extra.join(' '));
    assert.match(r.out, /PRODUCTION/);
  }
});
t('--not-prod על host של Neon נדחה', () => {
  const r = cli(['--confirm-host', 'ep-fake-host-123456', '--not-prod'], { DATABASE_URL: FAKE_URL });
  assert.equal(r.code, 2);
  assert.match(r.out, /not-prod/);
});
t('--confirm-host קצר מדי / תת-מחרוזת נדחה', () => {
  assert.equal(cli(['--confirm-host', 'neon'], { DATABASE_URL: FAKE_URL }).code, 2);
  assert.equal(cli(['--confirm-host', 'ep-fake-host'], { DATABASE_URL: FAKE_URL }).code, 2);
});

console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
