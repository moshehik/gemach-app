import prisma from '../lib/prisma';
import DashboardCharts from './DashboardCharts';
import { checkPageAccess } from '@/lib/auth';
import NoAccessMessage from '@/app/components/NoAccessMessage';

export const dynamic = 'force-dynamic';

// This page shows total revenue and financial breakdowns ("אזור ניהול" per its own
// heading below) - it had no access control at all (unlike /admin, /employees,
// /refunds, which are all gated the same way). A guard can't live in a shared
// app/dashboard/layout.js - that would also wrap /dashboard/dresses, which staff
// DO need to reach - so it's inline here instead. /dashboard/pricelist has its
// own scoped layout.js with the same manager-only guard for the same reason.
export default async function Dashboard() {
  if (!(await checkPageAccess())) {
    return <NoAccessMessage />;
  }
  // Trend window: 35 days back covers the "last 30 active days" chart
  const trendSince = new Date();
  trendSince.setDate(trendSince.getDate() - 35);

  const [
    totalCustomers,
    totalEmployees,
    totalOrders,
    revenueAggregation,
    paymentMethodsStats,
    recentOrders,
  ] = await Promise.all([
    prisma.customer.count({ where: { isDeleted: false } }),
    prisma.employee.count({ where: { isActive: true } }),
    prisma.order.count(),
    prisma.order.aggregate({
      _sum: { totalAmount: true }
    }),
    prisma.order.groupBy({
      by: ['paymentMethod'],
      _sum: { totalAmount: true },
      _count: { id: true }
    }),
    prisma.order.findMany({
      orderBy: { paymentDate: 'desc' },
      select: { paymentDate: true, totalAmount: true },
      where: { paymentDate: { gte: trendSince } }
    }),
  ]);

  const totalRevenue = revenueAggregation._sum.totalAmount || 0;

  const revenueByMethod = paymentMethodsStats.map(stat => ({
    method: stat.paymentMethod || 'לא מוגדר',
    amount: stat._sum.totalAmount || 0,
    count: stat._count.id
  })).sort((a, b) => b.amount - a.amount);

  const dateRevenueMap = {};
  recentOrders.forEach(order => {
    if (!order.paymentDate) return;
    const dateStr = order.paymentDate.toISOString().split('T')[0];
    if (!dateRevenueMap[dateStr]) dateRevenueMap[dateStr] = 0;
    dateRevenueMap[dateStr] += (order.totalAmount || 0);
  });

  // Limit to last 30 active days
  const revenueTrend = Object.keys(dateRevenueMap)
    .sort()
    .slice(-30)
    .map(date => ({
      date,
      revenue: dateRevenueMap[date]
    }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>אזור ניהול - סיכומים ופילוחים</h1>
        </div>
      </div>

      <h2 className="section-title">מדדים מרכזיים</h2>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: 'var(--success-tint)', color: 'var(--success)' }}>
              <svg className="icon"><use href="#i-coin" /></svg>
            </div>
          </div>
          <div className="kpi-label">סה"כ הכנסות</div>
          <div className="kpi-value">₪{totalRevenue.toLocaleString()}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: 'var(--info-tint)', color: 'var(--info)' }}>
              <svg className="icon"><use href="#i-users" /></svg>
            </div>
          </div>
          <div className="kpi-label">לקוחות פעילים</div>
          <div className="kpi-value">{totalCustomers.toLocaleString()}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: 'var(--primary-tint)', color: 'var(--primary)' }}>
              <svg className="icon"><use href="#i-bag" /></svg>
            </div>
          </div>
          <div className="kpi-label">סה"כ הזמנות</div>
          <div className="kpi-value">{totalOrders.toLocaleString()}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: 'var(--warning-tint)', color: 'var(--warning)' }}>
              <svg className="icon"><use href="#i-user-check" /></svg>
            </div>
          </div>
          <div className="kpi-label">עובדים פעילים</div>
          <div className="kpi-value">{totalEmployees}</div>
        </div>
      </div>

      <h2 className="section-title">פילוח נתונים</h2>
      <DashboardCharts revenueByMethod={revenueByMethod} revenueTrend={revenueTrend} />
    </>
  );
}
