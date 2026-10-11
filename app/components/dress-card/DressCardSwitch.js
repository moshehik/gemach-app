'use client';

import { use } from 'react';
import dynamic from 'next/dynamic';
import { useUiVariant } from '../UiVariantContext';
import VariantFrame from '../variant/VariantFrame';
import LegacyDressCardPage from '@/app/dashboard/dresses/[id]/LegacyDressCardPage';

// כרטיס הדגם: 'legacy' (ברירת מחדל) = הכרטיס הישן כמו שהוא (LegacyDressCardPage.js, הועבר 1:1 מ-page.js); 'a5' = הכרטיס החדש
// (app/components/dress-card). הכרטיס החדש נטען בנפרד (dynamic, בלי SSR) כמו OrderCardSwitch - קובץ ה-CSS של הפלטה וקוד הכרטיס לא נטענים
// כשהדגל 'legacy'. מסך "דגם חדש" (/dashboard/dresses/new) נשאר באשף הקיים בשתי הגרסאות עד שייבנה (מסך model_new, שלב 2).
const DressCardA5 = dynamic(() => import('./DressCardA5'), { ssr: false });

export default function DressCardSwitch({ params }) {
  const variant = useUiVariant('model_card');
  if (variant !== 'a5') return <VariantFrame screen="model_card" variant="legacy"><LegacyDressCardPage params={params} /></VariantFrame>;
  return <VariantFrame screen="model_card" variant="a5"><A5Route params={params} /></VariantFrame>;
}

// params הוא Promise (Next 16) - נפתח רק בענף החדש; הכרטיס הישן פותח אותו בעצמו (use(params)).
function A5Route({ params }) {
  const { id } = use(params);
  if (id === 'new') return <LegacyDressCardPage params={params} />;
  return <DressCardA5 dressId={id} />;
}
