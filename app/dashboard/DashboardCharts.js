'use client';

import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#c4a661', '#4caf50', '#2196f3', '#ff9800', '#f44336'];

export default function DashboardCharts({ revenueByMethod, revenueTrend }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
      
      <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
        <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>התפלגות הכנסות לפי אמצעי תשלום</h3>
        <div style={{ height: '300px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
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
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `₪${value}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
        <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>הכנסות לפי תאריך תשלום (תקופה אחרונה)</h3>
        <div style={{ height: '300px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={revenueTrend}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => `₪${value}`} />
              <Legend />
              <Bar dataKey="revenue" name="הכנסות (₪)" fill="#c4a661" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
