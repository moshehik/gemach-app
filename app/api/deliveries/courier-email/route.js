import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { checkAuth } from '@/lib/auth';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { getDeliveriesForDate } from '@/lib/deliveries';
import { groupDeliveryRowsForCourier, isoRangeToDates } from '@/lib/deliveryCourier';
import { renderCourierDeliveryEmailHtml } from '@/lib/emailTemplates';
import { sendSystemEmail } from '@/lib/mailer';
import { getVerifiedAuthCookie } from '@/lib/authTokens';

export const dynamic = 'force-dynamic';

// POST /api/deliveries/courier-email — §D בתכנון (docs/deliveries-feature-plan-2026-09-16.md):
// שולחת למשלוחן (כתובת מהגדרת courier_email) את אותה טבלה שמודפסת ב-
// app/print/delivery-courier/page.js, לפי אותה בחירת כיוון+טווח תאריכים.
// Body: { direction: 'out' | 'return' | 'both', fromDate: 'YYYY-MM-DD', toDate: 'YYYY-MM-DD' }
export async function POST(request) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const direction = ['out', 'return', 'both'].includes(body?.direction) ? body.direction : 'both';
    const dates = isoRangeToDates(body?.fromDate, body?.toDate);
    if (dates.length === 0) {
      return NextResponse.json({ error: 'טווח תאריכים לא תקין' }, { status: 400 });
    }

    const allSettings = await getAllCachedSettings();
    const settingsMap = allSettings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});

    if (settingsMap.enable_deliveries !== 'true') {
      return NextResponse.json({ error: 'מערכת המשלוחים כבויה בהגדרות הניהול' }, { status: 400 });
    }
    const courierEmail = (settingsMap.courier_email || '').trim();
    if (!courierEmail) {
      return NextResponse.json({ error: 'לא הוגדרה כתובת מייל למשלוחן בהגדרות המערכת (courier_email)' }, { status: 400 });
    }

    const rowsByDispatchDate = await Promise.all(
      dates.map(async (date) => ({ dispatchDate: date, rows: (await getDeliveriesForDate(date)).data }))
    );
    const groups = groupDeliveryRowsForCourier(rowsByDispatchDate, direction);

    if (groups.length === 0) {
      return NextResponse.json({ error: 'אין משלוחים בטווח/כיוון שנבחרו - לא נשלח מייל' }, { status: 400 });
    }

    const gmachName = settingsMap.gmach_name || 'גמ"ח שמלות';
    const html = renderCourierDeliveryEmailHtml({ groups, gmachName });
    const plainText = groups.map(g => `${g.title}\n${g.rows.map(r => `${r.customerName} | ${r.address || '-'} | ${r.customerPhone || '-'} | ${r.customerPhone2 || '-'}`).join('\n')}`).join('\n\n');
    const subject = groups.length === 1 ? groups[0].title : `נתוני משלוחים - ${groups.length} קבוצות`;

    const cookieStore = await cookies();
    const employeeId = getVerifiedAuthCookie(cookieStore)?.value || null;

    const result = await sendSystemEmail({
      to: courierEmail,
      subject,
      body: plainText,
      html,
      employeeId,
      fileName: 'נתוני משלוחים.txt',
      fileContent: Buffer.from(plainText).toString('base64'),
    });

    if (!result.success) {
      return NextResponse.json({ error: result.message || 'שליחת המייל נכשלה' }, { status: 500 });
    }
    return NextResponse.json({ success: true, sentTo: courierEmail, groupsCount: groups.length });
  } catch (error) {
    console.error('POST /api/deliveries/courier-email error:', error);
    return NextResponse.json({ error: 'שגיאה בשליחת נתוני המשלוחים למשלוחן' }, { status: 500 });
  }
}
