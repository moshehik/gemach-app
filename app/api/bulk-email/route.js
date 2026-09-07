import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { sendSystemEmail } from '@/lib/mailer';
import { getHebrewDateString } from '@/lib/hebrewDate';

export const dynamic = 'force-dynamic';

// 22 - שליחת מייל לכל הלקוחות עם אירוע בתאריך/טווח + מעקב מי אישר (דרך EmailLog)
// מותנה ב-bulk_email_by_event_date. POST { fromDate, toDate, subject, body }.
// GET מחזיר מעקב: EmailLog אחרונים עם subject המכיל bulk מזהה (כולל
// confirmToken/acknowledgedAt לכל שורה - ה-UI ב-app/admin/bulk-email/page.js
// מציג לפי זה מי אישר ומתי). האישור עצמו קורה ב-GET /api/bulk-email/confirm
// (route.js נפרד, ציבורי/ללא אימות - ראה שם למנגנון המלא).
export async function POST(request) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const all = await getAllCachedSettings();
    const get = (k) => all.find(s => s.key === k)?.value;
    if (get('bulk_email_by_event_date') !== 'true') {
      return NextResponse.json({ error: 'שליחת מייל לפי תאריך אירוע כבויה בהגדרות (bulk_email_by_event_date).' }, { status: 403 });
    }
    const { fromDate, toDate, subject, body } = await request.json();
    if (!fromDate || !subject || !body) {
      return NextResponse.json({ error: 'חובה fromDate + subject + body' }, { status: 400 });
    }
    const from = new Date(fromDate); from.setHours(0, 0, 0, 0);
    const to = toDate ? new Date(toDate) : new Date(fromDate);
    to.setHours(23, 59, 59, 999);

    const orders = await prisma.order.findMany({
      where: { isDeleted: false, eventDate: { gte: from, lte: to } },
      include: { customer: true },
      take: 500,
    });
    const seen = new Map();
    for (const o of orders) {
      const email = o.customer?.email;
      if (!email || !String(email).includes('@')) continue;
      if (!seen.has(email)) seen.set(email, o);
    }
    const batchId = `bulk-${Date.now()}`;
    // מקור לקישור האישור - origin של הבקשה הנוכחית (עובד גם ב-prod וגם ב-test/preview
    // deployments בלי env נוסף, ראה request.nextUrl ב-Next.js App Router).
    const origin = request.nextUrl?.origin || new URL(request.url).origin;
    let sent = 0;
    const errors = [];
    for (const [email, o] of seen) {
      try {
        // טוקן אקראי ולא-ניתן-לניחוש (32 בייטים) לקישור "אישור קריאה" האישי של
        // הנמען הזה - נשמר על שורת ה-EmailLog (confirmToken, unique) כדי ש-
        // GET /api/bulk-email/confirm יוכל לאתר בדיוק את השורה הזו בלי לחשוף
        // מידע על לקוחות אחרים אם הטוקן שגוי/מנוחש.
        const confirmToken = crypto.randomBytes(32).toString('base64url');
        const confirmUrl = `${origin}/api/bulk-email/confirm?token=${confirmToken}`;
        const personalized = `${body}\n\n(הזמנה #${o.orderId}, אירוע: ${o.eventDateHebrew || getHebrewDateString(o.eventDate)})\n\nלאישור קבלת ההודעה, יש ללחוץ על הקישור:\n${confirmUrl}`;
        const r = await sendSystemEmail({
          to: email,
          subject: `${subject} [${batchId}]`,
          body: personalized,
          html: `<div dir="rtl" style="font-family:Arial;line-height:1.6"><p>${String(body).replace(/\n/g, '<br/>')}</p><p style="color:#888;font-size:12px">הזמנה #${o.orderId}, אירוע: ${o.eventDateHebrew || getHebrewDateString(o.eventDate)}</p><p style="margin-top:16px"><a href="${confirmUrl}" style="background:#2f6f4f;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">אישור קבלת ההודעה</a></p></div>`,
          customerId: o.customerId || null,
          confirmToken,
        });
        if (r.success) sent++;
        else errors.push(`${email}: ${r.message}`);
      } catch (e) { errors.push(`${email}: ${e.message}`); }
    }
    return NextResponse.json({ success: true, batchId, recipients: seen.size, sent, errors: errors.slice(0, 20) });
  } catch (e) {
    console.error('bulk-email failed', e);
    return NextResponse.json({ error: 'שגיאה בשליחה' }, { status: 500 });
  }
}

// מעקב אישורים: מחזיר EmailLog של batch אחרונים (subject מכיל bulk-)
export async function GET(request) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId') || '';
    const where = batchId
      ? { subject: { contains: batchId } }
      : { subject: { contains: 'bulk-' } };
    const logs = await prisma.emailLog.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      take: 200,
    });
    return NextResponse.json({ logs });
  } catch (e) {
    return NextResponse.json({ error: 'שגיאה' }, { status: 500 });
  }
}
