'use client';

import { use } from 'react';
import dynamic from 'next/dynamic';
import { useUiVariant } from '../UiVariantContext';
import LegacyEmployeeCardPage from '@/app/employees/[id]/LegacyEmployeeCardPage';

// כרטיס עובד (ניהול): 'legacy' (ברירת מחדל) = הכרטיס הישן כמו שהוא; 'a5' = הכרטיס החדש (עיצוב מאושר:
// תצוגות-עיצוב/כרטיס-עובד-ניהול.html + תשובות הבעלים EC-01..EC-12, 4.10.2026). הכרטיס החדש נטען בנפרד (dynamic, בלי SSR) כמו
// CustomerCardSwitch / ProfileSwitch: קובץ ה-CSS של הפלטה (~460KB) וקוד הכרטיס לא נטענים כשהדגל 'legacy'.
// אין הסתמכות על data-ui-employee-card ב-CSS או ב-JS (ר' UiVariantContext.js).
const EmployeeCardA5 = dynamic(() => import('./EmployeeCardA5'), { ssr: false });

export default function EmployeeCardSwitch({ params }) {
  const variant = useUiVariant('employee_card');
  if (variant !== 'a5') return <LegacyEmployeeCardPage params={params} />;
  return <A5Route params={params} />;
}

// params הוא Promise (Next 16) - נפתח רק בענף החדש; הכרטיס הישן פותח אותו בעצמו (use(params)) כמו קודם.
function A5Route({ params }) {
  const { id } = use(params);
  return <EmployeeCardA5 employeeId={id} />;
}
