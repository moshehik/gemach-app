'use client';

import dynamic from 'next/dynamic';
import { useUiVariant } from '../UiVariantContext';
import VariantFrame from '../variant/VariantFrame';
import PermissionsClient from '@/app/admin/permissions/PermissionsClient';

// הרשאות (/admin/permissions): 'legacy' (ברירת מחדל לכולם חוץ מהמתכנת) = הדף הקודם כפי שהוא (PermissionsClient.js, ללא שינוי, עם אייקון המעבר לחדש בפינה - VariantFrame);
// 'a5' = המסך החדש (PermissionsA5). החדש נטען בנפרד (dynamic, בלי SSR): קובץ ה-CSS של הפלטה (~460KB) לא נטען כשהדגל 'legacy'. ההכרעה: useUiVariant('permissions').
// השער (הנהלה ראשית / מתכנת) נשאר ב-app/admin/layout.js וב-/api/admin/permissions.
const PermissionsA5 = dynamic(() => import('./PermissionsA5'), { ssr: false });

export default function PermissionsSwitch() {
  const variant = useUiVariant('permissions');
  if (variant !== 'a5') return <VariantFrame screen="permissions" variant="legacy"><PermissionsClient /></VariantFrame>;
  return <VariantFrame screen="permissions" variant="a5"><PermissionsA5 /></VariantFrame>;
}
