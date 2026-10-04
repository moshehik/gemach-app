// ocDocsLogic.js — לוגיקה טהורה של "מסמכים" בכרטיס ההזמנה החדש (W7): תפריט ההדפסה (R6/A3/A4), שער התקנון (R7), הורדת PDF (A2), ייצוא Excel (A1),
// מייל מהיר (A8) + אפשרויות המייל (R8), "כתובת מייל חסרה". בלי React, בלי fetch, בלי DOM - נבדקת ב-node (scripts/order-card-tests/docs.*.test.mjs).
// הכרטיס הישן (components/orders/OrderPrintMenu.js) לא מייבא את הקובץ הזה; זה פורט של ההתנהגות שלו (מפת פורט ליד כל פונקציה).
//
// ===== מפת פורט (← components/orders/OrderPrintMenu.js) =====
// isValidEmail ← handleEmailSubmit :193 (אותה ביטוי) ; hasUsableEmail ← handleSendEmail :113 (`includes('@')`, כאן מחמיר יותר: ביטוי מלא)
// printOrderUrl ← openPrint :95-99 (`/print/order?orderId=..&type=..`) ; mailRequestBody ← sendOrderEmail :150-162
// EXTRA_DEST_OPTIONS ← :270-274 (צרופה למייל / דרייב + שיתוף / גם וגם) ; extraAttachmentOf ← :140-148
// קבצי המייל המהיר (A8, AMB-11 - החלטת הבעלים: לבנות את כל שישת הסוגים): פרטי ההזמנה, תקנון חתום (דוח ההשכרה), דף תשלומים, דף משלוח (PP-12),
// חשבונית/קבלה (אין באתר מסמך קבלה קיים - נבנה אישור תשלומים להדפסה/PDF מתשלומי ההזמנה) ותמונות דגמים (PDF מתמונות הדגמים השמורות, לא ZIP).
import { hebDateOf } from '../orderCardLogic';
import { isDeliveryOut } from '../../../../lib/schedule/deliveryDirection';
import { orderPrintPath } from '../../../../lib/schedule/print/orderMode';
import { QUICK_MAIL_MAX_BODY, QUICK_MAIL_MAX_SUBJECT } from '../../../../lib/orderQuickMail';

// ---------------------------------------------------------------------------------------------
// כתובת מייל
// ---------------------------------------------------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isValidEmail = (v) => EMAIL_RE.test(String(v || '').trim());
export const orderEmailOf = (order) => String((order && order.customer && order.customer.email) || '').trim();
/** יש כתובת מייל שאפשר לשלוח אליה (אחרת נפתח "כתובת מייל חסרה") */
export const hasUsableEmail = (order) => isValidEmail(orderEmailOf(order));
export const customerNameOf = (order) => [order?.customer?.firstName, order?.customer?.lastName].filter(Boolean).join(' ').trim() || 'הלקוח';

// ---------------------------------------------------------------------------------------------
// תפריט ההדפסה (R6): סיכום · השכרה · דף הכנה · דף משלוח · שליחה במייל · מייל השכרה
// ---------------------------------------------------------------------------------------------
export const printOrderUrl = (orderId, type) => `/print/order?orderId=${encodeURIComponent(orderId)}&type=${type === 'rental' ? 'rental' : 'order'}`;

/**
 * שורות התפריט לפי הזמנה והגדרות. access = { prep, delivery } (בוליאנים; undefined = עוד לא ידוע = מוצג, והשרת אוכף).
 * דף משלוח (A4, AMB-03 = PP-12): רק כש-enable_deliveries וההזמנה במשלוח הלוך. דף הכנה (A3 = PP-07): תמיד להזמנה.
 * kind: 'print' (פותח לשונית הדפסה) | 'mail' (חלון המייל). target: מה לפתוח.
 */
export function printMenuItems({ order, settings, access = {} } = {}) {
  const out = [
    { key: 'order', kind: 'print', icon: 'print', label: 'הדפסת סיכום ללקוח', target: 'order' },
    { key: 'rental', kind: 'print', icon: 'list', label: 'הדפסת השכרה', target: 'rental' },
  ];
  if (access.prep !== false) out.push({ key: 'prep', kind: 'print', icon: 'file', label: 'דף הכנה למחסן', target: 'PP-07' });
  const deliverable = !!(settings && settings.enableDeliveries) && isDeliveryOut(order);
  if (deliverable && access.delivery !== false) out.push({ key: 'delivery', kind: 'print', icon: 'truck', label: 'דף משלוח', target: 'PP-12' });
  out.push({ key: 'mail-order', kind: 'mail', icon: 'mail', label: 'שליחה במייל', target: 'order' });
  out.push({ key: 'mail-rental', kind: 'mail', icon: 'mail', label: 'שליחת מייל השכרה', target: 'rental' });
  return out;
}

/** כתובת הלשונית שנפתחת להדפסה (דף ההזמנה/השכרה הקיים, או דף הלו״ז להזמנה בודדת) */
export function printTargetUrl(item, orderId) {
  if (!item || item.kind !== 'print') return null;
  if (item.target === 'order' || item.target === 'rental') return printOrderUrl(orderId, item.target);
  return orderPrintPath(item.target, orderId);
}

/** access מתשובת GET /api/schedule/print?format=access ({allowed, forbidden}) או מסטטוס שגיאה (403 = אין page:schedule) */
export function accessFromResponse(status, body) {
  if (status === 403 || status === 401) return { prep: false, delivery: false };
  if (status === 200 && body && Array.isArray(body.allowed)) return { prep: body.allowed.includes('PP-07'), delivery: body.allowed.includes('PP-12') };
  return {}; // לא ידוע (תקלה/501) - מציגים, והשרת אוכף
}

// ---------------------------------------------------------------------------------------------
// שער התקנון (R7): לפני פתיחת תפריט ההדפסה/מייל. ב"חתם" נשמר hasSignedRegulations (oc.toggleSignature({confirmed:true}))
// ---------------------------------------------------------------------------------------------
export const needsRegulationsGate = (order) => !(order && order.hasSignedRegulations);

// ---------------------------------------------------------------------------------------------
// קבצי המייל המהיר (A8, AMB-11)
// ---------------------------------------------------------------------------------------------
// kind = EMAIL_ATTACHMENT_KINDS של W0 (lib/history/orderEvents.js): order-pdf | rental-pdf | delivery | regulations | payments | receipt | model-photos | file
export const MAIL_FILES = Object.freeze([
  { id: 'ord', kind: 'order-pdf', name: 'פרטי ההזמנה', ext: 'PDF' },
  { id: 'reg', kind: 'rental-pdf', name: 'תקנון חתום', ext: 'PDF', need: 'sig', miss: 'טרם נחתם' },
  { id: 'pay', kind: 'payments', name: 'דף תשלומים', ext: 'PDF' },
  { id: 'del', kind: 'delivery', name: 'דף משלוח', ext: 'PDF', need: 'del', miss: 'ללא משלוח' },
  { id: 'inv', kind: 'receipt', name: 'חשבונית/קבלה', ext: 'PDF', need: 'receipt', miss: 'אין תשלומים' },
  { id: 'img', kind: 'model-photos', name: 'תמונות דגמים', ext: 'PDF', need: 'photos', miss: 'אין תמונות דגמים' },
]);

/** הקבצים כפי שמוצגים: exists=false כשהמסמך לא רלוונטי להזמנה (טרם נחתם / ללא משלוח / אין תשלומים / אין תמונות דגמים) */
export function mailFilesFor({ order, settings, items = [], payments = [] }) {
  const delivery = !!(settings && settings.enableDeliveries) && isDeliveryOut(order);
  const hasPayments = payments.some((p) => !p.isDeleted && num(p.amount) !== 0);
  const hasPhotos = modelPhotosOf(items).length > 0;
  return MAIL_FILES.map((f) => ({
    ...f,
    exists: !((f.need === 'sig' && !(order && order.hasSignedRegulations)) || (f.need === 'del' && !delivery)
      || (f.need === 'receipt' && !hasPayments) || (f.need === 'photos' && !hasPhotos)),
  }));
}

export const MAIL_DEST_OPTIONS = Object.freeze([
  { v: 'email', label: 'צרופה למייל' },
  { v: 'drive', label: 'דרייב + שיתוף' },
  { v: 'both', label: 'גם וגם' },
]);
export const MAX_QUICK_SUBJECT = QUICK_MAIL_MAX_SUBJECT; // אותן מגבלות כמו השרת (lib/orderQuickMail.js)
export const MAX_QUICK_BODY = QUICK_MAIL_MAX_BODY;

/** נושא ברירת מחדל למייל מהיר (כמו בדגימה: "הזמנה #N") */
export const defaultMailSubject = (order) => `הזמנה #${order && order.orderId}`;

/** המייל המהיר תקין לשליחה: כתובת תקינה + נושא + תוכן */
export function quickMailValid({ to, subject, bodyText }) {
  return isValidEmail(to) && !!String(subject || '').trim() && !!String(bodyText || '').trim()
    && String(subject).length <= MAX_QUICK_SUBJECT && String(bodyText).length <= MAX_QUICK_BODY;
}

export const driveModeNote = (mode) => (mode === 'drive' || mode === 'both' ? 'הקבצים יועלו לדרייב וישותפו עם הנמען בהרשאת הורדה מלאה.' : '');

/** קובץ שנבחר ידנית ("קבצים נוספים", R8) -> צרופה לבקשה (אותה צורה כמו הישן, + kind:'file') */
export function extraAttachmentOf({ name, base64, mimeType, size }, dest) {
  return { fileName: name, fileContent: base64, mimeType: mimeType || 'application/octet-stream', sizeBytes: size || null, dest: dest || 'email', kind: 'file' };
}
/** מסמך שנוצר במערכת (PDF) -> צרופה לבקשה. dest: יעד הקבצים שנבחר בחלון (R8) */
export function docAttachmentOf({ kind, fileName, base64 }, dest) {
  return { fileName, fileContent: base64, mimeType: 'application/pdf', sizeBytes: Math.round((String(base64 || '').length * 3) / 4), dest: dest || 'email', kind };
}

/** שם קובץ ה-PDF/Excel שמורד/מצורף */
export const docFileName = (kind, orderId, ext) => {
  const base = { 'order-pdf': 'הזמנה', 'rental-pdf': 'השכרה', delivery: 'משלוח', payments: 'תשלומים', receipt: 'קבלה', 'model-photos': 'תמונות דגמים', xlsx: 'הזמנה' }[kind] || 'מסמך';
  return `${base} ${orderId}.${ext}`;
};

/**
 * גוף POST /api/orders/[id]/email.
 *  mode 'doc'   (שליחה במייל / מייל השכרה מהתפריט): הזמנה/השכרה כ-PDF ראשי (pdfBase64) + קבצים נוספים - כמו הישן.
 *  mode 'quick' (A8): נושא ותוכן חופשיים (quick:{subject,bodyText}) + צרופות לפי kind (extraAttachments), בלי PDF ראשי.
 * approval = {employeeId, pin} מ-oc.approve (אחרי 403 approval_required).
 */
export function mailRequestBody({ mode, email, type = 'order', pdfBase64, subject, bodyText, attachments = [], sendMode = 'email', approval = null }) {
  const body = {
    email,
    type: type === 'rental' ? 'rental' : 'order',
    extraAttachments: attachments,
    sendMode: ['email', 'drive', 'both'].includes(sendMode) ? sendMode : 'email',
    ...(approval ? { emailApproverId: approval.employeeId, emailApproverPin: approval.pin } : {}),
  };
  if (mode === 'quick') body.quick = { subject: String(subject || '').trim().slice(0, MAX_QUICK_SUBJECT), bodyText: String(bodyText || '').trim().slice(0, MAX_QUICK_BODY) };
  else if (pdfBase64) body.pdfBase64 = pdfBase64;
  return body;
}

/** טוסט ההצלחה אחרי שליחה ("נשלח ל-… · N קבצים") */
export function mailSentToast(to, fileCount, driveCount = 0) {
  const files = fileCount === 0 ? 'ללא קבצים' : fileCount === 1 ? 'קובץ אחד' : `${fileCount} קבצים`;
  return { big: `נשלח ל-${to}`, small: driveCount > 0 ? `${files} · ${driveCount === 1 ? 'קובץ אחד הועלה' : `${driveCount} קבצים הועלו`} לדרייב` : files };
}

// ---------------------------------------------------------------------------------------------
// ייצוא Excel (A1) - עברית בלבד בכל תאריך (ENG-11); מספרים כמספרים; טלפון/ת״ז כטקסט
// ---------------------------------------------------------------------------------------------
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const itemName = (it) => it?.dressItem?.dress?.name || it?.dressModelName || it?.modelName || it?.description || '';
const methodOf = (p) => p?.paymentMethod || p?.method || '';

/** גיליונות הקובץ: הזמנה (שדה/ערך), פריטים, חיובים, תשלומים. מקור: מצב השרת האחרון (snapshot) - מה שנשמר. */
export function orderExportSheets({ order, items = [], obligations = [], payments = [] }) {
  const o = order || {};
  const c = o.customer || {};
  const activeItems = items.filter((i) => !i.isDeleted);
  const activeObl = obligations.filter((x) => !x.isDeleted);
  const activePay = payments.filter((p) => !p.isDeleted);
  const required = activeObl.reduce((s, x) => s + num(x.amount), 0);
  const paid = activePay.reduce((s, p) => s + num(p.amount), 0);
  const eventRange = o.isAbroad || o.isWeekdayEvent
    ? [hebDateOf(o.fromDate), hebDateOf(o.toDate)].filter(Boolean).join(' – ')
    : '';
  const summary = [
    ['מספר הזמנה', o.orderId],
    ['לקוח', customerNameOf(o)],
    ['טלפון', String(c.phone1 || '')],
    ['טלפון נוסף', String(c.phone2 || '')],
    ['מייל', String(c.email || '')],
    ['תאריך אירוע', o.eventDateHebrew || hebDateOf(o.eventDate)],
    ...(eventRange ? [['תקופת השכרה', eventRange]] : []),
    ['תאריך ביצוע', hebDateOf(o.orderDate)],
    ['משלוח', o.isDelivery ? `כן${o.deliveryDirection ? ` · ${o.deliveryDirection}` : ''}${o.deliveryCity ? ` · ${o.deliveryCity}` : ''}` : 'לא'],
    ['חתימה על תקנון', o.hasSignedRegulations ? 'כן' : 'לא'],
    ['הערות', String(o.notes || '')],
    ['סה״כ לחיוב', Math.round(required * 100) / 100],
    ['סה״כ שולם', Math.round(paid * 100) / 100],
    ['יתרה', Math.round((required - paid) * 100) / 100],
  ].map(([k, v]) => ({ 'שדה': k, 'ערך': v === undefined || v === null ? '' : v }));
  return [
    { sheetName: 'הזמנה', rows: summary },
    {
      sheetName: 'פריטים',
      rows: activeItems.map((it, i) => ({
        '#': i + 1, 'דגם': itemName(it), 'מידה': String(it.sizeText || it.dressItem?.sizeText || ''),
        'מחיר': num(it.finalPrice ?? it.price), 'נלקח': it.isTaken || it.takenDate ? 'כן' : 'לא', 'הוחזר': it.isReturned || it.returnDate ? 'כן' : 'לא',
        'תיקונים': [it.neckAlteration > 0 ? 'צוואר' : '', it.sleeveAlteration > 0 ? 'שרוול' : '', it.lengthAlteration && !['', 'null', '0'].includes(String(it.lengthAlteration)) ? `אורך ${it.lengthAlteration}` : ''].filter(Boolean).join(', '),
      })),
    },
    { sheetName: 'חיובים', rows: activeObl.map((x) => ({ 'תיאור': String(x.description || ''), 'סכום': num(x.amount) })) },
    {
      sheetName: 'תשלומים',
      rows: activePay.map((p) => ({ 'תאריך': hebDateOf(p.paymentDate), 'אופן תשלום': methodOf(p), 'סכום': num(p.amount), 'הערות': String(p.notes && String(p.notes).trim().startsWith('{') ? '' : p.notes || '') })),
    },
  ];
}

// ---------------------------------------------------------------------------------------------
// "דף תשלומים" (A8/AMB-11: מקטע התשלומים של דוח ההזמנה, כקובץ נפרד): HTML עצמאי (צבעים קבועים, בלי משתני ערכת נושא) ל-/api/pdf
// ---------------------------------------------------------------------------------------------
export const escapeHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const shekel = (n) => `₪${Math.round(num(n) * 100) / 100}`;

function paymentNoteOf(raw) {
  // אותה הסתרה של JSON סליקה כמו בדוח ההזמנה: רק "אישור: XYZ" / "סליקת אשראי", לעולם לא גוף גולמי של סליקה
  const s = String(raw || '').trim();
  if (!s) return '-';
  if (s.startsWith('{')) {
    try {
      const p = JSON.parse(s);
      const approval = p.Confirmation || p.TransactionId || p['אישור'];
      return approval ? `אישור: ${approval}` : 'סליקת אשראי';
    } catch { return 'סליקת אשראי'; }
  }
  return s.length > 50 ? `${s.slice(0, 50)}...` : s;
}

export function paymentsPageHtml({ order, obligations = [], payments = [], gmachName = 'גמ"ח שמלות' }) {
  const o = order || {};
  const activePay = payments.filter((p) => !p.isDeleted);
  const required = obligations.filter((x) => !x.isDeleted).reduce((s, x) => s + num(x.amount), 0);
  const paid = activePay.reduce((s, p) => s + num(p.amount), 0);
  const rows = activePay.length
    ? activePay.map((p) => `<tr><td>${escapeHtml(hebDateOf(p.paymentDate))}</td><td>${escapeHtml(methodOf(p) || '-')}</td><td style="font-weight:bold">${escapeHtml(shekel(p.amount))}</td><td>${escapeHtml(paymentNoteOf(p.notes))}</td></tr>`).join('')
    : '<tr><td colspan="4" style="text-align:center;color:#999;padding:24px">לא התקבלו תשלומים</td></tr>';
  return `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8"><style>
body{font-family:Arial,'Segoe UI',sans-serif;margin:0;padding:24px;color:#333;direction:rtl}
h1{font-size:24px;margin:0 0 6px;color:#222}.sub{color:#888;font-size:13px;margin-bottom:22px}
table{width:100%;border-collapse:collapse;margin-bottom:22px;border:1px solid #e5e5e5}
th,td{padding:11px 12px;text-align:right;border-bottom:1px solid #eee;font-size:14px}th{background:#f4f4f4;color:#333}
.sum td{border:0;padding:6px 12px;font-size:15px}.sum .tot td{font-size:18px;font-weight:700;border-top:2px solid #e5e5e5}
</style></head><body>
<div style="font-size:13px;color:#999;margin-bottom:6px">בס"ד</div>
<h1>${escapeHtml(gmachName)}</h1>
<div class="sub">דף תשלומים · הזמנה #${escapeHtml(o.orderId)} · ${escapeHtml(customerNameOf(o))}</div>
<table><thead><tr><th>תאריך (עברי)</th><th>אופן תשלום</th><th>סכום</th><th>הערות</th></tr></thead><tbody>${rows}</tbody></table>
<table class="sum" style="width:320px;border:0;margin-inline-start:auto"><tr><td>סה"כ לחיוב:</td><td>${escapeHtml(shekel(required))}</td></tr><tr><td>סה"כ שולם:</td><td>${escapeHtml(shekel(paid))}</td></tr><tr class="tot"><td>יתרה לתשלום:</td><td>${escapeHtml(shekel(Math.max(0, required - paid)))}</td></tr></table>
<div style="text-align:center;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:10px">הופק על ידי מערכת גמ"ח שמלות</div>
</body></html>`;
}

// ---------------------------------------------------------------------------------------------
// "חשבונית/קבלה" (A8, AMB-11): באתר אין מסמך קבלה קיים (יש רק אייקון), לכן נבנה אישור תשלומים: מה התקבל, מתי ובאיזה אופן + סה״כ שהתקבל.
// זהו אישור קבלת תשלום של הגמ״ח ללקוחה - לא חשבונית מס ולא קבלה לפי פקודת מס הכנסה (אין באתר מספור קבלות). HTML עצמאי ל-/api/pdf.
// ---------------------------------------------------------------------------------------------
export function receiptPageHtml({ order, payments = [], gmachName = 'גמ"ח שמלות' }) {
  const o = order || {};
  const activePay = payments.filter((p) => !p.isDeleted && num(p.amount) !== 0);
  const paid = activePay.reduce((s, p) => s + num(p.amount), 0);
  const rows = activePay.map((p, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(hebDateOf(p.paymentDate))}</td><td>${escapeHtml(methodOf(p) || '-')}</td><td style="font-weight:bold">${escapeHtml(shekel(p.amount))}</td><td>${escapeHtml(paymentNoteOf(p.notes))}</td></tr>`).join('');
  return `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8"><style>
body{font-family:Arial,'Segoe UI',sans-serif;margin:0;padding:28px;color:#333;direction:rtl}
h1{font-size:26px;margin:0 0 4px;color:#222}h2{font-size:20px;margin:18px 0 6px;color:#222}.sub{color:#777;font-size:14px;margin-bottom:20px}
.box{border:1.5px solid #333;border-radius:6px;padding:14px 18px;margin:16px 0;background:#f7f7f7;font-size:16px}
table{width:100%;border-collapse:collapse;margin-bottom:22px;border:1px solid #e5e5e5}
th,td{padding:10px 12px;text-align:right;border-bottom:1px solid #eee;font-size:14px}th{background:#f4f4f4;color:#333}
.sign{display:flex;justify-content:space-between;margin-top:46px;font-size:14px;color:#555}.sign div{width:220px;border-top:1px solid #aaa;padding-top:8px;text-align:center}
</style></head><body>
<div style="font-size:13px;color:#999;margin-bottom:6px">בס"ד</div>
<h1>${escapeHtml(gmachName)}</h1>
<h2>אישור קבלת תשלום</h2>
<div class="sub">קבלה · הזמנה #${escapeHtml(o.orderId)} · על שם ${escapeHtml(customerNameOf(o))}</div>
<div class="box">התקבל סך <b>${escapeHtml(shekel(paid))}</b> עבור הזמנה #${escapeHtml(o.orderId)}${o.eventDateHebrew ? ` (אירוע: ${escapeHtml(o.eventDateHebrew)})` : ''}.</div>
<table><thead><tr><th>#</th><th>תאריך (עברי)</th><th>אופן תשלום</th><th>סכום</th><th>הערות</th></tr></thead><tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#999;padding:24px">לא התקבלו תשלומים</td></tr>'}</tbody></table>
<div class="sign"><div>חתימת הגמ"ח</div><div>הופק במערכת הגמ"ח</div></div>
</body></html>`;
}

// ---------------------------------------------------------------------------------------------
// "תמונות דגמים" (A8, AMB-11): PDF של תמונות הדגמים של פריטי ההזמנה (DressModel.imageUrl / thumbnailUrl, נשמרות ב-DB כ-Attachment).
// ה-HTML נשלח ל-/api/pdf שחוסם כל בקשת רשת חוץ מ-data: - לכן כל תמונה מוטמעת כ-data URI (ocDocsImages.js, מוקטנת).
// ---------------------------------------------------------------------------------------------
export const MAX_MODEL_PHOTOS = 24;

/** דגמים ייחודיים עם תמונה בפריטים הפעילים: [{key, name, urls:[imageUrl, thumbnailUrl], sizes:[...]}] (עד MAX_MODEL_PHOTOS) */
export function modelPhotosOf(items = []) {
  const byModel = new Map();
  for (const it of items) {
    if (!it || it.isDeleted) continue;
    const dress = it.dressItem && it.dressItem.dress;
    const urls = [dress && dress.imageUrl, dress && dress.thumbnailUrl].filter((u) => typeof u === 'string' && u.trim());
    if (!urls.length) continue;
    const key = String(dress.id || dress.name || urls[0]);
    if (!byModel.has(key)) byModel.set(key, { key, name: String(dress.name || it.description || 'דגם'), urls, sizes: [] });
    const size = it.sizeText || (it.dressItem && it.dressItem.sizeText);
    const entry = byModel.get(key);
    if (size && !entry.sizes.includes(String(size))) entry.sizes.push(String(size));
  }
  return [...byModel.values()].slice(0, MAX_MODEL_PHOTOS);
}

/** photos = [{name, sizes, dataUri}] (רק תמונות שנטענו) */
export function modelPhotosPageHtml({ order, photos = [], gmachName = 'גמ"ח שמלות' }) {
  const o = order || {};
  const cells = photos.map((p) => `<figure><img src="${escapeHtml(p.dataUri)}" alt="${escapeHtml(p.name)}"><figcaption><b>דגם ${escapeHtml(p.name)}</b>${p.sizes && p.sizes.length ? `<br>מידה ${escapeHtml(p.sizes.join(', '))}` : ''}</figcaption></figure>`).join('');
  return `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8"><style>
body{font-family:Arial,'Segoe UI',sans-serif;margin:0;padding:24px;color:#333;direction:rtl}
h1{font-size:24px;margin:0 0 4px;color:#222}.sub{color:#777;font-size:14px;margin-bottom:18px}
.grid{display:flex;flex-wrap:wrap;gap:18px}figure{margin:0;width:calc(50% - 9px);break-inside:avoid;text-align:center}
img{max-width:100%;max-height:340px;object-fit:contain;border:1px solid #ddd;border-radius:6px}figcaption{font-size:14px;margin-top:6px}
</style></head><body>
<div style="font-size:13px;color:#999;margin-bottom:6px">בס"ד</div>
<h1>${escapeHtml(gmachName)}</h1>
<div class="sub">תמונות הדגמים · הזמנה #${escapeHtml(o.orderId)} · ${escapeHtml(customerNameOf(o))}</div>
<div class="grid">${cells}</div>
</body></html>`;
}
