'use client';

import Link from 'next/link';
import { useLabels } from './LabelsContext';

export default function AppNavLinks({ enableAlterations }) {
  const { getLabel } = useLabels();

  return (
    <div className="nav-links">
      <Link data-element-name="רכיב_AppNavLinks_1" href="/" className="nav-link">בית</Link>
      <Link data-element-name="רכיב_AppNavLinks_2" href="/board" className="nav-link">לוח</Link>
      <Link data-element-name="רכיב_AppNavLinks_3" href="/customers" className="nav-link">{getLabel('tab_customers', 'לקוחות')}</Link>
      <Link data-element-name="רכיב_AppNavLinks_4" href="/customer-interface" className="nav-link">{getLabel('tab_customer_availability', 'זמינות לקוח')}</Link>
      <Link data-element-name="רכיב_AppNavLinks_5" href="/orders" className="nav-link">{getLabel('tab_orders', 'הזמנות')}</Link>
      <Link data-element-name="רכיב_AppNavLinks_6" href="/rentals" className="nav-link">{getLabel('tab_rentals', 'השכרות והחזרות')}</Link>
      {enableAlterations && <Link data-element-name="רכיב_AppNavLinks_7" href="/alterations" className="nav-link">תפירות</Link>}
    </div>
  );
}
