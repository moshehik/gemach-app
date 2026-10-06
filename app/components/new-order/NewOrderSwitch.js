'use client';

import dynamic from 'next/dynamic';
import { useUiVariant } from '../UiVariantContext';
import VariantFrame from '../variant/VariantFrame';
import LegacyNewOrderPage from '@/app/orders/new/LegacyNewOrderPage';

// הזמנה חדשה: 'legacy' (ברירת מחדל) = האשף הישן כמו שהוא; 'a5' = האשף החדש (העיצוב המאושר תצוגות-עיצוב/הזמנה-חדשה.html,
// גרסת B2 'מודרך עם פסים', עם תשובות הבעלים answers-neworder.json). האשף החדש נטען בנפרד (dynamic, בלי SSR) כמו
// HomeSwitch / ProfileSwitch: קובץ ה-CSS של הפלטה (~460KB) וקוד האשף לא נטענים כלל כשהדגל 'legacy'.
// הדגל: מסך 'new_order' ב-lib/uiVariant.js (SystemSetting ui_variant_new_order או עקיפה אישית). 6.10.2026: ברירת מחדל לפי תפקיד -
// חדש למתכנת (newExists ב-lib/uiVariantScreens.js), ישן לכל השאר; הנהלה ראשית / מתכנת מחליפים לעצמם באייקון PageVariantToggle
// (בכותרת האשף החדש; בישן - בפינה, דרך VariantFrame כמו OrderCardSwitch). לכל השאר - הגדרת ארגון (scripts/set-ui-variant.js).
const NewOrderA5 = dynamic(() => import('./NewOrderA5'), { ssr: false });

export default function NewOrderSwitch() {
  const variant = useUiVariant('new_order');
  // VariantFrame: בישן מוסיף את אייקון המעבר "לתצוגה החדשה" בפינה (בלי לגעת בקובץ הישן הקפוא); בחדש האייקון בכותרת האשף.
  if (variant !== 'a5') return <VariantFrame screen="new_order" variant="legacy"><LegacyNewOrderPage /></VariantFrame>;
  return <VariantFrame screen="new_order" variant="a5"><NewOrderA5 /></VariantFrame>;
}
