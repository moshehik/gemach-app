// מיילים לדוגמה לכל סוג בקטלוג (lib/emailCatalog.js) - למסך /admin/email-test.
//
// כל דוגמה משתמשת בדיוק באותן תבניות HTML (lib/emailTemplates.js) ובאותה שליחה (lib/mailer.js)
// שבהן משתמש המייל האמיתי, אבל עם נתוני דמה - כך שהנמען רואה כיצד המייל באמת ייראה, בלי
// לגעת בהזמנות/לקוחות אמיתיים. שתי הדוגמאות עם צרופות ("מייל חופשי" ו"כרטיס הזמנה") מצרפות
// מסמך הזמנה/השכרה אמיתי (ctx.order, ר' loadSampleOrder בנתיב ה-API) ולא קובץ ריק.
// טקסט הגוף (plain) משוכפל מאתרי השליחה בכוונה ("דוגמה" בלבד): אם שינית ניסוח באתר שליחה,
// עדכן גם כאן כדי שהמסך ישקף את המציאות.
//
// לא מייצרים כאן לוגיקה עסקית ואין כתיבה למסד נתונים מלבד שורת EmailLog שיוצרת השליחה עצמה.

import {
  renderGenericEmailHtml,
  renderPasswordResetEmailHtml,
  renderErrorReportEmailHtml,
  renderCourierDeliveryEmailHtml,
  renderOrderCardEmailHtml,
  renderOrderConfirmationEmailHtml,
  renderPickupReminderEmailHtml,
  renderLateReturnEmailHtml,
  renderRefundExecutedEmailHtml,
  renderDailyReportEmailHtml,
  renderManualBarcodesEmailHtml,
  renderInternalMessageEmailHtml,
  renderHumanRequestedEmailHtml,
  renderAgentDigestEmailHtml,
  renderEmailGallery,
} from '@/lib/emailTemplates';
import { EMAIL_CATALOG, emailSubject } from '@/lib/emailCatalog';

const SAMPLE_PREFIX = '[דוגמה] ';

// PDF מינימלי תקין (עמוד ריק) - רק כשאין הזמנה אמיתית זמינה לצרף
const FALLBACK_PDF_B64 = Buffer.from(
  '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF'
).toString('base64');

function pdfAttachment(fileName, b64) {
  const content = b64 || FALLBACK_PDF_B64;
  return { fileName, fileContent: content, mimeType: 'application/pdf', sizeBytes: Math.round((content.length * 3) / 4), dest: 'email' };
}

/**
 * @param {string} id מזהה בקטלוג
 * @param {object} ctx
 * @param {string} [ctx.gmachName] @param {string} [ctx.gmachAddress] @param {string} [ctx.gmachPhone]
 * @param {{orderId:number, customerName:string, eventDate:string, pdfs?:{order?:string, rental?:string}, reports?:{order?:string}}} [ctx.order]
 *   הזמנה אמיתית (או undefined = צרופה ריקה). pdfs = base64 של ה-PDF שכבר הופק; reports.order = ה-HTML של הדוח
 *   (לשליחה בנתיב ה-PDF של Apps Script, בדיוק כמו המייל האמיתי).
 * @returns {{name:string, note?:string, subject:string, body:string, html:string, attachments?:Array, bugRouting?:boolean, rtlBody?:boolean, pdfFromHtml?:{html:string,fileName:string}}}
 */
export function buildSampleEmail(id, ctx = {}) {
  const gmachName = ctx.gmachName || 'גמ"ח שמלות';
  const gmachAddress = ctx.gmachAddress || 'רחוב הדוגמה 1, ירושלים';
  const gmachPhone = ctx.gmachPhone || '02-1234567';
  const hebrewDate = 'כז אלול תשפ"ו';
  const meta = EMAIL_CATALOG[id];
  if (!meta) throw new Error(`אין דוגמה למייל "${id}"`);
  const wrap = (r) => ({ name: meta.name, ...r, subject: `${SAMPLE_PREFIX}${r.subject}` });

  switch (id) {
    case 'passwordResetSelf':
    case 'passwordResetManager': {
      const byManager = id === 'passwordResetManager';
      return wrap({
        subject: emailSubject(id),
        body: `שלום דנה,\n\n${byManager ? 'סיסמתך למערכת הגמ"ח אופסה על ידי מנהל.' : 'ביקשת לאפס את סיסמתך למערכת הגמ"ח.'}\nסיסמה זמנית: AB12-cd34\n\nיש להתחבר עם הסיסמה הזמנית ולהגדיר סיסמה חדשה בהתחברות הבאה.\nאם לא ביקשת איפוס סיסמה, ${byManager ? 'יש לפנות למנהל המערכת.' : 'אפשר להתעלם מהודעה זו ולפנות למנהל המערכת.'}`,
        html: renderPasswordResetEmailHtml({ firstName: 'דנה', tempPassword: 'AB12-cd34', triggeredByManager: byManager, gmachName, gmachPhone }),
      });
    }

    case 'managerFreeText': {
      const text = 'שלום רב,\nמצורף המסמך שביקשת. אם יש שאלות, אפשר להשיב למייל זה או להתקשר: 02-1234567.\nתודה, ובשורות טובות!';
      const o = ctx.order;
      const files = [pdfAttachment(o ? `דוח השכרה ${o.orderId}.pdf` : 'מסמך לדוגמה.pdf', o?.pdfs?.rental)];
      return wrap({
        subject: emailSubject(id, { subject: 'המסמך שביקשת' }),
        body: text,
        html: renderGenericEmailHtml({ title: 'המסמך שביקשת', bodyText: text, gmachName, subtitle: 'הודעה מהגמ"ח', icon: '📎' }),
        attachments: files,
        note: 'צרופה: דוח השכרה אמיתי (PDF)',
      });
    }

    case 'orderCard': {
      const o = ctx.order;
      const orderId = o?.orderId || 12345;
      const files = [pdfAttachment(`הזמנה ${orderId}.pdf`, o?.pdfs?.order)];
      const html = renderOrderCardEmailHtml({
        orderId, printType: 'order', customerName: o?.customerName || 'רחל כהן', eventDate: o?.eventDate || hebrewDate,
        gmachName, gmachAddress, gmachPhone,
      });
      return wrap({
        subject: emailSubject(id, { orderId }),
        body: 'מצורף כרטיס הזמנה/השכרה.',
        html,
        attachments: files,
        // במייל האמיתי ה-PDF נוצר ב-Apps Script מה-HTML של הדוח (action sendGemachOrderEmail)
        ...(o?.reports?.order ? { pdfFromHtml: { html: o.reports.order, fileName: `הזמנה ${orderId}.pdf` } } : {}),
        note: 'צרופה: כרטיס הזמנה אמיתי (PDF)',
      });
    }

    case 'orderCreatedAuto': {
      const items = [{ name: 'שמלת ערב "מיכל"', size: '38' }, { name: 'שמלת ערב "נועה"', size: '40' }];
      const pickupLine = 'ביום ג׳ כה אלול תשפ"ו בשעה 20:00-21:30';
      const returnLine = 'יום ה׳ כח אלול תשפ"ו עד השעה 13:00';
      return wrap({
        subject: emailSubject(id, { orderId: 12345, gmachName }),
        body: `שלום רחל כהן,\nהזמנתך #12345 נקלטה בהצלחה ב${gmachName}.\nתאריך אירוע: ${hebrewDate}\nקבלת השמלות: ${pickupLine}\nהחזרת השמלות: ${returnLine}\nפריטים: ${items.map(i => `${i.name} (מידה: ${i.size})`).join(', ')}\nסה"כ לחיוב: ₪450\nסה"כ שולם: ₪200\nיתרה לתשלום: ₪250\nכתובת איסוף: ${gmachAddress}\nטלפון: ${gmachPhone}\n\nנשמח לראותך!`,
        html: renderOrderConfirmationEmailHtml({ customerName: 'רחל כהן', orderId: 12345, eventDate: hebrewDate, pickupLine, returnLine, items, totalCharge: 450, totalPaid: 200, balance: 250, gmachName, gmachAddress, gmachPhone }),
      });
    }

    case 'pickupReminder': {
      const items = ['שמלת ערב "מיכל" (38)', 'שמלת ערב "נועה" (40)'];
      return wrap({
        subject: emailSubject(id, { orderId: 12345, gmachName }),
        body: `שלום רחל כהן,\n\nתזכורת: מחר (${hebrewDate}) איסוף ההזמנה #12345 ב${gmachName}.\nכתובת: ${gmachAddress}\nטלפון: ${gmachPhone}\nפריטים: ${items.join(', ')}\n\nנשמח לראותכם!`,
        html: renderPickupReminderEmailHtml({ customerName: 'רחל כהן', orderId: 12345, eventDate: hebrewDate, items, gmachName, gmachAddress, gmachPhone }),
      });
    }

    case 'lateReturnReminder': {
      const message = 'המערכת זיהתה שלא החזרתם את השמלות, במידה ולא יחזרו במיידי המערכת מעבירה לגביה אוטומטית.';
      return wrap({
        subject: emailSubject(id, { orderId: 12345 }),
        body: `שלום רחל,\n\n${message}\nהזמנה #12345 - תאריך החזרה: ${hebrewDate}\n`,
        html: renderLateReturnEmailHtml({ customerName: 'רחל', orderId: 12345, returnDate: hebrewDate, message, gmachName, gmachAddress, gmachPhone }),
      });
    }

    case 'bulkEventDate': {
      const msg = 'שלום לכולם,\nרצינו לעדכן שהגמ"ח יהיה סגור ביום חמישי הקרוב, ונפתח מחדש ביום ראשון.\nתודה על ההבנה!';
      const orderLine = `הזמנה #12345, אירוע: ${hebrewDate}`;
      const confirmUrl = 'https://example.com/api/bulk-email/confirm?token=SAMPLE';
      return wrap({
        subject: emailSubject(id, { subject: 'עדכון חשוב', batchId: 'bulk-sample' }),
        body: `${msg}\n\n(${orderLine})\n\nלאישור קבלת ההודעה, יש ללחוץ על הקישור:\n${confirmUrl}`,
        html: renderGenericEmailHtml({ title: 'עדכון חשוב', bodyText: msg, gmachName, subtitle: 'הודעה חשובה', icon: '📣', footnote: orderLine, actionButton: { label: 'אישור קבלת ההודעה', url: confirmUrl } }),
      });
    }

    case 'refundExecuted': {
      return wrap({
        subject: emailSubject(id),
        body: 'שלום רחל כהן,\n\nבוצע עבורך זיכוי על סך ₪1,250.\nמספר הזמנה: 12345\n\nהזיכוי יועבר לחשבון הבנק שנמסר לנו (בנק הפועלים סניף 612).',
        html: renderRefundExecutedEmailHtml({ customerName: 'רחל כהן', amount: 1250, orderId: 12345, bankName: 'הפועלים', bankBranch: '612', gmachName, gmachPhone }),
      });
    }

    case 'dailyManagerReport': {
      const orders = [
        { orderId: 12345, customerName: 'רחל כהן', eventDate: 'כז אלול תשפ"ו', itemsCount: 2 },
        { orderId: 12346, customerName: 'שרה לוי', eventDate: 'כח אלול תשפ"ו', itemsCount: 1 },
        { orderId: 12347, customerName: 'מרים גולד', eventDate: 'ל אלול תשפ"ו', itemsCount: 3 },
      ];
      const lines = orders.map(o => `#${o.orderId} - ${o.customerName} - ${o.eventDate} - ${o.itemsCount} פריטים`).join('\n');
      return wrap({
        subject: emailSubject(id, { hebrewDate, count: 3 }),
        body: `דוח יומי - ${hebrewDate}\nסה"כ הזמנות היום: 3\n\n${lines}`,
        html: renderDailyReportEmailHtml({ dateHebrew: hebrewDate, orders, gmachName }),
      });
    }

    case 'manualBarcodesReport': {
      const items = [
        { orderId: 12345, barcode: '551-04', description: 'שמלת ערב "מיכל"' },
        { orderId: 12346, barcode: '622-11', description: 'שמלת ערב "נועה"' },
      ];
      return wrap({
        subject: emailSubject(id, { hebrewDate, count: 2 }),
        body: `ברקודים שהוקלדו ידנית היום (${hebrewDate}): 2\n\n${items.map(i => `#${i.orderId} - ברקוד: ${i.barcode} - ${i.description}`).join('\n')}`,
        html: renderManualBarcodesEmailHtml({ dateHebrew: hebrewDate, items, gmachName }),
      });
    }

    case 'internalMessageAlert': {
      const content = 'שלום צוות,\nהמחשב בעמדה 2 לא מדפיס. אשמח שמישהו יבדוק, תודה.';
      return wrap({
        subject: emailSubject(id, { title: 'תקלת מדפסת' }),
        body: content,
        html: renderInternalMessageEmailHtml({ title: 'תקלת מדפסת', bodyText: content, senderName: 'דנה לוי', gmachName }),
      });
    }

    case 'courierDeliveries': {
      const groups = [{
        title: 'משלוח הלוך אירועים - יום רביעי כז אלול תשפ"ו',
        rows: [
          { customerName: 'רחל כהן', address: 'הרצל 5, ירושלים', customerPhone: '050-1234567', customerPhone2: '02-6543210' },
          { customerName: 'שרה לוי', address: 'בן יהודה 12, ביתר עילית', customerPhone: '052-7654321', customerPhone2: '' },
        ],
      }];
      const plain = groups.map(g => `${g.title}\n${g.rows.map(r => `${r.customerName} | ${r.address || '-'} | ${r.customerPhone || '-'} | ${r.customerPhone2 || '-'}`).join('\n')}`).join('\n\n');
      return wrap({
        subject: emailSubject(id, { groups }),
        body: plain,
        html: renderCourierDeliveryEmailHtml({ groups, gmachName }),
      });
    }

    case 'errorReportNew': {
      const userText = 'כשלוחצים על "שמור" בכרטיס הזמנה, מופיעה הודעת שגיאה ולא נשמר.';
      const lastButtons = ['פתיחת הזמנה #12345', 'עריכת פריט', 'שמור'];
      return wrap({
        subject: emailSubject(id),
        body: `דיווח שגיאה מאת: דנה לוי\nזמן: ${hebrewDate}\nחלון/דף: הזמנה #12345\nכתובת URL: /orders/12345\n\n5 הלחצנים האחרונים שנלחצו:\n${lastButtons.map((b, i) => `${i + 1}. ${b}`).join('\n')}\n\nתיאור השגיאה מהמשתמש:\n${userText}\n\n(זהו מייל לדוגמה - ללא בלוק AI_DATA)`,
        html: renderErrorReportEmailHtml({ employeeName: 'דנה לוי', time: hebrewDate, title: 'הזמנה #12345', url: '/orders/12345', userText, lastButtons, gmachName }),
        bugRouting: true,
        rtlBody: false,
      });
    }

    case 'errorReportHumanRequested': {
      const desc = 'כשלוחצים על "שמור" מופיעה שגיאה.';
      const replies = [
        { authorLabel: 'תמיכה (סוכן אוטומטי)', text: 'ראיתי את הדיווח, בודק ומטפל.', isBot: true },
        { authorLabel: 'תמיכה (סוכן אוטומטי)', text: 'לא הצלחתי לשחזר - איזה דגם בדיוק היה בהזמנה?', isBot: true },
      ];
      const threadText = replies.map(r => `--- ${r.authorLabel} ---\n${r.text}`).join('\n\n');
      return wrap({
        subject: emailSubject(id, { reporterName: 'דנה לוי' }),
        body: `דנה לוי ביקש/ה מענה אנושי ישיר בדיווח תקלה, במקום המענה האוטומטי.\n\nחלון/דף: הזמנה #12345\nתיאור התקלה המקורי:\n${desc}\n\nשרשור התגובות עד כה:\n${threadText}\n\nהסוכן האוטומטי ידלג על הדיווח הזה מעתה - יש לענות בעצמכם בשרשור.`,
        html: renderHumanRequestedEmailHtml({ reporterName: 'דנה לוי', pageTitle: 'הזמנה #12345', description: desc, replies, gmachName }),
        bugRouting: true,
      });
    }

    case 'agentDigest': {
      const prs = [
        { number: 101, title: 'תיקון הצגת תאריך בכרטיס הזמנה', branch: 'fix-reports/date-display', created: '22/09, 17:00', excerpt: 'התאריך העברי הוצג ביום שגוי כשהשרת בשעון UTC.', url: 'https://github.com/example/repo/pull/101' },
        { number: 102, title: 'יישור טקסט בהודעות מייל', branch: 'fix-reports/email-rtl', created: '22/09, 17:05', excerpt: '', url: 'https://github.com/example/repo/pull/102' },
      ];
      return wrap({
        subject: emailSubject(id, { count: 2 }),
        body: `יש 2 שינויי קוד שהסוכן האוטומטי הכין וממתינים לאישור שלך למיזוג:\n\n${prs.map(p => `#${p.number} - ${p.title}\nקישור: ${p.url}`).join('\n\n')}`,
        html: renderAgentDigestEmailHtml({ prs, gmachName }),
      });
    }

    default:
      throw new Error(`אין דוגמה למייל "${id}"`);
  }
}

export const SAMPLE_EMAIL_IDS = Object.keys(EMAIL_CATALOG);

/**
 * כל 16 הדוגמאות במייל אחד: גלריה (כל מייל בכרטיס משלו) + הצרופות האמיתיות.
 * @returns {{subject:string, body:string, html:string, attachments:Array}}
 */
export function buildSampleGallery(ctx = {}) {
  const samples = SAMPLE_EMAIL_IDS.map(id => buildSampleEmail(id, ctx));
  const attachments = [];
  const seen = new Set();
  for (const s of samples) {
    for (const a of s.attachments || []) {
      if (!seen.has(a.fileName)) { seen.add(a.fileName); attachments.push(a); }
    }
  }
  const html = renderEmailGallery(samples.map(s => ({ name: s.name, subject: s.subject, note: s.note, html: s.html })));
  return {
    subject: `${SAMPLE_PREFIX}כל ${samples.length} מיילי המערכת בעיצוב החדש`,
    body: `${samples.length} מיילים לדוגמה:\n${samples.map((s, i) => `${i + 1}. ${s.name} - ${s.subject}`).join('\n')}`,
    html,
    attachments,
  };
}
