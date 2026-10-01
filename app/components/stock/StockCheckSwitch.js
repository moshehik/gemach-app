'use client';

import dynamic from 'next/dynamic';

// הדף נטען בנפרד (כמו HomeSwitch): קובץ ה-CSS של הפלטה (~450KB) וקוד הדף נטענים רק בכניסה ל-/stock-check.
const StockCheckPage = dynamic(() => import('./StockCheckPage'), { ssr: false });

export default function StockCheckSwitch() {
  return <StockCheckPage />;
}
