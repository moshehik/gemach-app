'use client';

import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#c4a661', '#4caf50', '#2196f3', '#ff9800', '#f44336'];

export default function DashboardCharts({ revenueByMethod, revenueTrend }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginTop: '2rem' }} data-agy-id="dashboard_charts_container">
      
      <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }} data-agy-id="revenue_by_method_chart_container">
        <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>התפלגות הכנסות לפי אמצעי תשלום</h3>
        <div style={{ height: '300px' }}>
          <ResponsiveContainer data-element-name="רכיב_DashboardCharts_1" width="100%" height="100%">
            <PieChart data-element-name="רכיב_DashboardCharts_2">
              <Pie data-element-name="רכיב_DashboardCharts_3"
                data={revenueByMethod}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="amount"
                nameKey="method"
                label={({ method, percent }) => `${method} (${(percent * 100).toFixed(0)}%)`}
              >
                {revenueByMethod.map((entry, index) => (
                  <Cell data-element-name="רכיב_DashboardCharts_4" key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip data-element-name="רכיב_DashboardCharts_5" formatter={(value) => `₪${value}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }} data-agy-id="revenue_trend_chart_container">
        <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>הכנסות לפי תאריך תשלום (תקופה אחרונה)</h3>
        <div style={{ height: '300px' }}>
          <ResponsiveContainer data-element-name="רכיב_DashboardCharts_6" width="100%" height="100%">
            <BarChart data-element-name="רכיב_DashboardCharts_7"
              data={revenueTrend}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <XAxis data-element-name="רכיב_DashboardCharts_8" dataKey="date" />
              <YAxis data-element-name="רכיב_DashboardCharts_9" />
              <Tooltip data-element-name="רכיב_DashboardCharts_10" formatter={(value) => `₪${value}`} />
              <Legend data-element-name="רכיב_DashboardCharts_11" />
              <Bar data-element-name="רכיב_DashboardCharts_12" dataKey="revenue" name="הכנסות (₪)" fill="#c4a661" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
