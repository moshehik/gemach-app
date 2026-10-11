'use client';

import dynamic from 'next/dynamic';
import { useUiVariant } from '../UiVariantContext';
import VariantFrame from '../variant/VariantFrame';
import LegacyNewDressPage from './LegacyNewDressPage';

// דגם חדש (/dashboard/dresses/new): 'legacy' (ברירת מחדל) = האשף הישן כמו שהוא (LegacyNewDressPage -> ModernNewDressWizard); 'a5' = האשף החדש
// (העיצוב המאושר model-new.html). הדגל: מסך 'model_new' ב-lib/uiVariantScreens.js (ui_variant_model_new או עקיפה אישית; ברירת מחדל לפי תפקיד - מתכנת חדש,
// כל השאר ישן). האשף החדש נטען בנפרד (dynamic, בלי SSR) כמו NewOrderSwitch: ה-CSS והקוד לא נטענים כשהדגל 'legacy'.
const ModelNewA5 = dynamic(() => import('./ModelNewA5'), { ssr: false });

export default function ModelNewSwitch() {
  const variant = useUiVariant('model_new');
  if (variant !== 'a5') return <VariantFrame screen="model_new" variant="legacy"><LegacyNewDressPage /></VariantFrame>;
  return <VariantFrame screen="model_new" variant="a5"><ModelNewA5 /></VariantFrame>;
}
