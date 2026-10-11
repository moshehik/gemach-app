// רשימת עובדים (/employees): עטיפה דקה שבוחרת בין הדף הישן (app/employees/LegacyEmployeesListPage.js - הועבר 1:1 מהקובץ הזה, ר' EmployeesSwitch)
// לרשימה החדשה (app/components/employees-list/*) לפי הדגל ui_variant_employees_list (useUiVariant('employees_list')). ברירת מחדל: מתכנת חדש, כל השאר ישן.
// הדגל של לשונית הנוכחות (ui_variant_attendance) ממשיך להכריע את הדף הישן עם לשונית הנוכחות הישנה - ר' lib/uiVariantScreens.js.
'use client';

import EmployeesSwitch from '../components/employees-list/EmployeesSwitch';

export default function EmployeesRoute() {
  return <EmployeesSwitch />;
}
