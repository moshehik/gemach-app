// היסטוריית נתונים (/admin/data-history): עטיפה דקה שבוחרת בין הדף הישן (LegacyDataHistoryPage.js - הועבר 1:1 מהקובץ הזה) ליומן החדש
// (app/components/history-lists/DataHistoryA5.js) לפי הדגל ui_variant_data_history (useUiVariant('data_history')). ברירת מחדל: מתכנת חדש, כל השאר ישן.
import DataHistorySwitch from '@/app/components/history-lists/DataHistorySwitch';

export default function DataHistoryPage() {
  return <DataHistorySwitch />;
}
