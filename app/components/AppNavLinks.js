'use client';

import Link from 'next/link';
import { useLabels } from './LabelsContext';

export default function AppNavLinks({ enableAlterations }) {
  const { getLabel } = useLabels();

  return (
    <div className="nav-links">
      <Link href="/" className="nav-link">מערכת כללית</Link>
      <Link href="/board" className="nav-link">לוח</Link>
      <Link href="/customers" className="nav-link">{getLabel('tab_customers', 'לקוחות')}</Link>
      <Link href="/customer-interface" className="nav-link">{getLabel('tab_customer_availability', 'זמינות לקוח')}</Link>
      <Link href="/orders" className="nav-link">{getLabel('tab_orders', 'הזמנות ותשלומים')}</Link>
      <Link href="/rentals" className="nav-link">{getLabel('tab_rentals', 'השכרות והחזרות')}</Link>
      {enableAlterations && <Link href="/alterations" className="nav-link">תיקונים ותפירות</Link>}
    </div>
  );
}
