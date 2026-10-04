'use client';

// /orders/[id] — כרטיס ההזמנה. עטיפה דקה בלבד: הבחירה בין הכרטיס הישן (LegacyOrderPage.js, הקוד הקודם של הקובץ
// הזה, הועבר כמו שהוא) לבין כרטיס ה-A5 החדש נעשית ב-OrderCardSwitch לפי useUiVariant('order_card').
// ברירת המחדל (אין שורת ui_variant_order_card) = 'legacy' = הכרטיס הישן בדיוק כמו קודם.
import OrderCardSwitch from '@/app/components/order-card/OrderCardSwitch';

export default function OrderDetailsRoute({ params }) {
  return <OrderCardSwitch params={params} />;
}
