import CustomersListLoader from '@/app/components/customers-list/CustomersListLoader';

// /admin/customers-list - רשימת הלקוחות לניהול (ללא גרסה ישנה; נגישה רק מאזור הניהול).
// השער: app/admin/layout.js (checkPageAccess(HEAD_MANAGEMENT_ROLES) = הנהלה ראשית / מתכנת; אחרת כרטיס "אין הרשאה"; לא מחובר - מסך הכניסה של app/layout.js)
// וה-API שמאחוריו (/api/admin/customers-list) שומר על אותו שער בנפרד (checkAuth('הנהלה ראשית')).
export const dynamic = 'force-dynamic';

export default function CustomersListPage() {
  return <CustomersListLoader />;
}
