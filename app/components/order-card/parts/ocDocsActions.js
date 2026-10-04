// ocDocsActions.js — פעולות המסמכים של כרטיס ההזמנה החדש (W7), פונקציות async עם תלויות מוזרקות (fetch / pdf / oc / ui) כדי שאפשר יהיה
// לבדוק אותן ב-node בלי דפדפן (scripts/order-card-tests/docs.actions.test.mjs). הרכיבים (OcPrintMenu / OcMailSheet / OcExports /
// OcMissingEmail) רק קוראים להן.
//
// מקורות ההתנהגות (הכרטיס הישן, קפוא): components/orders/OrderPrintMenu.js — קריאת ה-HTML של ההזמנה (`returnHtmlOnly`) → PDF אמיתי
// (/api/pdf, Puppeteer) → base64 כצרופה; אישור מנהל רק אחרי 403 approval_required (feature:customer_email_approval) ושליחה חוזרת עם אותו PDF;
// שמירת כתובת מייל חדשה בכרטיס הלקוח (PUT /api/customers/:id עם כל שדות הלקוח). כאן במקום window.alert/customAuthPrompt: ui.* / oc.approve.
// רישום להיסטוריה: הדפסה נרשמת ע"י דף ההדפסה עצמו (חוזה W0 §1.5) - לא כאן; הורדת PDF / ייצוא Excel = oc.logEvent; מייל = השרת (EMAIL_SENT / EMAIL_FAILED).
import {
  mailRequestBody, docAttachmentOf, extraAttachmentOf, docFileName, paymentsPageHtml, orderExportSheets, orderEmailOf, isValidEmail,
} from './ocDocsLogic';
import { orderPrintPath } from '../../../../lib/schedule/print/orderMode';

const jsonOf = async (res) => { try { return await res.json(); } catch { return {}; } };

const defaultPdf = () => import('@/app/lib/pdfClient');

/** ה-HTML של דוח ההזמנה/ההשכרה (אותו HTML שהישן הופך ל-PDF) מהשרת - בלי לשלוח כלום */
export async function fetchReportHtml({ fetchImpl = fetch, orderId, type, email }) {
  // הנתיב דורש שדה email גם ב-returnHtmlOnly (לא נשלח לשום מקום); כתובת הלקוח כשיש, אחרת ערך מזהה שאינו כתובת אמיתית
  const res = await fetchImpl(`/api/orders/${orderId}/email`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email || 'preview@invalid.local', type: type === 'rental' ? 'rental' : 'order', returnHtmlOnly: true }),
  });
  const data = await jsonOf(res);
  if (!res.ok || !data.success || !data.html) throw new Error(data.error || 'שגיאה ביצירת נתוני המסמך');
  return data.html;
}

/**
 * PDF (base64) של מסמך מערכת לפי kind (EMAIL_ATTACHMENT_KINDS של W0): order-pdf / rental-pdf (דוחות ההזמנה/ההשכרה), payments (דף תשלומים,
 * מ-HTML מקומי), delivery (תעודת משלוח PP-12 של הלו״ז להזמנה זו). שגיאה = Error עם הודעה בעברית.
 */
export async function makeDocPdf({ kind, orderId, email, data, fetchImpl = fetch, pdf, gmachName }) {
  const client = pdf || (await defaultPdf());
  if (kind === 'order-pdf' || kind === 'rental-pdf') {
    const html = await fetchReportHtml({ fetchImpl, orderId, type: kind === 'rental-pdf' ? 'rental' : 'order', email });
    return client.fetchPdfBase64({ html, filename: docFileName(kind, orderId, 'pdf').replace(/\.pdf$/, '') });
  }
  if (kind === 'payments') {
    const html = paymentsPageHtml({ order: data && data.order, obligations: data && data.obligations, payments: data && data.payments, gmachName });
    return client.fetchPdfBase64({ html, filename: docFileName('payments', orderId, 'pdf').replace(/\.pdf$/, '') });
  }
  if (kind === 'delivery') {
    const path = orderPrintPath('PP-12', orderId, { downloadPdf: true });
    if (!path) throw new Error('מספר הזמנה לא תקין');
    return client.fetchPdfBase64({ path, filename: docFileName('delivery', orderId, 'pdf').replace(/\.pdf$/, '') });
  }
  throw new Error('סוג מסמך לא נתמך');
}

const readFileBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
  reader.onerror = () => reject(new Error('נכשלה קריאת הקובץ'));
  reader.readAsDataURL(file);
});

/**
 * שליחת מייל הזמנה (mode 'doc') או מייל מהיר (mode 'quick'). מחזיר { ok, fileCount, driveLinks } | { ok:false, cancelled? , error? }.
 * אישור מנהל: ניסיון ראשון בלי אישור; 403 approval_required → oc.approve('feature:customer_email_approval') → שליחה חוזרת עם אותו PDF.
 */
export async function sendOrderMail({
  oc, orderId, mode, to, type = 'order', subject, bodyText, kinds = [], extraFiles = [], sendMode = 'email', docData, email,
  fetchImpl = fetch, pdf, readFile = readFileBase64, gmachName, onStep,
}) {
  if (!isValidEmail(to)) return { ok: false, error: 'כתובת המייל אינה תקינה' };
  try {
    const attachments = [];
    let pdfBase64 = null;
    if (mode === 'doc') {
      onStep && onStep('pdf');
      pdfBase64 = await makeDocPdf({ kind: type === 'rental' ? 'rental-pdf' : 'order-pdf', orderId, email: to, data: docData, fetchImpl, pdf, gmachName });
    } else {
      for (const kind of kinds) {
        onStep && onStep('pdf', kind);
        const base64 = await makeDocPdf({ kind, orderId, email: to, data: docData, fetchImpl, pdf, gmachName });
        attachments.push(docAttachmentOf({ kind, fileName: docFileName(kind, orderId, 'pdf'), base64 }, sendMode));
      }
    }
    for (const file of extraFiles) {
      attachments.push(extraAttachmentOf({ name: file.name, base64: await readFile(file), mimeType: file.type, size: file.size }, sendMode));
    }
    onStep && onStep('send');
    const send = async (approval) => {
      const res = await fetchImpl(`/api/orders/${orderId}/email`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mailRequestBody({ mode, email: to, type, pdfBase64, subject, bodyText, attachments, sendMode, approval })),
      });
      return { status: res.status, data: await jsonOf(res) };
    };
    let { status, data } = await send(null);
    if (status === 403 && data.code === 'approval_required') {
      const approval = await oc.approve('feature:customer_email_approval', `שליחת מייל ללקוח · הזמנה #${orderId}`);
      if (!approval) return { ok: false, cancelled: true };
      ({ status, data } = await send(approval));
    }
    if (data && data.success) {
      oc.bumpHistory && oc.bumpHistory();
      return { ok: true, fileCount: attachments.length + (pdfBase64 ? 1 : 0), driveLinks: Array.isArray(data.driveLinks) ? data.driveLinks : [] };
    }
    oc.bumpHistory && oc.bumpHistory(); // גם כישלון נרשם בהיסטוריה (EMAIL_FAILED)
    return { ok: false, error: (data && data.error) || 'השליחה נכשלה' };
  } catch (e) {
    return { ok: false, error: (e && e.message) || 'שגיאה ביצירת ה-PDF או בשליחת המייל' };
  }
}

/** שמירת כתובת מייל חדשה בכרטיס הלקוח (כמו handleEmailSubmit בישן: PUT עם כל שדות הלקוח). מחזיר { ok, email } */
export async function saveCustomerEmail({ oc, email, fetchImpl = fetch }) {
  const clean = String(email || '').trim();
  if (!isValidEmail(clean)) return { ok: false, error: 'כתובת המייל שהוזנה אינה תקינה.' };
  const customer = oc.order && oc.order.customer;
  if (!customer || !customer.id) return { ok: true, email: clean, unsaved: true }; // אין לקוח לשמור אליו - שולחים לכתובת שהוקלדה
  try {
    const res = await fetchImpl(`/api/customers/${customer.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...customer, email: clean }),
    });
    if (!res.ok) return { ok: false, error: 'שמירת הכתובת בכרטיס הלקוח נכשלה' };
    oc.patchOrder({ customer: { ...customer, email: clean } });
    return { ok: true, email: clean };
  } catch {
    return { ok: false, error: 'שגיאת תקשורת בשמירת הכתובת' };
  }
}

/** A2: הורדת סיכום ההזמנה כ-PDF + ORDER_PDF_DOWNLOADED. אותו HTML כמו ההדפסה/המייל. */
export async function downloadOrderPdf({ oc, orderId, fetchImpl = fetch, pdf }) {
  const client = pdf || (await defaultPdf());
  const email = orderEmailOf(oc.order);
  const html = await fetchReportHtml({ fetchImpl, orderId, type: 'order', email });
  const fileName = docFileName('order-pdf', orderId, 'pdf');
  await client.downloadPdf({ html, filename: fileName.replace(/\.pdf$/, '') }, fileName);
  await oc.logEvent('ORDER_PDF_DOWNLOADED', { doc: 'order', fileName });
  return { ok: true, fileName };
}

/** A1: ייצוא ההזמנה ל-Excel (גיליון לכל מקטע, RTL, תאריכים עבריים) + ORDER_XLSX_EXPORTED. מקור: מצב השרת האחרון (מה שנשמר). */
export async function exportOrderXlsx({ oc, orderId, download }) {
  const snap = oc.snapshot || {};
  const sheets = orderExportSheets({
    order: snap.order || oc.order, items: snap.items || oc.items, obligations: snap.obligations || oc.obligations, payments: snap.payments || oc.payments,
  });
  const fileName = docFileName('xlsx', orderId, 'xlsx');
  const save = download || (async (rows, name) => (await import('../../../../lib/schedule/print/xlsx')).downloadScheduleXlsx(rows, name));
  const ok = await save(sheets, fileName.replace(/\.xlsx$/, ''));
  if (!ok) return { ok: false };
  await oc.logEvent('ORDER_XLSX_EXPORTED', { fileName });
  return { ok: true, fileName };
}
