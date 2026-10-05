'use client';

import { use } from 'react';
import dynamic from 'next/dynamic';
import { useUiVariant } from '../UiVariantContext';
import VariantFrame from '../variant/VariantFrame';
import LegacyOrderPage from '@/app/orders/[id]/LegacyOrderPage';

// כרטיס ההזמנה: 'legacy' (ברירת מחדל) = הכרטיס הישן כמו שהוא; 'a5' = הכרטיס החדש (PLAN §D.1).
// הכרטיס החדש נטען בנפרד (dynamic, בלי SSR) כמו HomeSwitch / ProfileSwitch: קובץ ה-CSS של הפלטה (~460KB) וקוד הכרטיס
// החדש לא נטענים בכלל כשהדגל 'legacy'. אין הסתמכות על data-ui-order-card ב-CSS או ב-JS (ר' UiVariantContext.js).
// ברירת מחדל: ישן לכולם, חדש למתכנת (newExists ב-lib/uiVariantScreens.js). הנהלה ראשית / מתכנת מחליפים לעצמם באייקון PageVariantToggle; לכל השאר - הגדרת ארגון (scripts/set-ui-variant.js).
const OrderCardA5 = dynamic(() => import('./OrderCardA5'), { ssr: false });

export default function OrderCardSwitch({ params }) {
  const variant = useUiVariant('order_card');
  // VariantFrame: בישן מוסיף את אייקון המעבר "לתצוגה החדשה" בפינה (בלי לגעת בקובץ הישן הקפוא); בחדש האייקון בכותרת OcTopbar.
  if (variant !== 'a5') return <VariantFrame screen="order_card" variant="legacy"><LegacyOrderPage params={params} /></VariantFrame>;
  return <VariantFrame screen="order_card" variant="a5"><A5Route params={params} /></VariantFrame>;
}

// params הוא Promise (Next 16) - נפתח רק בענף החדש; הכרטיס הישן פותח אותו בעצמו (use(params)) כמו קודם.
function A5Route({ params }) {
  const { id } = use(params);
  return <OrderCardA5 orderRef={id} />;
}
