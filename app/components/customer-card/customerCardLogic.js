// customerCardLogic — פונקציות טהורות של כרטיס הלקוח החדש (בלי React, בלי fetch). נבדק ב-node: scripts/customer-card-tests/*.
// כל ה-payload-ים שהכרטיס שולח לשרת נבנים כאן, באותה צורה בדיוק כמו בכרטיס הישן (app/customers/[id]/LegacyCustomerPage.js +
// components/customers/modern/*), כדי שבדיקת השוויון (parity.test.mjs) תוכיח שהשרת מקבל אותו דבר. התוספת היחידה: cardVariant:'a5'
// בגוף השמירה / יצירת הלקוח - בזכותה השרת אוכף את customer_required_fields רק לכרטיס החדש.

import { normalizeEmail } from '../../../lib/emailUtils.js';
import {
  validateCustomerFieldFormats, parseFieldGroups, unsatisfiedFieldGroupErrors, isFieldRequiredByGroup,
} from '../../../lib/customerValidation.js';
import { missingRequiredFields, requiredFieldLabel } from '../../../lib/customerRequiredFields.js';

export const CARD_VARIANT = 'a5';

// חתימה על התקנון ברמת לקוח: אין עמודות ב-Customer עדיין (prisma/migrations-pending/2026-10-04-customer-signed-regulations.sql).
// עד שהן ייווצרו - תצוגה נגזרת לקריאה בלבד מההזמנות (Order.hasSignedRegulations). להדליק רק אחרי הרצת ה-SQL ועדכון ה-PUT.
export const SIGNATURE_COLUMNS_READY = false;

// ---------- שדות הכרטיס ----------
// השדות שהכרטיס עורך (תת-קבוצה של ה-data של PUT /api/customers/[id]). "שם מלא" ו"כתובת מגורים" יחידים לא קיימים (הבעלים:
// "תוריד לגמרי את שם מלא - זה שילוב של פרטי ומשפחה"; רחוב + מספר בית). cat = קטגוריית ההיסטוריה של השינוי.
export const CARD_FIELDS = [
  { key: 'firstName', label: 'שם פרטי', icon: 'user', cat: 'cust' },
  { key: 'lastName', label: 'שם משפחה', icon: 'user', cat: 'cust' },
  { key: 'phone1', label: 'טלפון', icon: 'phone', cat: 'cust' },
  { key: 'phone2', label: 'טלפון נוסף', icon: 'phone', cat: 'cust' },
  { key: 'email', label: 'מייל', icon: 'mail', cat: 'cust' },
  { key: 'street', label: 'רחוב', icon: 'pin', cat: 'cust' },
  { key: 'houseNum', label: 'מספר בית', icon: 'pin', cat: 'cust' },
  { key: 'city', label: 'עיר', icon: 'pin', cat: 'cust' },
  { key: 'zeout', label: 'תעודת זהות', icon: 'file', cat: 'cust' },
  { key: 'marketingConsent', label: 'מאשר/ת קבלת דיוורים', icon: 'mail', cat: 'cust', bool: true },
  { key: 'notes', label: 'הערות', icon: 'note', cat: 'cust' },
  { key: 'bankName', label: 'שם בנק', icon: 'bank', cat: 'pay' },
  { key: 'bankBranch', label: 'סניף', icon: 'bank', cat: 'pay' },
  { key: 'bankAccount', label: 'מספר חשבון', icon: 'bank', cat: 'pay' },
  { key: 'bankAccountName', label: 'שם בעל החשבון', icon: 'bank', cat: 'pay' },
];
export const CARD_FIELD_KEYS = CARD_FIELDS.map((f) => f.key);
const FIELD = new Map(CARD_FIELDS.map((f) => [f.key, f]));
export const fieldMeta = (key) => FIELD.get(key) || { key, label: key, icon: 'user', cat: 'cust' };

const isBlank = (v) => v === null || v === undefined || String(v).trim() === '';
const clean = (v) => (v === null || v === undefined ? '' : String(v));
export const nameOk = (n) => n && String(n).toLowerCase() !== 'null';

export function displayName(c) {
  if (!c) return '';
  return [c.firstName, c.lastName].filter(nameOk).join(' ') || 'לקוח ללא שם';
}

// ---------- השוואת ערכים / רשימת השינויים במסילה ----------
// השוואה "של משתמש": null / '' / undefined שווים; מספר מול מחרוזת של אותו מספר שווים (houseNum מגיע כמספר ונערך כמחרוזת).
export function sameValue(key, a, b) {
  const meta = FIELD.get(key);
  if (meta && meta.bool) return !!a === !!b;
  if (isBlank(a) && isBlank(b)) return true;
  return String(a ?? '').trim() === String(b ?? '').trim() && String(a ?? '') === String(b ?? '');
}

const short = (v, max = 26) => { const s = clean(v); return s.length > max ? `${s.slice(0, max)}…` : s; };
export function showValue(key, v) {
  const meta = FIELD.get(key);
  if (meta && meta.bool) return v ? 'מאושר' : 'לא מאושר';
  return isBlank(v) ? 'ריק' : short(v);
}

/**
 * השינויים שלא נשמרו, שדה אחרי שדה (סדר CARD_FIELDS). כל שינוי: {key:'f:<field>', field, icon, label, cat, text, plain, note, old, nw}.
 * text הוא HTML-free: הרכיב מדגיש את התווית בעצמו.
 */
export function computeChanges(saved, cur) {
  if (!saved || !cur) return [];
  const out = [];
  for (const f of CARD_FIELDS) {
    if (sameValue(f.key, saved[f.key], cur[f.key])) continue;
    const old = showValue(f.key, saved[f.key]);
    const nw = showValue(f.key, cur[f.key]);
    const verb = f.bool ? (cur[f.key] ? 'סומן' : 'בוטל') : 'עודכן';
    out.push({ key: `f:${f.key}`, field: f.key, icon: f.icon, label: f.label, cat: f.cat, verb, text: `${f.label} ${verb}`, plain: `${f.label} ${verb}`, note: `${old} ← ${nw}`, old, nw });
  }
  return out;
}

/** ביטול שינוי של שדה אחד: מחזיר עותק של cur עם הערך השמור של השדה. */
export function undoField(cur, saved, field) {
  return { ...cur, [field]: saved ? saved[field] : undefined };
}

// ---------- payload-ים לשרת (זהים לכרטיס הישן) ----------
/** הגוף של PUT /api/customers/[id] בכרטיס הישן (LegacyCustomerPage.js handleSave): כל אובייקט הלקוח + מייל מנורמל. */
export function legacySavePayload(customer) {
  return { ...customer, email: normalizeEmail(customer.email, customer.emailSuffix) };
}
/** הגוף של הכרטיס החדש = בדיוק הישן + cardVariant (אכיפת customer_required_fields בשרת). */
export function buildSavePayload(customer) {
  return { ...legacySavePayload(customer), cardVariant: CARD_VARIANT };
}

/** טופס לקוח חדש: אותו אובייקט פתיחה כמו בישן (LegacyCustomerPage.js, id === 'new'). */
export function newCustomerInitial() {
  return { firstName: '', lastName: '', phone1: '', phone2: '', email: '', city: '', street: '', houseNum: '', notes: '' };
}
export function buildNewCustomerPayload(customer) {
  return buildSavePayload(customer);
}

/** ביטול חסימה - PATCH /api/customers/[id] (זהה לישן). */
export const unblockPayload = () => ({ isBlocked: false, blockedReason: null });

/** תשלום מכרטיס הלקוח - POST /api/payments, אותו גוף כמו "תשלום נוסף" בכרטיס ההזמנה הישן (ModernPaymentsManager submitAdditionalPayment). */
export function buildPaymentPayload({ orderId, amount, paymentMethod, notes }) {
  return { orderId, amount, paymentMethod: paymentMethod || 'מזומן', notes: notes || '' };
}

/** האישור שתשלום ידני מהכרטיס דורש: בנווה יעקב (consolidate_manual_payment_credit_ui) - feature:manual_payment_credit_add, כמו
 * הכפתור המאוחד "הוספת תשלום/זיכוי ידני" בכרטיס ההזמנה הישן; אחרת אין אישור (כמו "תשלום נוסף" הישן). */
export const paymentApprovalLevel = (settings = {}) => (settings.consolidate_manual_payment_credit_ui === 'true' ? 'feature:manual_payment_credit_add' : null);

/** אופני התשלום לתשלום ידני - בדיוק כמו additionalPaymentMethodOptions בכרטיס ההזמנה הישן (בלי אשראי). */
export function manualPaymentMethods(settings = {}) {
  const raw = settings.ALLOWED_PAYMENT_METHODS
    ? String(settings.ALLOWED_PAYMENT_METHODS).split(',').map((s) => s.trim()).filter(Boolean)
    : ['מזומן', 'העברה בנקאית', "צ'ק"];
  const withoutCredit = raw.filter((opt) => !opt.includes('אשראי'));
  return withoutCredit.length > 0 ? withoutCredit : ['מזומן'];
}
export const paymentMethodIcon = (m) => {
  const s = String(m || '');
  if (s.includes('מזומן')) return 'cash';
  if (s.includes('אשראי')) return 'card';
  if (s.includes('העברה')) return 'bank';
  if (s.includes('צ') || s.includes('שיק')) return 'cheque';
  if (s.includes('זיכוי')) return 'undo';
  return 'wallet';
};

/** מייל - POST /api/send-email, אותו גוף כמו ModernSendEmailModal. attachments: [{fileName,fileContent,mimeType,sizeBytes}] (כבר base64). */
export function buildMailPayload({ customer, subject, body, attachments = [], sendMode = 'email', driveFolderId = '', auth }) {
  const list = attachments.map((a) => ({
    fileName: a.fileName,
    fileContent: a.fileContent,
    mimeType: a.mimeType || 'application/octet-stream',
    sizeBytes: a.sizeBytes || null,
    dest: sendMode,
  }));
  return {
    to: customer.email,
    subject,
    emailBody: body,
    username: auth.employeeId,
    password: auth.pin,
    customerId: customer.id,
    fileName: list[0]?.fileName || '',
    fileContent: list[0]?.fileContent || '',
    attachments: list,
    sendMode,
    driveFolderId,
  };
}

export const mailSubjectFor = (customer) => `כרטיס לקוח · ${displayName(customer)}`;

// ---------- ולידציה לפני שמירה ----------
/**
 * @param {object} c אובייקט הלקוח הנוכחי
 * @param {{requiredKeys:string[], isNew?:boolean, settings?:object}} o
 * @returns {{ok:boolean, errors:string[], field:string|null, missing:string[]}}
 */
export function validateForSave(c, { requiredKeys = [], isNew = false, settings = {} } = {}) {
  const errors = [];
  let field = null;
  const missing = missingRequiredFields(c, requiredKeys);
  if (missing.length) { errors.push(`שדות חובה חסרים: ${missing.map(requiredFieldLabel).join(', ')}`); field = missing[0]; }
  if (isNew) {
    // הכללים הקיימים של יצירת לקוח (כמו בטופס הישן), בנוסף ל-customer_required_fields
    const groupErrors = unsatisfiedFieldGroupErrors(c, parseFieldGroups(settings.mandatory_field_groups));
    errors.push(...groupErrors);
    const extra = [];
    if (settings.require_customer_email === 'true' && isBlank(c.email)) extra.push(['email', 'דוא"ל']);
    if (settings.require_full_address === 'true') {
      if (isBlank(c.city)) extra.push(['city', 'עיר']);
      if (isBlank(c.street)) extra.push(['street', 'רחוב']);
      if (isBlank(c.houseNum)) extra.push(['houseNum', 'מספר בית']);
    }
    if (settings.require_customer_id_number === 'true' && isBlank(c.zeout)) extra.push(['zeout', 'תעודת זהות']);
    const extraNew = extra.filter(([k]) => !missing.includes(k));
    if (extraNew.length) { errors.push(`שדות חובה חסרים: ${extraNew.map(([, l]) => l).join(', ')}`); field = field || extraNew[0][0]; }
    if (!field && groupErrors.length) field = parseFieldGroups(settings.mandatory_field_groups).find((g) => !g.some((k) => !isBlank(c[k])))?.[0] || null;
  }
  const fmt = validateCustomerFieldFormats(c);
  if (fmt.length) {
    errors.push(...fmt);
    if (!field) {
      if (fmt.some((e) => e.includes('הטלפון הראשי'))) field = 'phone1';
      else if (fmt.some((e) => e.includes('טלפון'))) field = 'phone2';
      else if (fmt.some((e) => e.includes('דוא"ל'))) field = 'email';
      else if (fmt.some((e) => e.includes('תעודת'))) field = 'zeout';
    }
  }
  return { ok: errors.length === 0, errors, field, missing };
}

/** כוכבית ליד תווית: חובה לפי ההגדרה, או (בלקוח חדש) לפי הכללים הקיימים של יצירה. */
export function isStarred(key, c, { requiredKeys = [], isNew = false, settings = {} } = {}) {
  if (requiredKeys.includes(key)) return true;
  if (!isNew) return false;
  if (key === 'email' && settings.require_customer_email === 'true') return true;
  if (['city', 'street', 'houseNum'].includes(key) && settings.require_full_address === 'true') return true;
  if (key === 'zeout' && settings.require_customer_id_number === 'true') return true;
  if ((key === 'email' || key === 'phone2') && isFieldRequiredByGroup(key, c, parseFieldGroups(settings.mandatory_field_groups))) return true;
  return false;
}

// ---------- הערות: שורות אוטומטיות (קישור להזמנה) ושורות ידניות ----------
// אותו regex כמו renderCustomerNotes בכרטיס הישן (נכתב ע"י app/api/returns/report-issue).
export const AUTO_NOTE_RE = /\[(\d{1,2}\.\d{1,2}\.\d{4})\] אוטומטי: שמלה (\d+) \(הזמנה (\d+)\) (.*)/;
export function parseAutoNote(line) {
  const m = String(line || '').match(AUTO_NOTE_RE);
  if (!m) return null;
  const [, dateStr, barcode, orderId, rest] = m;
  const [day, month, year] = dateStr.split('.').map(Number);
  return { line, date: new Date(year, month - 1, day, 12), barcode, model: barcode.substring(0, 3), size: barcode.substring(3, 5) || '', orderId: Number(orderId), rest };
}
/** מפריד את ההערות לטקסט הידני (נערך בתיבה) ולשורות האוטומטיות (מוצגות כקישורים, לא נערכות). */
export function splitNotes(notes) {
  const lines = clean(notes).split('\n');
  const manual = [];
  const auto = [];
  for (const l of lines) { const a = parseAutoNote(l); if (a) auto.push(a); else manual.push(l); }
  return { manual: manual.join('\n'), auto };
}
/**
 * מחבר בחזרה: הטקסט הידני כפי שנערך + השורות האוטומטיות בסופן (כך המערכת מוסיפה אותן). כשהטקסט הידני לא השתנה - ההערות
 * המקוריות חוזרות כמו שהן (בלי שינוי סדר שקט).
 */
export function joinNotes(originalNotes, manualText) {
  const { manual, auto } = splitNotes(originalNotes);
  if (manual === manualText) return originalNotes ?? '';
  const m = clean(manualText).replace(/\s+$/, '');
  return [m, ...auto.map((a) => a.line)].filter((x, i) => i > 0 || x !== '').join('\n');
}

// ---------- כספים: מודול משותף עם השרת (lib/customerAccount.js) - אותה נוסחה כמו הכרטיס הישן ----------
import { orderRequired, orderPaid, accountSummary, deleteBlockers } from '../../../lib/customerAccount.js';
export { orderRequired, orderPaid, accountSummary, deleteBlockers };
const orderRefunds = (o, refunds) => (refunds || []).filter((r) => r.orderId === o.orderId).reduce((s, r) => s + (r.amount || 0), 0);

/** חיובים פתוחים: הזמנות (לא מחוקות) שנשאר בהן לתשלום, החדשה ראשונה. */
export function openCharges(customer, refunds = []) {
  return sortOrders(customer?.orders || [])
    .filter((o) => !o.isDeleted)
    .map((o) => { const required = orderRequired(o); const paid = orderPaid(o) - orderRefunds(o, refunds); return { order: o, required, paid, due: Math.round((required - paid) * 100) / 100 }; })
    .filter((x) => x.due > 0);
}

/** רשימת התשלומים + הזיכויים (אותו מיזוג ומיון כמו allPayments בכרטיס הישן). */
export function paymentRows(customer, refunds = []) {
  if (!customer?.orders) return [];
  return [
    ...customer.orders.flatMap((order) => (order.payments || []).map((p) => ({ ...p, orderId: order.orderId, entryType: 'payment' }))),
    ...(refunds || []).map((r) => ({ ...r, entryType: 'refund', paymentDate: r.createdAt, paymentMethod: 'זיכוי' })),
  ].sort((a, b) => new Date(b.paymentDate || b.createdAt || 0) - new Date(a.paymentDate || a.createdAt || 0));
}

// ---------- הזמנות ----------
const eventSortDate = (o) => ((o.isWeekdayEvent || o.isAbroad) ? (o.fromDate || o.eventDate || o.orderDate || o.createdAt || 0) : (o.eventDate || o.orderDate || o.createdAt || 0));
/** אותו מיון כמו ModernCustomerOrdersTab: לפי תאריך האירוע, החדש ראשון. */
export function sortOrders(orders) {
  return [...(orders || [])].sort((a, b) => new Date(eventSortDate(b)) - new Date(eventSortDate(a)));
}
export const orderEventIso = (o) => eventSortDate(o) || null;
// "דגם 4512" לכל פריט פעיל: קידומת הברקוד (barcodePrefix של הפריט / של השמלה), אחרת התיאור
export const orderItemModels = (o) => (o.items || []).filter((i) => !i.isDeleted).map((i) => {
  const prefix = i.barcodePrefix ?? i.dressItem?.barcodePrefix;
  if (prefix !== null && prefix !== undefined && prefix !== '') return `דגם ${prefix}${i.size ? ` מידה ${i.size}` : ''}`;
  return i.description || i.dressItem?.dressName || '';
}).filter(Boolean);
export function deliveryText(o) {
  if (!o.isDelivery) return '';
  return [o.deliveryDirection || 'משלוח', o.deliveryCity || o.deliveryAddress].filter(Boolean).join(' · ');
}

// ---------- חתימה (נגזרת מההזמנות עד שתהיה עמודה ב-Customer) ----------
export function signatureState(customer) {
  if (SIGNATURE_COLUMNS_READY && customer && typeof customer.hasSignedRegulations === 'boolean') {
    return { signed: customer.hasSignedRegulations, at: customer.regulationsSignedAt || null, orderId: null, derived: false };
  }
  const signedOrder = sortOrders(customer?.orders || []).find((o) => !o.isDeleted && o.hasSignedRegulations);
  return { signed: !!signedOrder, at: signedOrder ? (signedOrder.orderDate || null) : null, orderId: signedOrder ? signedOrder.orderId : null, derived: true };
}

// ---------- סמני לשוניות (C-A5, J6) ----------
export function tabMarkers({ customer, requiredKeys = [], balance = 0 }) {
  const out = {};
  const miss = missingRequiredFields(customer || {}, requiredKeys);
  if (miss.length) out.details = { key: 'cust', cls: 'debt', icon: 'alert', tip: `חסר: ${miss.map(requiredFieldLabel).join(', ')}` };
  if (balance > 0) out.payments = { key: 'pay', cls: 'debt', icon: 'alert', tip: 'יש חוב' };
  else if (balance < 0) out.payments = { key: 'pay', cls: 'cred', icon: 'undo', tip: 'יש זיכוי' };
  return out;
}

// ---------- אישור מנהל (אותה הכרעה כמו customAuthPrompt / OcApproval של כרטיס ההזמנה) ----------
export const ROLE_LABELS = { 0: 'הנהלה ראשית', 1: 'מנהל', 2: 'מתכנת' };
export const employeeRoleLabel = (e) => (e && (e.department?.name || ROLE_LABELS[e.roleId])) || 'עובד';
export const APPROVAL_MAX_TRIES = 3;
export const APPROVAL_LOCK_MS = 30000;
/** העובדים שמורשים לאשר ברמה המבוקשת (מסננת את מי שאין לו את רמת ההרשאה, הבעלים PG1). */
export function filterApprovers(employees, level) {
  let list = Array.isArray(employees) ? employees.filter((e) => e && e.isActive !== false) : [];
  if (level === 'מנהל') list = list.filter((e) => e.roleId === 1 || e.roleId === 2);
  else if (level === 'מתכנת') list = list.filter((e) => e.roleId === 2);
  else if (level === 'הנהלה ראשית') list = list.filter((e) => e.roleId === 0 || e.roleId === 2);
  else if (level === 'מנהל סניף ומעלה') list = list.filter((e) => e.roleId === 0 || e.roleId === 1 || e.roleId === 2);
  else if (level === 'מאשר הזמנה ללא תשלום') list = list.filter((e) => e.canApproveWithoutPayment);
  else if (typeof level === 'string' && level.startsWith('feature:')) list = list.filter((e) => e.approvals && e.approvals[level]);
  return list;
}

// ---------- מסמכים לצירוף במייל: רק מה שקיים היום (הבעלים: "הצג כרגע רק דפים קיימים") ----------
// כל מסמך כאן מיוצר כ-PDF בשרת (POST /api/pdf, path) מדף הדפסה קיים. "דף פרטי קשר" נוסף ברשימה לפי תשובת הבעלים CC-O9 (4.10.2026). "תקנון חתום" ו"קבלות" לא קיימים - לא מוצגים.
export function mailDocuments(customer) {
  const cid = encodeURIComponent(customer.id);
  const docs = [
    { id: 'card', name: 'כרטיס לקוחה', path: `/print/customer?customerId=${cid}&type=card&downloadPdf=true`, preview: `/print/customer?customerId=${cid}&type=card&preview=1`, file: `כרטיס לקוחה - ${displayName(customer)}` },
    { id: 'account', name: 'דף חשבון', path: `/print/customer?customerId=${cid}&type=account&downloadPdf=true`, preview: `/print/customer?customerId=${cid}&type=account&preview=1`, file: `דף חשבון - ${displayName(customer)}` },
    { id: 'contact', name: 'דף פרטי קשר', path: `/print/customer?customerId=${cid}&type=contact&downloadPdf=true`, preview: `/print/customer?customerId=${cid}&type=contact&preview=1`, file: `דף פרטי קשר - ${displayName(customer)}` },
  ];
  for (const o of sortOrders(customer.orders || []).filter((x) => !x.isDeleted).slice(0, 6)) {
    const p = `/print/order?orderId=${o.orderId}&type=order&downloadPdf=true`;
    docs.push({ id: `order-${o.orderId}`, name: `סיכום הזמנה #${o.orderId}`, path: p, preview: p, file: `הזמנה ${o.orderId}` });
  }
  return docs;
}
// מסמכים שבעיצוב אבל לא קיימים במערכת (לדוח לבעלים, לא מוצגים בכרטיס)
export const MISSING_MAIL_DOCUMENTS = ['תקנון חתום (אין חתימה ברמת לקוח ואין מסמך תקנון חתום)', 'קבלות (אין מחולל קבלות)'];

// ---------- היסטוריה (סינון / חיפוש / טבלה) - רשומות GET /api/customers/[id]/history ----------
export const HIST_CATS = [['cust', 'פרטים', 'user'], ['orders', 'הזמנות', 'file'], ['pay', 'תשלומים', 'card'], ['docs', 'מסמכים', 'file']];
const HF_EXTRA = [['sig', 'חתימות', 'sig'], ['print', 'הדפסות', 'print'], ['mail', 'מיילים', 'mail']];
export const histIn = (e, k) => (['sig', 'print', 'mail'].includes(k) ? e.icon === k : e.category === k);
export function histCats(entries) {
  return HIST_CATS.concat(HF_EXTRA.filter(([k]) => (entries || []).some((e) => histIn(e, k))));
}
export const histWords = (q) => String(q || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
export function histHay(e) {
  return [e.title, e.detail || '', e.actor?.name || '', e.time || '', e.hebrewDate || '', ...(e.details || []).flat(), e.from || '', e.to || ''].join(' ').toLowerCase();
}
export function histVisible(entries, sel = [], q = '') {
  const w = histWords(q);
  return (entries || []).filter((e) => (!sel.length || sel.some((k) => histIn(e, k))) && (!w.length || w.every((x) => histHay(e).includes(x))));
}
export function histRowData(e) {
  return { act: e.title, date: e.at, prev: e.from ?? '—', new: e.to ?? (e.detail || '—'), who: e.actor?.name || '' };
}

// ---------- ייצוא Excel ----------
/** שורות הגיליון של כרטיס הלקוחה (פרטים + הזמנות + תשלומים), תאריכים עבריים בלבד. hebrew: Date -> string. */
export function customerXlsxSheets(customer, refunds, hebrew) {
  const h = (d) => (d ? hebrew(new Date(d)) : '');
  const acc = accountSummary(customer, refunds);
  const details = [
    ['שם פרטי', customer.firstName], ['שם משפחה', customer.lastName], ['טלפון', customer.phone1], ['טלפון נוסף', customer.phone2],
    ['מייל', customer.email], ['רחוב', customer.street], ['מספר בית', customer.houseNum], ['עיר', customer.city],
    ['תעודת זהות', customer.zeout], ['מספר לקוח', customer.legacyId], ['הערות', splitNotes(customer.notes).manual],
    ['שם בנק', customer.bankName], ['סניף', customer.bankBranch], ['מספר חשבון', customer.bankAccount], ['שם בעל החשבון', customer.bankAccountName],
    ['סה״כ חיובים', acc.required], ['סה״כ שולם', acc.paid], ['סה״כ זיכויים', acc.refunds], [acc.balance >= 0 ? 'יתרת חוב' : 'יתרת זכות', Math.abs(acc.balance)],
  ].map(([field, value]) => ({ 'שדה': field, 'ערך': value ?? '' }));
  const orders = sortOrders(customer.orders || []).map((o) => ({
    'הזמנה': o.orderId, 'תאריך אירוע': h(orderEventIso(o)), 'פריטים': orderItemModels(o).join(', '),
    'סכום': orderRequired(o), 'שולם': orderPaid(o), 'יתרה': Math.round((orderRequired(o) - orderPaid(o)) * 100) / 100, 'מחוקה': o.isDeleted ? 'כן' : '',
  }));
  const pays = paymentRows(customer, refunds).map((p) => ({
    'תאריך': h(p.paymentDate), 'סוג': p.entryType === 'refund' ? 'זיכוי' : 'תשלום', 'הזמנה': p.orderId || '', 'אופן תשלום': p.entryType === 'refund' ? (p.reason || 'זיכוי') : p.paymentMethod,
    'סכום': p.entryType === 'refund' ? -(p.amount || 0) : (p.amount || 0),
  }));
  return { details, orders, payments: pays };
}

export function safeFileBase(name) {
  return String(name || 'לקוח').replace(/[\\/:*?"<>|]/g, ' ').trim() || 'לקוח';
}
