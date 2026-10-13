// בדיקות הלוגיקה הטהורה של תיבת המייל (app/components/mailbox/mailboxLogic.js) - בלי React ובלי רשת.
// הרצה: node scripts/email-center-tests/mailbox-logic.test.mjs
import assert from 'node:assert/strict';
import './alias-register.mjs';

const L = await import('../../app/components/mailbox/mailboxLogic.js');

let passed = 0;
function t(name, fn) { try { fn(); passed++; console.log(`  ok  ${name}`); } catch (e) { console.error(`  FAIL ${name}\n`, e); process.exitCode = 1; } }

console.log('mailbox-logic');

t('תיקיות: שם ואייקון לפי specialUse, ונכנסים תמיד "נכנסים"', () => {
  assert.equal(L.folderLabel({ path: 'INBOX', name: 'INBOX', specialUse: null }), 'נכנסים');
  assert.equal(L.folderLabel({ path: 'INBOX.Sent', name: 'Sent', specialUse: '\\Sent' }), 'נשלחו');
  assert.equal(L.folderLabel({ path: 'INBOX.Trash', name: 'Trash', specialUse: '\\Trash' }), 'אשפה');
  assert.equal(L.folderLabel({ path: 'INBOX.Spam', name: 'Spam', specialUse: null }), 'ספאם');
  assert.equal(L.folderLabel({ path: 'INBOX.לקוחות', name: 'לקוחות', specialUse: null }), 'לקוחות');
  assert.equal(L.folderIcon({ path: 'INBOX', specialUse: null }), 'inbox');
  assert.equal(L.folderIcon({ path: 'x', specialUse: '\\Sent' }), 'send');
  assert.equal(L.folderIcon({ path: 'x', specialUse: null }), 'bookmark');
  assert.equal(L.isOutgoingFolder({ specialUse: '\\Drafts' }), true);
  assert.equal(L.isOutgoingFolder({ specialUse: null }), false);
  assert.equal(L.isTrashFolder({ specialUse: '\\Trash' }), true);
});

t('כתובות: כל צורה שה-API עלול להחזיר הופכת למחרוזות (לא "[object Object]")', () => {
  assert.deepEqual(L.normAddr({ name: 'רחל', address: 'r@x.co' }), { name: 'רחל', address: 'r@x.co' });
  assert.deepEqual(L.normAddr('a@b.co'), { name: '', address: 'a@b.co' });
  assert.deepEqual(L.normAddr({ name: '', address: 'a@b.co' }), { name: '', address: 'a@b.co' });
  assert.deepEqual(L.normAddr({ name: { name: 'גמח', address: 'g@x.co' }, address: 'g@x.co' }), { name: 'גמח', address: 'g@x.co' });
  assert.deepEqual(L.normAddr({ name: 'a@b.co', address: 'a@b.co' }), { name: '', address: 'a@b.co' }, 'שם זהה לכתובת = בלי שם');
  assert.equal(L.normAddr(null), null);
  for (const v of [{ name: { x: 1 }, address: 'a@b.co' }, { name: 5, address: 'a@b.co' }]) {
    const n = L.normAddr(v);
    assert.equal(typeof n.name, 'string');
    assert.ok(!/object/i.test(L.addrText(v)));
  }
  assert.equal(L.addrText({ name: 'רחל', address: 'r@x.co' }), 'רחל <r@x.co>');
  assert.equal(L.addrShort({ name: '', address: 'r@x.co' }), 'r@x.co');
  assert.deepEqual(L.addrList([{ address: 'a@b.co' }, null, { name: '', address: '' }]).map((x) => x.address), ['a@b.co']);
});

t('שורת רשימה: נכנסים מציגים שולח, נשלחו מציגים נמענים; נקרא / מסומן / קבצים', () => {
  const m = { uid: 7, subject: '  ', date: '2026-10-13T10:00:00Z', flags: ['\\Flagged'], unseen: true, from: { name: 'לקוחה', address: 'c@x.co' }, to: [{ name: '', address: 'me@x.co' }, { name: 'דנה', address: 'd@x.co' }], cc: [], attachments: [{ id: 'a', filename: 'f.pdf' }, { id: 'b', inline: true, filename: null }] };
  const inbox = L.mailRow(m, false);
  assert.equal(inbox.id, 7);
  assert.equal(inbox.who, 'לקוחה');
  assert.equal(inbox.subject, '(ללא נושא)');
  assert.equal(inbox.unseen, true);
  assert.equal(inbox.flagged, true);
  assert.equal(inbox.files, 1, 'תמונה מוטמעת בלי שם לא נספרת');
  assert.equal(L.mailRow(m, true).who, 'me@x.co, דנה');
  assert.equal(L.mailRow({ uid: 1, flags: ['\\Seen'], from: null, to: [] }, false).unseen, false, 'בלי שדה unseen: לפי הדגל \\Seen');
  assert.equal(L.mailRow({ uid: 1, flags: [], from: null, to: [] }, false).who, '(ללא)');
});

t('שדות כתובות: פיצול, ללא כפילויות (לא תלוי רישיות), הוספה', () => {
  assert.deepEqual(L.splitAddresses('a@x.co, B@x.co;a@X.CO  c@x.co'), ['a@x.co', 'B@x.co', 'c@x.co']);
  assert.equal(L.hasAddress('a@x.co, b@x.co', 'B@X.co'), true);
  assert.equal(L.addAddress('a@x.co', 'b@x.co'), 'a@x.co, b@x.co');
  assert.equal(L.addAddress('a@x.co', 'A@x.co'), 'a@x.co', 'כבר קיימת - לא מוסיף');
  assert.equal(L.addAddress('', 'b@x.co'), 'b@x.co');
  assert.ok(L.EMAIL_RE.test('a@b.co') && !L.EMAIL_RE.test('bad') && !L.EMAIL_RE.test('a b@c.co'));
});

t('תשובה / תשובה לכולם / העברה: נמענים, נושא וציטוט', () => {
  const msg = { subject: 'שאלה', date: '2026-10-13T10:00:00Z', from: { name: 'רחל', address: 'r@x.co' }, to: [{ address: 'me@x.co' }, { address: 'dana@x.co' }], cc: [{ address: 'cc@x.co' }], body: { text: 'שורה 1\nשורה 2' } };
  const ref = { uid: 9, folder: 'INBOX' };
  const reply = L.composeDraft('reply', msg, ref, 'me@x.co');
  assert.equal(reply.to, 'r@x.co');
  assert.equal(reply.cc, '');
  assert.equal(reply.subject, 'Re: שאלה');
  assert.deepEqual(reply.replyTo, ref);
  assert.match(reply.text, /> שורה 1\n> שורה 2/);
  const all = L.composeDraft('replyAll', msg, ref, 'ME@x.co');
  assert.equal(all.cc, 'dana@x.co, cc@x.co', 'בלי התיבה עצמה ובלי השולח');
  assert.equal(L.composeDraft('reply', { ...msg, subject: 'Re: שאלה' }, ref, '').subject, 'Re: שאלה', 'בלי Re: כפול');
  const fwd = L.composeDraft('forward', msg, ref, 'me@x.co');
  assert.equal(fwd.to, '');
  assert.equal(fwd.subject, 'Fwd: שאלה');
  assert.deepEqual(fwd.forwardOf, ref);
  assert.equal(fwd.replyTo, undefined);
  assert.deepEqual(L.composeDraft('new', null, null, ''), { kind: 'new', to: '', cc: '', bcc: '', subject: '', text: '', files: [] });
});

t('גוף ההודעה ב-iframe: CSP בלי סקריפטים; תמונות מרוחקות רק באישור', () => {
  const blocked = L.frameDoc('<p>x</p>', false);
  assert.match(blocked, /default-src 'none'/);
  assert.ok(!/img-src[^"]*https:/.test(blocked));
  assert.match(L.frameDoc('<p>x</p>', true), /img-src data: cid: https: http:/);
  assert.equal(L.hasRemoteImages('<img src="https://t.co/x.gif">'), true);
  assert.equal(L.hasRemoteImages('<img src="data:image/png;base64,AA">'), false);
  assert.equal(L.fmtBytes(2048), '2KB');
  assert.equal(L.fmtBytes(3 * 1048576), '3.0MB');
});

console.log(`\n${passed} בדיקות עברו${process.exitCode ? ' (יש כשלים)' : ''}`);
