// כרטיס עובד (ניהול) (/employees/[id]) וטופס עובד חדש (/employees/new): עטיפה דקה שבוחרת בין הכרטיס הישן
// (LegacyEmployeeCardPage.js - הועבר 1:1 מהקובץ הזה, כולל תיקוני השמירה של fix/employee-card-save-errors-2026-10-04) לכרטיס החדש
// (app/components/employee-card/*) לפי הדגל ui_variant_employee_card (useUiVariant('employee_card')).
// ברירת מחדל 'legacy' = האתר זהה לקודם; ההדלקה היא צעד נפרד באישור הבעלים.
import EmployeeCardSwitch from '@/app/components/employee-card/EmployeeCardSwitch';

export default function EmployeePage({ params }) {
  return <EmployeeCardSwitch params={params} />;
}
