'use client';

// התוכן המקורי של DashboardCharts — הופרד לקובץ נפרד כדי ש-recharts ייטען
// דינמית (ראה DashboardCharts.js). מעטפת v3 בלבד.

import { Card } from '@/app/v3/ui/components';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['var(--v3-navy)', 'var(--v3-gold)', 'var(--v3-sky-400)', 'var(--v3-rose-500)', 'var(--v3-navy-500)'];

export default function DashboardChartsImpl({ revenueByMethod, revenueTrend, revenueTrendWeekly, revenueTrendMonthly }) {
  return (
    <div className="dv3-charts">

      <Card icon="wallet" title="הכנסות לפי אמצעי תשלום" level={3}>
          <div className="dv3-chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={revenueByMethod}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  dataKey="amount"
                  nameKey="method"
                  label={({ method, percent }) => `${method} (${(percent * 100).toFixed(0)}%)`}
                >
                  {revenueByMethod.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `₪${value}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
      </Card>

      <Card icon="activity" title="הכנסות לפי יום" level={3}>
          <div className="dv3-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={revenueTrend}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => `₪${value}`} />
                <Legend />
                <Bar dataKey="revenue" name="הכנסות (₪)" fill="var(--v3-navy)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
      </Card>

      <Card icon="activity" title="הכנסות לפי שבוע" level={3}>
          <div className="dv3-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={revenueTrendWeekly}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip formatter={(value) => `₪${value}`} />
                <Legend />
                <Bar dataKey="revenue" name="הכנסות (₪)" fill="var(--v3-sky-400)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
      </Card>

      <Card icon="activity" title="הכנסות לפי חודש" level={3}>
          <div className="dv3-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={revenueTrendMonthly}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `₪${value}`} />
                <Legend />
                <Bar dataKey="revenue" name="הכנסות (₪)" fill="var(--v3-gold)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
      </Card>

    </div>
  );
}
