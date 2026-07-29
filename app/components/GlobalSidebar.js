'use client';

import Link from 'next/link';
import { PlusCircle, RotateCcw, Search } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function GlobalSidebar() {
  const pathname = usePathname();

  // Hide on login screen if needed, or check logic
  // but it's rendered inside layout after checking showLogin, so it's safe.

  return (
    <div className="global-sidebar" data-element-name="רכיב_GlobalSidebar_1">
      <Link href="/orders/new" className="global-sidebar-icon" title="הזמנה חדשה" data-element-name="רכיב_GlobalSidebar_2">
        <PlusCircle size={22} strokeWidth={2.5} />
      </Link>
      <Link href="/rentals" className="global-sidebar-icon" title="החזרה מהירה" data-element-name="רכיב_GlobalSidebar_3">
        <RotateCcw size={22} strokeWidth={2.5} />
      </Link>
      <Link href="/customers" className="global-sidebar-icon" title="חיפוש מהיר / חיפוש לקוח" data-element-name="רכיב_GlobalSidebar_4">
        <Search size={22} strokeWidth={2.5} />
      </Link>
    </div>
  );
}
