// בדיקת יחידה: מיילים שגופם מכיל סוד (סיסמה זמנית) לא נשמרים ביומן המיילים (EmailLog.body) - 2026-10-11, security-audit.md סעיף 10.5 פריט 1.
//  * resolveLoggedBody (lib/emailCatalog.js): כל מזהה בקטלוג עם containsSecret מוחלף בממלא מקום, כל השאר נשאר כמו שהוא; עקיפה מפורשת logBody; רשת הביטחון (נושא / "סיסמה זמנית:").
//  * sendSystemEmail האמיתי (lib/mailer.js) מורץ מול prisma / fetch מדומים: מה שנכתב ל-emailLog.create, והמייל עצמו (ה-payload ל-Apps Script) עדיין נושא את הסיסמה.
//  * GET /api/email-logs (המתכנת הישן) האמיתי מחזיר את ממלא המקום לשורה חדשה.
//  * חוזה סטטי: כל אתר שליחה שהנושא שלו מהקטלוג של מייל containsSecret מעביר emailId.
// הרצה: node scripts/test_email_log_secrets.mjs   (יוצא עם קוד 1 אם משהו נכשל). אין DB / רשת.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootUrl = pathToFileURL(ROOT + path.sep).href;

// ---- מדמה את prisma / settingsCache / auth / next-server דרך hook של הטעינה (הקוד האמיתי של mailer.js ו-route.js נטען כמו שהוא) ----
const hooks = `
const ROOT = ${JSON.stringify(rootUrl)};
const stubs = {
  '@/app/lib/prisma': 'prisma', '../../lib/prisma': 'prisma',
  '@/lib/settingsCache': 'settings',
  '../../../lib/auth': 'auth',
  'next/server': 'nextserver',
};
export async function resolve(spec, ctx, next) {
  if (stubs[spec]) return { url: 'stub:' + stubs[spec], shortCircuit: true, format: 'module' };
  if (spec.startsWith('@/')) return next(ROOT + spec.slice(2) + (/\\.[a-z]+$/.test(spec) ? '' : '.js'), ctx);
  return next(spec, ctx);
}
export async function load(url, ctx, next) {
  if (url === 'stub:prisma') return { format: 'module', shortCircuit: true, source: 'export default globalThis.__stub.prisma;' };
  if (url === 'stub:settings') return { format: 'module', shortCircuit: true, source: 'export const getAllCachedSettings = async () => []; export const getCachedSetting = async () => "";' };
  if (url === 'stub:auth') return { format: 'module', shortCircuit: true, source: 'export const checkAuth = async (role) => globalThis.__stub.authOk;' };
  if (url === 'stub:nextserver') return { format: 'module', shortCircuit: true, source: 'export const NextResponse = { json: (data, init) => ({ json: async () => data, status: (init && init.status) || 200 }) };' };
  return next(url, ctx);
}`;
register('data:text/javascript,' + encodeURIComponent(hooks), import.meta.url);

const created = []; // כל מה ש-emailLog.create קיבל
const sentPayloads = []; // כל מה ש-fetch (ה-Apps Script) קיבל
globalThis.__stub = {
  authOk: true,
  prisma: {
    emailLog: {
      create: async ({ data }) => { created.push(data); return { id: 'x' + created.length, ...data }; },
      count: async () => created.length,
      findMany: async () => created.map((d, i) => ({ id: 'x' + i, ...d })),
    },
  },
};
globalThis.fetch = async (url, init) => {
  sentPayloads.push(JSON.parse(init.body));
  return { status: 200, text: async () => JSON.stringify({ status: 'success' }) };
};

const { EMAIL_CATALOG, SECRET_BODY_PLACEHOLDER, emailContainsSecret, emailSubject, resolveLoggedBody, secretEmailSubjects, TEMP_PASSWORD_BODY_RE } = await import('../lib/emailCatalog.js');
const { sendSystemEmail } = await import('../lib/mailer.js');

let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');
const FAKE_PW = 'ZzQ9-TESTONLY-TEMP-0001';

console.log('הקטלוג');
await t('ממלא המקום הוא הטקסט שסוכם עם הבעלים', () => {
  assert.equal(SECRET_BODY_PLACEHOLDER, '[גוף ההודעה לא נשמר — מכיל סיסמה זמנית]');
});
await t('שני מיילי האיפוס מסומנים containsSecret, ואף מייל אחר לא (שינוי = החלטה מודעת + עדכון EMAILS.md)', () => {
  const flagged = Object.entries(EMAIL_CATALOG).filter(([, e]) => e.containsSecret === true).map(([id]) => id).sort();
  assert.deepEqual(flagged, ['passwordResetManager', 'passwordResetSelf']);
  for (const e of Object.values(EMAIL_CATALOG)) assert.ok(e.containsSecret === undefined || e.containsSecret === true, 'הדגל הוא true או נעדר');
});
await t('emailContainsSecret: מזהה לא מוכר = שגיאה מוקדמת', () => {
  assert.throws(() => emailContainsSecret('nope'), /לא מוכר/);
  assert.equal(emailContainsSecret('orderCard'), false);
});
await t('secretEmailSubjects = נושאי כל מיילי containsSecret', () => {
  assert.deepEqual(secretEmailSubjects(), ['איפוס סיסמה - מערכת הגמ"ח']);
});

console.log('resolveLoggedBody');
await t('כל מזהה containsSecret -> ממלא מקום; כל מזהה אחר -> הגוף כמו שהוא', () => {
  for (const [id, e] of Object.entries(EMAIL_CATALOG)) {
    const body = `גוף רגיל של ${id}`;
    const got = resolveLoggedBody({ body, subject: 'נושא כלשהו', emailId: id });
    if (e.containsSecret) assert.equal(got, SECRET_BODY_PLACEHOLDER, id);
    else assert.equal(got, body, id);
  }
});
await t('בלי emailId: גוף רגיל נשמר, גוף ריק -> null', () => {
  assert.equal(resolveLoggedBody({ body: 'שלום', subject: 'הודעה' }), 'שלום');
  assert.equal(resolveLoggedBody({ body: '', subject: 'הודעה' }), null);
  assert.equal(resolveLoggedBody({}), null);
});
await t('logBody מפורש גובר על הכול (גם null = לא לשמור גוף); emailId של מייל רגיל + logBody', () => {
  assert.equal(resolveLoggedBody({ body: 'x', emailId: 'passwordResetSelf', logBody: 'טקסט אחר' }), 'טקסט אחר');
  assert.equal(resolveLoggedBody({ body: 'x', logBody: null }), null);
  assert.equal(resolveLoggedBody({ body: 'x', logBody: '' }), null);
  assert.equal(resolveLoggedBody({ body: 'סיסמה זמנית: AB', logBody: 'ללא' }), 'ללא');
});
await t('רשת ביטחון: נושא של מייל סודי בלי emailId, או גוף עם "סיסמה זמנית:"', () => {
  assert.equal(resolveLoggedBody({ body: `סיסמה זמנית: ${FAKE_PW}`, subject: emailSubject('passwordResetSelf') }), SECRET_BODY_PLACEHOLDER);
  assert.equal(resolveLoggedBody({ body: `שלום\nסיסמה זמנית: ${FAKE_PW}`, subject: '[דוגמה] איפוס סיסמה' }), SECRET_BODY_PLACEHOLDER);
  assert.ok(TEMP_PASSWORD_BODY_RE.test('סיסמה זמנית : x'));
  assert.equal(resolveLoggedBody({ body: 'אין כאן סוד', subject: 'הודעה' }), 'אין כאן סוד');
});
await t('emailId לא מוכר זורק', () => {
  assert.throws(() => resolveLoggedBody({ body: 'x', emailId: 'typo' }), /לא מוכר/);
});

console.log('sendSystemEmail האמיתי מול prisma / Apps Script מדומים');
await t('כל מייל containsSecret: המייל יוצא עם הסיסמה, השורה ביומן עם ממלא מקום (נושא / נמען / סטטוס / מצורפים נשמרים)', async () => {
  for (const [id] of Object.entries(EMAIL_CATALOG).filter(([, x]) => x.containsSecret)) {
    created.length = 0; sentPayloads.length = 0;
    const r = await sendSystemEmail({
      to: 'a@example.com', subject: emailSubject(id), emailId: id, employeeId: 'emp-1',
      body: `שלום,\nסיסמה זמנית: ${FAKE_PW}\n`, html: `<b>${FAKE_PW}</b>`,
      attachments: [{ fileName: 'f.txt', fileContent: 'QQ==' }],
    });
    assert.equal(r.success, true, id);
    assert.equal(created.length, 1, id);
    assert.equal(created[0].body, SECRET_BODY_PLACEHOLDER, id);
    assert.ok(!JSON.stringify(created[0]).includes(FAKE_PW), `${id}: הסיסמה דלפה לשורת היומן`);
    assert.equal(created[0].subject, emailSubject(id));
    assert.equal(created[0].to, 'a@example.com');
    assert.equal(created[0].status, 'success');
    assert.equal(created[0].fileName, 'f.txt');
    assert.equal(created[0].employeeId, 'emp-1');
    assert.equal(sentPayloads.length, 1);
    assert.ok(sentPayloads[0].body.includes(FAKE_PW), `${id}: הסיסמה חייבת להישאר במייל עצמו`);
    assert.equal(sentPayloads[0].htmlBody, `<b>${FAKE_PW}</b>`);
  }
});
await t('כל מייל שאינו containsSecret: הגוף נשמר ביומן כמו קודם', async () => {
  for (const [id] of Object.entries(EMAIL_CATALOG).filter(([, x]) => !x.containsSecret)) {
    created.length = 0;
    await sendSystemEmail({ to: 'b@example.com', subject: emailSubject(id, { orderId: 7, subject: 's', batchId: 'bulk-1', count: 1, groups: [], title: 't', reporterName: 'ר' }), emailId: id, body: `גוף ${id}` });
    assert.equal(created.length, 1, id);
    assert.equal(created[0].body, `גוף ${id}`, id);
  }
});
await t('מייל סודי שנשכח בלי emailId עדיין מוגן (נושא תואם)', async () => {
  created.length = 0;
  await sendSystemEmail({ to: 'c@example.com', subject: emailSubject('passwordResetSelf'), body: `סיסמה זמנית: ${FAKE_PW}` });
  assert.equal(created[0].body, SECRET_BODY_PLACEHOLDER);
});
await t('כשל שליחה: גם שורת שגיאה לא שומרת את הסיסמה', async () => {
  created.length = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ status: 200, text: async () => JSON.stringify({ status: 'error', message: 'boom' }) });
  try {
    const r = await sendSystemEmail({ to: 'd@example.com', subject: emailSubject('passwordResetManager'), emailId: 'passwordResetManager', body: `סיסמה זמנית: ${FAKE_PW}` });
    assert.equal(r.success, false);
  } finally { globalThis.fetch = realFetch; }
  assert.equal(created[0].status, 'error');
  assert.equal(created[0].body, SECRET_BODY_PLACEHOLDER);
});
await t('emailId לא מוכר נכשל לפני השליחה (לא יוצא מייל)', async () => {
  sentPayloads.length = 0;
  await assert.rejects(() => sendSystemEmail({ to: 'e@example.com', subject: 's', emailId: 'typo', body: 'x' }), /לא מוכר/);
  assert.equal(sentPayloads.length, 0);
});

console.log('GET /api/email-logs (מתכנת, ישן)');
await t('שורה חדשה של איפוס סיסמה מוחזרת עם ממלא המקום ולא עם הסיסמה', async () => {
  created.length = 0;
  await sendSystemEmail({ to: 'f@example.com', subject: emailSubject('passwordResetSelf'), emailId: 'passwordResetSelf', body: `סיסמה זמנית: ${FAKE_PW}` });
  const { GET } = await import('../app/api/email-logs/route.js');
  const res = await GET({ url: 'http://localhost/api/email-logs?page=1&limit=50' });
  const out = await res.json();
  assert.equal(out.success, true);
  assert.equal(out.data.length, 1);
  assert.equal(out.data[0].body, SECRET_BODY_PLACEHOLDER);
  assert.ok(!JSON.stringify(out).includes(FAKE_PW));
});

console.log('חוזה סטטי');
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.next', 'scratch', '.git'].includes(name)) continue;
    const p = path.join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out); else if (/\.(js|mjs|jsx)$/.test(name)) out.push(p);
  }
  return out;
}
await t('כל קובץ ששולח emailSubject(<מייל containsSecret>) מעביר גם emailId עם אותו מזהה', () => {
  const secretIds = Object.entries(EMAIL_CATALOG).filter(([, e]) => e.containsSecret).map(([id]) => id);
  const files = [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'lib'))];
  let found = 0;
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const id of secretIds) {
      if (!src.includes(`emailSubject('${id}'`)) continue;
      found++;
      assert.ok(src.includes(`emailId: '${id}'`), `${path.relative(ROOT, f)} שולח את ${id} בלי emailId`);
    }
  }
  assert.ok(found >= 2, 'שני אתרי השליחה של איפוס הסיסמה נמצאו');
});
await t('EMAILS.md מתעד את containsSecret', () => {
  assert.ok(/containsSecret/.test(read('EMAILS.md')), 'EMAILS.md לא מתעד את containsSecret');
});
await t('mailer.js כותב ל-EmailLog את loggedBody ולא את body הגולמי', () => {
  const m = read('lib/mailer.js');
  assert.ok(/body: loggedBody,/.test(m));
  assert.ok(!/body: body \|\| null,/.test(m));
});

console.log(`\n${passed} passed${process.exitCode ? ' (WITH FAILURES)' : ''}`);
