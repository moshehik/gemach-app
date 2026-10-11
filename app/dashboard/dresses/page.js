// רשימת הדגמים (/dashboard/dresses): עטיפה דקה שבוחרת בין הדף הישן (app/dashboard/dresses/LegacyDressesListPage.js - הועבר 1:1 מהקובץ הזה)
// לרשימה החדשה (app/components/models-list/*) לפי הדגל ui_variant_models_list (useUiVariant('models_list')). ברירת מחדל: מתכנת חדש, כל השאר ישן.
'use client';

import ModelsListSwitch from '@/app/components/models-list/ModelsListSwitch';

export default function DressesManagement() {
  return <ModelsListSwitch />;
}
