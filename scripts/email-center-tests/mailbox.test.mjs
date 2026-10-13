// בדיקות תיבת המייל (/api/admin/mailbox + lib/hostingerMailbox.js) - fetch/auth/prisma מדומים, בלי רשת ובלי DB.
// הרצה: node scripts/email-center-tests/mailbox.test.mjs
import assert from 'node:assert/strict';
import { register } from 'node:module';
import './alias-register.mjs';

register('data:text/javascript,' + encodeURIComponent(String.raw`
export async function resolve(spec, ctx, next) {
  if (spec === '@/app/lib/prisma') return { url: 'stub:prisma', shortCircuit: true, format: 'module' };
  if (spec === '@/lib/settingsCache') return { url: 'stub:settings', shortCircuit: true, format: 'module' };
  if (spec === '@/lib/auth') return { url: 'stub:auth', shortCircuit: true, format: 'module' };
  if (spec === 'next/server') return { url: 'stub:next-server', shortCircuit: true, format: 'module' };
  return next(spec, ctx);
}
export async function load(url, ctx, next) {
  if (url === 'stub:prisma') return { format: 'module', shortCircuit: true, source: 'export default { emailLog: { create: async (a) => { (globalThis.__logs ||= []).push(a.data); return {}; } } };' };
  if (url === 'stub:settings') return { format: 'module', shortCircuit: true, source: 'export const getCachedSetting = async () => "גמח נווה יעקב";' };
  if (url === 'stub:auth') return { format: 'module', shortCircuit: true, source: 'export const checkAuth = async (role, opts) => { globalThis.__authCalls = (globalThis.__authCalls || []).concat([[role, opts]]); return globalThis.__authOk !== false; };' };
  if (url === 'stub:next-server') return { format: 'module', shortCircuit: true, source: 'export class NextResponse extends Response { static json(b, i) { return Response.json(b, i); } }' };
  return next(url, ctx);
}`), import.meta.url);

process.env.HOSTINGER_MAIL_TOKEN = 'tok';
process.env.HOSTINGER_MAILBOX_ID = 'AC1';
const { GET, POST } = await import('@/app/api/admin/mailbox/route');

let passed = 0;
async function t(name, fn) { try { await fn(); passed++; console.log(`  ok  ${name}`); } catch (e) { console.error(`  FAIL ${name}\n`, e); process.exitCode = 1; } }

const realFetch = globalThis.fetch;
let calls = [];
const FOLDERS = [
  { path: 'INBOX', name: 'INBOX', specialUse: null, messageCount: 3, unreadCount: 1 },
  { path: 'INBOX.Sent', name: 'Sent', specialUse: '\\Sent', messageCount: 2, unreadCount: 0 },
  { path: 'INBOX.Trash', name: 'Trash', specialUse: '\\Trash', messageCount: 0, unreadCount: 0 },
];
function mock() {
  calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(String(url));
    const method = init.method || 'GET';
    calls.push({ path: decodeURIComponent(u.pathname), search: u.search, method, body: init.body ? JSON.parse(init.body) : null, headers: init.headers });
    const p = decodeURIComponent(u.pathname);
    const json = (status, data) => ({ ok: status < 400, status, text: async () => JSON.stringify(data), json: async () => data });
    if (p === '/api/v1/me') return json(200, { data: { mailboxes: [{ resourceId: 'AC1', address: 'gsmalot@rinatlev.org.il' }] } });
    if (p.endsWith('/quota')) return json(200, { data: { supported: true, totalUsage: 1000, totalLimit: 100000, totalPercentage: 1, quotas: [] } });
    if (p.endsWith('/folders')) return json(200, { data: FOLDERS });
    if (p.endsWith('/text')) return json(200, { data: { text: 'שלום', html: '<p>שלום</p>' } });
    if (p.includes('/attachments/')) return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode('PDFDATA').buffer };
    if (/\/messages\/\d+$/.test(p) && method === 'GET') return json(200, { data: { uid: 7, subject: 'נושא', flags: [], unseen: true, from: { name: 'לקוחה', address: 'c@example.test' }, to: [], cc: [], attachments: [] } });
    if (p.endsWith('/messages') || p.endsWith('/messages/search')) return json(200, { data: [{ uid: 7, subject: 'נושא', unseen: true }], pagination: { page: 1, totalPages: 1, total: 1 } });
    if (method === 'PATCH' || method === 'DELETE' || p.endsWith('/send') || p.endsWith('/move')) return { ok: true, status: 204, text: async () => '' };
    return json(404, { error: 'not found' });
  };
}
const get = (qs) => GET(new Request('http://x/api/admin/mailbox?' + qs));
const post = (body) => POST(new Request('http://x/api/admin/mailbox', { method: 'POST', body: JSON.stringify(body) }));

console.log('mailbox');

await t('בלי הרשאה: 401, והשער נבדק fail-closed', async () => {
  globalThis.__authOk = false; mock();
  assert.equal((await get('action=status')).status, 401);
  assert.equal((await post({ action: 'send' })).status, 401);
  assert.equal(calls.length, 0, 'בלי הרשאה לא פונים ל-Hostinger');
  assert.deepEqual(globalThis.__authCalls.at(-1), ['הנהלה ראשית', { failClosed: true }]);
  globalThis.__authOk = true;
});

await t('סטטוס: כתובת התיבה, תיקיות ונפח', async () => {
  mock();
  const r = await get('action=status'); const j = await r.json();
  assert.equal(j.enabled, true);
  assert.equal(j.address, 'gsmalot@rinatlev.org.il');
  assert.equal(j.folders.length, 3);
  assert.equal(j.quota.totalUsage, 1000);
  assert.ok(calls.every((c) => !c.headers || c.headers.Authorization === 'Bearer tok'));
});

await t('רשימת הודעות: דפדוף, מיון וחיפוש (POST /search)', async () => {
  mock();
  const j = await (await get('action=messages&folder=INBOX&page=2')).json();
  assert.equal(j.data[0].uid, 7);
  assert.match(calls[0].path, /\/folders\/INBOX\/messages$/);
  assert.match(calls[0].search, /page=2/);
  assert.match(calls[0].search, /sort=-date/);
  mock();
  await get('action=messages&folder=INBOX.Sent&q=' + encodeURIComponent('הזמנה 5'));
  assert.equal(calls[0].method, 'POST');
  assert.match(calls[0].path, /INBOX\.Sent\/messages\/search$/);
  assert.deepEqual(calls[0].body, { subject: 'הזמנה 5', from: 'הזמנה 5', to: 'הזמנה 5', body: 'הזמנה 5' });
});

await t('קלט לא תקין נדחה לפני שפונים ל-Hostinger', async () => {
  mock();
  for (const qs of ['action=messages&folder=../etc', 'action=messages&folder=INBOX%2F..%2F..', 'action=message&folder=INBOX&uid=abc', 'action=message&folder=INBOX&uid=1;DROP', 'action=attachment&folder=INBOX&uid=1']) {
    assert.equal((await get(qs)).status, 400, qs);
  }
  assert.equal((await post({ action: 'move', folder: 'INBOX', uid: 1, targetFolder: 'a b?x' })).status, 400);
  assert.equal(calls.length, 0);
});

await t('קריאת הודעה: מחזירה גוף ומסמנת כנקראה', async () => {
  mock();
  const j = await (await get('action=message&folder=INBOX&uid=7')).json();
  assert.equal(j.message.body.html, '<p>שלום</p>');
  const patch = calls.find((c) => c.method === 'PATCH');
  assert.deepEqual(patch.body, { addFlags: ['\\Seen'] });
});

await t('קובץ מצורף: תמיד הורדה (לא inline) עם שם מנוקה', async () => {
  mock();
  const name = encodeURIComponent('report"x.html');
  const r = await get('action=attachment&folder=INBOX&uid=7&id=ABC&name=' + name);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/octet-stream');
  assert.match(r.headers.get('content-disposition'), /^attachment; filename\*=UTF-8''/);
  assert.ok(!r.headers.get('content-disposition').includes('"'));
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(Buffer.from(await r.arrayBuffer()).toString(), 'PDFDATA');
});

await t('דגלים: רק \\Seen ו-\\Flagged', async () => {
  mock();
  assert.equal((await post({ action: 'flags', folder: 'INBOX', uid: 7, addFlags: ['\\Deleted'] })).status, 400);
  assert.equal((await post({ action: 'flags', folder: 'INBOX', uid: 7, addFlags: ['\\Flagged'], removeFlags: ['\\Seen'] })).status, 200);
  assert.deepEqual(calls.at(-1).body, { addFlags: ['\\Flagged'], removeFlags: ['\\Seen'] });
});

await t('מחיקה: מהתיבה לאשפה, ומהאשפה סופית', async () => {
  mock();
  let j = await (await post({ action: 'delete', folder: 'INBOX', uid: 7 })).json();
  assert.equal(j.movedToTrash, true);
  const mv = calls.find((c) => c.path.endsWith('/move'));
  assert.deepEqual(mv.body, { targetFolder: 'INBOX.Trash' });
  assert.ok(!calls.some((c) => c.method === 'DELETE'));
  mock();
  j = await (await post({ action: 'delete', folder: 'INBOX.Trash', uid: 7 })).json();
  assert.equal(j.movedToTrash, false);
  assert.ok(calls.some((c) => c.method === 'DELETE' && c.path.endsWith('/messages/7')));
});

await t('שליחה: נמענים, תשובה (inReplyTo), שם שולח, תיעוד ב-EmailLog', async () => {
  mock(); globalThis.__logs = [];
  const r = await post({ action: 'send', to: 'a@example.test, b@example.test', cc: 'c@example.test', subject: 'Re: נושא', text: 'שלום <b>', replyTo: { uid: 7, folder: 'INBOX' } });
  assert.equal(r.status, 200);
  const sent = calls.find((c) => c.path.endsWith('/send')).body;
  assert.deepEqual(sent.to, ['a@example.test', 'b@example.test']);
  assert.deepEqual(sent.cc, ['c@example.test']);
  assert.deepEqual(sent.inReplyTo, { uid: 7, folder: 'INBOX' });
  assert.equal(sent.displayName, 'גמח נווה יעקב');
  assert.match(sent.html, /dir="rtl"/);
  assert.ok(sent.html.includes('&lt;b&gt;') && !sent.html.includes('<b>'), 'HTML בגוף מנוקה');
  assert.equal(globalThis.__logs.length, 1);
  assert.equal(globalThis.__logs[0].status, 'success');
});

await t('שליחה: קלט שגוי נדחה (נמען חסר/כתובת/ריק/קובץ גדול/פורמט קובץ)', async () => {
  mock();
  assert.equal((await post({ action: 'send', to: '', subject: 's', text: 't' })).status, 400);
  assert.equal((await post({ action: 'send', to: 'bad', subject: 's', text: 't' })).status, 400);
  assert.equal((await post({ action: 'send', to: 'a@example.test', subject: '', text: ' ' })).status, 400);
  assert.equal((await post({ action: 'send', to: 'a@example.test', subject: 's', text: 't', attachments: [{ filename: 'a.pdf', content: 'A'.repeat(5 * 1024 * 1024) }] })).status, 400);
  assert.equal((await post({ action: 'send', to: 'a@example.test', subject: 's', text: 't', attachments: [{ filename: 'a.pdf', content: '<script>' }] })).status, 400);
  assert.ok(!calls.some((c) => c.path.endsWith('/send')));
});

await t('שליחה שנכשלה ב-Hostinger: שגיאה למשתמש + שורת שגיאה ב-EmailLog', async () => {
  mock(); globalThis.__logs = [];
  const f = globalThis.fetch;
  globalThis.fetch = async (url, init) => (String(url).endsWith('/send') ? { ok: false, status: 401, text: async () => JSON.stringify({ error: 'Unauthenticated' }) } : f(url, init));
  const r = await post({ action: 'send', to: 'a@example.test', subject: 's', text: 't' });
  assert.equal(r.status, 502);
  assert.match((await r.json()).error, /401.*Unauthenticated/);
  assert.equal(globalThis.__logs[0].status, 'error');
});

await t('תיבה לא מחוברת (הגמח הראשי): enabled=false, בלי פנייה לרשת', async () => {
  delete process.env.HOSTINGER_MAIL_TOKEN; mock();
  assert.deepEqual(await (await get('action=status')).json(), { enabled: false });
  assert.equal((await get('action=folders')).status, 503);
  assert.equal(calls.length, 0);
});

globalThis.fetch = realFetch;
console.log(`\n${passed} בדיקות עברו${process.exitCode ? ' (יש כשלים)' : ''}`);
