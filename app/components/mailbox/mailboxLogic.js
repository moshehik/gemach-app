// לוגיקה טהורה של תיבת המייל (/admin/mailbox): שמות ואייקוני תיקיות, שורת רשימה מתשובת Hostinger, תצוגת כתובות, ציטוט לתשובה / העברה.
// בלי React ובלי רשת - נבדקת ב-scripts/email-center-tests/mailbox-logic.test.mjs. התצוגה: MailboxA5.js (ערכת a5-list).

export const PER_PAGE = 50; // כמו PAGE_SIZE של ערכת הרשימות (a5-list/listLogic.js)
export const MAX_ATT_BYTES = 3 * 1024 * 1024; // גוף בקשה בפונקציית Vercel מוגבל; זהה ל-MAX_SEND_ATTACHMENT_BYTES בשרת

const FOLDER_LABEL = { INBOX: 'נכנסים', 'INBOX.Sent': 'נשלחו', 'INBOX.Drafts': 'טיוטות', 'INBOX.Trash': 'אשפה', 'INBOX.Spam': 'ספאם', 'INBOX.Junk': 'ספאם', 'INBOX.Archive': 'ארכיון' };
const SPECIAL_LABEL = { '\\Sent': 'נשלחו', '\\Drafts': 'טיוטות', '\\Trash': 'אשפה', '\\Junk': 'ספאם', '\\Archive': 'ארכיון' };
const SPECIAL_ICON = { '\\Sent': 'send', '\\Drafts': 'file', '\\Trash': 'trash', '\\Junk': 'alert', '\\Archive': 'archive' };

export const folderLabel = (f) => (f.path === 'INBOX' ? 'נכנסים' : SPECIAL_LABEL[f.specialUse] || FOLDER_LABEL[f.path] || f.name);
export const folderIcon = (f) => (f.path === 'INBOX' ? 'inbox' : SPECIAL_ICON[f.specialUse] || 'bookmark');
export const isOutgoingFolder = (f) => !!f && (f.specialUse === '\\Sent' || f.specialUse === '\\Drafts');
export const isTrashFolder = (f) => !!f && f.specialUse === '\\Trash';

/** כתובת או שם מכל צורה שה-API עלול להחזיר (אובייקט {name,address}, מחרוזת, או name מקונן) -> { name, address } עם מחרוזות בלבד. */
export function normAddr(a) {
  if (a == null) return null;
  if (typeof a === 'string') return { name: '', address: a.trim() };
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  let name = str(a.name);
  let address = str(a.address);
  if (a.name && typeof a.name === 'object') { // מבנה מקונן: name: { name, address }
    name = str(a.name.name) || name;
    address = address || str(a.name.address);
  }
  if (!address && typeof a.email === 'string') address = a.email.trim();
  return { name: name === address ? '' : name, address };
}
export const addrList = (list) => (Array.isArray(list) ? list.map(normAddr).filter((x) => x && (x.address || x.name)) : []);
/** שם להצגה בשורה: השם, ובלעדיו הכתובת. */
export const addrShort = (a) => { const n = normAddr(a); return n ? n.name || n.address : ''; };
/** "שם <כתובת>" לציטוט / טקסט רגיל. */
export const addrText = (a) => { const n = normAddr(a); return n ? (n.name ? `${n.name} <${n.address}>` : n.address) : ''; };

/** שורת רשימה מהודעה של Hostinger (list item). outgoing = תיקיית נשלחו/טיוטות: מציגים נמענים ולא שולח. */
export function mailRow(m, outgoing) {
  const flags = Array.isArray(m.flags) ? m.flags : [];
  const unseen = typeof m.unseen === 'boolean' ? m.unseen : !flags.includes('\\Seen');
  const who = outgoing ? addrList(m.to).map(addrShort).join(', ') : addrShort(m.from);
  return {
    id: m.uid,
    uid: m.uid,
    unseen,
    flagged: flags.includes('\\Flagged'),
    who: who || '(ללא)',
    subject: (m.subject || '').trim() || '(ללא נושא)',
    date: m.date || null,
    from: normAddr(m.from),
    to: addrList(m.to),
    cc: addrList(m.cc),
    files: Array.isArray(m.attachments) ? m.attachments.filter((a) => a && (!a.inline || a.filename)).length : 0,
    size: m.size || 0,
  };
}

export const fmtBytes = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round((n || 0) / 1024))}KB`);

const SEND_FIELD_RE = /[,;\s]+/;
/** רשימת כתובות משדה טקסט (פסיק / נקודה-פסיק / רווח), בלי כפילויות (לא תלוי רישיות). */
export function splitAddresses(text) {
  const seen = new Set();
  const out = [];
  for (const raw of String(text || '').split(SEND_FIELD_RE)) {
    const s = raw.trim();
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
  }
  return out;
}
export const hasAddress = (text, email) => splitAddresses(text).some((x) => x.toLowerCase() === String(email).toLowerCase());
export function addAddress(text, email) {
  return hasAddress(text, email) ? String(text || '') : [...splitAddresses(text), email].join(', ');
}
export const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

const quotedBlock = (text) => String(text || '').split('\n').map((l) => `> ${l}`).join('\n');
const quoteWhen = (iso) => {
  try { return new Date(iso).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'medium', timeStyle: 'short' }); } catch { return ''; }
};

/**
 * מצב ראשוני של חלון הכתיבה. kind: new | reply | replyAll | forward. msg = ההודעה המלאה (עם body.text), ref = { uid, folder }, me = כתובת התיבה.
 */
export function composeDraft(kind, msg, ref, me) {
  const empty = { kind: 'new', to: '', cc: '', bcc: '', subject: '', text: '', files: [] };
  if (kind === 'new' || !msg) return empty;
  const from = normAddr(msg.from);
  const subj = (msg.subject || '').trim();
  const intro = `\n\n\nב-${quoteWhen(msg.date)}, ${addrText(msg.from)} כתב/ה:\n${quotedBlock(msg.body && msg.body.text)}`;
  if (kind === 'forward') {
    return { ...empty, kind, subject: /^(fwd?|הועבר)\s*:/i.test(subj) ? subj : `Fwd: ${subj}`, text: intro, forwardOf: ref };
  }
  const lower = (s) => String(s || '').toLowerCase();
  const others = kind === 'replyAll'
    ? [...addrList(msg.to), ...addrList(msg.cc)].map((a) => a.address).filter((a) => a && lower(a) !== lower(me) && lower(a) !== lower(from && from.address))
    : [];
  return { ...empty, kind, to: (from && from.address) || '', cc: [...new Set(others)].join(', '), subject: /^re\s*:/i.test(subj) ? subj : `Re: ${subj}`, text: intro, replyTo: ref };
}

/** מסמך ה-iframe של גוף ההודעה: CSP בלי סקריפטים; תמונות מרוחקות רק כשהמשתמש אישר (מעקב). */
export function frameDoc(html, showImages) {
  const csp = `default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data: cid:${showImages ? ' https: http:' : ''}`;
  return `<!doctype html><html dir="auto"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>body{font-family:Arial,Tahoma,sans-serif;font-size:15px;line-height:1.55;margin:14px;overflow-wrap:anywhere}img{max-width:100%;height:auto}</style></head><body>${html}</body></html>`;
}
export const hasRemoteImages = (html) => /<img[^>]+src=["']?https?:/i.test(String(html || ''));
