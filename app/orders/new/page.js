'use client';

// /orders/new - "הזמנה חדשה". עטיפה דקה בלבד: הבחירה בין האשף הישן (LegacyNewOrderPage.js - הקוד הקודם של הקובץ הזה,
// הועבר כמו שהוא) לבין האשף החדש (app/components/new-order, העיצוב המאושר 'B2 מודרך עם פסים') נעשית ב-NewOrderSwitch
// לפי useUiVariant('new_order'). ברירת המחדל (אין שורת ui_variant_new_order) = 'legacy' = האשף הישן בדיוק כמו קודם.
import NewOrderSwitch from '@/app/components/new-order/NewOrderSwitch';

export default function NewOrderRoute() {
  return <NewOrderSwitch />;
}
