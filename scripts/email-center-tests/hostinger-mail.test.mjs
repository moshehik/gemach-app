// בדיקות השליחה דרך Hostinger Mail API (lib/hostingerMail.js + הניתוב ב-postToMailer) - fetch/prisma מדומים, בלי רשת ובלי DB.
// הרצה: node scripts/email-center-tests/hostinger-mail.test.mjs
import assert from 'node:assert/strict';
import { register } from 'node:module';
import './alias-register.mjs';

register('data:text/javascript,' + encodeURIComponent(String.raw`
export async function resolve(spec, ctx, next) {
  if (spec === '@/app/lib/prisma') return { url: 'stub:prisma', shortCircuit: true, format: 'module' };
  if (spec === '@/lib/settingsCache') return { url: 'stub:settings', shortCircuit: true, format: 'module' };
  return next(spec, ctx);
}
export async function load(url, ctx, next) {
  if (url === 'stub:prisma') return { format: 'module', shortCircuit: true, source: 'export default { emailLog: { create: async () => ({}) } };' };
  if (url === 'stub:settings') return { format: 'module', shortCircuit: true, source: 'export const getAllCachedSettings = async () => [{ key: "gmach_name", value: "גמח נווה יעקב" }]; export const getCachedSetting = async () => ""; export const invalidateSettingsCache = () => {};' };
  return next(url, ctx);
}`), import.meta.url);

delete process.env.EMAIL_DRY_RUN;
delete process.env.HOSTINGER_MAIL_TOKEN;
delete process.env.HOSTINGER_MAILBOX_ID;

const { postToMailer, buildGasPayload } = await import('@/lib/mailer');
const { isHostingerMailEnabled, canSendViaHostinger, buildHostingerSendBody, _setPdfRenderer } = await import('@/lib/hostingerMail');

let passed = 0;
async function t(name, fn) { try { await fn(); passed++; console.log(`  ok  ${name}`); } catch (e) { console.error(`  FAIL ${name}\n`, e); process.exitCode = 1; } }

const realFetch = globalThis.fetch;
let calls = [];
function mockFetch(handler) {
  calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return handler(String(url), init); };
}
const res = (status, body) => ({ status, text: async () => (body == null ? '' : typeof body === 'string' ? body : JSON.stringify(body)) });
const enable = () => { process.env.HOSTINGER_MAIL_TOKEN = 'test-token'; process.env.HOSTINGER_MAILBOX_ID = 'AC123'; };
const disable = () => { delete process.env.HOSTINGER_MAIL_TOKEN; delete process.env.HOSTINGER_MAILBOX_ID; };

console.log('hostinger-mail');

await t('כבוי כברירת מחדל: בלי משתנים לא קוראים ל-Hostinger והשליחה הולכת ל-Apps Script', async () => {
  disable();
  assert.equal(isHostingerMailEnabled(), false);
  mockFetch(() => res(200, { status: 'success' }));
  const r = await postToMailer(buildGasPayload({ to: 'a@example.test', subject: 'x', body: 'y' }));
  assert.equal(r.isSuccess, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /script\.google\.com/);
});

await t('דלוק רק כששני המשתנים קיימים', () => {
  process.env.HOSTINGER_MAIL_TOKEN = 't'; delete process.env.HOSTINGER_MAILBOX_ID;
  assert.equal(isHostingerMailEnabled(), false);
  enable();
  assert.equal(isHostingerMailEnabled(), true);
});

await t('מייל רגיל יוצא ל-API: כתובת, Bearer, גוף ושם שולח', async () => {
  enable();
  mockFetch(() => res(204, null));
  const r = await postToMailer(buildGasPayload({ to: 'a@example.test, b@example.test', cc: 'c@example.test', subject: 'נושא', body: 'שלום', htmlBody: '<p>שלום</p>' }));
  assert.equal(r.isSuccess, true);
  assert.equal(r.result.via, 'hostinger');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.mail.hostinger.com/api/v1/mailboxes/AC123/send');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer test-token');
  const sent = JSON.parse(calls[0].init.body);
  assert.deepEqual(sent.to, ['a@example.test', 'b@example.test']);
  assert.deepEqual(sent.cc, ['c@example.test']);
  assert.equal(sent.subject, 'נושא');
  assert.equal(sent.html, '<p>שלום</p>');
  assert.match(sent.text, /שלום/);
  assert.equal(sent.displayName, 'גמח נווה יעקב');
  assert.equal(sent.attachments, undefined, 'קובץ ממלא המקום של Apps Script לא נשלח');
});

await t('קובץ אמיתי מצורף בשמות של ה-API (filename/content/contentType)', async () => {
  enable();
  mockFetch(() => res(204, null));
  const payload = buildGasPayload({ to: 'a@example.test', subject: 's', body: 'b', attachments: [{ fileName: 'a.pdf', fileContent: 'QUJD', mimeType: 'application/pdf' }] });
  await postToMailer(payload);
  const sent = JSON.parse(calls[0].init.body);
  assert.deepEqual(sent.attachments, [{ filename: 'a.pdf', content: 'QUJD', contentType: 'application/pdf' }]);
});

await t('פעולות אחרות של Apps Script ושליחה לדרייב נשארות ב-Apps Script', async () => {
  enable();
  assert.equal(canSendViaHostinger({ action: 'somethingElse', to: 'a@example.test' }), false);
  assert.equal(canSendViaHostinger(buildGasPayload({ to: 'a@example.test', sendMode: 'drive', attachments: [{ fileName: 'a', fileContent: 'QQ==', dest: 'drive' }] })), false);
  assert.equal(canSendViaHostinger({ action: 'sendGemachOrderEmail', to: 'a@example.test', sendMode: 'both' }), false);
  mockFetch(() => res(200, { status: 'success' }));
  await postToMailer({ action: 'somethingElse', to: 'a@example.test', subject: 's', htmlBody: '<p/>' });
  assert.match(calls[0].url, /script\.google\.com/);
});

const orderCard = (extra = {}) => ({
  action: 'sendGemachOrderEmail', to: 'a@example.test', cc: '', subject: 'כרטיס הזמנה', htmlBody: '<html>REPORT</html>', bodyText: '<p>מצורף</p>',
  fileName: 'הזמנה 5.pdf', body: 'מצורף כרטיס הזמנה/השכרה.', fileContent: '', attachments: [], sendMode: 'email', ...extra,
});

await t('כרטיס הזמנה: PDF מהדפדפן מצורף למייל רגיל ב-Hostinger, בלי Apps Script', async () => {
  enable();
  let rendered = 0; _setPdfRenderer(async () => { rendered++; return Buffer.from('x'); });
  mockFetch(() => res(204, null));
  const r = await postToMailer(orderCard({ fileContent: 'UERG', attachments: [{ fileName: 'הזמנה 5.pdf', fileContent: 'UERG', mimeType: 'application/pdf', dest: 'email' }] }));
  assert.equal(r.isSuccess, true);
  assert.equal(r.result.via, 'hostinger');
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /api\.mail\.hostinger\.com/);
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(sent.html, '<p>מצורף</p>');
  assert.deepEqual(sent.attachments, [{ filename: 'הזמנה 5.pdf', content: 'UERG', contentType: 'application/pdf' }]);
  assert.equal(rendered, 0, 'יש כבר PDF מהדפדפן - לא מרנדרים שוב');
});

await t('כרטיס הזמנה בלי PDF מהדפדפן: ה-PDF נוצר בשרת מדוח ההזמנה', async () => {
  enable();
  let seen = null; _setPdfRenderer(async ({ html, format }) => { seen = { html, format }; return Buffer.from('PDFBYTES'); });
  mockFetch(() => res(204, null));
  const r = await postToMailer(orderCard());
  assert.equal(r.isSuccess, true);
  assert.deepEqual(seen, { html: '<html>REPORT</html>', format: 'A4' });
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(sent.attachments.length, 1);
  assert.equal(sent.attachments[0].filename, 'הזמנה 5.pdf');
  assert.equal(sent.attachments[0].content, Buffer.from('PDFBYTES').toString('base64'));
  assert.equal(sent.attachments[0].contentType, 'application/pdf');
});

await t('כרטיס הזמנה: צרופות נוספות נשמרות ובדוח ה-HTML לא נשלח כגוף המייל', async () => {
  enable();
  _setPdfRenderer(async () => Buffer.from('P'));
  mockFetch(() => res(204, null));
  await postToMailer(orderCard({ body: '<html>REPORT</html>', attachments: [{ fileName: 'תקנון.pdf', fileContent: 'VEs=', mimeType: 'application/pdf', dest: 'email' }] }));
  const sent = JSON.parse(calls[0].init.body);
  assert.deepEqual(sent.attachments.map((a) => a.filename), ['הזמנה 5.pdf', 'תקנון.pdf']);
  assert.equal(sent.text, 'מצורף כרטיס הזמנה/השכרה.');
});

await t('כרטיס הזמנה: יצירת ה-PDF נכשלה = נופל ל-Apps Script (המייל לא יצא)', async () => {
  enable();
  _setPdfRenderer(async () => { throw new Error('chromium missing'); });
  mockFetch(() => res(200, { status: 'success' }));
  const r = await postToMailer(orderCard());
  assert.equal(r.isSuccess, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /script\.google\.com/);
  assert.equal(JSON.parse(calls[0].init.body).action, 'sendGemachOrderEmail');
});

await t('401/403/429 נופלים ל-Apps Script (המייל לא יצא)', async () => {
  enable();
  mockFetch((url) => (url.includes('hostinger') ? res(401, { error: 'Unauthenticated', code: 'ERR_UNAUTHENTICATED' }) : res(200, { status: 'success' })));
  const r = await postToMailer(buildGasPayload({ to: 'a@example.test', subject: 's', body: 'b' }));
  assert.equal(r.isSuccess, true);
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /script\.google\.com/);
});

await t('422 ושגיאת שרת/רשת = כשל ולא כפילות: אין נפילה ל-Apps Script', async () => {
  enable();
  mockFetch(() => res(422, { error: 'The given data was invalid.', code: 'ERR_VALIDATION_FAILED', params: { to: ['bad'] } }));
  let r = await postToMailer(buildGasPayload({ to: 'a@example.test', subject: 's', body: 'b' }));
  assert.equal(r.isSuccess, false);
  assert.match(r.message, /422.*ERR_VALIDATION_FAILED/);
  assert.equal(calls.length, 1);
  mockFetch(() => { throw new Error('socket hang up'); });
  r = await postToMailer(buildGasPayload({ to: 'a@example.test', subject: 's', body: 'b' }));
  assert.equal(r.isSuccess, false);
  assert.equal(calls.length, 1, 'ניתוק = אי-ודאות אם יצא, לא שולחים שוב');
});

await t('כתובת לא תקינה לא מגיעה ל-API', async () => {
  enable();
  mockFetch(() => res(204, null));
  const r = await postToMailer(buildGasPayload({ to: 'not-an-address', subject: 's', body: 'b' }));
  assert.equal(r.isSuccess, false);
  assert.equal(calls.length, 0);
  assert.deepEqual(buildHostingerSendBody({ to: 'x@y.z;w@y.z' }).to, ['x@y.z', 'w@y.z']);
});

globalThis.fetch = realFetch;
disable();
console.log(`\n${passed} בדיקות עברו${process.exitCode ? ' (יש כשלים)' : ''}`);
