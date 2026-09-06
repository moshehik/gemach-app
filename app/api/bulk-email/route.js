import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { sendSystemEmail } from '@/lib/mailer';
import { getHebrewDateString } from '@/lib/hebrewDate';

export const dynamic = 'force-dynamic';

// 22 - שליחת מייל לכל הלקוחות עם אירוע בתאריך/טווח + מעקב מי אישר (דרך EmailLog)
// מותנה ב-bulk_email_by_event_date. POST { fromDate, toDate, subject, body }.
// GET מחזיר מעקב: EmailLog אחרונים עם subject המכיל bulk מזהה.
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
    let sent = 0;
    const errors = [];
    for (const [email, o] of seen) {
      try {
        const personalized = `${body}\n\n(הזמנה #${o.orderId}, אירוע: ${o.eventDateHebrew || getHebrewDateString(o.eventDate)})`;
        const r = await sendSystemEmail({
          to: email,
          subject: `${subject} [${batchId}]`,
          body: personalized,
          html: `<div dir="rtl" style="font-family:Arial;line-height:1.6"><p>${String(body).replace(/\n/g, '<br/>')}</p><p style="color:#888;font-size:12px">הזמנה #${o.orderId}, אירוע: ${o.eventDateHebrew || getHebrewDateString(o.eventDate)}</p></div>`,
          customerId: o.customerId || null,
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
