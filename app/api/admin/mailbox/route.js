import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { normalizeEmail } from '@/lib/emailUtils';
import { getCachedSetting } from '@/lib/settingsCache';
import {
  MailboxError, MAX_SEND_ATTACHMENT_BYTES, isMailboxEnabled, validFolder, validUid,
  listFolders, getQuota, getAddress, listMessages, getMessage, downloadAttachment, updateFlags, moveMessage, deleteMessage, sendMail,
} from '@/lib/hostingerMailbox';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// תיבת מייל (/admin/mailbox): קריאה, חיפוש וכתיבה של תיבת Hostinger של האתר (נווה יעקב). הנהלה ראשית בלבד, וגם כש"חובת התחברות" כבויה
// (failClosed) - התיבה חושפת את כל התכתובת. כל קריאה עוברת כאן (הטוקן לא יוצא לדפדפן). גוף המייל מוצג בדפדפן בתוך iframe מוגבל (sandbox).

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const MAX_RECIPIENTS = 50;
const MAX_BODY = 200000;

const json = (body, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

function fail(e) {
  if (e instanceof MailboxError) {
    console.error('[mailbox]', e.message);
    return json({ error: e.message }, [400, 404, 429, 503].includes(e.status) ? e.status : 502);
  }
  console.error('[mailbox] unexpected', e);
  return json({ error: 'שגיאה לא צפויה בתיבת המייל' }, 500);
}

async function authorized() {
  return !!(await checkAuth('הנהלה ראשית', { failClosed: true }));
}

function addrList(v) {
  const list = Array.isArray(v) ? v : String(v || '').split(/[,;\s]+/);
  return [...new Set(list.map((s) => String(s || '').trim()).filter(Boolean))];
}

const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function pickFolder(raw, fallback = 'INBOX') {
  const f = raw == null || raw === '' ? fallback : raw;
  if (!validFolder(f)) throw new MailboxError('תיקייה לא תקינה', 400);
  return f;
}
function pickUid(raw) {
  if (!validUid(raw)) throw new MailboxError('מזהה הודעה לא תקין', 400);
  return Number(raw);
}

export async function GET(request) {
  if (!(await authorized())) return json({ error: 'Unauthorized' }, 401);
  const sp = new URL(request.url).searchParams;
  const action = sp.get('action') || 'status';
  try {
    if (action === 'status') {
      if (!isMailboxEnabled()) return json({ enabled: false });
      const [folders, quota, address] = await Promise.all([listFolders(), getQuota(), getAddress()]);
      return json({ enabled: true, address, folders, quota });
    }
    if (action === 'folders') return json({ folders: await listFolders() });
    if (action === 'messages') {
      const folder = pickFolder(sp.get('folder'));
      const page = Math.max(1, Math.min(1000, Number(sp.get('page')) || 1));
      const perPage = Math.max(5, Math.min(100, Number(sp.get('perPage')) || 30));
      const q = String(sp.get('q') || '').trim().slice(0, 200);
      return json(await listMessages(folder, { page, perPage, q }));
    }
    if (action === 'message') {
      const folder = pickFolder(sp.get('folder'));
      const uid = pickUid(sp.get('uid'));
      const msg = await getMessage(folder, uid);
      // קריאת הודעה = נקראה (כמו בכל תיבת דואר); כשל בסימון לא מפיל את הקריאה
      if (msg && Array.isArray(msg.flags) && !msg.flags.includes('\\Seen')) {
        try { await updateFlags(folder, uid, { addFlags: ['\\Seen'] }); } catch (e) { console.warn('[mailbox] mark seen failed', e.message); }
      }
      return json({ message: msg });
    }
    if (action === 'attachment') {
      const folder = pickFolder(sp.get('folder'));
      const uid = pickUid(sp.get('uid'));
      const id = String(sp.get('id') || '');
      if (!id || id.length > 500) throw new MailboxError('מזהה קובץ לא תקין', 400);
      const upstream = await downloadAttachment(folder, uid, id);
      const name = String(sp.get('name') || 'attachment').replace(/[\r\n"\\/]/g, '_').slice(0, 150) || 'attachment';
      const buf = Buffer.from(await upstream.arrayBuffer());
      return new NextResponse(buf, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'private, no-store',
        },
      });
    }
    if (action === 'customers') return json({ customers: await searchCustomers(sp.get('q')) });
    return json({ error: 'פעולה לא מוכרת' }, 400);
  } catch (e) {
    return fail(e);
  }
}

// בחירת נמענים מרשימת הלקוחות (חלון הכתיבה): חיפוש לפי שם / טלפון / מייל, רק לקוחות עם מייל, עד 20 תוצאות.
async function searchCustomers(raw) {
  const tokens = String(raw || '').trim().slice(0, 80).split(/\s+/).filter(Boolean).slice(0, 4);
  if (!tokens.length || tokens.join('').length < 2) return [];
  const ins = (field, v) => ({ [field]: { contains: v, mode: 'insensitive' } });
  const rows = await prisma.customer.findMany({
    where: {
      isDeleted: false,
      email: { not: null, notIn: [''] },
      AND: tokens.map((tk) => ({ OR: [ins('firstName', tk), ins('lastName', tk), ins('email', tk), ins('phone1', tk), ins('phone2', tk)] })),
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    take: 20,
    select: { id: true, firstName: true, lastName: true, phone1: true, city: true, email: true, emailSuffix: true },
  });
  return rows
    .map((c) => ({ id: c.id, name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'ללא שם', phone: c.phone1 || '', city: c.city || '', email: normalizeEmail(c.email, c.emailSuffix) }))
    .filter((c) => c.email && EMAIL_RE.test(c.email));
}

async function logSend({ to, cc, subject, text, ok, error }) {
  try {
    await prisma.emailLog.create({
      data: { to: to.join(', '), cc: cc.length ? cc.join(', ') : null, subject: subject || null, body: (text || '').slice(0, 2000), status: ok ? 'success' : 'error', errorMessage: ok ? null : error, sentAt: new Date() },
    });
  } catch (e) {
    console.error('[mailbox] EmailLog write failed', e.message);
  }
}

async function trashFolderPath() {
  const folders = await listFolders();
  return (folders.find((f) => f.specialUse === '\\Trash') || folders.find((f) => /(^|\.)(trash|deleted)/i.test(f.path)) || {}).path || null;
}

export async function POST(request) {
  if (!(await authorized())) return json({ error: 'Unauthorized' }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'בקשה לא תקינה' }, 400); }
  const action = body && body.action;
  try {
    if (action === 'flags') {
      const folder = pickFolder(body.folder);
      const uid = pickUid(body.uid);
      const allowed = new Set(['\\Seen', '\\Flagged']);
      const addFlags = (Array.isArray(body.addFlags) ? body.addFlags : []).filter((f) => allowed.has(f));
      const removeFlags = (Array.isArray(body.removeFlags) ? body.removeFlags : []).filter((f) => allowed.has(f));
      if (!addFlags.length && !removeFlags.length) throw new MailboxError('לא נבחר דגל', 400);
      await updateFlags(folder, uid, { addFlags: addFlags.length ? addFlags : undefined, removeFlags: removeFlags.length ? removeFlags : undefined });
      return json({ ok: true });
    }
    if (action === 'move') {
      const folder = pickFolder(body.folder);
      const uid = pickUid(body.uid);
      const target = pickFolder(body.targetFolder);
      await moveMessage(folder, uid, target);
      return json({ ok: true });
    }
    if (action === 'delete') {
      // מחיקה רגילה = העברה לאשפה; מחיקה סופית רק מתוך האשפה עצמה
      const folder = pickFolder(body.folder);
      const uid = pickUid(body.uid);
      const trash = await trashFolderPath();
      if (trash && folder !== trash) await moveMessage(folder, uid, trash);
      else await deleteMessage(folder, uid);
      return json({ ok: true, movedToTrash: !!(trash && folder !== trash) });
    }
    if (action === 'send') {
      const to = addrList(body.to);
      const cc = addrList(body.cc);
      const bcc = addrList(body.bcc);
      const all = [...to, ...cc, ...bcc];
      if (!to.length) throw new MailboxError('חסר נמען', 400);
      if (all.length > MAX_RECIPIENTS) throw new MailboxError(`יותר מדי נמענים (מקסימום ${MAX_RECIPIENTS})`, 400);
      const badAddr = all.find((a) => !EMAIL_RE.test(a));
      if (badAddr) throw new MailboxError(`כתובת לא תקינה: ${badAddr}`, 400);
      const subject = String(body.subject || '').slice(0, 500);
      const text = String(body.text || '').slice(0, MAX_BODY);
      if (!subject.trim() && !text.trim()) throw new MailboxError('המייל ריק', 400);
      const atts = Array.isArray(body.attachments) ? body.attachments : [];
      let total = 0;
      const attachments = atts.map((a) => {
        const content = String((a && a.content) || '');
        const filename = String((a && a.filename) || '').replace(/[\r\n"\\/]/g, '_').slice(0, 150);
        if (!filename || !content || !/^[A-Za-z0-9+/=\s]+$/.test(content)) throw new MailboxError('קובץ מצורף לא תקין', 400);
        total += Math.floor((content.length * 3) / 4);
        return { filename, content: content.replace(/\s+/g, ''), contentType: String((a && a.contentType) || 'application/octet-stream').slice(0, 100) };
      });
      if (total > MAX_SEND_ATTACHMENT_BYTES) throw new MailboxError(`הקבצים גדולים מדי (מקסימום ${Math.round(MAX_SEND_ATTACHMENT_BYTES / 1048576)}MB ביחד)`, 400);
      let inReplyTo; let forwardOf;
      if (body.replyTo) inReplyTo = { uid: pickUid(body.replyTo.uid), folder: pickFolder(body.replyTo.folder) };
      else if (body.forwardOf) forwardOf = { uid: pickUid(body.forwardOf.uid), folder: pickFolder(body.forwardOf.folder) };
      const displayName = ((await getCachedSetting('gmach_name').catch(() => '')) || '').toString().trim();
      const html = `<div dir="rtl" style="font-family:Arial,Tahoma,sans-serif;font-size:15px;line-height:1.6;white-space:pre-wrap">${escHtml(text)}</div>`;
      try {
        await sendMail({ to, cc, bcc, subject, text, html, attachments, displayName, inReplyTo, forwardOf });
      } catch (e) {
        await logSend({ to, cc, subject, text, ok: false, error: e.message });
        throw e;
      }
      await logSend({ to, cc, subject, text, ok: true });
      return json({ ok: true });
    }
    return json({ error: 'פעולה לא מוכרת' }, 400);
  } catch (e) {
    return fail(e);
  }
}
