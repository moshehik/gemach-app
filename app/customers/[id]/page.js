// כרטיס לקוח (/customers/[id]) וטופס לקוח חדש (/customers/new): עטיפה דקה שבוחרת בין הכרטיס הישן (LegacyCustomerPage.js -
// הועבר 1:1 מהקובץ הזה) לכרטיס החדש (app/components/customer-card/*) לפי הדגל ui_variant_customer_card
// (useUiVariant('customer_card')). ברירת מחדל 'legacy' = האתר זהה לקודם; ההדלקה היא צעד נפרד באישור הבעלים.
import CustomerCardSwitch from '@/app/components/customer-card/CustomerCardSwitch';

export default function CustomerPage({ params }) {
  return <CustomerCardSwitch params={params} />;
}
