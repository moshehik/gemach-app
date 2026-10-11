// ניהול מחלקות (/admin/departments): עטיפה דקה שבוחרת בין הדף הישן (LegacyDepartmentsPage.js - הועבר 1:1 מהקובץ הזה) לרשימה החדשה (app/components/departments/*)
// לפי הדגל ui_variant_departments (useUiVariant('departments')). ברירת מחדל: מתכנת חדש, כל השאר ישן. השער: app/admin/layout.js + ה-API (/api/departments).
'use client';

import DepartmentsSwitch from '@/app/components/departments/DepartmentsSwitch';

export default function DepartmentsAdminPage() {
  return <DepartmentsSwitch />;
}
