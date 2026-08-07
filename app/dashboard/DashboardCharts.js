'use client';

import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['var(--primary-solid)', 'var(--success)', 'var(--info)', 'var(--accent)', 'var(--danger)'];

export default function DashboardCharts({ revenueByMethod, revenueTrend }) {
  return (
    <div className="form-grid" style={{ marginTop: '1.5rem' }}>

      <div className="card">
        <div className="card-head">
          <div className="card-title-row">
            <svg className="icon"><use href="#i-wallet" /></svg>
            <h3>התפלגות הכנסות לפי אמצעי תשלום</h3>
          </div>
        </div>
        <div className="card-pad">
          <div style={{ height: '300px' }}>
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
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title-row">
            <svg className="icon"><use href="#i-activity" /></svg>
            <h3>הכנסות לפי תאריך תשלום (תקופה אחרונה)</h3>
          </div>
        </div>
        <div className="card-pad">
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
                <Bar dataKey="revenue" name="הכנסות (₪)" fill="var(--primary-solid)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
}
