'use client';

import dynamic from 'next/dynamic';
import { useUiVariant } from '../UiVariantContext';
import LegacyNewOrderPage from '@/app/orders/new/LegacyNewOrderPage';

// הזמנה חדשה: 'legacy' (ברירת מחדל) = האשף הישן כמו שהוא; 'a5' = האשף החדש (העיצוב המאושר תצוגות-עיצוב/הזמנה-חדשה.html,
// גרסת B2 'מודרך עם פסים', עם תשובות הבעלים answers-neworder.json). האשף החדש נטען בנפרד (dynamic, בלי SSR) כמו
// HomeSwitch / ProfileSwitch: קובץ ה-CSS של הפלטה (~460KB) וקוד האשף לא נטענים כלל כשהדגל 'legacy'.
// הדגל: מסך 'new_order' ב-lib/uiVariant.js (SystemSetting ui_variant_new_order או עקיפה אישית); ההדלקה רק דרך
// scripts/set-ui-variant.js (new_order לא ניתן להחלפה עצמית, lib/uiVariantSelfSwitch.js).
const NewOrderA5 = dynamic(() => import('./NewOrderA5'), { ssr: false });

export default function NewOrderSwitch() {
  const variant = useUiVariant('new_order');
  if (variant !== 'a5') return <LegacyNewOrderPage />;
  return <NewOrderA5 />;
}
