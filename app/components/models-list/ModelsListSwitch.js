'use client';

import dynamic from 'next/dynamic';
import { useUiVariant } from '../UiVariantContext';
import VariantFrame from '../variant/VariantFrame';
import LegacyDressesListPage from '@/app/dashboard/dresses/LegacyDressesListPage';

// רשימת הדגמים (/dashboard/dresses): 'legacy' (ברירת מחדל לכולם חוץ מהמתכנת) = הדף הקודם כפי שהוא (LegacyDressesListPage.js = page.js של main 51eae39f,
// בייט-בבייט, עם אייקון המעבר לחדש בפינה - VariantFrame); 'a5' = הרשימה החדשה (העיצוב המאושר models.html). הרשימה החדשה נטענת בנפרד
// (dynamic, בלי SSR): קובץ ה-CSS של הפלטה (~460KB) לא נטען כשהדגל 'legacy'. ההכרעה: useUiVariant('models_list') - אותם קלטים כמו בשרת (app/layout.js).
const ModelsListA5 = dynamic(() => import('./ModelsListA5'), { ssr: false });

export default function ModelsListSwitch() {
  const variant = useUiVariant('models_list');
  if (variant !== 'a5') return <VariantFrame screen="models_list" variant="legacy"><LegacyDressesListPage /></VariantFrame>;
  return <VariantFrame screen="models_list" variant="a5"><ModelsListA5 /></VariantFrame>;
}
