import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { sendSystemEmail } from '@/lib/mailer';
import {
  renderPickupReminderEmailHtml, renderLateReturnEmailHtml, renderManualBarcodesEmailHtml,
} from '@/lib/emailTemplates';
import { emailSubject } from '@/lib/emailCatalog';
import { getHebrewDateString } from '@/lib/hebrewDate';
import { getLateReturnInfo, LATE_RETURN_THRESHOLD_DAYS } from '@/lib/lateReturn';

export const dynamic = 'force-dynamic';

// Cron יומי: מופעל ע"י Vercel Cron (vercel.json) או ידנית GET /api/cron/daily
// מכבד את כל מתגי האוטומציה - לא שולח אם ההגדרה כבויה.
export async function GET(request) {
  // Vercel Cron שולח את הסוד בכותרת הסטנדרטית Authorization: Bearer - לא רק
  // x-cron-secret/?secret. דיווח d22ef2ca (נווה יעקב): התנאי הזה תמיד היה "ריק" -
  // גם כשהוגדר CRON_SECRET, קריאה עם סוד שגוי/חסר פשוט המשיכה לרוץ כרגיל בלי
  // לחסום כלום, כך שכל קריאה חוזרת ל-URL הזה (לא רק ה-cron היומי המתוזמן) הפעילה
  // שליחת מיילים בפועל, בכל שעה. עכשיו נאכף בפועל אם CRON_SECRET/VERCEL_CRON_SECRET
  // מוגדר; אם לא מוגדר בכלל - נשאר פתוח לקריאות פנימיות כמו קודם, בלי שינוי התנהגות.
  const authHeader = request.headers.get('authorization') || '';
  const bearerSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const secret = request.headers.get('x-cron-secret') || bearerSecret || new URL(request.url).searchParams.get('secret');
  const expected = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;
  if (expected && secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        const html = renderPickupReminderEmailHtml({
          customerName: `${o.customer.firstName || ''} ${o.customer.lastName || ''}`.trim(), orderId: o.orderId, eventDate: hebrewDate,
          items: (o.items || []).map(i => i.description || i.sizeText || 'פריט'), gmachName, gmachAddress, gmachPhone,
        });
        const r = await sendSystemEmail({ to: email, subject: emailSubject('pickupReminder', { orderId: o.orderId, gmachName }), body, html });
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
        // דיווח 8c96c94c (נווה יעקב): "0 הזמנות" בדוח היה מבלבל - הדוח נשלח בבוקר
        // (05:30 UTC) וספר הזמנות שנפתחו "היום" בעוד היום עצמו כמעט לא התחיל, כך
        // שהמספר כמעט תמיד יצא 0 בלי קשר לפעילות האמיתית. עכשיו שני מספרים ברורים:
        // הזמנות חדשות שנפתחו אתמול (יום שלם, כמו שהתבקש), והזמנות שהאירוע שלהן היום.
        // (שים לב: renderDailyReportEmailHtml החדשה מהספרייה המאוחדת מניחה רשימת
        // הזמנות אחת ולא מתאימה לפורמט שני-המספרים הזה - נשאר HTML ידני כאן בכוונה.)
        const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayEnd = new Date(yesterday); yesterdayEnd.setHours(23,59,59,999);
        const todayEnd = new Date(today); todayEnd.setHours(23,59,59,999);
        const [openedYesterday, reservedToday] = await Promise.all([
          prisma.order.findMany({
            where: { isDeleted: false, orderDate: { gte: yesterday, lte: yesterdayEnd } },
            include: { customer: true, items: { where: { isDeleted: false } } },
            orderBy: { orderId: 'desc' },
            take: 100
          }),
          prisma.order.findMany({
            where: { isDeleted: false, eventDate: { gte: today, lte: todayEnd } },
            include: { customer: true, items: { where: { isDeleted: false } } },
            orderBy: { orderId: 'desc' },
            take: 100
          }),
        ]);
        const formatLine = (o) => `#${o.orderId} - ${o.customer?.firstName || ''} ${o.customer?.lastName || ''} - ${o.eventDateHebrew || (o.eventDate ? getHebrewDateString(o.eventDate) : '')} - ${o.items.length} פריטים`;
        const openedLines = openedYesterday.map(formatLine).join('\n');
        const reservedLines = reservedToday.map(formatLine).join('\n');
        const body = `דוח יומי - ${getHebrewDateString(today)}\n\nהזמנות חדשות שנפתחו אתמול: ${openedYesterday.length}\n${openedLines || 'אין'}\n\nהזמנות עם אירוע היום: ${reservedToday.length}\n${reservedLines || 'אין'}`;
        const html = `<div dir="rtl" style="font-family:Arial"><h2>דוח יומי - ${getHebrewDateString(today)}</h2>` +
          `<p><strong>הזמנות חדשות שנפתחו אתמול:</strong> ${openedYesterday.length}</p>` +
          `<pre style="background:#f5f5f5;padding:12px;border-radius:8px;white-space:pre-wrap">${openedLines || 'אין'}</pre>` +
          `<p><strong>הזמנות עם אירוע היום:</strong> ${reservedToday.length}</p>` +
          `<pre style="background:#f5f5f5;padding:12px;border-radius:8px;white-space:pre-wrap">${reservedLines || 'אין'}</pre></div>`;
        const r = await sendSystemEmail({ to: managerEmail, subject: `דוח יומי ${getHebrewDateString(today)} - ${openedYesterday.length} הזמנות חדשות אתמול, ${reservedToday.length} עם אירוע היום`, body, html });
        results.dailyReport = !!r.success;
        if (!r.success) results.errors.push(`dailyReport: ${r.message}`);
      }
    } catch (e) { results.errors.push(`dailyReport: ${e.message}`); }
  }

  // 9 - מייל למאחרים - דיווח d22ef2ca (נווה יעקב): "יותר מדי מיילי איחור, לא בזמן
  // המתאים". שתי בעיות נמצאו:
  // 1. "איחור" כאן הוגדר בעבר כ-eventDate<today בלבד (למעשה מהיום שאחרי האירוע) -
  //    בעוד שבכל שאר המערכת (lib/lateReturn.js, גם ב-RentalReturnModal וגם ב-
  //    app/rentals/page.js) "איחור" מוגדר כ-7+ ימים ממועד ההחזרה הצפוי. המייל יצא
  //    הרבה יותר מוקדם ממה שמשתמשים/לקוחות מצפים ל"איחור" - עכשיו משתמש באותה
  //    נוסחה בדיוק (getLateReturnInfo) כדי לא לשכפל את ההגדרה בפעם שלישית.
  // 2. אין דה-דופליקציה - הלולאה שלחה מייל מחדש לכל הזמנה שעדיין באיחור בכל הרצה
  //    יומית (בניגוד לדפוס alreadyCharged שכבר קיים באותו קובץ בסעיפים 3/23
  //    למטה) - כך שלקוח שלא החזיר קיבל את אותו מייל כל יום במשך שבועות. עכשיו
  //    נשלח פעם אחת בלבד להזמנה, לפי EmailLog קיים (בלי צורך בעמודה חדשה ב-DB).
  if (get('late_return_email_enabled') === 'true') {
    try {
      const text = get('late_return_email_text') || 'המערכת זיהתה שלא החזרתם את השמלות, במידה ולא יחזרו במיידי המערכת מעבירה לגביה אוטומטית.';
      const candidates = await prisma.order.findMany({
        where: {
          isDeleted: false,
          returnDate: { lt: today },
          items: { some: { isTaken: true, isReturned: false, isDeleted: false } }
        },
        include: { customer: true, items: { where: { isTaken: true, isReturned: false, isDeleted: false } } },
        take: 200
      });
      const lateReturnThresholdDays = Number(get('late_return_threshold_days')) || LATE_RETURN_THRESHOLD_DAYS;
      const overdueOrders = candidates.filter(o => getLateReturnInfo(o, lateReturnThresholdDays).isLate);
      for (const o of overdueOrders) {
        const email = o.customer?.email;
        if (!email || !email.includes('@')) continue;
        const subject = emailSubject('lateReturnReminder', { orderId: o.orderId });
        const alreadySent = await prisma.emailLog.findFirst({ where: { subject, status: 'success' } });
        if (alreadySent) continue;
        const body = `שלום ${o.customer.firstName || ''},\n\n${text}\nהזמנה #${o.orderId} - תאריך החזרה: ${getHebrewDateString(o.returnDate)}\n`;
        const html = renderLateReturnEmailHtml({
          customerName: o.customer.firstName || '', orderId: o.orderId, returnDate: getHebrewDateString(o.returnDate), message: text,
          gmachName: get('gmach_name') || 'גמ"ח שמלות', gmachAddress: get('gmach_address') || '', gmachPhone: get('gmach_phone') || '',
        });
        const r = await sendSystemEmail({ to: email, subject, body, html });
        if (r.success) results.lateEmails++;
        else results.errors.push(`late ${o.orderId}: ${r.message}`);
      }
    } catch (e) { results.errors.push(`late: ${e.message}`); }
  }

  // 3 - גביה אוטומטית ממאחרים בהו"ק (עד 19:00 ביום ההחזרה, מחיר השכרה נוסף לכל שמלה)
  // שלד בטוח: יוצר PaymentObligation בלבד (לא חיוב כרטיס אמיתי) + מייל. כבוי = לא יוצר.
  if (get('hok_auto_charge_enabled') === 'true' && get('hok_enabled') === 'true') {
    try {
      const hourStr = get('hok_auto_charge_hour') || '19:00';
      const [hh, mm] = hourStr.split(':').map(Number);
      const now = new Date();
      const deadlinePassed = now.getHours() > (hh || 19) || (now.getHours() === (hh || 19) && now.getMinutes() >= (mm || 0));
      if (deadlinePassed) {
        const hokChargeAmountRaw = get('hok_charge_amount');
        // ריק = ברירת המחדל ההיסטורית (מחיר ההשכרה המקורי); "0" מפורש = ללא גביה כלל
        // (לא רק ליפול לברירת המחדל, כמו שקרה לפני התיקון הזה).
        const fixedAmount = parseFloat(hokChargeAmountRaw || '');
        const overdue = await prisma.order.findMany({
          where: {
            isDeleted: false,
            returnDate: { lt: now },
            items: { some: { isTaken: true, isReturned: false, isDeleted: false } },
          },
          include: { customer: true, items: { where: { isTaken: true, isReturned: false, isDeleted: false } }, obligations: { where: { isDeleted: false } } },
          take: 100,
        });
        for (const o of overdue) {
          try {
            const perDress = !isNaN(fixedAmount) && fixedAmount >= 0
              ? fixedAmount
              : Math.round(((o.totalAmount || 0) / Math.max(1, o.items.length)) * 100) / 100;
            if (perDress <= 0) continue;
            const alreadyCharged = (o.obligations || []).some(x => String(x.description || '').includes('גביה אוטומטית - איחור'));
            if (alreadyCharged) continue;
            const total = perDress * o.items.length;
            await prisma.paymentObligation.create({
              data: {
                orderId: o.orderId,
                amount: total,
                quantity: o.items.length,
                description: `גביה אוטומטית - איחור (הו"ק, אחרי ${hourStr})`,
                isManual: false,
              },
            });
          } catch (e) { results.errors.push(`hok ${o.orderId}: ${e.message}`); }
        }
      }
    } catch (e) { results.errors.push(`hok: ${e.message}`); }
  }

  // 23 - גביה אוטומטית על החזרה פגומה (isDamagedReturn) - יוצר חיוב הו"ק, כבוי = לא יוצר
  if (get('auto_charge_damaged_return') === 'true' && get('hok_enabled') === 'true') {
    try {
      const damaged = await prisma.orderItem.findMany({
        where: { isDamagedReturn: true, isDeleted: false, isReturned: true },
        include: { order: { include: { obligations: { where: { isDeleted: false } } } } },
        take: 100,
      });
      for (const i of damaged) {
        try {
          const o = i.order;
          if (!o) continue;
          const already = (o.obligations || []).some(x => String(x.description || '').includes('הוחזרה שמלה פגומה'));
          if (already) continue;
          const amount = i.finalPrice || i.basePrice || 0;
          await prisma.paymentObligation.create({
            data: {
              orderId: o.orderId,
              orderItemId: i.id,
              amount: amount || 0,
              quantity: 1,
              description: 'הוחזרה שמלה פגומה (גביה הו"ק אוטומטית)',
              isManual: false,
            },
          });
        } catch (e) { results.errors.push(`damaged ${i.id}: ${e.message}`); }
      }
    } catch (e) { results.errors.push(`damaged: ${e.message}`); }
  }
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
        const html = renderManualBarcodesEmailHtml({
          dateHebrew: getHebrewDateString(today), gmachName: get('gmach_name') || 'גמ"ח שמלות',
          items: items.map(i => ({ orderId: i.order?.orderId ?? '?', barcode: i.barcode || '?', description: i.description || i.sizeText || '' })),
        });
        const r = await sendSystemEmail({ to: managerEmail, subject: emailSubject('manualBarcodesReport', { hebrewDate: getHebrewDateString(today), count: items.length }), body, html });
        if (!r.success) results.errors.push(`manualBarcodes: ${r.message}`);
      }
    } catch (e) { results.errors.push(`manualBarcodes: ${e.message}`); }
  }

  return NextResponse.json({ success: true, ...results });
}

export async function POST(req) { return GET(req); }
