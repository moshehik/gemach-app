import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { parseOverduePopupConfig, getOverduePopupInfo } from '@/lib/overduePopup';
import { getIsraelTodayKey, addDaysToDateKey, getIsraelDayRange } from '@/lib/hebrewDate';
import { getCachedSetting } from '@/lib/settingsCache';
import { getNonWorkingDaysConfig } from '@/lib/businessDaysServer';

export const dynamic = 'force-dynamic';

// משפחות שעדיין לא החזירו והאיחור עבר את הסף. ברירת המחדל זהה לבר ההחזרה המהיר
// (app/rentals/page.js, RentalReturnModal - lib/lateReturn.js, late_return_threshold_days); רק החלונית הזאת
// יכולה לקבל כלל משלה דרך overdue_popup_threshold_days / overdue_popup_after_hour (ר' lib/overduePopup.js,
// דיווח 749aaf87) - שניהם ריקים = בדיוק ההתנהגות הקודמת. המסנן ב-DB רחב-בכוונה (יום קלנדרי ישראלי
// אחד מעבר לסף) כדי לכסות דילוג ימים לא-עובדים וגבולות שעה בלי לסרוק את כל ההזמנות - מועד ההחזרה
// הצפוי הוא תמיד לפחות toDate/returnDate או יום אחרי האירוע, ולכן כל הזמנה מאחרת עומדת גם במסנן הרחב;
// הסינון המדויק (כולל דילוג שישי/שבת/חג/ערב חג/ימים ללא פעילות והשעה) קורה ב-JS על קבוצת המועמדים.
export async function GET() {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const [lateSetting, popupSetting, hourSetting] = await Promise.all([
      getCachedSetting('late_return_threshold_days'),
      getCachedSetting('overdue_popup_threshold_days'),
      getCachedSetting('overdue_popup_after_hour'),
    ]);
    const config = parseOverduePopupConfig({
      popupThreshold: popupSetting?.value,
      lateThreshold: lateSetting?.value,
      afterHour: hourSetting?.value,
    });
    const nonWorkingDays = await getNonWorkingDaysConfig();
    const now = new Date();
    // סוף היום הישראלי של (היום - (סף-1)) - לפי שעון ישראל ולא שעון השרת; בסף 0 זה סוף יום המחר (רחב-בכוונה)
    const cutoff = getIsraelDayRange(addDaysToDateKey(getIsraelTodayKey(now), -(config.threshold - 1))).end;

    const candidates = await prisma.order.findMany({
      where: {
        isDeleted: false,
        items: { some: { isTaken: true, isReturned: false, isDeleted: false } },
        OR: [
          { toDate: { lte: cutoff } },
          { returnDate: { lte: cutoff } },
          { AND: [{ toDate: null }, { returnDate: null }, { eventDate: { lte: cutoff } }] },
        ],
      },
      select: {
        orderId: true,
        eventDate: true,
        toDate: true,
        returnDate: true,
        customer: { select: { firstName: true, lastName: true } },
      },
    });

    const orders = candidates
      .map((o) => ({ order: o, late: getOverduePopupInfo(o, config, { now, nonWorkingDays }) }))
      .filter((o) => o.late.show)
      .map((o) => ({
        orderId: o.order.orderId,
        customerName: `${o.order.customer?.firstName || ''} ${o.order.customer?.lastName || ''}`.trim() || 'לקוח ללא שם',
        daysLate: o.late.daysLate,
      }))
      .sort((a, b) => a.orderId - b.orderId);

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Error fetching overdue orders:', error);
    return NextResponse.json({ error: 'Failed to fetch overdue orders' }, { status: 500 });
  }
}
