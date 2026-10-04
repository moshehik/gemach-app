'use client';

import { use } from 'react';
import dynamic from 'next/dynamic';
import { useUiVariant } from '../UiVariantContext';
import LegacyCustomerPage from '@/app/customers/[id]/LegacyCustomerPage';

// כרטיס הלקוח: 'legacy' (ברירת מחדל) = הכרטיס הישן כמו שהוא; 'a5' = הכרטיס החדש (עיצוב מאושר: תצוגות-עיצוב/כרטיס-לקוח.html
// + תשובות הבעלים 4.10.2026). הכרטיס החדש וטופס הלקוח החדש נטענים בנפרד (dynamic, בלי SSR) כמו HomeSwitch / ProfileSwitch:
// קובץ ה-CSS של הפלטה (~460KB) וקוד הכרטיס לא נטענים בכלל כשהדגל 'legacy'. אין הסתמכות על data-ui-customer-card ב-CSS או
// ב-JS (ר' UiVariantContext.js).
const CustomerCardA5 = dynamic(() => import('./CustomerCardA5'), { ssr: false });
const NewCustomerA5 = dynamic(() => import('./NewCustomerA5'), { ssr: false });

export default function CustomerCardSwitch({ params }) {
  const variant = useUiVariant('customer_card');
  if (variant !== 'a5') return <LegacyCustomerPage params={params} />;
  return <A5Route params={params} />;
}

// params הוא Promise (Next 16) - נפתח רק בענף החדש; הכרטיס הישן פותח אותו בעצמו (use(params)) כמו קודם.
function A5Route({ params }) {
  const { id } = use(params);
  if (id === 'new') return <NewCustomerA5 />;
  return <CustomerCardA5 customerId={id} />;
}
