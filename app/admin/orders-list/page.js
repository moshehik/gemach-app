import OrdersListLoader from '@/app/components/orders-list/OrdersListLoader';

// /admin/orders-list - רשימת ההזמנות לניהול (ללא גרסה ישנה; נגישה רק מאזור הניהול).
// השער: app/admin/layout.js (checkPageAccess(HEAD_MANAGEMENT_ROLES) = הנהלה ראשית / מתכנת; אחרת כרטיס "אין הרשאה"; לא מחובר - מסך הכניסה של app/layout.js)
// וה-API שמאחוריו (/api/admin/orders-list) שומר על אותו שער בנפרד (checkAuth('הנהלה ראשית')).
export const dynamic = 'force-dynamic';

export default function OrdersListPage() {
  return <OrdersListLoader />;
}
