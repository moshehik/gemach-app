'use client';

import dynamic from 'next/dynamic';
import { useUiVariant } from '../UiVariantContext';
import VariantFrame from '../variant/VariantFrame';
import LegacyManagementHistoryPage from '@/app/management/history/LegacyManagementHistoryPage';

// היסטוריית ההנהלה - שאילתות ו-API (/management/history): 'legacy' (ברירת מחדל לכולם חוץ מהמתכנת) = הדף הקודם כפי שהוא (LegacyManagementHistoryPage.js = page.js של main 15dc7a0d,
// בייט-בבייט, עם אייקון המעבר לחדש בפינה - VariantFrame); 'a5' = הרשימה החדשה (ManagementHistoryA5). החדש נטען בנפרד (dynamic, בלי SSR): קובץ ה-CSS של הפלטה לא נטען בישן.
// ההכרעה: useUiVariant('management_history'). השער של האזור (הנהלה ראשית / מתכנת) נשאר ב-app/management/layout.js וב-/api/admin/management-history.
const ManagementHistoryA5 = dynamic(() => import('./ManagementHistoryA5'), { ssr: false });

export default function ManagementHistorySwitch() {
  const variant = useUiVariant('management_history');
  if (variant !== 'a5') return <VariantFrame screen="management_history" variant="legacy"><LegacyManagementHistoryPage /></VariantFrame>;
  return <VariantFrame screen="management_history" variant="a5"><ManagementHistoryA5 /></VariantFrame>;
}
