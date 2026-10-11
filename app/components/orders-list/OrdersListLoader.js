'use client';

import dynamic from 'next/dynamic';

// רשימת ההזמנות לניהול נטענת בנפרד (dynamic, בלי SSR): קובץ ה-CSS של הפלטה (~460KB) לא נכנס ל-bundle של שאר דפי הניהול (אותה מוסכמה כמו AdminHubSwitch / ModelsListSwitch).
const OrdersListA5 = dynamic(() => import('./OrdersListA5'), { ssr: false });

export default function OrdersListLoader() {
  return <OrdersListA5 />;
}
