// קריאה/ניהול של תיבת הדואר דרך Hostinger Mail API (תיבה אחת, לפי HOSTINGER_MAIL_TOKEN + HOSTINGER_MAILBOX_ID).
// משמש את מסך "תיבת מייל" (/admin/mailbox) דרך /api/admin/mailbox. שליחה רגילה של המערכת נשארת ב-lib/hostingerMail.js.
// כל הפונקציות זורקות MailboxError (עם status) - הנתיב ממיר אותו לתשובת JSON.

const API_BASE = (process.env.HOSTINGER_MAIL_API_BASE || 'https://api.mail.hostinger.com').replace(/\/+$/, '');
const TIMEOUT_MS = 25000;
export const MAX_SEND_ATTACHMENT_BYTES = 3 * 1024 * 1024; // גוף בקשה בפונקציית Vercel מוגבל (~4.5MB כולל base64)

export class MailboxError extends Error {
  constructor(message, status = 500) { super(message); this.status = status; }
}

export function isMailboxEnabled() {
  return !!(process.env.HOSTINGER_MAIL_TOKEN && process.env.HOSTINGER_MAILBOX_ID);
}

/** נתיב תיקייה תקין בלבד (INBOX, INBOX.Sent, ...) - נכנס לכתובת ה-URL, לכן רשימה לבנה של תווים. */
export function validFolder(f) {
  return typeof f === 'string' && f.length > 0 && f.length <= 100 && /^[\p{L}\p{N} ._\-/]+$/u.test(f) && !f.includes('..');
}
export function validUid(u) {
  return /^\d{1,12}$/.test(String(u));
}

function base() {
  if (!isMailboxEnabled()) throw new MailboxError('תיבת הדואר לא מחוברת באתר הזה', 503);
  return `${API_BASE}/api/v1/mailboxes/${encodeURIComponent(process.env.HOSTINGER_MAILBOX_ID)}`;
}

async function call(path, { method = 'GET', json, query, raw = false } = {}) {
  const url = new URL(base() + path);
  if (query) for (const [k, v] of Object.entries(query)) if (v != null && v !== '') url.searchParams.set(k, String(v));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      headers: {
        Accept: raw ? '*/*' : 'application/json',
        Authorization: `Bearer ${process.env.HOSTINGER_MAIL_TOKEN}`,
        ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: json !== undefined ? JSON.stringify(json) : undefined,
      signal: ctrl.signal,
    });
    if (raw && res.ok) return res;
    if (res.status === 204) return null;
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
    if (!res.ok) {
      const msg = (body && body.error) || text.replace(/\s+/g, ' ').slice(0, 200) || `HTTP ${res.status}`;
      throw new MailboxError(`Hostinger (${res.status}): ${msg}`, res.status === 404 ? 404 : res.status >= 500 ? 502 : res.status === 429 ? 429 : 502);
    }
    return body;
  } catch (e) {
    if (e instanceof MailboxError) throw e;
    throw new MailboxError(e.name === 'AbortError' ? 'Hostinger: זמן התגובה עבר' : `Hostinger: ${e.message || e}`, 504);
  } finally {
    clearTimeout(timer);
  }
}

const enc = encodeURIComponent;

export async function listFolders() {
  const out = await call('/folders', { query: { perPage: 100 } });
  return (out && out.data) || [];
}

/** כתובת התיבה (מ-GET /me לפי HOSTINGER_MAILBOX_ID). */
export async function getAddress() {
  try {
    const res = await fetch(`${API_BASE}/api/v1/me`, { headers: { Accept: 'application/json', Authorization: `Bearer ${process.env.HOSTINGER_MAIL_TOKEN}` } });
    if (!res.ok) return '';
    const j = await res.json();
    const box = ((j && j.data && j.data.mailboxes) || []).find((m) => m.resourceId === process.env.HOSTINGER_MAILBOX_ID);
    return (box && box.address) || '';
  } catch { return ''; }
}

export async function getQuota() {
  try { return ((await call('/quota')) || {}).data || null; } catch { return null; }
}

/** רשימת הודעות בתיקייה; q = חיפוש חופשי (נושא/שולח/נמען/גוף). */
export async function listMessages(folder, { page = 1, perPage = 30, q = '', sort = '-date' } = {}) {
  const query = { page, perPage, sort };
  if (q) {
    const out = await call(`/folders/${enc(folder)}/messages/search`, {
      method: 'POST', query, json: { subject: q, from: q, to: q, body: q },
    });
    return { data: (out && out.data) || [], pagination: (out && out.pagination) || null };
  }
  const out = await call(`/folders/${enc(folder)}/messages`, { query });
  return { data: (out && out.data) || [], pagination: (out && out.pagination) || null };
}

/** הודעה מלאה: מטא-דאטה + טקסט/HTML. */
export async function getMessage(folder, uid) {
  const [meta, text] = await Promise.all([
    call(`/folders/${enc(folder)}/messages/${uid}`),
    call(`/folders/${enc(folder)}/messages/${uid}/text`),
  ]);
  return { ...((meta && meta.data) || {}), body: (text && text.data) || { text: '', html: '' } };
}

export async function downloadAttachment(folder, uid, attachmentId) {
  return call(`/folders/${enc(folder)}/messages/${uid}/attachments/${enc(attachmentId)}`, { raw: true });
}

export async function updateFlags(folder, uid, { addFlags, removeFlags }) {
  await call(`/folders/${enc(folder)}/messages/${uid}`, { method: 'PATCH', json: { ...(addFlags ? { addFlags } : {}), ...(removeFlags ? { removeFlags } : {}) } });
}

export async function moveMessage(folder, uid, targetFolder) {
  await call(`/folders/${enc(folder)}/messages/${uid}/move`, { method: 'POST', json: { targetFolder } });
}

export async function deleteMessage(folder, uid) {
  await call(`/folders/${enc(folder)}/messages/${uid}`, { method: 'DELETE' });
}

/** שליחה מהתיבה (חדש / תשובה / העברה). נשמר אוטומטית ב-INBOX.Sent. */
export async function sendMail({ to, cc, bcc, subject, text, html, attachments, displayName, inReplyTo, forwardOf }) {
  const body = { to, subject: subject || '' };
  if (cc && cc.length) body.cc = cc;
  if (bcc && bcc.length) body.bcc = bcc;
  if (displayName) body.displayName = displayName;
  if (text) body.text = text;
  if (html) body.html = html;
  if (attachments && attachments.length) body.attachments = attachments;
  if (inReplyTo) body.inReplyTo = inReplyTo;
  else if (forwardOf) body.forwardOf = forwardOf;
  await call('/send', { method: 'POST', json: body });
}
