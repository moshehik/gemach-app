// היסטוריית ההנהלה - שאילתות ו-API (/management/history): עטיפה דקה שבוחרת בין הדף הישן (LegacyManagementHistoryPage.js - הועבר 1:1 מהקובץ הזה) לרשימה החדשה
// (app/components/history-lists/ManagementHistoryA5.js) לפי הדגל ui_variant_management_history (useUiVariant('management_history')). ברירת מחדל: מתכנת חדש, כל השאר ישן.
import ManagementHistorySwitch from '@/app/components/history-lists/ManagementHistorySwitch';

export default function ManagementHistoryPage() {
  return <ManagementHistorySwitch />;
}
