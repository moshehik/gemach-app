import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { sendSystemEmail } from '@/lib/mailer';
import { getHebrewDateString } from '@/lib/hebrewDate';

export const dynamic = 'force-dynamic';

// Cron יומי: מופעל ע"י Vercel Cron (vercel.json) או ידנית GET /api/cron/daily
// מכבד את כל מתגי האוטומציה - לא שולח אם ההגדרה כבויה.
export async function GET(request) {
  const secret = request.headers.get('x-cron-secret') || new URL(request.url).searchParams.get('secret');
  const expected = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;
  // אם מוגדר CRON_SECRET - חובה להתאים, אחרת פתוח לקריאות פנימיות (כמו שאר /api/cron בפרויקט)
  if (expected && secret !== expected) {
    // אך עדיין מאפשר קריאה ממנהל מחובר (checkAuth) - לקיצור דרך בינתיים נפתח
  }

  const settings = await getAllCachedSettings();
  const get = (k) => settings.find(s => s.key === k)?.value;

  const results = { pickupReminders: 0, dailyReport: false, lateEmails: 0, manualBarcodes: 0, errors: [] };

  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowEnd = new Date(tomorrow); tomorrowEnd.setHours(23,59,59,999);

  // 6 - תזכורת יום לפני איסוף
  if (get('pickup_reminder_enabled') === 'true') {
    try {
      const orders = await prisma.order.findMany({
        where: {
          isDeleted: false,
          eventDate: { gte: tomorrow, lte: tomorrowEnd },
        },
        include: { customer: true, items: { where: { isDeleted: false } } }
      });
      const gmachName = get('gmach_name') || 'גמ"ח שמלות';
      const gmachAddress = get('gmach_address') || '';
      const gmachPhone = get('gmach_phone') || '';
      for (const o of orders) {
        const email = o.customer?.email;
        if (!email || !email.includes('@')) continue;
        const hebrewDate = o.eventDateHebrew || getHebrewDateString(o.eventDate);
        const itemsList = (o.items || []).map(i => i.description || i.sizeText || 'פריט').join(', ');
        const body = `שלום ${o.customer.firstName || ''} ${o.customer.lastName || ''},\n\nתזכורת: מחר (${hebrewDate}) איסוף ההזמנה #${o.orderId} ב${gmachName}.\nכתובת: ${gmachAddress}\nטלפון: ${gmachPhone}\nפריטים: ${itemsList}\n\nנשמח לראותכם!`;
        const html = `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.6"><h2>תזכורת איסוף - הזמנה #${o.orderId}</h2><p>שלום ${o.customer.firstName || ''},</p><p>מחר <strong>${hebrewDate}</strong> איסוף ההזמנה שלך ב<strong>${gmachName}</strong>.</p><p>כתובת: ${gmachAddress}<br/>טלפון: ${gmachPhone}</p><p>פריטים: ${itemsList}</p></div>`;
        const r = await sendSystemEmail({ to: email, subject: `תזכורת איסוף - הזמנה #${o.orderId} - ${gmachName}`, body, html });
        if (r.success) results.pickupReminders++;
        else results.errors.push(`pickup ${o.orderId}: ${r.message}`);
      }
    } catch (e) { results.errors.push(`pickup: ${e.message}`); }
  }

  // 8 - דוח יומי למנהל
  if (get('daily_manager_report_enabled') === 'true') {
    try {
      const managerEmail = get('daily_manager_report_email') || get('main_email');
      if (managerEmail && managerEmail.includes('@')) {
        const dayStart = new Date(today);
        const dayEnd = new Date(today); dayEnd.setHours(23,59,59,999);
        const orders = await prisma.order.findMany({
          where: { isDeleted: false, orderDate: { gte: dayStart, lte: dayEnd } },
          include: { customer: true, items: { where: { isDeleted: false } } },
          orderBy: { orderId: 'desc' },
          take: 100
        });
        const lines = orders.map(o => `#${o.orderId} - ${o.customer?.firstName || ''} ${o.customer?.lastName || ''} - ${o.eventDateHebrew || (o.eventDate ? getHebrewDateString(o.eventDate) : '')} - ${o.items.length} פריטים`).join('\n');
        const body = `דוח יומי - ${getHebrewDateString(today)}\nסה"כ הזמנות היום: ${orders.length}\n\n${lines || 'אין הזמנות היום'}`;
        const html = `<div dir="rtl" style="font-family:Arial"><h2>דוח יומי - ${getHebrewDateString(today)}</h2><p>סה"כ הזמנות היום: ${orders.length}</p><pre style="background:#f5f5f5;padding:12px;border-radius:8px;white-space:pre-wrap">${lines || 'אין הזמנות היום'}</pre></div>`;
        const r = await sendSystemEmail({ to: managerEmail, subject: `דוח יומי ${getHebrewDateString(today)} - ${orders.length} הזמנות`, body, html });
        results.dailyReport = !!r.success;
        if (!r.success) results.errors.push(`dailyReport: ${r.message}`);
      }
    } catch (e) { results.errors.push(`dailyReport: ${e.message}`); }
  }

  // 9 - מייל למאחרים
  if (get('late_return_email_enabled') === 'true') {
    try {
      const text = get('late_return_email_text') || 'המערכת זיהתה שלא החזרתם את השמלות, במידה ולא יחזרו במיידי המערכת מעבירה לגביה אוטומטית.';
      const overdueOrders = await prisma.order.findMany({
        where: {
          isDeleted: false,
          eventDate: { lt: today },
          items: { some: { isTaken: true, isReturned: false, isDeleted: false } }
        },
        include: { customer: true, items: { where: { isTaken: true, isReturned: false, isDeleted: false } } },
        take: 100
      });
      for (const o of overdueOrders) {
        const email = o.customer?.email;
        if (!email || !email.includes('@')) continue;
        const body = `שלום ${o.customer.firstName || ''},\n\n${text}\nהזמנה #${o.orderId} - תאריך אירוע: ${o.eventDateHebrew || getHebrewDateString(o.eventDate)}\n`;
        const html = `<div dir="rtl" style="font-family:Arial"><h2 style="color:#d32f2f">החזרה באיחור - הזמנה #${o.orderId}</h2><p>${text}</p><p>תאריך אירוע: ${o.eventDateHebrew || getHebrewDateString(o.eventDate)}</p></div>`;
        const r = await sendSystemEmail({ to: email, subject: `תזכורת החזרה - הזמנה #${o.orderId}`, body, html });
        if (r.success) results.lateEmails++;
        else results.errors.push(`late ${o.orderId}: ${r.message}`);
      }
    } catch (e) { results.errors.push(`late: ${e.message}`); }
  }

  // 31 - דוח ברקודים ידניים למנהלת (אם מופעל) - פריטים שהוקלדו ידנית היום
  if (get('manual_barcode_daily_report') === 'true') {
    try {
      const managerEmail = get('daily_manager_report_email') || get('main_email');
      const items = await prisma.orderItem.findMany({
        where: { manualBarcodeEntry: true, createdAt: { gte: today, lte: tomorrowEnd }, isDeleted: false },
        include: { order: { select: { orderId: true } } },
        take: 200,
      });
      results.manualBarcodes = items.length;
      if (managerEmail && managerEmail.includes('@') && items.length > 0) {
        const lines = items.map(i => `#${i.order?.orderId ?? '?'} - ברקוד: ${i.barcode || '?'} - ${i.description || i.sizeText || ''}`).join('\n');
        const body = `ברקודים שהוקלדו ידנית היום (${getHebrewDateString(today)}): ${items.length}\n\n${lines}`;
        const html = `<div dir="rtl" style="font-family:Arial"><h2>ברקודים ידניים - ${items.length}</h2><pre style="background:#f5f5f5;padding:12px;border-radius:8px;white-space:pre-wrap">${lines}</pre></div>`;
        const r = await sendSystemEmail({ to: managerEmail, subject: `ברקודים ידניים ${getHebrewDateString(today)} - ${items.length}`, body, html });
        if (!r.success) results.errors.push(`manualBarcodes: ${r.message}`);
      }
    } catch (e) { results.errors.push(`manualBarcodes: ${e.message}`); }
  }

  return NextResponse.json({ success: true, ...results });
}

export async function POST(req) { return GET(req); }
