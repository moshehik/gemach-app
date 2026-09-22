import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { sendSystemEmail } from '@/lib/mailer';
import { listEmailCatalog, EMAIL_CATALOG } from '@/lib/emailCatalog';
import { buildSampleEmail, buildSampleGallery } from '@/lib/emailSamples';
import { getHebrewDateString } from '@/lib/hebrewDate';
import { renderPdf } from '@/lib/pdf';
import { POST as orderEmailPOST } from '@/app/api/orders/[id]/email/route';

export const dynamic = 'force-dynamic';
// הפקת PDF (Chromium) לשתי הצרופות האמיתיות לוקחת כמה שניות
export const maxDuration = 60;

// מסך בדיקת מיילים (/admin/email-test): שולח מייל *לדוגמה* מכל סוג בקטלוג לכתובת שהוקלדה בלבד.
// לעולם לא ללקוחות/עובדים אמיתיים - הנמען הוא תמיד הכתובת מהבקשה. נתוני הדמה מגיעים מ-lib/emailSamples.js;
// היחיד שאמיתי הוא מסמך ההזמנה/ההשכרה שמצורף לשתי הדוגמאות עם צרופות (הזמנה אחרונה כלשהי במערכת).
// כל שליחה נרשמת ב-EmailLog (נושא עם הקידומת "[דוגמה]").
// שליחה אחת לבקשה (ה-UI מריץ "שלח הכל" בלולאה) - כדי לא לחרוג ממגבלת זמן של פונקציה.
// id='ALL' = כל הדוגמאות בגלריה אחת במייל אחד, כולל הצרופות.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NEEDS_ORDER = new Set(['managerFreeText', 'orderCard', 'ALL']);

async function reportHtml(orderId, type) {
  const res = await orderEmailPOST(
    new Request('http://localhost/internal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'sample@example.com', type, returnHtmlOnly: true }) }),
    { params: Promise.resolve({ id: String(orderId) }) }
  );
  const data = await res.json();
  return data?.html || null;
}

async function pdfBase64(html) {
  if (!html) return null;
  try {
    const buf = await renderPdf({ html, format: 'A4' });
    return Buffer.from(buf).toString('base64');
  } catch (e) {
    console.error('email-test: PDF render failed', e);
    return null;
  }
}

// הזמנה אחרונה כלשהי עם לקוח ופריטים - "לא משנה מי" (ביקשת הבעלים). undefined אם אין / אם ההפקה נכשלה.
async function loadSampleOrder() {
  const order = await prisma.order.findFirst({
    where: { isDeleted: false, items: { some: { isDeleted: false } }, customer: { isNot: null } },
    orderBy: { orderId: 'desc' },
    include: { customer: true },
  });
  if (!order) return undefined;
  const [orderHtml, rentalHtml] = await Promise.all([reportHtml(order.orderId, 'order'), reportHtml(order.orderId, 'rental')]);
  const [order_pdf, rental_pdf] = await Promise.all([pdfBase64(orderHtml), pdfBase64(rentalHtml)]);
  return {
    orderId: order.orderId,
    customerName: [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' '),
    eventDate: order.eventDateHebrew || (order.eventDate ? getHebrewDateString(order.eventDate) : ''),
    pdfs: { order: order_pdf, rental: rental_pdf },
    reports: { order: orderHtml },
  };
}

export async function GET(request) {
  if (!(await checkAuth('הנהלה ראשית'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ?preview=<id|ALL> - מחזיר את ה-HTML של הדוגמה לתצוגה בדף (בלי לשלוח כלום ובלי הזמנה אמיתית/PDF)
  const preview = new URL(request.url).searchParams.get('preview');
  if (preview) {
    if (preview !== 'ALL' && !EMAIL_CATALOG[preview]) return NextResponse.json({ error: 'סוג מייל לא מוכר' }, { status: 400 });
    const settings = await getAllCachedSettings();
    const get = (k) => settings.find(s => s.key === k)?.value;
    const ctx = { gmachName: get('gmach_name') || undefined, gmachAddress: get('gmach_address') || undefined, gmachPhone: get('gmach_phone') || undefined };
    const sample = preview === 'ALL' ? buildSampleGallery(ctx) : buildSampleEmail(preview, ctx);
    return NextResponse.json({ subject: sample.subject, html: sample.html });
  }
  const types = listEmailCatalog().map(e => ({
    id: e.id,
    name: e.name,
    category: e.categoryLabel,
    trigger: e.trigger,
    recipients: e.recipients,
    subject: e.subjectExample,
    gate: e.gate,
    attachments: e.attachments,
  }));
  return NextResponse.json({ types });
}

export async function POST(request) {
  if (!(await checkAuth('הנהלה ראשית'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { to, id } = await request.json();
    const address = String(to || '').trim();
    if (!EMAIL_RE.test(address)) {
      return NextResponse.json({ success: false, message: 'כתובת מייל לא תקינה' }, { status: 400 });
    }
    if (id !== 'ALL' && !EMAIL_CATALOG[id]) {
      return NextResponse.json({ success: false, message: 'סוג מייל לא מוכר' }, { status: 400 });
    }

    const settings = await getAllCachedSettings();
    const get = (k) => settings.find(s => s.key === k)?.value;
    const ctx = {
      gmachName: get('gmach_name') || undefined,
      gmachAddress: get('gmach_address') || undefined,
      gmachPhone: get('gmach_phone') || undefined,
    };
    if (NEEDS_ORDER.has(id)) ctx.order = await loadSampleOrder();

    const sample = id === 'ALL' ? buildSampleGallery(ctx) : buildSampleEmail(id, ctx);
    const result = await sendSystemEmail({
      to: address,
      subject: sample.subject,
      body: sample.body,
      html: sample.html,
      attachments: sample.attachments,
      pdfFromHtml: sample.pdfFromHtml,
      bugRouting: sample.bugRouting,
      rtlBody: sample.rtlBody,
    });

    return NextResponse.json({ success: !!result.success, message: result.message || null, subject: sample.subject });
  } catch (error) {
    console.error('POST /api/admin/email-test error:', error);
    return NextResponse.json({ success: false, message: 'שגיאת שרת בשליחת מייל הדוגמה' }, { status: 500 });
  }
}
