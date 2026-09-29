import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth, checkPageAccess, HEAD_MANAGEMENT_ROLES } from '@/lib/auth';

// סיכום כספי לעמוד החדש (/a5): אותם חישובים בדיוק כמו app/dashboard/page.js
// (כולל אותו אופן קיבוץ ימים/שבועות/חודשים — לא משנים את הכלל, רק משכפלים). קריאה בלבד.
export const dynamic = 'force-dynamic';

const MONTHS = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
// 'YYYY-MM-DD' -> 'D/M'
const dm = (s) => `${parseInt(s.slice(8, 10), 10)}/${parseInt(s.slice(5, 7), 10)}`;
// 'YYYY-MM' -> 'אוק׳ 25'
const ym = (s) => `${MONTHS[parseInt(s.slice(5, 7), 10) - 1]} ${s.slice(2, 4)}`;

export async function GET() {
  try {
    if (!(await checkAuth())) return NextResponse.json({ error: 'לא מחובר' }, { status: 401 });
    if (!(await checkPageAccess(HEAD_MANAGEMENT_ROLES))) {
      return NextResponse.json({ error: 'הסיכום הכספי פתוח להנהלה ראשית בלבד' }, { status: 403 });
    }

    const trendSince = new Date();
    trendSince.setMonth(trendSince.getMonth() - 13);

    const [totalCustomers, totalEmployees, totalOrders, revenueAggregation, paymentMethodsStats, recentPayments] =
      await Promise.all([
        prisma.customer.count({ where: { isDeleted: false } }),
        prisma.employee.count({ where: { isActive: true } }),
        prisma.order.count(),
        prisma.payment.aggregate({ where: { isDeleted: false }, _sum: { amount: true } }),
        prisma.payment.groupBy({
          by: ['paymentMethod'],
          where: { isDeleted: false, isRefund: false },
          _sum: { amount: true },
          _count: { id: true },
        }),
        prisma.payment.findMany({
          orderBy: { paymentDate: 'desc' },
          select: { paymentDate: true, amount: true },
          where: { isDeleted: false, paymentDate: { gte: trendSince } },
        }),
      ]);

    const methods = paymentMethodsStats
      .map((s) => [s.paymentMethod || 'לא מוגדר', s._sum.amount || 0, s._count.id])
      .sort((a, b) => b[1] - a[1]);

    const dayMap = {}, weekMap = {}, monthMap = {};
    for (const p of recentPayments) {
      if (!p.paymentDate) continue;
      const d = p.paymentDate, amt = p.amount || 0;
      const dayKey = d.toISOString().split('T')[0];
      dayMap[dayKey] = (dayMap[dayKey] || 0) + amt;
      const ws = new Date(d);
      ws.setDate(ws.getDate() - ws.getDay()); // שבוע מתחיל ביום ראשון
      const weekKey = ws.toISOString().split('T')[0];
      weekMap[weekKey] = (weekMap[weekKey] || 0) + amt;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap[monthKey] = (monthMap[monthKey] || 0) + amt;
    }
    const pick = (map, n, fmt) => Object.keys(map).sort().slice(-n).map((k) => ({ k: fmt(k), v: map[k] }));

    return NextResponse.json({
      K: [revenueAggregation._sum.amount || 0, totalCustomers, totalOrders, totalEmployees],
      methods,
      trend: { daily: pick(dayMap, 30, dm), weekly: pick(weekMap, 12, dm), monthly: pick(monthMap, 12, ym) },
    });
  } catch (e) {
    console.error('a5 dashboard error:', e);
    return NextResponse.json({ error: 'שגיאה בטעינת הסיכום' }, { status: 500 });
  }
}
