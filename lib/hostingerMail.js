// שליחת מייל דרך Hostinger Mail API (https://api.mail.hostinger.com) - חלופה ל-Apps Script/Gmail.
// פעיל רק כששני משתני הסביבה מוגדרים (משתני סביבה הם לפי פרויקט Vercel, ולכן מדליקים אותו בפרויקט של
// נווה יעקב בלבד; בגמח הראשי המשתנים לא קיימים והשליחה נשארת כמו שהייתה):
//   HOSTINGER_MAIL_TOKEN      - טוקן Bearer של ה-API (נוצר ב-hPanel, לשונית ה-Email)
//   HOSTINGER_MAILBOX_ID      - mailboxResourceId של התיבה השולחת (GET /api/v1/me מחזיר אותו)
// הנקודה היחידה שקוראת לכאן היא postToMailer ב-lib/mailer.js.

const API_BASE = (process.env.HOSTINGER_MAIL_API_BASE || 'https://api.mail.hostinger.com').replace(/\/+$/, '');
const SEND_TIMEOUT_MS = 30000;
// נפילה בטוחה ל-Apps Script רק על כשלים שבהם בטוח שהמייל לא יצא (טוקן/הרשאה/הגבלת קצב)
const FALLBACK_STATUSES = new Set([401, 403, 429]);

export function isHostingerMailEnabled() {
  return !!(process.env.HOSTINGER_MAIL_TOKEN && process.env.HOSTINGER_MAILBOX_ID);
}

/**
 * ה-API מכסה "מייל רגיל" בלבד. פעולות ש-Apps Script עושה בעצמו (המרת HTML ל-PDF בכרטיס הזמנה =
 * action, העלאת קובץ לדרייב) נשארות ב-Apps Script.
 */
export function canSendViaHostinger(payload) {
  if (!payload || payload.action) return false;
  if (payload.sendMode && payload.sendMode !== 'email') return false;
  const atts = Array.isArray(payload.attachments) ? payload.attachments : [];
  return atts.every((a) => !a || !a.dest || a.dest === 'email');
}

function splitAddresses(v) {
  if (!v) return [];
  const list = Array.isArray(v) ? v : String(v).split(/[,;\s]+/);
  return [...new Set(list.map((s) => String(s || '').trim()).filter((s) => s.includes('@')))];
}

/** payload של Apps Script -> גוף הבקשה של POST /mailboxes/{id}/send */
export function buildHostingerSendBody(payload) {
  const to = splitAddresses(payload.to);
  const cc = splitAddresses(payload.cc);
  const body = { to, subject: payload.subject || '' };
  if (cc.length) body.cc = cc;
  if (payload.senderName) body.displayName = String(payload.senderName).slice(0, 200);
  if (payload.body) body.text = String(payload.body);
  if (payload.htmlBody) body.html = String(payload.htmlBody);
  // noAttachment=true = ה-fileName/fileContent שבשדות הישנים הם "קובץ ממלא מקום" בלבד
  if (!payload.noAttachment && Array.isArray(payload.attachments) && payload.attachments.length) {
    body.attachments = payload.attachments
      .filter((a) => a && a.fileName && a.fileContent)
      .map((a) => ({ filename: a.fileName, content: a.fileContent, contentType: a.mimeType || 'application/octet-stream' }));
    if (!body.attachments.length) delete body.attachments;
  }
  return body;
}

function errorText(status, json, text) {
  const code = json && json.code ? ` ${json.code}` : '';
  const params = json && json.params && Object.keys(json.params).length ? ` ${JSON.stringify(json.params)}` : '';
  const msg = (json && json.error) || String(text || '').replace(/\s+/g, ' ').slice(0, 200);
  return `Hostinger Mail API (HTTP ${status}${code}): ${msg}${params}`;
}

/**
 * @returns {Promise<{isSuccess:boolean, result:object, message:string|null, fallback?:boolean}>}
 *   fallback=true = בטוח שהמייל לא יצא ואפשר לנסות דרך Apps Script.
 */
export async function sendViaHostinger(payload) {
  const body = buildHostingerSendBody(payload);
  if (!body.to.length && !body.cc) {
    return { isSuccess: false, result: { status: 'error', via: 'hostinger' }, message: 'לא סופקה כתובת מייל תקינה' };
  }
  const url = `${API_BASE}/api/v1/mailboxes/${encodeURIComponent(process.env.HOSTINGER_MAILBOX_ID)}/send`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${process.env.HOSTINGER_MAIL_TOKEN}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (res.status === 204 || res.status === 200) {
      return { isSuccess: true, result: { status: 'success', via: 'hostinger' }, message: null };
    }
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    const message = errorText(res.status, json, text);
    return { isSuccess: false, result: { status: 'error', via: 'hostinger', message }, message, fallback: FALLBACK_STATUSES.has(res.status) };
  } catch (e) {
    // timeout / ניתוק: אי אפשר לדעת אם המייל יצא - לא נופלים ל-Apps Script (סכנת כפילות)
    const message = e.name === 'AbortError' ? 'Hostinger Mail API: timeout' : `Hostinger Mail API: ${e.message || e}`;
    return { isSuccess: false, result: { status: 'error', via: 'hostinger', message }, message };
  } finally {
    clearTimeout(timer);
  }
}
