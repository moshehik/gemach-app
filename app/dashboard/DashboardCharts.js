'use client';

// עטיפת טעינה דינמית ל-recharts: הספרייה (~400KB) יוצאת מה-bundle הבסיסי של
// לוח הבקרה ונטענת רק כשהגרפים באמת מוצגים. ה-placeholder משכפל את שלד שני
// הכרטיסים בגובה הגרפים המדויק (300px + כותרת) כדי שלא יהיה layout jank במעבר.
// התוכן עצמו לא השתנה — הוא עבר כפי-שהוא ל-DashboardChartsImpl.js.

import dynamic from 'next/dynamic';
import { Card, Icon } from '@/app/v3/ui/components';

function SkeletonCard({ icon, title }) {
  return (
    <Card icon={icon} title={title} level={3}>
      <div className="dv3-chart-load" role="status">
        <Icon name="loader" loop /> טוענים את הגרף…
      </div>
    </Card>
  );
}

function ChartsSkeleton() {
  return (
    <div className="dv3-charts">
      <SkeletonCard icon="wallet" title="הכנסות לפי אמצעי תשלום" />
      <SkeletonCard icon="activity" title="הכנסות לפי יום" />
      <SkeletonCard icon="activity" title="הכנסות לפי שבוע" />
      <SkeletonCard icon="activity" title="הכנסות לפי חודש" />
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
