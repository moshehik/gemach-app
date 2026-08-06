'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLabels } from './LabelsContext';

export default function AppNavLinks({ enableAlterations }) {
  const { getLabel } = useLabels();
  const pathname = usePathname();

  const linkClass = (href) => {
    const isActive = href === '/' ? pathname === '/' : pathname?.startsWith(href);
    return isActive ? 'nav-link active' : 'nav-link';
  };

  return (
    <div className="nav-links">
      <Link data-element-name="רכיב_AppNavLinks_1" href="/" className={linkClass('/')}>בית</Link>
      <Link data-element-name="רכיב_AppNavLinks_2" href="/board" className={linkClass('/board')}>לוח</Link>
      <Link data-element-name="רכיב_AppNavLinks_3" href="/customers" className={linkClass('/customers')}>{getLabel('tab_customers', 'לקוחות')}</Link>
      <Link data-element-name="רכיב_AppNavLinks_4" href="/customer-interface" className={linkClass('/customer-interface')}>{getLabel('tab_customer_availability', 'זמינות לקוח')}</Link>
      <Link data-element-name="רכיב_AppNavLinks_5" href="/orders" className={linkClass('/orders')}>{getLabel('tab_orders', 'הזמנות')}</Link>
      <Link data-element-name="רכיב_AppNavLinks_6" href="/rentals" className={linkClass('/rentals')}>{getLabel('tab_rentals', 'השכרות והחזרות')}</Link>
      {enableAlterations && <Link data-element-name="רכיב_AppNavLinks_7" href="/alterations" className={linkClass('/alterations')}>תפירות</Link>}
    </div>
  );
}
