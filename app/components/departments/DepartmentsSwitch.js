'use client';

import dynamic from 'next/dynamic';
import { useUiVariant } from '../UiVariantContext';
import VariantFrame from '../variant/VariantFrame';
import LegacyDepartmentsPage from '@/app/admin/departments/LegacyDepartmentsPage';

// ניהול מחלקות (/admin/departments): 'legacy' (ברירת מחדל לכולם חוץ מהמתכנת) = הדף הקודם כפי שהוא (LegacyDepartmentsPage.js = page.js של main 15dc7a0d,
// בייט-בבייט, עם אייקון המעבר לחדש בפינה - VariantFrame); 'a5' = הרשימה החדשה על ערכת הרשימות. החדש נטען בנפרד (dynamic, בלי SSR): קובץ ה-CSS של הפלטה (~460KB)
// לא נטען כשהדגל 'legacy'. ההכרעה: useUiVariant('departments') - אותם קלטים כמו בשרת (app/layout.js). השער (הנהלה ראשית / מתכנת) נשאר ב-app/admin/layout.js וב-API.
const DepartmentsA5 = dynamic(() => import('./DepartmentsA5'), { ssr: false });

export default function DepartmentsSwitch() {
  const variant = useUiVariant('departments');
  if (variant !== 'a5') return <VariantFrame screen="departments" variant="legacy"><LegacyDepartmentsPage /></VariantFrame>;
  return <VariantFrame screen="departments" variant="a5"><DepartmentsA5 /></VariantFrame>;
}
