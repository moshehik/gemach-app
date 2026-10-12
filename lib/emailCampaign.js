// lib/emailCampaign.js - דיוורים (מרכז המיילים, לשונית "דיוורים"). צד שרת בלבד. זה הבסיס - הבעלים ירחיב בהמשך.
//
// עקרונות (חוק התקשורת, סעיף 30א, ואבטחה):
//  * נמענים: רק לקוחות עם marketingConsent=true, לא מחוקים, עם מייל תקין. הבדיקה חוזרת *בכל שליחה בודדת* (לא סומכים על רשימה שנבנתה קודם -
//    לקוחה שהסירה את עצמה בין היצירה לשליחה לא תקבל). הלקוח (הדפדפן) שולח מזהי לקוחות בלבד; כתובות מייל לא עוברות אליו (רק מסכות).
//  * כל דיוור כולל קישור הסרה אישי (טוקן HMAC של מזהה הלקוח עם AUTH_SECRET, בלי טבלה) ושורת זיהוי השולח; הכותפת אינה ניתנת להסרה.
//  * גוף הדיוור: טקסט חופשי בלבד (renderRichText: escape מלא + **הדגשה** + [קישור](https://…) בטוח) - אין HTML של משתמש.
//  * תמונה בגוף: Attachment (public, UUID) שעבר המרה ב-sharp; צרופות: רשימת סיומות סגורה (lib/attachmentFileTypes.js) ותקרת גודל.
//  * אחסון: SystemSetting email_campaign:<id> (JSON) - בלי שינוי סכמה. כל שליחה נרשמת גם ב-EmailLog (כמו כל מייל במערכת).
//  * תזמון: מסמך במצב scheduled + scheduledAt (UTC); processDueCampaigns רץ מה-cron היומי / ה-cron של סוכן הענפים / GET /api/cron/email-campaigns.
//    שעה מדויקת: אותו דפוס כמו הצינתוקים המתוזמנים של print-center (lib/scheduledBroadcast.js שם): מתזמן Google Apps Script חיצוני
//    (docs/gas-campaign-scheduler.gs). בעת התזמון האתר רושם אצלו {action:'schedule', id, runAt, site}; הוא יוצר טריגר חד-פעמי לאותה דקה, ובה קורא פעם אחת
//    ל-/api/cron/email-campaigns (Bearer EMAIL_SCHEDULER_SECRET) שמריץ את מה שהגיע זמנו. env: EMAIL_SCHEDULER_URL + EMAIL_SCHEDULER_SECRET.
//    בלי env - מדלגים, ורשתות הביטחון (cron יומי ~08:30 + cron סוכן הענפים ~17:30/~00:30) שולחות בהרצה הקרובה אחרי המועד.
//    הטענה (claim) של דיוור לשליחה היא compare-and-swap אטומי על שורת ההגדרה, כך שמתזמן + cron באותה דקה לא ישלחו פעמיים.
//  * מכסת Gmail (100 נמענים ליום לחשבון, משותפת לכל המערכת): בודקים לפני שליחה (getMailerQuota) ומפסיקים כשנגמרה; ההמשך בהרצה הבאה.

import crypto from 'crypto';
import prisma from '@/app/lib/prisma';
import { getAllCachedSettings, invalidateSettingsCache } from '@/lib/settingsCache';
import { sendSystemEmail, getMailerQuota } from '@/lib/mailer';
import { renderCampaignEmailHtml } from '@/lib/emailTemplates';
import { getEmailConfig } from '@/lib/emailConfig';
import { fillVars, renderRichText, richTextToPlain, cleanTextInput, safeUrl, validateText } from '@/lib/emailText';
import { getIsraelDayRange } from '@/lib/hebrewDate';
import { ATTACHMENT_FILE_TYPES, fileExtension } from '@/lib/attachmentFileTypes';

export const CAMPAIGN_KEY_PREFIX = 'email_campaign:';
export const MAX_RECIPIENTS_PER_CAMPAIGN = 500;
export const MAX_SUBJECT = 150;
export const MAX_BODY = 8000;
export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENTS_TOTAL_BYTES = 6 * 1024 * 1024;
export const CAMPAIGN_VARS = Object.freeze([
  { key: 'firstName', label: 'שם פרטי', example: 'רחל' },
  { key: 'lastName', label: 'שם משפחה', example: 'כהן' },
  { key: 'fullName', label: 'שם מלא', example: 'רחל כהן' },
  { key: 'gmachName', label: 'שם הגמ"ח', example: 'גמ"ח שמלות' },
  { key: 'gmachPhone', label: 'טלפון הגמ"ח', example: '02-1234567' },
]);
const CAMPAIGN_VAR_KEYS = CAMPAIGN_VARS.map((v) => v.key);
const STATUSES = ['draft', 'scheduled', 'sending', 'done', 'cancelled'];

// ---------------------------------------------------------------------------
// מתזמן חיצוני (Google Apps Script) - שעה מדויקת
// ---------------------------------------------------------------------------

export function schedulerConfigured() {
  return !!(process.env.EMAIL_SCHEDULER_URL && process.env.EMAIL_SCHEDULER_SECRET);
}

/** קריאה למתזמן. לא זורקת. { skipped:true } כשאין env. */
async function callScheduler(body) {
  const url = process.env.EMAIL_SCHEDULER_URL;
  const secret = process.env.EMAIL_SCHEDULER_SECRET;
  if (!url || !secret) return { skipped: true };
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret, ...body }), redirect: 'follow', signal: AbortSignal.timeout(25000) });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { ok: false, error: `תשובה לא תקינה מהמתזמן (${res.status})` }; }
  } catch (e) {
    return { ok: false, error: String(e.message || e).slice(0, 150) };
  }
}

/** רושם דיוור מתוזמן אצל המתזמן. מחזיר { registered, skipped?, error?, triggerId? }. */
export async function registerWithScheduler(doc) {
  const r = await callScheduler({ action: 'schedule', id: doc.id, runAt: doc.scheduledAt, site: doc.origin });
  if (r.skipped) return { registered: false, skipped: true };
  return r.ok ? { registered: true, triggerId: r.triggerId || null } : { registered: false, error: r.error || 'הרישום במתזמן נכשל' };
}

export function cancelWithScheduler(id) { return callScheduler({ action: 'cancel', id }); }

// ---------------------------------------------------------------------------
// הסרה מהדיוור: טוקן חתום (בלי טבלה)
// ---------------------------------------------------------------------------

function unsubSecret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET לא מוגדר - אי אפשר ליצור קישורי הסרה, ולכן אין שליחת דיוורים');
  return s;
}
const b64u = (buf) => Buffer.from(buf).toString('base64url');

export function makeUnsubscribeToken(customerId) {
  const id = String(customerId);
  const mac = crypto.createHmac('sha256', unsubSecret()).update(`unsub:${id}`).digest().subarray(0, 24);
  return `${b64u(id)}.${b64u(mac)}`;
}

/** מחזיר את מזהה הלקוח אם הטוקן תקין, אחרת null. */
export function verifyUnsubscribeToken(token) {
  try {
    const [idPart, macPart] = String(token || '').split('.');
    if (!idPart || !macPart || idPart.length > 100 || macPart.length > 60) return null;
    const id = Buffer.from(idPart, 'base64url').toString('utf8');
    if (!/^[0-9a-fA-F-]{8,64}$/.test(id)) return null;
    const expected = crypto.createHmac('sha256', unsubSecret()).update(`unsub:${id}`).digest().subarray(0, 24);
    const given = Buffer.from(macPart, 'base64url');
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
    return id;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// נמענים
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;
export const isValidEmail = (e) => typeof e === 'string' && EMAIL_RE.test(e.trim()) && e.trim().length <= 200;

export function maskEmail(email) {
  const e = String(email || '').trim();
  const at = e.indexOf('@');
  if (at < 1) return '***';
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  return `${local.slice(0, 1)}${'*'.repeat(Math.max(2, Math.min(5, local.length - 1)))}@${domain.slice(0, 1)}***${dot > 0 ? domain.slice(dot) : ''}`;
}

const fullNameOf = (c) => [c.firstName, c.lastName].filter(Boolean).join(' ').trim();

function toRecipient(c) {
  return { id: c.id, name: fullNameOf(c) || '(ללא שם)', city: c.city || '', maskedEmail: maskEmail(c.email) };
}

const CONSENT_WHERE = { isDeleted: false, marketingConsent: true, email: { not: null } };
const CUSTOMER_SELECT = { id: true, firstName: true, lastName: true, city: true, email: true };

/**
 * ערים של לקוחות מאשרי דיוור (לבורר) - [{city, count}] ממוין לפי כמות.
 */
export async function listConsentCities() {
  const rows = await prisma.customer.findMany({ where: { ...CONSENT_WHERE, city: { not: null } }, select: { city: true, email: true }, take: 20000 });
  const counts = new Map();
  for (const r of rows) {
    if (!isValidEmail(r.email)) continue;
    const c = String(r.city || '').trim();
    if (c) counts.set(c, (counts.get(c) || 0) + 1);
  }
  return [...counts.entries()].map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count || a.city.localeCompare(b.city, 'he'));
}

/** מספר מאשרי הדיוור הכולל (לתצוגה). */
export async function countConsentCustomers() {
  const rows = await prisma.customer.findMany({ where: CONSENT_WHERE, select: { email: true }, take: 50000 });
  return rows.filter((r) => isValidEmail(r.email)).length;
}

/**
 * פילטר -> רשימת נמענים (בלי כתובות מייל מלאות). filters:
 *  { mode:'all' } | { mode:'city', cities:[..] } | { mode:'event', eventFrom:'YYYY-MM-DD', eventTo:'YYYY-MM-DD' } | { mode:'manual', customerIds:[..] }
 * תמיד מסונן לפי הסכמת דיוור. מייל אחד לכל כתובת. מוגבל ל-MAX_RECIPIENTS_PER_CAMPAIGN (truncated=true אם נחתך).
 */
export async function resolveRecipients(filters = {}) {
  const mode = filters.mode;
  let where = { ...CONSENT_WHERE };
  if (mode === 'city') {
    const cities = (Array.isArray(filters.cities) ? filters.cities : []).map((c) => String(c).trim()).filter(Boolean).slice(0, 100);
    if (!cities.length) return { recipients: [], total: 0, truncated: false };
    where = { ...where, city: { in: cities } };
  } else if (mode === 'event') {
    const key = /^\d{4}-\d{2}-\d{2}$/;
    if (!key.test(String(filters.eventFrom || ''))) return { recipients: [], total: 0, truncated: false, error: 'חסר תאריך התחלה' };
    const from = getIsraelDayRange(filters.eventFrom).start;
    const to = getIsraelDayRange(key.test(String(filters.eventTo || '')) ? filters.eventTo : filters.eventFrom).end;
    const orders = await prisma.order.findMany({ where: { isDeleted: false, eventDate: { gte: from, lte: to }, customerId: { not: null } }, select: { customerId: true }, distinct: ['customerId'], take: 5000 });
    const ids = orders.map((o) => o.customerId).filter(Boolean);
    if (!ids.length) return { recipients: [], total: 0, truncated: false };
    where = { ...where, id: { in: ids } };
  } else if (mode === 'manual') {
    const ids = (Array.isArray(filters.customerIds) ? filters.customerIds : []).map(String).filter((x) => /^[0-9a-fA-F-]{8,64}$/.test(x)).slice(0, MAX_RECIPIENTS_PER_CAMPAIGN * 2);
    if (!ids.length) return { recipients: [], total: 0, truncated: false };
    where = { ...where, id: { in: ids } };
  } else if (mode !== 'all') {
    return { recipients: [], total: 0, truncated: false, error: 'סוג בחירה לא מוכר' };
  }
  const rows = await prisma.customer.findMany({ where, select: CUSTOMER_SELECT, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], take: 6000 });
  const seen = new Set();
  const out = [];
  for (const c of rows) {
    if (!isValidEmail(c.email)) continue;
    const key = c.email.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  const truncated = out.length > MAX_RECIPIENTS_PER_CAMPAIGN;
  const kept = out.slice(0, MAX_RECIPIENTS_PER_CAMPAIGN);
  return { recipients: kept.map(toRecipient), total: out.length, truncated };
}

/** חיפוש לקוחה לבחירה ידנית (שם / טלפון), רק מאשרות דיוור. עד 15 תוצאות; בלי כתובות מלאות. */
export async function searchConsentCustomers(q) {
  const text = String(q || '').trim().slice(0, 40);
  if (text.length < 2) return [];
  const words = text.split(/\s+/).filter(Boolean).slice(0, 3);
  const AND = words.map((w) => ({ OR: [{ firstName: { contains: w, mode: 'insensitive' } }, { lastName: { contains: w, mode: 'insensitive' } }, { phone1: { contains: w } }, { phone2: { contains: w } }] }));
  const rows = await prisma.customer.findMany({ where: { ...CONSENT_WHERE, AND }, select: CUSTOMER_SELECT, take: 15 });
  return rows.filter((c) => isValidEmail(c.email)).map(toRecipient);
}

// ---------------------------------------------------------------------------
// מסמך הדיוור
// ---------------------------------------------------------------------------

const ORIGIN_RE = /^https?:\/\/[A-Za-z0-9.-]+(:\d{2,5})?$/;
const ATTACHMENT_URL_RE = /^\/api\/attachment\/([0-9a-fA-F-]{8,64})$/;

/** ניקוי ואימות קלט של דיוור (צד שרת). מחזיר { ok, value } או { ok:false, error }. */
export function sanitizeCampaignInput(raw, { requireContent = true } = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const subject = cleanTextInput(r.subject, { max: MAX_SUBJECT, multiline: false });
  const bodyText = cleanTextInput(r.bodyText, { max: MAX_BODY, multiline: true });
  const heading = cleanTextInput(r.heading, { max: 120, multiline: false });
  if (requireContent && !subject) return { ok: false, error: 'נדרש נושא' };
  if (requireContent && !bodyText) return { ok: false, error: 'נדרש תוכן' };
  for (const [label, text] of [['הנושא', subject], ['התוכן', bodyText], ['הכותרת', heading]]) {
    const err = validateText(text, CAMPAIGN_VAR_KEYS, { label, max: MAX_BODY });
    if (err) return { ok: false, error: err };
  }
  let imageAttachmentId = null;
  if (r.imageUrl) {
    const m = ATTACHMENT_URL_RE.exec(String(r.imageUrl));
    if (!m) return { ok: false, error: 'כתובת התמונה לא תקינה (יש להעלות תמונה דרך המסך)' };
    imageAttachmentId = m[1];
  }
  const buttonLabel = cleanTextInput(r.buttonLabel, { max: 40, multiline: false });
  let buttonUrl = '';
  if (r.buttonUrl) {
    const u = safeUrl(r.buttonUrl);
    if (!u || !/^https?:\/\//i.test(u)) return { ok: false, error: 'קישור הכפתור חייב להתחיל ב-http:// או https://' };
    buttonUrl = u;
  }
  if (buttonUrl && !buttonLabel) return { ok: false, error: 'נדרש כיתוב לכפתור' };
  const attachments = [];
  let total = 0;
  for (const a of (Array.isArray(r.attachments) ? r.attachments : []).slice(0, MAX_ATTACHMENTS + 1)) {
    const id = String(a && a.attachmentId || '');
    const fileName = cleanTextInput(a && a.fileName, { max: 120, multiline: false }).replace(/[\\/:*?"<>|]/g, '_');
    if (!/^[0-9a-fA-F-]{8,64}$/.test(id) || !fileName) return { ok: false, error: 'צרופה לא תקינה' };
    const ext = fileExtension(fileName);
    if (!Object.prototype.hasOwnProperty.call(ATTACHMENT_FILE_TYPES, ext)) return { ok: false, error: `סוג קובץ לא מותר: ${fileName}` };
    total += Number(a.size) || 0;
    attachments.push({ attachmentId: id, fileName, size: Number(a.size) || 0 });
  }
  if (attachments.length > MAX_ATTACHMENTS) return { ok: false, error: `עד ${MAX_ATTACHMENTS} צרופות` };
  if (total > MAX_ATTACHMENTS_TOTAL_BYTES) return { ok: false, error: 'סך הצרופות גדול מדי (עד 6MB)' };
  return {
    ok: true,
    value: { subject, bodyText, heading, imageAttachmentId, imageAlt: cleanTextInput(r.imageAlt, { max: 120, multiline: false }), buttonLabel, buttonUrl, attachments },
  };
}

const newId = () => `c${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;
const parseDoc = (raw) => { try { const v = JSON.parse(raw); return v && typeof v === 'object' ? v : null; } catch { return null; } };

async function writeDoc(doc) {
  const value = JSON.stringify(doc);
  const name = `דיוור - ${String(doc.subject || '').slice(0, 60)}`;
  await prisma.systemSetting.upsert({
    where: { key: CAMPAIGN_KEY_PREFIX + doc.id },
    update: { value, name },
    create: { key: CAMPAIGN_KEY_PREFIX + doc.id, value, name, type: 'json' },
  });
  invalidateSettingsCache(CAMPAIGN_KEY_PREFIX + doc.id);
}

// ---------------------------------------------------------------------------
// כתיבת התקדמות בזמן שליחה: compare-and-swap (סקירת אבטחה 12.10.2026, ממצא 3).
// writeDoc (upsert) דורס את כל המסמך - ביטול שנכתב בזמן שליחה (cancelCampaign) היה נמחק בכתיבת ההתקדמות הבאה והדיוור היה ממשיך (ושוב 'done').
// כאן הכתיבה מותנית בערך שנקרא / נכתב לאחרונה. נכשל (count==0) -> טוענים מחדש: אם בוטל באמצע, מאחדים את ההתקדמות אל המסמך המבוטל ועוצרים;
// אם השתנה משהו אחר, ממזגים (איחוד התקדמות) וממשיכים. מחזיר { expected, cancelled }.
// ---------------------------------------------------------------------------
const unionIds = (a, b) => [...new Set([...(a || []), ...(b || [])])];
function mergeProgress(base, mine) {
  const failedById = new Map();
  for (const f of [...((base && base.failed) || []), ...((mine && mine.failed) || [])]) if (f && f.id) failedById.set(f.id, f);
  return { sent: unionIds(base && base.sent, mine && mine.sent), skipped: unionIds(base && base.skipped, mine && mine.skipped), failed: [...failedById.values()] };
}
export async function persistProgress(doc, expected) {
  const key = CAMPAIGN_KEY_PREFIX + doc.id;
  let want = expected;
  for (let attempt = 0; attempt < 4; attempt++) {
    const value = JSON.stringify(doc);
    const r = await prisma.systemSetting.updateMany({ where: { key, value: want }, data: { value } });
    if (r.count === 1) { invalidateSettingsCache(key); return { expected: value, cancelled: false }; }
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    const cur = row ? parseDoc(row.value) : null;
    if (!cur) return { expected: want, cancelled: true }; // המסמך נמחק - עוצרים
    if (cur.status === 'cancelled') {
      // מאחדים את ההתקדמות למסמך המבוטל (כדי שהסיכום ישקף מה כבר נשלח) ועוצרים
      const merged = { ...cur, progress: mergeProgress(cur.progress, doc.progress), lock: null };
      const mv = JSON.stringify(merged);
      const w = await prisma.systemSetting.updateMany({ where: { key, value: row.value }, data: { value: mv } });
      if (w.count === 1) { invalidateSettingsCache(key); return { expected: mv, cancelled: true }; }
      doc.progress = mergeProgress(doc.progress, cur.progress);
      want = undefined; // המסמך השתנה שוב בינתיים - נטען מחדש בסיבוב הבא
      continue;
    }
    // שינוי אחר (לא ביטול): ממזגים התקדמות ומנסים שוב מול הערך הנוכחי
    doc.progress = mergeProgress(cur.progress, doc.progress);
    want = row.value;
  }
  // לא הצלחנו לכתוב אחרי כמה ניסיונות: עוצרים בבטחה (לא דורסים)
  return { expected: want, cancelled: true, conflict: true };
}

/** קריאה *טרייה* מהמסד (לא מהמטמון) - ההתקדמות משתנה בין קריאות. */
export async function loadCampaign(id) {
  if (!/^c[a-z0-9]{6,30}$/.test(String(id))) return null;
  const row = await prisma.systemSetting.findUnique({ where: { key: CAMPAIGN_KEY_PREFIX + id } });
  const doc = row ? parseDoc(row.value) : null;
  return doc && STATUSES.includes(doc.status) ? doc : null;
}

/** רשימת הדיוורים האחרונים (סיכום בלבד - בלי נמענים). */
export async function listCampaigns(limit = 25) {
  const rows = await prisma.systemSetting.findMany({ where: { key: { startsWith: CAMPAIGN_KEY_PREFIX } }, select: { value: true }, take: 300 });
  return rows.map((r) => parseDoc(r.value)).filter((d) => d && STATUSES.includes(d.status))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, limit).map(summarize);
}

export function summarize(d) {
  return {
    id: d.id, status: d.status, subject: d.subject, createdAt: d.createdAt, scheduledAt: d.scheduledAt || null, finishedAt: d.finishedAt || null,
    total: (d.recipientIds || []).length, sent: (d.progress?.sent || []).length, failed: (d.progress?.failed || []).length, skipped: (d.progress?.skipped || []).length,
    exact: !!(d.scheduler && d.scheduler.exact), schedulerError: (d.scheduler && d.scheduler.error) || null,
    hasImage: !!d.imageAttachmentId, attachmentCount: (d.attachments || []).length, filterMode: d.filters?.mode || null,
  };
}

/**
 * יוצר דיוור. recipientIds נבנים בשרת מהפילטר (resolveRecipients) - לא מקבלים רשימה מוכנה מהלקוח, חוץ ממצב ידני שעובר אימות הסכמה.
 * mode: 'now' (מצב sending - הלקוח ממשיך לקרוא ל-sendChunk) | 'schedule' (scheduledAt חובה, עתידי) | 'draft'.
 */
export async function createCampaign({ input, filters, origin, employeeId, mode = 'now', scheduledAt = null }) {
  const clean = sanitizeCampaignInput(input);
  if (!clean.ok) return clean;
  if (!ORIGIN_RE.test(String(origin || ''))) return { ok: false, error: 'כתובת האתר לא תקינה' };
  const { recipients, total, truncated, error } = await resolveRecipients(filters);
  if (error) return { ok: false, error };
  if (!recipients.length) return { ok: false, error: 'אין נמענים מתאימים (רק לקוחות שאישרו דיוור, עם מייל תקין)' };
  if (truncated) return { ok: false, error: `נבחרו ${total} נמענים - המקסימום לדיוור הוא ${MAX_RECIPIENTS_PER_CAMPAIGN}. צמצמו את הבחירה.` };
  let scheduledIso = null;
  if (mode === 'schedule') {
    const t = new Date(scheduledAt);
    if (isNaN(t.getTime())) return { ok: false, error: 'מועד השליחה לא תקין' };
    if (t.getTime() < Date.now() - 60 * 1000) return { ok: false, error: 'מועד השליחה כבר עבר' };
    if (t.getTime() > Date.now() + 365 * 24 * 3600 * 1000) return { ok: false, error: 'מועד השליחה רחוק מדי (עד שנה)' };
    scheduledIso = t.toISOString();
  }
  // דיוור זהה (נושא + גוף + פילטר) של אותו יוצר מ-10 הדקות האחרונות נדחה: לחיצה כפולה / רענון באמצע שליחה לא תשלח את אותו מייל פעמיים (ממצא 8)
  const dup = await findRecentDuplicate({ clean: clean.value, filters: sanitizeFilters(filters), employeeId });
  if (dup) return { ok: false, duplicate: true, existingId: dup.id, error: 'דיוור זהה (אותו נושא, תוכן ובחירת נמענים) כבר נוצר ב-10 הדקות האחרונות. אם זו טעות - בטלו אותו קודם, או שנו משהו בתוכן.' };
  const doc = {
    v: 1, id: newId(), status: mode === 'schedule' ? 'scheduled' : mode === 'draft' ? 'draft' : 'sending',
    ...clean.value, origin: String(origin), filters: sanitizeFilters(filters), recipientIds: recipients.map((r) => r.id),
    createdAt: new Date().toISOString(), createdBy: employeeId || null, scheduledAt: scheduledIso,
    progress: { sent: [], failed: [], skipped: [] },
  };
  await writeDoc(doc);
  let scheduler = null;
  if (doc.status === 'scheduled') {
    scheduler = await registerWithScheduler(doc);
    doc.scheduler = scheduler.registered ? { exact: true, triggerId: scheduler.triggerId } : { exact: false, ...(scheduler.error ? { error: scheduler.error } : {}) };
    await writeDoc(doc);
  }
  return { ok: true, id: doc.id, total: doc.recipientIds.length, status: doc.status, ...(scheduler ? { scheduler: doc.scheduler } : {}) };
}

export const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
async function findRecentDuplicate({ clean, filters, employeeId }) {
  const rows = await prisma.systemSetting.findMany({ where: { key: { startsWith: CAMPAIGN_KEY_PREFIX } }, select: { value: true }, take: 300 });
  const now = Date.now();
  const sig = (d) => JSON.stringify([d.subject || '', d.bodyText || '', d.heading || '', d.filters || {}]);
  const mine = sig({ subject: clean.subject, bodyText: clean.bodyText, heading: clean.heading, filters });
  for (const r of rows) {
    const d = parseDoc(r.value);
    if (!d || d.status === 'cancelled' || (d.createdBy || null) !== (employeeId || null)) continue;
    if (now - new Date(d.createdAt).getTime() > DUPLICATE_WINDOW_MS) continue;
    if (sig(d) === mine) return d;
  }
  return null;
}

function sanitizeFilters(f) {
  const mode = ['all', 'city', 'event', 'manual'].includes(f && f.mode) ? f.mode : 'all';
  return {
    mode,
    ...(mode === 'city' ? { cities: (f.cities || []).map(String).slice(0, 100) } : {}),
    ...(mode === 'event' ? { eventFrom: String(f.eventFrom || ''), eventTo: String(f.eventTo || '') } : {}),
  };
}

export async function cancelCampaign(id) {
  const doc = await loadCampaign(id);
  if (!doc) return { ok: false, error: 'דיוור לא נמצא' };
  if (doc.status === 'done' || doc.status === 'cancelled') return { ok: false, error: 'הדיוור כבר הסתיים' };
  doc.status = 'cancelled';
  doc.finishedAt = new Date().toISOString();
  await writeDoc(doc);
  if (doc.scheduler && doc.scheduler.exact) await cancelWithScheduler(doc.id); // מוחק את הטריגר החד-פעמי (לא זורק)
  return { ok: true };
}

// ---------------------------------------------------------------------------
// רינדור מייל לנמען
// ---------------------------------------------------------------------------

function absoluteUrl(origin, path) { return `${origin}${path}`; }

/** בונה {subject, html, text} לנמען אחד. customer = { firstName, lastName }. unsubscribeUrl מוחלט. */
export async function buildCampaignEmail(doc, customer, { unsubscribeUrl, preview = false } = {}) {
  const cfg = await getEmailConfig('managerFreeText'); // שדות קבועים בלבד (שם גמ"ח / כתובת / טלפון / כותפת)
  const rows = await getAllCachedSettings();
  const get = (k) => rows.find((r) => r.key === k)?.value || '';
  const fx = cfg.fixed || {};
  const gmachName = fx.gmachName || get('gmach_name') || 'גמ"ח שמלות';
  const gmachAddress = fx.gmachAddress || get('gmach_address') || '';
  const gmachPhone = fx.gmachPhone || get('gmach_phone') || '';
  const vars = {
    firstName: customer.firstName || '', lastName: customer.lastName || '', fullName: fullNameOf(customer),
    gmachName, gmachPhone,
  };
  const subject = fillVars(doc.subject, vars, { subject: true }) || 'הודעה מ' + gmachName;
  const heading = fillVars(doc.heading || doc.subject, vars, { subject: true });
  const imageUrl = doc.imageAttachmentId ? absoluteUrl(doc.origin, `/api/attachment/${doc.imageAttachmentId}`) : '';
  const html = renderCampaignEmailHtml({
    title: heading, bodyHtml: renderRichText(doc.bodyText, vars), imageUrl, imageAlt: doc.imageAlt || '',
    buttonLabel: doc.buttonLabel || '', buttonUrl: doc.buttonUrl || '', unsubscribeUrl: preview ? (unsubscribeUrl || '') : unsubscribeUrl,
    kicker: 'הודעה', gmachName, gmachAddress, gmachPhone, cfg,
  });
  const text = [
    richTextToPlain(doc.bodyText, vars),
    doc.buttonUrl ? `\n${doc.buttonLabel}: ${doc.buttonUrl}` : '',
    '\n---',
    `קיבלת הודעה זו כי אישרת קבלת דיוורים מ${gmachName}.`,
    unsubscribeUrl ? `להסרה מרשימת הדיוור: ${unsubscribeUrl}` : '',
    [gmachName, gmachAddress, gmachPhone].filter(Boolean).join(' · '),
  ].filter((x) => x !== '').join('\n');
  return { subject, html, text, vars };
}

/** קבצים מצורפים כ-base64 (לפי ה-Attachment השמור). עוצר אם הסכום חורג. */
async function loadAttachments(doc) {
  const out = [];
  let total = 0;
  for (const a of doc.attachments || []) {
    const row = await prisma.attachment.findUnique({ where: { id: a.attachmentId }, select: { data: true } });
    if (!row) throw new Error(`הצרופה ${a.fileName} לא נמצאה (נמחקה?)`);
    const buf = Buffer.from(row.data);
    total += buf.length;
    if (total > MAX_ATTACHMENTS_TOTAL_BYTES) throw new Error('סך הצרופות גדול מדי');
    const ext = fileExtension(a.fileName);
    out.push({ fileName: a.fileName, fileContent: buf.toString('base64'), mimeType: ATTACHMENT_FILE_TYPES[ext] || 'application/octet-stream', sizeBytes: buf.length, dest: 'email' });
  }
  return out;
}

/** מייל בדיקה לעובד המחובר בלבד (לכתובת שבכרטיס העובד) - בלי תלות בהסכמת דיוור, עם נתוני דוגמה וקישור הסרה לדוגמה. */
export async function sendTestToEmployee({ input, employeeId, origin }) {
  const clean = sanitizeCampaignInput(input);
  if (!clean.ok) return clean;
  if (!ORIGIN_RE.test(String(origin || ''))) return { ok: false, error: 'כתובת האתר לא תקינה' };
  const emp = employeeId ? await prisma.employee.findUnique({ where: { id: employeeId }, select: { email: true, firstName: true, lastName: true } }) : null;
  if (!emp || !isValidEmail(emp.email)) return { ok: false, error: 'לא הוגדרה כתובת מייל בכרטיס העובד שלך - אין לאן לשלוח בדיקה' };
  const doc = { ...clean.value, id: 'preview', origin };
  const mail = await buildCampaignEmail(doc, { firstName: emp.firstName || 'רחל', lastName: emp.lastName || 'כהן' }, { unsubscribeUrl: absoluteUrl(origin, '/api/email/unsubscribe?t=example'), preview: true });
  let attachments = [];
  try { attachments = await loadAttachments(doc); } catch (e) { return { ok: false, error: e.message }; }
  const r = await sendSystemEmail({ to: emp.email.trim(), subject: `[בדיקה] ${mail.subject}`, body: mail.text, html: mail.html, attachments, employeeId });
  return r.success ? { ok: true, maskedTo: maskEmail(emp.email) } : { ok: false, error: r.message || 'השליחה נכשלה' };
}

/** תצוגה מקדימה (HTML) עם נתוני דוגמה. */
export async function previewCampaign({ input, origin, sampleCustomer }) {
  const clean = sanitizeCampaignInput(input, { requireContent: false });
  if (!clean.ok) return clean;
  const doc = { ...clean.value, id: 'preview', origin: ORIGIN_RE.test(String(origin || '')) ? origin : 'http://localhost' };
  const mail = await buildCampaignEmail(doc, sampleCustomer || { firstName: 'רחל', lastName: 'כהן' }, { unsubscribeUrl: absoluteUrl(doc.origin, '/api/email/unsubscribe?t=example'), preview: true });
  return { ok: true, subject: mail.subject, html: mail.html };
}

// ---------------------------------------------------------------------------
// שליחה בפועל (נקרא מ-endpoint של הלקוח בחתיכות, ומה-cron)
// ---------------------------------------------------------------------------

const LOCK_MS = 55 * 1000;
export const QUOTA_RESERVE = 25;
/** כמה מיילים מותר לשלוח בחתיכה: min(limit, מה שנותר במכסה פחות הרזרבה). מכסה לא ידועה (null) = limit. */
export function sendBudget(limit, remaining) {
  if (remaining === null || remaining === undefined) return limit;
  return Math.min(limit, Math.max(0, remaining - QUOTA_RESERVE));
}

/**
 * שולח עד `limit` נמענים שטרם נשלח אליהם. בטוח לקריאה חוזרת (התקדמות נשמרת אחרי כל שליחה; requestId קבוע מונע כפילות ב-Apps Script).
 * @returns {{ok:boolean, error?:string, done?:boolean, sent:number, failed:number, skipped:number, remaining:number, quota?:number|null, busy?:boolean}}
 */
export async function sendCampaignChunk(id, { limit = 5, deadlineMs = Date.now() + 40000 } = {}) {
  const doc = await loadCampaign(id);
  if (!doc) return { ok: false, error: 'דיוור לא נמצא', sent: 0, failed: 0, skipped: 0, remaining: 0 };
  if (doc.status === 'cancelled') return { ok: false, error: 'הדיוור בוטל', sent: 0, failed: 0, skipped: 0, remaining: 0 };
  if (doc.status === 'done') return { ok: true, done: true, sent: 0, failed: 0, skipped: 0, remaining: 0 };
  if (doc.status === 'draft') return { ok: false, error: 'הדיוור עדיין טיוטה', sent: 0, failed: 0, skipped: 0, remaining: 0 };
  if (doc.status === 'scheduled' && new Date(doc.scheduledAt).getTime() > Date.now()) return { ok: false, error: 'הדיוור מתוזמן למועד עתידי', sent: 0, failed: 0, skipped: 0, remaining: (doc.recipientIds || []).length };
  if (doc.lock && new Date(doc.lock).getTime() > Date.now()) return { ok: true, busy: true, sent: 0, failed: 0, skipped: 0, remaining: pendingOf(doc).length };

  // claim אטומי (compare-and-swap על ערך השורה): רק ריצה אחת תופסת את הדיוור - מתזמן + cron באותה דקה לא ישלחו פעמיים
  const before = await prisma.systemSetting.findUnique({ where: { key: CAMPAIGN_KEY_PREFIX + id } });
  if (!before) return { ok: false, error: 'דיוור לא נמצא', sent: 0, failed: 0, skipped: 0, remaining: 0 };
  doc.status = 'sending';
  doc.lock = new Date(Date.now() + LOCK_MS).toISOString();
  let expected = JSON.stringify(doc); // הערך ששמרנו בתפיסה - נקודת ההשוואה לכתיבות ההתקדמות (persistProgress)
  const claimed = await prisma.systemSetting.updateMany({ where: { key: CAMPAIGN_KEY_PREFIX + id, value: before.value }, data: { value: expected } });
  if (claimed.count !== 1) return { ok: true, busy: true, sent: 0, failed: 0, skipped: 0, remaining: pendingOf(doc).length };
  invalidateSettingsCache(CAMPAIGN_KEY_PREFIX + id);

  const result = { ok: true, sent: 0, failed: 0, skipped: 0 };
  let attachments = [];
  let cancelledMidway = false;
  try {
    attachments = await loadAttachments(doc);
    const pending = pendingOf(doc);
    const quota = await getMailerQuota();
    result.quota = quota.remaining;
    // רזרבה של QUOTA_RESERVE במכסה היומית: מיילים תפעוליים (אישורי הזמנה, תזכורות) משתפים את אותה מכסה ולא נשארים בלי (סקירת אבטחה 12.10.2026, ממצא 7)
    let budget = sendBudget(limit, quota.remaining);
    if (budget === 0 && pending.length) {
      result.error = 'מכסת המיילים היומית של חשבון השליחה נגמרה - ההמשך יישלח בהרצה הבאה (מחר)';
      result.quotaExhausted = true;
    }
    for (const customerId of pending) {
      if (budget <= 0 || Date.now() > deadlineMs) break;
      const fresh = await loadCampaign(id); // ביטול תוך כדי שליחה נעצר מיד
      if (!fresh || fresh.status === 'cancelled') { cancelledMidway = true; break; }
      const c = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, firstName: true, lastName: true, email: true, marketingConsent: true, isDeleted: true } });
      // הסכמה נבדקת מחדש ברגע השליחה
      if (!c || c.isDeleted || !c.marketingConsent || !isValidEmail(c.email)) {
        doc.progress.skipped.push(customerId); result.skipped++;
        continue;
      }
      try {
        const unsubscribeUrl = absoluteUrl(doc.origin, `/api/email/unsubscribe?t=${makeUnsubscribeToken(c.id)}`);
        const mail = await buildCampaignEmail(doc, c, { unsubscribeUrl });
        const r = await sendSystemEmail({
          to: c.email.trim(), subject: mail.subject, body: mail.text, html: mail.html, attachments,
          customerId: c.id, employeeId: doc.createdBy || undefined, requestId: `camp-${doc.id}-${c.id}`,
        });
        budget--;
        if (r.success) { doc.progress.sent.push(customerId); result.sent++; }
        else { doc.progress.failed.push({ id: customerId, error: String(r.message || 'שגיאה').slice(0, 160) }); result.failed++; }
      } catch (e) {
        doc.progress.failed.push({ id: customerId, error: String(e.message || e).slice(0, 160) }); result.failed++;
      }
      doc.lock = new Date(Date.now() + LOCK_MS).toISOString();
      const saved = await persistProgress(doc, expected); // התקדמות נשמרת אחרי כל נמען, ב-CAS: ביטול שנכתב בינתיים לא נדרס
      expected = saved.expected;
      if (saved.cancelled) { cancelledMidway = true; break; }
    }
  } catch (e) {
    result.ok = false;
    result.error = e.message || 'שגיאה בשליחה';
  }
  if (cancelledMidway) return { ...result, ok: false, error: 'הדיוור בוטל', remaining: pendingOf(doc).length };
  const left = pendingOf(doc).length;
  if (left === 0) { doc.status = 'done'; doc.finishedAt = new Date().toISOString(); }
  doc.lock = null;
  const finalSave = await persistProgress(doc, expected); // גם 'done' / שחרור המנעול ב-CAS: דיוור שבוטל בינתיים נשאר מבוטל
  if (finalSave.cancelled) return { ...result, ok: false, error: 'הדיוור בוטל', remaining: pendingOf(doc).length };
  result.remaining = left;
  result.done = left === 0;
  return result;
}

function pendingOf(doc) {
  const handled = new Set([...(doc.progress?.sent || []), ...(doc.progress?.skipped || []), ...((doc.progress?.failed || []).map((f) => f.id))]);
  return (doc.recipientIds || []).filter((x) => !handled.has(x));
}

/** מריץ דיוורים שהגיע זמנם (scheduled) או שנותרו באמצע (sending) עד תקרת זמן. נקרא מה-cron. */
export async function processDueCampaigns({ deadlineMs = Date.now() + 45000 } = {}) {
  const rows = await prisma.systemSetting.findMany({ where: { key: { startsWith: CAMPAIGN_KEY_PREFIX } }, select: { value: true }, take: 300 });
  const docs = rows.map((r) => parseDoc(r.value)).filter((d) => d && (d.status === 'scheduled' || d.status === 'sending'));
  const out = { processed: 0, sent: 0, failed: 0, more: 0, details: [] };
  for (const d of docs.sort((a, b) => String(a.scheduledAt || a.createdAt).localeCompare(String(b.scheduledAt || b.createdAt)))) {
    if (Date.now() > deadlineMs) break;
    if (d.status === 'scheduled' && new Date(d.scheduledAt).getTime() > Date.now()) continue;
    // "sending" שלקוח עדיין שולח אותו בחתיכות מהדפדפן (נעילה פעילה) לא נגע; sendCampaignChunk מחזיר busy
    const r = await sendCampaignChunk(d.id, { limit: 200, deadlineMs });
    out.processed++; out.sent += r.sent || 0; out.failed += r.failed || 0;
    out.details.push({ id: d.id, sent: r.sent, failed: r.failed, remaining: r.remaining, error: r.error || null });
    // more: דיוור שנשאר בו עוד ושהתקדם (לא עצר בגלל מכסה/שגיאה) - המתזמן מפעיל ריצה נוספת בעוד דקה. בלי התקדמות = לא ממשיכים בלולאה
    if (r.remaining > 0 && !r.error && !r.busy && ((r.sent || 0) + (r.failed || 0)) > 0) out.more++;
  }
  return out;
}

