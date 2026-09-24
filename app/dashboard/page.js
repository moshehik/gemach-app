import prisma from '../lib/prisma';
import DashboardCharts from './DashboardCharts';
import { checkPageAccess, HEAD_MANAGEMENT_ROLES } from '@/lib/auth';
import NoAccessMessage from '@/app/components/NoAccessMessage';
import { V3Page, Card, Tip } from '@/app/v3/ui/components';
import './dashboard-v3.css';

export const dynamic = 'force-dynamic';

// This page shows total revenue and financial breakdowns ("אזור ניהול" per its own
// heading below) - it had no access control at all (unlike /admin, /employees,
// /refunds, which are all gated the same way). A guard can't live in a shared
// app/dashboard/layout.js - that would also wrap /dashboard/dresses, which staff
// DO need to reach - so it's inline here instead. /dashboard/pricelist has its
// own scoped layout.js with the same guard for the same reason.
// Gated to הנהלה ראשית (roleId 0) + מתכנת (roleId 2) only, not a regular branch
// מנהל (roleId 1) — this revenue/financial breakdown page is company-wide data.
// Tightened 2026-08-24 following user-role bug reports.
export default async function Dashboard() {
  if (!(await checkPageAccess(HEAD_MANAGEMENT_ROLES))) {
    return <NoAccessMessage />;
  }
  // Trend window: 13 months back covers all three trend charts below (daily
  // last-30-active-days, weekly last-12-active-weeks, monthly last-12-active-months)
  // from a single query, per דיווח 58d71561 (נווה יעקב).
  const trendSince = new Date();
  trendSince.setMonth(trendSince.getMonth() - 13);

  const [
    totalCustomers,
    totalEmployees,
    totalOrders,
    revenueAggregation,
    paymentMethodsStats,
    recentPayments,
  ] = await Promise.all([
    prisma.customer.count({ where: { isDeleted: false } }),
    prisma.employee.count({ where: { isActive: true } }),
    prisma.order.count(),
    // דיווח 58d71561 (נווה יעקב) - הגרפים כאן היו ריקים תמיד: Order.totalAmount/
    // paymentMethod/paymentDate מוזנים רק בהזמנות שהגיעו ממיגרציית האקסס (ר'
    // scripts/import_all_data.js), לא נכתבים בכלל ע"י יצירה/עריכה של הזמנה במערכת
    // החיה (app/api/orders/route.js, app/api/orders/[id]/route.js) - התשלומים
    // האמיתיים נמצאים רק בטבלת Payment. amount שלילי = זיכוי/החזר (ר'
    // app/api/refunds/[id]/route.js), כך שסכימה רגילה כבר נטו מהחזרים.
    prisma.payment.aggregate({
      where: { isDeleted: false },
      _sum: { amount: true }
    }),
    // isRefund מוצא כאן החוצה (בניגוד לסכום הכולל למעלה) - זיכוי הוא amount שלילי
    // תחת אמצעי-תשלום 'החזר/זיכוי' משלו, שגרף עוגה לא יודע לצייר כפרוסה שלילית
    prisma.payment.groupBy({
      by: ['paymentMethod'],
      where: { isDeleted: false, isRefund: false },
      _sum: { amount: true },
      _count: { id: true }
    }),
    prisma.payment.findMany({
      orderBy: { paymentDate: 'desc' },
      select: { paymentDate: true, amount: true },
      where: { isDeleted: false, paymentDate: { gte: trendSince } }
    }),
  ]);

  const totalRevenue = revenueAggregation._sum.amount || 0;

  const revenueByMethod = paymentMethodsStats.map(stat => ({
    method: stat.paymentMethod || 'לא מוגדר',
    amount: stat._sum.amount || 0,
    count: stat._count.id
  })).sort((a, b) => b.amount - a.amount);

  const dateRevenueMap = {};
  recentPayments.forEach(payment => {
    if (!payment.paymentDate) return;
    const dateStr = payment.paymentDate.toISOString().split('T')[0];
    if (!dateRevenueMap[dateStr]) dateRevenueMap[dateStr] = 0;
    dateRevenueMap[dateStr] += (payment.amount || 0);
  });

  // Limit to last 30 active days
  const revenueTrend = Object.keys(dateRevenueMap)
    .sort()
    .slice(-30)
    .map(date => ({
      date,
      revenue: dateRevenueMap[date]
    }));

  // Week starts on Sunday (getDay() === 0), matching the calendar convention
  // used elsewhere in the app (board/shifts).
  const weekRevenueMap = {};
  const monthRevenueMap = {};
  recentPayments.forEach(payment => {
    if (!payment.paymentDate) return;
    const d = payment.paymentDate;
    const weekStart = new Date(d);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    weekRevenueMap[weekKey] = (weekRevenueMap[weekKey] || 0) + (payment.amount || 0);

    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthRevenueMap[monthKey] = (monthRevenueMap[monthKey] || 0) + (payment.amount || 0);
  });

  // Limit to last 12 active weeks/months
  const revenueTrendWeekly = Object.keys(weekRevenueMap)
    .sort()
    .slice(-12)
    .map(week => ({
      week,
      revenue: weekRevenueMap[week]
    }));

  const revenueTrendMonthly = Object.keys(monthRevenueMap)
    .sort()
    .slice(-12)
    .map(month => ({
      month,
      revenue: monthRevenueMap[month]
    }));

  return (
    <V3Page>
      <header className="v3-pagehead">
        <div className="v3-pagehead__title">
          <h1 className="v3-h1">סיכום כספי וניתוח נתונים</h1>
          <Tip>לוח סיכומים לכל החברה: הכנסות נטו (כולל זיכויים), ומספר הלקוחות, ההזמנות והעובדים.</Tip>
        </div>
      </header>

      <section className="dv3-section" aria-labelledby="dv3-kpi">
        <h2 id="dv3-kpi" className="v3-h2">במבט אחד</h2>
        <div className="dv3-kpis">
          <Card icon="coin" title="הכנסות" tip="סכום כל התשלומים נטו, אחרי זיכויים והחזרים.">
            <div className="v3-display"><bdi>₪{totalRevenue.toLocaleString()}</bdi></div>
          </Card>
          <Card icon="users" title="לקוחות פעילים">
            <div className="v3-display"><bdi>{totalCustomers.toLocaleString()}</bdi></div>
          </Card>
          <Card icon="bag" title="הזמנות" tip="כל ההזמנות במערכת, כולל מבוטלות.">
            <div className="v3-display"><bdi>{totalOrders.toLocaleString()}</bdi></div>
          </Card>
          <Card icon="user-check" title="עובדים פעילים">
            <div className="v3-display"><bdi>{totalEmployees}</bdi></div>
          </Card>
        </div>
      </section>

      <section className="dv3-section" aria-labelledby="dv3-charts">
        <h2 id="dv3-charts" className="v3-h2">גרפים</h2>
        <DashboardCharts
          revenueByMethod={revenueByMethod}
          revenueTrend={revenueTrend}
          revenueTrendWeekly={revenueTrendWeekly}
          revenueTrendMonthly={revenueTrendMonthly}
        />
      </section>
    </V3Page>
  );
}
