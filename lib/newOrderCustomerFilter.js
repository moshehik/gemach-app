// הגדרה new_order_customer_list_filter - אילו לקוחות מופיעים בבורר "לקוח קיים" במסך הזמנה חדשה (חיפוש לפי טלפון, וחיפוש מהרשימה).
//   all      - כל הלקוחות הפעילים (לא מחוקים). ברירת מחדל, וגם כשהשורה חסרה / ערך לא מוכר = ההתנהגות הקיימת, בלי שינוי
//   complete - רק לקוחות "תקינים": שיש להם את כל הפרטים שהמערכת דורשת ביצירת לקוח חדש בגמ"ח הזה (lib/customerCompleteness.js)
// מקור יחיד לרשימת האפשרויות בעמוד ההגדרות (lib/settingsMetadata.js) ולהכרעה בשרת (lib/customerPickerFilter.js) - כמו lib/newOrderLayout.js.
// הסינון שקוף לגמרי: בכרטיסייה/ברשימה אין שום כיתוב, ספירה או תג (דרישת הבעלים) - לקוחה שלא תקינה פשוט לא נמצאת בחיפוש.
export const NEW_ORDER_CUSTOMER_FILTER_KEY = 'new_order_customer_list_filter';
export const DEFAULT_NEW_ORDER_CUSTOMER_FILTER = 'all';
export const NEW_ORDER_CUSTOMER_FILTERS = [
  { value: 'all', label: 'כל הלקוחות הפעילים' },
  { value: 'complete', label: 'רק לקוחות עם כל הפרטים' },
];
// הפרמטר ש-GET /api/customers מזהה כבורר של הזמנה חדשה (בלעדיו - כל שאר המסכים, כולל /customers, לא מושפעים בכלל)
export const NEW_ORDER_PICKER_PARAM = 'pickerFor';
export const NEW_ORDER_PICKER_VALUE = 'new-order';

// ערך ההגדרה -> מצב תקף. רק 'complete' (בדיוק) מדליק את הסינון; כל דבר אחר (חסר, ריק, שגיאת הקלדה) = כולם
export function resolveNewOrderCustomerFilter(value) {
  return String(value == null ? '' : value).trim() === 'complete' ? 'complete' : DEFAULT_NEW_ORDER_CUSTOMER_FILTER;
}
