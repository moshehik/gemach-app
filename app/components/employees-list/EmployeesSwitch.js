'use client';

import dynamic from 'next/dynamic';
import { useUiVariant } from '../UiVariantContext';
import VariantFrame from '../variant/VariantFrame';
import LegacyEmployeesListPage from '@/app/employees/LegacyEmployeesListPage';

// רשימת עובדים (/employees): 'legacy' (ברירת מחדל לכולם חוץ מהמתכנת) = הדף הקודם כפי שהוא (LegacyEmployeesListPage.js = app/employees/page.js של main
// 51eae39f, בייט-בבייט); 'a5' = הרשימה החדשה (העיצוב המאושר employees.html). הרשימה החדשה נטענת בנפרד (dynamic, בלי SSR) כמו שאר המסכים:
// קובץ ה-CSS של הפלטה (~460KB) לא נטען כשהדגל 'legacy'.
//
// הקשר למסך 'attendance' (אותו נתיב): הדף הישן כולו מארח את לשונית הנוכחות הישנה, ולכן כש-attendance='legacy' מוצג הדף הישן כמו שהוא
// (הוא עצמו עוטף ב-VariantFrame של attendance) וההכרעה של employees_list לא נבדקת. כש-attendance='a5' הכרעת employees_list קובעת: חדש = הרשימה
// החדשה (הלשונית "נוכחות" שלה מובילה ל-/employees/attendance), ישן = הדף הישן עם אייקון המעבר לחדש בפינה (VariantFrame של employees_list).
const EmployeesListA5 = dynamic(() => import('./EmployeesListA5'), { ssr: false });

export default function EmployeesSwitch() {
  const attendance = useUiVariant('attendance');
  const variant = useUiVariant('employees_list');
  if (attendance === 'legacy') return <LegacyEmployeesListPage />;
  if (variant !== 'a5') return <VariantFrame screen="employees_list" variant="legacy"><LegacyEmployeesListPage /></VariantFrame>;
  return <VariantFrame screen="employees_list" variant="a5"><EmployeesListA5 /></VariantFrame>;
}
