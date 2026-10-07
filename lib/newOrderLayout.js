// צורת טופס "הזמנה חדשה" (האשף החדש A5) - ההגדרה new_order_layout ב-SystemSetting (לפי ארגון, כמו שאר ההגדרות).
//   wizard     - אשף שלבים: שלב אחד על המסך ושורת ניווט (ברירת מחדל; שורה חסרה / ערך לא מוכר = אשף, בדיוק ההתנהגות הקיימת)
//   continuous - טופס רציף בעמוד אחד נגלל: כל השלבים כגושים בזה אחר זה, שלב מאוחר נעול (מעומעם) עד שתנאי הנעילה של האשף מתקיימים
// מקור יחיד גם לרשימת האפשרויות בעמוד ההגדרות (lib/settingsMetadata.js) וגם להכרעה באשף (useNewOrderController) - כמו lib/orderRedirectScreens.js.
// לא נוגע באשף הישן (LegacyNewOrderPage) - הוא תמיד מציג את אותו טופס.
export const NEW_ORDER_LAYOUT_KEY = 'new_order_layout';
export const DEFAULT_NEW_ORDER_LAYOUT = 'wizard';
export const NEW_ORDER_LAYOUTS = [
  { value: 'wizard', label: 'אשף שלבים (ברירת מחדל)' },
  { value: 'continuous', label: 'טופס רציף בעמוד אחד נגלל' },
];

// ערך ההגדרה -> צורה תקפה. רק 'continuous' (בדיוק) מדליק את הטופס הרציף; כל דבר אחר (חסר, ריק, שגיאת הקלדה) = אשף
export function resolveNewOrderLayout(value) {
  return String(value == null ? '' : value).trim() === 'continuous' ? 'continuous' : DEFAULT_NEW_ORDER_LAYOUT;
}
