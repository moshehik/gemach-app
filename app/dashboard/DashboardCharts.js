'use client';

// עטיפת טעינה דינמית ל-recharts: הספרייה (~400KB) יוצאת מה-bundle הבסיסי של
// לוח הבקרה ונטענת רק כשהגרפים באמת מוצגים. ה-placeholder משכפל את שלד שני
// הכרטיסים בגובה הגרפים המדויק (300px + כותרת) כדי שלא יהיה layout jank במעבר.
// התוכן עצמו לא השתנה — הוא עבר כפי-שהוא ל-DashboardChartsImpl.js.

import dynamic from 'next/dynamic';

function ChartsSkeleton() {
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
          <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="loading-inline"><span className="spinner" /> טוען גרף...</div>
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
          <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="loading-inline"><span className="spinner" /> טוען גרף...</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const DashboardChartsImpl = dynamic(() => import('./DashboardChartsImpl'), {
  ssr: false,
  loading: ChartsSkeleton,
});

export default function DashboardCharts(props) {
  return <DashboardChartsImpl {...props} />;
}
