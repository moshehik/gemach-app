'use client';

import dynamic from 'next/dynamic';
import { useUiVariant } from '../UiVariantContext';
import VariantFrame from '../variant/VariantFrame';
import LegacyDataHistoryPage from '@/app/admin/data-history/LegacyDataHistoryPage';

// היסטוריית נתונים (/admin/data-history): 'legacy' (ברירת מחדל לכולם חוץ מהמתכנת) = הדף הקודם כפי שהוא (LegacyDataHistoryPage.js = page.js של main 15dc7a0d, בייט-בבייט,
// עם אייקון המעבר לחדש בפינה - VariantFrame); 'a5' = היומן החדש (DataHistoryA5). החדש נטען בנפרד (dynamic, בלי SSR): קובץ ה-CSS של הפלטה (~460KB) לא נטען כשהדגל 'legacy'.
// ההכרעה: useUiVariant('data_history'). השער של האזור כולו (הנהלה ראשית / מתכנת) נשאר ב-app/admin/layout.js וב-/api/admin/data-history.
const DataHistoryA5 = dynamic(() => import('./DataHistoryA5'), { ssr: false });

export default function DataHistorySwitch() {
  const variant = useUiVariant('data_history');
  if (variant !== 'a5') return <VariantFrame screen="data_history" variant="legacy"><LegacyDataHistoryPage /></VariantFrame>;
  return <VariantFrame screen="data_history" variant="a5"><DataHistoryA5 /></VariantFrame>;
}
