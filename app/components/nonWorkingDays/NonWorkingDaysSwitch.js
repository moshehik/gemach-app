'use client';

import dynamic from 'next/dynamic';

// "ימי אי-פעילות" נטען בנפרד (כמו StockCheckSwitch / AttendanceSwitch): ה-CSS של הפלטה (~450KB) וקוד הדף נטענים רק בכניסה לדף.
const NonWorkingDaysPage = dynamic(() => import('./NonWorkingDaysPage'), { ssr: false });

export default function NonWorkingDaysSwitch() {
  return <NonWorkingDaysPage />;
}
